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
