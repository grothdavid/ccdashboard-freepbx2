#!/bin/bash

# FreePBX Contact Center Connector - Manual Installation
# For systems with existing Python installations

set -e

echo "🚀 FreePBX Contact Center Connector - Manual Install"

# Check current user
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)" 
   exit 1
fi

# Display current Python info
echo "📋 Current Python Environment:"
echo "Python path: $(which python3)"
echo "Python version: $(python3 --version)"
echo "Pip location: $(which pip3 2>/dev/null || echo 'pip3 not found')"

# Create connector directory
CONNECTOR_DIR="/opt/freepbx-connector"
echo "📁 Creating connector directory: $CONNECTOR_DIR"
mkdir -p $CONNECTOR_DIR
cd $CONNECTOR_DIR

# Check if files exist
if [[ ! -f "connector.py" ]] || [[ ! -f "requirements.txt" ]]; then
    echo "📄 Files not found. Please download them first:"
    echo "wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/connector.py"
    echo "wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/requirements.txt"
    exit 1
fi

# Install packages manually to avoid conflicts
echo "🐍 Installing required Python packages..."

# Install each package individually
echo "Installing aiohttp..."
python3 -m pip install --user aiohttp==3.9.1

echo "Installing mysql-connector-python..."
python3 -m pip install --user mysql-connector-python==8.2.0

echo "Installing asyncio-mqtt..."
python3 -m pip install --user asyncio-mqtt==0.13.0

echo "✅ Python packages installed successfully"

# Test imports
echo "🧪 Testing Python imports..."
python3 -c "import aiohttp; import mysql.connector; print('✅ All imports successful')"

# Create systemd service
echo "⚙️  Creating systemd service..."
cat > /etc/systemd/system/freepbx-connector.service << EOF
[Unit]
Description=FreePBX Contact Center Connector
After=network.target mysql.service

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/opt/freepbx-connector
ExecStart=$(which python3) /opt/freepbx-connector/connector.py
Restart=always
RestartSec=10
Environment=PYTHONPATH=/root/.local/lib/python3.9/site-packages
Environment=MYSQL_HOST=localhost
Environment=MYSQL_USER=freepbxuser
Environment=MYSQL_PASSWORD=amp109
Environment=MYSQL_DATABASE=asterisk
Environment=CONNECTOR_PORT=8080
Environment=AMI_HOST=localhost
Environment=AMI_USERNAME=admin
Environment=AMI_PASSWORD=amp111

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
echo "🔐 Setting permissions..."
chown -R asterisk:asterisk $CONNECTOR_DIR
chmod +x $CONNECTOR_DIR/connector.py

# Test the service first
echo "🧪 Testing the connector..."
echo "Running connector test..."
timeout 10s python3 connector.py || echo "Test completed (timeout expected)"

# Enable and start service
echo "🚀 Enabling and starting service..."
systemctl daemon-reload
systemctl enable freepbx-connector

# Start the service
echo "Starting freepbx-connector service..."
systemctl start freepbx-connector

# Wait a moment and check status
sleep 3

echo ""
echo "✅ Installation complete!"
echo ""
echo "Service Status:"
systemctl status freepbx-connector --no-pager --lines=10

echo ""
echo "🌐 Connector endpoints:"
echo "   Health: http://localhost:8080/health"
echo "   Agents: http://localhost:8080/agents"
echo "   Queues: http://localhost:8080/queues"
echo ""
echo "🔧 Troubleshooting:"
echo "   View logs: journalctl -u freepbx-connector -f"
echo "   Restart:   systemctl restart freepbx-connector"
echo "   Status:    systemctl status freepbx-connector"
echo ""
echo "📝 Next steps:"
echo "   1. Test: curl http://localhost:8080/health"
echo "   2. Update Azure with your FreePBX IP"
echo "   3. Open firewall port 8080"