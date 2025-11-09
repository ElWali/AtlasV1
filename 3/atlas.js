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

Atlas.TileLayerProto = {
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
    for (var x = startX; x < startX + tilesX; x++) {
      for (var y = startY; y < startY + tilesY; y++) {
        var tileId = zoom + '_' + x + '_' + y;
        newTiles[tileId] = true;
        var tile;
        if (this._tiles[tileId]) {
          tile = this._tiles[tileId];
        } else {
          tile = document.createElement('img');
          tile.className = 'atlas-tile';
          var tileUrl = this._urlTemplate.replace('{z}', zoom).replace('{x}', x).replace('{y}', y).replace('{s}', 'a');
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
  }
};

Atlas.tileLayer = function(urlTemplate, options) {
  var layer = Object.create(Atlas.TileLayerProto);
  layer._urlTemplate = urlTemplate;
  layer._options = options || {};
  return layer;
};

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
  on: function(event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
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

Atlas._latLngToPoint = function(lat, lng, zoom) {
  var scale = 256 * Math.pow(2, zoom);
  var x = (lng + 180) / 360 * scale;
  var sinLat = Math.sin(lat * Math.PI / 180);
  var y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [x, y];
};

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
