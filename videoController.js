/*
 * videoController.js
 * This module provides centralized video control with queued commands for seeks, source loading, playback, and error handling.
 */

class VideoController {
  constructor(videoElement, providers) {
    this.video = videoElement;
    this.providers = providers;
    // Track provider performance metrics
    this.providerStats = new Map(providers.map(p => [p, {
      successCount: 0,
      errorCount: 0,
      avgSpeed: 0,
      lastUsed: 0
    }]));
    // Chunk streaming properties
    this.chunkSize = 4 * 1024 * 1024; // 4MB
    this.concurrentFetches = providers.length; // Use all providers concurrently
    this.currentProviderIndex = 0;
    this.chunkQueue = [];
    this.activeFetches = new Map();
    // Command queue properties
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.currentLoadAbortController = null;
    // Video state
    this.videoSources = [];
    this.currentVideoIndex = 0;
    this.preloadedVideoUrl = null;
    this.isLoading = false;
    this.debug = true; // Set to false to disable logging
    this.chunkColors = new Map();
    this.isSeeking = false;
  }

  // Chunk streaming methods
  async fetchChunk(cid, chunkIndex) {
    const start = chunkIndex * this.chunkSize;
    const end = start + this.chunkSize - 1;
    
    const sortedProviders = this.getSortedProviders();
    const errors = [];

    for (const provider of sortedProviders) {
      try {
        const startTime = performance.now();
        const response = await provider.fetch(cid, start, end);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        const fetchTime = performance.now() - startTime;
        
        this.updateProviderStats(provider, fetchTime);
        return { chunkIndex, data: new Uint8Array(buffer), provider: provider.name };
      } catch (error) {
        errors.push(`${provider.name}: ${error.message}`);
      }
    }

    console.error(`Chunk ${chunkIndex} failed:\n${errors.join('\n')}`);
    throw new Error(`All providers failed for chunk ${chunkIndex}`);
  }

  updateProviderStats(provider, fetchTime) {
    const stats = this.providerStats.get(provider);
    stats.successCount++;
    stats.avgSpeed = (stats.avgSpeed * (stats.successCount - 1) + 
      (this.chunkSize / (fetchTime / 1000))) / stats.successCount;
    stats.lastUsed = Date.now();
  }

  getSortedProviders() {
    return [...this.providers].sort((a, b) => {
      const statsA = this.providerStats.get(a);
      const statsB = this.providerStats.get(b);
      
      // Prioritize providers with higher success rate and speed
      const scoreA = (statsA.avgSpeed * 0.7) + (statsA.successCount * 0.3);
      const scoreB = (statsB.avgSpeed * 0.7) + (statsB.successCount * 0.3);
      
      return scoreB - scoreA;
    });
  }

  async startStream(cid) {
    if (this.debug) console.log(`%c[Stream Start] CID: ${cid} ChunkSize: ${this.chunkSize}`, 'color: #4CAF50');
    let expectedChunk = 0;
    const decoder = new StreamDecoder();

    // Debug initialization
    if (this.debug) {
      console.groupCollapsed(`%cInitial Chunk Fetches (${this.concurrentFetches})`, 'color: #2196F3');
      for (let i = 0; i < this.concurrentFetches; i++) {
        console.log(`%cChunk ${i} queued`, 'color: #FF9800');
      }
      console.groupEnd();
    }

    // Initialize with concurrent fetches for first chunks
    for (let i = 0; i < this.concurrentFetches; i++) {
      this.queueChunkFetch(cid, i);
    }

    while (true) {
      if (this.debug) console.log(`%c[Loop] Expected: ${expectedChunk} | Queue: ${this.chunkQueue.map(c => c.chunkIndex)} | Active: ${[...this.activeFetches.keys()]}`, 'color: #9C27B0');

      const result = await Promise.race([
        this.waitForNextChunk(),
        this.video.needsData?.() || Promise.resolve('chunk-ready')
      ]);

      if (result === 'need-data') {
        while (this.chunkQueue.length > 0 && this.chunkQueue[0].chunkIndex === expectedChunk) {
          const chunk = this.chunkQueue.shift();
          if (chunk.data) {
            if (this.debug) console.log(`%c[Processing] Chunk ${chunk.chunkIndex} (${chunk.data.byteLength} bytes) from ${chunk.provider}`, 'color: #009688');
            const decoded = decoder.process(chunk.data);
            this.video.feed(decoded);
          }
          expectedChunk++;
          
          // Prefetch next chunks
          const nextChunk = expectedChunk + this.concurrentFetches - 1;
          if (this.debug) console.log(`%c[Prefetch] Queuing chunk ${nextChunk}`, 'color: #FF5722');
          this.queueChunkFetch(cid, nextChunk);
        }
      }
    }
  }

  queueChunkFetch(cid, chunkIndex) {
    if (this.activeFetches.has(chunkIndex)) return;
    if (this.debug) console.log(`%c[Queue] Chunk ${chunkIndex}`, 'color: #FFC107');

    const fetchPromise = this.fetchChunk(cid, chunkIndex).then(result => {
      this.activeFetches.delete(chunkIndex);
      this.chunkQueue.push(result);
      this.chunkQueue.sort((a, b) => a.chunkIndex - b.chunkIndex);
      if (this.debug) console.log(`%c[Complete] Chunk ${chunkIndex}`, 'color: #00BCD4');
    });

    this.activeFetches.set(chunkIndex, fetchPromise);
  }

  waitForNextChunk() {
    return new Promise(resolve => {
      if (this.debug) console.log('%c[Wait] Starting chunk wait', 'color: #795548');
      const check = () => {
        if (this.chunkQueue.length > 0) {
          if (this.debug) console.log('%c[Wait] Chunk ready', 'color: #4CAF50');
          resolve('chunk-ready');
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  // Command queue methods
  async queueCommand(commandFn, timeout = 5000) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ commandFn, resolve, reject, timeout });
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    this.isProcessingQueue = true;
    while (this.commandQueue.length > 0) {
      const { commandFn, resolve, reject, timeout } = this.commandQueue.shift();
      let timeoutId;
      try {
        const result = await Promise.race([
          commandFn(),
          new Promise((_, rej) => {
            timeoutId = setTimeout(() => rej(new Error("Command timed out")), timeout);
          })
        ]);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    }
    this.isProcessingQueue = false;
  }

  // Player control methods
  async seekTo(time, timeout = 3000) {
    return this.queueCommand(() => {
      return new Promise((resolve, reject) => {
        const onSeeked = () => {
          this.video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        
        this.video.addEventListener('seeked', onSeeked, { once: true });
        this.video.currentTime = time;
        
        // Add seeking state management
        if (!this.video.seeking) {
          this.isSeeking = true;
          const onSeeking = () => {
            this.isSeeking = true;
            this.video.removeEventListener('seeking', onSeeking);
          };
          this.video.addEventListener('seeking', onSeeking, { once: true });
        }
      });
    }, timeout).finally(() => {
      this.isSeeking = false;
    });
  }

  async seekBy(delta, timeout = 3000) {
    const newTime = Math.max(0, this.video.currentTime + delta);
    return this.seekTo(newTime, timeout);
  }

  async loadVideo(cidPromise, timeout = 5000) {
    if (this.currentLoadAbortController) {
      this.currentLoadAbortController.abort();
    }
    this.currentLoadAbortController = new AbortController();
    const signal = this.currentLoadAbortController.signal;
    
    this.video.src = "";
    await new Promise(resolve => setTimeout(resolve, 50));

    let cid;
    try {
      cid = await cidPromise;
      if (signal.aborted) throw new Error("Video load aborted");
      await this.startStream(cid);
      return cid;
    } catch (error) {
      throw new Error(`Video load failed: ${error.message}`);
    }
  }

  async play(timeout = 5000) {
    return this.queueCommand(() => {
      return new Promise(async (resolve, reject) => {
        this.video.muted = true;
        try {
          await this.video.play();
          this.video.muted = false;
          resolve();
        } catch (e) {
          reject(new Error("Autoplay blocked"));
        }
      });
    }, timeout);
  }

  async pause(timeout = 3000) {
    return this.queueCommand(() => {
      return new Promise((resolve, reject) => {
        try {
          this.video.pause();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }, timeout);
  }

  clearQueue() {
    this.commandQueue = [];
  }

  async loadVideoByDirection(direction, retries = 0) {
    // Add load state synchronization
    if (this.isLoading) {
      console.log('Load already in progress, queuing direction change');
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.loadVideoByDirection(direction, retries);
    }

    // Add abort check early in the process
    if (this.currentLoadAbortController?.signal.aborted) {
      return;
    }

    // direction: +1 for next, -1 for previous
    if (this.isLoading || !this.videoSources.length) return;
    this.isLoading = true;
    try {
      // Pause current playback and clear the source
      await this.pause();
      this.video.src = "";
      await new Promise(resolve => requestAnimationFrame(resolve));

      if (direction > 0) {
        // Next video
        if (this.preloadedVideoUrl) {
          this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoSources.length;
          await this.loadVideo(Promise.resolve(this.preloadedVideoUrl));
          this.preloadedVideoUrl = null;
        } else {
          this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoSources.length;
          const cid = this.videoSources[this.currentVideoIndex];
          await this.loadVideo(Promise.resolve(cid));
        }
      } else {
        // Previous video
        this.preloadedVideoUrl = null;
        this.currentVideoIndex = (this.currentVideoIndex - 1 + this.videoSources.length) % this.videoSources.length;
        const cid = this.videoSources[this.currentVideoIndex];
        await this.loadVideo(Promise.resolve(cid));
      }

      // Attempt playback with muted fallback
      try {
        await this.video.play();
        if (typeof this.preloadNextVideo === 'function') {
          this.preloadNextVideo();
        }
      } catch (error) {
        if (this.onAutoplayBlocked) this.onAutoplayBlocked();
      }
    } catch (error) {
      console.error('Error loading video:', error);
      if (retries < this.videoSources.length) {
        console.log(`Retrying (${retries + 1}/${this.videoSources.length})...`);
        setTimeout(() => this.loadVideoByDirection(direction, retries + 1), 0);
      } else {
        console.error('All videos failed to load after maximum retries.');
        if (this.onLoadFailed) this.onLoadFailed();
      }
    } finally {
      this.isLoading = false;
      if (this.onSpinnerUpdate) this.onSpinnerUpdate();
    }
  }
}

export default VideoController; 