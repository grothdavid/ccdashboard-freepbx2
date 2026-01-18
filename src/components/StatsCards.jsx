import React from 'react';

const StatsCards = ({ stats, agents, calls }) => {
  const totalAgents = agents.length;
  const availableAgents = agents.filter(a => a.status === 'available').length;
  const busyAgents = agents.filter(a => a.status === 'on-call' || a.status === 'busy').length;
  const activeCalls = calls.length;

  const cards = [
    {
      title: 'Total Agents',
      value: totalAgents,
      subtitle: 'Logged in',
      color: 'blue',
      icon: '👥'
    },
    {
      title: 'Available',
      value: availableAgents,
      subtitle: 'Ready for calls',
      color: 'green',
      icon: '✅'
    },
    {
      title: 'On Call',
      value: busyAgents,
      subtitle: 'Currently busy',
      color: 'yellow',
      icon: '📞'
    },
    {
      title: 'Active Calls',
      value: activeCalls,
      subtitle: 'In progress',
      color: 'purple',
      icon: '🔔'
    }
  ];

  const getCardColors = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      purple: 'bg-purple-50 border-purple-200 text-purple-800'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`border rounded-lg p-4 ${getCardColors(card.color)}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">
                {card.title}
              </p>
              <p className="text-2xl font-bold">
                {card.value}
              </p>
              <p className="text-xs opacity-70">
                {card.subtitle}
              </p>
            </div>
            <div className="text-2xl">
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;