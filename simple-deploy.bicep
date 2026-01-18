// Simple Azure Container Apps deployment for FreePBX Dashboard
param location string = resourceGroup().location
param dashboardImage string = 'freepbxdashboardacr.azurecr.io/freepbx-dashboard:latest'
param pbxConnectorEndpoint string
@secure()
param pbxConnectorSecret string

var environmentName = 'freepbx-env'
var appName = 'freepbx-dashboard'

// Container Apps Environment
resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  properties: {
    zoneRedundant: false
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        allowInsecure: false
      }
      registries: [
        {
          server: 'freepbxdashboardacr.azurecr.io'
          username: 'freepbxdashboardacr'
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: listCredentials(resourceId('Microsoft.ContainerRegistry/registries', 'freepbxdashboardacr'), '2021-09-01').passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'freepbx-dashboard'
          image: dashboardImage
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PBX_CONNECTOR_ENDPOINT'
              value: pbxConnectorEndpoint
            }
            {
              name: 'PBX_CONNECTOR_SECRET'
              value: pbxConnectorSecret
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output dashboardUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'