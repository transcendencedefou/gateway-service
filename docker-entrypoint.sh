#!/bin/bash

echo "🚀 Starting gateway-service with Vault integration..."

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
  } catch (error) {
    console.error('❌ Failed to load from Vault, using fallbacks:', error.message);
    // Set fallback environment variables
    process.env.PORT = process.env.PORT || '3003';
    process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    process.env.GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || 'http://game-service:3002';
    process.env.FRONT_SERVICE_URL = process.env.FRONT_SERVICE_URL || 'http://front-service:3004';
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
