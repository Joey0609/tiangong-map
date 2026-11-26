import {DAY,passes,observer} from "./orbit.js";
import {$,angle,date,hm,esc,dialog,toast} from "./ui.js";
const key="tiangong.observer.v1";
const fallback={name:"北京",lat:39.90,lon:116.40,alt:50,mask:10};
function valid(s){return s&&typeof s.name==="string"&&s.name.trim()&&
  [["lat",-90,90],["lon",-180,180],["alt",-500,10000],["mask",0,89]].every(([k,min,max])=>Number.isFinite(s[k])&&s[k]>=min&&s[k]<=max);}
export function createObservation(preview,onChange){
  let site=fallback,list=[],cached="",lastRows=null;
  try{const saved=JSON.parse(localStorage.getItem(key));if(valid(saved))site=saved;}catch{}
  const form=$("siteForm");
  $("edit").onclick=()=>{for(const [k,v] of Object.entries(site))form.elements[k].value=v;$("editor").showModal();};
  form.onsubmit=e=>{
    e.preventDefault();
    const data=new FormData(form), s={name:data.get("name").trim()};
    for(const k of ["lat","lon","alt","mask"])s[k]=Number(data.get(k));
    if(!valid(s))return toast("请填写有效观测点");
    site=s;cached="";$("editor").close();
    try{localStorage.setItem(key,JSON.stringify(s));}catch{toast("当前浏览器仅临时保存位置");}
    onChange();
  };
  function passHTML(p){
    return '<div class="pass"><div><b>'+date(p.start)+' – '+hm(p.end)+'</b><small>最高 '+p.el.toFixed(1)+'°'+(p.openStart||p.openEnd?" · 窗口截断":"")+'</small></div><button data-peak="'+p.peak+'">预览</button></div>';
  }
  function bind(parent){parent.querySelectorAll("[data-peak]").forEach(b=>b.onclick=()=>{if($("details").open)$("details").close();preview(+b.dataset.peak);});}
  $("allPass").onclick=()=>{dialog(esc(site.name)+" · 预计过境",list.map(passHTML).join("")||"预测范围内无过境");bind($("detailBody"));};
  function render(rows,t,p){
    $("siteName").textContent=site.name;$("coords").textContent=angle(site.lat,true)+"  "+angle(site.lon,false)+"  ·  "+site.alt+" m";
    const a=p?observer(site)(p):null;
    $("el").textContent=a?a.el.toFixed(1)+"°":"—";$("az").textContent=a?a.az.toFixed(1)+"°":"—";$("range").textContent=a?Math.round(a.range)+" km":"—";
    const visible=a&&a.el>=site.mask;
    $("visible").textContent=a?(visible?"几何可见":"低于门限"):"无星历";$("visible").classList.toggle("on",!!visible);
    const target=Math.floor(t/60000);
    if(cached!==target||rows!==lastRows){
      cached=target;lastRows=rows;
      list=passes(rows,site,t, t+7*DAY);
      $("passList").innerHTML=list.slice(0,3).map(passHTML).join("")||'<small>星历覆盖内无预计过境</small>';
      $("mask").textContent="最低仰角 "+site.mask+"°"+(rows.length?" · 预报至 "+date(Math.min(t+7*DAY,rows.at(-1)[0])):"");
      bind($("passList"));
    }
  }
  return {render,get site(){return site;}};
}

