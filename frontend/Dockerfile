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

# Construire l'application en mode production
# Le résultat sera dans /app/dist/frontend (ou un nom similaire)
RUN npm run build

# ==================================
# ÉTAPE 2: Servir l'application avec Nginx
# ==================================
FROM nginx:stable-alpine

# Copier les fichiers statiques construits depuis l'étape précédente
# Assurez-vous que 'dist/frontend' correspond au chemin de sortie de votre build
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Copier notre configuration de proxy Nginx personnalisée
COPY nginx-dev.conf /etc/nginx/conf.d/default.conf

# Exposer le port 80 du conteneur
EXPOSE 80
