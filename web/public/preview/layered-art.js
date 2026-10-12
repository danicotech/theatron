import * as T from 'jz/vendor/three.module.js';
import {ART} from 'preview/assets.js';

export async function mountLayeredArt(scene){
  const root=new T.Group();root.name='Preview / grounded 2D character';scene.add(root);
  const texture=await new T.TextureLoader().loadAsync(ART.character);
  texture.colorSpace=T.SRGBColorSpace;
  // This is a grounded world plane, not a screen billboard: perspective and
  // depth testing stay consistent with the original hall and stair geometry.
  const mat=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.32,depthWrite:true,side:T.DoubleSide,color:0xc0c7d0,roughness:1});
  const geo=new T.PlaneGeometry(2.13,3.2);geo.translate(0,1.6,0);
  const actor=new T.Mesh(geo,mat);actor.position.set(-3,3.72,-35.4);actor.rotation.y=.32;actor.name='Ivory guest / world anchored';root.add(actor);
  // Soft contact shadow under the feet, on the hall's raised dais.
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');
  const gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadowTexture=new T.CanvasTexture(c),sg=new T.PlaneGeometry(2.8,1.5),sm=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});
  const shadow=new T.Mesh(sg,sm);shadow.rotation.x=-Math.PI/2;shadow.position.set(-3,3.735,-35.35);root.add(shadow);
  return {root,update(){root.visible=true;},dispose(){root.removeFromParent();geo.dispose();mat.dispose();texture.dispose();sg.dispose();sm.dispose();shadowTexture.dispose();}};
}
