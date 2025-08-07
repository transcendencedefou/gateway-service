import http from 'http';
import SecretManager from './SecretManager.js';

/**
 * Client pour interagir avec le service Vault de Transcendence
 * Implémente les meilleures pratiques de sécurité pour auth-service
 */
class VaultClient {
  constructor(config = {}) {
    // Utiliser VAULT_SERVICE_URL en priorité, puis fallback
    const vaultServiceUrl = process.env.VAULT_SERVICE_URL || 'http://vault-service:8300';
    const url = new URL(vaultServiceUrl);

    this.baseUrl = vaultServiceUrl;
    this.serviceName = config.serviceName || 'gateway-service';
    this.token = config.token;
    this.timeout = config.timeout || 15000; // Augmenter le timeout à 15s
    this.retryCount = config.retryCount || 5; // Augmenter les tentatives
  }

  /**
   * Attendre que Vault soit disponible avec retry
   * @param {number} maxRetries
   */
  async waitForVault(maxRetries = 60) {
    console.log('🔄 Waiting for Vault service to be available...');

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.makeRequest('/health');
        if (response && (response.success || response.status === 'ok' || response.status === 'healthy')) {
          console.log('✅ Vault service is available');
          return;
        }
      } catch (error) {
        console.log(`⏳ Vault not ready yet, attempt ${i + 1}/${maxRetries}... (${error.message})`);
        await this.sleep(3000); // Attendre 3 secondes au lieu de 2
      }
    }

    throw new Error('❌ Vault service is not available after maximum retries');
  }

  /**
   * Récupère un secret depuis Vault avec retry et logging sécurisé
   * @param {string} path - Chemin du secret
   * @returns {Promise<Object>} Données du secret
   */
  async getSecret(path) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.makeRequest(`/api/secrets/${path}`);
        if (!response.success) {
          throw new Error(`Failed to get secret: ${response.error}`);
        }

        // Log sécurisé sans exposer le secret
        console.log(`✅ Secret retrieved from path: ${path} (attempt ${attempt})`);
        return response.data;

      } catch (error) {
        lastError = error;
        if (attempt < this.retryCount) {
          console.warn(`⚠️ Secret retrieval failed (attempt ${attempt}/${this.retryCount}), retrying...`);
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    console.error(`❌ Failed to retrieve secret from ${path} after ${this.retryCount} attempts`);
    throw lastError;
  }

  /**
   * Récupère la configuration de base de données
   */
  async getDatabaseConfig() {
    const response = await this.makeRequest('/api/database/config');
    if (!response.success) {
      throw new Error(`Failed to get database config: ${response.error}`);
    }
    return response.data;
  }

  /**
   * Récupère les URLs des services
   */
  async getServiceUrls() {
    const response = await this.makeRequest('/api/services/urls');
    if (!response.success) {
      throw new Error(`Failed to get service URLs: ${response.error}`);
    }
    return response.data;
  }

  /**
   * Fonction utilitaire pour les requêtes HTTP
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : null;

    return new Promise((resolve, reject) => {
      const req = http.request(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
          ...(body && { 'Content-Length': Buffer.byteLength(body) })
        },
        timeout: this.timeout
      }, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  /**
   * Fonction utilitaire pour les délais
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Charge les variables d'environnement depuis Vault pour le service d'authentification
 * Implémente la sécurité et la validation spécifiques à auth-service
 * @param {string} serviceName - Nom du service
 * @returns {Promise<void>}
 */
async function loadEnvFromVault(serviceName = 'gateway-service') {
  const vaultClient = new VaultClient({ serviceName });

  try {
    console.log(`🔐 Loading environment variables for ${serviceName} from Vault...`);
    await vaultClient.waitForVault();

    // Configuration de la base de données avec validation
    try {
      const dbConfig = await vaultClient.getDatabaseConfig();

      // Construire l'URL de la base de données depuis la configuration
      const dbUrl = `mysql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

      // Valider l'URL de base de données
      if (!dbUrl || !dbUrl.startsWith('mysql://')) {
        throw new Error('Invalid database URL format');
      }

      process.env.DATABASE_URL = dbUrl;
      console.log(`✅ Database configuration loaded for shared database: ${dbConfig.database}`);
    } catch (error) {
      console.warn(`⚠️ Failed to load database config from Vault: ${error.message}`);
      // Utiliser des credentials cohérents avec ceux du vault-init.sh
      console.warn('🔧 Using fallback database configuration consistent with Vault defaults');
      process.env.DATABASE_URL = 'mysql://user:userSecure123!@db:3306/transcendence';
    }

    // URLs des services avec validation
    try {
      const serviceUrls = await vaultClient.getServiceUrls();

      // Validation et assignation sécurisée
      const urlMap = {
        AUTH_SERVICE_URL: serviceUrls.auth_service_url,
        USER_SERVICE_URL: serviceUrls.user_service_url,
        GAME_SERVICE_URL: serviceUrls.game_service_url,
        GATEWAY_SERVICE_URL: serviceUrls.gateway_service_url
      };

      for (const [envVar, url] of Object.entries(urlMap)) {
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          process.env[envVar] = url;
        }
      }

      console.log('✅ Service URLs loaded from Vault');
    } catch (error) {
      console.warn(`⚠️ Failed to load service URLs from Vault: ${error.message}`);
    }

    // Secrets JWT pour le service d'auth avec validation
    if (serviceName === 'auth-service') {
      try {
        const jwtSecrets = await vaultClient.getSecret('jwt');

        // Validation des secrets JWT
        if (jwtSecrets.secret && jwtSecrets.secret.length >= 32) {
          process.env.JWT_SECRET = jwtSecrets.secret;
          process.env.JWT_ALGORITHM = jwtSecrets.algorithm || 'HS256';
          process.env.JWT_EXPIRATION = jwtSecrets.expiration || '24h';

          console.log(`✅ JWT secrets loaded (algorithm: ${jwtSecrets.algorithm})`);
        } else {
          throw new Error('JWT secret too short or missing');
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load JWT secrets: ${error.message}`);
        // Générer un fallback temporaire pour le développement
        console.warn('🔧 Generating temporary JWT secret for development');
        process.env.JWT_SECRET = SecretManager.generateSecureToken(32);
        process.env.JWT_ALGORITHM = 'HS256';
        process.env.JWT_EXPIRATION = '24h';
      }

      // Configuration OAuth - Chargement des secrets OAuth depuis Vault
      try {
        const oauthSecrets = await vaultClient.getSecret('oauth');

        // Variables GitHub OAuth
        if (oauthSecrets.github_client_id) {
          process.env.GITHUB_CLIENT_ID = oauthSecrets.github_client_id;
          process.env.GITHUB_CLIENT_SECRET = oauthSecrets.github_client_secret;
          process.env.GITHUB_REDIRECT_URI = oauthSecrets.github_redirect_uri;

          console.log('✅ GitHub OAuth configuration loaded from Vault');
        }

        // Variables 42 Intra OAuth
        if (oauthSecrets.intra_client_id) {
          process.env.INTRA_CLIENT_ID = oauthSecrets.intra_client_id;
          process.env.INTRA_CLIENT_SECRET = oauthSecrets.intra_client_secret;
          process.env.INTRA_REDIRECT_URI = oauthSecrets.intra_redirect_uri;

          console.log('✅ 42 Intra OAuth configuration loaded from Vault');
        }

        // Variables Google OAuth (si disponibles)
        if (oauthSecrets.google_client_id) {
          process.env.GOOGLE_CLIENT_ID = oauthSecrets.google_client_id;
          process.env.GOOGLE_CLIENT_SECRET = oauthSecrets.google_client_secret;

          console.log('✅ Google OAuth configuration loaded from Vault');
        }

        // URL de base pour les callbacks
        if (oauthSecrets.callback_url_base) {
          process.env.CALLBACK_URL_BASE = oauthSecrets.callback_url_base;
        }

        console.log('✅ OAuth configuration fully loaded from Vault');

      } catch (error) {
        console.warn(`⚠️ Failed to load OAuth secrets: ${error.message}`);
        console.warn('🔧 Using fallback OAuth configuration from environment or defaults');

        // Fallbacks pour éviter le plantage du service
        if (!process.env.GITHUB_CLIENT_ID) {
          process.env.GITHUB_CLIENT_ID = 'fallback-github-client-id';
          process.env.GITHUB_CLIENT_SECRET = 'fallback-github-client-secret';
          process.env.GITHUB_REDIRECT_URI = 'https://localhost/oauth/github/callback';
        }

        if (!process.env.INTRA_CLIENT_ID) {
          process.env.INTRA_CLIENT_ID = 'fallback-intra-client-id';
          process.env.INTRA_CLIENT_SECRET = 'fallback-intra-client-secret';
          process.env.INTRA_REDIRECT_URI = 'https://localhost/oauth/42/callback';
        }
      }
    }

    // Configuration API avec validation
    try {
      const apiConfig = await vaultClient.getSecret('api');

      // Validation et assignation avec des valeurs plus appropriées pour le développement
      process.env.RATE_LIMIT_MAX = String(parseInt(apiConfig.rate_limit_max) || 1000); // 1000 req/min au lieu de 100
      process.env.RATE_LIMIT_WINDOW = String(parseInt(apiConfig.rate_limit_window) || 60000); // 1 minute
      process.env.CORS_ORIGIN = apiConfig.cors_origin || '*';

      console.log(`✅ API configuration loaded from Vault (Rate limit: ${process.env.RATE_LIMIT_MAX} req/min)`);
    } catch (error) {
      console.warn(`⚠️ Failed to load API config: ${error.message}`);
      // Fallbacks pour le développement
      process.env.RATE_LIMIT_MAX = '1000'; // 1000 requêtes par minute pour le dev
      process.env.RATE_LIMIT_WINDOW = '60000'; // 1 minute
      process.env.CORS_ORIGIN = '*';
      console.log(`🔧 Using fallback API config (Rate limit: ${process.env.RATE_LIMIT_MAX} req/min)`);
    }

    // Configuration des ports par service
    const portMap = {
      'auth-service': '3000',
      'user-service': '3001',
      'game-service': '3002',
      'gateway-service': '3003'
    };

    if (portMap[serviceName]) {
      process.env.PORT = portMap[serviceName];
    }

    console.log(`✅ Environment variables loaded from Vault for ${serviceName}`);
    return true; // Indiquer le succès

  } catch (error) {
    console.error(`❌ Failed to load environment from Vault for ${serviceName}:`, error.message);
    console.warn('🔧 Using fallback configuration...');

    // Fallbacks critiques pour éviter les plantages
    if (!process.env.DATABASE_URL) {
      // Utiliser les mêmes credentials que ceux configurés dans Vault
      process.env.DATABASE_URL = 'mysql://user:userSecure123!@db:3306/transcendence';
    }

    if (!process.env.PORT) {
      const portMap = {
        'auth-service': '3000',
        'user-service': '3001',
        'game-service': '3002',
        'gateway-service': '3003'
      };
      process.env.PORT = portMap[serviceName] || '3000';
    }

    // Fallbacks JWT pour auth-service
    if (serviceName === 'auth-service' && !process.env.JWT_SECRET) {
      process.env.JWT_SECRET = SecretManager.generateSecureToken(32);
      process.env.JWT_ALGORITHM = 'HS256';
      process.env.JWT_EXPIRATION = '24h';
      console.warn('🔧 Generated temporary JWT secret for development');
    }

    console.log(`⚠️ Using fallback configuration for ${serviceName}`);
    return false; // Indiquer l'échec
  }
}

/**
 * Retourne le nom de la base de données pour un service
 * @param {string} serviceName - Nom du service
 * @returns {string} Nom de la base de données
 */
function getServiceDatabase(serviceName) {
  // Tous les services utilisent maintenant la base unique 'transcendence'
  return 'transcendence';
}

export {
  VaultClient,
  loadEnvFromVault,
  SecretManager
};
