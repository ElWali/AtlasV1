    // --- Constants ---
    const EARTH_RADIUS = 6378137;
    const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS;
    const MAX_LATITUDE = 85.05112878;
    const MIN_LATITUDE = -85.05112878;
    const TILE_SIZE = 256;
    const TILE_BUFFER = 3;
    const TILE_TTL = 1000 * 60 * 60 * 24; // 24 hours
    const TILE_LOAD_TIMEOUT_MS = 10000; // 10 seconds timeout for tile loading
    const SCALE_BAR_TARGET_PX = 120;
    const INERTIA_DECEL = 0.0025;
    const INERTIA_STOP_SPEED = 0.02;
    const VELOCITY_WINDOW_MS = 120;
    const DOUBLE_TAP_MAX_DELAY = 300;
    const DOUBLE_TAP_MAX_MOVE = 16;
    const TWO_FINGER_TAP_MAX_DELAY = 250;
    const TWO_FINGER_TAP_MOVE_THRESH = 10;
    const ROTATE_MOVE_THRESH_RAD = 0.08;
    const WHEEL_ZOOM_STEP = 0.25;
    const WHEEL_ZOOM_DURATION = 220;
    const TAP_ZOOM_DURATION = 280;
    const SNAP_DURATION = 300;
    const FLYTO_DURATION = 800;

    // --- Layer Configuration ---
    const LAYERS = {
      OSM: {
        name: "OpenStreetMap",
        minZoom: 0,
        maxZoom: 19,
        tileServers: ["https://a.tile.openstreetmap.org", "https://b.tile.openstreetmap.org", "https://c.tile.openstreetmap.org"],
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        background: "#e6e6e6",
        supportsRetina: true,
        maxCacheSize: 500
      },
      ESRI: {
        name: "Esri Satellite",
        minZoom: 0,
        maxZoom: 19,
        tileServers: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile"],
        attribution: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">Esri World Imagery</a>',
        background: "#000000",
        supportsRetina: false,
        maxCacheSize: 400
      }
    };

    // --- Configuration ---
    const CONFIG = {
      defaultLayer: "OSM",
      defaultCenter: { lon: 0, lat: 0 },
      defaultZoom: 3,
      retina: "auto",
      retinaSuffix: "@2x"
    };

    // --- Easing Functions ---
    const EASING = {
      easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
      easeOutCubic: t => 1 - Math.pow(1 - t, 3),
      linear: t => t
    };

    const RAD2DEG = 180 / Math.PI;
    const DEG2RAD = Math.PI / 180;

    // --- Utility Functions ---
    const normalizeAngle = rad => Math.atan2(Math.sin(rad), Math.cos(rad));
    const shortestAngleDiff = (from, to) => normalizeAngle(to - from);
    const wrapDeltaLon = delta => (((delta + 180) % 360) + 360) % 360 - 180;
    const rot = (x, y, ang) => {
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        return { x: x * c - y * s, y: x * s + y * c };
    };

    // --- NEW: Projection System ---
    /**
     * Base class for projections. Defines the interface for transforming between
     * geographical coordinates (latitude, longitude) and projected coordinates (x, y).
     * @class Projection
     */
    class Projection {
      /**
       * Transforms a geographical coordinate (lat, lon) into a 2D point (x, y)
       * in the projection's coordinate space.
       * @param {object} latlng - The geographical coordinate.
       * @param {number} latlng.lat - The latitude.
       * @param {number} latlng.lon - The longitude.
       * @returns {object} The projected point.
       * @throws {Error} If the method is not implemented by a subclass.
       */
      project(latlng) {
        throw new Error('project() must be implemented by subclass');
      }

      /**
       * Transforms a 2D point (x, y) in the projection's coordinate space back
       * into a geographical coordinate (lat, lon).
       * @param {object} point - The projected point.
       * @param {number} point.x - The x-coordinate.
       * @param {number} point.y - The y-coordinate.
       * @returns {object} The geographical coordinate.
       * @throws {Error} If the method is not implemented by a subclass.
       */
      unproject(point) {
        throw new Error('unproject() must be implemented by subclass');
      }
    }

    /**
     * Implements the Web Mercator projection (EPSG:3857), the standard for most web maps.
     * @class WebMercatorProjection
     * @extends Projection
     */
    class WebMercatorProjection extends Projection {
      /**
       * Creates an instance of WebMercatorProjection.
       */
      constructor() {
        super();
      }

      /**
       * Converts a LatLng object to a Point in Web Mercator meters.
       * @param {object} latlng - The geographical coordinate.
       * @param {number} latlng.lat - The latitude.
       * @param {number} latlng.lon - The longitude.
       * @returns {object} The projected point in meters.
       */
      project(latlng) {
        const d = EARTH_RADIUS;
        const maxLat = MAX_LATITUDE;
        const lat = Math.max(Math.min(maxLat, latlng.lat), -maxLat);
        const sin = Math.sin(lat * DEG2RAD);
        return {
          x: d * latlng.lon * DEG2RAD,
          y: d * Math.log((1 + sin) / (1 - sin)) / 2
        };
      }

      /**
       * Converts a Point in Web Mercator meters back to a LatLng object.
       * @param {object} point - The projected point in meters.
       * @param {number} point.x - The x-coordinate.
       * @param {number} point.y - The y-coordinate.
       * @returns {object} The geographical coordinate.
       */
      unproject(point) {
        const d = EARTH_RADIUS;
        return {
          lon: (point.x / d) * RAD2DEG,
          lat: (2 * Math.atan(Math.exp(point.y / d)) - (Math.PI / 2)) * RAD2DEG
        };
      }

      /**
       * Converts a LatLng object to a Tile coordinate at a specific zoom level.
       * This is a convenience method that chains project() and the scale calculation.
       * @param {object} latlng - The geographical coordinate.
       * @param {number} latlng.lat - The latitude.
       * @param {number} latlng.lon - The longitude.
       * @param {number} zoom - The zoom level.
       * @returns {object} The tile coordinate.
       */
      latLngToTile(latlng, zoom) {
        const scale = Math.pow(2, zoom);
        const projected = this.project(latlng);
        return {
          x: (projected.x + Math.PI * EARTH_RADIUS) / (2 * Math.PI * EARTH_RADIUS) * scale,
          y: (Math.PI * EARTH_RADIUS - projected.y) / (2 * Math.PI * EARTH_RADIUS) * scale
        };
      }

      /**
       * Converts a Tile coordinate at a specific zoom level back to a LatLng object.
       * This is a convenience method that chains the scale calculation and unproject().
       * @param {number} x - The x-coordinate of the tile.
       * @param {number} y - The y-coordinate of the tile.
       * @param {number} zoom - The zoom level.
       * @returns {object} The geographical coordinate.
       */
      tileToLatLng(x, y, zoom) {
        const scale = Math.pow(2, zoom);
        const projected = {
          x: x / scale * 2 * Math.PI * EARTH_RADIUS - Math.PI * EARTH_RADIUS,
          y: Math.PI * EARTH_RADIUS - y / scale * 2 * Math.PI * EARTH_RADIUS
        };
        return this.unproject(projected);
      }
    }

    // Create a global instance of the default projection.
    const DEFAULT_PROJECTION = new WebMercatorProjection();

    /**
     * A utility class for Geographical Information System (GIS) functions.
     * @class GISUtils
     */
    class GISUtils {
      /**
       * Converts degrees to radians.
       * @param {number} d - The angle in degrees.
       * @returns {number} The angle in radians.
       */
      static toRadians(d) { return d * Math.PI / 180; }

      /**
       * Converts radians to degrees.
       * @param {number} r - The angle in radians.
       * @returns {number} The angle in degrees.
       */
      static toDegrees(r) { return r * 180 / Math.PI; }

      /**
       * Wraps a longitude value to the range [-180, 180].
       * @param {number} l - The longitude value.
       * @returns {number} The wrapped longitude.
       */
      static wrapLongitude(l) {
        while (l > 180) l -= 360;
        while (l < -180) l += 360;
        return l;
      }

      /**
       * Clamps a latitude value to the valid range.
       * @param {number} lat - The latitude value.
       * @returns {number} The clamped latitude.
       */
      static clampLatitude(lat) {
        return Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, lat));
      }

      /**
       * Calculates the map resolution in meters per pixel.
       * @param {number} lat - The latitude.
       * @param {number} z - The zoom level.
       * @returns {number} The resolution.
       */
      static getResolution(lat, z) {
        return (EARTH_CIRCUMFERENCE * Math.cos(this.toRadians(lat))) / (Math.pow(2, z) * TILE_SIZE);
      }

      /**
       * Formats a distance in meters to a human-readable string.
       * @param {number} m - The distance in meters.
       * @returns {string} The formatted distance.
       */
      static formatDistance(m) {
        return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
      }

      /**
       * This method is now a wrapper around the projection's method for backward compatibility.
       * @param {number} x - The x-coordinate of the tile.
       * @param {number} y - The y-coordinate of the tile.
       * @param {number} z - The zoom level.
       * @returns {object} The geographical coordinate.
       * @deprecated
       */
      static tileToLonLat(x, y, z) {
        return DEFAULT_PROJECTION.tileToLatLng(x, y, z);
      }
    }

    /**
     * Base class for all layer types.
     * @class Layer
     */
    class Layer {
      /**
       * Creates an instance of Layer.
       * @param {object} [options={}] - The layer options.
       */
      constructor(options = {}) {
        this.options = options;
        this._map = null;
        this._events = {};
      }

      /**
       * Adds the layer to the given map.
       * @param {Atlas} map - The map instance.
       * @returns {Layer} The current layer instance.
       */
      addTo(map) {
        if (this._map) {
          this._map.removeLayer(this);
        }
        this._map = map;
        map.addLayer(this);
        return this;
      }

      /**
       * Removes the layer from the map.
       * @returns {Layer} The current layer instance.
       */
      remove() {
        if (this._map) {
          this._map.removeLayer(this);
          this._map = null;
        }
        return this;
      }

      /**
       * Adds an event listener to the layer.
       * @param {string} type - The event type.
       * @param {Function} fn - The event listener function.
       * @returns {Layer} The current layer instance.
       */
      on(type, fn) {
        if (!this._events[type]) {
          this._events[type] = [];
        }
        this._events[type].push(fn);
        return this;
      }

      /**
       * Removes an event listener from the layer.
       * @param {string} type - The event type.
       * @param {Function} [fn] - The event listener function. If not provided, all listeners for the type are removed.
       * @returns {Layer} The current layer instance.
       */
      off(type, fn) {
        if (!this._events[type]) return this;
        if (!fn) {
          this._events[type] = [];
        } else {
          this._events[type] = this._events[type].filter(cb => cb !== fn);
        }
        return this;
      }

      /**
       * Fires an event on the layer.
       * @param {string} type - The event type.
       * @param {object} [data={}] - The event data.
       */
      fire(type, data = {}) {
        if (!this._events[type]) return;
        data.type = type;
        data.target = this;
        this._events[type].forEach(fn => fn(data));
      }

      /**
       * Called when the layer is added to the map.
       */
      onAdd() { }

      /**
       * Called when the layer is removed from the map.
       */
      onRemove() { }

      /**
       * Renders the layer on the map.
       */
      render() { }
    }

    /**
     * A layer for displaying tiled map data.
     * @class TileLayer
     * @extends Layer
     */
    class TileLayer extends Layer {
      /**
       * Creates an instance of TileLayer.
       * @param {string} urlTemplate - The URL template for the tiles.
       * @param {object} [options={}] - The tile layer options.
       */
      constructor(urlTemplate, options = {}) {
        super(options);
        this.urlTemplate = urlTemplate;
        this.options = {
          minZoom: options.minZoom || 0,
          maxZoom: options.maxZoom || 18,
          attribution: options.attribution || '',
          background: options.background || '#ffffff',
          supportsRetina: options.supportsRetina || false,
          maxCacheSize: options.maxCacheSize || 500,
          ...options
        };
        this.tileCache = new Map();
        this.loadingTiles = new Set();
        this.loadingControllers = new Map();
        this._retinaAvailable = true;
      }

      _getTileUrl(x, y, z) {
        const scale = Math.pow(2, z);
        // Robustly wrap the X coordinate to [0, scale)
        let wrappedX = ((x % scale) + scale) % scale;
        const intX = Math.floor(wrappedX);
        const intY = Math.max(0, Math.min(scale - 1, Math.floor(y)));
        let url = this.urlTemplate.replace('{z}', z).replace('{x}', intX).replace('{y}', intY);
        if (this.options.supportsRetina && this._shouldRequestRetina()) {
          url += CONFIG.retinaSuffix;
        }
        return url;
      }

      _shouldRequestRetina() {
        const mode = CONFIG.retina;
        const want = (mode === true) || (mode === "auto" && (window.devicePixelRatio || 1) > 1.5);
        return want && this._retinaAvailable;
      }

      async _loadTile(key, url) {
        if (this.tileCache.has(key)) return this.tileCache.get(key);
        const controller = new AbortController();
        const signal = controller.signal;
        this.loadingControllers.set(key, controller);
        const img = new Image();
        img.crossOrigin = "anonymous";
        const tile = { img, loaded: false, loadedAt: Date.now(), lastUsed: Date.now(), controller };
        this.tileCache.set(key, tile);
        this.loadingTiles.add(key);

        const start = performance.now();
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            if (this.loadingTiles.has(key)) {
              controller.abort();
              console.warn(`[Atlas] Tile load timeout for: ${url}`);
              this.loadingTiles.delete(key);
              this.loadingControllers.delete(key);
              if (this.tileCache.has(key)) {
                this.tileCache.delete(key);
              }
              this.fire('tileerror', { tile: key, url, error: new Error('Timeout') });
              reject(new Error(`Timeout loading tile: ${url}`));
            }
          }, TILE_LOAD_TIMEOUT_MS);
        });

        const loadPromise = new Promise((resolve, reject) => {
          img.onload = () => {
            clearTimeout(timeoutId);
            const loadTime = performance.now() - start;
            console.log(`[Atlas] Tile ${key} loaded in ${loadTime.toFixed(2)}ms`);
            tile.loaded = true;
            tile.loadedAt = Date.now();
            this.loadingTiles.delete(key);
            this.loadingControllers.delete(key);
            if (this._map) {
              this._map.scheduleRender();
            }
            this.fire('tileload', { tile: key, url });
            resolve(tile);
          };

          img.onerror = (e) => {
            clearTimeout(timeoutId);
            if (signal.aborted) return;
            console.warn(`[Atlas] Failed to load tile: ${url}`, e);
            if (this.options.supportsRetina && url.includes(CONFIG.retinaSuffix)) {
              this._retinaAvailable = false;
              const nonRetinaUrl = url.replace(CONFIG.retinaSuffix, "");
              img.src = nonRetinaUrl;
              return;
            }
            this.loadingTiles.delete(key);
            this.loadingControllers.delete(key);
            this.fire('tileerror', { tile: key, url, error: e });
            reject(e);
          };

          img.src = url;
        });

        try {
          await Promise.race([loadPromise, timeoutPromise]);
        } catch (error) {
          if (!signal.aborted) {
            console.error("[Atlas] Tile loading failed or timed out:", error.message);
          }
          throw error;
        }

        return tile;
      }

      _reloadTile(key, url) {
        const existing = this.tileCache.get(key);
        if (!existing) return;
        const token = key + "#r";
        if (this.loadingTiles.has(token)) return;

        const doReload = () => {
          const controller = new AbortController();
          const img = new Image();
          img.crossOrigin = "anonymous";
          this.loadingTiles.add(token);

          img.onload = () => {
            existing.img = img;
            existing.loaded = true;
            existing.loadedAt = Date.now();
            this.loadingTiles.delete(token);
            if (this._map) {
              this._map.scheduleRender();
            }
          };

          img.onerror = () => {
            this.loadingTiles.delete(token);
          };

          img.src = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(doReload, { timeout: 2000 });
        } else {
          setTimeout(doReload, 100);
        }
      }

      _evict() {
        if (this.tileCache.size <= this.options.maxCacheSize) return;
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => this._performEviction(), { timeout: 2000 });
        } else {
          setTimeout(() => this._performEviction(), 100);
        }
      }

      _performEviction() {
        if (this.tileCache.size <= this.options.maxCacheSize) return;
        const entries = Array.from(this.tileCache.entries());
        entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        const removeCount = this.tileCache.size - this.options.maxCacheSize;
        for (let i = 0; i < removeCount; i++) {
          this.tileCache.delete(entries[i][0]);
        }
      }

      _preloadAdjacentZoomTiles() {
        if (!this._map) return;
        const zInt = Math.floor(this._map.zoom);
        const nextZoom = Math.min(this.options.maxZoom, zInt + 1);
        const prevZoom = Math.max(this.options.minZoom, zInt - 1);

        if (Math.abs(this._map.zoom - zInt) > 0.3) return;

        // Use wrapped longitude to prevent loading tiles from adjacent worlds
        const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
        const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);
        const ts = TILE_SIZE;
        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        const viewportTiles = Math.ceil(Math.max(w, h) / ts) + TILE_BUFFER;

        for (let dz of [prevZoom, nextZoom]) {
          if (dz === zInt) continue;
          const scaleDiff = Math.pow(2, Math.abs(dz - zInt));
          const startX = Math.floor(ct.x * (dz > zInt ? scaleDiff : 1 / scaleDiff) - viewportTiles / 2);
          const startY = Math.floor(ct.y * (dz > zInt ? scaleDiff : 1 / scaleDiff) - viewportTiles / 2);

          for (let dx = 0; dx < viewportTiles; dx++) {
            for (let dy = 0; dy < viewportTiles; dy++) {
              const X = startX + dx, Y = startY + dy;
              const key = `${dz}/${X}/${Y}`;
              if (!this.tileCache.has(key) && !this.loadingTiles.has(key)) {
                const url = this._getTileUrl(X, Y, dz);
                this._loadTile(key, url);
              }
            }
          }
        }
      }

      render() {
        if (!this._map) return;

        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        const zInt = Math.floor(this._map.zoom);
        const scaleFactor = Math.pow(2, this._map.zoom - zInt);
        const ts = TILE_SIZE;

        // Use wrapped longitude to anchor the tile grid, preventing "split world" artifacts
        const wrappedCenterLon = GISUtils.wrapLongitude(this._map.center.lon);
        const ct = this._map.projection.latLngToTile({ lat: this._map.center.lat, lon: wrappedCenterLon }, zInt);

        const absCos = Math.abs(Math.cos(this._map.bearing)), absSin = Math.abs(Math.sin(this._map.bearing));
        const needW = w * absCos + h * absSin;
        const needH = w * absSin + h * absCos;

        const cols = Math.ceil(needW / (ts * scaleFactor)) + TILE_BUFFER;
        const rows = Math.ceil(needH / (ts * scaleFactor)) + TILE_BUFFER;

        const startX = Math.floor(ct.x - cols / 2);
        const startY = Math.floor(ct.y - rows / 2);
        const maxTileY = Math.pow(2, zInt);

        const tiles = [];
        for (let dx = 0; dx < cols; dx++) {
          for (let dy = 0; dy < rows; dy++) {
            const X = startX + dx, Y = startY + dy;
            if (Y < 0 || Y >= maxTileY) {
                continue;
            }
            const dist = Math.hypot(dx - cols / 2, dy - rows / 2);
            tiles.push({ X, Y, dist });
          }
        }

        tiles.sort((a, b) => a.dist - b.dist);

        const ctx = this._map.ctx;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(this._map.bearing);
        ctx.scale(scaleFactor, scaleFactor);
        ctx.imageSmoothingEnabled = false;

        for (const { X, Y } of tiles) {
          const key = `${zInt}/${X}/${Y}`;
          const url = this._getTileUrl(X, Y, zInt);
          const trX = (X - ct.x) * ts;
          const trY = (Y - ct.y) * ts;

          let tile = this.tileCache.get(key);
          if (!tile) {
            this._loadTile(key, url);
          } else if (tile.loaded) {
            ctx.drawImage(tile.img, trX, trY, ts, ts);
            tile.lastUsed = Date.now();
            if (tile.loadedAt && (Date.now() - tile.loadedAt > TILE_TTL)) {
              this._reloadTile(key, url);
            }
          }
        }

        ctx.restore();
        this._evict();
        this._preloadAdjacentZoomTiles();
      }

      /**
       * Called when the layer is added to the map.
       */
      onAdd() {
        this.fire('add');
      }

      /**
       * Called when the layer is removed from the map.
       */
      onRemove() {
        for (const controller of this.loadingControllers.values()) {
          controller.abort();
        }
        this.loadingTiles.clear();
        this.loadingControllers.clear();
        this.tileCache.clear();
        this.fire('remove');
      }

      /**
       * Gets the attribution text for the layer.
       * @returns {string} The attribution text.
       */
      getAttribution() {
        return this.options.attribution;
      }

      /**
       * Gets the background color of the layer.
       * @returns {string} The background color.
       */
      getBackground() {
        return this.options.background;
      }

      /**
       * Gets the minimum zoom level for the layer.
       * @returns {number} The minimum zoom level.
       */
      getMinZoom() {
        return this.options.minZoom;
      }

      /**
       * Gets the maximum zoom level for the layer.
       * @returns {number} The maximum zoom level.
       */
      getMaxZoom() {
        return this.options.maxZoom;
      }
    }

    /**
     * A layer for displaying GeoJSON data.
     * @class GeoJSONLayer
     * @extends Layer
     */
    class GeoJSONLayer extends Layer {
      /**
       * Creates an instance of GeoJSONLayer.
       * @param {object} geojson - The GeoJSON data.
       * @param {object} [options={}] - The GeoJSON layer options.
       */
      constructor(geojson, options = {}) {
        super(options);
        this._geojson = this._normalizeGeoJSON(geojson);
        this._features = [];
        this._featureCache = new Map();
        this._hitCache = new Map();
        this._lastRenderZoom = null;
        this._lastRenderBearing = null;
        this._lastRenderCenter = null;
        this.options.style = options.style || {
          color: '#3388ff',
          weight: 3,
          opacity: 1,
          fillColor: '#3388ff',
          fillOpacity: 0.2
        };
        this.options.interactive = options.interactive !== undefined ? options.interactive : true;
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseOut = this._onMouseOut.bind(this);
        this._onClick = this._onClick.bind(this);
        this._hoveredFeature = null;
      }

      _normalizeGeoJSON(input) {
        if (Array.isArray(input)) {
          return {
            type: 'FeatureCollection',
            features: input.map(f => f.type === 'Feature' ? f : { type: 'Feature', geometry: f, properties: {} })
          };
        } else if (input.type === 'FeatureCollection') {
          return input;
        } else if (input.type === 'Feature') {
          return { type: 'FeatureCollection', features: [input] };
        } else {
          return {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: input, properties: {} }]
          };
        }
      }

      _latLngToScreenPoint(coord) {
        if (!this._map) return { x: 0, y: 0 };
        const [lon, lat] = coord;
        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        const zInt = Math.floor(this._map.zoom);
        const ts = TILE_SIZE * Math.pow(2, this._map.zoom - zInt);
        const ct = this._map.projection.latLngToTile(this._map.center, zInt);
        const pt = this._map.projection.latLngToTile({ lat, lon }, zInt);
        const trX = (pt.x - ct.x) * ts;
        const trY = (pt.y - ct.y) * ts;
        const anchorVec = rot(trX, trY, this._map.bearing);
        const screenX = w / 2 + anchorVec.x;
        const screenY = h / 2 + anchorVec.y;
        return { x: screenX, y: screenY };
      }

      _getFeatureStyle(feature) {
        if (typeof this.options.style === 'function') {
          return this.options.style(feature);
        }
        return this.options.style;
      }

      _processFeature(feature) {
        const cacheKey = JSON.stringify(feature);
        if (this._featureCache.has(cacheKey)) {
          return this._featureCache.get(cacheKey);
        }

        const geometry = feature.geometry;
        const processed = { type: geometry.type, coordinates: null, properties: feature.properties };

        switch (geometry.type) {
          case 'Point':
            processed.coordinates = this._latLngToScreenPoint(geometry.coordinates);
            break;
          case 'MultiPoint':
            processed.coordinates = geometry.coordinates.map(coord => this._latLngToScreenPoint(coord));
            break;
          case 'LineString':
            processed.coordinates = geometry.coordinates.map(coord => this._latLngToScreenPoint(coord));
            break;
          case 'MultiLineString':
            processed.coordinates = geometry.coordinates.map(ring => ring.map(coord => this._latLngToScreenPoint(coord)));
            break;
          case 'Polygon':
            processed.coordinates = geometry.coordinates.map(ring => ring.map(coord => this._latLngToScreenPoint(coord)));
            break;
          case 'MultiPolygon':
            processed.coordinates = geometry.coordinates.map(polygon => polygon.map(ring => ring.map(coord => this._latLngToScreenPoint(coord))));
            break;
          default:
            console.warn('[Atlas] Unsupported geometry type:', geometry.type);
            return null;
        }

        this._featureCache.set(cacheKey, processed);
        return processed;
      }

      _renderPoint(ctx, feature, style) {
        const { x, y } = feature.coordinates;
        ctx.beginPath();
        ctx.arc(x, y, style.radius || 5, 0, 2 * Math.PI);
        ctx.fillStyle = style.fillColor || style.color || '#3388ff';
        ctx.fill();
        if (style.stroke !== false) {
          ctx.strokeStyle = style.color || '#3388ff';
          ctx.lineWidth = style.weight || 2;
          ctx.globalAlpha = style.opacity || 1;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      _renderLineString(ctx, feature, style) {
        const coords = feature.coordinates;
        if (coords.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) {
          ctx.lineTo(coords[i].x, coords[i].y);
        }
        ctx.strokeStyle = style.color || '#3388ff';
        ctx.lineWidth = style.weight || 3;
        ctx.globalAlpha = style.opacity || 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      _renderPolygon(ctx, feature, style) {
        const rings = feature.coordinates;
        if (rings.length === 0) return;

        ctx.beginPath();
        for (let r = 0; r < rings.length; r++) {
          const ring = rings[r];
          if (ring.length < 3) continue;
          ctx.moveTo(ring[0].x, ring[0].y);
          for (let i = 1; i < ring.length; i++) {
            ctx.lineTo(ring[i].x, ring[i].y);
          }
          ctx.closePath();
        }

        if (style.fill !== false) {
          ctx.fillStyle = style.fillColor || style.color || '#3388ff';
          ctx.globalAlpha = style.fillOpacity || 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (style.stroke !== false) {
          ctx.strokeStyle = style.color || '#3388ff';
          ctx.lineWidth = style.weight || 3;
          ctx.globalAlpha = style.opacity || 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      _pointInPolygon(x, y, rings) {
        let inside = false;
        // Check the outer ring first
        if (this._pointInRing(x, y, rings[0])) {
          inside = true;
          // Now check the inner rings (holes)
          for (let i = 1; i < rings.length; i++) {
            if (this._pointInRing(x, y, rings[i])) {
              inside = false; // Point is in a hole
              break;
            }
          }
        }
        return inside;
      }

      _pointInRing(x, y, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i].x, yi = ring[i].y;
          const xj = ring[j].x, yj = ring[j].y;
          const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }

      _pointOnLine(x, y, line, width) {
        for (let i = 0; i < line.length - 1; i++) {
          const p1 = line[i];
          const p2 = line[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const closeX = p1.x + t * dx;
          const closeY = p1.y + t * dy;
          const distSq = (x - closeX) * (x - closeX) + (y - closeY) * (y - closeY);
          if (distSq < (width / 2) * (width / 2)) return true;
        }
        return false;
      }

      _hitDetect(x, y) {
        // Iterate backwards to prioritize features rendered on top
        for (let i = this._features.length - 1; i >= 0; i--) {
          const feature = this._features[i];
          const processed = this._processFeature(feature);
          if (!processed) continue;
          const style = this._getFeatureStyle(feature);

          switch (processed.type) {
            case 'Point':
              const dist = Math.hypot(x - processed.coordinates.x, y - processed.coordinates.y);
              if (dist <= (style.radius || 5) + 5) { // Add a 5px buffer
                return feature;
              }
              break;
            case 'LineString':
              if (this._pointOnLine(x, y, processed.coordinates, (style.weight || 3) + 10)) { // Add a 10px buffer
                return feature;
              }
              break;
            case 'Polygon':
              if (this._pointInPolygon(x, y, processed.coordinates)) {
                return feature;
              }
              break;
          }
        }
        return null;
      }

      _onMouseMove(e) {
        const rect = this._map.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const feature = this._hitDetect(x, y);

        if (this._hoveredFeature && this._hoveredFeature !== feature) {
          this.fire('mouseout', { originalEvent: e, feature: this._hoveredFeature });
          this._hoveredFeature = null;
          this._map.canvas.style.cursor = 'grab';
        }

        if (feature && this._hoveredFeature !== feature) {
          this.fire('mouseover', { originalEvent: e, feature: feature });
          this._hoveredFeature = feature;
          this._map.canvas.style.cursor = 'pointer';
        }

        if (feature) {
          this.fire('mousemove', { originalEvent: e, feature });
        }
      }

      _onMouseOut(e) {
        if (this._hoveredFeature) {
          this.fire('mouseout', { originalEvent: e, feature: this._hoveredFeature });
          this._hoveredFeature = null;
          this._map.canvas.style.cursor = 'grab';
        }
      }

      _onClick(e) {
        const rect = this._map.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const feature = this._hitDetect(x, y);

        if (feature) {
          this.fire('click', { originalEvent: e, feature });
        }
      }

      /**
       * Called when the layer is added to the map.
       */
      onAdd() {
        this._features = this._geojson.features || [];
        if (this.options.interactive) {
          this._map.canvas.addEventListener('mousemove', this._onMouseMove);
          this._map.canvas.addEventListener('mouseout', this._onMouseOut);
          this._map.canvas.addEventListener('click', this._onClick);
        }
        this.fire('add');
      }

      /**
       * Called when the layer is removed from the map.
       */
      onRemove() {
        if (this.options.interactive) {
          this._map.canvas.removeEventListener('mousemove', this._onMouseMove);
          this._map.canvas.removeEventListener('mouseout', this._onMouseOut);
          this._map.canvas.removeEventListener('click', this._onClick);
        }
        this._featureCache.clear();
        this._hitCache.clear();
        this.fire('remove');
      }

      render() {
        if (!this._map) return;

        const ctx = this._map.ctx;
        const needsRebuild = (
          this._lastRenderZoom !== this._map.zoom ||
          this._lastRenderBearing !== this._map.bearing ||
          this._lastRenderCenter?.lon !== this._map.center.lon ||
          this._lastRenderCenter?.lat !== this._map.center.lat
        );

        if (needsRebuild) {
          this._featureCache.clear();
          this._hitCache.clear();
          this._lastRenderZoom = this._map.zoom;
          this._lastRenderBearing = this._map.bearing;
          this._lastRenderCenter = { ...this._map.center };
        }

        for (const feature of this._features) {
          const processed = this._processFeature(feature);
          if (!processed) continue;
          const style = this._getFeatureStyle(feature);

          switch (processed.type) {
            case 'Point':
              this._renderPoint(ctx, processed, style);
              break;
            case 'LineString':
              this._renderLineString(ctx, processed, style);
              break;
            case 'Polygon':
              this._renderPolygon(ctx, processed, style);
              break;
          }
        }
      }

      /**
       * Sets the GeoJSON data for the layer.
       * @param {object} geojson - The GeoJSON data.
       * @returns {GeoJSONLayer} The current layer instance.
       */
      setData(geojson) {
        this._geojson = this._normalizeGeoJSON(geojson);
        this._features = this._geojson.features || [];
        this._featureCache.clear();
        this._hitCache.clear();
        if (this._map) {
          this._map.render();
        }
        return this;
      }

      /**
       * Gets the GeoJSON data for the layer.
       * @returns {object} The GeoJSON data.
       */
      getData() {
        return this._geojson;
      }
    }

    /**
     * Base class for all controls.
     * @class Control
     */
    class Control {
      /**
       * Creates an instance of Control.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        this.options = {
          position: options.position || 'top-left'
        };
        this._map = null;
        this._container = null;
        this._events = {};
      }

      /**
       * Adds an event listener to the control.
       * @param {string} type - The event type.
       * @param {Function} fn - The event listener function.
       * @returns {Control} The current control instance.
       */
      on(type, fn) {
        if (!this._events[type]) {
          this._events[type] = [];
        }
        this._events[type].push(fn);
        return this;
      }

      /**
       * Removes an event listener from the control.
       * @param {string} type - The event type.
       * @param {Function} [fn] - The event listener function. If not provided, all listeners for the type are removed.
       * @returns {Control} The current control instance.
       */
      off(type, fn) {
        if (!this._events[type]) return this;
        if (!fn) {
          this._events[type] = [];
        } else {
          this._events[type] = this._events[type].filter(cb => cb !== fn);
        }
        return this;
      }

      /**
       * Fires an event on the control.
       * @param {string} type - The event type.
       * @param {object} [data={}] - The event data.
       */
      fire(type, data = {}) {
        if (!this._events[type]) return;
        data.type = type;
        data.target = this;
        this._events[type].forEach(fn => fn(data));
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        return document.createElement('div');
      }

      /**
       * Called when the control is removed from the map.
       */
      onRemove() {
      }

      /**
       * Adds the control to the given map.
       * @param {Atlas} map - The map instance.
       * @returns {Control} The current control instance.
       */
      addTo(map) {
        this.remove();
        this._map = map;
        this._container = this.onAdd();
        this._container.controlInstance = this;
        this._addToContainer();
        return this;
      }

      /**
       * Removes the control from the map.
       * @returns {Control} The current control instance.
       */
      remove() {
        if (!this._map) return this;
        this.onRemove();
        if (this._container && this._container.parentNode) {
          this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
        this._container = null;
        return this;
      }

      /**
       * Gets the control's container element.
       * @returns {HTMLElement} The container element.
       */
      getContainer() {
        return this._container;
      }

      _addToContainer() {
        if (!this._map || !this._container) return;
        const position = this.options.position;
        const cornerName = `.atlas-control-${position}`;
        let container = this._map._controlCorners[position];

        if (!container) {
          container = document.createElement('div');
          container.className = `atlas-control-container atlas-control-${position}`;
          if (position.includes('top') || position.includes('bottom')) {
            container.classList.add('atlas-control-vertical');
          } else {
            container.classList.add('atlas-control-horizontal');
          }
          this._map.container.appendChild(container);
          this._map._controlCorners[position] = container;
        }

        container.appendChild(this._container);
      }
    }

    /**
     * A control for zooming in and out.
     * @class ZoomControl
     * @extends Control
     */
    class ZoomControl extends Control {
      /**
       * Creates an instance of ZoomControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          zoomInTitle: options.zoomInTitle || 'Zoom in',
          zoomOutTitle: options.zoomOutTitle || 'Zoom out'
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-zoom-control';

        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'control-btn';
        zoomInBtn.title = this.options.zoomInTitle;
        zoomInBtn.setAttribute('aria-label', this.options.zoomInTitle);
        zoomInBtn.textContent = '+';
        zoomInBtn.onclick = () => {
          if (this._map) {
            this._map.stopAnimations();
            this._map.setZoom(this._map.getZoom() + 1);
          }
        };

        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'control-btn';
        zoomOutBtn.title = this.options.zoomOutTitle;
        zoomOutBtn.setAttribute('aria-label', this.options.zoomOutTitle);
        zoomOutBtn.textContent = '−';
        zoomOutBtn.onclick = () => {
          if (this._map) {
            this._map.stopAnimations();
            this._map.setZoom(this._map.getZoom() - 1);
          }
        };

        container.appendChild(zoomInBtn);
        container.appendChild(zoomOutBtn);

        this._zoomInBtn = zoomInBtn;
        this._zoomOutBtn = zoomOutBtn;

        return container;
      }

      onRemove() {
      }

      _update() {
        if (!this._map || !this._zoomInBtn || !this._zoomOutBtn) return;
        const minZoom = this._map.getBaseLayer() ? this._map.getBaseLayer().getMinZoom() : 0;
        const maxZoom = this._map.getBaseLayer() ? this._map.getBaseLayer().getMaxZoom() : 18;
        const currentZoom = this._map.getZoom();

        this._zoomInBtn.disabled = currentZoom >= maxZoom;
        this._zoomOutBtn.disabled = currentZoom <= minZoom;
      }
    }

    /**
     * A control for toggling between base layers.
     * @class LayerControl
     * @extends Control
     */
    class LayerControl extends Control {
      /**
       * Creates an instance of LayerControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          title: options.title || 'Toggle layer'
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-layer-control';

        this._osmLayer = TILE_LAYERS.OSM;
        this._esriLayer = TILE_LAYERS.ESRI;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'control-btn';
        toggleBtn.title = this.options.title;
        toggleBtn.setAttribute('aria-label', this.options.title);
        toggleBtn.textContent = '🌐';
        toggleBtn.onclick = () => {
            if (this._map) {
                const current = this._map.getBaseLayer();
                if (current === this._osmLayer) {
                    this._map.setBaseLayer(this._esriLayer);
                } else {
                    this._map.setBaseLayer(this._osmLayer);
                }
            }
        };

        container.appendChild(toggleBtn);
        this._toggleBtn = toggleBtn;

        return container;
      }

      onRemove() {
      }
    }

    /**
     * A control for toggling fullscreen mode.
     * @class FullscreenControl
     * @extends Control
     */
    class FullscreenControl extends Control {
      /**
       * Creates an instance of FullscreenControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          title: options.title || 'Toggle fullscreen'
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-fullscreen-control';

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'control-btn';
        fullscreenBtn.title = this.options.title;
        fullscreenBtn.setAttribute('aria-label', this.options.title);
        fullscreenBtn.textContent = '⛶';
        fullscreenBtn.onclick = () => {
          if (!document.fullscreenElement) {
            this._map.container.requestFullscreen().catch(err => {
              console.warn(`[Atlas] Error attempting to enable fullscreen: ${err.message}`);
            });
          } else {
            document.exitFullscreen().catch(err => {
              console.warn(`[Atlas] Error attempting to exit fullscreen: ${err.message}`);
            });
          }
        };

        container.appendChild(fullscreenBtn);
        this._fullscreenBtn = fullscreenBtn;

        return container;
      }

      onRemove() {
      }
    }

    /**
     * A control for displaying a scale bar.
     * @class ScaleControl
     * @extends Control
     */
    class ScaleControl extends Control {
      /**
       * Creates an instance of ScaleControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          maxWidth: options.maxWidth || 150,
          unit: options.unit || 'metric'
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-scale-control scale-bar-container';

        this._scaleBar = document.createElement('div');
        this._scaleBar.className = 'scale-bar';

        this._scaleText = document.createElement('div');
        this._scaleText.id = 'scale-text';
        this._scaleText.dataset.unit = this.options.unit;

        container.appendChild(this._scaleBar);
        container.appendChild(this._scaleText);

        this._toggleUnit = () => {
          this._scaleText.dataset.unit = this._scaleText.dataset.unit === 'metric' ? 'imperial' : 'metric';
          this._update();
        };
        this._scaleText.addEventListener('click', this._toggleUnit);

        return container;
      }

      onRemove() {
        if (this._scaleText) {
          this._scaleText.removeEventListener('click', this._toggleUnit);
        }
      }

      _update() {
        if (!this._map || !this._scaleBar || !this._scaleText) return;

        const mPerPx = GISUtils.getResolution(this._map.getCenter().lat, this._map.getZoom());
        const targetMeters = mPerPx * this.options.maxWidth;

        const pow = Math.pow(10, Math.floor(Math.log10(targetMeters)));
        const base = targetMeters / pow;
        const niceBase = base >= 5 ? 5 : base >= 2 ? 2 : 1;
        const niceMeters = niceBase * pow;

        const widthPx = Math.max(20, Math.min(this.options.maxWidth, niceMeters / mPerPx));

        this._scaleBar.style.width = `${widthPx}px`;

        let displayText;
        if (this._scaleText.dataset.unit === "metric") {
          displayText = GISUtils.formatDistance(niceMeters);
        } else {
          const feet = niceMeters * 3.28084;
          displayText = feet < 5280 ? Math.round(feet) + " ft" : (feet / 5280).toFixed(1) + " mi";
        }

        this._scaleText.textContent = displayText;
      }
    }

    /**
     * A control for displaying map attribution.
     * @class AttributionControl
     * @extends Control
     */
    class AttributionControl extends Control {
      /**
       * Creates an instance of AttributionControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          prefix: options.prefix || ''
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-attribution-control';
        container.innerHTML = this.options.prefix;
        this._container = container;
        return container;
      }

      onRemove() {
      }

      _update() {
        if (!this._map || !this._container) return;
        const attribution = this._map.getBaseLayer() ? this._map.getBaseLayer().getAttribution() : '';
        this._container.textContent = this.options.prefix + (this.options.prefix && attribution ? ' | ' : '') + attribution;
      }
    }

    /**
     * A control for displaying a compass.
     * @class CompassControl
     * @extends Control
     */
    class CompassControl extends Control {
      /**
       * Creates an instance of CompassControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          title: options.title || 'Reset North'
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-compass-control';

        const compassBtn = document.createElement('button');
        compassBtn.id = 'compass';
        compassBtn.className = 'control-btn';
        compassBtn.title = this.options.title;
        compassBtn.setAttribute('aria-label', this.options.title);
        compassBtn.textContent = 'N';
        compassBtn.style.display = 'none';

        compassBtn.onclick = () => {
          if (this._map) {
            const w = this._map.canvas.width / this._map.dpr;
            const h = this._map.canvas.height / this._map.dpr;
            this._map.animateZoomRotateAbout(w / 2, h / 2, this._map.getZoom(), 0, SNAP_DURATION);
          }
        };

        compassBtn.onmouseenter = () => { compassBtn.style.background = "rgba(240, 240, 240, 0.95)"; };
        compassBtn.onmouseleave = () => { compassBtn.style.background = "rgba(255, 255, 255, 0.9)"; };
        compassBtn.onmousedown = () => { compassBtn.style.transform = "scale(0.98) rotate(" + (-this._map.getBearing() * RAD2DEG) + "deg)"; };
        compassBtn.onmouseup = () => { compassBtn.style.transform = "rotate(" + (-this._map.getBearing() * RAD2DEG) + "deg)"; };

        container.appendChild(compassBtn);
        this._compassBtn = compassBtn;

        return container;
      }

      onRemove() {
      }

      _update() {
        if (!this._compassBtn || !this._map) return;
        const visible = Math.abs(this._map.getBearing()) > 0.001;
        this._compassBtn.style.display = visible ? "block" : "none";
        this._compassBtn.style.transform = `rotate(${-this._map.getBearing() * RAD2DEG}deg)`;
      }
    }

    /**
     * A control for resetting the zoom to the default level.
     * @class ResetZoomControl
     * @extends Control
     */
    class ResetZoomControl extends Control {
      /**
       * Creates an instance of ResetZoomControl.
       * @param {object} [options={}] - The control options.
       */
      constructor(options = {}) {
        super(options);
        this.options = {
          ...this.options,
          title: options.title || 'Reset Zoom'
        };
      }

      /**
       * Called when the control is added to the map.
       * @returns {HTMLElement} The control's container element.
       */
      onAdd() {
        const container = document.createElement('div');
        container.className = 'atlas-reset-zoom-control';

        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-zoom';
        resetBtn.className = 'control-btn';
        resetBtn.title = this.options.title;
        resetBtn.setAttribute('aria-label', this.options.title);
        resetBtn.textContent = '⤢';

        resetBtn.onclick = () => {
          if (this._map) {
            this._map.flyTo({ center: CONFIG.defaultCenter, zoom: CONFIG.defaultZoom, duration: SNAP_DURATION });
          }
        };

        resetBtn.onmouseenter = () => { resetBtn.style.background = "rgba(240, 240, 240, 0.95)"; };
        resetBtn.onmouseleave = () => { resetBtn.style.background = "rgba(255, 255, 255, 0.9)"; };
        resetBtn.onmousedown = () => { resetBtn.style.transform = "scale(0.98)"; };
        resetBtn.onmouseup = () => { resetBtn.style.transform = "scale(1)"; };

        container.appendChild(resetBtn);
        this._resetBtn = resetBtn;

        return container;
      }

      onRemove() {
      }
    }

    /**
     * A control for displaying notifications on the map.
     * @class NotificationControl
     */
    class NotificationControl {
        /**
         * Creates an instance of NotificationControl.
         * @param {Atlas} map - The map instance.
         */
        constructor(map) {
            this._map = map;
            this._container = map.container.querySelector('.atlas-notification-container');
            if (!this._container) {
                this._container = document.createElement('div');
                this._container.className = 'atlas-notification-container';
                this._map.container.appendChild(this._container);
            }
        }

        /**
         * Shows a notification on the map.
         * @param {string} message - The message to display.
         * @param {number} [duration=5000] - The duration in milliseconds to show the notification.
         */
        show(message, duration = 5000) {
            const notification = document.createElement('div');
            notification.className = 'atlas-notification';
            notification.textContent = message;

            this._container.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, duration);
        }
    }

    /**
     * Base class for all map interaction handlers.
     * @class Handler
     */
    class Handler {
      /**
       * Creates an instance of Handler.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        this._map = map;
        this._enabled = false;
        this._eventListeners = {};
      }

      /**
       * Enables the handler.
       * @returns {Handler} The current handler instance.
       */
      enable() {
        if (this._enabled) return this;
        this._enabled = true;
        this._addEvents();
        return this;
      }

      /**
       * Disables the handler.
       * @returns {Handler} The current handler instance.
       */
      disable() {
        if (!this._enabled) return this;
        this._enabled = false;
        this._removeEvents();
        return this;
      }

      /**
       * Toggles the handler.
       * @returns {Handler} The current handler instance.
       */
      toggle() {
        return this._enabled ? this.disable() : this.enable();
      }

      /**
       * Checks if the handler is enabled.
       * @returns {boolean} True if the handler is enabled, false otherwise.
       */
      isEnabled() {
        return this._enabled;
      }

      _addEvents() {
        // To be implemented by subclasses
      }

      _removeEvents() {
        // To be implemented by subclasses
      }

      destroy() {
        this.disable();
        this._eventListeners = {};
      }
    }

    /**
     * Handles map panning via drag events.
     * @class DragPanHandler
     * @extends Handler
     */
    class DragPanHandler extends Handler {
      /**
       * Creates an instance of DragPanHandler.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        super(map);
        this._isDragging = false;
        this._dragStart = null;
        this._moveSamples = [];
      }

      _addEvents() {
        this._map.canvas.addEventListener('mousedown', this._onMouseDown);
        this._map.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
      }

      _removeEvents() {
        this._map.canvas.removeEventListener('mousedown', this._onMouseDown);
        this._map.canvas.removeEventListener('touchstart', this._onTouchStart);
        this._removeMoveEvents();
      }

      _removeMoveEvents() {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('touchmove', this._onTouchMove, { passive: false });
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('touchcancel', this._onTouchEnd);
      }

      _onMouseDown = (e) => {
        if (e.button !== 0) return; // Only left mouse button
        this._startDrag(e.clientX, e.clientY);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
      }

      _onMouseMove = (e) => {
        if (!this._isDragging) return;
        e.preventDefault();
        const dx = e.clientX - this._dragStart.x;
        const dy = e.clientY - this._dragStart.y;
        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy, this._map.zoom, this._map.bearing, this._dragStart.center);
        this._pushVelocitySample(e.clientX, e.clientY);
        this._map.render();
      }

      _onMouseUp = () => {
        this._endDrag();
      }

      _onTouchStart = (e) => {
        if (e.touches.length !== 1) {
          if (this._isDragging) {
            this._endDrag();
          }
          return;
        }
        e.preventDefault();
        this._startDrag(e.touches[0].clientX, e.touches[0].clientY);
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd);
        document.addEventListener('touchcancel', this._onTouchEnd);
      }

      _onTouchMove = (e) => {
        if (!this._isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - this._dragStart.x;
        const dy = e.touches[0].clientY - this._dragStart.y;
        const w = this._map.canvas.width / this._map.dpr;
        const h = this._map.canvas.height / this._map.dpr;
        this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy, this._map.zoom, this._map.bearing, this._dragStart.center);
        this._pushVelocitySample(e.touches[0].clientX, e.touches[0].clientY);
        this._map.render();
      }

      _onTouchEnd = () => {
        this._endDrag();
      }

      _startDrag(clientX, clientY) {
        this._isDragging = true;
        this._map.stopAnimations();
        this._map.isDragging = true;
        this._map.container.classList.add('dragging');
        this._dragStart = {
          x: clientX,
          y: clientY,
          center: { ...this._map.center }
        };
        this._moveSamples = [];
        this._pushVelocitySample(clientX, clientY);
      }

      _endDrag() {
        if (!this._isDragging) return;
        this._isDragging = false;
        this._map.isDragging = false;
        this._map.container.classList.remove('dragging');
        const { vx, vy } = this._computeVelocity();
        this._startInertia(vx, vy);
        this._removeMoveEvents();
      }

      _pushVelocitySample(x, y) {
        const t = performance.now();
        this._moveSamples.push({ t, x, y });
        const cutoff = t - VELOCITY_WINDOW_MS;
        while (this._moveSamples.length && this._moveSamples[0].t < cutoff) {
          this._moveSamples.shift();
        }
      }

      _computeVelocity() {
        if (this._moveSamples.length < 2) return { vx: 0, vy: 0 };
        const last = this._moveSamples[this._moveSamples.length - 1];
        let i = this._moveSamples.length - 2;
        while (i > 0 && last.t - this._moveSamples[i].t < VELOCITY_WINDOW_MS * 0.5) i--;
        const ref = this._moveSamples[i];
        const dt = Math.max(1, last.t - ref.t);
        return { vx: (last.x - ref.x) / dt, vy: (last.y - ref.y) / dt };
      }

      _startInertia(vx, vy) {
        const speed = Math.hypot(vx, vy);
        if (speed < INERTIA_STOP_SPEED) return;
        let lastT = performance.now();
        const step = () => {
          const now = performance.now();
          const dt = now - lastT;
          lastT = now;
          const dx = vx * dt, dy = vy * dt;
          const w = this._map.canvas.width / this._map.dpr;
          const h = this._map.canvas.height / this._map.dpr;
          this._map.center = this._map.screenToLatLon(w / 2 - dx, h / 2 - dy);
          const vmag = Math.hypot(vx, vy);
          const newVmag = Math.max(0, vmag - INERTIA_DECEL * dt);
          if (newVmag <= INERTIA_STOP_SPEED) {
            this._map.render();
            this._map._inertiaRAF = null;
            this._map.fire('moveend');
            return;
          }
          const s = newVmag / (vmag || 1);
          vx *= s;
          vy *= s;
          this._map.render();
          this._map._inertiaRAF = requestAnimationFrame(step);
        };
        this._map._inertiaRAF = requestAnimationFrame(step);
      }
    }

    /**
     * Handles map zooming via scroll events.
     * @class ScrollZoomHandler
     * @extends Handler
     */
    class ScrollZoomHandler extends Handler {
      /**
       * Creates an instance of ScrollZoomHandler.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        super(map);
      }

      _addEvents() {
        this._map.canvas.addEventListener('wheel', this._onWheel, { passive: false });
      }

      _removeEvents() {
        this._map.canvas.removeEventListener('wheel', this._onWheel);
      }

      _onWheel = (e) => {
        e.preventDefault();
        const dz = (e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP);
        this._map.smoothZoomAt(e.clientX, e.clientY, dz);
      }
    }

    /**
     * Handles map zooming via double-click events.
     * @class DoubleClickZoomHandler
     * @extends Handler
     */
    class DoubleClickZoomHandler extends Handler {
      /**
       * Creates an instance of DoubleClickZoomHandler.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        super(map);
        this._lastClickTime = 0;
        this._lastClickPos = { x: 0, y: 0 };
      }

      _addEvents() {
        this._map.canvas.addEventListener('dblclick', this._onDoubleClick);
      }

      _removeEvents() {
        this._map.canvas.removeEventListener('dblclick', this._onDoubleClick);
      }

      _onDoubleClick = (e) => {
        e.preventDefault();
        this._map.animateZoomRotateAbout(e.clientX, e.clientY, this._map.getZoom() + 1, this._map.getBearing(), TAP_ZOOM_DURATION);
      }
    }

    /**
     * Handles map zooming and rotation via touch events.
     * @class TouchZoomRotateHandler
     * @extends Handler
     */
    class TouchZoomRotateHandler extends Handler {
      /**
       * Creates an instance of TouchZoomRotateHandler.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        super(map);
        this._isPinching = false;
        this._pinchStartDist = 0;
        this._pinchStartAngle = 0;
        this._pinchStartZoom = map.getZoom();
        this._pinchStartBearing = map.getBearing();
        this._pinchStartTime = 0;
        this._pinchLastCenter = null;
        this._pinchMoved = false;
        this._pinchAnchorLL = null;
      }

      _addEvents() {
        this._map.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
      }

      _removeEvents() {
        this._map.canvas.removeEventListener('touchstart', this._onTouchStart);
        this._removeMoveEvents();
      }

      _removeMoveEvents() {
        document.removeEventListener('touchmove', this._onTouchMove, { passive: false });
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('touchcancel', this._onTouchEnd);
      }

      _onTouchStart = (e) => {
        if (e.touches.length < 2) return;
        const dragPanHandler = this._map.getHandler('dragPan');
        if (dragPanHandler && dragPanHandler._isDragging) {
          dragPanHandler._endDrag();
        }
        e.preventDefault();
        this._startPinch(e);
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd);
        document.addEventListener('touchcancel', this._onTouchEnd);
      }

      _startPinch = (e) => {
        this._map.stopAnimations();
        this._isPinching = true;
        const t1 = e.touches[0], t2 = e.touches[1];
        this._pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        this._pinchStartAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        this._pinchStartZoom = this._map.getZoom();
        this._pinchStartBearing = this._map.getBearing();
        this._pinchStartTime = performance.now();
        this._pinchLastCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        this._pinchAnchorLL = this._map.screenToLatLon(this._pinchLastCenter.x, this._pinchLastCenter.y, this._map.getZoom(), this._map.getBearing(), this._map.getCenter());
        this._pinchMoved = false;
      }

      _onTouchMove = (e) => {
        if (!this._isPinching || e.touches.length < 2) return;
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        const targetZoom = this._pinchStartZoom + Math.log2(dist / Math.max(1, this._pinchStartDist));
        const deltaAngle = normalizeAngle(angle - this._pinchStartAngle);
        const targetBearing = normalizeAngle(this._pinchStartBearing + deltaAngle);

        if (Math.abs(Math.log(dist / Math.max(1, this._pinchStartDist))) > Math.log(1 + TWO_FINGER_TAP_MOVE_THRESH / Math.max(1, this._pinchStartDist)) ||
            Math.abs(deltaAngle) > ROTATE_MOVE_THRESH_RAD) {
            this._pinchMoved = true;
        }

        this._map.applyZoomRotateAbout(center.x, center.y, targetZoom, targetBearing, this._pinchAnchorLL);
        this._pinchLastCenter = center;
        this._map.render();
      }

      _onTouchEnd = (e) => {
        if (!this._isPinching) return;
        const dt = performance.now() - this._pinchStartTime;
        // Only fire two-finger tap if all fingers are lifted
        if (e.touches.length === 0 && dt <= TWO_FINGER_TAP_MAX_DELAY && !this._pinchMoved) {
            const ax = this._pinchLastCenter ? this._pinchLastCenter.x : (this._map.canvas.width / this._map.dpr) / 2;
            const ay = this._pinchLastCenter ? this._pinchLastCenter.y : (this._map.canvas.height / this._map.dpr) / 2;
            this._map.animateZoomRotateAbout(ax, ay, this._map.getZoom() - 1, this._map.getBearing(), TAP_ZOOM_DURATION);
        }
        if (e.touches.length < 2) {
            this._isPinching = false;
            this._removeMoveEvents();
        }
      }
    }

    /**
     * Handles map panning via keyboard events.
     * @class KeyboardPanHandler
     * @extends Handler
     */
    class KeyboardPanHandler extends Handler {
      /**
       * Creates an instance of KeyboardPanHandler.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        super(map);
      }

      _addEvents() {
        window.addEventListener('keydown', this._onKeyDown);
      }

      _removeEvents() {
        window.removeEventListener('keydown', this._onKeyDown);
      }

      _onKeyDown = (e) => {
        let dx = 0, dy = 0;
        const panStepPx = 100; // The distance to pan in pixels

        if (e.key === "ArrowUp") {
          dy = panStepPx;
        } else if (e.key === "ArrowDown") {
          dy = -panStepPx;
        } else if (e.key === "ArrowLeft") {
          dx = panStepPx;
        } else if (e.key === "ArrowRight") {
          dx = -panStepPx;
        } else if (e.key.toLowerCase() === "n") {
          const w = this._map.canvas.width / this._map.dpr, h = this._map.canvas.height / this._map.dpr;
          this._map.animateZoomRotateAbout(w / 2, h / 2, this._map.getZoom(), 0, SNAP_DURATION);
          return;
        } else if (e.key === "r") {
          this._map.setBearing(this._map.getBearing() + DEG2RAD * 15);
          return;
        } else if (e.key === "l") {
          this._map.setBearing(this._map.getBearing() - DEG2RAD * 15);
          return;
        } else if (e.key === "s") {
          const current = this._map.getBaseLayer();
          if (current === TILE_LAYERS.ESRI) {
            this._map.setBaseLayer(TILE_LAYERS.OSM);
          } else {
            this._map.setBaseLayer(TILE_LAYERS.ESRI);
          }
          return;
        } else if (e.key === "+" || e.key === "=") {
          this._map.stopAnimations();
          this._map.setZoom(this._map.getZoom() + 1);
          return;
        } else if (e.key === "-") {
          this._map.stopAnimations();
          this._map.setZoom(this._map.getZoom() - 1);
          return;
        }

        if (dx !== 0 || dy !== 0) {
          this._map.stopAnimations();
          const w = this._map.canvas.width / this._map.dpr;
          const h = this._map.canvas.height / this._map.dpr;
          // Pan relative to the screen, not geographically, by passing the current bearing.
          this._map.center = this._map.screenToLatLon(w / 2 + dx, h / 2 + dy, this._map.getZoom(), this._map.getBearing());
          this._map.render();
        }
      }
    }

    /**
     * Manages the state of popups on the map.
     * @class PopupManager
     */
    class PopupManager {
      /**
       * Creates an instance of PopupManager.
       * @param {Atlas} map - The map instance.
       */
      constructor(map) {
        this._map = map;
        this._openPopup = null;
        this._boundCloseOnEscape = this._closeOnEscape.bind(this);
        this._boundCloseOnClickOutside = this._closeOnClickOutside.bind(this);
        this._setupGlobalListeners();
      }

      _setupGlobalListeners() {
        document.addEventListener('keydown', this._boundCloseOnEscape);
        document.addEventListener('click', this._boundCloseOnClickOutside);
      }

      _teardownGlobalListeners() {
        document.removeEventListener('keydown', this._boundCloseOnEscape);
        document.removeEventListener('click', this._boundCloseOnClickOutside);
      }

      _closeOnEscape(e) {
        if (e.key === 'Escape' && this._openPopup) {
          this._openPopup.close();
        }
      }

      _closeOnClickOutside(e) {
        if (!this._openPopup) return;

        if (this._openPopup._popupElement && this._openPopup._popupElement.contains(e.target)) {
          return;
        }

        if (this._openPopup._anchor instanceof AtlasMarker &&
            this._openPopup._anchor._iconElement &&
            this._openPopup._anchor._iconElement.contains(e.target)) {
          return;
        }

        this._openPopup.close();
      }

      /**
       * Sets the currently open popup.
       * @param {AtlasPopup} popup - The popup to set as open.
       */
      setOpenPopup(popup) {
        if (this._openPopup === popup) return;

        if (this._openPopup) {
          this._openPopup.close();
        }

        this._openPopup = popup;
      }

      /**
       * Gets the currently open popup.
       * @returns {AtlasPopup} The open popup.
       */
      getOpenPopup() {
        return this._openPopup;
      }

      /**
       * Clears the currently open popup if it matches the given popup.
       * @param {AtlasPopup} popup - The popup to clear.
       */
      clearOpenPopup(popup) {
        if (this._openPopup === popup) {
          this._openPopup = null;
        }
      }

      /**
       * Destroys the popup manager and removes its event listeners.
       */
      destroy() {
        this._teardownGlobalListeners();
        this._openPopup = null;
      }
    }

    /**
     * Base class for all overlay types.
     * @class Overlay
     */
    class Overlay {
      /**
       * Creates an instance of Overlay.
       * @param {object} [options={}] - The overlay options.
       */
      constructor(options = {}) {
        this.options = options;
        this._map = null;
        this._events = {};
      }

      /**
       * Adds an event listener to the overlay.
       * @param {string} type - The event type.
       * @param {Function} fn - The event listener function.
       * @returns {Overlay} The current overlay instance.
       */
      on(type, fn) {
        if (!this._events[type]) {
          this._events[type] = [];
        }
        this._events[type].push(fn);
        return this;
      }

      /**
       * Removes an event listener from the overlay.
       * @param {string} type - The event type.
       * @param {Function} [fn] - The event listener function. If not provided, all listeners for the type are removed.
       * @returns {Overlay} The current overlay instance.
       */
      off(type, fn) {
        if (!this._events[type]) return this;
        if (!fn) {
          this._events[type] = [];
        } else {
          this._events[type] = this._events[type].filter(cb => cb !== fn);
        }
        return this;
      }

      /**
       * Fires an event on the overlay.
       * @param {string} type - The event type.
       * @param {object} [data={}] - The event data.
       */
      fire(type, data = {}) {
        if (!this._events[type]) return;
        data.type = type;
        data.target = this;
        this._events[type].forEach(fn => fn(data));
      }

      /**
       * Adds the overlay to the given map.
       * @param {Atlas} map - The map instance.
       * @returns {Overlay} The current overlay instance.
       */
      addTo(map) {
        if (this._map) {
          this._map.removeOverlay(this);
        }
        this._map = map;
        map.addOverlay(this);
        return this;
      }

      /**
       * Removes the overlay from the map.
       * @returns {Overlay} The current overlay instance.
       */
      remove() {
        if (this._map) {
          this._map.removeOverlay(this);
          this._map = null;
        }
        return this;
      }

      /**
       * Called when the overlay is added to the map.
       */
      onAdd() { }

      /**
       * Called when the overlay is removed from the map.
       */
      onRemove() { }

      /**
       * Renders the overlay on the map.
       */
      render() { }
    }

    /**
     * A marker that can be placed on the map.
     * @class AtlasMarker
     * @extends Overlay
     */
    class AtlasMarker extends Overlay {
      /**
       * Creates an instance of AtlasMarker.
       * @param {object} latlng - The geographical coordinate of the marker.
       * @param {number} latlng.lat - The latitude.
       * @param {number} latlng.lon - The longitude.
       * @param {object} [options={}] - The marker options.
       */
      constructor(latlng, options = {}) {
        super(options);

        this._latlng = { ...latlng };
        this._iconElement = null;
        this._isHovered = false;
        this._isDragging = false;
        this._dragStart = null;
        this._popup = null;

        this.options = {
          draggable: false,
          riseOnHover: true,
          riseOffset: 250,
          zIndexOffset: 0,
          ...options
        };
      }

      /**
       * Called when the marker is added to the map.
       */
      onAdd() {
        this._iconElement = this._createIcon();
        this._map.container.appendChild(this._iconElement);

        this._iconElement.addEventListener('click', this._onClick.bind(this));
        this._iconElement.addEventListener('mouseenter', this._onMouseEnter.bind(this));
        this._iconElement.addEventListener('mouseleave', this._onMouseLeave.bind(this));

        if (this.options.draggable) {
          this._iconElement.addEventListener('mousedown', this._onMouseDown.bind(this));
          this._iconElement.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        }

        this._updatePosition();
        this._updateZIndex();
      }

      /**
       * Called when the marker is removed from the map.
       */
      onRemove() {
        if (this._popup) {
          this._popup.remove();
        }

        if (this._iconElement && this._iconElement.parentNode) {
          this._iconElement.parentNode.removeChild(this._iconElement);
        }

        this._iconElement = null;
        this._popup = null;
      }

      /**
       * Renders the marker on the map.
       */
      render() {
        if (this._iconElement) {
          this._updatePosition();
        }
      }

      _createIcon() {
        const el = document.createElement('div');
        el.className = 'atlas-marker';

        const shadow = document.createElement('div');
        shadow.className = 'atlas-marker-shadow';
        el.appendChild(shadow);

        const icon = document.createElement('div');
        icon.className = 'atlas-marker-icon';
        icon.innerHTML = this.options.html || `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 10.5 12 24 12 24s12-13.5 12-24C24 5.4 18.6 0 12 0zm0 16.5c-2.5 0-4.5-2-4.5-4.5S9.5 7.5 12 7.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5z" fill="#ff7800" stroke="#fff" stroke-width="1.5"/>
          </svg>
        `;
        el.appendChild(icon);

        return el;
      }

      _updatePosition() {
        if (!this._iconElement || !this._map) return;
        const point = this._map.latLngToContainerPoint(this._latlng);
        this._iconElement.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`;
      }

      _updateZIndex() {
        if (!this._iconElement) return;

        let baseZIndex = 1000;
        if (this._isHovered && this.options.riseOnHover) {
          baseZIndex += this.options.riseOffset;
        }
        baseZIndex += this.options.zIndexOffset;

        this._iconElement.style.zIndex = baseZIndex;
      }

      _onClick(e) {
        e.stopPropagation();
        this.fire('click', { originalEvent: e });

        if (this._popup) {
          if (this._popup._isOpen) {
            this._popup.close();
          } else {
            this._popup.openOn(this);
          }
        }
      }

      _onMouseEnter(e) {
        if (!this._isDragging) {
          this._isHovered = true;
          this._updateZIndex();
          this._iconElement.classList.add('hover');
          this.fire('mouseover', { originalEvent: e });
        }
      }

      _onMouseLeave(e) {
        this._isHovered = false;
        this._updateZIndex();
        this._iconElement.classList.remove('hover');
        this.fire('mouseout', { originalEvent: e });
      }

      _onMouseDown(e) {
        if (e.button !== 0) return;
        e.stopPropagation();
        this._startDrag(e.clientX, e.clientY);
        document.addEventListener('mousemove', this._onMouseMove = this._onMouseMove.bind(this));
        document.addEventListener('mouseup', this._onMouseUp = this._onMouseUp.bind(this));
      }

      _onTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.stopPropagation();
        e.preventDefault();
        this._startDrag(e.touches[0].clientX, e.touches[0].clientY);
        document.addEventListener('touchmove', this._onTouchMove = this._onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this._onTouchEnd = this._onTouchEnd.bind(this));
        document.addEventListener('touchcancel', this._onTouchEnd);
      }

      _startDrag(clientX, clientY) {
        this._isDragging = true;
        this._map.stopAnimations();
        this._map.isDragging = true;
        this._map.container.classList.add('dragging');

        this._dragStart = {
          x: clientX,
          y: clientY,
          latlng: { ...this._latlng }
        };

        this._iconElement.classList.add('dragging');
        this.fire('dragstart');
      }

      _onDragMove(clientX, clientY) {
        const startPoint = this._map.latLngToContainerPoint(this._dragStart.latlng);
        const dx = clientX - this._dragStart.x;
        const dy = clientY - this._dragStart.y;
        const newPoint = { x: startPoint.x + dx, y: startPoint.y + dy };
        const newLatLng = this._map.screenToLatLon(newPoint.x, newPoint.y);

        this._latlng = {
          lat: GISUtils.clampLatitude(newLatLng.lat),
          lon: GISUtils.wrapLongitude(newLatLng.lon)
        };

        this.fire('drag', { latlng: { ...this._latlng } });
        this.render();
      }

      _onMouseMove(e) {
        if (!this._isDragging) return;
        e.preventDefault();
        this._onDragMove(e.clientX, e.clientY);
      }

      _onTouchMove(e) {
        if (!this._isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        this._onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }

      _onMouseUp() {
        this._endDrag();
      }

      _onTouchEnd() {
        this._endDrag();
      }

      _endDrag() {
        if (!this._isDragging) return;

        this._isDragging = false;
        this._map.isDragging = false;
        this._map.container.classList.remove('dragging');
        this._iconElement.classList.remove('dragging');

        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('touchcancel', this._onTouchEnd);

        this.fire('dragend', { latlng: { ...this._latlng } });
      }

      /**
       * Sets the geographical coordinate of the marker.
       * @param {object} latlng - The geographical coordinate.
       * @param {number} latlng.lat - The latitude.
       * @param {number} latlng.lon - The longitude.
       * @returns {AtlasMarker} The current marker instance.
       */
      setLatLng(latlng) {
        this._latlng = { ...latlng };
        if (this._map) {
          this._map.render();
        }
        return this;
      }

      /**
       * Gets the geographical coordinate of the marker.
       * @returns {object} The geographical coordinate.
       */
      getLatLng() {
        return { ...this._latlng };
      }

      /**
       * Binds a popup to the marker.
       * @param {string|HTMLElement} content - The content of the popup.
       * @param {object} [options={}] - The popup options.
       * @returns {AtlasMarker} The current marker instance.
       */
      bindPopup(content, options = {}) {
        if (this._popup) {
          this._popup.remove();
        }
        this._popup = new AtlasPopup(content, options);
        this._popup.addTo(this._map);
        return this;
      }

      /**
       * Unbinds the popup from the marker.
       * @returns {AtlasMarker} The current marker instance.
       */
      unbindPopup() {
        if (this._popup) {
          this._popup.remove();
          this._popup = null;
        }
        return this;
      }

      /**
       * Toggles the popup.
       * @returns {AtlasMarker} The current marker instance.
       */
      togglePopup() {
        if (this._popup) {
          if (this._popup._isOpen) {
            this._popup.close();
          } else {
            this._popup.openOn(this);
          }
        }
        return this;
      }

      /**
       * Opens the popup.
       * @returns {AtlasMarker} The current marker instance.
       */
      openPopup() {
        if (this._popup) {
          this._popup.openOn(this);
        }
        return this;
      }

      /**
       * Closes the popup.
       * @returns {AtlasMarker} The current marker instance.
       */
      closePopup() {
        if (this._popup && this._popup._isOpen) {
          this._popup.close();
        }
        return this;
      }
    }

    /**
     * A popup that can be opened on the map.
     * @class AtlasPopup
     * @extends Overlay
     */
    class AtlasPopup extends Overlay {
      /**
       * Creates an instance of AtlasPopup.
       * @param {string|HTMLElement} content - The content of the popup.
       * @param {object} [options={}] - The popup options.
       */
      constructor(content, options = {}) {
        super(options);

        this._content = content;
        this._popupElement = null;
        this._isOpen = false;
        this._anchor = null;
        this._tipElement = null;

        this.options = {
          closeButton: true,
          autoClose: true,
          closeOnClick: true,
          className: '',
          maxWidth: 300,
          minWidth: 50,
          ...options
        };
      }

      /**
       * Called when the popup is added to the map.
       */
      onAdd() {
        this._popupElement = this._createPopupElement();
        this._map.container.appendChild(this._popupElement);

        if (this.options.closeButton) {
          const closeButton = this._popupElement.querySelector('.popup-close');
          if (closeButton) {
            closeButton.addEventListener('click', (e) => {
              e.stopPropagation();
              this.close();
            });
          }
        }

        if (!this._map._popupManager) {
          this._map._popupManager = new PopupManager(this._map);
        }
      }

      /**
       * Called when the popup is removed from the map.
       */
      onRemove() {
        if (this._popupElement && this._popupElement.parentNode) {
          this._popupElement.parentNode.removeChild(this._popupElement);
        }
        this._popupElement = null;
        this._tipElement = null;
        this._isOpen = false;

        if (this._map && this._map._popupManager) {
          this._map._popupManager.clearOpenPopup(this);
        }
      }

      /**
       * Renders the popup on the map.
       */
      render() {
        if (!this._isOpen || !this._popupElement) return;
        this._updatePosition();
      }

      _createPopupElement() {
        const el = document.createElement('div');
        el.className = 'atlas-popup';
        if (this.options.className) {
          el.classList.add(this.options.className);
        }

        let closeButtonHtml = '';
        if (this.options.closeButton) {
          closeButtonHtml = `<button class="popup-close" aria-label="Close popup" title="Close">&times;</button>`;
        }

        el.innerHTML = `
          <div class="popup-content">${this._content}</div>
          ${closeButtonHtml}
          <div class="popup-tip"></div>
        `;

        this._tipElement = el.querySelector('.popup-tip');

        el.style.maxWidth = `${this.options.maxWidth}px`;
        el.style.minWidth = `${this.options.minWidth}px`;

        return el;
      }

      _updatePosition() {
        if (!this._anchor || !this._popupElement || !this._tipElement) return;

        let anchorPoint;
        if (this._anchor instanceof AtlasMarker && this._anchor._iconElement) {
          const rect = this._anchor._iconElement.getBoundingClientRect();
          const containerRect = this._map.container.getBoundingClientRect();
          anchorPoint = {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top
          };
        } else if (this._anchor && typeof this._anchor.lat === 'number') {
          const point = this._map.latLngToContainerPoint(this._anchor);
          anchorPoint = { x: point.x, y: point.y };
        } else {
          return;
        }

        const popupRect = this._popupElement.getBoundingClientRect();
        const mapRect = this._map.container.getBoundingClientRect();

        const space = {
          top: anchorPoint.y,
          right: mapRect.width - anchorPoint.x,
          bottom: mapRect.height - anchorPoint.y,
          left: anchorPoint.x
        };

        let position = 'bottom';
        let tipClass = 'tip-bottom';

        if (space.bottom < popupRect.height && space.top >= popupRect.height) {
          position = 'top';
          tipClass = 'tip-top';
        } else if (space.right < popupRect.width / 2 && space.left >= popupRect.width / 2) {
          position = 'left';
          tipClass = 'tip-left';
        } else if (space.left < popupRect.width / 2 && space.right >= popupRect.width / 2) {
          position = 'right';
          tipClass = 'tip-right';
        }

        let left, top;
        switch (position) {
          case 'top':
            left = anchorPoint.x - popupRect.width / 2;
            top = anchorPoint.y - popupRect.height;
            break;
          case 'bottom':
            left = anchorPoint.x - popupRect.width / 2;
            top = anchorPoint.y;
            break;
          case 'left':
            left = anchorPoint.x - popupRect.width;
            top = anchorPoint.y - popupRect.height / 2;
            break;
          case 'right':
            left = anchorPoint.x;
            top = anchorPoint.y - popupRect.height / 2;
            break;
        }

        left = Math.max(5, Math.min(mapRect.width - popupRect.width - 5, left));
        top = Math.max(5, Math.min(mapRect.height - popupRect.height - 5, top));

        this._popupElement.style.left = `${left}px`;
        this._popupElement.style.top = `${top}px`;
        this._popupElement.classList.add('open');

        this._tipElement.className = 'popup-tip ' + tipClass;
      }

      /**
       * Opens the popup on the map.
       * @param {AtlasMarker|object} anchor - The marker or geographical coordinate to anchor the popup to.
       * @returns {AtlasPopup} The current popup instance.
       */
      openOn(anchor) {
        this._anchor = anchor;
        this._isOpen = true;

        if (this._map && this._map._popupManager) {
          this._map._popupManager.setOpenPopup(this);
        }

        if (this._map) {
          this._map.render();
        }

        this.fire('open');
        return this;
      }

      /**
       * Closes the popup.
       * @returns {AtlasPopup} The current popup instance.
       */
      close() {
        this._isOpen = false;
        if (this._popupElement) {
          this._popupElement.classList.remove('open');
        }

        if (this._map && this._map._popupManager) {
          this._map._popupManager.clearOpenPopup(this);
        }

        if (this._map) {
          this._map.render();
        }

        this.fire('close');
        return this;
      }

      /**
       * Sets the content of the popup.
       * @param {string|HTMLElement} content - The new content.
       * @returns {AtlasPopup} The current popup instance.
       */
      setContent(content) {
        this._content = content;
        if (this._popupElement) {
          this._popupElement.querySelector('.popup-content').innerHTML = content;
        }
        return this;
      }
    }

    /**
     * The main map class.
     * @class Atlas
     */
    class Atlas {
      /**
       * Creates an instance of Atlas.
       * @param {string} id - The ID of the canvas element.
       * @param {object} [options={}] - The map options.
       */
      constructor(id, options = {}) {
        this.container = document.getElementById("map-container");
        if (!this.container) {
          throw new Error('[Atlas] The required "map-container" element was not found in the DOM.');
        }
        this.canvas = document.getElementById(id);
        if (!this.canvas) {
          throw new Error(`[Atlas] The required canvas element with id "${id}" was not found in the DOM.`);
        }
        this.ctx = this.canvas.getContext("2d");

        Object.assign(CONFIG, options);
        this.center = {
          lon: GISUtils.wrapLongitude(CONFIG.defaultCenter.lon),
          lat: GISUtils.clampLatitude(CONFIG.defaultCenter.lat)
        };
        this.zoom = CONFIG.defaultZoom;
        this.bearing = 0;
        this.renderScheduled = false;
        this.zoomOverlay = document.getElementById("zoom-overlay");
        this.loadingEl = document.getElementById("loading");
        this.loadingCountEl = document.getElementById("loading-count");
        this.coordsEl = document.getElementById("coords");
        this._inertiaRAF = null;
        this._eventListeners = {};
        this._layers = [];
        this._baseLayer = null;
        this._events = {};
        this._controls = [];
        this._controlCorners = {};
        this._overlays = [];
        this._handlers = {};
        this._popupManager = null;

        // --- NEW: Initialize the default projection ---
        this.projection = DEFAULT_PROJECTION;
        // --- END NEW ---

        this.addHandler('dragPan', DragPanHandler);
        this.addHandler('scrollZoom', ScrollZoomHandler);
        this.addHandler('doubleClickZoom', DoubleClickZoomHandler);
        this.addHandler('touchZoomRotate', TouchZoomRotateHandler);
        this.addHandler('keyboardPan', KeyboardPanHandler);

        this.notifications = new NotificationControl(this);

        console.warn(
          `%c[Atlas] You are using map tiles.
%cPlease comply with the respective tile usage policies.
%c- OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/
%c- Esri: https://www.esri.com/en-us/legal/terms/full-master-agreement`,
          "font-weight:bold;color:#e74c3c;",
          "color:#3498db;",
          "color:#2ecc71;",
          "color:#f39c12;"
        );

        this.resize();
        this.addControl(new ZoomControl({ position: 'top-left' }));
        this.addControl(new LayerControl({ position: 'top-left' }));
        this.addControl(new FullscreenControl({ position: 'top-right' }));
        this.addControl(new ScaleControl({ position: 'bottom-right' }));
        this.addControl(new AttributionControl({ position: 'bottom-left' }));
        this.addControl(new CompassControl({ position: 'top-left' }));
        this.addControl(new ResetZoomControl({ position: 'top-left' }));
        this.updateAttribution();
        this.render();
        this.fire('load');
      }

      /**
       * Adds an event listener to the map.
       * @param {string} type - The event type.
       * @param {Function} fn - The event listener function.
       * @returns {Atlas} The current map instance.
       */
      on(type, fn) {
        if (!this._events[type]) {
          this._events[type] = [];
        }
        this._events[type].push(fn);
        return this;
      }

      /**
       * Removes an event listener from the map.
       * @param {string} type - The event type.
       * @param {Function} [fn] - The event listener function. If not provided, all listeners for the type are removed.
       * @returns {Atlas} The current map instance.
       */
      off(type, fn) {
        if (!this._events[type]) return this;
        if (!fn) {
          this._events[type] = [];
        } else {
          this._events[type] = this._events[type].filter(cb => cb !== fn);
        }
        return this;
      }

      /**
       * Fires an event on the map.
       * @param {string} type - The event type.
       * @param {object} [data={}] - The event data.
       */
      fire(type, data = {}) {
        if (!this._events[type]) return;
        data.type = type;
        data.target = this;
        this._events[type].forEach(fn => fn(data));
      }

      /**
       * Adds a layer to the map.
       * @param {Layer} layer - The layer to add.
       * @returns {Atlas} The current map instance.
       */
      addLayer(layer) {
        if (!(layer instanceof Layer)) {
          throw new Error('Argument must be an instance of Layer');
        }
        if (!this._layers.includes(layer)) {
          this._layers.push(layer);
          layer._map = this;
          layer.onAdd();
          this.render();
          if (!this._baseLayer || (layer instanceof TileLayer && !this._baseLayer)) {
            this._baseLayer = layer;
            this.container.style.background = layer.getBackground();
          }
        }
        return this;
      }

      /**
       * Removes a layer from the map.
       * @param {Layer} layer - The layer to remove.
       * @returns {Atlas} The current map instance.
       */
      removeLayer(layer) {
        const index = this._layers.indexOf(layer);
        if (index !== -1) {
          this._layers.splice(index, 1);
          layer.onRemove();
          layer._map = null;
          if (this._baseLayer === layer) {
            this._baseLayer = this._layers.find(l => l instanceof TileLayer) || null;
            if (this._baseLayer) {
              this.container.style.background = this._baseLayer.getBackground();
            }
          }
          this.render();
        }
        return this;
      }

      /**
       * Sets the base layer of the map.
       * @param {TileLayer} newLayer - The new base layer.
       * @returns {Atlas} The current map instance.
       */
      setBaseLayer(newLayer) {
        if (!(newLayer instanceof TileLayer)) {
          throw new Error('Argument must be an instance of TileLayer');
        }
        if (this._baseLayer && this._baseLayer !== newLayer) {
          this.removeLayer(this._baseLayer);
        }
        if (!this._layers.includes(newLayer)) {
          this.addLayer(newLayer);
        } else {
          this._baseLayer = newLayer;
          this.container.style.background = newLayer.getBackground();
          this.zoom = Math.max(newLayer.getMinZoom(), Math.min(newLayer.getMaxZoom(), this.zoom));
          this.render();
        }
        return this;
      }

      /**
       * Gets the base layer of the map.
       * @returns {TileLayer} The base layer.
       */
      getBaseLayer() {
        return this._baseLayer;
      }

      /**
       * Adds a control to the map.
       * @param {Control} control - The control to add.
       * @returns {Atlas} The current map instance.
       */
      addControl(control) {
        if (!(control instanceof Control)) {
          throw new Error('Argument must be an instance of Control');
        }
        this._controls.push(control);
        control.addTo(this);
        return this;
      }

      /**
       * Removes a control from the map.
       * @param {Control} control - The control to remove.
       * @returns {Atlas} The current map instance.
       */
      removeControl(control) {
        const index = this._controls.indexOf(control);
        if (index !== -1) {
          this._controls.splice(index, 1);
          control.remove();
        }
        return this;
      }

      /**
       * Gets all controls on the map.
       * @returns {Control[]} An array of controls.
       */
      getControls() {
        return [...this._controls];
      }

      /**
       * Adds a handler to the map.
       * @param {string} name - The name of the handler.
       * @param {typeof Handler} HandlerClass - The handler class.
       * @returns {Atlas} The current map instance.
       */
      addHandler(name, HandlerClass) {
        if (this._handlers[name]) {
          console.warn(`Handler '${name}' already exists.`);
          return this;
        }
        this._handlers[name] = new HandlerClass(this);
        this._handlers[name].enable();
        return this;
      }

      /**
       * Removes a handler from the map.
       * @param {string} name - The name of the handler.
       * @returns {Atlas} The current map instance.
       */
      removeHandler(name) {
        if (!this._handlers[name]) return this;
        this._handlers[name].destroy();
        delete this._handlers[name];
        return this;
      }

      /**
       * Gets a handler by name.
       * @param {string} name - The name of the handler.
       * @returns {Handler|null} The handler instance or null if not found.
       */
      getHandler(name) {
        return this._handlers[name] || null;
      }

      /**
       * Enables a handler.
       * @param {string} name - The name of the handler.
       * @returns {Atlas} The current map instance.
       */
      enableHandler(name) {
        const handler = this.getHandler(name);
        if (handler) handler.enable();
        return this;
      }

      /**
       * Disables a handler.
       * @param {string} name - The name of the handler.
       * @returns {Atlas} The current map instance.
       */
      disableHandler(name) {
        const handler = this.getHandler(name);
        if (handler) handler.disable();
        return this;
      }

      /**
       * Gets all handlers on the map.
       * @returns {object} An object containing all handlers.
       */
      getHandlers() {
        return { ...this._handlers };
      }

      /**
       * Adds an overlay to the map.
       * @param {Overlay} overlay - The overlay to add.
       * @returns {Atlas} The current map instance.
       */
      addOverlay(overlay) {
        if (!(overlay instanceof Overlay)) {
          throw new Error('Argument must be an instance of Overlay');
        }
        if (!this._overlays.includes(overlay)) {
          this._overlays.push(overlay);
          overlay._map = this;
          overlay.onAdd();
          this.render();
        }
        return this;
      }

      /**
       * Removes an overlay from the map.
       * @param {Overlay} overlay - The overlay to remove.
       * @returns {Atlas} The current map instance.
       */
      removeOverlay(overlay) {
        const index = this._overlays.indexOf(overlay);
        if (index !== -1) {
          this._overlays.splice(index, 1);
          overlay.onRemove();
          overlay._map = null;
          this.render();
        }
        return this;
      }

      /**
       * Gets all overlays on the map.
       * @returns {Overlay[]} An array of overlays.
       */
      getOverlays() {
        return [...this._overlays];
      }

      /**
       * Sets the zoom level of the map.
       * @param {number} z - The new zoom level.
       */
      setZoom(z) {
        const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
        const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
        const nz = Math.max(minZoom, Math.min(maxZoom, z));
        if (nz === this.zoom) return;
        this.zoom = nz;
        this.render();
        this.showZoomOverlay();
        this.updateControlsUI();
        this.fire('zoom');
      }

      /**
       * Sets the bearing of the map.
       * @param {number} rad - The new bearing in radians.
       */
      setBearing(rad) {
        const nr = normalizeAngle(rad);
        if (Math.abs(nr - this.bearing) < 1e-6) return;
        this.bearing = nr;
        this.render();
        this.fire('rotate');
      }

      showZoomOverlay() {
        const overlay = this.zoomOverlay;
        overlay.textContent = `Zoom: ${this.zoom.toFixed(2)}`;
        overlay.style.opacity = 1;
        clearTimeout(this._zTimer);
        this._zTimer = setTimeout(() => overlay.style.opacity = 0, 500);
      }

      stopInertia() {
        if (this._inertiaRAF) cancelAnimationFrame(this._inertiaRAF);
        this._inertiaRAF = null;
      }

      /**
       * Stops all animations.
       */
      stopAnimations() {
        this.stopInertia();
        if (this._zoomAnim?.raf) cancelAnimationFrame(this._zoomAnim.raf);
        this._zoomAnim = null;
        if (this._flyAnim?.raf) cancelAnimationFrame(this._flyAnim.raf);
        this._flyAnim = null;
      }

      resize() {
        const w = this.container.offsetWidth, h = this.container.offsetHeight;
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.render();
        this.fire('resize');
      }

      scheduleRender() {
        if (this.renderScheduled) return;
        this.renderScheduled = true;
        requestAnimationFrame(() => {
          this.renderScheduled = false;
          this._draw();
        });
      }

      /**
       * Renders the map.
       */
      render() {
        this.scheduleRender();
      }

      _snapCanvasToPixelGrid() {
        const currentTransform = this.ctx.getTransform();
        const physicalTranslateX = currentTransform.e * this.dpr;
        const physicalTranslateY = currentTransform.f * this.dpr;
        const snapX = - (physicalTranslateX % 1) / this.dpr;
        const snapY = - (physicalTranslateY % 1) / this.dpr;
        this.ctx.translate(snapX, snapY);
      }

      _draw() {
        const backgroundColor = this._baseLayer ? this._baseLayer.getBackground() : '#000';
        const w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, w, h);

        for (const layer of this._layers) {
          layer.render();
        }

        for (const overlay of this._overlays) {
          overlay.render();
        }

        this._snapCanvasToPixelGrid();

        let loadingCount = 0;
        if (this._baseLayer && this._baseLayer instanceof TileLayer) {
          loadingCount = this._baseLayer.loadingTiles.size;
        }
        this.loadingEl.classList.toggle("visible", loadingCount > 0);
        this.loadingCountEl.textContent = loadingCount;
        this.coordsEl.textContent = `${this.center.lat.toFixed(6)}°, ${this.center.lon.toFixed(6)}° | Z: ${this.zoom.toFixed(2)} | Bearing: ${(this.bearing * RAD2DEG).toFixed(1)}° | Layer: ${this._baseLayer ? 'Custom' : 'None'}`;

        this.updateControlsUI();
        this.fire('moveend');
      }

      updateAttribution() {
        for (const control of this._controls) {
          if (control instanceof AttributionControl && typeof control._update === 'function') {
            control._update();
          }
        }
      }

      updateControlsUI() {
        for (const control of this._controls) {
          if (typeof control._update === 'function') {
            control._update();
          }
        }
      }

      /**
       * Gets the center of the map.
       * @returns {object} The geographical coordinate of the center.
       */
      getCenter() {
        return { ...this.center };
      }

      /**
       * Gets the zoom level of the map.
       * @returns {number} The zoom level.
       */
      getZoom() {
        return this.zoom;
      }

      /**
       * Gets the bearing of the map.
       * @returns {number} The bearing in radians.
       */
      getBearing() {
        return this.bearing;
      }


      /**
       * Converts a screen coordinate to a geographical coordinate.
       * @param {number} ax - The x-coordinate on the screen.
       * @param {number} ay - The y-coordinate on the screen.
       * @param {number} [zoom=this.zoom] - The zoom level.
       * @param {number} [bearing=this.bearing] - The bearing in radians.
       * @param {object} [center=this.center] - The center of the map.
       * @returns {object} The geographical coordinate.
       */
      screenToLatLon(ax, ay, zoom = this.zoom, bearing = this.bearing, center = this.center) {
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const zInt = Math.floor(zoom);
        const ts = TILE_SIZE * Math.pow(2, zoom - zInt);
        const ct = this.projection.latLngToTile(center, zInt);
        const anchorVec = { x: ax - w / 2, y: ay - h / 2 };
        const v = rot(anchorVec.x / ts, anchorVec.y / ts, -bearing);
        const tpt = { x: ct.x + v.x, y: ct.y + v.y };
        const ll = this.projection.tileToLatLng(tpt.x, tpt.y, zInt);
        return {
          lon: GISUtils.wrapLongitude(ll.lon),
          lat: GISUtils.clampLatitude(ll.lat)
        };
      }

      /**
       * Converts a geographical coordinate to a tile coordinate.
       * @param {number} lon - The longitude.
       * @param {number} lat - The latitude.
       * @param {number} z - The zoom level.
       * @returns {object} The tile coordinate.
       * @deprecated
       */
      lonLatToTile(lon, lat, z) {
        return this.projection.latLngToTile({ lat, lon }, z);
      }

      /**
       * Converts a geographical coordinate to a container point.
       * @param {object} latlng - The geographical coordinate.
       * @returns {object} The container point.
       */
      latLngToContainerPoint(latlng) {
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const zInt = Math.floor(this.zoom);
        const ts = TILE_SIZE * Math.pow(2, this.zoom - zInt);
        const ct = this.projection.latLngToTile(this.center, zInt);
        const pt = this.projection.latLngToTile(latlng, zInt);
        const trX = (pt.x - ct.x) * ts;
        const trY = (pt.y - ct.y) * ts;
        const anchorVec = rot(trX, trY, this.bearing);
        const screenX = w / 2 + anchorVec.x;
        const screenY = h / 2 + anchorVec.y;
        return { x: screenX, y: screenY };
      }

      applyZoomRotateAbout(ax, ay, newZoom, newBearing, anchorLL = null) {
        const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
        const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
        newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const anchorVec = { x: ax - w / 2, y: ay - h / 2 };
        const currAnchorLL = anchorLL || this.screenToLatLon(ax, ay, this.zoom, this.bearing, this.center);
        const zInt = Math.floor(newZoom);
        const ts = TILE_SIZE * Math.pow(2, newZoom - zInt);
        const Ptile = this.projection.latLngToTile(currAnchorLL, zInt);
        const v = rot(anchorVec.x / ts, anchorVec.y / ts, -newBearing);
        const ctNew = { x: Ptile.x - v.x, y: Ptile.y - v.y };
        const newCenter = this.projection.tileToLatLng(ctNew.x, ctNew.y, zInt);
        this.center = {
          lon: GISUtils.wrapLongitude(newCenter.lon),
          lat: GISUtils.clampLatitude(newCenter.lat)
        };
        this.zoom = newZoom;
        this.bearing = normalizeAngle(newBearing);
      }

      showZoomIndicator(x, y) {
        if (this._zoomIndicator) {
          this.container.removeChild(this._zoomIndicator);
        }
        const indicator = document.createElement("div");
        indicator.style.position = "absolute";
        indicator.style.left = (x - 15) + "px";
        indicator.style.top = (y - 15) + "px";
        indicator.style.width = "30px";
        indicator.style.height = "30px";
        indicator.style.borderRadius = "50%";
        indicator.style.border = "2px solid #333";
        indicator.style.opacity = "0.8";
        indicator.style.pointerEvents = "none";
        indicator.style.zIndex = "100";
        indicator.style.animation = "zoom-indicator 0.6s ease-out forwards";
        this.container.appendChild(indicator);
        this._zoomIndicator = indicator;
        setTimeout(() => {
          if (this._zoomIndicator && this._zoomIndicator.parentNode) {
            this.container.removeChild(this._zoomIndicator);
            this._zoomIndicator = null;
          }
        }, 600);
      }

      /**
       * Animates the map's zoom and rotation around a given point.
       * @param {number} ax - The x-coordinate of the anchor point.
       * @param {number} ay - The y-coordinate of the anchor point.
       * @param {number} toZoom - The target zoom level.
       * @param {number} [toBearing=this.bearing] - The target bearing in radians.
       * @param {number} [duration=WHEEL_ZOOM_DURATION] - The duration of the animation in milliseconds.
       * @param {Function} [easing=EASING.easeInOutCubic] - The easing function.
       */
      animateZoomRotateAbout(ax, ay, toZoom, toBearing = this.bearing, duration = WHEEL_ZOOM_DURATION, easing = EASING.easeInOutCubic) {
        this.showZoomIndicator(ax, ay);
        this.stopAnimations();
        const startT = performance.now();
        const sZoom = this.zoom;
        const sBear = this.bearing;
        const deltaBear = shortestAngleDiff(sBear, toBearing);
        const anchorLL = this.screenToLatLon(ax, ay, this.zoom, this.bearing, this.center);
        const step = () => {
          const t = (performance.now() - startT) / Math.max(1, duration);
          const p = t >= 1 ? 1 : easing(Math.max(0, Math.min(1, t)));
          const z = sZoom + (toZoom - sZoom) * p;
          const b = sBear + deltaBear * p;
          this.applyZoomRotateAbout(ax, ay, z, b, anchorLL);
          this.render();
          if (t < 1) {
            this._zoomAnim = { raf: requestAnimationFrame(step) };
          } else {
            this._zoomAnim = null;
            this.updateControlsUI();
            this.fire('zoomend');
          }
        };
        this._zoomAnim = { raf: requestAnimationFrame(step) };
        this.fire('zoomstart');
      }

      smoothZoomAt(ax, ay, deltaZ) {
        const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
        const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
        const target = Math.max(minZoom, Math.min(maxZoom, this.zoom + deltaZ));
        this.animateZoomRotateAbout(ax, ay, target, this.bearing, WHEEL_ZOOM_DURATION, EASING.easeInOutCubic);
      }

      /**
       * Animates the map to a new view.
       * @param {object} options - The animation options.
       * @param {object} [options.center] - The new center of the map.
       * @param {number} [options.zoom] - The new zoom level.
       * @param {number} [options.bearing] - The new bearing in radians.
       * @param {number} [options.duration] - The duration of the animation in milliseconds.
       * @param {Function} [options.easing] - The easing function.
       */
      flyTo({ center, zoom, bearing, duration, easing } = {}) {
        center = center || this.center;
        zoom = zoom || this.zoom;
        bearing = bearing || this.bearing;
        duration = duration || FLYTO_DURATION;
        easing = easing || EASING.easeInOutCubic;
        const minZoom = this._baseLayer ? this._baseLayer.getMinZoom() : 0;
        const maxZoom = this._baseLayer ? this._baseLayer.getMaxZoom() : 18;
        const targetZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
        this.stopAnimations();
        const startT = performance.now();
        const sC = { ...this.center };
        const eC = { lon: GISUtils.wrapLongitude(center.lon), lat: center.lat };
        const dLon = wrapDeltaLon(eC.lon - sC.lon);
        const dLat = eC.lat - sC.lat;
        const sZ = this.zoom, eZ = targetZoom;
        const sB = this.bearing, dB = shortestAngleDiff(sB, bearing);
        const step = () => {
          const t = (performance.now() - startT) / Math.max(1, duration);
          const p = t >= 1 ? 1 : easing(Math.max(0, Math.min(1, t)));
          const currentLon = sC.lon + dLon * p;
          this.center = {
            lon: t >= 1 ? GISUtils.wrapLongitude(currentLon) : currentLon,
            lat: GISUtils.clampLatitude(sC.lat + dLat * p)
          };
          this.zoom = sZ + (eZ - sZ) * p;
          this.bearing = normalizeAngle(sB + dB * p);
          this.render();
          if (t < 1) {
            this._flyAnim = { raf: requestAnimationFrame(step) };
          } else {
            this._flyAnim = null;
            this.updateControlsUI();
            this.fire('moveend');
          }
        };
        this._flyAnim = { raf: requestAnimationFrame(step) };
        this.fire('movestart');
      }

      /**
       * Destroys the map instance and cleans up its resources.
       */
      destroy() {
        this.stopAnimations();

        for (const layer of [...this._layers]) {
          this.removeLayer(layer);
        }

        for (const control of [...this._controls]) {
          this.removeControl(control);
        }

        for (const corner in this._controlCorners) {
          const container = this._controlCorners[corner];
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
        this._controlCorners = {};

        for (const name in this._handlers) {
          this.removeHandler(name);
        }

        for (const overlay of [...this._overlays]) {
          this.removeOverlay(overlay);
        }

        if (this._popupManager) {
          this._popupManager.destroy();
          this._popupManager = null;
        }

        this.fire('unload');
        this._events = {}; // Clear all event listeners
        console.log("[Atlas] Instance destroyed.");
      }
    }

    let atlasInstance = null;
    window.Atlas = Atlas;
    window.TileLayer = TileLayer;
    window.GeoJSONLayer = GeoJSONLayer;
    window.Layer = Layer;

    // --- Shared Tile Layer Instances ---
    const TILE_LAYERS = {
        OSM: (() => {
            const subdomains = ['a', 'b', 'c'];
            const randomSubdomain = subdomains[Math.floor(Math.random() * subdomains.length)];
            return new TileLayer(
                `https://${randomSubdomain}.tile.openstreetmap.org/{z}/{x}/{y}.png`,
                LAYERS.OSM
            );
        })(),
        ESRI: new TileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            LAYERS.ESRI
        )
    };

    const handleGeolocationError = message => {
        console.warn(message);

        if (!atlasInstance) {
            atlasInstance = new Atlas("map");
        }

        atlasInstance.notifications.show("Could not determine location. Showing default map.");
        atlasInstance.setBaseLayer(TILE_LAYERS.OSM);
    };

    /**
     * Initializes the Atlas map with the user's location.
     */
    const initializeAtlas = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          atlasInstance = new Atlas("map");
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          atlasInstance.flyTo({ center: { lat, lon }, zoom: 10 });
          atlasInstance.setBaseLayer(TILE_LAYERS.OSM);

          // Create a professional marker with popup
          const userMarker = new AtlasMarker({ lat, lon }, {
            draggable: true // Enable dragging for demo
          });

          userMarker.bindPopup(`
            <h3 style="margin:0 0 8px 0; font-size:16px;">You Are Here</h3>
            <p style="margin:0; font-size:14px;">Lat: ${lat.toFixed(6)}<br>Lon: ${lon.toFixed(6)}</p>
            <p style="margin:8px 0 0 0; font-size:12px; color:#666;">Drag me around!</p>
          `);

          userMarker.on('dragend', (e) => {
            const { lat, lon } = e.latlng;
            userMarker._popup.setContent(`
              <h3 style="margin:0 0 8px 0; font-size:16px;">You Are Here</h3>
              <p style="margin:0; font-size:14px;">Lat: ${lat.toFixed(6)}<br>Lon: ${lon.toFixed(6)}</p>
              <p style="margin:8px 0 0 0; font-size:12px; color:#666;">Drag me around!</p>
            `);
          });

          userMarker.addTo(atlasInstance);

          // Add GeoJSON layer
          const geojsonLayer = new GeoJSONLayer({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [lon, lat]
                },
                properties: {
                  name: 'You Are Here (GeoJSON)'
                }
              }
            ]
          }, {
            style: { radius: 8, fillColor: '#ff7800', color: '#fff', weight: 2 },
            interactive: true
          });

          geojsonLayer.on('click', (e) => {
            alert(`Clicked on GeoJSON point: ${e.feature.properties.name}`);
          });

          atlasInstance.addLayer(geojsonLayer);

        }, (error) => {
            handleGeolocationError(`[Atlas] Geolocation failed: ${error.message}. Loading map with default view.`);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      } else {
        handleGeolocationError("[Atlas] Geolocation is not supported by this browser. Loading map with default view.");
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeAtlas);
    } else {
      initializeAtlas();
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            Atlas,
            AttributionControl,
            TileLayer
        };
    }
