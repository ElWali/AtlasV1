# Atlas.js

Atlas.js is a lightweight, open-source JavaScript library for creating interactive maps.

## Installation

To use Atlas.js, include the `Atlas.css` and `Atlas.js` files in your HTML:

```html
<head>
  ...
  <link rel="stylesheet" href="Atlas.css" />
  ...
</head>
<body>
  ...
  <script src="Atlas.js"></script>
  ...
</body>
```

## Usage

Create a `div` element with a `canvas` inside it to contain your map:

```html
<div id="map-container" style="width: 600px; height: 400px;">
  <canvas id="map"></canvas>
</div>
```

Then, create a new `Atlas` instance:

```javascript
const map = new Atlas('map', {
  defaultCenter: { lon: -0.09, lat: 51.505 },
  defaultZoom: 13
});
```

### Adding a Marker

To add a marker to the map, create a new `AtlasMarker` instance and add it to the map:

```javascript
const marker = new AtlasMarker({ lat: 51.505, lon: -0.09 });
marker.addTo(map);
```

### Adding a GeoJSON Layer

To add a GeoJSON layer to the map, create a new `GeoJSONLayer` instance and add it to the map:

```javascript
const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-0.09, 51.505]
      },
      properties: {
        name: 'A GeoJSON Point'
      }
    }
  ]
};

const geojsonLayer = new GeoJSONLayer(geojson);
geojsonLayer.addTo(map);
```

## API Reference

### `Atlas`

The main map class.

- `new Atlas(id, options)`: Creates a new map instance.
- `addLayer(layer)`: Adds a layer to the map.
- `removeLayer(layer)`: Removes a layer from the map.
- `addControl(control)`: Adds a control to the map.
- `removeControl(control)`: Removes a control from the map.
- `setZoom(zoom)`: Sets the zoom level of the map.
- `setBearing(bearing)`: Sets the bearing of the map in radians.
- `flyTo(options)`: Animates the map to a new view.

### `TileLayer`

A layer for displaying tiled map data.

- `new TileLayer(urlTemplate, options)`: Creates a new tile layer.

### `GeoJSONLayer`

A layer for displaying GeoJSON data.

- `new GeoJSONLayer(geojson, options)`: Creates a new GeoJSON layer.
- `setData(geojson)`: Sets the GeoJSON data for the layer.
- `getData()`: Gets the GeoJSON data for the layer.

### `AtlasMarker`

A marker that can be placed on the map.

- `new AtlasMarker(latlng, options)`: Creates a new marker.
- `setLatLng(latlng)`: Sets the geographical coordinate of the marker.
- `getLatLng()`: Gets the geographical coordinate of the marker.
- `bindPopup(content, options)`: Binds a popup to the marker.

### `AtlasPopup`

A popup that can be opened on the map.

- `new AtlasPopup(content, options)`: Creates a new popup.
- `openOn(anchor)`: Opens the popup on the map.
- `close()`: Closes the popup.
- `setContent(content)`: Sets the content of the popup.

## Development

To set up a development environment, you will need a local web server to serve the files. A simple way to do this is to use Python's built-in HTTP server:

```bash
python3 -m http.server
```

This will start a web server in the current directory, and you can access the `index.html` file at `http://localhost:8000`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on our [GitHub repository](https://github.com/your-username/atlas.js).

## License

This project is licensed under the BSD-2-Clause License.

Copyright (c) 2023, Your Name

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT- LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
