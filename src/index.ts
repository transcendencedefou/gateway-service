import Fastify from 'fastify';
import httpProxy from '@fastify/http-proxy';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

const fastify = Fastify({
  logger: true,
  maxParamLength: 5000
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

        <div class="service">
            <h3>🖥️ Front Service</h3>
            <code>/app/*</code> - Interface utilisateur Vue.js avec Babylon.js
        </div>

        <p>
            <a href="/app">🎮 Lancer l'application</a>
            <a href="/docs">📚 Documentation</a>
            <a href="/health">🏥 Health Check</a>
        </p>
    </body>
    </html>
    `;
});

// Health check simplifié
fastify.get('/health', async (request, reply) => {
  const services = {
    gateway: { status: 'healthy', timestamp: new Date().toISOString() },
    auth: { url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000' },
    user: { url: process.env.USER_SERVICE_URL || 'http://user-service:3001' },
    game: { url: process.env.GAME_SERVICE_URL || 'http://game-service:3002' },
    front: { url: process.env.FRONT_SERVICE_URL || 'http://front-service:3004' },
    vault: { url: process.env.VAULT_SERVICE_URL || 'http://vault-service:8300' }
  };

  return {
    status: 'healthy',
    services,
    timestamp: new Date().toISOString()
  };
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

// Proxy vers front-service (interface utilisateur)
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/app',
  rewritePrefix: '/',
  http2: false
});

// Proxy pour les ressources Vite du front-service
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/@vite',
  rewritePrefix: '/@vite',
  http2: false
});

// Proxy pour les fichiers sources du front-service
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/src',
  rewritePrefix: '/src',
  http2: false
});

// Proxy pour les assets du front-service
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/vite.svg',
  rewritePrefix: '/vite.svg',
  http2: false
});

// Proxy pour les node_modules Vite
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/node_modules',
  rewritePrefix: '/node_modules',
  http2: false
});

// Proxy pour les routes internes Vite (@id/*)
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/@id',
  rewritePrefix: '/@id',
  http2: false
});

// Proxy pour les assets généraux (css, js, images, etc.)
await fastify.register(httpProxy, {
  upstream: process.env.FRONT_SERVICE_URL || 'http://front-service:3004',
  prefix: '/assets',
  rewritePrefix: '/assets',
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
    console.log('🖥️ Front Service: http://localhost:3003/app');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
