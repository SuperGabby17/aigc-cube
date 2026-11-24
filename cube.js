const $ = id => document.getElementById(id);
const poster = $('poster'), world = $('world'), replay = $('replay');
const moves = [
  {key:'Left', label:'左', arrow:'←', axis:'y', layer:0, angle:-90},
  {key:'Down', label:'下', arrow:'↓', axis:'x', layer:1, angle:-90},
  {key:'Right', label:'右', arrow:'→', axis:'y', layer:-1, angle:90},
  {key:'Up', label:'上', arrow:'↑', axis:'x', layer:0, angle:90}
];
let pieces = [], step = 0, busy = false, pointer = null;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function place(p) {
  return 'translate3d(calc(var(--s) * '+p.x+'),calc(var(--s) * '+p.y+'),calc(var(--s) * '+p.z+'))';
}
function rotation(axis, degrees) {
  return new DOMMatrix().rotateAxisAngle(+(axis==='x'), +(axis==='y'), 0, degrees);
}
function draw(p) {
  // Rotate the translated cubie about the shared centre of its slice.
  p.el.style.transform = p.matrix.toString()+' '+place(p);
}
function build() {
  world.replaceChildren(); pieces = [];
  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++) {
    if(!x&&!y&&!z) continue;
    const el=document.createElement('div'), p={x,y,z,el,matrix:new DOMMatrix()};
    el.className='piece'; world.append(el); pieces.push(p);
    const sides=[
      [z===1,'rotateY(0deg)',x+1,y+1], [x===1,'rotateY(90deg)',4-z,y+1],
      [y===-1,'rotateX(90deg)',7+x,1+z], [z===-1,'rotateY(180deg)',1-x,1+y],
      [x===-1,'rotateY(-90deg)',4+z,1+y], [y===1,'rotateX(-90deg)',7+x,1-z]
    ];
    for(const [outer,ang,col,row] of sides) {
      const f=document.createElement('div'); f.className='face';
      f.style.transform=ang+' translateZ(calc(var(--s) * .5))';
      if(outer){f.style.backgroundImage='url(architecture.webp)'; f.style.backgroundPosition=(col*12.5)+'% '+(row*50)+'%';}
      el.append(f);
    }
    draw(p);
  }
}
function promptMove() {
  $('num').textContent=String(Math.min(4,step+1)).padStart(2,'0');
  document.querySelectorAll('.tracks i').forEach((e,i)=>e.classList.toggle('on',i<step));
  if(step<4){
    const current = moves[step];
    poster.dataset.direction = current.key;
    $('label').textContent = '向'+current.label+'滑动';
    document.querySelector('.arrow').textContent = current.arrow;
  }
}
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function shatter() {
  poster.classList.add('burst');document.querySelector('.hint').hidden=true;
  for(const p of pieces){
    for(const f of p.el.children){
      const base=f.style.transform;
      const fly=base+' translateZ('+ (180+Math.random()*340)+'px) rotateX('+(Math.random()*220-110)+'deg) rotateZ('+(Math.random()*250-125)+'deg)';
      f.animate([{transform:base,opacity:1},{transform:fly,opacity:0}],{duration:reduced()?1:1050,easing:'cubic-bezier(.2,.55,.4,1)',fill:'forwards'});
    }
  }
  await wait(reduced()?5:700);poster.classList.add('done');$('end').setAttribute('aria-hidden','false');replay.hidden=false;
}
async function move(key){
  if(busy||step===4)return;
  const m=moves[step];
  if(key!==m.key){$('label').textContent='请向'+m.label+'滑动';return;}
  busy=true; const turn=rotation(m.axis,m.angle);
  for(const p of pieces){
    const pos=p.matrix.transformPoint(new DOMPoint(p.x,p.y,p.z));
    if(Math.round(pos[m.axis])!==m.layer)continue;
    p.matrix=turn.multiply(p.matrix); draw(p);
  }
  await wait(reduced()?5:690);step++;promptMove();
  if(step===4) await shatter(); else busy=false;
}
poster.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0||busy||e.target.closest('button'))return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY};poster.setPointerCapture(e.pointerId);
});
poster.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;
  move(Math.abs(dx)>Math.abs(dy)?(dx<0?'Left':'Right'):(dy<0?'Up':'Down'));
});
poster.addEventListener('pointercancel',()=>pointer=null);
document.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){e.preventDefault();if(!e.repeat)move(e.key.slice(5));}});
function reset(){step=0;busy=false;pointer=null;poster.classList.remove('burst','done');$('end').setAttribute('aria-hidden','true');replay.hidden=true;document.querySelector('.hint').hidden=false;build();promptMove();}
replay.onclick=reset;reset();
