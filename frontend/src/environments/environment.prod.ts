import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  keycloak: {
    issuer: 'https://auth.hscode.enclume-numerique.com/realms/hscode-realm',
    realm: 'hscode-realm',
    clientId: 'frontend-client',
    redirectUri: window.location.origin + '/'
  },
  apiUrl: '/api',
//  marketVersion: 'DEFAULT' // DEFAULT, DZ, etc. - À configurer selon le déploiement
  marketVersion: 'DZ' // Au lieu de 'DEFAULT'
};
