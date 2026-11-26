import {basemap} from "./basemap.js";
import {position,geodetic,observer} from "./orbit.js";
import {$,esc,toast} from "./ui.js";

export function createMap(){
  const map=L.map("map",{zoomControl:false,zoomSnap:0.1,minZoom:1,maxZoom:8,
    maxBounds:[[-82,-360],[82,360]],maxBoundsViscosity:1,preferCanvas:true});
  map.attributionControl.setPrefix(false);map.attributionControl.addAttribution("Natural Earth · Leaflet");
  map.createPane("fallback");map.getPane("fallback").style.zIndex=180;map.getPane("fallback").style.pointerEvents="none";
  const land=L.layerGroup().addTo(map), grid=L.layerGroup().addTo(map), paths=L.layerGroup().addTo(map);
  const pins=L.layerGroup().addTo(map), areas=L.layerGroup().addTo(map);
  const connect=L.layerGroup().addTo(map);
  const marker=L.marker([0,0],{icon:L.divIcon({className:"sat-icon",html:'<i class="spacecraft"></i>',iconSize:[36,30]}),zIndexOffset:800})
    .bindTooltip("天宫空间站",{permanent:true,direction:"right",offset:[10,0]});
  let theme="vector";
  const landStyle=()=>theme==="vector"?{color:"#b6c6c1",weight:.7,fillColor:"#e7ecdf",fillOpacity:1}:{color:"#577172",weight:.7,fillColor:"#304d50",fillOpacity:1};
  let latest=null, pathKey="",pinKey="",noticeKey="",lastOrbit=null,initial=true;
  function world(){
    const z=Math.max(1.1,Math.min(3.35,Math.log2(map.getSize().x/256)+0.05));
    map.setView([12,32],z);
  }
  world();
  basemap(map,m=>{theme=m;pathKey="";land.eachLayer(l=>l.setStyle(landStyle()));});
  fetch("vendor/world.json").then(r=>r.json()).then(d=>{
    for(const off of [-360,0,360]){
      L.geoJSON(d,{coordsToLatLng:c=>L.latLng(c[1],c[0]+off),pane:"fallback",style:landStyle(),interactive:false}).addTo(land);
    }
    land.eachLayer(x=>x.bringToBack());
  }).catch(()=>toast("底图读取失败"));
  const faint={pane:"fallback",color:"#758d92",weight:0.6,opacity:.24,interactive:false};
  for(let x=-540;x<=540;x+=30)L.polyline([[-80,x],[80,x]],faint).addTo(grid);
  for(let y=-75;y<=75;y+=15)L.polyline([[y,-540],[y,540]],faint).addTo(grid);
  for(const off of [-360,0,360])for(const [lat,lon,name] of [[48,81,"亚 洲"],[54,20,"欧 洲"],[3,21,"非 洲"],[-24,135,"大 洋 洲"],[48,-103,"北 美 洲"],[-12,-59,"南 美 洲"],[5,-145,"太 平 洋"],[-17,76,"印 度 洋"],[19,-38,"大 西 洋"]]){
    L.marker([lat,lon+off],{pane:"fallback",interactive:false,keyboard:false,zIndexOffset:-100,icon:L.divIcon({className:"map-label",html:name,iconSize:[84,20]})}).addTo(grid);
  }
  const near=(lon,ref)=>lon+360*Math.round((ref-lon)/360);
  function dot(lat,lon,title,station){
    return L.marker([lat,near(lon,map.getCenter().lng)],{icon:L.divIcon({className:"dot "+(station?"station-dot":""),iconSize:station?[8,8]:[12,12]})}).bindTooltip(esc(title)).addTo(pins);
  }
  function track(rows,time,minutes,style){
    let coords=[],lastLon;const paint=()=>{
      if(coords.length>1)for(const off of [-360,0,360])L.polyline(coords.map(([y,x])=>[y,x+off]),{...style,interactive:false}).addTo(paths);
      coords=[];lastLon=undefined;
    };
    const first=minutes<0?time+minutes*60000:time, end=minutes<0?time:time+minutes*60000;
    for(let t=first;t<=end;t+=30000){
      const p=position(rows,t);if(!p){paint();continue;}
      const g=geodetic(p), lon=near(g.lon,lastLon??g.lon);coords.push([g.lat,lon]);lastLon=lon;
    }
    paint();
  }
  function paint({rows,t,point,site,mission,notices,activeContacts,version}){
    latest=point;
    const center=map.getCenter().lng, lng=point?near(point.lon,center):0;
    if(initial&&point){
      initial=false;map.panTo([9,near(point.lon,0)+ (map.getSize().x>700?25:0)],{animate:false});
    }
    if(point)marker.setLatLng([point.lat,near(point.lon,map.getCenter().lng)]).addTo(map);else marker.remove();
    if(rows!==lastOrbit){lastOrbit=rows;pathKey="";}
    const key=[Math.floor(t/30000),$("trackOn").checked,theme].join();
    if(key!==pathKey){
      pathKey=key;paths.clearLayers();if($("trackOn").checked&&point){
        track(rows,t,-93,{color:theme==="vector"?"#087259":"#a1e4b7",weight:2.7,opacity:.9});
        track(rows,t,93,{color:theme==="vector"?"#ab4e13":"#f1c581",weight:2.5,dashArray:"5 7",opacity:.95});
      }
    }
    const pkey=JSON.stringify([site,version,Math.round(center/90),$("siteOn").checked,$("stationsOn").checked]);
    if(pkey!==pinKey){
      pinKey=pkey;pins.clearLayers();
      if($("siteOn").checked)dot(site.lat,site.lon,site.name,false).bindPopup(esc(site.name)+" · 固定观测点");
      if($("stationsOn").checked)for(const s of mission.stations)dot(s.lat,s.lon,s.name,true).bindPopup(esc(s.name)+" · 地区示意");
    }
    connect.clearLayers();
    function line(s,color,dash){
      if(!point)return;
      const slon=near(s.lon,lng);L.polyline([[s.lat,slon],[point.lat,lng]],{color,weight:1.5,dashArray:dash,interactive:false}).addTo(connect);
    }
    if(point&&$("siteOn").checked&&observer(site)(position(rows,t)).el>=site.mask)line(site,"#b9ddd2","3 7");
    if($("stationsOn").checked)for(const c of activeContacts){
      const s=mission.stations.find(s=>s.id===c.station);
      if(s&&c.kind==="direct")line(s,"#92e4a1",null);
    }
    const nkey=JSON.stringify([version,notices.map(n=>[n.id,n.code]),$("noticesOn").checked,Math.round(center/90)]);
    if(nkey!==noticeKey){
      noticeKey=nkey;areas.clearLayers();
      if($("noticesOn").checked)for(const n of notices){
        const opts={color:"#d9ac72",weight:1.2,fillOpacity:.14};
        let l;if(n.circle){const [[y,x],r]=n.circle;l=L.circle([y,near(x,center)],{...opts,radius:r});}
        else if(n.points.length>=3){let last=center;l=L.polygon(n.points.map(([y,x])=>[y,last=near(x,last)]),opts);}
        if(l)l.addTo(areas).bindPopup("<b>"+esc(n.code)+"</b><small>"+esc(n.time)+" UTC</small>"+esc(n.text).slice(0,450));
      }
    }
  }
  $("fit").onclick=world;$("locate").onclick=()=>latest?map.setView([latest.lat,latest.lon],Math.max(3,map.getZoom())):toast("所选时间无轨道数据");
  $("zoomIn").onclick=()=>map.zoomIn(.5);$("zoomOut").onclick=()=>map.zoomOut(.5);
  return {paint,go:(lat,lon)=>map.setView([lat,lon],Math.max(4,map.getZoom()))};
}

