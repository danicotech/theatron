import {mergeVertices} from 'jz/vendor/BufferGeometryUtils.js';
import * as T from 'jz/vendor/three.module.js';
const profiles={
  "red": {
    "widths": [
      0.025,
      0.21606,
      0.33818,
      0.41646,
      0.49475,
      0.54485,
      0.57616,
      0.60121,
      0.60747,
      0.62,
      0.61061,
      0.58556,
      0.55111,
      0.5104,
      0.45717,
      0.32879,
      0.025
    ],
    "source": "plum-red-study-24.png",
    "crop": [
      8,
      265,
      248,
      495
    ],
    "sourceHeight": 198,
    "sourceWidth": 198
  },
  "white": {
    "widths": [
      0.025,
      0.11481,
      0.19901,
      0.33296,
      0.4363,
      0.50901,
      0.55494,
      0.58556,
      0.61235,
      0.62,
      0.61235,
      0.59321,
      0.55494,
      0.51667,
      0.42864,
      0.32531,
      0.025
    ],
    "source": "plum-white-study-24.png",
    "crop": [
      8,
      265,
      248,
      495
    ],
    "sourceHeight": 202,
    "sourceWidth": 162
  }
};
export function createPetalGeometry(tone='red',detail=12){
  const pos=[],colors=[],widths=profiles[tone].widths,white=tone==='white';
  const base=new T.Color(white?0xfff0e5:0xf3a4a8),edge=new T.Color(white?0xe1dfd3:0xb81d3c);
  function point(t,s){const u=t*16,k=Math.min(15,Math.floor(u)),w=T.MathUtils.lerp(widths[k],widths[k+1],u-k);
    return [s*w*.76,t,.27*t*t+.17*s*s*Math.sin(Math.PI*t)+.025*Math.sin(s*7+t*12)*t];}
  function add(t,s){pos.push(...point(t,s));const c=base.clone().lerp(edge,Math.min(1,t*1.5));c.multiplyScalar(1-.11*Math.pow(Math.abs(Math.sin(s*17+t*4)),16));colors.push(c.r,c.g,c.b);}
  for(let i=0;i<detail;i++)for(let j=0;j<4;j++){const a=i/detail,b=(i+1)/detail,s=j/2-1,v=s+.5;add(a,s);add(b,s);add(a,v);add(b,s);add(b,v);add(a,v);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));const smooth=mergeVertices(g);g.dispose();smooth.computeVertexNormals();const result=smooth.toNonIndexed();smooth.dispose();return result;
}
export function createFlowerGeometry(tone='red',low=false,part='flower'){
  const pos=[],color=[],petal=createPetalGeometry(tone,low?4:12),rod=new T.CylinderGeometry(1,1,1,low?3:6,1).toNonIndexed(),sphere=new T.IcosahedronGeometry(1,0);
  const up=new T.Vector3(0,1,0),v=new T.Vector3(),matrix=new T.Matrix4();
  function append(g,m,c){const p=g.attributes.position,co=g.attributes.color;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);pos.push(v.x,v.y,v.z);if(c)color.push(c.r,c.g,c.b);else color.push(co.getX(i),co.getY(i),co.getZ(i));}}
  const filament=new T.Color(0xf3dfb3),gold=new T.Color(0xd5a344),sepal=new T.Color(0x68513b);
  if(part==='flower')for(let i=0;i<5;i++){matrix.makeRotationZ(i*Math.PI*2/5);append(petal,matrix,null);}
  if(part!=='bud')for(let i=0;i<(low?5:24);i++){
    const angle=i*2.39996,r=.17+(i%3)*.10,tip=new T.Vector3(Math.cos(angle)*r,Math.sin(angle)*r,.43+(i%4)*.05);
    const q=new T.Quaternion().setFromUnitVectors(up,tip.clone().normalize());matrix.compose(tip.clone().multiplyScalar(.5),q,new T.Vector3(.009,tip.length(),.009));append(rod,matrix,filament);
    matrix.compose(tip,new T.Quaternion(),new T.Vector3(.035,.024,.026));append(sphere,matrix,gold);
  }
  if(part==='flower'||part==='bud'){
    for(let i=0;i<5;i++){matrix.makeRotationZ(i*Math.PI*2/5+.3).multiply(new T.Matrix4().makeTranslation(0,0,-.08)).multiply(new T.Matrix4().makeScale(.28,.40,-.7));append(petal,matrix,sepal);}
    if(part==='bud'){matrix.makeScale(.4,.53,.4);append(sphere,matrix,new T.Color(tone==='white'?0xe9c6c5:0x9e1c37));}
  }
  petal.dispose();rod.dispose();sphere.dispose();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(color,3));const smooth=mergeVertices(g);g.dispose();smooth.computeVertexNormals();const result=smooth.toNonIndexed();smooth.dispose();return result;
}
