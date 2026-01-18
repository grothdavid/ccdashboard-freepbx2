#!/bin/bash

# Manual FreePBX Connector Installation
# Use this when the auto-installer can't find Python 3

echo "🔧 Manual FreePBX Connector Installation"
echo "======================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)" 
   exit 1
fi

# Let user specify Python path
echo ""
echo "First, let's find your Python 3 installation:"
echo ""
echo "Run these commands to test:"
echo "  python3 --version"
echo "  /usr/bin/python3 --version"
echo "  /usr/local/bin/python3 --version"
echo ""

read -p "Enter the full path to your Python 3 executable (e.g., /usr/bin/python3): " PYTHON_EXEC

# Validate Python executable
if [[ ! -x "$PYTHON_EXEC" ]]; then
    echo "❌ $PYTHON_EXEC is not executable or doesn't exist"
    exit 1
fi

# Check if it's actually Python 3
PY_VERSION=$($PYTHON_EXEC --version 2>&1)
if ! echo "$PY_VERSION" | grep -q "Python 3"; then
    echo "❌ $PYTHON_EXEC is not Python 3 (got: $PY_VERSION)"
    exit 1
fi

echo "✅ Using Python: $PYTHON_EXEC ($PY_VERSION)"

# Get user site packages path
PYTHON_USER_SITE=$($PYTHON_EXEC -m site --user-site)
echo "📦 User site packages: $PYTHON_USER_SITE"

# Create connector directory
CONNECTOR_DIR="/opt/freepbx-connector"
echo "📁 Creating connector directory: $CONNECTOR_DIR"
mkdir -p $CONNECTOR_DIR
cd $CONNECTOR_DIR

# Create requirements.txt
cat > requirements.txt << 'EOF'
aiohttp==3.9.1
mysql-connector-python==8.2.0
asyncio-mqtt==0.13.0
EOF

# Create connector.py (abbreviated version)
cat > connector.py << 'EOF'
#!/usr/bin/env python3
import asyncio
import json
import logging
import mysql.connector
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import aiohttp
from aiohttp import web, web_request
import os
import sys

# Configuration
CONFIG = {
    'port': int(os.getenv('CONNECTOR_PORT', 8080)),
    'mysql': {
        'host': os.getenv('MYSQL_HOST', 'localhost'),
        'user': os.getenv('MYSQL_USER', 'freepbxuser'),
        'password': os.getenv('MYSQL_PASSWORD', 'amp109'),
        'database': os.getenv('MYSQL_DATABASE', 'asterisk')
    }
}

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('freepbx-connector')

@dataclass
class Agent:
    id: str
    name: str
    extension: str
    status: str = 'available'
    departments: List[str] = None

@dataclass  
class Queue:
    id: str
    name: str
    extension: str
    waitingCalls: int = 0

class FreePBXConnector:
    def __init__(self):
        self.mysql_connection = None
        
    async def connect_mysql(self):
        try:
            self.mysql_connection = mysql.connector.connect(**CONFIG['mysql'])
            logger.info("Connected to MySQL")
            return True
        except Exception as e:
            logger.error(f"MySQL error: {e}")
            return False
    
    async def get_agents_from_db(self):
        if not self.mysql_connection or not self.mysql_connection.is_connected():
            if not await self.connect_mysql():
                return []
        
        try:
            cursor = self.mysql_connection.cursor(dictionary=True)
            query = """
            SELECT DISTINCT 
                qm.interface as extension,
                qm.membername as name,
                qm.queue_name
            FROM queue_members qm
            WHERE qm.interface LIKE 'Local/%'
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            
            agents = {}
            for row in rows:
                ext = row['extension'].replace('Local/', '').replace('@from-queue/n', '')
                agent_id = f"agent_{ext}"
                
                if agent_id not in agents:
                    agents[agent_id] = Agent(
                        id=agent_id,
                        name=row['name'] or f"Agent {ext}",
                        extension=ext,
                        departments=[row['queue_name']] if row['queue_name'] else []
                    )
                else:
                    if row['queue_name'] and row['queue_name'] not in agents[agent_id].departments:
                        agents[agent_id].departments.append(row['queue_name'])
            
            return list(agents.values())
            
        except Exception as e:
            logger.error(f"Error fetching agents: {e}")
            return []
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    async def get_queues_from_db(self):
        if not self.mysql_connection or not self.mysql_connection.is_connected():
            if not await self.connect_mysql():
                return []
        
        try:
            cursor = self.mysql_connection.cursor(dictionary=True)
            query = "SELECT extension, descr as name FROM queues_config"
            cursor.execute(query)
            rows = cursor.fetchall()
            
            queues = []
            for row in rows:
                queue = Queue(
                    id=row['extension'],
                    name=row['name'],
                    extension=row['extension']
                )
                queues.append(queue)
            
            return queues
            
        except Exception as e:
            logger.error(f"Error fetching queues: {e}")
            return []
        finally:
            if 'cursor' in locals():
                cursor.close()

class APIHandler:
    def __init__(self, connector):
        self.connector = connector
    
    async def get_agents(self, request):
        try:
            agents = await self.connector.get_agents_from_db()
            return web.json_response([asdict(agent) for agent in agents])
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)
    
    async def get_queues(self, request):
        try:
            queues = await self.connector.get_queues_from_db()
            return web.json_response([asdict(queue) for queue in queues])
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)
    
    async def get_calls(self, request):
        return web.json_response([])
    
    async def health(self, request):
        return web.json_response({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "mysql_connected": self.connector.mysql_connection and self.connector.mysql_connection.is_connected()
        })

async def create_app():
    connector = FreePBXConnector()
    api_handler = APIHandler(connector)
    
    app = web.Application()
    
    async def cors_middleware(request, handler):
        response = await handler(request)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    
    app.middlewares.append(cors_middleware)
    
    app.router.add_get('/health', api_handler.health)
    app.router.add_get('/agents', api_handler.get_agents)
    app.router.add_get('/queues', api_handler.get_queues) 
    app.router.add_get('/calls', api_handler.get_calls)
    
    return app

async def main():
    logger.info("Starting FreePBX Connector")
    
    try:
        app = await create_app()
        runner = web.AppRunner(app)
        await runner.setup()
        
        site = web.TCPSite(runner, '0.0.0.0', CONFIG['port'])
        await site.start()
        
        logger.info(f"🚀 FreePBX Connector running on port {CONFIG['port']}")
        
        while True:
            await asyncio.sleep(3600)
            
    except Exception as e:
        logger.error(f"Failed to start: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
EOF

# Install Python packages
echo "🐍 Installing Python packages..."
echo "Using: $PYTHON_EXEC"

$PYTHON_EXEC -m pip install --user aiohttp==3.9.1
$PYTHON_EXEC -m pip install --user mysql-connector-python==8.2.0
$PYTHON_EXEC -m pip install --user asyncio-mqtt==0.13.0

# Test imports
echo "🧪 Testing imports..."
$PYTHON_EXEC -c "import aiohttp; import mysql.connector; print('✅ All imports successful')"

# Create systemd service
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/freepbx-connector.service << EOF
[Unit]
Description=FreePBX Contact Center Connector
After=network.target mysql.service

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/opt/freepbx-connector
ExecStart=$PYTHON_EXEC /opt/freepbx-connector/connector.py
Restart=always
RestartSec=10
Environment=PYTHONPATH=$PYTHON_USER_SITE
Environment=MYSQL_HOST=localhost
Environment=MYSQL_USER=freepbxuser
Environment=MYSQL_PASSWORD=amp109
Environment=MYSQL_DATABASE=asterisk
Environment=CONNECTOR_PORT=8080

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R asterisk:asterisk $CONNECTOR_DIR
chmod +x $CONNECTOR_DIR/connector.py

# Start service
systemctl daemon-reload
systemctl enable freepbx-connector
systemctl start freepbx-connector

echo ""
echo "✅ Installation complete!"
echo ""
echo "Test with: curl http://localhost:8080/health"
echo "Check logs: journalctl -u freepbx-connector -f"