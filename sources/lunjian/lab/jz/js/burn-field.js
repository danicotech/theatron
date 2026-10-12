// Stationary, irregular ignition field. Advancing its threshold only removes cloth.
export const BURN_GLSL=`
float burnHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float burnNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(burnHash(i),burnHash(i+vec2(1,0)),f.x),mix(burnHash(i+vec2(0,1)),burnHash(i+vec2(1,1)),f.x),f.y);}
float burnField(vec2 uv,vec2 origin,float aspect){vec2 q=(uv-origin)*vec2(aspect,1.);float farX=max(origin.x,1.-origin.x)*aspect;float farY=max(origin.y,1.-origin.y);float farthest=length(vec2(farX,farY))+.2;float d=length(q);float grain=burnNoise(uv*13.)*.10+burnNoise(uv*39.)*.035+burnNoise(uv*107.)*.012;return (d+grain*smoothstep(0.,.10,d)-(uv.y-origin.y)*.07)/farthest;}
`;
const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t;
function hash(x,y){return fract(Math.sin(x*127.1+y*311.7)*43758.5453);}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=fract(x),fy=fract(y);fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);return mix(mix(hash(ix,iy),hash(ix+1,iy),fx),mix(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy);}
export function burnField(x,y,origin,aspect){const d=Math.hypot((x-origin.x)*aspect,y-origin.y);const farthest=Math.hypot(Math.max(origin.x,1-origin.x)*aspect,Math.max(origin.y,1-origin.y))+.2;const k=Math.min(1,d/.1),grain=noise(x*13,y*13)*.10+noise(x*39,y*39)*.035+noise(x*107,y*107)*.012;return (d+grain*k*k*(3-2*k)-(y-origin.y)*.07)/farthest;}
