# 天宫任务地图

中国空间站全屏轨道地图。矢量和卫星模式使用与 [Joey0609/notams](https://github.com/Joey0609/notams) 相同的高德瓦片和 Bing 瓦片。固定观测点保存在访问者的浏览器中。线上入口为 [天宫任务地图](https://joey0609.github.io/tiangong-map/)。

## 本地运行

```sh
python -m pip install -r requirements.txt
python serve.py
```

打开 http://127.0.0.1:8765/ 。Windows 也可运行 `start.cmd`。本地服务每 15 分钟采集，页面每分钟读取快照，实时位置每秒更新。浏览器需要通过 HTTP 加载 ES 模块。

## 数据与预测

- `sources/ephemeris.py` 读取中国载人航天工程办公室的 [CSS OEM](https://www.cmse.gov.cn/gfgg/zgkjzgdcs/)，校验 CSS、UTC、EME2000 并转换至地固系。使用 ERFA 的岁差、章动与地球自转矩阵，以 UTC 近似 UT1，忽略极移。适用于公共地图展示。
- `web/orbit.js` 在相邻位置和速度之间做三次 Hermite 插值。计算 WGS84 经纬高、站心方位、仰角和斜距。星历范围外和超过十分钟的缺口停止推算。过境搜索限定于星历有效期及选定时刻之后七天，按用户指定的最低仰角计算，结果为几何可见时段。
- `sources/notices.py` 读取 [NOTAM 发布数据](https://joey0609.github.io/notams/data_dict.json)，用上游几何解析器处理区域。地图按明确的 UTC 时间区间筛选。列表不自动认定与神舟任务相关。
- `sources/bulletins.py` 更新神舟二十三号和二十四号官方公告索引。`web/data/mission.json` 是固定的人工核实数据入口，包含人员、事件、历史轮换样本和地面站。公开确认的返回计划按 `officialReturn: {"published":"带时区的发布时间","label":"官方公布的日期或时段","url":"官方公告网址"}` 填写。地面站示意点取地区中心。
- 通信记录使用 `contacts` 数组，每条记录包含 `station`（地面站 ID）、`start`、`end`（带时区的时间）、`kind`、`url`（公开来源）。标记为 `direct` 的有效时段显示直连线。没有公开记录时仅计算几何可见性。
- 返回日期按四次已完成轮换的北京时间自然日差取最小值和最大值。页面可展开核对样本。本次含短期访问，常规轮换的历史范围仅作参考。确认的官方时间优先。
- `collector.py` 原子替换 `web/data/latest.json` 并保存有变化的来源快照到 `web/data/history/`。采集失败保留上次成功数据，来源面板显示失败原因与时间。

## 部署与检查

GitHub Pages 的发布源为 GitHub Actions。`.github/workflows/pages.yml` 支持推送到 main、手动运行和每小时第 17、47 分钟的定时触发。工作流抓取数据、运行轨道及过境检查、保存快照并发布 web 目录。GitHub 调度和页面分发可能延迟。线上刷新按钮重新读取最近一次发布的快照。

```sh
node tests/verify.mjs
```

前端按地图、瓦片、轨道、观测点、任务及界面交互拆分。Leaflet 许可证和上游 NOTAM 几何代码许可证位于 `web/vendor/`。离线轮廓来自公共领域 Natural Earth。

