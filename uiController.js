/*
 * uiController.js
 * This module encapsulates UI control logic separately from video logic.
 * It provides centralized UI updates, queued UI actions (if needed), and proper event handling for progress, popups, gestures, and fullscreen toggling.
 */

import { formatTime, throttle } from './utils/helpers.js';
import { PROVIDERS, providerDisplayNames, getProviderUrl } from './config/videoConfig.js';

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
        this.handleArrowKey('right', e);
        break;
      case 'ArrowLeft':
        this.handleArrowKey('left', e);
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
      this.video.play().then(() => {
        this.showFastSeekAnimation('play');
      }).catch(err => console.error('Play error:', err));
    } else {
      this.video.pause();
      this.showFastSeekAnimation('pause');
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

  handleArrowKey(direction, e) {
    const positions = {
      right: { x: window.innerWidth - 100, y: window.innerHeight / 2 },
      left: { x: 100, y: window.innerHeight / 2 }
    };

    if (this.state.arrowTimeout) {
      clearTimeout(this.state.arrowTimeout);
      this.state.arrowTimeout = null;
    }

    const tapCount = (this.state.multiTapState?.[direction] || 0) + 1;
    this.state.multiTapState = { ...this.state.multiTapState, [direction]: tapCount };

    if (tapCount === 2) {
      if (direction === 'right') {
        loadNextVideo();
        this.showFastSeekAnimation('right');
      } else {
        loadPreviousVideo();
        this.showFastSeekAnimation('left');
      }
      this.state.multiTapState[direction] = 0;
    } else {
      this.state.arrowTimeout = setTimeout(() => {
        const seconds = direction === 'right' ? 15 : -15;
        this.secsSeek(seconds);
        this.showFastSeekAnimation(direction);
        this.state.multiTapState[direction] = 0;
      }, 200);
    }
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
    if (!this.isDragging) return;
    
    const rect = this.ui.progressContainer.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.min(Math.max(0, offsetX / rect.width), 1);
    
    this.timestampPopup.style.left = `${percent * 100}%`;
    this.timestampPopup.textContent = formatTime(percent * this.video.duration);
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

  showNotification(message, type = 'info') {
    const notificationsEl = document.getElementById('notifications-container');
    if (!notificationsEl) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-message">${message}</div>
        <div class="notification-timestamp">${new Date().toLocaleTimeString()}</div>
      </div>
    `;

    notificationsEl.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('visible'));

    setTimeout(() => {
      notification.classList.add('exiting');
      setTimeout(() => notification.remove(), 300);
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

  showFastSeekAnimation(direction) {
    const messages = {
      left: '⏪ Rewound 15s',
      right: '⏩ Fast-forwarded 15s',
      play: '▶️ Play',
      pause: '⏸ Paused'
    };
    
    this.showNotification(messages[direction], 'info');
    
    // Keep existing visual animation if needed, but remove duplicate feedback
    // ... rest of existing animation code ...
  }

  secsSeek(seconds) {
    this.video.currentTime = Math.min(Math.max(0, this.video.currentTime + seconds), this.video.duration);
  }
}

export default UIController; 