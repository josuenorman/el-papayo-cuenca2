import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const status = document.querySelector('#status');
const intro = document.querySelector('#intro');
document.querySelector('#presentation').onclick = () => intro.showModal();
document.querySelector('#closeintro').onclick = document.querySelector('#explore').onclick = () => intro.close();
intro.showModal();

function appendLegend(container, item) {
  for (const symbol of item.legend || []) {
    const line = document.createElement('div');
    line.className = 'legend-row';
    const swatch = document.createElement('span');
    swatch.className = 'legend';
    swatch.style.background = symbol.color;
    line.append(swatch, document.createTextNode(symbol.label));
    container.append(line);
  }
  if (item.rendering) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = item.rendering;
    container.append(note);
  }
}

try {
  const response = await fetch('datos/manifest.json');
  if (!response.ok) throw Error('Inventario no disponible');
  const data = await response.json();
  const corners = data.corners;
  const bounds = [[corners[2][1], corners[0][0]], [corners[0][1], corners[2][0]]];
  const map = L.map('map').fitBounds(bounds);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  const groups = new Map();
  for (const item of data.layers) {
    if (!groups.has(item.group)) {
      const section = document.createElement('details');
      section.className = 'layer-group';
      section.open = item.group.includes('Área de estudio');
      const summary = document.createElement('summary');
      summary.textContent = item.group;
      section.append(summary);
      groups.set(item.group, section);
      document.querySelector('#layers').append(section);
    }
    const row = document.createElement('div');
    row.className = 'layer';
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = item.visible;
    label.append(check, document.createTextNode(' ' + item.name));
    row.append(label);
    let layer;
    if (item.type === 'raster') {
      layer = L.imageOverlay(item.url, bounds, {opacity: 0.8});
    } else {
      const r = await fetch(item.url);
      if (!r.ok) throw Error('Capa no disponible: ' + item.name);
      layer = L.geoJSON(await r.json(), {
        style: {color: item.id.includes('riesgo') ? '#d15630' : '#236694', weight: 2, fillOpacity: 0.04},
        onEachFeature: (feature, l) => {
          const node = document.createElement('div');
          node.textContent = item.name;
          l.bindPopup(node);
        }
      });
    }
    if (check.checked) layer.addTo(map);
    check.onchange = () => check.checked ? layer.addTo(map) : map.removeLayer(layer);
    if (item.type === 'raster') {
      const opacity = document.createElement('input');
      opacity.type = 'range'; opacity.min = 0; opacity.max = 1; opacity.step = 0.05; opacity.value = 0.8;
      opacity.setAttribute('aria-label', 'Opacidad ' + item.name);
      opacity.oninput = () => layer.setOpacity(Number(opacity.value));
      row.append(opacity);
    }
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Descripción y leyenda';
    const desc = document.createElement('p');
    desc.className = 'hint'; desc.textContent = item.description;
    details.append(summary, desc);
    appendLegend(details, item);
    row.append(details);
    groups.get(item.group).append(row);
  }

  let renderer, scene, camera, controls, mesh, terrainGrid;
  let compositionVersion = 0;
  const images = new Map();
  const slots = [];
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 1536;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const dem = data.layers.find(l => l.id === 'dem_cuenca_2_p2');

  function image(url) {
    if (!images.has(url)) {
      images.set(url, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { images.delete(url); reject(Error('Imagen no disponible: ' + url)); };
        img.src = url;
      }));
    }
    return images.get(url);
  }

  async function compose() {
    const version = ++compositionVersion;
    const selected = slots.filter(s => s.select.value).map(s => ({
      item: data.layers.find(l => l.id === s.select.value), opacity: Number(s.slider.value) / 100
    }));
    const loaded = await Promise.all([image(dem.texture), ...selected.map(s => image(s.item.texture))]);
    if (version !== compositionVersion) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
    context.drawImage(loaded[0], 0, 0, canvas.width, canvas.height);
    selected.forEach((s, i) => {
      context.globalAlpha = s.opacity;
      context.drawImage(loaded[i + 1], 0, 0, canvas.width, canvas.height);
    });
    context.globalAlpha = 1;
    texture.needsUpdate = true;
    const legend = document.querySelector('#legend3');
    legend.replaceChildren();
    for (const s of selected) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = s.item.name + ' · ' + Math.round(s.opacity * 100) + ' %';
      details.append(summary);
      const description = document.createElement('p');
      description.className = 'hint'; description.textContent = s.item.description;
      details.append(description);
      appendLegend(details, s.item);
      legend.append(details);
    }
    status.textContent = data.layers.length + ' capas · ' + selected.length + '/3 superpuestas en 3D';
  }

  function updateComposition() {
    if (mesh) compose().catch(error => { status.textContent = error.message; });
  }

  for (let i = 0; i < 3; i++) {
    const box = document.createElement('div');
    box.className = 'slot';
    const label = document.createElement('label');
    label.textContent = 'Capa ' + (i + 1) + (i === 0 ? ' · inferior' : i === 2 ? ' · superior' : ' · intermedia');
    const select = document.createElement('select');
    select.id = 'slot-' + i; label.htmlFor = select.id;
    const none = document.createElement('option'); none.value = ''; none.textContent = 'Sin superposición'; select.append(none);
    for (const item of data.layers) {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option);
    }
    const opacityLabel = document.createElement('label');
    const output = document.createElement('output'); output.value = '65 %';
    opacityLabel.append('Opacidad: ', output);
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 0; slider.max = 100; slider.step = 1; slider.value = 65;
    slider.setAttribute('aria-label', 'Opacidad capa 3D ' + (i + 1));
    slider.oninput = () => { output.value = slider.value + ' %'; updateComposition(); };
    select.onchange = updateComposition;
    box.append(label, select, opacityLabel, slider);
    slots.push({select, slider});
    document.querySelector('#slots').append(box);
  }

  function resetCamera() {
    const scale = Math.max(data.extent[2] - data.extent[0], data.extent[3] - data.extent[1]);
    camera.position.set(scale * 0.5, scale * 0.8, scale * 0.8);
    controls.target.set(0, (terrainGrid.maximum - terrainGrid.minimum) / 2, 0);
    controls.update();
  }

  async function initialize3D() {
    if (renderer) return;
    const r = await fetch('datos/terreno.json');
    if (!r.ok) throw Error('DEM no disponible');
    terrainGrid = await r.json();
    const grid = terrainGrid;
    const area = document.querySelector('#terrain');
    scene = new THREE.Scene(); scene.background = new THREE.Color('#dce9ec');
    camera = new THREE.PerspectiveCamera(45, 1, 1, 200000);
    const width = data.extent[2] - data.extent[0], height = data.extent[3] - data.extent[1];
    const geometry = new THREE.PlaneGeometry(width, height, grid.width - 1, grid.height - 1);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, grid.heights[i] - grid.minimum);
    // Do not invent a flat terrain outside the DEM footprint.
    const indices = [];
    const original = geometry.index.array;
    for (let i = 0; i < original.length; i += 3) {
      if ([original[i], original[i + 1], original[i + 2]].every(index => grid.valid[index])) {
        indices.push(original[i], original[i + 1], original[i + 2]);
      }
    }
    geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map: texture, side: THREE.DoubleSide, roughness: 1, metalness: 0
    }));
    scene.add(mesh);
    scene.add(new THREE.AmbientLight('#ffffff', 1.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-width, width, height); scene.add(sun);
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    area.append(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    resetCamera();
    mesh.scale.y = Number(document.querySelector('#exaggeration').value);
    function resize() {
      const w = area.clientWidth, h = area.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(area); resize();
    renderer.setAnimationLoop(() => {
      if (area.style.display === 'none') return;
      controls.update(); renderer.render(scene, camera);
    });
    await compose();
  }

  document.querySelector('#exaggeration').oninput = event => {
    const value = Number(event.target.value);
    document.querySelector('#exaggerationvalue').value = value + '×';
    if (mesh) mesh.scale.y = value;
  };
  document.querySelector('#reset3').onclick = () => { if (camera) resetCamera(); };
  function mode(is3D) {
    document.querySelector('#terrain').style.display = is3D ? 'block' : 'none';
    document.querySelector('#map').style.display = is3D ? 'none' : 'block';
    document.querySelector('#threecontrols').hidden = !is3D;
    document.querySelector('#badge3').hidden = !is3D;
    document.querySelector('#layers').hidden = is3D;
    document.querySelector('#mode2').setAttribute('aria-pressed', String(!is3D));
    document.querySelector('#mode3').setAttribute('aria-pressed', String(is3D));
  }
  document.querySelector('#mode2').onclick = () => { mode(false); map.invalidateSize(); };
  document.querySelector('#mode3').onclick = async () => {
    mode(true);
    try { await initialize3D(); } catch (error) { status.textContent = 'Error 3D: ' + error.message; }
  };
  status.textContent = data.layers.length + ' capas disponibles · Análisis preliminar';
} catch (error) {
  status.textContent = 'Error: ' + error.message;
}
