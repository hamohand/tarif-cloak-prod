# Variables d'Environnement - Documentation Complète

Ce document liste toutes les variables d'environnement utilisées dans le projet.

## 📋 Instructions

1. Créez un fichier `.env` à la racine du projet
2. Copiez les variables ci-dessous et adaptez les valeurs à votre environnement
3. **IMPORTANT** : Ne commitez jamais le fichier `.env` dans Git (il est déjà dans `.gitignore`)

## 🔧 Variables d'Environnement

### Configuration Générale du Projet

```env
# Nom du projet (utilisé pour les noms de conteneurs et volumes)
PROJECT_NAME=app

# Nom du service frontend
FRONTEND_SERVICE_NAME=frontend
```

### Configuration des Domaines

```env
# Domaines principaux pour le frontend et le backend
FRONTEND_DOMAIN=hscode.enclume-numerique.com
WWW_FRONTEND_DOMAIN=www.hscode.enclume-numerique.com

# Domaine pour Keycloak (authentification)
KEYCLOAK_DOMAIN=auth.hscode.enclume-numerique.com
KC_HOSTNAME=auth.hscode.enclume-numerique.com
```

### Configuration Traefik

```env
# Nom du certificate resolver Traefik pour les certificats Let's Encrypt
TRAEFIK_CERT_RESOLVER=myresolver
```

### Configuration des Ports Internes

```env
# Ports internes des services (ne pas exposer à l'extérieur)
FRONTEND_INTERNAL_PORT=80
BACKEND_INTERNAL_PORT=8081
KEYCLOAK_INTERNAL_PORT=8080
POSTGRES_PORT=5432
```

### Configuration PostgreSQL - Base de Données Application

```env
POSTGRES_DB=app-db
POSTGRES_USER=muhend
POSTGRES_PASSWORD=CHANGEZ_MOI

# Nom du service de base de données (utilisé dans les URLs JDBC)
DB_SERVICE_NAME=app-db

# Version de l'image PostgreSQL
POSTGRES_IMAGE_TAG=16
```

### Configuration PostgreSQL - Base de Données Keycloak

```env
KEYCLOAK_DB=keycloak
KEYCLOAK_DB_USER=keycloak
KEYCLOAK_DB_PASSWORD=CHANGEZ_MOI

# Nom du service de base de données Keycloak
DB_KEYCLOAK_SERVICE_NAME=keycloak-db
```

### Configuration Keycloak

```env
# Nom du realm Keycloak
KEYCLOAK_REALM=hscode-realm

# Identifiants administrateur Keycloak
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=CHANGEZ_MOI

# Configuration des clients Keycloak
KEYCLOAK_FRONTEND_CLIENT=frontend-client
KEYCLOAK_BACKEND_CLIENT=backend-client
KEYCLOAK_BACKEND_CLIENT_SECRET=CHANGEZ_MOI

# URLs Keycloak
# URL interne : utilisée par les services Docker pour communiquer entre eux
KEYCLOAK_INTERNAL_URL=http://keycloak:8080
# URL externe : utilisée par le frontend et les tokens JWT
KEYCLOAK_EXTERNAL_URL=https://auth.hscode.enclume-numerique.com

# Version de l'image Keycloak
KEYCLOAK_IMAGE_TAG=22.0.1
```

### Configuration Keycloak - Timeouts et Retry

```env
# Timeout de connexion pour les requêtes de validation de jeton (ms)
KEYCLOAK_CONNECTION_TIMEOUT=10000

# Timeout de lecture pour les requêtes de validation de jeton (ms)
KEYCLOAK_READ_TIMEOUT=10000

# Nombre maximum de tentatives en cas d'échec
KEYCLOAK_RETRY_MAX_ATTEMPTS=5

# Durée d'attente entre les tentatives
KEYCLOAK_RETRY_WAIT_DURATION=10s
```

### Configuration CORS

```env
# Origines CORS autorisées (séparées par des virgules)
# Format: "https://domain1.com,https://www.domain1.com,http://localhost:4200"
CORS_ALLOWED_ORIGINS=https://hscode.enclume-numerique.com,https://www.hscode.enclume-numerique.com,http://localhost:4200
```

### Configuration SMTP (Email)

```env
# Serveur SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Identifiants SMTP
SMTP_USERNAME=votre_email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_application

# Configuration SMTP
SMTP_AUTH=true
SMTP_STARTTLS=true
SMTP_STARTTLS_REQUIRED=true
SMTP_CONNECTION_TIMEOUT=5000
SMTP_TIMEOUT=5000
SMTP_WRITE_TIMEOUT=5000

# Expéditeur par défaut
SMTP_FROM=noreply@enclume-numerique.com
SMTP_FROM_NAME=Enclume Numérique

# URL du frontend (pour les liens dans les emails)
FRONTEND_URL=https://hscode.enclume-numerique.com
```

**Note** : Pour Gmail, vous devez utiliser un "Mot de passe d'application" au lieu de votre mot de passe habituel. Consultez [la documentation Gmail](https://support.google.com/accounts/answer/185833) pour plus d'informations.

### Configuration Spring Boot

```env
# Profil Spring Boot (dev ou prod)
SPRING_PROFILES_ACTIVE=prod
```

### Configuration Services IA

```env
# OpenAI
OPENAI_API_KEY=CHANGEZ_MOI
OPENAI_MODEL=gpt-4

# Anthropic (Claude)
ANTHROPIC_API_KEY=CHANGEZ_MOI
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Ollama
OLLAMA_API_KEY=CHANGEZ_MOI
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Configuration Frontend

```env
# URL de l'API backend (utilisée par le frontend)
# En production, utilisez un chemin relatif: /api
# En développement, utilisez: http://localhost:8081/api
API_URL=/api
```

## 📝 Exemple de Fichier .env Complet

```env
# ===============================================================
# CONFIGURATION GÉNÉRALE
# ===============================================================
PROJECT_NAME=app
FRONTEND_SERVICE_NAME=frontend

# ===============================================================
# DOMAINES
# ===============================================================
FRONTEND_DOMAIN=hscode.enclume-numerique.com
WWW_FRONTEND_DOMAIN=www.hscode.enclume-numerique.com
KEYCLOAK_DOMAIN=auth.hscode.enclume-numerique.com
KC_HOSTNAME=auth.hscode.enclume-numerique.com

# ===============================================================
# TRAEFIK
# ===============================================================
TRAEFIK_CERT_RESOLVER=myresolver

# ===============================================================
# PORTS
# ===============================================================
FRONTEND_INTERNAL_PORT=80
BACKEND_INTERNAL_PORT=8081
KEYCLOAK_INTERNAL_PORT=8080
POSTGRES_PORT=5432

# ===============================================================
# POSTGRESQL - APPLICATION
# ===============================================================
POSTGRES_DB=app-db
POSTGRES_USER=muhend
POSTGRES_PASSWORD=votre_mot_de_passe_securise
DB_SERVICE_NAME=app-db
POSTGRES_IMAGE_TAG=16

# ===============================================================
# POSTGRESQL - KEYCLOAK
# ===============================================================
KEYCLOAK_DB=keycloak
KEYCLOAK_DB_USER=keycloak
KEYCLOAK_DB_PASSWORD=votre_mot_de_passe_keycloak
DB_KEYCLOAK_SERVICE_NAME=keycloak-db

# ===============================================================
# KEYCLOAK
# ===============================================================
KEYCLOAK_REALM=hscode-realm
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=votre_admin_password
KEYCLOAK_FRONTEND_CLIENT=frontend-client
KEYCLOAK_BACKEND_CLIENT=backend-client
KEYCLOAK_BACKEND_CLIENT_SECRET=votre_client_secret
KEYCLOAK_INTERNAL_URL=http://keycloak:8080
KEYCLOAK_EXTERNAL_URL=https://auth.hscode.enclume-numerique.com
KEYCLOAK_IMAGE_TAG=22.0.1

# ===============================================================
# KEYCLOAK - TIMEOUTS ET RETRY
# ===============================================================
KEYCLOAK_CONNECTION_TIMEOUT=10000
KEYCLOAK_READ_TIMEOUT=10000
KEYCLOAK_RETRY_MAX_ATTEMPTS=5
KEYCLOAK_RETRY_WAIT_DURATION=10s

# ===============================================================
# CORS
# ===============================================================
CORS_ALLOWED_ORIGINS=https://hscode.enclume-numerique.com,https://www.hscode.enclume-numerique.com,http://localhost:4200

# ===============================================================
# SMTP (EMAIL)
# ===============================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=votre_email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_application
SMTP_AUTH=true
SMTP_STARTTLS=true
SMTP_STARTTLS_REQUIRED=true
SMTP_CONNECTION_TIMEOUT=5000
SMTP_TIMEOUT=5000
SMTP_WRITE_TIMEOUT=5000
SMTP_FROM=noreply@enclume-numerique.com
SMTP_FROM_NAME=Enclume Numérique
FRONTEND_URL=https://hscode.enclume-numerique.com

# ===============================================================
# SPRING BOOT
# ===============================================================
SPRING_PROFILES_ACTIVE=prod

# ===============================================================
# SERVICES IA
# ===============================================================
OPENAI_API_KEY=votre_cle_openai
OPENAI_MODEL=gpt-4
ANTHROPIC_API_KEY=votre_cle_anthropic
ANTHROPIC_MODEL=claude-3-sonnet-20240229
OLLAMA_API_KEY=votre_cle_ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434

# ===============================================================
# FRONTEND
# ===============================================================
API_URL=/api
```

## ⚠️ Notes Importantes

1. **Sécurité** : Remplacez toutes les valeurs `CHANGEZ_MOI` par des valeurs sécurisées
2. **Domaines** : Les domaines doivent pointer vers votre serveur et être configurés dans votre DNS
3. **Certificats SSL** : Assurez-vous que Traefik est configuré pour générer les certificats Let's Encrypt
4. **Développement local** : Pour le développement, certaines valeurs peuvent être différentes (localhost, ports, etc.)
5. **Fichier .env** : Ne commitez JAMAIS le fichier `.env` dans Git (il doit être dans `.gitignore`)

## 🔍 Où sont utilisées ces variables ?

- **docker-compose-prod.yml** : Configuration des services Docker
- **backend/src/main/resources/application.yml** : Configuration Spring Boot
- **frontend/generate-env.js** : Génération de `environment.prod.ts`
- **backend/src/main/java/com/muhend/backend/config/SecurityConfig.java** : Configuration CORS

## 📚 Références

- [Documentation Docker Compose](https://docs.docker.com/compose/environment-variables/)
- [Documentation Spring Boot](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config)
- [Documentation Keycloak](https://www.keycloak.org/documentation)

