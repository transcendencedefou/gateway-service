import Fastify from 'fastify';
import httpProxy from '@fastify/http-proxy';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { VaultManager } from './vault.js';

const fastify = Fastify({
  logger: true,
  maxParamLength: 5000
});

// Initialize Vault
const vaultManager = new VaultManager();
let vaultReady = false;

// Initialize Vault on startup
vaultManager.initialize().then(() => {
  vaultReady = true;
}).catch((error) => {
  console.error('❌ Failed to initialize Vault:', error);
});

// Configuration CORS
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Rate limiting
await fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "60000")
});

// Swagger pour la documentation API
await fastify.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Gateway API',
      description: 'Point d\'entrée unique pour tous les microservices Transcendence',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3003',
        description: 'Development server'
      }
    ],
  }
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  }
});

// ============================================================================
// ROUTES
// ============================================================================

// Route d'accueil du gateway
fastify.get('/', async (request, reply) => {
  reply.type('text/html');
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gateway Service - Transcendence</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 40px;
                background: #f5f5f5;
            }
            h1 {
                color: #333;
                margin-bottom: 20px;
            }
            .service {
                background: white;
                margin: 20px 0;
                padding: 20px;
                border-left: 4px solid #007acc;
            }
            .service h3 {
                margin: 0 0 10px 0;
                color: #007acc;
            }
            .service code {
                background: #f0f0f0;
                padding: 2px 6px;
                border-radius: 3px;
            }
            a {
                color: #007acc;
                text-decoration: none;
                margin-right: 20px;
            }
            a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <h1>🌐 Gateway Service</h1>
        <p>Point d'entrée unique pour les microservices Transcendence</p>

        <div class="service">
            <h3>🔐 Auth Service</h3>
            <code>/auth/*</code>
        </div>

        <div class="service">
            <h3>👤 User Service</h3>
            <code>/users/*</code>
        </div>

        <div class="service">
            <h3>🎮 Game Service</h3>
            <code>/games/*</code>
        </div>

        <p>
            <a href="/docs">📚 Documentation</a>
            <a href="/health">🏥 Health Check</a>
        </p>
    </body>
    </html>
    `;
});

// Health check global avec intégration Vault
fastify.get('/health', async (request, reply) => {
  const services = {
    gateway: { status: 'healthy', timestamp: new Date().toISOString() },
    auth: { url: process.env.AUTH_SERVICE_URL },
    user: { url: process.env.USER_SERVICE_URL },
    game: { url: process.env.GAME_SERVICE_URL },
    vault: vaultReady ? await vaultManager.getHealthStatus() : { status: 'initializing' }
  };

  return {
    status: 'healthy',
    services,
    timestamp: new Date().toISOString(),
    vault_ready: vaultReady
  };
});

// Route pour les secrets Vault (admin uniquement)
fastify.get('/admin/vault/secrets', async (request, reply) => {
  if (!vaultReady) {
    reply.code(503);
    return { error: 'Vault not ready' };
  }

  try {
    const dbSecrets = await vaultManager.getSecret('database');
    const jwtSecrets = await vaultManager.getSecret('jwt');

    return {
      database: { ...dbSecrets, password: '***' }, // Masquer le mot de passe
      jwt: { ...jwtSecrets, secret: '***' }, // Masquer le secret
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to retrieve secrets' };
  }
});

// Route pour rotation des secrets JWT
fastify.post('/admin/vault/rotate-jwt', async (request, reply) => {
  if (!vaultReady) {
    reply.code(503);
    return { error: 'Vault not ready' };
  }

  try {
    const newSecret = await vaultManager.rotateJWTSecret();
    return {
      message: 'JWT secret rotated successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to rotate JWT secret' };
  }
});

// ============================================================================
// PROXY ROUTES vers les microservices
// ============================================================================

// Proxy vers auth-service
await fastify.register(httpProxy, {
  upstream: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
  prefix: '/auth',
  rewritePrefix: '/',
  http2: false
});

// Proxy vers user-service
await fastify.register(httpProxy, {
  upstream: process.env.USER_SERVICE_URL || 'http://user-service:3001',
  prefix: '/users',
  rewritePrefix: '/',
  http2: false
});

// Proxy vers game-service
await fastify.register(httpProxy, {
  upstream: process.env.GAME_SERVICE_URL || 'http://game-service:3002',
  prefix: '/games',
  rewritePrefix: '/',
  http2: false
});

// ============================================================================
// DÉMARRAGE DU SERVEUR
// ============================================================================

const start = async () => {
  try {
    await fastify.listen({ host: '0.0.0.0', port: parseInt(process.env.PORT || '3003') });
    console.log('🌐 Gateway service running on http://localhost:3003');
    console.log('📚 API Documentation: http://localhost:3003/docs');
    console.log('🔐 Auth Service: http://localhost:3003/auth');
    console.log('👤 User Service: http://localhost:3003/users');
    console.log('🎮 Game Service: http://localhost:3003/games');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
