import { create } from 'zustand';
import { io } from 'socket.io-client';

// Create socket instance outside of store to prevent recreation on HMR
// Automatically detect the correct server URL:
// - In production (built with vite build): connect to same origin
// - In development (vite dev server): connect to backend on localhost:3000
const getSocketUrl = () => {
  // Check if we're in production mode (built/deployed)
  if (import.meta.env.PROD) {
    // Use current domain - works in any Azure environment
    return window.location.origin;
  }
  // Development mode - connect to local backend
  return 'http://localhost:3000';
};

const socketUrl = getSocketUrl();

let socket;
if (!socket) {
  socket = io(socketUrl, {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    // Force new connection on reconnect
    forceNew: false,
  });
  console.log('Socket.IO client initialized');
  console.log('Environment:', import.meta.env.PROD ? 'Production' : 'Development');
  console.log('Connecting to:', socketUrl);
}

export const useDashboardStore = create((set, get) => ({
  // State
  agents: [],
  queues: [],
  calls: [],
  stats: null,
  alerts: [],
  connected: false,
  loading: true,
  error: null,
  selectedQueue: 'all', // Global queue filter

  // Socket connection
  socket,

  // Actions
  setAgents: (agents) => set({ agents }),
  setQueues: (queues) => set({ queues }),
  setCalls: (calls) => set({ calls }),
  setStats: (stats) => set({ stats }),
  setAlerts: (alerts) => set({ alerts }),
  setConnected: (connected) => set({ connected }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSelectedQueue: (selectedQueue) => set({ selectedQueue }),

  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 50), // Keep last 50 alerts
  })),

  dismissAlert: (index) => set((state) => ({
    alerts: state.alerts.filter((_, i) => i !== index),
  })),

  clearAlerts: () => set({ alerts: [] }),

  // Initialize socket listeners
  initializeSocket: () => {
    const { socket } = get();

    console.log('Initializing socket connection to', socketUrl);
    console.log('Socket transport:', socket.io.opts.transports);

    // Set a timeout to stop loading even if connection fails
    setTimeout(() => {
      const state = get();
      if (state.loading) {
        console.log('Connection timeout - stopping loading state');
        set({ loading: false, error: 'Connection timeout - using mock data' });
      }
    }, 5000);

    socket.on('connect', () => {
      console.log('Socket connected with ID:', socket.id);
      set({ connected: true, error: null, loading: false });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      set({ connected: false });
    });

    socket.on('connect_error', (error) => {
      console.log('Socket connection error:', error.message);
      set({ error: error.message, loading: false, connected: false });
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      set({ connected: true, error: null });
    });

    socket.on('reconnect_error', (error) => {
      console.log('Socket reconnection failed:', error.message);
      set({ error: error.message, connected: false });
    });

    socket.on('agents:update', (agents) => {
      console.log('Received agents update:', agents.length);
      set({ agents, loading: false });
    });

    socket.on('queues:update', (queues) => {
      console.log('Received queues update:', queues.length);
      set({ queues, loading: false });
    });

    socket.on('calls:update', (calls) => {
      console.log('Received calls update:', calls.length);
      set({ calls, loading: false });
    });

    socket.on('stats:update', (stats) => {
      console.log('Received stats update');
      set({ stats, loading: false });
    });

    socket.on('alerts', (newAlerts) => {
      set((state) => ({
        alerts: [...newAlerts, ...state.alerts].slice(0, 50),
      }));
    });

    socket.on('error', (error) => {
      set({ error: error.message });
    });
  },

  // Cleanup - just remove listeners, keep socket connected
  cleanup: () => {
    // Don't disconnect the socket - let it stay connected
    // This prevents issues with React Strict Mode in development
    console.log('Cleanup called - socket stays connected');
  },
}));