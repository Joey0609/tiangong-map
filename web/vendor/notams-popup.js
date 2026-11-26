// Adapted from Joey0609/notams. See NOTAMS-LICENSE. Hide action omitted.
import {toast as showNotification} from "../ui.js";
function handleCopy(text) {
    // 通用复制函数，兼容安卓 WebView
    function fallbackCopy(str) {
        const textarea = document.createElement('textarea');
        textarea.value = str;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', ''); // 防止移动端弹出键盘
        document.body.appendChild(textarea);

        // 针对 iOS 的特殊处理
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textarea.setSelectionRange(0, str.length); // 安卓需要这个

        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (e) {
            console.error('execCommand copy failed:', e);
        }
        document.body.removeChild(textarea);
        return success;
    }

    // 优先使用现代 Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => {
            showNotification("成功复制到剪贴板");
        }).catch(err => {
            // Clipboard API 失败，使用回退方案
            if (fallbackCopy(text)) {
                showNotification("成功复制到剪贴板");
            } else {
                showNotification("复制失败，请手动复制");
            }
        });
    } else {
        // 不支持 Clipboard API，直接使用回退方案
        if (fallbackCopy(text)) {
            showNotification("成功复制到剪贴板");
        } else {
            showNotification("复制失败，请手动复制");
        }
    }
}
function formatNotamListTime(utcTimeStr) {
    // 处理空值或无效值
    if (!utcTimeStr || utcTimeStr === 'null' || utcTimeStr === 'undefined') {
        return '时间未知';
    }

    const regex = /(\d{1,2}) (\w{3}) (\d{2}:\d{2}) (\d{4}) UNTIL (\d{1,2}) (\w{3}) (\d{2}:\d{2}) (\d{4})/gi;
    const matches = [...String(utcTimeStr).matchAll(regex)];
    if (!matches.length) {
        console.warn('时间格式不匹配:', utcTimeStr);
        return utcTimeStr;
    }

    // 月份映射表（支持大小写）
    const monthMap = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12',
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    function toLocal(day, month, time, year) {
        // 确保月份转为大写后再查找
        const monthUpper = month.toUpperCase();
        const monthNum = monthMap[monthUpper] || monthMap[month];

        // 调试信息
        // console.log('toLocal调用:', { day, month, monthUpper, time, year, monthNum });

        if (!monthNum) {
            console.error('无法识别的月份:', month);
            return { y: 0, m: 0, d: 0, h: '00', i: '00' };
        }

        // 确保日期和月份是两位数
        const dayPadded = String(day).padStart(2, '0');
        const dateString = `${year}-${monthNum}-${dayPadded}T${time}:00Z`;
        // console.log('构造的日期字符串:', dateString);

        const utc = new Date(dateString);
        // console.log('UTC时间:', utc, 'isValid:', !isNaN(utc.getTime()));

        if (isNaN(utc.getTime())) {
            console.error('无效的日期:', dateString);
            return { y: 0, m: 0, d: 0, h: '00', i: '00' };
        }

        const btc = new Date(utc.getTime() + 8 * 60 * 60 * 1000);
        return {
            y: btc.getUTCFullYear(),
            m: btc.getUTCMonth() + 1,
            d: btc.getUTCDate(),
            h: String(btc.getUTCHours()).padStart(2, "0"),
            i: String(btc.getUTCMinutes()).padStart(2, "0")
        };
    }

    // 多段活动时间逐段转换并换行，不能合并成连续区间。
    return matches.map((match) => {
        const [, startDay, startMonth, startTime, startYear, endDay, endMonth, endTime, endYear] = match;
        const s = toLocal(startDay, startMonth, startTime, startYear);
        const e = toLocal(endDay, endMonth, endTime, endYear);
        return `${s.y}年${s.m}月${s.d}日 ${s.h}:${s.i} ~ ${e.y}年${e.m}月${e.d}日 ${e.h}:${e.i}`;
    }).join('<br>');
}
function convertTime(time) {
    const matches = [...String(time || '').matchAll(/(\d{1,2} \w{3} \d{2}:\d{2} \d{4}) UNTIL (\d{1,2} \w{3} \d{2}:\d{2} \d{4})/gi)];
    if (!matches.length) return formatNotamListTime(time);
    return formatNotamListTime(`${matches[0][1]} UNTIL ${matches[matches.length - 1][2]}`) + ' 北京时间 (UTC+8)';
}
/* 拼接 E) 段的相邻两行：源报文既可能在单词中间硬折行（例如 "...BAC" + "K TO START"）
   也可能是自然换行。规则：
   - 行尾与行首都带空白 → 去掉行首空白直接接上（避免出现双空格）
   - 只有一侧带空白 → 直接接上（保留原有空白，不重复补空格）
   - 两侧都是字母/数字 → 判定为单词中间的硬折行 → 直接接上（BAC + K → BACK）
   - 其它情况 → 补一个空格（"...BY:" + "N3958..." → "...BY: N3958..."） */
function joinNotamLines(previous, line) {
    if (!previous) return line;
    if (!line) return previous;
    const last = previous.slice(-1);
    const first = line.slice(0, 1);
    if (/\s/.test(last) && /\s/.test(first)) return previous + line.replace(/^\s+/, '');
    if (/\s/.test(last) || /\s/.test(first)) return previous + line;
    if (/[0-9A-Za-z]/.test(last) && /[0-9A-Za-z]/.test(first)) return previous + line;
    return previous + ' ' + line;
}

/* 从原始报文中取出 E) 段正文：默认取全部行（maxLines <= 0 表示不限行数、不出现省略号），
   传入正数则最多显示该行数、多出的用 ... 省略。行内容保留原始空白，返回纯文本（不带末尾换行）。 */
function extractNotamDetails(rawMessage, maxLines = 0) {
    const text = String(rawMessage || '').replace(/\r/g, '');
    const match = text.match(/(?:^|\n)\s*E\)\s*([\s\S]*?)(?=\s[A-H]\)|$)/);
    if (!match) return '';
    // 不做 trim：行首/行尾的空白是硬折行的边界信息，拼接时要保留
    const lines = match[1].split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return '';
    const shown = maxLines > 0 ? lines.slice(0, maxLines) : lines;
    return shown.join('\n') + (shown.length < lines.length ? '...' : '');
}

function extractFullNotamDetails(rawMessage, maxLines = 0) {
    const lines = String(rawMessage == null ? '' : rawMessage)
        .replace(/\r/g, '')
        .split('\n')
        .filter(line => line.trim() !== '');
    if (lines.length === 0) return '';
    const shown = maxLines > 0 ? lines.slice(0, maxLines) : lines;
    return shown.join('\n') + (shown.length < lines.length ? '...' : '');
}

function escapeNotamText(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* 详情末尾的断行：HTML 里换行必须用 <br>；而且行尾**单个** <br> 不会渲染出空行
   （末尾的空行盒高度为 0），要「最后一行是空行」必须连续两次断行。 */
const NOTAM_DETAIL_TRAILING_BREAK = '<br><br>';

function notamDetailHtml(rawMessage, maxLines = 0) {
    const details = extractNotamDetails(rawMessage, maxLines);
    if (details) {
        const text = details.split('\n').reduce((accumulated, line) => joinNotamLines(accumulated, line), '');
        if (!text) return '';
        return escapeNotamText(text) + NOTAM_DETAIL_TRAILING_BREAK;
    }
    const full = extractFullNotamDetails(rawMessage, maxLines);
    if (!full) return '';
    return escapeNotamText(full).replace(/\n/g, '<br>') + NOTAM_DETAIL_TRAILING_BREAK;
}

/* 弹窗标题栏：左侧标题 + 右侧「隐藏 / 图钉 / 复制 / 关闭」；隐藏需二次确认。 */
const POPUP_PIN_ICON = "<svg width='14' height='14' viewBox='0 0 24 24' aria-hidden='true'>" +
    "<path fill='currentColor' d='M16 9V4h1V2H7v2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z'/></svg>";
const POPUP_COPY_ICON = "<svg width='14' height='14' viewBox='0 0 24 24' aria-hidden='true'>" +
    "<path fill='currentColor' d='M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z'/></svg>";
const POPUP_CLOSE_ICON = "<svg width='14' height='14' viewBox='0 0 24 24' aria-hidden='true'>" +
    "<path fill='currentColor' d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/></svg>";
const POPUP_RAW_ICON = "<svg width='14' height='14' viewBox='0 0 24 24' aria-hidden='true'>" +
    "<path fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' d='M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h8'/></svg>";

let popupRawSeq = 0;
const popupRawMessages = new Map();

function registerPopupRawMessage(rawMessage) {
    const key = 'raw-' + (++popupRawSeq);
    popupRawMessages.set(key, String(rawMessage == null ? '' : rawMessage));
    return key;
}

function popupRawMessage(key) {
    return popupRawMessages.get(key) || '';
}

function buildNotamPopupHeader(title, rawMessage, headerStyle, notamIndex) {
    const key = registerPopupRawMessage(rawMessage);
    const styleAttr = headerStyle ? " style='" + headerStyle + "'" : '';
    return "<div class='notam-popup-header'" + styleAttr + ">" +
        "<h4>" + title + "</h4>" +
        "<div class='popup-header-actions'>" +
        "<button class='popup-toggle-raw' data-raw-key='" + key + "' data-raw-view='false' title='查看航警原文' aria-label='查看航警原文'>" + POPUP_RAW_ICON + "</button>" +
        "<button class='popup-pin' data-pinned='false' title='固定弹窗' aria-label='固定弹窗'>" + POPUP_PIN_ICON + "</button>" +
        "<button class='popup-copy-raw' data-raw-key='" + key + "' title='复制原始报文' aria-label='复制原始报文'>" + POPUP_COPY_ICON + "</button>" +
        "</div>" +
        "</div>";
}
function setPopupRawView(container, owner, rawView, button) {
    if (!container || !container.querySelector) return;
    if (owner) owner.__rawView = !!rawView;
    const body = container.querySelector('.notam-popup-body');
    const structured = container.querySelector('.popup-structured-view');
    const raw = container.querySelector('.popup-raw-view');
    if (!body || !structured || !raw) return;
    if (rawView && !owner.__rawBodyHeight) {
        owner.__rawBodyHeight = Math.ceil(body.getBoundingClientRect().height);
    }
    if (owner.__rawBodyHeight) body.style.height = owner.__rawBodyHeight + 'px';
    structured.hidden = !!rawView;
    raw.hidden = !rawView;
    const toggle = button || container.querySelector('.popup-toggle-raw');
    if (toggle) {
        toggle.dataset.rawView = rawView ? 'true' : 'false';
        toggle.title = rawView ? '显示结构化信息' : '查看航警原文';
        toggle.setAttribute('aria-label', toggle.title);
    }
}

function togglePopupRawView(popup, button) {
    if (!popup || !popup.getElement) return;
    const container = popup.getElement();
    const current = button && button.dataset.rawView === 'true';
    setPopupRawView(container, popup, !current, button);
}
/* 固定状态记在 popup 对象上：Leaflet 重新定位（点击同一多边形）会执行
   update() → _updateContent()，按原始字符串重写弹窗正文，按钮 DOM 会被重建，
   所以状态不能只存在按钮上；点击事件也改用容器委托，重建后依然有效。
   Leaflet 侧还需要同步两处：getEvents() 的 closeOnClick（点击地图关闭）、
   openOn() 的 autoClose（被新弹窗顶掉）。 */
function setPopupPinned(popup, pinned) {
    if (!popup || !popup.options) return;
    popup.__pinned = !!pinned;
    popup.options.closeOnClick = !pinned;
    popup.options.autoClose = !pinned;
    const map = popup._map || popup.__pinMap;
    if (map && typeof map.off === 'function') {
        popup.__pinMap = map;
        map.off('preclick', popup.close, popup);
        if (!pinned) map.on('preclick', popup.close, popup);
    }
    applyPopupPinState(popup);
}

/* 把固定状态套用到（可能刚被重建的）图钉按钮上 */
function applyPopupPinState(popup, container) {
    if (!popup) return;
    const element = container || (popup.getElement ? popup.getElement() : null);
    const button = element && element.querySelector ? element.querySelector('.popup-pin') : null;
    if (!button) return;
    const pinned = popup.__pinned === true;
    button.dataset.pinned = pinned ? 'true' : 'false';
    button.title = pinned ? '已固定：点击地图或打开其它航警都不会关闭' : '固定弹窗';
}

/* 容器级事件委托 + 内容重写后重新套用状态 */
function ensurePopupActionDelegation(container, popup) {
    if (!container || !popup) return;
    if (!container.__popupActionsBound && typeof container.addEventListener === 'function') {
        container.__popupActionsBound = true;
        container.addEventListener('click', function(event) {
            const target = event.target;
            if (!target || typeof target.closest !== 'function') return;
            if (target.closest('.popup-pin')) {
                event.stopPropagation();
                setPopupPinned(popup, popup.__pinned !== true);
                return;
            }
            const rawButton = target.closest('.popup-toggle-raw[data-raw-key]');
            if (rawButton) {
                event.stopPropagation();
                togglePopupRawView(popup, rawButton);
                return;
            }
            const copyButton = target.closest('.popup-copy-raw[data-raw-key]');
            if (copyButton) {
                event.stopPropagation();
                handleCopy(popupRawMessage(copyButton.getAttribute('data-raw-key')));
            }
        });
    }
    if (typeof popup._updateContent === 'function' && !popup.__pinContentPatched) {
        popup.__pinContentPatched = true;
        const originalUpdateContent = popup._updateContent;
        popup._updateContent = function() {
            const element = this.getElement ? this.getElement() : null;
            const closeButton = element && element.querySelector ? element.querySelector('a.leaflet-popup-close-button') : null;
            if (closeButton && element && closeButton.parentElement !== element) element.appendChild(closeButton);
            originalUpdateContent.apply(this, arguments);
            applyPopupPinState(this, container);
            setPopupRawView(container, this, this.__rawView === true);
            applyPopupCloseIcon(this);
            movePopupCloseIntoHeader(this, container);
        };
    }
}

/* Leaflet 的关闭按钮是 <a aria-label="Close popup"><span>×</span></a>，只在 _initLayout 里创建一次，
   重写弹窗正文不会重建它，所以这里一次性换成与图钉/复制同一套 14×14 图标；
   万一没换成，按钮里仍是原来的 ×，不会变成空按钮。 */
function applyPopupCloseIcon(popup) {
    const element = popup && popup.getElement ? popup.getElement() : null;
    const button = element && element.querySelector ? element.querySelector('a.leaflet-popup-close-button') : null;
    if (!button || typeof button.innerHTML !== 'string' || button.innerHTML.indexOf('<svg') !== -1) return;
    button.innerHTML = POPUP_CLOSE_ICON;
}

function movePopupCloseIntoHeader(popup, container) {
    const element = container || (popup && popup.getElement ? popup.getElement() : null);
    if (!element || !element.querySelector) return;
    const closeButton = element.querySelector('a.leaflet-popup-close-button');
    const actions = element.querySelector('.popup-header-actions');
    if (closeButton && actions && closeButton.parentElement !== actions) actions.appendChild(closeButton);
}
/* 弹窗标题栏按钮：复制原始报文 + 固定弹窗（各页面共用一份实现） */
function bindPopupActions(layer) {
    if (!layer || typeof layer.on !== 'function') return;

    layer.on('popupopen', function(e) {
        const popup = e && e.popup;
        if (!popup) return;
        applyPopupCloseIcon(popup);
        movePopupCloseIntoHeader(popup);
        ensurePopupActionDelegation(popup.getElement ? popup.getElement() : null, popup);
        popup.__rawView = false;
        popup.__rawBodyHeight = null;
        // 每次重新打开都回到未固定状态（重新定位不会触发 popupopen，固定状态因此保留）
        setPopupPinned(popup, false);
    });

    layer.on('popupclose', function(e) {
        const popup = e && e.popup;
        if (!popup) return;
        popup.__rawView = false;
        popup.__rawBodyHeight = null;
        // 关闭后恢复默认「点击地图即关闭、被新弹窗顶掉」，下次打开由 Leaflet 重新绑定
        setPopupPinned(popup, false);
    });
}

/* 统一的航警弹窗信息行：持续时间 / 编号（可选独占一行）/ 航警详情 */
function buildNotamPopupRows(options) {
    const settings = options || {};
    const codeRow = settings.fullWidthCode
        ? "<div class='popup-info-row'>" +
            "<span class='popup-label'>" + (settings.codeLabel || '航警编号') + ":</span>" +
            "<span class='popup-value'>" + (settings.code || '') + "</span>" +
          "</div>"
        : "<div class='popup-info-row row-horizontal'>" +
            "<div class='popup-col'>" +
            "<span class='popup-label'>" + (settings.codeLabel || '航警编号') + ":</span>" +
            "<span class='popup-value'>" + (settings.code || '') + "</span>" +
            "</div>" +
            "<div class='popup-col'>" +
            "<span class='popup-label'>" + (settings.regionLabel || '飞行情报区') + ":</span>" +
            "<span class='popup-value'>" + (settings.regionValue || '-') + "</span>" +
            "</div>" +
          "</div>";
    let rows = "<div class='popup-info-row'>" +
        "<span class='popup-label'>持续时间:</span>" +
        "<span class='popup-value'>" + (settings.timeText || '') + "</span>" +
        "</div>" + codeRow;

    // 详情默认取全部行（不截断、不加省略号），超出部分由滚动区 + 底部渐隐查看
    const detailLines = typeof settings.detailLines === 'number' ? settings.detailLines : 0;
    const detailHtml = notamDetailHtml(settings.rawMessage, detailLines);
    if (detailHtml) {
        // 外层容器用于承载底部渐隐遮罩（见 styles.css .popup-detail-wrap::after）
        rows += "<div class='popup-info-row'>" +
            "<span class='popup-label'>" + (settings.detailLabel || '航警详情') + ":</span>" +
            "<div class='popup-detail-wrap'>" +
            "<span class='popup-value popup-detail'>" + detailHtml + "</span>" +
            "</div>" +
            "</div>";
    }
    return rows + (settings.extraRows || '');
}

function buildNotamPopupRawView(rawMessage) {
    // 原文视图也按详情区的排版规则展示：清理空行和连续空白，保留有效分行，
    // 再在正文末尾补一处 <br>，避免最后一行贴在渐隐边缘。
    const raw = String(rawMessage == null ? '' : rawMessage)
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.replace(/[\t ]+/g, ' ').trim())
        .filter(line => line !== '')
        .join('\n');
    const rawHtml = escapeNotamText(raw || '暂无航警原文').replace(/\n/g, '<br>') + '<br><br>';
    return "<div class='popup-raw-view' hidden>" +
        "<pre class='popup-raw-content'>" + rawHtml + "</pre>" +
        "</div>";
}

export function bindNotice(layer,n) {
    const fir = String(n.text).match(/(?:^|\n)A\)\s*([A-Z]{4})\b/)?.[1] || 'UNKNOWN';
    const html = "<div class='notam-popup'>" + buildNotamPopupHeader('NOTAM 信息',n.text,'') + "<div class='notam-popup-body'><div class='popup-structured-view'>" + buildNotamPopupRows({timeText: convertTime(escapeNotamText(n.time)),code:escapeNotamText(n.code),regionValue:fir,rawMessage:n.text}) + "</div>" + buildNotamPopupRawView(n.text) + "</div></div>";
    layer.bindPopup(html,{maxWidth:300,className:'notam-info-popup'});
    bindPopupActions(layer);
    const key = html.match(/data-raw-key='([^']+)'/)[1];
    layer.once('remove', () => popupRawMessages.delete(key));
}
