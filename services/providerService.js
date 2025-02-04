import { AppState } from '../state/stateManager.js';
import { getProviderUrl } from '../config/providers.js';
import { domHelpers } from '../utils/helpers.js';
import { stateHelpers } from '../state/stateHelpers.js';

export class ProviderService {
  static async validateCidThroughProviders(cid) {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No available providers');
    }

    // Add provider validation with fallback
    const validationPromises = availableProviders.map(async (provider) => {
      const testUrl = getProviderUrl(provider.key, cid);
      try {
        const testVideo = domHelpers.createVideoElement();
        testVideo.src = testUrl;
        await new Promise((resolve, reject) => {
          testVideo.onloadeddata = resolve;
          testVideo.onerror = reject;
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        return provider;
      } catch (error) {
        stateHelpers.updateProviderStats(provider.key, (stats) => ({
          ...stats,
          errorCount: (stats?.errorCount || 0) + 1
        }));
        return null;
      }
    });

    const validatedProviders = (await Promise.all(validationPromises)).filter(Boolean);
    
    if (validatedProviders.length === 0) {
      throw new AggregateError([new Error('All providers failed validation')]);
    }
    
    return validatedProviders;
  }

  static getAvailableProviders() {
    return AppState.providers.filter(provider => {
      // Add fallback for undefined stats
      const stats = AppState.providerStats.get(provider) || { errorCount: 0 };
      return stats.errorCount < 3;
    });
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