# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern Twitter/X content monitoring web application that displays daily curated tweets with images, metrics, and interactive features. The app uses a **three-tier caching architecture** to optimize performance and supports offline browsing.

## Architecture

### Backend: Dual-Mode API Server

The project supports two deployment modes:

1. **Vercel Serverless** (Production)
   - `/api/*.js` - Node.js serverless functions
   - Deployed via Vercel with automatic scaling
   - Uses PostgreSQL for persistent storage

2. **Local Python Server** (Development)
   - `server.py` - Single-file HTTP server
   - Same API interface as Vercel functions
   - Useful for local development and testing

Both modes implement identical endpoints:
- `/api/dates` - List all available dates
- `/api/data?date=YYYY-MM-DD` - Get tweet URLs for a date
- `/api/tweet_info?id=TWEET_ID` - Proxy to VxTwitter API (bypasses CORS)
- `/api/update` - Save/merge tweet data (POST)
- `/api/delete` - Remove specific tweet (POST)

### Frontend: Three-Layer Caching System

```
User Request
    ↓
1. Memory Cache (tweetMediaCache Map)
    ↓ miss
2. IndexedDB (Persistent Browser Storage)
    ↓ miss
3. Backend API → VxTwitter Proxy
    ↓
Cache all layers & return
```

This design minimizes API calls and enables offline functionality.

### Key Components

- **script.js** (~2800 lines) - Main application logic, data fetching, caching, view rendering
- **tweet-detail-modal.js** - Modal viewer with thumbnail navigation and copy features
- **sw.js** - Service Worker for offline support and media caching
- **index.html** - Single-page application with embedded tweets and gallery views
- **styles.css** + **tweet-detail-modal.css** - Modern dark theme with light mode support

### Data Flow

1. **Initial Load**: Fetch available dates from `/api/dates`
2. **Date Selection**: Load tweet URLs from `/api/data?date=X`
3. **Lazy Loading**: IntersectionObserver triggers media fetch only when tweets enter viewport
4. **Media Details**: Each tweet's images/video fetched via `/api/tweet_info` (proxied from VxTwitter)

### View Modes

- **List View**: Traditional timeline with embedded tweets and date badges
- **Gallery View**: Masonry grid of images with hover effects and metadata overlays

## Development Commands

### Local Development Server

```bash
# Option 1: Python server (includes API proxy)
python3 server.py
# Then visit: http://localhost:5500

# Option 2: Vercel dev (serverless functions)
npm run dev
# Then visit: http://localhost:3000

# Option 3: Simple HTTP server (no API, frontend only)
python3 -m http.server 8888
# Then visit: http://localhost:8888
```

### Database Setup

Required environment variable:
```bash
# .env file
POSTGRES_URL=postgresql://user:pass@host:5432/dbname
# or
DATABASE_URL=postgresql://...
```

Database schema (auto-created on first run):
```sql
CREATE TABLE daily_tweets (
    date VARCHAR(10) PRIMARY KEY,
    urls JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Testing Image Download Feature

The batch download feature requires:
1. html2canvas and JSZip libraries (loaded from CDN)
2. Images must be visible in DOM (uses canvas conversion to avoid CORS)
3. Works by:
   - Converting all Twitter images to data URLs via canvas
   - Capturing full-page screenshot with html2canvas
   - Extracting individual images from DOM elements
   - Packaging everything into a ZIP file

## Content Security Policy (CSP)

The app has strict CSP defined in `index.html` and `vercel.json`. When adding new external resources:

- **Scripts**: Add domain to `script-src`
- **Images**: Add domain to `img-src`
- **Frames**: Add domain to `frame-src` (required for Twitter embeds)
- **Connections**: Add domain to `connect-src`

Current allowed domains:
- `platform.twitter.com`, `*.twitter.com`, `*.twimg.com` (Twitter content)
- `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com` (CDN libraries)
- `fonts.googleapis.com`, `fonts.gstatic.com` (Google Fonts)

## Important Patterns

### Avoiding CORS Issues

1. **Backend Proxy**: All VxTwitter API calls go through `/api/tweet_info` to avoid CORS
2. **Canvas Conversion**: Image downloads convert `<img>` elements to canvas before extraction
3. **Service Worker**: Caches media with `opaque` response handling

### Memory Management

- `tweetMediaCache` has size limits and cleanup on date changes
- IndexedDB stores tweet data permanently (cleared manually)
- Service Worker caches media separately from app assets

### Infinite Scroll

Uses IntersectionObserver to:
1. Load next date when user scrolls near bottom
2. Lazy-load tweet media when entering viewport
3. Preload adjacent modal cards for smooth navigation

### Modal Navigation

- Arrow keys and swipe gestures supported
- Thumbnail strip shows all images in current date
- Data preloaded for cards before/after current position
- Supports direct deep-linking via URL hash

## Common Gotchas

1. **Library Loading**: html2canvas/JSZip may fail to load due to CSP or adblockers. Error handling logs to console only, no user-facing alerts.

2. **Service Worker Updates**: After modifying `sw.js`, users must:
   ```javascript
   // Run in browser console
   navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
   ```

3. **Theme Switching**: Theme preference stored in localStorage as `site-theme`. Applied before DOM load via inline script to prevent flash.

4. **Date Format**: Always `YYYY-MM-DD`. Backend validates with regex `^\d{4}-\d{2}-\d{2}$`.

5. **Tweet ID Extraction**: Uses regex to extract ID from various Twitter URL formats. See `extractTweetId()` function.

## API Response Formats

### VxTwitter API (via `/api/tweet_info`)
```json
{
  "text": "Tweet content...",
  "media_extended": [
    {
      "type": "image",
      "url": "https://pbs.twimg.com/media/...",
      "thumbnail_url": "https://pbs.twimg.com/..."
    }
  ],
  "likes": 1234,
  "retweets": 567,
  "replies": 89
}
```

### Database Storage (`/api/data`)
```json
{
  "date": "2025-12-18",
  "urls": [
    "https://twitter.com/user/status/123...",
    "https://x.com/user/status/456..."
  ]
}
```

## Browser Extension Integration

There's a `browser-extension/` folder with scripts for collecting tweets from Twitter/X pages. This is separate from the main web app but shares data formats.

## Deployment

- **Production**: Vercel (automatic via Git push)
- **Environment**: Set `POSTGRES_URL` in Vercel dashboard
- **CDN**: All external libraries loaded from CDN (no npm build step for frontend)
- **Static Assets**: Served directly, no bundler required

## Performance Considerations

- Lazy loading prevents loading all tweet media at once
- Service Worker caches images indefinitely (until cache cleared)
- IndexedDB reduces API calls after first load
- CSS animations use `transform` and `opacity` for GPU acceleration
- Image quality reduced to 90-95% for download ZIP to save space
