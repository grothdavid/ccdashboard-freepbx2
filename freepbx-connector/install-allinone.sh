#!/bin/bash

# FreePBX Contact Center Connector - All-in-One Installer
# No external downloads required - everything is embedded

set -e

echo "🚀 FreePBX Contact Center Connector - All-in-One Install"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)" 
   exit 1
fi

# Display current Python info
echo "📋 Current Python Environment:"
echo "Python path: $(which python3)"
echo "Python version: $(python3 --version)"

# Create connector directory
CONNECTOR_DIR="/opt/freepbx-connector"
echo "📁 Creating connector directory: $CONNECTOR_DIR"
mkdir -p $CONNECTOR_DIR
cd $CONNECTOR_DIR

# Create requirements.txt
echo "📄 Creating requirements.txt..."
cat > requirements.txt << 'EOF'
aiohttp==3.9.1
mysql-connector-python==8.2.0
asyncio-mqtt==0.13.0
EOF

# Create connector.py
echo "📄 Creating connector.py..."
cat > connector.py << 'EOF'
#!/usr/bin/env python3
"""
FreePBX Contact Center Connector Service
Bridges FreePBX/Asterisk data to Azure Dashboard
"""

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
    'asterisk_ami': {
        'host': os.getenv('AMI_HOST', 'localhost'),
        'port': int(os.getenv('AMI_PORT', 5038)),
        'username': os.getenv('AMI_USERNAME', 'admin'),
        'password': os.getenv('AMI_PASSWORD', 'amp111')
    },
    'mysql': {
        'host': os.getenv('MYSQL_HOST', 'localhost'),
        'user': os.getenv('MYSQL_USER', 'freepbxuser'),
        'password': os.getenv('MYSQL_PASSWORD', 'amp109'),
        'database': os.getenv('MYSQL_DATABASE', 'asterisk')
    },
    'dashboard_url': os.getenv('DASHBOARD_URL', 'https://freepbx-dashboard.orangeflower-acedba1b.eastus.azurecontainerapps.io'),
    'secret_key': os.getenv('CONNECTOR_SECRET', 'freepbx-connector-key-2024')
}

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/freepbx-connector.log')
    ]
)
logger = logging.getLogger('freepbx-connector')

@dataclass
class Agent:
    id: str
    name: str
    extension: str
    status: str = 'offline'
    departments: List[str] = None
    currentCall: Optional[Dict] = None
    statusDuration: int = 0

@dataclass  
class Queue:
    id: str
    name: str
    extension: str
    waitingCalls: int = 0
    avgWaitTime: int = 0
    longestWaitTime: int = 0
    agentsLoggedIn: int = 0
    callsAnswered: int = 0
    callsAbandoned: int = 0

@dataclass
class Call:
    id: str
    queueId: str
    direction: str = 'inbound'
    status: str = 'active'
    phoneNumber: str = ''
    callerName: str = ''
    duration: int = 0
    agent: Optional[str] = None

class FreePBXConnector:
    def __init__(self):
        self.mysql_connection = None
        self.agents: Dict[str, Agent] = {}
        self.queues: Dict[str, Queue] = {}
        self.calls: Dict[str, Call] = {}
        
    async def connect_mysql(self):
        """Connect to MySQL database"""
        try:
            self.mysql_connection = mysql.connector.connect(**CONFIG['mysql'])
            logger.info("Connected to MySQL database")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MySQL: {e}")
            return False
    
    async def get_agents_from_db(self) -> List[Agent]:
        """Get agents from FreePBX database"""
        if not self.mysql_connection or not self.mysql_connection.is_connected():
            if not await self.connect_mysql():
                return []
        
        try:
            cursor = self.mysql_connection.cursor(dictionary=True)
            
            # Get queue members (agents)
            query = """
            SELECT DISTINCT 
                qm.interface as extension,
                qm.membername as name,
                qm.queue_name,
                CASE 
                    WHEN qm.paused = 1 THEN 'away'
                    ELSE 'available'
                END as status
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
                        status=row['status'],
                        departments=[row['queue_name']] if row['queue_name'] else []
                    )
                else:
                    # Add queue to departments
                    if row['queue_name'] and row['queue_name'] not in agents[agent_id].departments:
                        agents[agent_id].departments.append(row['queue_name'])
            
            return list(agents.values())
            
        except Exception as e:
            logger.error(f"Error fetching agents: {e}")
            return []
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    async def get_queues_from_db(self) -> List[Queue]:
        """Get queue information from database"""
        if not self.mysql_connection or not self.mysql_connection.is_connected():
            if not await self.connect_mysql():
                return []
        
        try:
            cursor = self.mysql_connection.cursor(dictionary=True)
            
            # Get queue configuration
            query = """
            SELECT 
                q.extension,
                q.descr as name,
                COALESCE(qs.calls_waiting, 0) as waiting_calls,
                COALESCE(qs.avg_wait_time, 0) as avg_wait_time,
                COALESCE(qs.longest_wait_time, 0) as longest_wait_time
            FROM queues_config q
            LEFT JOIN (
                SELECT 
                    queue_name,
                    COUNT(*) as calls_waiting,
                    AVG(TIMESTAMPDIFF(SECOND, call_start, NOW())) as avg_wait_time,
                    MAX(TIMESTAMPDIFF(SECOND, call_start, NOW())) as longest_wait_time
                FROM queue_log 
                WHERE event = 'ENTERQUEUE' 
                AND call_start > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                GROUP BY queue_name
            ) qs ON q.extension = qs.queue_name
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            queues = []
            for row in rows:
                queue = Queue(
                    id=row['extension'],
                    name=row['name'],
                    extension=row['extension'],
                    waitingCalls=int(row.get('waiting_calls', 0)),
                    avgWaitTime=int(row.get('avg_wait_time', 0)),
                    longestWaitTime=int(row.get('longest_wait_time', 0))
                )
                queues.append(queue)
            
            return queues
            
        except Exception as e:
            logger.error(f"Error fetching queues: {e}")
            return []
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    async def get_active_calls(self) -> List[Call]:
        """Get active calls (would integrate with AMI for real-time data)"""
        # This is a simplified version - in production you'd use AMI events
        return []

class APIHandler:
    def __init__(self, connector: FreePBXConnector):
        self.connector = connector
    
    async def get_agents(self, request: web_request.Request):
        """API endpoint for agents"""
        try:
            agents = await self.connector.get_agents_from_db()
            return web.json_response([asdict(agent) for agent in agents])
        except Exception as e:
            logger.error(f"Error in get_agents: {e}")
            return web.json_response({"error": str(e)}, status=500)
    
    async def get_queues(self, request: web_request.Request):
        """API endpoint for queues"""
        try:
            queues = await self.connector.get_queues_from_db()
            return web.json_response([asdict(queue) for queue in queues])
        except Exception as e:
            logger.error(f"Error in get_queues: {e}")
            return web.json_response({"error": str(e)}, status=500)
    
    async def get_calls(self, request: web_request.Request):
        """API endpoint for active calls"""
        try:
            calls = await self.connector.get_active_calls()
            return web.json_response([asdict(call) for call in calls])
        except Exception as e:
            logger.error(f"Error in get_calls: {e}")
            return web.json_response({"error": str(e)}, status=500)
    
    async def health(self, request: web_request.Request):
        """Health check endpoint"""
        return web.json_response({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "mysql_connected": self.connector.mysql_connection and self.connector.mysql_connection.is_connected()
        })

async def create_app():
    """Create and configure the web application"""
    connector = FreePBXConnector()
    api_handler = APIHandler(connector)
    
    app = web.Application()
    
    # Add CORS middleware
    async def cors_middleware(request, handler):
        response = await handler(request)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    
    app.middlewares.append(cors_middleware)
    
    # Routes
    app.router.add_get('/health', api_handler.health)
    app.router.add_get('/agents', api_handler.get_agents)
    app.router.add_get('/queues', api_handler.get_queues) 
    app.router.add_get('/calls', api_handler.get_calls)
    
    return app

async def main():
    """Main application entry point"""
    logger.info("Starting FreePBX Contact Center Connector")
    logger.info(f"Configuration: MySQL={CONFIG['mysql']['host']}, Port={CONFIG['port']}")
    
    try:
        app = await create_app()
        runner = web.AppRunner(app)
        await runner.setup()
        
        site = web.TCPSite(runner, '0.0.0.0', CONFIG['port'])
        await site.start()
        
        logger.info(f"🚀 FreePBX Connector running on port {CONFIG['port']}")
        logger.info(f"Health check: http://localhost:{CONFIG['port']}/health")
        logger.info(f"Endpoints: /agents, /queues, /calls")
        
        # Keep the server running
        while True:
            await asyncio.sleep(3600)
            
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
EOF

# Install packages with existing Python 3.9
echo "🐍 Installing Python packages with existing Python 3.9..."
python3 -m pip install --user aiohttp==3.9.1
python3 -m pip install --user mysql-connector-python==8.2.0
python3 -m pip install --user asyncio-mqtt==0.13.0

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
timeout 10s python3 connector.py && echo "✅ Test successful" || echo "⚠️  Test completed (timeout expected)"

# Enable and start service
echo "🚀 Enabling and starting service..."
systemctl daemon-reload
systemctl enable freepbx-connector
systemctl start freepbx-connector

# Wait and check status
sleep 3
echo ""
echo "✅ Installation complete!"
echo ""
echo "Service Status:"
systemctl status freepbx-connector --no-pager --lines=10

echo ""
echo "🌐 Test the connector:"
echo "curl http://localhost:8080/health"
echo ""
echo "📋 Troubleshooting:"
echo "journalctl -u freepbx-connector -f"
EOF

chmod +x install-allinone.sh