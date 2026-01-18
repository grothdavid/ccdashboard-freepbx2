@description('FreePBX Contact Center Dashboard - Azure Container Apps Deployment')

@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the Container Apps Environment')
param environmentName string = 'freepbx-dashboard-env'

@description('Name of the dashboard app')
param dashboardAppName string = 'freepbx-dashboard'

@description('Container image for the dashboard')
param dashboardImage string = 'freepbxdashboard:latest'

@description('PBX Connector endpoint (local FreePBX server)')
param pbxConnectorEndpoint string

@description('PBX Connector authentication secret')
@secure()
param pbxConnectorSecret string

@description('Custom domain name (optional)')
param customDomain string = ''

@description('Enable Application Insights')
param enableAppInsights bool = true

var tags = {
  project: 'freepbx-dashboard'
  environment: 'production'
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: '${environmentName}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (enableAppInsights) {
  name: '${environmentName}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Container Apps Environment
resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Dashboard Container App
resource dashboardApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: dashboardAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      secrets: [
        {
          name: 'pbx-connector-secret'
          value: pbxConnectorSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'dashboard'
          image: dashboardImage
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'PBX_CONNECTOR_ENDPOINT'
              value: pbxConnectorEndpoint
            }
            {
              name: 'PBX_CONNECTOR_SECRET'
              secretRef: 'pbx-connector-secret'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: enableAppInsights ? appInsights.properties.ConnectionString : ''
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'cpu-scaling'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
        ]
      }
    }
  }
}

// Custom Domain (if provided)
resource customDomainBinding 'Microsoft.App/containerApps/sourcecontrols@2023-05-01' = if (!empty(customDomain)) {
  name: '${dashboardApp.name}/custom-domain'
  properties: {
    repoUrl: 'https://github.com/your-repo/freepbx-dashboard'
    branch: 'main'
    githubActionConfiguration: {
      registryInfo: {
        registryUrl: 'ghcr.io'
        registryUserName: 'your-username'
        registryPassword: 'your-token'
      }
      azureCredentials: {
        clientId: 'your-client-id'
        clientSecret: 'your-client-secret'
        tenantId: 'your-tenant-id'
        subscriptionId: subscription().subscriptionId
      }
    }
  }
}

// Outputs
output dashboardUrl string = 'https://${dashboardApp.properties.configuration.ingress.fqdn}'
output resourceGroupName string = resourceGroup().name
output environmentName string = environment.name
output dashboardAppName string = dashboardApp.name
output logAnalyticsWorkspaceId string = logAnalytics.id
output applicationInsightsId string = enableAppInsights ? appInsights.id : ''
output customDomain string = customDomain