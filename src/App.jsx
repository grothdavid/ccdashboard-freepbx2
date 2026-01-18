import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// Components
import AgentGrid from './components/AgentGrid';
import QueueGrid from './components/QueueGrid';
import CallList from './components/CallList';
import StatsCards from './components/StatsCards';
import AlertBanner from './components/AlertBanner';

function App() {
  const [agents, setAgents] = useState([]);
  const [queues, setQueues] = useState([]);
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const socketConnection = io({
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    socketConnection.on('connect', () => {
      console.log('✅ Connected to dashboard server');
      setConnectionStatus('connected');
      
      // Request initial data
      fetchInitialData();
    });

    socketConnection.on('disconnect', () => {
      console.log('❌ Disconnected from dashboard server');
      setConnectionStatus('disconnected');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('error');
    });

    // Real-time data updates
    socketConnection.on('dashboard:agents', setAgents);
    socketConnection.on('dashboard:queues', setQueues);
    socketConnection.on('dashboard:calls', setCalls);
    socketConnection.on('dashboard:stats', setStats);
    socketConnection.on('dashboard:alerts', setAlerts);

    // Individual updates
    socketConnection.on('agent:updated', (updatedAgent) => {
      setAgents(prev => 
        prev.map(agent => 
          agent.id === updatedAgent.id ? updatedAgent : agent
        )
      );
    });

    socketConnection.on('call:started', (call) => {
      setCalls(prev => [...prev, call]);
    });

    socketConnection.on('call:ended', (call) => {
      setCalls(prev => prev.filter(c => c.id !== call.id));
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [agentsRes, queuesRes, callsRes, statsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/queues'),
        fetch('/api/calls'),
        fetch('/api/stats')
      ]);

      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (queuesRes.ok) setQueues(await queuesRes.json());
      if (callsRes.ok) setCalls(await callsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                FreePBX Contact Center Dashboard
              </h1>
              <div className={`ml-4 px-2 py-1 text-xs rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {connectionStatus}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      {/* Alert Banner */}
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <StatsCards stats={stats} agents={agents} calls={calls} />

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Agents */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Agents ({agents.length})
              </h3>
              <div className="mt-4">
                <AgentGrid agents={agents} />
              </div>
            </div>
          </div>

          {/* Queues */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Queues ({queues.length})
              </h3>
              <div className="mt-4">
                <QueueGrid queues={queues} />
              </div>
            </div>
          </div>
        </div>

        {/* Active Calls */}
        <div className="bg-white overflow-hidden shadow rounded-lg mt-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Active Calls ({calls.length})
            </h3>
            <div className="mt-4">
              <CallList calls={calls} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;