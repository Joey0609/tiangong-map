"""Build an offline historical profile and CSV using only the Python standard library.
Usage: python scripts/historical_profile.py [output-directory]
Published times are minute labels; samples between them are synthetic, not telemetry.
"""
from pathlib import Path
from datetime import datetime,timedelta
from bisect import bisect_right
import csv,math,sys

START=datetime.fromisoformat('2021-09-17T12:43:00+08:00')
OFF='https://www.cmse.gov.cn/xwzx/yzjz/202109/t20210917_48699.html'
LIVE='https://www.12371.cn/2021/09/17/VIDE1631863158223592.shtml'
VIDEO='https://www.youtube.com/watch?v=yzrmeWx5CWA'
EVENTS={0:('返回指令、轨返分离','官方通报'),120:('返回制动开机','直播更新'),240:('返回制动结束','直播更新'),960:('惯性滑行','直播更新'),1500:('推返分离已完成','直播更新'),1920:('进入黑障','直播更新'),2040:('离开黑障','直播更新'),2220:('伞舱盖打开','直播更新'),2340:('主伞打开','直播更新'),2460:('距地面约6公里，抛防热大底','直播更新'),3060:('着陆','官方通报')}
# Relative planar illustration; no azimuth, geographic origin, target or guidance law.
# Columns: elapsed seconds, model height A/B (km), assumed horizontal speeds A/B (km/s).
K=[(0,390,385,7.60,7.55),(960,300,320,7.5,7.45),(1500,150,175,7.35,7.30),(1860,92,100,6.8,6.6),(2100,27,33,1.2,1.5),(2220,10,11,0.14,0.17),(2340,7.5,8,0.015,0.022),(2460,6,6,0.006,0.009),(3060,0,0,0.002,0.004)]
T=[k[0] for k in K]
def profile(model):
 h=[k[1+model] for k in K];u=[k[3+model] for k in K]; dt=[b-a for a,b in zip(T,T[1:])];sl=[(b-a)/d for a,b,d in zip(h,h[1:],dt)];m=[sl[0]]
 for j in range(1,len(T)-1):
  w1=2*dt[j]+dt[j-1];w2=dt[j]+2*dt[j-1];m.append((w1+w2)/(w1/sl[j-1]+w2/sl[j]))
 m.append(sl[-1]);dist=[0.0]
 for j,d in enumerate(dt):dist.append(dist[-1]+(u[j]+u[j+1])*d/2)
 for t in range(T[-1]+1):
  j=min(len(dt)-1,bisect_right(T,t)-1);d=dt[j];q=(t-T[j])/d
  height=(2*q**3-3*q*q+1)*h[j]+(q**3-2*q*q+q)*d*m[j]+(-2*q**3+3*q*q)*h[j+1]+(q**3-q*q)*d*m[j+1]
  vz=6*q*(q-1)*(h[j]-h[j+1])/d+(3*q*q-4*q+1)*m[j]+(3*q*q-2*q)*m[j+1];vx=u[j]+(u[j+1]-u[j])*q;x=dist[j]+d*q*(u[j]+vx)/2
  yield (t,height,1000*math.hypot(vz,vx),x,1000*vz,1000*vx)

def chart(curves,colx,coly,xname,yname):
 X=max(v[colx] for c in curves for v in c);Y=max(v[coly] for c in curves for v in c);w=670;h=154
 def pt(x,y):return (65+w*x/X,30+h*(1-y/Y))
 def text(x,y,s,anchor='middle'):return f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}">{s}</text>'
 out=[f'<svg viewBox="0 0 780 235" role="img" aria-label="{yname}随{xname}变化">',text(6,17,yname,'start')];
 for i in range(5):
  x,y=pt(X*i/4,Y*i/4);out += [f'<path d="M65 {y}H735" class="grid"/>',text(58,y+4,f'{Y*i/4:.0f}','end'),text(x,203,f'{X*i/4:.0f}')]
 for c,color in zip(curves,['#006758','#b45623']):
  out.append('<polyline fill="none" stroke="'+color+'" stroke-width="2.6" points="'+' '.join('%.1f,%.1f'%pt(v[colx],v[coly]) for v in c[::5])+'"/>')
 out.extend([text(400,227,xname),'</svg>']);return ''.join(out)

def main(dest):
 dest.mkdir(parents=True,exist_ok=True);curves=[list(profile(i)) for i in [0,1]]
 for c in curves:
  assert len(c)==3061 and c[2460][1]==6 and c[-1][1]==0
  assert all(b[1]<=a[1] and b[3]>=a[3] and b[2]>=0 for a,b in zip(c,c[1:]))
  assert max(abs((c[i+1][3]-c[i-1][3])*500-c[i][5]) for i in range(1,3060) if i not in T)<1e-6
 with (dest/'return-profile.csv').open('w',encoding='utf-8-sig',newline='') as f:
  writer=csv.writer(f,lineterminator='\n');writer.writerow(['北京时间_示例采样','相对秒','事件','时标来源','模型','模拟高度_km_AGL','模拟相对速度_m_s','模拟沿程_km','模拟垂直速度_m_s','模拟水平速度_m_s','事件记录来源']);
  for i in range(3061):
   event,src=EVENTS.get(i,('',''));clock=(START+timedelta(seconds=i)).isoformat();
   for model,c in zip('AB',curves):writer.writerow([clock,i,event,src,model,*[round(z,5) for z in c[i][1:]],OFF if src=='官方通报' else LIVE if src else ''])
 # Playback-relative event ticks, not captions from the video track.
 with (dest/'historical-events.csv').open('w',encoding='utf-8-sig',newline='') as ef:
  ew=csv.writer(ef,lineterminator='\n');ew.writerow(['北京时间_分钟级','相对12时43分_秒','事件','记录类型','来源']);
  for t,(event,kind) in EVENTS.items():ew.writerow([(START+timedelta(seconds=t)).strftime('%Y-%m-%d %H:%M +08:00'),t,event,kind,OFF if kind=='官方通报' else LIVE]);
 rows=''.join(f'<tr><td>{(START+timedelta(seconds=t)):%H:%M}</td><td>{event}</td><td>{src}</td><td>{curves[0][t][1]:.1f} / {curves[1][t][1]:.1f}</td><td>{curves[0][t][2]:,.0f} / {curves[1][t][2]:,.0f}</td></tr>' for t,(event,src) in EVENTS.items()); charts=''.join(chart(curves,*args) for args in [(0,1,'距起点（秒）','高度（km）'),(0,2,'距起点（秒）','速度（m/s）'),(3,1,'沿程距离（km）','高度（km）')]);
 html=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>神舟十二号 · 历史返回剖面</title><style>*{{box-sizing:border-box}}body{{font:16px/1.65 system-ui,sans-serif;color:#172e34;background:#f3f6f5;margin:0}}main{{max-width:920px;margin:auto;padding:32px 20px}}section{{background:white;border:1px solid #d4dfdb;padding:20px;margin:18px 0;border-radius:12px}}h1,h2{{line-height:1.25}}h2{{font-size:20px}}a{{color:#006758}}svg{{width:100%;height:auto}}text{{font:13px system-ui;fill:#304b50}}.grid{{stroke:#dce5df;stroke-width:1}}table{{width:100%;border-collapse:collapse;font-size:14px}}td,th{{border-bottom:1px solid #dce5df;text-align:left;padding:7px}}.scroll{{overflow:auto}}.a{{color:#006758}}.b{{color:#b45623}}</style><main><p>历史回放　/　2021.09.17</p><h1>神舟十二号 · 返回剖面</h1><p>12:43 至 13:34，北京时间。事件取自公开报道；曲线是相对坐标中的二维运动学示例，不能据此识别真实地面航迹。<a href="return-profile.csv" download>下载逐秒 CSV</a></p><section><h2>时间、高度、速度与轨迹</h2><p><b class="a">绿色　假设 A</b>　<b class="b">棕色　假设 B</b></p>{charts}</section><section class="scroll"><h2>事件对照</h2><table><thead><tr><th>北京时间</th><th>事件</th><th>依据</th><th>模型高度 A/B（km）</th><th>模型速度 A/B（m/s）</th></tr></thead><tbody>{rows}</tbody></table></section><section><h2>证据与计算口径</h2><p><a href="{OFF}">载人航天工程办公室通报</a>确认返回指令与着陆时刻。其余标记采用<a href="{LIVE}">央视图文直播的分钟级更新时间</a>，包含播报延迟。<a href="{VIDEO}">完整历史回放</a>此次未取得中英文字幕轨。</p><p>两条曲线均经过 13:24 约 6 km 和着陆时 0 km 的相对地面高度。其余高度节点与全部水平速度是示例假设。高度用单调分段三次曲线，垂直速度取其导数；水平速度按时间线性插值，积分得到沿程距离。显示速度是水平与垂直分量的合速度，终点取触地前极限。模型忽略地球曲率、横向运动和风，沿程从 0 起算，不对应经纬度。A/B 为非唯一性的示例，不代表统计误差界限。</p></section></main></html>''';(dest/'return-profile.html').write_text(html,encoding='utf8');print('verified 2 x 3,061 samples; timeline 51 minutes; CSV + offline report written')
if __name__=='__main__': main(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'web'/'historical')
