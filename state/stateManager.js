import { PROVIDERS, getProviderUrl } from '../config/providers.js';

// Centralized state management
export const AppState = {
  // Video state
  videoElement: document.getElementById("videoPlayer") || null,
  isLoading: false,
  isSeeking: false,
  isBuffering: false,
  isRecovering: false,
  currentVideoIndex: -1,
  
  // Provider state
  providers: Object.keys(PROVIDERS).map(providerKey => ({
    key: providerKey,
    name: PROVIDERS[providerKey].displayName,
    fetch: (cid, start, end) => fetch(getProviderUrl(providerKey, cid), { 
      headers: { Range: `bytes=${start}-${end}` },
      mode: providerKey === 'flk-ipfs.xyz' ? 'no-cors' : 'cors'
    })
  })),
  providerIndices: new Map(),
  providerStats: new Map(),
  
  // Playback state
  videoSources: [],
  preloadedNextUrl: null,
  currentHue: 0,
  
  // Constants
  constants: {
    CID_VALID_CACHE_KEY: 'validCidCache',
    CID_VALIDITY_DURATION: 48 * 60 * 60 * 1000,
    CONTROLS_TIMEOUT: 3000,
    TIMESTAMP_OFFSET_BOTTOM: 20,
    SAMPLING_DIMENSIONS: { width: 32, height: 32 }
  }
};

// Initialize derived state
AppState.providerStats = new Map(
  AppState.providers.map(p => [p, {
    successCount: 0,
    errorCount: 0,
    preloadSuccess: 0,
    avgSpeed: 0,
    lastUsed: 0,
    corsErrors: 0
  }])
);

// Freeze constants
Object.freeze(AppState.constants); 