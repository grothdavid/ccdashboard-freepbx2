# FreePBX Connector - Quick Setup Guide

## For Systems with Existing Python (like FreePBX with Python 3.9)

### Option 1: Manual Installation (Recommended)

```bash
# Download files
cd /opt
mkdir freepbx-connector
cd freepbx-connector

wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/connector.py
wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/requirements.txt
wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/install-manual.sh

chmod +x install-manual.sh
sudo ./install-manual.sh
```

### Option 2: Step by Step

```bash
# 1. Create directory
sudo mkdir -p /opt/freepbx-connector
cd /opt/freepbx-connector

# 2. Download files
sudo wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/connector.py
sudo wget https://raw.githubusercontent.com/grothdavid/ccdashboard-freepbx2/master/freepbx-connector/requirements.txt

# 3. Install Python packages (using existing Python 3.9)
python3 -m pip install --user aiohttp==3.9.1
python3 -m pip install --user mysql-connector-python==8.2.0
python3 -m pip install --user asyncio-mqtt==0.13.0

# 4. Test imports
python3 -c "import aiohttp; import mysql.connector; print('Success!')"

# 5. Create systemd service
sudo tee /etc/systemd/system/freepbx-connector.service > /dev/null <<EOF
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

[Install]
WantedBy=multi-user.target
EOF

# 6. Start service
sudo systemctl daemon-reload
sudo systemctl enable freepbx-connector
sudo systemctl start freepbx-connector

# 7. Check status
sudo systemctl status freepbx-connector
```

### Testing
```bash
# Health check
curl http://localhost:8080/health

# Test endpoints
curl http://localhost:8080/agents
curl http://localhost:8080/queues
```

### Common Issues with Python 3.9

1. **Package conflicts**: Use `--user` flag for pip install
2. **Permission issues**: Run as root for system service setup
3. **MySQL access**: Verify FreePBX MySQL credentials
4. **Firewall**: Open port 8080 for Azure access

### Logs
```bash
journalctl -u freepbx-connector -f
```