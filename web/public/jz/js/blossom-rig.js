import {createFlowerGeometry} from 'jz/js/plum-geometry.js';
import * as T from 'jz/vendor/three.module.js';

// Botanical geometry follows flower-branch-study.png: cupped petals, stamens,
// anthers, closed buds, and sparse branches. All movement uses bone skinning.
export function createBlossomRig(scene){
  const root=new T.Group();root.name='White flowering willow and red plum / wind rigs';scene.add(root);
  let seed=3152026;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const rigs=[],geometries=[],skeletons=[];
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:0,side:T.DoubleSide});
  const flowerWhite=createFlowerGeometry('white',true),flowerRed=createFlowerGeometry('red',true);
  const white=new T.Color(0xe0ded1),red=new T.Color(0xb72442),bark=new T.Color(0x55403c),filament=new T.Color(0xeee1c3),anther=new T.Color(0xb79958);
  const unitBud=new T.IcosahedronGeometry(1,0);
  const tube=new T.CylinderGeometry(1,1,1,4,1).toNonIndexed();
  const petal=new T.BufferGeometry();
  {const p=[];const f=(t,s)=>{const w=Math.sin(Math.PI*t)*.59;return [s*w,t,.24*t*t+.15*s*s*Math.sin(Math.PI*t)];};
    for(let i=0;i<4;i++)for(let j=0;j<2;j++){
      const a=f(i/4,j-1),b=f((i+1)/4,j-1),c=f((i+1)/4,j),d=f(i/4,j);
      p.push(...a,...b,...d,...b,...c,...d);
    }petal.setAttribute('position',new T.Float32BufferAttribute(p,3));petal.computeVertexNormals();}
  const tmp=new T.Matrix4(),q=new T.Quaternion(),up=V(0,1,0);
  function build(name,p,scale,yaw,definitions,isWhite){
    const pos=[],colors=[],skin=[],weights=[],bones=[],chains=[];
    function append(geo,m,c,i0,i1,w){const a=geo.attributes.position,v=V();
      for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m);pos.push(v.x,v.y,v.z);if(c)colors.push(c.r,c.g,c.b);else{const co=geo.attributes.color;colors.push(co.getX(i),co.getY(i),co.getZ(i));}skin.push(i0,i1,0,0);weights.push(1-w,w,0,0);}}
    function transform(p,q,s){return new T.Matrix4().compose(p,q,s);}
    function segment(a,b,r,c,idx,t){q.setFromUnitVectors(up,b.clone().sub(a).normalize());tmp.compose(a.clone().lerp(b,.5),q,V(r,a.distanceTo(b),r));append(tube,tmp,c,idx,idx+1,t);}
    function bloom(at,size,idx,w,closed=false){
      const rotation=new T.Quaternion().setFromEuler(new T.Euler((rand()-.5)*1.6,(rand()-.5)*2.4,rand()*6.28));
      const base=isWhite?white:red;const color=base.clone().multiplyScalar(.82+rand()*.32);
      const frame=transform(at,rotation,V(size,size,size));
      if(closed){append(unitBud,frame.clone().multiply(new T.Matrix4().makeScale(.4,.56,.4)),color,idx,idx+1,w);return;}
      append(isWhite?flowerWhite:flowerRed,frame,null,idx,idx+1,w);
    }
    for(const def of definitions){
      const {start,end,length,droop}=def,base=bones.length,points=[];const n=5;
      for(let j=0;j<n;j++){
        const t=j/(n-1),point=droop?start.clone().add(V(def.dx*Math.sin(t*1.6),-length*t,def.dz*t+Math.sin(t*2)*.2)):start.clone().lerp(end,t);
        points.push(point);const bone=new T.Bone();bone.name=name+' / twig '+chains.length+' / joint '+j;
        bone.position.copy(j?point.clone().sub(points[j-1]):point);if(j)bones[base+j-1].add(bone);bones.push(bone);
      }
      chains.push({base,phase:rand()*6.28,droop});
      const segments=droop?16:5;
      for(let j=0;j<segments;j++){
        const t=j/segments,u=t*(n-1),i=Math.min(n-2,Math.floor(u)),f=u-i;
        const a=points[i].clone().lerp(points[i+1],f),t2=(j+1)/segments,u2=t2*(n-1),i2=Math.min(n-2,Math.floor(u2));
        const b=points[i2].clone().lerp(points[i2+1],u2-i2);
        segment(a,b,(droop?.035:.045)*(1-t*.75),bark,base+i,f);
        if(j<1)continue;
        const repetitions=1;
        for(let k=0;k<repetitions;k++){
          const offset=V((rand()-.5)*(droop?.55:.42),(rand()-.5)*.35,(rand()-.5)*.45),at=a.clone().add(offset);
          segment(a,at,.009,bark,base+i,f);
          bloom(at,(droop?.32:.32)*(.72+rand()*.52),base+i,f,rand()<.21);
        }
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(skin,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geo.computeVertexNormals();geo.computeBoundingSphere();geometries.push(geo);
    const mesh=new T.SkinnedMesh(geo,material);mesh.name=name;mesh.position.fromArray(p);mesh.scale.setScalar(scale);mesh.rotation.y=yaw;
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
    chains.forEach(c=>mesh.add(bones[c.base]));root.add(mesh);root.updateMatrixWorld(true);
    const skeleton=new T.Skeleton(bones);mesh.bind(skeleton);skeletons.push(skeleton);rigs.push({mesh,bones,chains});
  }
  const arms=[[[1,10,0],[-4,12,1],[-8,11,1],[-13,14,2]],[[2,12,0],[6,12,1],[10,10,1],[15,12,2]],[[3,16,0],[8,17,-1],[11,16,-1],[15,20,0]],[[2,17,0],[-1,18,-2],[-3,23,-2],[-5,25,0]],[[3,19,0],[4,23,1],[8,25,1],[9,28,2]],[[0,8,-.7],[-2,11,-5],[-5,13,-7],[-7,16,-7]]];
  function willow(){const defs=[];for(const arm of arms){const curve=new T.CatmullRomCurve3(arm.map(p=>V(...p)));
    for(let j=0;j<10;j++){const t=.27+j*.073,start=curve.getPoint(t);defs.push({start,length:3.6+rand()*6,droop:true,dx:(rand()-.5)*2,dz:(rand()-.5)*1.8});}
  }return defs;}
  build('Willow / white cascading blossoms',[1,10,-94],1.25,0,willow(),true);
  // The second ancient tree grows on the left rock: use its exact local offset.
  const yaw=.18,offset=V(-1,15,-1).multiplyScalar(1.15).applyAxisAngle(up,yaw).add(V(-57,0,-86));
  build('Rock willow / white cascading blossoms',offset.toArray(),.92,yaw,willow(),true);
  function plum(){const defs=[];function branch(a,len,angle,az,depth){const b=a.clone().add(V(Math.sin(angle)*Math.cos(az)*len,Math.cos(angle)*len,Math.sin(angle)*Math.sin(az)*len));
    if(depth===0){defs.push({start:a,end:b.clone().add(V(0,.35,0)),droop:false});return;}
    branch(b,len*.71,angle+.38,az+.7,depth-1);branch(b,len*.59,angle+.8,az-1.9,depth-1);
  }branch(V(),3.3,.15,.8,5);return defs;}
  const plumDefs=plum();
  for(const side of [-1,1])for(let i=0;i<3;i++)build('Plum / red flowers '+side+'-'+i,[side*(27+i*3),0,4-i*17],1.05,side*i*.4,plumDefs,false);
  unitBud.dispose();tube.dispose();petal.dispose();flowerWhite.dispose();flowerRed.dispose();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  root.userData={rigCount:rigs.length,boneCount:skeletons.reduce((a,s)=>a+s.bones.length,0),flowerStyle:'white weeping willow / red plum',animation:'hierarchical bone chains with phase-delayed tip sway'};
  return {root,update(t){const strength=reduced.matches?0:1;for(const rig of rigs)for(const c of rig.chains)for(let j=0;j<5;j++){
    const bone=rig.bones[c.base+j],amplitude=(c.droop?.024:.013)*(j?1:.35)*strength;
    bone.rotation.z=amplitude*(Math.sin(t*.73+c.phase-j*.43)+.35*Math.sin(t*1.41+c.phase));
    bone.rotation.x=amplitude*.65*Math.sin(t*.57+c.phase-j*.35);
  }},dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());skeletons.forEach(s=>s.dispose());material.dispose();}};
}
