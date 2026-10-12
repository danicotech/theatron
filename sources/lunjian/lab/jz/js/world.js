import * as THREE from 'jz/vendor/three.module.js';

/* =============================================================== 背景世界
   取代原本疊在後面的四張平面照片（sky / mountains / pagodas / midground）。

   割裂感的來源是那四張照片有自己的光和透視，跟場景的月光、霧、陰影對不起來，
   鏡頭一動就露餡。這裡的東西全部長在同一個 scene 裡，吃同一盞平行光、
   同一層 FogExp2，所以遠近之間不會再有接縫。

   座標沿用 environment.js 的既有系統：
     擂台   x ±27，z -23..18，圓台中心 (0,.12,-2)
     舊門樓 z = -28
     鏡頭   (0, 7~8, 25~30) 看向 (0, 5.2, -15)
   所以神社放在 z = -44 之後，遠山再更遠。                                */

const TAU = Math.PI * 2;

/* 固定亂數，讓每次載入的山形與星點一致 */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ 月面貼圖
   畫在 canvas 上，不外掛圖檔：底色 + 幾塊暗海 + 邊緣暗化。            */
function moonTexture() {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#e9eef4'; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  const rnd = mulberry32(9137);
  g.globalAlpha = .13; g.fillStyle = '#7f8fa2';
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * s * .42;
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r;
    g.beginPath(); g.ellipse(x, y, 8 + rnd() * 34, 8 + rnd() * 26, rnd() * TAU, 0, TAU); g.fill();
  }
  g.globalAlpha = .5; g.fillStyle = '#c2ccd8';
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * s * .46;
    g.beginPath();
    g.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 1 + rnd() * 4, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
  const rim = g.createRadialGradient(s / 2, s / 2, s * .32, s / 2, s / 2, s * .5);
  rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(24,34,48,.55)');
  g.fillStyle = rim; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------ 稜線幾何
   一條山脈＝一片沿 X 展開的帶狀 mesh，上緣由多頻正弦疊出來。
   刻意不用 noise 函式庫，三個頻率就夠出形，而且可重現。               */
function ridgeGeometry(width, height, segs, seed, baseY) {
  const rnd = mulberry32(seed);
  const phase = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, x = (u - .5) * width;
    const k = u * TAU;
    const h = height * (
      .58 + .30 * Math.sin(k * 1.6 + phase[0])
          + .18 * Math.sin(k * 3.7 + phase[1])
          + .09 * Math.sin(k * 8.3 + phase[2]));
    pos.push(x, baseY, 0, x, baseY + Math.max(height * .18, h), 0);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ 飛簷屋頂
   參數化曲面。u 橫跨面寬、v 由屋脊往兩側屋簷，y 用 1-|v|^1.6 做出下凹的
   坡度，再加 |v|^4 讓簷口翹起來——就是「起翹」。簷口同時往外放寬，
   屋頂才會比屋身寬出一圈。                                            */
function flaredRoof(w, d, h, overhang, flare, segsU = 12, segsV = 10) {
  const pos = [], idx = [], uvs = [];
  for (let j = 0; j <= segsV; j++) {
    const v = (j / segsV) * 2 - 1, av = Math.abs(v);
    const y = h * (1 - Math.pow(av, 1.6)) + flare * Math.pow(av, 4);
    const halfW = w / 2 + overhang * av;
    const z = (d / 2 + overhang) * v;
    for (let i = 0; i <= segsU; i++) {
      const u = i / segsU;
      pos.push((u - .5) * 2 * halfW, y, z);
      uvs.push(u, j / segsV);
    }
  }
  const row = segsU + 1;
  for (let j = 0; j < segsV; j++) for (let i = 0; i < segsU; i++) {
    const a = j * row + i, b = a + 1, c = a + row, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function world(scene, textures) {
  const root = new THREE.Group();
  scene.add(root);
  const geometries = [], materials = [], textureList = [];
  const keep = (g) => { geometries.push(g); return g; };
  const keepM = (m) => { materials.push(m); return m; };

  /* 月亮的方向。平行光改成從月亮來，畫面上看得到的光源與實際照明才一致 ——
     這是消除割裂感的另一半：不只是幾何要在同一個世界，光也要。 */
  const MOON_DIR = new THREE.Vector3(0.62, 0.52, -0.59).normalize();
  const MOON_DIST = 250;

  /* ============================================================ 天空 */
  const skyMat = keepM(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color('#060d18') },
                uMid: { value: new THREE.Color('#16283d') },
                uHaze: { value: new THREE.Color('#3d5468') } },
    vertexShader:
      'varying float vH;void main(){vH=normalize(position).y;' +
      'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'uniform vec3 uTop,uMid,uHaze;varying float vH;void main(){' +
      'float h=clamp(vH,-1.,1.);' +
      'vec3 c=mix(uMid,uTop,smoothstep(.05,.75,h));' +
      'c=mix(uHaze,c,smoothstep(-.16,.20,h));' +   /* 地平線附近過渡到霧色 */
      'gl_FragColor=vec4(c,1.);}'
  }));
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(320, 32, 20)), skyMat);
  sky.frustumCulled = false;
  root.add(sky);

  /* 星點。低於地平線的丟掉，省一半。 */
  {
    const rnd = mulberry32(20260914), n = 900, p = new Float32Array(n * 3), a = new Float32Array(n);
    let k = 0;
    while (k < n) {
      const u = rnd() * 2 - 1, th = rnd() * TAU, s = Math.sqrt(1 - u * u);
      if (u < -0.02) continue;
      p[k * 3] = Math.cos(th) * s * 300;
      p[k * 3 + 1] = u * 300;
      p[k * 3 + 2] = Math.sin(th) * s * 300;
      a[k] = .25 + rnd() * .75;
      k++;
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aMag', new THREE.BufferAttribute(a, 1));
    const m = keepM(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader:
        'attribute float aMag;uniform float uTime;varying float vA;void main(){' +
        'vA=aMag*(.72+.28*sin(uTime*1.6+aMag*40.));' +
        'vec4 mv=modelViewMatrix*vec4(position,1.);' +
        'gl_Position=projectionMatrix*mv;gl_PointSize=1.0+aMag*1.9;}',
      fragmentShader:
        'varying float vA;void main(){float d=length(gl_PointCoord-.5);' +
        'if(d>.5)discard;gl_FragColor=vec4(vec3(.85,.90,.97),(1.-smoothstep(.1,.5,d))*vA*.8);}'
    }));
    const stars = new THREE.Points(g, m);
    stars.frustumCulled = false;
    root.add(stars);
    materials.push(m);
    root.userData.starMat = m;
  }

  /* 月亮本體 + 外圈光暈 */
  {
    const tex = moonTexture(); textureList.push(tex);
    const m = keepM(new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
    const disc = new THREE.Mesh(keep(new THREE.SphereGeometry(13, 32, 24)), m);
    disc.position.copy(MOON_DIR).multiplyScalar(MOON_DIST);
    disc.renderOrder = -1;
    root.add(disc);

    const halo = new THREE.Mesh(keep(new THREE.PlaneGeometry(96, 96)), keepM(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;' +
        'float a=pow(1.-clamp(d,0.,1.),3.2)*.42+pow(1.-clamp(d,0.,1.),12.)*.35;' +
        'gl_FragColor=vec4(vec3(.72,.82,.95),a);}'
    })));
    halo.position.copy(disc.position);
    halo.renderOrder = -2;
    root.add(halo);
    root.userData.halo = halo;
  }

  /* ============================================================ 遠山
     三層稜線，越遠越高越淡。全部吃 FogExp2，所以自然疊出空氣透視。   */
  for (const [z, w, h, seed, col] of [
    [-95, 420, 46, 11, '#43566b'],
    [-140, 620, 74, 27, '#3b4d61'],
    [-195, 860, 104, 43, '#35465a']
  ]) {
    const g = keep(ridgeGeometry(w, h, 150, seed, -6));
    const m = keepM(new THREE.MeshBasicMaterial({ color: col, fog: true }));
    const mesh = new THREE.Mesh(g, m);
    mesh.position.z = z;
    mesh.frustumCulled = false;
    root.add(mesh);
  }

  /* ============================================================ 神社
     重新設計過的配置：擂台就蓋在神社前的廣場上，中軸對齊，
     石階把兩者接起來 —— 原本照片是「貼在後面」，現在是「走得過去」。 */
  const wood = keepM(new THREE.MeshStandardMaterial({
    map: textures.wood, color: '#4d423a', roughness: .93
  }));
  const beam = keepM(new THREE.MeshStandardMaterial({
    map: textures.wood, color: '#6b4b3a', roughness: .86
  }));
  const stone = keepM(new THREE.MeshStandardMaterial({
    map: textures.wood, color: '#46545f', roughness: .5, metalness: .16
  }));
  const snowMat = keepM(new THREE.MeshStandardMaterial({ color: '#9fb0bb', roughness: .92 }));
  const tile = keepM(new THREE.MeshStandardMaterial({ color: '#2c3a47', roughness: .62, metalness: .22 }));
  const iron = keepM(new THREE.MeshStandardMaterial({ color: '#222b33', roughness: .82, metalness: .5 }));
  /* 障子紙：唯一的暖色，也是遠處唯一的光源感 */
  const shoji = keepM(new THREE.MeshStandardMaterial({
    color: '#caa477', roughness: 1,
    emissive: '#e8903a', emissiveIntensity: .85
  }));

  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const colGeo = keep(new THREE.CylinderGeometry(.5, .56, 1, 10));

  function box(x, y, z, w, h, d, m = wood, parent = root) {
    const o = new THREE.Mesh(boxGeo, m);
    o.position.set(x, y, z); o.scale.set(w, h, d);
    parent.add(o); return o;
  }
  function pillar(x, y, z, r, h, m = beam, parent = root) {
    const o = new THREE.Mesh(colGeo, m);
    o.position.set(x, y + h / 2, z); o.scale.set(r, h, r);
    parent.add(o); return o;
  }

  /* --- 參道：從擂台後緣往神社的石階與平台 --- */
  for (let i = 0; i < 9; i++) {
    box(0, -.1 + i * .52, -30 - i * 1.45, 24 - i * .5, .52, 1.5, stone);
    box(0, .17 + i * .52, -30 - i * 1.45, 24 - i * .5, .07, 1.5, snowMat);
  }
  box(0, 4.35, -47, 40, .9, 20, stone);          /* 神社台基 */
  box(0, 4.83, -47, 40.6, .12, 20.6, snowMat);

  /* --- 本殿 --- */
  const hall = new THREE.Group();
  hall.position.set(0, 4.8, -50);
  root.add(hall);
  {
    const W = 24, D = 13;
    box(0, .45, 0, W + 2, .9, D + 2, stone, hall);           /* 基座 */
    /* 柱列 */
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = sx * (3.4 + i * 3.4);
      pillar(x, .9, D / 2 - .8, .34, 6.4, beam, hall);
      pillar(x, .9, -D / 2 + .8, .34, 6.4, beam, hall);
    }
    /* 牆與障子 */
    box(0, 4.1, -D / 2 + .5, W - 1, 5.8, .3, wood, hall);
    for (let i = -3; i <= 3; i++) {
      const p = box(i * 3.2, 4.0, D / 2 - .55, 2.7, 4.4, .16, shoji, hall);
      p.userData.lit = true;
    }
    /* 斗拱：屋簷下的層疊小件 */
    for (const sz of [-1, 1]) for (let i = -4; i <= 4; i++) {
      const z = sz * (D / 2 - .3), x = i * 2.7;
      box(x, 7.35, z, 1.5, .34, 1.0, beam, hall);
      box(x, 7.75, z + sz * .45, 1.9, .34, 1.0, beam, hall);
      box(x, 8.15, z + sz * .95, 2.3, .30, 1.0, beam, hall);
    }
    box(0, 7.5, 0, W, .5, D, beam, hall);                    /* 簷桁 */

    /* 主屋頂 */
    const roofG = keep(flaredRoof(W + 3.4, D + 3.2, 5.4, 2.6, 1.5, 16, 12));
    const roof = new THREE.Mesh(roofG, tile);
    roof.position.y = 8.4; hall.add(roof);
    const cap = new THREE.Mesh(roofG, snowMat);
    cap.position.y = 8.62; cap.scale.set(.985, 1, .985); hall.add(cap);
    box(0, 13.95, 0, W + 1.6, .7, 1.3, tile, hall);           /* 正脊 */
    box(0, 14.4, 0, W + 1.0, .22, .8, snowMat, hall);
    for (const sx of [-1, 1]) {                               /* 脊端鴟尾 */
      const t = box(sx * (W / 2 + .7), 14.5, 0, .5, 1.4, .9, iron, hall);
      t.rotation.z = sx * .22;
    }
  }

  /* --- 左右翼廊 --- */
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 25, 4.8, -44);
    g.rotation.y = sx * .30;
    root.add(g);
    const W = 12, D = 9;
    box(0, .4, 0, W + 1.4, .8, D + 1.4, stone, g);
    for (const ax of [-1, 1]) for (const az of [-1, 1])
      pillar(ax * (W / 2 - 1.2), .8, az * (D / 2 - 1.2), .3, 4.6, beam, g);
    box(0, 3.0, -D / 2 + .4, W - .8, 4.2, .26, wood, g);
    for (let i = -1; i <= 1; i++) box(i * 3.4, 2.9, D / 2 - .45, 2.6, 3.4, .14, shoji, g);
    box(0, 5.5, 0, W, .4, D, beam, g);
    const rg = keep(flaredRoof(W + 2.4, D + 2.4, 3.4, 1.9, 1.0, 12, 10));
    const r = new THREE.Mesh(rg, tile); r.position.y = 6.1; g.add(r);
    const rc = new THREE.Mesh(rg, snowMat); rc.position.y = 6.28; rc.scale.set(.985, 1, .985); g.add(rc);
    box(0, 9.6, 0, W + 1.1, .5, 1.0, tile, g);
  }

  /* --- 石燈籠：把參道兩側標出來，也是近景與遠景之間的尺度參照 --- */
  const lanternLights = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = sx * (14 + i * .9), z = -30 - i * 3.4, y = i * .48;
    box(x, y + .35, z, 1.5, .7, 1.5, stone);
    pillar(x, y + .7, z, .34, 2.1, stone);
    box(x, y + 3.0, z, 1.7, .5, 1.7, stone);
    const glow = box(x, y + 3.05, z, 1.25, .42, 1.25, shoji);
    glow.userData.lit = true;
    box(x, y + 3.42, z, 2.2, .34, 2.2, tile);
    box(x, y + 3.63, z, 2.3, .12, 2.3, snowMat);
    lanternLights.push(glow);
  }

  /* --- 鳥居：立在參道起點，框住神社 --- */
  {
    const g = new THREE.Group();
    g.position.set(0, 0, -33);
    root.add(g);
    const vermilion = keepM(new THREE.MeshStandardMaterial({ color: '#7c2b23', roughness: .78 }));
    for (const sx of [-1, 1]) {
      const p = pillar(sx * 7.4, 0, 0, .62, 12.6, vermilion, g);
      p.rotation.z = -sx * .022;
      box(sx * 7.4, .45, 0, 2.1, .9, 2.1, stone, g);
    }
    box(0, 9.4, 0, 15.2, .7, 1.1, vermilion, g);              /* 貫 */
    const kasagi = box(0, 12.4, 0, 19.6, .78, 1.9, vermilion, g);  /* 笠木 */
    kasagi.rotation.z = 0;
    box(0, 13.0, 0, 20.2, .34, 2.3, snowMat, g);
    box(0, 11.4, 0, 17.2, .5, 1.5, vermilion, g);             /* 島木 */
  }

  /* 遠處的暖光：讓本殿的障子在霧裡有實際的光溢出，不是只有貼圖在亮 */
  const hallGlow = new THREE.PointLight('#e8903a', 260, 110, 2);
  hallGlow.position.set(0, 9, -44);
  scene.add(hallGlow);

  /* 讓月光真的從月亮的方向來 */
  const moonLight = new THREE.DirectionalLight('#cfe0f2', 1.5);
  moonLight.position.copy(MOON_DIR).multiplyScalar(120);
  scene.add(moonLight);

  return {
    root,
    moonDirection: MOON_DIR.clone(),
    update(t, camera) {
      if (root.userData.starMat) root.userData.starMat.uniforms.uTime.value = t;
      /* 天空與月亮跟著鏡頭平移，但不跟著旋轉 —— 才會像在無限遠 */
      sky.position.copy(camera.position);
      if (root.userData.halo) root.userData.halo.quaternion.copy(camera.quaternion);
      hallGlow.intensity = 260 + Math.sin(t * 1.7) * 18;
    },
    dispose() {
      root.removeFromParent();
      scene.remove(hallGlow); scene.remove(moonLight);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const tex of textureList) tex.dispose();
    }
  };
}
