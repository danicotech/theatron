import * as THREE from 'jz/vendor/three.module.js';
import {BURN_GLSL} from 'jz/js/burn-field.js';
import {ClothPhysics} from 'jz/js/cloth-physics.js';
const vertex = 'varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vDepth=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const fragment = `precision highp float;
varying vec2 vUv; varying float vDepth;
uniform sampler2D uCloth,uWeave,uFigures;
uniform float uTime,uBurn,uAspect,uFigAlpha;
uniform vec2 uStart;
${BURN_GLSL}
float fighter(vec2 screen,float side){
  float h=min(.68,uAspect*.90),w=h*.75;
  float gap=min(uAspect*.235,.28);
  // 固定雙劍對峙姿勢；僅保留布料物理與燃燒效果。
  vec2 p=screen-vec2(side*gap,-.025);
  vec2 local=p/vec2(w,h)+.5;
  vec2 atlas=vec2(local.x*.5+(side>0.?.5:0.),local.y);
  float inside=step(0.,atlas.x)*step(atlas.x,1.)*step(0.,atlas.y)*step(atlas.y,1.);
  // 交叉點上方劍尖跨過中線，交換歸屬，避免直接裁半造成斷劍與漂浮碎片。
  float leftHalf=1.-step(.512,atlas.x);
  float owner=mix(leftHalf,1.-leftHalf,step(.86,atlas.y));
  return texture2D(uFigures,atlas).a*inside*(side<0.?owner:1.-owner);
}
float shadows(vec2 screen){
  return max(fighter(screen,-1.),fighter(screen,1.));
}
void main(){
  vec2 uv=vUv;
  vec3 tex=texture2D(uCloth,uv).rgb;
  float lum=dot(texture2D(uWeave,uv).rgb,vec3(.299,.587,.114))*.78+dot(tex,vec3(.299,.587,.114))*.22;
  vec2 q=(uv-vec2(.5,.52))*vec2(1.25,1.);
  float light=exp(-dot(q,q)*2.4);
  // 旗面比視窗高 1.22 倍，投影按視窗比例計算，不拉伸人物。
  vec2 screen=(uv-.5)*vec2(uAspect,1.)*1.22;
  vec2 blur=vec2(.0035);
  float shadow=(shadows(screen)*.50
    +shadows(screen+vec2(blur.x,0.))*.125+shadows(screen-vec2(blur.x,0.))*.125
    +shadows(screen+vec2(0.,blur.y))*.125+shadows(screen-vec2(0.,blur.y))*.125)*uFigAlpha;
  light*=1.-shadow*.96;
  float weave=sin(uv.x*2300.)*sin(uv.y*1800.)*.014;
  vec3 col=mix(vec3(.065,.027,.013),vec3(.91,.45,.19),light)*(.32+lum*1.05)+weave;
  col*=1.-shadow*.50; col*=.93+vDepth*.045;
  float alpha=1.;
  if(uBurn>0.){
    float d=burnField(uv,uStart,uAspect)-uBurn*1.12;
    float flame=.006+.012*burnNoise(uv*vec2(68.,45.)+vec2(0.,-uTime*3.));
    if(d < -flame)discard;
    if(d<0.){alpha=smoothstep(-flame,0.,d);col=mix(vec3(1.,.10,.005),vec3(1.,.61,.16),alpha);}
    else{col=mix(col,vec3(.014,.007,.003),1.-smoothstep(.008,.027,d));col=mix(col,vec3(1.,.39,.055),1.-smoothstep(.001,.010,d));}
  }
  gl_FragColor=vec4(col,alpha);
}`;
export class Banner {
  constructor(scene,texture,weave){
    this.physics=new ClothPhysics(); this.disposed=false;
    this.uniforms={
      uCloth:{value:texture},uWeave:{value:weave},uFigures:{value:null},
      uTime:{value:0},uBurn:{value:0},uAspect:{value:1},uFigAlpha:{value:0},
      uStart:{value:new THREE.Vector2(.7,.5)}
    };
    // 等投影素材到位才顯示點燃提示；離頁後才完成載入也要回收。
    this.figuresReady=new THREE.TextureLoader().loadAsync(new URL('../../lunjian/art/curtain-figures.webp',import.meta.url).href)
      .then(figures=>{
        if(this.disposed){figures.dispose();return;}
        figures.colorSpace=THREE.SRGBColorSpace;
        figures.wrapS=figures.wrapT=THREE.ClampToEdgeWrapping;
        this.figures=figures;this.uniforms.uFigures.value=figures;this.uniforms.uFigAlpha.value=1;
      }).catch(error=>{this.figuresError=error;});
    this.geometry=new THREE.PlaneGeometry(14,10,this.physics.cols,this.physics.rows);
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:this.uniforms,transparent:true,side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;scene.add(this.mesh);
    this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();
  }
  async prepare(){await this.figuresReady;if(this.figuresError)throw this.figuresError;}
  hit(x,y,camera){this.ndc.set(x/innerWidth*2-1,1-y/innerHeight*2);this.ray.setFromCamera(this.ndc,camera);return this.ray.intersectObject(this.mesh)[0]?.uv??null;}
  pointer(x,y,camera){const uv=this.hit(x,y,camera);if(uv)this.physics.pointer(uv.x,uv.y);else this.physics.pointer(.5,.5,false);}
  start(uv){this.uniforms.uStart.value.copy(uv||new THREE.Vector2(.7,.5));this.physics.target.strength=0;}
  update(t,p,dt){
    if(this.disposed)return;
    this.physics.update(dt,t);this.geometry.attributes.position.array.set(this.physics.positions);this.geometry.attributes.position.needsUpdate=true;
    this.uniforms.uTime.value=t;
    this.uniforms.uBurn.value=Math.max(0,p);this.mesh.visible=p<.99;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.figures?.dispose();
  }
}
