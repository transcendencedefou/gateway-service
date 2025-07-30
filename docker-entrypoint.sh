#!/bin/bash

echo "🚀 Starting gateway-service with Vault integration..."

# Load environment variables from Vault
node -e "
const { loadEnvFromVault } = require('./src/VaultClient.js');

async function loadEnv() {
  try {
    await loadEnvFromVault('gateway-service');
    console.log('✅ Environment loaded from Vault');
  } catch (error) {
    console.error('❌ Failed to load from Vault, using fallbacks:', error.message);
    // Set fallback environment variables
    process.env.PORT = process.env.PORT || '3003';
    process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    process.env.GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || 'http://game-service:3002';
  }
}

loadEnv().then(() => {
  console.log('Starting gateway service...');
}).catch(console.error);
"

# Start the application
echo "✅ Starting gateway service application..."
exec npm start
