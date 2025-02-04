export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function throttle(func, limit) {
  let lastCall = 0;
  let timeoutId;
  return function(...args) {
    const now = Date.now();
    const remaining = limit - (now - lastCall);
    if (remaining <= 0) {
      func.apply(this, args);
      lastCall = now;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastCall = now;
      }, remaining);
    }
  };
}

export const domHelpers = {
  createVideoElement: () => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    video.controls = false;
    return video;
  },
  
  setupDNSPrefetch: (hostname) => {
    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = `//${hostname}`;
    document.head.appendChild(dnsPrefetch);
  },
  
  getProviderFromUrl(url) {
    const subdomainMatch = url.match(/https?:\/\/(.+)\.ipfs\.([^\/]+)/);
    if (subdomainMatch) return subdomainMatch[2];
    
    const pathMatch = url.match(/https?:\/\/ipfs\.([^\/]+)\/ipfs\/.+$/);
    return pathMatch?.[1] || 'unknown';
  }
};

export const stateHelpers = {
  updateProviderStats: (providerKey, updateFn) => {
    const provider = AppState.providers.find(p => p.key === providerKey);
    const stats = AppState.providerStats.get(provider);
    AppState.providerStats.set(provider, updateFn(stats));
  }
};

export async function withRetry(fn, options = {}) {
  const { maxRetries = 3, delay = 1000 } = options;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (attempt++ >= maxRetries) throw error;
      await new Promise(r => setTimeout(r, delay * (2 ** attempt)));
    }
  }
} 