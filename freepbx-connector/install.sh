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

# Check existing Python installation
echo "📦 Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo "✅ Found Python $PYTHON_VERSION"
else
    echo "❌ Python 3 not found, installing..."
    yum install -y python3 python3-pip
fi

# Ensure pip is available
if ! command -v pip3 &> /dev/null; then
    echo "📦 Installing pip3..."
    yum install -y python3-pip
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
echo "Using Python: $(which python3)"
echo "Python version: $(python3 --version)"

# Try pip3 first, then pip if pip3 doesn't exist
if command -v pip3 &> /dev/null; then
    echo "Installing with pip3..."
    pip3 install --user -r requirements.txt
elif python3 -m pip --version &> /dev/null; then
    echo "Installing with python3 -m pip..."
    python3 -m pip install --user -r requirements.txt
else
    echo "❌ Cannot find pip. Installing pip manually..."
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py --user
    python3 -m pip install --user -r requirements.txt
    rm get-pip.py
fi

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