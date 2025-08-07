FROM node:24-alpine

# Installation de bash pour les scripts d'entrée et curl pour les checks
RUN apk add --no-cache bash curl

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

# Point d'entrée avec script Vault
ENTRYPOINT ["./docker-entrypoint.sh"]
