## AI Assistant

README.md
Voici un README complet et professionnel pour votre projet :
llm:snippet-fileREADME.md</llm:snippet-file>``` markdown
# SaaS Qwen - Application Full-Stack avec Authentification Keycloak

Une application SaaS moderne construite avec Angular, Spring Boot, Keycloak et PostgreSQL, entièrement conteneurisée avec Docker.

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Technologies](#-technologies)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [Développement](#-développement)
- [Déploiement](#-déploiement)
- [Troubleshooting](#-troubleshooting)
- [Contribution](#-contribution)
- [Licence](#-licence)

## 🚀 Fonctionnalités

- ✅ **Authentification complète** avec Keycloak (OAuth 2.0 / OpenID Connect)
- ✅ **Gestion des utilisateurs** : Inscription, connexion, profils
- ✅ **API REST sécurisée** avec Spring Boot et JWT
- ✅ **Interface moderne** avec Angular 20
- ✅ **Base de données PostgreSQL** persistante
- ✅ **Architecture microservices** entièrement conteneurisée
- ✅ **Configuration centralisée** via variables d'environnement
- ✅ **Import/Export** de configuration Keycloak

## 🏗️ Architecture
```

┌─────────────────────────────────────────────────────────────┐ │ CLIENT (Browser) │ └────────────────────────────┬────────────────────────────────┘ │ ┌────────▼────────┐ │ Frontend │ :4200 │ Angular 20 │ │ (Nginx) │ └────────┬────────┘ │ ┌────────▼────────┐ │ Backend │ :8081 │ Spring Boot │ │ + OAuth2 │ └────┬───────┬────┘ │ │ ┌──────────┘ └──────────┐ ▼ ▼ ┌──────────────┐ ┌──────────────┐ │ Keycloak │ │ PostgreSQL │ │ (Auth) │◄─────────────│ (Database) │ │ :8080 │ │ :5432 │ └──────────────┘ └──────────────┘``` 

## 💻 Technologies

### Frontend
- **Angular** 20.3.0
- **TypeScript** 5.9.2
- **angular-oauth2-oidc** 17.0.0
- **RxJS** 7.8.0
- **Karma/Jasmine** pour les tests

### Backend
- **Spring Boot** 3.5.6
- **Java** 21
- **Spring Security OAuth2** Resource Server
- **Spring Data JPA** avec Hibernate
- **Keycloak Admin Client** 26.0.7
- **PostgreSQL** Driver
- **Lombok** pour réduire le boilerplate
- **SpringDoc OpenAPI** 2.8.13 pour la documentation API

### Infrastructure
- **Docker** & Docker Compose
- **Keycloak** 22.0.1
- **PostgreSQL** 16
- **Nginx** (pour servir le frontend)

## 📦 Prérequis

- **Docker** version 20.10 ou supérieure
- **Docker Compose** version 2.0 ou supérieure
- **Git**
- (Optionnel) **Node.js** 18+ et **npm** pour le développement local du frontend
- (Optionnel) **JDK** 21+ et **Maven** pour le développement local du backend

## 🛠️ Installation

### 1. Cloner le Projet

```bash
git clone https://github.com/votre-username/saas-qwen.git
cd saas-qwen
```
```

2. Configuration Initiale
Créez le fichier .env à partir de l'exemple :``` bash
cp .env.example .env
```

Éditez .env et configurez au minimum :``` env
PROJECT_NAME=mon-projet
POSTGRES_PASSWORD=votre-mot-de-passe-securise
KEYCLOAK_ADMIN_PASSWORD=votre-admin-password
KEYCLOAK_BACKEND_CLIENT_SECRET=votre-client-secret
```

3. Démarrage des Services``` bash
# Première installation (avec construction des images)
docker compose up -d --build

# Vérifier que tous les services sont démarrés
docker compose ps

# Suivre les logs
docker compose logs -f
```

4. Accéder à l'Application
   Frontend : http://localhost:4200
   Backend API : http://localhost:8081
   Keycloak Admin : http://localhost:8080 (admin / admin par défaut)
   API Documentation : http://localhost:8081/swagger-ui.html
   ⚙️ Configuration
   Toutes les variables de configuration sont centralisées dans le fichier .env. Consultez README-CONFIGURATION.md pour la liste complète.
   Variables Principales
   Variable
   Description
   Valeur par défaut
   PROJECT_NAME
   Nom du projet
   saasessai2
   POSTGRES_DB
   Nom de la base de données
   ${PROJECT_NAME}-db
   POSTGRES_USER
   Utilisateur PostgreSQL
   muhend
   POSTGRES_PASSWORD
   Mot de passe PostgreSQL
   À DÉFINIR
   KEYCLOAK_REALM : utiliser 'volume:' de Keycloak dans docker-compose uniquement la première fois lors de la création du realm
   Nom du realm Keycloak
   saasqwen2 : à modifier à chaque nouveau realm, 
   KEYCLOAK_ADMIN_USER
   Admin Keycloak
   admin
   KEYCLOAK_ADMIN_PASSWORD
   Password admin Keycloak
   À DÉFINIR
   KEYCLOAK_BACKEND_CLIENT
   ID du client backend
   backend-client
   KEYCLOAK_BACKEND_CLIENT_SECRET
   Secret du client backend
   À DÉFINIR
   🎯 Utilisation
   Inscription d'un Utilisateur
   Accédez à http://localhost:4200
   Cliquez sur "S'inscrire"
   Remplissez le formulaire
   L'utilisateur est créé dans Keycloak
   Connexion
   Cliquez sur "Se connecter"
   Vous serez redirigé vers Keycloak
   Entrez vos identifiants
   Vous serez redirigé vers le recherche
   API Backend
   L'API backend est documentée avec OpenAPI :``` bash
# Accéder à la documentation interactive
open http://localhost:8081/swagger-ui.html
```

Exemple d'appel API :``` bash
# S'inscrire (endpoint public)
curl -X POST http://localhost:8081/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "password123"
  }'
```

👨‍💻 Développement
Structure du Projet```
saas-qwen/
├── backend/               # API Spring Boot
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── com/muhend/backend/
│   │   │   │       ├── config/      # Configuration Spring & Keycloak
│   │   │   │       ├── controller/  # Contrôleurs REST
│   │   │   │       ├── dto/         # Data Transfer Objects
│   │   │   │       ├── models/      # Entités JPA
│   │   │   │       └── service/     # Services métier
│   │   │   └── resources/
│   │   │       └── application.yml
│   │   └── test/
│   ├── Dockerfile
│   └── pom.xml
├── frontend/              # Application Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/      # Services, guards, interceptors
│   │   │   ├── features/  # Modules fonctionnels
│   │   │   └── shared/    # Composants partagés
│   │   └── environments/
│   ├── Dockerfile
│   ├── angular.json
│   └── package.json
├── keycloak/              # Configuration Keycloak
│   └── realm-export.json
├── docker-compose.yml     # Orchestration des services
├── .env                   # Variables d'environnement (ne pas commiter)
└── README.md
```

Développement Local du Frontend``` bash
cd frontend
npm install
npm start

# L'application sera disponible sur http://localhost:4200
# Le hot-reload est activé
```

Développement Local du Backend``` bash
cd backend
./mvnw spring-boot:run

# L'API sera disponible sur http://localhost:8081
# Assurez-vous que PostgreSQL et Keycloak sont démarrés
```

Tests``` bash
# Tests backend
cd backend
./mvnw test

# Tests frontend
cd frontend
npm test

# Tests e2e frontend
npm run e2e
```

🚢 Déploiement
Production avec Docker Compose
Modifiez .env pour la production :``` env
SPRING_PROFILES_ACTIVE=prod
KEYCLOAK_HOSTNAME=votre-domaine.com
# Changez tous les mots de passe
```

Utilisez HTTPS (configurez un reverse proxy comme Traefik ou Nginx)
Démarrez les services :``` bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Variables de Production à Changer
⚠️ Important : En production, changez obligatoirement :
POSTGRES_PASSWORD
KEYCLOAK_ADMIN_PASSWORD
KEYCLOAK_BACKEND_CLIENT_SECRET
Générez un nouveau secret pour backend-client dans Keycloak
Backup de la Base de Données``` bash
# Backup
docker exec saasessai2-db pg_dump -U muhend saasessai2-db > backup.sql

# Restauration
docker exec -i saasessai2-db psql -U muhend saasessai2-db < backup.sql
```

🔧 Troubleshooting
Le backend ne démarre pas``` bash
# Vérifier les logs
docker compose logs backend

# Vérifier que Keycloak est démarré
docker compose ps keycloak

# Redémarrer le backend
docker compose restart backend
```

Erreur 403 lors de l'inscription
Le service account backend-client n'a pas les bons rôles :
Connectez-vous à Keycloak Admin Console
Sélectionnez le realm saasqwen2
Clients → backend-client → Service Account Roles
Ajoutez les rôles : manage-users, view-users, query-users
Réinitialisation Complète``` bash
# Arrêter et supprimer tous les conteneurs et volumes
docker compose down --volumes --remove-orphans

# Redémarrer
docker compose up -d --build
```

Voir les Logs en Temps Réel``` bash
# Tous les services
docker compose logs -f

# Un service spécifique
docker compose logs -f backend
docker compose logs -f keycloak
```
🤝 Contribution
Les contributions sont les bienvenues ! Veuillez suivre ces étapes :
Forkez le projet
Créez une branche pour votre fonctionnalité (git checkout -b feature/AmazingFeature)
Committez vos changements (git commit -m 'Add some AmazingFeature')
Poussez vers la branche (git push origin feature/AmazingFeature)
Ouvrez une Pull Request
Standards de Code
Backend : Suivez les conventions Java et Spring Boot
Frontend : Suivez le style guide Angular officiel
Git : Utilisez des messages de commit conventionnels
📄 Licence
Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.
👥 Auteurs
Muhend - Développeur principal - GitHub
🙏 Remerciements
Spring Boot
Angular
Keycloak
PostgreSQL

## AI Assistant


#   t a r i f - s e c u r  
 #   t a r i f - s e c u r - p r o d  
 #   t a r i f - c l o a k - p r o d  
 