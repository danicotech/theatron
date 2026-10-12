/** 保留原有場景與燃布引擎；開場只在資源準備好後接受點擊。 */
function want3D(){
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return false;
  const ask = new URLSearchParams(location.search).get('stage');
  if (ask === '2d') return false;
  if (ask === '3d') return true;
  try { return !!document.createElement('canvas').getContext('webgl2'); }
  catch { return false; }
}

export async function mountStage3D(runtime){
  const L = runtime || window.__LUNJIAN;
  if (!L || L.S.stageMounted || L.S.fallbackStarted) return null;
  L.S.stageMounted = true;
  window.__stage3d = true;
  const S = L.S, body = document.body, qs = new URLSearchParams(location.search);
  const signal = L.lifetime.signal;
  const on = (type, fn, options = {}) => window.addEventListener(type, fn, {...options, signal});
  let openingSeen=false;
  try{openingSeen=sessionStorage.getItem('lunjian:opening-seen:v1')==='1';}catch{}
  const shouldIntro = () => !openingSeen && S.shown === 0 && qs.get('intro') !== '0' && !body.classList.contains('reading');
  const weights = {module:8, renderer:5, 'texture-banner-cloth':5, 'texture-wood':5, 'texture-cloth':5, geometry:26, title:8, art:5, portrait:10, shaders:12, frame:11};
  const labels = {module:'展開江湖', renderer:'點亮月色', 'texture-banner-cloth':'織起殘旗', 'texture-wood':'雕琢木色', 'texture-cloth':'整理旗紋', geometry:'築起山門', title:'掛上匾額', art:'鋪陳近景', portrait:'迎候來者', shaders:'準備光影', frame:'江湖已開'};
  const done = new Set();
  const stage = name => {
    if (signal.aborted) return;
    done.add(name);
    L.introProgress(Math.min(100, [...done].reduce((sum, key) => sum + (weights[key] || 0), 0)), labels[name] || '準備入場');
  };
  if (!want3D()) { await L.prepareFallback(); return null; }
  body.dataset.stage = '3d';
  if (shouldIntro()) L.beginIntro();

  let scene, backdrop;
  const shared=!shouldIntro()&&window.__LUNJIAN_SCENE_TRANSFER?.take(L.canvas || document.getElementById('world'));
  try {
    if(shared){scene=shared;S.scene3d=scene;}else{
    const { createScene } = await import('jz/js/scene.js');
    if (signal.aborted) return null;
    stage('module');
    scene = await createScene(L.canvas || document.getElementById('world'), stage);
    if (signal.aborted) { scene.dispose(); return null; }
    S.scene3d = scene;
    await scene.banner.prepare();
    if (signal.aborted) { scene.dispose(); return null; }
    if (shouldIntro()) {
      // 真正放在布幕的 Three.js scene 裡，燃洞才會露出後面的雙俠。
      const THREE = await import('jz/vendor/three.module.js');
      if (signal.aborted) { scene.dispose(); return null; }
      const loader = new THREE.TextureLoader();
      const textures = [];
      // 同時備好橫直構圖，轉向時不用重新等待；失敗與離頁也回收先到的素材。
      const loadArt = async url => {
        const texture = await loader.loadAsync(url);
        if (signal.aborted) { texture.dispose(); return texture; }
        texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
        return texture;
      };
      L.cleanups.push(() => textures.forEach(texture => texture.dispose()));
      const results = await Promise.allSettled([
        loadArt(document.getElementById('boot-duel').src),
        loadArt(document.getElementById('boot-duel-portrait').srcset)
      ]);
      if (signal.aborted) { scene.dispose(); return null; }
      if (results.some(result => result.status === 'rejected')) {
        textures.forEach(texture => texture.dispose());
        throw new Error('序幕圖片載入失敗');
      }
      const [landscape, portrait] = results.map(result => result.value);
      const geometry = new THREE.PlaneGeometry(1, 1);
      const ink = getComputedStyle(document.getElementById('boot')).getPropertyValue('--ink').trim();
      const shadeMaterial = new THREE.MeshBasicMaterial({color:ink, transparent:true, depthWrite:false, toneMapped:false});
      const artMaterial = new THREE.MeshBasicMaterial({map:landscape, transparent:true, depthWrite:false, toneMapped:false});
      const shade = new THREE.Mesh(geometry, shadeMaterial), art = new THREE.Mesh(geometry, artMaterial);
      shade.position.z = -2; art.position.z = -1.9;
      shade.renderOrder = -20; art.renderOrder = -10;
      scene.banner.mesh.parent.add(shade, art);
      let disposed = false;
      const resize = () => {
        if (disposed) return;
        const height = 2 * Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * 22;
        const width = height * innerWidth / innerHeight;
        shade.scale.set(width * 1.05, height * 1.05, 1);
        const texture = innerWidth <= innerHeight ? portrait : landscape;
        artMaterial.map = texture;
        const imageAspect = texture.image.width / texture.image.height;
        const artWidth = Math.max(width, height * imageAspect);
        art.scale.set(artWidth, artWidth / imageAspect, 1);
      };
      backdrop = {
        fade(opacity){ shadeMaterial.opacity = artMaterial.opacity = opacity; },
        dispose(){ if (disposed) return; disposed = true; shade.removeFromParent(); art.removeFromParent(); geometry.dispose(); shadeMaterial.dispose(); artMaterial.dispose(); textures.forEach(texture => texture.dispose()); }
      };
      L.cleanups.push(() => backdrop.dispose());
      on('resize', resize); resize(); stage('portrait');
    }
    await scene.prepare();
    if (signal.aborted) { backdrop?.dispose(); scene.dispose(); return null; }
    }
  } catch (error) {
    if (signal.aborted) return null;
    console.warn('3D 場地起不來，退回 2D 開場：', error && error.message);
    backdrop?.dispose(); scene?.dispose(); S.scene3d = null;
    await L.prepareFallback();
    L.applyGrid(S.shown || 0, {animate:false});
    return null;
  }

  body.dataset.stage = '3d';
  L.applyGrid(S.shown || 0, {animate:false}); scene.seek(S.shot || 0);
  const BURN = 3.5, HOLD = .8, FADE = .9;
  // Reuse the frozen camera's entry offset at a fraction of the opening scale.
  // Its displacement is entry squared: these produce at most 0.6 world units.
  const HYBRID_ENTRY = {register:.16, duel:.20, rewards:.18};
  const chapters = [...document.querySelectorAll('.chapter')];
  const HYBRID_SETTLE = 4;
  let cameraShot = S.shot || 0, cameraChapter = S.shown || 0, entryRate = 1 / 2.6;
  const beginCameraEntry = opening => {
    cameraShot = S.shot || 0;
    cameraChapter = S.shown || 0;
    const path = window.__JZ3D?.path;
    if (!path) return;
    const hybridEntry = HYBRID_ENTRY[chapters[cameraChapter]?.id];
    const amount = body.classList.contains('reading') ? 0 : hybridEntry ?? (opening && cameraChapter === 0 && cameraShot === 0 ? 1 : 0);
    path.entry = amount;
    entryRate = hybridEntry ? amount / HYBRID_SETTLE : 1 / 2.6;
  };
  let mode = 'curtain', p = -1, burnAt = 0, t = 0;
  const enter = () => {
    if (mode === 'journey') return;
    mode = 'journey'; p = 1; backdrop?.dispose();
    // The initial curtain render calls path.opening(), including direct chapter entry.
    scene.seek(S.shot || 0);
    beginCameraEntry(true);
    L.enterStage();
  };
  const ignite = event => {
    if (mode !== 'curtain') return;
    mode = 'burning'; burnAt = performance.now(); p = 0;
    let uv;
    if (event.detail) uv = scene.banner.hit(event.clientX, event.clientY, scene.camera);
    // 全畫面有效，旗面以外與鍵盤啟動都由正中間開始。
    scene.banner.start(uv || {x:.5, y:.5});
    L.burningIntro();
  };
  S.enter3d = enter;
  S.render3d = (now, dtMs) => {
    if (signal.aborted) return;
    const dt = Math.min(dtMs, 50) / 1000;
    t += dt;
    if (mode === 'burning') {
      // 布料積分限制 dt；敘事用真實經過時間，背景分頁不會讓開場卡住。
      const elapsed = Math.max(0, (now - burnAt) / 1000);
      p = Math.min(.999, elapsed / BURN);
      if (elapsed >= BURN) document.getElementById('boot').dataset.state = 'reveal';
      backdrop?.fade(1 - Math.max(0, Math.min(1, (elapsed - BURN - HOLD) / FADE)));
      if (elapsed >= BURN + HOLD + FADE) enter();
    }
    const path = window.__JZ3D?.path;
    // Adjacent chapters may share the arena shot but still have distinct entrances.
    if (mode === 'journey' && (cameraShot !== S.shot || cameraChapter !== S.shown)) beginCameraEntry(false);
    if (body.classList.contains('reading')) { if (path) path.entry = 0; }
    else if (path?.entry > 0) path.entry = Math.max(0, path.entry - dt * entryRate);
    const pointerGain = HYBRID_ENTRY[chapters[cameraChapter]?.id] ? .35 : 1;
    scene.render(t, p, S.frac, dt, 0, (S.mx || 0) * pointerGain, (S.my || 0) * pointerGain, 1);
  };
  scene.render(0, shared ? 1 : -1, S.frac, 0, 0, 0, 0, 1); stage('frame');
  if (shouldIntro()) L.readyIntro(ignite); else enter();
  on('pagehide', () => { backdrop?.dispose(); scene.dispose(); }, {once:true});
  return scene;
}
