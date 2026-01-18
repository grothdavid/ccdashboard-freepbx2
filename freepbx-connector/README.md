# FreePBX Contact Center Connector

This service runs on your FreePBX server and provides the bridge between FreePBX/Asterisk and the Azure dashboard.

## Installation on FreePBX Server

1. **Upload files to your FreePBX server:**
   ```bash
   scp connector.py requirements.txt install.sh root@YOUR_FREEPBX_IP:/tmp/
   ```

2. **SSH into your FreePBX server:**
   ```bash
   ssh root@YOUR_FREEPBX_IP
   ```

3. **Run the installation:**
   ```bash
   cd /tmp
   chmod +x install.sh
   ./install.sh
   ```

## Manual Installation Steps

If you prefer manual installation:

```bash
# 1. Install Python dependencies
yum install -y python3 python3-pip

# 2. Create directory
mkdir -p /opt/freepbx-connector
cd /opt/freepbx-connector

# 3. Copy files
cp /tmp/connector.py .
cp /tmp/requirements.txt .

# 4. Install Python packages
pip3 install -r requirements.txt

# 5. Create systemd service (see install.sh for service file)
# 6. Start service
systemctl enable freepbx-connector
systemctl start freepbx-connector
```

## Configuration

The service uses environment variables (set in systemd service):

- `MYSQL_HOST`: MySQL hostname (default: localhost)
- `MYSQL_USER`: MySQL user (default: freepbxuser)  
- `MYSQL_PASSWORD`: MySQL password (default: amp109)
- `MYSQL_DATABASE`: Database name (default: asterisk)
- `CONNECTOR_PORT`: Service port (default: 8080)
- `AMI_HOST`: Asterisk Manager host (default: localhost)
- `AMI_USERNAME`: AMI username (default: admin)
- `AMI_PASSWORD`: AMI password (default: amp111)

## Testing

Test the connector:
```bash
# Health check
curl http://localhost:8080/health

# Get agents
curl http://localhost:8080/agents

# Get queues
curl http://localhost:8080/queues
```

## Connecting Azure Dashboard

1. **Get your FreePBX public IP**
2. **Open firewall port 8080**
3. **Update Azure Container App environment variable:**
   ```bash
   az containerapp update --name freepbx-dashboard --resource-group freepbx-dashboard-rg \
     --set-env-vars PBX_CONNECTOR_ENDPOINT=http://YOUR_FREEPBX_PUBLIC_IP:8080
   ```

## Troubleshooting

View logs:
```bash
journalctl -u freepbx-connector -f
```

Check service status:
```bash
systemctl status freepbx-connector
```

Common issues:
- **Database connection**: Check MySQL credentials
- **No agents/queues**: Verify FreePBX has queue members configured
- **Azure connection timeout**: Check firewall and public IP