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
    this.chunkSize = 2 * 1024 * 1024; // Reduced to 2MB for faster initial load
    this.initialConcurrentFetches = 2; // Only fetch first 2 chunks initially
    this.concurrentFetches = providers.length;
    this.currentProviderIndex = 0;
    this.chunkQueue = new PriorityQueue((a, b) => a.priority - b.priority);
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
    // Add priority constants
    this.PRIORITY = {
      CRITICAL: 0, // First chunk and recovery chunks
      HIGH: 1,     // Subsequent initial chunks
      NORMAL: 2    // Background prefetch
    };
  }

  // Chunk streaming methods
  async fetchChunk(cid, chunkIndex) {
    const sortedProviders = this.getSortedProviders();
    const start = chunkIndex * this.chunkSize;
    const end = start + this.chunkSize - 1;

    // Race providers with timeout
    return Promise.race([
      Promise.any(sortedProviders.map(provider => 
        this.tryProviderForChunk(provider, cid, start, end)
      )),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Chunk fetch timeout')), 3000)
      )
    ]);
  }

  async tryProviderForChunk(provider, cid, start, end) {
    const startTime = performance.now();
    const response = await provider.fetch(cid, start, end);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    const fetchTime = performance.now() - startTime;
    
    this.updateProviderStats(provider, fetchTime);
    return {
      chunkIndex: Math.floor(start / this.chunkSize),
      data: new Uint8Array(buffer),
      provider: provider.name
    };
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
    if (this.debug) console.log(`%c[Stream Start] CID: ${cid}`, 'color: #4CAF50');
    
    // Fetch first chunk with highest priority
    this.queueChunkFetch(cid, 0, this.PRIORITY.CRITICAL);
    
    // Prefetch next chunks with lower priority
    for (let i = 1; i < this.initialConcurrentFetches; i++) {
      this.queueChunkFetch(cid, i, this.PRIORITY.HIGH);
    }

    while (true) {
      const result = await Promise.race([
        this.waitForNextChunk(),
        this.video.needsData?.() || Promise.resolve('chunk-ready')
      ]);

      if (result === 'need-data') {
        while (this.chunkQueue.size() > 0) {
          const chunk = this.chunkQueue.dequeue();
          if (chunk.data) {
            // Process chunk and feed to video
            if (chunk.chunkIndex === 0 && this.debug) {
              console.log('%c[First chunk received]', 'color: #00BCD4');
            }
            this.video.feed(decoder.process(chunk.data));
            
            // Prefetch next chunks with normal priority
            const nextChunk = chunk.chunkIndex + 1;
            this.queueChunkFetch(cid, nextChunk, this.PRIORITY.NORMAL);
          }
        }
      }
    }
  }

  queueChunkFetch(cid, chunkIndex, priority = this.PRIORITY.NORMAL) {
    if (this.activeFetches.has(chunkIndex)) return;
    
    const fetchPromise = this.fetchChunk(cid, chunkIndex)
      .then(result => {
        this.activeFetches.delete(chunkIndex);
        this.chunkQueue.enqueue({ ...result, priority });
      });
    
    this.activeFetches.set(chunkIndex, fetchPromise);
  }

  waitForNextChunk() {
    return new Promise(resolve => {
      if (this.debug) console.log('%c[Wait] Starting chunk wait', 'color: #795548');
      const check = () => {
        if (this.chunkQueue.size() > 0) {
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