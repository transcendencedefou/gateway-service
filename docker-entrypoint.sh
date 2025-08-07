#!/bin/bash
set -e

echo "🚀 Starting gateway service application..."

# Attendre que les services backend soient prêts
echo "⏳ Waiting for backend services to be ready..."
while ! nc -z auth-service 3000; do
    echo "Waiting for auth-service..."
    sleep 2
done

while ! nc -z user-service 3001; do
    echo "Waiting for user-service..."
    sleep 2
done

while ! nc -z game-service 3002; do
    echo "Waiting for game-service..."
    sleep 2
done

echo "✅ Backend services are ready!"

echo "✅ Environment loaded successfully"

# Démarrer l'application
npm run dev
