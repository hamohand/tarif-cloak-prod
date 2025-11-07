export const environment = {
  production: true,
  keycloak: {
    issuer: 'https://auth.hscode.enclume-numerique.com/realms/hscode-realm',
    realm: 'hscode-realm',
    clientId: 'frontend-client',
    redirectUri: window.location.origin + '/'
  },
  apiUrl: '/api'
};
