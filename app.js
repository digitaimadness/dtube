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
 * Updates the video buffering indicator.
 */
function updateVideoBufferingImpl() {
  const bufferBar = document.querySelector('.buffer-bar');
  // If video duration isn't available, show an empty buffer bar.
  if (!video.duration) {
    if (bufferBar) {
      bufferBar.style.width = "0%";
      // Set darker background color with 50% transparency
      bufferBar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    }
    return;
  }
  let bufferedPercentage = 0;
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    bufferedPercentage = (bufferedEnd / video.duration) * 100;
  }
  if (bufferBar) {
    bufferBar.style.width = bufferedPercentage + '%';
    // Set darker background color with 50% transparency
    bufferBar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
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

/**
 * Updates the progress bar color based on the overall hue of the video.
 */
function updateProgressBarColor() {
  if (video.paused || video.readyState < 2) return;
  try {
    offscreenCtx.drawImage(video, 0, 0, samplingWidth, samplingHeight);
    const imageData = offscreenCtx.getImageData(0, 0, samplingWidth, samplingHeight);
    const data = imageData.data;
    let r = 0, g = 0, b = 0;
    const count = samplingWidth * samplingHeight;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r /= count;
    g /= count;
    b /= count;
    const hue = rgbToHue(r, g, b);
    if (progressFilledElem) {
      // Adjust saturation/lightness as needed; here we use 70% saturation and 50% lightness.
      progressFilledElem.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
    }
  } catch (error) {
    console.warn("Error updating progress bar color:", error);
  }
}

/**
 * Throttles video buffering updates to limit DOM redraws.
 */
function updateVideoBuffering() {
  if (!bufferingUpdateScheduled) {
    bufferingUpdateScheduled = true;
    requestAnimationFrame(() => {
      updateVideoBufferingImpl();
      bufferingUpdateScheduled = false;
    });
  }
}

/**
 * Registers video-specific event listeners.
 */
function registerVideoEventListeners() {
  // Buffering and progress updates.
  video.addEventListener("progress", updateVideoBuffering, { passive: true });
  video.addEventListener("loadedmetadata", updateVideoBuffering, { passive: true });
  video.addEventListener("timeupdate", () => {
    updateVideoBuffering();
    updateProgressBarColor(); // update progress bar color based on current frame
    updatePlaybackProgress();
  }, { passive: true });

  // Video error handling.
  video.addEventListener("error", e => {
    console.error("Video encountered an error:", e);
  });

  // Load the next video when the current one ends.
  video.addEventListener("ended", () => {
    console.log("Video ended; loading next video.");
    loadNextVideo();
  });
}

/**
 * Registers progress bar interactions for clickable and draggable seek functionality.
 */
function registerProgressBarInteractions() {
  const progressContainer = document.querySelector('.progress-container');
  if (!progressContainer) return;
  
  // Create tooltip for timestamp display
  let timestampPopup = document.createElement('div');
  timestampPopup.className = 'timestamp-popup';
  progressContainer.appendChild(timestampPopup);
  
  let isDragging = false;
  
  // Helper function: update popup preview (does not change video.currentTime)
  function updateTimestampPopupPreview(clientX) {
    const rect = progressContainer.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const percent = offsetX / rect.width;
    if (video.duration) {
      timestampPopup.textContent = formatTime(percent * video.duration);
    } else {
      timestampPopup.textContent = "0:00";
    }
    timestampPopup.style.left = offsetX + 'px';
    // For debugging, force it visible (later you can comment this out)
    timestampPopup.style.display = 'block';
  }
  
  // When dragging, update video time and popup
  const seek = (clientX) => {
    const rect = progressContainer.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const percent = offsetX / rect.width;
    if (video.duration) {
      video.currentTime = percent * video.duration;
      updatePlaybackProgress();
    }
    // Also update the popup (for dragging)
    updateTimestampPopupPreview(clientX);
  };
  
  // When pointer enters, update popup preview and display it
  progressContainer.addEventListener('pointerenter', (e) => {
    console.log("pointerenter", e);
    updateTimestampPopupPreview(e.clientX);
    timestampPopup.style.display = 'block';
  });
  
  // Pointer move: always update the preview; if dragging, update playback as well
  progressContainer.addEventListener('pointermove', (e) => {
    console.log("pointermove", e);
    updateTimestampPopupPreview(e.clientX);
    if (isDragging) {
      seek(e.clientX);
    }
  });
  
  // On pointer down, begin dragging: update playback and show popup
  progressContainer.addEventListener('pointerdown', (e) => {
    console.log("pointerdown", e);
    isDragging = true;
    progressContainer.classList.add("active");
    progressContainer.setPointerCapture(e.pointerId);
    seek(e.clientX);
    timestampPopup.style.display = 'block';
  });
  
  // When pointer leaves or pointer is up/canceled, hide the popup and stop dragging
  progressContainer.addEventListener('pointerup', (e) => {
    console.log("pointerup", e);
    if (isDragging) {
      seek(e.clientX);
      isDragging = false;
      progressContainer.classList.remove("active");
      progressContainer.releasePointerCapture(e.pointerId);
      timestampPopup.style.display = 'none';
    }
  });
  
  progressContainer.addEventListener('pointercancel', (e) => {
    console.log("pointercancel", e);
    isDragging = false;
    progressContainer.classList.remove("active");
    progressContainer.releasePointerCapture(e.pointerId);
    timestampPopup.style.display = 'none';
  });
  
  progressContainer.addEventListener('pointerleave', (e) => {
    console.log("pointerleave", e);
    timestampPopup.style.display = 'none';
  });
}

/**
 * Main initialization function.
 */
async function main() {
  registerVideoEventListeners();
  registerProgressBarInteractions();

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

// Remove simulation code. Instead update playback progress based on actual video data.

/**
 * Updates the playback progress bar based on current time.
 */
function updatePlaybackProgress() {
  if (!video.duration) return;
  const percent = (video.currentTime / video.duration) * 100;
  if (progressFilledElem) {
    progressFilledElem.style.width = percent + '%';
  }
}

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

// Left zone: single click toggles play/pause, double-click seeks backward, triple-click loads previous video.
(function() {
  let clickCount = 0;
  let clickTimeout;
  leftZone.addEventListener('click', (e) => {
    clickCount++;
    clearTimeout(clickTimeout);
    clickTimeout = setTimeout(() => {
      if (clickCount === 1) {
        console.log("Left zone single-click: Toggle play/pause");
        togglePlayPause();
      } else if (clickCount === 2) {
        console.log("Left zone double-click: Seek video 15s backward");
        zoneSeekVideo(-15);
        showGesturePopup("Rewind 15s");
      } else if (clickCount === 3) {
        console.log("Left zone triple-click: Load previous video");
        loadPreviousVideo();
        showGesturePopup("Previous Video");
      }
      clickCount = 0;
    }, 250);
  });
})();

// Right zone: single click toggles play/pause, double-click seeks forward, triple-click loads next video.
(function() {
  let clickCount = 0;
  let clickTimeout;
  rightZone.addEventListener('click', (e) => {
    clickCount++;
    clearTimeout(clickTimeout);
    clickTimeout = setTimeout(() => {
      if (clickCount === 1) {
        console.log("Right zone single-click: Toggle play/pause");
        togglePlayPause();
      } else if (clickCount === 2) {
        console.log("Right zone double-click: Seek video 15s forward");
        zoneSeekVideo(15);
        showGesturePopup("Forward 15s");
      } else if (clickCount === 3) {
        console.log("Right zone triple-click: Load next video");
        loadNextVideo();
        showGesturePopup("Next Video");
      }
      clickCount = 0;
    }, 250);
  });
})();

// Center zone: single click toggles play/pause, double-click toggles fullscreen.
(function() {
  let clickCount = 0;
  let clickTimeout;
  centerZone.addEventListener('click', (e) => {
    clickCount++;
    clearTimeout(clickTimeout);
    clickTimeout = setTimeout(() => {
      if (clickCount === 1) {
        console.log("Center zone single-click: Toggle play/pause");
        togglePlayPause();
      } else if (clickCount === 2) {
        console.log("Center zone double-click: Toggle fullscreen");
        toggleFullscreen();
      }
      clickCount = 0;
    }, 250);
  });
})();

// Helper function to toggle play/pause of the video.
function togglePlayPause() {
  if (video.paused) {
    video.play().then(() => {
      showGesturePopup("Play");
    }).catch(err => {
      console.error("Error playing video:", err);
    });
  } else {
    video.pause();
    showGesturePopup("Pause");
  }
}

// Helper function to show gesture popup messages.
function showGesturePopup(message) {
  const gesturePopup = document.getElementById("gesturePopup");
  if (!gesturePopup) return;
  gesturePopup.textContent = message;
  gesturePopup.classList.remove("active");
  // Force reflow to allow re-animation if needed.
  void gesturePopup.offsetWidth;
  gesturePopup.classList.add("active");
}

// Add event listener to handle spacebar press for Play/Pause
document.addEventListener('keydown', (e) => {
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault(); // Prevent scrolling when space is pressed
    togglePlayPause();
  }
});

// Add event listener to handle F key press for toggling fullscreen
document.addEventListener('keydown', (e) => {
  if (e.code === "KeyF" && !e.repeat) {
    e.preventDefault(); // Prevent default behavior
    toggleFullscreen();
  }
});

// Modify right arrow key handling to support multi-tap: single press seeks forward; double press loads next video.
let rightArrowCount = 0;
let rightArrowTimeout;
document.addEventListener('keydown', (e) => {
  if (e.code === "ArrowRight" && !e.repeat) {
    e.preventDefault();
    rightArrowCount++;
    clearTimeout(rightArrowTimeout);
    rightArrowTimeout = setTimeout(() => {
      if (rightArrowCount === 1) {
        // Single press: seek forward 15s.
        zoneSeekVideo(15);
        showGesturePopup("Forward 15s");
      } else if (rightArrowCount === 2) {
        // Double press: load next video.
        loadNextVideo();
        showGesturePopup("Next Video");
      }
      rightArrowCount = 0;
    }, 250);
  }
});

// Modify left arrow key handling to support multi-tap: single press seeks backward; double press loads previous video.
let leftArrowCount = 0;
let leftArrowTimeout;
document.addEventListener('keydown', (e) => {
  if (e.code === "ArrowLeft" && !e.repeat) {
    e.preventDefault();
    leftArrowCount++;
    clearTimeout(leftArrowTimeout);
    leftArrowTimeout = setTimeout(() => {
      if (leftArrowCount === 1) {
        // Single press: seek backward 15s.
        zoneSeekVideo(-15);
        showGesturePopup("Rewind 15s");
      } else if (leftArrowCount === 2) {
        // Double press: load previous video.
        loadPreviousVideo();
        showGesturePopup("Previous Video");
      }
      leftArrowCount = 0;
    }, 250);
  }
});

// Add event listener to handle up arrow key press for increasing volume
document.addEventListener('keydown', (e) => {
  if (e.code === "ArrowUp" && !e.repeat) {
    e.preventDefault();
    // Increase volume by 0.1 and clamp the value to 1.
    video.volume = Math.min(video.volume + 0.1, 1);
    if (video.volume === 1) {
      showGesturePopup("Volume Max");
    } else {
      showGesturePopup("Volume +");
    }
  }
});

// Add event listener to handle down arrow key press for decreasing volume
document.addEventListener('keydown', (e) => {
  if (e.code === "ArrowDown" && !e.repeat) {
    e.preventDefault();
    // Decrease volume by 0.1 and clamp the value to 0.
    video.volume = Math.max(video.volume - 0.1, 0);
    if (video.volume === 0) {
      showGesturePopup("Volume Min");
    } else {
      showGesturePopup("Volume -");
    }
  }
});

// Helper function to toggle fullscreen mode and display a popup.
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    video.requestFullscreen().then(() => {
      showGesturePopup("Fullscreen");
    }).catch(err => {
      console.error(`Error attempting fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
    showGesturePopup("Windowed");
  }
}
