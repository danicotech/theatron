import {createFlameRig} from 'jz/js/flame-rig.js';
import * as THREE from 'jz/vendor/three.module.js';
import {createRavenStandardFactory} from 'jz/js/raven-standard.js';
import {createArenaKit} from 'jz/js/arena-kit.js';
import {createBackdropKit} from 'jz/js/backdrop-kit.js';

// Meter-scale reconstruction of arena-poster.webp. No photographic scenery planes.
// Z runs from the forecourt (+) through the gate (-). Y=0 is the courtyard.
export function environment(scene, textures) {
  const root = new THREE.Group(); root.name = 'Arena / architectural reconstruction'; scene.add(root);
  let seed = 1847;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  const placement=new THREE.Matrix4();
  function addModel(mesh){mesh.applyMatrix4(placement);if(placement.elements[14])mesh.name='Entrance / '+mesh.name;root.add(mesh);}
  const batches = new Map(), ownedTextures = [], geometries = new Set(), materials = new Set();
  const remember = g => (geometries.add(g), g);
  const material = options => {const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m;};
  const cube = remember(new THREE.BoxGeometry(1,1,1));
  const cylinder = remember(new THREE.CylinderGeometry(1,1,1,7));
  const sphere = remember(new THREE.SphereGeometry(1,8,5));
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  const up = new THREE.Vector3(0,1,0), direction = new THREE.Vector3(), midpoint = new THREE.Vector3(), tapers = new Map();
  function instance(g,m,p,s,q=null) {
    const key = g.uuid+m.uuid;
    if(!batches.has(key)) batches.set(key,{g,m,items:[]});
    matrix.compose(p,q || new THREE.Quaternion(),s).premultiply(placement);
    batches.get(key).items.push(matrix.clone());
  }
  function box(x,y,z,w,h,d,m,rz=0) {
    quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),rz);
    instance(cube,m,new THREE.Vector3(x,y,z),new THREE.Vector3(w,h,d),quaternion);
  }
  function beam(a,b,r,m,r2=r) {
    direction.subVectors(b,a); const length=direction.length();
    quaternion.setFromUnitVectors(up,direction.normalize());midpoint.addVectors(a,b).multiplyScalar(.5);
    if(r2===r) instance(cylinder,m,midpoint,scale.set(r,length,r),quaternion);
    else {const ratio=Math.round(r2/r*10)/10;if(!tapers.has(ratio))tapers.set(ratio,remember(new THREE.CylinderGeometry(ratio,1,1,8)));instance(tapers.get(ratio),m,midpoint,scale.set(r,length,r),quaternion);}
  }
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  function surface(kind) {
    const c=document.createElement('canvas');c.width=c.height=512;
    const ctx=c.getContext('2d'),data=ctx.createImageData(512,512);
    for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
      const n=random();let value;
      if(kind==='wood') value=78+18*Math.sin(x*.17+Math.sin(y*.025)*2)+9*Math.sin(x*.71+y*.008)+n*28;
      else value=kind==='snow'?184+n*45:69+n*44+12*Math.sin(x*.029)*Math.cos(y*.044);
      const i=(y*512+x)*4; data.data[i]=value;data.data[i+1]=value*(kind==='wood'?.80:1.02);data.data[i+2]=value*(kind==='wood'?.64:1.08);data.data[i+3]=255;
    }
    ctx.putImageData(data,0,0);
    if(kind==='wood') {
      for(let i=0;i<85;i++) {const x=random()*512,y=random()*512;ctx.strokeStyle=i%4?'#130f0b85':'#9a938238';ctx.lineWidth=.6+random()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-3,y+24,x+4,y+60,x+1,y+100+random()*180);ctx.stroke();}
      for(let i=0;i<25;i++){ctx.fillStyle='#121b162b';ctx.fillRect(random()*512,random()*512,4+random()*35,20+random()*160);}
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;ownedTextures.push(t);return t;
  }
  const woodMap=surface('wood'), stoneMap=surface('stone'), snowMap=surface('snow');
  const wood=material({map:woodMap,color:0xc4bcaf,roughness:.94,bumpMap:woodMap,bumpScale:.13});
  const carved=material({map:woodMap,color:0xa6a49c,roughness:.88,bumpMap:woodMap,bumpScale:.09});
  const darkWood=material({map:woodMap,color:0x474b4c,roughness:.95});
  const stone=material({map:stoneMap,color:0x707f8d,roughness:.79,bumpMap:stoneMap,bumpScale:.09});
  const snow=material({map:snowMap,color:0xd5e3ee,roughness:.96,bumpMap:snowMap,bumpScale:.06});
  const tile=material({color:0x253440,roughness:.67,metalness:.06,bumpMap:stoneMap,bumpScale:.025});
  const iron=material({color:0x353b3c,roughness:.78,metalness:.57});
  const bark=material({map:woodMap,color:0x58545a,roughness:1});
  const blossom=material({color:0xb8241c,roughness:1});
  const plumWhite=material({color:0xc7d8e5,roughness:.98});
  const bambooMat=material({map:woodMap,color:0x3e5148,roughness:.9});
  function orb(x,y,z,sx,sy,sz,m){instance(sphere,m,v(x,y,z),v(sx,sy,sz));}

  // Courtyard: irregular individual pavers, snow collected at joints and verges.
  box(0,-.6,-25,108,1,143,stone);
  for(let z=-45;z<36;z+=2.2)for(let x=-37;x<38;x+=2.6){
    const xx=x+(Math.round(z/2.2)%2)*1.3, yy=-.03+random()*.028;
    box(xx,yy,z,2.50,.16,2.08,stone,0);
    if(random()>.82)orb(xx,.045,z,.35+random()*.4,.025,.3+random()*.5,snow);
  }
  for(let i=0;i<310;i++){
    const x=(random()-.5)*87,z=random()*100-65;if(Math.hypot(x,(z+8)*.9)<23)continue;
    orb(x,.03+random()*.18,z,.5+random()*2,.12+random()*.35,.4+random()*1.5,snow);
  }
  const groundSnowGeometry=remember(new THREE.PlaneGeometry(100,135,100,110));groundSnowGeometry.rotateX(-Math.PI/2);
  const ga=groundSnowGeometry.attributes.position;
  // Keep the continuous snow skin above the tallest paver. Intersecting them
  // creates triangular holes unrelated to the wind-scoured coverage shader.
  for(let i=0;i<ga.count;i++){const x=ga.getX(i),z=ga.getZ(i);ga.setY(i,.15+.025*Math.sin(x*1.7+z*.5)+.012*Math.cos(z*2.8-x));}
  groundSnowGeometry.computeVertexNormals();
  const groundSnowMaterial=snow.clone();materials.add(groundSnowMaterial);
  groundSnowMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSnowP;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vSnowP=position;');
    shader.fragmentShader='varying vec3 vSnowP;float snowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float snowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(snowHash(i),snowHash(i+vec2(1,0)),f.x),mix(snowHash(i+vec2(0,1)),snowHash(i+vec2(1,1)),f.x),f.y);}\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n float n=snowNoise(vSnowP.xz*.55)*.65+snowNoise(vSnowP.xz*3.2)*.25+snowNoise(vSnowP.xz*13.)*.1;float arena=1.-smoothstep(16.,22.,length(vec2(vSnowP.x,(vSnowP.z-13.)*.92)));float rim=1.-smoothstep(.18,.5,abs(length(vec2(vSnowP.x,vSnowP.z-13.))-17.8));if(n<.17+arena*.18+rim*.4)discard;');
  };
  const snowCover=new THREE.Mesh(groundSnowGeometry,groundSnowMaterial);snowCover.position.z=-21;snowCover.receiveShadow=true;snowCover.name='Wind-scoured snow cover / procedural coverage';root.add(snowCover);

  // A low, snow-dusted boundary marks the open fighting ground, not a raised stage.
  const arenaMaterial=material({map:stoneMap,color:0x445462,roughness:.72,bumpMap:stoneMap,bumpScale:.08});
  for(const radius of [17.4,18.15]){
    const rg=remember(new THREE.RingGeometry(radius,radius+.18,128));rg.rotateX(-Math.PI/2);
    const ring=new THREE.Mesh(rg,arenaMaterial);ring.position.set(0,.125,-8);ring.name='Arena / inlaid boundary ring';ring.receiveShadow=true;root.add(ring);
  }

  // Masonry enclosure: real staggered blocks, wall thickness, buttresses, snow
  // coping and crenellations. The gap in the rear wall stays physically open.
  const rampartMats=[0xc0ccd5,0xa7bac6,0xcbd3d7].map(color=>material({map:stoneMap,color,roughness:.92,bumpMap:stoneMap,bumpScale:.17}));
  const wallBounds=[];
  function rampart(cx,cz,length,alongX=true){
    const height=8.4,depth=2.6;
    wallBounds.push({cx,cz,length,alongX,height,depth});
    box(cx,height/2,cz,alongX?length:depth,height,alongX?depth:length,stone);
    // Front and rear faces are individually staggered courses, including the ends.
    for(let row=0;row<12;row++)for(let k=0;k<Math.ceil(length/2.1);k++){
      const start=-length/2+k*2.1-(row%2)*1.05,end=Math.min(length/2,start+2.1);
      const lo=Math.max(-length/2,start),span=end-lo-.065;if(span<=0)continue;
      const t=(lo+end)/2;
      for(const side of [-1,1]){
        const x=cx+(alongX?t:side*(depth/2+.06)),z=cz+(alongX?side*(depth/2+.06):t);
        box(x,row*.7+.34,z,alongX?span:.19,.655,alongX?.19:span,rampartMats[(row+k)%3]);
      }
    }
    box(cx,height+.13,cz,alongX?length+.2:3.0,.27,alongX?3.0:length+.2,rampartMats[0]);
    box(cx,height+.30,cz,alongX?length+.2:3.05,.11,alongX?3.05:length+.2,snow);
    for(let k=0;k<length/2.5;k++){
      const t=-length/2+1+k*2.5,x=cx+(alongX?t:0),z=cz+(alongX?0:t);
      box(x,height+.79,z,alongX?1.32:2.7,.9,alongX?2.7:1.32,rampartMats[k%3]);
      box(x,height+1.27,z,alongX?1.43:2.83,.12,alongX?2.83:1.43,snow);
    }
    for(let k=0;k<length/9;k++){
      const t=-length/2+1+k*9;
      box(cx+(alongX?t:0),3.3,cz+(alongX?0:t),alongX?1.2:3.5,6.6,alongX?3.5:1.2,stone);
    }
  }
  rampart(-25.5,-45,35);rampart(25.5,-45,35);
  rampart(-42,-21,48,false);rampart(42,-15,60,false);

  // Two broken edging walls and snow-covered rocks frame the camera.
  for(const side of [-1,1])for(let i=0;i<18;i++){
    const x=side*(29+random()*5),z=24-i*2.4;
    box(x,.65,z,1.6,1.3,1.8,stone);box(x,1.33,z,1.7,.16,1.9,snow);
    if(i%3===0){orb(x+side*1.6,.7,z,1.8,1.6,1.4,stone);orb(x+side*1.6,1.94,z,1.8,.32,1.35,snow);}
  }

  function gateBase(gateZ,deckY,steps){
  // Gate set into the rear rampart: six shallow steps keep the arena open.

  box(0,deckY/2,gateZ-2,21,deckY,17,stone);box(0,deckY+.03,gateZ-2,21,.12,17,snow);
  for(let i=0;i<steps;i++){
    const y=(i+1)*.25,z=gateZ+6.55+(steps-1)*.69-i*.69;
    box(0,y/2,z,14.4,y,.72,stone);box(0,y+.035,z+.18,14.48,.055,.34,snow);
    for(const side of [-1,1])box(side*7.75,y/2,z,1.05,y,.74,stone);
  }
  // Solid sloping stone panels, with rectangular coping and snow on the upper edge.
  const railShape=new THREE.Shape();railShape.moveTo(0,0);railShape.lineTo(2.13,.76);railShape.lineTo(2.13,1.48);railShape.lineTo(0,.72);railShape.closePath();
  const railGeometry=remember(new THREE.ExtrudeGeometry(railShape,{depth:.34,bevelEnabled:false,steps:1}));
  railGeometry.rotateY(Math.PI/2);railGeometry.translate(-.17,0,0);
  function rail(a,b){
    instance(railGeometry,stone,a.clone().add(v(0,-.78,0)),v(1,1,1));
    direction.subVectors(b,a);const length=direction.length();quaternion.setFromUnitVectors(up,direction.normalize());midpoint.addVectors(a,b).multiplyScalar(.5);
    instance(cube,stone,midpoint,scale.set(.62,length,.25),quaternion);
    instance(cube,snow,midpoint.clone().add(v(0,.15,0)),scale.set(.65,length,.07),quaternion);
  }
  for(const side of [-1,1])for(let i=0;i<Math.ceil(steps/3);i++) {
    const z=gateZ+6.75+(steps-1)*.69-i*2.13,y=.25+i*.76,x=side*7.76;
    box(x,y+.66,z,.68,1.4,.68,stone);box(x,y+1.37,z,.86,.17,.86,stone);
    orb(x,y+1.60,z,.37,.25,.37,stone);orb(x,y+1.78,z,.37,.10,.37,snow);
    if(i<Math.ceil(steps/3)-1)rail(v(x,y+1.0,z),v(x,y+1.76,z-2.13));
  }

  }

  // A swept hip roof is a real indexed curved surface, with individual tile ribs.
  // Each tier has deep eaves, exposed rafters and a separate snow shell.
  function roof(cx,y,cz,w,d,rise,snowShell=true) {
    const hx=w/2,hz=d/2,ridge=Math.max(1,hx-hz*.84);
    function point(face,u,t,offset=0){
      const front=face<2,side=face===0||face===2?1:-1;
      const x=front?u*(ridge+(hx-ridge)*t):side*(ridge+(hx-ridge)*t);
      const z=front?side*hz*t:u*hz*t;
      const curl=.75*Math.pow(t,5)+.85*Math.pow(Math.abs(u),8)*Math.pow(t,3);
      return v(cx+x,y+rise*Math.pow(1-t,1.7)+curl+offset,cz+z);
    }
    for(let face=0;face<4;face++){
      const positions=[],uv=[],indices=[],N=face<2?32:16,M=12;
      for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
        const p=point(face,i/N*2-1,j/M);positions.push(p.x,p.y,p.z);uv.push(i/N*8,j/M*4);
      }
      for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;indices.push(a,a+1,a+N+1,a+1,a+N+2,a+N+1);}
      const g=remember(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
      const m=tile.clone();m.side=THREE.DoubleSide;materials.add(m);const shell=new THREE.Mesh(g,m);shell.name='Curved hip roof / tiles';shell.castShadow=true;shell.receiveShadow=true;addModel(shell);
      // Snow follows the same curve, avoiding a floating rectangular roof cap.
      const sg=remember(g.clone());const a=sg.attributes.position;
      for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)+.10+random()*.045);
      sg.computeVertexNormals();const sm=snow.clone();sm.side=THREE.DoubleSide;materials.add(sm);const cap=new THREE.Mesh(sg,sm);cap.name='Roof snow shell';cap.receiveShadow=true;if(snowShell)addModel(cap);
      const close=cz>-35&&w>9&&d<20,steps=close?4:2;
      const rows=face<2?Math.round(w/(close?.46:.8)):Math.round(d/(close?.55:1));
      for(let i=0;i<=rows;i++){
        const u=i/rows*2-1;
        for(let j=1;j<=steps;j++){
          const a=point(face,u,(j-1)/steps,.17),b=point(face,u,j/steps,.17);
          beam(a,b,.067,tile);if(i%3!==1)beam(a.clone().add(v(0,.045,0)),b.clone().add(v(0,.045,0)),.036,snow);
        }
        // Exposed underside rafters project through the eave.
        beam(point(face,u,.74,-.27),point(face,u,1.015,-.27),.085,wood);
        const end=point(face,u,1,-.10);orb(end.x,end.y,end.z,.092,.12,.092,carved);
        if(i%4===0){const p=point(face,u,1,.05);beam(p,p.clone().add(v(0,-.18-random()*.45,0)),.022,snow);}
      }
      for(let i=0;i<16;i++)beam(point(face,i/8-1,1,-.18),point(face,(i+1)/8-1,1,-.18),.14,carved);
    }
    beam(v(cx-ridge,y+rise+.18,cz),v(cx+ridge,y+rise+.18,cz),.18,carved);
    beam(v(cx-ridge,y+rise+.35,cz),v(cx+ridge,y+rise+.35,cz),.10,snow);
    for(const side of [-1,1]) {
      const x=cx+side*hx;
      beam(v(x,y+1.35,cz+hz),v(x+side*.15,y+2.12,cz+hz+.08),.12,carved);
      orb(x+side*.15,y+2.13,cz+hz+.08,.15,.25,.15,carved);
    }
  }
  function column(x,y,z,h,r=.35){
    beam(v(x,y,z),v(x,y+h,z),r,wood);
    box(x,y+.13,z,r*2.8,.26,r*2.8,stone);orb(x,y+.28,z,r*1.28,.12,r*1.28,snow);
    for(const yy of [.7,h*.66,h-.18])beam(v(x,y+yy,z),v(x,y+yy+.10,z),r*1.06,iron);
    // Interlocked dougong bracket arms below the roof.
    for(let j=0;j<3;j++) {
      box(x,y+h-.1+j*.18,z,1.4+j*.32,.13,.28,carved);
      box(x,y+h-.04+j*.18,z,.28,.13,1.4+j*.30,carved);
    }
  }
  function lattice(x,y,z,w,h){
    box(x,y,z,w+.18,h+.18,.16,wood);box(x,y,z+.1,w,h,.035,darkWood);
    for(let dx=-w/2;dx<=w/2;dx+=.32)box(x+dx,y,z+.15,.045,h,.045,carved);
    for(let dy=-h/2;dy<=h/2;dy+=.37)box(x,y+dy,z+.16,w,.042,.05,carved);
  }
  function gateStructure(gateZ,deckY){
  // Reference gate: four massive front posts, deep passage and a forward-facing
  // pointed gable crossing ONE broad hip roof. It is not a two-storey pagoda.
  const gateColumn=remember(new THREE.CylinderGeometry(1,1,1,20));
  function gatePost(x,z,r){
    instance(gateColumn,wood,v(x,deckY+3.25,z),v(r,6.5,r));
    box(x,deckY+.15,z,r*2.55,.30,r*2.55,stone);
    orb(x,deckY+.34,z,r*1.26,.17,r*1.26,snow);
    for(const yy of [.65,1.65,5.65,6.28])instance(gateColumn,iron,v(x,deckY+yy,z),v(r*1.045,.11,r*1.045));
    for(let j=0;j<4;j++){
      box(x,deckY+6.17+j*.18,z,1.25+j*.38,.16,.39,carved);
      box(x,deckY+6.23+j*.18,z,.39,.16,1.25+j*.37,carved);
    }
  }
  for(const side of [-1,1]){
    gatePost(side*3.8,gateZ+3.65,.64);gatePost(side*6.3,gateZ+2.85,.55);
    gatePost(side*3.8,gateZ-3,.51);gatePost(side*6.3,gateZ-3,.46);
    // Tall recessed plank panels and carved ventilation panels between columns.
    for(let j=0;j<6;j++)box(side*5.05-.86+j*.345,deckY+2.4,gateZ+2.69,.32,4.65,.24,wood);
    for(const dx of [-1.04,1.04])box(side*5.05+dx,deckY+2.55,gateZ+2.87,.15,5.05,.18,carved);
    for(const yy of [.2,3.65,4.12,5.35])box(side*5.05,deckY+yy,gateZ+2.9,2.17,.15,.21,carved);
    lattice(side*5.05,deckY+4.78,gateZ+2.97,1.85,.87);
    box(side*3.16,deckY+2.15,gateZ-2.2,1.1,4.3,.36,wood);
    for(let j=0;j<6;j++)orb(side*3.16,deckY+.55+j*.57,gateZ-1.99,.055,.055,.035,iron);
    box(side*6.3,deckY+6.05,gateZ,.52,.52,8,wood);
  }
  for(const z of [gateZ+3.4,gateZ+.35,gateZ-3])for(let j=0;j<4;j++)box(0,deckY+5.65+j*.38,z,14.1,.29,.48,j%2?wood:carved);
  box(0,deckY+5.2,gateZ+3.54,6.3,.65,.27,darkWood);
  // A second inset lintel makes the black opening read as a real passage.
  box(0,deckY+4.5,gateZ-2.12,6.4,.85,.38,wood);
  for(const side of [-1,1])box(side*2.55,deckY+3.8,gateZ-2.12,1.22,1.7,.38,darkWood);
  roof(0,deckY+6.6,gateZ,20.8,11.0,3.3,false);

  function gateGable(){
    const width=5.4,front=gateZ+5.64,back=gateZ-2.5,base=deckY+7.49,peak=deckY+10.55;
    const height=u=>peak-(peak-base)*Math.pow(u,.85)+.26*Math.pow(u,7);
    const point=(side,u,z,dy=0)=>v(side*width*u,height(u)+dy,z);
    // Solid vertical tympanum, with no photograph or fake painted opening.
    const shape=new THREE.Shape();shape.moveTo(-width,base-.20);shape.lineTo(width,base-.20);
    for(let i=32;i>=0;i--)shape.lineTo(width*i/32,height(i/32)-.16);
    for(let i=1;i<=32;i++)shape.lineTo(-width*i/32,height(i/32)-.16);
    shape.closePath();
    const g=remember(new THREE.ExtrudeGeometry(shape,{depth:.35,steps:1,bevelEnabled:false}));
    const face=new THREE.Mesh(g,darkWood);face.position.z=front-.40;face.name='Gate / solid pointed front gable';face.castShadow=face.receiveShadow=true;addModel(face);
    for(let x=-4.5;x<=4.5;x+=.34){const h=height(Math.abs(x)/width)-base-.4;if(h>0)box(x,base+h/2,front-.01,.21,h,.12,wood);}
    for(const side of [-1,1]){
      const positions=[],uv=[],indices=[],N=32,M=12;
      for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){const p=point(side,i/N,front+(back-front)*j/M);positions.push(p.x,p.y,p.z);uv.push(i/N*5,j/M*6);}
      for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;indices.push(a,a+1,a+N+1,a+1,a+N+2,a+N+1);}
      const geom=remember(new THREE.BufferGeometry());geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geom.setIndex(indices);geom.computeVertexNormals();
      const mat=tile.clone();mat.side=THREE.DoubleSide;materials.add(mat);const mesh=new THREE.Mesh(geom,mat);mesh.name='Gate / curved transverse gable roof';mesh.castShadow=mesh.receiveShadow=true;addModel(mesh);
      // Parallel rounded tile courses descend from the gable ridge; snow sits on
      // their crests, leaving the dark valleys and timber bargeboards exposed.
      for(let z=front;z>=back;z-=.37)for(let i=0;i<12;i++){
        beam(point(side,i/12,z,.07),point(side,(i+1)/12,z,.07),.08,tile);
        if(Math.round((front-z)/.37)%3!==1)beam(point(side,i/12,z,.145),point(side,(i+1)/12,z,.145),.044,snow);
      }
      for(let i=0;i<24;i++){
        beam(point(side,i/24,front+.1,-.10),point(side,(i+1)/24,front+.1,-.10),.17,carved);
        beam(point(side,i/24,front+.13,-.37),point(side,(i+1)/24,front+.13,-.37),.095,wood);
        beam(point(side,i/24,front+.1,.085),point(side,(i+1)/24,front+.1,.085),.09,snow);
      }
      // Small scrollwork cut from wood rather than a decal on the front panel.
      for(let k=0;k<5;k++){
        const x=side*(.56+k*.53),yy=height(Math.abs(x)/width)-.77;
        const curve=new THREE.CatmullRomCurve3([v(x-side*.25,yy-.15,front+.12),v(x,yy+.10,front+.12),v(x+side*.22,yy-.1,front+.12),v(x+side*.1,yy-.25,front+.12)]);
        const cg=remember(new THREE.TubeGeometry(curve,8,.05,5,false));const scroll=new THREE.Mesh(cg,carved);scroll.name='Gate / carved gable scroll';addModel(scroll);
      }
    }
    beam(v(0,peak+.10,front+.08),v(0,peak+.10,back),.18,carved);
    beam(v(0,peak+.27,front+.08),v(0,peak+.27,back),.08,snow);
    beam(v(0,peak+.10,front),v(0,peak+.57,front-.16),.18,carved,.08);
    orb(0,peak+.63,front-.16,.15,.20,.15,carved);
  }
  gateGable();

  }

  // Double-storey flanking halls and receding galleries.
  function hall(cx,cz,w=10,d=11,tiers=2,elevation=0) {
    box(cx,(elevation+.8)/2,cz,w+1.2,elevation+.8,d+1.4,stone);box(cx,elevation+.84,cz,w+1.3,.12,d+1.5,snow);
    for(let level=0;level<tiers;level++){
      const base=elevation+.9+level*5.4,h=4.6;
      box(cx,base,cz,w,.18,d,wood);
      // Rear and side walls give the model an interior and a silhouette from oblique views.
      box(cx,base+2.2,cz-d/2+.15,w,4.4,.3,darkWood);
      for(const side of [-1,1]){
        box(cx+side*w/2,base+2.2,cz,.25,4.4,d,wood);
        for(let k=0;k<4;k++)box(cx+side*w/2,base+2.2,cz-d/2+k*d/3,.37,4.4,.28,carved);
      }
      for(let i=0;i<4;i++){
        const x=cx-w/2+i*w/3;column(x,base,cz+d/2,h,.25);
        if(i<3)lattice(x+w/6,base+2.25,cz+d/2-.2,w/3-.55,2.2);
      }
      for(const z of [cz-d/2,cz+d/2])box(cx,base+h-.15,z,w+.5,.30,.4,carved);
      if(level){
        box(cx,base+.1,cz+d/2+1,w+1.4,.22,2.5,wood);
        for(let x=cx-w/2-.4;x<=cx+w/2+.5;x+=.65)box(x,base+.65,cz+d/2+2,.085,1.1,.085,wood);
        box(cx,base+1.18,cz+d/2+2,w+1,.14,.16,carved);box(cx,base+1.28,cz+d/2+2,w+1,.07,.20,snow);
      }
      roof(cx,base+h+.2,cz,w+3.7,d+3.2,2.5);
    }
  }
  const gateZ=-43,deckY=1.5;
  const assetKit=createArenaKit();assetKit.instanceStatic();root.add(assetKit.root);
  const backdropKit=createBackdropKit();root.add(backdropKit.root);

  // Restore the earlier forecourt as a separate lower terrace, then join its
  // landing directly to the current snow arena. The original gate dimensions
  // and 19 steps survive; placement alone changes the world coordinates.
  placement.makeTranslation(0,-4.75,80);
  gateBase(-25,4.75,19);gateStructure(-25,4.75);
  for(const side of [-1,1]){
    hall(side*24,-12,10,12,2);hall(side*23,-36,9,10,2);
    for(let z=-6;z>=-40;z-=4){column(side*17,.5,z,3.2,.16);box(side*20,3.7,z,6.6,.22,.3,carved);}
    roof(side*20,3.9,-24,7.4,38,1.6);
  }
  box(0,-.35,17,100,.55,65,stone);
  // Forecourt snow is an actual lower terrace, not an image underneath the steps.
  for(let x=-42;x<43;x+=2.6)for(let z=-2;z<48;z+=2.5){
    box(x,-.025,z,2.53,.08,2.43,stone);

  }
  const foreSnowG=remember(new THREE.PlaneGeometry(100,65,50,40));foreSnowG.rotateX(-Math.PI/2);
  const fs=foreSnowG.attributes.position;
  for(let i=0;i<fs.count;i++)fs.setY(i,.07+.012*Math.sin(fs.getX(i)*1.2+fs.getZ(i)));
  foreSnowG.computeVertexNormals();
  const foreSnowM=groundSnowMaterial.clone();materials.add(foreSnowM);
  foreSnowM.onBeforeCompile=shader=>{groundSnowMaterial.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('+rim*.4','');};
  foreSnowM.customProgramCacheKey=()=> 'forecourt-snow';
  const foreSnow=new THREE.Mesh(foreSnowG,foreSnowM);foreSnow.position.z=17;foreSnow.name='Continuous lower forecourt snow';foreSnow.receiveShadow=true;addModel(foreSnow);
  placement.identity();

  // Snow-laden plum branches are tapered round members, not a billboard tree.
  function tree(x,z,height=8){
    function branch(a,len,angle,azimuth,r,depth){
      const b=a.clone().add(v(Math.sin(angle)*Math.cos(azimuth)*len,Math.cos(angle)*len,Math.sin(angle)*Math.sin(azimuth)*len));
      beam(a,b,r,bark,r*.62);
      if(depth<3)beam(a.clone().lerp(b,.25).add(v(0,r*.7,0)),b.clone().add(v(0,r*.8,0)),r*.55,snow,r*.23);
      if(depth===0){
        for(let j=0;j<7;j++){
          const p=a.clone().lerp(b,.15+j*.14).add(v((random()-.5)*.35,random()*.2,(random()-.5)*.35));
          orb(p.x,p.y,p.z,.18,.10,.16,random()>.89?blossom:plumWhite);
          for(let k=0;k<4;k++)orb(p.x+Math.cos(k*1.57)*.12,p.y+.035,p.z+Math.sin(k*1.57)*.12,.095,.065,.08,plumWhite);
        }
        return;
      }
      branch(b,len*.69,angle+.36,azimuth+.62,r*.61,depth-1);
      branch(b,len*.59,angle+.58,azimuth-1.6,r*.57,depth-1);
      if(depth===2)branch(b,len*.51,angle+.85,azimuth+2.2,r*.44,depth-1);
    }
    branch(v(x,0,z),height*.43,.12,random()*6,.35,4);
    for(let i=0;i<5;i++)orb(x+(random()-.5)*3,.16,z+(random()-.5)*3,.8,.25,.7,snow);
  }
  for(const side of [-1,1])for(const [x,z,h] of [[29,12,9],[31,-8,10],[29,-29,8],[41,-22,11],[18,-53,7]])tree(side*x,z,h);

  placement.makeTranslation(0,-4.75,80);
  for(const side of [-1,1]){tree(side*15,4,9);tree(side*17,-11,10);}
  placement.identity();

  // Actual bamboo stems; the same continuous wind drives stems, flags and snow.
  const bamboo=new THREE.Group();bamboo.name='Bamboo grove / wind deformation';root.add(bamboo);
  const bambooGeometry=remember(new THREE.CylinderGeometry(.065,.10,1,6,5));
  const bambooMaterial=bambooMat.clone();materials.add(bambooMaterial);
  const wind={value:0};
  bambooMaterial.onBeforeCompile=s=>{s.uniforms.uWindTime=wind;s.vertexShader='uniform float uWindTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += pow(position.y+.5,2.)*(sin(uWindTime*.7+instanceMatrix[3].x*.17)*.08);');};
  const stems=new THREE.InstancedMesh(bambooGeometry,bambooMaterial,100);
  for(let i=0;i<100;i++){
    const h=6+random()*7,x=(i%2?1:-1)*(31+random()*10),z=random()*80-60;
    matrix.compose(v(x,h/2,z),new THREE.Quaternion(),v(1,h,1));stems.setMatrixAt(i,matrix);
    for(let k=1;k<h;k++)beam(v(x,k,z),v(x,k+.04,z),.105,bambooMat);
    for(let k=0;k<3;k++)beam(v(x,h*.7+k*.7,z),v(x+(random()-.5)*2,h*.75+k*.7,z+(random()-.5)*2),.025,bambooMat);
  }
  stems.name='100 wind-bent bamboo culms';bamboo.add(stems);

  // Reference black/ivory standards: side-mounted torn cloth and real fittings.
  const standards=createRavenStandardFactory();
  // Arena standards belong to the independently exportable kit; the original
  // two entrance standards remain attached to the retained lower forecourt.

  for(const side of [-1,1]){
    const flag=standards.create({light:side>0,size:1});flag.position.set(side*9.3,-4.75,74.8);root.add(flag);
  }

  // Lanterns have actual cages, paper inserts and small local light pools.
  const lampPaper=material({color:0xffdbac,emissive:0xe8903a,emissiveIntensity:1.4,roughness:.85});
  const lamps=[];
  for(const side of [-1,1]){const l=new THREE.PointLight(0xe8a05c,14,12,2);l.position.set(side*10.1,12.9,-35.9);root.add(l);lamps.push(l);}
  function lantern(x,y,z,lit=false){
    box(x,y,z,.26,.50,.26,lampPaper);
    for(const dx of [-.17,.17])for(const dz of [-.17,.17])box(x+dx,y,z+dz,.045,.67,.045,iron);
    box(x,y+.35,z,.5,.12,.5,iron);box(x,y-.35,z,.45,.1,.45,iron);
    beam(v(x,y+.4,z),v(x,y+.95,z),.022,iron);
    if(lit){const l=new THREE.PointLight(0xe8a05c,12,12,2);l.position.set(x,y,z+.3);root.add(l);lamps.push(l);}
  }
  for(const side of [-1,1]){
    lantern(side*3.05,deckY+4.1,gateZ+2.0,true);
    lantern(side*6.7,deckY+4.4,gateZ-2.6);
    lantern(side*37,10.5,-37.6,true);
    lantern(side*3.05,4.1,57,true);lantern(side*22,2.75,74.4,true);
  }
  const flameOrigins=[];
  for(const side of [-1,1])for(const [x,y,z] of [[side*10,4.9,-36],...[15,1,-15,-29].map(z=>[side*19,1.3,z])]){
    // Retain the old RNG consumption so terrain and other seeded scenery stay identical.
    for(let i=0;i<12;i++)random();
    flameOrigins.push([x,y-.12,z]);
    const l=new THREE.PointLight(0xffa35a,14,10,2);l.position.set(x,y+.6,z);root.add(l);lamps.push(l);
  }
  const flameRig=createFlameRig(root,flameOrigins,{time:wind});

  // Continuous mountain terrain with overlapping eroded ridges, not cone silhouettes.
  const mountainMaterial=material({color:0x8294a5,roughness:1,vertexColors:true});
  const mg=remember(new THREE.PlaneGeometry(300,125,150,72));mg.rotateX(-Math.PI/2);
  const mp=mg.attributes.position,peaks=[];
  for(let i=0;i<17;i++)peaks.push({x:(i-8)*19+(random()-.5)*10,z:(random()-.5)*65,h:18+random()*35,w:13+random()*17});
  const mc=[];
  for(let i=0;i<mp.count;i++){
    const x=mp.getX(i),z=mp.getZ(i);let h=0;
    for(const p of peaks){const dx=(x-p.x)/p.w,dz=(z-p.z)/(p.w*.8);h=Math.max(h,p.h*Math.exp(-(dx*dx+dz*dz)*.7));}
    const ridge=Math.sin(x*.16+Math.sin(z*.12)*2)*Math.cos(z*.19+x*.08);
    h=Math.max(0,h+ridge*5+Math.sin(x*.73+z*.38)*1.8+Math.sin(x*1.9-z*.9)*.55);
    mp.setY(i,h);const c=new THREE.Color(h>30&&ridge>0?0x718392:0x344b5b);mc.push(c.r,c.g,c.b);
  }
  mg.setAttribute('color',new THREE.Float32BufferAttribute(mc,3));mg.computeVertexNormals();
  const mountains=new THREE.Mesh(mg,mountainMaterial);mountains.position.set(0,-7,-128);mountains.name='Continuous eroded mountain range';root.add(mountains);

  // Sky is a closed sphere with procedural moving cloud density, not sky.webp.
  const skyGeometry=remember(new THREE.SphereGeometry(290,48,24));
  const noiseGLSL=`float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){float a=.5,v=0.;for(int i=0;i<5;i++){v+=a*noise3(p);p=p*2.03+vec3(13.1);a*=.5;}return v;}`;
  const moonPosition=v(60,54,-148),moonDirection=moonPosition.clone().normalize();
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:wind,uMoon:{value:moonDirection}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float uTime;uniform vec3 uMoon;varying vec3 vP;${noiseGLSL}void main(){vec3 p=normalize(vP);float horizon=pow(1.-max(0.,p.y),3.);vec3 col=mix(vec3(.018,.035,.064),vec3(.08,.125,.18),horizon);float light=pow(max(0.,dot(p,uMoon)),16.);vec3 q=p*6.5+vec3(uTime*.004,0.,uTime*.002);float cloud=smoothstep(.45,.71,fbm(q));float detail=fbm(q*3.);col=mix(col,vec3(.12,.18,.25)*( .4+light*1.8+detail*.6),cloud*.78);float star=step(.9986,hash(floor(p*650.)))*(1.-cloud)*smoothstep(.04,.3,p.y);col+=vec3(star*.28);col+=vec3(.06,.10,.15)*pow(max(0.,dot(p,uMoon)),22.);gl_FragColor=vec4(col,1.);}`});materials.add(skyMat);
  const sky=new THREE.Mesh(skyGeometry,skyMat);sky.name='Procedural cloud sky sphere';sky.renderOrder=-10;scene.add(sky);
  const moonGeo=remember(new THREE.SphereGeometry(11.5,64,40));
  const moonMat=new THREE.ShaderMaterial({uniforms:{},vertexShader:'varying vec3 vP;varying vec3 vN;void main(){vP=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vP;varying vec3 vN;${noiseGLSL}void main(){vec3 n=normalize(vP);float maria=fbm(n*5.2);float fine=fbm(n*29.);float crater=0.;for(int i=0;i<12;i++){float k=float(i);vec3 center=normalize(vec3(sin(k*12.3),cos(k*7.1),cos(k*4.7)));float d=length(n-center);float radius=.045+fract(sin(k*8.1)*32.)*.12;crater+=exp(-pow((d-radius)*90.,2.))*.12-exp(-pow(d/(radius*.85),4.))*.12;}float limb=.65+.35*max(0.,dot(normalize(vN),normalize(vec3(-.3,.4,1.))));vec3 c=mix(vec3(.28,.38,.49),vec3(.82,.90,.96),smoothstep(.28,.70,maria));c*=.8+fine*.3+crater;gl_FragColor=vec4(c*limb*1.4,1.);}`});materials.add(moonMat);
  const moon=new THREE.Mesh(moonGeo,moonMat);moon.position.copy(moonPosition);moon.name='Moon / cratered sphere';scene.add(moon);
  const moonlight=new THREE.DirectionalLight(0xc6dff6,3.5);moonlight.position.copy(moonPosition);moonlight.target.position.set(0,0,-20);moonlight.castShadow=true;moonlight.shadow.mapSize.set(1536,1536);Object.assign(moonlight.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:1,far:270});moonlight.shadow.bias=-.00045;moonlight.shadow.normalBias=.06;scene.add(moonlight,moonlight.target);
  const bounce=new THREE.HemisphereLight(0x9ebbd4,0x354354,1.85);scene.add(bounce);
  scene.fog=new THREE.FogExp2(0x182c40,.006);

  // Upload repeated timber/tile/snow elements once, keeping architecture draw calls bounded.
  for(const {g,m,items} of batches.values()) {
    const mesh=new THREE.InstancedMesh(g,m,items.length);items.forEach((a,i)=>mesh.setMatrixAt(i,a));
    mesh.name='Instanced '+(m===snow?'snow':m===wood?'timber':m===stone?'masonry':m===tile?'roof tiles':'architectural detail');
    mesh.castShadow=m!==snow&&items.length<1600;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
  }
  return {root,moon,sky,standards,assetKit,backdropKit,flames:flameRig,layout:{entrance:{gateZ:55,deckY:0,baseY:-4.75,steps:19,stairFrontZ:74},walls:wallBounds,arena:{center:[0,0,-8],radius:18.33},gate:{z:gateZ,deckY:3.6,steps:15},backdrop:backdropKit.placements},lights:[moonlight,bounce,...lamps],
    update(t){wind.value=t;for(let i=0;i<lamps.length;i++)lamps[i].intensity=(i<4?12:22)*(1+.04*Math.sin(t*7+i)+.025*Math.sin(t*11+i));
      standards.update(t);
      assetKit.update(t);
    },
    dispose(){flameRig.dispose();backdropKit.dispose();assetKit.dispose();standards.dispose();root.removeFromParent();sky.removeFromParent();moon.removeFromParent();for(const l of [moonlight,bounce,...lamps]){l.removeFromParent();l.shadow?.dispose();}moonlight.target.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of ownedTextures)t.dispose();}
  };
}
