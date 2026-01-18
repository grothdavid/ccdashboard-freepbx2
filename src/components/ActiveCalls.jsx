import { useDashboardStore } from '../store/dashboardStore';
import { Phone, PhoneIncoming, PhoneOutgoing, UserCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function ActiveCalls() {
  const { calls, selectedQueue } = useDashboardStore();

  // Filter calls based on selected queue
  const filteredCalls = selectedQueue === 'all'
    ? calls
    : calls.filter(call => call.queueId === selectedQueue);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown';
    const cleaned = number.replace(/\\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return number;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Active Calls</h2>
        <span className="text-sm text-gray-600">{filteredCalls.length} active</span>
      </div>

      {/* Scrollable container - max 5 lines */}
      <div className="max-h-[200px] overflow-y-auto">
        <div className="space-y-2">
          {filteredCalls.map((call) => (
            <div
              key={call.id}
              className="bg-gray-50 rounded border border-gray-200 px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              {/* Single line layout */}
              <div className="flex items-center justify-between gap-4">
                {/* Direction icon - user with arrow */}
                <div className={`flex-shrink-0 relative ${
                  call.direction === 'inbound' ? 'text-blue-600' : 'text-green-600'
                }`}>
                  <UserCircle className="w-6 h-6" />
                  {call.direction === 'inbound' ? (
                    <ArrowDownLeft className="w-3 h-3 absolute -top-0.5 -right-0.5 bg-white rounded-full" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3 absolute -top-0.5 -right-0.5 bg-white rounded-full" />
                  )}
                </div>

                {/* Caller Info (Name + Number on same line) */}
                <div className="flex-shrink-0 min-w-[200px]">
                  <span className="text-sm text-gray-900 truncate block">
                    {call.direction === 'inbound' ? (
                      <>
                        <span className="font-medium">{call.fromName ? call.fromName : 'Customer'}</span>
                        {' '}<span className="text-gray-600">&lt;{call.from}&gt;</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{call.toName ? call.toName : 'Customer'}</span>
                        {' '}<span className="text-gray-600">&lt;{call.to}&gt;</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Queue name */}
                <div className="flex-shrink-0 min-w-[120px]">
                  <span className="text-sm text-gray-700 truncate block">
                    {call.queueName || 'N/A'}
                  </span>
                </div>

                {/* Agent name */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700 truncate block">
                    {call.agentName || 'N/A'}
                  </span>
                </div>

                {/* Duration */}
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    {call.duration ? formatDuration(call.duration) : '0:00'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredCalls.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Phone className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active calls</p>
        </div>
      )}
    </div>
  );
}