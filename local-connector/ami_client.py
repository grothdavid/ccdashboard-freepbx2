#!/usr/bin/env python3
"""
Asterisk Manager Interface (AMI) Client
Handles real-time communication with Asterisk PBX
"""

import asyncio
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class AMIEvent:
    """Represents an AMI event"""
    event: str
    data: Dict[str, str]
    timestamp: datetime

@dataclass
class CallEvent:
    """Represents a call event"""
    uniqueid: str
    channel: str
    callerid: str
    destination: str
    context: str
    extension: str
    state: str
    direction: str
    timestamp: datetime

class AMIClient:
    """Asterisk Manager Interface client with event handling"""
    
    def __init__(self, config):
        self.config = config
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.connected = False
        self.logged_in = False
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.active_calls: Dict[str, CallEvent] = {}
        self.agent_states: Dict[str, Dict] = {}
        
    async def connect(self) -> bool:
        """Connect to AMI"""
        try:
            logger.info(f"Connecting to AMI at {self.config.AMI_HOST}:{self.config.AMI_PORT}")
            
            self.reader, self.writer = await asyncio.wait_for(
                asyncio.open_connection(
                    self.config.AMI_HOST, 
                    self.config.AMI_PORT
                ),
                timeout=self.config.AMI_CONNECT_TIMEOUT
            )
            
            self.connected = True
            
            # Read AMI greeting
            greeting = await self.reader.readline()
            logger.debug(f"AMI greeting: {greeting.decode().strip()}")
            
            # Login
            if await self.login():
                self.logged_in = True
                
                # Start event listener
                asyncio.create_task(self._event_listener())
                
                # Request initial status
                await self._request_initial_status()
                
                logger.info("AMI client connected and logged in")
                return True
            else:
                logger.error("AMI login failed")
                await self.disconnect()
                return False
                
        except Exception as e:
            logger.error(f"AMI connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self):
        """Disconnect from AMI"""
        logger.info("Disconnecting from AMI")
        
        self.connected = False
        self.logged_in = False
        
        if self.writer:
            try:
                await self.send_action('Logoff')
                self.writer.close()
                await self.writer.wait_closed()
            except:
                pass
            
        self.reader = None
        self.writer = None
        
    async def login(self) -> bool:
        """Login to AMI"""
        try:
            response = await self.send_action('Login', {
                'Username': self.config.AMI_USERNAME,
                'Secret': self.config.AMI_PASSWORD
            })
            
            return response and response.get('Response') == 'Success'
            
        except Exception as e:
            logger.error(f"AMI login error: {e}")
            return False
    
    async def send_action(self, action: str, parameters: Dict[str, str] = None) -> Dict[str, str]:
        """Send AMI action and get response"""
        if not self.connected or not self.writer:
            raise ConnectionError("Not connected to AMI")
        
        # Build action message
        message = f"Action: {action}\r\n"
        
        if parameters:
            for key, value in parameters.items():
                message += f"{key}: {value}\r\n"
        
        message += "\r\n"
        
        # Send message
        self.writer.write(message.encode())
        await self.writer.drain()
        
        # Read response
        response = await self._read_response()
        return response
    
    async def _read_response(self) -> Dict[str, str]:
        """Read AMI response message"""
        response = {}
        
        while True:
            line = await self.reader.readline()
            if not line:
                break
                
            line = line.decode().strip()
            
            if not line:  # Empty line indicates end of response
                break
                
            if ':' in line:
                key, value = line.split(':', 1)
                response[key.strip()] = value.strip()
        
        return response
    
    async def _event_listener(self):
        """Listen for AMI events"""
        logger.info("Starting AMI event listener")
        
        while self.connected:
            try:
                event_data = await self._read_response()
                
                if event_data and 'Event' in event_data:
                    event = AMIEvent(
                        event=event_data['Event'],
                        data=event_data,
                        timestamp=datetime.now()
                    )
                    
                    await self._handle_event(event)
                    
            except Exception as e:
                logger.error(f"Event listener error: {e}")
                if not self.connected:
                    break
                await asyncio.sleep(1)
    
    async def _handle_event(self, event: AMIEvent):
        """Handle incoming AMI events"""
        event_type = event.event
        
        # Handle call events
        if event_type in ['Newchannel', 'Newstate', 'Hangup', 'Bridge', 'Join', 'Leave']:
            await self._handle_call_event(event)
        
        # Handle agent/device state events  
        elif event_type in ['DeviceStateChange', 'ExtensionStatus']:
            await self._handle_agent_event(event)
        
        # Handle queue events
        elif event_type in ['QueueMemberStatus', 'QueueParams', 'QueueEntry']:
            await self._handle_queue_event(event)
        
        # Call registered event handlers
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    await handler(event)
                except Exception as e:
                    logger.error(f"Event handler error: {e}")
    
    async def _handle_call_event(self, event: AMIEvent):
        """Handle call-related events"""
        data = event.data
        uniqueid = data.get('Uniqueid')
        
        if not uniqueid:
            return
        
        if event.event == 'Newchannel':
            # New call started
            call = CallEvent(
                uniqueid=uniqueid,
                channel=data.get('Channel', ''),
                callerid=data.get('CallerIDNum', ''),
                destination=data.get('Exten', ''),
                context=data.get('Context', ''),
                extension=self._extract_extension(data.get('Channel', '')),
                state='ringing',
                direction=self._determine_call_direction(data),
                timestamp=datetime.now()
            )
            
            self.active_calls[uniqueid] = call
            logger.debug(f"New call: {call.callerid} -> {call.destination}")
            
        elif event.event == 'Newstate':
            # Call state changed
            if uniqueid in self.active_calls:
                call = self.active_calls[uniqueid]
                call.state = data.get('ChannelState', 'unknown')
                
        elif event.event == 'Hangup':
            # Call ended
            if uniqueid in self.active_calls:
                call = self.active_calls.pop(uniqueid)
                logger.debug(f"Call ended: {call.callerid} -> {call.destination}")
    
    async def _handle_agent_event(self, event: AMIEvent):
        """Handle agent/extension state events"""
        data = event.data
        device = data.get('Device', '')
        state = data.get('State', '')
        
        if device:
            self.agent_states[device] = {
                'state': state,
                'timestamp': datetime.now(),
                'event_data': data
            }
    
    async def _handle_queue_event(self, event: AMIEvent):
        """Handle queue-related events"""
        # Queue event handling implementation
        pass
    
    def _extract_extension(self, channel: str) -> str:
        """Extract extension number from channel name"""
        # Match patterns like SIP/1001-000001
        match = re.search(r'SIP/(\d+)', channel)
        if match:
            return match.group(1)
        
        # Match patterns like PJSIP/1001-000001  
        match = re.search(r'PJSIP/(\d+)', channel)
        if match:
            return match.group(1)
        
        return ''
    
    def _determine_call_direction(self, data: Dict[str, str]) -> str:
        """Determine call direction based on context and channel"""
        context = data.get('Context', '').lower()
        
        if 'from-external' in context or 'from-pstn' in context:
            return 'inbound'
        elif 'from-internal' in context:
            return 'outbound'
        else:
            return 'internal'
    
    async def get_queue_status(self, queue: str) -> Dict:
        """Get queue status via AMI"""
        try:
            response = await self.send_action('QueueStatus', {'Queue': queue})
            return response
        except Exception as e:
            logger.error(f"Error getting queue status for {queue}: {e}")
            return {}
    
    async def get_device_state(self, device: str) -> str:
        """Get device state"""
        try:
            response = await self.send_action('DeviceState', {'Device': device})
            return response.get('State', 'UNKNOWN')
        except Exception as e:
            logger.error(f"Error getting device state for {device}: {e}")
            return 'UNKNOWN'
    
    async def _request_initial_status(self):
        """Request initial status from Asterisk"""
        try:
            # Request all queue statuses
            await self.send_action('QueueStatus')
            
            # Request all extension states
            await self.send_action('ExtensionState')
            
        except Exception as e:
            logger.error(f"Error requesting initial status: {e}")
    
    def register_event_handler(self, event_type: str, handler: Callable):
        """Register an event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    def get_active_calls(self) -> List[CallEvent]:
        """Get list of active calls"""
        return list(self.active_calls.values())
    
    def get_agent_states(self) -> Dict[str, Dict]:
        """Get agent/device states"""
        return self.agent_states.copy()
    
    async def is_connected(self) -> bool:
        """Check if connected to AMI"""
        return self.connected and self.logged_in
    
    async def reconnect(self) -> bool:
        """Reconnect to AMI"""
        await self.disconnect()
        await asyncio.sleep(2)
        return await self.connect()