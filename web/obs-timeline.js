// Feed the original Rocket Mission Control renderer. Offsetting the display origin
// equally for nodes and cursor selects its fully deployed arc without shifting events.
const base=300;
const timeLabel=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const short=new Map([['返回指令、轨返分离','轨返分离'],['返回制动开机','制动点火'],['推返分离已完成','推返分离'],['距地面约6公里，抛防热大底','抛防热大底']]);
export function label(name,at){return `${timeLabel.format(at)} ${short.get(name)||name}`}
export function createAxis(mountEl){
 const axis=new MissionTimeline.TimelineRenderer({mountEl,svgHeight:200,missionDuration:3060});
 let previous=null;
 function cursor(t,force=false){const sec=Math.floor(t)+base;if(!force && sec===previous)return;previous=sec;axis.setCurrentTimeOffset(sec);axis.render()}
 function events(list){axis.setEvents(list.map(e=>({...e,time:e.time+base})));previous=null}
 cursor(0,true);return {cursor,events};
}
export function liveRecords(m,now){
 const sep=m.confirmedSeparation;
 const items=[...(m.returnEvents||[]),...(sep?[{...sep,name:'船站分离'}]:[])];
 return items.filter(e=>typeof e.name==='string'&&/^https:\/\//.test(e.url)&&/(?:Z|[+-]\d\d:\d\d)$/.test(e.at)&&Number.isFinite(Date.parse(e.at))&&Date.parse(e.published)<=now&&(Date.parse(e.at)<=now||e.status==='scheduled')).map(e=>({name:(e.status==='scheduled'?'预计·':'')+e.name,at:Date.parse(e.at)})).sort((a,b)=>a.at-b.at);
}
