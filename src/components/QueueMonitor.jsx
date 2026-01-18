import { useDashboardStore } from '../store/dashboardStore';
import { Users, Phone, Clock, TrendingUp } from 'lucide-react';

export default function QueueMonitor() {
  const { queues, selectedQueue } = useDashboardStore();

  // Filter queues based on selection
  const filteredQueues = selectedQueue === 'all'
    ? queues
    : queues.filter(queue => queue.id === selectedQueue);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h2>

      {/* Grid layout for queue cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredQueues.map((queue) => (
          <div
            key={queue.id}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow"
          >
            <div className="mb-3">
              <h3 className="font-medium text-gray-900 mb-2 truncate">{queue.name}</h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>Available</span>
                  </div>
                  <span className="font-semibold">{queue.agentsAvailable} / {queue.agents}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3 h-3" />
                    <span>On Call</span>
                  </div>
                  <span className="font-semibold">{queue.agentsOnCall}</span>
                </div>
              </div>
            </div>
            
            {queue.waitingCalls > 0 && (
              <div className="mb-3">
                <div className="bg-red-100 text-red-800 px-2.5 py-1 rounded text-center text-sm font-semibold">
                  {queue.waitingCalls} waiting
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Longest Wait</span>
                <span className="font-semibold text-gray-900">{formatTime(queue.longestWait)}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Avg Wait</span>
                <span className="font-semibold text-gray-900">{formatTime(queue.averageWait)}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Answered</span>
                <span className="font-semibold text-gray-900">{queue.answeredCalls}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Abandoned</span>
                <span className="font-semibold text-gray-900">{queue.abandonedCalls}</span>
              </div>
            </div>

            {queue.serviceLevel > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">Service Level</span>
                  <span className="font-semibold text-gray-900">{queue.serviceLevel}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(queue.serviceLevel, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredQueues.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No queues {selectedQueue !== 'all' ? 'in this contact center' : 'configured'}</p>
        </div>
      )}
    </div>
  );
}