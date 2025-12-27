import { searchWiki, fetchPage, setCurrentWiki, getCurrentWiki } from './wikiService.js';

const wikiSelect = document.getElementById('wikiSelect');
const input = document.getElementById('searchInput');
const content = document.getElementById('content');

let currentResults = null;
let isLoadingChunks = false;
let navigationHistory = []; // Track page history for back navigation

// Handle wiki selection
wikiSelect.addEventListener('change', (e) => {
    setCurrentWiki(e.target.value);
    const wiki = getCurrentWiki();
    input.placeholder = `Search ${wiki.name} wiki...`;
    content.innerHTML = `<p>Now searching <strong>${wiki.name}</strong> wiki!</p>`;
    input.value = '';
    input.focus();
    navigationHistory = []; // Clear history when changing wikis
});

// Handle search
input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    
    const query = input.value.trim();
    const wiki = getCurrentWiki();
    content.innerHTML = `<div class="loading">🔍 Searching ${wiki.name} for: <strong>${query}</strong></div>`;
    
    try {
        const results = await searchWiki(query);

        if (!results || results.length === 0 || results[1].length === 0) {
            content.innerHTML = '<p>❌ No results found.</p>';
            return;
        }

        currentResults = results;
        navigationHistory = []; // Clear history on new search
        renderResults(results);
    } catch (error) {
        content.innerHTML = `<p>❌ Error: ${error.message}</p>`;
        console.error('Search error:', error);
    }
});

function renderResults(results) {
    content.innerHTML = '';
    
    // Add back button if there's history
    if (navigationHistory.length > 0) {
        addBackButton();
    }
    
    const resultsHeader = document.createElement('h3');
    resultsHeader.textContent = 'Search Results:';
    content.appendChild(resultsHeader);

    const titles = results[1];
    const descriptions = results[2];
    
    titles.forEach((title, index) => {
        const link = document.createElement('a');
        link.className = 'search-result';
        link.href = '#';
        link.innerHTML = `<strong>${escapeHtml(title)}</strong>`;
        if (descriptions[index]) {
            link.innerHTML += `<small>${escapeHtml(descriptions[index])}</small>`;
        }
        
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            await loadPage(title);
        });
        
        content.appendChild(link);
    });
}

async function loadPage(title) {
    content.innerHTML = `<div class="loading">📄 Loading: <strong>${escapeHtml(title)}</strong></div>`;
    
    try {
        const pageData = await fetchPage(title);
        
        // Add current state to history before loading new page
        navigationHistory.push({
            type: 'page',
            title: title,
            html: pageData.html
        });
        
        renderPage(title, pageData.html);
    } catch (error) {
        content.innerHTML = `<p>❌ Error loading page: ${error.message}</p>`;
        console.error('Page load error:', error);
    }
}

function addBackButton() {
    const backBtn = document.createElement('div');
    backBtn.className = 'back-button';
    backBtn.innerHTML = '← Back';
    backBtn.addEventListener('click', () => {
        goBack();
    });
    content.insertBefore(backBtn, content.firstChild);
}

function goBack() {
    if (navigationHistory.length === 0) {
        // No history, go back to search results
        if (currentResults) {
            renderResults(currentResults);
        }
        return;
    }
    
    // Remove current page from history
    navigationHistory.pop();
    
    if (navigationHistory.length === 0) {
        // Back to search results
        if (currentResults) {
            renderResults(currentResults);
        }
    } else {
        // Go to previous page
        const previousPage = navigationHistory[navigationHistory.length - 1];
        navigationHistory.pop(); // Remove it so loadPage can add it back
        
        // Re-render the previous page without adding to history again
        content.innerHTML = `<div class="loading">Loading previous page...</div>`;
        setTimeout(() => {
            renderPage(previousPage.title, previousPage.html, true);
        }, 100);
    }
}

function renderPage(title, html, skipHistoryAdd = false) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const wiki = getCurrentWiki();
    const baseUrl = wiki.api.replace('/api.php', '');

    // Clean up unwanted elements but keep tables and images
    const unwantedSelectors = [
        '.mw-editsection',
        '.mw-cite-backlink',
        '.reference',
        '.noprint',
        'script',
        'style',
        '.navbox',
        '.ambox',
        '.hatnote',
        // Remove video/audio embeds that won't work in overlay
        'iframe',
        'video',
        'audio',
        'object',
        'embed',
        '.video-player',
        '.youtube',
        '.wikia-gallery-item video',
        // Remove info icons with broken SVG references
        '.info-icon',
        '.show-info-icon .info-icon',
        // Remove other broken elements
        'svg use',
        '.wds-icon'
    ];
    
    unwantedSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove empty anchor tags that only contained removed SVGs
    doc.querySelectorAll('a').forEach(a => {
        // If anchor only has whitespace or empty SVG, remove it
        if (a.querySelector('svg') && !a.querySelector('svg').innerHTML.trim()) {
            a.remove();
        } else if (!a.textContent.trim() && !a.querySelector('img') && a.children.length === 0) {
            a.remove();
        }
    });

    // Clean up empty SVG elements
    doc.querySelectorAll('svg').forEach(svg => {
        if (!svg.innerHTML.trim() || svg.querySelector('use')) {
            svg.remove();
        }
    });

    // Helper function to decode HTML entities
    function decodeHtmlEntities(str) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    }

    // Helper function to fix URLs
    function fixUrl(url) {
        if (!url) return null;
        url = url.trim();
        // Decode HTML entities like &amp; -> &
        url = decodeHtmlEntities(url);
        if (url.startsWith('data:')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/') && !url.startsWith('//')) return baseUrl + url;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        // Relative URL
        return baseUrl + '/' + url;
    }
    
    // Style images for better display with lazy loading
    doc.querySelectorAll('img').forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '6px';
        img.style.margin = '10px 0';
        img.style.display = 'block';
        img.loading = 'lazy';
        
        // Fandom wikis use data-src for lazy loading - prioritize this
        const dataSrc = img.getAttribute('data-src');
        const src = img.getAttribute('src');
        
        // Determine the best source for the image
        let bestSrc = null;
        
        // Priority: data-src (actual image) > src (might be placeholder)
        if (dataSrc && !dataSrc.includes('data:image')) {
            bestSrc = fixUrl(dataSrc);
        } else if (src && !src.includes('data:image/gif') && !src.includes('blank.gif')) {
            bestSrc = fixUrl(src);
        } else if (src) {
            // It's a placeholder, try data-src anyway
            bestSrc = dataSrc ? fixUrl(dataSrc) : fixUrl(src);
        }
        
        if (bestSrc) {
            img.setAttribute('src', bestSrc);
        }
        
        // Remove data-src to prevent lazy loading scripts from interfering
        img.removeAttribute('data-src');
        
        // Fix srcset attribute for responsive images
        const srcset = img.getAttribute('srcset');
        if (srcset) {
            const fixedSrcset = srcset.split(',').map(entry => {
                const parts = entry.trim().split(/\s+/);
                let url = parts[0];
                url = fixUrl(url);
                return parts.length > 1 ? `${url} ${parts.slice(1).join(' ')}` : url;
            }).join(', ');
            img.setAttribute('srcset', fixedSrcset);
        }
        
        // Also check for data-srcset (Fandom lazy loading)
        const dataSrcset = img.getAttribute('data-srcset');
        if (dataSrcset && !srcset) {
            const fixedSrcset = dataSrcset.split(',').map(entry => {
                const parts = entry.trim().split(/\s+/);
                let url = parts[0];
                url = fixUrl(url);
                return parts.length > 1 ? `${url} ${parts.slice(1).join(' ')}` : url;
            }).join(', ');
            img.setAttribute('srcset', fixedSrcset);
        }
        img.removeAttribute('data-srcset');
        
        // Remove classes that might hide images
        img.classList.remove('lazyload', 'lzy', 'lzyPlcworked');
        
        // Remove any opacity or filter styles that might be inherited
        img.style.opacity = '1';
        img.style.filter = 'none';
        img.style.visibility = 'visible';
        
        // Add error handling for failed images
        img.addEventListener('error', function() {
            console.log('Failed to load image:', this.src);
            this.style.display = 'none';
        });
    });

    // Handle noscript images - only if the sibling image is a placeholder
    doc.querySelectorAll('noscript').forEach((noscript) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = noscript.innerHTML;
        const imgs = tempDiv.querySelectorAll('img');
        if (imgs.length > 0) {
            // Check if previous sibling is a placeholder image
            const prevSibling = noscript.previousElementSibling;
            const isPlaceholder = prevSibling && prevSibling.tagName === 'IMG' && 
                (prevSibling.src.includes('data:image') || prevSibling.src.includes('blank.gif') || !prevSibling.src);
            
            if (isPlaceholder) {
                // Remove placeholder and use noscript image
                prevSibling.remove();
                imgs.forEach(img => {
                    const src = img.getAttribute('src');
                    if (src) {
                        img.setAttribute('src', fixUrl(src));
                    }
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    noscript.parentNode.insertBefore(img, noscript);
                });
            }
            noscript.remove();
        }
    });

    // Fix figure and picture elements
    doc.querySelectorAll('figure, picture').forEach((container) => {
        // Fix source elements in picture tags
        container.querySelectorAll('source').forEach(source => {
            const srcset = source.getAttribute('srcset');
            if (srcset) {
                source.setAttribute('srcset', fixUrl(srcset));
            }
        });
    });

    // Fix background images in inline styles (including sprites)
    // First decode HTML entities, then fix URLs
    doc.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style');
        if (style && style.includes('url(')) {
            // Decode HTML entities first (e.g., &amp; -> &)
            let decodedStyle = decodeHtmlEntities(style);
            
            // Fix URLs in the style - use a more permissive regex that handles query strings
            const fixed = decodedStyle.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (match, url) => {
                const fixedUrl = fixUrl(url.trim());
                return `url('${fixedUrl}')`;
            });
            el.setAttribute('style', fixed);
        }
    });

    // Handle sprite elements specifically - they need dimensions from external CSS
    doc.querySelectorAll('.sprite, .inv-sprite, .item-sprite, .block-sprite').forEach(sprite => {
        // Sprites need explicit dimensions since we don't have the wiki's CSS
        const style = sprite.getAttribute('style') || '';
        
        // Check for width/height in existing style
        const hasWidth = style.includes('width');
        const hasHeight = style.includes('height');
        
        // Set display properties
        sprite.style.display = 'inline-block';
        sprite.style.verticalAlign = 'middle';
        sprite.style.backgroundRepeat = 'no-repeat';
        
        // Default sprite size is 16x16 for most Minecraft wiki sprites
        // Some are 32x32 (check if style mentions larger background-size)
        if (!hasWidth) {
            sprite.style.width = '16px';
        }
        if (!hasHeight) {
            sprite.style.height = '16px';
        }
    });
    
    // Style tables for better display in overlay
    doc.querySelectorAll('table').forEach((table) => {
        table.style.width = '100%';
        table.style.maxWidth = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '16px 0';
        table.style.fontSize = '13px';
        table.style.background = 'rgba(40, 40, 60, 0.4)';
        table.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        table.style.borderRadius = '6px';
        table.style.overflow = 'hidden';
        table.style.tableLayout = 'auto';
        
        // Style table cells and fix images inside them
        table.querySelectorAll('td, th').forEach(cell => {
            cell.style.padding = '8px';
            cell.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            cell.style.color = '#d0d0d0';
            cell.style.verticalAlign = 'middle';
            
            // Ensure images in table cells display correctly
            cell.querySelectorAll('img').forEach(img => {
                img.style.display = 'inline-block';
                img.style.margin = '4px';
                img.style.maxWidth = '100px';
                img.style.maxHeight = '100px';
            });
        });
        
        // Style headers
        table.querySelectorAll('th').forEach(th => {
            th.style.background = 'rgba(100, 150, 255, 0.2)';
            th.style.fontWeight = '600';
            th.style.color = '#e0e0e0';
        });
    });

    // Handle infoboxes specifically (they often have complex image handling)
    doc.querySelectorAll('.portable-infobox, .infobox, .pi-image').forEach(infobox => {
        infobox.querySelectorAll('img').forEach(img => {
            img.style.maxWidth = '200px';
            img.style.margin = '8px auto';
            img.style.display = 'block';
        });
    });
    
    // Create page content
    content.innerHTML = '';
    addBackButton();
    
    const titleEl = document.createElement('h1');
    titleEl.className = 'page-title';
    titleEl.textContent = title;
    content.appendChild(titleEl);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'wiki-content';
    content.appendChild(contentDiv);
    
    // Render content in chunks for smooth scrolling
    renderContentInChunks(doc.body, contentDiv);
}

function renderContentInChunks(sourceElement, targetElement) {
    const children = Array.from(sourceElement.children);
    const chunkSize = 3; // Render 3 elements at a time for better performance
    let currentIndex = 0;
    let isRendering = false;
    
    function renderChunk() {
        if (currentIndex >= children.length || isRendering) {
            return;
        }
        
        isRendering = true;
        const endIndex = Math.min(currentIndex + chunkSize, children.length);
        const fragment = document.createDocumentFragment();
        
        for (let i = currentIndex; i < endIndex; i++) {
            const clonedNode = children[i].cloneNode(true);
            
            // Process links to enable internal wiki navigation
            clonedNode.querySelectorAll('a').forEach(link => {
                const href = link.getAttribute('href');
                
                // Check if link wraps an image
                const hasImage = link.querySelector('img') !== null;
                
                if (href && (href.startsWith('/wiki/') || href.startsWith('./') || href.startsWith('../'))) {
                    link.style.cursor = 'pointer';
                    if (!hasImage) {
                        link.style.color = '#6db3ff';
                    }
                    link.addEventListener('click', async (e) => {
                        e.preventDefault();
                        let pageTitle = href.replace('/wiki/', '').replace('./', '').replace('../', '');
                        pageTitle = decodeURIComponent(pageTitle.split('#')[0].replace(/_/g, ' '));
                        if (pageTitle) {
                            await loadPage(pageTitle);
                        }
                    });
                } else if (href && (href.startsWith('http') || href.startsWith('//'))) {
                    // For image links, just prevent navigation
                    if (hasImage) {
                        link.style.cursor = 'default';
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                        });
                        // Ensure images in links display properly
                        const imgs = link.querySelectorAll('img');
                        imgs.forEach(img => {
                            img.style.opacity = '1';
                            img.style.filter = 'none';
                        });
                    } else {
                        // For text links, show disabled state
                        link.style.opacity = '0.6';
                        link.title = 'External link - disabled in overlay';
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                        });
                    }
                }
            });
            
            fragment.appendChild(clonedNode);
        }
        
        targetElement.appendChild(fragment);
        currentIndex = endIndex;
        isRendering = false;
        
        // Schedule next chunk if needed
        if (currentIndex < children.length) {
            requestAnimationFrame(() => {
                setTimeout(renderChunk, 50); // Delay for smooth UI
            });
        }
    }
    
    // Load more content when scrolling near bottom
    let scrollTimeout;
    content.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollPosition = content.scrollTop + content.clientHeight;
            const scrollThreshold = content.scrollHeight - 300;
            
            if (scrollPosition > scrollThreshold && currentIndex < children.length && !isRendering) {
                renderChunk();
            }
        }, 100);
    });
    
    // Initial render - load first few chunks immediately
    renderChunk();
    setTimeout(() => {
        if (currentIndex < children.length) renderChunk();
    }, 100);
    setTimeout(() => {
        if (currentIndex < children.length) renderChunk();
    }, 200);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}