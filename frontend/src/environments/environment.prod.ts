// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Généré le : 2026-11-16T11:37:12.378Z
// Configuré via : generate-env.js

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  keycloak: {
    issuer: 'https://auth.client1.box.enclume-numerique.com/realms/hscode-realm',
    realm: 'hscode-realm',
    clientId: 'frontend-client',
    redirectUri: window.location.origin + '/'
  },
  apiUrl: '/api',
  marketVersion: 'DZ'
} as Environment;
