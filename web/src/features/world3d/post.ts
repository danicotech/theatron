import {
  AdditiveBlending,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';

/**
 * 後製:自己寫的多級 bloom 加一支合成 shader。
 *
 * 沒有用 EffectComposer,因為要的東西只有三樣(亮部抽取、分離式高斯、一次合成),
 * 而 composer 會帶進一整套 pass 的抽象與額外的全螢幕拷貝。
 *
 * 順序上唯一不能動的一條:**先加 bloom,再 ACES**。反過來的話 tonemap 已經把
 * 高光壓進 0..1,bloom 加上去只剩一層灰霧,劍光就不會發光了。
 *
 * 《劍塚》這一版重調過,三個方向都是往下:
 *
 *  1. **閾值從 0.78 拉到 1.06。** 這是規格那條「只有劍身會發光」的落點。
 *     0.78 的時候月亮、餘燼、木頭上的高光全部過得去,整個畫面浮一層光暈;
 *     拉到 1 以上之後,唯一過得去的是 buildings.ts 裡那支 color 設到 2.9 的
 *     劍身材質 —— 也就是說,bloom 的閾值與劍的亮度是**一組的**,改一個要
 *     看另一個。
 *  2. **曝光從 0.9 降到 0.74。** 這個世界比上一個世界冷也暗:一座沒有人點燈
 *     的木屋,月亮是唯一的光源。
 *  3. **暗部往霧青壓得更重。** 上一版暗部偏青、亮部偏暖,因為有十二盞燈籠。
 *     這一版只剩一盞快熄的,所以亮部那一段的暖幾乎拿掉 —— 留一點點,
 *     那一點點就是餘燼。
 *
 * 顆粒與暗角刻意**不在**這裡做 —— features/chrome/Atmosphere.tsx 已經用 CSS
 * 在整頁上鋪了一層。做兩次的結果不是「更有氛圍」,是糊。
 */

const QUAD_VS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHT_FS = `
uniform sampler2D tSource;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSource, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + uKnee, l), 1.0);
}
`;

/* 五抽樣的分離式高斯。權重是把九抽樣的核用線性取樣折半得到的,
   所以看起來是五次,實際覆蓋九個像素。 */
const BLUR_FS = `
uniform sampler2D tSource;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSource, vUv).rgb * 0.2270270270;
  c += texture2D(tSource, vUv + uStep * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSource, vUv - uStep * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSource, vUv + uStep * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSource, vUv - uStep * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COPY_FS = `
uniform sampler2D tSource;
uniform float uAmount;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tSource, vUv).rgb * uAmount, 1.0);
}
`;

const COMP_FS = `
uniform sampler2D tSource;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uAberration;
uniform float uExposure;
uniform float uSaturation;
uniform float uFade;
varying vec2 vUv;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 d = vUv - 0.5;
  // 色差隨半徑增強:鏡頭的色差本來就是邊緣才明顯,中央等量施加只會讓字糊掉。
  float ca = uAberration * (0.28 + dot(d, d) * 2.6) * 0.0013;
  vec3 c;
  c.r = texture2D(tSource, vUv + d * ca).r;
  c.g = texture2D(tSource, vUv).g;
  c.b = texture2D(tSource, vUv - d * ca).b;

  c += texture2D(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  c = aces(c);

  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  // 暗部往霧青壓,亮部只留一點點暖 —— 那一點點是那盞快熄的燈籠,
  // 而全場就只有它是暖的。分色讓月光與餘燼在同一格畫面裡分得開。
  c = mix(c, c * vec3(0.68, 0.98, 1.16), smoothstep(0.62, 0.0, l) * 0.85);
  c = mix(c, c * vec3(1.05, 0.98, 0.93), smoothstep(0.62, 1.0, l) * 0.16);

  c *= uFade;
  gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);
}
`;

export interface PostOptions {
  /** 幾級遞減的 bloom。畫面越暗吃得越少,低階機器給 2 級就夠。 */
  levels: number;
  /** 場景 RT 的 MSAA。低階給 0。 */
  samples: number;
}

export interface PostChain {
  setSize(width: number, height: number): void;
  /** 把場景畫進鏈,最後一趟輸出到畫布。fade 是 0…1 的整體淡入。 */
  render(scene: Scene, camera: Camera, fade: number): void;
  dispose(): void;
}

interface Level {
  a: WebGLRenderTarget;
  b: WebGLRenderTarget;
  width: number;
  height: number;
}

export function createPost(renderer: WebGLRenderer, options: PostOptions): PostChain {
  const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new PlaneGeometry(2, 2);
  const quadScene = new Scene();

  const rtOptions = {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  } as const;

  const size = renderer.getDrawingBufferSize(new Vector2());
  const sceneRt = new WebGLRenderTarget(size.x, size.y, {
    ...rtOptions,
    depthBuffer: true,
    samples: options.samples,
  });

  const levels: Level[] = [];
  function buildLevels(width: number, height: number) {
    let w = Math.max(2, width >> 1);
    let h = Math.max(2, height >> 1);
    for (let i = 0; i < options.levels; i++) {
      levels.push({
        a: new WebGLRenderTarget(w, h, rtOptions),
        b: new WebGLRenderTarget(w, h, rtOptions),
        width: w,
        height: h,
      });
      w = Math.max(2, w >> 1);
      h = Math.max(2, h >> 1);
    }
  }
  buildLevels(size.x, size.y);

  const bright = new ShaderMaterial({
    uniforms: {
      tSource: { value: null },
      // 只有劍身過得去。見檔案開頭 —— 這個數字與 buildings.ts 的劍材質是一組的。
      uThreshold: { value: 1.06 },
      uKnee: { value: 0.34 },
    },
    vertexShader: QUAD_VS,
    fragmentShader: BRIGHT_FS,
  });
  const blur = new ShaderMaterial({
    uniforms: { tSource: { value: null }, uStep: { value: new Vector2(1, 0) } },
    vertexShader: QUAD_VS,
    fragmentShader: BLUR_FS,
  });
  const copy = new ShaderMaterial({
    uniforms: { tSource: { value: null }, uAmount: { value: 1 } },
    vertexShader: QUAD_VS,
    fragmentShader: COPY_FS,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const comp = new ShaderMaterial({
    uniforms: {
      tSource: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.55 },
      uAberration: { value: 0.8 },
      uExposure: { value: 1.02 },
      // 彩度略低於 1:全場唯一的飽和色是梅花的朱紅,把整體拉高會讓朽木也
      // 變成有顏色的,而朽木應該幾乎是灰的。
      uSaturation: { value: 0.94 },
      uFade: { value: 1 },
    },
    vertexShader: QUAD_VS,
    fragmentShader: COMP_FS,
  });

  // 全螢幕四邊形一開始就掛上其中一支材質。不給材質的話 Mesh 會自己生一支
  // 預設材質,而那一支沒有人拿得到,也就沒有人 dispose 得掉。
  const quad = new Mesh(quadGeo, bright);
  quad.frustumCulled = false;
  quadScene.add(quad);

  function pass(material: ShaderMaterial, target: WebGLRenderTarget | null, additive = false) {
    quad.material = material;
    renderer.setRenderTarget(target);
    if (!additive) renderer.clear(true, false, false);
    renderer.render(quadScene, quadCam);
  }

  return {
    setSize(width, height) {
      sceneRt.setSize(width, height);
      let w = Math.max(2, width >> 1);
      let h = Math.max(2, height >> 1);
      for (const level of levels) {
        level.a.setSize(w, h);
        level.b.setSize(w, h);
        level.width = w;
        level.height = h;
        w = Math.max(2, w >> 1);
        h = Math.max(2, h >> 1);
      }
    },

    render(scene, camera, fade) {
      renderer.setRenderTarget(sceneRt);
      renderer.clear();
      renderer.render(scene, camera);

      bright.uniforms.tSource!.value = sceneRt.texture;
      pass(bright, levels[0]!.a);

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i]!;
        if (i > 0) {
          copy.blending = NoBlending;
          copy.uniforms.uAmount!.value = 1;
          copy.uniforms.tSource!.value = levels[i - 1]!.a.texture;
          pass(copy, level.a);
        }
        blur.uniforms.tSource!.value = level.a.texture;
        (blur.uniforms.uStep!.value as Vector2).set(1 / level.width, 0);
        pass(blur, level.b);
        blur.uniforms.tSource!.value = level.b.texture;
        (blur.uniforms.uStep!.value as Vector2).set(0, 1 / level.height);
        pass(blur, level.a);
      }

      // 由小往大加回去。小的那一級是最糊的,它給的是大範圍的光暈。
      copy.blending = AdditiveBlending;
      copy.uniforms.uAmount!.value = 0.55;
      for (let i = levels.length - 1; i > 0; i--) {
        copy.uniforms.tSource!.value = levels[i]!.a.texture;
        pass(copy, levels[i - 1]!.a, true);
      }

      comp.uniforms.tSource!.value = sceneRt.texture;
      comp.uniforms.tBloom!.value = levels[0]!.a.texture;
      comp.uniforms.uFade!.value = fade;
      pass(comp, null);
    },

    dispose() {
      sceneRt.dispose();
      for (const level of levels) {
        level.a.dispose();
        level.b.dispose();
      }
      levels.length = 0;
      bright.dispose();
      blur.dispose();
      copy.dispose();
      comp.dispose();
      quadGeo.dispose();
      quadScene.clear();
      renderer.setRenderTarget(null);
    },
  };
}
