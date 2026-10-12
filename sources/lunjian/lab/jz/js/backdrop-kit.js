import * as T from 'jz/vendor/three.module.js';
import {mergeGeometries,mergeVertices} from 'jz/vendor/BufferGeometryUtils.js';

// Image-guided authored geometry, not image-to-mesh inference or camera billboards.
// Metres, Y up, front +Z. Originals remain reusable at an identity transform.
export const BACKDROP_IDS=['01-twin-gallery','02-arched-bridge','03-ancient-tree','04-tree-rock','05-frost-grove','06-spirit-lantern'];
export function createBackdropKit(){
  let seed=150926;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const V=(x,y,z)=>new T.Vector3(x,y,z),textures=[],materials=[],geometries=new Set(),prototypes=new Map();
  function texture(bark=false){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),d=ctx.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const k=(y*256+x)*4;const n=130+18*Math.sin(x*(bark?.65:.25)+Math.sin(y*.045)*2)+rnd()*22;
      d.data[k]=n;d.data[k+1]=n*.93;d.data[k+2]=n*.85;d.data[k+3]=255;
    }ctx.putImageData(d,0,0);ctx.strokeStyle='#262c2c77';
    for(let i=0;i<120;i++){let x=rnd()*256,y=rnd()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+3,y+12);ctx.lineTo(x-2,y+55);ctx.stroke();}
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;textures.push(t);return t;
  }
  const woodMap=texture(),barkMap=texture(true);
  function mat(name,color,map=null){const m=new T.MeshStandardMaterial({name,color,map,roughness:.94});if(map){m.bumpMap=map;m.bumpScale=.07;}materials.push(m);return m;}
  const m={wood:mat('Silvered timber',0x918a80,woodMap),dark:mat('Recessed timber',0x444c50,woodMap),tile:mat('Muted moss tiles',0x536658,woodMap),snow:mat('Thin wind-packed snow',0xc2d2df),stone:mat('Weathered limestone',0x626e79,barkMap),bark:mat('Ancient ridged bark',0xaaa99c,barkMap),frost:mat('Frosted fine twigs',0xa6bdcf),leaf:mat('Desaturated violet canopy',0x424852),bamboo:mat('Grey green bamboo',0x5c7163),paper:mat('Unlit lantern paper',0xb0b5ac),spirit:mat('Cold carved ring',0x648f9b)};
  let group,batches;
  function begin(id){group=new T.Group();group.name=id;group.userData={assetId:id,units:'metres',method:'image-guided-parametric-modeling',reference:'images/'+id+'.png'};batches=new Map();}
  function add(geo,material,p=V(0,0,0),s=V(1,1,1),q=new T.Quaternion()){
    if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}
    geo.applyMatrix4(new T.Matrix4().compose(p,q,s));
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geo);
  }
  function finish(){for(const [material,parts]of batches){const raw=mergeGeometries(parts),g=mergeVertices(raw);raw.dispose();geometries.add(g);const mesh=new T.Mesh(g,material);mesh.name=group.name+' / '+material.name;mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);for(const p of parts)p.dispose();}prototypes.set(group.name,group);return group;}
  function box(x,y,z,w,h,d,material=m.wood){add(new T.BoxGeometry(w,h,d),material,V(x,y,z));}
  function beam(a,b,r,material=m.wood,r2=r){const d=b.clone().sub(a);add(new T.CylinderGeometry(r2,r,d.length(),6),material,a.clone().add(b).multiplyScalar(.5),V(1,1,1),new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));}
  function blob(x,y,z,sx,sy,sz,material,detail=1){const g=new T.IcosahedronGeometry(1,detail),a=g.attributes.position;for(let i=0;i<a.count;i++){const n=1+.09*Math.sin(a.getX(i)*9+a.getY(i)*13+a.getZ(i)*7);a.setXYZ(i,a.getX(i)*n,a.getY(i)*n,a.getZ(i)*n);}g.computeVertexNormals();add(g,material,V(x,y,z),V(sx,sy,sz));}
  function taper(points,r0,r1,material=m.bark,steps=20,sides=9){
    const curve=new T.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(steps,false),pos=[],uv=[],ix=[];
    for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPoint(t),r=T.MathUtils.lerp(r0,r1,t);
      for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,rr=r*(1+.10*Math.cos(a*5+t*8));const q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*rr).addScaledVector(frames.binormals[i],Math.sin(a)*rr);pos.push(q.x,q.y,q.z);uv.push(j/sides,t*4);}
    }
    for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;ix.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,material);
  }
  function rail(x1,x2,y,z){
    for(let x=x1;x<=x2+.01;x+=1.6){box(x,y+.68,z,.15,1.36,.15);box(x,y+1.42,z,.24,.13,.24);}
    for(const h of [.25,.7,1.28])box((x1+x2)/2,y+h,z,x2-x1,.085,.12);
    for(let x=x1+.4;x<x2;x+=.45)box(x,y+.7,z,.048,1.1,.048);
    box((x1+x2)/2,y+1.35,z,x2-x1,.035,.16,m.snow);
  }
  function roof(cx,y,cz,w,d,rise){
    const ridge=w*.62;
    for(let side=0;side<4;side++){
      const point=(u,t)=>{let x,z;if(side<2){x=(u-.5)*T.MathUtils.lerp(ridge,w,t);z=(side?1:-1)*d*.5*t;}else{x=(side===2?-1:1)*T.MathUtils.lerp(ridge/2,w/2,t);z=(u-.5)*d*t;}return V(cx+x,y+rise*Math.pow(1-t,1.6)+.8*Math.pow(t,5)*(.25+.75*Math.pow(Math.abs(u-.5)*2,4)),cz+z);};
      const nu=side<2?32:12,nv=8,pos=[],uv=[],ix=[];
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=point(i/nu,j/nv);pos.push(p.x,p.y,p.z);uv.push(i/nu,j/nv);}
      for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;if(side===0||side===3)ix.push(a,a+1,b,b,a+1,b+1);else ix.push(a,b,a+1,b,b+1,a+1);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();const under=geo.clone();under.translate(0,-.18,0);add(under,m.dark);add(geo,m.tile);
      for(let i=0;i<=nu;i++){
        const pts=[];for(let j=0;j<=nv;j++){const p=point(i/nu,j/nv);p.y+=.08;pts.push(p);}
        taper(pts,.08,.08,m.tile,8,5);
        if(i%4!==0){const snowy=pts.slice(1,7).map(p=>p.clone().add(V(0,.08,0)));taper(snowy,.035,.055,m.snow,7,5);}
        const e=point(i/nu,1),b=point(i/nu,.55);e.y-=.22;b.y-=.22;beam(e,b,.07);
      }
      const edge=[];for(let i=0;i<=nu;i++)edge.push(point(i/nu,1));taper(edge,.13,.13,m.tile,nu,6);
    }
    beam(V(cx-ridge/2,y+rise+.16,cz),V(cx+ridge/2,y+rise+.16,cz),.16,m.tile);
    beam(V(cx-ridge/2,y+rise+.32,cz),V(cx+ridge/2,y+rise+.32,cz),.065,m.snow);
  }
  function moonWall(cx,y,z,w,h){
    const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();const hole=new T.Path();hole.absarc(0,2,1.68,0,Math.PI*2,true);shape.holes.push(hole);
    add(new T.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false,curveSegments:32}),m.dark,V(cx,y,z));
    const ring=new T.TorusGeometry(1.72,.115,6,48);add(ring,m.wood,V(cx,y+2,z+.33));
    for(const side of [-1,1])for(let x=2.2;x<w/2-.4;x+=.32){box(cx+side*x,y+h*.5,z+.32,.045,h-.4,.08);}
    for(const side of [-1,1])for(let j=1;j<5;j++)box(cx+side*w*.31,y+j*h/5,z+.36,w*.3,.045,.08);
  }
  begin(BACKDROP_IDS[0]);
  box(0,.2,0,64,.4,13,m.stone);box(0,.43,0,63.8,.06,12.8,m.snow);
  for(let x=-30;x<=30;x+=4){
    for(const z of [-5,5]){beam(V(x,.4,z),V(x,5.7,z),.21,m.wood,.18);box(x,5.75,z,1.5,.2,.4);box(x,5.9,z,.6,.2,1.1);}
    if(Math.abs(x)%12!==0)for(const z of [-4.8,4.8]){box(x+1.8,2.8,z,3.2,4.8,.2,m.dark);for(let j=0;j<8;j++)box(x+.45+j*.35,2.8,z+.18,.045,4.5,.055);for(const y of [1.1,2.4,3.5,4.7])box(x+1.8,y,z+.21,3.1,.055,.075);}
  }
  for(const z of [-5,5]){box(0,5.35,z,64,.35,.35);box(0,4.75,z,64,.12,.2);}
  roof(0,5.9,0,68,15,2.2);
  for(const side of [-1,1]){
    const x=side*21;box(x,8.95,-.6,19,.3,11.4);moonWall(x,9.1,3.1,17.2,5.1);moonWall(x,9.1,-4.6,17.2,5.1);
    for(const dx of [-8.6,8.6]){box(x+dx,11.65,-.5,.25,5.1,8);for(const z of [-4.5,3.6]){beam(V(x+dx,9,z),V(x+dx,14.1,z),.24);box(x+dx,14,z,1.3,.23,.8);}}
    for(const z of [-4.5,3.6])box(x,14,z,19,.38,.4);
    roof(x,14.25,-.5,23,13,2.4);rail(x-9,x+9,9.1,5.1);
    for(const dx of [-9,9])for(let k=0;k<3;k++){
      add(new T.CylinderGeometry(.17,.17,.42,8),m.paper,V(x+dx,13.2-k*.52,5.1));beam(V(x+dx,13.6,5.1),V(x+dx,11.5,5.1),.025);
    }
  }finish();

  begin(BACKDROP_IDS[1]);
  const arch=x=>.38+2.4*(1-(x/12)**2);
  for(let i=0;i<60;i++){const x=-12+(i+.5)*.4;const g=new T.BoxGeometry(.395,.18,3.6);g.rotateZ(Math.atan(-4.8*x/144));add(g,m.wood,V(x,arch(x),0));if(i%5!==0)box(x,arch(x)+.115,0,.36,.035,3.55,m.snow);}
  for(const z of [-1.8,1.8]){
    const pts=[];for(let i=0;i<=32;i++){const x=-12+i*.75;pts.push(V(x,arch(x)-.22,z));}taper(pts,.2,.2,m.dark,32,6);
    for(const h of [.35,.86,1.5])taper(pts.map(p=>p.clone().add(V(0,h+.22,0))),.065,.065,m.wood,32,6);
    for(let i=0;i<=12;i++){const x=-12+i*2;box(x,arch(x)+.8,z,.16,1.6,.16);box(x,arch(x)+1.62,z,.3,.16,.3);box(x,arch(x)+1.73,z,.3,.05,.3,m.snow);}
    for(let x=-11.5;x<12;x+=.5)box(x,arch(x)+.8,z,.04,1.3,.06);
  }
  for(const x of [-12,12])box(x,.16,0,1,.32,4,m.stone);finish();

  function twigs(origin,direction,length,radius,depth,material=m.bark){
    const mid=origin.clone().addScaledVector(direction,length*.48).add(V((rnd()-.5)*length*.25,length*.12,(rnd()-.5)*length*.3));const end=origin.clone().addScaledVector(direction,length).add(V((rnd()-.5)*length*.25,length*.1,(rnd()-.5)*length*.3));
    taper([origin,mid,end],radius,radius*.3,material,5,5);
    if(depth<1)return;
    for(let k=0;k<3;k++){const d=direction.clone().add(V((rnd()-.5)*1.3,.3+rnd()*.4,(rnd()-.5)*1.35)).normalize();twigs(end,d,length*(.47+rnd()*.15),radius*.42,depth-1,material);}
  }
  function ancient(ox=0,oy=0,oz=0,scale=1,leafy=false){
    const p=(x,y,z)=>V(ox+x*scale,oy+y*scale,oz+z*scale);
    taper([p(0,0,0),p(-1,4,0),p(0,8,0),p(2.8,12,.4),p(1.9,16,0),p(4,20,-.7)],2.5*scale,.4*scale,m.bark,36,14);
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9,dx=Math.cos(a),dz=Math.sin(a);taper([p(0,3,0),p(dx*2,1.5,dz*2),p(dx*5,.35,dz*4),p(dx*8,.15,dz*6)],.85*scale,.04*scale,m.bark,16,8);}
    for(const branch of [ [[1,10,0],[-4,12,1],[-8,11,1],[-13,14,2]],[[2,12,0],[6,12,1],[10,10,1],[15,12,2]],[[3,16,0],[8,17,-1],[11,16,-1],[15,20,0]],[[2,17,0],[-1,18,-2],[-3,23,-2],[-5,25,0]],[[3,19,0],[4,23,1],[8,25,1],[9,28,2]],[[0,8,-.7],[-2,11,-5],[-5,13,-7],[-7,16,-7]] ]){
      const pts=branch.map(a=>p(...a));taper(pts,1.0*scale,.17*scale,m.bark,24,10);
      const snow=pts.slice(1).map(a=>a.clone().add(V(0,.22*scale,0)));taper(snow,.17*scale,.06*scale,m.snow,12,6);
      for(let k=1;k<4;k++)twigs(pts[k],V((branch[k][0]-branch[k-1][0])*.17,.65,(rnd()-.5)*.8).normalize(),3*scale,.12*scale,2);
      if(leafy)for(let k=1;k<4;k++)for(let j=0;j<15;j++){const a=pts[k];blob(a.x+(rnd()-.5)*5*scale,a.y+rnd()*2*scale,a.z+(rnd()-.5)*4*scale,(.5+rnd())*scale,.35*scale,(.5+rnd())*scale,m.leaf,0);}
    }
  }
  begin(BACKDROP_IDS[2]);ancient();finish();
  begin(BACKDROP_IDS[3]);
  // Two crag pillars and an offset cap preserve a real open pocket in the rock.
  for(const side of [-1,1])for(let i=0;i<6;i++){const x=side*(3+i*.15),y=1.5+i*2.3;blob(x,y,-1,3.4-i*.15,2.5,4.5-i*.3,m.stone,1);if(i%2===0)blob(x,y+1.8,-.8,2.8-i*.14,.25,3.4-i*.3,m.snow,1);}
  blob(0,14,-1.5,6,3.5,4,m.stone,1);ancient(-1,15,-1,.8,true);finish();
  begin(BACKDROP_IDS[4]);
  for(let k=0;k<3;k++){
    const x=(k-1)*3.6,z=k===1?-1:1,h=9+k*1.9;
    taper([V(x,0,z),V(x+.2,h*.4,z),V(x-.3,h*.75,z+.2),V(x+.3,h,z)],.17,.025,m.bark,16,6);
    for(let j=0;j<9;j++){const a=j*2.4+k;twigs(V(x,h*.3+j*h*.06,z),V(Math.cos(a),.65,Math.sin(a)).normalize(),2.5+j*.06,.06,2,m.frost);}
  }
  for(let k=0;k<9;k++){
    const x=4+rnd()*3,z=-2+rnd()*4,h=6+rnd()*3;
    beam(V(x,0,z),V(x+.4,h,z+.2),.08,m.bamboo,.055);
    for(let j=1;j<h;j++){add(new T.TorusGeometry(.09,.019,4,6),m.bamboo,V(x+.4*j/h,j,z+.2*j/h),V(1,1,1),new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2));if(j>h*.5)for(let q=0;q<3;q++){const a=rnd()*6.28;const end=V(x+Math.cos(a)*.9,j+.35,z+Math.sin(a)*.9);beam(V(x,j,z),end,.015,m.bamboo);blob(end.x,end.y,end.z,.32,.025,.075,m.bamboo,0);}}
  }finish();
  begin(BACKDROP_IDS[5]);box(0,.15,0,2.8,.3,1.8,m.stone);
  for(const sign of [-1,1]){const pts=[];for(let i=0;i<=24;i++){const a=-Math.PI*.48+i/24*Math.PI*1.65;pts.push(V(sign*Math.cos(a)*1.35,2.05+Math.sin(a)*1.75,sign*.14*Math.sin(a*2)));}taper(pts,.18,.025,m.spirit,36,8);}
  beam(V(0,3.8,0),V(0,2.6,0),.025,m.dark);box(0,2.35,0,.58,.7,.58,m.paper);for(const x of [-.32,.32])for(const z of [-.32,.32])box(x,2.35,z,.045,.82,.045,m.dark);box(0,2.8,0,.78,.12,.78,m.dark);box(0,1.92,0,.7,.1,.7,m.dark);finish();

  const root=new T.Group();root.name='Rear-wall backdrop / twin pavilions and ancient tree';
  for(const [w,h,d,x,y,z]of [[128,8,58,0,4,-92],[78,2,20,0,9,-80]]){
    const geo=new T.BoxGeometry(w,h,d);geometries.add(geo);const terrace=new T.Mesh(geo,m.stone);terrace.position.set(x,y,z);terrace.name='Solid rear mountain terrace';terrace.receiveShadow=true;root.add(terrace);
  }
  const placements=[];
  function place(id,p,scale=1,yaw=0){const o=prototypes.get(id).clone(true);o.position.fromArray(p);o.scale.setScalar(scale);o.rotation.y=yaw;o.userData={...o.userData,backdrop:true};root.add(o);placements.push({id,position:p,scale,yaw});return o;}
  // Entire assembly is behind the rear enclosure at Z=-45, with a raised
  // mountain terrace. Do not move the arena, front stair or camera to expose it.
  place(BACKDROP_IDS[0],[0,10,-80],1.15);
  place(BACKDROP_IDS[1],[0,20.48,-74.7],1.15);
  place(BACKDROP_IDS[2],[1,10,-94],1.25);
  place(BACKDROP_IDS[3],[-57,0,-86],1.15,.18);
  for(const [x,z,s]of [[-42,-88,1.8],[43,-88,1.7],[-29,-101,1.9],[29,-102,2],[56,-95,1.8],[-10,-108,1.9],[12,-108,2.1]])place(BACKDROP_IDS[4],[x,8,z],s,x*.017);
  for(const side of [-1,1])place(BACKDROP_IDS[5],[side*24.15,29.5,-80.5],.8);
  root.updateMatrixWorld(true);
  return {root,prototypes,placements,dispose(){root.removeFromParent();for(const g of geometries)g.dispose();for(const material of materials)material.dispose();for(const t of textures)t.dispose();}};
}
