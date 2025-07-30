import vault from 'node-vault';

export class VaultManager {
  private vault: any;
  private isInitialized = false;

  constructor() {
    this.vault = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR || 'http://vault:8200',
      token: process.env.VAULT_TOKEN || 'vault-root-token'
    });
  }

  async initialize() {
    try {
      // Initialize vault policies
      await this.setupPolicies();

      // Store initial secrets
      await this.storeInitialSecrets();

      this.isInitialized = true;
      console.log('✅ Vault initialized successfully');
    } catch (error) {
      console.error('❌ Vault initialization failed:', error);
      throw error;
    }
  }

  private async setupPolicies() {
    const policies = {
      'transcendence-policy': `
        path "secret/data/transcendence/*" {
          capabilities = ["create", "read", "update", "delete", "list"]
        }
        path "secret/metadata/transcendence/*" {
          capabilities = ["list"]
        }
        path "auth/token/lookup-self" {
          capabilities = ["read"]
        }
      `
    };

    for (const [name, policy] of Object.entries(policies)) {
      try {
        await this.vault.addPolicy({ name, rules: policy });
        console.log(`📋 Policy '${name}' created`);
      } catch (error) {
        console.log(`📋 Policy '${name}' already exists or error:`, error.message);
      }
    }
  }

  private async storeInitialSecrets() {
    const secrets = {
// Ce fichier a été remplacé par le service vault-service dédié
// Les secrets sont maintenant gérés par le microservice vault-service
// Utiliser VaultClient.js pour interagir avec le service Vault

console.log('⚠️  vault.ts is deprecated. Use vault-service microservice instead.');

export class VaultManager {
  constructor() {
    console.warn('VaultManager is deprecated. Use VaultClient from vault-service instead.');
  }

  async initialize() {
    console.warn('VaultManager.initialize() is deprecated. Use vault-service microservice instead.');
  }

  async getSecret(path: string) {
    console.warn('VaultManager.getSecret() is deprecated. Use VaultClient from vault-service instead.');
    throw new Error('VaultManager is deprecated. Use vault-service microservice instead.');
  }
}
          secret: this.generateSecureKey(64),
          algorithm: 'HS256',
          expiration: '24h'
        }
      },
      'secret/data/transcendence/encryption': {
        data: {
          key: this.generateSecureKey(32),
          algorithm: 'aes-256-gcm'
        }
      },
      'secret/data/transcendence/oauth': {
        data: {
          google_client_id: 'your-google-client-id',
          google_client_secret: 'your-google-client-secret',
          github_client_id: 'your-github-client-id',
          github_client_secret: 'your-github-client-secret'
        }
      },
      'secret/data/transcendence/api': {
        data: {
          rate_limit_max: '100',
          rate_limit_window: '60000',
          cors_origin: '*'
        }
      }
    };

    for (const [path, secret] of Object.entries(secrets)) {
      try {
        await this.vault.write(path, secret);
        console.log(`🔒 Secret stored at ${path}`);
      } catch (error) {
        console.log(`🔒 Error storing secret at ${path}:`, error.message);
      }
    }
  }

  async getSecret(path: string): Promise<any> {
    try {
      const result = await this.vault.read(`secret/data/transcendence/${path}`);
      return result.data.data;
    } catch (error) {
      console.error(`❌ Error reading secret from ${path}:`, error);
      throw error;
    }
  }

  async updateSecret(path: string, data: any): Promise<void> {
    try {
      await this.vault.write(`secret/data/transcendence/${path}`, { data });
      console.log(`✅ Secret updated at transcendence/${path}`);
    } catch (error) {
      console.error(`❌ Error updating secret at ${path}:`, error);
      throw error;
    }
  }

  async rotateJWTSecret(): Promise<string> {
    const newSecret = this.generateSecureKey(64);
    await this.updateSecret('jwt', {
      secret: newSecret,
      algorithm: 'HS256',
      expiration: '24h',
      rotated_at: new Date().toISOString()
    });
    return newSecret;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const health = await this.vault.health();
      return {
        vault_status: 'healthy',
        initialized: health.initialized,
        sealed: health.sealed,
        standby: health.standby
      };
    } catch (error) {
      return {
        vault_status: 'unhealthy',
        error: error.message
      };
    }
  }

  private generateSecureKey(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
