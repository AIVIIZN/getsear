/**
 * Sear POS — Main Application JavaScript
 * htmx configuration, global helpers, keyboard shortcuts, touch feedback.
 */

// ============================================================
// htmx Configuration
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // Add auth token to all htmx requests
  document.body.addEventListener('htmx:configRequest', (event) => {
    const token = localStorage.getItem('sear_token');
    if (token) {
      event.detail.headers['Authorization'] = 'Bearer ' + token;
    }

    // Add CSRF token if present
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta && csrfMeta.content) {
      event.detail.headers['X-CSRFToken'] = csrfMeta.content;
    }
  });

  // Handle htmx errors globally
  document.body.addEventListener('htmx:responseError', (event) => {
    const status = event.detail.xhr.status;
    if (status === 401) {
      window.showToast('error', 'Session expired. Please sign in again.');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } else if (status === 403) {
      window.showToast('error', 'Permission denied.');
    } else if (status === 0) {
      window.showToast('warning', 'Network error. Check your connection.');
    } else if (status >= 500) {
      window.showToast('error', 'Server error. Try again in a moment.');
    }
  });

  // Handle network errors
  document.body.addEventListener('htmx:sendError', () => {
    window.showToast('warning', 'Request failed. Are you offline?');
  });

});


// ============================================================
// Global Toast Helper
// ============================================================
window.showToast = function(type, message, duration = 5000) {
  // Wait for Alpine to be ready
  if (typeof Alpine !== 'undefined' && Alpine.store('toasts')) {
    return Alpine.store('toasts').add(type, message, duration);
  }
  // Fallback: queue for when Alpine initializes
  document.addEventListener('alpine:init', () => {
    Alpine.store('toasts').add(type, message, duration);
  }, { once: true });
};


// ============================================================
// Global Modal Helper
// ============================================================
window.showModal = function(content, options = {}) {
  if (typeof Alpine !== 'undefined' && Alpine.store('modal')) {
    Alpine.store('modal').show(content, options);
  }
};

window.closeModal = function() {
  if (typeof Alpine !== 'undefined' && Alpine.store('modal')) {
    Alpine.store('modal').close();
  }
};


// ============================================================
// Keyboard Shortcuts
// ============================================================
document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const isMeta = e.metaKey || e.ctrlKey;

  if (isMeta) {
    switch (e.key) {
      case '1':
        e.preventDefault();
        window.location.href = '/pos';
        break;
      case '2':
        e.preventDefault();
        window.location.href = '/tables';
        break;
      case '3':
        e.preventDefault();
        window.location.href = '/checks';
        break;
      case 'k':
        e.preventDefault();
        // Open search (dispatches custom event for screens to handle)
        window.dispatchEvent(new CustomEvent('sear:search'));
        break;
      case 'n':
        e.preventDefault();
        // New order
        window.dispatchEvent(new CustomEvent('sear:new-order'));
        break;
    }
  }

  // Escape to close modal
  if (e.key === 'Escape') {
    if (typeof Alpine !== 'undefined' && Alpine.store('modal') && Alpine.store('modal').open) {
      Alpine.store('modal').close();
    }
  }
});


// ============================================================
// Connection Monitoring
// ============================================================
(function() {
  // Periodic connectivity check (every 30 seconds)
  let checkInterval = null;

  function startConnectivityCheck() {
    checkInterval = setInterval(() => {
      if (typeof Alpine !== 'undefined' && Alpine.store('connection')) {
        Alpine.store('connection').online = navigator.onLine;
      }
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startConnectivityCheck);
  } else {
    startConnectivityCheck();
  }
})();


// ============================================================
// SSE Connection Helper
// ============================================================
window.connectSSE = function(url, handlers = {}) {
  const token = localStorage.getItem('sear_token');
  const eventSource = new EventSource(url + (url.includes('?') ? '&' : '?') + 'token=' + token);

  eventSource.onopen = () => {
    if (handlers.onOpen) handlers.onOpen();
  };

  eventSource.onerror = (e) => {
    if (handlers.onError) handlers.onError(e);
    // Reconnect after 5 seconds
    setTimeout(() => {
      eventSource.close();
      window.connectSSE(url, handlers);
    }, 5000);
  };

  // Register event handlers
  Object.keys(handlers).forEach(eventName => {
    if (eventName === 'onOpen' || eventName === 'onError') return;
    eventSource.addEventListener(eventName, (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers[eventName](data);
      } catch (err) {
        handlers[eventName](e.data);
      }
    });
  });

  return eventSource;
};


// ============================================================
// Touch Feedback Helper
// ============================================================
(function() {
  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('.touch-active, .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-danger, .sidebar-nav-item, .card-interactive');
    if (target) {
      target.style.transform = 'scale(0.97)';
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const target = e.target.closest('.touch-active, .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-danger, .sidebar-nav-item, .card-interactive');
    if (target) {
      setTimeout(() => {
        target.style.transform = '';
      }, 100);
    }
  }, { passive: true });
})();
