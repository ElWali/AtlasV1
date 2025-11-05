/**
 * Atlas.js - Lightweight Interactive Mapping Library
 * Version: 1.0.0
 * A mobile-friendly JavaScript library for creating interactive maps
 */

class Atlas {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Default options
    this.options = {
      zoom: options.zoom || 5,
      minZoom: options.minZoom || 1,
      maxZoom: options.maxZoom || 20,
      centerLat: options.centerLat || 0,
      centerLon: options.centerLon || 0,
      draggable: options.draggable !== false,
      zoomable: options.zoomable !== false,
      ...options
    };

    this.markers = [];
    this.lines = [];
    this.polygons = [];
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.setupContainer();
    this.createCanvas();
    this.setupEventListeners();
    this.centerMap();
    this.render();
  }

  setupContainer() {
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.overflow = 'hidden';
    this.container.style.touchAction = 'none';
  }

  createCanvas() {
    // Remove existing canvas if any
    const existingCanvas = this.container.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    
    this.setCanvasSize();
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    
    this.container.appendChild(this.canvas);
  }

  setCanvasSize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

    // Resize listener
    window.addEventListener('resize', () => {
      this.setCanvasSize();
      this.render();
    });
  }

  // Mouse event handlers
  handleMouseDown(e) {
    if (!this.options.draggable) return;

    const rect = this.canvas.getBoundingClientRect();
    this.dragStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    this.isDragging = true;
    this.canvas.style.cursor = 'grabbing';
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.options.draggable) return;

    const rect = this.canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const deltaX = currentX - this.dragStart.x;
    const deltaY = currentY - this.dragStart.y;

    this.offsetX += deltaX;
    this.offsetY += deltaY;

    this.dragStart = { x: currentX, y: currentY };
    this.render();
  }

  handleMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }

  handleMouseLeave() {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }

  handleWheel(e) {
    if (!this.options.zoomable) return;

    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = this.scale * zoomFactor;

    // Clamp zoom level
    const clampedScale = Math.max(
      this.options.minZoom / 5,
      Math.min(newScale, this.options.maxZoom / 5)
    );

    if (clampedScale === this.scale) return;

    // Zoom towards mouse position
    const scaleFactor = clampedScale / this.scale;
    this.offsetX = mouseX + (this.offsetX - mouseX) * scaleFactor;
    this.offsetY = mouseY + (this.offsetY - mouseY) * scaleFactor;
    this.scale = clampedScale;

    this.render();
  }

  // Touch event handlers
  handleTouchStart(e) {
    if (!this.options.draggable) return;

    if (e.touches.length === 1) {
      const rect = this.canvas.getBoundingClientRect();
      this.dragStart = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
      this.isDragging = true;
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      this.touchStartDistance = this.getTouchDistance(e.touches);
      this.touchStartScale = this.scale;
    }
  }

  handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 1 && this.isDragging && this.options.draggable) {
      const rect = this.canvas.getBoundingClientRect();
      const currentX = e.touches[0].clientX - rect.left;
      const currentY = e.touches[0].clientY - rect.top;

      const deltaX = currentX - this.dragStart.x;
      const deltaY = currentY - this.dragStart.y;

      this.offsetX += deltaX;
      this.offsetY += deltaY;

      this.dragStart = { x: currentX, y: currentY };
      this.render();
    } else if (e.touches.length === 2 && this.options.zoomable) {
      const currentDistance = this.getTouchDistance(e.touches);
      const scale = currentDistance / this.touchStartDistance;
      const newScale = this.touchStartScale * scale;

      const clampedScale = Math.max(
        this.options.minZoom / 5,
        Math.min(newScale, this.options.maxZoom / 5)
      );

      if (clampedScale !== this.scale) {
        this.scale = clampedScale;
        this.render();
      }
    }
  }

  handleTouchEnd() {
    this.isDragging = false;
  }

  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Coordinate conversion methods
  latLonToPixels(lat, lon) {
    const x = (lon + 180) * (256 / 360);
    const y = (180 - lat) * (256 / 360);
    return { x, y };
  }

  pixelsToLatLon(x, y) {
    const lon = (x * 360) / 256 - 180;
    const lat = 180 - (y * 360) / 256;
    return { lat, lon };
  }

  screenToWorld(screenX, screenY) {
    const worldX = (screenX - this.offsetX) / this.scale;
    const worldY = (screenY - this.offsetY) / this.scale;
    return this.pixelsToLatLon(worldX, worldY);
  }

  worldToScreen(lat, lon) {
    const { x, y } = this.latLonToPixels(lat, lon);
    const screenX = x * this.scale + this.offsetX;
    const screenY = y * this.scale + this.offsetY;
    return { x: screenX, y: screenY };
  }

  // Marker methods
  addMarker(lat, lon, options = {}) {
    const marker = {
      id: options.id || `marker_${this.markers.length}`,
      lat,
      lon,
      label: options.label || '',
      color: options.color || '#FF6B6B',
      size: options.size || 12,
      icon: options.icon || null,
      onClick: options.onClick || null,
      ...options
    };

    this.markers.push(marker);
    this.render();
    return marker.id;
  }

  removeMarker(id) {
    const index = this.markers.findIndex(m => m.id === id);
    if (index > -1) {
      this.markers.splice(index, 1);
      this.render();
      return true;
    }
    return false;
  }

  getMarker(id) {
    return this.markers.find(m => m.id === id);
  }

  updateMarker(id, updates) {
    const marker = this.getMarker(id);
    if (marker) {
      Object.assign(marker, updates);
      this.render();
      return true;
    }
    return false;
  }

  clearMarkers() {
    this.markers = [];
    this.render();
  }

  // Line methods
  addLine(points, options = {}) {
    if (!Array.isArray(points) || points.length < 2) {
      console.error('Line must have at least 2 points');
      return null;
    }

    const line = {
      id: options.id || `line_${this.lines.length}`,
      points,
      color: options.color || '#4ECDC4',
      width: options.width || 2,
      style: options.style || 'solid',
      ...options
    };

    this.lines.push(line);
    this.render();
    return line.id;
  }

  removeLine(id) {
    const index = this.lines.findIndex(l => l.id === id);
    if (index > -1) {
      this.lines.splice(index, 1);
      this.render();
      return true;
    }
    return false;
  }

  getLine(id) {
    return this.lines.find(l => l.id === id);
  }

  clearLines() {
    this.lines = [];
    this.render();
  }

  // Polygon methods
  addPolygon(points, options = {}) {
    if (!Array.isArray(points) || points.length < 3) {
      console.error('Polygon must have at least 3 points');
      return null;
    }

    const polygon = {
      id: options.id || `polygon_${this.polygons.length}`,
      points,
      fillColor: options.fillColor || 'rgba(78, 205, 196, 0.3)',
      strokeColor: options.strokeColor || '#4ECDC4',
      strokeWidth: options.strokeWidth || 2,
      ...options
    };

    this.polygons.push(polygon);
    this.render();
    return polygon.id;
  }

  removePolygon(id) {
    const index = this.polygons.findIndex(p => p.id === id);
    if (index > -1) {
      this.polygons.splice(index, 1);
      this.render();
      return true;
    }
    return false;
  }

  getPolygon(id) {
    return this.polygons.find(p => p.id === id);
  }

  clearPolygons() {
    this.polygons = [];
    this.render();
  }

  // Map controls
  centerMap() {
    const { x, y } = this.latLonToPixels(this.options.centerLat, this.options.centerLon);
    this.offsetX = this.canvasWidth / 2 - x * this.scale;
    this.offsetY = this.canvasHeight / 2 - y * this.scale;
    this.render();
  }

  zoomTo(lat, lon, zoom) {
    this.options.centerLat = lat;
    this.options.centerLon = lon;
    this.scale = Math.max(
      this.options.minZoom / 5,
      Math.min(zoom / 5, this.options.maxZoom / 5)
    );
    this.centerMap();
  }

  panTo(lat, lon, duration = 500) {
    const startLat = this.options.centerLat;
    const startLon = this.options.centerLon;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-quad)
      const easeProgress = 1 - Math.pow(1 - progress, 2);

      this.options.centerLat = startLat + (lat - startLat) * easeProgress;
      this.options.centerLon = startLon + (lon - startLon) * easeProgress;

      this.centerMap();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    animate();
  }

  // Rendering
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw grid (optional background)
    this.drawGrid();

    // Save context state
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // Draw polygons
    this.polygons.forEach(polygon => this.drawPolygon(polygon));

    // Draw lines
    this.lines.forEach(line => this.drawLine(line));

    // Draw markers
    this.markers.forEach(marker => this.drawMarker(marker));

    // Restore context state
    this.ctx.restore();

    // Draw UI elements (zoom info, etc.)
    this.drawUI();
  }

  drawGrid() {
    const gridSpacing = 50;
    this.ctx.strokeStyle = '#E0E0E0';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < this.canvasWidth; x += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvasHeight);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < this.canvasHeight; y += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvasWidth, y);
      this.ctx.stroke();
    }
  }

  drawMarker(marker) {
    const { x, y } = this.latLonToPixels(marker.lat, marker.lon);

    if (marker.icon) {
      // Draw custom icon if provided
      this.ctx.fillStyle = marker.color;
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(marker.icon, x, y);
    } else {
      // Draw default circular marker
      this.ctx.beginPath();
      this.ctx.arc(x, y, marker.size, 0, Math.PI * 2);
      this.ctx.fillStyle = marker.color;
      this.ctx.fill();
      this.ctx.strokeStyle = '#FFF';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Draw label
    if (marker.label) {
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(marker.label, x, y + marker.size + 5);
    }
  }

  drawLine(line) {
    if (line.points.length < 2) return;

    this.ctx.strokeStyle = line.color;
    this.ctx.lineWidth = line.width;

    // Handle dashed lines
    if (line.style === 'dashed') {
      this.ctx.setLineDash([5, 5]);
    } else if (line.style === 'dotted') {
      this.ctx.setLineDash([2, 2]);
    } else {
      this.ctx.setLineDash([]);
    }

    this.ctx.beginPath();
    let firstPoint = true;

    line.points.forEach(point => {
      const { x, y } = this.latLonToPixels(point.lat, point.lon);
      if (firstPoint) {
        this.ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawPolygon(polygon) {
    if (polygon.points.length < 3) return;

    this.ctx.fillStyle = polygon.fillColor;
    this.ctx.strokeStyle = polygon.strokeColor;
    this.ctx.lineWidth = polygon.strokeWidth;

    this.ctx.beginPath();
    let firstPoint = true;

    polygon.points.forEach(point => {
      const { x, y } = this.latLonToPixels(point.lat, point.lon);
      if (firstPoint) {
        this.ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  drawUI() {
    // Draw zoom level indicator
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Zoom: ${(this.scale * 5).toFixed(1)}x`, 10, 20);

    // Draw coordinates (optional)
    const centerCoords = this.pixelsToLatLon(
      (this.canvasWidth / 2 - this.offsetX) / this.scale,
      (this.canvasHeight / 2 - this.offsetY) / this.scale
    );
    this.ctx.fillText(
      `Lat: ${centerCoords.lat.toFixed(2)}, Lon: ${centerCoords.lon.toFixed(2)}`,
      10,
      40
    );
  }

  // Utility methods
  fitBounds(bounds) {
    if (!bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      console.error('Bounds must have north, south, east, west properties');
      return;
    }

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLon = (bounds.east + bounds.west) / 2;

    const { x: x1, y: y1 } = this.latLonToPixels(bounds.north, bounds.west);
    const { x: x2, y: y2 } = this.latLonToPixels(bounds.south, bounds.east);

    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    const scaleX = this.canvasWidth / width;
    const scaleY = this.canvasHeight / height;

    this.scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for padding

    this.options.centerLat = centerLat;
    this.options.centerLon = centerLon;

    this.centerMap();
  }

  getMarkers() {
    return this.markers;
  }

  getLines() {
    return this.lines;
  }

  getPolygons() {
    return this.polygons;
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.canvas.remove();
    this.container.innerHTML = '';
  }

  // Export data
  exportGeoJSON() {
    const features = [];

    // Export markers
    this.markers.forEach(marker => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lon, marker.lat]
        },
        properties: {
          id: marker.id,
          label: marker.label,
          color: marker.color
        }
      });
    });

    // Export lines
    this.lines.forEach(line => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: line.points.map(p => [p.lon, p.lat])
        },
        properties: {
          id: line.id,
          color: line.color
        }
      });
    });

    // Export polygons
    this.polygons.forEach(polygon => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [polygon.points.map(p => [p.lon, p.lat])]
        },
        properties: {
          id: polygon.id,
          fillColor: polygon.fillColor
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  // Import GeoJSON
  importGeoJSON(geoJSON) {
    if (!geoJSON.features || !Array.isArray(geoJSON.features)) {
      console.error('Invalid GeoJSON format');
      return false;
    }

    geoJSON.features.forEach(feature => {
      const { geometry, properties } = feature;

      switch (geometry.type) {
        case 'Point':
          this.addMarker(geometry.coordinates[1], geometry.coordinates[0], {
            id: properties.id,
            label: properties.label,
            color: properties.color
          });
          break;

        case 'LineString':
          const linePoints = geometry.coordinates.map(coord => ({
            lon: coord[0],
            lat: coord[1]
          }));
          this.addLine(linePoints, {
            id: properties.id,
            color: properties.color
          });
          break;

        case 'Polygon':
          const polyPoints = geometry.coordinates[0].map(coord => ({
            lon: coord[0],
            lat: coord[1]
          }));
          this.addPolygon(polyPoints, {
            id: properties.id,
            fillColor: properties.fillColor
          });
          break;
      }
    });

    return true;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Atlas;
}
