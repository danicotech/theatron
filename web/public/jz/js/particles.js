import {createPetalGeometry,createFlowerGeometry} from 'jz/js/plum-geometry.js';
import * as THREE from 'jz/vendor/three.module.js';

/* ========================================================= 雪與梅瓣
   改寫自原本的固定箱子版本。原本雪和梅瓣長在世界座標一個 x±45 / z 固定的
   盒子裡，鏡頭沿路徑走開就沒有了，而且大多數粒子始終在鏡頭後面白算。

   現在兩者都在**鏡頭正在看的方向前方**重生（KAGE 的飄葉是同一個道理）：
   同樣的粒子數，畫面內的數量多好幾倍，而且鏡頭走到哪裡都有雪。

   梅瓣另外改成真的會翻滾的薄片：每一片有自己的下墜速度、兩個不同頻率的
   左右／前後擺盪、自轉與翻滾。兩個頻率是關鍵 —— 只用一個會像鐘擺，一眼
   就看出是程式在動。                                                  */

const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* 梅瓣貼圖：一片帶缺口的花瓣，邊緣透明。畫在 canvas 上，不外掛圖檔。 */
const FWD = new THREE.Vector3();
function aheadOfCamera(camera, ahead, out) {
  camera.getWorldDirection(FWD);
  FWD.y = 0;
  if (FWD.lengthSq() < 1e-6) FWD.set(0, 0, -1); else FWD.normalize();
  out.set(camera.position.x + FWD.x * ahead, 0, camera.position.z + FWD.z * ahead);
  return out;
}

export function particles(scene) {
  const rnd = mulberry32(73);
  const geometries = [], materials = [], textures = [];
  const CENTRE = new THREE.Vector3();

  /* ---------------------------------------------------------- 雪
     三層不同速度與大小，維持原本的層次感，但改成相對鏡頭的圓柱體積，
     並在 shader 裡用 mod 讓它自己往復，CPU 完全不介入。            */
  const snowLayers = [];
  for (const [count, speed, size, radius, height] of [
    [900, .55, 46, 42, 34],
    [1100, 1.15, 44, 26, 30],
    [320, 2.30, 62, 13, 22]
  ]) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * radius;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = rnd() * height;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geometries.push(g);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uSpeed: { value: speed },
        uSize: { value: size }, uHeight: { value: height },
        uCentre: { value: new THREE.Vector3() }
      },
      vertexShader:
        'attribute float aSeed;uniform float uTime,uSpeed,uSize,uHeight;uniform vec3 uCentre;' +
        'varying float vAlpha;void main(){vec3 p=position;' +
        /* 風：兩個頻率相加，雪才不會整片一起擺 */
        'float wind=sin(uTime*.7+p.z*.08)+sin(p.x*.3+uTime*.47)*.65;' +
        'p.y=mod(p.y-uTime*uSpeed+40.,uHeight);' +
        'p.x+=wind*(.5+aSeed)+sin(uTime*.4+aSeed*40.)*.6;' +
        'p+=uCentre;' +
        'vec4 mv=modelViewMatrix*vec4(p,1.);' +
        'gl_Position=projectionMatrix*mv;' +
        'gl_PointSize=clamp(uSize/max(1.,-mv.z),1.,7.);' +
        'vAlpha=.55*clamp(1.-length(mv.xyz)/120.,.08,1.);}',
      fragmentShader:
        'varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);' +
        'if(d>.5)discard;' +
        'gl_FragColor=vec4(vec3(.86,.91,.94),(1.-smoothstep(.08,.5,d))*vAlpha);}'
    });
    materials.push(m);
    const points = new THREE.Points(g, m);
    points.frustumCulled = false;
    scene.add(points);
    snowLayers.push({ points, m, ahead: radius * .45 });
  }

  /* ---------------------------------------------------------- 梅瓣
     原本只有 44 片、0.14×0.08 的小薄片，而且旋轉是 shader 裡的假 2D 轉。
     現在 240 片，真的三軸翻滾，用 InstancedMesh 一次畫完。            */
  const PETALS=0, BLOOMS=0, SPREAD=15, AHEAD=12, RANGE=34;
  const petalGeo=createPetalGeometry('red',10);petalGeo.scale(.25,.25,.25);
  const bloomGeo=createFlowerGeometry('white',true);bloomGeo.scale(.19,.19,.19);
  geometries.push(petalGeo,bloomGeo);
  const petalMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.8,metalness:0});materials.push(petalMat);
  const petals=new THREE.InstancedMesh(petalGeo,petalMat,PETALS-BLOOMS);
  const blooms=new THREE.InstancedMesh(bloomGeo,petalMat,BLOOMS);
  petals.name='Drifting red plum petals / curved 3D geometry';blooms.name='Drifting white plum blossoms / petals and stamens';
  petals.frustumCulled=blooms.frustumCulled=false;scene.add(petals,blooms);
  const list = [];
  for (let i = 0; i < PETALS; i++) list.push({
    x: (rnd() - .5) * 2 * RANGE, z: (rnd() - .5) * 2 * RANGE, y: rnd() * 26,
    fall: .26 + rnd() * .55,
    sway: .40 + rnd() * 1.4, swayPh: rnd() * TAU, swayAmp: .28 + rnd() * .9,
    spin: (rnd() - .5) * 2.4, roll: rnd() * TAU, rollSp: .45 + rnd() * 1.9,
    tilt: rnd() * TAU, s: .6 + rnd() * .8
  });

  /* 每幀重用，不在迴圈裡配置物件 */
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  let seeded = false;

  function updatePetals(t, dt, camera) {
    aheadOfCamera(camera, AHEAD, CENTRE);
    const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
    for (let i = 0; i < PETALS; i++) {
      const l = list[i];
      l.y -= l.fall * dt;
      l.roll += l.rollSp * dt;
      l.tilt += l.spin * dt;
      if (!seeded || l.y < cy - 12) {
        l.y = seeded ? cy + 18 : cy - 12 + Math.random() * 30;
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * SPREAD;
        l.x = CENTRE.x + Math.cos(a) * r;
        l.z = CENTRE.z + Math.sin(a) * r;
      }
      /* 遠處的環繞備援：鏡頭如果整個走離自己的花瓣，把它們拉回來。
         RANGE 落在霧的外面，所以不會看到東西跳位。 */
      if (l.x - cx > RANGE) l.x -= 2 * RANGE; else if (l.x - cx < -RANGE) l.x += 2 * RANGE;
      if (l.z - cz > RANGE) l.z -= 2 * RANGE; else if (l.z - cz < -RANGE) l.z += 2 * RANGE;

      /* 左右與前後用不同頻率（後者 ×0.7），才不會像鐘擺 */
      if(Math.hypot(l.x-cx,l.z-cz)<4){l.x+=FWD.x*6;l.z+=FWD.z*6;}
      const sw = Math.sin(t * l.sway + l.swayPh);
      P.set(l.x + sw * l.swayAmp, l.y,
            l.z + Math.cos(t * l.sway * .7 + l.swayPh) * l.swayAmp * .6);
      /* 翻滾角跟著擺盪走：花瓣從一邊洩掉空氣，再換另一邊 */
      E.set(l.roll, l.tilt, sw * .55);
      Q.setFromEuler(E);
      S.setScalar(l.s);
      M.compose(P, Q, S);
      if(i<BLOOMS)blooms.setMatrixAt(i,M);else petals.setMatrixAt(i-BLOOMS,M);
    }
    seeded = true;
    petals.instanceMatrix.needsUpdate = true;blooms.instanceMatrix.needsUpdate=true;
  }

  /* 回傳的函式簽名維持 (t) 可用，但有 camera 時才會跟著鏡頭走 */
  let last = 0;
  const update=function(t, camera, dt) {
    const step = dt != null ? dt : Math.min(.067, Math.max(0, t - last));
    last = t;
    for (const layer of snowLayers) {
      layer.m.uniforms.uTime.value = t;
      if (camera) {
        aheadOfCamera(camera, layer.ahead, CENTRE);
        layer.m.uniforms.uCentre.value.set(CENTRE.x, 0, CENTRE.z);
      }
    }
    if (camera) updatePetals(t, step, camera);
  };
  update.dispose=()=>{for(const layer of snowLayers)layer.points.removeFromParent();petals.removeFromParent();blooms.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
  return update;
}
