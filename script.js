// Extract tweet ID from URL
function extractTweetId(url) {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
}

// Render content items in masonry layout
function renderContent() {
    const contentList = document.getElementById('contentList');
    contentList.className = 'masonry-grid';

    tweetUrls.forEach((url, index) => {
        const contentItem = document.createElement('div');
        contentItem.className = 'masonry-item';
        contentItem.style.animationDelay = `${index * 0.05}s`;

        contentItem.innerHTML = `
            <div class="tweet-embed-container" id="tweet-container-${index}">
                <div class="tweet-loading">
                    <div class="loading-spinner"></div>
                    <span>加载推文中...</span>
                </div>
                <div id="tweet-target-${index}"></div>
            </div>
        `;

        contentList.appendChild(contentItem);

        // Auto load tweet
        const container = document.getElementById(`tweet-container-${index}`);
        loadTweet(url, container, index);
    });
}

// Load embedded tweet using Twitter's widget
function loadTweet(url, container, index) {
    const tweetId = extractTweetId(url);

    if (!tweetId) {
        container.innerHTML = '<p class="tweet-error">无法加载推文预览</p>';
        container.classList.add('loaded');
        return;
    }

    const target = document.getElementById(`tweet-target-${index}`);
    const loading = container.querySelector('.tweet-loading');

    const renderTweet = () => {
        window.twttr.widgets.createTweet(
            tweetId,
            target,
            {
                theme: 'dark',
                dnt: true,
                conversation: 'none',
                cards: 'visible',
                align: 'center',
                width: '100%'
            }
        ).then(function (el) {
            // Remove loading spinner after tweet loads
            if (loading) {
                loading.style.display = 'none';
            }
            if (el) {
                container.classList.add('loaded');
                // Ensure proper alignment after loading
                container.parentElement.style.alignSelf = 'flex-start';
            } else {
                container.innerHTML = '<p class="tweet-error">推文加载失败，可能已被删除或受限</p>';
                container.classList.add('loaded');
            }
        });
    };

    // Load the tweet using Twitter's widget
    if (window.twttr && window.twttr.widgets) {
        renderTweet();
    } else {
        // Wait for Twitter widget to load
        const checkTwitter = setInterval(() => {
            if (window.twttr && window.twttr.widgets) {
                clearInterval(checkTwitter);
                renderTweet();
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkTwitter);
            if (!container.classList.contains('loaded') && container.querySelector('.tweet-loading')) {
                container.innerHTML = '<p class="tweet-error">推文加载超时，请点击下方链接查看原文</p>';
            }
        }, 10000);
    }
}

// Global State
const params = new URLSearchParams(window.location.search);
const paramDate = params.get('date');
let currentDate = (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) ? paramDate : new Date().toISOString().split('T')[0];
const tweetUrls = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Only run frontend logic if we are on the main page
    if (document.getElementById('contentList')) {
        setupDateNavigation();
        loadContentForDate(currentDate);
        addEntranceAnimation();
    }
});

// Setup Date Navigation
function setupDateNavigation() {
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    const dateDisplay = document.getElementById('currentDateDisplay');
    const datePicker = document.getElementById('datePicker');

    // Update display
    const updateDisplay = () => {
        dateDisplay.textContent = currentDate;
        datePicker.value = currentDate;

        // Disable next button if date is today
        const today = new Date().toISOString().split('T')[0];
        nextBtn.style.opacity = currentDate >= today ? '0.5' : '1';
        nextBtn.style.pointerEvents = currentDate >= today ? 'none' : 'auto';
    };

    // Change date
    const changeDate = (offset) => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + offset);
        currentDate = date.toISOString().split('T')[0];
        updateDisplay();
        loadContentForDate(currentDate);
    };

    prevBtn.addEventListener('click', () => changeDate(-1));
    nextBtn.addEventListener('click', () => changeDate(1));

    // Date picker interaction
    dateDisplay.parentElement.addEventListener('click', () => {
        datePicker.showPicker();
    });

    datePicker.addEventListener('change', (e) => {
        currentDate = e.target.value;
        updateDisplay();
        loadContentForDate(currentDate);
    });

    updateDisplay();
}

// Load content for specific date
function loadContentForDate(date) {
    const storageKey = `tweets_${date}`;
    const contentList = document.getElementById('contentList');
    const emptyState = document.getElementById('emptyState');
    contentList.innerHTML = '';
    tweetUrls.length = 0;
    const url = `/api/data?date=${encodeURIComponent(date)}`;
    fetch(url)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            const urls = Array.isArray(data && data.urls) ? data.urls : [];
            if (urls.length > 0) {
                tweetUrls.push(...urls);
                renderContent();
                emptyState.style.display = 'none';
                localStorage.setItem(storageKey, JSON.stringify(urls));
                return;
            }
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                try {
                    const u = JSON.parse(savedData);
                    if (Array.isArray(u) && u.length > 0) {
                        tweetUrls.push(...u);
                        renderContent();
                        emptyState.style.display = 'none';
                        return;
                    }
                } catch (e) {}
            }
            emptyState.style.display = 'block';
        })
        .catch(() => {
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                try {
                    const u = JSON.parse(savedData);
                    if (Array.isArray(u) && u.length > 0) {
                        tweetUrls.push(...u);
                        renderContent();
                        emptyState.style.display = 'none';
                        return;
                    }
                } catch (e) {}
            }
            emptyState.style.display = 'block';
        });
}

// Save daily snapshot (Called by Admin)
function saveDailySnapshot(date, urls) {
    const storageKey = `tweets_${date}`;
    const body = JSON.stringify({ date, urls });
    return fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        .then(r => {
            const ok = r.ok;
            return (ok ? r.json() : Promise.reject()).then(() => ok);
        })
        .then(ok => {
            localStorage.setItem(storageKey, JSON.stringify(urls));
            return { remoteSaved: ok };
        })
        .catch(() => {
            localStorage.setItem(storageKey, JSON.stringify(urls));
            return { remoteSaved: false };
        });
}

// Extract URLs from text (Shared utility)
function extractUrls(text) {
    const regex = /https?:\/\/(?:x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/\d+/g;
    return [...new Set(text.match(regex) || [])];
}

// Render content items in masonry layout
function renderContent() {
    const contentList = document.getElementById('contentList');
    contentList.className = 'masonry-grid';

    tweetUrls.forEach((url, index) => {
        const contentItem = document.createElement('div');
        contentItem.className = 'masonry-item';
        contentItem.style.animationDelay = `${index * 0.05}s`;

        contentItem.innerHTML = `
            <div class="tweet-embed-container" id="tweet-container-${index}">
                <div class="tweet-loading">
                    <div class="loading-spinner"></div>
                    <span>加载推文中...</span>
                </div>
                <div id="tweet-target-${index}"></div>
            </div>
        `;

        contentList.appendChild(contentItem);

        // Auto load tweet
        const container = document.getElementById(`tweet-container-${index}`);
        loadTweet(url, container, index);
    });
}

// Add entrance animation
function addEntranceAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .content-item {
            animation: slideInUp 0.5s ease-out backwards;
        }
    `;
    document.head.appendChild(style);
}

// Optional: Add smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
