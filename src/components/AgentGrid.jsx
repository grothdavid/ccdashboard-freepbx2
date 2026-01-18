import { useDashboardStore } from '../store/dashboardStore';
import { User, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useRef } from 'react';

const statusConfig = {
  available: { 
    label: 'Available', 
    class: 'status-available', 
    dot: 'bg-green-500',
    cardBg: 'bg-white border-gray-300',
    textColor: 'text-black'
  },
  busy: { 
    label: 'Busy', 
    class: 'status-busy', 
    dot: 'bg-red-500',
    cardBg: 'bg-red-500 border-red-600',
    textColor: 'text-white'
  },
  away: { 
    label: 'Away', 
    class: 'status-away', 
    dot: 'bg-yellow-500',
    cardBg: 'bg-yellow-400 border-yellow-500',
    textColor: 'text-gray-900'
  },
  offline: { 
    label: 'Offline', 
    class: 'status-offline', 
    dot: 'bg-gray-500',
    cardBg: 'bg-gray-400 border-gray-500',
    textColor: 'text-white'
  },
  dnd: { 
    label: 'Do Not Disturb', 
    class: 'status-busy', 
    dot: 'bg-red-500',
    cardBg: 'bg-red-500 border-red-600',
    textColor: 'text-white'
  },
};

export default function AgentGrid() {
  const { agents, queues, selectedQueue, setSelectedQueue } = useDashboardStore();
  const [gridHeight, setGridHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = gridHeight;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const deltaY = e.clientY - startYRef.current;
      const newHeight = startHeightRef.current + deltaY;
      setGridHeight(Math.max(200, Math.min(800, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, gridHeight]);

  // Helper function to format call duration
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to format phone number
  const formatPhoneNumber = (phone) => {
    if (!phone || phone === 'Unknown') return phone;
    // Remove +1 country code if present
    const cleaned = phone.replace(/^\+1/, '');
    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Sort agents to group by status
  const statusOrder = { available: 1, busy: 2, away: 3, dnd: 4, offline: 5 };
  const sortedAgents = [...agents].sort((a, b) => {
    const aOrder = statusOrder[a.status] || 999;
    const bOrder = statusOrder[b.status] || 999;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.name.localeCompare(b.name);
  });

  // Filter agents by selected queue/department
  const filteredAgents = selectedQueue === 'all' 
    ? sortedAgents 
    : sortedAgents.filter(agent => 
        agent.departments?.includes(selectedQueue) || agent.department === selectedQueue
      );

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Agents</h2>
          <select 
            value={selectedQueue}
            onChange={(e) => setSelectedQueue(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Contact Centers</option>
            {queues.map(queue => (
              <option key={queue.id} value={queue.id}>{queue.name}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-gray-600">
          {(() => {
            // Count exactly what renders as white: no currentCall, not busy, status is available
            const whiteCards = filteredAgents.filter(a => 
              !a.currentCall && 
              a.status !== 'busy' && 
              a.status === 'available'
            ).length;
            
            // Count logged in (all except offline)
            const loggedIn = filteredAgents.filter(a => a.status !== 'offline').length;
            
            return `${whiteCards} of ${loggedIn} available`;
          })()} 
        </span>
      </div>

      <div style={{ maxHeight: `${gridHeight}px` }} className="overflow-y-auto">
        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5">
          {filteredAgents.map((agent) => {
          const config = statusConfig[agent.status] || statusConfig.offline;
          
          // Determine background color based on state
          let bgClass, textColor, isFlashing = false;
          
          if (agent.currentCall && agent.status !== 'offline') {
            // Agent on a call - always orange
            bgClass = 'bg-orange-400 border-orange-500';
            textColor = 'text-white';
          } else if (agent.status === 'available') {
            // Available - white
            bgClass = 'bg-white border-gray-300';
            textColor = 'text-black';
          } else if (agent.status === 'busy') {
            // Busy - red
            bgClass = 'bg-red-500 border-red-600';
            textColor = 'text-white';
            // Flash red when busy (simulating incoming call or urgent status)
            isFlashing = Math.random() < 0.3;
          } else {
            // Use configured colors for away, offline, etc.
            bgClass = config.cardBg;
            textColor = 'text-white';
          }
          
          return (
            <div
              key={agent.id}
              className={`${bgClass} rounded border p-1.5 hover:shadow transition-shadow cursor-pointer relative ${isFlashing ? 'animate-pulse' : ''}`}
              title={`${agent.name} - ${agent.currentCall ? 'On Call' : config.label}${agent.extension ? ' (Ext: ' + agent.extension + ')' : ''}`}
            >
              {agent.currentCall && (
                <div className="absolute top-0.5 right-0.5">
                  <Phone className="w-3 h-3 text-white" />
                </div>
              )}
              
              <div className="flex flex-col items-start justify-start min-h-[40px]">
                <div className="flex items-center gap-1.5 w-full">
                  <div className="relative flex-shrink-0">
                    <User className="w-4 h-4 text-black" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${config.dot} border border-white`}></div>
                  </div>
                  <span className={`text-[10px] font-medium truncate flex-1 ${textColor}`}>
                    {agent.name.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
                
                {agent.extension && (
                  <div className={`w-full text-[9px] ${textColor} mt-0.5 ml-5.5 truncate`}>
                    Ext: {agent.extension}
                  </div>
                )}
                
                {agent.status === 'offline' && (
                  <div className="w-full text-[9px] text-white mt-1 ml-5.5 truncate">
                    Off Duty
                  </div>
                )}
                {agent.currentCall && agent.currentCall.status === 'active' && (
                  <div className="w-full text-[9px] text-white mt-1 ml-5.5">
                    <div className="flex items-center gap-1">
                      <span className="font-medium truncate">
                        {agent.currentCall.direction === 'inbound' 
                          ? (agent.currentCall.callerName || 'Customer')
                          : (agent.currentCall.callerName || 'Customer')}
                      </span>
                      <span className="whitespace-nowrap">{formatDuration(agent.currentCall.duration)}</span>
                    </div>
                    <div className="text-white opacity-80 truncate">
                      {formatPhoneNumber(agent.currentCall.phoneNumber)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No agents available{selectedQueue !== 'all' ? ' in this contact center' : ''}</p>
        </div>
      )}
      
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-2 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center transition-colors ${isResizing ? 'bg-gray-400' : ''}`}
        title="Drag to resize"
      >
        <div className="w-12 h-1 bg-gray-400 rounded-full"></div>
      </div>
    </div>
  );
}