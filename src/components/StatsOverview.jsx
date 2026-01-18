import { useDashboardStore } from '../store/dashboardStore';
import { Users, PhoneCall, Clock, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { useMemo } from 'react';

export default function StatsOverview() {
  const { stats, agents, queues, selectedQueue } = useDashboardStore();

  const filteredAgents = useMemo(() => {
    return selectedQueue === 'all' 
      ? agents 
      : agents.filter(agent => 
          agent.departments?.includes(selectedQueue) || agent.department === selectedQueue
        );
  }, [agents, selectedQueue]);

  const metrics = [
    {
      label: 'Total Agents',
      value: filteredAgents.length,
      icon: Users,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      alert: false
    },
    {
      label: 'Available',
      value: filteredAgents.filter(a => a.status === 'available' && !a.currentCall).length,
      icon: TrendingUp,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      alert: false
    },
    {
      label: 'On Call',
      value: filteredAgents.filter(a => a.currentCall).length,
      icon: PhoneCall,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      alert: false
    },
    {
      label: 'Busy/DND',
      value: filteredAgents.filter(a => a.status === 'busy' || a.status === 'dnd').length,
      icon: AlertTriangle,
      bgColor: filteredAgents.filter(a => a.status === 'busy' || a.status === 'dnd').length > 0 
        ? 'bg-red-500 border-red-600' 
        : 'bg-red-50',
      iconColor: filteredAgents.filter(a => a.status === 'busy' || a.status === 'dnd').length > 0 
        ? 'text-white' 
        : 'text-red-600',
      alert: filteredAgents.filter(a => a.status === 'busy' || a.status === 'dnd').length > 0,
      flash: Math.random() < 0.4 && filteredAgents.filter(a => a.status === 'busy' || a.status === 'dnd').length > 0
    },
    {
      label: 'Away',
      value: filteredAgents.filter(a => a.status === 'away').length,
      icon: Clock,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      alert: false
    },
    {
      label: 'Offline',
      value: filteredAgents.filter(a => a.status === 'offline').length,
      icon: Activity,
      bgColor: 'bg-gray-50',
      iconColor: 'text-gray-600',
      alert: false
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div 
            key={index} 
            className={`metric-card ${metric.flash ? 'animate-pulse' : ''} ${metric.bgColor}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={`text-sm font-medium mb-1 ${metric.alert ? 'text-white' : 'text-gray-600'}`}>{metric.label}</p>
                <p className={`text-2xl font-bold ${metric.alert ? 'text-white' : 'text-gray-900'}`}>{metric.value}</p>
              </div>
              <Icon className={`w-6 h-6 ${metric.iconColor} ${metric.alert ? 'text-white' : ''}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}