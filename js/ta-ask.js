(function () { try {
(function () {
const uid = window.activePrefix();
const store = window.activeStore();
const KEY = 'ta-ask';
function grpToast(msg) {
let t = document.getElementById('cc-toast');
if (!t) { t = document.createElement('div'); t.id = 'cc-toast'; document.body.appendChild(t); }
t.textContent = msg;
t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show';
clearTimeout(t._timer);
t._timer = setTimeout(() => { t.className = 'cc-toast'; }, 2000);
}
function escG(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function askTypeBadge(q) {
const n = q && Array.isArray(q.options) ? q.options.length : 0;
if (q && q.type === 'single') return ' <span class="tc-known">单选·' + n + '选项</span>';
if (q && q.type === 'multi') return ' <span class="tc-known">多选' + (q.multiMax >= 2 ? '·限' + q.multiMax : '') + '·' + n + '选项</span>';
return '';
}
function taReplyShow(s) {
const t = (window.askCardReplyClean ? window.askCardReplyClean(s) : String(s == null ? '' : s));
return escG(window.taFit ? window.taFit(t) : t);
}
function interactPoolInlineHtml(poolName) {
const arr = window.getInteractPool ? window.getInteractPool(poolName, []) : [];
if (!arr.length) return '';
return '<div class="tc-qopts">TA 回应：<span class="tc-known">系统</span> ' + arr.map(escG).join(' / ') + '</div>';
}
function pgCatOff(ns, cat) { return !!(window.presetGroup && window.presetGroup.isOff(ns, cat || 'daily')); }
function presetCatOpen(ns, q) { return !(q && q.isPreset === true && pgCatOff(ns, q.cat)); }
window.cardGroups = {
genId: function () { return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); },
toast: grpToast,
esc: escG,
dup: function (groups, name, ignoreId) { return groups.some(function (g) { return g.name === name && g.id !== ignoreId; }); },
addFlow: function (groups, cb) {
if (!window.openModal) { cb(null); return; }
window.openModal('新建分组', '', function (v) {
const name = String(v || '').trim();
if (!name) { cb(null); return; }
if (window.cardGroups.dup(groups, name)) { grpToast('分组「' + name + '」已存在'); cb(null); return; }
const g = { id: window.cardGroups.genId(), name: name };
groups.push(g);
cb(g);
});
},
renameFlow: function (g, groups, cb) {
if (!window.openModal) { cb(null); return; }
window.openModal('重命名分组', g.name, function (v) {
const name = String(v || '').trim();
if (!name) { cb(null); return; }
if (window.cardGroups.dup(groups, name, g.id)) { grpToast('分组「' + name + '」已存在'); cb(null); return; }
cb(name);
});
},
removeFlow: function (name, cb) {
if (!window.openModal) { cb(true); return; }
window.openModal('删除分组', '', function () { cb(true); }, { noInput: true, staticText: '删除分组「' + name + '」？组内字卡不会丢失，会回到「未分组」。' });
},
catOptsHtml: function (catList, groups, cur) {
let h = '';
catList.forEach(function (c) {
h += '<option value="' + c[0] + '"' + (cur === c[0] ? ' selected' : '') + '>' + escG(c[1]) + '</option>';
});
if (groups.length) {
h += '<optgroup label="我的分组">';
groups.forEach(function (g) { h += '<option value="grp:' + g.id + '"' + (cur === 'grp:' + g.id ? ' selected' : '') + '>' + escG(g.name) + '</option>'; });
h += '</optgroup>';
}
h += '<option value="__newgrp">＋ 新建分组…</option>';
return h;
},
grpOnlyOptsHtml: function (groups, cur) {
let h = '<option value="">未分组</option>';
groups.forEach(function (g) { h += '<option value="grp:' + g.id + '"' + (cur === 'grp:' + g.id ? ' selected' : '') + '>' + escG(g.name) + '</option>'; });
h += '<option value="__newgrp">＋ 新建分组…</option>';
return h;
},
parseCatVal: function (v) {
if (typeof v === 'string' && v.indexOf('grp:') === 0) return { cat: null, grp: v.slice(4) };
if (v === '__newgrp') return null;
return { cat: v || 'daily', grp: null };
},
bindNewGrp: function (sel, groups, onChanged) {
try { if (window.cardGroups) window.cardGroups.attachCustom(sel); } catch (e) {}
sel.__grpGroups = groups;
sel.__grpOnChanged = onChanged;
if (sel.__grpBound) return;
sel.__grpBound = true;
sel.addEventListener('change', function () {
if (sel.value !== '__newgrp') return;
window.cardGroups.addFlow(sel.__grpGroups || [], function (g) {
const first = sel.querySelector('option');
if (!g) { if (first) sel.value = first.value; return; }
if (sel.__grpOnChanged) sel.__grpOnChanged(g);
const opt = document.createElement('option');
opt.value = 'grp:' + g.id;
opt.textContent = g.name;
const nopt = sel.querySelector('option[value="__newgrp"]');
sel.insertBefore(opt, nopt);
sel.value = 'grp:' + g.id;
grpToast('已新建分组「' + g.name + '」');
});
});
},
attachCustom: function (sel) {
if (!sel || sel.nodeType !== 1 || sel.tagName !== 'SELECT' || sel.__mochiCsWrap) return;
sel.__mochiCsWrap = true;
const w = sel.offsetWidth || 0;
const wrap = document.createElement('span');
wrap.className = 'mochi-custom-select';
wrap.style.minWidth = (w || 96) + 'px';
wrap.style.width = w ? w + 'px' : 'auto';
const trig = document.createElement('button');
trig.type = 'button';
trig.className = 'mochi-custom-select-trig';
const label = document.createElement('span');
label.className = 'mochi-custom-select-label';
const caret = document.createElement('span');
caret.className = 'mochi-custom-select-caret';
caret.textContent = '▾';
trig.appendChild(label);
trig.appendChild(caret);
const list = document.createElement('div');
list.className = 'mochi-custom-select-list';
wrap.appendChild(trig);
wrap.appendChild(list);
sel.classList.add('mochi-custom-select-native'); // display:none 隐藏原生，value/change 仍可读写
sel.parentNode.insertBefore(wrap, sel);
let open = false;
let closeFns = [];
function setLabel() {
const cur = String(sel.value);
const opts = sel.querySelectorAll('option');
for (let i = 0; i < opts.length; i++) {
if (String(opts[i].value) === cur) { label.textContent = opts[i].textContent; return; }
}
const first = sel.querySelector('option');
label.textContent = first ? first.textContent : '请选择';
}
function closeAll() {
open = false;
wrap.classList.remove('open');
if (list.parentNode === document.body) {
try { list.style.display = 'none'; document.body.removeChild(list); } catch (err) {}
} else {
list.style.display = 'none';
}
closeFns.forEach(function (fn) { if (fn) fn(); });
closeFns = [];
}
function openList() {
const rect = trig.getBoundingClientRect();
const vw = window.innerWidth || document.documentElement.clientWidth;
const vh = window.innerHeight || document.documentElement.clientHeight;
const panelW = Math.max(rect.width, 120);
const availBelow = vh - rect.bottom - 8;
const dropH = Math.max(120, Math.min(34 * vh / 100, availBelow));
list.style.width = panelW + 'px';
list.style.maxHeight = (availBelow < 120 ? Math.max(120, vh - 16) : dropH) + 'px';
list.style.position = 'fixed';
list.style.zIndex = 9999;
let top = rect.bottom + 4;
if (top + dropH > vh - 8) top = Math.max(8, rect.top - 4 - Math.min(dropH, vh - 16));
top = Math.max(8, Math.min(top, vh - 8 - Math.min(parseInt(list.style.maxHeight, 10) || dropH, vh - 16)));
const left = Math.min(Math.max(4, rect.left), Math.max(4, vw - panelW - 4));
list.style.left = left + 'px';
list.style.top = top + 'px';
document.body.appendChild(list);
list.style.display = 'block';
open = true;
wrap.classList.add('open');
rebuild(); // 打开时刷新选中高亮/toLabel
const onScroll = function (e) { if (!e || !list.contains(e.target)) closeAll(); };
const onResize = function () { closeAll(); };
window.addEventListener('scroll', onScroll, true);
window.addEventListener('resize', onResize);
closeFns.push(function () {
window.removeEventListener('scroll', onScroll, true);
window.removeEventListener('resize', onResize);
});
}
function setOpen(v) { if (v) openList(); else closeAll(); }
function addOpt(opt) {
const b = document.createElement('button');
b.type = 'button';
b.className = 'mochi-cs-opt' + (String(opt.value) === String(sel.value) ? ' on' : '');
b.textContent = opt.textContent || '';
b.addEventListener('click', function (e) {
e.stopPropagation();
if (String(opt.value) === String(sel.value)) { setOpen(false); return; }
sel.value = opt.value;
try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (err) {}
setLabel();
setOpen(false);
rebuild();
});
list.appendChild(b);
}
function rebuild() {
list.innerHTML = '';
Array.prototype.forEach.call(sel.children, function (ch) {
if (ch.tagName === 'OPTGROUP') {
const g = document.createElement('div');
g.className = 'mochi-cs-group';
g.textContent = ch.label || '';
list.appendChild(g);
Array.prototype.forEach.call(ch.querySelectorAll('option'), addOpt);
} else if (ch.tagName === 'OPTION') {
addOpt(ch);
}
});
setLabel();
}
trig.addEventListener('click', function (e) { e.stopPropagation(); if (open) closeAll(); else openList(); });
document.addEventListener('mousedown', function (e) {
if (!open) return;
if (list.contains(e.target) || trig.contains(e.target)) return;
closeAll();
}, true);
document.addEventListener('touchstart', function (e) {
if (!open) return;
if (list.contains(e.target) || trig.contains(e.target)) return;
closeAll();
}, true);
document.addEventListener('contact-switched', closeAll, false);
document.addEventListener('visibilitychange', function () { closeAll(); }, false);
if (typeof MutationObserver !== 'undefined') {
new MutationObserver(function () { if (wrap && list) rebuild(); })
.observe(sel, { childList: true, subtree: true });
}
rebuild();
},
ensureCustomSelects: function () {
var selSel = 'select.ta-type, select.tc-input, select.gm-input, select.ti-type';
document.querySelectorAll(selSel).forEach(function (s) { window.cardGroups.attachCustom(s); });
if (window.__mochiCsObserver || typeof MutationObserver === 'undefined') return;
window.__mochiCsObserver = true;
new MutationObserver(function (muts) {
muts.forEach(function (m) {
m.addedNodes.forEach(function (n) {
if (!n || n.nodeType !== 1) return;
if (n.matches && n.matches(selSel)) { window.cardGroups.attachCustom(n); return; }
if (n.childElementCount <= 60 && n.querySelectorAll) {
const f = n.querySelectorAll(selSel);
for (let i = 0; i < f.length; i++) window.cardGroups.attachCustom(f[i]);
}
});
});
}).observe(document.body, { childList: true, subtree: true });
}
};
const DEFAULT_QUESTIONS = [
{ id: 'q_d1', text: '你吃饭了吗？', cat: 'daily', enabled: true },
{ id: 'q_c1', text: '有没有好好休息？', cat: 'care', enabled: true },
{ id: 'q_i1', text: '现在在做什么？', cat: 'interact', enabled: true },
{ id: 'q_w1', text: '想要聊些什么？', cat: 'world', enabled: true },
{ id: 'q_s1', text: '今天很忙吗？', cat: 'interact', type: 'single', enabled: true, options: [
{ t: '很忙', reply: '辛苦了呢' }, { t: '不算太忙', reply: '摸鱼也算在忙吧' },
{ t: '非常轻松', reply: '希望这样的日子再多一点' }, { t: '和往常一样', reply: '平淡就是生活的主线' }] }
];
const CATS = [
['daily', '日常询问'],
['care', '关心询问'],
['interact', '互动询问'],
['world', '两个世界']
];
window.MOCHI_TA_ASK_CARE = DEFAULT_QUESTIONS.filter(function (q) { return q.cat === 'care'; });
function toast(msg) {
let t = document.getElementById('cc-toast');
if (!t) {
t = document.createElement('div');
t.id = 'cc-toast';
document.body.appendChild(t);
}
t.textContent = msg;
t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show';
clearTimeout(t._timer);
t._timer = setTimeout(() => { t.className = 'cc-toast'; }, 2000);
}
function askPopupProb(s) {
if (s && typeof s.popupProb === 'number') return s.popupProb;
if (s && s.autoPopup === false) return 0;
return 70;
}
function cardPopupBusy() {
return ['modal-mask', 'tc-mask', 'qa-mask'].some(id => {
const el = document.getElementById(id);
return el && !el.hidden;
});
}
function chatInputFocused() {
const ci = document.getElementById('chat-input');
if (ci && document.activeElement === ci) return true;
const ae = document.activeElement;
return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
}
let lastPopHiddenAt = 0;
try {
document.addEventListener('visibilitychange', function onVis() {
if (document.visibilityState !== 'visible') lastPopHiddenAt = Date.now();
}, true);
} catch (e) {}
function autoPopupStale(schedAt) {
if (lastPopHiddenAt > schedAt) return true;
return Date.now() - schedAt > 4000;
}
window.interactPopupStale = autoPopupStale;
const INTERACT_GATE_KEY = 'interact-card-last';
const INTERACT_GATE_MS = 60 * 60000; // 基准值（原频率档）；实际闸门 = 基准 × 频率档 gateMul
const IC_FREQ_KEY = 'reply-ic-freq';
const IC_MODES = [
{ id: 'orig', label: '原频率', probMul: 1,   coolMul: 1,   gateMul: 1   },
{ id: 'low1', label: '稍安静', probMul: 0.6, coolMul: 1.5, gateMul: 1.5 },
{ id: 'low2', label: '安静',   probMul: 0.4, coolMul: 2,   gateMul: 2   },
{ id: 'low3', label: '很安静', probMul: 0.2, coolMul: 3,   gateMul: 3   }
];
function icMode() {
let k = 0;
try {
const raw = store.get(IC_FREQ_KEY);
if (raw !== null && raw !== undefined && raw !== '') {
const v = Number(raw);
if (v >= 0 && v < IC_MODES.length) k = v;
}
} catch (e) {}
return IC_MODES[k] || IC_MODES[0];
}
window.icMode = icMode;
window.icModes = IC_MODES;
function icProb(v) {
const n = Number(v);
if (!isFinite(n)) return 0;
const r = Math.round(n * icMode().probMul);
return Math.max(0, Math.min(100, (r < 1 && n >= 1) ? 1 : r));
}
window.icProb = icProb;
function icCool(min) { return Math.max(1, Math.round(min * icMode().coolMul)); }
window.icCool = icCool;
function interactGateMs() { return Math.round(INTERACT_GATE_MS * icMode().gateMul); }
window.interactGateMs = interactGateMs;
function interactGateOk() {
if (window.nightModeActive && window.nightModeActive()) return false;
try {
const last = Number(store.get(INTERACT_GATE_KEY)) || 0;
return Date.now() - last >= interactGateMs();
} catch (e) { return true; }
}
function interactGateMark() {
try { store.set(INTERACT_GATE_KEY, String(Date.now())); } catch (e) {}
}
window.interactGateOk = interactGateOk;
window.interactGateMark = interactGateMark;
function taAskDcfOk() { try { return Math.random() * 100 < (window.dcfGet ? window.dcfGet('ask') : 100); } catch (e) { return true; } }
window.__interactGateInfo = function () {
let last = 0;
try { last = Number(store.get(INTERACT_GATE_KEY)) || 0; } catch (e) {}
return { key: INTERACT_GATE_KEY, lastAt: last, gateMs: interactGateMs(), open: interactGateOk(), waitMs: Math.max(0, last + interactGateMs() - Date.now()) };
};
const _pendingPops = [];
function _enqueuePop(idx, openFnName) {
if (idx < 0) return;
_pendingPops.push({ idx: idx, fn: openFnName, t: Date.now() });
if (_pendingPops.length > 4) _pendingPops.shift();
}
function _chatPageOpen() {
try {
const cp = document.getElementById('page-chat');
return cp ? !cp.hidden : false;
} catch (e) { return false; }
}
function _lateNotify() {
try { return !!(window.bgLateCatchup && window.bgLateCatchup()) && !_chatPageOpen(); } catch (e) { return false; }
}
window.interactLateNotify = _lateNotify; // 查岗卡（ck-question.js）共用（同 interactPopupStale 惯例）
function _flushPendingPops() {
if (!_pendingPops.length) return;
if (cardPopupBusy() || chatInputFocused()) return;
if (_chatPageOpen()) { _pendingPops.length = 0; return; } // 在聊天页就不补弹，卡片聊天里看得见
const item = _pendingPops[_pendingPops.length - 1];
_pendingPops.length = 0;
const fn = window[item.fn];
if (typeof fn === 'function') fn(item.idx);
}
try {
document.addEventListener('mochi-fg-resume', function () {
try {
maybeTriggerTAAsk(); maybeTriggerTC(); maybeTriggerTCU(); maybeTriggerTR(); if (typeof maybeTriggerTACC === 'function') try { maybeTriggerTACC(); } catch (e) {}
} catch (e) {}
_flushPendingPops();
});
} catch (e) {}
function migrateInteractProb(d, storeKey, oldDefaults) {
try {
if (!d.settings || d.settings.probLowV313) return;
if (oldDefaults.indexOf(Number(d.settings.prob)) !== -1) d.settings.prob = 5;
d.settings.probLowV313 = true;
if (store.get(storeKey)) { try { store.set(storeKey, JSON.stringify(d)); } catch (e) {} }
} catch (e) {}
}
function taAskMerge(d) {
const ids = {};
(d.questions || []).forEach(q => { if (q && q.id) ids[q.id] = true; });
const merged = Array.isArray(d.mergedIds) ? d.mergedIds.slice() : [];
const mergedSet = {};
merged.forEach(id => { if (id) mergedSet[id] = true; });
let changed = false;
DEFAULT_QUESTIONS.forEach(q => {
if (!mergedSet[q.id] && !ids[q.id]) {
const nq = Object.assign({}, q);
nq.isPreset = true; // v3.6.x：系统预设标记——预设只可启停、不可删除
d.questions.push(nq);
changed = true;
}
});
DEFAULT_QUESTIONS.forEach(q => {
if (!mergedSet[q.id]) { merged.push(q.id); mergedSet[q.id] = true; changed = true; }
});
DEFAULT_QUESTIONS.forEach(q => {
if (ids[q.id] && d.questions.some(x => x && x.id === q.id && x.isPreset !== true)) {
d.questions.forEach(x => { if (x && x.id === q.id) x.isPreset = true; });
changed = true;
}
});
if (changed) d.mergedIds = merged;
return changed;
}
function taAskLoad() {
let d = null;
try { d = JSON.parse(store.get(KEY) || 'null'); } catch (e) { d = null; }
if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY)) store.requestBigKey(KEY); } catch (e0) {} }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5, popupProb: 70 };
if (d.settings.useDefault === undefined) d.settings.useDefault = true;
if (d.settings.useChatReply === undefined) d.settings.useChatReply = false;
migrateInteractProb(d, KEY, [20, 10]);
if (!Array.isArray(d.questions) || !d.questions.length) {
const isNew = !store.get(KEY);
d.questions = DEFAULT_QUESTIONS.map(q => {
const nq = Object.assign({}, q);
nq.isPreset = true;
return nq;
});
d.mergedIds = DEFAULT_QUESTIONS.map(q => q.id);
if (!isNew && !ckHold(KEY)) { try { store.set(KEY, JSON.stringify(d)); } catch (e) {} }
} else {
if (taAskMerge(d) && !ckHold(KEY)) { try { store.set(KEY, JSON.stringify(d)); } catch (e) {} }
}
if (!Array.isArray(d.history)) d.history = [];
if (!Array.isArray(d.groups)) d.groups = [];
return d;
}
function taAskSave(d) {
if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY, 'TA 的提问题库')) return false;
try { store.set(KEY, JSON.stringify(d)); } catch (e) {}
return true;
}
function askDeadlineMs(d) {
const v = (d && d.settings && d.settings.deadline) || 0;
return (typeof v === 'number' && v > 0) ? v : 0;
}
function askDeadlinePassed(d) {
const dl = askDeadlineMs(d);
return dl > 0 && Date.now() > dl;
}
function fmtDeadlineText(ts) {
if (!ts) return '未设置';
const dt = new Date(ts), p = n => (n < 10 ? '0' : '') + n;
const wk = '日一二三四五六'.charAt(dt.getDay());
return (dt.getMonth() + 1) + '月' + dt.getDate() + '日 周' + wk + ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes()) + ':' + p(dt.getSeconds());
}
let dlPickerCb = null;
function dlPickerSecs() {
const el = document.getElementById('dl-picker-secs');
const n = el ? parseInt(el.value, 10) : NaN;
return (isFinite(n) && n > 0) ? n : 0;
}
function fmtSecsText(n) {
if (n < 60) return n + ' 秒';
return Math.floor(n / 60) + ' 分 ' + (n % 60) + ' 秒';
}
function dlPickerRender() {
const n = dlPickerSecs();
const curEl = document.getElementById('dl-picker-cur');
if (!curEl) return;
curEl.textContent = n > 0
? '到点：' + fmtDeadlineText(Date.now() + n * 1000) + '（' + fmtSecsText(n) + '后）'
: '请输入秒数（默认 60 秒）';
}
function closeDeadlinePicker() {
const m = document.getElementById('dl-picker-mask');
if (m) m.hidden = true;
dlPickerCb = null;
}
let dlPickerWired = false;
function dlPickerInit() {
const m = document.getElementById('dl-picker-mask');
if (!m) return null;
if (dlPickerWired) return m;
dlPickerWired = true;
const secs = document.getElementById('dl-picker-secs');
if (secs) {
secs.addEventListener('input', dlPickerRender);
secs.addEventListener('click', () => { try { (secs.__ceBox || secs).focus(); } catch (e) {} });
}
const ok = document.getElementById('dl-picker-ok');
if (ok) ok.onclick = () => {
const n = dlPickerSecs();
if (n <= 0) { toast('请输入秒数（大于 0）'); return; }
const cb = dlPickerCb; const ts = Date.now() + n * 1000; closeDeadlinePicker(); if (cb) cb(ts);
};
const cancel = document.getElementById('dl-picker-cancel');
if (cancel) cancel.onclick = () => closeDeadlinePicker();
const clear = document.getElementById('dl-picker-clear');
if (clear) clear.onclick = () => { const cb = dlPickerCb; closeDeadlinePicker(); if (cb) cb(0); };
m.addEventListener('click', (e) => { if (e.target === m) closeDeadlinePicker(); });
return m;
}
function dlPickerSetSecs(n) {
const el = document.getElementById('dl-picker-secs');
if (!el) return;
if (document.activeElement === el || (el.__ceBox && document.activeElement === el.__ceBox)) return;
el.value = String(n);
}
function openDeadlinePicker(title, current, cb) {
const m = dlPickerInit();
if (!m) { toast('时间选择器加载失败'); return; }
dlPickerCb = cb;
const n = (current > 0 && current > Date.now()) ? Math.max(1, Math.round((current - Date.now()) / 1000)) : 60;
const tEl = document.getElementById('dl-picker-title');
if (tEl) tEl.textContent = title;
dlPickerSetSecs(n);
dlPickerRender();
m.hidden = false;
setTimeout(() => { if (m && !m.hidden) dlPickerSetSecs(n); }, 0);
setTimeout(() => { if (m && !m.hidden) { dlPickerSetSecs(n); dlPickerRender(); } }, 80);
}
function taAskPick(d) {
const s = d.settings || {};
const useDefault = s.useDefault !== false;
const qs = d.questions.filter(q => q.enabled !== false && q.text && (useDefault || !q.isPreset) && presetCatOpen('ta-ask', q));
if (!qs.length) return null;
return qs[Math.floor(Math.random() * qs.length)];
}
window.pickAskCardReply = function (presetPool) {
try {
const cards = (window.getCustomCards && window.getCustomCards()) || [];
const words = cards.filter(s => typeof s === 'string' && s.indexOf('data:') !== 0 && s.indexOf('|||') < 0 && !/^https?:\/\//i.test(s) && !(window.mochiMediaIsToken && window.mochiMediaIsToken(s)) && s.trim());
const preset = (Array.isArray(presetPool) ? presetPool : [])
.filter(c => !(window.isDefaultCardOff && window.isDefaultCardOff('interact', c)))
.filter(c => !(typeof c === 'string' && (c.indexOf('data:') === 0 || c.indexOf('|||') >= 0 || /^https?:\/\//i.test(c) || (window.mochiMediaIsToken && window.mochiMediaIsToken(c)))));
const hasPreset = preset.length > 0;
if (hasPreset && words.length) {
if (Math.random() < 0.9) return preset[Math.floor(Math.random() * preset.length)];
const n = 1 + Math.floor(Math.random() * Math.min(5, words.length));
const copy = words.slice();
const out = [];
while (out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
return (window.pyJoinCards && window.replyCfg) ? window.pyJoinCards(out, window.replyCfg()) : out.join(' ');
}
if (hasPreset) return preset[Math.floor(Math.random() * preset.length)];
if (words.length) return words[Math.floor(Math.random() * words.length)];
} catch (e) {}
const defs = ['收到你的回答。', '好呀，我知道了。', '嗯嗯，我也是这么想的。', '你这么说，我记住了。', '好的，我记在心里了。'];
return defs[Math.floor(Math.random() * defs.length)];
};
window.taAskChatReplyOn = function () {
try { const d = taAskLoad(); return !!(d.settings && d.settings.useChatReply); } catch (e) { return false; }
};
function taAskTextReply() {
try {
const d = taAskLoad();
if (!(d.settings && d.settings.useChatReply)) return null;
if (window.genChatStyleReply) {
const r = window.genChatStyleReply();
if (r) return r;
}
if (window.getDefaultCards) {
const dc = window.getDefaultCards('chat');
if (dc && dc.type !== 'poke' && typeof dc.text === 'string' && dc.text.trim()) return dc.text;
}
if (window.quoteSpellPick && window.replyCfg) {
const sp = window.quoteSpellPick(window.replyCfg());
if (sp && Array.isArray(sp.segs) && sp.segs.length) return (window.pyJoinCards ? window.pyJoinCards(sp.segs, window.replyCfg()) : sp.segs.join(' '));
}
} catch (e) {}
return null;
}
function pushAsk(q, opts) {
if (!window.chatAddSystem) return;
const isPick = q && (q.type === 'single' || q.type === 'multi') && Array.isArray(q.options) && q.options.length;
let popup = false;
if (!isPick) {
if (opts && typeof opts.popupProb === 'number') popup = Math.random() * 100 < opts.popupProb;
else if (opts && opts.popup === false) popup = false;
}
window.chatAddSystem('TA想问你一个问题。', { special: 'ask-msg' });
const askTs = Date.now();
const el = window.chatAddSystem(q.text, { special: 'ask-card', askQuestion: q.text, askOptions: isPick ? q.options : null, askType: isPick ? q.type : 'text', askTs: askTs, askMultiMax: (isPick && q.type === 'multi' && q.multiMax >= 2) ? q.multiMax : 0 });
try {
const d = taAskLoad();
d.history.push({ q: q.text, a: '', reply: '', ts: askTs, status: 'pending' });
taAskSave(d);
refreshAskRecordsIfOpen(); // #625：提问记录页开着时后台来的询问即时上屏
} catch (e) {}
const idx = el ? Number(el.dataset.idx) : -1;
if (window.bgNotifyCheck) window.bgNotifyCheck('TA想问你一个问题：' + q.text, Date.now(), { name: 'TA的询问', late: _lateNotify(), kind: 'ask' });
if (popup) {
if (document.hidden) { _enqueuePop(idx, 'openAskReply'); }
else {
const popSchedAt = Date.now();
setTimeout(() => {
if (autoPopupStale(popSchedAt) || document.hidden) return;
if (chatInputFocused()) return;
if (idx >= 0 && window.openAskReply && !cardPopupBusy()) window.openAskReply(idx);
}, 400);
}
}
}
function maybeTriggerTAAsk() {
try {
const d = taAskLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
if (s.enabled === false) return;
if (askDeadlinePassed(d)) return;
if (Date.now() - (d.lastAskAt || 0) < icCool(45) * 60000) return;
if (!interactGateOk()) return;
if (!taAskDcfOk()) return;
if (Math.random() * 100 >= icProb(window.dcpEff ? window.dcpEff(typeof s.prob === 'number' ? s.prob : 5) : (typeof s.prob === 'number' ? s.prob : 5))) return; // #518 套总档 → #1153 再套频率档
const q = taAskPick(d);
if (!q) return;
d.lastAskAt = Date.now();
taAskSave(d);
interactGateMark();
pushAsk(q, { popupProb: askPopupProb(s) });
} catch (e) {}
}
setTimeout(maybeTriggerTAAsk, 60000);
setInterval(maybeTriggerTAAsk, 240000);
function locateCardIdx(msgIdx, special, statusKey) {
let arr = [];
try { arr = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]')); } catch (e) {}
if (!Array.isArray(arr)) arr = [];
const rec = arr[msgIdx];
if (rec && rec.special === special && !rec[statusKey]) return msgIdx;
for (let i = arr.length - 1; i >= 0; i--) {
const r = arr[i];
if (r && r.special === special && !r[statusKey]) return i;
}
return -1;
}
function getCardAt(msgIdx) {
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) return msgs[msgIdx];
} catch (e) {}
return null;
}
window.openAskReply = function (msgIdx) {
if (!window.openModal) return;
if (askDeadlinePassed(taAskLoad())) { toast('已过问卷答题结束时间，不能再作答'); return; }
msgIdx = locateCardIdx(msgIdx, 'ask-card', 'askStatus');
if (msgIdx < 0) return;
let question = '';
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) question = msgs[msgIdx].askQuestion || msgs[msgIdx].text || '';
} catch (e) {}
window.openModal('回答TA的询问', '', (v) => {
const answer = (v || '').trim();
if (!answer) { toast('请输入回答'); return; }
let rec = getCardAt(msgIdx);
if (!rec || rec.special !== 'ask-card') {
const fixedIdx = locateCardIdx(msgIdx, 'ask-card', 'askStatus');
if (fixedIdx < 0) return;
msgIdx = fixedIdx;
}
if (window.chatAskReply) {
const chatReply = taAskTextReply();
if (chatReply) {
window.chatAskReply(msgIdx, answer, chatReply, { raw: true });
} else {
const defs = ['收到你的回答。', '好呀，我知道了。', '你这么说，我记住了。', '好的，我记在心里了。'];
const pool = window.getInteractPool ? window.getInteractPool('询问·回应', defs) : defs;
window.chatAskReply(msgIdx, answer, pool[Math.floor(Math.random() * pool.length)]);
}
toast('已回复TA的提问');
}
}, { staticText: 'TA 问你：' + question, textareaPlaceholder: '输入你的回答…' });
};
if (window.chatAskReply && !window.__taAskReplyWrapped) {
const _origChatAskReply = window.chatAskReply;
window.chatAskReply = function (msgIdx, answer, reply, opts) {
let rec = getCardAt(msgIdx);
if (!rec || rec.special !== 'ask-card' || rec.askStatus === 'answered') {
const _fixedIdx = locateCardIdx(msgIdx, 'ask-card', 'askStatus');
if (_fixedIdx >= 0) { msgIdx = _fixedIdx; rec = getCardAt(_fixedIdx); }
}
if (rec && rec.deskCk) return _origChatAskReply.call(this, msgIdx, answer, reply, opts);
if (askDeadlinePassed(taAskLoad())) { toast('已过问卷答题结束时间，不能再作答'); return undefined; }
const askTs = rec && rec.askTs ? rec.askTs : null;
const question = rec ? (rec.askQuestion || rec.text || '') : '';
const result = _origChatAskReply.call(this, msgIdx, answer, reply, opts);
if (result === undefined) return result;
try {
const d = taAskLoad();
let item = null;
if (askTs) {
for (let i = d.history.length - 1; i >= 0; i--) {
const h = d.history[i];
if (h && h.ts === askTs && h.status === 'pending') { item = h; break; }
}
}
if (item) { item.a = answer; item.reply = result; item.status = 'answered'; }
else { d.history.push({ q: question, a: answer, reply: result, ts: askTs || Date.now(), status: 'answered' }); }
taAskSave(d);
refreshAskRecordsIfOpen();
} catch (e) {}
return result;
};
window.__taAskReplyWrapped = true;
}
const page = document.getElementById('page-ta-ask');
if (!page) return;
window.triggerTaAskNow = function () {
const d = taAskLoad();
if (askDeadlinePassed(d)) { toast('已过问卷答题结束时间，不再发出询问'); return; }
const q = taAskPick(d);
if (!q) { toast('题库没有启用的问题'); return; }
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
d.lastAskAt = Date.now();
taAskSave(d);
pushAsk(q, { popupProb: askPopupProb(s) });
toast('TA 在聊天里向你提问了');
};
const nowBtn = document.getElementById('ta-ask-now');
if (nowBtn) nowBtn.addEventListener('click', () => window.triggerTaAskNow());
function renderAskSettings() {
const d = taAskLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
const enEl = document.getElementById('ta-ask-enable');
if (enEl) enEl.checked = s.enabled !== false;
const defEl = document.getElementById('ta-ask-default');
if (defEl) defEl.checked = s.useDefault !== false;
const ccEl = document.getElementById('ta-ask-chatcard');
if (ccEl) ccEl.checked = !!s.useChatReply;
const probEl = document.getElementById('ta-ask-prob');
const probVal = document.getElementById('ta-ask-prob-val');
if (probEl) probEl.value = typeof s.prob === 'number' ? s.prob : 5;
if (probVal) probVal.textContent = (typeof s.prob === 'number' ? s.prob : 5) + '%';
const popEl = document.getElementById('ta-ask-popup');
const popVal = document.getElementById('ta-ask-popup-val');
const pp = askPopupProb(s);
if (popEl) popEl.value = pp;
if (popVal) popVal.textContent = pp + '%';
const dlEl = document.getElementById('ta-ask-deadline');
const dl = askDeadlineMs(d);
if (dlEl) dlEl.textContent = dl ? fmtDeadlineText(dl) : '未设置';
}
const askEn = document.getElementById('ta-ask-enable');
if (askEn) askEn.addEventListener('change', () => {
const d = taAskLoad();
d.settings.enabled = askEn.checked;
taAskSave(d);
toast(askEn.checked ? 'TA的询问已开启' : 'TA的询问已关闭');
});
const askDefault = document.getElementById('ta-ask-default');
if (askDefault) askDefault.addEventListener('change', () => {
const d = taAskLoad();
d.settings.useDefault = askDefault.checked;
taAskSave(d);
switchAskTab(askTab);
toast(askDefault.checked ? '系统预设问题已开启' : '系统预设问题已关闭（仅用你添加的问题）');
});
const askChatCard = document.getElementById('ta-ask-chatcard');
if (askChatCard) askChatCard.addEventListener('change', () => {
const d = taAskLoad();
d.settings.useChatReply = askChatCard.checked;
taAskSave(d);
toast(askChatCard.checked ? '互动卡回应已接通聊天字卡/词典（文字+单选）' : '互动卡回应已恢复预设池回应');
});
const askProb = document.getElementById('ta-ask-prob');
if (askProb) askProb.addEventListener('input', () => {
const d = taAskLoad();
d.settings.prob = Math.max(0, Math.min(100, parseInt(askProb.value, 10) || 0));
taAskSave(d);
const v = document.getElementById('ta-ask-prob-val');
if (v) v.textContent = askProb.value + '%';
toast('触发概率已设为 ' + askProb.value + '%');
});
const askPopup = document.getElementById('ta-ask-popup');
if (askPopup) askPopup.addEventListener('input', () => {
const d = taAskLoad();
d.settings.popupProb = parseInt(askPopup.value, 10) || 0;
taAskSave(d);
const v = document.getElementById('ta-ask-popup-val');
if (v) v.textContent = askPopup.value + '%';
toast('弹窗概率已设为 ' + askPopup.value + '%');
});
const askDeadlineEl = document.getElementById('ta-ask-deadline');
const askDeadlineRow = askDeadlineEl ? askDeadlineEl.closest('.gs-row') : null;
if (askDeadlineRow) askDeadlineRow.addEventListener('click', (e) => {
if (e.target.closest('#ta-ask-deadline-clear')) return;
openDeadlinePicker('问卷答题结束时间', askDeadlineMs(taAskLoad()), (ts) => {
const d = taAskLoad();
d.settings.deadline = ts > 0 ? ts : 0;
taAskSave(d);
toast(d.settings.deadline ? '答题结束时间已设置：' + fmtDeadlineText(d.settings.deadline) : '答题结束时间已清除');
renderAskSettings();
});
});
const askDeadlineClear = document.getElementById('ta-ask-deadline-clear');
if (askDeadlineClear) askDeadlineClear.addEventListener('click', () => {
const d = taAskLoad();
if (!askDeadlineMs(d)) { toast('尚未设置答题结束时间'); return; }
d.settings.deadline = 0;
taAskSave(d);
if (askDeadlineEl) askDeadlineEl.textContent = '未设置';
toast('答题结束时间已清除');
});
renderAskSettings();
const batchCatEl = document.getElementById('ta-ask-batch-cat');
const batchTextEl = document.getElementById('ta-ask-batch');
const batchAddBtn = document.getElementById('ta-ask-batch-add');
function rebuildAskBatchCatSelect() {
if (!batchCatEl) return;
const d0 = taAskLoad();
batchCatEl.innerHTML = window.cardGroups.catOptsHtml(CATS, d0.groups || [], batchCatEl.value);
window.cardGroups.bindNewGrp(batchCatEl, d0.groups, function () { taAskSave(d0); });
}
if (batchCatEl && batchTextEl && batchAddBtn) {
rebuildAskBatchCatSelect();
bindTaInpClears(batchTextEl.parentElement);
batchAddBtn.addEventListener('click', () => {
const parsed = window.cardGroups.parseCatVal(batchCatEl.value);
if (!parsed) { toast('请先选择要导入的分类或分组'); return; }
const lines = (batchTextEl.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
if (!lines.length) { toast('请先输入问题，每行一个；单选题第一行用【问题】，下面每行一个选项'); return; }
const d2 = taAskLoad();
let cur = null, imported = 0, singles = 0;
const flush = () => {
if (!cur) return;
const q = { id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 9999), text: cur.text, cat: parsed.cat || 'daily', enabled: true, isPreset: false };
if (parsed.grp) q.grp = parsed.grp;
if (cur.opts.length >= 2) { q.type = cur.multi ? 'multi' : 'single'; q.options = cur.opts.slice(); if (cur.multi && cur.max >= 2) q.multiMax = cur.max; singles++; }
d2.questions.push(q);
imported++;
cur = null;
};
lines.forEach(t => {
const m = t.match(/^【(.+?)】$/);
if (m) {
flush();
const mk = askMultiMarkOf(m[1]);
if (mk.text) cur = { text: mk.text, opts: [], multi: mk.multi, max: mk.max || 0 };
return;
}
if (cur) { cur.opts.push(t); return; }
cur = { text: t, opts: [] };
flush();
});
flush();
if (!imported) { toast('没有可导入的问题'); return; }
taAskSave(d2);
let label;
if (parsed.grp) {
const g = (d2.groups || []).find(x => x.id === parsed.grp);
label = '分组「' + (g ? g.name : '未知') + '」';
} else {
label = (CATS.find(c => c[0] === parsed.cat) || [])[1] || parsed.cat;
}
batchTextEl.value = '';
renderAskMineWithForms();
toast('已导入 ' + imported + ' 个问题' + (singles ? '（含 ' + singles + ' 道单选题）' : '') + '到' + label);
});
}
const backBtn = document.getElementById('ta-ask-back');
if (backBtn) {
backBtn.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
const home = document.getElementById('page-chatcard');
if (home) home.hidden = false;
});
}
const catsEl = document.getElementById('ta-ask-sys-cats');
const mineCatsEl = document.getElementById('ta-ask-mine-cats');
let askTab = 'sys';
let askSysCat = null;
function renderAskCatsInto(container, presetOnly, search) {
if (!container) return;
const d = taAskLoad();
const useDefault = (d.settings || {}).useDefault !== false;
if (presetOnly) {
const counts = {};
CATS.forEach(([k]) => { counts[k] = d.questions.filter(q => q.cat === k && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0)).length; });
const hasCats = CATS.filter(([k]) => counts[k] > 0);
if (!hasCats.length) { container.innerHTML = '<div class="ta-empty" style="padding:14px">暂无系统预设问题</div>'; return; }
if (!askSysCat || !hasCats.some(([k]) => k === askSysCat)) askSysCat = hasCats[0][0];
let html = '<div class="card-tabs" style="padding:2px 2px 10px">';
hasCats.forEach(([k, label]) => {
html += '<button class="cc-tab' + (k === askSysCat ? ' sel' : '') + '" data-cat="' + k + '">' + escG(label) + '<em class="cc-tab-n">' + counts[k] + '</em></button>';
});
html += '</div>';
const sysCatLabel = escG((CATS.find(c => c[0] === askSysCat) || [])[1] || askSysCat);
html += window.presetGroup ? window.presetGroup.catBar('ta-ask', askSysCat, String(sysCatLabel)) : '';
const arr = d.questions.filter(q => q.cat === askSysCat && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0));
arr.forEach(q => {
const idx = d.questions.indexOf(q);
html += '<div class="ta-row' + (!useDefault ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox"' + (q.enabled !== false ? ' checked' : '') + ' data-idx="' + idx + '"><span class="tk"></span></label>' +
'<span class="ta-txt">' + q.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + askTypeBadge(q) + ' <span class="tc-known">系统</span></span>' +
'</div>';
html += interactPoolInlineHtml('询问·回应');
});
container.innerHTML = html;
if (window.presetGroup) window.presetGroup.bindBar(container.querySelector('.preset-cat-bar'), 'ta-ask', askSysCat, function () { renderAskCatsInto(container, true, search); });
container.querySelectorAll('.cc-tab[data-cat]').forEach(t => {
t.addEventListener('click', () => { askSysCat = t.dataset.cat; renderAskCatsInto(container, true, search); });
});
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = taAskLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
taAskSave(d2);
});
});
return;
}
let html = '';
CATS.forEach(([k, label]) => {
const arr = d.questions.filter(q => q.cat === k && (q.isPreset === true) === presetOnly && (search === '' || q.text.indexOf(search) >= 0));
if (!arr.length) return;
html += '<div class="cal-card glass"><div class="cal-card-title">' + label + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + arr.length + ')</span></div>';
arr.forEach(q => {
const idx = d.questions.indexOf(q);
const preset = q.isPreset === true;
const delBtn = preset ? '' : '<button class="ta-del" data-idx="' + idx + '">✕</button>';
html += '<div class="ta-row' + (preset && !useDefault ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox"' + (q.enabled !== false ? ' checked' : '') + ' data-idx="' + idx + '"><span class="tk"></span></label>' +
'<span class="ta-txt">' + q.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + askTypeBadge(q) + (preset ? ' <span class="tc-known">系统</span>' : '') + '</span>' +
delBtn +
'</div>';
if (presetOnly) html += interactPoolInlineHtml('询问·回应');
});
html += '</div>';
});
if (!html) html = '<div class="ta-empty" style="padding:14px">' + (presetOnly ? '暂无系统预设问题' : '暂未添加自定义问题，可在上方批量导入或下方逐条添加') + '</div>';
container.innerHTML = html;
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = taAskLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
taAskSave(d2);
});
});
container.querySelectorAll('.ta-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = taAskLoad();
const q = d2.questions[Number(b.dataset.idx)];
if (q && q.isPreset === true) { toast('系统预设问题不可删除，可关闭使用'); return; }
d2.questions.splice(Number(b.dataset.idx), 1);
taAskSave(d2);
renderAskCatsInto(container, false, search);
});
});
}
function askItemHtml(q, idx) {
return '<div class="ta-row">' +
'<label class="toggle"><input type="checkbox"' + (q.enabled !== false ? ' checked' : '') + ' data-idx="' + idx + '"><span class="tk"></span></label>' +
'<span class="ta-txt">' + escG(q.text) + askTypeBadge(q) + '</span>' +
'<button class="ta-del" data-idx="' + idx + '">✕</button>' +
'</div>';
}
function bindTaInpClears(root) {
if (!root) return;
root.querySelectorAll('.dec-inp-clear').forEach(btn => {
btn.addEventListener('click', () => {
const ta = document.getElementById(btn.dataset.clear);
if (!ta) return;
const box = ta.__ceBox;
if (box) box.textContent = '';
else ta.value = '';
ta.focus();
toast('已清空');
});
});
}
function askAddFormHtml(blockKey, grp, cat) {
return '<div class="ta-add">' +
'<select class="ta-type tc-input" data-key="' + blockKey + '">' +
'<option value="text">文字回复</option>' +
'<option value="single">单选题</option>' +
'<option value="multi">多选题</option>' +
'</select>' +
'<div class="dec-inp-wrap ta-inp-flex"><input id="ta-new-' + blockKey + '" type="text" placeholder="添加问题…"><button type="button" class="dec-inp-clear" data-clear="ta-new-' + blockKey + '" aria-label="清空" title="清空">✕</button></div>' +
'<button class="ta-add-btn" data-key="' + blockKey + '" data-cat="' + (cat || 'daily') + '" data-grp="' + (grp || '') + '">添加</button>' +
'<div class="dec-inp-wrap ta-opts-flex"><textarea id="ta-opts-' + blockKey + '" class="ta-opts tc-input" rows="3" placeholder="每行一个选项。可写 选项~TA回应；多条回应用 ; 分隔，如 听我说说话~好，我在听。;嗯，你慢慢说。" hidden></textarea><button type="button" class="dec-inp-clear" data-clear="ta-opts-' + blockKey + '" aria-label="清空" title="清空">✕</button></div>' +
'</div>';
}
function renderAskMineWithForms(search) {
if (!mineCatsEl) return;
const d = taAskLoad();
const groups = Array.isArray(d.groups) ? d.groups : [];
const mineQs = d.questions.filter(q => q.isPreset !== true && (search === '' || q.text.indexOf(search) >= 0));
let html = '';
html += '<div class="mg-grp-row"><button class="cc-tool" id="ask-grp-add"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>新建分组</button></div>';
if (!mineQs.length && !groups.length) {
html += '<div class="ta-empty" style="padding:14px">暂未添加自定义问题，可在上方批量导入或下方添加</div>';
mineCatsEl.innerHTML = html;
bindAskGroupOps();
return;
}
groups.forEach(g => {
const arr = mineQs.filter(q => q.grp === g.id);
html += '<div class="cal-card glass mg-block">' +
'<div class="cal-card-title mg-title"><span class="mg-name">' + escG(g.name) + '</span><span class="mg-cnt">(' + arr.length + ')</span>' +
'<span class="mg-ops"><button class="mg-op" data-askg="' + escG(g.id) + '" data-op="rn" title="重命名">✎</button><button class="mg-op" data-askg="' + escG(g.id) + '" data-op="rm" title="删除分组">✕</button></span></div>';
if (!arr.length) html += '<div class="ta-empty">这个分组还没有内容，可在下方直接添加</div>';
arr.forEach(q => { html += askItemHtml(q, d.questions.indexOf(q)); });
html += askAddFormHtml('g' + g.id, g.id, 'daily');
html += '</div>';
});
const ungrouped = mineQs.filter(q => !q.grp);
html += '<div class="cal-card glass mg-block mg-ungrouped"><div class="cal-card-title mg-title"><span class="mg-name">未分组 · 按系统分类</span><span class="mg-cnt">(' + ungrouped.length + ')</span></div>';
if (!ungrouped.length) html += '<div class="ta-empty">暂无未分组内容，可在上方批量导入（选择系统分类）</div>';
CATS.forEach(([k, label]) => {
const arr = ungrouped.filter(q => q.cat === k && (search === '' || q.text.indexOf(search) >= 0));
if (!arr.length) return;
html += '<div class="mg-subcat">' + label + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + arr.length + ')</span></div>';
arr.forEach(q => { html += askItemHtml(q, d.questions.indexOf(q)); });
html += askAddFormHtml('c' + k, '', k);
});
html += '</div>';
mineCatsEl.innerHTML = html;
bindTaInpClears(mineCatsEl);
mineCatsEl.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = taAskLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
taAskSave(d2);
});
});
mineCatsEl.querySelectorAll('.ta-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = taAskLoad();
const q = d2.questions[Number(b.dataset.idx)];
if (q && q.isPreset === true) { toast('系统预设问题不可删除'); return; }
d2.questions.splice(Number(b.dataset.idx), 1);
taAskSave(d2);
renderAskMineWithForms(search);
});
});
mineCatsEl.querySelectorAll('.ta-type').forEach(sel => {
const toggleOpts = () => {
const o = document.getElementById('ta-opts-' + sel.dataset.key);
if (!o) return;
o.hidden = sel.value !== 'single' && sel.value !== 'multi';
if (o.__ceBox) o.__ceBox.hidden = o.hidden;
else if (o.parentElement) o.parentElement.querySelectorAll('.ce-box').forEach(b => { b.hidden = o.hidden; });
};
sel.addEventListener('change', toggleOpts);
toggleOpts();
});
mineCatsEl.querySelectorAll('.ta-add-btn').forEach(b => {
b.addEventListener('click', () => {
const key = b.dataset.key;
const inp = document.getElementById('ta-new-' + key);
const v = inp ? inp.value.trim() : '';
if (!v) { toast('请输入问题'); return; }
const typeSel = b.parentElement.querySelector('.ta-type');
const type = typeSel ? typeSel.value : 'text';
const d2 = taAskLoad();
const q = { id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 999), text: v, cat: b.dataset.cat || 'daily', enabled: true, isPreset: false };
if (b.dataset.grp) q.grp = b.dataset.grp;
if (type === 'single' || type === 'multi') {
const optsEl = document.getElementById('ta-opts-' + key);
const opts = (optsEl ? optsEl.value : '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
const i = line.indexOf('~');
if (i < 0) return { t: line, reply: '' };
const t = line.slice(0, i).trim();
const replies = line.slice(i + 1).split(';').map(s => s.trim()).filter(Boolean);
return { t: t, reply: replies.length > 1 ? replies : (replies[0] || '') };
});
if (!opts.length) { toast((type === 'multi' ? '多选题' : '单选题') + '请填写选项，每行一个'); return; }
if (type === 'multi' && opts.length < 2) { toast('多选题至少填 2 个选项'); return; }
q.type = type;
q.options = opts;
}
d2.questions.push(q);
taAskSave(d2);
renderAskMineWithForms(search);
});
});
bindAskGroupOps();
}
function bindAskGroupOps() {
const grpAdd = document.getElementById('ask-grp-add');
if (grpAdd && !grpAdd.__bound) {
grpAdd.__bound = true;
grpAdd.addEventListener('click', () => {
const d2 = taAskLoad();
window.cardGroups.addFlow(d2.groups, g => {
if (!g) return;
taAskSave(d2);
rebuildAskBatchCatSelect();
renderAskMineWithForms();
toast('已新建分组「' + g.name + '」');
});
});
}
const wrap = document.getElementById('ta-ask-mine-cats');
if (!wrap) return;
wrap.querySelectorAll('.mg-op').forEach(b => {
if (b.__bound) return;
b.__bound = true;
b.addEventListener('click', () => {
const d2 = taAskLoad();
const gid = b.dataset.askg;
const g = (d2.groups || []).find(x => x.id === gid);
if (!g) return;
if (b.dataset.op === 'rn') {
window.cardGroups.renameFlow(g, d2.groups, name => {
if (!name) return;
g.name = name;
taAskSave(d2);
rebuildAskBatchCatSelect();
renderAskMineWithForms();
toast('分组已重命名');
});
} else if (b.dataset.op === 'rm') {
window.cardGroups.removeFlow(g.name, ok => {
if (!ok) return;
d2.questions.forEach(q => { if (q.grp === gid) q.grp = ''; });
d2.groups = d2.groups.filter(x => x.id !== gid);
taAskSave(d2);
rebuildAskBatchCatSelect();
renderAskMineWithForms();
toast('已删除分组「' + g.name + '」');
});
}
});
});
}
function switchAskTab(tab) {
askTab = tab;
const tabsWrap = document.getElementById('ta-ask-tabs');
if (tabsWrap) tabsWrap.querySelectorAll('.cc-tab').forEach(t => t.classList.toggle('sel', t.dataset.tab === tab));
const sysPanel = document.getElementById('ta-ask-sys-panel');
const minePanel = document.getElementById('ta-ask-mine-panel');
if (sysPanel) sysPanel.hidden = tab !== 'sys';
if (minePanel) minePanel.hidden = tab !== 'mine';
askSearch = '';
const searchInput = document.getElementById('ta-ask-search');
if (searchInput) searchInput.value = '';
if (tab === 'sys') renderAskCatsInto(catsEl, true, ''); else renderAskMineWithForms('');
}
const askTabsWrap = document.getElementById('ta-ask-tabs');
if (askTabsWrap) {
askTabsWrap.querySelectorAll('.cc-tab').forEach(tab => {
tab.addEventListener('click', () => switchAskTab(tab.dataset.tab));
});
}
let askSearch = '';
const askSearchInput = document.getElementById('ta-ask-search');
if (askSearchInput) {
askSearchInput.addEventListener('input', () => {
askSearch = askSearchInput.value.trim();
if (askTab === 'sys') renderAskCatsInto(catsEl, true, askSearch);
else renderAskMineWithForms(askSearch);
});
}
const li = document.getElementById('li-ta-ask');
if (li) {
li.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
page.hidden = false;
const tw = document.getElementById('ta-ask-tabs'); if (tw) tw.style.display = 'none';
switchAskTab('sys');
});
}
const liTC = document.getElementById('li-ta-choose');
const tcPage = document.getElementById('page-ta-choose');
if (liTC && tcPage) {
liTC.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
tcPage.hidden = false;
const tw = document.getElementById('tc-tabs'); if (tw) tw.style.display = 'none';
switchTCTab('sys');
});
}
const tcBackBtn = document.getElementById('tc-choose-back');
if (tcBackBtn) {
tcBackBtn.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
const home = document.getElementById('page-chatcard');
if (home) home.hidden = false;
});
}
function ckHold(k) { try { return !!(window.xyBigWriteHold && window.xyBigWriteHold(store, k)); } catch (e) { return false; } }
const KEY2 = 'ta-choose';
const TC_CAT_LABEL = { daily: '日常', like: '喜好', fun: '趣味', rel: '关系', hypo: '假设', star: '摸鱼', world: '两个世界' };
const TC_DEFAULT = [
{ id: "cd1", cat: "daily", text: "我们谁先说晚安？", pref: 3, options: [
{ t: "我", reply: ["说完晚安之后真的会乖乖睡觉吗？"], liked: false }, { t: "你", reply: ["那估计会很晚吧"], liked: false }, { t: "一起说", reply: ["有点考验默契呢"], liked: true }, { t: "谁先睡觉谁先说", reply: ["那约好每天都要说晚安了哦"], liked: false }] },
{ id: "cl1", cat: "like", text: "喜欢什么天气？", pref: 1, options: [
{ t: "晴天", reply: ["阳光正好"], liked: false }, { t: "雨天", reply: ["可以一起待在家里"], liked: true }, { t: "下雪天", reply: ["要一起去看雪吗？"], liked: false }, { t: "阴天", reply: ["出行、运动都很舒适的天气"], liked: false }] },
{ id: "cf1", cat: "fun", text: "最喜欢哪个季节？", pref: 1, options: [
{ t: "春", reply: ["一起去看樱花吗？"], liked: false }, { t: "夏", reply: ["蝉鸣也是夏天的特色"], liked: true }, { t: "秋", reply: ["踩落叶的声音很好听"], liked: false }, { t: "冬", reply: ["在家里吃上热乎乎的一顿刚刚好"], liked: false }] },
{ id: "cr1", cat: "rel", text: "更喜欢聊天还是安静陪伴？", pref: 1, options: [
{ t: "聊天", reply: ["我也想听你说很多很多，说什么都行"], liked: false }, { t: "安静陪伴", reply: ["不说也能心意相通"], liked: true }, { t: "都要", reply: ["陪伴的最佳形式？"], liked: false }] },
{ id: "ch1", cat: "hypo", text: "去游乐园的话，想先玩什么设施？", pref: 1, options: [
{ t: "过山车", reply: ["游乐园的必玩项目"], liked: false }, { t: "水上滑梯", reply: ["需要多准备一套衣服呢"], liked: false }, { t: "逛逛观光设施", reply: ["灯火里散步也很浪漫"], liked: false }, { t: "摩天轮", reply: ["许多故事开始的地方"], liked: true }] },
{ id: "cs1", cat: "star", text: "给你一颗不知名的种子，你觉得能种出什么？", pref: 1, options: [
{ t: "观叶植物", reply: ["有些意外，为什么呢？"], liked: false }, { t: "观花植物", reply: ["有什么喜欢的花吗？"], liked: true }, { t: "魔法植物", reply: ["也不是不行"], liked: false }, { t: "什么都种不出来", reply: ["种子坏"], liked: false }] },
{ id: "cw1", cat: "world", text: "各种类型的作品里喜欢青梅竹马还是天降？", pref: 1, options: [
{ t: "青梅竹马", reply: ["陪伴是最长情的告白"], liked: false }, { t: "天降", reply: ["也算是一种命中注定？"], liked: true }, { t: "青梅竹马，但有一天突然心动", reply: ["有些人在注意到之前就自带色彩"], liked: false }, { t: "两种都很好", reply: ["不同情境下确实不一样呢"], liked: false }] },
];
const TC_CAT_ORDER = ['daily', 'like', 'fun', 'rel', 'hypo', 'star', 'world'];
let _tcSessionTriggered = false; // 会话级：一次会话最多触发 1 个
let _tcAskedIds = [];            // 本次会话问过的题目 id（继续问时排除）
let _tcChain = 0;                // 继续问链计数（最多 3 题）
function tcOptLabelSync(d) {
let changed = false;
TC_DEFAULT.forEach(def => {
const local = (d.questions || []).find(x => x && x.id === def.id && x.isPreset === true);
if (!local || !Array.isArray(local.options) || local.options.length !== def.options.length) return;
def.options.forEach((defOpt, i) => {
const lo = local.options[i];
if (lo && lo.t !== defOpt.t) { lo.t = defOpt.t; changed = true; }
});
});
return changed;
}
function tcMerge(d) {
const ids = {};
(d.questions || []).forEach(q => { if (q && q.id) ids[q.id] = true; });
const merged = Array.isArray(d.mergedIds) ? d.mergedIds.slice() : [];
const mergedSet = {};
merged.forEach(id => { if (id) mergedSet[id] = true; });
let changed = tcOptLabelSync(d);
TC_DEFAULT.forEach(q => {
if (!mergedSet[q.id] && !ids[q.id]) {
const nq = { id: q.id, cat: q.cat, text: q.text, pref: q.pref,
options: q.options.map(o => ({ t: o.t, reply: o.reply, liked: o.liked === true })), enabled: true };
nq.isPreset = true; // v3.6.x：系统预设标记——预设只可启停、不可删除
d.questions.push(nq);
changed = true;
} else if (ids[q.id]) {
const local = d.questions.find(x => x && x.id === q.id);
if (local && local.isPreset === true && Array.isArray(local.options)) {
q.options.forEach(defOpt => {
const lo = local.options.find(o => o && o.t === defOpt.t);
if (lo) {
const defR = defOpt.reply, loR = lo.reply;
const same = (Array.isArray(defR) && Array.isArray(loR) && defR.length === loR.length && defR.every((v, i) => v === loR[i])) || (!Array.isArray(defR) && !Array.isArray(loR) && defR === loR);
if (!same) { lo.reply = defR; changed = true; }
}
});
}
}
});
TC_DEFAULT.forEach(q => {
if (!mergedSet[q.id]) { merged.push(q.id); mergedSet[q.id] = true; changed = true; }
});
TC_DEFAULT.forEach(q => {
if (ids[q.id] && d.questions.some(x => x && x.id === q.id && x.isPreset !== true)) {
d.questions.forEach(x => { if (x && x.id === q.id) x.isPreset = true; });
changed = true;
}
});
if (changed) d.mergedIds = merged;
return changed;
}
function tcLoad() {
let d = null;
try { d = JSON.parse(store.get(KEY2) || 'null'); } catch (e) { d = null; }
if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY2)) store.requestBigKey(KEY2); } catch (e0) {} }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5 };
if (d.settings.useDefault === undefined) d.settings.useDefault = true;
migrateInteractProb(d, KEY2, [15, 8]);
if (!Array.isArray(d.questions) || !d.questions.length) {
const isNew = !store.get(KEY2);
d.questions = TC_DEFAULT.map(q => {
const nq = { id: q.id, cat: q.cat, text: q.text, pref: q.pref,
options: q.options.map(o => ({ t: o.t, reply: o.reply, liked: o.liked === true })), enabled: true };
nq.isPreset = true;
return nq;
});
d.mergedIds = TC_DEFAULT.map(q => q.id);
if (!isNew && !ckHold(KEY2)) { try { store.set(KEY2, JSON.stringify(d)); } catch (e) {} }
} else {
if (tcMerge(d) && !ckHold(KEY2)) { try { store.set(KEY2, JSON.stringify(d)); } catch (e) {} }
}
if (!Array.isArray(d.history)) d.history = [];
if (!Array.isArray(d.favs)) d.favs = [];
if (!Array.isArray(d.groups)) d.groups = [];
return d;
}
function tcSave(d) {
if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY2, 'TA 的小问题库')) return false;
try { store.set(KEY2, JSON.stringify(d)); } catch (e) {}
return true;
}
function tcPick(d) {
const useDefault = (d.settings || {}).useDefault !== false;
const ready = function (q) { return q.text && q.options && q.options.length >= 2; };
const qs = d.questions.filter(q => q.enabled !== false && ready(q) && (useDefault || !q.isPreset) && presetCatOpen('ta-choose', q));
const presetInStore = d.questions.some(q => q.isPreset === true && ready(q));
const fallback = (qs.length || presetInStore) ? qs : TC_DEFAULT.filter(q => !pgCatOff('ta-choose', q.cat));
const pool = fallback.filter(q => _tcAskedIds.indexOf(q.id) === -1);
const src = pool.length ? pool : fallback;
return src[Math.floor(Math.random() * src.length)];
}
function tcPush(q, opts) {
if (!window.chatAddSystem) return;
_tcSessionTriggered = true;
if (q.id && _tcAskedIds.indexOf(q.id) === -1) _tcAskedIds.push(q.id);
const d = tcLoad();
d.lastChoiceAt = Date.now();
tcSave(d);
let popup = true;
if (opts && typeof opts.popupProb === 'number') popup = Math.random() * 100 < opts.popupProb;
else if (opts && opts.popup === false) popup = false;
window.chatAddSystem('TA想让你选一个答案。', { special: 'ask-msg' });
const el = window.chatAddSystem(q.text, {
special: 'ask-choose', choiceQuestion: q.text, choiceOptions: q.options, choicePref: q.pref, choiceCat: q.cat || ''
});
const idx = el ? Number(el.dataset.idx) : -1;
if (window.bgNotifyCheck) window.bgNotifyCheck('TA想让你选一个答案：' + q.text, Date.now(), { name: 'TA的小问题', late: _lateNotify(), kind: 'ask' });
if (popup) {
if (document.hidden) { _enqueuePop(idx, 'openTC'); }
else {
const popSchedAt = Date.now();
setTimeout(() => {
if (autoPopupStale(popSchedAt) || document.hidden) return;
if (chatInputFocused()) return;
if (idx >= 0 && window.openTC && !cardPopupBusy()) window.openTC(idx);
}, 400);
}
}
}
function maybeTriggerTC() {
try {
const d = tcLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
if (s.enabled === false) return;
if (_tcSessionTriggered) return;
if (Date.now() - (d.lastChoiceAt || 0) < icCool(30) * 60000) return;
if (!interactGateOk()) return;
if (!taAskDcfOk()) return;
if (Math.random() * 100 >= icProb(window.dcpEff ? window.dcpEff(typeof s.prob === 'number' ? s.prob : 5) : (typeof s.prob === 'number' ? s.prob : 5))) return; // #518 套总档 → #1153 再套频率档
const q = tcPick(d);
if (!q) return;
interactGateMark();
tcPush(q, { popupProb: askPopupProb(s) });
} catch (e) {}
}
setTimeout(maybeTriggerTC, 90000);
setInterval(maybeTriggerTC, 240000);
function openTCPanel(title, html) {
const mask = document.getElementById('tc-mask');
const body = document.getElementById('tc-body');
const titleEl = document.getElementById('tc-panel-title');
if (!mask || !body) return;
if (titleEl) titleEl.textContent = title;
body.innerHTML = html;
if (window.mochiPickDoorSweep) { try { window.mochiPickDoorSweep(true); } catch (eS) {} }
body.scrollTop = 0;
mask.hidden = false;
}
window.openTCPanel = openTCPanel;
const tcClose = document.getElementById('tc-mask-close');
if (tcClose) tcClose.addEventListener('click', () => { document.getElementById('tc-mask').hidden = true; });
window.openTC = function (msgIdx) {
msgIdx = locateCardIdx(msgIdx, 'ask-choose', 'choiceStatus');
if (msgIdx < 0) return;
let rec = null;
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) rec = msgs[msgIdx];
} catch (e) {}
if (!rec || rec.special !== 'ask-choose') return;
if (rec.choiceStatus === 'answered') { renderTCResult(msgIdx); return; }
const opts = rec.choiceOptions || [];
let html = '<div class="tc-hint">TA想问你</div><div class="tc-q">' + ((rec.choiceQuestion || rec.text || '')) + '</div>';
opts.forEach((o, i) => {
html += '<div class="tc-opt" data-i="' + i + '">' + String(o.t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>';
});
openTCPanel('TA的小问题', html);
document.querySelectorAll('#tc-body .tc-opt').forEach(el => {
el.addEventListener('click', () => {
const i = Number(el.dataset.i);
submitTC(msgIdx, i);
});
});
};
function submitTC(msgIdx, optIdx) {
let rec = getCardAt(msgIdx);
if (!rec || rec.special !== 'ask-choose') {
msgIdx = locateCardIdx(msgIdx, 'ask-choose', 'choiceStatus');
if (msgIdx < 0) return;
rec = getCardAt(msgIdx);
}
if (!rec || rec.special !== 'ask-choose' || rec.choiceStatus === 'answered') return;
const opts = rec.choiceOptions || [];
const opt = opts[optIdx];
if (!opt) return;
const prefIdx = typeof rec.choicePref === 'number' ? rec.choicePref : 0;
const prefTxt = opts[prefIdx] ? opts[prefIdx].t : '';
const isPref = optIdx === prefIdx;
const isLiked = opt.liked === true || opt.liked === 'true';
const matchTxt = isPref ? '✦ 刚好想到了一起'
: isLiked ? '你们想得不一样，不过TA似乎很喜欢你的答案'
: '这次没有选到一起。TA心里想的是：「' + prefTxt + '」';
if (window.chatChooseReply) window.chatChooseReply(msgIdx, String(opt.t || ''), opt, matchTxt);
const d = tcLoad();
d.history.unshift({ q: rec.choiceQuestion, my: rec.choiceAnswer, reply: rec.choiceReply, match: matchTxt, cat: rec.choiceCat || '', ts: Date.now() });
tcSave(d);
refreshAskRecordsIfOpen();
const tcMaskEl = document.getElementById('tc-mask');
if (tcMaskEl) tcMaskEl.hidden = true;
}
function renderTCResult(msgIdx) {
let rec = null;
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) rec = msgs[msgIdx];
} catch (e) {}
if (!rec) return;
const opts = rec.choiceOptions || [];
const prefIdx = typeof rec.choicePref === 'number' ? rec.choicePref : 0;
const prefTxt = opts[prefIdx] ? opts[prefIdx].t : '';
const isPref = (rec.choiceMatch || '').indexOf('✦') >= 0;
const d = tcLoad();
const existed = d.favs.some(f => f.q === rec.choiceQuestion);
let html = '';
html += '<div class="tc-res-head"><span>你的选择</span><button class="tc-fav-btn" id="tc-fav">' + (existed ? '★' : '☆') + '</button></div>';
html += '<div class="tc-res-mine">' + String(rec.choiceAnswer || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>';
if (!isPref) {
html += '<div class="tc-res-label">TA心里的答案</div><div class="tc-res-pref">' + String(prefTxt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>';
}
html += '<div class="tc-res-line"></div>';
const _chShow = (window.askCardReplyClean ? window.askCardReplyClean(rec.choiceReply || '') : (rec.choiceReply || '')); // FIX 2026-09-17 #648 存量媒体卡回应清洗后展示
html += '<div class="tc-res-reply"><b>' + (window.taFit ? window.taFit('TA：') : 'TA：') + '</b>“' + String(window.taFit ? window.taFit(_chShow) : _chShow).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '”</div>';
html += '<div class="tc-res-match ' + (isPref ? 'pref' : '') + '">' + String(rec.choiceMatch || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>';
if (Math.random() < 0.4 && _tcChain < 2) {
html += '<div class="tc-res-cont" id="tc-cont">TA还想问一个 ▸</div>';
}
html += '<div class="tc-res-close" id="tc-close2">收起来</div>';
openTCPanel('TA的小问题', html);
const favBtn = document.getElementById('tc-fav');
if (favBtn) {
favBtn.addEventListener('click', () => {
if (existed) { toast('这道题已在收藏里'); return; }
d.favs.unshift({ q: rec.choiceQuestion, my: rec.choiceAnswer, reply: rec.choiceReply, match: rec.choiceMatch, cat: rec.choiceCat || '', ts: Date.now() });
tcSave(d);
toast('已收藏这道题');
favBtn.textContent = '★';
});
}
const cont = document.getElementById('tc-cont');
if (cont) {
cont.addEventListener('click', () => {
if (_tcChain >= 2) { toast('今天TA问得够多啦'); document.getElementById('tc-mask').hidden = true; return; }
const d2 = tcLoad();
const q = tcPick(d2);
if (!q) return;
_tcChain++;
tcPush(q);
document.getElementById('tc-mask').hidden = true;
});
}
document.getElementById('tc-close2').addEventListener('click', () => { document.getElementById('tc-mask').hidden = true; });
}
let tcTab = 'sys';
function renderTCSettings() {
const d = tcLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
const enEl = document.getElementById('tc-enable');
if (enEl) enEl.checked = s.enabled !== false;
const defEl = document.getElementById('tc-default');
if (defEl) defEl.checked = s.useDefault !== false;
const popEl = document.getElementById('tc-popup');
const popVal = document.getElementById('tc-popup-val');
const pp = askPopupProb(s);
if (popEl) popEl.value = pp;
if (popVal) popVal.textContent = pp + '%';
const probEl = document.getElementById('tc-prob');
const probVal = document.getElementById('tc-prob-val');
if (probEl) probEl.value = typeof s.prob === 'number' ? s.prob : 5;
if (probVal) probVal.textContent = (typeof s.prob === 'number' ? s.prob : 5) + '%';
const favBtn = document.getElementById('tc-favs');
if (favBtn) favBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px"><path d="M12 2l2.4 5 5.6.8-4 4 .9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-4 5.6-.8z"/></svg>' + '收藏（' + d.favs.length + '）';
}
function escT(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function optReplyLabel(o) {
if (!o) return '';
if (Array.isArray(o.reply) && o.reply.length) {
const arr = o.reply.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());
if (!arr.length) return '';
return arr.join(' ｜ ');
}
if (typeof o.reply === 'string' && o.reply.trim()) return o.reply.trim();
return '';
}
let tcSysCat = null;
function renderTCCatsInto(container, presetOnly, search) {
if (!container) return;
const d = tcLoad();
const useDefault = (d.settings || {}).useDefault !== false;
if (presetOnly) {
const counts = {};
TC_CAT_ORDER.forEach(k => { counts[k] = d.questions.filter(q => q.cat === k && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0)).length; });
const hasCats = TC_CAT_ORDER.filter(k => counts[k] > 0);
if (!hasCats.length) { container.innerHTML = '<div class="ta-empty">暂无系统预设问题</div>'; return; }
if (!tcSysCat || !hasCats.includes(tcSysCat)) tcSysCat = hasCats[0];
let html = '<div class="card-tabs" style="padding:2px 2px 10px">';
hasCats.forEach(k => {
html += '<button class="cc-tab' + (k === tcSysCat ? ' sel' : '') + '" data-cat="' + k + '">' + escT(TC_CAT_LABEL[k] || k) + '<em class="cc-tab-n">' + counts[k] + '</em></button>';
});
html += '</div>';
const sysCatLabel = escT(TC_CAT_LABEL[tcSysCat] || tcSysCat);
html += window.presetGroup ? window.presetGroup.catBar('ta-choose', tcSysCat, String(sysCatLabel)) : '';
const arr = d.questions.filter(q => q.cat === tcSysCat && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0));
arr.forEach(q => {
const idx = d.questions.indexOf(q);
html += '<div class="tc-qrow' + (q.enabled === false || !useDefault ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + ' <span class="tc-known">系统</span></div>' +
'<div class="tc-qopts">选项：' + q.options.map(o => escT(o.t) + (optReplyLabel(o) ? ' <span class="tc-opt-reply">→ ' + escT(optReplyLabel(o)) + '</span>' : '')).join(' / ') + '</div></div>' +
'</div>';
});
container.innerHTML = html;
if (window.presetGroup) window.presetGroup.bindBar(container.querySelector('.preset-cat-bar'), 'ta-choose', tcSysCat, function () { renderTCCatsInto(container, true, search); });
container.querySelectorAll('.cc-tab[data-cat]').forEach(t => {
t.addEventListener('click', () => { tcSysCat = t.dataset.cat; renderTCCatsInto(container, true, search); });
});
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = tcLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
tcSave(d2);
});
});
return;
}
let html = '';
TC_CAT_ORDER.forEach(k => {
const arr = d.questions.filter(q => q.cat === k && (q.isPreset === true) === presetOnly && (search === '' || q.text.indexOf(search) >= 0));
if (!arr.length) return;
html += '<div class="tc-cat-t">' + (TC_CAT_LABEL[k] || k) + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + arr.length + ')</span></div>';
arr.forEach(q => {
const idx = d.questions.indexOf(q);
const preset = q.isPreset === true;
const delBtn = preset ? '' : '<button class="ta-del" data-idx="' + idx + '">✕</button>';
html += '<div class="tc-qrow' + (q.enabled === false || (preset && !useDefault) ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + (preset ? ' <span class="tc-known">系统</span>' : '') + '</div>' +
'<div class="tc-qopts">选项：' + q.options.map(o => escT(o.t) + (optReplyLabel(o) ? ' <span class="tc-opt-reply">→ ' + escT(optReplyLabel(o)) + '</span>' : '')).join(' / ') + '</div></div>' +
delBtn +
'</div>';
});
});
if (!html) html = '<div class="ta-empty">' + (presetOnly ? '暂无系统预设问题' : '暂未添加自定义问题，可在上方添加') + '</div>';
container.innerHTML = html;
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = tcLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
tcSave(d2);
});
});
container.querySelectorAll('.ta-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = tcLoad();
const q = d2.questions[Number(b.dataset.idx)];
if (q && q.isPreset === true) { toast('系统预设问题不可删除'); return; }
d2.questions.splice(Number(b.dataset.idx), 1);
tcSave(d2);
renderTCCatsInto(container, false, search);
});
});
}
function renderMineGroupsInto(container, opt, search) {
if (!container) return;
const d = opt.load();
const groups = Array.isArray(d.groups) ? d.groups : [];
const items = d.questions.filter(q => q.isPreset !== true && (search === '' || q.text.indexOf(search) >= 0));
let html = '';
html += '<div class="mg-grp-row"><button class="cc-tool mg-grp-add"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>新建分组</button></div>';
if (!items.length && !groups.length) {
html += '<div class="ta-empty">' + opt.emptyTip + '</div>';
container.innerHTML = html;
bindMineGroups(container, opt);
return;
}
groups.forEach(g => {
const arr = items.filter(q => q.grp === g.id);
html += '<div class="cal-card glass mg-block">' +
'<div class="cal-card-title mg-title"><span class="mg-name">' + escG(g.name) + '</span><span class="mg-cnt">(' + arr.length + ')</span>' +
'<span class="mg-ops"><button class="mg-op" data-g="' + escG(g.id) + '" data-op="rn" title="重命名">✎</button><button class="mg-op" data-g="' + escG(g.id) + '" data-op="rm" title="删除分组">✕</button></span></div>' +
(arr.length ? arr.map(q => opt.rowHtml(q, d.questions.indexOf(q))).join('') : '<div class="ta-empty">这个分组还没有内容</div>') +
'</div>';
});
const ungrouped = items.filter(q => !q.grp);
html += '<div class="cal-card glass mg-block mg-ungrouped"><div class="cal-card-title mg-title"><span class="mg-name">未分组 · 按系统分类</span><span class="mg-cnt">(' + ungrouped.length + ')</span></div>';
if (!ungrouped.length) html += '<div class="ta-empty">暂无未分组内容，可在上方添加（选择系统分类）</div>';
opt.order.forEach(k => {
const arr = ungrouped.filter(q => q.cat === k && (search === '' || q.text.indexOf(search) >= 0));
if (!arr.length) return;
html += '<div class="mg-subcat">' + escG(opt.label[k] || k) + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + arr.length + ')</span></div>';
html += arr.map(q => opt.rowHtml(q, d.questions.indexOf(q))).join('');
});
html += '</div>';
container.innerHTML = html;
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = opt.load();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
opt.save(d2);
});
});
container.querySelectorAll('.ta-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = opt.load();
const q = d2.questions[Number(b.dataset.idx)];
if (q && q.isPreset === true) { toast('系统预设问题不可删除'); return; }
d2.questions.splice(Number(b.dataset.idx), 1);
opt.save(d2);
renderMineGroupsInto(container, opt, search);
});
});
bindMineGroups(container, opt);
}
function bindMineGroups(container, opt) {
container.querySelectorAll('.mg-grp-add').forEach(b => {
if (b.__bound) return;
b.__bound = true;
b.addEventListener('click', () => {
const d2 = opt.load();
window.cardGroups.addFlow(d2.groups, g => {
if (!g) return;
opt.save(d2);
renderMineGroupsInto(container, opt);
toast('已新建分组「' + g.name + '」');
});
});
});
container.querySelectorAll('.mg-op').forEach(b => {
if (b.__bound) return;
b.__bound = true;
b.addEventListener('click', () => {
const d2 = opt.load();
const gid = b.dataset.g;
const g = (d2.groups || []).find(x => x.id === gid);
if (!g) return;
if (b.dataset.op === 'rn') {
window.cardGroups.renameFlow(g, d2.groups, name => {
if (!name) return;
opt.save(d2);
renderMineGroupsInto(container, opt);
toast('分组已重命名');
});
} else if (b.dataset.op === 'rm') {
window.cardGroups.removeFlow(g.name, ok => {
if (!ok) return;
d2.questions.forEach(q => { if (q.grp === gid) q.grp = ''; });
d2.groups = d2.groups.filter(x => x.id !== gid);
opt.save(d2);
renderMineGroupsInto(container, opt);
toast('已删除分组「' + g.name + '」');
});
}
});
});
}
const tcMineOpt = {
load: tcLoad, save: tcSave, order: TC_CAT_ORDER, label: TC_CAT_LABEL,
emptyTip: '暂未添加自定义问题，可在上方添加',
rowHtml: function (q, idx) {
return '<div class="tc-qrow' + (q.enabled === false ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + '</div>' +
'<div class="tc-qopts">选项：' + q.options.map(o => escT(o.t)).join(' / ') + '</div></div>' +
'<button class="ta-del" data-idx="' + idx + '">✕</button></div>';
}
};
function switchTCTab(tab) {
tcTab = tab;
renderTCSettings();
const tabsWrap = document.getElementById('tc-tabs');
if (tabsWrap) tabsWrap.querySelectorAll('.cc-tab').forEach(t => t.classList.toggle('sel', t.dataset.tab === tab));
const sysPanel = document.getElementById('tc-sys-panel');
const minePanel = document.getElementById('tc-mine-panel');
if (sysPanel) sysPanel.hidden = tab !== 'sys';
if (minePanel) minePanel.hidden = tab !== 'mine';
tcSearch = '';
const searchInput = document.getElementById('tc-search');
if (searchInput) searchInput.value = '';
if (tab === 'sys') renderTCCatsInto(document.getElementById('tc-sys-cats'), true, '');
else renderMineGroupsInto(document.getElementById('tc-mine-cats'), tcMineOpt, '');
}
const tcTabsWrap = document.getElementById('tc-tabs');
if (tcTabsWrap) {
tcTabsWrap.querySelectorAll('.cc-tab').forEach(tab => {
tab.addEventListener('click', () => switchTCTab(tab.dataset.tab));
});
}
let tcSearch = '';
const tcSearchInput = document.getElementById('tc-search');
if (tcSearchInput) {
tcSearchInput.addEventListener('input', () => {
tcSearch = tcSearchInput.value.trim();
if (tcTab === 'sys') renderTCCatsInto(document.getElementById('tc-sys-cats'), true, tcSearch);
else renderMineGroupsInto(document.getElementById('tc-mine-cats'), tcMineOpt, tcSearch);
});
}
const tcEn = document.getElementById('tc-enable');
if (tcEn) {
tcEn.addEventListener('change', () => {
const d = tcLoad();
d.settings.enabled = tcEn.checked;
tcSave(d);
toast(tcEn.checked ? 'TA的小问题已开启' : 'TA的小问题已关闭');
});
}
const tcDefault = document.getElementById('tc-default');
if (tcDefault) {
tcDefault.addEventListener('change', () => {
const d = tcLoad();
d.settings.useDefault = tcDefault.checked;
tcSave(d);
switchTCTab(tcTab);
toast(tcDefault.checked ? '系统预设问题已开启' : '系统预设问题已关闭（仅用你添加的问题）');
});
}
const tcProb = document.getElementById('tc-prob');
if (tcProb) {
tcProb.addEventListener('input', () => {
const d = tcLoad();
d.settings.prob = Math.max(0, Math.min(100, parseInt(tcProb.value, 10) || 0));
tcSave(d);
const v = document.getElementById('tc-prob-val');
if (v) v.textContent = tcProb.value + '%';
toast('触发概率已设为 ' + tcProb.value + '%');
});
}
const tcPopup = document.getElementById('tc-popup');
if (tcPopup) {
tcPopup.addEventListener('input', () => {
const d = tcLoad();
d.settings.popupProb = parseInt(tcPopup.value, 10) || 0;
tcSave(d);
const v = document.getElementById('tc-popup-val');
if (v) v.textContent = tcPopup.value + '%';
toast('弹窗概率已设为 ' + tcPopup.value + '%');
});
}
const tcNewAdd = document.getElementById('tc-new-add');
if (tcNewAdd) {
(function rebuildTCSelect() {
const catEl = document.getElementById('tc-new-cat');
if (!catEl) return;
const d0 = tcLoad();
catEl.innerHTML = window.cardGroups.catOptsHtml(TC_CAT_ORDER.map(k => [k, TC_CAT_LABEL[k]]), d0.groups || [], catEl.value);
window.cardGroups.bindNewGrp(catEl, d0.groups, function () { tcSave(d0); });
})();
tcNewAdd.addEventListener('click', () => {
const catEl = document.getElementById('tc-new-cat');
const textEl = document.getElementById('tc-new-text');
const optsEl = document.getElementById('tc-new-opts');
const text = textEl ? textEl.value.trim() : '';
const optsRaw = optsEl ? optsEl.value.trim() : '';
const parsed = window.cardGroups.parseCatVal(catEl ? catEl.value : 'daily');
if (!parsed) { toast('请先选择分类或分组'); return; }
if (!text) { toast('请输入问题内容'); return; }
const parts = optsRaw.split('|').map(s => s.trim()).filter(Boolean);
if (parts.length < 2) { toast('请至少输入 2 个选项，用 | 分隔'); return; }
if (parts.length > 4) { toast('选项最多 4 个'); return; }
const options = parts.map(p => {
let t = p, reply = '';
const ti = p.indexOf('~');
if (ti > 0) {
t = p.slice(0, ti).trim();
const replies = p.slice(ti + 1).split(';').map(s => s.trim()).filter(Boolean);
reply = replies.length > 1 ? replies : (replies[0] || '');
}
if (!t) return null;
if (!reply) reply = '嗯，听你的。';
return { t: t, reply: reply, liked: false };
}).filter(Boolean);
if (options.length < 2) { toast('选项格式有误，请用 | 分隔'); return; }
const d = tcLoad();
const q = { id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 9999), cat: parsed.cat || 'daily', text: text, pref: Math.floor(Math.random() * options.length), options: options, enabled: true, isPreset: false };
if (parsed.grp) q.grp = parsed.grp;
d.questions.push(q);
tcSave(d);
if (textEl) textEl.value = '';
if (optsEl) optsEl.value = '';
renderMineGroupsInto(document.getElementById('tc-mine-cats'), tcMineOpt);
toast('已添加问题');
});
}
const tcNewGrp = document.getElementById('tc-new-grp');
if (tcNewGrp) {
tcNewGrp.addEventListener('click', () => {
const d = tcLoad();
window.cardGroups.addFlow(d.groups, g => {
if (!g) return;
tcSave(d);
(function refreshTCSelect() {
const catEl = document.getElementById('tc-new-cat');
if (catEl) {
catEl.innerHTML = window.cardGroups.catOptsHtml(TC_CAT_ORDER.map(k => [k, TC_CAT_LABEL[k]]), d.groups, catEl.value);
window.cardGroups.bindNewGrp(catEl, d.groups);
}
})();
if (tcTab === 'mine') renderMineGroupsInto(document.getElementById('tc-mine-cats'), tcMineOpt);
toast('已新建分组「' + g.name + '」');
});
});
}
window.triggerTaChooseNow = function () {
const d = tcLoad();
const q = tcPick(d);
if (!q) { toast('题库没有可用的问题'); return; }
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
tcPush(q, { popupProb: askPopupProb(s) });
toast('TA 在聊天里向你提问了');
};
const tcNow = document.getElementById('tc-now');
if (tcNow) tcNow.addEventListener('click', () => window.triggerTaChooseNow());
const tcFavs = document.getElementById('tc-favs');
if (tcFavs) {
tcFavs.addEventListener('click', () => {
const d = tcLoad();
if (!d.favs.length) { openTCPanel('收藏', '<div class="ta-empty">还没有收藏的题目</div>'); return; }
let html = '';
d.favs.forEach((f, i) => {
const dd = new Date(f.ts);
const time = ('0' + dd.getHours()).slice(-2) + ':' + ('0' + dd.getMinutes()).slice(-2) + ' ' + ((dd.getMonth() + 1) + '月' + dd.getDate() + '日');
html += '<div class="tc-listitem"><div class="tc-li-top"><span class="tc-li-q">[' + (TC_CAT_LABEL[f.cat] || '') + '] ' + f.q + '</span>' +
'<button class="tc-li-del" data-i="' + i + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"/><path d="M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg></button></div>' +
(f.my ? '<div class="tc-li-line">你当时选了：' + f.my + '</div>' : '') +
(f.reply ? '<div class="tc-li-line">TA回应：' + taReplyShow(f.reply) + '</div>' : '') +
'<div class="tc-li-time">收藏于 ' + time + '</div></div>';
});
openTCPanel('收藏', html);
document.querySelectorAll('#tc-body .tc-li-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = tcLoad();
d2.favs.splice(Number(b.dataset.i), 1);
tcSave(d2);
tcFavs.click();
});
});
});
}
const KEY3 = 'ta-curious';
const TCU_CAT_LABEL = { you: '关于你', mood: '情绪', daily: '日常', past: '过去', like: '喜好', think: '想法', us: '你和TA', world: '两个世界' };
const TCU_CAT_ORDER = ['you', 'mood', 'daily', 'past', 'like', 'think', 'us', 'world'];
const TCU_FALLBACK = ['原来是这样', '嗯，我记住了', '听你说完，感觉又懂了你一点', '这样啊，挺好的'];
const TCU_DEFAULT = [
{ id: 'cy1', cat: 'you', text: '你有没有一个只属于自己、谁也不告诉的小仪式？', quick: ['有', '没有', '偶尔有', '说不清'], replies: ['那我要好好观察一下了', '嗯，那要一起培养一些新的仪式感吗？'] },
{ id: 'cm1', cat: 'mood', text: '你难过的时候最想做什么？', quick: ['一个人待着', '找人说话', '出去走走', '睡觉'], replies: ['想说话的时候随时找我', '别一个人扛着'] },
{ id: 'cd1', cat: 'daily', text: '冷饮还是热饮？', quick: ['冷饮', '热饮', '看天气'], replies: ['还挺真实的', '好，知道了'], followup: '会开着暖气吃雪糕吗？' },
{ id: 'cp1', cat: 'past', text: '照片还是画像？', quick: ['照片', '画像', '得先知道画像风格', '都想要'], replies: ['什么样的你，我都想看看呢'] },
{ id: 'cl1', cat: 'like', text: '如果不得不出门，那更喜欢下雨天出门，还是大晴天出门？', quick: ['下雨天', '大晴天'], replies: ['嗯，猜到了', '没想到呢'] },
{ id: 'ct1', cat: 'think', text: '出门玩更喜欢什么出行方式？', quick: ['高铁', '自己开车', '飞机', '徒步'], replies: ['好，我会记住'] },
{ id: 'cu1', cat: 'us', text: '耳环还是耳钉？', quick: ['耳环', '耳钉', '看当天的衣服', '都不喜欢'], replies: ['原来如此'] },
{ id: 'cw1', cat: 'world', text: '山还是海？', quick: ['山', '海', '都可以'], replies: ['好，我记住了'] }
];
let _tcuSessionTriggered = false;
function tcuMerge(d) {
const ids = {};
(d.questions || []).forEach(q => { if (q && q.id) ids[q.id] = true; });
const merged = Array.isArray(d.mergedIds) ? d.mergedIds.slice() : [];
const mergedSet = {};
merged.forEach(id => { if (id) mergedSet[id] = true; });
let changed = false;
TCU_DEFAULT.forEach(q => {
if (!mergedSet[q.id] && !ids[q.id]) {
const nq = { id: q.id, cat: q.cat, text: q.text, quick: (q.quick || []).slice(), replies: (q.replies || []).slice(), followup: q.followup || '', enabled: true };
nq.isPreset = true; // v3.6.x：系统预设标记——预设只可启停、不可删除
d.questions.push(nq);
changed = true;
}
});
TCU_DEFAULT.forEach(q => {
if (!mergedSet[q.id]) { merged.push(q.id); mergedSet[q.id] = true; changed = true; }
});
TCU_DEFAULT.forEach(q => {
if (ids[q.id] && d.questions.some(x => x && x.id === q.id && x.isPreset !== true)) {
d.questions.forEach(x => { if (x && x.id === q.id) x.isPreset = true; });
changed = true;
}
});
if (changed) d.mergedIds = merged;
return changed;
}
function tcuLoad() {
let d = null;
try { d = JSON.parse(store.get(KEY3) || 'null'); } catch (e) { d = null; }
if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY3)) store.requestBigKey(KEY3); } catch (e0) {} }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
const CURIOUS_QUICK_FIX = {
cw4: { '你身边': '我身边' },
cw6: { '跟着你走': '跟着我走' },
cp6: { '再等等，会遇到我': '再等等，会遇到你' },
cy11: { '只给我看': '只给你看' }
};
if (Array.isArray(d.questions)) {
let migrated = false;
d.questions.forEach(q => {
const fix = q && q.id ? CURIOUS_QUICK_FIX[q.id] : null;
if (fix && Array.isArray(q.quick)) {
const prevQuick = q.quick;
const nextQuick = prevQuick.map(o => fix[o] || o);
if (nextQuick.some((o, i) => o !== prevQuick[i])) { q.quick = nextQuick; migrated = true; }
}
});
if (migrated && !ckHold(KEY3)) { try { store.set(KEY3, JSON.stringify(d)); } catch (e) {} }
}
if (Array.isArray(d.history)) {
d.history.forEach(h => {
if (h && h.my === '你身边') h.my = '我身边';
else if (h && h.my === '再等等，会遇到我') h.my = '再等等，会遇到你';
else if (h && h.my === '只给我看') h.my = '只给你看';
else if (h && h.my === '跟着你走') h.my = '跟着我走';
});
}
if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5, followup: true };
if (d.settings.useDefault === undefined) d.settings.useDefault = true;
migrateInteractProb(d, KEY3, [15, 8]);
if (!Array.isArray(d.questions) || !d.questions.length) {
const isNew = !store.get(KEY3);
d.questions = TCU_DEFAULT.map(q => {
const nq = { id: q.id, cat: q.cat, text: q.text, quick: (q.quick || []).slice(), replies: (q.replies || []).slice(), followup: q.followup || '', enabled: true };
nq.isPreset = true;
return nq;
});
d.mergedIds = TCU_DEFAULT.map(q => q.id);
if (!isNew && !ckHold(KEY3)) { try { store.set(KEY3, JSON.stringify(d)); } catch (e) {} }
} else {
if (tcuMerge(d) && !ckHold(KEY3)) { try { store.set(KEY3, JSON.stringify(d)); } catch (e) {} }
}
if (!Array.isArray(d.history)) d.history = [];
if (!d.known || typeof d.known !== 'object') d.known = {};
if (!Array.isArray(d.groups)) d.groups = [];
return d;
}
function tcuSave(d) {
if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY3, 'TA 的好奇题库')) return false;
try { store.set(KEY3, JSON.stringify(d)); } catch (e) {}
return true;
}
function tcuPick(d) {
const useDefault = (d.settings || {}).useDefault !== false;
const pool = (d.questions && d.questions.length) ? d.questions : TCU_DEFAULT.filter(q => !pgCatOff('ta-curious', q.cat));
let qs = pool.filter(q => q.enabled !== false && q.text && !(q.id && d.known[q.id]) && (useDefault || !q.isPreset) && presetCatOpen('ta-curious', q));
if (!qs.length) {
const presetInStore = (d.questions || []).some(q => q.isPreset === true);
if (!presetInStore) {
qs = TCU_DEFAULT.filter(q => !d.known[q.id] && !pgCatOff('ta-curious', q.cat));
if (!qs.length) qs = TCU_DEFAULT.filter(q => !pgCatOff('ta-curious', q.cat));
}
}
return qs[Math.floor(Math.random() * qs.length)];
}
function tcuPush(q, opts) {
if (!window.chatAddSystem) return;
_tcuSessionTriggered = true;
const d = tcuLoad();
d.lastCuriousAt = Date.now();
tcuSave(d);
let popup = true;
if (opts && typeof opts.popupProb === 'number') popup = Math.random() * 100 < opts.popupProb;
else if (opts && opts.popup === false) popup = false;
window.chatAddSystem('TA对你有点好奇。', { special: 'ask-msg' });
const el = window.chatAddSystem(q.text, {
special: 'ask-curious', curiousQuestion: q.text, curiousQuick: q.quick || [], curiousReplies: q.replies || [],
curiousFollowup: q.followup || '', curiousQid: q.id || '', curiousCat: q.cat || ''
});
const idx = el ? Number(el.dataset.idx) : -1;
if (window.bgNotifyCheck) window.bgNotifyCheck('TA对你有点好奇：' + q.text, Date.now(), { name: 'TA的好奇', late: _lateNotify(), kind: 'ask' });
if (popup) {
if (document.hidden) { _enqueuePop(idx, 'openCurious'); }
else {
const popSchedAt = Date.now();
setTimeout(() => {
if (autoPopupStale(popSchedAt) || document.hidden) return;
if (chatInputFocused()) return;
if (idx >= 0 && window.openCurious && !cardPopupBusy()) window.openCurious(idx);
}, 400);
}
}
}
function maybeTriggerTCU() {
try {
const d = tcuLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
if (s.enabled === false) return;
if (_tcuSessionTriggered) return;
if (Date.now() - (d.lastCuriousAt || 0) < icCool(30) * 60000) return;
if (!interactGateOk()) return;
if (!taAskDcfOk()) return;
if (Math.random() * 100 >= icProb(window.dcpEff ? window.dcpEff(typeof s.prob === 'number' ? s.prob : 5) : (typeof s.prob === 'number' ? s.prob : 5))) return; // #518 套总档 → #1153 再套频率档
const q = tcuPick(d);
if (!q) return;
interactGateMark();
tcuPush(q, { popupProb: askPopupProb(s) });
} catch (e) {}
}
setTimeout(maybeTriggerTCU, 90000);
setInterval(maybeTriggerTCU, 240000);
window.openCurious = function (msgIdx) {
msgIdx = locateCardIdx(msgIdx, 'ask-curious', 'curiousStatus');
if (msgIdx < 0) return;
let rec = null;
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) rec = msgs[msgIdx];
} catch (e) {}
if (!rec || rec.special !== 'ask-curious') return;
if (rec.curiousStatus === 'answered') { showCuriousResult(msgIdx); return; }
const mask = document.getElementById('qa-mask');
const body = document.getElementById('qa-body');
const title = document.getElementById('qa-title');
if (!mask || !body) return;
if (title) title.textContent = window.taFit ? window.taFit('TA的好奇') : 'TA的好奇';
let html = '<div class="qa-hint">TA有点好奇</div><div class="qa-q">' + String(rec.curiousQuestion || rec.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>';
const quicks = rec.curiousQuick || [];
if (quicks.length) {
html += '<div class="qa-quicks">' + quicks.map(x => '<span class="qa-chip" data-v="' + String(x).replace(/"/g, '&quot;') + '">' + String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</span>').join('') + '</div>';
}
html += '<input id="qa-input" class="qa-input" type="text" placeholder="输入你的回答…">';
html += '<button class="qa-send" id="qa-send">告诉TA</button>';
body.innerHTML = html;
mask.hidden = false;
body.querySelectorAll('.qa-chip').forEach(c => {
c.addEventListener('click', () => {
const inp = document.getElementById('qa-input');
if (inp) inp.value = c.dataset.v;
});
});
const send = () => {
const inp = document.getElementById('qa-input');
const answer = inp ? inp.value.trim() : '';
if (!answer) { toast('告诉TA点什么吧'); return; }
submitCurious(msgIdx, answer);
};
document.getElementById('qa-send').addEventListener('click', send);
const inp = document.getElementById('qa-input');
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) send(); });
setTimeout(() => { if (!chatInputFocused()) inp.focus(); }, 60);
};
function submitCurious(msgIdx, answer) {
let rec = getCardAt(msgIdx);
if (!rec || rec.special !== 'ask-curious') {
msgIdx = locateCardIdx(msgIdx, 'ask-curious', 'curiousStatus');
if (msgIdx < 0) return;
rec = getCardAt(msgIdx);
}
if (!rec || rec.special !== 'ask-curious' || rec.curiousStatus === 'answered') return;
const replies = (rec.curiousReplies && rec.curiousReplies.length) ? rec.curiousReplies : TCU_FALLBACK.slice();
const reply = window.pickAskCardReply ? window.pickAskCardReply(replies) : replies[Math.floor(Math.random() * replies.length)];
const d = tcuLoad();
const qid = rec.curiousQid || ('q_' + String(rec.curiousQuestion || rec.text || ''));
d.known[qid] = answer;
d.history.unshift({ q: rec.curiousQuestion, my: answer, reply: reply, cat: rec.curiousCat || '', ts: Date.now() });
tcuSave(d);
refreshAskRecordsIfOpen();
const followup = rec.curiousFollowup;
const s = d.settings || { followup: true };
const fw = (s.followup !== false && followup && Math.random() < 0.3) ? followup : null;
if (window.chatCuriousReply) window.chatCuriousReply(msgIdx, answer, reply, fw);
document.getElementById('qa-mask').hidden = true;
if (window.openTC) { /* noop */ }
}
function showCuriousResult(msgIdx) {
let rec = null;
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) rec = msgs[msgIdx];
} catch (e) {}
if (!rec) return;
const mask = document.getElementById('qa-mask');
const body = document.getElementById('qa-body');
const title = document.getElementById('qa-title');
if (!mask || !body) return;
if (title) title.textContent = window.taFit ? window.taFit('TA的好奇') : 'TA的好奇';
const _crShow = (window.askCardReplyClean ? window.askCardReplyClean(rec.curiousReply || '') : (rec.curiousReply || '')); // FIX 2026-09-17 #648 存量媒体卡回应清洗后展示
body.innerHTML = '<div class="qa-q">' + String(rec.curiousQuestion || rec.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>' +
'<div class="qa-mine">你说：' + String(rec.curiousAnswer || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>' +
'<div class="qa-reply"><b>' + (window.taFit ? window.taFit('TA：') : 'TA：') + '</b>“' + String(window.taFit ? window.taFit(_crShow) : _crShow).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '”</div>' +
'<div class="qa-close" id="qa-close2">收起来</div>';
mask.hidden = false;
document.getElementById('qa-close2').addEventListener('click', () => { mask.hidden = true; });
}
let tcuTab = 'sys';
function renderTCUSettings() {
const d = tcuLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70, followup: true };
const enEl = document.getElementById('tcu-enable');
if (enEl) enEl.checked = s.enabled !== false;
const defEl = document.getElementById('tcu-default');
if (defEl) defEl.checked = s.useDefault !== false;
const popEl = document.getElementById('tcu-popup');
const popVal = document.getElementById('tcu-popup-val');
const pp = askPopupProb(s);
if (popEl) popEl.value = pp;
if (popVal) popVal.textContent = pp + '%';
const probEl = document.getElementById('tcu-prob');
const probVal = document.getElementById('tcu-prob-val');
if (probEl) probEl.value = typeof s.prob === 'number' ? s.prob : 5;
if (probVal) probVal.textContent = (typeof s.prob === 'number' ? s.prob : 5) + '%';
const fuEl = document.getElementById('tcu-followup');
if (fuEl) fuEl.checked = s.followup !== false;
}
let tcuSysCat = null;
function renderTCUCatsInto(container, presetOnly, search) {
if (!container) return;
const d = tcuLoad();
const useDefault = (d.settings || {}).useDefault !== false;
if (presetOnly) {
const counts = {};
TCU_CAT_ORDER.forEach(k => { counts[k] = d.questions.filter(q => q.cat === k && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0)).length; });
const hasCats = TCU_CAT_ORDER.filter(k => counts[k] > 0);
if (!hasCats.length) { container.innerHTML = '<div class="ta-empty">暂无系统预设问题</div>'; return; }
if (!tcuSysCat || !hasCats.includes(tcuSysCat)) tcuSysCat = hasCats[0];
let html = '<div class="card-tabs" style="padding:2px 2px 10px">';
hasCats.forEach(k => {
html += '<button class="cc-tab' + (k === tcuSysCat ? ' sel' : '') + '" data-cat="' + k + '">' + escT(TCU_CAT_LABEL[k] || k) + '<em class="cc-tab-n">' + counts[k] + '</em></button>';
});
html += '</div>';
const sysCatLabel = escT(TCU_CAT_LABEL[tcuSysCat] || tcuSysCat);
html += window.presetGroup ? window.presetGroup.catBar('ta-curious', tcuSysCat, String(sysCatLabel)) : '';
const arr = d.questions.filter(q => q.cat === tcuSysCat && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0));
arr.forEach(q => {
const idx = d.questions.indexOf(q);
const known = q.id && d.known[q.id];
html += '<div class="tc-qrow' + (q.enabled === false || !useDefault ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + (known ? ' <span class="tc-known">✓已了解</span>' : '') + ' <span class="tc-known">系统</span></div>' +
(q.quick && q.quick.length ? '<div class="tc-qopts">快捷：' + q.quick.join(' / ') + '</div>' : '') +
(q.replies && q.replies.length ? '<div class="tc-qopts">TA 回应：' + q.replies.map(escT).join(' / ') + '</div>' : '') +
'</div></div>';
});
container.innerHTML = html;
if (window.presetGroup) window.presetGroup.bindBar(container.querySelector('.preset-cat-bar'), 'ta-curious', tcuSysCat, function () { renderTCUCatsInto(container, true, search); });
container.querySelectorAll('.cc-tab[data-cat]').forEach(t => {
t.addEventListener('click', () => { tcuSysCat = t.dataset.cat; renderTCUCatsInto(container, true, search); });
});
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = tcuLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
tcuSave(d2);
});
});
return;
}
let html = '';
TCU_CAT_ORDER.forEach(k => {
const arr = d.questions.filter(q => q.cat === k && (q.isPreset === true) === presetOnly && (search === '' || q.text.indexOf(search) >= 0));
if (!arr.length) return;
html += '<div class="tc-cat-t">' + (TCU_CAT_LABEL[k] || k) + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + arr.length + ')</span></div>';
arr.forEach(q => {
const idx = d.questions.indexOf(q);
const known = q.id && d.known[q.id];
const preset = q.isPreset === true;
const delBtn = preset ? '' : '<button class="ta-del" data-idx="' + idx + '">✕</button>';
html += '<div class="tc-qrow' + (q.enabled === false || (preset && !useDefault) ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + (known ? ' <span class="tc-known">✓已了解</span>' : '') + (preset ? ' <span class="tc-known">系统</span>' : '') + '</div>' +
(q.quick && q.quick.length ? '<div class="tc-qopts">快捷：' + q.quick.join(' / ') + '</div>' : '') +
(q.replies && q.replies.length ? '<div class="tc-qopts">TA 回应：' + q.replies.map(escT).join(' / ') + '</div>' : '') +
'</div>' + delBtn + '</div>';
});
});
if (!html) html = '<div class="ta-empty">' + (presetOnly ? '暂无系统预设问题' : '暂未添加自定义问题，可在上方添加') + '</div>';
container.innerHTML = html;
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = tcuLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
tcuSave(d2);
});
});
container.querySelectorAll('.ta-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = tcuLoad();
const q = d2.questions[Number(b.dataset.idx)];
if (q && q.isPreset === true) { toast('系统预设问题不可删除'); return; }
d2.questions.splice(Number(b.dataset.idx), 1);
tcuSave(d2);
renderTCUCatsInto(container, false, search);
});
});
}
const tcuMineOpt = {
load: tcuLoad, save: tcuSave, order: TCU_CAT_ORDER, label: TCU_CAT_LABEL,
emptyTip: '暂未添加自定义问题，可在上方添加',
rowHtml: function (q, idx) {
const known = q.id && (tcuLoad().known || {})[q.id];
return '<div class="tc-qrow' + (q.enabled === false ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + (known ? ' <span class="tc-known">✓已了解</span>' : '') + '</div>' +
(q.quick && q.quick.length ? '<div class="tc-qopts">快捷：' + q.quick.map(escT).join(' / ') + '</div>' : '') +
'</div>' +
'<button class="ta-del" data-idx="' + idx + '">✕</button></div>';
}
};
function switchTCUTab(tab) {
tcuTab = tab;
renderTCUSettings();
const tabsWrap = document.getElementById('tcu-tabs');
if (tabsWrap) tabsWrap.querySelectorAll('.cc-tab').forEach(t => t.classList.toggle('sel', t.dataset.tab === tab));
const sysPanel = document.getElementById('tcu-sys-panel');
const minePanel = document.getElementById('tcu-mine-panel');
if (sysPanel) sysPanel.hidden = tab !== 'sys';
if (minePanel) minePanel.hidden = tab !== 'mine';
tcuSearch = '';
const searchInput = document.getElementById('tcu-search');
if (searchInput) searchInput.value = '';
if (tab === 'sys') renderTCUCatsInto(document.getElementById('tcu-sys-cats'), true, '');
else renderMineGroupsInto(document.getElementById('tcu-mine-cats'), tcuMineOpt, '');
}
const tcuTabsWrap = document.getElementById('tcu-tabs');
if (tcuTabsWrap) {
tcuTabsWrap.querySelectorAll('.cc-tab').forEach(tab => {
tab.addEventListener('click', () => switchTCUTab(tab.dataset.tab));
});
}
let tcuSearch = '';
const tcuSearchInput = document.getElementById('tcu-search');
if (tcuSearchInput) {
tcuSearchInput.addEventListener('input', () => {
tcuSearch = tcuSearchInput.value.trim();
if (tcuTab === 'sys') renderTCUCatsInto(document.getElementById('tcu-sys-cats'), true, tcuSearch);
else renderMineGroupsInto(document.getElementById('tcu-mine-cats'), tcuMineOpt, tcuSearch);
});
}
const liTCU = document.getElementById('li-ta-curious');
const tcuPage = document.getElementById('page-ta-curious');
if (liTCU && tcuPage) {
liTCU.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
tcuPage.hidden = false;
const tw = document.getElementById('tcu-tabs'); if (tw) tw.style.display = 'none';
switchTCUTab('sys');
});
}
const tcuBackBtn = document.getElementById('tc-curious-back');
if (tcuBackBtn) {
tcuBackBtn.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
const home = document.getElementById('page-chatcard');
if (home) home.hidden = false;
});
}
const tcuEn = document.getElementById('tcu-enable');
if (tcuEn) tcuEn.addEventListener('change', () => { const d = tcuLoad(); d.settings.enabled = tcuEn.checked; tcuSave(d); toast(tcuEn.checked ? 'TA的好奇已开启' : 'TA的好奇已关闭'); });
const tcuDefault = document.getElementById('tcu-default');
if (tcuDefault) tcuDefault.addEventListener('change', () => {
const d = tcuLoad(); d.settings.useDefault = tcuDefault.checked; tcuSave(d);
switchTCUTab(tcuTab);
toast(tcuDefault.checked ? '系统预设问题已开启' : '系统预设问题已关闭（仅用你添加的问题）');
});
const tcuProb = document.getElementById('tcu-prob');
if (tcuProb) tcuProb.addEventListener('input', () => {
const d = tcuLoad(); d.settings.prob = Math.max(0, Math.min(100, parseInt(tcuProb.value, 10) || 0)); tcuSave(d);
const v = document.getElementById('tcu-prob-val'); if (v) v.textContent = tcuProb.value + '%';
toast('触发概率已设为 ' + tcuProb.value + '%');
});
const tcuPopup = document.getElementById('tcu-popup');
if (tcuPopup) tcuPopup.addEventListener('input', () => {
const d = tcuLoad(); d.settings.popupProb = parseInt(tcuPopup.value, 10) || 0; tcuSave(d);
const v = document.getElementById('tcu-popup-val'); if (v) v.textContent = tcuPopup.value + '%';
toast('弹窗概率已设为 ' + tcuPopup.value + '%');
});
const tcuFu = document.getElementById('tcu-followup');
if (tcuFu) tcuFu.addEventListener('change', () => { const d = tcuLoad(); d.settings.followup = tcuFu.checked; tcuSave(d); toast(tcuFu.checked ? 'TA 偶尔会自然追问' : 'TA 不再追问'); });
const tcuAdd = document.getElementById('tcu-new-add');
if (tcuAdd) {
(function rebuildTCUSelect() {
const catEl = document.getElementById('tcu-new-cat');
if (!catEl) return;
const d0 = tcuLoad();
catEl.innerHTML = window.cardGroups.catOptsHtml(TCU_CAT_ORDER.map(k => [k, TCU_CAT_LABEL[k]]), d0.groups || [], catEl.value);
window.cardGroups.bindNewGrp(catEl, d0.groups, function () { tcuSave(d0); });
})();
tcuAdd.addEventListener('click', () => {
const catEl = document.getElementById('tcu-new-cat');
const textEl = document.getElementById('tcu-new-text');
const quickEl = document.getElementById('tcu-new-quick');
const repliesEl = document.getElementById('tcu-new-replies');
const followupEl = document.getElementById('tcu-new-followup');
const text = textEl ? textEl.value.trim() : '';
if (!text) { toast('请输入问题内容'); return; }
const parsed = window.cardGroups.parseCatVal(catEl ? catEl.value : 'you');
if (!parsed) { toast('请先选择分类或分组'); return; }
const quick = (quickEl ? quickEl.value : '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 4);
let replies = (repliesEl ? repliesEl.value : '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 4);
if (!replies.length) replies = TCU_FALLBACK.slice(0, 2);
const followup = followupEl ? followupEl.value.trim() : '';
const d = tcuLoad();
const q = { id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 9999), cat: parsed.cat || 'you', text: text, quick: quick, replies: replies, followup: followup, enabled: true, isPreset: false };
if (parsed.grp) q.grp = parsed.grp;
d.questions.push(q);
tcuSave(d);
[textEl, quickEl, repliesEl, followupEl].forEach(el => { if (el) el.value = ''; });
renderMineGroupsInto(document.getElementById('tcu-mine-cats'), tcuMineOpt);
toast('已添加问题');
});
}
const tcuNewGrp = document.getElementById('tcu-new-grp');
if (tcuNewGrp) {
tcuNewGrp.addEventListener('click', () => {
const d = tcuLoad();
window.cardGroups.addFlow(d.groups, g => {
if (!g) return;
tcuSave(d);
(function refreshTCUSelect() {
const catEl = document.getElementById('tcu-new-cat');
if (catEl) {
catEl.innerHTML = window.cardGroups.catOptsHtml(TCU_CAT_ORDER.map(k => [k, TCU_CAT_LABEL[k]]), d.groups, catEl.value);
window.cardGroups.bindNewGrp(catEl, d.groups);
}
})();
if (tcuTab === 'mine') renderMineGroupsInto(document.getElementById('tcu-mine-cats'), tcuMineOpt);
toast('已新建分组「' + g.name + '」');
});
});
}
window.triggerTaCuriousNow = function () {
const d = tcuLoad();
const q = tcuPick(d);
if (!q) { toast('题库没有可用的问题'); return; }
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
tcuPush(q, { popupProb: askPopupProb(s) });
toast('TA 在聊天里向你好奇了');
};
const tcuNow = document.getElementById('tcu-now');
if (tcuNow) tcuNow.addEventListener('click', () => window.triggerTaCuriousNow());
const KEY4 = 'ta-roast';
const TR_CAT_LABEL = { light: '轻微调侃', familiar: '熟悉感', sweet: '情侣式调侃', mild: '轻微嫌弃', serious: '严肃吐槽', world: '两个世界' };
const TR_CAT_ORDER = ['light', 'familiar', 'sweet', 'mild', 'serious', 'world'];
const TR_DEFAULT = [
{ id: 'rl1', cat: 'light', text: '你怎么又这样' },
{ id: 'rf1', cat: 'familiar', text: '我就知道你会选这个' },
{ id: 'rs1', cat: 'sweet', text: '你怎么这么可爱' }, 
{ id: 'rm1', cat: 'mild', text: '又不好好照顾自己，说你多少次了' }, 
{ id: 'rsg1', cat: 'serious', text: '你真的很会折腾自己' },
{ id: 'rmt1', cat: 'mild', text: '你怎么又熬夜', match: ['熬夜', '没睡', '睡不着'] },
{ id: 'rw1', cat: 'world', text: '在想我吗？', match: ['想你了', '没在想你'] }
];
let _trSessionTriggered = false;
function trMerge(d) {
const ids = {};
(d.questions || []).forEach(q => { if (q && q.id) ids[q.id] = true; });
const merged = Array.isArray(d.mergedIds) ? d.mergedIds.slice() : [];
const mergedSet = {};
merged.forEach(id => { if (id) mergedSet[id] = true; });
let changed = false;
TR_DEFAULT.forEach(q => {
if (!mergedSet[q.id] && !ids[q.id]) {
const nq = { id: q.id, cat: q.cat, text: q.text, match: (q.match || []).slice(), enabled: true };
nq.isPreset = true; // v3.6.x：系统预设标记——预设只可启停、不可删除
d.questions.push(nq);
changed = true;
}
});
TR_DEFAULT.forEach(q => {
if (!mergedSet[q.id]) { merged.push(q.id); mergedSet[q.id] = true; changed = true; }
});
TR_DEFAULT.forEach(q => {
if (ids[q.id] && d.questions.some(x => x && x.id === q.id && x.isPreset !== true)) {
d.questions.forEach(x => { if (x && x.id === q.id) x.isPreset = true; });
changed = true;
}
});
if (changed) d.mergedIds = merged;
return changed;
}
function trLoad() {
let d = null;
try { d = JSON.parse(store.get(KEY4) || 'null'); } catch (e) { d = null; }
if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY4)) store.requestBigKey(KEY4); } catch (e0) {} }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5 };
if (d.settings.useDefault === undefined) d.settings.useDefault = true;
migrateInteractProb(d, KEY4, [30, 15]);
if (!Array.isArray(d.questions) || !d.questions.length) {
const isNew = !store.get(KEY4);
d.questions = TR_DEFAULT.map(q => {
const nq = { id: q.id, cat: q.cat, text: q.text, match: (q.match || []).slice(), enabled: true };
nq.isPreset = true;
return nq;
});
d.mergedIds = TR_DEFAULT.map(q => q.id);
if (!isNew && !ckHold(KEY4)) { try { store.set(KEY4, JSON.stringify(d)); } catch (e) {} }
} else {
if (trMerge(d) && !ckHold(KEY4)) { try { store.set(KEY4, JSON.stringify(d)); } catch (e) {} }
}
if (!Array.isArray(d.history)) d.history = [];
if (!Array.isArray(d.groups)) d.groups = [];
return d;
}
function trSave(d) {
if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY4, 'TA 的吐槽题库')) return false;
try { store.set(KEY4, JSON.stringify(d)); } catch (e) {}
return true;
}
function trPick(d, lastUserText) {
const useDefault = (d.settings || {}).useDefault !== false;
const pool = (d.questions && d.questions.length) ? d.questions : TR_DEFAULT.filter(q => !pgCatOff('ta-roast', q.cat));
if (lastUserText) {
const matched = pool.filter(q => q.enabled !== false && Array.isArray(q.match) && q.match.length && (useDefault || !q.isPreset) && presetCatOpen('ta-roast', q) && q.match.some(k => lastUserText.indexOf(k) >= 0));
if (matched.length) return matched[Math.floor(Math.random() * matched.length)];
}
let qs = pool.filter(q => q.enabled !== false && (useDefault || !q.isPreset) && presetCatOpen('ta-roast', q));
if (!qs.length && !(d.questions || []).some(q => q.isPreset === true)) qs = TR_DEFAULT.filter(q => !pgCatOff('ta-roast', q.cat));
return qs[Math.floor(Math.random() * qs.length)];
}
function trPush(q, opts) {
if (!window.chatAddSystem) return;
_trSessionTriggered = true;
const d = trLoad();
d.lastRoastAt = Date.now();
trSave(d);
let popup = true;
if (opts && typeof opts.popupProb === 'number') popup = Math.random() * 100 < opts.popupProb;
else if (opts && opts.popup === false) popup = false;
window.chatAddSystem('TA吐槽了你一句。', { special: 'ask-msg' });
const el = window.chatAddSystem(q.text, { special: 'ask-roast', roastText: q.text, roastCat: q.cat || 'light' });
const idx = el ? Number(el.dataset.idx) : -1;
if (window.bgNotifyCheck) window.bgNotifyCheck('TA吐槽了你一句：' + q.text, Date.now(), { name: 'TA的吐槽', late: _lateNotify(), kind: 'ask' });
if (popup) {
if (document.hidden) { _enqueuePop(idx, 'openRoast'); }
else {
const popSchedAt = Date.now();
setTimeout(() => {
if (autoPopupStale(popSchedAt) || document.hidden) return;
if (chatInputFocused()) return;
if (idx >= 0 && window.openRoast && !cardPopupBusy()) window.openRoast(idx);
}, 400);
}
}
}
function lastUserMsg() {
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
for (let i = msgs.length - 1; i >= 0; i--) {
if (msgs[i] && msgs[i].side === 'out' && msgs[i].text && typeof msgs[i].text === 'string') return msgs[i].text;
}
} catch (e) {}
return '';
}
function maybeTriggerTR() {
try {
const d = trLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
if (s.enabled === false) return;
if (_trSessionTriggered) return;
if (Date.now() - (d.lastRoastAt || 0) < icCool(30) * 60000) return;
if (!interactGateOk()) return;
if (!taAskDcfOk()) return;
if (Math.random() * 100 < icProb(window.dcpEff ? window.dcpEff(typeof s.prob === 'number' ? s.prob : 5) : (typeof s.prob === 'number' ? s.prob : 5))) { // #518 套总档 → #1153 再套频率档
const q = trPick(d, lastUserMsg());
if (q) { interactGateMark(); trPush(q, { popupProb: askPopupProb(s) }); }
}
} catch (e) {}
}
setTimeout(maybeTriggerTR, 120000);
setInterval(maybeTriggerTR, 300000);
const CC_TRIGGER_KEY = 'ta-cc-state';
function ccStateLoad() { try { return JSON.parse(store.get(CC_TRIGGER_KEY) || '{}') || {}; } catch (e) { return {}; } }
function ccStateSave(d) { try { store.set(CC_TRIGGER_KEY, JSON.stringify(d)); } catch (e) {} }
function ccCfg(k, def) {
try {
const v = store.get('reply-' + k);
if (v === null || v === undefined || v === '') return def;
const n = Number(v);
return isNaN(n) ? def : n;
} catch (e) { return def; }
}
window.__taCcPool = function () {
let cards = [];
try { cards = ((window.getCustomCards ? window.getCustomCards() : []) || []); } catch (e) { cards = []; }
return cards.filter(function (s) {
if (typeof s !== 'string') return false;
const t = s.trim();
if (!t || t.length > 60) return false;
if (t.indexOf('|||') >= 0) return false;
if (t.indexOf('data:') === 0 || t.indexOf('http:') === 0 || t.indexOf('https:') === 0) return false;
if (window.mochiMediaIsToken && window.mochiMediaIsToken(t)) return false; // FIX 2026-09-13 #388 同款守卫
return true;
});
};
function maybeTriggerTACC() {
try {
if (ccCfg('ai-cc-en', 1) !== 1) return;
if (!interactGateOk()) return;
if (!taAskDcfOk()) return;
const st = ccStateLoad();
if (Date.now() - (st.lastCcAt || 0) < icCool(90) * 60000) return;
if (Math.random() * 100 >= icProb(ccCfg('ai-cc-prob', 4))) return; // #1153：分享你的字卡同套频率档
const pool = window.__taCcPool();
if (!pool.length) return;
const recent = Array.isArray(st.recent) ? st.recent : [];
const fresh = pool.filter(function (t) { return recent.indexOf(t) < 0; });
const arr2 = fresh.length ? fresh : pool;
const text = arr2[Math.floor(Math.random() * arr2.length)];
st.lastCcAt = Date.now();
st.recent = recent.concat([text]).slice(-6);
ccStateSave(st);
interactGateMark();
if (window.chatAddIn) window.chatAddIn(text, { initiative: 1, tag: '用了你建的字卡' });
if (window.bgNotifyCheck) { try { window.bgNotifyCheck(text, Date.now(), { name: window.taFit ? window.taFit('TA') + '的字卡' : 'TA的字卡', kind: 'msg' }); } catch (e) {} }
} catch (e) {}
}
window.maybeTriggerTACC = maybeTriggerTACC;
setTimeout(maybeTriggerTACC, 150000);
setInterval(maybeTriggerTACC, 240000);
window.openRoast = function (msgIdx) {
msgIdx = locateCardIdx(msgIdx, 'ask-roast', 'roastStatus');
if (msgIdx < 0) return;
let rec = null;
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) rec = msgs[msgIdx];
} catch (e) {}
if (!rec || rec.special !== 'ask-roast') return;
if (rec.roastStatus === 'answered') { showRoastResult(msgIdx); return; }
const mask = document.getElementById('qa-mask');
const body = document.getElementById('qa-body');
const title = document.getElementById('qa-title');
if (!mask || !body) return;
if (title) title.textContent = window.taFit ? window.taFit('TA的吐槽') : 'TA的吐槽';
body.innerHTML = '<div class="qa-hint">TA 吐槽你</div><div class="qa-q">“' + String(rec.roastText || rec.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '”</div>' +
'<input id="qa-input" class="qa-input" type="text" placeholder="回 TA 一句…">' +
'<button class="qa-send" id="qa-send">回TA一句</button>';
mask.hidden = false;
const send = () => {
const inp = document.getElementById('qa-input');
const answer = inp ? inp.value.trim() : '';
if (!answer) { toast('回TA一句吧'); return; }
submitRoast(msgIdx, answer);
};
document.getElementById('qa-send').addEventListener('click', send);
const inp = document.getElementById('qa-input');
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) send(); });
setTimeout(() => { if (!chatInputFocused()) inp.focus(); }, 60);
};
function submitRoast(msgIdx, answer) {
let rec = getCardAt(msgIdx);
if (!rec || rec.special !== 'ask-roast') {
msgIdx = locateCardIdx(msgIdx, 'ask-roast', 'roastStatus');
if (msgIdx < 0) return;
rec = getCardAt(msgIdx);
}
if (!rec || rec.special !== 'ask-roast' || rec.roastStatus === 'answered') return;
const defs = window.getInteractPool
? window.getInteractPool('吐槽·回应', ['你觉得我会信？', '少骗我。', '哼。', '好吧好吧。', '就这一次？', '行吧，放过你。', '嗯，这还差不多。'])
: ['你觉得我会信？', '少骗我。', '哼。', '好吧好吧。', '就这一次？', '行吧，放过你。', '嗯，这还差不多。'];
const reply = window.pickAskCardReply ? window.pickAskCardReply(defs) : defs[Math.floor(Math.random() * defs.length)];
const d = trLoad();
d.history.unshift({ roast: rec.roastText, my: answer, reply: reply, cat: rec.roastCat || '', ts: Date.now() });
trSave(d);
refreshAskRecordsIfOpen();
if (window.chatRoastReply) window.chatRoastReply(msgIdx, answer, reply);
document.getElementById('qa-mask').hidden = true;
}
function showRoastResult(msgIdx) {
let rec = null;
try {
const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
if (Array.isArray(msgs) && msgs[msgIdx]) rec = msgs[msgIdx];
} catch (e) {}
if (!rec) return;
const mask = document.getElementById('qa-mask');
const body = document.getElementById('qa-body');
const title = document.getElementById('qa-title');
if (!mask || !body) return;
if (title) title.textContent = window.taFit ? window.taFit('TA的吐槽') : 'TA的吐槽';
const _trShow = (window.askCardReplyClean ? window.askCardReplyClean(rec.roastReply || '') : (rec.roastReply || '')); // FIX 2026-09-17 #648 存量媒体卡回应清洗后展示
body.innerHTML = '<div class="qa-q">“' + String(rec.roastText || rec.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '”</div>' +
'<div class="qa-mine">你说：' + String(rec.roastAnswer || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>' +
'<div class="qa-reply"><b>' + (window.taFit ? window.taFit('TA：') : 'TA：') + '</b>“' + String(window.taFit ? window.taFit(_trShow) : _trShow).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '”</div>' +
'<div class="qa-close" id="qa-close2">收起来</div>';
mask.hidden = false;
document.getElementById('qa-close2').addEventListener('click', () => { mask.hidden = true; });
}
let trTab = 'sys';
function renderTRSettings() {
const d = trLoad();
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
const enEl = document.getElementById('tr-enable');
if (enEl) enEl.checked = s.enabled !== false;
const defEl = document.getElementById('tr-default');
if (defEl) defEl.checked = s.useDefault !== false;
const popEl = document.getElementById('tr-popup');
const popVal = document.getElementById('tr-popup-val');
const pp = askPopupProb(s);
if (popEl) popEl.value = pp;
if (popVal) popVal.textContent = pp + '%';
const probEl = document.getElementById('tr-prob');
const probVal = document.getElementById('tr-prob-val');
if (probEl) probEl.value = typeof s.prob === 'number' ? s.prob : 5;
if (probVal) probVal.textContent = (typeof s.prob === 'number' ? s.prob : 5) + '%';
}
let trSysCat = null;
function renderTRCatsInto(container, presetOnly, search) {
if (!container) return;
const d = trLoad();
const useDefault = (d.settings || {}).useDefault !== false;
if (presetOnly) {
const counts = {};
TR_CAT_ORDER.forEach(k => { counts[k] = d.questions.filter(q => q.cat === k && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0)).length; });
const hasCats = TR_CAT_ORDER.filter(k => counts[k] > 0);
if (!hasCats.length) { container.innerHTML = '<div class="ta-empty">暂无系统预设字卡</div>'; return; }
if (!trSysCat || !hasCats.includes(trSysCat)) trSysCat = hasCats[0];
let html = '<div class="card-tabs" style="padding:2px 2px 10px">';
hasCats.forEach(k => {
html += '<button class="cc-tab' + (k === trSysCat ? ' sel' : '') + '" data-cat="' + k + '">' + escT(TR_CAT_LABEL[k] || k) + '<em class="cc-tab-n">' + counts[k] + '</em></button>';
});
html += '</div>';
const sysCatLabel = escT(TR_CAT_LABEL[trSysCat] || trSysCat);
html += window.presetGroup ? window.presetGroup.catBar('ta-roast', trSysCat, String(sysCatLabel)) : '';
const arr = d.questions.filter(q => q.cat === trSysCat && q.isPreset === true && (search === '' || q.text.indexOf(search) >= 0));
arr.forEach(q => {
const idx = d.questions.indexOf(q);
html += '<div class="tc-qrow' + (q.enabled === false || !useDefault ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + ' <span class="tc-known">系统</span></div>' +
(q.match && q.match.length ? '<div class="tc-qopts">触发：' + q.match.join(' / ') + '</div>' : '') +
interactPoolInlineHtml('吐槽·回应') +
'</div></div>';
});
container.innerHTML = html;
if (window.presetGroup) window.presetGroup.bindBar(container.querySelector('.preset-cat-bar'), 'ta-roast', trSysCat, function () { renderTRCatsInto(container, true, search); });
container.querySelectorAll('.cc-tab[data-cat]').forEach(t => {
t.addEventListener('click', () => { trSysCat = t.dataset.cat; renderTRCatsInto(container, true, search); });
});
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = trLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
trSave(d2);
});
});
return;
}
let html = '';
TR_CAT_ORDER.forEach(k => {
const arr = d.questions.filter(q => q.cat === k && (q.isPreset === true) === presetOnly && (search === '' || q.text.indexOf(search) >= 0));
if (!arr.length) return;
html += '<div class="tc-cat-t">' + (TR_CAT_LABEL[k] || k) + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + arr.length + ')</span></div>';
arr.forEach(q => {
const idx = d.questions.indexOf(q);
const preset = q.isPreset === true;
const delBtn = preset ? '' : '<button class="ta-del" data-idx="' + idx + '">✕</button>';
html += '<div class="tc-qrow' + (q.enabled === false || (preset && !useDefault) ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + (preset ? ' <span class="tc-known">系统</span>' : '') + '</div>' +
(q.match && q.match.length ? '<div class="tc-qopts">触发：' + q.match.join(' / ') + '</div>' : '') +
(presetOnly ? interactPoolInlineHtml('吐槽·回应') : '') +
'</div>' + delBtn + '</div>';
});
});
if (!html) html = '<div class="ta-empty">' + (presetOnly ? '暂无系统预设字卡' : '暂未添加自定义字卡，可在上方添加') + '</div>';
container.innerHTML = html;
container.querySelectorAll('input[data-idx]').forEach(cb => {
cb.addEventListener('change', () => {
const d2 = trLoad();
const q = d2.questions[Number(cb.dataset.idx)];
if (q) q.enabled = cb.checked;
trSave(d2);
});
});
container.querySelectorAll('.ta-del').forEach(b => {
b.addEventListener('click', () => {
const d2 = trLoad();
const q = d2.questions[Number(b.dataset.idx)];
if (q && q.isPreset === true) { toast('系统预设字卡不可删除'); return; }
d2.questions.splice(Number(b.dataset.idx), 1);
trSave(d2);
renderTRCatsInto(container, false, search);
});
});
}
const trMineOpt = {
load: trLoad, save: trSave, order: TR_CAT_ORDER, label: TR_CAT_LABEL,
emptyTip: '暂未添加自定义字卡，可在上方添加',
rowHtml: function (q, idx) {
return '<div class="tc-qrow' + (q.enabled === false ? ' off' : '') + '">' +
'<label class="toggle"><input type="checkbox" data-idx="' + idx + '"' + (q.enabled !== false ? ' checked' : '') + '><span class="tk"></span></label>' +
'<div class="tc-qmain"><div class="tc-qtext">' + escT(q.text) + '</div>' +
(q.match && q.match.length ? '<div class="tc-qopts">触发：' + q.match.map(escT).join(' / ') + '</div>' : '') +
'</div>' +
'<button class="ta-del" data-idx="' + idx + '">✕</button></div>';
}
};
function switchTRTab(tab) {
trTab = tab;
renderTRSettings();
const tabsWrap = document.getElementById('tr-tabs');
if (tabsWrap) tabsWrap.querySelectorAll('.cc-tab').forEach(t => t.classList.toggle('sel', t.dataset.tab === tab));
const sysPanel = document.getElementById('tr-sys-panel');
const minePanel = document.getElementById('tr-mine-panel');
if (sysPanel) sysPanel.hidden = tab !== 'sys';
if (minePanel) minePanel.hidden = tab !== 'mine';
trSearch = '';
const searchInput = document.getElementById('tr-search');
if (searchInput) searchInput.value = '';
if (tab === 'sys') renderTRCatsInto(document.getElementById('tr-sys-cats'), true, '');
else renderMineGroupsInto(document.getElementById('tr-mine-cats'), trMineOpt, '');
}
const trTabsWrap = document.getElementById('tr-tabs');
if (trTabsWrap) {
trTabsWrap.querySelectorAll('.cc-tab').forEach(tab => {
tab.addEventListener('click', () => switchTRTab(tab.dataset.tab));
});
}
let trSearch = '';
const trSearchInput = document.getElementById('tr-search');
if (trSearchInput) {
trSearchInput.addEventListener('input', () => {
trSearch = trSearchInput.value.trim();
if (trTab === 'sys') renderTRCatsInto(document.getElementById('tr-sys-cats'), true, trSearch);
else renderMineGroupsInto(document.getElementById('tr-mine-cats'), trMineOpt, trSearch);
});
}
const liTR = document.getElementById('li-ta-roast');
const trPage = document.getElementById('page-ta-roast');
if (liTR && trPage) {
liTR.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
trPage.hidden = false;
const tw = document.getElementById('tr-tabs'); if (tw) tw.style.display = 'none';
switchTRTab('sys');
});
}
const trBackBtn = document.getElementById('tc-roast-back');
if (trBackBtn) {
trBackBtn.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
const home = document.getElementById('page-chatcard');
if (home) home.hidden = false;
});
}
const trEn = document.getElementById('tr-enable');
if (trEn) trEn.addEventListener('change', () => { const d = trLoad(); d.settings.enabled = trEn.checked; trSave(d); toast(trEn.checked ? 'TA的吐槽已开启' : 'TA的吐槽已关闭'); });
const trDefault = document.getElementById('tr-default');
if (trDefault) trDefault.addEventListener('change', () => {
const d = trLoad(); d.settings.useDefault = trDefault.checked; trSave(d);
switchTRTab(trTab);
toast(trDefault.checked ? '系统预设字卡已开启' : '系统预设字卡已关闭（仅用你添加的字卡）');
});
const trProb = document.getElementById('tr-prob');
if (trProb) trProb.addEventListener('input', () => {
const d = trLoad(); d.settings.prob = Math.max(0, Math.min(100, parseInt(trProb.value, 10) || 0)); trSave(d);
const v = document.getElementById('tr-prob-val'); if (v) v.textContent = trProb.value + '%';
toast('触发概率已设为 ' + trProb.value + '%');
});
const trPopup = document.getElementById('tr-popup');
if (trPopup) trPopup.addEventListener('input', () => {
const d = trLoad(); d.settings.popupProb = parseInt(trPopup.value, 10) || 0; trSave(d);
const v = document.getElementById('tr-popup-val'); if (v) v.textContent = trPopup.value + '%';
toast('弹窗概率已设为 ' + trPopup.value + '%');
});
const trAdd = document.getElementById('tr-new-add');
if (trAdd) {
(function rebuildTRSelect() {
const catEl = document.getElementById('tr-new-cat');
if (!catEl) return;
const d0 = trLoad();
catEl.innerHTML = window.cardGroups.catOptsHtml(TR_CAT_ORDER.map(k => [k, TR_CAT_LABEL[k]]), d0.groups || [], catEl.value);
window.cardGroups.bindNewGrp(catEl, d0.groups, function () { trSave(d0); });
})();
trAdd.addEventListener('click', () => {
const catEl = document.getElementById('tr-new-cat');
const textEl = document.getElementById('tr-new-text');
const matchEl = document.getElementById('tr-new-match');
const text = textEl ? textEl.value.trim() : '';
if (!text) { toast('请输入吐槽内容'); return; }
const parsed = window.cardGroups.parseCatVal(catEl ? catEl.value : 'light');
if (!parsed) { toast('请先选择分类或分组'); return; }
const match = (matchEl ? matchEl.value : '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 4);
const d = trLoad();
const q = { id: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 9999), cat: parsed.cat || 'light', text: text, match: match, enabled: true, isPreset: false };
if (parsed.grp) q.grp = parsed.grp;
d.questions.push(q);
trSave(d);
if (textEl) textEl.value = '';
if (matchEl) matchEl.value = '';
renderMineGroupsInto(document.getElementById('tr-mine-cats'), trMineOpt);
toast('已添加吐槽字卡');
});
}
const trNewGrp = document.getElementById('tr-new-grp');
if (trNewGrp) {
trNewGrp.addEventListener('click', () => {
const d = trLoad();
window.cardGroups.addFlow(d.groups, g => {
if (!g) return;
trSave(d);
(function refreshTRSelect() {
const catEl = document.getElementById('tr-new-cat');
if (catEl) {
catEl.innerHTML = window.cardGroups.catOptsHtml(TR_CAT_ORDER.map(k => [k, TR_CAT_LABEL[k]]), d.groups, catEl.value);
window.cardGroups.bindNewGrp(catEl, d.groups);
}
})();
if (trTab === 'mine') renderMineGroupsInto(document.getElementById('tr-mine-cats'), trMineOpt);
toast('已新建分组「' + g.name + '」');
});
});
}
window.triggerTaRoastNow = function () {
const d = trLoad();
const q = trPick(d, '');
if (!q) { toast('题库没有可用吐槽'); return; }
const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
trPush(q, { popupProb: askPopupProb(s) });
toast('TA 在聊天里吐槽你了');
};
const trNow = document.getElementById('tr-now');
if (trNow) trNow.addEventListener('click', () => window.triggerTaRoastNow());
const qaClose = document.getElementById('qa-mask-close');
if (qaClose) qaClose.addEventListener('click', () => { document.getElementById('qa-mask').hidden = true; });
function fmtDT(ts) {
const dd = new Date(ts);
return ('0' + dd.getHours()).slice(-2) + ':' + ('0' + dd.getMinutes()).slice(-2) + ' ' + ((dd.getMonth() + 1) + '月' + dd.getDate() + '日');
}
const GNS = (function () {
try { const p = window.activePrefix(); const i = p.lastIndexOf(':'); if (i > 0) return p.slice(0, i); } catch (e) {}
return 'xy-home-v2';
})();
function deskCids() {
const cur = window.__activeCid || 'default';
const list = [cur, 'default'].concat((window.getContacts ? window.getContacts() : []).map(function (c) { return c && c.id; }).filter(Boolean));
const seen = {}, out = [];
list.forEach(function (cid) { if (!cid || seen[cid]) return; seen[cid] = 1; out.push(cid); });
return out;
}
function deskRaw(cid, key) {
try {
if (cid === 'default') {
const ns = window.xyStore(GNS + ':default').get(key);
if (ns !== null && ns !== undefined) return ns;
return window.xyStore(GNS).get(key);
}
const s = window.storeFor ? window.storeFor(cid) : null;
return s ? s.get(key) : null;
} catch (e) { return null; }
}
function deskWrite(cid, key, val) {
try {
if (cid === 'default') {
window.xyStore(GNS + ':default').set(key, val);
try { window.xyStore(GNS).remove(key); } catch (e) {}
return;
}
const s = window.storeFor ? window.storeFor(cid) : null;
if (s) s.set(key, val);
} catch (e) {}
}
function allDeskHistories(key) {
const out = [];
deskCids().forEach(function (cid) {
const raw = deskRaw(cid, key);
if (!raw) return;
let d = null;
try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
const arr = Array.isArray(d) ? d : (d && Array.isArray(d.history) ? d.history : null);
if (!arr) return;
arr.forEach(function (x) { if (x) out.push(Object.assign({}, x, { __cid: cid })); });
});
out.sort(function (a, b) { return (Number(b && b.ts) || 0) - (Number(a && a.ts) || 0); });
return out;
}
function delDeskHistoryEntry(cid, key, ts) {
const raw = deskRaw(cid, key);
if (!raw) return false;
let d = null;
try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return false; }
const arr = Array.isArray(d) ? d : (d && Array.isArray(d.history) ? d.history : null);
if (!arr) return false;
const i = arr.findIndex(function (x) { return x && (Number(x.ts) || 0) === ts; });
if (i < 0) return false;
arr.splice(i, 1);
if (Array.isArray(d)) { deskWrite(cid, key, JSON.stringify(arr)); }
else { d.history = arr; deskWrite(cid, key, JSON.stringify(d)); }
return true;
}
function askListRender(el, h, key, name, rowFn) {
if (!el) return;
el.innerHTML = window.mochiHistFold(h.map(function (x) {
const label = String(x.q || x.roast || x.my || '').slice(0, 30);
return { ts: Number(x.ts) || 0, html: '<div class="tc-listitem">' + rowFn(x) + window.mochiHistDel((x.__cid || '') + '|' + (Number(x.ts) || 0), label) + '</div>' };
}), {
key: key,
empty: '<div class="ta-empty">暂无' + name + '记录</div>',
todayEmpty: '<div class="dc-h-day-empty">今天暂无' + name + '记录</div>'
});
window.mochiHistDelBind(el, {
title: '删除这条' + name + '记录？',
onDel: function (k) {
const p = String(k).split('|');
if (delDeskHistoryEntry(p[0], key, Number(p[1]))) {
window.renderAskRecords();
if (typeof window.toast === 'function') window.toast('已删除这条' + name + '记录');
}
}
});
}
window.renderAskRecords = function () {
const askEl = document.getElementById('ar-ask');
if (askEl) {
const h = allDeskHistories('ta-ask');
askListRender(askEl, h, 'ta-ask', '询问', function (x) {
return '<div class="tc-li-q">问：' + escG(x.q) + '</div>' + (x.status === 'pending' ? '<div class="tc-li-pending">待回答</div>' : '<div class="tc-li-line">你：' + escG(x.a) + '</div>' + (x.reply ? '<div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div>' : '')) + '<div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
});
}
const chEl = document.getElementById('ar-choose');
if (chEl) {
const h = allDeskHistories(KEY2);
askListRender(chEl, h, KEY2, '小问题', function (x) {
return '<div class="tc-li-q">' + escG(x.q) + '</div><div class="tc-li-line">你的选择：' + escG(x.my) + '</div><div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div><div class="tc-li-match">' + escG(x.match) + '</div><div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
});
}
const cuEl = document.getElementById('ar-curious');
if (cuEl) {
const h = allDeskHistories(KEY3);
askListRender(cuEl, h, KEY3, '好奇', function (x) {
return '<div class="tc-li-q">' + escG(x.q) + '</div><div class="tc-li-line">你：' + escG(x.my) + '</div><div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div><div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
});
}
const roEl = document.getElementById('ar-roast');
if (roEl) {
const h = allDeskHistories(KEY4);
askListRender(roEl, h, KEY4, '吐槽', function (x) {
return '<div class="tc-li-q">' + escG(x.roast) + '</div><div class="tc-li-line">你：' + escG(x.my) + '</div><div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div><div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
});
}
const inEl = document.getElementById('ar-invite');
if (inEl) {
const h = allDeskHistories('invite-ask-history');
askListRender(inEl, h, 'invite-ask-history', '邀请/问问', function (x) {
return '<div class="tc-li-q">' +
(x.type === 'invite' ? '邀请：' : '问：') + String(x.q || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</div>' +
'<div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + escG(window.taFit ? window.taFit(window.askCardReplyClean ? window.askCardReplyClean(x.a || '') : (x.a || '')) : (window.askCardReplyClean ? window.askCardReplyClean(x.a || '') : (x.a || ''))) + '</div>' +
'<div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
});
}
};
function clearDeskHistories(key) {
deskCids().forEach(function (cid) {
const raw = deskRaw(cid, key);
if (!raw) return; // 该桌面从未写过该分类：无需清，也不新建空档
let d = null;
try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
if (Array.isArray(d)) { deskWrite(cid, key, '[]'); return; }
if (!d || typeof d !== 'object') return;
d.history = [];
try { deskWrite(cid, key, JSON.stringify(d)); } catch (e) {}
});
}
function refreshAskRecordsIfOpen() {
try {
const pg = document.getElementById('page-interact');
if (pg && !pg.hidden && window.renderAskRecords) window.renderAskRecords();
} catch (e) {}
}
const clearBind = (id, key, label) => {
const btn = document.getElementById(id);
if (!btn) return;
btn.addEventListener('click', () => {
if (window.openModal) {
window.openModal('清空全部桌面的' + label + '记录？', '', () => {
clearDeskHistories(key);
window.renderAskRecords();
}, { noInput: true });
}
});
};
clearBind('ar-ask-clear', KEY, '询问');
clearBind('ar-choose-clear', KEY2, '小问题');
clearBind('ar-curious-clear', KEY3, '好奇');
clearBind('ar-roast-clear', KEY4, '吐槽');
const arInviteClear = document.getElementById('ar-invite-clear');
if (arInviteClear) {
arInviteClear.addEventListener('click', () => {
if (window.openModal) {
window.openModal('清空全部桌面的邀请/问问记录？', '', () => {
clearDeskHistories('invite-ask-history');
window.renderAskRecords();
}, { noInput: true });
}
});
}
document.querySelectorAll('#page-interact .fav-tab').forEach(tab => {
tab.addEventListener('click', () => {
document.querySelectorAll('#page-interact .fav-tab').forEach(x => x.classList.toggle('sel', x === tab));
const k = tab.dataset.tab;
document.querySelectorAll('#page-interact .cal-card').forEach(c => {
c.hidden = c.dataset.panel !== k;
});
if (window.renderAskRecords) window.renderAskRecords();
});
});
window.refreshTaCardCounts = function () {
const setSys = (id, n) => { const el = document.querySelector('#' + id + ' .t'); if (el) el.textContent = n; };
const setMine = (id, n) => { const el = document.querySelector('#' + id + '-mine .t'); if (el) el.textContent = n; };
const split = (id, qs) => {
setSys(id, qs.filter(q => q && q.isPreset === true).length);
setMine(id, qs.filter(q => q && q.isPreset !== true).length);
};
try { split('li-ta-ask', taAskLoad().questions); } catch (e) {}
try { split('li-ta-choose', tcLoad().questions); } catch (e) {}
try { split('li-ta-curious', tcuLoad().questions); } catch (e) {}
try { split('li-ta-roast', trLoad().questions); } catch (e) {}
};
(function () {
const openMine = (liId, pageId, tabsId, switchFn) => {
const liEl = document.getElementById(liId);
const pgEl = document.getElementById(pageId);
if (!liEl || !pgEl) return;
liEl.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
pgEl.hidden = false;
const tw = document.getElementById(tabsId); if (tw) tw.style.display = 'none';
switchFn('mine');
});
};
openMine('li-ta-ask-mine', 'page-ta-ask', 'ta-ask-tabs', switchAskTab);
openMine('li-ta-choose-mine', 'page-ta-choose', 'tc-tabs', switchTCTab);
openMine('li-ta-curious-mine', 'page-ta-curious', 'tcu-tabs', switchTCUTab);
openMine('li-ta-roast-mine', 'page-ta-roast', 'tr-tabs', switchTRTab);
})();
window.__cardSearchFns = window.__cardSearchFns || [];
[
{ name: 'TA的询问', load: taAskLoad },
{ name: 'TA的小问题', load: tcLoad },
{ name: 'TA的好奇', load: tcuLoad },
{ name: 'TA的吐槽', load: trLoad }
].forEach(function (it) {
window.__cardSearchFns.push({ name: it.name, fn: function (kw) {
const out = [];
try { (it.load().questions || []).forEach(function (q) { const txt = q && q.text ? q.text : ''; if (txt && txt.toLowerCase().indexOf(kw) >= 0) out.push({ t: txt, cat: q.isPreset === true ? '系统预设' : '我的添加' }); }); } catch (e) {}
return out;
} });
});
const ccPageEl = document.getElementById('page-chatcard');
if (ccPageEl) {
const mo = new MutationObserver(() => { if (!ccPageEl.hidden) window.refreshTaCardCounts(); });
mo.observe(ccPageEl, { attributes: true, attributeFilter: ['hidden'] });
}
window.refreshTaCardCounts();
function attachIdbRestore(key, loadFn, mergeFn) {
if (!window.idbGet) return;
window.idbGet(window.activePrefix() + ':' + key).then(function (v) {
if (v === undefined || v === null) return;
try {
const idbData = typeof v === 'string' ? JSON.parse(v) : v;
if (!idbData || typeof idbData !== 'object' || Array.isArray(idbData)) return;
if (!Array.isArray(idbData.questions) || !idbData.questions.length) return;
const local = loadFn();
const idbCnt = idbData.questions.length;
const localCnt = Array.isArray(local.questions) ? local.questions.length : 0;
if (idbCnt > localCnt) {
if (mergeFn) mergeFn(idbData);
try { store.set(key, JSON.stringify(idbData)); } catch (e) {}
try { window.refreshTaCardCounts(); } catch (e) {}
}
} catch (e) {}
});
}
attachIdbRestore(KEY, taAskLoad, taAskMerge);
attachIdbRestore(KEY2, tcLoad, tcMerge);
attachIdbRestore(KEY3, tcuLoad, tcuMerge);
attachIdbRestore(KEY4, trLoad, trMerge);
const SKEY = 'ta-survey';
function surveyLoad() {
let d = null;
try { d = JSON.parse(store.get(SKEY) || 'null'); } catch (e) { d = null; }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
if (typeof d.text !== 'string') d.text = '';
if (!d.settings || typeof d.settings !== 'object') d.settings = { prob: 10, deadline: 0, sendToChat: true };
if (typeof d.settings.prob !== 'number') d.settings.prob = 10;
if (typeof d.settings.deadline !== 'number') d.settings.deadline = 0;
if (typeof d.settings.sendToChat !== 'boolean') d.settings.sendToChat = true;
if (!Array.isArray(d.qs)) d.qs = [];
if (!Array.isArray(d.answers)) d.answers = [];
if (d.status !== 'sent' && d.status !== 'done') { d.status = 'draft'; d.sentAt = 0; }
if (typeof d.doneMsgAt !== 'number') d.doneMsgAt = 0;
return d;
}
function surveySave(d) { try { store.set(SKEY, JSON.stringify(d)); } catch (e) {} }
function surveySyncCard(d) {
try { if (window.chatSyncSurveyCard) window.chatSyncSurveyCard(d.sentAt, d.status, d.answers.slice()); } catch (e) {}
}
function askMultiMarkOf(text) {
const s = String(text == null ? '' : text).trim();
const capOf = function (n) { const v = parseInt(n, 10); return (v >= 2 && v <= 6) ? v : 0; };
const br = s.match(/[（(]\s*多\s*选\s*(?:[·•:：]?\s*最\s*多\s*(\d{1,2})\s*个?\s*)?[)）]\s*$/);
if (br) return { text: s.slice(0, br.index).trim(), multi: true, max: capOf(br[1]) };
const bare = s.length > 2 ? s.match(/\s*多\s*选\s*(?:[·•:：]?\s*最\s*多\s*(\d{1,2})\s*个?\s*)?$/) : null;
if (bare) return { text: s.slice(0, bare.index).trim(), multi: true, max: capOf(bare[1]) };
return { text: s, multi: false, max: 0 };
}
function surveyParse(text) {
const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const qs = [];
let cur = null, marked = false;
const flush = () => {
if (!cur) return;
if (!marked && cur.opts.length >= 2) {
const sq = { type: cur.multi ? 'multi' : 'single', text: cur.text, options: cur.opts.slice() };
if (cur.multi && cur.max >= 2) sq.multiMax = cur.max;
qs.push(sq);
}
else qs.push({ type: 'text', text: cur.text, options: [] });
cur = null; marked = false;
};
lines.forEach(t => {
const m = t.match(/^【(.+?)】$/);
if (m) {
flush();
const mk = askMultiMarkOf(m[1]);
if (mk.text) cur = { text: mk.text, opts: [], multi: mk.multi, max: mk.max || 0 };
return;
}
if (cur) {
if (!marked && !cur.opts.length && t === '一') { marked = true; return; }
cur.opts.push(t); return;
}
flush();
qs.push({ type: 'text', text: t, options: [] }); // 无【】裸行：整行当文字题题干
});
flush();
return qs.filter(q => q.text);
}
function surveyAnswerText() {
let t = '';
let words = [];
try {
const cards = (window.getCustomCards && window.getCustomCards()) || [];
words = cards.filter(s => typeof s === 'string' && s.trim() && s.indexOf('data:') !== 0 && s.indexOf('|||') < 0 && !/^https?:\/\//i.test(s) && !(window.mochiMediaIsToken && window.mochiMediaIsToken(s)));
} catch (e) {}
if (words.length) {
const n = 1 + Math.floor(Math.random() * Math.min(5, words.length));
const copy = words.slice(); const out = [];
while (out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
t = (window.pyJoinCards && window.replyCfg) ? window.pyJoinCards(out, window.replyCfg()) : out.join(' ');
}
try {
const dc = window.getDefaultCards && window.getDefaultCards('chat');
if (dc && dc.type !== 'poke' && typeof dc.text === 'string' && dc.text.trim()) t = dc.text;
} catch (e) {}
if (!t) {
if (window.cardLockOpen && window.cardLockOpen()) {
t = window.pickAskCardReply ? window.pickAskCardReply() : '收到你的回答。';
} else {
t = '……';
}
}
return t;
}
function surveyPickAnswer(q) {
if (q && Array.isArray(q.options) && q.options.length) {
if (q.type === 'multi' && typeof window.mochiPickMulti === 'function') {
const max = (q.multiMax >= 2 && q.multiMax <= 6) ? q.multiMax
: (typeof window.askMultiMaxLoad === 'function' ? window.askMultiMaxLoad() : 3);
return window.mochiPickMulti(q.options.length, max).map(k => String(q.options[k] == null ? '' : q.options[k])).join('、');
}
if (q.type === 'single' || q.type === 'multi') return q.options[Math.floor(Math.random() * q.options.length)];
}
return surveyAnswerText();
}
function surveySeqAnswers(qs, cb, i) {
if (i >= qs.length) { cb(); return; }
const q = qs[i];
const ans = surveyPickAnswer(q);
const cur = surveyLoad();
if (cur.status !== 'sent') { cb(); return; }
cur.answers.push(ans);
surveySave(cur);
surveySyncCard(cur);
if (cur.settings.sendToChat !== false) {
const isPick = (q.type === 'single' || q.type === 'multi') && Array.isArray(q.options) && q.options.length;
const msg = isPick
? '【' + q.text + '】我的选择：' + ans
: '【' + q.text + '】' + ans;
try { window.chatAddIn(msg, {}); } catch (e) {}
}
surveyRender();
setTimeout(() => surveySeqAnswers(qs, cb, i + 1), 1200 + Math.floor(Math.random() * 1600));
}
let surveySubmitLock = false;
function surveySubmitAll(d, early) {
if (surveySubmitLock) return;
surveySubmitLock = true;
const remaining = d.qs.slice(d.answers.length);
const finish = () => {
surveySubmitLock = false;
const d2 = surveyLoad();
if (d2.status !== 'sent') return;
d2.answers = d2.qs.map((q, i) => d2.answers[i] || surveyPickAnswer(q));
d2.status = 'done';
const notify = d2.doneMsgAt !== d2.sentAt;
if (notify) d2.doneMsgAt = d2.sentAt;
surveySave(d2);
surveySyncCard(d2); // v3.33.x #521：交卷态回写聊天问卷卡片
if (notify) {
try { window.chatAddSystem(early ? 'TA 提前交卷了（共 ' + d2.qs.length + ' 题）。' : 'TA 交卷了（共 ' + d2.qs.length + ' 题）。', { special: 'ask-msg' }); } catch (e) {}
}
surveyRender();
};
if (remaining.length) surveySeqAnswers(remaining, finish, 0); else finish();
}
function surveyTick() {
let d;
try { d = surveyLoad(); } catch (e) { return; }
if (d.status !== 'sent') return;
if (Date.now() - (d.sentAt || 0) < 15000) return; // 刚发出 15s 内不动作
const done = d.answers.length >= d.qs.length;
const deadlineHit = d.settings.deadline > 0 && Date.now() >= d.settings.deadline;
const earlyHit = !done && !deadlineHit && Math.random() * 100 < d.settings.prob;
if (done || deadlineHit || earlyHit) { surveySubmitAll(d, earlyHit); return; }
const q = d.qs[d.answers.length];
if (!q) return;
surveySeqAnswers([q], () => {}, 0);
}
setInterval(surveyTick, 30000);
function surveySend() {
const d = surveyLoad();
if (d.status === 'sent') { toast('问卷已发出，TA 正在作答'); return; }
const tEl = document.getElementById('ta-survey-text');
if (tEl) { d.text = tEl.value; d.qs = surveyParse(tEl.value); surveySave(d); }
if (!d.qs.length) { toast('请先填写问卷题目（【问题】+ 选项行 / 「一」行）'); return; }
if (d.settings.deadline && d.settings.deadline <= Date.now()) { toast('交卷时间已过期，请重新设置'); return; }
d.status = 'sent'; d.sentAt = Date.now(); d.answers = []; d.doneMsgAt = 0;
surveySave(d);
try { window.chatAddSystem('你向TA发出了一份问卷（' + d.qs.length + ' 题）。', { special: 'ask-msg' }); } catch (e) {}
try {
window.chatAddSystem('问卷（' + d.qs.length + ' 题）', {
special: 'ask-survey',
surveyTs: d.sentAt,
surveyQs: JSON.parse(JSON.stringify(d.qs)),
surveyStatus: 'sent',
surveyAnswers: []
});
} catch (e) {}
surveyRender();
toast('问卷已发出，TA 开始作答');
surveyGoChat();
}
function surveyRender() {
const d = surveyLoad();
const txt = document.getElementById('ta-survey-text');
if (txt && document.activeElement !== txt && txt.value !== d.text) txt.value = d.text;
const dl = document.getElementById('ta-survey-deadline');
if (dl) dl.textContent = d.settings.deadline ? fmtDeadlineText(d.settings.deadline) : '未设置';
const prob = document.getElementById('ta-survey-prob');
if (prob && document.activeElement !== prob) prob.value = d.settings.prob;
const pv = document.getElementById('ta-survey-prob-val');
if (pv) pv.textContent = d.settings.prob + '%';
const schatEl = document.getElementById('ta-survey-chat');
if (schatEl) schatEl.checked = d.settings.sendToChat !== false;
const mmaxEl = document.getElementById('ta-survey-mmax-val');
if (mmaxEl) mmaxEl.value = typeof window.askMultiMaxLoad === 'function' ? window.askMultiMaxLoad() : 3;
const st = document.getElementById('ta-survey-status');
if (st) {
if (d.status === 'draft') {
const nS = d.qs.filter(q => q.type === 'single').length;
const nM = d.qs.filter(q => q.type === 'multi').length;
const brk = d.qs.length ? '（单选 ' + nS + ' 题' + (nM ? ' / 多选 ' + nM + ' 题' : '') + ' / 文字 ' + (d.qs.length - nS - nM) + ' 题）' : '';
const cap = (typeof window.askMultiMaxLoad === 'function' ? window.askMultiMaxLoad() : 3);
const nCap = d.qs.filter(q => q.type === 'multi' && q.multiMax >= 2).length;
st.innerHTML = '当前状态：草稿 —— 已解析 <b>' + d.qs.length + '</b> 题' + brk + (nM ? '；多选题' + (nCap ? nCap + ' 题单独限选、其余' : '') + '每次最多选 ' + cap + ' 个。' : '。') + '填好后点「发出问卷给TA」。';
} else if (d.status === 'sent') {
st.innerHTML = '当前状态：TA 作答中 —— 已答 <b>' + d.answers.length + '</b> / ' + d.qs.length + ' 题' + (d.settings.deadline ? '；交卷时间 ' + fmtDeadlineText(d.settings.deadline) : '；未设交卷时间') + '；每 30 秒按 ' + d.settings.prob + '% 概率提前交卷。';
} else {
st.innerHTML = '当前状态：已交卷 —— 共 ' + d.qs.length + ' 题。可直接再点「发出问卷给TA」重新提交一轮（清空上一轮作答、在聊天里插入新的问卷卡片）。';
}
}
}
const surveyPage = document.getElementById('page-ta-ask-survey');
let surveyOpenFromChat = false;
window.openAskSurvey = function () {
if (!surveyPage) { toast('批量问卷加载失败'); return; }
surveyOpenFromChat = true;
document.querySelectorAll('.page').forEach(p => p.hidden = true);
surveyPage.hidden = false;
surveyRender();
};
window.openSurveyDetail = function (rec) {
try {
const qs = Array.isArray(rec && rec.surveyQs) ? rec.surveyQs : [];
const answers = Array.isArray(rec && rec.surveyAnswers) ? rec.surveyAnswers : [];
const done = !!(rec && rec.surveyStatus === 'done');
const nDone = answers.filter(a => typeof a === 'string' && a.trim()).length;
if (!qs.length) { toast('这份问卷没有题目'); return; }
const bankTexts = function () {
const set = {};
try { (taAskLoad().questions || []).forEach(b => { if (b && b.text) set[String(b.text)] = true; }); } catch (e) {}
return set;
};
let bankSet = bankTexts();
const favStates = qs.map(q => !!bankSet[String((q && q.text) || '').trim()]);
const actBtnCss = 'border:1px solid rgba(127,127,127,.3);background:rgba(127,127,127,.12);color:var(--ink);border-radius:99px;padding:6px 12px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer';
let html = '';
html += '<div class="tc-hint">' + escT('你发出的问卷 · 共 ' + qs.length + ' 题 · ' + (done ? '已交卷' : 'TA 作答中（已答 ' + nDone + '/' + qs.length + '）')) + (rec && rec.surveyTs ? '<br>' + escT('发出时间：' + fmtDeadlineText(rec.surveyTs)) : '') + '</div>';
html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0 2px">' +
'<button id="sv-fav-card" style="' + actBtnCss + '">♡ 收藏整份问卷</button>' +
'<button id="sv-fav-allbtn" style="' + actBtnCss + '">★ 全部收藏题目</button>' +
'</div>';
html += '<div style="display:flex;align-items:center;gap:14px;justify-content:center;margin:8px 0 10px">' +
'<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);cursor:pointer"><input type="checkbox" id="sv-fav-chkall" style="width:15px;height:15px">全选</label>' +
'<button id="sv-fav-sel" style="' + actBtnCss + '">☆ 收藏所选</button>' +
'</div>';
html += '<div id="sv-detail-list">';
qs.forEach((q, i) => {
const a = answers[i];
const aTxt = (typeof a === 'string' && a.trim()) ? (window.taFit ? window.taFit(a) : a) : '';
const opts = (q && Array.isArray(q.options) && q.options.length) ? q.options : null;
html += '<div class="tc-listitem" style="text-align:left">' +
'<div class="tc-li-top">' +
'<input type="checkbox" class="sv-fav-cb" data-i="' + i + '" style="width:16px;height:16px;flex-shrink:0;cursor:pointer">' +
'<span class="tc-li-q">' + (i + 1) + '. ' + escT((q && q.text) || '') + (opts ? ' <span class="tc-known">' + (q.type === 'multi' ? '多选' + (q.multiMax >= 2 ? '·限' + q.multiMax : '') + '·' : '单选·') + opts.length + '选项</span>' : '') + '</span>' +
'<span class="sv-fav-state" data-i="' + i + '" style="font-size:11px;font-weight:600;color:#c2864b;flex-shrink:0;white-space:nowrap">' + (favStates[i] ? '★ 已收藏' : '') + '</span>' +
'</div>' +
(opts ? '<div class="tc-li-line">选项：' + escT(opts.join(' / ')) + '</div>' : '') +
(aTxt ? '<div class="tc-li-line" style="color:#3b7a4e;font-weight:600">TA：' + escT(aTxt) + '</div>' : '<div class="tc-li-line">（未作答）</div>') +
'</div>';
});
html += '</div>';
openTCPanel('问卷详情', html);
const syncStates = function () {
document.querySelectorAll('#sv-detail-list .sv-fav-state').forEach(el => {
const i = Number(el.dataset.i);
if (el) el.textContent = favStates[i] ? '★ 已收藏' : '';
});
};
const favIntoBank = function (idxList, fromAll) {
const d = taAskLoad();
let added = 0, dup = 0;
idxList.forEach(i => {
const q = qs[i];
const text = String((q && q.text) || '').trim();
if (!text) { dup++; return; }
if ((d.questions || []).some(b => b && String(b.text || '') === text)) { dup++; return; }
const nq = { id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 9999), text: text, cat: 'daily', enabled: true, isPreset: false };
if (q && Array.isArray(q.options) && q.options.length >= 2) { nq.type = q.type === 'multi' ? 'multi' : 'single'; nq.options = q.options.slice(0, 12).map(o => String(o)); if (nq.type === 'multi' && q.multiMax >= 2) nq.multiMax = q.multiMax; }
d.questions.push(nq);
added++;
});
if (!added) { toast(fromAll ? '全部题目都已在题库里' : '所选题目都已在题库里'); return; }
taAskSave(d);
bankSet = bankTexts();
qs.forEach((q, i) => { favStates[i] = !!bankSet[String((q && q.text) || '').trim()]; });
syncStates();
toast('已收藏 ' + added + ' 道题到问问TA题库' + (dup ? '（' + dup + ' 道已在题库）' : ''));
};
const cardBtn = document.getElementById('sv-fav-card');
if (cardBtn) cardBtn.addEventListener('click', () => {
let idx = -1;
try {
const mlist = (window.getChatMsgs ? window.getChatMsgs() : []) || [];
for (let i = mlist.length - 1; i >= 0; i--) {
const r = mlist[i];
if (r && (r === rec || (rec.surveyTs && r.special === 'ask-survey' && r.surveyTs === rec.surveyTs))) { idx = i; break; }
}
} catch (e) {}
if (idx >= 0 && window.favCardFromMsg) window.favCardFromMsg(idx);
else toast('找不到原问卷卡片');
});
const allBtn = document.getElementById('sv-fav-allbtn');
if (allBtn) allBtn.addEventListener('click', () => {
const rest = [];
qs.forEach((q, i) => { if (!favStates[i]) rest.push(i); });
if (!rest.length) { toast('全部题目都已在题库里'); return; }
favIntoBank(rest, true);
});
const selBtn = document.getElementById('sv-fav-sel');
if (selBtn) selBtn.addEventListener('click', () => {
const picked = [];
document.querySelectorAll('#sv-detail-list .sv-fav-cb').forEach(cb => { if (cb.checked) picked.push(Number(cb.dataset.i)); });
if (!picked.length) { toast('请先勾选要收藏的题目'); return; }
favIntoBank(picked, false);
});
const chkAll = document.getElementById('sv-fav-chkall');
if (chkAll) chkAll.addEventListener('change', () => {
document.querySelectorAll('#sv-detail-list .sv-fav-cb').forEach(cb => { cb.checked = chkAll.checked; });
});
} catch (e) {}
};
function surveyGoChat() {
surveyOpenFromChat = false;
document.querySelectorAll('.page').forEach(p => p.hidden = true);
if (window.enterChat) { window.enterChat(); return; }
const home = document.getElementById('page-ta-ask');
if (home) home.hidden = false;
}
if (surveyPage) {
const surveyOpen = document.getElementById('ta-ask-survey-open');
if (surveyOpen) surveyOpen.addEventListener('click', () => {
document.querySelectorAll('.page').forEach(p => p.hidden = true);
surveyPage.hidden = false;
surveyRender();
});
const backS = document.getElementById('ta-survey-back');
if (backS) backS.addEventListener('click', () => {
surveyGoChat();
});
const stxt = document.getElementById('ta-survey-text');
if (stxt) {
stxt.addEventListener('change', () => {
const d = surveyLoad();
d.text = stxt.value;
d.qs = surveyParse(stxt.value);
surveySave(d);
surveyRender();
});
bindTaInpClears(stxt.parentElement);
}
const sdl = document.getElementById('ta-survey-deadline');
const sdlRow = sdl ? sdl.closest('.gs-row') : null;
if (sdlRow) sdlRow.addEventListener('click', (e) => {
if (e.target.closest('#ta-survey-deadline-clear')) return;
openDeadlinePicker('交卷时间', surveyLoad().settings.deadline, (ts) => {
const d = surveyLoad();
d.settings.deadline = ts > 0 ? ts : 0;
surveySave(d);
toast(d.settings.deadline ? '交卷时间已设置：' + fmtDeadlineText(d.settings.deadline) : '交卷时间已清除');
surveyRender();
});
});
const sdlClear = document.getElementById('ta-survey-deadline-clear');
if (sdlClear) sdlClear.addEventListener('click', () => {
const d = surveyLoad();
d.settings.deadline = 0;
surveySave(d);
if (sdl) sdl.textContent = '未设置';
toast('交卷时间已清除');
surveyRender();
});
const sprob = document.getElementById('ta-survey-prob');
if (sprob) sprob.addEventListener('input', () => {
const d = surveyLoad();
d.settings.prob = parseInt(sprob.value, 10) || 0;
surveySave(d);
const v = document.getElementById('ta-survey-prob-val');
if (v) v.textContent = sprob.value + '%';
});
const schat = document.getElementById('ta-survey-chat');
if (schat) schat.addEventListener('change', () => {
const d = surveyLoad();
d.settings.sendToChat = schat.checked;
surveySave(d);
toast(schat.checked ? 'TA 的每条作答都会发送到聊天消息' : 'TA 的作答只写入问卷卡片，不再逐条发到聊天消息');
});
const mmaxRow = document.getElementById('ta-survey-mmax');
if (mmaxRow) {
const mmaxVal = document.getElementById('ta-survey-mmax-val');
const clampMMax = () => {
let n = parseInt(mmaxVal.value, 10);
if (isNaN(n)) n = 3;
else n = n < 2 ? 2 : (n > 6 ? 6 : n);
mmaxVal.value = n;
if (typeof window.askMultiMaxSave === 'function') window.askMultiMaxSave(n);
};
mmaxRow.querySelector('.stp-min').addEventListener('click', (e) => { if (e) e.stopPropagation(); mmaxVal.value = (parseInt(mmaxVal.value, 10) || 3) - 1; clampMMax(); });
mmaxRow.querySelector('.stp-max').addEventListener('click', (e) => { if (e) e.stopPropagation(); mmaxVal.value = (parseInt(mmaxVal.value, 10) || 3) + 1; clampMMax(); });
}
const ssend = document.getElementById('ta-survey-send');
if (ssend) ssend.addEventListener('click', surveySend);
const sreset = document.getElementById('ta-survey-reset');
if (sreset) sreset.addEventListener('click', () => {
const d = surveyLoad();
if (d.status === 'draft' && !d.answers.length) { toast('尚未发出问卷'); return; }
d.status = 'draft'; d.answers = []; d.sentAt = 0;
surveySave(d);
surveyRender();
toast('问卷已撤回（重置为草稿）');
});
surveyRender();
}
var _askCeReflowT = null;
function _reflowAskCeBoxes() {
var page = document.getElementById('page-ta-ask');
if (!page || page.hidden) return;
page.querySelectorAll('.ta-add .ce-box').forEach(function (b) {
if (b.offsetParent === null) return;
var prev = b.style.transform;
b.style.transform = 'translateZ(0)';
void b.offsetHeight;
b.style.transform = prev;
});
}
function _schedAskCeReflow() {
clearTimeout(_askCeReflowT);
_askCeReflowT = setTimeout(_reflowAskCeBoxes, 120);
}
if (window.visualViewport) window.visualViewport.addEventListener('resize', _schedAskCeReflow);
window.addEventListener('resize', _schedAskCeReflow);
document.addEventListener('contact-switched', function () {
_tcSessionTriggered = false;
_tcAskedIds = [];
_tcChain = 0;
_tcuSessionTriggered = false;
_trSessionTriggered = false;
});
try { if (window.cardGroups) window.cardGroups.ensureCustomSelects(); } catch (e) {}
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("ta-ask.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("ta-ask.js"); try { console.error("[JS] ta-ask.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[ta-ask.js] " + String(__e && __e.message || __e)); } })();