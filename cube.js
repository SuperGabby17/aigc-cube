'use strict';
const poster = document.getElementById('poster');
const canvas = document.getElementById('lightCube');
const ctx = canvas.getContext('2d');
const mask = document.createElement('canvas');
const light = mask.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const faces = [
  [0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]
];
const normals = [[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];
const corners = Array.from({length:8},(_,i)=>[(i&1)?1:-1,(i&2)?1:-1,(i&4)?1:-1].map(n=>n*.39));
let width,height,scale,cx,cy,pieces,step,basis,burst,pointer,handle,previous=0;
let hitFaces=[],projectWorld,twist=null,settle=null,poseTime=0;
let intro=true,assemblyStart=null,introStart=0;
const dots=[];
for(let i=0;i<15;i++)for(let j=0;j<15;j++)for(let k=0;k<15;k++){
  const indices=[i,j,k];
  dots.push({
    grid:indices.map(n=>(n-7)/5),
    solid:indices.map(n=>Math.floor(n/5)-1+(n%5-2)*.195)
  });
}
function assemble(){
  if(!intro||assemblyStart!==null)return;
  assemblyStart=performance.now();
  el('startCube').hidden=true;
  wake();
}
const axes=["x","y","z"];
const el = id=>document.getElementById(id);
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
function rot([x,y,z],axis,a){
  const c=Math.cos(a),s=Math.sin(a);
  if(axis==='z')return [x*c-y*s,x*s+y*c,z];
  return axis==='x'?[x,y*c-z*s,y*s+z*c]:[x*c+z*s,y,z*c-x*s];
}
function reset(){
  intro=true;assemblyStart=null;introStart=performance.now();poseTime=0;
  el('startCube').hidden=false;
  twist=null;settle=null;hitFaces=[];pieces=[];step=0;basis=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rot(rot(v,"y",-.48),"x",-.37));burst=null;pointer=null;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
    pieces.push({pos:[x,y,z],velocity:[x*2+Math.random()-.5,y*2+Math.random()-.5,z*1.8],spin:Math.random()*4-2});
  poster.classList.remove('done','burst');el('replay').hidden=true;el('end').setAttribute('aria-hidden','true');
  updateProgress();wake();
}
function updateProgress(){
  el('num').textContent='0'+Math.min(4,step+1);
  document.querySelectorAll('.tracks i').forEach((e,i)=>e.classList.toggle('on',i<step));
}
function containsPoint(points,x,y){
  let positive=false,negative=false;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
    if(cross>0)positive=true;
    if(cross<0)negative=true;
  }
  return !(positive&&negative);
}
function chooseLayer(hit,dx,dy){
  const center=hit.piece.pos.map((v,i)=>v+.39*hit.normal[i]);
  let best=null;
  axes.forEach((axis,index)=>{
    if(hit.normal[index])return;
    const a=projectWorld(rot(center,axis,-.01)),b=projectWorld(rot(center,axis,.01));
    const tx=b[0]-a[0],ty=b[1]-a[1],length=Math.hypot(tx,ty);
    if(length<.001)return;
    const tangent=[tx/length,ty/length];
    const score=Math.abs(dx*tangent[0]+dy*tangent[1]);
    if(!best||score>best.score)best={axis,index,layer:hit.piece.pos[index],tangent,score,angle:0};
  });
  return best;
}
function releaseLayer(commit){
  if(!twist){wake();return;}
  const end=commit?Math.sign(twist.angle)*Math.PI/2:0;
  settle={start:performance.now(),from:twist.angle,end};
  wake();
}
function advanceLayer(now){
  if(!settle)return;
  const t=clamp((now-settle.start)/(reduced.matches?1:160),0,1);
  twist.angle=settle.from+(settle.end-settle.from)*(1-(1-t)**3);
  if(t<1)return;
  const {axis,index,layer}=twist;
  const end=settle.end;
  if(end)for(const p of pieces){
    if(p.pos[index]===layer)p.pos=rot(p.pos,axis,end).map(Math.round);
  }
  settle=null;twist=null;
  if(end)finishDrag();
}
function finishDrag(){
  step++;
  updateProgress();
  if(step===4){burst=performance.now();poster.classList.add('burst');}
  wake();
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
function drawCore(x,y,amount){
  if(amount<.005)return;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(scale,scale);
  ctx.globalAlpha*=amount;
  const halo=ctx.createRadialGradient(0,0,.15,0,0,1.35);
  halo.addColorStop(0,'#c9fbff');halo.addColorStop(.36,'rgba(94,215,255,.85)');
  halo.addColorStop(1,'rgba(42,156,226,0)');
  ctx.fillStyle=halo;ctx.fillRect(-1.35,-1.35,2.7,2.7);
  const vertices=[[0,-.58],[.42,-.20],[.35,.27],[0,.55],[-.36,.22],[-.4,-.21]];
  const colors=['#ccfaff','#72dbff','#3996c7','#79d7f5','#b1f6ff','#f1ffff'];
  vertices.forEach((v,i)=>{
    poly(ctx,[[-.09,-.12],v,vertices[(i+1)%vertices.length]]);
    ctx.fillStyle=colors[i];ctx.fill();
  });
  ctx.restore();
}
// Each group of 5 x 5 x 5 points converges onto one of the 27 pieces.
function easeRange(value,start,end){
  const t=clamp((value-start)/(end-start),0,1);
  return t*t*(3-2*t);
}
function drawFluid(time,progress,project,view){
  const blend=easeRange(progress,0,.68);
  const visibility=1-easeRange(progress,.48,.98);
  const angle=time*.44+.34;
  const buckets=[[],[],[],[]];
  const floor=cy+scale*2.08;
  const tapAngle=assemblyStart===null||reduced.matches?angle:(assemblyStart-introStart)*.00044+.34;
  const angles=[1,.83,.67].map(factor=>{
    const anchor=tapAngle*factor;
    const phase=Math.atan2(Math.sin(anchor),Math.cos(anchor))+(angle-tapAngle)*factor;
    return phase*(1-blend);
  });
  for(const dot of dots){
    const grid=dot.grid.map((v,i)=>v+(dot.solid[i]-v)*blend);
    let [x,y,z]=rot(rot(rot(grid,'y',angles[0]),'z',angles[1]),'x',angles[2]);
    x+=(1-blend)*.26*Math.sin(time*1.6+y*1.45);
    y+=(1-blend)*.21*Math.cos(time*2.1+z*1.2);
    const aligned=view([x,y,z]);
    const position=[x,y,z].map((v,i)=>v+(aligned[i]-v)*blend);
    buckets[clamp(Math.floor((position[2]+2)*.95),0,3)].push(project(position));
  }
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  const haze=ctx.createRadialGradient(cx,cy,0,cx,cy,scale*2.55);
  haze.addColorStop(0,'rgba(62,164,214,.28)');haze.addColorStop(1,'rgba(30,100,150,0)');
  ctx.globalAlpha=visibility;ctx.fillStyle=haze;
  ctx.fillRect(cx-scale*2.55,cy-scale*2.55,scale*5.1,scale*5.1);
  buckets.forEach((points,i)=>{
    const size=Math.max(1,scale*(.014+.006*i));
    const opacity=visibility*(.18+.15*i);
    ctx.fillStyle=i<2?'#59bfe9':'#c1f2ff';
    ctx.globalAlpha=opacity;
    for(const [x,y] of points)ctx.fillRect(x,y,size,size);
    ctx.globalAlpha=opacity*.12;
    for(const [x,y] of points)ctx.fillRect(x,floor+(floor-y)*.4,size,size*.65);
  });
  ctx.restore();
}
function wake(){if(!handle&&!document.hidden)handle=requestAnimationFrame(frame);}
function frame(now){
  handle=0;
  if(!width)return;
  if(!reduced.matches&&now-previous<30){wake();return;}previous=now;
  const time=reduced.matches?0:now*.00065;
  advanceLayer(now);
  const progress=assemblyStart===null?0:clamp((now-assemblyStart)/(reduced.matches?220:1850),0,1);
  const surface=easeRange(progress,.54,.96);
  const outline=easeRange(progress,.38,.82);
  if(progress===1&&intro){intro=false;assemblyStart=null;}
  if(!pointer&&!twist)poseTime=time;
  const view=v=>{
    const point=[0,1,2].map(i=>v[0]*basis[0][i]+v[1]*basis[1][i]+v[2]*basis[2][i]);
    return rot(rot(point,'y',Math.sin(poseTime)*.115),'x',Math.sin(poseTime*.81)*.05);
  };
  const project=([x,y,z])=>[cx+x*scale*10/(10-z),cy+y*scale*10/(10-z)];
  projectWorld=v=>project(view(v));
  if(intro&&assemblyStart===null){
    ctx.fillStyle='#080f14';ctx.fillRect(0,0,width,height);
    drawFluid(reduced.matches?0:(now-introStart)/1000,0,project,view);
    if(!reduced.matches)wake();
    return;
  }
  const elapsed=burst===null?0:Math.max(0,now-burst);
  const chargeDuration=reduced.matches?0:650;
  const charge=burst===null?0:Math.min(1,elapsed/Math.max(1,chargeDuration));
  const age=burst===null?0:clamp((elapsed-chargeDuration)/(reduced.matches?1:1100),0,1);
  const opening=twist?Math.sin(2*Math.abs(twist.angle)):0;
  const exposure=Math.max(opening,charge)*(1-age);
  const coreView=view([.32,-.42,.84]);
  const [coreX,coreY]=project(coreView);
  const alpha=(1-clamp(age,0,1))*(intro?surface:1),polys=[],shadows=[];
  for(const p of pieces){
    const selected=twist&&p.pos[twist.index]===twist.layer;
    const turnVector=v=>selected?rot(v,twist.axis,twist.angle):v;
    let center=turnVector(p.pos);
    // The channels widen slightly at mid-turn, then close as the layer aligns.
    center=center.map(v=>v*(1+.23*opening+.09*charge));
    if(age)center=center.map((v,i)=>v+p.velocity[i]*age*1.5);
    const orient=v=>view(age?rot(v,'x',p.spin*age):turnVector(v));
    const cv=view(center),verts=corners.map(v=>orient(v).map((n,i)=>n+cv[i])),screen=verts.map(project);
    shadows.push(cv);
    faces.forEach((ids,i)=>{
      const n=orient(normals[i]);
      if(n[2]*(10-cv[2])-n[0]*cv[0]-n[1]*cv[1]<.001)return;
      const points=ids.map(j=>screen[j]);
      const inward=Math.max(0,-(n[0]*cv[0]+n[1]*cv[1]+n[2]*cv[2]));
      const power=clamp(inward*.70+.12*n[0]-.14*n[1]+.04,0,1);
      const distance=Math.hypot(...p.pos);
      const wave=charge?clamp(charge*3.7-distance,0,1):0;
      const rim=Math.max(wave,selected ? .68 : 0,pointer?.hit.piece===p?1:0);
      polys.push({rim,piece:p,normal:normals[i],points,z:ids.reduce((s,j)=>s+verts[j][2],0)/4,power,n});
    });
  }
  polys.sort((a,b)=>a.z-b.z);
  hitFaces=polys;
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
    ctx.globalAlpha=alpha*(j===0?.76:.052*(1-.65*t));
    ctx.drawImage(mask,sx-w/2,sy-w/2,w,w);
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha;
  // The low side light casts each block onto the same ground plane.
  ctx.save();
  ctx.translate(cx,cy+scale*2.30);
  ctx.scale(scale,scale*.24);
  for(const [x,y,z] of shadows){
    const heightAboveGround=Math.max(0,2.3-y);
    const px=x+.32*heightAboveGround,py=-z+.18*heightAboveGround;
    const radius=.74+.16*heightAboveGround;
    const shade=ctx.createRadialGradient(px,py,0,px,py,radius);
    shade.addColorStop(0,'rgba(0,3,6,.42)');shade.addColorStop(1,'rgba(0,3,6,0)');
    ctx.fillStyle=shade;ctx.fillRect(px-radius,py-radius,2*radius,2*radius);
  }
  ctx.restore();
  // Reflect the visible faces across the floor and fade the distant ones.
  ctx.save();
  const floor=cy+scale*2.08;
  ctx.translate(0,floor*1.40);
  ctx.scale(1,-.40);
  ctx.globalAlpha=.24*alpha;
  drawCore(coreX,coreY,exposure);
  for(const face of polys){
    const y=face.points.reduce((sum,p)=>sum+p[1],0)/face.points.length;
    ctx.globalAlpha=alpha*.15*clamp(1-(floor-y)/(4.2*scale),0,1);
    poly(ctx,face.points);
    ctx.fillStyle=face.power>.35?'#56869b':'#263e4c';
    ctx.fill();ctx.strokeStyle='#75b9d5';ctx.lineWidth=.8+face.rim;ctx.stroke();
  }
  ctx.restore();
  let coreDrawn=false;
  for(const {points,power,n,rim,z} of polys){
    if(!coreDrawn&&z>=coreView[2]){
      // Nearer blocks occlude the crystal; the openings expose it while dragging.
      drawCore(coreX,coreY,exposure);
      coreDrawn=true;
    }
    const x=points.reduce((s,v)=>s+v[0],0)/4,y=points.reduce((s,v)=>s+v[1],0)/4;
    const dx=sx-x,dy=sy-y,dist=Math.hypot(dx,dy)||1,reach=scale*.52;
    const g=ctx.createLinearGradient(x+dx/dist*reach,y+dy/dist*reach,x-dx/dist*reach,y-dy/dist*reach);
    const b=.10+.09*(1-Math.max(0,n[2]))+power*.84;
    g.addColorStop(0,'rgb('+Math.round(4+b*55)+','+Math.round(10+b*112)+','+Math.round(15+b*138)+')');
    g.addColorStop(1,'rgb(3,'+Math.round(6+b*40)+','+Math.round(10+b*53)+')');
    ctx.globalAlpha=alpha;poly(ctx,points);ctx.fillStyle=g;ctx.fill();
    ctx.globalAlpha=intro?outline:alpha;ctx.strokeStyle='rgba(147,216,244,'+(.16+.42*power)+')';ctx.lineWidth=.7;ctx.stroke();
    if(rim){
      ctx.strokeStyle='rgba(142,226,255,'+(.85*rim)+')';
      ctx.lineWidth=.8+rim;ctx.stroke();
    }
  }
  // Light spilling out through the front, top and side channels also catches the rims.
  ctx.globalCompositeOperation='lighter';
  const lamps=[[-.5,.5,1.22],[-.5,-.5,1.15],[.5,-1.13,-.5],[1.2,.5,-.5]];
  lamps.forEach((v,i)=>{
    const pos=view(v);
    const [x,y]=project(pos),radius=scale*(1.13+i*.06);
    const g=ctx.createRadialGradient(x,y,0,x,y,radius);
    g.addColorStop(0,'rgba(140,225,255,.82)');
    g.addColorStop(.18,'rgba(80,184,234,.49)');
    g.addColorStop(.53,'rgba(40,130,184,.21)');
    g.addColorStop(1,'rgba(25,100,150,0)');
    ctx.globalAlpha=alpha*(.70+.15*Math.sin(time+i));
    ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  });
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  if(intro){
    const secondsSinceTap=Math.max(0,now-assemblyStart)/1000;
    const phaseAtTap=(assemblyStart-introStart)/1000;
    const elapsedSeconds=reduced.matches?0:phaseAtTap+.34*(1-Math.exp(-secondsSinceTap/.34));
    drawFluid(elapsedSeconds,progress,project,view);
  }
  if(age>.68){poster.classList.add('done');el('end').setAttribute('aria-hidden','false');el('replay').hidden=false;}
  if(age<1&&(!reduced.matches||assemblyStart!==null||settle||burst!==null))wake();
}
poster.addEventListener('pointerdown',e=>{
  if(intro||!e.isPrimary||e.button!==0||pointer||settle||step===4||e.target.closest('button'))return;
  const bounds=canvas.getBoundingClientRect();
  const x=e.clientX-bounds.left,y=e.clientY-bounds.top;
  for(let i=hitFaces.length-1;i>=0;i--){
    const hit=hitFaces[i];
    if(!containsPoint(hit.points,x,y))continue;
    pointer={id:e.pointerId,startX:e.clientX,startY:e.clientY,hit};
    poster.setPointerCapture(e.pointerId);wake();
    break;
  }
});
function trackPointer(e){
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.startX,dy=e.clientY-pointer.startY;
  if(twist&&Math.hypot(dx,dy)<4){twist=null;wake();}
  if(!twist&&Math.hypot(dx,dy)>=4)twist=chooseLayer(pointer.hit,dx,dy);
  if(!twist)return;
  const travel=dx*twist.tangent[0]+dy*twist.tangent[1];
  twist.angle=clamp(travel/scale,-1.5,1.5)*Math.PI/3;
  wake();
}
poster.addEventListener('pointermove',trackPointer);
poster.addEventListener('pointerup',e=>{
  if(pointer?.id!==e.pointerId)return;
  trackPointer(e);pointer=null;
  releaseLayer(twist&&Math.abs(twist.angle)>=Math.PI/7);
});
function cancelPointer(e){
  if(pointer?.id!==e.pointerId)return;
  pointer=null;releaseLayer(false);
}
poster.addEventListener('pointercancel',cancelPointer);
poster.addEventListener('lostpointercapture',cancelPointer);
const arrows={ArrowLeft:['y',-1],ArrowRight:['y',1],ArrowUp:['x',1],ArrowDown:['x',-1]};
document.addEventListener('keydown',e=>{
  const direction=arrows[e.key];
  if(intro||!direction||step===4||pointer||settle)return;
  e.preventDefault();
  if(!e.repeat){
    const [axis,sign]=direction;
    twist={axis,index:axes.indexOf(axis),layer:0,angle:sign*.001};
    releaseLayer(true);
  }
});
document.addEventListener('visibilitychange',wake);window.addEventListener('resize',resize);reduced.addEventListener('change',wake);
el('startCube').onclick=assemble;
el('replay').onclick=reset;reset();resize();
