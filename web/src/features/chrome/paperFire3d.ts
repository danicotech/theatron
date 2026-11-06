import * as THREE from 'three';
import type { BurnParticles, BurnPigments, BurnPoint } from './paperBurn';
import { createBurnField } from './paperBurn';
import { createFireSheet, FIRE_STYLES } from './fireSheet';

const vertexShader = `
attribute float size;
attribute float opacity;
attribute float seed;
uniform float density;
varying float vOpacity;
varying float vSeed;
void main(){
  vOpacity=opacity; vSeed=seed;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  gl_PointSize=size*density*(1.0+position.z*0.002);
}`;
const fragmentShader = `
uniform float time;
uniform float kind;
uniform vec3 cold;
uniform vec3 hot;
varying float vOpacity;
varying float vSeed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.29+noise(p*4.07)*.14;}
void main(){
  vec2 p=gl_PointCoord*2.-1.;
  vec2 flow=vec2(p.x*2.3+vSeed,p.y*2.7+time*(kind<.5?.6:2.8));
  float n=fbm(flow);
  float radius=length(p);
  float alpha;
  vec3 color;
  if(kind<.5){
    // Billowing black soot: overlapping, turbulent soft volumes rather than discs.
    float edge=smoothstep(1.,.22,radius+(n-.5)*.3);
    alpha=edge*(.34+n*.66)*vOpacity;
    color=mix(cold,hot,n*.55);
  }else if(kind<1.5){
    float body=exp(-dot(p*vec2(1.5,.78),p*vec2(1.5,.78))*2.5);
    alpha=body*smoothstep(.12,.65,n)*vOpacity;
    color=mix(cold,hot,pow(body,.7)*(.55+n*.45));
  }else{
    alpha=smoothstep(1.,.1,radius)*vOpacity;
    color=hot;
  }
  if(alpha<.008)discard;
  gl_FragColor=vec4(color,alpha);
}`;

type Pool = {
  count: number;
  cursor: number;
  emission: number;
  kind: number;
  positions: Float32Array;
  velocity: Float32Array;
  life: Float32Array;
  age: Float32Array;
  size: Float32Array;
  baseSize: Float32Array;
  alpha: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
};

/** Three small particle pools. GSAP owns the only frame clock; no persistent RAF. */
export function createPaperFire(
  host: HTMLElement,
  width: number,
  height: number,
  colors: BurnPigments,
  field: ReturnType<typeof createBurnField>,
): BurnParticles | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'opening-fire opening-fire-particles';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
  } catch {
    return null;
  }
  const density = Math.min(devicePixelRatio || 1, 1.25, 1152 / width, 800 / height);
  renderer.setPixelRatio(density);
  renderer.setSize(width, height, false);
  renderer.setClearColor(colors.soot, 0);
  host.append(canvas);
  const scene = new THREE.Scene();
  // D supplies the continuous low flame; depth particles only add isolated hot spots.
  const sheet = createFireSheet(width, height, colors, FIRE_STYLES[3], field);
  scene.add(sheet.mesh);
  const camera = new THREE.OrthographicCamera(0, width, 0, height, 0.1, 1000);
  camera.position.z = 200;
  const compact = width < 600;
  const pools: Pool[] = [];
  const makePool = (count: number, kind: number) => {
    const positions = new Float32Array(count * 3),
      size = new Float32Array(count);
    const alpha = new Float32Array(count),
      seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random() * 100;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'size',
      new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'opacity',
      new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: kind === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        kind: { value: kind },
        density: { value: density },
        cold: {
          value: new THREE.Color(kind === 0 ? colors.soot : colors.flame).convertLinearToSRGB(),
        },
        hot: {
          value: new THREE.Color(kind === 0 ? colors.smoke : colors.core).convertLinearToSRGB(),
        },
      },
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = kind;
    scene.add(points);
    pools.push({
      count,
      kind,
      positions,
      size,
      alpha,
      geometry,
      material,
      cursor: 0,
      emission: 0,
      velocity: new Float32Array(count * 3),
      life: new Float32Array(count),
      age: new Float32Array(count).fill(99),
      baseSize: new Float32Array(count),
    });
  };
  makePool(compact ? 70 : 130, 0);
  makePool(compact ? 100 : 200, 1);
  makePool(compact ? 55 : 90, 2);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    pools.forEach((pool) => {
      pool.geometry.dispose();
      pool.material.dispose();
    });
    sheet.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
  canvas.addEventListener('webglcontextlost', dispose, { once: true });
  return {
    dispose,
    render(
      edge: BurnPoint[],
      time: number,
      dt: number,
      fade: number,
      emitting: boolean,
      progress: number,
    ) {
      if (disposed) return;
      sheet.update(progress, time, fade);
      for (const pool of pools) {
        const { kind, positions, velocity, age, life, alpha, size, baseSize } = pool;
        pool.emission += dt * (kind === 0 ? 105 : kind === 1 ? 330 : 90) * (compact ? 0.55 : 1);
        while (pool.emission >= 1 && emitting && edge.length) {
          pool.emission--;
          const i = pool.cursor++ % pool.count,
            j = i * 3;
          const point = edge[Math.floor(Math.random() * edge.length)]!;
          positions[j] = point.x + (Math.random() - 0.5) * 12;
          positions[j + 1] = point.y - Math.random() * 9;
          positions[j + 2] = (Math.random() - 0.5) * 45;
          velocity[j] = (Math.random() - 0.5) * (kind ? 38 : 24);
          velocity[j + 1] = -(kind === 0 ? 45 + Math.random() * 65 : 85 + Math.random() * 170);
          velocity[j + 2] = (Math.random() - 0.5) * 18;
          age[i] = 0;
          life[i] =
            kind === 0
              ? 1.15 + Math.random() * 0.6
              : kind === 1
                ? 0.16 + Math.random() * 0.23
                : 0.5 + Math.random() * 0.5;
          baseSize[i] =
            kind === 0
              ? 45 + Math.random() * 60
              : kind === 1
                ? 16 + Math.random() * 20
                : 1 + Math.random() * 2.5;
        }
        pool.emission = Math.min(pool.emission, 2);
        for (let i = 0; i < pool.count; i++) {
          age[i] = age[i]! + dt;
          if (age[i]! >= life[i]!) {
            alpha[i] = 0;
            size[i] = 0;
            continue;
          }
          const j = i * 3,
            t = age[i]! / life[i]!;
          const curl = Math.sin(time * 3.5 + positions[j + 1]! * 0.022 + i) * (kind ? 28 : 40);
          positions[j] = positions[j]! + (velocity[j]! + curl) * dt;
          positions[j + 1] = positions[j + 1]! + velocity[j + 1]! * dt;
          positions[j + 2] = positions[j + 2]! + velocity[j + 2]! * dt;
          velocity[j + 1] = velocity[j + 1]! - (kind ? 70 : 24) * dt;
          size[i] = baseSize[i]! * (kind === 0 ? 1 + t * 1.7 : 1 - t * 0.55);
          alpha[i] =
            (kind === 1 ? Math.pow(1 - t, 1.35) : Math.sin(Math.PI * t)) *
            fade *
            (kind === 0 ? 0.38 : kind === 1 ? 0.5 : 0.8);
        }
        for (const attribute of ['position', 'size', 'opacity'])
          pool.geometry.getAttribute(attribute).needsUpdate = true;
        pool.material.uniforms.time!.value = time;
      }
      renderer.render(scene, camera);
    },
  };
}
