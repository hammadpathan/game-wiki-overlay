const wiki = document.getElementById("wiki");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const backBtn = document.getElementById("back-btn");
const forwardBtn = document.getElementById("forward-btn");
const homeBtn = document.getElementById("home-btn");
const closeBtn = document.getElementById("close-btn");
const status = document.getElementById("status");
const landingPage = document.getElementById("landing-page");
const wikiUrlInput = document.getElementById("wiki-url-input");
const goBtn = document.getElementById("go-btn");
const wikiCards = document.querySelectorAll(".wiki-card");

// Current wiki configuration
let WIKI_CONFIG = {
  baseUrl: "",
  searchUrl: ""
};

// Track navigation history (webview URLs we've visited)
let navigationHistory = [];
let currentHistoryIndex = -1;

// Show landing page, hide webview
function showLandingPage() {
  landingPage.classList.remove("hidden");
  wiki.classList.remove("active");
  wiki.src = "about:blank";
  searchInput.value = "";
  searchInput.placeholder = "Select a wiki first...";
  searchInput.disabled = true;
  searchBtn.disabled = true;
  
  // Clear navigation history
  navigationHistory = [];
  currentHistoryIndex = -1;
}

// Show webview, hide landing page
function showWiki(baseUrl, searchUrl) {
  WIKI_CONFIG.baseUrl = baseUrl;
  WIKI_CONFIG.searchUrl = searchUrl || baseUrl + "/wiki/Special:Search?search=";
  
  landingPage.classList.add("hidden");
  wiki.classList.add("active");
  wiki.src = baseUrl;
  searchInput.disabled = false;
  searchInput.placeholder = "Search wiki...";
  searchBtn.disabled = false;
}

// Wiki card selection
wikiCards.forEach(card => {
  card.addEventListener("click", () => {
    const url = card.dataset.url;
    const searchUrl = card.dataset.search;
    showWiki(url, searchUrl);
  });
});

// Custom URL input
function goToCustomUrl() {
  let url = wikiUrlInput.value.trim();
  if (url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    showWiki(url, url + "/wiki/Special:Search?search=");
  }
}

goBtn.addEventListener("click", goToCustomUrl);
wikiUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    goToCustomUrl();
  }
});

// Prevent new windows - open in same webview instead
wiki.addEventListener("new-window", (e) => {
  e.preventDefault();
  if (e.url) {
    wiki.src = e.url;
  }
});

// Search functionality
function performSearch() {
  const query = searchInput.value.trim();
  if (query && WIKI_CONFIG.searchUrl) {
    wiki.src = WIKI_CONFIG.searchUrl + encodeURIComponent(query);
  }
}

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    performSearch();
  }
});

searchBtn.addEventListener("click", performSearch);

// Track webview navigation
wiki.addEventListener("did-navigate", (e) => {
  // Ignore about:blank
  if (e.url === "about:blank") return;
  
  // Reset navigation state on page change
  highlightStyleInjected = false;
  currentHighlightedElement = null;
  allClickableElements = [];
  
  // If we navigated (not via our back/forward), add to history
  // Trim any forward history if we're not at the end
  if (currentHistoryIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
  }
  
  // Add new URL to history (avoid duplicates)
  if (navigationHistory[navigationHistory.length - 1] !== e.url) {
    navigationHistory.push(e.url);
    currentHistoryIndex = navigationHistory.length - 1;
  }
});

wiki.addEventListener("did-navigate-in-page", (e) => {
  // Handle in-page navigation (hash changes, etc.)
  if (e.url === "about:blank") return;
  
  if (currentHistoryIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
  }
  
  if (navigationHistory[navigationHistory.length - 1] !== e.url) {
    navigationHistory.push(e.url);
    currentHistoryIndex = navigationHistory.length - 1;
  }
});

// Navigation state - prevent rapid navigation
let isNavigating = false;
let navigationTimeout = null;

function setNavigating(state) {
  isNavigating = state;
  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
  }
  if (state) {
    // Auto-reset after 2 seconds in case did-stop-loading doesn't fire
    navigationTimeout = setTimeout(() => {
      isNavigating = false;
    }, 2000);
  }
}

// Safe back navigation - uses our own history tracking
function safeGoBack() {
  if (!wiki.classList.contains('active')) {
    return false;
  }
  
  // Prevent rapid navigation
  if (isNavigating) {
    return false;
  }
  
  // Check if we have history to go back to
  if (currentHistoryIndex > 0) {
    setNavigating(true);
    currentHistoryIndex--;
    wiki.src = navigationHistory[currentHistoryIndex];
    return true;
  } else {
    // No history, go to landing page
    showLandingPage();
    return false;
  }
}

// Safe forward navigation
function safeGoForward() {
  if (!wiki.classList.contains('active')) {
    return false;
  }
  
  // Prevent rapid navigation
  if (isNavigating) {
    return false;
  }
  
  if (currentHistoryIndex < navigationHistory.length - 1) {
    setNavigating(true);
    currentHistoryIndex++;
    wiki.src = navigationHistory[currentHistoryIndex];
    return true;
  }
  return false;
}

// Navigation
backBtn.addEventListener("click", () => {
  safeGoBack();
});

forwardBtn.addEventListener("click", () => {
  safeGoForward();
});

homeBtn.addEventListener("click", () => {
  showLandingPage();
});

// Close button
closeBtn.addEventListener("click", () => {
  if (window.electronAPI) {
    window.electronAPI.closeWindow();
  }
});

// Loading state
wiki.addEventListener("did-start-loading", () => {
  wiki.classList.add("loading");
  status.textContent = "Loading...";
});

wiki.addEventListener("did-stop-loading", () => {
  wiki.classList.remove("loading");
  status.textContent = "";
  setNavigating(false); // Allow new navigation
  
  // Refresh clickable elements after page loads
  if (cursorVisible) {
    setTimeout(refreshClickableElements, 300);
  }
});

// Handle navigation errors gracefully (suppress about:blank errors)
wiki.addEventListener("did-fail-load", (e) => {
  setNavigating(false); // Allow new navigation after error
  // Ignore aborted loads (usually from navigating away quickly or about:blank)
  if (e.errorCode === -3 || e.validatedURL === "about:blank") {
    return;
  }
  console.log("Load failed:", e.errorDescription, e.validatedURL);
});

// Handle click-through mode notification from main process
if (window.electronAPI) {
  window.electronAPI.onClickThroughChanged((enabled) => {
    if (enabled) {
      status.textContent = "Click-through ON";
      status.classList.add("click-through");
    } else {
      status.textContent = "";
      status.classList.remove("click-through");
    }
  });
}

// Initialize with landing page
showLandingPage();

// Setup resize handles
const resizeHandles = document.querySelectorAll('.resize-handle');
resizeHandles.forEach(handle => {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    // Extract direction from class name (resize-n, resize-se, etc.)
    const classes = handle.className.split(' ');
    const dirClass = classes.find(c => c.startsWith('resize-') && c !== 'resize-handle');
    if (dirClass && window.electronAPI) {
      const direction = dirClass.replace('resize-', '');
      window.electronAPI.startResize(direction);
    }
  });
});

// Stop resizing when mouse is released anywhere
document.addEventListener('mouseup', () => {
  if (window.electronAPI) {
    window.electronAPI.stopResize();
  }
});

// Also stop if mouse leaves the window
document.addEventListener('mouseleave', () => {
  if (window.electronAPI) {
    window.electronAPI.stopResize();
  }
});

// Opacity slider
const opacitySlider = document.getElementById('opacity-slider');
opacitySlider.addEventListener('input', (e) => {
  const opacity = parseInt(e.target.value) / 100;
  if (window.electronAPI) {
    window.electronAPI.setOpacity(opacity);
  }
});

// ===== On-Screen Keyboard =====
const osk = document.getElementById('osk');
const oskKeys = document.getElementById('osk-keys');
const oskInputText = document.getElementById('osk-input-text');

// Keyboard layouts
const KEYBOARD_LAYOUTS = {
  letters: [
    'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P',
    'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', "'",
    'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '-'
  ],
  numbers: [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
    '+', '=', '[', ']', '{', '}', ':', ';', '"', '?'
  ]
};

let oskVisible = false;
let oskSelectedIndex = 0;
let oskCurrentLayout = 'letters';
let oskInputValue = '';
let oskTargetInput = null; // Which input we're typing into
let oskLastAnalogNav = 0; // Debounce analog navigation

function showOSK(targetInput) {
  oskTargetInput = targetInput;
  oskInputValue = targetInput.value || '';
  oskSelectedIndex = 0;
  oskVisible = true;
  osk.classList.remove('hidden');
  renderOSKKeys();
  updateOSKPreview();
  hideCursor(); // Hide the main cursor while OSK is active
}

function hideOSK(submit = false) {
  if (submit && oskTargetInput) {
    oskTargetInput.value = oskInputValue;
    // Trigger search if it's the search input
    if (oskTargetInput === searchInput) {
      performSearch();
    } else if (oskTargetInput === wikiUrlInput) {
      goToCustomUrl();
    }
  }
  oskVisible = false;
  osk.classList.add('hidden');
  oskTargetInput = null;
  showCursor(); // Restore the main cursor
}

function renderOSKKeys() {
  const keys = KEYBOARD_LAYOUTS[oskCurrentLayout];
  oskKeys.innerHTML = '';
  
  keys.forEach((key, index) => {
    const keyEl = document.createElement('div');
    keyEl.className = 'osk-key' + (index === oskSelectedIndex ? ' selected' : '');
    keyEl.textContent = key;
    keyEl.dataset.index = index;
    keyEl.addEventListener('click', () => {
      oskInputValue += key.toLowerCase();
      updateOSKPreview();
    });
    oskKeys.appendChild(keyEl);
  });
}

function updateOSKPreview() {
  oskInputText.textContent = oskInputValue || '';
}

function oskNavigate(direction) {
  const keys = KEYBOARD_LAYOUTS[oskCurrentLayout];
  const cols = 10;
  const rows = Math.ceil(keys.length / cols);
  
  let col = oskSelectedIndex % cols;
  let row = Math.floor(oskSelectedIndex / cols);
  
  switch (direction) {
    case 'up':
      row = (row - 1 + rows) % rows;
      break;
    case 'down':
      row = (row + 1) % rows;
      break;
    case 'left':
      col = (col - 1 + cols) % cols;
      break;
    case 'right':
      col = (col + 1) % cols;
      break;
  }
  
  let newIndex = row * cols + col;
  if (newIndex >= keys.length) {
    newIndex = keys.length - 1;
  }
  
  oskSelectedIndex = newIndex;
  renderOSKKeys();
}

function oskTypeSelected() {
  const keys = KEYBOARD_LAYOUTS[oskCurrentLayout];
  if (oskSelectedIndex < keys.length) {
    oskInputValue += keys[oskSelectedIndex].toLowerCase();
    updateOSKPreview();
  }
}

function oskBackspace() {
  oskInputValue = oskInputValue.slice(0, -1);
  updateOSKPreview();
}

function oskSpace() {
  oskInputValue += ' ';
  updateOSKPreview();
}

function oskSwitchLayout() {
  oskCurrentLayout = oskCurrentLayout === 'letters' ? 'numbers' : 'letters';
  oskSelectedIndex = Math.min(oskSelectedIndex, KEYBOARD_LAYOUTS[oskCurrentLayout].length - 1);
  renderOSKKeys();
}

// ===== Gamepad Hybrid Navigation System =====
// Free-moving cursor that highlights nearest clickable element
const cursor = document.getElementById('gamepad-cursor');
const CURSOR_SPEED = 8; // Pixels per input
const SCROLL_SPEED = 8;
const CURSOR_HIDE_DELAY = 5000;
const SNAP_RADIUS = 80; // How close to snap to an element

let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;
let cursorVisible = false;
let cursorHideTimeout = null;

// Element highlighting state
let currentHighlightedElement = null; // Currently highlighted element info
let allClickableElements = []; // All available clickable elements
let highlightStyleInjected = false;
let currentHighlightedLocal = null; // DOM reference for local elements

function showCursor() {
  cursorVisible = true;
  cursor.classList.add('visible');
  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';
  resetCursorHideTimer();
  refreshClickableElements();
}

function hideCursor() {
  cursorVisible = false;
  cursor.classList.remove('visible');
  cursor.classList.remove('snapped');
  clearAllHighlights();
  currentHighlightedElement = null;
}

function resetCursorHideTimer() {
  if (cursorHideTimeout) clearTimeout(cursorHideTimeout);
  cursorHideTimeout = setTimeout(hideCursor, CURSOR_HIDE_DELAY);
}

// Update cursor position and find nearest element to highlight
function updateCursor() {
  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';
  
  // Find and highlight nearest clickable element
  const nearest = findNearestElement();
  if (nearest && nearest !== currentHighlightedElement) {
    highlightElement(nearest);
    currentHighlightedElement = nearest;
    cursor.classList.add('snapped');
  } else if (!nearest) {
    clearAllHighlights();
    currentHighlightedElement = null;
    cursor.classList.remove('snapped');
  }
}

// Move cursor by delta and update highlighting
function moveCursor(dx, dy) {
  showCursor();
  
  cursorX = Math.max(10, Math.min(window.innerWidth - 10, cursorX + dx));
  cursorY = Math.max(10, Math.min(window.innerHeight - 10, cursorY + dy));
  
  updateCursor();
  resetCursorHideTimer();
}

// Find the nearest clickable element to cursor
function findNearestElement() {
  if (allClickableElements.length === 0) return null;
  
  let nearest = null;
  let nearestDist = SNAP_RADIUS;
  
  for (const el of allClickableElements) {
    // Check if cursor is inside element bounds
    if (cursorX >= el.left && cursorX <= el.right &&
        cursorY >= el.top && cursorY <= el.bottom) {
      return el; // Cursor is inside this element
    }
    
    // Calculate distance to element center
    const dist = Math.hypot(cursorX - el.centerX, cursorY - el.centerY);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = el;
    }
  }
  
  return nearest;
}

// Clear all highlights (local and webview)
function clearAllHighlights() {
  // Clear local
  if (currentHighlightedLocal) {
    currentHighlightedLocal.classList.remove('gamepad-selected');
    currentHighlightedLocal = null;
  }
  
  // Clear webview
  if (wiki.classList.contains('active')) {
    wiki.executeJavaScript(`
      (function() {
        const highlighted = document.querySelector('.gamepad-selected');
        if (highlighted) highlighted.classList.remove('gamepad-selected');
      })()
    `).catch(() => {});
  }
}

// Highlight the currently selected element
function highlightElement(elementInfo) {
  clearAllHighlights();
  
  if (!elementInfo) return;
  
  if (elementInfo.isWebviewElement) {
    // Highlight inside webview
    wiki.executeJavaScript(`
      (function() {
        if (window.__gamepadClickables && window.__gamepadClickables[${elementInfo.webviewIndex}]) {
          window.__gamepadClickables[${elementInfo.webviewIndex}].classList.add('gamepad-selected');
        }
      })()
    `).catch(() => {});
  } else {
    // Highlight local element
    elementInfo.element.classList.add('gamepad-selected');
    currentHighlightedLocal = elementInfo.element;
  }
}

// Get all clickable elements (local + webview)
function getLocalClickableElements() {
  const isInWebview = wiki.classList.contains('active');
  const toolbarHeight = 36;
  let elements = [];
  
  // Toolbar elements
  const toolbarClickables = document.querySelectorAll('#toolbar button, #search-input');
  toolbarClickables.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      elements.push({
        element: el,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        isWebviewElement: false
      });
    }
  });
  
  if (!isInWebview) {
    // Landing page elements
    const landingClickables = document.querySelectorAll('.wiki-card, #go-btn, #wiki-url-input');
    landingClickables.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top > toolbarHeight) {
        elements.push({
          element: el,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          isWebviewElement: false
        });
      }
    });
  }
  
  return elements;
}

// Refresh all clickable elements (async for webview)
function refreshClickableElements() {
  // Get local elements immediately
  allClickableElements = getLocalClickableElements();
  
  // Get webview elements asynchronously
  if (wiki.classList.contains('active')) {
    const webviewRect = wiki.getBoundingClientRect();
    
    // Inject styles if needed
    if (!highlightStyleInjected) {
      wiki.executeJavaScript(`
        (function() {
          if (!document.getElementById('gamepad-nav-styles')) {
            const style = document.createElement('style');
            style.id = 'gamepad-nav-styles';
            style.textContent = \`
              .gamepad-selected {
                outline: 3px solid #2196F3 !important;
                outline-offset: 3px !important;
                box-shadow: 0 0 20px rgba(33, 150, 243, 0.7), inset 0 0 10px rgba(33, 150, 243, 0.2) !important;
                background-color: rgba(33, 150, 243, 0.1) !important;
                transition: all 0.15s ease-out !important;
                position: relative;
                z-index: 1000;
              }
            \`;
            document.head.appendChild(style);
          }
        })()
      `).catch(() => {});
      highlightStyleInjected = true;
    }
    
    wiki.executeJavaScript(`
      (function() {
        const clickables = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [onclick], [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])');
        const results = [];
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;
        
        window.__gamepadClickables = [];
        
        for (let i = 0; i < clickables.length; i++) {
          const el = clickables[i];
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          
          // Only visible elements in viewport - smaller minimum size (4x4)
          if (rect.width >= 4 && rect.height >= 4 &&
              rect.right > 0 && rect.left < viewWidth &&
              rect.bottom > 0 && rect.top < viewHeight &&
              style.visibility !== 'hidden' && 
              style.display !== 'none' &&
              parseFloat(style.opacity) > 0.1) {
            window.__gamepadClickables.push(el);
            results.push({
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              index: window.__gamepadClickables.length - 1
            });
          }
          
          if (results.length >= 500) break; // Allow more elements
        }
        return results;
      })()
    `).then(results => {
      const webviewElements = results.map(r => ({
        element: wiki,
        centerX: webviewRect.left + r.left + r.width / 2,
        centerY: webviewRect.top + r.top + r.height / 2,
        left: webviewRect.left + r.left,
        right: webviewRect.left + r.right,
        top: webviewRect.top + r.top,
        bottom: webviewRect.top + r.bottom,
        isWebviewElement: true,
        webviewIndex: r.index
      }));
      
      // Merge with local elements
      allClickableElements = getLocalClickableElements().concat(webviewElements);
      
      // Update highlight based on current cursor position
      if (cursorVisible) {
        updateCursor();
      }
    }).catch(() => {});
  } else {
    // Update highlight based on current cursor position
    if (cursorVisible) {
      updateCursor();
    }
  }
}

// Click the currently highlighted element
function clickHighlighted() {
  if (!currentHighlightedElement) {
    // No element highlighted - try clicking at cursor position
    return;
  }
  
  showCursor();
  
  // Visual feedback
  cursor.classList.add('clicking');
  setTimeout(() => cursor.classList.remove('clicking'), 150);
  
  if (currentHighlightedElement.isWebviewElement) {
    // Click webview element
    wiki.executeJavaScript(`
      (function() {
        if (window.__gamepadClickables && window.__gamepadClickables[${currentHighlightedElement.webviewIndex}]) {
          const el = window.__gamepadClickables[${currentHighlightedElement.webviewIndex}];
          const link = el.closest('a') || el;
          link.click();
        }
      })()
    `).catch(() => {});
    
    // Refresh after navigation
    setTimeout(() => {
      currentHighlightedElement = null;
      refreshClickableElements();
    }, 500);
  } else {
    // Click local element
    const el = currentHighlightedElement.element;
    
    if (el.tagName === 'INPUT') {
      el.focus();
    } else {
      el.click();
    }
  }
}

// Scroll the page
function scrollPage(deltaX, deltaY) {
  if (wiki.classList.contains('active')) {
    wiki.executeJavaScript(`window.scrollBy(${deltaX}, ${deltaY})`);
    // Refresh clickable elements after scroll
    setTimeout(refreshClickableElements, 150);
  } else {
    landingPage.scrollBy(deltaX, deltaY);
    setTimeout(refreshClickableElements, 150);
  }
}

// Handle gamepad actions
if (window.electronAPI) {
  window.electronAPI.onGamepadAction((action) => {
    // If OSK is visible, handle keyboard navigation
    if (oskVisible) {
      switch (action) {
        case 'cursor-up':
        case 'cursor-up-fast':
          oskNavigate('up');
          break;
        case 'cursor-down':
        case 'cursor-down-fast':
          oskNavigate('down');
          break;
        case 'cursor-left':
        case 'cursor-left-fast':
          oskNavigate('left');
          break;
        case 'cursor-right':
        case 'cursor-right-fast':
          oskNavigate('right');
          break;
        case 'click': // A - type selected key
          oskTypeSelected();
          break;
        case 'back': // B - close keyboard
          hideOSK(false);
          break;
        case 'search': // X - backspace
          oskBackspace();
          break;
        case 'home': // Y - space
          oskSpace();
          break;
        case 'page-up': // LB - switch layout
        case 'page-down': // RB - switch layout
          oskSwitchLayout();
          break;
        case 'start': // Start - submit
          hideOSK(true);
          break;
      }
      return; // Don't process normal actions while OSK is open
    }
    
    switch (action) {
      // D-pad navigation - move cursor in fixed steps
      case 'cursor-up':
        moveCursor(0, -CURSOR_SPEED * 4);
        break;
      case 'cursor-up-fast':
        moveCursor(0, -CURSOR_SPEED * 6);
        break;
      case 'cursor-down':
        moveCursor(0, CURSOR_SPEED * 4);
        break;
      case 'cursor-down-fast':
        moveCursor(0, CURSOR_SPEED * 6);
        break;
      case 'cursor-left':
        moveCursor(-CURSOR_SPEED * 4, 0);
        break;
      case 'cursor-left-fast':
        moveCursor(-CURSOR_SPEED * 6, 0);
        break;
      case 'cursor-right':
        moveCursor(CURSOR_SPEED * 4, 0);
        break;
      case 'cursor-right-fast':
        moveCursor(CURSOR_SPEED * 6, 0);
        break;
        
      // Right stick scrolling
      case 'scroll-up-analog':
        scrollPage(0, -30);
        break;
      case 'scroll-down-analog':
        scrollPage(0, 30);
        break;
        
      // Scrolling (LB/RB)
      case 'page-up':
        scrollPage(0, -300);
        break;
      case 'page-down':
        scrollPage(0, 300);
        break;
        
      // Actions
      case 'click':
        // Check if we're clicking on a text input - open OSK (only if not disabled)
        if (currentHighlightedElement && !currentHighlightedElement.isWebviewElement) {
          const el = currentHighlightedElement.element;
          if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search' || !el.type) && !el.disabled) {
            showOSK(el);
            return;
          }
        }
        clickHighlighted();
        break;
      case 'back':
        if (wiki.classList.contains('active')) {
          safeGoBack();
          setTimeout(refreshClickableElements, 500);
        }
        break;
      case 'home':
        showLandingPage();
        currentHighlightedElement = null;
        allClickableElements = [];
        clearAllHighlights();
        hideCursor();
        break;
      case 'search':
        // X button - open keyboard for search (only when wiki is active)
        if (wiki.classList.contains('active') && !searchInput.disabled) {
          showCursor();
          showOSK(searchInput);
        }
        break;
      case 'start':
        // Start button does nothing when OSK is closed (it's handled in the OSK section above)
        // Could be used for other purposes in the future
        break;
    }
  });
  
  // Handle analog stick input - direct cursor movement
  window.electronAPI.onAnalogInput((data) => {
    // If OSK is visible, use analog for navigation too
    if (oskVisible) {
      const now = Date.now();
      // Debounce analog input for OSK navigation (150ms between moves)
      if (now - oskLastAnalogNav < 150) return;
      
      if (Math.abs(data.dx) > 4 || Math.abs(data.dy) > 4) {
        oskLastAnalogNav = now;
        if (Math.abs(data.dx) > Math.abs(data.dy)) {
          oskNavigate(data.dx > 0 ? 'right' : 'left');
        } else {
          oskNavigate(data.dy > 0 ? 'down' : 'up');
        }
      }
      return;
    }
    
    if (data.dx !== 0 || data.dy !== 0) {
      moveCursor(data.dx, data.dy);
    }
  });
}