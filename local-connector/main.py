#!/usr/bin/env python3
"""
FreePBX Local Connector
Connects to Asterisk AMI and MySQL to provide real-time data to Azure dashboard
"""

import asyncio
import logging
import signal
import sys
from datetime import datetime
from typing import Optional

from ami_client import AMIClient
from mysql_client import MySQLClient
from azure_client import AzureClient
from web_server import WebServer
from config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/freepbx-connector/connector.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class FreePBXConnector:
    """Main connector service that orchestrates all components"""
    
    def __init__(self):
        self.config = Config()
        self.ami_client: Optional[AMIClient] = None
        self.mysql_client: Optional[MySQLClient] = None
        self.azure_client: Optional[AzureClient] = None
        self.web_server: Optional[WebServer] = None
        self.running = False
        
    async def start(self):
        """Start all connector components"""
        logger.info("Starting FreePBX Connector...")
        
        try:
            # Initialize MySQL client
            self.mysql_client = MySQLClient(self.config)
            await self.mysql_client.connect()
            logger.info("MySQL client connected")
            
            # Initialize AMI client
            self.ami_client = AMIClient(self.config)
            await self.ami_client.connect()
            logger.info("AMI client connected")
            
            # Initialize Azure client
            if self.config.AZURE_DASHBOARD_URL:
                self.azure_client = AzureClient(self.config)
                logger.info("Azure client initialized")
            
            # Initialize web server
            self.web_server = WebServer(
                self.config, 
                self.ami_client, 
                self.mysql_client,
                self.azure_client
            )
            
            # Start web server
            await self.web_server.start()
            logger.info(f"Web server started on port {self.config.WEB_SERVER_PORT}")
            
            # Start data sync loops
            self.running = True
            
            # Start background tasks
            tasks = [
                asyncio.create_task(self.sync_configuration()),
                asyncio.create_task(self.sync_queue_stats()),
                asyncio.create_task(self.monitor_health()),
            ]
            
            if self.azure_client:
                tasks.append(asyncio.create_task(self.sync_to_azure()))
            
            logger.info("All components started successfully")
            
            # Wait for shutdown signal
            await asyncio.gather(*tasks, return_exceptions=True)
            
        except Exception as e:
            logger.error(f"Failed to start connector: {e}")
            await self.stop()
            raise
    
    async def stop(self):
        """Stop all connector components"""
        logger.info("Stopping FreePBX Connector...")
        
        self.running = False
        
        if self.web_server:
            await self.web_server.stop()
            
        if self.ami_client:
            await self.ami_client.disconnect()
            
        if self.mysql_client:
            await self.mysql_client.disconnect()
            
        logger.info("FreePBX Connector stopped")
    
    async def sync_configuration(self):
        """Periodically sync configuration data from FreePBX database"""
        while self.running:
            try:
                logger.debug("Syncing configuration data")
                
                # Sync agents/extensions
                agents = await self.mysql_client.get_agents()
                self.web_server.update_agents(agents)
                
                # Sync queues
                queues = await self.mysql_client.get_queues()
                self.web_server.update_queues(queues)
                
                # Sync queue members
                queue_members = await self.mysql_client.get_queue_members()
                self.web_server.update_queue_members(queue_members)
                
                logger.debug(f"Synced {len(agents)} agents, {len(queues)} queues")
                
            except Exception as e:
                logger.error(f"Configuration sync error: {e}")
            
            await asyncio.sleep(self.config.CONFIG_SYNC_INTERVAL)
    
    async def sync_queue_stats(self):
        """Periodically update queue statistics"""
        while self.running:
            try:
                logger.debug("Updating queue statistics")
                
                # Get queue stats from AMI
                for queue_id in self.web_server.get_queue_ids():
                    stats = await self.ami_client.get_queue_status(queue_id)
                    if stats:
                        self.web_server.update_queue_stats(queue_id, stats)
                
            except Exception as e:
                logger.error(f"Queue stats sync error: {e}")
            
            await asyncio.sleep(self.config.QUEUE_STATS_INTERVAL)
    
    async def sync_to_azure(self):
        """Periodically send data to Azure dashboard"""
        if not self.azure_client:
            return
            
        while self.running:
            try:
                logger.debug("Syncing data to Azure dashboard")
                
                # Get current data
                data = {
                    'agents': self.web_server.get_agents_data(),
                    'queues': self.web_server.get_queues_data(),
                    'calls': self.web_server.get_calls_data(),
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                
                # Send to Azure
                success = await self.azure_client.send_update(data)
                if success:
                    logger.debug("Data synced to Azure successfully")
                else:
                    logger.warning("Failed to sync data to Azure")
                
            except Exception as e:
                logger.error(f"Azure sync error: {e}")
            
            await asyncio.sleep(self.config.AZURE_SYNC_INTERVAL)
    
    async def monitor_health(self):
        """Monitor component health and restart if needed"""
        while self.running:
            try:
                # Check AMI connection
                if not await self.ami_client.is_connected():
                    logger.warning("AMI connection lost, attempting reconnect")
                    await self.ami_client.reconnect()
                
                # Check MySQL connection
                if not await self.mysql_client.is_connected():
                    logger.warning("MySQL connection lost, attempting reconnect")
                    await self.mysql_client.reconnect()
                
                # Log health status
                logger.debug("Health check passed")
                
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
            
            await asyncio.sleep(self.config.HEALTH_CHECK_INTERVAL)

async def signal_handler(connector):
    """Handle shutdown signals gracefully"""
    logger.info("Received shutdown signal")
    await connector.stop()
    sys.exit(0)

async def main():
    """Main entry point"""
    connector = FreePBXConnector()
    
    # Setup signal handlers
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda s, f: asyncio.create_task(signal_handler(connector)))
    
    try:
        await connector.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
        await connector.stop()
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        await connector.stop()
        sys.exit(1)

if __name__ == "__main__":
    # Ensure log directory exists
    import os
    os.makedirs('/var/log/freepbx-connector', exist_ok=True)
    
    # Run the connector
    asyncio.run(main())