'use strict';
const poster = document.getElementById('poster');
const canvas = document.getElementById('lightCube');
const ctx = canvas.getContext('2d');
const mask = document.createElement('canvas');
const light = mask.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const moves = [
  ['Left','左','←','y',0,-1], ['Down','下','↓','x',1,-1],
  ['Right','右','→','y',-1,1], ['Up','上','↑','x',0,1]
];
const faces = [
  [0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]
];
const normals = [[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];
const corners = Array.from({length:8},(_,i)=>[(i&1)?1:-1,(i&2)?1:-1,(i&4)?1:-1].map(n=>n*.39));
let width,height,scale,cx,cy,pieces,step,turn,burst,pointer,handle,previous=0;
const el = id=>document.getElementById(id);
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
function rot([x,y,z],axis,a){
  const c=Math.cos(a),s=Math.sin(a);
  return axis==='x'?[x,y*c-z*s,y*s+z*c]:[x*c+z*s,y,z*c-x*s];
}
function reset(){
  pieces=[];step=0;turn=null;burst=null;pointer=null;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
    pieces.push({pos:[x,y,z],velocity:[x*2+Math.random()-.5,y*2+Math.random()-.5,z*1.8],spin:Math.random()*4-2});
  poster.classList.remove('done','burst');el('replay').hidden=true;el('end').setAttribute('aria-hidden','true');
  document.querySelector('.hint').hidden=false;promptMove();wake();
}
function promptMove(){
  el('num').textContent='0'+Math.min(4,step+1);
  document.querySelectorAll('.tracks i').forEach((e,i)=>e.classList.toggle('on',i<step));
  if(step<4){const [key,label,arrow]=moves[step];poster.dataset.direction=key;el('label').textContent='向'+label+'滑动';document.querySelector('.arrow').textContent=arrow;}
}
function move(key){
  if(turn||burst!==null||step>=4)return;
  const [expected,label,,axis,layer,sign]=moves[step];
  if(expected!==key){el('label').textContent='请向'+label+'滑动';return;}
  turn={axis,sign,layer,start:performance.now(),slice:new Set(pieces.filter(p=>p.pos[axis==='x'?0:1]===layer))};wake();
}
function resize(){
  width=poster.clientWidth;height=poster.clientHeight;cx=width*.5;cy=height*.43;
  scale=Math.min(width*.17,height*.115,105);
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  mask.width=mask.height=224;wake();
}
function poly(c,points){
  c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();
}
function wake(){if(!handle&&!document.hidden)handle=requestAnimationFrame(frame);}
function frame(now){
  handle=0;
  if(!width)return;
  if(!reduced.matches&&now-previous<30){wake();return;}previous=now;
  let angle=0,kick=0;
  if(turn){
    const t=clamp((now-turn.start)/(reduced.matches?1:720),0,1);
    angle=turn.sign*Math.PI*.5*(t*t*(3-2*t));kick=Math.sin(Math.PI*t);
    if(t===1){
      for(const p of turn.slice)p.pos=rot(p.pos,turn.axis,angle).map(Math.round);
      turn=null;angle=0;step++;promptMove();
      if(step===4){burst=now;poster.classList.add('burst');document.querySelector('.hint').hidden=true;}
    }
  }
  const time=reduced.matches?0:now*.00065;
  const yaw=-.48+Math.sin(time)*.115+(turn?.axis==='y'?turn.sign*kick*.09:0);
  const pitch=-.37+Math.sin(time*.81)*.05+(turn?.axis==='x'?turn.sign*kick*.07:0);
  const view=v=>rot(rot(v,'y',yaw),'x',pitch);
  const project=([x,y,z])=>[cx+x*scale*10/(10-z),cy+y*scale*10/(10-z)];
  const age=burst===null?0:(now-burst)/(reduced.matches?1:1100);
  const alpha=1-clamp(age,0,1),polys=[];
  for(const p of pieces){
    const selected=turn?.slice.has(p);
    let center=selected?rot(p.pos,turn.axis,angle):p.pos;
    if(age)center=center.map((v,i)=>v+p.velocity[i]*age*1.5);
    const orient=v=>view(age?rot(v,'x',p.spin*age):selected?rot(v,turn.axis,angle):v);
    const cv=view(center),verts=corners.map(v=>orient(v).map((n,i)=>n+cv[i])),screen=verts.map(project);
    faces.forEach((ids,i)=>{
      const n=orient(normals[i]);
      if(n[2]*(10-cv[2])-n[0]*cv[0]-n[1]*cv[1]<.001)return;
      const points=ids.map(j=>screen[j]);
      const inward=Math.max(0,-(n[0]*cv[0]+n[1]*cv[1]+n[2]*cv[2]));
      const power=clamp(inward*.70+.12*n[0]-.14*n[1]+.04,0,1);
      polys.push({points,z:ids.reduce((s,j)=>s+verts[j][2],0)/4,power,n});
    });
  }
  polys.sort((a,b)=>a.z-b.z);
  ctx.globalAlpha=1;ctx.fillStyle='#080f14';ctx.fillRect(0,0,width,height);
  const source=project(view([-.12,.08,.18])),[sx,sy]=source;
  // Use this frame's projected blocks as an occlusion mask for the light shafts.
  const span=scale*5.4,unit=224/span;
  light.setTransform(1,0,0,1,0,0);light.clearRect(0,0,224,224);
  light.setTransform(unit,0,0,unit,112-sx*unit,112-sy*unit);
  const glow=light.createRadialGradient(sx,sy,0,sx,sy,scale*2.35);
  glow.addColorStop(0,'#e0faff');glow.addColorStop(.39,'#8fdfff');glow.addColorStop(.74,'#4385ad');glow.addColorStop(1,'transparent');
  light.fillStyle=glow;light.fillRect(sx-span/2,sy-span/2,span,span);
  light.globalCompositeOperation='destination-out';light.fillStyle='#000';
  for(const f of polys){poly(light,f.points);light.fill();}
  light.globalCompositeOperation='source-over';
  ctx.globalCompositeOperation='lighter';
  for(let j=40;j>=0;j--){
    const t=j/40,w=span*(1+1.94*t*t);
    ctx.globalAlpha=alpha*(j===0?.76:.052*(1-.65*t))*(1+kick*.13);
    ctx.drawImage(mask,sx-w/2,sy-w/2,w,w);
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha;
  for(const {points,power,n} of polys){
    const x=points.reduce((s,v)=>s+v[0],0)/4,y=points.reduce((s,v)=>s+v[1],0)/4;
    const dx=sx-x,dy=sy-y,dist=Math.hypot(dx,dy)||1,reach=scale*.52;
    const g=ctx.createLinearGradient(x+dx/dist*reach,y+dy/dist*reach,x-dx/dist*reach,y-dy/dist*reach);
    const b=.10+.09*(1-Math.max(0,n[2]))+power*.84;
    g.addColorStop(0,'rgb('+Math.round(4+b*55)+','+Math.round(10+b*112)+','+Math.round(15+b*138)+')');
    g.addColorStop(1,'rgb(3,'+Math.round(6+b*40)+','+Math.round(10+b*53)+')');
    poly(ctx,points);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(147,216,244,'+(.16+.42*power)+')';ctx.lineWidth=.7;ctx.stroke();
  }
  // Light spilling out through the front, top and side channels also catches the rims.
  ctx.globalCompositeOperation='lighter';
  const lamps=[[-.5,.5,1.22],[-.5,-.5,1.15],[.5,-1.13,-.5],[1.2,.5,-.5]];
  lamps.forEach((v,i)=>{
    const active=turn && Math.abs(v[turn.axis==='x'?0:1]-turn.layer)<=.51;
    const pos=view(active?rot(v,turn.axis,angle):v);
    const [x,y]=project(pos),radius=scale*(1.13+i*.06);
    const g=ctx.createRadialGradient(x,y,0,x,y,radius);
    g.addColorStop(0,'rgba(140,225,255,.82)');
    g.addColorStop(.18,'rgba(80,184,234,.49)');
    g.addColorStop(.53,'rgba(40,130,184,.21)');
    g.addColorStop(1,'rgba(25,100,150,0)');
    ctx.globalAlpha=alpha*(.70+.15*Math.sin(time+i)+kick*.18);
    ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  });
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  if(age>.68){poster.classList.add('done');el('end').setAttribute('aria-hidden','false');el('replay').hidden=false;}
  if(age<1&&(!reduced.matches||turn||burst!==null))wake();
}
poster.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0||turn||step===4||e.target.closest('button'))return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY};poster.setPointerCapture(e.pointerId);
});
poster.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))>=28)move(Math.abs(dx)>Math.abs(dy)?(dx<0?'Left':'Right'):(dy<0?'Up':'Down'));
});
poster.addEventListener('pointercancel',()=>pointer=null);
document.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){e.preventDefault();if(!e.repeat)move(e.key.slice(5));}});
document.addEventListener('visibilitychange',wake);window.addEventListener('resize',resize);reduced.addEventListener('change',wake);
el('replay').onclick=reset;reset();resize();
