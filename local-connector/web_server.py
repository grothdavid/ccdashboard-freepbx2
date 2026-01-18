#!/usr/bin/env python3
"""
Local Web Server for FreePBX Connector
Provides REST API for dashboard communication
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from mysql_client import Agent, Queue, QueueMember
from ami_client import CallEvent

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

class WebServer:
    """Local web server providing REST API for dashboard"""
    
    def __init__(self, config, ami_client, mysql_client, azure_client=None):
        self.config = config
        self.ami_client = ami_client
        self.mysql_client = mysql_client
        self.azure_client = azure_client
        
        # Data caches
        self.agents_cache: Dict[str, Agent] = {}
        self.queues_cache: Dict[str, Queue] = {}
        self.queue_members_cache: List[QueueMember] = []
        self.queue_stats_cache: Dict[str, Dict] = {}
        
        # Initialize FastAPI app
        self.app = FastAPI(
            title="FreePBX Connector API",
            description="Local connector API for FreePBX dashboard integration",
            version="1.0.0"
        )
        
        # Add CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure appropriately for production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )
        
        self._setup_routes()
        
    def _setup_routes(self):
        """Setup API routes"""
        
        # Authentication dependency
        async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
            if self.config.WEB_SERVER_AUTH_TOKEN:
                if not credentials or credentials.credentials != self.config.WEB_SERVER_AUTH_TOKEN:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid authentication token",
                        headers={"WWW-Authenticate": "Bearer"}
                    )
        
        # Health check
        @self.app.get("/api/health")
        async def health_check():
            """Health check endpoint"""
            return {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat() + 'Z',
                "version": "1.0.0",
                "components": {
                    "ami": await self.ami_client.is_connected() if self.ami_client else False,
                    "mysql": await self.mysql_client.is_connected() if self.mysql_client else False,
                    "azure": bool(self.azure_client)
                }
            }
        
        # Agents endpoint
        @self.app.get("/api/agents", dependencies=[Depends(verify_token)])
        async def get_agents():
            """Get agents with current status"""
            agents_data = []
            
            for agent in self.agents_cache.values():
                # Get current status from AMI
                device_state = 'UNKNOWN'
                current_call = None
                
                if self.ami_client:
                    # Get device state
                    device = f"SIP/{agent.extension}"
                    device_state = await self.ami_client.get_device_state(device)
                    
                    # Check for active calls
                    active_calls = self.ami_client.get_active_calls()
                    for call in active_calls:
                        if call.extension == agent.extension:
                            current_call = {
                                'uniqueid': call.uniqueid,
                                'phoneNumber': call.callerid,
                                'direction': call.direction,
                                'duration': int((datetime.now() - call.timestamp).total_seconds()),
                                'state': call.state
                            }
                            break
                
                # Map device state to standard status
                status = self._map_device_state_to_status(device_state)
                if current_call:
                    status = 'busy'
                
                agent_data = {
                    'id': agent.id,
                    'extension': agent.extension,
                    'name': agent.name,
                    'email': agent.email,
                    'status': status,
                    'deviceState': device_state,
                    'department': agent.department,
                    'departmentId': agent.department_id,
                    'departments': agent.departments,
                    'currentCall': current_call,
                    'lastStatusChange': datetime.utcnow().isoformat() + 'Z'
                }
                
                agents_data.append(agent_data)
            
            return agents_data
        
        # Queues endpoint
        @self.app.get("/api/queues", dependencies=[Depends(verify_token)])
        async def get_queues():
            """Get queues with current status"""
            queues_data = []
            
            for queue in self.queues_cache.values():
                # Get current stats from cache
                stats = self.queue_stats_cache.get(queue.id, {})
                
                # Count agents in queue
                queue_agents = [m for m in self.queue_members_cache if m.queue_id == queue.id]
                available_agents = 0
                busy_agents = 0
                
                for member in queue_agents:
                    agent = self.agents_cache.get(member.agent_id)
                    if agent:
                        device_state = 'UNKNOWN'
                        if self.ami_client:
                            device_state = await self.ami_client.get_device_state(f"SIP/{agent.extension}")
                        
                        status = self._map_device_state_to_status(device_state)
                        if status == 'available':
                            available_agents += 1
                        elif status == 'busy':
                            busy_agents += 1
                
                queue_data = {
                    'id': queue.id,
                    'extension': queue.extension,
                    'name': queue.name,
                    'description': queue.description,
                    'strategy': queue.strategy,
                    'timeout': queue.timeout,
                    'retry': queue.retry,
                    'wrapuptime': queue.wrapuptime,
                    'status': queue.status,
                    'totalAgents': len(queue_agents),
                    'agentsAvailable': available_agents,
                    'agentsOnCall': busy_agents,
                    'agentsBusy': busy_agents,
                    'waitingCalls': stats.get('waiting_calls', 0),
                    'longestWait': stats.get('longest_wait', 0),
                    'averageWait': stats.get('average_wait', 0),
                    'totalCalls': queue.total_calls,
                    'answeredCalls': queue.answered_calls,
                    'abandonedCalls': queue.abandoned_calls,
                    'serviceLevel': queue.service_level
                }
                
                queues_data.append(queue_data)
            
            return queues_data
        
        # Calls endpoint
        @self.app.get("/api/calls", dependencies=[Depends(verify_token)])
        async def get_calls():
            """Get active calls"""
            calls_data = []
            
            if self.ami_client:
                active_calls = self.ami_client.get_active_calls()
                
                for call in active_calls:
                    # Find agent info
                    agent_name = f"Extension {call.extension}"
                    for agent in self.agents_cache.values():
                        if agent.extension == call.extension:
                            agent_name = agent.name
                            break
                    
                    call_data = {
                        'id': call.uniqueid,
                        'uniqueid': call.uniqueid,
                        'channel': call.channel,
                        'direction': call.direction,
                        'from': call.callerid if call.direction == 'inbound' else call.extension,
                        'to': call.destination if call.direction == 'outbound' else call.extension,
                        'agentId': f"agent_{call.extension}",
                        'agentName': agent_name,
                        'extension': call.extension,
                        'duration': int((datetime.now() - call.timestamp).total_seconds()),
                        'state': call.state,
                        'status': 'active',
                        'startTime': call.timestamp.isoformat() + 'Z',
                        'context': call.context
                    }
                    
                    calls_data.append(call_data)
            
            return calls_data
        
        # Statistics endpoint
        @self.app.get("/api/stats", dependencies=[Depends(verify_token)])
        async def get_stats():
            """Get overall statistics"""
            # Get call stats from MySQL
            call_stats = await self.mysql_client.get_call_stats(24) if self.mysql_client else {}
            
            # Count agent statuses
            agent_statuses = {'available': 0, 'busy': 0, 'offline': 0, 'away': 0}
            
            for agent in self.agents_cache.values():
                if self.ami_client:
                    device_state = await self.ami_client.get_device_state(f"SIP/{agent.extension}")
                    status = self._map_device_state_to_status(device_state)
                    
                    # Check for active calls
                    active_calls = self.ami_client.get_active_calls()
                    for call in active_calls:
                        if call.extension == agent.extension:
                            status = 'busy'
                            break
                    
                    agent_statuses[status] = agent_statuses.get(status, 0) + 1
                else:
                    agent_statuses['offline'] += 1
            
            # Count queue stats
            total_waiting = sum(stats.get('waiting_calls', 0) for stats in self.queue_stats_cache.values())
            
            return {
                'agents': {
                    'total': len(self.agents_cache),
                    **agent_statuses
                },
                'calls': {
                    'active': len(self.ami_client.get_active_calls()) if self.ami_client else 0,
                    'waiting': total_waiting,
                    'answered': call_stats.get('answered_calls', 0),
                    'abandoned': call_stats.get('failed_calls', 0)
                },
                'queues': {
                    'total': len(self.queues_cache),
                    'averageWaitTime': sum(stats.get('average_wait', 0) for stats in self.queue_stats_cache.values()) / max(len(self.queue_stats_cache), 1),
                    'longestWaitTime': max((stats.get('longest_wait', 0) for stats in self.queue_stats_cache.values()), default=0)
                },
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _map_device_state_to_status(self, device_state: str) -> str:
        """Map Asterisk device state to standard status"""
        state_map = {
            'NOT_INUSE': 'available',
            'INUSE': 'busy',
            'RINGING': 'busy',
            'RINGINUSE': 'busy',
            'ONHOLD': 'busy',
            'BUSY': 'busy',
            'INVALID': 'offline',
            'UNAVAILABLE': 'away',
            'UNKNOWN': 'offline'
        }
        
        return state_map.get(device_state, 'offline')
    
    async def start(self):
        """Start web server"""
        config = uvicorn.Config(
            app=self.app,
            host=self.config.WEB_SERVER_HOST,
            port=self.config.WEB_SERVER_PORT,
            log_level="info"
        )
        
        server = uvicorn.Server(config)
        await server.serve()
    
    async def stop(self):
        """Stop web server"""
        # Server shutdown is handled by uvicorn
        pass
    
    # Data update methods
    def update_agents(self, agents: List[Agent]):
        """Update agents cache"""
        self.agents_cache = {agent.id: agent for agent in agents}
    
    def update_queues(self, queues: List[Queue]):
        """Update queues cache"""
        self.queues_cache = {queue.id: queue for queue in queues}
    
    def update_queue_members(self, members: List[QueueMember]):
        """Update queue members cache"""
        self.queue_members_cache = members
    
    def update_queue_stats(self, queue_id: str, stats: Dict):
        """Update queue statistics"""
        self.queue_stats_cache[queue_id] = stats
    
    # Data accessor methods
    def get_agents_data(self) -> Dict:
        """Get agents data for Azure sync"""
        return [{
            'id': agent.id,
            'extension': agent.extension,
            'name': agent.name,
            'status': 'offline',  # Will be updated with real-time data
            'department': agent.department
        } for agent in self.agents_cache.values()]
    
    def get_queues_data(self) -> Dict:
        """Get queues data for Azure sync"""
        return [{
            'id': queue.id,
            'name': queue.name,
            'extension': queue.extension,
            'stats': self.queue_stats_cache.get(queue.id, {})
        } for queue in self.queues_cache.values()]
    
    def get_calls_data(self) -> Dict:
        """Get calls data for Azure sync"""
        if not self.ami_client:
            return []
        
        return [{
            'id': call.uniqueid,
            'extension': call.extension,
            'direction': call.direction,
            'duration': int((datetime.now() - call.timestamp).total_seconds())
        } for call in self.ami_client.get_active_calls()]
    
    def get_queue_ids(self) -> List[str]:
        """Get list of queue IDs"""
        return list(self.queues_cache.keys())