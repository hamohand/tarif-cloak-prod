export const environment = {
  production: true,
  keycloak: {
    issuer: `${window.location.origin}/realms/hscode-realm`,
    realm: 'hscode-realm',
    clientId: 'frontend-client',
    redirectUri: window.location.origin + '/'
  },
  apiUrl: '/api'
};
