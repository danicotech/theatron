import * as THREE from 'jz/vendor/three.module.js';
import { ravenEmblem } from 'jz/js/raven-emblem.js';

// Reusable modeled standards. Canvas is used only for textile/ink, never a pole
// or a complete object photograph. Dimensions are metres; origin is the foot.
export function createRavenStandardFactory() {
  let seed=7201;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const textures=[], materials=[], geometries=[], standards=[];
  function mat(o){const m=new THREE.MeshStandardMaterial(o);materials.push(m);return m;}
  function canvasTexture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;textures.push(t);return t;}
  function textile(light,split=false){
    const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');
    const pixels=ctx.createImageData(512,1024);
    for(let y=0;y<1024;y++)for(let x=0;x<512;x++){
      const n=rand(),fiber=(x%3===0?-9:0)+(y%4===0?6:0),stain=Math.sin(x*.023+y*.008)*Math.sin(y*.029)*12;
      const b=(light?182:45)+fiber+(n-.5)*(light?29:18)+stain;
      const k=(y*512+x)*4;pixels.data[k]=b;pixels.data[k+1]=b*(light?.93:1.10);pixels.data[k+2]=b*(light?.79:1.24);pixels.data[k+3]=255;
    }
    ctx.putImageData(pixels,0,0);ctx.fillStyle=light?'#15212c':'#c7cbc4';
    // Use the supplied emblem's alpha, including its enclosing feather ring.
    // Tint only the print; preserve the source aspect ratio and negative spaces.
    const stamp=document.createElement('canvas');stamp.width=512;stamp.height=768;
    const ink=stamp.getContext('2d');
    ink.translate(512,0);ink.scale(-1,1); // face right, as in the supplied flag crops
    ink.drawImage(ravenEmblem,0,0,512,768);ink.setTransform(1,0,0,1,0,0);
    ink.globalCompositeOperation='source-in';ink.fillStyle=light?'#15212c':'#c7cbc4';
    ink.fillRect(0,0,512,768);
    ctx.drawImage(stamp,43,205,426,639);
    ctx.fillStyle=light?'#ad9e83':'#38424a';ctx.globalAlpha=.3;
    for(let i=0;i<3300;i++)ctx.fillRect(rand()*512,rand()*1024,.5+rand()*2,1+rand()*5);
    // Worn print, pinholes, and a deeply torn hem. Alpha is real, no checkerboard.
    ctx.globalCompositeOperation='destination-out';
    for(let i=0;i<1900;i++){ctx.globalAlpha=.18+rand()*.45;ctx.fillRect(rand()*512,rand()*1000,.5+rand()*2,1+rand()*5);}
    ctx.globalAlpha=1;
    const hem=x=>849+65*Math.sin(x*.043)+50*Math.sin(x*.091+1.6)+24*Math.sin(x*.31);
    ctx.beginPath();ctx.moveTo(0,1024);for(let x=0;x<=512;x+=3)ctx.lineTo(x,hem(x));ctx.lineTo(512,1024);ctx.closePath();ctx.fill();
    for(let i=0;i<48;i++){
      const x=i<28?460+rand()*53:20+rand()*470,y=180+rand()*760;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+4+rand()*13,y+8);ctx.lineTo(x+rand()*8,y+28+rand()*33);ctx.lineTo(x-3,y+12);ctx.closePath();ctx.fill();
    }
    ctx.beginPath();ctx.moveTo(512,0);for(let y=0;y<=1024;y+=5)ctx.lineTo(512-8-12*Math.sin(y*.08)**2-(y>500?18*Math.sin(y*.025)**2:0),y);ctx.lineTo(512,1024);ctx.closePath();ctx.fill();
    if(split){
      const ink=ctx.getImageData(0,0,256,1024);
      for(let i=0;i<ink.data.length;i+=4){const value=238-ink.data[i];ink.data[i]=value*.87;ink.data[i+1]=value*.95;ink.data[i+2]=value;}
      ctx.putImageData(ink,0,0);
    }
    return canvasTexture(c);
  }
  const woodCanvas=document.createElement('canvas');woodCanvas.width=woodCanvas.height=256;const w=woodCanvas.getContext('2d');w.fillStyle='#504334';w.fillRect(0,0,256,256);
  for(let i=0;i<600;i++){w.strokeStyle=i%4?'#1c1b1888':'#bbb0a03a';w.lineWidth=.4+rand()*1.5;const x=rand()*256,y=rand()*256;w.beginPath();w.moveTo(x,y);w.bezierCurveTo(x+4,y+18,x-6,y+45,x+1,y+90);w.stroke();}
  const woodMap=canvasTexture(woodCanvas);
  const wood=mat({map:woodMap,bumpMap:woodMap,bumpScale:.1,roughness:.93,color:0xb1a99f});
  const iron=mat({color:0x434b52,roughness:.64,metalness:.72});
  const rope=mat({color:0xa29378,roughness:1});
  const snow=mat({color:0xd2e0e9,roughness:.96});
  const rock=mat({color:0x56626a,roughness:1});
  const dark=mat({color:0x171f28,roughness:1});
  const cloth=[false,true].map(light=>{const map=textile(light);return mat({map,bumpMap:map,bumpScale:.045,roughness:1,side:THREE.DoubleSide,alphaTest:.5});});
  const unitCylinder=new THREE.CylinderGeometry(1,1,1,12),unitBox=new THREE.BoxGeometry(1,1,1),unitRock=new THREE.IcosahedronGeometry(1,1),unitCone=new THREE.ConeGeometry(1,1,4);
  geometries.push(unitCylinder,unitBox,unitRock,unitCone);
  const up=new THREE.Vector3(0,1,0),V=(x,y,z)=>new THREE.Vector3(x,y,z);
  function create({light=false,size=1}={}){
    const group=new THREE.Group();group.name=light?'White raven standard / modeled':'Black raven standard / modeled';group.scale.setScalar(size);
    const side=light?1:-1,batches=new Map();
    function part(g,m,p,s,q=new THREE.Quaternion()){
      if(!batches.has(m))batches.set(m,[]);
      const copy=g.clone();copy.applyMatrix4(new THREE.Matrix4().compose(p,q,s));batches.get(m).push(copy);
    }
    function beam(a,b,r,m){const d=b.clone().sub(a);part(unitCylinder,m,a.clone().add(b).multiplyScalar(.5),V(r,d.length(),r),new THREE.Quaternion().setFromUnitVectors(up,d.normalize()));}
    function orb(x,y,z,sx,sy,sz,m){part(unitRock,m,V(x,y,z),V(sx,sy,sz));}
    function tube(points,r,m){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*3),r,5,false);part(g,m,V(0,0,0),V(1,1,1));g.dispose();}
    function coil(y,turns=3,r=.26){const points=[];for(let j=0;j<=turns*18;j++){const a=j/18*Math.PI*2;points.push(V(Math.cos(a)*r,y+j/(turns*18)*.39,Math.sin(a)*r));}tube(points,.053,rope);}
    beam(V(0,.15,0),V(0,10.85,0),.22,wood);
    beam(V(-side*.72,10.18,0),V(side*4,10.18,0),.18,wood);
    beam(V(-side*.69,10.38,0),V(side*3.95,10.38,0),.075,snow);
    part(unitCone,iron,V(0,11.22,0),V(.29,.78,.29));orb(0,10.84,0,.27,.13,.27,snow);
    for(const y of [.43,1.3,2.0,9.99,10.72]){
      beam(V(0,y,0),V(0,y+.16,0),.27,iron);
      for(let k=0;k<8;k++){const a=k*Math.PI/4;orb(Math.cos(a)*.275,y+.08,Math.sin(a)*.275,.045,.045,.045,iron);}
    }
    for(const y of [2.5,5.6,9.95])coil(y);
    tube([V(-.2,9.8,.23),V(.24,10.45,.23),V(-.23,10.5,-.19),V(.22,9.8,-.23),V(-.2,9.8,.23)],.085,rope);
    for(let k=0;k<4;k++){
      const a=k*Math.PI/2+.6;
      beam(V(Math.cos(a)*1.05,.12,Math.sin(a)*1.05),V(0,1.55,0),.16,wood);
      orb(Math.cos(a)*.69,.20,Math.sin(a)*.69,.63,.3,.5,rock);
      orb(Math.cos(a)*.70,.44,Math.sin(a)*.70,.62,.13,.48,snow);
    }
    // Iron lashing rings and diagonal stabilisers, visible from the back too.
    for(const s of [-1,1]){
      const ring=new THREE.TorusGeometry(.21,.045,6,16);part(ring,iron,V(s*.30,1.32,.05),V(1,1,1));ring.dispose();
    }
    for(let k=0;k<5;k++){
      const x=side*(.30+k*.78);
      part(unitBox,light?rope:dark,V(x,10.0,.02),V(.16,.5,.39));
      orb(x,10.23,0,.13,.07,.22,snow);
    }
    for(let i=0;i<7;i++){
      const x=side*(.28+rand()*3.55),h=.1+rand()*.3;
      part(unitCone,snow,V(x,10.09-h/2,.10),V(.035,h,.035),new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI));
    }
    const tail=new THREE.Group();tail.name='Rope tassel / wind lag';tail.position.set(-side*.57,10.12,.13);group.add(tail);
    const tasselGeo=new THREE.ConeGeometry(.085,.8,8),tassel=new THREE.Mesh(tasselGeo,dark);geometries.push(tasselGeo);tassel.position.y=-1.87;tail.add(tassel);
    const cordG=new THREE.CylinderGeometry(.035,.035,1.5,6);geometries.push(cordG);const cord=new THREE.Mesh(cordG,rope);cord.position.y=-.75;tail.add(cord);
    const fg=new THREE.PlaneGeometry(3.5,6.8,36,64);geometries.push(fg);const pos=fg.attributes.position;
    for(let i=0;i<pos.count;i++){
      // Float32 endpoints can exceed the nominal plane height by a few ulps.
      // Clamp before fractional powers so the pinned row stays finite.
      const u=THREE.MathUtils.clamp((pos.getX(i)+1.75)/3.5,0,1),fall=THREE.MathUtils.clamp((3.4-pos.getY(i))/6.8,0,1);
      pos.setXYZ(i,side*(.25+u*3.5+Math.pow(fall,1.4)*u*.9),9.83-fall*6.8,.10+.45*Math.sin(u*Math.PI)*Math.sin(fall*Math.PI*.8)+Math.sin(u*12-fall*5)*.18*u*fall);
    }
    // The black standard's geometry extends left: compensate its mirrored UVs
    // so both outward-facing prints have the same readable orientation.
    if(side<0){const uv=fg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
    fg.computeVertexNormals();const flag=new THREE.Mesh(fg,cloth[light?1:0]);flag.name=light?'Ivory cloth / dark supplied circular raven':'Black cloth / pale supplied circular raven';flag.castShadow=flag.receiveShadow=true;
    flag.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:cloth[light?1:0].map,alphaTest:.5,side:THREE.DoubleSide});materials.push(flag.customDepthMaterial);group.add(flag);
    const base=pos.array.slice();flag.userData.role='wind-cloth';
    // Merge static pieces by material: ropes, bands and timber do not each cost a draw call.
    for(const [m,pieces] of batches){
      const p=[],n=[],uv=[],indices=[];let offset=0;
      for(const g of pieces){p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);if(g.index)for(const j of g.index.array)indices.push(j+offset);else for(let j=0;j<g.attributes.position.count;j++)indices.push(j+offset);offset+=g.attributes.position.count;g.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);geometries.push(g);
      const mesh=new THREE.Mesh(g,m);mesh.name='Standard / merged '+(m===wood?'timber':m===iron?'iron':m===rope?'rope':m===snow?'snow':'base');mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    }
    const state={group,flag,tail,base,phase:light?1.1:0};standards.push(state);return group;
  }
  return {create,standards,createCurtainMaterial(){const map=textile(true,true);return mat({map,bumpMap:map,bumpScale:.035,roughness:1,side:THREE.DoubleSide,alphaTest:.5});},
    update(t){for(const {flag,tail,base,phase} of standards){const a=flag.geometry.attributes.position,uv=flag.geometry.attributes.uv;for(let i=0;i<a.count;i++){const j=i*3,u=uv.getX(i),fall=1-uv.getY(i),free=u*fall;const gust=Math.sin(t*.7+phase)*.22+Math.sin(t*1.7-u*5+fall*3+phase)*.30;a.setZ(i,base[j+2]+free*gust);a.setY(i,base[j+1]+free*.1*Math.sin(t*1.3-u*4+phase));}a.needsUpdate=true;flag.geometry.computeVertexNormals();tail.rotation.z=.065*Math.sin(t*1.3+phase-.18);}},
    dispose(){for(const s of standards)s.group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
  };
}
