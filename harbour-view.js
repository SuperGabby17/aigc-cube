'use strict';
const stage=document.getElementById('stage'), photo=document.getElementById('photo'), person=document.getElementById('person');
const slider=document.getElementById('zoom'), hint=document.getElementById('hint');
const MAX=17, subject=[.473,.652], points=new Map();
let zoom=1, shiftX=0, shiftY=0, frame=0, lastTap=null, down=null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function layout(){
 const w=stage.clientWidth,h=stage.clientHeight,base=Math.max(w/736,h/1100);
 const streetZoom=1+3.4*Math.log1p((zoom-1)/3.4);
 const iw=736*base*streetZoom, ih=1100*base*streetZoom;
 const blend=1-1/zoom,guide=clamp((zoom-5)/12,0,1);
 const px=clamp((w-iw)/2+( .5-subject[0])*iw*blend+shiftX*(1-guide),w-iw,0);
 const initialFoot=h/2+(subject[1]-.5)*1100*base;
 const py=clamp(initialFoot+(.79*h-initialFoot)*blend-subject[1]*ih+shiftY*(1-guide),h-ih,0);
 photo.style.width=736*base+'px';photo.style.height=1100*base+'px';photo.style.transform='translate('+px+'px,'+py+'px) scale('+streetZoom+')';
 photo.style.filter='blur('+((zoom-1)*.06)+'px)';
 const footX=px+subject[0]*iw,footY=py+subject[1]*ih;
 const height=Math.min(base*1100*.041,h*.039)*zoom;
 person.style.transform='translate('+(footX-140)+'px,'+(footY-384)+'px) scale('+height/400+')';
 slider.value=100*Math.log(zoom)/Math.log(MAX);window.dispatchEvent(new Event('harbourzoom'));
 document.getElementById('ratio').textContent=zoom.toFixed(1)+'×';
 document.getElementById('less').disabled=zoom<=1.001;document.getElementById('more').disabled=zoom>=MAX-.001;
 const label=zoom>=14?'这束花，送给你':zoom>3?'再靠近一点，看看她手里的花':'双指放大，寻找街角的花束';
 if(hint.textContent!==label)hint.textContent=label;
}
function setZoom(value){zoom=clamp(value,1,MAX);if(zoom===1){shiftX=0;shiftY=0}layout()}
function glide(value){
 cancelAnimationFrame(frame);const start=zoom,end=clamp(value,1,MAX),now=performance.now();
 function tick(t){const k=clamp((t-now)/360,0,1);setZoom(start*(end/start)**(1-(1-k)**3));if(k<1)frame=requestAnimationFrame(tick)}
 frame=requestAnimationFrame(tick);
}
function pair(){const [a,b]=points.values();return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)}}
stage.onpointerdown=e=>{
 if(e.button!==0)return;cancelAnimationFrame(frame);stage.setPointerCapture(e.pointerId);
 points.set(e.pointerId,{x:e.clientX,y:e.clientY});down=points.size===1?{x:e.clientX,y:e.clientY,t:performance.now()}:null;
};
stage.onpointermove=e=>{
 const old=points.get(e.pointerId);if(!old)return;
 const before=points.size===2?pair():null;
 points.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(before){const after=pair();shiftX+=after.x-before.x;shiftY+=after.y-before.y;setZoom(zoom*after.d/Math.max(1,before.d));}
 else if(points.size===1&&zoom>1){shiftX=clamp(shiftX+e.clientX-old.x,-stage.clientWidth*zoom/2,stage.clientWidth*zoom/2);shiftY=clamp(shiftY+e.clientY-old.y,-stage.clientHeight*zoom/2,stage.clientHeight*zoom/2);layout()}
};
stage.onpointerup=e=>{
 if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<10&&performance.now()-down.t<280){
  if(lastTap&&performance.now()-lastTap.t<350&&Math.hypot(lastTap.x-e.clientX,lastTap.y-e.clientY)<35){glide(zoom>=16?1:zoom*2.3);lastTap=null}
  else lastTap={x:e.clientX,y:e.clientY,t:performance.now()};
 }
 points.delete(e.pointerId);down=null;
};
stage.onpointercancel=stage.onlostpointercapture=e=>{points.delete(e.pointerId);down=null};
stage.addEventListener('wheel',e=>{e.preventDefault();cancelAnimationFrame(frame);setZoom(zoom*Math.exp(-e.deltaY*.0025))},{passive:false});
slider.oninput=()=>{cancelAnimationFrame(frame);setZoom(MAX**(slider.value/100))};
document.getElementById('less').onclick=()=>glide(zoom/1.85);document.getElementById('more').onclick=()=>glide(zoom*1.85);
window.addEventListener('resize',layout);layout();
