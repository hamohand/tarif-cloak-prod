import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';

export const authConfig: AuthConfig = {
  // REALM - Configurable via environment
  issuer: environment.keycloak.issuer,
  redirectUri: environment.keycloak.redirectUri,
  // CLIENT
  clientId: environment.keycloak.clientId,
  responseType: 'code',
  scope: 'openid profile email',
  showDebugInformation: !environment.production,
  strictDiscoveryDocumentValidation: false,
  requireHttps: false,
  skipIssuerCheck: true,
  // Configuration pour la gestion des tokens
  sessionChecksEnabled: true, // Vérifier la session périodiquement
  clearHashAfterLogin: true
};


