import React, { useState } from 'react';

const AlertBanner = ({ alerts = [] }) => {
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  const dismissAlert = (alertIndex) => {
    setDismissedAlerts(prev => new Set([...prev, alertIndex]));
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  const getAlertColors = (type) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const visibleAlerts = alerts.filter((_, index) => !dismissedAlerts.has(index));

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-2 py-3">
          {visibleAlerts.map((alert, originalIndex) => {
            const alertIndex = alerts.findIndex(a => a === alert);
            return (
              <div
                key={alertIndex}
                className={`border rounded-lg p-3 flex items-center justify-between ${
                  getAlertColors(alert.type)
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {getAlertIcon(alert.type)}
                  </span>
                  <div>
                    <h4 className="font-medium">
                      {alert.title}
                    </h4>
                    <p className="text-sm opacity-90">
                      {alert.message}
                    </p>
                    {alert.timestamp && (
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(alertIndex)}
                  className="text-lg hover:opacity-70 transition-opacity"
                  title="Dismiss alert"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AlertBanner;