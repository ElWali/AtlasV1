# AGENTS.md

## Agent: Jules (Google AI)

---

## Project: Atlas.js

---

### 1. Overview

Atlas.js is a lightweight, dependency-free, browser-based mapping library. It must be delivered as a single JavaScript file (`atlas.js`) that includes all required CSS (injected at runtime). The library must provide a clean, modern API for embedding interactive maps, tile layers, and markers in web pages. **No references to Leaflet.js or any other mapping library are allowed.**

---

## 2. Critical Components: Full Implementations

---

### 2.1. CSS Injection

**Purpose:**  
Ensure all required styles are present without a separate CSS file.

**Full Code:**
```js
function injectAtlasCSS() {
  if (document.getElementById('atlas-style')) return;
  var style = document.createElement('style');
  style.id = 'atlas-style';
  style.innerHTML = `
    .atlas-map { position: relative; overflow: hidden; background: #e5e3df; user-select: none; }
    .atlas-tile-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .atlas-tile { position: absolute; width: 256px; height: 256px; }
    .atlas-marker { position: absolute; transform: translate(-50%, -100%); cursor: pointer; z-index: 10; }
    .atlas-marker img { width: 25px; height: 41px; }
    .atlas-zoom-control { position: absolute; top: 10px; left: 10px; background: #fff; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.3); z-index: 1000; }
    .atlas-zoom-btn { display: block; width: 30px; height: 30px; line-height: 30px; text-align: center; font-size: 18px; cursor: pointer; border: none; background: none; }
    .atlas-zoom-btn:active { background: #eee; }
    .atlas-attribution { position: absolute; bottom: 0; right: 0; background: rgba(255,255,255,0.7); font-size: 11px; padding: 2px 8px; border-radius: 4px 0 0 0; z-index: 1000; }
  `;
  document.head.appendChild(style);
}
injectAtlasCSS();
```
**Explanation:**  
This function injects all necessary CSS for the map, tiles, markers, and controls. It ensures the CSS is only added once.

---

### 2.2. Map Initialization and Rendering

**Purpose:**  
Create a map instance, set up the container, and handle resizing.

**Full Code:**
```js
window.Atlas = window.Atlas || {};

Atlas.MapProto = {
  setView: function(center, zoom) {
    this._center = center;
    this._zoom = zoom;
    this._update();
    this._fire('move');
    this._fire('zoom');
    return this;
  },
  getCenter: function() {
    return this._center.slice();
  },
  getZoom: function() {
    return this._zoom;
  },
  on: function(event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
    return this;
  },
  _fire: function(event, data) {
    var handlers = this._events[event];
    if (handlers) {
      handlers.forEach(function(fn) { fn(data); });
    }
  },
  _initDOM: function() {
    // Controls
    var zoomControl = document.createElement('div');
    zoomControl.className = 'atlas-zoom-control';
    var zoomIn = document.createElement('button');
    zoomIn.className = 'atlas-zoom-btn';
    zoomIn.innerHTML = '+';
    var zoomOut = document.createElement('button');
    zoomOut.className = 'atlas-zoom-btn';
    zoomOut.innerHTML = '-';
    zoomControl.appendChild(zoomIn);
    zoomControl.appendChild(zoomOut);
    this._container.appendChild(zoomControl);
    zoomIn.onclick = () => this.setView(this._center, this._zoom + 1);
    zoomOut.onclick = () => this.setView(this._center, this._zoom - 1);

    // Attribution
    var attribution = document.createElement('div');
    attribution.className = 'atlas-attribution';
    attribution.innerHTML = '';
    this._container.appendChild(attribution);
    this._attribution = attribution;

    // Drag to pan
    let isDragging = false, start = null, startCenter = null;
    this._container.addEventListener('mousedown', (e) => {
      isDragging = true;
      start = {x: e.clientX, y: e.clientY};
      startCenter = this._center.slice();
      document.body.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      var scale = 256 * Math.pow(2, this._zoom);
      var size = this._container.getBoundingClientRect();
      var lng = startCenter[1] - dx / scale * 360;
      var lat = startCenter[0] + dy / scale * 170; // Approximate
      this._center = [lat, lng];
      this._update();
      this._fire('move');
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
      document.body.style.cursor = '';
    });

    // Scroll to zoom
    this._container.addEventListener('wheel', (e) => {
      e.preventDefault();
      var delta = e.deltaY < 0 ? 1 : -1;
      this.setView(this._center, this._zoom + delta);
    });

    // Responsive
    window.addEventListener('resize', () => this._onResize());
  },
  _onResize: function() {
    this._update();
    this._fire('resize');
  },
  _update: function() {
    // Update all layers and markers
    this._layers.forEach(layer => layer._renderTiles && layer._renderTiles());
    this._markers.forEach(marker => marker._updatePosition && marker._updatePosition());
  }
};

Atlas.map = function(container, options) {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container) throw new Error('Atlas: Container not found');
  container.classList.add('atlas-map');
  var map = Object.create(Atlas.MapProto);
  map._container = container;
  map._center = options.center || [0, 0];
  map._zoom = options.zoom || 0;
  map._layers = [];
  map._markers = [];
  map._events = {};
  map._initDOM();
  map.setView(map._center, map._zoom);
  return map;
};
```
**Explanation:**  
This code sets up the map, controls, drag-to-pan, scroll-to-zoom, and ensures all layers and markers update on view changes.

---

### 2.3. Tile Layer Management

**Purpose:**  
Display map tiles based on a URL template, handle panning and zooming.

**Full Code:**
```js
Atlas.TileLayerProto = {
  addTo: function(map) {
    this._map = map;
    map._layers.push(this);
    this._container = document.createElement('div');
    this._container.className = 'atlas-tile-layer';
    map._container.appendChild(this._container);
    this._renderTiles();
    map.on('move', this._renderTiles.bind(this));
    map.on('zoom', this._renderTiles.bind(this));
    // Attribution
    if (this._options.attribution) {
      map._attribution.innerHTML = this._options.attribution;
    }
    return this;
  },
  _renderTiles: function() {
    var map = this._map;
    var zoom = map._zoom;
    var center = map._center;
    var size = map._container.getBoundingClientRect();
    var scale = 256 * Math.pow(2, zoom);
    var centerPx = Atlas._latLngToPoint(center[0], center[1], zoom);
    var tilesX = Math.ceil(size.width / 256) + 2;
    var tilesY = Math.ceil(size.height / 256) + 2;
    var startX = Math.floor((centerPx[0] - size.width/2) / 256);
    var startY = Math.floor((centerPx[1] - size.height/2) / 256);

    // Remove old tiles
    while (this._container.firstChild) this._container.removeChild(this._container.firstChild);

    for (var x = startX; x < startX + tilesX; x++) {
      for (var y = startY; y < startY + tilesY; y++) {
        var tile = document.createElement('img');
        tile.className = 'atlas-tile';
        var tileUrl = this._urlTemplate
          .replace('{z}', zoom)
          .replace('{x}', x)
          .replace('{y}', y)
          .replace('{s}', 'a');
        tile.src = tileUrl;
        tile.style.left = (x * 256 - centerPx[0] + size.width/2) + 'px';
        tile.style.top = (y * 256 - centerPx[1] + size.height/2) + 'px';
        this._container.appendChild(tile);
      }
    }
  }
};

Atlas.tileLayer = function(urlTemplate, options) {
  var layer = Object.create(Atlas.TileLayerProto);
  layer._urlTemplate = urlTemplate;
  layer._options = options || {};
  return layer;
};
```
**Explanation:**  
This code calculates which tiles are visible, creates image elements for them, and positions them correctly. It also updates tiles on map movement or zoom.

---

### 2.4. Marker Support

**Purpose:**  
Allow users to add markers at specific coordinates, with optional custom icons and events.

**Full Code:**
```js
Atlas.MarkerProto = {
  addTo: function(map) {
    this._map = map;
    map._markers.push(this);
    this._el = document.createElement('div');
    this._el.className = 'atlas-marker';
    if (this._options.icon) {
      var img = document.createElement('img');
      img.src = this._options.icon;
      this._el.appendChild(img);
    } else {
      this._el.style.background = 'red';
      this._el.style.width = '20px';
      this._el.style.height = '20px';
      this._el.style.borderRadius = '50%';
      this._el.style.border = '2px solid #fff';
      this._el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
    }
    if (this._options.title) this._el.title = this._options.title;
    this._el.addEventListener('click', (e) => {
      if (this._events['click']) this._events['click'](e);
    });
    map._container.appendChild(this._el);
    this._updatePosition();
    map.on('move', this._updatePosition.bind(this));
    map.on('zoom', this._updatePosition.bind(this));
    return this;
  },
  on: function(event, handler) {
    this._events[event] = handler;
    return this;
  },
  _updatePosition: function() {
    var map = this._map;
    var zoom = map._zoom;
    var size = map._container.getBoundingClientRect();
    var centerPx = Atlas._latLngToPoint(map._center[0], map._center[1], zoom);
    var markerPx = Atlas._latLngToPoint(this._latlng[0], this._latlng[1], zoom);
    var left = markerPx[0] - centerPx[0] + size.width/2;
    var top = markerPx[1] - centerPx[1] + size.height/2;
    this._el.style.left = left + 'px';
    this._el.style.top = top + 'px';
  }
};

Atlas.marker = function(latlng, options) {
  var marker = Object.create(Atlas.MarkerProto);
  marker._latlng = latlng;
  marker._options = options || {};
  marker._events = {};
  return marker;
};
```
**Explanation:**  
This code creates a marker, supports custom icons, attaches it to the map, and updates its position on map movement or zoom.

---

### 2.5. Coordinate Conversion

**Purpose:**  
Convert between latitude/longitude and pixel coordinates for tile and marker placement.

**Full Code:**
```js
Atlas._latLngToPoint = function(lat, lng, zoom) {
  var scale = 256 * Math.pow(2, zoom);
  var x = (lng + 180) / 360 * scale;
  var sinLat = Math.sin(lat * Math.PI / 180);
  var y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [x, y];
};
```
**Explanation:**  
This function uses the Web Mercator projection to convert latitude and longitude to pixel coordinates at a given zoom level.

---

### 2.6. Event System

**Purpose:**  
Allow users to listen for map and marker events (e.g., `click`, `move`, `zoom`).

**Full Code:**  
(Already included in MapProto and MarkerProto above.)

---

### 2.7. Example Usage

```javascript
/*
Example Usage:

// HTML:
<div id="map" style="width: 600px; height: 400px;"></div>

// JavaScript:
var map = Atlas.map('map', {
  center: [51.505, -0.09],
  zoom: 13
});
Atlas.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
Atlas.marker([51.5, -0.09], { title: 'A marker!' }).addTo(map);
*/
```

---

## 3. Testing & Validation

- Test all features in major browsers.
- Test with different tile providers and custom markers.
- Test responsiveness and interactivity.
- Test event system and error handling.

---

## 4. Documentation

- All public methods and options must be documented in code comments.
- Include a usage example at the top of the file.
- Provide clear instructions for integration and usage.

---

## 5. Prohibited Actions

- Do not copy or reference any code, comments, or documentation from Leaflet.js or any other mapping library.
- Do not use any third-party libraries or frameworks.
- Do not mention Leaflet.js or any other mapping library in any part of the code, comments, or documentation.

---

## 6. Deliverable

- A single file named `atlas.js` containing:
  - All JavaScript code
  - All required CSS (injected at runtime)
  - Usage example and documentation in comments
- No external dependencies or references.

---

## 7. Completion Criteria

- The `atlas.js` file must implement all features and requirements described above.
- The file must be self-contained, original, and production-ready.
- The code must be clean, modular, and well-documented.
- The API must be intuitive and easy to use for web developers.

---

**End of AGENTS.md**
