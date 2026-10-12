import * as T from 'jz/vendor/three.module.js';
import {mergeGeometries,mergeVertices} from 'jz/vendor/BufferGeometryUtils.js';
import {createRavenStandardFactory} from 'jz/js/raven-standard.js';

// Image-guided, metre-scale modeling. This is not AI image-to-mesh inference.
// Every asset has volume, a floor-centred pivot and independently exportable geometry.
export const ASSET_IDS=['01-main-hall','02-stair-dais','03-arena-floor','04-black-standard','05-ivory-standard','06-timber-railing','07-spear-rack','08-iron-brazier','09-hanging-lantern','10-watchtower','11-side-gallery','12-snow-plum','13-snow-pine','14-crest-curtain'];
export function createArenaKit(){
  let seed=91427;
  const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const V=(x,y,z)=>new T.Vector3(x,y,z), textures=[], prototypes=new Map();
  function grain(wood){
    const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),d=x.createImageData(512,512);
    for(let j=0;j<512;j++)for(let i=0;i<512;i++){
      const a=(j*512+i)*4,n=wood?70+5*Math.sin(i*.65+Math.sin(j*.02))+rnd()*22:110+rnd()*45;
      d.data[a]=n;d.data[a+1]=n*(wood?.85:1);d.data[a+2]=n*(wood?.73:1.04);d.data[a+3]=255;
    }x.putImageData(d,0,0);
    x.strokeStyle=wood?'#171e1acc':'#26303c77';x.lineWidth=1;
    for(let i=0;i<70;i++){let a=rnd()*512,b=rnd()*512;x.beginPath();x.moveTo(a,b);x.lineTo(a+3,b+35);x.lineTo(a-2,b+90);x.stroke();}
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,2);textures.push(t);return t;
  }
  const wm=grain(true),sm=grain(false);
  const material=(name,color,roughness=.85,map=null,metalness=0)=>{const m=new T.MeshStandardMaterial({name,color,roughness,map,metalness});if(map){m.bumpMap=map;m.bumpScale=.035;}return m;};
  const mats={wood:material('Aged timber',0xb7a99a,.94,wm),dark:material('Recessed wood',0x55565b,.98,wm),stone:material('Weathered masonry',0x8c98a4,.82,sm),snow:material('Granular snow',0xd9e1e7,.97),tile:material('Charcoal ceramic',0x354452,.73,sm),iron:material('Oxidised iron',0x42454b,.65,null,.65),paper:material('Lantern paper',0xc5b69d,.95),needle:material('Pine needles',0x263c39,.98),red:material('Plum blossom',0xb8241c),white:material('Pale stone inlay',0xb8c4cf,.77,sm),black:material('Dark stone inlay',0x182632,.72,sm)};
  let g,batches;
  function begin(id){g=new T.Group();g.name=id;g.userData={assetId:id,method:'image-guided-parametric-modeling',units:'metres',reference:'images/'+id+'.png'};batches=new Map();}
  function add(geo,mat,p=V(0,0,0),s=V(1,1,1),q=new T.Quaternion()){
    if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}
    geo.applyMatrix4(new T.Matrix4().compose(p,q,s));
    if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo);
  }
  function box(x,y,z,w,h,d,m=mats.wood){add(new T.BoxGeometry(w,h,d),m,V(x,y,z));}
  function beam(a,b,r,m=mats.wood,r2=r){const d=b.clone().sub(a);add(new T.CylinderGeometry(r2,r,d.length(),r<.1?5:10),m,a.clone().add(b).multiplyScalar(.5),V(1,1,1),new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));}
  function ball(x,y,z,sx,sy,sz,m){add(new T.IcosahedronGeometry(1,1),m,V(x,y,z),V(sx,sy,sz));}
  function torus(x,y,z,r,t,m,rx=0){const geo=new T.TorusGeometry(r,t,5,32);geo.rotateX(rx);add(geo,m,V(x,y,z));}
  function finish(){for(const [m,parts]of batches){const raw=mergeGeometries(parts),geometry=mergeVertices(raw);raw.dispose();const mesh=new T.Mesh(geometry,m);mesh.name=g.name+' / '+m.name;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);for(const p of parts)p.dispose();}prototypes.set(g.name,g);return g;}
  function post(x,y,z,h,r=.25){beam(V(x,y,z),V(x,y+h,z),r,mats.wood,r*.9);for(const a of [.15,h-.35]){beam(V(x,y+a,z),V(x,y+a+.1,z),r*1.06,mats.iron);}box(x,y+.1,z,r*2.7,.2,r*2.7,mats.stone);}
  function bracket(x,y,z,span=1){for(let k=0;k<3;k++){box(x,y+k*.18,z,span-k*.2,.15,.18);box(x,y+k*.18+.075,z,.18,.15,span-k*.2);}for(const side of [-1,1])beam(V(x,y-.6,z),V(x+side*.48,y+.05,z),.06);}
  function roof(cx,y,cz,w,d,rise){
    // Four curved roof surfaces meet along a real ridge, with a lower underside.
    const ridge=w*.28;
    for(let side=0;side<4;side++){
      const pos=[],uv=[],indices=[],nu=16,nv=6;
      const point=(u,t)=>{
        let x,z;if(side<2){x=(u-.5)*T.MathUtils.lerp(ridge,w,t);z=(side?1:-1)*d*.5*t;}
        else{x=(side===2?-1:1)*T.MathUtils.lerp(ridge/2,w/2,t);z=(u-.5)*d*t;}
        const curl=.72*Math.pow(t,5)*(side<2?(.25+.75*Math.pow(Math.abs(u-.5)*2,4)):1);
        return V(cx+x,y+rise*Math.pow(1-t,1.65)+curl,cz+z);
      };
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=point(i/nu,j/nv);pos.push(p.x,p.y,p.z);uv.push(i/nu,j/nv);}
      for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;if(side===0||side===3)indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
      const tile=geo.clone();add(tile,mats.tile);const under=geo.clone();under.translate(0,-.12,0);add(under,mats.dark);geo.dispose();
      const sp=[],su=[],si=[],sn=48,sv=18;
      for(let j=0;j<=sv;j++)for(let i=0;i<=sn;i++){const p=point(i/sn,j/sv);sp.push(p.x,p.y+.08,p.z);su.push(i/sn,j/sv);}
      for(let j=2;j<sv;j++)for(let i=0;i<sn;i++){
        const u=i/sn,t=j/sv;if(Math.sin(u*19+t*8)+Math.sin(t*21-u*9)<-.2)continue;
        const a=j*(sn+1)+i,b=a+sn+1;if(side===0||side===3)si.push(a,a+1,b,b,a+1,b+1);else si.push(a,b,a+1,b,b+1,a+1);
      }
      const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));sg.setAttribute('uv',new T.Float32BufferAttribute(su,2));sg.setIndex(si);sg.computeVertexNormals();add(sg,mats.snow);
      // Tile ribs run down each pitch and define roof depth in silhouette.
      for(let i=0;i<=nu;i++){
        for(let j=1;j<=nv;j++){const a=point(i/nu,(j-1)/nv),b=point(i/nu,j/nv);a.y+=.04;b.y+=.04;beam(a,b,.048,mats.tile);if(j>3&&((i+j)%4!==0)){a.y+=.07;b.y+=.07;beam(a,b,.035,mats.snow);}}
        const p=point(i/nu,1);ball(p.x,p.y,p.z,.095,.07,.10,mats.tile);
      }
      for(let i=0;i<16;i++){const a=point(i/16,.3),b=point(i/16,1);a.y-=.22;b.y-=.22;beam(a,b,.065,mats.wood);}
    }
    beam(V(cx-ridge/2,y+rise+.12,cz),V(cx+ridge/2,y+rise+.12,cz),.14,mats.tile);
    beam(V(cx-ridge/2,y+rise+.23,cz),V(cx+ridge/2,y+rise+.23,cz),.07,mats.snow);
    for(const side of [-1,1]){const x=cx+side*w*.5;beam(V(x-side*.7,y+.5,cz+d*.5),V(x,y+1.35,cz+d*.5),.11,mats.tile);}
  }
  function hallBody(w=24,d=12,h=11){
    box(0,.12,0,w,.24,d);box(0,h*.48,-d/2,w,h,.32,mats.dark);
    for(const side of [-1,1]){box(side*w/2,h*.48,0,.25,h,d,mats.dark);for(let j=0;j<5;j++)post(side*w/2,0,-d/2+j*d/4,h,.22);}
    for(const x of [-w/2,-w*.32,-w*.21,w*.21,w*.32,w/2]){post(x,0,d/2,h,.38);bracket(x,h-.1,d/2,1.2);}
    for(const z of [-d/2,d/2]){box(0,h-.3,z,w+.7,.45,.48);box(0,h-.9,z,w,.13,.5,mats.dark);for(let x=-w/2+.5;x<w/2;x+=.8){bracket(x,h-.08,z,.7);}}
    for(let x=-w/2+.5;x<w/2;x+=.38){box(x,h*.5,-d/2+.19,.07,h-.5,.07);}
    roof(0,h+.5,0,w+4,d+3.5,2.8);
  }
  begin(ASSET_IDS[0]);hallBody();
  // Recessed upper roof body; the first roof remains visible around all sides.
  box(0,14.2,-.5,13.6,2.4,6.2,mats.dark);
  for(let x=-6.5;x<=6.5;x+=1.3){post(x,13,2.7,2.5,.16);bracket(x,15.5,2.7,.8);}
  roof(0,15.6,-.5,17,9,2.2);
  for(const side of [-1,1]){for(const z of [-4,4])post(side*14.5,0,z,7.4,.28);roof(side*14.2,7.7,0,7,11,1.7);}
  // Deep lintel panels and carved roundels, kept matte rather than emissive.
  for(const x of [-9.8,-6.3,0,6.3,9.8]){
    const w=x===0?9.2:2.2;box(x,10.15,6.08,w,.75,.24,mats.dark);
    for(const yy of [9.75,10.55])box(x,yy,6.25,w,.065,.08);
    for(let k=-1;k<=1;k++){const xx=x+k*w*.25;torus(xx,10.16,6.25,.20,.025,mats.wood);}
  }
  // A physical judges' table and raised dais within the hall, separately named
  // in the source; guardian sculptures still require an authored sculpt.
  box(0,.22,3,5.2,.44,3.5,mats.stone);
  box(0,1.5,3,3.2,.18,1.3);box(0,.99,3.5,2.8,.95,.14,mats.dark);
  for(const x of [-1.25,1.25])for(const z of [2.55,3.45])box(x,.95,z,.17,1.1,.17);
  torus(0,1,3.61,.30,.033,mats.wood);box(0,1.68,3.1,.48,.16,.35,mats.iron);
  finish();

  begin(ASSET_IDS[1]);box(0,1.8,0,33,3.6,16,mats.stone);
  for(let i=0;i<15;i++){const h=(15-i)*.24,z=8+i*.48+(i>=9?1.25:0);box(0,h/2,z,10.8,h,.52,mats.stone);box(0,h+.02,z,10.8,.045,.10,mats.snow);}
  box(0,.84,12.56,11.2,1.68,1.30,mats.stone);box(0,1.705,12.56,11.2,.05,1.3,mats.snow);
  for(let x=-16;x<17;x+=2)for(let z=-7;z<8;z+=2){box(x,3.62,z,1.94,.09,1.94,mats.stone);if(rnd()<.4)box(x+.2,3.68,z,1.5,.035,1.3,mats.snow);}
  for(const side of [-1,1]){
    for(let i=0;i<5;i++){let y=3.6-i*.84,z=7.8+i*1.7+(i>=3?1.25:0);box(side*5.9,y+.5,z,.65,1,.65,mats.stone);box(side*5.9,y+1.05,z,.85,.16,.85,mats.stone);box(side*5.9,y+1.15,z,.8,.07,.8,mats.snow);}
    beam(V(side*5.9,4.4,8),V(side*5.9,2.25,12.2),.16,mats.stone);
    beam(V(side*5.9,2.25,12.2),V(side*5.9,2.25,13.45),.16,mats.stone);
    beam(V(side*5.9,2.25,13.45),V(side*5.9,.9,16.3),.16,mats.stone);
    for(let i=0;i<6;i++){const x=side*(7+i*1.7);box(x,1.85,8.04,1.6,3.35,.12,mats.dark);box(x,1.85,8.13,1.38,3.12,.10,mats.stone);}
  }finish();

  begin(ASSET_IDS[2]);add(new T.CylinderGeometry(18,18,.16,128),mats.stone,V(0,.08,0));
  // Yin-yang is genuine tessellated inlay with two small circular stone inserts.
  const shape=new T.Shape();shape.absarc(0,0,10,-Math.PI/2,Math.PI/2,false);shape.absarc(0,5,5,Math.PI/2,-Math.PI/2,false);shape.absarc(0,-5,5,Math.PI/2,-Math.PI/2,true);
  const inlay=new T.ShapeGeometry(shape,48);inlay.rotateX(-Math.PI/2);const other=inlay.clone();other.rotateY(Math.PI);add(inlay,mats.white,V(0,.2,0));add(other,mats.black,V(0,.2,0));
  for(const [z,m] of [[-5,mats.black],[5,mats.white]]){const c=new T.CircleGeometry(1.12,32);c.rotateX(-Math.PI/2);add(c,m,V(0,.23,z));}
  for(const r of [10.2,13.4,13.65,15.4,17.5])torus(0,.17,0,r,.04,mats.white,Math.PI/2);
  for(let i=0;i<128;i++){const a=i*Math.PI/64;beam(V(Math.cos(a)*15.7,.175,Math.sin(a)*15.7),V(Math.cos(a)*17.3,.175,Math.sin(a)*17.3),.018,mats.black);}
  for(let i=0;i<100;i++){const a=rnd()*Math.PI*2,r=11+rnd()*6.7;ball(Math.cos(a)*r,.19,Math.sin(a)*r,.25+rnd()*.7,.018,.15+rnd()*.5,mats.snow);}finish();

  const flagFactory=createRavenStandardFactory();
  for(const [id,light]of [[ASSET_IDS[3],false],[ASSET_IDS[4],true]]){const f=flagFactory.create({light,size:1});f.name=id;f.userData={assetId:id,method:'image-guided-parametric-modeling',reference:'images/'+id+'.png'};prototypes.set(id,f);}
  begin(ASSET_IDS[5]);for(const x of [-1.5,1.5]){box(x,.62,0,.25,1.24,.25);box(x,1.29,0,.4,.18,.4);box(x,1.4,0,.38,.055,.38,mats.snow);for(const y of [.3,.7,1.12])ball(x,y,.16,.04,.04,.035,mats.iron);}
  for(const y of [.3,.7,1.12]){box(0,y,0,3,.16,.14);box(0,y+.09,0,3,.025,.13,mats.snow);}finish();
  begin(ASSET_IDS[6]);for(const x of [-1.3,1.3]){box(x,.9,0,.16,1.8,.16);box(x,.09,0,.2,.18,1.3);beam(V(x,.7,0),V(x,.12,.58),.05);}
  for(const y of [.35,1.4])box(0,y,0,2.9,.14,.15);
  for(let i=0;i<5;i++){let x=(i-2)*.52,h=3.9-i*.19;beam(V(x,.08,.12),V(x,h-.5,.12),.032);const s=new T.Shape();s.moveTo(0,0);s.lineTo(.12,.2);s.lineTo(0,.8);s.lineTo(-.12,.2);s.closePath();const e=new T.ExtrudeGeometry(s,{depth:.04,bevelEnabled:false});add(e,mats.iron,V(x,h-.65,.10));for(let k=0;k<4;k++)torus(x,h-.67-k*.04,.12,.044,.01,mats.iron,Math.PI/2);}finish();
  begin(ASSET_IDS[7]);
  const profile=[V(.12,0,0),V(.48,.12,0),V(.72,.44,0),V(.76,.52,0)].map(p=>new T.Vector2(p.x,p.y));
  add(new T.LatheGeometry(profile,32),mats.iron,V(0,.9,0));
  torus(0,1.42,0,.75,.055,mats.iron,Math.PI/2);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;beam(V(Math.cos(a)*.42,1,Math.sin(a)*.42),V(Math.cos(a)*.77,1.5,Math.sin(a)*.77),.033,mats.iron);}
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;beam(V(Math.cos(a)*.6,.05,Math.sin(a)*.6),V(Math.cos(a)*.35,1,Math.sin(a)*.35),.06,mats.iron);}
  for(let i=0;i<15;i++)ball((rnd()-.5)*.85,1.14,(rnd()-.5)*.85,.11,.07,.09,mats.black);finish();
  begin(ASSET_IDS[8]);box(0,.55,0,.36,.68,.36,mats.paper);
  for(const x of [-.23,.23])for(const z of [-.23,.23])box(x,.55,z,.055,.88,.055);
  box(0,.1,0,.55,.1,.55);box(0,1,0,.65,.14,.65,mats.dark);box(0,1.08,0,.6,.035,.6,mats.snow);torus(0,1.23,0,.1,.018,mats.iron);finish();
  begin(ASSET_IDS[9]);box(0,4,0,8,8,8,mats.stone);
  for(let y=.25;y<8;y+=.55)for(let x=-3.9;x<4;x+=.8){box(x,y,4.02,.76,.5,.12,mats.stone);box(4.02,y,x,.12,.5,.76,mats.stone);}
  for(const x of [-3,3])for(const z of [-3,3])post(x,8,z,4,.23);
  box(0,8.05,0,9,.2,9);box(0,10,-3.3,6.5,3.8,.16,mats.dark);
  for(const side of [-1,1])for(let j=-4;j<=4;j++){box(j,8.7,side*4.2,.075,1.2,.075);box(side*4.2,8.7,j,.075,1.2,.075);}
  for(const z of [-4.2,4.2])box(0,9.3,z,8.6,.13,.15);
  roof(0,12,0,10.5,10.5,2.5);finish();
  begin(ASSET_IDS[10]);box(0,.18,0,5,.36,6);
  for(const x of [-2,2])for(const z of [-2.5,2.5]){post(x,.36,z,3.5,.2);bracket(x,3.8,z,.8);}
  roof(0,4.1,0,6.7,7,1.4);finish();
  function tree(pine){
    function branch(a,len,angle,az,r,depth){const b=a.clone().add(V(Math.sin(angle)*Math.cos(az)*len,Math.cos(angle)*len,Math.sin(angle)*Math.sin(az)*len));beam(a,b,r,mats.wood,r*.64);
      if(depth>1){const sa=a.clone().lerp(b,.25),sb=b.clone();sa.y+=r*.75;sb.y+=r*.7;beam(sa,sb,r*.45,mats.snow,r*.25);}
      if(depth===0){if(pine){for(let j=0;j<4;j++){const p=b.clone().add(V((rnd()-.5)*.9,0,(rnd()-.5)*.9));for(let k=0;k<8;k++){const az=k*Math.PI/4;beam(p,p.clone().add(V(Math.cos(az)*.42,.05,Math.sin(az)*.42)),.018,mats.needle);}if(rnd()<.55)ball(p.x,p.y+.06,p.z,.3,.035,.24,mats.snow);}}
        else if(rnd()<.45){for(let k=0;k<5;k++)ball(b.x+Math.cos(k*1.257)*.07,b.y,b.z+Math.sin(k*1.257)*.07,.06,.035,.05,rnd()<.035?mats.red:mats.snow);}return;}
      branch(b,len*.71,angle+.38,az+.7,r*.6,depth-1);branch(b,len*.59,angle+.8,az-1.9,r*.5,depth-1);
    }branch(V(0,0,0),3.3,.15,.8,.3,5);
  }
  begin(ASSET_IDS[11]);tree(false);finish();begin(ASSET_IDS[12]);tree(true);finish();
  begin(ASSET_IDS[13]);
  function hangingCloth(x,w,h,mat,name){const geo=new T.PlaneGeometry(w,h,48,48),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const fall=T.MathUtils.clamp((h/2-p.getY(i))/h,0,1);p.setZ(i,Math.sin(p.getX(i)*3.2)*.08+Math.sin(p.getX(i)*1.7)*.22*fall);p.setY(i,p.getY(i)-Math.pow(fall,12)*(.10+.15*Math.sin(p.getX(i)*13)));}geo.computeVertexNormals();
    const cloth=new T.Mesh(geo,mat);cloth.position.set(x,h/2,0);cloth.name=name;cloth.userData.role='wind-cloth';g.add(cloth);
    beam(V(x-w/2,h+.1,0),V(x+w/2,h+.1,0),.05,mats.wood);
    for(let i=0;i<6;i++)torus(x-w/2+i*w/5,h+.025,0,.08,.014,mats.iron);
  }
  hangingCloth(0,8.8,10,flagFactory.createCurtainMaterial(),'Central black-white raven curtain');
  for(const side of [-1,1])hangingCloth(side*6.4,2,10,flagFactory.standards[side<0?0:1].flag.material,'Side raven curtain');
  finish();

  const root=new T.Group();root.name='Tournament asset assembly';
  function place(id,x,y,z,scale=1,ry=0){const a=prototypes.get(id).clone(true);a.position.set(x,y,z);a.scale.setScalar(scale);a.rotation.y=ry;root.add(a);return a;}
  place(ASSET_IDS[0],0,3.6,-43);place(ASSET_IDS[1],0,0,-43);place(ASSET_IDS[2],0,.12,-8);
  place(ASSET_IDS[13],0,3.9,-37.2,1);
  for(const side of [-1,1]){
    place(ASSET_IDS[9],side*37,0,-51);
    for(let i=0;i<3;i++)place(ASSET_IDS[10],side*28,1.3,-8-i*9,1,Math.PI/2);
    for(let i=0;i<9;i++)place(ASSET_IDS[5],side*21.5,0,15-i*4,1,Math.PI/2);
    for(let i=0;i<4;i++)place(ASSET_IDS[5],side*(9+i*3),3.6,-35);
    for(let i=0;i<4;i++)place(ASSET_IDS[side<0?3:4],side*(23+i*.5),0,12-i*12,.78-i*.04);
    place(ASSET_IDS[6],side*16,0,16,1,side*.12);
    for(const z of [15,1,-15,-29])place(ASSET_IDS[7],side*19,0,z);
    place(ASSET_IDS[7],side*10,3.6,-36);
    for(let i=0;i<2;i++)place(ASSET_IDS[8],side*(10.1+i*4.3),11.9-i*2.6,-36.6,1.7-i*.35);
    for(let i=0;i<3;i++)place(ASSET_IDS[11],side*(27+i*3),0,4-i*17,1.05,side*i*.4);
    for(let i=0;i<2;i++)place(ASSET_IDS[12],side*(35+i*3),0,-7-i*21,1.5);
  }
  const moving=[];
  root.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position&&o.userData.role==='wind-cloth'){o.geometry=o.geometry.clone();o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;moving.push({mesh:o,base:o.geometry.attributes.position.array.slice(),top:b.max.y,height:b.max.y-b.min.y});}});
  function instanceStatic(){
    root.updateMatrixWorld(true);const groups=new Map();
    root.traverse(o=>{if(!o.isMesh||o.userData.role==='wind-cloth')return;const k=o.geometry.uuid+o.material.uuid;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);});
    for(const list of groups.values()){if(list.length<2)continue;const first=list[0],batch=new T.InstancedMesh(first.geometry,first.material,list.length);batch.name='Kit instances / '+first.name;batch.castShadow=batch.receiveShadow=true;list.forEach((o,i)=>{batch.setMatrixAt(i,o.matrixWorld);o.removeFromParent();});batch.computeBoundingSphere();root.add(batch);}
  }
  return {root,prototypes,place,mats,instanceStatic,update(t){for(const {mesh,base,top,height}of moving){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=base[i*3+1],fall=T.MathUtils.clamp((top-y)/height,0,1);p.setZ(i,base[i*3+2]+fall*.17*Math.sin(t*.8+base[i*3]*1.6));}p.needsUpdate=true;}},dispose(){const gs=new Set(),ms=new Set();for(const a of [root,...prototypes.values()])a.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const a of gs)a.dispose();for(const a of ms)a.dispose();for(const a of textures)a.dispose();flagFactory.dispose();root.removeFromParent();}};
}
