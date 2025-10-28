# ==================================
# ÉTAPE 1: Construire l'application Angular
# ==================================
FROM node:20-alpine AS build
WORKDIR /app
# Copier les fichiers de dépendances et les installer
COPY package.json package-lock.json ./
RUN npm install
# Copier le reste du code source
COPY . .

# Accepter l'URL publique de Keycloak comme argument de build
ARG KEYCLOAK_EXTERNAL_URL
# La rendre disponible comme variable d'environnement pour le script generate-env.js
ENV KEYCLOAK_EXTERNAL_URL=${KEYCLOAK_EXTERNAL_URL}

# ===================================================================
# ÉTAPE DE DÉBOGAGE : Exécuter le script SEUL pour voir sa sortie
# ===================================================================
RUN node ./generate-env.js

# Construire l'application en mode production
# Le script generate-env.js va maintenant utiliser la bonne URL
# Le résultat sera dans /app/dist/frontend (ou un nom similaire)
RUN npm run build

# ==================================
# ÉTAPE 2: Servir l'application avec Nginx
# ==================================
FROM nginx:stable-alpine

# Accepter un argument pour le fichier de configuration Nginx
ARG NGINX_CONF=nginx-dev.conf

# Copier les fichiers statiques construits depuis l'étape précédente
# Assurez-vous que 'dist/frontend' correspond au chemin de sortie de votre build
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Copier notre configuration de proxy Nginx personnalisée
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

# Exposer le port 80 du conteneur
EXPOSE 80
