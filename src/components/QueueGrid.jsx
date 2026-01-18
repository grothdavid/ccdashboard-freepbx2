import React from 'react';

const QueueGrid = ({ queues = [] }) => {
  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getQueueStatus = (queue) => {
    if (queue.waitingCalls > 10) return { color: 'red', label: 'High Volume' };
    if (queue.longestWait > 300) return { color: 'yellow', label: 'Long Wait' };
    if (queue.agentsAvailable === 0) return { color: 'orange', label: 'No Agents' };
    return { color: 'green', label: 'Normal' };
  };

  const getStatusColor = (color) => {
    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800'
    };
    return colors[color] || colors.green;
  };

  if (queues.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No queues configured</p>
        <p className="text-sm">Queues will appear here when configured in FreePBX</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {queues.map((queue) => {
        const status = getQueueStatus(queue);
        return (
          <div
            key={queue.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">
                  {queue.name}
                </h4>
                <p className="text-sm text-gray-500">
                  Extension: {queue.extension}
                </p>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                getStatusColor(status.color)
              }`}>
                {status.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Waiting:</span>
                  <span className="font-medium">
                    {queue.waitingCalls || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Longest Wait:</span>
                  <span className="font-medium">
                    {formatTime(queue.longestWait)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available:</span>
                  <span className="font-medium text-green-600">
                    {queue.agentsAvailable || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">On Call:</span>
                  <span className="font-medium text-blue-600">
                    {queue.agentsOnCall || 0}
                  </span>
                </div>
              </div>
            </div>

            {queue.avgWaitTime > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg Wait Time:</span>
                  <span className="font-medium">
                    {formatTime(queue.avgWaitTime)}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QueueGrid;