import * as THREE from 'three';

// One GPS subscription shared by both views. Coordinates stay in memory.
export function initializeLocation(map, data, getTerrain) {
  const start = document.querySelector('#locate');
  const stop = document.querySelector('#stoplocation');
  const follow = document.querySelector('#followlocation');
  const message = document.querySelector('#locationstatus');
  let watch = null, latest = null, marker2, accuracy2, marker3, generation = 0;
  let firstFix = true;
  const raycaster = new THREE.Raycaster();
  proj4.defs('EPSG:32616', '+proj=utm +zone=16 +datum=WGS84 +units=m +no_defs');

  function active3D() {
    return document.querySelector('#mode3').getAttribute('aria-pressed') === 'true';
  }

  function terrainPoint() {
    const {mesh, terrainGrid} = getTerrain();
    if (!latest || !mesh) return null;
    const [east, north] = proj4('EPSG:4326', data.crs, [latest.coords.longitude, latest.coords.latitude]);
    const [west, south, right, top] = data.extent;
    if (east < west || east > right || north < south || north > top) return null;
    const x = east - (west + right) / 2;
    const z = (south + top) / 2 - north;
    mesh.updateMatrixWorld(true);
    raycaster.set(new THREE.Vector3(x, (terrainGrid.maximum - terrainGrid.minimum) * mesh.scale.y + 1000, z),
      new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObject(mesh, false)[0];
    return hit ? hit.point : null;
  }

  function update3D(center = false) {
    const {scene, camera, controls, mesh} = getTerrain();
    if (!scene || !mesh || !latest) return;
    const point = terrainPoint();
    if (!point) {
      if (marker3) marker3.visible = false;
      return;
    }
    if (!marker3) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.beginPath(); ctx.arc(32, 32, 23, 0, Math.PI * 2);
      ctx.fillStyle = '#1677ff'; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = 'white'; ctx.stroke();
      const texture = new THREE.CanvasTexture(canvas);
      marker3 = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, depthTest: false, depthWrite: false, sizeAttenuation: false
      }));
      marker3.scale.set(0.025, 0.025, 1);
      marker3.renderOrder = 1000;
      scene.add(marker3);
    }
    marker3.visible = true;
    marker3.position.copy(point); marker3.position.y += 3;
    if (center) {
      const delta = point.clone().sub(controls.target);
      camera.position.add(delta);
      controls.target.copy(point);
      controls.update();
    }
  }

  function renderMessage() {
    if (!latest) return;
    const c = latest.coords;
    const age = Math.max(0, Math.floor((Date.now() - latest.timestamp) / 1000));
    const prefix = watch === null ? 'Última ubicación · seguimiento detenido. ' :
      age > 30 ? 'Sin actualización reciente del GPS. ' : 'GPS activo. ';
    const {mesh} = getTerrain();
    const outside = active3D() && mesh && !terrainPoint() ?
      ' Fuera del terreno disponible: consultá tu posición en 2D.' : '';
    message.textContent = prefix + 'Precisión: ±' + Math.round(c.accuracy) + ' m · ' +
      c.latitude.toFixed(6) + ', ' + c.longitude.toFixed(6) + ' · hace ' + age + ' s.' + outside;
  }

  function centerCurrent() {
    if (!latest) return;
    if (active3D()) update3D(true);
    else map.setView([latest.coords.latitude, latest.coords.longitude], Math.max(map.getZoom(), 16));
    renderMessage();
  }

  function receive(position) {
    const c = position.coords;
    if (![c.latitude, c.longitude, c.accuracy].every(Number.isFinite) || c.accuracy < 0) return;
    latest = position;
    const latlng = [c.latitude, c.longitude];
    if (!marker2) {
      accuracy2 = L.circle(latlng, {radius: c.accuracy, color: '#1677ff', weight: 1,
        fillOpacity: 0.12, interactive: false}).addTo(map);
      marker2 = L.circleMarker(latlng, {radius: 8, color: 'white', weight: 3,
        fillColor: '#1677ff', fillOpacity: 1, pane: 'tooltipPane', interactive: false}).addTo(map);
    } else {
      marker2.setLatLng(latlng);
      accuracy2.setLatLng(latlng).setRadius(c.accuracy);
    }
    update3D(active3D() && (follow.checked || firstFix));
    if (!active3D() && (follow.checked || firstFix)) {
      if (firstFix) map.setView(latlng, Math.max(map.getZoom(), 16));
      else map.panTo(latlng, {animate: false});
    }
    firstFix = false;
    start.textContent = 'Centrar mi ubicación';
    renderMessage();
  }

  function halt() {
    generation++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    stop.disabled = true;
    start.textContent = 'Mi ubicación';
    renderMessage();
  }

  start.onclick = () => {
    if (watch !== null) { centerCurrent(); return; }
    if (!window.isSecureContext) {
      message.textContent = 'Abrí el visor mediante HTTPS para usar la ubicación.'; return;
    }
    if (!navigator.geolocation) {
      message.textContent = 'Este navegador no permite acceder a la ubicación.'; return;
    }
    firstFix = true;
    const token = ++generation;
    message.textContent = 'Buscando ubicación… Permití el acceso y activá la ubicación del teléfono.';
    stop.disabled = false;
    watch = navigator.geolocation.watchPosition(position => {
      if (token === generation) receive(position);
    }, error => {
      if (token !== generation) return;
      if (error.code === 1) {
        halt();
        message.textContent = 'Permiso de ubicación denegado. Habilitalo en los permisos del sitio y volvé a intentar.';
      } else {
        message.textContent = (error.code === 3 ? 'El GPS tardó en responder.' : 'Ubicación no disponible.') +
          ' Buscá un lugar despejado; el seguimiento seguirá intentando.' +
          (latest ? ' Se conserva la última posición recibida.' : '');
      }
    }, {enableHighAccuracy: true, maximumAge: 0, timeout: 20000});
  };
  stop.onclick = halt;
  follow.onchange = () => { if (follow.checked) centerCurrent(); };
  map.on('dragstart', () => { follow.checked = false; });
  function attachControls() {
    const {controls} = getTerrain();
    if (controls) controls.addEventListener('start', () => { follow.checked = false; });
  }
  const timer = setInterval(() => { if (latest) renderMessage(); }, 5000);
  window.addEventListener('pagehide', () => {
    halt(); clearInterval(timer);
  }, {once: true});
  return {
    refresh: () => { update3D(follow.checked && watch !== null); renderMessage(); },
    attachControls
  };
}
