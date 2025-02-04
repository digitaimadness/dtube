import { AppState } from '../state/stateManager.js';
import { getProviderUrl } from '../config/providers.js';

export class ProviderService {
  static async validateCidThroughProviders(cid) {
    const availableProviders = this.getAvailableProviders();
    
    // Original validation logic using AppState
    const providersWithDNS = await this.checkDNSAvailability(availableProviders, cid);
    
    // Rest of validation logic...
  }

  static getAvailableProviders() {
    return AppState.providers.filter(provider => 
      (AppState.providerStats.get(provider)?.errorCount || 0) < 3
    );
  }
  
  static async checkDNSAvailability(providers, cid) {
    return Promise.all(providers.map(async (provider) => {
      const url = new URL(getProviderUrl(provider.key, cid));
      try {
        await fetch(`https://dns.google/resolve?name=${url.hostname}`, {
          mode: 'cors',
          headers: { 'Accept': 'application/dns-json' }
        });
        return true;
      } catch (error) {
        return false;
      }
    }));
  }
} 