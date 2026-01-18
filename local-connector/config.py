#!/usr/bin/env python3
"""
Configuration module for FreePBX Local Connector
"""

import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    """Configuration settings for the FreePBX connector"""
    
    # Asterisk Manager Interface (AMI) Settings
    AMI_HOST: str = '127.0.0.1'
    AMI_PORT: int = 5038
    AMI_USERNAME: str = 'dashboard_user'
    AMI_PASSWORD: str = 'change_this_password'
    
    # MySQL Database Settings
    MYSQL_HOST: str = '127.0.0.1'
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = 'dashboard_ro'
    MYSQL_PASSWORD: str = 'change_this_password'
    MYSQL_DATABASE: str = 'asterisk'
    MYSQL_CDR_DATABASE: str = 'asteriskcdr'
    
    # Azure Dashboard Settings
    AZURE_DASHBOARD_URL: Optional[str] = None
    AZURE_AUTH_TOKEN: Optional[str] = None
    AZURE_SYNC_INTERVAL: int = 30  # seconds
    
    # Local Web Server Settings
    WEB_SERVER_HOST: str = '127.0.0.1'
    WEB_SERVER_PORT: int = 8080
    WEB_SERVER_AUTH_TOKEN: Optional[str] = None
    
    # Update Intervals (seconds)
    AMI_POLL_INTERVAL: int = 5
    CONFIG_SYNC_INTERVAL: int = 300  # 5 minutes
    QUEUE_STATS_INTERVAL: int = 30
    HEALTH_CHECK_INTERVAL: int = 60
    
    # Logging Settings
    LOG_LEVEL: str = 'INFO'
    LOG_FILE: str = '/var/log/freepbx-connector/connector.log'
    
    # Connection Settings
    AMI_CONNECT_TIMEOUT: int = 10
    AMI_READ_TIMEOUT: int = 30
    MYSQL_CONNECT_TIMEOUT: int = 10
    HTTP_TIMEOUT: int = 30
    
    def __post_init__(self):
        """Load configuration from environment variables"""
        
        # AMI Configuration
        self.AMI_HOST = os.getenv('AMI_HOST', self.AMI_HOST)
        self.AMI_PORT = int(os.getenv('AMI_PORT', self.AMI_PORT))
        self.AMI_USERNAME = os.getenv('AMI_USERNAME', self.AMI_USERNAME)
        self.AMI_PASSWORD = os.getenv('AMI_PASSWORD', self.AMI_PASSWORD)
        
        # MySQL Configuration
        self.MYSQL_HOST = os.getenv('MYSQL_HOST', self.MYSQL_HOST)
        self.MYSQL_PORT = int(os.getenv('MYSQL_PORT', self.MYSQL_PORT))
        self.MYSQL_USER = os.getenv('MYSQL_USER', self.MYSQL_USER)
        self.MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', self.MYSQL_PASSWORD)
        self.MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', self.MYSQL_DATABASE)
        self.MYSQL_CDR_DATABASE = os.getenv('MYSQL_CDR_DATABASE', self.MYSQL_CDR_DATABASE)
        
        # Azure Configuration
        self.AZURE_DASHBOARD_URL = os.getenv('AZURE_DASHBOARD_URL')
        self.AZURE_AUTH_TOKEN = os.getenv('AZURE_AUTH_TOKEN')
        self.AZURE_SYNC_INTERVAL = int(os.getenv('AZURE_SYNC_INTERVAL', self.AZURE_SYNC_INTERVAL))
        
        # Web Server Configuration
        self.WEB_SERVER_HOST = os.getenv('WEB_SERVER_HOST', self.WEB_SERVER_HOST)
        self.WEB_SERVER_PORT = int(os.getenv('WEB_SERVER_PORT', self.WEB_SERVER_PORT))
        self.WEB_SERVER_AUTH_TOKEN = os.getenv('WEB_SERVER_AUTH_TOKEN')
        
        # Interval Configuration
        self.AMI_POLL_INTERVAL = int(os.getenv('AMI_POLL_INTERVAL', self.AMI_POLL_INTERVAL))
        self.CONFIG_SYNC_INTERVAL = int(os.getenv('CONFIG_SYNC_INTERVAL', self.CONFIG_SYNC_INTERVAL))
        self.QUEUE_STATS_INTERVAL = int(os.getenv('QUEUE_STATS_INTERVAL', self.QUEUE_STATS_INTERVAL))
        self.HEALTH_CHECK_INTERVAL = int(os.getenv('HEALTH_CHECK_INTERVAL', self.HEALTH_CHECK_INTERVAL))
        
        # Logging Configuration
        self.LOG_LEVEL = os.getenv('LOG_LEVEL', self.LOG_LEVEL)
        self.LOG_FILE = os.getenv('LOG_FILE', self.LOG_FILE)
        
        # Timeout Configuration
        self.AMI_CONNECT_TIMEOUT = int(os.getenv('AMI_CONNECT_TIMEOUT', self.AMI_CONNECT_TIMEOUT))
        self.AMI_READ_TIMEOUT = int(os.getenv('AMI_READ_TIMEOUT', self.AMI_READ_TIMEOUT))
        self.MYSQL_CONNECT_TIMEOUT = int(os.getenv('MYSQL_CONNECT_TIMEOUT', self.MYSQL_CONNECT_TIMEOUT))
        self.HTTP_TIMEOUT = int(os.getenv('HTTP_TIMEOUT', self.HTTP_TIMEOUT))
    
    def validate(self) -> bool:
        """Validate configuration settings"""
        errors = []
        
        # Required settings
        if not self.AMI_PASSWORD or self.AMI_PASSWORD == 'change_this_password':
            errors.append("AMI_PASSWORD must be set")
        
        if not self.MYSQL_PASSWORD or self.MYSQL_PASSWORD == 'change_this_password':
            errors.append("MYSQL_PASSWORD must be set")
        
        # Port ranges
        if not (1 <= self.AMI_PORT <= 65535):
            errors.append(f"AMI_PORT {self.AMI_PORT} is not valid")
        
        if not (1 <= self.MYSQL_PORT <= 65535):
            errors.append(f"MYSQL_PORT {self.MYSQL_PORT} is not valid")
        
        if not (1 <= self.WEB_SERVER_PORT <= 65535):
            errors.append(f"WEB_SERVER_PORT {self.WEB_SERVER_PORT} is not valid")
        
        # Positive intervals
        intervals = [
            ('AMI_POLL_INTERVAL', self.AMI_POLL_INTERVAL),
            ('CONFIG_SYNC_INTERVAL', self.CONFIG_SYNC_INTERVAL),
            ('QUEUE_STATS_INTERVAL', self.QUEUE_STATS_INTERVAL),
            ('HEALTH_CHECK_INTERVAL', self.HEALTH_CHECK_INTERVAL),
        ]
        
        for name, value in intervals:
            if value <= 0:
                errors.append(f"{name} must be positive")
        
        if errors:
            raise ValueError("Configuration errors: " + ", ".join(errors))
        
        return True
    
    def __str__(self) -> str:
        """String representation (with sensitive data masked)"""
        return f"""FreePBX Connector Configuration:
  AMI: {self.AMI_USERNAME}@{self.AMI_HOST}:{self.AMI_PORT}
  MySQL: {self.MYSQL_USER}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}
  Azure: {self.AZURE_DASHBOARD_URL or 'Not configured'}
  Web Server: {self.WEB_SERVER_HOST}:{self.WEB_SERVER_PORT}
  Intervals: AMI={self.AMI_POLL_INTERVAL}s, Config={self.CONFIG_SYNC_INTERVAL}s, Stats={self.QUEUE_STATS_INTERVAL}s"""

# Example configuration file content
CONFIG_EXAMPLE = """# FreePBX Local Connector Configuration
# Copy this file to config.py and modify as needed

# Asterisk Manager Interface (AMI) Settings
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USERNAME=dashboard_user
AMI_PASSWORD=your_strong_password

# MySQL Database Settings
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=dashboard_ro
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=asterisk
MYSQL_CDR_DATABASE=asteriskcdr

# Azure Dashboard Settings (optional)
AZURE_DASHBOARD_URL=https://your-dashboard.azurecontainerapps.io
AZURE_AUTH_TOKEN=your-generated-token
AZURE_SYNC_INTERVAL=30

# Local Web Server Settings
WEB_SERVER_HOST=127.0.0.1
WEB_SERVER_PORT=8080
WEB_SERVER_AUTH_TOKEN=your-local-auth-token

# Update Intervals (seconds)
AMI_POLL_INTERVAL=5
CONFIG_SYNC_INTERVAL=300
QUEUE_STATS_INTERVAL=30
HEALTH_CHECK_INTERVAL=60

# Logging Settings
LOG_LEVEL=INFO
LOG_FILE=/var/log/freepbx-connector/connector.log
"""