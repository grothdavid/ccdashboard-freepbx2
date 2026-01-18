#!/usr/bin/env python3
"""
MySQL Client for FreePBX Database Access
Handles configuration and CDR data retrieval
"""

import aiomysql
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class Agent:
    """Agent/Extension configuration"""
    id: str
    extension: str
    name: str
    email: str
    device_type: str
    status: str = 'offline'
    department: str = 'Default'
    department_id: str = 'default'
    departments: List[str] = None
    
    def __post_init__(self):
        if self.departments is None:
            self.departments = [self.department_id]

@dataclass
class Queue:
    """Queue configuration"""
    id: str
    extension: str
    name: str
    description: str
    strategy: str
    timeout: int
    retry: int
    wrapuptime: int
    status: str = 'open'
    total_calls: int = 0
    answered_calls: int = 0
    abandoned_calls: int = 0
    service_level: float = 0.0

@dataclass
class QueueMember:
    """Queue member configuration"""
    queue_id: str
    agent_id: str
    extension: str
    penalty: int
    paused: bool
    interface: str

class MySQLClient:
    """MySQL client for FreePBX database access"""
    
    def __init__(self, config):
        self.config = config
        self.pool: Optional[aiomysql.Pool] = None
        
    async def connect(self):
        """Connect to MySQL database"""
        try:
            logger.info(f"Connecting to MySQL at {self.config.MYSQL_HOST}:{self.config.MYSQL_PORT}")
            
            self.pool = await aiomysql.create_pool(
                host=self.config.MYSQL_HOST,
                port=self.config.MYSQL_PORT,
                user=self.config.MYSQL_USER,
                password=self.config.MYSQL_PASSWORD,
                db=self.config.MYSQL_DATABASE,
                charset='utf8mb4',
                connect_timeout=self.config.MYSQL_CONNECT_TIMEOUT,
                minsize=1,
                maxsize=10
            )
            
            # Test connection
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute("SELECT 1")
                    result = await cursor.fetchone()
                    
            logger.info("MySQL client connected successfully")
            
        except Exception as e:
            logger.error(f"MySQL connection failed: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from MySQL"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("MySQL client disconnected")
    
    async def get_agents(self) -> List[Agent]:
        """Get agent/extension configuration from FreePBX"""
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # Get extensions from FreePBX users table
                    query = """
                    SELECT 
                        u.extension,
                        u.name as display_name,
                        u.email,
                        s.tech as device_type,
                        s.dial as device_string,
                        u.department
                    FROM users u
                    LEFT JOIN sip s ON u.extension = s.id
                    WHERE u.extension IS NOT NULL 
                    AND u.extension != ''
                    AND u.extension REGEXP '^[0-9]+$'
                    ORDER BY CAST(u.extension AS UNSIGNED)
                    """
                    
                    await cursor.execute(query)
                    results = await cursor.fetchall()
                    
                    agents = []
                    for row in results:
                        agent = Agent(
                            id=f"agent_{row['extension']}",
                            extension=row['extension'],
                            name=row['display_name'] or f"Extension {row['extension']}",
                            email=row['email'] or f"{row['extension']}@pbx.local",
                            device_type=row['device_type'] or 'SIP',
                            department=row['department'] or 'Default',
                            department_id=self._get_department_id(row['department'])
                        )
                        agents.append(agent)
                    
                    logger.debug(f"Retrieved {len(agents)} agents from database")
                    return agents
                    
        except Exception as e:
            logger.error(f"Error retrieving agents: {e}")
            return []
    
    async def get_queues(self) -> List[Queue]:
        """Get queue configuration from FreePBX"""
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # Get queues from FreePBX queues_config table
                    query = """
                    SELECT 
                        qc.extension,
                        qc.descr as description,
                        qc.grppre as name,
                        qd.keyword,
                        qd.data as value
                    FROM queues_config qc
                    LEFT JOIN queues_details qd ON qc.extension = qd.id
                    WHERE qc.extension IS NOT NULL
                    ORDER BY qc.extension, qd.keyword
                    """
                    
                    await cursor.execute(query)
                    results = await cursor.fetchall()
                    
                    # Group results by queue
                    queues_data = {}
                    for row in results:
                        ext = row['extension']
                        if ext not in queues_data:
                            queues_data[ext] = {
                                'extension': ext,
                                'name': row['name'] or f"Queue {ext}",
                                'description': row['description'] or '',
                                'config': {}
                            }
                        
                        if row['keyword'] and row['value']:
                            queues_data[ext]['config'][row['keyword']] = row['value']
                    
                    # Convert to Queue objects
                    queues = []
                    for ext, data in queues_data.items():
                        config = data['config']
                        
                        queue = Queue(
                            id=f"queue_{ext}",
                            extension=ext,
                            name=data['name'],
                            description=data['description'],
                            strategy=config.get('strategy', 'ringall'),
                            timeout=int(config.get('timeout', 15)),
                            retry=int(config.get('retry', 5)),
                            wrapuptime=int(config.get('wrapuptime', 0))
                        )
                        queues.append(queue)
                    
                    # Get historical stats for queues
                    await self._enrich_queue_stats(conn, queues)
                    
                    logger.debug(f"Retrieved {len(queues)} queues from database")
                    return queues
                    
        except Exception as e:
            logger.error(f"Error retrieving queues: {e}")
            return []
    
    async def get_queue_members(self) -> List[QueueMember]:
        """Get queue member assignments"""
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # Get queue members from FreePBX queue_members table
                    query = """
                    SELECT 
                        qm.queue_name as queue_id,
                        qm.interface,
                        qm.membername as member_name,
                        qm.penalty,
                        qm.paused
                    FROM queue_members qm
                    WHERE qm.interface LIKE 'SIP/%' OR qm.interface LIKE 'PJSIP/%'
                    ORDER BY qm.queue_name, qm.interface
                    """
                    
                    await cursor.execute(query)
                    results = await cursor.fetchall()
                    
                    members = []
                    for row in results:
                        # Extract extension from interface (SIP/1001 -> 1001)
                        interface = row['interface']
                        extension = interface.split('/')[-1] if '/' in interface else interface
                        
                        member = QueueMember(
                            queue_id=f"queue_{row['queue_id']}",
                            agent_id=f"agent_{extension}",
                            extension=extension,
                            penalty=int(row['penalty'] or 0),
                            paused=bool(row['paused']),
                            interface=interface
                        )
                        members.append(member)
                    
                    logger.debug(f"Retrieved {len(members)} queue members from database")
                    return members
                    
        except Exception as e:
            logger.error(f"Error retrieving queue members: {e}")
            return []
    
    async def _enrich_queue_stats(self, conn, queues: List[Queue]):
        """Enrich queues with historical statistics from CDR"""
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # Switch to CDR database
                await cursor.execute(f"USE {self.config.MYSQL_CDR_DATABASE}")
                
                # Get stats for last 24 hours
                yesterday = datetime.now() - timedelta(days=1)
                
                for queue in queues:
                    # Get call stats for this queue
                    query = """
                    SELECT 
                        COUNT(*) as total_calls,
                        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) as answered_calls,
                        SUM(CASE WHEN disposition IN ('NO ANSWER', 'FAILED', 'BUSY') THEN 1 ELSE 0 END) as abandoned_calls,
                        AVG(CASE WHEN disposition = 'ANSWERED' THEN billsec ELSE NULL END) as avg_duration
                    FROM cdr 
                    WHERE dstchannel LIKE %s 
                    AND calldate >= %s
                    """
                    
                    queue_pattern = f"%Queue/{queue.extension}%"
                    await cursor.execute(query, (queue_pattern, yesterday))
                    result = await cursor.fetchone()
                    
                    if result:
                        queue.total_calls = int(result['total_calls'] or 0)
                        queue.answered_calls = int(result['answered_calls'] or 0)
                        queue.abandoned_calls = int(result['abandoned_calls'] or 0)
                        
                        # Calculate service level (answered within 20 seconds)
                        if queue.total_calls > 0:
                            queue.service_level = (queue.answered_calls / queue.total_calls) * 100
                
                # Switch back to main database
                await cursor.execute(f"USE {self.config.MYSQL_DATABASE}")
                
        except Exception as e:
            logger.error(f"Error enriching queue stats: {e}")
    
    def _get_department_id(self, department: str) -> str:
        """Convert department name to ID"""
        if not department:
            return 'default'
        
        # Simple mapping - could be enhanced
        dept_map = {
            'Sales': 'sales',
            'Support': 'support', 
            'Technical': 'technical',
            'Billing': 'billing'
        }
        
        return dept_map.get(department, department.lower().replace(' ', '_'))
    
    async def get_call_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get call statistics for specified time period"""
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # Switch to CDR database
                    await cursor.execute(f"USE {self.config.MYSQL_CDR_DATABASE}")
                    
                    since = datetime.now() - timedelta(hours=hours)
                    
                    query = """
                    SELECT 
                        COUNT(*) as total_calls,
                        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) as answered_calls,
                        SUM(CASE WHEN disposition IN ('NO ANSWER', 'FAILED', 'BUSY') THEN 1 ELSE 0 END) as failed_calls,
                        AVG(CASE WHEN disposition = 'ANSWERED' THEN billsec ELSE NULL END) as avg_duration,
                        AVG(CASE WHEN disposition = 'ANSWERED' THEN duration - billsec ELSE NULL END) as avg_wait_time
                    FROM cdr 
                    WHERE calldate >= %s
                    """
                    
                    await cursor.execute(query, (since,))
                    result = await cursor.fetchone()
                    
                    return {
                        'total_calls': int(result['total_calls'] or 0),
                        'answered_calls': int(result['answered_calls'] or 0),
                        'failed_calls': int(result['failed_calls'] or 0),
                        'avg_duration': float(result['avg_duration'] or 0),
                        'avg_wait_time': float(result['avg_wait_time'] or 0),
                        'period_hours': hours,
                        'timestamp': datetime.now()
                    }
                    
        except Exception as e:
            logger.error(f"Error getting call stats: {e}")
            return {}
    
    async def is_connected(self) -> bool:
        """Check if connected to MySQL"""
        if not self.pool:
            return False
        
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute("SELECT 1")
                    return True
        except:
            return False
    
    async def reconnect(self):
        """Reconnect to MySQL"""
        await self.disconnect()
        await self.connect()