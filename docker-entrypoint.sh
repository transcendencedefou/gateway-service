#!/bin/bash

echo "🚀 Starting gateway-service with Vault integration..."

# Wait for vault-service to be ready (important!)
echo "⏳ Waiting for vault-service to be ready..."
for i in {1..60}; do
  if curl -s -f http://vault-service:8300/health > /dev/null 2>&1; then
    echo "✅ Vault-service is ready!"
    break
  fi
  echo "Attempt $i/60: vault-service not ready, waiting 2s..."
  sleep 2
done

# Create temporary env file
ENV_FILE="/tmp/.gateway-env"

# Load environment variables from Vault and export to file
node -e "
import { loadEnvFromVault } from './src/VaultClient.js';
import fs from 'fs';

async function loadEnv() {
  try {
    await loadEnvFromVault('gateway-service');
    console.log('✅ Environment loaded from Vault');

    // Log de la configuration rate limit pour debug
    console.log('🔍 Rate limit configuration:');
    console.log('  RATE_LIMIT_MAX:', process.env.RATE_LIMIT_MAX);
    console.log('  RATE_LIMIT_WINDOW:', process.env.RATE_LIMIT_WINDOW);

  } catch (error) {
    console.error('❌ Failed to load from Vault, using fallbacks:', error.message);
    // Set fallback environment variables consistent with Vault
    process.env.PORT = process.env.PORT || '3003';
    process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    process.env.GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || 'http://game-service:3002';
    process.env.FRONT_SERVICE_URL = process.env.FRONT_SERVICE_URL || 'http://front-service:3004';
    // Fallback rate limit avec des valeurs élevées
    process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '50000';
    process.env.RATE_LIMIT_WINDOW = process.env.RATE_LIMIT_WINDOW || '60000';
  }

  // Export all environment variables to file
  const envVars = Object.entries(process.env)
    .filter(([key]) => !key.startsWith('npm_') && !key.startsWith('NODE_'))
    .map(([key, value]) => \`export \${key}=\"\${value}\"\`)
    .join('\n');

  fs.writeFileSync('$ENV_FILE', envVars);
  console.log('📝 Environment variables exported to file');
}

loadEnv().then(() => {
  console.log('✅ Gateway service ready to start');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Failed to initialize gateway service:', error);
  process.exit(1);
});
"

# Wait for the Node.js process to complete
if [ $? -ne 0 ]; then
  echo "❌ Failed to load environment variables"
  exit 1
fi

# Source the environment variables
if [ -f "$ENV_FILE" ]; then
  echo "📥 Loading environment variables..."
  source "$ENV_FILE"
  rm "$ENV_FILE"
  echo "✅ Environment variables loaded"
else
  echo "⚠️ No environment file found, using Docker environment"
fi

# Start the application
echo "🚀 Starting gateway service application..."
exec npm run dev
