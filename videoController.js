/*
 * videoController.js
 * This module provides centralized video control with queued commands for seeks, source loading, playback, and error handling.
 */

class VideoController {
  constructor(videoElement, providers) {
    this.video = videoElement;
    this.providers = providers;
    // Chunk streaming properties
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
  }

  // Chunk streaming methods
  async fetchChunk(cid, chunkIndex) {
    const chunkSize = 4 * 1024 * 1024; // 4MB
    const start = chunkIndex * chunkSize;
    const providerIndex = chunkIndex % this.providers.length;
    const provider = this.providers[providerIndex];
    
    try {
      const chunk = await provider.fetch(cid, start, start + chunkSize - 1);
      return { chunkIndex, data: chunk };
    } catch (error) {
      console.error(`Failed to fetch chunk ${chunkIndex} from ${provider.name}:`, error);
      return { chunkIndex, data: null };
    }
  }

  async startStream(cid) {
    let expectedChunk = 0;
    const decoder = new StreamDecoder();
    const chunkQueue = this.chunkQueue;

    // Start initial concurrent fetches
    for (let i = 0; i < this.providers.length; i++) {
      this.queueChunkFetch(cid, i);
    }

    while (true) {
      const result = await Promise.race([
        this.waitForNextChunk(),
        this.video.needsData?.() || Promise.resolve('chunk-ready')
      ]);

      if (result === 'need-data') {
        while (chunkQueue.length > 0 && chunkQueue[0].chunkIndex === expectedChunk) {
          const chunk = chunkQueue.shift();
          if (chunk.data) {
            const decoded = decoder.process(chunk.data);
            this.video.feed(decoded);
          }
          expectedChunk++;
          this.queueChunkFetch(cid, expectedChunk + this.providers.length - 1);
        }
      }
    }
  }

  queueChunkFetch(cid, chunkIndex) {
    if (this.activeFetches.has(chunkIndex)) return;

    const fetchPromise = this.fetchChunk(cid, chunkIndex).then(result => {
      this.activeFetches.delete(chunkIndex);
      this.chunkQueue.push(result);
      this.chunkQueue.sort((a, b) => a.chunkIndex - b.chunkIndex);
    });

    this.activeFetches.set(chunkIndex, fetchPromise);
  }

  waitForNextChunk() {
    return new Promise(resolve => {
      const check = () => {
        if (this.chunkQueue.length > 0) {
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
      });
    }, timeout);
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