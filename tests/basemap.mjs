import assert from 'node:assert/strict';
import { basemap } from '../web/basemap.js';

const controls = { satLabels: {}, labelOption: {} };
const buttons = ['vector', 'satellite'].map(base => ({ dataset: { base }, setAttribute() {} }));
globalThis.document = { body: { dataset: {} }, getElementById: id => controls[id], querySelectorAll: () => buttons };
let saved = JSON.stringify({ provider: 'bing', mode: 'vector' });
globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => saved = value };
const layers = [];
globalThis.L = {
  layerGroup: () => ({ addTo() { return this; }, clearLayers() { layers.length = 0; } }),
  tileLayer: url => ({ addTo() { layers.push(url); } }),
};
const start = () => basemap({}, () => {});
const vector = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
const satellite = 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}';
const labels = satellite.replace('style=6', 'style=8');
start();
assert.deepEqual(layers, [vector]);
buttons[1].onclick();
assert.deepEqual(layers, [satellite, labels]);
controls.satLabels.onchange({ target: { checked: false } });
start();
assert.deepEqual(layers, [satellite]);
buttons[0].onclick();
assert.deepEqual(layers, [vector]);
assert.equal(controls.labelOption.hidden, true);
console.log('Verified NOTAMS vector and satellite URLs, labels and mode persistence.');
