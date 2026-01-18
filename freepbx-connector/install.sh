#!/bin/bash

# FreePBX Contact Center Connector Installation Script
# Run this on your FreePBX server

set -e

echo "🚀 Installing FreePBX Contact Center Connector"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)" 
   exit 1
fi

# Install Python 3 and pip if not available
echo "📦 Installing Python dependencies..."
if ! command -v python3 &> /dev/null; then
    yum install -y python3 python3-pip
fi

# Create connector directory
CONNECTOR_DIR="/opt/freepbx-connector"
echo "📁 Creating connector directory: $CONNECTOR_DIR"
mkdir -p $CONNECTOR_DIR
cd $CONNECTOR_DIR

# Copy connector files (you'll need to upload them to your FreePBX server)
echo "📄 Please upload the following files to $CONNECTOR_DIR:"
echo "  - connector.py"
echo "  - requirements.txt"
echo "  - This script will wait for you to confirm..."
read -p "Press Enter after uploading the files..."

# Install Python requirements
echo "🐍 Installing Python packages..."
pip3 install -r requirements.txt

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
ExecStart=/usr/bin/python3 /opt/freepbx-connector/connector.py
Restart=always
RestartSec=10
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

# Enable and start service
echo "🚀 Enabling and starting service..."
systemctl daemon-reload
systemctl enable freepbx-connector
systemctl start freepbx-connector

# Check status
echo "✅ Installation complete!"
echo ""
echo "Service Status:"
systemctl status freepbx-connector --no-pager

echo ""
echo "🌐 Connector should be running on http://YOUR_FREEPBX_IP:8080"
echo "💡 Test with: curl http://localhost:8080/health"
echo ""
echo "📝 To update Azure dashboard connection:"
echo "   1. Note your FreePBX server's public IP"
echo "   2. Update the PBX_CONNECTOR_ENDPOINT in Azure Container App"
echo "   3. Open port 8080 in your firewall"
echo ""
echo "📋 Logs: journalctl -u freepbx-connector -f"