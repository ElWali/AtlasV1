const chai = require('chai');
const expect = chai.expect;
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

const atlasPath = path.resolve(__dirname, './atlas.js');
const atlasCode = fs.readFileSync(atlasPath, 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="map"></div></body></html>', {
  runScripts: "dangerously",
  resources: "usable"
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

const atlas = require(atlasPath);

describe('atlas.js', () => {
  it('should have a valid version', () => {
    expect(atlas.version).to.match(/^\d+\.\d+\.\d+$/);
  });
});
