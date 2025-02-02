/*
 * videoController.js
 * This module provides centralized video control with queued commands for seeks, source loading, playback, and error handling.
 */

class VideoController {
  constructor(videoElement) {
    this.video = videoElement;
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.currentLoadAbortController = null;

    // New properties for merged video navigation
    this.videoSources = [];
    this.currentVideoIndex = -1;
    this.isLoading = false;
    this.preloadedVideoUrl = null;

    // Optional callbacks for UI updates
    this.onAutoplayBlocked = null;
    this.onLoadFailed = null;
    this.onSpinnerUpdate = null;
  }

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

  async loadVideo(urlPromise, timeout = 5000) {
    // Abort any existing load
    if (this.currentLoadAbortController) {
      this.currentLoadAbortController.abort();
    }
    this.currentLoadAbortController = new AbortController();
    const signal = this.currentLoadAbortController.signal;
    
    // Clear current source and allow cleanup
    this.video.src = "";
    await new Promise(resolve => setTimeout(resolve, 50));

    let url;
    try {
      url = await urlPromise;
    } catch (error) {
      throw new Error("Failed to get video URL");
    }

    if (signal.aborted) {
      throw new Error("Video load aborted");
    }

    this.video.src = url;

    return new Promise((resolve, reject) => {
      const onCanPlay = () => {
        cleanup();
        resolve(url);
      };
      const onAbort = () => {
        cleanup();
        reject(new Error("Video load aborted"));
      };
      const cleanup = () => {
        this.video.removeEventListener('canplaythrough', onCanPlay);
        signal.removeEventListener('abort', onAbort);
      };
      signal.addEventListener('abort', onAbort);
      this.video.addEventListener('canplaythrough', onCanPlay, { once: true });
      setTimeout(() => {
        cleanup();
        reject(new Error("Video load timeout"));
      }, timeout);
    });
  }

  async play(timeout = 5000) {
    return this.queueCommand(() => {
      return new Promise(async (resolve, reject) => {
        this.video.muted = true; // Attempt muted autoplay
        try {
          await this.video.play();
          this.video.muted = false;
          resolve();
        } catch (e) {
          reject(new Error("Autoplay blocked even in muted mode"));
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
          console.log('Loaded preloaded video URL:', this.preloadedVideoUrl);
          this.preloadedVideoUrl = null;
        } else {
          this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoSources.length;
          const cid = this.videoSources[this.currentVideoIndex];
          console.log('Attempting to load video with CID:', cid);
          const url = await loadVideoFromCid(cid);
          console.log('Loaded video URL:', url);
          await this.loadVideo(Promise.resolve(url));
        }
      } else {
        // Previous video
        this.currentVideoIndex = (this.currentVideoIndex - 1 + this.videoSources.length) % this.videoSources.length;
        const cid = this.videoSources[this.currentVideoIndex];
        console.log('Attempting to load previous video with CID:', cid);
        const url = await loadVideoFromCid(cid);
        console.log('Loaded video URL:', url);
        await this.loadVideo(Promise.resolve(url));
      }

      // Attempt playback with muted fallback
      try {
        this.video.muted = true;
        await this.video.play();
        this.video.muted = false;
        // Optionally, trigger preloading of the next video here if a preloadNextVideo method exists
        if (direction > 0 && typeof this.preloadNextVideo === 'function') {
          this.preloadNextVideo();
        }
      } catch (error) {
        console.error('Autoplay blocked', error);
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