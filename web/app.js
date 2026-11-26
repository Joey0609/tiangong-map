import {createMap} from "./map.js";
import {createMission} from "./mission.js";
import {createObservation} from "./observation.js";
import {position,geodetic} from "./orbit.js";
import {$,angle,date,navigation,toast} from "./ui.js";

navigation();
const map=createMap(), missions=createMission(map.go);
let snapshot,mission,rows=[],pinned=null,version=0,busy=false;
const observation=createObservation(selectTime,()=>{tick();map.go(observation.site.lat,observation.site.lon);});
function selectTime(t){pinned=t;tick();}
function tick(){
  const now=Date.now(), t=pinned??now;
  $("clock").textContent=date(now,{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  if(!snapshot)return;
  const xyz=position(rows,t),point=xyz?geodetic(xyz):null;
  $("mode").textContent=!point?"星历范围外":pinned===null?"实时推算":t>=now?"预测预览":"历史回放";
  $("selected").textContent=date(t);$("timeline").value=t;
  $("lat").textContent=point?angle(point.lat,true):"—";
  $("lon").textContent=point?angle(point.lon,false):"—";
  $("height").textContent=point?point.height.toFixed(1)+" km":"—";
  observation.render(rows,t,xyz);
  const layers=missions.render(t,xyz);
  map.paint({rows,t,point,site:observation.site,mission,version,...layers});
}
async function getJSON(url){
  const r=await fetch(url,{cache:"no-cache"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.json();
}
async function sync(manual=false){
  if(busy)return;
  busy=true;$("refresh").disabled=true;
  try{
    if(manual&&["127.0.0.1","localhost"].includes(location.hostname)){
      const r=await fetch("api/refresh",{method:"POST"});
      if(!r.ok&&![404,501,405].includes(r.status))throw new Error("采集服务 "+r.status);
    }
    const [data,curated]=await Promise.all([getJSON("data/latest.json"),getJSON("data/mission.json")]);
    if(!data.orbit||!data.news||!data.notices||!Array.isArray(curated.stations))throw new Error("快照格式无效");
    if(data.updated!==snapshot?.updated||JSON.stringify(curated)!==JSON.stringify(mission)){
      snapshot=data;mission=curated;rows=data.orbit.data?.rows||[];version++;
      missions.set(data,curated);
      $("timeline").disabled=!rows.length;
      if(rows.length){const a=rows[0][0],b=rows.at(-1)[0];
        $("timeline").min=a;$("timeline").max=b;$("begin").textContent=date(a);$("end").textContent=date(b);
      }
    }
    tick();
    if(manual)toast("已读取最新快照 · "+date(data.updated));
  }catch(e){toast("同步失败 · "+e.message);if(!snapshot)$("mode").textContent="数据不可用";}
  finally{busy=false;$("refresh").disabled=false;}
}
$("timeline").oninput=e=>selectTime(Number(e.target.value));
$("nowBtn").onclick=()=>selectTime(null);
$("refresh").onclick=()=>sync(true);
for(const id of ["trackOn","siteOn","stationsOn","noticesOn"])$(id).onchange=tick;
setInterval(tick,1000);setInterval(sync,60000);sync();

