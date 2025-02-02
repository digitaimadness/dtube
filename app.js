// Refactored and cleaned app.js

// --- Global Constants and Variables --- //
const PROVIDERS = ['io', 'algonode.xyz', 'eth.aragon.network', 'dweb.link', 'flk-ipfs.xyz'];
const VIDEO_CACHE_KEY = 'videoCache';

const video = document.getElementById("videoPlayer");
// Set CORS attribute for cross-origin video frame sampling
video.crossOrigin = "anonymous";

// Offscreen canvas for optimized frame sampling
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");
const samplingWidth = 32, samplingHeight = 32;
offscreenCanvas.width = samplingWidth;
offscreenCanvas.height = samplingHeight;

// Global variables for video loading and buffering state
let isLoading = false;
let currentVideoIndex = -1;
let preloadedNextUrl = null;
let isPreloadingNext = false;
let bufferingUpdateScheduled = false;
let isBuffering = false;

// Cache references to spinner and progress bar elements
const spinner = document.getElementById("spinner");
const progressFilledElem = document.querySelector('.progress-bar');

// Add these constants with other global constants
const CONTROLS_TIMEOUT = 3000; // 3 seconds of inactivity

// Import video sources
import videoSourcesImport from './videoSources.js';

// Replace the original import and redeclaration
const videoSources = shuffleArray(videoSourcesImport);

// Add global declaration at the top with other globals
let controlsSystem;  // Add this line with other global variables

// Add constants at the top with other globals
const TIMESTAMP_OFFSET_BOTTOM = 20; // px from progress bar
const POPUP_TRANSITION_DURATION = 0.05; // seconds

// Existing variables
let currentProviderIndex = 0;
const LOAD_TIMEOUT = 2000; // 2 seconds

// --- Helper Functions --- //

/**
 * Shuffles an array in place and returns it.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Constructs the URL to access the video through a given provider.
 */
const getProviderUrl = (provider, cid) =>
  ["dweb.link", "flk-ipfs.xyz"].includes(provider)
    ? `https://${cid}.ipfs.${provider}`
    : `https://ipfs.${provider}/ipfs/${cid}`;

/**
 * Loads video sources from different providers until one works.
 */
function loadVideoFromCid(cid) {
  // Check cache first
  const cachedUrl = localStorage.getItem(getCacheKey(cid));
  if (cachedUrl) {
    return Promise.resolve(cachedUrl);
  }

  const promises = PROVIDERS.map(provider => {
    return new Promise((resolve, reject) => {
      const url = getProviderUrl(provider, cid);
      const testVideo = document.createElement("video");
      testVideo.style.display = "none";

      const cleanup = () => testVideo.remove();

      testVideo.addEventListener(
        "canplay",
        () => {
          cleanup();
          // Cache successful URL
          localStorage.setItem(getCacheKey(cid), url);
          resolve(url);
        },
        { once: true }
      );

      testVideo.addEventListener(
        "error",
        () => {
          cleanup();
          reject(new Error(`Provider ${provider} failed for CID ${cid}`));
        },
        { once: true }
      );

      testVideo.src = url;
      testVideo.preload = "auto";
      testVideo.load();
      document.body.appendChild(testVideo);
    });
  });

  return Promise.any(promises).catch(errors => {
    throw new Error(`All providers failed for CID ${cid}: ${errors}`);
  });
}

/**
 * Loads the next video using provider retry logic.
 */
async function loadNextVideo() {
  if (isLoading || !videoSources.length) return;
  try {
    isLoading = true;
    controlsSystem.updateSpinner();
    video.pause();
    
    // Clear existing source and force garbage collection
    video.src = "";
    await new Promise(resolve => requestAnimationFrame(resolve));

    if (preloadedNextUrl) {
      currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
      video.src = preloadedNextUrl;
      console.log('Loaded preloaded video URL:', preloadedNextUrl);
      
      // Warm up the buffer
      video.preload = "auto";
      video.muted = true;
      await video.play();
      video.muted = false;
      video.pause();
      
      preloadedNextUrl = null;
    } else {
      currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
      const cid = videoSources[currentVideoIndex];
      console.log('Attempting to load video with CID:', cid);
      const url = await loadVideoFromCid(cid);
      
      video.src = url;
      console.log('Loaded video URL:', url);
      
      // Wait for enough data to play
      await new Promise((resolve) => {
        video.addEventListener('canplaythrough', resolve, { once: true });
      });
    }

    // Start playback with better buffering handling
    try {
      video.muted = true;
      await video.play();
      video.muted = false;
      // Start preloading next video after successful playback
      preloadNextVideo();
    } catch (error) {
      console.error('Autoplay blocked', error);
      // Show popup to inform user about muted autoplay
      controlsSystem.showGesturePopup("Click to unmute", { x: window.innerWidth/2, y: window.innerHeight/2 });
    }
  } catch (error) {
    console.error('Error loading video:', error);
    // Skip to next video on error
    loadNextVideo();
  } finally {
    isLoading = false;
    controlsSystem.updateSpinner();
  }
}

/**
 * Loads the previous video using provider retry logic.
 */
async function loadPreviousVideo() {
  if (isLoading || !videoSources.length) return;
  try {
    isLoading = true;
    controlsSystem.updateSpinner();
    video.pause();
    // Decrement index with wrap-around
    currentVideoIndex = (currentVideoIndex - 1 + videoSources.length) % videoSources.length;
    const cid = videoSources[currentVideoIndex];
    console.log("Attempting to load previous video with CID:", cid);

    const url = await loadVideoFromCid(cid);
    video.src = url;
    console.log("Loaded video URL:", url);
    video.load();

    try {
      await video.play();
    } catch (error) {
      console.error("Autoplay blocked", error);
    }
  } catch (error) {
    console.error("Error loading previous video:", error);
  } finally {
    isLoading = false;
    controlsSystem.updateSpinner();
  }
}

/**
 * Converts an RGB color to its corresponding hue (in degrees).
 */
function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
  let hue;
  if (max === min) {
    hue = 0;
  } else if (max === r) {
    hue = (60 * ((g - b) / (max - min)) + 360) % 360;
  } else if (max === g) {
    hue = (60 * ((b - r) / (max - min)) + 120) % 360;
  } else {
    hue = (60 * ((r - g) / (max - min)) + 240) % 360;
  }
  return hue;
}

// --- New Controls and Progress Bar System ---
class ZoneInteractionHandler {
  constructor(uiController) {
    this.ui = uiController;
    this.MULTI_TAP_DELAY = 200;
  }

  initialize() {
    this.setupZone(this.ui.controls.leftZone, this.handleLeftZoneClick.bind(this));
    this.setupZone(this.ui.controls.rightZone, this.handleRightZoneClick.bind(this));
    this.setupZone(this.ui.controls.centerZone, this.handleCenterZoneClick.bind(this));
  }

  setupZone(zone, handler) {
    let clickCount = 0;
    let timeout;

    zone.addEventListener('click', (e) => {
      const clickPos = { x: e.clientX, y: e.clientY };
      clickCount++;
      clearTimeout(timeout);

      if (clickCount === 3) {
        handler(clickPos, 3);
        clickCount = 0;
        return;
      }

      timeout = setTimeout(() => {
        handler(clickPos, clickCount);
        clickCount = 0;
      }, this.MULTI_TAP_DELAY);
    });
  }

  handleLeftZoneClick(clickPos, count) {
    switch(count) {
      case 1: 
        this.ui.togglePlayPause(clickPos); 
        break;
      case 2: 
        this.ui.secsSeek(-15);
        this.ui.showGesturePopup("Rewind 15s", clickPos);
        break;
      case 3: 
        loadPreviousVideo();
        this.ui.showGesturePopup("Previous Video", clickPos);
        break;
    }
  }

  handleRightZoneClick(clickPos, count) {
    switch(count) {
      case 1: 
        this.ui.togglePlayPause(clickPos); 
        break;
      case 2: 
        this.ui.secsSeek(15);
        this.ui.showGesturePopup("Forward 15s", clickPos);
        break;
      case 3:
        loadNextVideo();
        this.ui.showGesturePopup("Next Video", clickPos);
        break;
    }
  }

  handleCenterZoneClick(clickPos, count) {
    switch(count) {
      case 1: this.ui.togglePlayPause(clickPos); break;
      case 2: this.ui.toggleFullscreen(clickPos); break;
    }
  }
}

// --- Frame Analysis Optimizations --- //
class FrameAnalyzer {
  static samplingWidth = 32;
  static samplingHeight = 32;
  static PIXEL_STEP = 8; // Sample every other pixel

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = FrameAnalyzer.samplingWidth;
    this.canvas.height = FrameAnalyzer.samplingHeight;
  }

  getDominantHue(video) {
    try {
      this.ctx.drawImage(video, 0, 0, FrameAnalyzer.samplingWidth, FrameAnalyzer.samplingHeight);
      const imageData = this.ctx.getImageData(0, 0, 
        FrameAnalyzer.samplingWidth, FrameAnalyzer.samplingHeight);
      return this.calculateAverageHue(imageData.data);
    } catch (error) {
      console.warn("Frame analysis error:", error);
      return 0;
    }
  }

  calculateAverageHue(data) {
    let r = 0, g = 0, b = 0;
    // Process every other pixel using step size
    for (let i = 0; i < data.length; i += FrameAnalyzer.PIXEL_STEP) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const totalPixels = (data.length / 4) * (4 / FrameAnalyzer.PIXEL_STEP);
    return rgbToHue(r/totalPixels, g/totalPixels, b/totalPixels);
  }
}

// Insert UIManager class after FrameAnalyzer class

class UIController {
  constructor(video) {
    this.video = video;
    this.controlsTimeout = null;
    this.controls = {
      progressContainer: document.querySelector('.progress-container'),
      progressBar: document.querySelector('.progress-bar'),
      bufferBar: document.querySelector('.buffer-bar'),
      gesturePopup: document.getElementById('gesturePopup'),
      leftZone: document.querySelector('.zone.left-zone'),
      centerZone: document.querySelector('.zone.center-zone'),
      rightZone: document.querySelector('.zone.right-zone'),
      spinner: document.getElementById('spinner')
    };
    
    this.state = {
      isDragging: false,
      controlsVisible: true,
      cachedRect: null,
      lastPopupOffsetX: null,
      lastPopupText: null,
      multiTapState: {},
      arrowTimeout: null
    };

    this.frameAnalyzer = new FrameAnalyzer();
    this.zoneHandler = new ZoneInteractionHandler(this);
    this.initializeUI();
    this.lastHueUpdate = 0;
    this.fullscreenUIHidden = false;
  }

  initializeUI() {
    this.createTimestampPopup();
    this.createProgressBackground();
    this.bindEvents();
    this.zoneHandler.initialize();
    this.initKeyBindings();
    this.initActivityMonitoring();
  }

  createTimestampPopup() {
    this.timestampPopup = document.createElement('div');
    this.timestampPopup.className = 'timestamp-popup';
    
    // Centralized style configuration
    Object.assign(this.timestampPopup.style, {
      cursor: 'grab',
      display: 'none',
      position: 'absolute',
      bottom: `${TIMESTAMP_OFFSET_BOTTOM}px`,
      transform: 'translateX(-50%)',
      transformOrigin: 'center bottom',
      transition: `left ${POPUP_TRANSITION_DURATION}s linear`
    });

    this.controls.progressContainer.appendChild(this.timestampPopup);
  }

  createProgressBackground() {
    this.progressBackground = document.createElement('div');
    this.progressBackground.className = 'progress-background';
    this.controls.progressContainer.insertBefore(
      this.progressBackground, 
      this.controls.progressBar
    );
    this.progressBackground.style.transition = 'background-color 0.5s ease';
  }

  bindEvents() {
    // Progress container events
    this.controls.progressContainer.addEventListener('pointerenter', () => {
      this.state.cachedRect = this.controls.progressContainer.getBoundingClientRect();
    });

    this.controls.progressContainer.addEventListener('pointerleave', () => {
      this.state.cachedRect = null;
    });

    window.addEventListener('resize', () => {
      if (this.state.cachedRect) {
        this.state.cachedRect = this.controls.progressContainer.getBoundingClientRect();
      }
    });

    // Pointer events - update throttle to 16ms and ensure position updates
    const throttledPointerMove = throttle((e) => {
      const position = this.calculateSeekPosition(e.clientX);
      this.updateTimestampPopupPreview(position.offsetX);
      if (this.state.isDragging) {
        this.video.currentTime = position.time;
        this.updatePlaybackProgress(this.video);
        this.updateTimestampPopupPreview(position.offsetX); // Immediate update
      }
    }, 16); // 60fps update rate

    this.controls.progressContainer.addEventListener('pointermove', throttledPointerMove);
    this.controls.progressContainer.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.controls.progressContainer.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    this.controls.progressContainer.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

    // Add timestamp popup drag handlers
    this.timestampPopup.addEventListener('pointerdown', (e) => {
      this.handlePopupDragStart(e);
    });
    
    document.addEventListener('pointermove', (e) => {
      this.handlePopupDragMove(e);
    });
    
    document.addEventListener('pointerup', (e => {
      this.handlePopupDragEnd(e);
    }));
  }

  updateBufferBar(video) {
    if (!video.duration) {
      if (this.controls.bufferBar) {
        this.controls.bufferBar.style.width = "0%";
        this.controls.bufferBar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      }
      return;
    }
    let bufferedPercentage = 0;
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      bufferedPercentage = (bufferedEnd / video.duration) * 100;
    }
    if (this.controls.bufferBar) {
      this.controls.bufferBar.style.width = bufferedPercentage + '%';
      this.controls.bufferBar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    }
  }

  updatePlaybackProgress(video) {
    if (!video.duration) return;
    const percent = (video.currentTime / video.duration) * 100;
    if (this.controls.progressBar) {
      this.controls.progressBar.style.width = percent + '%';
    }
  }

  updateProgressBarColor(hue) {
    if (this.controls.progressBar) {
      this.controls.progressBar.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
      // Update spinner color to match progress bar
      this.controls.spinner.style.borderTopColor = 
        `hsl(${hue}, 70%, 50%)`;
      // Update timestamp popup styles to match
      this.timestampPopup.style.backgroundColor = `hsla(${hue}, 70%, 50%, 0.2)`;
      this.timestampPopup.style.border = `2px solid hsla(${hue}, 70%, 35%, 0.8)`;
      this.timestampPopup.style.color = `hsl(${hue}, 70%, 95%)`;
      this.progressBackground.style.backgroundColor = `hsla(${hue}, 30%, 20%, 0.3)`;
    }
  }

  updateTimestampPopupPreview(offsetX) {
    const rect = this.controls.progressContainer.getBoundingClientRect();
    const popupText = formatTime(this.video.currentTime);
    
    // Calculate popup boundaries
    const popupWidth = this.timestampPopup.offsetWidth;
    const containerWidth = rect.width;
    const adjustedX = Math.max(popupWidth/2, Math.min(offsetX, containerWidth - popupWidth/2));
    
    this.timestampPopup.textContent = popupText;
    this.timestampPopup.style.left = `${adjustedX}px`;
    this.timestampPopup.style.opacity = '1';
    this.timestampPopup.style.display = 'block';
  }

  showGesturePopup(message, clickPos) {
    const gp = this.controls.gesturePopup;
    if (!gp) return;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Get current progress bar color for consistency
    const currentHue = this.frameAnalyzer.getDominantHue(this.video);
    
    // Apply matching styles with progress bar (updated opacity)
    gp.style.cssText = `
      display: flex;
      opacity: 0;
      transform: translate(-50%, -50%) scale(0);
      transition: opacity 300ms ease, transform 300ms ease;
      background: hsla(${currentHue}, 70%, 50%, 0.2);
      color: hsla(${currentHue}, 70%, 95%, 0.9);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 1.6em;
      font-weight: bold;
      text-shadow: 0 1px 3px hsla(${currentHue}, 70%, 20%, 0.4);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      border: 2px solid hsla(${currentHue}, 70%, 35%, 0.8);
      backdrop-filter: blur(4px);
      min-width: auto;
      white-space: nowrap;
    `;

    gp.offsetHeight; // trigger reflow
    gp.textContent = message;
    const posX = clickPos?.x ?? window.innerWidth/2;
    const posY = clickPos?.y ?? window.innerHeight/2;
    gp.style.left = `${posX}px`;
    gp.style.top = `${posY}px`;
    requestAnimationFrame(() => {
      gp.style.opacity = '1';
      gp.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    this.hideTimeout = setTimeout(() => {
      gp.style.opacity = '0';
      gp.style.transform = 'translate(-50%, -50%) scale(0)';
      this.hideTimeout = setTimeout(() => {
        gp.style.display = 'none';
        this.hideTimeout = null;
      }, 300);
    }, 1000);
  }

  showControls() {
    if (this.controlsVisible && !this.fullscreenUIHidden) return;
    this.controlsVisible = true;
    this.controls.progressContainer.style.opacity = '1';
    this.timestampPopup.style.opacity = '1';
  }

  hideControls() {
    if (!this.controlsVisible || !document.fullscreenElement) return;
    this.controlsVisible = false;
    this.fullscreenUIHidden = true;
    this.controls.progressContainer.style.opacity = '0';
    this.timestampPopup.style.opacity = '0';
  }

  initKeyBindings() {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

  handleKeyPress(e) {
    this.resetControlsTimeout();
    if (e.repeat) return;
    
    const keyActions = {
      'Space': () => this.togglePlayPause(null),
      'KeyF': () => this.toggleFullscreen(null),
      'ArrowRight': () => this.handleArrowKey('right', e),
      'ArrowLeft': () => this.handleArrowKey('left', e),
      'ArrowUp': () => this.adjustVolume(0.1),
      'ArrowDown': () => this.adjustVolume(-0.1)
    };

    if (keyActions[e.code]) {
      e.preventDefault();
      keyActions[e.code]();
    }
  }

  handleArrowKey(direction, e) {
    const positions = {
      right: { x: window.innerWidth - 100, y: window.innerHeight / 2 },
      left: { x: 100, y: window.innerHeight / 2 }
    };

    // Clear any existing timeout for this direction
    if (this.state.arrowTimeout) {
      clearTimeout(this.state.arrowTimeout);
      this.state.arrowTimeout = null;
    }

    // Increment tap count
    const tapCount = (this.state.multiTapState?.[direction] || 0) + 1;
    this.state.multiTapState = { ...this.state.multiTapState, [direction]: tapCount };

    if (tapCount === 2) {
      // Handle double tap
      if (direction === 'right') {
        loadNextVideo();
        this.showGesturePopup("Next Video", positions.right);
      } else {
        loadPreviousVideo();
        this.showGesturePopup("Previous Video", positions.left);
      }
      this.state.multiTapState[direction] = 0;
    } else {
      // Set timeout for single tap action
      this.state.arrowTimeout = setTimeout(() => {
        const seconds = direction === 'right' ? 15 : -15;
        this.secsSeek(seconds);
        this.showGesturePopup(
          `${direction === 'right' ? 'Forward' : 'Rewind'} 15s`,
          positions[direction]
        );
        this.state.multiTapState[direction] = 0;
      }, 200);
    }
  }

  adjustVolume(change) {
    this.video.volume = Math.min(Math.max(this.video.volume + change, 0), 1);
    const position = change > 0 
      ? { x: window.innerWidth / 2, y: 100 }
      : { x: window.innerWidth / 2, y: window.innerHeight - 100 };
    this.showGesturePopup(
      this.video.volume === (change > 0 ? 1 : 0) 
        ? `Volume ${change > 0 ? 'Max' : 'Min'}`
        : `Volume ${change > 0 ? '+' : '-'}`,
      position
    );
  }

  toggleFullscreen(clickPos) {
    this.resetControlsTimeout();
    if (!clickPos) {
      clickPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const wrapper = document.querySelector('.video-wrapper');
    if (!document.fullscreenElement) {
      if (wrapper) {
        wrapper.requestFullscreen().then(() => {
          this.showGesturePopup("Fullscreen", clickPos);
          this.fullscreenUIHidden = false;
          this.showControls(); // Show controls immediately when entering fullscreen
        }).catch(err => {
          console.error(`Error attempting fullscreen: ${err.message}`);
          this.showGesturePopup("Fullscreen", clickPos);
        });
      }
    } else {
      document.exitFullscreen().then(() => {
        this.showGesturePopup("Windowed", clickPos);
        this.fullscreenUIHidden = false;
        this.showControls(); // Ensure controls are visible when exiting
      }).catch(err => {
        console.error(`Error exiting fullscreen: ${err.message}`);
        this.showGesturePopup("Windowed", clickPos);
      });
    }
  }

  calculateSeekPosition(clientX) {
    const rect = this.controls.progressContainer.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const percent = offsetX / rect.width;
    return {
      time: percent * this.video.duration,
      offsetX: offsetX
    };
  }

  seek(clientX) {
    this.resetControlsTimeout();
    const position = this.calculateSeekPosition(clientX);
    if (this.video.duration) {
        this.video.currentTime = position.time;
        this.updatePlaybackProgress(this.video);
        this.updateTimestampPopupPreview(position.offsetX); // Force position update
    }
  }

  initActivityMonitoring() {
    const activityEvents = ['mousemove', 'click', 'touchstart', 'keydown'];
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.showControls();
        this.resetControlsTimeout();
      }, { passive: true });
    });
  }

  resetControlsTimeout() {
    clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      this.hideControls();
    }, CONTROLS_TIMEOUT);
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.state.isDragging = true;
    this.showControls();
    this.controls.progressContainer.setPointerCapture(e.pointerId);
    this.seek(e.clientX); // Direct seek on pointer down
    this.timestampPopup.style.display = 'block';
    this.controls.progressBar.classList.add('dragging');
    this.updateTimestampPopupPreview(this.calculateSeekPosition(e.clientX).offsetX); // Initial position
  }

  handlePointerUp(e) {
    if (this.state.isDragging) {
      this.seek(e.clientX);
      this.state.isDragging = false;
      this.controls.progressContainer.classList.remove("active");
      this.controls.progressContainer.releasePointerCapture(e.pointerId);
      this.hideTimestampPopup();
      this.controls.progressBar.classList.remove('dragging');
    }
  }

  secsSeek(seconds) {
    this.video.currentTime = Math.max(0, this.video.currentTime + seconds);
  }

  togglePlayPause(clickPos) {
    this.resetControlsTimeout();
    if (!clickPos) {
      clickPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    if (this.video.paused) {
      // Unmute on first user interaction
      this.video.muted = false;
      this.video.play().then(() => {
        this.showGesturePopup("Play", clickPos);
      }).catch(err => {
        console.error("Error playing video:", err);
        this.showGesturePopup("Play", clickPos);
      });
    } else {
      this.video.pause();
      this.showGesturePopup("Pause", clickPos);
    }
  }

  updateAll() {
    this.updateBufferBar(this.video);
    
    // Always update playback progress regardless of controls visibility
    this.updatePlaybackProgress(this.video);
    
    if (this.video.duration > 0) {
      const rect = this.controls.progressContainer.getBoundingClientRect();
      const percent = this.video.currentTime / this.video.duration;
      const offsetX = percent * rect.width;
      this.updateTimestampPopupPreview(offsetX);
    }

    if (Date.now() - this.lastHueUpdate >= 500) {
      if (!this.video.paused && this.video.readyState >= 2) {
        const hue = this.frameAnalyzer.getDominantHue(this.video);
        this.updateProgressBarColor(hue);
      }
      this.lastHueUpdate = Date.now();
    }

    this.updateSpinner();
  }

  handlePopupDragStart(e) {
    e.preventDefault();
    this.state.isDraggingPopup = true;
    const position = this.calculateSeekPosition(e.clientX);
    this.video.currentTime = position.time;
    this.controls.progressBar.style.width = `${(position.time / this.video.duration) * 100}%`;
    this.timestampPopup.style.cursor = 'grabbing';
    this.timestampPopup.setPointerCapture(e.pointerId);
  }

  handlePopupDragMove(e) {
    if (this.state.isDraggingPopup) {
      const position = this.calculateSeekPosition(e.clientX);
      this.video.currentTime = position.time;
      this.controls.progressBar.style.width = `${(position.time / this.video.duration) * 100}%`;
      this.updateTimestampPopupPreview(position.offsetX);
    }
  }

  handlePopupDragEnd(e) {
    this.state.isDraggingPopup = false;
    this.state.cachedRect = null;
    this.controls.progressBar.classList.remove('dragging');
    this.timestampPopup.style.cursor = 'grab';
    this.timestampPopup.releasePointerCapture(e.pointerId);
  }

  hideTimestampPopup() {
    this.timestampPopup.style.opacity = '0';
  }

  // Consolidated popup position handling
  updatePopupPosition(clientX) {
    const position = this.calculateSeekPosition(clientX);
    this.video.currentTime = position.time;
    this.updatePlaybackProgress();
    this.updateTimestampPopupPreview(position.offsetX);
  }

  // Simplified event handler
  handlePointerMove(e) {
    const position = this.calculateSeekPosition(e.clientX);
    this.updateTimestampPopupPreview(position.offsetX);
    
    if (this.state.isDragging) {
      this.updatePopupPosition(e.clientX);
    }
  }

  updateSpinner() {
    const showSpinner = isLoading || isBuffering;
    this.controls.spinner.style.display = showSpinner ? "block" : "none";
    
    // Update spinner color to match progress bar
    if (showSpinner) {
      const currentHue = this.frameAnalyzer.getDominantHue(this.video);
      this.controls.spinner.style.borderTopColor = `hsl(${currentHue}, 70%, 50%)`;
    }
  }
}

// --- Update registerVideoEventListeners ---
function registerVideoEventListeners() {
  // Buffering and additional video events.
  video.addEventListener("progress", () => {
    controlsSystem && controlsSystem.updateBufferBar(video);
  }, { passive: true });
  video.addEventListener("timeupdate", () => {
    controlsSystem && controlsSystem.updatePlaybackProgress(video);
  }, { passive: true });
  // Note: timeupdate events will be handled below after instantiating the ControlsSystem.

  // Add these new event listeners
  video.addEventListener("waiting", () => {
    if (!isBuffering) {
      isBuffering = true;
    }
  });

  video.addEventListener("playing", () => {
    if (isBuffering) {
      isBuffering = false;
    }
  });

  video.addEventListener("ended", () => {
    loadNextVideo();
  }, { passive: true });
}

// --- Update main() to instantiate ControlsSystem --- //
async function main() {
  registerVideoEventListeners();
  // Properly uses the globally declared variable
  controlsSystem = new UIController(video);

  // Forward timeupdate events to update the controls system.
  function updateProgress() {
    controlsSystem.updateAll();
    requestAnimationFrame(updateProgress);
  }

  requestAnimationFrame(updateProgress);

  if (videoSources.length > 0) {
    await loadNextVideo();
  } else {
    console.error("No video sources available");
  }
}

main().catch(err => console.error("Initialization failed:", err));

// --- Viewport Height Handling --- //
function setViewportHeight() {
  // Calculate and set 1% of the current viewport height.
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', setViewportHeight);

/**
 * Format time (in seconds) to mm:ss format.
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return minutes + ':' + (secs < 10 ? '0' : '') + secs;
}

/* Zone Interaction Code using the correct video element (id="videoPlayer") */
const leftZone = document.querySelector('.zone.left-zone');
const centerZone = document.querySelector('.zone.center-zone');
const rightZone = document.querySelector('.zone.right-zone');

// Helper function to seek the video by a given time in seconds.
function zoneSeekVideo(seconds) {
  // 'video' is already defined at the top as the videoPlayer element.
  video.currentTime = Math.max(0, video.currentTime + seconds);
}

// --- Rewritten Popup Class Implementation from scratch ---
class Popup {
  constructor() {
    // Create an overlay element with the popup-overlay class
    this.overlay = document.createElement('div');
    this.overlay.classList.add('popup-overlay');

    // Create the message box element with the popup class
    this.messageBox = document.createElement('div');
    this.messageBox.classList.add('popup');

    this.overlay.appendChild(this.messageBox);
    document.body.appendChild(this.overlay);

    // Hide the popup when the overlay is clicked, but not when the message box is clicked
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  show(message) {
    this.messageBox.textContent = message;
    this.overlay.classList.add('active');
  }

  hide() {
    this.overlay.classList.remove('active');
  }
}

// --- Initialize the new Popup when DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', () => {
  const popup = new Popup();

  // Optional sample: attach an event listener to a button with id 'openPopup' if it exists
  const openPopupButton = document.querySelector('#openPopup');
  if (openPopupButton) {
    openPopupButton.addEventListener('click', () => {
      popup.show('This is a modal popup!');
    });
  }

  // For demonstration purposes, you can uncomment the line below to auto-show the popup on load
  // popup.show('Welcome to DaokoTube!');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    video.pause();
  } else if (!video.paused) {
    video.play();
  }
});

function throttle(func, limit) {
  let lastCall = 0;
  let timeoutId;
  return function(...args) {
    const now = Date.now();
    const remaining = limit - (now - lastCall);
    
    if (remaining <= 0) {
      // Execute immediately and reset timer
      func.apply(this, args);
      lastCall = now;
    } else {
      // Clear any existing timeout and schedule new execution
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastCall = Date.now();
      }, remaining);
    }
  };
}

// Insert preloadNextVideo function after loadPreviousVideo function (or after loadNextVideo) near its definition
async function preloadNextVideo() {
  if (isPreloadingNext || videoSources.length === 0) return;
  isPreloadingNext = true;
  const nextIndex = (currentVideoIndex + 1) % videoSources.length;
  const cid = videoSources[nextIndex];
  
  try {
    // Check cache first
    const cachedUrl = localStorage.getItem(getCacheKey(cid));
    if (cachedUrl) {
      preloadedNextUrl = cachedUrl;
      console.log('Using cached URL for preload:', cachedUrl);
      return;
    }
    
    const url = await loadVideoFromCid(cid);
    preloadedNextUrl = url;
    console.log('Preloaded next video URL:', url);
  } catch (error) {
    console.error('Preloading next video failed:', error);
    preloadedNextUrl = null;
  } finally {
    isPreloadingNext = false;
  }
}

function getCacheKey(cid) {
  return `video_${cid}`;
}
