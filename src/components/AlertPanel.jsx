import { useDashboardStore } from '../store/dashboardStore';
import { AlertCircle, X, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AlertPanel() {
  const { alerts, dismissAlert, clearAlerts } = useDashboardStore();

  if (alerts.length === 0) return null;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 py-2 px-4 overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Bell className="w-4 h-4 text-gray-700" />
          <span className="text-sm font-semibold text-gray-900">Alerts</span>
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-2 animate-scroll">
            {[...alerts, ...alerts].map((alert, index) => (
              <div
                key={index}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded border ${getSeverityColor(alert.severity)}`}
              >
                <AlertCircle className={`w-3.5 h-3.5 ${getSeverityIcon(alert.severity)}`} />
                <span className="text-xs font-medium whitespace-nowrap">{alert.message}</span>
                <span className="text-xs opacity-70 whitespace-nowrap">
                  {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={clearAlerts}
          className="flex-shrink-0 text-xs text-gray-600 hover:text-gray-900 transition-colors"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}