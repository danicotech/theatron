import * as T from 'jz/vendor/three.module.js';

// Image-guided modeling from flame-reference-focused.png: a connected fire bed,
// a shorter ivory heart, forked tips, and narrow translucent folds.
// These are closed 3D surfaces, not camera-facing fire cards.
export function createFlameGeometry() {
  const position=[],uv=[],phase=[],layer=[],height=[],color=[],indices=[];
  const tongues=[
    [-.015,.00,1.40,.31,.11,.0,.055],
    [-.18,.045,.86,.205,-.13,1.8,-.055],
    [.17,.015,.92,.20,.12,3.2,.05],
    [.015,-.14,.98,.225,-.055,4.6,-.055],
    [-.13,-.12,.65,.175,-.09,2.4,.025],
    [.14,.13,.69,.18,.085,5.2,.04],
    [-.14,.14,.62,.175,-.095,.9,.055],
    [.075,.025,1.03,.15,-.025,6.1,-.02],
    [.02,.075,1.19,.135,.13,2.8,.01]
  ];
  const rings=32,sides=16;let outerIndexCount=0;
  for(let core=0;core<2;core++) {
    const begin=indices.length;
    for(let k=0;k<(core?6:tongues.length);k++) {
      const [x,z,h0,w0,lean,seed,dz]=tongues[k];
      const h=h0*(core?.60:1),w=w0*(core?.76:1),base=position.length/3;
      for(let j=0;j<=rings;j++) {
        const t=j/rings;
        // Adjacent lobes overlap at the fuel bed and share an updraft. Only the
        // upper tips separate; the fire reads as one mass from every direction.
        const gather=.65+.35*t;
        const cx=x*(core?.68:1)*gather+lean*t*t+Math.sin(t*7.4)*.095*t+Math.sin(t*8.+seed)*.028*t;
        const cz=z*(core?.68:1)*gather+dz*t*t+Math.sin(t*5.8)*.045*t+Math.sin(t*7.+seed)*.022*t;
        const radius=w*Math.pow(1-t,.85)*(.86+.28*Math.sin(t*Math.PI));
        const twist=seed+t*2.8;
        for(let a=0;a<=sides;a++) {
          const angle=a/sides*Math.PI*2;
          const fold=1+.19*Math.sin(angle*3+t*10+seed)+.10*Math.cos(angle*5-t*13);
          const rx=Math.cos(angle)*radius*fold;
          const rz=Math.sin(angle)*radius*(.46+.12*Math.sin(t*8+seed))*fold;
          position.push(cx+rx*Math.cos(twist)-rz*Math.sin(twist),t*h,
            cz+rx*Math.sin(twist)+rz*Math.cos(twist));
          uv.push(a/sides,t);phase.push(seed);layer.push(core);height.push(t);
          const c=new T.Color(core?0xffdf86:0xff831e).lerp(new T.Color(core?0xffa92d:0xe33b08),t);
          color.push(c.r,c.g,c.b);
          if(j<rings&&a<sides) {
            const p=base+j*(sides+1)+a,q=p+sides+1;
            indices.push(p,q,p+1,p+1,q,q+1);
          }
        }
      }
      // Close the base under the fuel line. Tips converge to one position.
      for(let a=1;a<sides-1;a++)indices.push(base,base+a,base+a+1);
    }
    // Keep material ranges for portable model export and mesh inspection.
    if(core===0)outerIndexCount=indices.length-begin;
  }
  const g=new T.BufferGeometry();
  for(const [name,values,size]of [['position',position,3],['uv',uv,2],['aPhase',phase,1],['aLayer',layer,1],['aHeight',height,1],['color',color,3]])
    g.setAttribute(name,new T.Float32BufferAttribute(values,size));
  g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData={reference:'flame-reference-focused.png',outerIndexCount,
    technique:'Image-guided curved 3D flame shells; procedural GPU advection',tongues:15};
  return g;
}

const noise=`
float hash3(vec3 p){p=fract(p*.3183099+vec3(.11,.37,.73));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float turbulence(vec3 p){return .57*noise3(p)+.28*noise3(p*2.03+4.7)+.15*noise3(p*4.11+9.1);}
`;

export function createFlameRig(parent,origins,{time={value:0},embers=true}={}) {
  const geometry=createFlameGeometry();
  const material=new T.ShaderMaterial({name:'Fire / advected translucent folds',
    uniforms:{uTime:time},transparent:true,depthWrite:false,side:T.DoubleSide,
    blending:T.AdditiveBlending,toneMapped:false,
    vertexShader:`
      uniform float uTime;attribute float aPhase,aLayer,aHeight;
      varying vec3 vP,vN,vView;varying float vHeight,vLayer,vSeed;
      ${noise}
      void main(){
        float seed=aPhase+instanceMatrix[3].x*.39+instanceMatrix[3].z*.27;
        float t=uTime;vec3 p=position;
        float lift=pow(aHeight,1.55);
        p.x+=lift*(.085*sin(t*2.7-aHeight*8.+seed)+.035*sin(t*5.1-aHeight*14.+seed*.7));
        p.z+=lift*(.065*cos(t*2.2-aHeight*7.+seed)+.028*sin(t*4.7-aHeight*12.));
        vec3 eddy=position*vec3(10.,7.,10.)+vec3(seed,-t*3.1,0.);
        p.x+=(noise3(eddy)-.5)*.15*lift;
        p.z+=(noise3(eddy+8.3)-.5)*.13*lift;
        p.y*=1.+aHeight*(.045*sin(t*3.5+seed)+.025*sin(t*6.2+seed*.4));
        vP=p;vHeight=aHeight;vLayer=aLayer;vSeed=seed;
        vec4 mv=modelViewMatrix*instanceMatrix*vec4(p,1.);
        vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);vView=-mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform float uTime;varying vec3 vP,vN,vView;varying float vHeight,vLayer,vSeed;
      ${noise}
      void main(){
        vec3 q=vP*vec3(6.,3.3,6.)+vec3(vSeed, -uTime*2.4, vSeed*.7);
        float n=turbulence(q);
        float folds=turbulence(q*vec3(2.1,1.4,2.1)+vec3(n*2.,-uTime*.8,0.));
        float filaments=pow(1.-abs(folds*2.-1.),6.);
        float density=smoothstep(.18+vHeight*.12,.69,n);
        float edge=pow(1.-abs(dot(normalize(vN),normalize(vView))),1.4);
        float base=smoothstep(0.,.035,vHeight);
        float tip=1.-smoothstep(.76,1.,vHeight);
        float hot=clamp(.18+(1.-vHeight)*.50+filaments*.32+vLayer*.25,0.,1.);
        vec3 c=mix(vec3(.95,.085,.009),vec3(1.,.49,.045),smoothstep(.12,.64,hot));
        c=mix(c,vec3(1.,.86,.48),smoothstep(.61,1.,hot));
        float alpha=base*tip*(.025+.57*density)*(.35+.65*filaments+.30*edge);
        alpha*=mix(.60,.48,vLayer);
        if(alpha<.018)discard;
        gl_FragColor=vec4(c,alpha);
      }`
  });
  const mesh=new T.InstancedMesh(geometry,material,origins.length);
  mesh.name='Flame / image-guided curling tongues';mesh.frustumCulled=false;
  const matrix=new T.Matrix4();
  origins.forEach(([x,y,z],i)=>{
    matrix.makeRotationY(i*2.39996);matrix.setPosition(x,y,z);mesh.setMatrixAt(i,matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.userData={...geometry.userData,brazierCount:origins.length};
  parent.add(mesh);
  let sparks=null,sparkGeometry=null,sparkMaterial=null;
  if(embers) {
    const p=[],seeds=[];
    for(const origin of origins)for(let i=0;i<14;i++){p.push(...origin);seeds.push(i/14,(i*13.37+origin[0]*.17)%6.28);}
    sparkGeometry=new T.BufferGeometry();sparkGeometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
    sparkGeometry.setAttribute('aSeed',new T.Float32BufferAttribute(seeds,2));
    sparkMaterial=new T.ShaderMaterial({uniforms:{uTime:time},transparent:true,depthWrite:false,
      blending:T.AdditiveBlending,toneMapped:false,
      vertexShader:`uniform float uTime;attribute vec2 aSeed;varying float vAlpha;
      void main(){float age=fract(aSeed.x+uTime*(.19+.045*sin(aSeed.y)));vec3 p=position;
      p.y+=.15+age*2.3;p.x+=sin(aSeed.y+age*4.)*(.16+age*.28);p.z+=cos(aSeed.y*2.+age*3.)*(.12+age*.2);
      vAlpha=sin(age*3.14159)*(1.-age)*.75;vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*mv;gl_PointSize=clamp(30./max(1.,-mv.z),1.,3.5);}`,
      fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(1.,.40,.055,vAlpha*(1.-smoothstep(.12,.5,d)));}`});
    sparks=new T.Points(sparkGeometry,sparkMaterial);sparks.name='Flame / drifting embers';sparks.frustumCulled=false;parent.add(sparks);
  }
  return {mesh,sparks,time,geometry,material,
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();sparks?.removeFromParent();sparkGeometry?.dispose();sparkMaterial?.dispose();}
  };
}
