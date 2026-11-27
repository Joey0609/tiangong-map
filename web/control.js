import {returnScenario} from './return-scenario.js';
import {landingRange} from './return-timing.js';
import {liveRecords} from './obs-timeline.js';
const $=id=>document.getElementById(id);
const fmt=(t,options)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',...options}).format(t);
const load=async url=>{const r=await fetch(url);if(!r.ok)throw Error(r.status);return r};
async function brief(){
 const m=await (await load('data/mission.json')).json(), now=Date.now(), day=86400000;
 const snap=await fetch('data/latest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
 const scenario=returnScenario(m,snap?.notices?.data?.items,now);
 const stages=['船站分离','轨返分离','制动点火','推返分离','进入黑障','离开黑障','主伞打开','着陆'];
 const records=liveRecords(m,now), grid=$('currentEvents');grid.replaceChildren();
 for(const name of new Set([...stages,...records.map(r=>r.name.replace(/^预计·/,''))])){const hit=records.filter(r=>r.name.replace(/^预计·/,'')===name).at(-1),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=hit?(hit.name.startsWith('预计·')?'预计 ':'')+fmt(hit.at,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):scenario?.stages[name]?'情景推算 · '+scenario.stages[name]:'待公布';grid.append(dt,dd)}
 const offsets=m.history.map(h=>Date.parse(h.landing)-Date.parse(h.arrival));
 const start=Date.parse(m.arrival+'T00:00:00+08:00'), low=start+Math.min(...offsets), high=start+Math.max(...offsets);
 const range=landingRange(m.confirmedSeparation,m.returnFlights||[],now);
 if(m.officialReturn && Date.parse(m.officialReturn.published)<=now){$('window').textContent=m.officialReturn.label;$('basis').textContent='官方返回安排'}
 else if(range){$('window').textContent=[range.from,range.to].map(t=>fmt(t,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})).join(' – ');$('basis').textContent='公开撤离时刻 · 历史时长类比'}
 else if(scenario){$('window').textContent=scenario.landing;$('basis').textContent='着陆情景推算 · 假设 A6096/26 用于本次回收且着陆发生在限制窗口内；关联尚未证实'}
 else if(now<high+day && offsets.length){$('window').textContent=[low,high].map(t=>fmt(t,{month:'long',day:'numeric'})).join(' – ');$('basis').textContent=`日期参考 · ${offsets.length} 次历史轮换`}
 else {$('window').textContent='等待官方返回安排';$('basis').textContent='历史窗口已过'}
}
brief().catch(()=>{$('window').textContent='返回窗口暂不可用'});
async function replay(){
 const csv=await (await load('historical/return-profile.csv')).text(), rows={A:[],B:[]};
 for(const line of csv.trim().split(/\r?\n/).slice(1)){
  const [clock,i,event,,m,h,v,x]=line.split(','); if(!rows[m])throw Error('profile');
  rows[m].push({clock:clock.slice(11,19),i:+i,event:event||rows[m].at(-1)?.event,h:+h,v:+v,x:+x});
 }
 for(const a of Object.values(rows))if(a.length!==3061||a.some((r,i)=>r.i!==i||![r.h,r.v,r.x].every(Number.isFinite)))throw Error('profile');
 const gauge=(id,label,unit,maxValue,fractionDigits)=>new window.MissionTelemetry.Gauge({mountEl:$(id),label,unit,maxValue,fractionDigits});
 const v=gauge('speed','模拟速度','m/s',8000,0), h=gauge('height','模拟高度','km',400,2);
 let origin=0, anchor=0, running=false, rate=1, played=-1;
 const end=rows.A.length-1, path=$('sphere').querySelector('path[stroke-dasharray]');
 // Orthographic view in a local frame; no Earth-fixed longitude or azimuth.
 function project(r, total){const R=6371, angle=(r.x-total/2)/R, radius=103*(1+r.h/R);return [radius*Math.sin(angle),-0.28*radius*Math.cos(angle)]}
 const geometry=Object.fromEntries(Object.entries(rows).map(([key,a])=>[key,a.filter((_,i)=>i%15===0).map(r=>project(r,a[end].x))]));
 const line=pts=>pts.map(([x,y],j)=>(j?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ');
 function elapsed(){return origin+(running?(performance.now()-anchor)*rate/1000:0)}
 function rebase(s){origin=Math.max(0,Math.min(end,s));anchor=performance.now()}
 function draw(force=false){
  let pos=elapsed(); if(pos>=end && running){if($('loop').checked){rebase(pos%(end+1));pos=origin}else{running=false;rebase(end);pos=end}}
  const i=Math.min(end,Math.floor(pos));$('play').textContent=running?'暂停':i===end?'重播':'播放';
  if(!force && played===i)return;played=i;
  const key=$('model').value,a=rows[key],r=a[i],p=project(r,a[end].x),points=geometry[key];
  if(force)path.setAttribute('d',line(points));
  $('dot').setAttribute('cx',p[0]);$('dot').setAttribute('cy',p[1]);$('trail').setAttribute('d',line([...points.slice(0,Math.floor(i/15)+1),p]));
  v.setValue(r.v);h.setValue(r.h);$('distance').textContent=r.x.toFixed(1);$('clock').textContent=r.clock;$('phase').textContent=r.event;
  $('seek').value=i;if(document.activeElement!==$('second')||force)$('second').value=i;
 }
 function syncObs(){const state=JSON.stringify({s:Math.min(end,elapsed()),at:Date.now(),rate,run:running,loop:$('loop').checked,m:$('model').value});$('obsReplay').href='obs.html?mode=replay&state='+encodeURIComponent(state);try{localStorage.setItem('tiangong:obs-replay:v1',state)}catch{}}
 function seek(s){if(Number.isFinite(s)){rebase(Math.round(s));draw(true);syncObs()}}
 $('obsReplay').addEventListener('pointerdown',syncObs);$('controls').addEventListener('click',syncObs);$('controls').addEventListener('change',syncObs);$('model').addEventListener('change',syncObs);syncObs();
 $('play').onclick=()=>{const t=elapsed();running=!running;rebase(running&&t>=end?0:t);draw(true)};
 $('seek').oninput=e=>seek(e.target.valueAsNumber);$('second').onchange=e=>seek(e.target.valueAsNumber);$('second').onblur=()=>draw(true);
 $('rate').onchange=e=>{rebase(elapsed());rate=+e.target.value};$('model').onchange=()=>draw(true);
 $('controls').disabled=false;draw(true);setInterval(()=>{if(running&&!document.hidden)draw()},100);document.addEventListener('visibilitychange',()=>{if(!document.hidden)draw(true)});
}
$('archive').addEventListener('toggle',function startArchive(){if(!this.open)return;this.removeEventListener('toggle',startArchive);replay().catch(()=>{$('status').textContent='仿真数据读取失败，请稍后刷新。'})});
