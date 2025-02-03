/*
 * uiController.js
 * This module encapsulates UI control logic separately from video logic.
 * It provides centralized UI updates, queued UI actions (if needed), and proper event handling for progress, popups, gestures, and fullscreen toggling.
 */

// Utility functions
function throttle(func, limit) {
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
        lastCall = Date.now();
      }, remaining);
    }
  };
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return minutes + ':' + (secs < 10 ? '0' : '') + secs;
}

class UIController {
  constructor(videoElement, uiElements) {
    // uiElements should be an object containing references to key DOM elements:
    // progressContainer, progressBar, bufferBar, notificationPopup, leftZone, centerZone, rightZone, spinner.
    this.video = videoElement;
    this.ui = uiElements;
    this.isDragging = false;
    this.controlsVisible = true;
    this.fullscreenUIHidden = false;
    this.controlsTimeout = null;
    this.uiUpdateActive = false;
    this.timestampPopup = null;

    this.initUI();
  }

  initUI() {
    this.createTimestampPopup();
    this.createProgressBackground();
    this.bindEvents();
    this.initKeyBindings();
    this.initActivityMonitoring();
  }

  createTimestampPopup() {
    const popup = document.createElement('div');
    popup.className = 'timestamp-popup';
    popup.style.cssText = `
      cursor: grab;
      display: none;
      position: absolute;
      bottom: 20px;
      transform: translateX(-50%);
      transition: left 0.05s linear, opacity 0.3s ease;
    `;
    this.ui.progressContainer.appendChild(popup);
    this.timestampPopup = popup;
  }

  createProgressBackground() {
    const bg = document.createElement('div');
    bg.className = 'progress-background';
    this.ui.progressContainer.insertBefore(bg, this.ui.progressBar);
    this.progressBackground = bg;
    bg.style.transition = 'background-color 0.5s ease';
  }

  bindEvents() {
    const wrapper = document.querySelector('.video-wrapper');
    const handler = this.handleUnifiedPointerEvent.bind(this);
    wrapper.addEventListener('pointerdown', handler, { passive: true });
    wrapper.addEventListener('pointermove', throttle(handler, 32), { passive: true });
    wrapper.addEventListener('pointerup', handler, { passive: true });
    wrapper.addEventListener('pointercancel', handler, { passive: true });

    // Listen for play/pause events to start/stop UI update loop
    this.video.addEventListener('play', () => this.startUIUpdates());
    this.video.addEventListener('pause', () => this.stopUIUpdates());
  }

  initKeyBindings() {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

  handleKeyPress(e) {
    this.resetControlsTimeout();
    if (e.repeat) return;

    switch(e.code) {
      case 'Space':
        this.togglePlayPause();
        break;
      case 'KeyF':
        this.toggleFullscreen();
        break;
      case 'ArrowRight':
        this.seekForward();
        break;
      case 'ArrowLeft':
        this.seekBackward();
        break;
      default:
        break;
    }
  }

  initActivityMonitoring() {
    const activityEvents = ['mousemove', 'click', 'touchstart', 'keydown'];
    activityEvents.forEach(eventName => {
      document.addEventListener(eventName, () => {
        this.showControls();
        this.resetControlsTimeout();
      }, { passive: true });
    });
  }

  resetControlsTimeout() {
    clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      this.hideControls();
    }, 3000);
  }

  showControls() {
    if (this.controlsVisible && !this.fullscreenUIHidden) return;
    this.controlsVisible = true;
    this.ui.progressContainer.style.opacity = '1';
    if (this.timestampPopup) {
      this.timestampPopup.style.opacity = '1';
    }
  }

  hideControls() {
    if (!this.controlsVisible || !document.fullscreenElement) return;
    this.controlsVisible = false;
    this.fullscreenUIHidden = true;
    this.ui.progressContainer.style.opacity = '0';
    if (this.timestampPopup) {
      this.timestampPopup.style.opacity = '0';
    }
  }

  startUIUpdates() {
    if (!this.uiUpdateActive) {
      this.uiUpdateActive = true;
      const update = () => {
        if (this.uiUpdateActive) {
          this.updateUI();
          requestAnimationFrame(update);
        }
      };
      requestAnimationFrame(update);
    }
  }

  stopUIUpdates() {
    this.uiUpdateActive = false;
  }

  updateUI() {
    // Update progress bar
    if (this.video.duration) {
      const percent = (this.video.currentTime / this.video.duration) * 100;
      this.ui.progressBar.style.width = percent + '%';
    }
    // Update buffer bar
    if (this.video.buffered.length) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      const bufferedPercent = (bufferedEnd / this.video.duration) * 100;
      this.ui.bufferBar.style.width = bufferedPercent + '%';
    }
    // Additional UI updates (like spinner or hue effects) can be applied here
  }

  togglePlayPause() {
    this.resetControlsTimeout();
    if (this.video.paused) {
      this.video.play().then(() => this.showToast('Play')).catch(err => this.showToast('Play Error'));
    } else {
      this.video.pause();
      this.showToast('Pause');
    }
  }

  toggleFullscreen() {
    this.resetControlsTimeout();
    const wrapper = document.querySelector('.video-wrapper');
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => {
        this.showToast('Fullscreen');
        this.fullscreenUIHidden = false;
        this.showControls();
      }).catch(err => this.showToast('Fullscreen Error'));
    } else {
      document.exitFullscreen().then(() => {
        this.showToast('Windowed');
        this.fullscreenUIHidden = false;
        this.showControls();
      }).catch(err => this.showToast('Windowed Error'));
    }
  }

  seekForward() {
    // Seek 15 seconds forward
    this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 15);
    this.showToast('Forward 15s');
  }

  seekBackward() {
    this.video.currentTime = Math.max(0, this.video.currentTime - 15);
    this.showToast('Rewind 15s');
  }

  handleUnifiedPointerEvent(e) {
    if (e.target.closest('.progress-container')) {
      if (e.type === 'pointerdown') {
        this.handlePointerDown(e);
      } else if (e.type === 'pointermove') {
        this.handlePointerMove(e);
      } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
        this.handlePointerUp(e);
      }
    }
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.isDragging = true;
    this.showControls();
    this.ui.progressContainer.setPointerCapture(e.pointerId);
    this.seekToPosition(e.clientX);
    if (this.timestampPopup) {
      this.timestampPopup.style.display = 'block';
    }
    this.ui.progressBar.classList.add('dragging');
  }

  handlePointerMove(e) {
    if (this.isDragging) {
      this.seekToPosition(e.clientX);
    }
  }

  handlePointerUp(e) {
    if (this.isDragging) {
      this.seekToPosition(e.clientX);
      this.isDragging = false;
      this.ui.progressContainer.releasePointerCapture(e.pointerId);
      this.ui.progressBar.classList.remove('dragging');
      if (this.timestampPopup) {
        this.timestampPopup.style.display = 'none';
      }
    }
  }

  seekToPosition(clientX) {
    const rect = this.ui.progressContainer.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percent = Math.min(Math.max(0, offsetX / rect.width), 1);
    const newTime = percent * this.video.duration;
    this.video.currentTime = newTime;
    if (this.timestampPopup) {
      this.timestampPopup.textContent = formatTime(newTime);
      this.timestampPopup.style.left = offsetX + 'px';
    }
  }

  showToast(message) {
    const popup = this.ui.notificationPopup;
    if (!popup) return;
    popup.textContent = message;
    popup.style.display = 'flex';
    popup.style.opacity = '1';
    setTimeout(() => {
      popup.style.opacity = '0';
      setTimeout(() => { popup.style.display = 'none'; }, 300);
    }, 1000);
  }

  showNotification(message, type = 'info') {
    const notificationsEl = document.querySelector('.notifications');
    if (!notificationsEl) return;
    
    notificationsEl.textContent = message;
    notificationsEl.className = `notifications ${type}`;
    notificationsEl.classList.add('show');
    
    setTimeout(() => {
      notificationsEl.classList.remove('show');
      setTimeout(() => notificationsEl.remove(), 300);
    }, 3000);
  }
}

export default UIController; 