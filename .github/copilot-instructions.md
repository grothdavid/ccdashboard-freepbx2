# FreePBX Contact Center Dashboard

This project is a FreePBX/Asterisk contact center dashboard with Azure deployment capabilities.

## Project Structure
- **Dashboard**: React frontend with Node.js backend (containerized for Azure)
- **Local Connector**: Python/Node.js service that runs on FreePBX server
- **Integration**: AMI (Asterisk Manager Interface) + MySQL database access

## Architecture
```
[FreePBX 16 + MySQL] ←→ [Local PBX Connector] ←→ [Azure Dashboard Container]
     (AMI + DB)            (Bridge Service)        (Web Interface)
```

## Development Guidelines
- Maintain separation between dashboard and local connector
- Use environment variables for all configuration
- Implement proper error handling and reconnection logic
- Follow FreePBX/Asterisk best practices for AMI integration
- Design for cloud deployment with local data source

## Completed Steps
✅ Project initialization