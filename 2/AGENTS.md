# AGENTS.md  
**Automated Guardrails & Fix Instructions for `atlas.js`**

This document defines clear guidelines for AI agents or developers tasked with identifying, verifying, and fixing bugs in `atlas.js`—a **single-file, zero-dependency, professional-grade JavaScript mobile-friendly mapping library**.

---

## 🎯 Project Constraints (MUST PRESERVE)

1. **Single-file architecture**:  
   - All code (logic + minimal required CSS) must remain in **one `.js` file**.
   - No external dependencies or imports.
   - CSS may be injected dynamically if necessary for UI functionality but must be self-contained.

2. **Zero runtime dependencies**:  
   - Must work in any modern browser with no build step.
   - Must not rely on bundlers, transpilers, or module systems.

3. **Backward API compatibility**:  
   - Public APIs (`Atlas`, `TileLayer`, `GeoJSONLayer`, `AtlasMarker`, etc.) must not change signature or behavior unless to fix a critical bug.
   - Constructor options, method names, and event names must stay consistent.

4. **Performance & correctness**:  
   - Tile loading, caching, and rendering must be efficient and bounded.
   - Coordinate projections must follow Web Mercator (EPSG:3857) standards.
   - All user interactions (pan, zoom, rotate, drag) must feel responsive and accurate.

---

## 🐞 Bug Identification Protocol

### Step 1: Reproduce the Issue
- Confirm the bug is **not** caused by:
  - Invalid user input (e.g., malformed GeoJSON, out-of-bounds coordinates).
  - Network issues (tile servers are external; failures must be handled gracefully).
  - Browser-specific quirks (test in Chrome, Firefox, Safari, Edge).

### Step 2: Classify the Bug

| Category | Description | Examples |
|--------|-------------|--------|
| **Rendering** | Visual glitches, misaligned tiles/markers, missing elements | Marker offset wrong after rotate; popup clipped |
| **Interaction** | Pan/zoom/drag/rotate not working as expected | Inertia too strong; pinch zoom jumps |
| **Projection** | Latitude/longitude ↔ pixel math errors | `screenToLatLon` returns invalid coords |
| **Memory / Leak** | Unbounded caches, event listeners not removed | Tile cache grows infinitely; handlers leak on destroy |
| **Accessibility** | Missing ARIA, keyboard nav, focus states | Zoom buttons not keyboard-focusable |
| **Edge Cases** | Antarctica, dateline, max zoom, rapid resize | Wrapping at ±180° longitude fails |

### Step 3: Verify Against Specification
- Cross-check behavior with:
  - **OpenStreetMap** and **Leaflet** as reference implementations.
  - **GIS standards** for Web Mercator, zoom levels, DPI handling.
  - **WCAG 2.1** for controls (keyboard, focus, labels).

---

## 🔧 Fix Guidelines

### ✅ Allowed Fixes
- **Logic corrections**: Fix math in projection, drag delta, zoom interpolation.
- **Guard clauses**: Add input validation (e.g., clamp lat/lng, guard against NaN).
- **Memory hygiene**: Ensure `destroy()` cleans up RAFs, event listeners, caches.
- **Race condition fixes**: Use AbortController properly for tile loads.
- **CSS tweaks**: Minor adjustments to popup/marker positioning if broken.
- **Error resilience**: Log warnings (not throw) for non-critical failures (e.g., tile 404).

### ❌ Forbidden Changes
- **Splitting the file** into modules or multiple scripts.
- **Adding external libraries** (e.g., D3, Lodash, proj4).
- **Changing public API signatures** (e.g., renaming `flyTo()` to `animateTo()`).
- **Altering core architecture** (e.g., replacing canvas with SVG or WebGL).
- **Removing features** (e.g., killing GeoJSON support to “simplify”).
- **Modifying license/attribution logic** (must preserve tile provider compliance).

---

## 🧪 Validation Checklist After Fix

Before merging any change:

- [ ] **Geolocation fallback** still works when denied/unavailable.
- [ ] **Tile switching** (OSM ↔ ESRI) works without flicker or memory leak.
- [ ] **Resize handler** correctly updates DPR and canvas on window resize.
- [ ] **All controls** update state (e.g., zoom buttons disable at min/max zoom).
- [ ] **Popups and markers** reposition correctly after pan/zoom/rotate.
- [ ] **Keyboard navigation** (`Arrow`, `+`, `-`, `N`, `R`, `L`, `S`) remains functional.
- [ ] **Touch gestures** (pinch, double-tap, drag) work on mobile.
- [ ] **No console errors** under normal usage (warnings OK for tile fails).
- [ ] **Performance**: 60 FPS during pan/zoom on mid-tier devices.

---

## 🚨 Critical Non-Negotiables

- **Do not break the initialization flow**:
  ```js
  const map = new Atlas("map");
  ```
  This must always work with a `<canvas id="map">` inside `#map-container`.

- **Do not remove or alter the attribution notice** or tile usage warnings.

- **Preserve the embedded SVG marker**—do not replace with external images.

- **Retain `CONFIG.retina` auto-detection** and `@2x` logic.

---

## 📦 Final Output Requirement

> Any fix must result in **one updated `atlas.js` file** that:
> - Passes all validation checks above.
> - Is **drop-in compatible** with existing HTML that uses the old version.
> - Contains **no debug artifacts** (`console.log`, dev comments, unused code).

---

Maintain the spirit of **Atlas.js**: a self-contained, professional, and elegant mapping solution for developers who value simplicity, control, and performance.
