import { CACHE_KEYS } from '../config/constants.js';
import { AppState } from './stateManager.js';

export const stateHelpers = {
  markInvalidCid(cid) {
    const invalidCids = JSON.parse(localStorage.getItem(CACHE_KEYS.CID_VALIDITY) || '{}');
    invalidCids[cid] = Date.now();
    localStorage.setItem(CACHE_KEYS.CID_VALIDITY, JSON.stringify(invalidCids));
    
    // Update app state
    AppState.videoSources = AppState.videoSources.filter(sourceCid => sourceCid !== cid);
  },
  
  updateProviderStats(providerKey, updateFn) {
    const provider = AppState.providers.find(p => p.key === providerKey);
    if (!provider) return;

    const currentStats = AppState.providerStats.get(provider) || {};
    AppState.providerStats.set(provider, updateFn(currentStats));
  }
}; 