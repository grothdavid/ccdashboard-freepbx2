# FreePBX Contact Center Dashboard

A real-time contact center monitoring dashboard built with React and Node.js, integrating with FreePBX/Asterisk via AMI (Asterisk Manager Interface) to display live agent status, queue metrics, and active calls.

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   FreePBX Server    │    │  Local Connector    │    │   Azure Dashboard   │
│  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │   Asterisk    │  │◄──►│  │  AMI Client   │  │◄──►│  │ React Frontend│  │
│  │     AMI       │  │    │  │  MySQL Client │  │    │  │ Node.js Server│  │
│  │   Port 5038   │  │    │  │  HTTP Client  │  │    │  │ WebSocket Hub │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
│  ┌───────────────┐  │    │                     │    │                     │
│  │    MySQL      │  │    │                     │    │                     │
│  │   asterisk    │  │    │                     │    │                     │
│  │   asteriskcdr │  │    │                     │    │                     │
│  │   Port 3306   │  │    │                     │    │                     │
│  └───────────────┘  │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Features

- **Real-time Agent Monitoring** - Track agent status (available, busy, away, offline) with live AMI updates
- **Queue Management** - Monitor FreePBX queue metrics including waiting calls, wait times, and service levels
- **Active Call Tracking** - View all active calls with duration, direction, and agent information via AMI events
- **Live Statistics** - Dashboard overview with key metrics and trends
- **Smart Alerts** - Automatic notifications for long wait times and low agent availability
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Azure Deployment** - Containerized for cloud hosting with local FreePBX integration

## Components

### 1. Azure Dashboard (This Directory)
- React frontend with real-time WebSocket updates
- Node.js backend that receives data from local connector
- Dockerized for Azure Container Instances deployment

### 2. Local Connector (`local-connector/`)
- Python service that runs on FreePBX server
- Connects to Asterisk Manager Interface (AMI)
- Reads FreePBX MySQL database for configuration
- Pushes real-time data to Azure dashboard via HTTP/WebSocket

## Tech Stack

### Dashboard (Azure)
- React 18 with hooks
- Vite for fast development
- Tailwind CSS for styling
- Socket.IO for real-time updates
- Zustand for state management
- Recharts for data visualization
- Node.js/Express backend

### Local Connector (FreePBX Server)
- Python 3.6+ (compatible with CentOS 6/7)
- `pyst2` or `asterisk-ami` for AMI connection
- `mysql-connector-python` for database access
- `requests` for HTTP client
- `websocket-client` for real-time communication

## Prerequisites

### For Dashboard (Azure)
- Node.js 18+ and npm
- Azure subscription (for deployment)
- Modern web browser

### For Local Connector (FreePBX Server)
- FreePBX 16+ with Asterisk
- Python 3.6+
- MySQL access to FreePBX database
- Network access to Azure (HTTPS outbound)

## Quick Start

### 1. Set Up Local Connector (On FreePBX Server)

```bash
# Navigate to FreePBX server
cd /opt
git clone [this-repo] freepbx-dashboard
cd freepbx-dashboard/local-connector

# Install Python dependencies
pip install -r requirements.txt

# Configure connection
cp config.example.py config.py
nano config.py  # Edit with your settings

# Test connection
python test_connection.py

# Run as service
python main.py
```

### 2. Deploy Dashboard to Azure

```bash
# Local development
npm install
npm run dev

# Build for production
npm run build

# Deploy to Azure (using provided scripts)
./scripts/deploy-azure.sh
```

### 3. Configure Environment

Create `.env` file:
```env
# Azure Dashboard Configuration
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com

# Local Connector Endpoint (set by Azure deployment)
PBX_CONNECTOR_ENDPOINT=https://your-connector-auth-token
PBX_CONNECTOR_SECRET=your-generated-secret

# Optional: Database backup connection (read-only)
PBX_MYSQL_HOST=your-freepbx-ip
PBX_MYSQL_USER=readonly_user
PBX_MYSQL_PASSWORD=readonly_password
PBX_MYSQL_DATABASE=asterisk
```

## Installation Guide

### Step 1: FreePBX AMI Setup

1. **Enable Asterisk Manager Interface:**
   ```bash
   # Edit manager.conf
   nano /etc/asterisk/manager.conf
   ```

   Add configuration:
   ```ini
   [general]
   enabled = yes
   port = 5038
   bindaddr = 127.0.0.1

   [dashboard_user]
   secret = your_strong_password
   read = system,call,log,verbose,command,agent,user,config,command,dtmf,reporting,cdr,dialplan
   write = system,call,log,verbose,command,agent,user,config,command,dtmf,reporting,cdr,dialplan
   ```

2. **Reload Asterisk Manager:**
   ```bash
   asterisk -rx "module reload manager"
   ```

### Step 2: MySQL Access Setup

1. **Create read-only database user:**
   ```sql
   CREATE USER 'dashboard_ro'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT SELECT ON asterisk.* TO 'dashboard_ro'@'localhost';
   GRANT SELECT ON asteriskcdr.* TO 'dashboard_ro'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Step 3: Local Connector Installation

See `local-connector/README.md` for detailed setup instructions.

### Step 4: Azure Deployment

See `AZURE_DEPLOYMENT.md` for complete deployment guide.

## Project Structure

```
freepbx-dashboard/
├── server/                          # Node.js backend
│   ├── index.js                     # Express server & Socket.IO setup
│   └── services/
│       ├── freepbxService.js        # FreePBX data processing
│       └── websocketHandler.js      # Real-time update handler
├── src/                             # React frontend
│   ├── components/
│   │   ├── Header.jsx               # Dashboard header with connection status
│   │   ├── StatsOverview.jsx        # Key metrics overview
│   │   ├── AgentGrid.jsx            # Agent status cards
│   │   ├── QueueMonitor.jsx         # Queue status display
│   │   ├── ActiveCalls.jsx          # Active calls list
│   │   └── AlertPanel.jsx           # Notifications and alerts
│   ├── store/
│   │   └── dashboardStore.js        # Zustand state management
│   └── App.jsx                      # Main application component
├── local-connector/                 # Python PBX connector
│   ├── main.py                      # Main connector service
│   ├── ami_client.py                # AMI connection handler
│   ├── mysql_client.py              # FreePBX database client
│   ├── azure_client.py              # Azure dashboard communication
│   ├── config.py                    # Configuration
│   └── requirements.txt             # Python dependencies
├── scripts/                         # Deployment scripts
│   ├── deploy-azure.sh              # Azure deployment
│   ├── setup-connector.sh           # Local connector setup
│   └── backup-config.sh             # Configuration backup
├── docker/                          # Docker configuration
│   ├── Dockerfile                   # Dashboard container
│   ├── docker-compose.yml           # Local development
│   └── docker-compose.azure.yml     # Azure deployment
└── docs/                            # Documentation
    ├── API.md                       # API documentation
    ├── CONFIGURATION.md             # Configuration guide
    └── TROUBLESHOOTING.md           # Common issues
```

## Configuration

### Local Connector Configuration

Edit `local-connector/config.py`:

```python
# FreePBX Connection
AMI_HOST = '127.0.0.1'
AMI_PORT = 5038
AMI_USERNAME = 'dashboard_user'
AMI_PASSWORD = 'your_strong_password'

# MySQL Connection
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = 3306
MYSQL_USER = 'dashboard_ro'
MYSQL_PASSWORD = 'secure_password'
MYSQL_DATABASE = 'asterisk'

# Azure Dashboard
DASHBOARD_URL = 'https://your-dashboard.azurecontainerapps.io'
AUTH_TOKEN = 'your-generated-token'

# Update Intervals (seconds)
AMI_POLL_INTERVAL = 5
QUEUE_STATS_INTERVAL = 30
CONFIG_SYNC_INTERVAL = 300
```

### Dashboard Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security
CORS_ORIGIN=https://your-domain.com
AUTH_SECRET=your-jwt-secret

# Local Connector Authentication
CONNECTOR_AUTH_TOKEN=your-generated-token

# Optional MySQL Backup Connection
BACKUP_MYSQL_HOST=your-freepbx-ip
BACKUP_MYSQL_USER=readonly_user
BACKUP_MYSQL_PASSWORD=readonly_password
BACKUP_MYSQL_DATABASE=asterisk
```

## API Integration

### Data Flow

1. **Local Connector** connects to:
   - **AMI (Port 5038)** for real-time events
   - **MySQL (Port 3306)** for configuration data

2. **Local Connector** sends data to **Azure Dashboard** via:
   - **HTTPS POST** for periodic updates
   - **WebSocket** for real-time events

3. **Azure Dashboard** distributes updates to:
   - **WebSocket clients** (browsers)
   - **REST API** endpoints

### Supported FreePBX Data

- **Agents**: Extension status, presence, call states
- **Queues**: Queue statistics, waiting calls, service levels
- **Calls**: Active calls, CDR data, call routing
- **Configuration**: Extensions, queues, routes, time conditions

## Security Considerations

- **AMI Access**: Limited to localhost, strong passwords
- **Database Access**: Read-only user with minimal permissions
- **Network Security**: HTTPS/WSS for all external communication
- **Authentication**: Token-based auth between connector and dashboard
- **Firewall**: Only outbound HTTPS required from FreePBX server

## Performance & Scalability

- **Real-time Updates**: 5-second AMI polling, instant event forwarding
- **Efficient Data Transfer**: Delta updates, compression
- **Azure Scalability**: Auto-scaling Container Apps
- **Local Resources**: Minimal impact on FreePBX performance

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Troubleshooting

### Common Issues

1. **AMI Connection Failed**
   - Check manager.conf configuration
   - Verify user permissions
   - Test with `telnet localhost 5038`

2. **MySQL Access Denied**
   - Verify database user permissions
   - Check network connectivity
   - Test with mysql client

3. **Dashboard Shows Offline**
   - Check local connector status
   - Verify network connectivity to Azure
   - Review connector logs

4. **No Real-time Updates**
   - Check WebSocket connection
   - Verify firewall settings
   - Review browser console

### Log Files

- **Local Connector**: `/var/log/freepbx-connector/`
- **FreePBX**: `/var/log/asterisk/`
- **Azure Dashboard**: Application Insights

## Future Enhancements

- [ ] Historical data and trending
- [ ] Advanced agent performance analytics
- [ ] Call recording integration
- [ ] SMS/Email notifications
- [ ] Multi-tenant support for managed service providers
- [ ] REST API for third-party integrations
- [ ] Mobile app for managers

## License

MIT License - free for commercial and non-commercial use.

## Support

1. Check troubleshooting section
2. Review FreePBX logs
3. Test AMI connection manually
4. Verify network connectivity

## Credits

Based on modern contact center monitoring principles, adapted for FreePBX/Asterisk environments with cloud-native deployment architecture.