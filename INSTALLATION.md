# FreePBX Contact Center Dashboard - Installation Guide

This guide will help you set up the FreePBX Contact Center Dashboard with Azure deployment and local connector.

## Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   FreePBX Server    │    │  Local Connector    │    │   Azure Dashboard   │
│                     │    │                     │    │                     │
│  ┌───────────────┐  │◄──►│  ┌───────────────┐  │◄──►│  ┌───────────────┐  │
│  │   Asterisk    │  │    │  │  AMI Client   │  │    │  │ React Frontend│  │
│  │     AMI       │  │    │  │  MySQL Client │  │    │  │ Node.js Server│  │
│  │   Port 5038   │  │    │  │  Web Server   │  │    │  │ Socket.IO Hub │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
│  ┌───────────────┐  │    │                     │    │                     │
│  │    MySQL      │  │    │                     │    │                     │
│  │   asterisk    │  │    │                     │    │                     │
│  │   asteriskcdr │  │    │                     │    │                     │
│  └───────────────┘  │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
     CentOS 6/7/8              Python Service            Azure Container App
```

## Prerequisites

### FreePBX Server Requirements (CentOS 6/7/8 Compatible)
- FreePBX 16+ with Asterisk
- Python 3.6+ (available via EPEL or SCL on CentOS 6)
- MySQL access (read-only user recommended)
- Network connectivity to Azure (HTTPS outbound)
- 512MB RAM and 1GB disk space for connector
- **NO Docker required** - Only Python connector runs locally

### Azure Requirements
- Azure subscription with Container Apps capability
- Azure CLI or Azure Portal access
- Docker registry access (Azure Container Registry recommended)

### Development/Build Machine Requirements (Separate from FreePBX)
- Node.js 18+
- Docker Desktop (for building dashboard container)
- Git
- Azure CLI
- **Note**: This is NOT the FreePBX server - use any modern machine for building

## Installation Workflow Summary

> **📋 Two-Part Installation**:
> 1. **FreePBX Server** (CentOS 6): Install Python connector only (no Docker needed)
> 2. **Development Machine**: Build Docker dashboard and deploy to Azure

### Deployment Architecture:
```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Your Dev Machine  │    │   CentOS 6 FreePBX  │    │    Azure Cloud      │
│                     │    │                     │    │                     │
│  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │ Docker Build  │  │    │  │ Python Only   │  │    │  │ Container App │  │
│  │ Node.js + Git │  │◄───┤  │ AMI + MySQL   │  │◄───┤  │ Dashboard UI  │  │
│  │ Azure CLI     │  │    │  │ REST API      │  │    │  │ Real-time Hub │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
   Build & Deploy              Local Connector            Cloud Dashboard
```

## Installation Steps

### Step 1: FreePBX Server Preparation

#### 1.1 Enable Asterisk Manager Interface (AMI)

```bash
# Edit AMI configuration
sudo nano /etc/asterisk/manager.conf
```

Add or modify the configuration:

```ini
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1
webenabled = no

[dashboard_user]
secret = your_strong_password_here
read = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
```

```bash
# Reload AMI configuration
sudo asterisk -rx "module reload manager"

# Test AMI connection
telnet localhost 5038
```

#### 1.2 Create MySQL Read-Only User

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create read-only user for dashboard
CREATE USER 'dashboard_ro'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT SELECT ON asterisk.* TO 'dashboard_ro'@'localhost';
GRANT SELECT ON asteriskcdr.* TO 'dashboard_ro'@'localhost';
FLUSH PRIVILEGES;

-- Test the connection
mysql -u dashboard_ro -p asterisk
```

#### 1.3 Install Python Dependencies

```bash
# For CentOS 6 (requires EPEL and Software Collections)
sudo yum install -y epel-release centos-release-scl
sudo yum install -y python36 python36-pip git
# Create symlinks for compatibility
sudo ln -sf /opt/rh/rh-python36/root/bin/python3.6 /usr/bin/python3
sudo ln -sf /opt/rh/rh-python36/root/bin/pip3.6 /usr/bin/pip3

# For CentOS 7/8
sudo yum install -y python3 python3-pip git

# For newer systems
sudo dnf install -y python3 python3-pip git

# Verify installation
python3 --version
pip3 --version
```

### Step 2: Local Connector Installation

#### 2.1 Download and Setup Connector

```bash
# Create installation directory
sudo mkdir -p /opt/freepbx-connector
cd /opt/freepbx-connector

# Clone or download the project
sudo git clone https://github.com/your-repo/freepbx-dashboard.git .

# Navigate to connector directory
cd local-connector

# Install Python dependencies
sudo pip3 install -r requirements.txt
```

#### 2.2 Configure the Connector

```bash
# Copy configuration template
sudo cp .env.example .env

# Edit configuration
sudo nano .env
```

Update the configuration:

```bash
# AMI Settings
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USERNAME=dashboard_user
AMI_PASSWORD=your_strong_password_here

# MySQL Settings
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=dashboard_ro
MYSQL_PASSWORD=secure_password_here
MYSQL_DATABASE=asterisk

# Azure Dashboard (will be set after deployment)
AZURE_DASHBOARD_URL=https://your-dashboard.azurecontainerapps.io
AZURE_AUTH_TOKEN=your-generated-token

# Local Web Server - IMPORTANT: Uses different port than FreePBX admin
WEB_SERVER_HOST=0.0.0.0
WEB_SERVER_PORT=8080
WEB_SERVER_AUTH_TOKEN=local-secret-token
```

> **📋 Port Configuration Note**: 
> - **FreePBX Admin Interface**: Runs on ports 80/443 (HTTP/HTTPS)
> - **Dashboard Connector**: Runs on port 8080 (configurable)
> - **No Conflict**: These services operate independently on different ports
> - **Alternative Ports**: If 8080 is in use, consider 8081, 8082, or 9090

#### 2.3 Create Service (Systemd or Init Script)

**For CentOS 7/8 with systemd:**

```bash
# Create service file
sudo nano /etc/systemd/system/freepbx-connector.service
```

```ini
[Unit]
Description=FreePBX Dashboard Connector
After=network.target mysql.service asterisk.service
Wants=network.target

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/opt/freepbx-connector/local-connector
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10

# Logging
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=freepbx-connector

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/freepbx-connector

[Install]
WantedBy=multi-user.target
```

```bash
# Create log directory
sudo mkdir -p /var/log/freepbx-connector
sudo chown asterisk:asterisk /var/log/freepbx-connector

# Set permissions
sudo chown -R asterisk:asterisk /opt/freepbx-connector
sudo chmod +x /opt/freepbx-connector/local-connector/main.py

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable freepbx-connector
sudo systemctl start freepbx-connector

# Check status
sudo systemctl status freepbx-connector
```

**For CentOS 6 with init scripts:**

```bash
# Create init script
sudo nano /etc/init.d/freepbx-connector
```

```bash
#!/bin/bash
# freepbx-connector        FreePBX Dashboard Connector
# chkconfig: 35 99 99
# description: FreePBX Dashboard Connector Service

. /etc/rc.d/init.d/functions

USER="asterisk"
DAEMON="freepbx-connector"
ROOT_DIR="/opt/freepbx-connector/local-connector"

SERVER="$ROOT_DIR/main.py"
PID_FILE="/var/run/freepbx-connector.pid"

start() {
    echo -n "Starting $DAEMON: "
    daemon --user "$USER" --pidfile="$PID_FILE" \
        "cd $ROOT_DIR && /usr/bin/python3 $SERVER & echo \$! > $PID_FILE"
    echo
}

stop() {
    echo -n "Stopping $DAEMON: "
    pid=`cat $PID_FILE 2>/dev/null`
    [ "$pid" != "" ] && kill $pid
    echo
}

restart() {
    stop
    sleep 2
    start
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    *)
        echo "Usage: {start|stop|restart}"
        exit 1
        ;;
esac

exit $?
```

```bash
# Make executable and enable
sudo chmod +x /etc/init.d/freepbx-connector
sudo chkconfig --add freepbx-connector
sudo chkconfig freepbx-connector on

# Start service
sudo service freepbx-connector start

# Check status
sudo service freepbx-connector status

#### 2.4 Test Local Connector

```bash
# Test connector API
curl http://localhost:8080/api/health

# Check logs
sudo journalctl -u freepbx-connector -f
```

### Step 3: Azure Dashboard Deployment

> **🏗️ Important**: This step is performed on your **development/build machine** (Windows/Mac/Linux with Docker), **NOT on the CentOS 6 FreePBX server**.

#### 3.1 Prepare Container Image

```bash
# On your development machine (NOT FreePBX server)
git clone https://github.com/your-repo/freepbx-dashboard.git
cd freepbx-dashboard

# Build and tag container image
docker build -t freepbx-dashboard:latest .

# Tag for Azure Container Registry
docker tag freepbx-dashboard:latest your-acr.azurecr.io/freepbx-dashboard:latest

# Push to registry
az acr login --name your-acr
docker push your-acr.azurecr.io/freepbx-dashboard:latest
```

#### 3.2 Deploy to Azure Container Apps

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "your-subscription-id"

# Create resource group
az group create --name freepbx-dashboard-rg --location eastus

# Deploy using Bicep template
az deployment group create \
  --resource-group freepbx-dashboard-rg \
  --template-file azure-deploy.bicep \
  --parameters \
    dashboardImage='your-acr.azurecr.io/freepbx-dashboard:latest' \
    pbxConnectorEndpoint='https://your-public-ip:8080' \
    pbxConnectorSecret='local-secret-token'
```

#### 3.3 Configure DNS and SSL

```bash
# Get the dashboard URL
az deployment group show \
  --resource-group freepbx-dashboard-rg \
  --name azure-deploy \
  --query properties.outputs.dashboardUrl.value

# Configure custom domain (optional)
az containerapp hostname add \
  --resource-group freepbx-dashboard-rg \
  --name freepbx-dashboard \
  --hostname dashboard.yourdomain.com
```

### Step 4: Final Configuration

#### 4.1 Update Connector with Azure URL

```bash
# On FreePBX server, update connector configuration
sudo nano /opt/freepbx-connector/local-connector/.env
```

Update Azure settings:

```bash
AZURE_DASHBOARD_URL=https://your-dashboard-url.azurecontainerapps.io
AZURE_AUTH_TOKEN=generated-secure-token
```

```bash
# Restart connector
sudo systemctl restart freepbx-connector
```

#### 4.2 Configure Firewall

```bash
# On FreePBX server - open connector port for Azure
sudo firewall-cmd --zone=public --add-port=8080/tcp --permanent
sudo firewall-cmd --reload

# For iptables systems
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
sudo service iptables save
```

> **🔒 Port Security Considerations**:
> - **FreePBX Admin**: Typically secured on ports 80/443 with restricted access
> - **Dashboard Connector**: Port 8080 should be restricted to Azure IP ranges only
> - **Local Access**: Connector API accessible locally on 127.0.0.1:8080
> - **External Access**: Only Azure dashboard needs external access to port 8080

#### Check for Port Conflicts

```bash
# Verify FreePBX admin interface ports
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Verify chosen connector port is available
sudo netstat -tlnp | grep :8080

# If port 8080 is in use, choose alternative
sudo ss -tlnp | grep -E ':(808[0-9]|909[0-9])'
```

#### 4.3 Test End-to-End Connection

```bash
# Test connector API from Azure (should work)
curl https://your-public-ip:8080/api/health -H "Authorization: Bearer local-secret-token"

# Test dashboard API
curl https://your-dashboard-url.azurecontainerapps.io/api/health
```

### Step 5: Verification and Monitoring

#### 5.1 Verify Dashboard Access

1. Open browser to: `https://your-dashboard-url.azurecontainerapps.io`
2. Check that agents, queues, and calls are displayed
3. Verify real-time updates work
4. Test making/receiving calls to see live data

#### 5.2 Monitor System Health

```bash
# Check connector status
sudo systemctl status freepbx-connector
sudo journalctl -u freepbx-connector --since "1 hour ago"

# Check connector logs
sudo tail -f /var/log/freepbx-connector/connector.log

# Test connector endpoints
curl http://localhost:8080/api/health
curl http://localhost:8080/api/agents -H "Authorization: Bearer local-secret-token"
curl http://localhost:8080/api/queues -H "Authorization: Bearer local-secret-token"
```

#### 5.3 Azure Monitoring

```bash
# Check container app status
az containerapp show \
  --resource-group freepbx-dashboard-rg \
  --name freepbx-dashboard \
  --query properties.runningStatus

# View logs
az containerapp logs show \
  --resource-group freepbx-dashboard-rg \
  --name freepbx-dashboard \
  --follow
```

## Troubleshooting

### Common Issues

#### Port Conflicts with Existing Services

```bash
# Check if port 8080 is already in use
sudo netstat -tlnp | grep :8080

# If occupied, find alternative port
sudo ss -tlnp | grep -v LISTEN | awk '{print $4}' | cut -d: -f2 | sort -n | grep '^80'

# Common alternative ports: 8081, 8082, 8090, 9090, 9080
# Update connector configuration if needed
sudo nano /opt/freepbx-connector/local-connector/.env
# Change: WEB_SERVER_PORT=8081
```

**Service Separation Overview**:
- **FreePBX Admin Web Interface**: Ports 80/443 (Apache/Nginx)
- **Asterisk Manager Interface**: Port 5038 (AMI protocol)  
- **MySQL Database**: Port 3306 (database protocol)
- **Dashboard Connector API**: Port 8080+ (HTTP REST API)

#### Connector Cannot Connect to AMI

```bash
# Check AMI status
sudo asterisk -rx "manager show connected"
sudo asterisk -rx "manager show users"

# Test AMI manually
telnet localhost 5038
# Type: Action: Login
# Username: dashboard_user
# Secret: your_password
```

#### Connector Cannot Connect to MySQL

```bash
# Test MySQL connection
mysql -u dashboard_ro -p asterisk -e "SELECT 1"

# Check MySQL logs
sudo tail -f /var/log/mysqld.log
```

#### Dashboard Shows No Data

```bash
# Check connector API
curl http://localhost:8080/api/health

# Check Azure connectivity
ping your-dashboard-url.azurecontainerapps.io

# Check connector logs
sudo journalctl -u freepbx-connector -f
```

#### Azure Deployment Issues

```bash
# Check deployment status
az deployment group show \
  --resource-group freepbx-dashboard-rg \
  --name azure-deploy

# Check container logs
az containerapp logs show \
  --resource-group freepbx-dashboard-rg \
  --name freepbx-dashboard
```

### Performance Tuning

#### Connector Optimization

```bash
# Edit connector configuration for better performance
sudo nano /opt/freepbx-connector/local-connector/.env
```

```bash
# Reduce polling intervals for higher update frequency
AMI_POLL_INTERVAL=2
QUEUE_STATS_INTERVAL=10
AZURE_SYNC_INTERVAL=15

# Or increase for lower resource usage
AMI_POLL_INTERVAL=10
QUEUE_STATS_INTERVAL=60
AZURE_SYNC_INTERVAL=60
```

#### Azure Scaling

```bash
# Update container app scaling rules
az containerapp update \
  --resource-group freepbx-dashboard-rg \
  --name freepbx-dashboard \
  --min-replicas 1 \
  --max-replicas 5
```

## Security Considerations

1. **Network Security**:
   - Use HTTPS for all external communication
   - Implement IP whitelisting for connector API
   - Use VPN for FreePBX to Azure communication (recommended)

2. **Authentication**:
   - Generate strong, unique tokens
   - Rotate tokens regularly
   - Use Azure AD integration for dashboard access

3. **Database Access**:
   - Use read-only MySQL user
   - Limit database permissions to required tables only
   - Monitor database access logs

4. **System Security**:
   - Keep FreePBX and all components updated
   - Use firewall rules to restrict access
   - Monitor system logs for suspicious activity

## Maintenance

### Regular Maintenance Tasks

```bash
# Update connector code (monthly)
cd /opt/freepbx-connector
sudo git pull
sudo systemctl restart freepbx-connector

# Check log file sizes (weekly)
sudo ls -lh /var/log/freepbx-connector/

# Rotate logs if needed
sudo logrotate -f /etc/logrotate.d/freepbx-connector

# Update Python dependencies (quarterly)
sudo pip3 install -r local-connector/requirements.txt --upgrade
```

### Backup Procedures

```bash
# Backup configuration
sudo cp /opt/freepbx-connector/local-connector/.env /backup/connector-config-$(date +%Y%m%d).env

# Backup Azure deployment template
cp azure-deploy.bicep /backup/azure-deploy-$(date +%Y%m%d).bicep
```

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review connector and Azure logs
3. Test individual components (AMI, MySQL, Azure connectivity)
4. Verify FreePBX configuration and network connectivity

## Next Steps

After successful installation:

1. **Customize Dashboard**: Modify UI components for your specific needs
2. **Add Monitoring**: Implement Prometheus/Grafana monitoring
3. **Backup Strategy**: Set up automated backups
4. **User Training**: Train staff on dashboard features
5. **Documentation**: Document your specific configuration and procedures

Congratulations! Your FreePBX Contact Center Dashboard should now be running successfully.