export class WebSocketHandler {
  constructor(io, freepbxService, activeCallsMap) {
    this.io = io;
    this.freepbxService = freepbxService;
    this.activeCallsMap = activeCallsMap || new Map();
    this.pollingInterval = null;
    this.updateInterval = process.env.DATA_REFRESH_INTERVAL || 5000;
    this.lastAlertCheck = new Date();
  }

  // Handle call events from connector
  handleCallStarted(callData) {
    console.log(`📞 Call started: ${callData.callerid} -> ${callData.extension}`);
    
    const callInfo = {
      id: callData.uniqueid || `call_${Date.now()}`,
      uniqueid: callData.uniqueid,
      phoneNumber: callData.callerid || 'Unknown',
      callerName: callData.callername || null,
      extension: callData.extension,
      direction: callData.direction || 'unknown',
      startTime: new Date().toISOString(),
      duration: 0,
      queueName: callData.queueName || 'Direct Call',
      queueId: callData.queueId || 'direct'
    };
    
    this.activeCallsMap.set(callInfo.id, callInfo);
    
    // Broadcast call started event
    this.io.emit('call:started', callInfo);
    
    // Update agent status if extension is provided
    if (callData.extension) {
      this.broadcastCallUpdate(callData.extension);
    }
  }

  handleCallEnded(callData) {
    console.log(`📞 Call ended: ${callData.uniqueid}`);
    
    // Find and remove call from active calls
    let removedCall = null;
    for (const [callId, call] of this.activeCallsMap.entries()) {
      if (call.uniqueid === callData.uniqueid || call.id === callData.uniqueid) {
        removedCall = call;
        this.activeCallsMap.delete(callId);
        break;
      }
    }
    
    if (removedCall) {
      // Calculate final duration
      const duration = Math.floor((new Date() - new Date(removedCall.startTime)) / 1000);
      removedCall.duration = duration;
      
      // Broadcast call ended event
      this.io.emit('call:ended', {
        ...removedCall,
        endTime: new Date().toISOString(),
        disposition: callData.disposition || 'ANSWERED'
      });
      
      // Update agent status
      if (removedCall.extension) {
        this.broadcastCallUpdate(removedCall.extension);
      }
    }
  }

  handleAgentStatus(agentData) {
    console.log(`👤 Agent status: ${agentData.extension} -> ${agentData.status}`);
    
    // Broadcast agent status update
    this.io.emit('agent:status', agentData);
  }

  async broadcastCallUpdate(extension) {
    try {
      // Get updated agent data for the specific extension
      const agents = await this.freepbxService.getAgents();
      const agent = agents.find(a => a.extension === extension);
      
      if (agent) {
        this.io.emit('agent:updated', agent);
      }
    } catch (error) {
      console.error('Error broadcasting call update:', error.message);
    }
  }

  getActiveCallForUser(userId) {
    // Find active call for user/extension
    for (const call of this.activeCallsMap.values()) {
      if (call.extension === userId || call.id === userId) {
        // Update duration
        call.duration = Math.floor((new Date() - new Date(call.startTime)) / 1000);
        return call;
      }
    }
    return null;
  }

  startPolling() {
    if (this.pollingInterval) {
      return; // Already polling
    }

    console.log(`🔄 Starting data polling every ${this.updateInterval}ms`);
    
    this.pollingInterval = setInterval(() => {
      this.broadcastUpdates();
    }, this.updateInterval);
    
    // Initial broadcast
    this.broadcastUpdates();
  }

  stopPolling() {
    if (this.pollingInterval) {
      console.log('🛑 Stopping data polling');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async broadcastUpdates() {
    try {
      // Get all current data
      const [agents, queues, calls, stats] = await Promise.all([
        this.freepbxService.getAgents(),
        this.freepbxService.getQueues(),
        this.freepbxService.getActiveCalls(),
        this.freepbxService.getCallCenterStats(),
      ]);

      // Update call durations
      this.updateCallDurations();

      // Broadcast updates
      this.io.emit('dashboard:agents', agents);
      this.io.emit('dashboard:queues', queues);
      this.io.emit('dashboard:calls', calls);
      this.io.emit('dashboard:stats', stats);

      // Check for alerts
      this.checkAndEmitAlerts(queues, agents);

      console.log(`📊 Data broadcast: ${agents.length} agents, ${queues.length} queues, ${calls.length} calls`);

    } catch (error) {
      console.error('Error broadcasting updates:', error.message);
      
      // Emit error to clients
      this.io.emit('dashboard:error', {
        message: 'Data update failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  updateCallDurations() {
    // Update durations for all active calls
    const now = new Date();
    for (const call of this.activeCallsMap.values()) {
      call.duration = Math.floor((now - new Date(call.startTime)) / 1000);
    }
  }

  checkAndEmitAlerts(queues, agents) {
    const now = new Date();
    
    // Only check alerts every 30 seconds
    if (now - this.lastAlertCheck < 30000) {
      return;
    }
    
    this.lastAlertCheck = now;
    
    const alerts = [];
    
    // Check for long wait times
    queues.forEach(queue => {
      if (queue.longestWait > 300) { // 5 minutes
        alerts.push({
          type: 'warning',
          title: 'Long Wait Time',
          message: `Queue "${queue.name}" has calls waiting ${Math.floor(queue.longestWait / 60)} minutes`,
          queueId: queue.id,
          timestamp: now.toISOString()
        });
      }
      
      if (queue.waitingCalls > 10) {
        alerts.push({
          type: 'warning', 
          title: 'High Queue Volume',
          message: `Queue "${queue.name}" has ${queue.waitingCalls} waiting calls`,
          queueId: queue.id,
          timestamp: now.toISOString()
        });
      }
    });

    // Check for low agent availability
    const totalAgents = agents.length;
    const availableAgents = agents.filter(a => a.status === 'available').length;
    
    if (totalAgents > 0 && availableAgents < totalAgents * 0.2) { // Less than 20% available
      alerts.push({
        type: 'error',
        title: 'Low Agent Availability',
        message: `Only ${availableAgents} of ${totalAgents} agents are available`,
        timestamp: now.toISOString()
      });
    }

    // Check for system connectivity
    if (!this.freepbxService.connectorUrl || this.freepbxService.useMockData) {
      alerts.push({
        type: 'error',
        title: 'Connector Offline',
        message: 'FreePBX connector is not responding - showing demo data',
        timestamp: now.toISOString()
      });
    }

    // Emit alerts if any
    if (alerts.length > 0) {
      this.io.emit('dashboard:alerts', alerts);
      console.log(`🚨 ${alerts.length} alert(s) detected`);
    }
  }

  // Get statistics for monitoring
  getStats() {
    return {
      connectedClients: this.io.engine.clientsCount,
      activeCalls: this.activeCallsMap.size,
      isPolling: !!this.pollingInterval,
      updateInterval: this.updateInterval,
      lastUpdate: new Date().toISOString()
    };
  }
}