FROM node:24-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY . .

# Permissions d'exécution pour le script d'entrée
RUN chmod +x ./docker-entrypoint.sh

# Exposer le port
EXPOSE 3003

# Démarrer l'application
CMD ["npm", "run", "dev"]
