import axios from 'axios';

export class FreePBXService {
  constructor(connectorUrl, authToken = null, wsHandler = null) {
    this.connectorUrl = connectorUrl || process.env.PBX_CONNECTOR_ENDPOINT || 'http://localhost:8080';
    this.authToken = authToken || process.env.PBX_CONNECTOR_SECRET;
    this.wsHandler = wsHandler;
    
    this.client = axios.create({
      baseURL: this.connectorUrl,
      headers: {
        'Authorization': this.authToken ? `Bearer ${this.authToken}` : undefined,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    // Use mock data if no connector endpoint configured
    this.useMockData = !this.connectorUrl || this.connectorUrl === 'http://localhost:8080';
    
    console.log(`FreePBX Service initialized - Connector: ${this.connectorUrl}, Mock: ${this.useMockData}`);
  }

  async getAgents() {
    if (this.useMockData) {
      return this.getMockAgents();
    }

    try {
      const response = await this.client.get('/api/agents');
      const agents = response.data || [];

      if (!agents.length) {
        console.log('No agents returned from connector, using mock data');
        return this.getMockAgents();
      }

      // Map connector data to dashboard format
      const mappedAgents = agents.map((agent) => {
        // Get active call details from webhook handler if available
        let currentCall = null;
        if (this.wsHandler && agent.status === 'busy' && agent.currentCall) {
          const callDetails = this.wsHandler.getActiveCallForUser(agent.id);
          if (callDetails) {
            currentCall = {
              status: 'active',
              phoneNumber: callDetails.phoneNumber,
              callerName: callDetails.callerName,
              direction: callDetails.direction,
              duration: callDetails.duration,
              queueName: callDetails.queueName || agent.department,
              queueId: callDetails.queueId || agent.departmentId,
            };
          } else if (agent.currentCall) {
            // Use data from connector
            currentCall = {
              status: 'active',
              phoneNumber: agent.currentCall.phoneNumber || 'Unknown',
              callerName: agent.currentCall.callerName || null,
              direction: agent.currentCall.direction || 'unknown',
              duration: agent.currentCall.duration || 0,
              queueName: agent.currentCall.queueName || agent.department,
              queueId: agent.currentCall.queueId || agent.departmentId,
            };
          }
        }

        return {
          id: agent.id || agent.extension,
          name: agent.name || `Extension ${agent.extension}`,
          email: agent.email || `${agent.extension}@pbx.local`,
          status: this.mapAsteriskStatusToStandard(agent.status),
          statusReason: agent.statusReason || '',
          extension: agent.extension,
          department: agent.department || 'Default',
          departmentId: agent.departmentId || 'default',
          departments: agent.departments || [agent.departmentId || 'default'],
          currentCall: currentCall,
          lastStatusChange: agent.lastStatusChange || new Date().toISOString(),
          deviceState: agent.deviceState || 'UNKNOWN',
          channelState: agent.channelState || 'Available',
        };
      });

      console.log(`Fetched ${mappedAgents.length} agents from FreePBX connector`);
      return mappedAgents;
    } catch (error) {
      console.error('Error fetching agents from connector:', error.message);
      if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
        console.error('FreePBX connector unavailable. Using mock data.');
      }
      return this.getMockAgents();
    }
  }

  async getQueues() {
    if (this.useMockData) {
      return this.getMockQueues();
    }

    try {
      const response = await this.client.get('/api/queues');
      const queues = response.data || [];

      if (!queues.length) {
        console.log('No queues returned from connector, using mock data');
        return this.getMockQueues();
      }

      // Map connector data to dashboard format
      const mappedQueues = queues.map((queue) => ({
        id: queue.id || queue.extension,
        name: queue.name || `Queue ${queue.extension}`,
        extension: queue.extension,
        waitingCalls: queue.waitingCalls || 0,
        longestWait: queue.longestWait || 0,
        longestWaitTime: queue.longestWait || 0,
        averageWait: queue.averageWait || 0,
        avgWaitTime: queue.averageWait || 0,
        totalCalls: queue.totalCalls || 0,
        answeredCalls: queue.answeredCalls || 0,
        callsAnswered: queue.answeredCalls || 0,
        abandonedCalls: queue.abandonedCalls || 0,
        callsAbandoned: queue.abandonedCalls || 0,
        serviceLevel: queue.serviceLevel || 0,
        agents: queue.totalAgents || 0,
        agentsAvailable: queue.agentsAvailable || 0,
        agentsOnCall: queue.agentsOnCall || 0,
        agentsBusy: queue.agentsBusy || 0,
        agentsPaused: queue.agentsPaused || 0,
        status: queue.status || 'open',
        strategy: queue.strategy || 'ringall',
        timeout: queue.timeout || 15,
        retry: queue.retry || 5,
        wrapuptime: queue.wrapuptime || 0,
      }));

      console.log(`Fetched ${mappedQueues.length} queues from FreePBX connector`);
      return mappedQueues;
    } catch (error) {
      console.error('Error fetching queues from connector:', error.message);
      return this.getMockQueues();
    }
  }

  async getActiveCalls() {
    if (this.useMockData) {
      return this.getMockCalls();
    }

    try {
      const response = await this.client.get('/api/calls');
      const calls = response.data || [];

      // Map connector data to dashboard format
      const mappedCalls = calls.map((call) => ({
        id: call.id || call.uniqueid,
        uniqueid: call.uniqueid,
        channel: call.channel,
        direction: call.direction || 'unknown',
        from: call.callerid || call.from || 'Unknown',
        fromName: call.callerName || null,
        to: call.destination || call.to || 'Unknown',
        toName: null,
        agentId: call.agentId || call.extension,
        agentName: call.agentName || `Extension ${call.extension}`,
        agentExtension: call.extension,
        duration: call.duration || 0,
        state: call.state || 'active',
        status: call.status || 'active',
        startTime: call.startTime || new Date().toISOString(),
        queueName: call.queueName || 'Direct Call',
        queueId: call.queueId || 'direct',
        bridgedChannel: call.bridgedChannel || null,
        context: call.context || 'default',
        priority: call.priority || '1',
        application: call.application || null,
      }));

      console.log(`Fetched ${mappedCalls.length} active calls from FreePBX connector`);
      return mappedCalls;
    } catch (error) {
      console.error('Error fetching calls from connector:', error.message);
      return this.getMockCalls();
    }
  }

  async getCallCenterStats() {
    try {
      const [agents, queues, calls] = await Promise.all([
        this.getAgents(),
        this.getQueues(),
        this.getActiveCalls(),
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

      const agentStatuses = agents.reduce((acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      }, {});

      const totalWaiting = queues.reduce((sum, q) => sum + q.waitingCalls, 0);
      const totalAnswered = queues.reduce((sum, q) => sum + q.answeredCalls, 0);
      const totalAbandoned = queues.reduce((sum, q) => sum + q.abandonedCalls, 0);

      return {
        agents: {
          total: agents.length,
          available: agentStatuses.available || 0,
          busy: agentStatuses.busy || 0,
          offline: agentStatuses.offline || 0,
          away: agentStatuses.away || 0,
          paused: agentStatuses.paused || 0,
        },
        calls: {
          active: calls.length,
          waiting: totalWaiting,
          answered: totalAnswered,
          abandoned: totalAbandoned,
        },
        queues: {
          total: queues.length,
          averageWaitTime: queues.reduce((sum, q) => sum + q.averageWait, 0) / (queues.length || 1),
          longestWaitTime: Math.max(...queues.map(q => q.longestWait), 0),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching call center stats:', error.message);
      throw error;
    }
  }

  // Map Asterisk device/channel states to standard dashboard statuses
  mapAsteriskStatusToStandard(status) {
    if (!status) return 'offline';
    
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'not_inuse':
      case 'available':
      case 'idle':
      case 'free':
        return 'available';
      case 'inuse':
      case 'busy':
      case 'ringing':
      case 'ringinuse':
        return 'busy';
      case 'unavailable':
      case 'paused':
      case 'dnd':
        return 'away';
      case 'unknown':
      case 'invalid':
      case 'unreachable':
        return 'offline';
      default:
        return 'offline';
    }
  }

  // Test connection to local connector
  async testConnection() {
    try {
      const response = await this.client.get('/api/health');
      return {
        success: true,
        status: response.data,
        connector: this.connectorUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        connector: this.connectorUrl,
      };
    }
  }

  // Mock data methods for demonstration/testing
  getMockAgents() {
    const statuses = ['available', 'busy', 'away', 'offline'];
    const departments = ['Sales Queue', 'Support Queue', 'Technical Queue', 'General Queue'];
    const names = [
      'John Smith', 'Sarah Johnson', 'Mike Davis', 'Emily Brown', 
      'David Wilson', 'Lisa Anderson', 'Tom Martinez', 'Jessica Taylor',
      'Chris Garcia', 'Amanda White', 'Kevin Jones', 'Rachel Green'
    ];
    
    return names.map((name, i) => {
      const extension = `${1000 + i}`;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const department = departments[i % departments.length];
      
      let currentCall = null;
      if (status === 'busy' && Math.random() > 0.7) {
        currentCall = {
          status: 'active',
          phoneNumber: `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
          callerName: ['Acme Corp', 'Tech Solutions', 'Global Inc', 'Smith & Associates'][Math.floor(Math.random() * 4)],
          direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
          duration: Math.floor(Math.random() * 600),
          queueName: department,
          queueId: `queue_${(i % 4) + 1}`,
        };
      }

      return {
        id: `agent_${i + 1}`,
        name,
        email: name.toLowerCase().replace(' ', '.') + '@company.com',
        status: status,
        statusReason: status === 'away' ? 'Break' : '',
        extension: extension,
        department: department,
        departmentId: `queue_${(i % 4) + 1}`,
        departments: [`queue_${(i % 4) + 1}`],
        currentCall: currentCall,
        lastStatusChange: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        deviceState: 'NOT_INUSE',
        channelState: 'Available',
      };
    });
  }

  getMockQueues() {
    return [
      {
        id: 'queue_1',
        name: 'Sales Queue',
        extension: '7001',
        waitingCalls: Math.floor(Math.random() * 5),
        longestWait: Math.floor(Math.random() * 300),
        averageWait: Math.floor(Math.random() * 120),
        totalCalls: 150,
        answeredCalls: 142,
        abandonedCalls: 8,
        serviceLevel: 94.7,
        agents: 8,
        agentsAvailable: 5,
        agentsOnCall: 3,
        status: 'open',
        strategy: 'rrmemory',
        timeout: 15,
        retry: 5,
      },
      {
        id: 'queue_2',
        name: 'Support Queue',
        extension: '7002',
        waitingCalls: Math.floor(Math.random() * 8),
        longestWait: Math.floor(Math.random() * 400),
        averageWait: Math.floor(Math.random() * 90),
        totalCalls: 230,
        answeredCalls: 220,
        abandonedCalls: 10,
        serviceLevel: 95.7,
        agents: 12,
        agentsAvailable: 7,
        agentsOnCall: 5,
        status: 'open',
        strategy: 'linear',
        timeout: 20,
        retry: 3,
      },
      {
        id: 'queue_3',
        name: 'Technical Queue',
        extension: '7003',
        waitingCalls: Math.floor(Math.random() * 3),
        longestWait: Math.floor(Math.random() * 200),
        averageWait: Math.floor(Math.random() * 60),
        totalCalls: 85,
        answeredCalls: 82,
        abandonedCalls: 3,
        serviceLevel: 96.5,
        agents: 6,
        agentsAvailable: 4,
        agentsOnCall: 2,
        status: 'open',
        strategy: 'ringall',
        timeout: 30,
        retry: 2,
      },
      {
        id: 'queue_4',
        name: 'General Queue',
        extension: '7000',
        waitingCalls: Math.floor(Math.random() * 10),
        longestWait: Math.floor(Math.random() * 600),
        averageWait: Math.floor(Math.random() * 180),
        totalCalls: 320,
        answeredCalls: 305,
        abandonedCalls: 15,
        serviceLevel: 95.3,
        agents: 15,
        agentsAvailable: 8,
        agentsOnCall: 7,
        status: 'open',
        strategy: 'rrmemory',
        timeout: 25,
        retry: 4,
      },
    ];
  }

  getMockCalls() {
    const activeCount = Math.floor(Math.random() * 8) + 2;
    const calls = [];
    const directions = ['inbound', 'outbound', 'internal'];
    const callerNames = [
      'Acme Corporation', 'Tech Solutions Inc', 'Global Enterprises', 
      'Smith & Associates', 'Johnson LLC', 'Anderson Partners',
      'Wilson Industries', 'Davis Group', 'Brown Holdings'
    ];
    const queues = [
      { id: 'queue_1', name: 'Sales Queue' },
      { id: 'queue_2', name: 'Support Queue' },
      { id: 'queue_3', name: 'Technical Queue' },
      { id: 'queue_4', name: 'General Queue' }
    ];
    
    for (let i = 0; i < activeCount; i++) {
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const queue = queues[Math.floor(Math.random() * queues.length)];
      const agentExt = 1000 + Math.floor(Math.random() * 12);
      
      calls.push({
        id: `call_${Date.now()}_${i}`,
        uniqueid: `${Date.now()}.${i}`,
        channel: `SIP/${agentExt}-0000${i.toString().padStart(4, '0')}`,
        direction: direction,
        from: direction === 'outbound' ? agentExt.toString() : `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
        fromName: direction === 'inbound' ? callerNames[Math.floor(Math.random() * callerNames.length)] : null,
        to: direction === 'inbound' ? agentExt.toString() : `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
        toName: direction === 'outbound' ? callerNames[Math.floor(Math.random() * callerNames.length)] : null,
        agentId: `agent_${agentExt - 999}`,
        agentName: ['John Smith', 'Sarah Johnson', 'Mike Davis', 'Emily Brown'][Math.floor(Math.random() * 4)],
        agentExtension: agentExt.toString(),
        duration: Math.floor(Math.random() * 600),
        state: 'active',
        startTime: new Date(Date.now() - Math.random() * 600000).toISOString(),
        queueName: direction === 'internal' ? 'Direct Call' : queue.name,
        queueId: direction === 'internal' ? 'direct' : queue.id,
        bridgedChannel: direction !== 'internal' ? `Queue/${queue.id.replace('queue_', '700')}-0000${i.toString().padStart(4, '0')}` : null,
        context: 'from-internal',
        priority: '1',
        application: direction === 'internal' ? 'Dial' : 'Queue',
      });
    }
    
    return calls;
  }
}