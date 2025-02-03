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
    this.timestampPopup = document.createElement('div');
    this.timestampPopup.className = 'timestamp-popup';
    
    // Unified styling with progress container
    Object.assign(this.timestampPopup.style, {
      position: 'absolute',
      bottom: 'calc(100% + 12px)', // Maintain fixed distance from progress bar
      transform: 'translateX(-50%)',
      transformOrigin: 'center bottom',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.2s ease, transform 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      zIndex: '1000'
    });

    // Add to progress container
    this.controls.progressContainer.appendChild(this.timestampPopup);
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
    this.timestampPopup.style.display = 'block';
    this.timestampPopup.style.opacity = '1';
    this.timestampPopup.style.transform = 'translateX(-50%) translateY(-8px)';
    this.ui.progressBar.classList.add('dragging');
  }

  handlePointerMove(e) {
    if (!this.state.isDragging) return;
    
    const rect = this.controls.progressContainer.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.min(Math.max(0, offsetX / rect.width), 1);
    
    // Update popup position
    this.timestampPopup.style.left = `${percent * 100}%`;
    this.timestampPopup.textContent = formatTime(percent * this.video.duration);
    
    // Maintain vertical distance
    this.timestampPopup.style.transform = `translateX(-50%) translateY(${
      this.state.isDragging ? '-8px' : '0'
    })`;
  }

  handlePointerUp(e) {
    if (this.isDragging) {
      this.seekToPosition(e.clientX);
      this.isDragging = false;
      this.ui.progressContainer.releasePointerCapture(e.pointerId);
      this.ui.progressBar.classList.remove('dragging');
      this.timestampPopup.style.opacity = '0';
      this.timestampPopup.style.transform = 'translateX(-50%) translateY(0)';
      // Let CSS transition handle the hide animation
      setTimeout(() => this.timestampPopup.style.display = 'none', 300);
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
      // Position as percentage relative to progress container
      this.timestampPopup.style.left = `${percent * 100}%`;
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
      setTimeout(() => popup.style.display = 'none', 300);
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

  updateTimestampPopupPreview(offsetX) {
    const percent = offsetX / this.state.containerWidth;
    const time = this.video.duration * percent;
    
    this.timestampPopup.querySelector('.time-display').textContent = formatTime(time);
    this.miniProgress.style.width = `${percent * 100}%`;
    this.timestampPopup.style.left = `${offsetX}px`;

    // Animation system integration
    if (!this.timestampPopup.classList.contains('visible')) {
      this.timestampPopup.classList.remove('hidden');
      this.timestampPopup.classList.add('visible');
    }
  }

  hideTimestampPopup() {
    this.timestampPopup.classList.add('hidden');
    this.timestampPopup.classList.remove('visible', 'dragging');
    
    // Cleanup after animation
    this.timestampPopup.addEventListener('animationend', () => {
      this.timestampPopup.style.display = 'none';
    }, { once: true });
  }

  handlePopupDragMove(e) {
    if (this.state.isDraggingPopup) {
      // ... existing code ...
      this.timestampPopup.classList.add('dragging');
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

  showFastSeekAnimation(direction, position) {
    const container = document.createElement('div');
    container.className = `fastseek-indicator ${direction}`;
    
    // Use same SVG structure as play/pause
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', direction === 'right' ? 
      'M8 5v14l11-7z' :  // Right arrow (play icon)
      'M6 19h4V5H6v14zm8-14v14h4V5h-4z'); // Left arrow (pause-like icon)
    
    svg.appendChild(path);
    container.appendChild(svg);
    document.body.appendChild(container);

    // Center positioning like play/pause
    container.style.left = '50%';
    container.style.top = '50%';
    container.style.transform = 'translate(-50%, -50%)';

    // Use same animation class
    container.classList.add('visible');
    setTimeout(() => {
      container.remove();
    }, 600);
  }
}

export default UIController; 