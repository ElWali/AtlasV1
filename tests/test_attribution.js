
const assert = require('assert');
const { JSDOM } = require('jsdom');

// Create a mock for the Geolocation API
const mockGeolocation = {
  getCurrentPosition: (success, error, options) => {
    // Simulate a successful position retrieval
    const position = {
      coords: {
        latitude: 51.505,
        longitude: -0.09,
        accuracy: 100,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
    success(position);
  },
  watchPosition: (success, error, options) => {
    // Simulate watching position, return a watchId
    const watchId = 1;
    return watchId;
  },
  clearWatch: (watchId) => {
    // Simulate clearing a watch
  },
};

const dom = new JSDOM(`
  <!DOCTYPE html>
  <div id="map-container">
    <canvas id="map"></canvas>
    <div id="loading">Loading: <span id="loading-count">0</span></div>
    <div id="zoom-overlay"></div>
    <div id="coords"></div>
  </div>
`, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = {
    ...dom.window.navigator,
    geolocation: mockGeolocation,
  };
global.Image = dom.window.Image;
global.DOMParser = dom.window.DOMParser;
global.performance = dom.window.performance;
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);

// Prevent the global initializeAtlas from running
global.window.initializeAtlas = () => {};

const { Atlas, AttributionControl, TileLayer } = require('../Atlas.js');

describe('AttributionControl', () => {
  it('should not have an id', () => {
    const map = new Atlas('map');
    const control = new AttributionControl();
    map.addControl(control);

    const container = control.getContainer();
    assert.strictEqual(container.id, '');
  });

  it('should not inject script elements into the attribution text', () => {
    const map = new Atlas('map');
    const control = new AttributionControl();
    map.addControl(control);

    const maliciousAttribution = '<script>window.hacked = true;</script>';
    const layer = new TileLayer('', { attribution: maliciousAttribution });
    map.setBaseLayer(layer);

    map.updateAttribution();

    const container = control.getContainer();
    assert.strictEqual(container.querySelector('script'), null, 'Script element should not be in the container');
  });
});
