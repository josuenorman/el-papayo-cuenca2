// Tiles requested only when the user selects an online terrain background.
// Small, bounded viewport; no offline tile download or background prefetch.
const cache = new Map();
export const providers = {
  osm: {
    label: 'OpenStreetMap',
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    credits: '© OpenStreetMap contributors',
    link: 'https://www.openstreetmap.org/copyright'
  },
  satellite: {
    label: 'Satelital · Esri World Imagery',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    credits: 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    link: 'https://www.esri.com/en-us/legal/terms/full-master-agreement'
  }
};

function loadTile(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => reject(Error('El proveedor no respondió a tiempo.')), 15000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(Error('El proveedor no permite cargar la imagen.')); };
    image.src = url;
  });
}

export function terrainBackground(provider, extent, crs, size) {
  const key = JSON.stringify([provider, extent, crs, size]);
  if (!cache.has(key)) {
    cache.set(key, createBackground(provider, extent, crs, size).catch(error => {
      cache.delete(key);
      throw error;
    }));
  }
  return cache.get(key);
}

async function createBackground(provider, extent, crs, size) {
  if (!window.proj4) throw Error('No se pudo cargar la reproyección del fondo.');
  const defs = {'EPSG:32616': '+proj=utm +zone=16 +datum=WGS84 +units=m +no_defs'};
  if (!defs[crs]) throw Error('CRS del terreno no compatible con el fondo.');
  proj4.defs(crs, defs[crs]);
  const tx = proj4(crs, 'EPSG:3857');
  const world = 20037508.342789244;
  const corners = [[extent[0], extent[1]], [extent[0], extent[3]],
    [extent[2], extent[1]], [extent[2], extent[3]]].map(point => tx.forward(point));
  const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0]));
  const minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]));
  let zoom = 13, left, right, top, bottom, span;
  function tileBounds() {
    span = 2 * world / 2 ** zoom;
    left = Math.floor((minX + world) / span); right = Math.floor((maxX + world) / span);
    top = Math.floor((world - maxY) / span); bottom = Math.floor((world - minY) / span);
  }
  tileBounds();
  while ((right - left + 1) * (bottom - top + 1) > 36 && zoom > 0) { zoom--; tileBounds(); }
  const mosaic = document.createElement('canvas');
  mosaic.width = (right - left + 1) * 256; mosaic.height = (bottom - top + 1) * 256;
  const ctx = mosaic.getContext('2d', {willReadFrequently: true});
  const queue = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) queue.push({x, y});
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const tile = queue[cursor++];
      const image = await loadTile(providers[provider].url(zoom, tile.x, tile.y));
      ctx.drawImage(image, (tile.x - left) * 256, (tile.y - top) * 256, 256, 256);
    }
  }
  await Promise.all(Array.from({length: Math.min(4, queue.length)}, worker));
  const source = ctx.getImageData(0, 0, mosaic.width, mosaic.height).data;
  const output = document.createElement('canvas'); output.width = size; output.height = size;
  const out = output.getContext('2d'); const pixels = out.createImageData(size, size);
  // Reprojection grid sampled in UTM, then interpolated in each small cell.
  // It avoids stretching a geographic rectangle directly onto UTM terrain.
  const n = 48, grid = [];
  for (let y = 0; y <= n; y++) {
    const row = [];
    for (let x = 0; x <= n; x++) {
      const [mx, my] = tx.forward([extent[0] + (extent[2] - extent[0]) * x / n,
        extent[3] - (extent[3] - extent[1]) * y / n]);
      row.push([(mx + world) / span * 256 - left * 256,
        (world - my) / span * 256 - top * 256]);
    }
    grid.push(row);
  }
  for (let y = 0; y < size; y++) {
    const gy = (y + 0.5) / size * n, iy = Math.min(n - 1, Math.floor(gy)), fy = gy - iy;
    for (let x = 0; x < size; x++) {
      const gx = (x + 0.5) / size * n, ix = Math.min(n - 1, Math.floor(gx)), fx = gx - ix;
      const a = grid[iy][ix], b = grid[iy][ix + 1], c = grid[iy + 1][ix], d = grid[iy + 1][ix + 1];
      const sx = Math.max(0, Math.min(mosaic.width - 1, Math.round((a[0] * (1 - fx) + b[0] * fx) * (1 - fy) + (c[0] * (1 - fx) + d[0] * fx) * fy)));
      const sy = Math.max(0, Math.min(mosaic.height - 1, Math.round((a[1] * (1 - fx) + b[1] * fx) * (1 - fy) + (c[1] * (1 - fx) + d[1] * fx) * fy)));
      const from = (sy * mosaic.width + sx) * 4, to = (y * size + x) * 4;
      pixels.data[to] = source[from]; pixels.data[to + 1] = source[from + 1];
      pixels.data[to + 2] = source[from + 2]; pixels.data[to + 3] = source[from + 3];
    }
  }
  out.putImageData(pixels, 0, 0);
  return output;
}
