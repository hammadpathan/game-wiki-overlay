const { session } = require("electron");

function setupSecurity() {
    // Blocklist approach - block ads/tracking, allow everything else
    const BLOCKED_DOMAINS = [
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "google-analytics.com",
        "googletagmanager.com",
        "googletagservices.com",
        "adservice.google.com",
        "pagead2.googlesyndication.com",
        "amazon-adsystem.com",
        "facebook.net",
        "facebook.com/tr",
        "connect.facebook.net",
        "adskeeper.com",
        "adnxs.com",
        "rubiconproject.com",
        "pubmatic.com",
        "openx.net",
        "criteo.com",
        "outbrain.com",
        "taboola.com",
        "quantserve.com",
        "scorecardresearch.com",
        "newrelic.com",
        "nr-data.net",
        "hotjar.com",
        "mouseflow.com",
        "fullstory.com",
        "optimizely.com",
        "crazyegg.com",
        "mixpanel.com",
        "segment.com",
        "amplitude.com",
        "heapanalytics.com",
        "sentry.io"
    ];

    const BLOCKED_KEYWORDS = [
        "/ads/",
        "/ad/",
        "/advert",
        "doubleclick",
        "googlesyndication",
        "pagead",
        "amazon-adsystem",
        "adnxs",
        "/tracking/",
        "/tracker",
        "analytics.js",
        "gtag/js",
        "gtm.js"
    ];

    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = details.url.toLowerCase();
        
        // Always allow local files and dev tools
        if (url.startsWith('file://') || url.startsWith('devtools://') || url.startsWith('chrome-extension://') || url.startsWith('data:')) {
            callback({ cancel: false });
            return;
        }
        
        // Check if domain is blocked
        const isBlockedDomain = BLOCKED_DOMAINS.some(domain => url.includes(domain));
        
        // Check if URL contains blocked keywords
        const hasBlockedKeyword = BLOCKED_KEYWORDS.some(keyword => url.includes(keyword));
        
        // Block if matched, otherwise allow
        callback({ cancel: isBlockedDomain || hasBlockedKeyword });
    });
}

module.exports = { setupSecurity };