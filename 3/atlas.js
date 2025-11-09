/**
 * Injects the necessary CSS for Atlas.js into the document head.
 * @private
 */
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
    .atlas-popup { position: absolute; background: #fff; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; z-index: 2000; pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.2); min-width: 80px; max-width: 200px; font-size: 13px; line-height: 1.4; }
  `;
  document.head.appendChild(style);
}
injectAtlasCSS();

/**
 * The main namespace for the Atlas.js library.
 * @namespace Atlas
 */
window.Atlas = window.Atlas || {};

/**
 * Represents the map object.
 * @private
 */
Atlas.MapProto = {
  /**
   * Sets the view of the map (center and zoom).
   * @param {number[]} center A two-element array of [latitude, longitude].
   * @param {number} zoom The zoom level.
   * @returns {Atlas.MapProto} The map instance.
   */
  setView: function(center, zoom) {
    this._center = center;
    this._zoom = zoom;
    this._update();
    this._fire('move');
    this._fire('zoom');
    return this;
  },

  /**
   * Gets the current center of the map.
   * @returns {number[]} A two-element array of [latitude, longitude].
   */
  getCenter: function() {
    return this._center.slice();
  },

  /**
   * Gets the current zoom level of the map.
   * @returns {number} The current zoom level.
   */
  getZoom: function() {
    return this._zoom;
  },

  /**
   * Adds an event listener to the map.
   * @param {string} event The event type (e.g., 'move', 'zoom').
   * @param {Function} handler The event handler function.
   * @returns {Atlas.MapProto} The map instance.
   */
  on: function(event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
    return this;
  },

  /**
   * Fires an event on the map.
   * @private
   */
  _fire: function(event, data) {
    var handlers = this._events[event];
    if (handlers) {
      handlers.forEach(function(fn) { fn(data); });
    }
  },

  /**
   * Initializes the DOM elements for the map.
   * @private
   */
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
      var startCenterPx = Atlas._latLngToPoint(startCenter[0], startCenter[1], this._zoom);
      var newCenterPx = [startCenterPx[0] - dx, startCenterPx[1] - dy];
      this._center = Atlas._pointToLatLng(newCenterPx[0], newCenterPx[1], this._zoom);
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

    // Double-click to zoom
    this._container.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const newZoom = this._zoom + 1;
      const rect = this._container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      //_latLngToPoint provides the coordinates of the map's center in pixels at a certain zoom level.
      const centerPx = Atlas._latLngToPoint(this._center[0], this._center[1], this._zoom);

      // The pixel coordinates of the click event relative to the map's center.
      const dx = mouseX - rect.width / 2;
      const dy = mouseY - rect.height / 2;

      // The geographical coordinates of the point that was clicked.
      const clickLatLng = Atlas._pointToLatLng(centerPx[0] + dx, centerPx[1] + dy, this._zoom);

      this.setView(clickLatLng, newZoom);
    });

    // Touch support
    let isPinching = false;
    let pinchStartDistance = 0;
    let pinchStartZoom = 0;

    this._container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        startCenter = this._center.slice();
      } else if (e.touches.length === 2) {
        e.preventDefault();
        isDragging = false;
        isPinching = true;
        pinchStartDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoom = this._zoom;
      }
    }, { passive: false });

    this._container.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        e.preventDefault();
        var dx = e.touches[0].clientX - start.x;
        var dy = e.touches[0].clientY - start.y;
        var startCenterPx = Atlas._latLngToPoint(startCenter[0], startCenter[1], this._zoom);
        var newCenterPx = [startCenterPx[0] - dx, startCenterPx[1] - dy];
        this._center = Atlas._pointToLatLng(newCenterPx[0], newCenterPx[1], this._zoom);
        this._update();
        this._fire('move');
      } else if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const zoomFactor = newDistance / pinchStartDistance;
        const newZoom = pinchStartZoom + Math.log2(zoomFactor);
        const roundedZoom = Math.round(newZoom);

        if (roundedZoom !== this._zoom) {
          const rect = this._container.getBoundingClientRect();
          const pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

          const centerPx = Atlas._latLngToPoint(this._center[0], this._center[1], this._zoom);
          const dx = pinchCenterX - rect.width / 2;
          const dy = pinchCenterY - rect.height / 2;

          const pinchLatLng = Atlas._pointToLatLng(centerPx[0] + dx, centerPx[1] + dy, this._zoom);

          this.setView(pinchLatLng, roundedZoom);
        }
      }
    }, { passive: false });

    this._container.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isDragging = false;
        isPinching = false;
      } else if (e.touches.length === 1) {
        isPinching = false;
        isDragging = true;
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        startCenter = this._center.slice();
      }
    }, { passive: false });

    // Responsive
    window.addEventListener('resize', () => this._onResize());
  },

  /**
   * Handles map resizing.
   * @private
   */
  _onResize: function() {
    this._update();
    this._fire('resize');
  },

  /**
   * Updates all layers and markers.
   * @private
   */
  _update: function() {
    this._layers.forEach(layer => layer._renderTiles && layer._renderTiles());
    this._markers.forEach(marker => marker._updatePosition && marker._updatePosition());
  }
};

/**
 * Creates a map instance.
 * @memberof Atlas
 * @param {string|HTMLElement} container The ID of the container element or the element itself.
 * @param {object} options Map options.
 * @param {number[]} options.center The initial center of the map [latitude, longitude].
 * @param {number} options.zoom The initial zoom level.
 * @returns {Atlas.MapProto} The map instance.
 */
Atlas.map = function(container, options) {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('Atlas: Invalid container element.');
  }
  if (!options || typeof options !== 'object') {
    throw new Error('Atlas: Invalid options object.');
  }
  if (!Array.isArray(options.center) || options.center.length !== 2) {
    throw new Error('Atlas: Invalid center coordinates.');
  }
  if (typeof options.zoom !== 'number') {
    throw new Error('Atlas: Invalid zoom level.');
  }

  container.classList.add('atlas-map');
  var map = Object.create(Atlas.MapProto);
  map._container = container;
  map._center = options.center;
  map._zoom = options.zoom;
  map._layers = [];
  map._markers = [];
  map._events = {};
  map._initDOM();
  map.setView(map._center, map._zoom);
  return map;
};

/**
 * Represents a tile layer.
 * @private
 */
Atlas.TileLayerProto = {
  /**
   * Adds the tile layer to the given map.
   * @param {Atlas.MapProto} map The map instance.
   * @returns {Atlas.TileLayerProto} The tile layer instance.
   */
  addTo: function(map) {
    this._map = map;
    map._layers.push(this);
    this._container = document.createElement('div');
    this._container.className = 'atlas-tile-layer';
    map._container.appendChild(this._container);
    this._tiles = {};
    this._renderTiles();
    map.on('move', this._renderTiles.bind(this));
    map.on('zoom', this._renderTiles.bind(this));
    if (this._options.attribution) {
      map._attribution.innerHTML = this._options.attribution;
    }
    return this;
  },

  /**
   * Renders the tiles on the map.
   * @private
   */
  _renderTiles: function() {
    var map = this._map;
    var zoom = map._zoom;
    var center = map._center;
    var size = map._container.getBoundingClientRect();
    var scale = 256 * Math.pow(2, zoom);
    var centerPx = Atlas._latLngToPoint(center[0], center[1], zoom);
    var tilesX = Math.ceil(size.width / 256) + 2;
    var tilesY = Math.ceil(size.height / 256) + 2;
    var startX = Math.floor((centerPx[0] - size.width / 2) / 256);
    var startY = Math.floor((centerPx[1] - size.height / 2) / 256);
    var newTiles = {};
    var maxTiles = Math.pow(2, zoom);

    for (var x = startX; x < startX + tilesX; x++) {
      for (var y = startY; y < startY + tilesY; y++) {
        if (y < 0 || y >= maxTiles) {
          continue;
        }
        var wrappedX = ((x % maxTiles) + maxTiles) % maxTiles;
        var tileId = zoom + '_' + x + '_' + y;
        newTiles[tileId] = true;
        var tile;
        if (this._tiles[tileId]) {
          tile = this._tiles[tileId];
        } else {
          tile = document.createElement('img');
          tile.className = 'atlas-tile';
          tile.onerror = function() {
            this.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
          };
          var tileUrl = this._urlTemplate.replace('{z}', zoom).replace('{x}', wrappedX).replace('{y}', y).replace('{s}', 'a');
          tile.src = tileUrl;
          this._container.appendChild(tile);
          this._tiles[tileId] = tile;
        }
        tile.style.left = x * 256 - centerPx[0] + size.width / 2 + 'px';
        tile.style.top = y * 256 - centerPx[1] + size.height / 2 + 'px';
      }
    }
    for (var tileId in this._tiles) {
      if (!newTiles[tileId]) {
        this._container.removeChild(this._tiles[tileId]);
        delete this._tiles[tileId];
      }
    }
  },

  /**
   * Removes the tile layer from the map.
   */
  remove: function() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    if (this._map) {
      var idx = this._map._layers.indexOf(this);
      if (idx !== -1) this._map._layers.splice(idx, 1);
    }
  }
};

/**
 * Creates a tile layer.
 * @memberof Atlas
 * @param {string} urlTemplate The URL template for the tiles.
 * @param {object} [options] Tile layer options.
 * @param {string} [options.attribution] The attribution text.
 * @returns {Atlas.TileLayerProto} The tile layer instance.
 */
Atlas.tileLayer = function(urlTemplate, options) {
  if (typeof urlTemplate !== 'string') {
    throw new Error('Atlas: Invalid URL template.');
  }
  var layer = Object.create(Atlas.TileLayerProto);
  layer._urlTemplate = urlTemplate;
  layer._options = options || {};
  return layer;
};

/**
 * Represents a marker.
 * @private
 */
Atlas.MarkerProto = {
  /**
   * Adds the marker to the given map.
   * @param {Atlas.MapProto} map The map instance.
   * @returns {Atlas.MarkerProto} The marker instance.
   */
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
      if (this._events['click']) {
        this._events['click'].forEach(handler => handler(e));
      }
    });
    map._container.appendChild(this._el);
    this._updatePosition();
    map.on('move', this._updatePosition.bind(this));
    map.on('zoom', this._updatePosition.bind(this));
    return this;
  },

  /**
   * Adds an event listener to the marker.
   * @param {string} event The event type (e.g., 'click').
   * @param {Function} handler The event handler function.
   * @returns {Atlas.MarkerProto} The marker instance.
   */
  on: function(event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
    return this;
  },

  /**
   * Updates the marker's position on the map.
   * @private
   */
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
  },

  /**
   * Removes the marker from the map.
   */
  remove: function() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    if (this._map) {
      var idx = this._map._markers.indexOf(this);
      if (idx !== -1) this._map._markers.splice(idx, 1);
    }
    if (this._popup) {
      this._popup.parentNode.removeChild(this._popup);
      this._popup = null;
    }
  },

  /**
   * Binds a popup to the marker.
   * @param {string} html The HTML content of the popup.
   * @returns {Atlas.MarkerProto} The marker instance.
   */
  bindPopup: function(html) {
    this._popupHtml = html;
    this._el.addEventListener('click', () => this.openPopup());
    return this;
  },

  /**
   * Opens the popup for the marker.
   */
  openPopup: function() {
    if (!this._popup) {
      this._popup = document.createElement('div');
      this._popup.className = 'atlas-popup';
      this._popup.innerHTML = this._popupHtml;
      this._map._container.appendChild(this._popup);
    }
    var rect = this._el.getBoundingClientRect();
    var mapRect = this._map._container.getBoundingClientRect();
    this._popup.style.left = (rect.left - mapRect.left) + 'px';
    this._popup.style.top = (rect.top - mapRect.top - this._popup.offsetHeight - 5) + 'px';
  }
};

/**
 * Creates a marker.
 * @memberof Atlas
 * @param {number[]} latlng The marker's coordinates [latitude, longitude].
 * @param {object} [options] Marker options.
 * @param {string} [options.icon] The URL to a custom marker icon.
 * @param {string} [options.title] The title of the marker (tooltip).
 * @returns {Atlas.MarkerProto} The marker instance.
 */
Atlas.marker = function(latlng, options) {
  if (!Array.isArray(latlng) || latlng.length !== 2) {
    throw new Error('Atlas: Invalid marker coordinates.');
  }
  var marker = Object.create(Atlas.MarkerProto);
  marker._latlng = latlng;
  marker._options = options || {};
  marker._events = {};
  return marker;
};

/**
 * Converts latitude/longitude to pixel coordinates.
 * @private
 */
Atlas._latLngToPoint = function(lat, lng, zoom) {
  var scale = 256 * Math.pow(2, zoom);
  var x = (lng + 180) / 360 * scale;
  var sinLat = Math.sin(lat * Math.PI / 180);
  var y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [x, y];
};

/**
 * Converts pixel coordinates to latitude/longitude.
 * @private
 */
Atlas._pointToLatLng = function(x, y, zoom) {
  var scale = 256 * Math.pow(2, zoom);
  var lng = (x / scale * 360) - 180;
  var n = Math.PI - 2 * Math.PI * y / scale;
  var lat = (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
  return [lat, lng];
};

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
