import {durationMinutes} from './return-timing.js';
// Editorial, hour-scale planning bands. The NOTAM identifies restricted airspace;
// association with a recovery operation and touchdown within it are assumptions.
const H=3600000, minute=60000;
const clock=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'});
const band=(a,b)=>{const lo=Math.floor(a/H)*H,hi=Math.ceil(b/H)*H;return `${date.format(lo)} ${clock.format(lo)}–${date.format(lo)===date.format(hi)?'':date.format(hi)+' '}${clock.format(hi)}`};
export function returnScenario(m,items,now){
 if(m.name!=='神舟二十三号'||m.officialReturn||m.confirmedSeparation||m.returnEvents?.length)return null;
 const n=items?.find(x=>x.id==='ZLHW_I_ZBBBYNYX_A6096_26'&&x.code==='A6096/26');
 if(!n||/\bNOTAMC\b/i.test(n.text||''))return null;
 const [a,b]=n.period||[]; if(![a,b,now].every(Number.isFinite)||a>=b||now>=b)return null;
 const ds=(m.returnFlights||[]).map(durationMinutes).filter(Number.isFinite);if(!ds.length)return null;
 const separation=band(a-Math.max(...ds)*minute,b-Math.min(...ds)*minute);
 // Last-hour group uses a broad historical terminal-phase duration, not a per-phase clock.
 // Historical SZ12 event sheet: command at 12:43, ignition reported at 12:45,
 // touchdown at 13:34. Reuse only the broad 45–55 minute lead for this group.
 const braking=band(a-55*minute,b-45*minute),terminal=band(a-H,b),landing=band(a,b);
 return {landing,stages:{'船站分离':separation,'轨返分离':braking,'制动点火':braking,'推返分离':terminal,'进入黑障':terminal,'离开黑障':terminal,'主伞打开':terminal,'着陆':landing}};
}
