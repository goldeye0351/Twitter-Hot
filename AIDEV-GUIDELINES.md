# AI Agent Development Guidelines & Troubleshooting Protocols

This document serves as a persistent memory and instruction set for AI Agents working on this project. 
ALWAYS consult this file before implementing media features or debugging UI issues.

## 🖼 Media & Cache Troubleshooting Protocol (The "No-Flicker" Rule)

**Context**: In Single Page Applications (SPA), image flickering or re-downloading usually stems from subtle cache misses or aggressive DOM updates.

### 🔴 Critical Checkpoints for Image Logic

When implementing or fixing image galleries, modals, or lists, **YOU MUST** verify the following 3 points:

1.  **CORS Consistency is Mandatory**
    *   **Rule**: If *any* part of the app loads an image with `crossOrigin="anonymous"` (e.g., for Canvas/Download), **ALL** other `<img>` tags for that same URL must also have `crossOrigin="anonymous"`.
    *   **Why**: Browsers partition the HTTP Cache by CORS mode. An image loaded *with* CORS is invisible to a request *without* CORS, causing a double download.
    *   **Action**: Explicitly check `img.crossOrigin` when creating elements.

2.  **DOM Rehydration over Recreation**
    *   **Rule**: Never use `innerHTML = ''` to update a list if only the *status* of items has changed.
    *   **Why**: Destroying an `<img>` element and creating a new one with the same `src` still causes a micro-flash (layout trashing) and potentially a re-validation request.
    *   **Action**: Use `document.getElementById` or `dataset` to find existing elements. Update `classList` (e.g., `.active`) instead of replacing the node.

3.  **Seamless Transition Strategy (Hero Animation)**
    *   **Rule**: When opening a detail view (Modal) from a list view, NEVER start with a blank placeholder if the image exists in the list.
    *   **Why**: Users hate the "Flash of Unstyled Content".
    *   **Action**:
        *   **Relaxed Matching**: Ignore URL parameters (`?size=...`) when matching list images to detail images.
        *   **Forced Placeholder**: If exact match fails, clone the *nearest available image* (even low-res) from the source card to fill the void immediately while the high-res version loads in the background.

### 🛠 Debugging Heuristics (How to diagnose "Flickering")

If the user reports "images are reloading" or "flashing":

1.  **Suspect CORS First**: Check if the "reloading" request has a different `Sec-Fetch-Mode` than the original request.
2.  **Suspect DOM Thrashing**: Check if the parent container is being cleared (`innerHTML`) on every state change (e.g., selection change).
3.  **Suspect URL Mismatch**: Check if the API returns a slightly different URL (signed/timestamped) than what is in the DOM. Use `url.split('?')[0]` for comparison.

---
*Created after resolving Issue: Tweet Detail Modal image reloading and thumbnail flickering (2025-12-22).*
