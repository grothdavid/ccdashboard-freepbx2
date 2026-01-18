import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FreePBXService } from './services/freepbxService.js';
import { WebSocketHandler } from './services/websocketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Socket.IO CORS configuration
const corsOptions = process.env.NODE_ENV === 'production' 
  ? {
      origin: true, // Reflect request origin in production
      methods: ['GET', 'POST'],
      credentials: true,
    }
  : {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    };

const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
});

// Express CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : '*',
  credentials: true,
}));
app.use(express.json());

// Prevent caching of API responses
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// In-memory store for active calls (from connector events)
const activeCallsMap = new Map();

// Initialize FreePBX service
const freepbxService = new FreePBXService(
  process.env.PBX_CONNECTOR_ENDPOINT,
  process.env.PBX_CONNECTOR_SECRET
);

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(io, freepbxService, activeCallsMap);

// Set circular reference for call data
freepbxService.wsHandler = wsHandler;

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    connector: freepbxService.connectorUrl,
    environment: process.env.NODE_ENV
  });
});

app.get('/api/agents', async (req, res) => {
  try {
    const agents = await freepbxService.getAgents();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queues', async (req, res) => {
  try {
    const [agents, queues] = await Promise.all([
      freepbxService.getAgents(),
      freepbxService.getQueues()
    ]);
    
    // Update queue agent counts based on actual agents assigned to each queue
    queues.forEach(queue => {
      const queueAgents = agents.filter(agent => 
        agent.departments?.includes(queue.id) || 
        agent.departmentId === queue.id ||
        agent.department === queue.name
      );
      
      // Update counts if not already provided by connector
      if (queue.agents === 0) queue.agents = queueAgents.length;
      if (queue.agentsAvailable === 0) queue.agentsAvailable = queueAgents.filter(a => a.status === 'available').length;
      if (queue.agentsOnCall === 0) queue.agentsOnCall = queueAgents.filter(a => a.currentCall).length;
    });
    
    res.json(queues);
  } catch (error) {
    console.error('Error fetching queues:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls', async (req, res) => {
  try {
    const calls = await freepbxService.getActiveCalls();
    res.json(calls);
  } catch (error) {
    console.error('Error fetching calls:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await freepbxService.getCallCenterStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Connector webhook endpoints
app.post('/api/connector/update', (req, res) => {
  try {
    const updateData = req.body;
    console.log('\n=== CONNECTOR UPDATE RECEIVED ===');
    console.log('Source:', updateData.source);
    console.log('Timestamp:', updateData.timestamp);
    
    // Broadcast update to all connected clients
    if (updateData.data) {
      io.emit('connector:update', updateData.data);
    }
    
    res.json({ status: 'received' });
  } catch (error) {
    console.error('Connector update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/connector/event', (req, res) => {
  try {
    const event = req.body;
    console.log(`\n=== CONNECTOR EVENT: ${event.type} ===`);
    console.log('Timestamp:', event.timestamp);
    console.log('Data:', JSON.stringify(event.data, null, 2));
    
    // Handle specific event types
    if (event.type === 'call.started') {
      wsHandler.handleCallStarted(event.data);
    } else if (event.type === 'call.ended') {
      wsHandler.handleCallEnded(event.data);
    } else if (event.type === 'agent.status') {
      wsHandler.handleAgentStatus(event.data);
    }
    
    // Broadcast event to all connected clients
    io.emit('connector:event', event);
    
    res.json({ status: 'received' });
  } catch (error) {
    console.error('Connector event error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Test connector endpoint
app.get('/api/connector/test', async (req, res) => {
  try {
    const testResult = await freepbxService.testConnection();
    res.json(testResult);
  } catch (error) {
    console.error('Connector test error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  console.log('✅ Client connected:', socket.id);
  console.log('   From:', clientIp);
  console.log('   Total clients:', io.engine.clientsCount);
  console.log('   Transport:', socket.conn.transport.name);
  
  // Send initial data to new client
  freepbxService.getCallCenterStats().then(stats => {
    socket.emit('dashboard:initial_stats', stats);
  }).catch(error => {
    console.error('Error sending initial stats:', error.message);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id);
    console.log('   Reason:', reason);
    console.log('   Total clients:', io.engine.clientsCount);
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 FreePBX Dashboard Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Connector: ${freepbxService.connectorUrl}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  
  // Start WebSocket handler
  wsHandler.startPolling();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  wsHandler.stopPolling();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  wsHandler.stopPolling();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});