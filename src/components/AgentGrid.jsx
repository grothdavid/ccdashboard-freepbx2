import React from 'react';

const AgentGrid = ({ agents = [] }) => {
  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800',
      'on-call': 'bg-blue-100 text-blue-800',
      busy: 'bg-yellow-100 text-yellow-800',
      away: 'bg-gray-100 text-gray-800',
      offline: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.offline;
  };

  const getStatusIcon = (status) => {
    const icons = {
      available: '🟢',
      'on-call': '🔵',
      busy: '🟡',
      away: '⚫',
      offline: '🔴'
    };
    return icons[status] || icons.offline;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No agents found</p>
        <p className="text-sm">Agents will appear here when they log in</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">
              {getStatusIcon(agent.status)}
            </span>
            <div>
              <p className="font-medium text-gray-900">
                {agent.name || `Agent ${agent.extension}`}
              </p>
              <p className="text-sm text-gray-500">
                Ext: {agent.extension}
                {agent.department && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {agent.department}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              getStatusColor(agent.status)
            }`}>
              {agent.status.replace('-', ' ')}
            </span>
            {agent.currentCall && (
              <p className="text-xs text-gray-500 mt-1">
                Call: {formatDuration(agent.currentCall.duration)}
              </p>
            )}
            {agent.statusDuration > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {agent.status}: {formatDuration(agent.statusDuration)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentGrid;