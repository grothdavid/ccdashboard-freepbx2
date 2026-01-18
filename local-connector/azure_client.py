#!/usr/bin/env python3
"""
Azure Client for Dashboard Communication
Handles real-time data sync to Azure dashboard
"""

import aiohttp
import logging
import json
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class AzureClient:
    """Client for communicating with Azure dashboard"""
    
    def __init__(self, config):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Create session with auth headers
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'FreePBX-Connector/1.0'
        }
        
        if self.config.AZURE_AUTH_TOKEN:
            headers['Authorization'] = f'Bearer {self.config.AZURE_AUTH_TOKEN}'
        
        self.session = aiohttp.ClientSession(
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=self.config.HTTP_TIMEOUT)
        )
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    async def send_update(self, data: Dict) -> bool:
        """Send data update to Azure dashboard"""
        if not self.config.AZURE_DASHBOARD_URL or not self.session:
            return False
        
        try:
            url = f"{self.config.AZURE_DASHBOARD_URL}/api/connector/update"
            
            # Add metadata
            payload = {
                'source': 'freepbx-connector',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'data': data
            }
            
            logger.debug(f"Sending update to Azure: {url}")
            
            async with self.session.post(url, json=payload) as response:
                if response.status == 200:
                    logger.debug("Azure update sent successfully")
                    return True
                else:
                    logger.warning(f"Azure update failed: {response.status} - {await response.text()}")
                    return False
                    
        except aiohttp.ClientError as e:
            logger.error(f"Azure client error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending Azure update: {e}")
            return False
    
    async def send_event(self, event_type: str, event_data: Dict) -> bool:
        """Send real-time event to Azure dashboard"""
        if not self.config.AZURE_DASHBOARD_URL or not self.session:
            return False
        
        try:
            url = f"{self.config.AZURE_DASHBOARD_URL}/api/connector/event"
            
            payload = {
                'type': event_type,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'data': event_data
            }
            
            logger.debug(f"Sending event to Azure: {event_type}")
            
            async with self.session.post(url, json=payload) as response:
                if response.status == 200:
                    logger.debug(f"Azure event {event_type} sent successfully")
                    return True
                else:
                    logger.warning(f"Azure event failed: {response.status} - {await response.text()}")
                    return False
                    
        except aiohttp.ClientError as e:
            logger.error(f"Azure event error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending Azure event: {e}")
            return False
    
    async def register_connector(self) -> bool:
        """Register connector with Azure dashboard"""
        if not self.config.AZURE_DASHBOARD_URL or not self.session:
            return False
        
        try:
            url = f"{self.config.AZURE_DASHBOARD_URL}/api/connector/register"
            
            payload = {
                'connector_id': 'freepbx-local',
                'connector_type': 'freepbx',
                'version': '1.0.0',
                'capabilities': [
                    'real_time_calls',
                    'agent_status',
                    'queue_stats',
                    'historical_data'
                ],
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
            
            logger.info(f"Registering connector with Azure: {url}")
            
            async with self.session.post(url, json=payload) as response:
                if response.status in [200, 201]:
                    logger.info("Connector registered successfully with Azure")
                    return True
                else:
                    logger.warning(f"Connector registration failed: {response.status} - {await response.text()}")
                    return False
                    
        except aiohttp.ClientError as e:
            logger.error(f"Connector registration error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error registering connector: {e}")
            return False
    
    async def test_connection(self) -> Dict:
        """Test connection to Azure dashboard"""
        if not self.config.AZURE_DASHBOARD_URL or not self.session:
            return {
                'success': False,
                'error': 'No Azure dashboard URL configured'
            }
        
        try:
            url = f"{self.config.AZURE_DASHBOARD_URL}/api/health"
            
            logger.debug(f"Testing Azure connection: {url}")
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'success': True,
                        'status': data,
                        'url': url
                    }
                else:
                    return {
                        'success': False,
                        'error': f"HTTP {response.status}",
                        'url': url
                    }
                    
        except aiohttp.ClientError as e:
            return {
                'success': False,
                'error': f"Connection error: {e}",
                'url': self.config.AZURE_DASHBOARD_URL
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Unexpected error: {e}",
                'url': self.config.AZURE_DASHBOARD_URL
            }