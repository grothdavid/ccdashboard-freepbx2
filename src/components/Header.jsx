import { useDashboardStore } from '../store/dashboardStore';
import { Users, Clock, Activity } from 'lucide-react';

export default function Header() {
  const { connected, stats } = useDashboardStore();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/iSimplicity.svg" alt="iSimplicity" className="h-12" />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {stats && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{stats.agents.total} Agents</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Activity className="w-4 h-4" />
                  <span>{stats.calls.active} Active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}