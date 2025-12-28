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

// Show landing page, hide webview
function showLandingPage() {
  // Don't reload if already on landing page
  if (!landingPage.classList.contains("hidden")) {
    return;
  }
  
  landingPage.classList.remove("hidden");
  wiki.classList.remove("active");
  wiki.src = "about:blank";
  searchInput.value = "";
  searchInput.placeholder = "Select a wiki first...";
  searchInput.disabled = true;
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

// Navigation
backBtn.addEventListener("click", () => {
  if (wiki.canGoBack()) {
    wiki.goBack();
  }
});

forwardBtn.addEventListener("click", () => {
  if (wiki.canGoForward()) {
    wiki.goForward();
  }
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