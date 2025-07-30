// Ce fichier a été remplacé par le service vault-service dédié
// Les secrets sont maintenant gérés par le microservice vault-service
// Utiliser VaultClient.js pour interagir avec le service Vault

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

  isReady() {
    console.warn('VaultManager.isReady() is deprecated. Use vault-service microservice instead.');
    return false;
  }
}
