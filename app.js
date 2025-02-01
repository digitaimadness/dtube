// Refactored and cleaned app.js

// --- Global Constants and Variables --- //
const PROVIDERS = [
  "io",
  "algonode.xyz",
  "eth.aragon.network",
  "dweb.link",
  "flk-ipfs.xyz",
];

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
let bufferingUpdateScheduled = false;

// Cache references to spinner and progress bar elements
const spinner = document.getElementById("spinner");
const progressFilledElem = document.querySelector('.progress-bar');

// Shuffle the video sources to randomize the order.
const videoSources = shuffleArray([
  "bafybeigtfhi5ws6lrveafsnwsryzwundiqal3iiwpo3ytmoxgv5hsp7mou",
  "bafybeic7y4a4334bvkj4qjzx7gjodlkca33kfycvr7esicm23efroidgfu",
  "bafybeidcjv6gk54s77rnocd3evbxdm26p2cyolhihpqxp366oj2ztaeltq",
  "bafybeicprruiaudtfmg4kg2zcr45776x5da77zv73owooppw3o2ctfdt5e",
  "bafybeidl2t566mip6tsmx2lbfxiydbvcdglq5qnkpdvrkje2uqxyf6rjom",
  "bafybeibvmhfd4mnnyqv2zf3l22wndpzrgoficslxxtktmhdpbtzq72wm3u",
  "bafybeicqxewkc5btmz44bdc6spe3s4yrfpjzuhbga2y6vydnsib4z3lsgq",
  "bafybeiboxgm6xlz5arh6lhzbpowc6gtscshrwsnj6dkrffzuqpk7n3an4q",
  "bafybeieadukgtpiyyo46xje34hmd3k4nyqphihi3uuvntrkvjjliqbixze",
  "bafybeicwq3gxtay7xgc7dxfd3oda5o6ypebyrrav5sm7w4blqt5pdl4fbi",
  "bafybeidcpcb3ksqsomth3dyumfa6umdhye7cre75sn6jl2fyba5tymapl4",
  "bafybeichqv6feek6txormpcxenwnsnv3gswohyp3zc4zlrnyxg5bavnmim",
  "bafybeigm5vud4d6jvsma2kgcgw3phjoimvrwdyisjoxezh4qj7kff2vf24",
  "bafybeid6hz6f3yokuzo3cdotvck4d43avol3pfw3wccx6bzprpch5hvvwu",
  "bafybeidkpopiwmpxkilx4llay354dpqdndqzv7pzc6oyffziolskdfftfm",
  "bafybeifrh25cck2yue5yeesdzqlfh3p7mz7e7vkvfini5vdjtjosq7epxi",
  "bafybeigqvv5fjoi2jpyvhpxzqcuadd2fpqio56sukmcckig6di2tg7rv7q",
  "bafybeifkoazphnc4fzeaf6b6wnhbvuscsbvj54tn5h565alhm2mjdtedii",
  "bafybeicqw4jgftp3rnmke2ixvb3auukeaauymj6y3g4b552sxvvf6adygm",
  "bafybeie2y67hpmxoxpxkdez3veezjj6rchn4vi5ckoy7ngysn34w3h34w4",
  "bafybeiczqttpr664lwktlcmrzvwr6oeemwn5howixjxynkorapjw7t7jze",
  "bafybeidcddfku264l3gqb4sdi3qwyrbrwulzg5qpbpvfpslbkyqwl5p2yy",
  "bafybeihiwcl42ukgcn3e3pszu46da2fbnn2xatyjqofyyeahfgu362wysq",
  "bafybeia7kqdwptsbetoj4gy5a73lohyuokudurijzmarq247uzveiegenu",
  "bafybeigdpqir5ehfqyuhmctcwkxoqchhbbrrgp6aj76pb3y7b2ot4mm4dq",
  "bafybeihb27cory76wmbm3n5gwuu2yiluyuuhpomot54gsfdszewix7eycm",
  "bafybeibob3v7y7aiuzksield65oybwtvhraorte34i5hqknmkdoxv4klae",
  "bafybeigdqsp2qfsf7cmhqjw72qt4wjrhr5irp637wyeiyd3jp75uyeq6ey",
  "bafybeihjurlpa2ztfy7cia6fxr7cj225rojhxapuj2rtvkruot7skabymy",
  "bafybeidcs2frwxv2h2wpv526iibe3vlbm2wo7fvjzqpm5o3oq32hkqlwte",
  "bafybeid4yjs2hx7gjgottu4gktznbbwgqixa7yve7epdrqxro6g7qig2gm",
  "bafybeihsi46l5f7pfqgrj4ldmm6nqjjfmx4ryg4pq6ornzibsgscpqtjau",
  "bafybeickclgl4lf2rc226ah4ltnweobtvzhhndl6y5lte2ibvcukwdigfm",
  "bafybeiauuuk26dbi6hp3grb7xinajiwbwrlxhxh6pgg76bygewfiix7gka",
  "bafybeigcltvclgdajfbrjps2e5fuidwaepkfoaj2zze4emxqc7q4k5xjq4",
  "bafybeiavkrub4h54vpnpqzgnakg4g3zxgfo6x4iadbdn5ul3mqu6pb3dfq",
]);

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
    spinner.style.display = "block";
    video.pause();
    currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
    const cid = videoSources[currentVideoIndex];
    console.log("Attempting to load video with CID:", cid);

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
    console.error("Error loading video:", error);
  } finally {
    isLoading = false;
    spinner.style.display = "none";
  }
}

/**
 * Loads the previous video using provider retry logic.
 */
async function loadPreviousVideo() {
  if (isLoading || !videoSources.length) return;
  try {
    isLoading = true;
    spinner.style.display = "block";
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
    spinner.style.display = "none";
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
  constructor(controlsSystem) {
    this.controls = controlsSystem;
    this.MULTI_TAP_DELAY = 200;
  }

  initialize() {
    this.setupZone(this.controls.leftZone, this.handleLeftZoneClick.bind(this));
    this.setupZone(this.controls.rightZone, this.handleRightZoneClick.bind(this));
    this.setupZone(this.controls.centerZone, this.handleCenterZoneClick.bind(this));
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
        this.controls.togglePlayPause(clickPos); 
        break;
      case 2: 
        this.controls.secsSeek(-15, clickPos);
        this.controls.showGesturePopup("Rewind 15s", clickPos);
        break;
      case 3: 
        loadPreviousVideo();
        this.controls.showGesturePopup("Previous Video", clickPos);
        break;
    }
  }

  handleRightZoneClick(clickPos, count) {
    switch(count) {
      case 1: 
        this.controls.togglePlayPause(clickPos); 
        break;
      case 2: 
        this.controls.secsSeek(15, clickPos);
        this.controls.showGesturePopup("Forward 15s", clickPos);
        break;
      case 3:
        loadNextVideo();
        this.controls.showGesturePopup("Next Video", clickPos);
        break;
    }
  }

  handleCenterZoneClick(clickPos, count) {
    switch(count) {
      case 1: this.controls.togglePlayPause(clickPos); break;
      case 2: this.controls.toggleFullscreen(clickPos); break;
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

// --- Controls System Optimizations --- //
class ControlsSystem {
  constructor(video) {
    this.video = video;
    this.progressContainer = document.querySelector('.progress-container');
    this.progressBar = document.querySelector('.progress-bar');
    this.bufferBar = document.querySelector('.buffer-bar');
    // Create a timestamp popup element and add it to the progress container
    this.timestampPopup = document.createElement('div');
    this.timestampPopup.className = 'timestamp-popup';
    this.progressContainer.appendChild(this.timestampPopup);
    // Cache the gesture popup element (defined in index.html)
    this.gesturePopup = document.getElementById('gesturePopup');
    // Cache the interaction zones
    this.leftZone = document.querySelector('.zone.left-zone');
    this.centerZone = document.querySelector('.zone.center-zone');
    this.rightZone = document.querySelector('.zone.right-zone');
    this.isDragging = false;
    this.zoneHandler = new ZoneInteractionHandler(this);
    this.frameAnalyzer = new FrameAnalyzer();
    this.initInteractions();
    this.initZoneInteractions();
    this.initKeyBindings();
    this.lastHueUpdate = 0;
    this.HUE_UPDATE_INTERVAL = 500; // Update hue every 500ms
    this.multiTapState = {};
    this.arrowTimeout = null;
  }
  
  initInteractions() {
    this.progressContainer.addEventListener('pointerenter', (e) => {
      this.updateTimestampPopupPreview(e.clientX);
      this.timestampPopup.style.display = 'block';
    });
    this.progressContainer.addEventListener('pointermove', (e) => {
      this.updateTimestampPopupPreview(e.clientX);
      if (this.isDragging) {
        this.seek(e.clientX);
      }
    });
    this.progressContainer.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.progressContainer.classList.add("active");
      this.progressContainer.setPointerCapture(e.pointerId);
      this.seek(e.clientX);
      this.timestampPopup.style.display = 'block';
    });
    const pointerUpCancel = (e) => {
      if (this.isDragging) {
        this.seek(e.clientX);
        this.isDragging = false;
        this.progressContainer.classList.remove("active");
        this.progressContainer.releasePointerCapture(e.pointerId);
        this.timestampPopup.style.display = 'none';
      }
    };
    this.progressContainer.addEventListener('pointerup', pointerUpCancel);
    this.progressContainer.addEventListener('pointercancel', pointerUpCancel);
    this.progressContainer.addEventListener('pointerleave', (e) => {
      this.timestampPopup.style.display = 'none';
    });
  }
  
  initZoneInteractions() {
    this.zoneHandler.initialize();
  }
  
  // Helper: Adjust playback position by seconds.
  secsSeek(seconds) {
    this.video.currentTime = Math.max(0, this.video.currentTime + seconds);
  }
  
  // Helper: Toggle play/pause of the video.
  togglePlayPause(clickPos) {
    // If no click position is provided (e.g. from keypress), default to the viewport center.
    if (!clickPos) {
      clickPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    if (this.video.paused) {
      this.video.play().then(() => {
        this.showGesturePopup("Play", clickPos);
      }).catch(err => {
        console.error("Error playing video:", err);
        // In case of an error, still display the popup.
        this.showGesturePopup("Play", clickPos);
      });
    } else {
      this.video.pause();
      this.showGesturePopup("Pause", clickPos);
    }
  }
  
  // Helper: Show a gesture popup with a message.
  // This method applies the same out-of-bound handling for popups whether the gesture originates
  // from a tap or a keyboard event. If the desired position would place the popup outside the viewport,
  // the position is averaged with the viewport center.
  showGesturePopup(message, clickPos) {
    const gp = this.gesturePopup;
    if (!gp) return;

    if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
    }

    // Reset to initial state with scale 0
    gp.style.display = 'flex';
    gp.style.opacity = '0';
    gp.style.transform = 'translate(-50%, -50%) scale(0)';
    
    gp.offsetHeight; // Trigger reflow

    gp.textContent = message;

    const posX = clickPos?.x ?? window.innerWidth/2;
    const posY = clickPos?.y ?? window.innerHeight/2;

    gp.style.left = `${posX}px`;
    gp.style.top = `${posY}px`;

    requestAnimationFrame(() => {
        // Animate in with scale up
        gp.style.opacity = '1';
        gp.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    this.hideTimeout = setTimeout(() => {
        // Animate out with scale down
        gp.style.opacity = '0';
        gp.style.transform = 'translate(-50%, -50%) scale(0)';
        this.hideTimeout = setTimeout(() => {
            gp.style.display = 'none';
            this.hideTimeout = null;
        }, 300); // Match transition duration
    }, 1000);
  }
  
  updateBufferBar() {
    if (!this.video.duration) {
      if (this.bufferBar) {
        this.bufferBar.style.width = "0%";
        this.bufferBar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      }
      return;
    }
    let bufferedPercentage = 0;
    if (this.video.buffered.length > 0) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      bufferedPercentage = (bufferedEnd / this.video.duration) * 100;
    }
    if (this.bufferBar) {
      this.bufferBar.style.width = bufferedPercentage + '%';
      this.bufferBar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    }
  }
  
  updatePlaybackProgress() {
    if (!this.video.duration) return;
    const percent = (this.video.currentTime / this.video.duration) * 100;
    if (this.progressBar) {
      this.progressBar.style.width = percent + '%';
    }
  }
  
  updateProgressBarColor() {
    if (this.video.paused || this.video.readyState < 2) return;
    const hue = this.frameAnalyzer.getDominantHue(this.video);
    this.progressBar.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
  }
  
  updateTimestampPopupPreview(clientX) {
    const rect = this.progressContainer.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const percent = offsetX / rect.width;
    
    if (this.video.duration) {
      this.timestampPopup.textContent = formatTime(percent * this.video.duration);
    } else {
      this.timestampPopup.textContent = "0:00";
    }
    
    // Apply boundary constraints
    const popupWidth = this.timestampPopup.offsetWidth;
    const maxLeft = rect.width - popupWidth;
    offsetX = Math.max(0, Math.min(offsetX - popupWidth/2, maxLeft));
    
    this.timestampPopup.style.left = `${offsetX}px`;
    this.timestampPopup.style.display = 'block';
  }
  
  seek(clientX) {
    const rect = this.progressContainer.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const percent = offsetX / rect.width;
    if (this.video.duration) {
      this.video.currentTime = percent * this.video.duration;
    }
    this.updatePlaybackProgress();
  }
  
  updateAll() {
    this.updateBufferBar();
    this.updatePlaybackProgress();
    
    // Throttle hue updates
    const now = Date.now();
    if (now - this.lastHueUpdate >= this.HUE_UPDATE_INTERVAL) {
      this.updateProgressBarColor();
      this.lastHueUpdate = now;
    }
  }

  // --- New: Keypress Gestures ---
  initKeyBindings() {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

  handleKeyPress(e) {
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
    if (this.arrowTimeout) {
      clearTimeout(this.arrowTimeout);
      this.arrowTimeout = null;
    }

    // Increment tap count
    const tapCount = (this.multiTapState?.[direction] || 0) + 1;
    this.multiTapState = { ...this.multiTapState, [direction]: tapCount };

    if (tapCount === 2) {
      // Handle double tap
      if (direction === 'right') {
        loadNextVideo();
        this.showGesturePopup("Next Video", positions.right);
      } else {
        loadPreviousVideo();
        this.showGesturePopup("Previous Video", positions.left);
      }
      this.multiTapState[direction] = 0;
    } else {
      // Set timeout for single tap action
      this.arrowTimeout = setTimeout(() => {
        const seconds = direction === 'right' ? 15 : -15;
        this.secsSeek(seconds);
        this.showGesturePopup(
          `${direction === 'right' ? 'Forward' : 'Rewind'} 15s`,
          positions[direction]
        );
        this.multiTapState[direction] = 0;
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

  // Helper: Toggle fullscreen mode.
  toggleFullscreen(clickPos) {
    // If no click position is provided (e.g. from keypress), default to the viewport center.
    if (!clickPos) {
      clickPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const wrapper = document.querySelector('.video-wrapper');
    if (!document.fullscreenElement) {
      if (wrapper) {
        wrapper.requestFullscreen().then(() => {
          this.showGesturePopup("Fullscreen", clickPos);
        }).catch(err => {
          console.error(`Error attempting fullscreen: ${err.message}`);
          this.showGesturePopup("Fullscreen", clickPos);
        });
      } else {
        console.error("Video wrapper not found.");
      }
    } else {
      document.exitFullscreen().then(() => {
        this.showGesturePopup("Windowed", clickPos);
      }).catch(err => {
        console.error(`Error exiting fullscreen: ${err.message}`);
        this.showGesturePopup("Windowed", clickPos);
      });
    }
  }
}

// --- Update registerVideoEventListeners ---
function registerVideoEventListeners() {
  // Buffering and additional video events.
  video.addEventListener("progress", () => {
    // Buffer bar updates will be handled by the ControlsSystem instance.
    controlsSystem && controlsSystem.updateBufferBar();
  }, { passive: true });
  video.addEventListener("loadedmetadata", () => {
    controlsSystem && controlsSystem.updateBufferBar();
  }, { passive: true });
  // Note: timeupdate events will be handled below after instantiating the ControlsSystem.
}

// --- Update main() to instantiate ControlsSystem --- //
async function main() {
  registerVideoEventListeners();
  // Instantiate the unified controls system.
  const controlsSystem = new ControlsSystem(video);

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
