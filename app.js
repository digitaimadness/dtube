// --- Global Constants and Variables --- //
const PROVIDERS = ['io', 'algonode.xyz', 'eth.aragon.network', 'dweb.link', 'flk-ipfs.xyz'];
const providerDisplayNames = {
  'io': 'IPFS',
  'algonode.xyz': 'Algonode',
  'eth.aragon.network': 'Aragon',
  'dweb.link': 'IPFS',
  'flk-ipfs.xyz': 'Fleek'
};
const VIDEO_CACHE_KEY = 'videoCache';
const providerIndices = new Map(); // Tracks current provider index per CID

const video = document.getElementById("videoPlayer");
// Set CORS attribute for cross-origin video frame sampling
video.crossOrigin = "anonymous";
video.controls = false; // Disable native controls

// Offscreen canvas for optimized frame sampling
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
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

// Add at the top with other imports
import VideoController from './videoController.js';

// Add after video element initialization (~line 13)
const providers = PROVIDERS.map(name => ({ 
  name: providerDisplayNames[name],
  fetch: (cid, start, end) => fetch(getProviderUrl(name, cid), { headers: { Range: `bytes=${start}-${end}` }})
}));

// Initialize VideoController (~line 44)
const videoController = new VideoController(video, providers);

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

/* Insert new helper function testProvider before loadVideoFromCid */
function testProvider(url) {
  return new Promise((resolve, reject) => {
    const testVideo = document.createElement('video');
    testVideo.style.display = 'none';
    let resolved = false;
    const cleanup = () => {
      testVideo.remove();
      clearTimeout(timeout);
    };
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Timeout'));
      }
    }, LOAD_TIMEOUT);
    testVideo.addEventListener('canplay', () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(url);
      }
    }, { once: true });
    testVideo.addEventListener('error', () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Error loading video'));
      }
    }, { once: true });
    testVideo.src = url;
    document.body.appendChild(testVideo);
  });
}

/* Optimized loadVideoFromCid using testProvider and Promise.any */
async function loadVideoFromCid(cid) {
  const cacheKey = getCacheKey(cid);
  const cachedUrl = localStorage.getItem(cacheKey);
  if (cachedUrl) return cachedUrl;

  // Split providers into IPFS and non-IPFS groups
  const ipfsProviders = shuffleArray(PROVIDERS.filter(p => providerDisplayNames[p].includes('IPFS')));
  const otherProviders = shuffleArray(PROVIDERS.filter(p => !providerDisplayNames[p].includes('IPFS')));
  const allProviders = [...ipfsProviders, ...otherProviders];

  // Create test promises for all providers
  const providerPromises = allProviders.map(provider => {
    const url = getProviderUrl(provider, cid);
    return testProvider(url).then(() => url);
  });

  try {
    const validUrl = await Promise.any(providerPromises);
    localStorage.setItem(cacheKey, validUrl);
    return validUrl;
  } catch (error) {
    throw new Error("All providers failed");
  }
}

/**
 * Loads the next video using provider retry logic.
 */
async function loadNextVideo(retries = 0) {
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
      const cid = videoSources[currentVideoIndex];
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
      controlsSystem.showGesturePopup("Click to unmute", { x: window.innerWidth/2, y: window.innerHeight/2 }, 'warning');
    }
  } catch (error) {
    console.error('Error loading video:', error);
    // Skip to next video on error with retry limit
    if (retries < videoSources.length) {
      console.log(`Retrying (${retries + 1}/${videoSources.length})...`);
      setTimeout(() => loadNextVideo(retries + 1), 0);
    } else {
      console.error('All videos failed to load after maximum retries.');
      controlsSystem.showGesturePopup("All videos failed", { x: window.innerWidth/2, y: window.innerHeight/2 }, 'error');
    }
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
        this.ui.showFastSeekAnimation('left', clickPos);
        break;
      case 3: 
        loadPreviousVideo();
        this.ui.showGesturePopup("Previous Video", clickPos, 'info');
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
        this.ui.showFastSeekAnimation('right', clickPos);
        break;
      case 3:
        loadNextVideo();
        this.ui.showGesturePopup("Next Video", clickPos, 'info');
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
  static PIXEL_STEP = 16; // Increased from 8 to reduce data by 50%

  constructor() {
    this.canvas = offscreenCanvas;
    this.ctx = offscreenCtx;
    if (window.Worker) {
      const workerCode = `
        function rgbToHue(r, g, b) {
          r /= 255;
          g /= 255;
          b /= 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let hue;
          if (max === min) { hue = 0; } 
          else if (max === r) { hue = (60 * ((g - b) / (max - min)) + 360) % 360; } 
          else if (max === g) { hue = (60 * ((b - r) / (max - min)) + 120) % 360; } 
          else { hue = (60 * ((r - g) / (max - min)) + 240) % 360; }
          return hue;
        }
        self.onmessage = function(e) {
          const { data, pixelCount } = e.data;
          let r = 0, g = 0, b = 0;
          for (let i = 0; i < data.length; i += pixelCount) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
          }
          const totalPixels = pixelCount;
          const avgR = r / totalPixels;
          const avgG = g / totalPixels;
          const avgB = b / totalPixels;
          const hue = rgbToHue(avgR, avgG, avgB);
          self.postMessage({ hue: hue });
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
    } else {
      this.worker = null;
    }
  }

  getDominantHue(video) {
    try {
      this.ctx.drawImage(video, 0, 0, FrameAnalyzer.samplingWidth, FrameAnalyzer.samplingHeight);
      const imageData = this.ctx.getImageData(0, 0, FrameAnalyzer.samplingWidth, FrameAnalyzer.samplingHeight);
      
      // Create reduced data array using larger step size
      const reducedData = new Uint8Array(Math.ceil(imageData.data.length / (FrameAnalyzer.PIXEL_STEP * 4)) * 3);
      let reducedIndex = 0;
      for(let i = 0; i < imageData.data.length; i += FrameAnalyzer.PIXEL_STEP * 4) {
        reducedData[reducedIndex++] = imageData.data[i];
        reducedData[reducedIndex++] = imageData.data[i+1];
        reducedData[reducedIndex++] = imageData.data[i+2];
      }

      if (this.worker) {
        return new Promise((resolve) => {
          const handleMessage = (e) => { resolve(e.data.hue); };
          this.worker.addEventListener('message', handleMessage, { once: true });
          this.worker.postMessage({ 
            data: reducedData,  // Send typed array directly
            pixelCount: reducedData.length / 3
          }, [reducedData.buffer]); // Transfer ownership
        });
      } else {
        return this.calculateAverageHue(imageData.data);
      }
    } catch (error) {
      console.warn('Frame analysis error:', error);
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
    this.isLoading = false;
    
    this.controlsTimeout = null;
    this.controls = {
      progressContainer: document.querySelector('.progress-container'),
      progressBar: document.querySelector('.progress-bar'),
      bufferBar: document.querySelector('.buffer-bar'),
      notificationPopup: document.getElementById('gesturePopup'),
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
      arrowTimeout: null,
      bufferingTimeout: null,
      isBuffering: false,
      containerWidth: 0,
      containerLeft: 0
    };

    this.frameAnalyzer = new FrameAnalyzer();
    this.zoneHandler = new ZoneInteractionHandler(this);
    this.initializeUI();
    this.lastHueUpdate = 0;
    this.fullscreenUIHidden = false;
    this.lastBufferUpdate = 0;
    this.lastProgressUpdate = 0;

    // Add these DOM references
    this.notificationContainer = document.getElementById('notifications-container');
    this.interactionZones = document.getElementById('interactionZones');
    
    // Add these state properties
    this.currentHue = 0;
    this.bufferingState = {
      isBuffering: false,
      timeoutId: null
    };

    this.playPauseAnimation = document.getElementById('playPauseAnimation');
  }

  initializeUI() {
    this.createTimestampPopup();
    this.createProgressBackground();
    this.bindEvents();
    this.zoneHandler.initialize();
    this.initKeyBindings();
    this.initActivityMonitoring();
    this.initContainerDimensions();
  }

  initContainerDimensions() {
    const updateDimensions = () => {
      const rect = this.controls.progressContainer.getBoundingClientRect();
      this.state.containerWidth = rect.width;
      this.state.containerLeft = rect.left;
    };
    
    // Initial measurement
    updateDimensions();
    
    // Update on resize
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0].target === this.controls.progressContainer) {
        updateDimensions();
      }
    });
    resizeObserver.observe(this.controls.progressContainer);
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
    // Replace existing code with optimized version
    const wrapper = document.querySelector('.video-wrapper');
    const handler = this.handleUnifiedPointerEvent.bind(this);
    
    // Use passive listeners where possible
    wrapper.addEventListener('pointerdown', handler, { passive: true });
    wrapper.addEventListener('pointermove', throttle(handler, 32), { passive: true });
    wrapper.addEventListener('pointerup', handler, { passive: true });
    wrapper.addEventListener('pointercancel', handler, { passive: true });

    // Add pause/resume listeners
    this.video.addEventListener('play', () => this.startUpdates());
    this.video.addEventListener('pause', () => this.stopUpdates());
  }

  startUpdates() {
    if (!this.updateLoopActive) {
      this.updateLoopActive = true;
      const update = () => {
        if (this.updateLoopActive) {
          this.updateAll();
          requestAnimationFrame(update);
        }
      };
      requestAnimationFrame(update);
    }
  }

  stopUpdates() {
    this.updateLoopActive = false;
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

  updateAllUIColor() {
    const hue = this.currentHue;
    const elements = {
      progressBar: this.controls.progressBar,
      spinner: this.controls.spinner,
      timestampPopup: this.timestampPopup,
      progressBackground: this.progressBackground,
      playPauseAnimation: this.playPauseAnimation
    };

    // Common color properties
    const primaryColor = `hsl(${hue}, 70%, 50%)`;
    const secondaryColor = `hsla(${hue}, 70%, 35%, 0.8)`;
    const bgColor = `hsla(${hue}, 30%, 20%, 0.3)`;
    const textColor = `hsl(${hue}, 70%, 95%)`;

    // Batch update elements
    Object.entries(elements).forEach(([key, element]) => {
      if (!element) return;
      
      switch(key) {
        case 'progressBar':
          element.style.backgroundColor = primaryColor;
          break;
        case 'spinner':
          element.style.borderTopColor = primaryColor;
          break;
        case 'timestampPopup':
          element.style.backgroundColor = `hsla(${hue}, 70%, 50%, 0.2)`;
          element.style.border = `2px solid ${secondaryColor}`;
          element.style.color = textColor;
          break;
        case 'progressBackground':
          element.style.backgroundColor = bgColor;
          break;
        case 'playPauseAnimation':
          element.style.color = primaryColor;
          break;
      }
    });
  }

  updateTimestampPopupPreview(offsetX) {
    const popupText = formatTime(this.video.currentTime);
    const containerWidth = this.state.containerWidth;
    const popupWidth = this.timestampPopup.offsetWidth;
    
    // Calculate boundaries using cached dimensions
    const adjustedX = Math.max(popupWidth/2, Math.min(offsetX, containerWidth - popupWidth/2));
    
    this.timestampPopup.textContent = popupText;
    this.timestampPopup.style.left = `${adjustedX}px`;
    this.timestampPopup.style.opacity = '1';
    this.timestampPopup.style.display = 'block';
  }

  showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Notification icon
    const icon = document.createElement('div');
    icon.className = `notification-icon ${type}`;
    
    // Notification content
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    const messageElem = document.createElement('div');
    messageElem.className = 'notification-message';
    messageElem.textContent = message;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'notification-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });

    content.appendChild(messageElem);
    content.appendChild(timestamp);
    
    notification.appendChild(icon);
    notification.appendChild(content);
    container.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('visible');
    });

    // Auto-dismiss
    setTimeout(() => {
      notification.classList.add('exiting');
      setTimeout(() => notification.remove(), 300);
    }, duration);

    // Manual dismiss
    notification.addEventListener('click', () => {
      notification.classList.add('exiting');
      setTimeout(() => notification.remove(), 300);
    });
  }

  showGesturePopup(message, position, type = 'info') {
    this.showNotification(message, type);
  }

  showError(message) {
    this.showNotification(message, 'error', 5000);
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showWarning(message) {
    this.showNotification(message, 'warning', 4000);
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
        this.showGesturePopup("Next Video", positions.right, 'info');
      } else {
        loadPreviousVideo();
        this.showGesturePopup("Previous Video", positions.left, 'info');
      }
      this.state.multiTapState[direction] = 0;
    } else {
      // Set timeout for single tap action
      this.state.arrowTimeout = setTimeout(() => {
        const seconds = direction === 'right' ? 15 : -15;
        this.secsSeek(seconds);
        this.showGesturePopup(
          `${direction === 'right' ? 'Forward' : 'Rewind'} 15s`,
          positions[direction],
          'info'
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
      position,
      'info'
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
          this.showGesturePopup("Fullscreen", clickPos, 'info');
          this.fullscreenUIHidden = false;
          this.showControls(); // Show controls immediately when entering fullscreen
        }).catch(err => {
          console.error(`Error attempting fullscreen: ${err.message}`);
          this.showGesturePopup("Fullscreen", clickPos, 'error');
        });
      }
    } else {
      document.exitFullscreen().then(() => {
        this.showGesturePopup("Windowed", clickPos, 'info');
        this.fullscreenUIHidden = false;
        this.showControls(); // Ensure controls are visible when exiting
      }).catch(err => {
        console.error(`Error exiting fullscreen: ${err.message}`);
        this.showGesturePopup("Windowed", clickPos, 'error');
      });
    }
  }

  calculateSeekPosition(clientX) {
    const offsetX = clientX - this.state.containerLeft;
    const percent = Math.max(0, Math.min(offsetX, this.state.containerWidth)) / this.state.containerWidth;
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

  handleUnifiedPointerEvent(e) {
    const target = e.target;
    if (target.closest('.progress-container')) {
      if (e.type === 'pointerdown') {
        this.handlePointerDown(e);
      } else if (e.type === 'pointermove') {
        this.handlePointerMove(e);
      } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
        this.handlePointerUp(e);
      }
    } else if (target.closest('.timestamp-popup')) {
      if (e.type === 'pointerdown') {
        this.handlePopupDragStart(e);
      } else if (e.type === 'pointermove') {
        this.handlePopupDragMove(e);
      } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
        this.handlePopupDragEnd(e);
      }
    }
    // Additional unified handling for toggling fullscreen or other events can be added here if needed
  }

  handlePointerMove(e) {
    const position = this.calculateSeekPosition(e.clientX);
    this.updateTimestampPopupPreview(position.offsetX);
    if (this.state.isDragging) {
      this.video.currentTime = position.time;
      this.updatePlaybackProgress(this.video);
    }
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
    const animation = document.getElementById('playPauseAnimation');
    const isPaused = this.video.paused;

    // Always center the animation
    animation.classList.remove('play', 'pause');
    animation.classList.add(isPaused ? 'play' : 'pause');
    
    // Trigger animation
    animation.classList.add('visible');
    setTimeout(() => {
      animation.classList.remove('visible');
    }, 300);

    if (isPaused) {
      this.video.muted = false;
      this.video.play().catch(err => {
        console.error("Error playing video:", err);
      });
    } else {
      this.video.pause();
    }
  }

  updateAll() {
    if (this.video.paused) return;
    
    const now = Date.now();
    
    // Throttle buffer updates to 10fps
    if (now - this.lastBufferUpdate > 100) {
      this.updateBufferBar(this.video);
      this.lastBufferUpdate = now;
    }
    
    // Throttle progress updates to 15fps
    if (now - this.lastProgressUpdate > 66) {
      this.updatePlaybackProgress(this.video);
      this.lastProgressUpdate = now;
    }

    // Always update timestamp position if not dragging
    if (this.video.duration > 0 && !this.state.isDragging) {
      const percent = this.video.currentTime / this.video.duration;
      const offsetX = percent * this.state.containerWidth;
      this.updateTimestampPopupPreview(offsetX);
    }

    // Keep existing hue update throttling (200ms)
    if (Date.now() - this.lastHueUpdate >= 200) {
      if (!this.video.paused && this.video.readyState >= 2) {
        this.frameAnalyzer.getDominantHue(this.video).then((hue) => {
          this.currentHue = hue;
          this.updateAllUIColor();
        });
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
      // Update both progress bar and timestamp together
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

  updateSpinner() {
    // Use instance property for loading and internal state for buffering
    const loading = this.isLoading;
    const buffering = this.state.isBuffering;
    // Only show the spinner when video is ready enough (readyState>=2 ensures data is available)
    const shouldShowSpinner = (loading || buffering) && (this.video.readyState >= 2);
    
    this.controls.spinner.style.display = shouldShowSpinner ? "block" : "none";
    
    if (shouldShowSpinner) {
      // Only compute hue if video is ready; otherwise, fall back to a default hue
      if (this.video.readyState >= 2) {
        const currentHue = this.frameAnalyzer.getDominantHue(this.video);
        this.controls.spinner.style.borderTopColor = `hsl(${currentHue}, 70%, 50%)`;
      } else {
        this.controls.spinner.style.borderTopColor = 'hsl(0, 70%, 50%)';
      }
    }
  }

  handleBufferingStart() {
    if (!this.bufferingState.isBuffering) {
      this.bufferingState.isBuffering = true;
      this.updateSpinner();
      
      this.bufferingState.timeoutId = setTimeout(async () => {
        if (this.bufferingState.isBuffering) {
          await this.handleBufferTimeout();
        }
      }, 2000);
    }
  }

  async handleBufferTimeout() {
    try {
      const currentCid = videoSources[currentVideoIndex];
      const url = await loadVideoFromCid(currentCid);
      this.video.src = url;
      await this.video.play();
      this.showNotification(`Switched to ${getProviderFromUrl(url)}`, 'info', 2000);
    } catch (error) {
      console.error('Buffer recovery failed:', error);
      loadNextVideo();
    } finally {
      this.bufferingState.isBuffering = false;
      this.updateSpinner();
    }
  }

  handleBufferingEnd() {
    if (this.bufferingState.isBuffering) {
      this.bufferingState.isBuffering = false;
      clearTimeout(this.bufferingState.timeoutId);
      this.updateSpinner();
    }
  }

  updateAllVisuals() {
    if (this.video.paused) return;
    
    const now = Date.now();
    this.updateProgress();
    this.updateTimestamp();
    
    if (now - this.lastHueUpdate >= 200) {
      this.updateColorScheme();
      this.lastHueUpdate = now;
    }
  }

  updateColorScheme() {
    this.frameAnalyzer.getDominantHue(this.video).then(hue => {
      this.currentHue = hue;
      this.updateAllUIColor();
    });
  }

  // Move zone handling into UIController
  initZoneInteractions() {
    this.zoneHandler = new ZoneInteractionHandler(this);
    this.zoneHandler.initialize();
  }

  showFastSeekAnimation(direction, position) {
    const container = document.createElement('div');
    container.className = `fastseek-indicator ${direction}`;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', direction === 'right' ? 
      'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z' : 
      'M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z');
    
    svg.appendChild(path);
    container.appendChild(svg);
    document.body.appendChild(container);

    // Position near tap location
    container.style.left = `${position.x - 60}px`;
    container.style.top = `${position.y - 60}px`;

    // Animation
    container.classList.add('active');
    setTimeout(() => {
      container.remove();
    }, 500);
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
    if (controlsSystem) {
      controlsSystem.handleBufferingStart();
    }
  });

  video.addEventListener("playing", () => {
    if (controlsSystem) {
      controlsSystem.handleBufferingEnd();
    }
  });

  video.addEventListener("ended", () => {
    loadNextVideo();
  }, { passive: true });
}

// --- Update main() to instantiate ControlsSystem --- //
async function main() {
  registerVideoEventListeners();
  controlsSystem = new UIController(video);

  // Optimized animation frame loop
  function updateProgress() {
    if (!video.paused) {
      controlsSystem.updateAll();
      requestAnimationFrame(updateProgress);
    }
  }
  
  video.addEventListener('play', () => {
    requestAnimationFrame(updateProgress);
  });

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

/* Modified initHueEffects function */
function initHueEffects() {
  // Ensure video element exists before initializing effects
  const video = document.getElementById('videoPlayer');
  if (!video) return;

  let hue = 0;
  function updateHue() {
    hue = (hue + 1) % 360;
    document.documentElement.style.setProperty('--main-hue', hue);
  }

  // Attach noncritical event listeners only after video starts playing
  video.addEventListener('playing', function attachHueListeners() {
    document.addEventListener('click', updateHue);
    document.addEventListener('scroll', updateHue);
    // Remove this listener since it's no longer needed
    video.removeEventListener('playing', attachHueListeners);
  }, { once: true });
}

// Update the DOMContentLoaded event listener at the end of the file
document.addEventListener('DOMContentLoaded', function() {
  const video = document.getElementById('videoPlayer');
  if (video) {
    // Initialize hue effects after video is confirmed available
    initHueEffects();
    if (video.readyState < 1) { // video not loaded yet
      let loadTimeout = setTimeout(() => {
        if (video.readyState < 1) {
          playNextVideo();
        }
      }, 4000);
      
      video.addEventListener('loadeddata', () => {
        clearTimeout(loadTimeout);
        preloadNextVideo();
      }, { once: true });
    } else {
      // If video is already loaded, immediately start preloading next video
      preloadNextVideo();
    }
  }
});

// Modified updateDisplay function with safety checks
function updateDisplay() {
  // Only update if video has valid duration and is playing
  if (video.duration > 0 && !video.paused) {
    const progress = (video.currentTime / video.duration) * 100;
    controlsSystem.controls.progressBar.style.width = progress + '%';
    controlsSystem.timestampPopup.textContent = formatTime(video.currentTime);
    requestAnimationFrame(updateDisplay);
  }
}

// Updated playAudio function with proper loop handling
function playAudio() {
  video.play().then(() => {
    // Only start the loop if playback succeeded
    if (!video.paused) {
      updateDisplay();
    }
  }).catch(error => {
    console.error('Playback failed:', error);
  });
}

// Add this helper function near other utility functions
function getProviderFromUrl(url) {
  const subdomainMatch = url.match(/https?:\/\/(.+)\.ipfs\.([^\/]+)/);
  if (subdomainMatch) return subdomainMatch[2];
  
  const pathMatch = url.match(/https?:\/\/ipfs\.([^\/]+)\/ipfs\/.+$/);
  if (pathMatch) return pathMatch[1];
  
  return 'unknown';
}

// Add playNextVideo function definition (~line 1300)
function playNextVideo() {
  videoController.loadVideoByDirection(1);
}

// Update preloadNextVideo to set on controller (~line 1316)
videoController.preloadNextVideo = preloadNextVideo;

// Update DOMContentLoaded handler (~line 1368)
document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  if (video.readyState < 1) {
    let loadTimeout = setTimeout(() => {
      if (video.readyState < 1) {
        playNextVideo(); // Now properly defined
      }
    }, 4000);
    // ... rest of handler ...
  }
});
