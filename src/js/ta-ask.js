// ===== 功能：TA的询问 =====
// 题库 3 分类（日常/关心/互动），可添加/删除/开关问题；
// 联系人随机触发向你提问（v3.12.x：冷却 45 分钟、概率 10%——用户反馈发卡太频繁，原 25 分钟/20%；启动 60 秒后首次检查、每 4 分钟轮询）；
// #1153：五类互动卡（询问/小问题/好奇/吐槽/分享你的字卡）整体频率可按「互动卡频率」三档缩放
//（频繁/原频率/安静，回复设置页可调）；原频率＝全部 ×1、行为不变。详见下方 IC_MODES 段。
// 聊天里显示"TA想问你一个问题。" + 询问卡片，点击卡片可回答；
// 回答后显示"我的回答" + "收到你的回答。"，并记入历史（最多 50 条）；
// 管理页可"让TA现在问一次"（无视冷却/概率），并可清空问答历史
(function () {
  const uid = window.activePrefix();
  const store = window.activeStore();
  const KEY = 'ta-ask';

  // ================= 我的添加：自定义分组通用工具（TA的询问/小问题/好奇/吐槽、查岗、今日情话共用） =================
  // 数据模型：groups=[{id,name}]（存各模块数据对象或独立键）；条目可选 grp=分组id（缺省=未分组）
  // 分组只用于管理页整理展示，不影响自动抽取逻辑（抽取仍按 isPreset/enabled/useDefault）
  function grpToast(msg) {
    let t = document.getElementById('cc-toast');
    if (!t) { t = document.createElement('div'); t.id = 'cc-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = 'cc-toast'; }, 2000);
  }
  function escG(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  // #1415：题库条目上的题型徽标——单选题一直写的是「单选·N选项」，多选题进来必须换个词，
  // 否则列表里两种题长得一模一样，出题的人分不清自己哪道会让 TA 多挑几个。
  function askTypeBadge(q) {
    const n = q && Array.isArray(q.options) ? q.options.length : 0;
    if (q && q.type === 'single') return ' <span class="tc-known">单选·' + n + '选项</span>';
    // #1480：题上写死了「最多N」的，徽标跟着亮出来（多选·限2·5选项），列表里一眼分清哪道限几道不限
    if (q && q.type === 'multi') return ' <span class="tc-known">多选' + (q.multiMax >= 2 ? '·限' + q.multiMax : '') + '·' + n + '选项</span>';
    return '';
  }
  // FIX 2026-09-17 #648 问答/收藏记录页「TA回应」列——存量落库的媒体卡回应（@@m: 令牌/
  // 「名称|||data:」/图链）先清洗为 [图片]/名称再转义；此前这些列表直拼 f.reply/x.reply
  //（连转义都没有），既直出令牌串又可能把导入数据里的 HTML 当标签执行
  function taReplyShow(s) {
    const t = (window.askCardReplyClean ? window.askCardReplyClean(s) : String(s == null ? '' : s));
    return escG(window.taFit ? window.taFit(t) : t);
  }
  // v3.7.x：系统预设 tab 内联展示 TA 回应话术池（只读，开关在「互动回应」tab）——
  // 询问/吐槽 文字题无题自带回应，每个问题下内联通用池（getInteractPool 同源）
  function interactPoolInlineHtml(poolName) {
    const arr = window.getInteractPool ? window.getInteractPool(poolName, []) : [];
    if (!arr.length) return '';
    return '<div class="tc-qopts">TA 回应：<span class="tc-known">系统</span> ' + arr.map(escG).join(' / ') + '</div>';
  }
  // #1315：系统预设字卡「整类停用」（共用件＝default-cards.js 的 window.presetGroup，键 pg-groups-off）。
  //   本文件四类（询问/小问题/好奇/吐槽）的分类就是它们的「分组」，页顶分类条上挂整类开关；
  //   判据只认「这条是不是系统预设 + 它所属分类有没有被停用」——用户在「我的添加」里自建的同类
  //   条目不受这把闸影响（那部分有自己的逐条启停）。
  function pgCatOff(ns, cat) { return !!(window.presetGroup && window.presetGroup.isOff(ns, cat || 'daily')); }
  function presetCatOpen(ns, q) { return !(q && q.isPreset === true && pgCatOff(ns, q.cat)); }
  window.cardGroups = {
    genId: function () { return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); },
    toast: grpToast,
    esc: escG,
    dup: function (groups, name, ignoreId) { return groups.some(function (g) { return g.name === name && g.id !== ignoreId; }); },
    // 新建分组弹窗 → cb(新分组对象|null)
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
    // 重命名分组弹窗 → cb(newName|null)
    renameFlow: function (g, groups, cb) {
      if (!window.openModal) { cb(null); return; }
      window.openModal('重命名分组', g.name, function (v) {
        const name = String(v || '').trim();
        if (!name) { cb(null); return; }
        if (window.cardGroups.dup(groups, name, g.id)) { grpToast('分组「' + name + '」已存在'); cb(null); return; }
        cb(name);
      });
    },
    // 删除分组确认弹窗（noInput，确定即删；组内字卡回到未分组）→ cb(true/false)
    removeFlow: function (name, cb) {
      if (!window.openModal) { cb(true); return; }
      window.openModal('删除分组', '', function () { cb(true); }, { noInput: true, staticText: '删除分组「' + name + '」？组内字卡不会丢失，会回到「未分组」。' });
    },
    // 系统分类 + 我的分组 合并 select options（添加/批量导入下拉共用）
    // catList: [[k,label],...]；groups: [{id,name}]；cur: 当前选中原始值
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
    // 纯「我的分组」select options（无系统分类的模块用：查岗/今日情话）+ 新建分组选项
    grpOnlyOptsHtml: function (groups, cur) {
      let h = '<option value="">未分组</option>';
      groups.forEach(function (g) { h += '<option value="grp:' + g.id + '"' + (cur === 'grp:' + g.id ? ' selected' : '') + '>' + escG(g.name) + '</option>'; });
      h += '<option value="__newgrp">＋ 新建分组…</option>';
      return h;
    },
    // 解析下拉值 → {cat, grp}（系统分类值原样返回；grp:xxx → grp；__newgrp → 返回 null 需先建组）
    parseCatVal: function (v) {
      if (typeof v === 'string' && v.indexOf('grp:') === 0) return { cat: null, grp: v.slice(4) };
      if (v === '__newgrp') return null;
      return { cat: v || 'daily', grp: null };
    },
    // 给 select 绑定「＋ 新建分组…」option：change 到 __newgrp 时弹窗建组，建好后选中新组
    // 多次调用只绑定一次（防重复弹窗），groups/onChanged 取最新值（刷新下拉后更新）
    // onChanged(g) 可选——需要额外持久化 groups 的模块（查岗/情话）在此保存
    bindNewGrp: function (sel, groups, onChanged) {
      // v3.28.x：分组/分类原生下拉也统一替换成自定义样式（bindNewGrp 是所有分组
      // select 的必经点，在此挂一次即可覆盖全部添加/批量导入的分组选择）
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
    // v3.28.x：把原生 <select>（分组/分类选择）包裹成网站内自定义下拉，替代浏览器
    // 自带下拉框（用户反馈「点开是浏览器自带的框」「今日情话/查岗/问问TA等添加/批量
    // 导入的分组选择不是网站样式」）。对外零侵入：只镜像 sel 的 option/optgroup 供
    // 点选，点选后仍写 sel.value 并派发 change（bubbles）——既有消费方
    // （catOptsHtml/grpOnlyOptsHtml 填充 + parseCatVal 读值 + bindNewGrp 新建分组 +
    // onchange 重渲染）全部原样工作。__newgrp 照发 change，交给 bindNewGrp 建组逻辑。
    // 幂等（marker）；innerHTML 被重刷（建组/切分类后重渲染）经 MutationObserver 自动重建菜单。
    attachCustom: function (sel) {
      if (!sel || sel.nodeType !== 1 || sel.tagName !== 'SELECT' || sel.__mochiCsWrap) return;
      sel.__mochiCsWrap = true;
      // 保存原生宽度，包一层同名占位避免布局塌陷（.ta-type 92px / 批量下拉 flex 宽度）
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
      // portal 式浮层：挂到 body 固定定位，避开滚动/溢出裁剪容器（设置/音乐等面板内的
      // select 若沿用 absolute 会被父容器裁掉）。打开时按触发器 rect 定位、视口越界自动翻转。
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
        // FIX 2026-09-16 #544：CSS `.mochi-custom-select-list{display:none}` 是默认收起态，
        // 这里必须显式写 block——原写 '' 只清内联样式，回落样式表仍是 none，浮层永远打不开
        // （用户现象：音乐「导入到歌单」等全站下拉点了不展开；vivo X200s+Edge 等多机型）。
        list.style.display = 'block';
        open = true;
        wrap.classList.add('open');
        rebuild(); // 打开时刷新选中高亮/toLabel
        // 关闭触发：窗口滚动（不含面板自身滚动）/缩放
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
          // change 处理里可能重刷选项/触发 onChanged 重渲染——重建菜单让高亮跟上
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
      // 点触发器/面板之外（捕获阶段拦截 mousedown/touchstart）关闭
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
      // 切换桌面/页面隐藏时兜底收起
      document.addEventListener('contact-switched', closeAll, false);
      document.addEventListener('visibilitychange', function () { closeAll(); }, false);
      // 选项被外部重刷（建组后插 option / onChanged 重渲染）时自动重建菜单与高亮
      if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function () { if (wrap && list) rebuild(); })
          .observe(sel, { childList: true, subtree: true });
      }
      rebuild();
    },
    // v3.28.x：把已渲染/新渲染的分组下拉 + 设置/音乐/礼盒/邀请等表单下拉统一替换成
    // 自定义样式。目标＝bindNewGrp 全部分组下拉 + .ta-type/.tc-input/.gm-input/.ti-type
    // （保留小游戏 snake-diff/pong-diff 的原生 console 外观）。attachCustom 幂等，重复命中无害。
    ensureCustomSelects: function () {
      var selSel = 'select.ta-type, select.tc-input, select.gm-input, select.ti-type';
      document.querySelectorAll(selSel).forEach(function (s) { window.cardGroups.attachCustom(s); });
      if (window.__mochiCsObserver || typeof MutationObserver === 'undefined') return;
      window.__mochiCsObserver = true;
      // 只扫小容器（新表单块），大列表重渲染（几十上百节点）直接跳过，避免拖慢聊天渲染
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

  // 默认题库（4 分类，与星言一致 + 两个世界）
  const DEFAULT_QUESTIONS = [
    { id: 'q_d1', text: '你吃饭了吗？', cat: 'daily', enabled: true },
{ id: 'q_c1', text: '有没有好好休息？', cat: 'care', enabled: true },
{ id: 'q_i1', text: '现在在做什么？', cat: 'interact', enabled: true },
{ id: 'q_w1', text: '想要聊些什么？', cat: 'world', enabled: true },
{ id: 'q_s1', text: '今天很忙吗？', cat: 'interact', type: 'single', enabled: true, options: [
{ t: '很忙', reply: '辛苦了呢' }, { t: '不算太忙', reply: '摸鱼也算在忙吧' },
{ t: '非常轻松', reply: '希望这样的日子再多一点' }, { t: '和往常一样', reply: '平淡就是生活的主线' }] }
    // 普通情侣轻松小问题
    // 两个世界（梦角设定：不同世界但常伴身边，能感觉到、摸到有体感；字卡沟通）
    // v3.7.x：新增预设——高自由度开放题（怎么答都行）+ 两个世界；末尾 3 题为单选题
    // （type:'single' 的选项即系统预设答案，每个答案自带 TA 预设回应，点卡片就地点选）
    // v3.7.x：第二批新增——延续高自由度开放题；结尾 2 题单选（预设答案+各答案 TA 预设回应）
    // v3.7.x：第三批新增——延续高自由度开放题（怎么答都行）+ 两个世界 + 字卡设定；末尾 3 题单选
    // v3.7.x：第四批新增——时间感/感官/字卡本身/两个世界深化；末尾 3 题单选
  ];
  const CATS = [
    ['daily', '日常询问'],
    ['care', '关心询问'],
    ['interact', '互动询问'],
    ['world', '两个世界']
  ];
  // 暴露 care 题库给 period.js 梦角关心触发用
  window.MOCHI_TA_ASK_CARE = DEFAULT_QUESTIONS.filter(function (q) { return q.cat === 'care'; });

  // 轻提示
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

  // v3.5.34：自动弹窗概率（0-100）。兼容旧布尔 autoPopup：true→70，false→0
  function askPopupProb(s) {
    if (s && typeof s.popupProb === 'number') return s.popupProb;
    if (s && s.autoPopup === false) return 0;
    return 70;
  }
  // v3.5.117：互动卡片弹窗互斥——TA的询问/小问题/好奇/吐槽各自独立定时触发、
  // 各自用不同弹窗容器（modal/tc/qa），同一时刻多个机制命中时会同时弹多个弹窗叠在一起。
  // 弹窗前检查：已有任一互动弹窗打开则不弹本次（卡片仍进聊天，可手动点开）。
  function cardPopupBusy() {
    return ['modal-mask', 'tc-mask', 'qa-mask'].some(id => {
      const el = document.getElementById(id);
      return el && !el.hidden;
    });
  }
  // v3.6.x：用户是否正在输入——TA 互动弹窗自动弹出时会抢焦点
  // （setTimeout(inp.focus()) 让原输入框 blur），手机端输入法被收起、
  // IME 组合中的文字直接丢失（表现：正在打的字消失、输入法弹窗被关闭）。
  // 正在打字时不自动弹窗（卡片照常进聊天记录，输完点卡片再答）；手动打开
  // 弹窗时也不抢焦点，用户继续输入。
  function chatInputFocused() {
    // 聊天输入栏聚焦（contenteditable 打字中）
    const ci = document.getElementById('chat-input');
    if (ci && document.activeElement === ci) return true;
    // 其他输入框聚焦（设置分组名/编辑昵称/写信等），同样不打断用户输入
    const ae = document.activeElement;
    return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
  }

  // v3.12.x：迟到弹窗守卫——手机浏览器会把后台页面的定时器冻结/深度节流，
  // 回前台时把到点未执行的定时器一次性补跑；补跑瞬间页面已恢复可见，
  // document.hidden 等既有守卫全部失效 → 弹出几分钟前已在聊天里看过的旧互动卡片
  //（用户反馈：切后台再回来再切出，开屏弹出刚看过的询问/小问题/好奇/吐槽弹窗）。
  // 正常触发在 400ms 左右执行；超过 4s 才到达的一律视为冻结补跑，不再自动弹
  //（卡片照常留在聊天里，点击可答）。
  // v3.13.x：再加一道「中途切后台」守卫——用户反馈快速切后台再回来（<4s）仍会重复弹
  // 刚看过的卡。只要弹窗排程之后、到点之前页面曾切过后台（lastPopHiddenAt > schedAt），
  // 说明用户已不在持续看聊天，回前台不再自动补弹（卡片留在聊天里可点）。
  // 与 4s 迟到守卫互补：快速切换靠 lastPopHiddenAt，长时间深度冻结靠 4s。
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
  // 暴露给 ck-question.js（查岗卡同款守卫）复用，保持一致
  window.interactPopupStale = autoPopupStale;

  // ---- v3.13.x：互动卡全局频率闸门（询问/小问题/好奇/吐槽/查岗五类共享）----
  // 用户反馈互动卡整体频率「还是太高」：v3.12.x 只降了各类默认概率，但五类各自独立计时、
  // 冷却互不相干，叠加起来观感仍是「每隔十几分钟就来一张」。现加一道跨类型总闸门：
  // 任意互动卡发出后 INTERACT_GATE_MS 内，其余类型一律不再自动触发
  //（手动「现在问一次 / 让TA现在查岗一次」不受限）。键按联系人桌面隔离（activeStore 同惯例）。
  const INTERACT_GATE_KEY = 'interact-card-last';
  const INTERACT_GATE_MS = 60 * 60000; // 基准值（原频率档）；实际闸门 = 基准 × 频率档 gateMul

  // ---- #1153：互动卡频率档（原频率 + 往下三档）----
  // 用户直派「联系人在聊天里发送互动卡片的频率需要可以调整 / 原来的频率也保留」，随后补充
  // 「其实原频率就已经很频繁了。不要高频率，帮我做原频率调低几档」——所以档位全部 ≤ 原频率，
  // 没有比原频率更高的档。作用面＝聊天里 TA 主动发的卡与邀请：
  //   · 五类提问卡（询问 / 小问题 / 好奇 / 吐槽 / 分享你的字卡）：概率 × probMul、
  //     各自冷却 × coolMul（基准 询问 45 / 小问题 30 / 好奇 30 / 吐槽 30 / 分享字卡 90 分钟）、
  //     跨类型总闸门（基准 60 分钟）× gateMul（查岗卡共用本闸门，一并随之缩放）；
  //   · 邀请三类（猜拳 / 游戏 / 贴贴，ta-invite.js 的 hit）与音乐邀请（music-player.js 的
  //     「一起去听」）：只套概率 × probMul（它们没有硬编码冷却，音乐邀请的冷却按音乐设置里的档位）。
  // 档位键 reply-ic-freq 随联系人桌面隔离，与回复设置页「互动卡频率」行是同一份；
  // 未设/坏值回退 0（原频率）＝全部倍数 ×1 ＝ 行为与加本功能之前逐位相同（「原来的频率也保留」）。
  // 手动「现在问一次 / 让 TA 现在查岗一次 / 让 TA 邀请我」不经过这些倍数，不受影响。
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
      // 注意 Number(null) === 0：键不存在时必须先挡掉空值，否则「未设键」会被读成 0（本档恰好是
      // 原频率，看着没事），但 ''/null 的语义必须是「未设」而不是「用户选了第 0 档」——两者在
      // 迁移与显示上要分得清，故照旧先挡空值。
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
  // 概率倍数：在 dcpEff（总档）之后套用；原频率档 probMul=1，整数原值直通（round 后不变）
  function icProb(v) {
    const n = Number(v);
    if (!isFinite(n)) return 0;
    const r = Math.round(n * icMode().probMul);
    // 原值 ≥1 时不许被档位抹成 0——否则用户设的 1% 选了「很安静」就静默变成「永不触发」
    return Math.max(0, Math.min(100, (r < 1 && n >= 1) ? 1 : r));
  }
  window.icProb = icProb;
  // 冷却分钟数倍数（至少 1 分钟，防取整成 0＝冷却失效）
  function icCool(min) { return Math.max(1, Math.round(min * icMode().coolMul)); }
  window.icCool = icCool;
  // 跨类型总闸门毫秒数（基准 60 分钟 × gateMul）
  function interactGateMs() { return Math.round(INTERACT_GATE_MS * icMode().gateMul); }
  window.interactGateMs = interactGateMs;
  function interactGateOk() {
    // #1015 夜间静默：夜间任意互动卡（询问/小问题/好奇/吐槽/查岗卡）一律不自动触发——
    // 五类触发器与 ck-question 自动查岗都经本闸门，此处一处收口；被拦的当次不写冷却时间戳
    //（调用方在 interactGateOk 之后才 interactGateMark/推进 lastAskAt），7:00 后下一个轮询
    // 周期照常触发。手动「现在问一次 / 让 TA 现在查岗一次」不经过本闸门，不受限。
    if (window.nightModeActive && window.nightModeActive()) return false;
    try {
      const last = Number(store.get(INTERACT_GATE_KEY)) || 0;
      return Date.now() - last >= interactGateMs();
    } catch (e) { return true; }
  }
  function interactGateMark() {
    try { store.set(INTERACT_GATE_KEY, String(Date.now())); } catch (e) {}
  }
  // 查岗卡（ck-question.js，后打包）经 window 调用同一道闸门；探针供回归/诊断只读
  window.interactGateOk = interactGateOk;
  window.interactGateMark = interactGateMark;
  // v3.42.x #422：TA 主动提问（关心询问/小问题/好奇/互动/吐槽）统一走「其他互动功能字卡」里的
  //   「TA主动提问」概率门控（dcf-ask，随联系人桌面隔离）：100%＝保持原节奏（仅受原冷却/闸门约束），
  //   0%＝完全不主动提问。独立于查岗卡（查岗走自己的 dcf-deskcheck/ckq），故不改 interactGateOk 本体。
  function taAskDcfOk() { try { return Math.random() * 100 < (window.dcfGet ? window.dcfGet('ask') : 100); } catch (e) { return true; } }
  window.__interactGateInfo = function () {
    let last = 0;
    try { last = Number(store.get(INTERACT_GATE_KEY)) || 0; } catch (e) {}
    return { key: INTERACT_GATE_KEY, lastAt: last, gateMs: interactGateMs(), open: interactGateOk(), waitMs: Math.max(0, last + interactGateMs() - Date.now()) };
  };

  // ---- v3.14.x：后台收到互动卡片 → 回前台补弹 + 补触发 ----
  // 安卓 Edge 后台 setInterval 被深度节流/冻结，导致两个问题：
  // ① 后台完全不触发 → 联系人不主动发消息（maybeTrigger 四函数不跑）；
  // ② 后台新收到的卡片 document.hidden 守卫不弹，回前台后无补弹机制 → 后台弹窗丢失。
  // 解法：bg-keep.js 回前台时 dispatch mochi-fg-resume 事件，本块监听后：
  //  - 立即补触发四个 maybeTrigger（解①）；
  //  - flush 后台入队的卡片补弹最近一张（解②，只弹一张避免刷屏）。
  // autoPopupStale 守卫不适用于补弹（那是防冻结补跑旧卡；此处是用户主动回前台补弹新卡）。
  const _pendingPops = [];
  function _enqueuePop(idx, openFnName) {
    if (idx < 0) return;
    _pendingPops.push({ idx: idx, fn: openFnName, t: Date.now() });
    if (_pendingPops.length > 4) _pendingPops.shift();
  }
  // v3.18.x：补弹前判断用户是否正停在聊天页——后台新卡本来就会渲染进聊天列表，
  // 若用户切回时正停在聊天页，卡片就在眼前，再用弹窗重复弹出就是「已看过的消息又弹窗」。
  // 只在用户不在聊天页（如回到桌面）时才补弹，真正需要提醒的场景。
  function _chatPageOpen() {
    try {
      const cp = document.getElementById('page-chat');
      return cp ? !cp.hidden : false;
    } catch (e) { return false; }
  }
  // #915：后台漏弹的互动卡迟到补通知——后台期触发器被冻结/深度节流，回前台 mochi-fg-resume
  // 补触发才生成卡片，此刻页面已可见、通知按「前台看见即已读」被吞＝这类卡的后台弹窗
  // 从没弹过。若本次是「刚从真后台（≥1 分钟）回来」且用户不在聊天页（卡片不在眼前），
  // 给本轮通知打 late 标补弹（bg-keep 同一套去重闸门照过，同内容绝不双弹；
  // 常规触发时 late=false，行为一字不变）。
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
  // v3.13.x：一次性降频迁移——设置对象一旦保存就固化了当时的默认概率，
  // v3.12.x 降默认对老设备从不生效（存储里还是旧高概率）。这里把「恰好等于历史默认值」的
  // 概率吸附到新默认 5%；用户真正自定义过的其他值不动。幂等，写盘仅限已有数据。
  // 各库历史默认：询问 20/10 · 小问题 15/8 · 好奇 15/8 · 吐槽 30/15
  function migrateInteractProb(d, storeKey, oldDefaults) {
    try {
      if (!d.settings || d.settings.probLowV313) return;
      if (oldDefaults.indexOf(Number(d.settings.prob)) !== -1) d.settings.prob = 5;
      d.settings.probLowV313 = true;
      if (store.get(storeKey)) { try { store.set(storeKey, JSON.stringify(d)); } catch (e) {} }
    } catch (e) {}
  }

  // ---- 数据读写 ----
  // v3.6.x：题库合并改为「增量 + 持久化」：
  //  ① 只追加默认题库里【从未合并过】的新题（mergedIds 之外）——旧预设被用户删除后不再自动复活；
  //  ② 绝不删除/覆盖用户个人添加的字卡；
  //  ③ 合并结果立即写回——系统预设新增的字卡一次固化，用户后续的删除/开关操作才真正生效
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
    // 全部默认题标记为已合并（含用户主动删掉的——之后不再自动加回）
    DEFAULT_QUESTIONS.forEach(q => {
      if (!mergedSet[q.id]) { merged.push(q.id); mergedSet[q.id] = true; changed = true; }
    });
    // v3.6.x：老数据里的预设题补 isPreset 标记（系统预设不可删除对历史数据同样生效）
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
    // #1519：读空但库里本该有＝大键没读全（IDB-only 题库切后台/回填未到），当场请库取回一次
    // （#1349a 单次飞行闸）。这一拍仍按旧形状走（播种纯预设题库只在内存里，isNew 守卫不写盘），
    // 下一拍自然读到权威值——写侧由 taAskSave 的闸兜住，这一发错拍不会落进库里。
    if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY)) store.requestBigKey(KEY); } catch (e0) {} }
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
    // v3.5.33：设置（启用/概率/自动弹窗）
    // v3.13.x：默认触发概率 10 → 5（互动卡整体降频第二轮，配合全局闸门）
    if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5, popupProb: 70 };
    // v3.6.x：是否使用系统预设问题（默认开启；关闭后预设不再被抽取，但题目仍在库里可随时重新开启）
    if (d.settings.useDefault === undefined) d.settings.useDefault = true;
    // v3.32.x #335：文字题回应接聊天字卡/词典，默认关（保持预设池原行为）
    if (d.settings.useChatReply === undefined) d.settings.useChatReply = false;
    migrateInteractProb(d, KEY, [20, 10]);
    if (!Array.isArray(d.questions) || !d.questions.length) {
      // 首次使用（本地无题库）或题库被清空：以默认题库为准
      const isNew = !store.get(KEY);
      d.questions = DEFAULT_QUESTIONS.map(q => {
        const nq = Object.assign({}, q);
        nq.isPreset = true;
        return nq;
      });
      d.mergedIds = DEFAULT_QUESTIONS.map(q => q.id);
      // 全新用户不立即写盘——防「localStorage 配额写失败/大键被移除 → 本地为空」的时序下，
      // 用纯默认题库覆盖 IndexedDB 里含用户自定义的权威数据；已有数据（如用户删空后）则写回
      // #1520：加载期这三发都是**自动**写（播种默认/合并默认/旧数据迁移），按站内铁律走静默闸 xyBigWriteHold（不许凭空弹 toast）；读数没确认时宁可不落笔，也不许把半份表写回去
      if (!isNew && !ckHold(KEY)) { try { store.set(KEY, JSON.stringify(d)); } catch (e) {} }
    } else {
      // 已有题库：增量合并默认题库新增的题，合并结果持久化（用户自定义永远保留）
      if (taAskMerge(d) && !ckHold(KEY)) { try { store.set(KEY, JSON.stringify(d)); } catch (e) {} }
    }
    if (!Array.isArray(d.history)) d.history = [];
    // v3.7.x：我的添加自定义分组
    if (!Array.isArray(d.groups)) d.groups = [];
    return d;
  }
  function taAskSave(d) {
    // #1519：题库整包写（管理页任何开关/增删都经这里）＝读-改-写。题库被批量导入撑过 200KB
    // ＝IDB-only 大键，切一次后台或回填未到时 taAskLoad() 读空会临时播种纯预设题库；此刻把
    // 「纯预设＋本次改动」整包写回＝库里自定义题被清空（作者报障同型：保存后自己的题没了）。
    // 判据用数据层那把唯一的尺 xyBigWriteBlocked（#1342d awaitingBigKey 五格证据，含回填未落定），
    // 拦下时照实 toast、绝不落笔；等库回填后再点一次即可（#1342「不把闸变成新的存不进去」）。
    if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY, 'TA 的提问题库')) return false;
    try { store.set(KEY, JSON.stringify(d)); } catch (e) {}
    return true;
  }

  // v3.26.x #291：问卷答题结束时间——settings.deadline 存毫秒时间戳（0=未设置）。
  // 过点后：不再自动/手动发出新询问，已发出的询问卡（文字/单选）也不能再作答。
  function askDeadlineMs(d) {
    const v = (d && d.settings && d.settings.deadline) || 0;
    return (typeof v === 'number' && v > 0) ? v : 0;
  }
  function askDeadlinePassed(d) {
    const dl = askDeadlineMs(d);
    return dl > 0 && Date.now() > dl;
  }
  // v3.33.x #523：显示文案（本地时区，比 datetime-local 的「YYYY-MM-DDTHH:MM」更好读）
  function fmtDeadlineText(ts) {
    if (!ts) return '未设置';
    const dt = new Date(ts), p = n => (n < 10 ? '0' : '') + n;
    const wk = '日一二三四五六'.charAt(dt.getDay());
    return (dt.getMonth() + 1) + '月' + dt.getDate() + '日 周' + wk + ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes()) + ':' + p(dt.getSeconds());
  }
  // v3.33.x #523：App 内自绘交卷时间选择器——替代原生 datetime-local（原生弹层锚点不受控，
  // 部分设备/桌面预览下会飘出手机框甚至屏幕外）。两处时间入口（问问TA 答题结束时间 / 批量问卷
  // 交卷时间）共用。**最简形态（用户定稿）**：只有一个「秒」输入框，直接自由填多少秒（默认 60 秒）；
  // 顶部实时显示到点的绝对时刻。overlay 静态写在 template 的 #dl-picker-mask（挂 .phone 内，
  // 与 #modal-mask 同层，永不飞出手机框）。
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
  // 选择器 DOM 已静态写在 template.html 的 #dl-picker-mask（不用动态 append：动态输入框依赖
  // mobile-adapt 的 MutationObserver 转换，部分环境点不动）；这里只做一次性事件绑定。
  let dlPickerWired = false;
  function dlPickerInit() {
    const m = document.getElementById('dl-picker-mask');
    if (!m) return null;
    if (dlPickerWired) return m;
    dlPickerWired = true;
    const secs = document.getElementById('dl-picker-secs');
    if (secs) {
      secs.addEventListener('input', dlPickerRender);
      // 兜底：部分内核点框沿不自动聚焦，点一下显式聚焦（安卓聚焦 ce-box）
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
    // 已设过且未过期 → 按剩余秒数回填；否则默认 60 秒
    const n = (current > 0 && current > Date.now()) ? Math.max(1, Math.round((current - Date.now()) / 1000)) : 60;
    const tEl = document.getElementById('dl-picker-title');
    if (tEl) tEl.textContent = title;
    dlPickerSetSecs(n);
    dlPickerRender();
    m.hidden = false;
    // 打开补写两次兜底（部分内核 ce-box 值代理有延迟）
    setTimeout(() => { if (m && !m.hidden) dlPickerSetSecs(n); }, 0);
    setTimeout(() => { if (m && !m.hidden) { dlPickerSetSecs(n); dlPickerRender(); } }, 80);
  }

  // 随机取一道已启用的题（优先用户自定义/启用的）
  // v3.6.x：settings.useDefault=false 时不抽取系统预设（isPreset）题——但题库里保留，重新开启即可恢复；
  // 返回完整问题对象（含 type/options，供 pushAsk 判断单选题）
  function taAskPick(d) {
    const s = d.settings || {};
    const useDefault = s.useDefault !== false;
    const qs = d.questions.filter(q => q.enabled !== false && q.text && (useDefault || !q.isPreset) && presetCatOpen('ta-ask', q));
    if (!qs.length) return null;
    return qs[Math.floor(Math.random() * qs.length)];
  }

  // v3.7.x：TA 回应挑选——「硬编码/系统预设回应池」与「字卡库自定义文字字卡」两池混合：
  // 预设池 90% 概率抽取，字卡库 10% 概率抽取；抽字卡库时最多连用 5 张字卡、
  // 每张之间空一格（v3.7.1 由合并大池改两池等概率，v3.7.2 调为 90/10 + 多张连用）。
  // presetPool：可选，该卡片类型自带的预设回应池（好奇的题预设 replies / 吐槽固定句 /
  // 选项预设回应等）；两池都空时兜底默认甜话。
  // v3.7.x：预设回应池与「系统预设字卡 → 互动回应」tab 同源展示，逐张开关
  // （dc-off-interact-*）后此处过滤已关闭的话术，不再参与抽取。
  window.pickAskCardReply = function (presetPool) {
    try {
      const cards = (window.getCustomCards && window.getCustomCards()) || [];
      // FIX 2026-09-13 #388 媒体池令牌卡不进互动回应文字池（同 chat.js #383 第三道守卫）
      // FIX 2026-09-15 #533 链接导入的媒体字卡（裸 http(s) 图链）同款排除，否则 TA 的
      // 互动回应会把「http://…png」当话术发出来
      const words = cards.filter(s => typeof s === 'string' && s.indexOf('data:') !== 0 && s.indexOf('|||') < 0 && !/^https?:\/\//i.test(s) && !(window.mochiMediaIsToken && window.mochiMediaIsToken(s)) && s.trim());
      const preset = (Array.isArray(presetPool) ? presetPool : [])
        .filter(c => !(window.isDefaultCardOff && window.isDefaultCardOff('interact', c)))
        // FIX 2026-09-17 #648 预设池同款媒体守卫——上层裸抽直传的媒体卡（@@m: 令牌/裸图链/
        // 「名称|||data:」/data: 载荷）不再原样返回，否则互动卡「TA：」行直出令牌串
        .filter(c => !(typeof c === 'string' && (c.indexOf('data:') === 0 || c.indexOf('|||') >= 0 || /^https?:\/\//i.test(c) || (window.mochiMediaIsToken && window.mochiMediaIsToken(c)))));
      const hasPreset = preset.length > 0;
      if (hasPreset && words.length) {
        // 预设池 90% / 字卡库 10%
        if (Math.random() < 0.9) return preset[Math.floor(Math.random() * preset.length)];
        // 字卡库：随机 1~5 张（不超过字卡池大小），不重复抽取，空格连接
        const n = 1 + Math.floor(Math.random() * Math.min(5, words.length));
        const copy = words.slice();
        const out = [];
        while (out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
        // #650 多张字卡连接符同走「拼接随机标点」符号池（chat.js pyJoinCards；关＝空格原样）
        return (window.pyJoinCards && window.replyCfg) ? window.pyJoinCards(out, window.replyCfg()) : out.join(' ');
      }
      if (hasPreset) return preset[Math.floor(Math.random() * preset.length)];
      if (words.length) return words[Math.floor(Math.random() * words.length)];
    } catch (e) {}
    const defs = ['收到你的回答。', '好呀，我知道了。', '嗯嗯，我也是这么想的。', '你这么说，我记住了。', '好的，我记在心里了。'];
    return defs[Math.floor(Math.random() * defs.length)];
  };

  // v3.32.x #335：互动卡片回应接通普通聊天回复链路（settings.useChatReply，默认关）——
  // 用户反馈：问问TA的回答只会用「询问·回应」预设池/字卡库，联系人用不上普通聊天的
  // 字卡体系和词典。开启后按普通聊天同源完整链路生成回应（v3.43.x #447 升级）：
  // ① genChatStyleReply（chat.js 与 replyOnce 同序）：公用+专属字卡（getPool 按 py-en
  //    概率抽卡）→ genReplyText 兜底 → 系统字卡（csp-cust 概率让位默认字卡）→ 表情贴图，
  //    再词典拼字（quoteSpellPick）命中整条替换，固定单气泡形态；
  // ② 生成器异常缺失时兜底旧链：getDefaultCards('chat') 系统字卡 → quoteSpellPick 词典拼字；
  // ③ 都未产出＝返回 null，走原「询问·回应」预设池/字卡库 90/10 混合。
  // v3.43.x #447：作用范围从「仅文字题」扩到「文字题 + 单选题点选项」（chat.js 单选按钮
  // 路径经 window.taAskChatReplyOn 查询同一开关）。
  window.taAskChatReplyOn = function () {
    try { const d = taAskLoad(); return !!(d.settings && d.settings.useChatReply); } catch (e) { return false; }
  };
  function taAskTextReply() {
    try {
      const d = taAskLoad();
      if (!(d.settings && d.settings.useChatReply)) return null;
      // v3.43.x #447：普通聊天完整链路（公用+专属字卡→系统字卡→词典拼字，与 replyOnce 同序）
      if (window.genChatStyleReply) {
        const r = window.genChatStyleReply();
        if (r) return r;
      }
      // 兜底：生成器缺失（旧构建混合加载）时退回旧链——仅系统字卡→词典拼字
      if (window.getDefaultCards) {
        const dc = window.getDefaultCards('chat');
        if (dc && dc.type !== 'poke' && typeof dc.text === 'string' && dc.text.trim()) return dc.text;
      }
      if (window.quoteSpellPick && window.replyCfg) {
        const sp = window.quoteSpellPick(window.replyCfg());
        // #650 单气泡拼字连接符同走「拼接随机标点」符号池（关＝空格原样）
        if (sp && Array.isArray(sp.segs) && sp.segs.length) return (window.pyJoinCards ? window.pyJoinCards(sp.segs, window.replyCfg()) : sp.segs.join(' '));
      }
    } catch (e) {}
    return null;
  }

  // 发出一条询问（系统提示 + 询问卡片；弹窗按 popupProb 概率触发）
  function pushAsk(q, opts) {
    if (!window.chatAddSystem) return;
    // v3.6.x：单选题不弹窗（弹窗是纯文字输入界面）——只进聊天卡片，点卡片就地点选
    // #1415：多选题同理，而且弹窗根本挂不出勾选态，也必须走点卡两拍
    const isPick = q && (q.type === 'single' || q.type === 'multi') && Array.isArray(q.options) && q.options.length;
    let popup = false;
    if (!isPick) {
      if (opts && typeof opts.popupProb === 'number') popup = Math.random() * 100 < opts.popupProb;
      else if (opts && opts.popup === false) popup = false;
    }
    // v3.5.146：提示语标记 ask-msg（渲染同 poke 但不算 notable）——否则提示语
    // 单独触发一条弹窗/通知，与下方卡片通知重复成 2 条
    window.chatAddSystem('TA想问你一个问题。', { special: 'ask-msg' });
    // v3.26.x：askTs 作为提问记录的稳定关联键（透传进 chat-msgs 记录，回答时据此更新 history）
    const askTs = Date.now();
    // #1480：题自带「最多N」（multiMax）随卡透传——手动作答那侧同受这道闸；没带＝0＝不限
    const el = window.chatAddSystem(q.text, { special: 'ask-card', askQuestion: q.text, askOptions: isPick ? q.options : null, askType: isPick ? q.type : 'text', askTs: askTs, askMultiMax: (isPick && q.type === 'multi' && q.multiMax >= 2) ? q.multiMax : 0 });
    // v3.26.x：提问即进记录——发卡同步写一条 pending，回答后由 chatAskReply 包装层更新
    // （此前只有回答才写 history，且单选题点选项直接调 chatAskReply 不经 openAskReply，history 永远空）
    try {
      const d = taAskLoad();
      d.history.push({ q: q.text, a: '', reply: '', ts: askTs, status: 'pending' });
      taAskSave(d);
      refreshAskRecordsIfOpen(); // #625：提问记录页开着时后台来的询问即时上屏
    } catch (e) {}
    const idx = el ? Number(el.dataset.idx) : -1;
    // v3.5.141：后台收到互动卡片 → 系统通知提示
    // v3.5.146：通知文本合并提示语 + 具体问题（一条通知显示完整内容，不再两条）
    if (window.bgNotifyCheck) window.bgNotifyCheck('TA想问你一个问题：' + q.text, Date.now(), { name: 'TA的询问', late: _lateNotify(), kind: 'ask' });
    // v3.5.141：页面弹窗在后台不弹（不可见弹了也没用），只发系统通知
    // v3.6.x：用户正在聊天输入栏打字时不弹（弹窗会抢焦点打断输入法，见 chatInputFocused）
    // v3.12.x：冻结定时器回前台补跑（autoPopupStale 迟到）时同样不弹旧卡
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
  // ---- 触发调度（v3.5.34：启用开关 + 触发概率滑块 + 自动弹窗概率滑块） ----
  function maybeTriggerTAAsk() {
    try {
      // v3.5.141：后台也触发（卡片进聊天记录 + 系统通知提示）；页面弹窗由
      // push 内 document.hidden 守卫控制，后台不会弹页面弹窗
      const d = taAskLoad();
      const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
      if (s.enabled === false) return;
      // v3.26.x #291：过了问卷答题结束时间后不再自动发出新询问
      if (askDeadlinePassed(d)) return;
      if (Date.now() - (d.lastAskAt || 0) < icCool(45) * 60000) return;
      // v3.13.x：全局闸门——任一互动卡发出后 60 分钟内不再自动触发
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

  // v3.6.x：异步 IDB 合并（chat.js loadMsgs）可能让自动弹窗持有过期 msgIdx——
  // 打开/作答前先校验索引指向的仍是「同类且未作答」的卡片；已错位/指向已作答
  // 卡片则从末尾回退找最近的未作答同类卡片（自动触发场景卡片就是最新一条；
  // 点击卡片路径由聊天页委托保证传入的必是未作答卡片的索引）
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
  // 读取指定索引的聊天记录（异常返回 null）
  function getCardAt(msgIdx) {
    try {
      const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
      if (Array.isArray(msgs) && msgs[msgIdx]) return msgs[msgIdx];
    } catch (e) {}
    return null;
  }

  // ---- 回答弹窗（点击聊天里的询问卡片触发） ----
  window.openAskReply = function (msgIdx) {
    if (!window.openModal) return;
    // v3.26.x #291：过了问卷答题结束时间后询问卡不能再作答
    if (askDeadlinePassed(taAskLoad())) { toast('已过问卷答题结束时间，不能再作答'); return; }
    msgIdx = locateCardIdx(msgIdx, 'ask-card', 'askStatus');
    if (msgIdx < 0) return;
    // 读聊天记录拿问题
    let question = '';
    try {
      const msgs = (window.getChatMsgs ? window.getChatMsgs() : JSON.parse(store.get('chat-msgs') || '[]'));
      if (Array.isArray(msgs) && msgs[msgIdx]) question = msgs[msgIdx].askQuestion || msgs[msgIdx].text || '';
    } catch (e) {}
    window.openModal('回答TA的询问', '', (v) => {
      const answer = (v || '').trim();
      if (!answer) { toast('请输入回答'); return; }
      // 提交时再校验：索引仍指向本卡片则直接用，错位则重定位（防连点重定位到别的卡片）
      let rec = getCardAt(msgIdx);
      if (!rec || rec.special !== 'ask-card') {
        const fixedIdx = locateCardIdx(msgIdx, 'ask-card', 'askStatus');
        if (fixedIdx < 0) return;
        msgIdx = fixedIdx;
      }
      if (window.chatAskReply) {
        // v3.32.x #335：开关开启时优先用普通聊天同源回应（默认聊天字卡/词典拼字），
        // raw 直传不再走 90/10 混合；未命中或开关关＝原「询问·回应」预设池行为
        const chatReply = taAskTextReply();
        if (chatReply) {
          window.chatAskReply(msgIdx, answer, chatReply, { raw: true });
        } else {
        // v3.7.x：文字题回应接「询问·回应」预设池（此前该池只在管理页展示、不参与抽取）——
        // 池里随机一条作预设回应传入，chatAskReply 内部再做 90%预设/10%字卡库 混合
        const defs = ['收到你的回答。', '好呀，我知道了。', '你这么说，我记住了。', '好的，我记在心里了。'];
        const pool = window.getInteractPool ? window.getInteractPool('询问·回应', defs) : defs;
        // v3.26.x：history 由 chatAskReply 包装层统一写（覆盖文字题 + 单选题点选项两条路径）
        window.chatAskReply(msgIdx, answer, pool[Math.floor(Math.random() * pool.length)]);
        }
        toast('已回复TA的提问');
      }
    }, { staticText: 'TA 问你：' + question, textareaPlaceholder: '输入你的回答…' });
  };

  // v3.26.x：包装 chatAskReply，把回答统一写进 ta-ask.history（关联键 askTs）。
  // 覆盖两条回答路径：① 文字题 openAskReply 调 chatAskReply；② 单选题点选项 chat.js 直接调 chatAskReply。
  // 此前单选题回答从不写 history，且未回答的提问也不进记录 → "提问记录"页空。
  if (window.chatAskReply && !window.__taAskReplyWrapped) {
    const _origChatAskReply = window.chatAskReply;
    window.chatAskReply = function (msgIdx, answer, reply, opts) {
      // FIX 2026-09-17 #653：弹窗→作答隔着异步间隙时 msgIdx 可能位移（同 chat.js chatAskReply
      // 内的重定位守卫）——探针若读错槽位，deskCk 查岗卡会被误判成普通询问写进 history、
      // askTs 取空。先按 locateCardIdx 同款守卫重定位，再判断 deskCk / 取 askTs。
      let rec = getCardAt(msgIdx);
      if (!rec || rec.special !== 'ask-card' || rec.askStatus === 'answered') {
        const _fixedIdx = locateCardIdx(msgIdx, 'ask-card', 'askStatus');
        if (_fixedIdx >= 0) { msgIdx = _fixedIdx; rec = getCardAt(_fixedIdx); }
      }
      // deskCk 查岗卡也走 ask-card，但不属于"TA的询问"，不进提问记录
      if (rec && rec.deskCk) return _origChatAskReply.call(this, msgIdx, answer, reply, opts);
      // v3.26.x #291：过了问卷答题结束时间后询问卡不能再作答（文字/单选两条路径都经此统一拦截）
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

  // ---- 管理页 ----
  const page = document.getElementById('page-ta-ask');
  if (!page) return;
  // 触发一次询问（供管理页按钮 / 更多功能面板共用；遵循"自动弹窗概率"）
  window.triggerTaAskNow = function () {
    const d = taAskLoad();
    // v3.26.x #291：过了问卷答题结束时间后不允许手动再问
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
  // v3.5.34：TA 询问设置——启用 / 使用系统预设 / 触发概率 / 自动弹窗概率
  function renderAskSettings() {
    const d = taAskLoad();
    const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
    const enEl = document.getElementById('ta-ask-enable');
    if (enEl) enEl.checked = s.enabled !== false;
    const defEl = document.getElementById('ta-ask-default');
    if (defEl) defEl.checked = s.useDefault !== false;
    // v3.32.x #335：文字题回应接聊天字卡/词典开关回显
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
    // v3.33.x #523：问卷答题结束时间回显（自绘按钮，显示绝对时刻；0=未设置）
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
  // v3.32.x #335：文字题回应接聊天字卡/词典开关
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
  // v3.26.x #291：问卷答题结束时间——设置/清除（v3.33.x #523 改自绘选择器）
  // v3.33.x #523：整行可点（用户可能点「问卷答题结束时间」文字而不是右侧小按钮）
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

  // ================= 批量导入问题（v3.6.x：一行一个问题，导入到所选分类） =================
  const batchCatEl = document.getElementById('ta-ask-batch-cat');
  const batchTextEl = document.getElementById('ta-ask-batch');
  const batchAddBtn = document.getElementById('ta-ask-batch-add');
  // v3.7.x：批量导入下拉注入「我的分组」+「＋ 新建分组…」——批量导入可导入到自定义分组
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
      // v3.26.x #291：批量导入支持单选题——【问题】开头的行开一道单选题，其后到下一个【】之间每行一个选项；
      // 普通行仍按「一行一个问题」导入（选项不足 2 个时按普通文字题导入）
      // #1415：题干里带「多选」标记的走多选题，判据与批量问卷同一条（askMultiMarkOf）
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

  // 渲染单个分类的问题列表（presetOnly=true 只渲染系统预设，false 只渲染用户添加）
  // v3.7.x：系统预设分类切换——顶部标签栏点击切换，避免全部分类堆叠导致页面过长
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
      // #1315：整类停用条——本页的一个分类就是一个「分组」，旧版只能逐张点掉
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
  // 我的添加 tab：v3.7.x 自定义分组模式——
  // 自定义分组区块置顶（各自独立卡片），未分组内容按系统分类放在下面（与系统预设 tab 的分组体系隔开）
  function askItemHtml(q, idx) {
    return '<div class="ta-row">' +
      '<label class="toggle"><input type="checkbox"' + (q.enabled !== false ? ' checked' : '') + ' data-idx="' + idx + '"><span class="tk"></span></label>' +
      '<span class="ta-txt">' + escG(q.text) + askTypeBadge(q) + '</span>' +
      '<button class="ta-del" data-idx="' + idx + '">✕</button>' +
      '</div>';
  }
  // v3.26.x #292：输入栏一键清空 ✕（同「帮我决定」.dec-inp-clear 款式，样式/暗色为全局 CSS）——
  // 手机端 contenteditable 转换的幽灵 input：value 已代理到 box，box 用 textContent 清空
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
  // 内联添加表单（blockKey 唯一用于输入框 id；grp 可选=添加后归入该分组；cat 为条目的系统分类）
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
    // 自定义分组区块（置顶，与系统分类隔开）
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
    // 未分组区块（始终渲染：与系统预设的分组体系隔开；空时提示走批量导入）
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
    // v3.26.x #292：添加表单重新渲染后重绑一键清空 ✕
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
        // #292：textarea 已包进 .dec-inp-wrap（旁边是清空按钮），ce-box 兜底改为按父容器扫
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
          // #1415：多选题只 1 个选项就没得「多」——按题型实际含义当场拦（单选题沿用原口径不拦）
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
  // 我的添加 tab 的分组管理：新建 / 重命名 / 删除
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
  // 搜索
  let askSearch = '';
  const askSearchInput = document.getElementById('ta-ask-search');
  if (askSearchInput) {
    askSearchInput.addEventListener('input', () => {
      askSearch = askSearchInput.value.trim();
      if (askTab === 'sys') renderAskCatsInto(catsEl, true, askSearch);
      else renderAskMineWithForms(askSearch);
    });
  }

  // 入口：字卡库页点「TA的询问」进入
  const li = document.getElementById('li-ta-ask');
  if (li) {
    li.addEventListener('click', () => {
      document.querySelectorAll('.page').forEach(p => p.hidden = true);
      page.hidden = false;
      const tw = document.getElementById('ta-ask-tabs'); if (tw) tw.style.display = 'none';
      switchAskTab('sys');
    });
  }
  // 入口：字卡库页点「TA的小问题」（选择题）进入独立页面
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

  // ================= TA的小问题（复刻星言 ta的小问题 完整版） =================
  // 定位：TA 偶尔递一道选择题，你选完，TA 再回应（选项有 TA 的心仪答案 + 回应）
  // #1520：加载期自动写的静默读数闸（数据层那把尺 xyBigWriteHold，自动路径不许弹 toast）
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
    // FIX 2026-09-16 #600 选项视角修正：题干是 TA 发问「我坐在你床边」，选项是用户自答，应为「帮我掖一下被角」（TA 的回应「被角我帮你掖」同指替用户掖）
  ];
  const TC_CAT_ORDER = ['daily', 'like', 'fun', 'rel', 'hypo', 'star', 'world'];
  let _tcSessionTriggered = false; // 会话级：一次会话最多触发 1 个
  let _tcAskedIds = [];            // 本次会话问过的题目 id（继续问时排除）
  let _tcChain = 0;                // 继续问链计数（最多 3 题）

  // FIX 2026-09-21 #999 预设选项文案随代码同步（人称口径修正的「已装用户」落地）：
  // 选项是【用户自答】——题干由 TA 发问，题干里的「你」＝用户；选项里的「我」＝用户自己、
  // 「你」＝TA（同族先例：cw12「帮我掖一下被角」、#600 选项视角修正）。
  // 老数据为什么改不到：预设题库首次合并后整块固化，tcMerge 只按选项 t 同步 reply；
  // 而改了 t 之后，按 t 匹配的 reply 同步会永远失配——所以这里按【选项顺序】把文案同步回代码。
  // 预设选项在管理页不可编辑（只有启停/删除），用户自加的题 isPreset!==true 一律不碰；
  // 条数对不上就跳过（避免错位覆盖）。幂等：同步过就不再写盘。
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
  // v3.6.x：增量合并（规则同 taAskMerge：只加新预设、绝不删用户自定义、结果持久化）
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
        // v3.7.x：题已存在——若是预设题，按选项 t 同步 TC_DEFAULT 的新 reply（多条数组），
        // 保留用户对 enabled/liked 的修改，只更新 reply 让系统预设回应跟代码升级
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
    // v3.6.x：老数据里的预设题补 isPreset 标记
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
    // #1520：读空但库里本该有＝大键没读全，当场请库取回一次（#1349a 单次飞行闸；同 taAskLoad）
    if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY2)) store.requestBigKey(KEY2); } catch (e0) {} }
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
    // v3.13.x：默认触发概率 8 → 5 + 存量旧默认值迁移（互动卡整体降频第二轮）
    if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5 };
    // v3.6.x：是否使用系统预设问题（默认开启）
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
      // 增量合并默认题库新增的题并持久化（用户自定义永远保留）
      if (tcMerge(d) && !ckHold(KEY2)) { try { store.set(KEY2, JSON.stringify(d)); } catch (e) {} }
    }
    if (!Array.isArray(d.history)) d.history = [];
    if (!Array.isArray(d.favs)) d.favs = [];
    // v3.7.x：我的添加自定义分组
    if (!Array.isArray(d.groups)) d.groups = [];
    return d;
  }
  // #1520：与 ta-ask 同款的整包写闸（#1519 只覆盖了同一文件里的 ta-ask 键，这三本当时漏了）：
  //   大键盲窗里读空播种纯预设 → 这一发整包写回＝自定义内容被清空。拦下照实 toast、绝不落笔。
  function tcSave(d) {
    if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY2, 'TA 的小问题库')) return false;
    try { store.set(KEY2, JSON.stringify(d)); } catch (e) {}
    return true;
  }
  // v3.6.x：useDefault=false 时不抽取系统预设（isPreset）题
  function tcPick(d) {
    const useDefault = (d.settings || {}).useDefault !== false;
    const ready = function (q) { return q.text && q.options && q.options.length >= 2; };
    const qs = d.questions.filter(q => q.enabled !== false && ready(q) && (useDefault || !q.isPreset) && presetCatOpen('ta-choose', q));
    // #1315：内置兜底只补「库里连预设题都还没合并进来」这一种空。旧写法在用户把题逐张关掉、
    //   或整类停用之后拿【没过任何闸】的 TC_DEFAULT 把池子填回来＝页面上的开关是装饰（本次报障本体）。
    const presetInStore = d.questions.some(q => q.isPreset === true && ready(q));
    const fallback = (qs.length || presetInStore) ? qs : TC_DEFAULT.filter(q => !pgCatOff('ta-choose', q.cat));
    const pool = fallback.filter(q => _tcAskedIds.indexOf(q.id) === -1);
    const src = pool.length ? pool : fallback;
    return src[Math.floor(Math.random() * src.length)];
  }
  // 发卡：系统提示 + 写入聊天（选择题卡片），弹窗按 popupProb 概率触发
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
    // v3.5.146：提示语标记 ask-msg（不算 notable，避免与卡片通知重复成两条）
    window.chatAddSystem('TA想让你选一个答案。', { special: 'ask-msg' });
    const el = window.chatAddSystem(q.text, {
      special: 'ask-choose', choiceQuestion: q.text, choiceOptions: q.options, choicePref: q.pref, choiceCat: q.cat || ''
    });
    const idx = el ? Number(el.dataset.idx) : -1;
    // v3.5.141：后台收到互动卡片 → 系统通知提示
    // v3.5.146：通知文本合并提示语 + 具体问题
    if (window.bgNotifyCheck) window.bgNotifyCheck('TA想让你选一个答案：' + q.text, Date.now(), { name: 'TA的小问题', late: _lateNotify(), kind: 'ask' });
    // v3.12.x：迟到弹窗守卫（冻结定时器回前台补跑不再弹旧卡，见 autoPopupStale）
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
  // 自动触发：一次会话最多 1 个；冷却 30 分钟；概率可调（v3.13.x 默认 5%，原 8%/15%——发卡整体降频）；启动 90 秒后、每 4 分钟轮询
  function maybeTriggerTC() {
    try {
      // v3.5.141：后台也触发（卡片进聊天记录 + 系统通知提示）
      const d = tcLoad();
      const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
      if (s.enabled === false) return;
      if (_tcSessionTriggered) return;
      if (Date.now() - (d.lastChoiceAt || 0) < icCool(30) * 60000) return;
      // v3.13.x：全局闸门——任一互动卡发出后 60 分钟内不再自动触发
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

  // 弹层通用
function openTCPanel(title, html) {
  const mask = document.getElementById('tc-mask');
  const body = document.getElementById('tc-body');
  const titleEl = document.getElementById('tc-panel-title');
  if (!mask || !body) return;
  if (titleEl) titleEl.textContent = title;
  body.innerHTML = html;
  // FIX 2026-09-27 #1348a：门要赶在手指落下之前就铺好。上面这行整块重画会带走旧按钮上那张
  // #1323 自学层，而 #1323 的补装时机是「下一次点按的 pointerdown」——同一发的 click 事件按
  // mousedown 靶与 mouseup 靶的**最近共同祖先**重新定靶，层是 mousedown 之后才出现的，于是靶
  // 回到按钮本身（无头实测这一族的取证环：leg:fire ＋ srf:1 ＋ fb:onscreen，一次 surf:hit 都没有）。
  // ⇒ 「面板里现学现画的上传按钮」这一族在拒绝合成激活的内核上每一发都是死的（本地音乐导入＝
  // iPhone 16／iOS 26 实报「点击上传后软件没有反应」；同一格在安卓 Chromium 上被 #1230 搬层腿
  // 兜住，所以只有 iOS 用户在报）。补装时机从「点按起手」提前到「换届这一刻」，层先于手指存在。
  if (window.mochiPickDoorSweep) { try { window.mochiPickDoorSweep(true); } catch (eS) {} }
  // v3.5.130：滚动位置复位——复用同一容器，上次滚到底会从旧偏移开始显示
  body.scrollTop = 0;
  mask.hidden = false;
}
// 供聊天搜索等外部模块复用该弹层
window.openTCPanel = openTCPanel;
  const tcClose = document.getElementById('tc-mask-close');
  if (tcClose) tcClose.addEventListener('click', () => { document.getElementById('tc-mask').hidden = true; });

  // 打开选择题（读聊天记录里的卡片）
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
  // 提交选择
  function submitTC(msgIdx, optIdx) {
    let rec = getCardAt(msgIdx);
    // 索引仍指向本类型卡片则直接用；错位则重定位（防连点重定位到别的卡片）
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
    // v3.5.128：不再预写 rec 字段——getChatMsgs 返回的是 chat.js 内存对象引用，
    // 预写会让 chatChooseReply 的 answered 守卫早退（回答消息丢失）。
    // 持久化 + 写回 + 推消息统一由 chatChooseReply 完成（v3.7.x：传选项对象，内部做混合随机回应）
    if (window.chatChooseReply) window.chatChooseReply(msgIdx, String(opt.t || ''), opt, matchTxt);
    // 写历史
    const d = tcLoad();
    d.history.unshift({ q: rec.choiceQuestion, my: rec.choiceAnswer, reply: rec.choiceReply, match: matchTxt, cat: rec.choiceCat || '', ts: Date.now() });
    tcSave(d);
    refreshAskRecordsIfOpen();
    // #1508：答完即收——小问题弹窗作答后不再停在「结果页」等手动「收起来」（作者实报
    // 「我已经选了答案，没有自动关闭收起来」，明说其他设备型号也有＝纯行为口径，零机型分支）。
    // 与好奇/吐槽同口径：你的选择与 TA 的回应已由 chatChooseReply 写进聊天卡片与消息流
    // （气泡翻「✓ 你选择了：…」＋TA 回应一条），默契结果仍在「TA的提问」记录里可查。
    // renderTCResult 保留不删：结果页暂无入口（locateCardIdx 只认未答卡），后续要
    // 「查看结果」入口时从这里接回。
    const tcMaskEl = document.getElementById('tc-mask');
    if (tcMaskEl) tcMaskEl.hidden = true;
  }
  // 结果视图：你的选择 / TA心里的答案 / TA回应 / 默契标签 / 继续问 / 收藏
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

  // ---- 管理页：TA的小问题 ----
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
  // v3.7.x：选项 reply 展示文本——多条用「 ｜ 」全部分隔列出，字符串原样
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
  // v3.7.x：系统预设分类切换——顶部标签栏点击切换，避免全部分类堆叠导致页面过长
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
      // #1315：整类停用条——本页的一个分类就是一个「分组」，旧版只能逐张点掉
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
  // ===== v3.7.x 通用：我的添加 tab 分组模式渲染（tc/tcu/tr 共用） =====
  // opt: { load, save, order, label, emptyTip, rowHtml(q,idx) }
  // 自定义分组区块置顶（与系统预设分类隔开），未分组内容按系统分类放在下方
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
  // 通用：分组管理事件（新建 / 重命名 / 删除）
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
  // TA的小问题 我的添加渲染配置
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
  // 搜索
  let tcSearch = '';
  const tcSearchInput = document.getElementById('tc-search');
  if (tcSearchInput) {
    tcSearchInput.addEventListener('input', () => {
      tcSearch = tcSearchInput.value.trim();
      if (tcTab === 'sys') renderTCCatsInto(document.getElementById('tc-sys-cats'), true, tcSearch);
      else renderMineGroupsInto(document.getElementById('tc-mine-cats'), tcMineOpt, tcSearch);
    });
  }
  // AI-B 代修（2026-08-22）：此处原有一段与上方完全相同的 tcTabsWrap 绑定代码被
  // 重复粘贴（const 重复声明 → SyntaxError → 整包 JS 不执行、开屏卡死），已删除第二份
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
    // v3.7.x：分类下拉注入「我的分组」+「＋ 新建分组…」
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
  // v3.7.x：「＋分组」按钮（添加问题卡片标题行）——新建分组后刷新我的添加列表
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
  // 触发一次小问题（供管理页按钮 / 更多功能面板共用）
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

  // ================= TA的好奇（复刻星言 ta的好奇 完整版） =================
  // 定位：TA 偶尔对你产生一个具体、带有兴趣的开放式问题，只想了解你
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
    // 两个世界（梦角设定）
    // 普通情侣轻松小问题
    // v3.7.x：新增预设——高自由度开放题（快捷项只是垫脚，想怎么答都行，部分带自然追问）
    // v3.7.x：第二批新增——延续开放题（快捷项只是垫脚，自由输入为主，部分带自然追问）
    // v3.7.x：第三批新增——延续开放题（快捷项只是垫脚，自由输入为主，部分带自然追问）
    // v3.7.x：第四批新增——情绪细微/感官/未来/字卡本身/两个世界深化（部分带 followup）
  ];
  let _tcuSessionTriggered = false;

  // v3.6.x：增量合并（规则同 taAskMerge：只加新预设、绝不删用户自定义、结果持久化）
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
    // v3.6.x：老数据里的预设题补 isPreset 标记
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
    // #1520：读空但库里本该有＝大键没读全，当场请库取回一次（#1349a 单次飞行闸；同 taAskLoad）
    if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY3)) store.requestBigKey(KEY3); } catch (e0) {} }
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
    // 迁移：快捷项人称修正（已存数据与历史答案同步修正）——
    // cw4「你身边」→「我身边」；cw6「跟着你走」→「跟着我走」；cp6「再等等，会遇到我」→「再等等，会遇到你」；
    // cy11「只给我看」→「只给你看」
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
          // FIX 2026-09-27 #1324：「迁移过了」只能是「这一次真的改到了字」，不能是「这条 id 在修复表里」。
          //   旧写法只要题目带 id 且挂着 quick 数组就无条件置 migrated ⇒ 整包回写，而这份数据第一次就
          //   已经改对了，之后每次读都「再迁一遍＋再写一遍」＝永久空转。纯 HEAD 副本实测：一次回前台
          //   经 mochi-fg-resume 走到 tcuLoad 两次，每次 stringify＋同步写回 22KB（四次后台往返合计
          //   158KB），而库里的内容一个字都没变；它同时把 #1324 那条写日志（__wr-journal）顶脏，
          //   于是每次回前台都要重写整本日志。迁移语义一字未动：第一次照旧改字＋落库。
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
    // v3.13.x：默认触发概率 8 → 5 + 存量旧默认值迁移（互动卡整体降频第二轮）
    if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5, followup: true };
    // v3.6.x：是否使用系统预设问题（默认开启）
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
      // 增量合并默认题库新增的题并持久化（用户自定义永远保留）
      if (tcuMerge(d) && !ckHold(KEY3)) { try { store.set(KEY3, JSON.stringify(d)); } catch (e) {} }
    }
    if (!Array.isArray(d.history)) d.history = [];
    if (!d.known || typeof d.known !== 'object') d.known = {};
    // v3.7.x：我的添加自定义分组
    if (!Array.isArray(d.groups)) d.groups = [];
    return d;
  }
  // #1520：与 ta-ask 同款的整包写闸（#1519 只覆盖了同一文件里的 ta-ask 键，这三本当时漏了）：
  //   大键盲窗里读空播种纯预设 → 这一发整包写回＝自定义内容被清空。拦下照实 toast、绝不落笔。
  function tcuSave(d) {
    if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY3, 'TA 的好奇题库')) return false;
    try { store.set(KEY3, JSON.stringify(d)); } catch (e) {}
    return true;
  }
  // v3.6.x：useDefault=false 时不抽取系统预设（isPreset）题
  function tcuPick(d) {
    const useDefault = (d.settings || {}).useDefault !== false;
    // #1315：整类停用先作用于内置兜底表（这一路 pool 就是 TCU_DEFAULT，条目没有 isPreset 字段）
    const pool = (d.questions && d.questions.length) ? d.questions : TCU_DEFAULT.filter(q => !pgCatOff('ta-curious', q.cat));
    let qs = pool.filter(q => q.enabled !== false && q.text && !(q.id && d.known[q.id]) && (useDefault || !q.isPreset) && presetCatOpen('ta-curious', q));
    if (!qs.length) {
      // #1315：两道旧兜底都拿【没过闸】的 TCU_DEFAULT 填空池＝用户逐张关掉/整类停用后照样出题，
      //   页面上的开关是装饰（本次报障本体）。现在库里已有预设题时不再回灌内置表（该类就此不出题，
      //   调用方判空返回）；只有「库里连预设都还没合并」时才按类闸放行内置表。
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
    // v3.5.146：提示语标记 ask-msg（不算 notable，避免与卡片通知重复成两条）
    window.chatAddSystem('TA对你有点好奇。', { special: 'ask-msg' });
    const el = window.chatAddSystem(q.text, {
      special: 'ask-curious', curiousQuestion: q.text, curiousQuick: q.quick || [], curiousReplies: q.replies || [],
      curiousFollowup: q.followup || '', curiousQid: q.id || '', curiousCat: q.cat || ''
    });
    const idx = el ? Number(el.dataset.idx) : -1;
    // v3.5.141：后台收到互动卡片 → 系统通知提示
    // v3.5.146：通知文本合并提示语 + 具体问题
    if (window.bgNotifyCheck) window.bgNotifyCheck('TA对你有点好奇：' + q.text, Date.now(), { name: 'TA的好奇', late: _lateNotify(), kind: 'ask' });
    // v3.6.x：用户正在聊天输入栏打字时不弹（弹窗会抢焦点打断输入法，见 chatInputFocused）
    // v3.12.x：迟到弹窗守卫（冻结定时器回前台补跑不再弹旧卡，见 autoPopupStale）
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
      // v3.5.141：后台也触发（卡片进聊天记录 + 系统通知提示）
      const d = tcuLoad();
      const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
      if (s.enabled === false) return;
      if (_tcuSessionTriggered) return;
      if (Date.now() - (d.lastCuriousAt || 0) < icCool(30) * 60000) return;
      // v3.13.x：全局闸门——任一互动卡发出后 60 分钟内不再自动触发
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

  // 好奇回答弹窗（快捷回复 + 自由输入）
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
    // v3.6.x：用户正在聊天输入栏打字时不抢焦点（不打断输入法/不丢字），输完再点弹窗输入框
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
    // v3.7.x：回应 = 题预设 replies 池 + 字卡库自定义字卡 混合随机
    const reply = window.pickAskCardReply ? window.pickAskCardReply(replies) : replies[Math.floor(Math.random() * replies.length)];
    // v3.5.128：不再预写 rec 字段——getChatMsgs 是 chat.js 内存对象引用，
    // 预写会让 chatCuriousReply 的 curiousStatus 守卫早退（回答消息丢失）
    const d = tcuLoad();
    const qid = rec.curiousQid || ('q_' + String(rec.curiousQuestion || rec.text || ''));
    d.known[qid] = answer;
    d.history.unshift({ q: rec.curiousQuestion, my: answer, reply: reply, cat: rec.curiousCat || '', ts: Date.now() });
    tcuSave(d);
    refreshAskRecordsIfOpen();
    // 30% 自然追问
    const followup = rec.curiousFollowup;
    const s = d.settings || { followup: true };
    const fw = (s.followup !== false && followup && Math.random() < 0.3) ? followup : null;
    // 持久化 + 推消息统一由 chatCuriousReply 完成
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

  // 好奇管理页
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
  // v3.7.x：系统预设分类切换——顶部标签栏点击切换，避免 8 个分类全部堆叠导致页面过长
  let tcuSysCat = null;
  function renderTCUCatsInto(container, presetOnly, search) {
    if (!container) return;
    const d = tcuLoad();
    const useDefault = (d.settings || {}).useDefault !== false;
    // 系统预设：顶部分类标签栏 + 只渲染当前选中分类（不再全部分组堆叠）
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
      // #1315：整类停用条——本页的一个分类就是一个「分组」，旧版只能逐张点掉
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
    // 自定义问题（保留原堆叠渲染，供其他调用路径）
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
  // TA的好奇 我的添加渲染配置
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
  // 搜索
  let tcuSearch = '';
  const tcuSearchInput = document.getElementById('tcu-search');
  if (tcuSearchInput) {
    tcuSearchInput.addEventListener('input', () => {
      tcuSearch = tcuSearchInput.value.trim();
      if (tcuTab === 'sys') renderTCUCatsInto(document.getElementById('tcu-sys-cats'), true, tcuSearch);
      else renderMineGroupsInto(document.getElementById('tcu-mine-cats'), tcuMineOpt, tcuSearch);
    });
  }
  // AI-B 代修（2026-08-22）：同上——tcuTabsWrap 绑定代码重复粘贴第二份已删除
  // 好奇入口
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
    // v3.7.x：分类下拉注入「我的分组」+「＋ 新建分组…」
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
  // v3.7.x：「＋分组」按钮（添加问题卡片标题行）
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
  // 触发一次好奇（供管理页按钮 / 更多功能面板共用）
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

  // ================= TA的吐槽（复刻星言 ta的吐槽 完整版） =================
  // 定位：TA 偶尔突然吐槽你一句，然后回到正常聊天（熟悉/调侃/亲密为主，不是批评）
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
    // 两个世界（梦角设定：甜蜜安稳的调侃）
    // 普通情侣轻松吐槽
    // v3.7.x：新增预设——情侣式调侃为主（熟悉/宠溺，不是批评）+ 两个世界；
    // 带 match 的条目在你聊到关键词时更容易被TA拿来调侃
    // v3.7.x：第三批新增——情侣式调侃为主（熟悉/宠溺，不是批评）+ 两个世界；
    // 带 match 的条目在你聊到关键词时更容易被TA拿来调侃
    // v3.7.x：第四批新增——情绪细微/日常碎碎念/两个世界深化（部分带 match）
  ];
  let _trSessionTriggered = false;

  // v3.6.x：增量合并（规则同 taAskMerge：只加新预设、绝不删用户自定义、结果持久化）
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
    // v3.6.x：老数据里的预设字卡补 isPreset 标记
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
    // #1520：读空但库里本该有＝大键没读全，当场请库取回一次（#1349a 单次飞行闸；同 taAskLoad）
    if (!d) { try { if (store.awaitingBigKey && store.awaitingBigKey(KEY4)) store.requestBigKey(KEY4); } catch (e0) {} }
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
    // v3.13.x：默认触发概率 15 → 5（v3.12.x 降频漏改了吐槽，这次补上）+ 存量旧默认值迁移
    if (!d.settings || typeof d.settings !== 'object') d.settings = { enabled: true, prob: 5 };
    // v3.6.x：是否使用系统预设字卡（默认开启）
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
      // 增量合并默认题库新增的字卡并持久化（用户自定义永远保留）
      if (trMerge(d) && !ckHold(KEY4)) { try { store.set(KEY4, JSON.stringify(d)); } catch (e) {} }
    }
    if (!Array.isArray(d.history)) d.history = [];
    // v3.7.x：我的添加自定义分组
    if (!Array.isArray(d.groups)) d.groups = [];
    return d;
  }
  // #1520：与 ta-ask 同款的整包写闸（#1519 只覆盖了同一文件里的 ta-ask 键，这三本当时漏了）：
  //   大键盲窗里读空播种纯预设 → 这一发整包写回＝自定义内容被清空。拦下照实 toast、绝不落笔。
  function trSave(d) {
    if (window.xyBigWriteBlocked && window.xyBigWriteBlocked(store, KEY4, 'TA 的吐槽题库')) return false;
    try { store.set(KEY4, JSON.stringify(d)); } catch (e) {}
    return true;
  }
  // v3.6.x：useDefault=false 时不抽取系统预设（isPreset）字卡
  function trPick(d, lastUserText) {
    const useDefault = (d.settings || {}).useDefault !== false;
    // #1315：整类停用先作用于内置兜底表（这一路 pool 就是 TR_DEFAULT，条目没有 isPreset 字段）
    const pool = (d.questions && d.questions.length) ? d.questions : TR_DEFAULT.filter(q => !pgCatOff('ta-roast', q.cat));
    if (lastUserText) {
      const matched = pool.filter(q => q.enabled !== false && Array.isArray(q.match) && q.match.length && (useDefault || !q.isPreset) && presetCatOpen('ta-roast', q) && q.match.some(k => lastUserText.indexOf(k) >= 0));
      if (matched.length) return matched[Math.floor(Math.random() * matched.length)];
    }
    let qs = pool.filter(q => q.enabled !== false && (useDefault || !q.isPreset) && presetCatOpen('ta-roast', q));
    // #1315：旧写法「抽空就 TR_DEFAULT.slice() 整表回灌」＝逐张关闭与整类停用全被越过（开关是装饰）。
    //   现在只在库里连预设题都没合并过时才用内置表，且同样过类闸。
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
    // v3.5.146：提示语标记 ask-msg（不算 notable，避免与卡片通知重复成两条）
    window.chatAddSystem('TA吐槽了你一句。', { special: 'ask-msg' });
    const el = window.chatAddSystem(q.text, { special: 'ask-roast', roastText: q.text, roastCat: q.cat || 'light' });
    const idx = el ? Number(el.dataset.idx) : -1;
    // v3.5.141：后台收到互动卡片 → 系统通知提示
    // v3.5.146：通知文本合并提示语 + 具体内容
    if (window.bgNotifyCheck) window.bgNotifyCheck('TA吐槽了你一句：' + q.text, Date.now(), { name: 'TA的吐槽', late: _lateNotify(), kind: 'ask' });
    // v3.6.x：用户正在聊天输入栏打字时不弹（弹窗会抢焦点打断输入法，见 chatInputFocused）
    // v3.12.x：迟到弹窗守卫（冻结定时器回前台补跑不再弹旧卡，见 autoPopupStale）
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
      // v3.5.141：后台也触发（卡片进聊天记录 + 系统通知提示）
      const d = trLoad();
      const s = d.settings || { enabled: true, prob: 5, popupProb: 70 };
      if (s.enabled === false) return;
      if (_trSessionTriggered) return;
      if (Date.now() - (d.lastRoastAt || 0) < icCool(30) * 60000) return;
      // v3.13.x：全局闸门——任一互动卡发出后 60 分钟内不再自动触发
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

  // ===== v3.15.x：第五类主动触发「TA 分享你的字卡」 =====
  // 用户在字卡库自建的字卡（cc-groups，含公用 cc-groups-public）按概率被 TA 抽一张、
  // 当作 TA 自己想说的话发出来（initiative 爱心角标 + mood 标签标注来源）。
  // 门控走 回复设置→其他 的 ai-cc-en / ai-cc-prob（与猜拳/游戏/贴贴邀请同体系，
  // 读法沿用 mail.js/feed.js 的 ls.get('reply-'+k) 惯例）；冷却 90 分钟 + 全局互动闸门。
  // 池过滤：纯文本（排除语音 |||/图片 data:/链接 http(s)）、≤60 字；最近 6 条不重复抽。
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
      // v3.14.x 教训：后台也照常进聊天记录+系统通知，前台弹窗交给通知链路
      if (ccCfg('ai-cc-en', 1) !== 1) return;
      // v3.13.x：全局闸门——任一互动卡发出后 60 分钟内不再自动触发
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

  // 吐槽回应弹窗
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
    // v3.6.x：用户正在聊天输入栏打字时不抢焦点（不打断输入法/不丢字），输完再点弹窗输入框
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
    // v3.7.x：吐槽话术池与「系统预设字卡 → 互动回应」tab 同源（getInteractPool），
    // 数据缺失时回退内置固定句；pickAskCardReply 内部会过滤用户已关闭的话术
    const defs = window.getInteractPool
      ? window.getInteractPool('吐槽·回应', ['你觉得我会信？', '少骗我。', '哼。', '好吧好吧。', '就这一次？', '行吧，放过你。', '嗯，这还差不多。'])
      : ['你觉得我会信？', '少骗我。', '哼。', '好吧好吧。', '就这一次？', '行吧，放过你。', '嗯，这还差不多。'];
    // v3.7.x：回应 = 吐槽固定句池 + 字卡库自定义字卡 混合随机
    const reply = window.pickAskCardReply ? window.pickAskCardReply(defs) : defs[Math.floor(Math.random() * defs.length)];
    // v3.5.128：不再预写 rec 字段——getChatMsgs 是 chat.js 内存对象引用，
    // 预写会让 chatRoastReply 的 roastStatus 守卫早退（回应消息丢失）
    const d = trLoad();
    d.history.unshift({ roast: rec.roastText, my: answer, reply: reply, cat: rec.roastCat || '', ts: Date.now() });
    trSave(d);
    refreshAskRecordsIfOpen();
    // 持久化 + 推消息统一由 chatRoastReply 完成
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

  // 吐槽管理页
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
  // v3.7.x：系统预设分类切换——顶部标签栏点击切换，避免全部分类堆叠导致页面过长
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
      // #1315：整类停用条——本页的一个分类就是一个「分组」，旧版只能逐张点掉
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
  // TA的吐槽 我的添加渲染配置
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
  // 搜索
  let trSearch = '';
  const trSearchInput = document.getElementById('tr-search');
  if (trSearchInput) {
    trSearchInput.addEventListener('input', () => {
      trSearch = trSearchInput.value.trim();
      if (trTab === 'sys') renderTRCatsInto(document.getElementById('tr-sys-cats'), true, trSearch);
      else renderMineGroupsInto(document.getElementById('tr-mine-cats'), trMineOpt, trSearch);
    });
  }
  // AI-B 代修（2026-08-22）：同上——trTabsWrap 绑定代码重复粘贴第二份已删除
  // 吐槽入口
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
    // v3.7.x：分类下拉注入「我的分组」+「＋ 新建分组…」
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
  // v3.7.x：「＋分组」按钮（添加字卡卡片标题行）
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
  // 触发一次吐槽（供管理页按钮 / 更多功能面板共用）
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

  // ================= 提问记录页（桌面第二页） =================
  // 集中展示 TA的询问 / TA的小问题 / TA的好奇 / TA的吐槽 的历史记录
  function fmtDT(ts) {
    const dd = new Date(ts);
    return ('0' + dd.getHours()).slice(-2) + ':' + ('0' + dd.getMinutes()).slice(-2) + ' ' + ((dd.getMonth() + 1) + '月' + dd.getDate() + '日');
  }
  // v3.26.x：提问记录跨桌面汇总——提问与回答都写进「发生所在联系人桌面」的 ta-ask，
  // 主页提问记录若只读当前桌面，用户在联系人桌面答过题、切回主页就「看不到记录」。
  // 汇总 = 当前桌面在前 + 其余桌面（注册表 contacts + default）的 history 合并。
  // FIX 2026-09-16 #625：此前仅「TA的询问」走了汇总，小问题/好奇/吐槽/邀请·问问仍只读
  // 当前桌面 ⇒ 在联系人桌面发生的记录切回主页就「看不到、不同步」。现五个分类统一走本组
  // 读写（含清空），排序统一按 ts 倒序（新→旧，与「TA的询问」原有观感一致）。
  // 根命名空间（activePrefix() = '<根>:<cid>'）：default 桌面必须与 contacts.js 的
  // defaultStore 同口径——命名空间优先、回退旧顶层键，否则老档用户在别的桌面看到的是空。
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
  // 读指定桌面的键（原始字符串；读不到返回 null）
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
  // 写指定桌面的键（default 分支同 defaultStore.set：写命名空间后清掉旧顶层键）
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
  // 汇总各桌面记录：兼容 {history:[…]} 对象与裸数组两种键形态，按 ts 倒序（新→旧）
  function allDeskHistories(key) {
    const out = [];
    deskCids().forEach(function (cid) {
      const raw = deskRaw(cid, key);
      if (!raw) return;
      let d = null;
      try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
      const arr = Array.isArray(d) ? d : (d && Array.isArray(d.history) ? d.history : null);
      if (!arr) return;
      // #1403：浅拷贝并挂上来源桌面 __cid——「按条删」要知道这一条来自哪个桌面（删除只在那一个
      // 桌面里摘掉那一条）。刻意不改下面的排序与返回形态：#101／#625a-d／#625h 六支针钉的就是
      // 「五个分类统一走本函数跨桌面汇总」这条链，动它＝把那些修复的锚一起拔掉。
      arr.forEach(function (x) { if (x) out.push(Object.assign({}, x, { __cid: cid })); });
    });
    out.sort(function (a, b) { return (Number(b && b.ts) || 0) - (Number(a && a.ts) || 0); });
    return out;
  }
  // #1403：按条删除的落笔处。写回口径照 clearDeskHistories（#625 同一条轴）：裸数组档写数组本身，
  // 对象档只换 history——题库/设置/分组/二级密码那些同档字段一律不动。
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
  // 五档共用一条渲染链：行内容各自给（rowFn，保持各档原有字段与形态），折叠与「删除」交站内唯一
  // 那两把件（idb.js 的 mochiHistFold／mochiHistDel＋Bind）＝当天直显、更早按月折、每条一删，
  // 不裁条目、也不替用户动那个已有的「清空全部桌面」大动作
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
    // TA的询问
    const askEl = document.getElementById('ar-ask');
    if (askEl) {
      const h = allDeskHistories('ta-ask');
      askListRender(askEl, h, 'ta-ask', '询问', function (x) {
        return '<div class="tc-li-q">问：' + escG(x.q) + '</div>' + (x.status === 'pending' ? '<div class="tc-li-pending">待回答</div>' : '<div class="tc-li-line">你：' + escG(x.a) + '</div>' + (x.reply ? '<div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div>' : '')) + '<div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
      });
    }
    // TA的小问题
    const chEl = document.getElementById('ar-choose');
    if (chEl) {
      const h = allDeskHistories(KEY2);
      askListRender(chEl, h, KEY2, '小问题', function (x) {
        return '<div class="tc-li-q">' + escG(x.q) + '</div><div class="tc-li-line">你的选择：' + escG(x.my) + '</div><div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div><div class="tc-li-match">' + escG(x.match) + '</div><div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
      });
    }
    // TA的好奇
    const cuEl = document.getElementById('ar-curious');
    if (cuEl) {
      const h = allDeskHistories(KEY3);
      askListRender(cuEl, h, KEY3, '好奇', function (x) {
        return '<div class="tc-li-q">' + escG(x.q) + '</div><div class="tc-li-line">你：' + escG(x.my) + '</div><div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div><div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
      });
    }
    // TA的吐槽
    const roEl = document.getElementById('ar-roast');
    if (roEl) {
      const h = allDeskHistories(KEY4);
      askListRender(roEl, h, KEY4, '吐槽', function (x) {
        return '<div class="tc-li-q">' + escG(x.roast) + '</div><div class="tc-li-line">你：' + escG(x.my) + '</div><div class="tc-li-line">' + (window.taFit ? window.taFit('TA：') : 'TA：') + taReplyShow(x.reply) + '</div><div class="tc-li-time">' + fmtDT(x.ts) + '</div>';
      });
    }
    // 邀请 / 问问 TA（我的提问 + 联系人答案）
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
  // 清空各桌面记录：读改写保留题库/设置/分组，只清 history（或裸数组本身）
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
  // 记录写入后即时刷新（仅当提问记录页正开着——TA 在后台自动触发时也能同步上屏）
  function refreshAskRecordsIfOpen() {
    try {
      const pg = document.getElementById('page-interact');
      if (pg && !pg.hidden && window.renderAskRecords) window.renderAskRecords();
    } catch (e) {}
  }
  // 清空按钮（#625：列表已是全桌面汇总，清空必须同口径清全桌面，
  // 否则清完别桌记录立刻又出现在列表里＝「清了个寂寞」）
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
  // 邀请/问问清空
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

  // 提问记录：横排 4 个分类 tab 切换
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

  // ================= 字卡库入口数字（动态显示各题库实际数量） =================
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
  // v3.9.x：字卡库拆双入口——「·我的添加」入口进入管理页只看自定义（隐藏系统预设 tab）
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
  // v3.9.x：注册 TA 询问/小问题/好奇/吐槽跨分类搜索
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
  // 字卡库页可见时刷新（初始加载、从管理页返回、增删题库后都会更新）
  const ccPageEl = document.getElementById('page-chatcard');
  if (ccPageEl) {
    const mo = new MutationObserver(() => { if (!ccPageEl.hidden) window.refreshTaCardCounts(); });
    mo.observe(ccPageEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.refreshTaCardCounts();

  // ================= IndexedDB 权威恢复（四个题库共用，v3.6.x） =================
  // localStorage 配额写失败、或大键只进 IDB 时，本地快照会停留在旧数据，
  // 用户新添加的字卡（只存在于 IDB）启动后读不到 → 看起来"消失"。
  // 启动时从 IDB 读回：若 IDB 题库比本地更全，用 IDB 数据做基准合并新预设后
  // 双写覆盖（策略同 chatcard.js cc-groups——IDB 是权威持久层，本地只是快照；
  // 反向场景 idbSet 偶尔失败而本地已最新时，IDB 数量更少 → 不覆盖，不会丢数据）。
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
          // 以 IDB 为权威（含用户自定义），合并系统预设新增题后双写
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

  // ================= 批量提问问卷（v3.32.x：用户批量出题 → 联系人作答交卷） =================
  // 题目格式（textarea 批量编辑）：单选题 = 第一行【问题】+ 下面每行一个选项（≥2 个成单选）；
  // 多选题 = 题干里带「多选」标记（【问题（多选）】）+ 每行一个选项，TA 一次答好几个；
  // 文字题 = 第一行【问题】+ 下一行只写一个「一」（与单选题的区别标记）。
  // 联系人文字题用字卡作答，与正常聊天同源：自定义字卡 1~5 张空格连发，系统预设默认聊天
  // 字卡（getDefaultCards('chat')）可覆盖——后者内部尊重 #319 未成年人防护锁（锁定时系统
  // 预设字卡抽不出，只剩自定义字卡；锁定且字卡库为空时兜底「……」，绝不泄漏预设）。
  // 交卷节奏：交卷时间（settings.deadline）到点自动交卷；未到点每 30 秒掷一次
  // 「提前交卷概率」（settings.prob），命中即把剩余题目一次性答完并交卷；
  // 未命中且还有未答题时按序再答一道（作答中体感）。
  const SKEY = 'ta-survey';
  function surveyLoad() {
    let d = null;
    try { d = JSON.parse(store.get(SKEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
    if (typeof d.text !== 'string') d.text = '';
    if (!d.settings || typeof d.settings !== 'object') d.settings = { prob: 10, deadline: 0, sendToChat: true };
    if (typeof d.settings.prob !== 'number') d.settings.prob = 10;
    if (typeof d.settings.deadline !== 'number') d.settings.deadline = 0;
    // v3.33.x #523：TA 的作答是否逐条发到聊天（批量问卷题多，用户可关闭只留卡片；默认开＝与单题一致）
    if (typeof d.settings.sendToChat !== 'boolean') d.settings.sendToChat = true;
    if (!Array.isArray(d.qs)) d.qs = [];
    if (!Array.isArray(d.answers)) d.answers = [];
    if (d.status !== 'sent' && d.status !== 'done') { d.status = 'draft'; d.sentAt = 0; }
    // v3.33.x #523：doneMsgAt = 已发过交卷系统消息的那一轮 sentAt（同轮只提醒一次；0=未提醒）
    if (typeof d.doneMsgAt !== 'number') d.doneMsgAt = 0;
    return d;
  }
  function surveySave(d) { try { store.set(SKEY, JSON.stringify(d)); } catch (e) {} }
  // v3.33.x #521：问卷进度回写聊天卡片——TA 每答一题/交卷时调用，把快照写回聊天记录里的
  // ask-survey 卡片（chat.js 的 chatSyncSurveyCard 按 surveyTs 定位；surveyTs=发出时间戳，
  // 与卡片插入时写入的一致，撤回重发后新卡新键不串）
  function surveySyncCard(d) {
    try { if (window.chatSyncSurveyCard) window.chatSyncSurveyCard(d.sentAt, d.status, d.answers.slice()); } catch (e) {}
  }
  // #1415：「多选」标记的唯一定义处——批量问卷解析与题库批量导入共用一份判据。
  // 认两种写法：括号式「题？（多选）」与裸后缀「题？多选」，命中后从题干里剥掉，屏上念的是干净问题。
  // #1480：标记里还可以把「最多选几个」按题写死——「（多选·最多2）」「（多选·最多 3 个）」
  // 「（多选：最多4）」与裸后缀「题？多选·最多2」；数字 2~6 有效（与「最多选几个」那根杆同档位），
  // 写成别的数只当普通多选、上限仍走全站那根杆（宁可少限，也不把没剥干净的标记念给 TA 听）。
  function askMultiMarkOf(text) {
    const s = String(text == null ? '' : text).trim();
    const capOf = function (n) { const v = parseInt(n, 10); return (v >= 2 && v <= 6) ? v : 0; };
    const br = s.match(/[（(]\s*多\s*选\s*(?:[·•:：]?\s*最\s*多\s*(\d{1,2})\s*个?\s*)?[)）]\s*$/);
    if (br) return { text: s.slice(0, br.index).trim(), multi: true, max: capOf(br[1]) };
    const bare = s.length > 2 ? s.match(/\s*多\s*选\s*(?:[·•:：]?\s*最\s*多\s*(\d{1,2})\s*个?\s*)?$/) : null;
    if (bare) return { text: s.slice(0, bare.index).trim(), multi: true, max: capOf(bare[1]) };
    return { text: s, multi: false, max: 0 };
  }
  // 解析问卷文本：返回 [{type:'single'|'multi'|'text', text, options}]（多选题可带 multiMax=#1480）
  // #1415：多选题的写法＝题干里带「多选」标记（【今晚想吃点什么？（多选）】或【……？多选】），
  // 标记在入库前从题干剥掉，屏上念出来的就是干净问题。选项仍不足 2 个时按文字题处理（同单选口径）。
  function surveyParse(text) {
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const qs = [];
    let cur = null, marked = false;
    const flush = () => {
      if (!cur) return;
      if (!marked && cur.opts.length >= 2) {
        const sq = { type: cur.multi ? 'multi' : 'single', text: cur.text, options: cur.opts.slice() };
        // #1480：题干标记里写死了「最多N」就随题存（multiMax），没写＝走「最多选几个」那根杆
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
  // 文字题答案：与正常聊天同源抽字卡（自定义字卡连发 → 默认聊天字卡覆盖 → 兜底）
  function surveyAnswerText() {
    let t = '';
    let words = [];
    try {
      const cards = (window.getCustomCards && window.getCustomCards()) || [];
      // FIX 2026-09-13 #388 媒体池令牌卡不进文字题答案池（同 chat.js #383 第三道守卫）
      // FIX 2026-09-15 #533 链接导入的媒体字卡（裸 http(s) 图链）同款排除
      words = cards.filter(s => typeof s === 'string' && s.trim() && s.indexOf('data:') !== 0 && s.indexOf('|||') < 0 && !/^https?:\/\//i.test(s) && !(window.mochiMediaIsToken && window.mochiMediaIsToken(s)));
    } catch (e) {}
    if (words.length) {
      const n = 1 + Math.floor(Math.random() * Math.min(5, words.length));
      const copy = words.slice(); const out = [];
      while (out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
      // #650 文字题多张字卡连接符同走「拼接随机标点」符号池（关＝空格原样）
      t = (window.pyJoinCards && window.replyCfg) ? window.pyJoinCards(out, window.replyCfg()) : out.join(' ');
    }
    try {
      const dc = window.getDefaultCards && window.getDefaultCards('chat');
      if (dc && dc.type !== 'poke' && typeof dc.text === 'string' && dc.text.trim()) t = dc.text;
    } catch (e) {}
    if (!t) {
      // 未锁定时走「询问·回应」混合池；未成年人防护锁定下不碰任何系统预设，仅字卡库（已空则最小兜底）
      if (window.cardLockOpen && window.cardLockOpen()) {
        t = window.pickAskCardReply ? window.pickAskCardReply() : '收到你的回答。';
      } else {
        t = '……';
      }
    }
    return t;
  }
  // 逐题作答：每题答案只生成一次（避免「聊天消息里的答案」与「卡片里的答案」不一致），写入
  // d.answers 并回写卡片；是否把该答案作为聊天消息逐条发出由 settings.sendToChat 决定
  // （v3.33.x #523：批量问卷题多、逐条刷聊天太吵，用户可在发出前取消勾选）。
  function surveyPickAnswer(q) {
    if (q && Array.isArray(q.options) && q.options.length) {
      // #1415：多选题一次抽「2 ~ min(最多选几个, 选项数)」个，按题目原序念成「A、B」整串。
      // 上限取全站共用的那一根杆（chat.js 的 per-cid 键 ask-multi-max）——半框里改过这里就跟着变，
      // 不留两把尺；助手取不到时（单独载入本文件的探针）退化成抽 1 个，不抛错。
      // #1480：题自己写死了「最多N」（multiMax）就用题上的，没写的题仍走那根杆。
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
      // #1415：多选题也是「从选项里挑」，逐条发到聊天时要带「我的选择：」，别念成一条自由文本
      const isPick = (q.type === 'single' || q.type === 'multi') && Array.isArray(q.options) && q.options.length;
      const msg = isPick
        ? '【' + q.text + '】我的选择：' + ans
        : '【' + q.text + '】' + ans;
      try { window.chatAddIn(msg, {}); } catch (e) {}
    }
    surveyRender();
    setTimeout(() => surveySeqAnswers(qs, cb, i + 1), 1200 + Math.floor(Math.random() * 1600));
  }
  // v3.33.x #523：同一轮只允许一条交卷完成链（防并发 tick 起第二条链重复发消息）；
  // doneMsgAt 记录「已提醒过的轮次（=sentAt）」，同一轮重复进入 finish 也不再发第二次。
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
    // 未交卷：按序再答一道（答案落卡片；聊天消息按 sendToChat 决定）
    const q = d.qs[d.answers.length];
    if (!q) return;
    surveySeqAnswers([q], () => {}, 0);
  }
  setInterval(surveyTick, 30000);
  function surveySend() {
    const d = surveyLoad();
    if (d.status === 'sent') { toast('问卷已发出，TA 正在作答'); return; }
    // v3.33.x #523：已交卷（done）允许直接再发一轮（用户要「重复提交给联系人作答」）——
    // 这里照常把 status 重置为 sent、answers 清空、插入新的问卷卡片，等于开启新一轮作答。
    const tEl = document.getElementById('ta-survey-text');
    if (tEl) { d.text = tEl.value; d.qs = surveyParse(tEl.value); surveySave(d); }
    if (!d.qs.length) { toast('请先填写问卷题目（【问题】+ 选项行 / 「一」行）'); return; }
    if (d.settings.deadline && d.settings.deadline <= Date.now()) { toast('交卷时间已过期，请重新设置'); return; }
    d.status = 'sent'; d.sentAt = Date.now(); d.answers = []; d.doneMsgAt = 0;
    surveySave(d);
    try { window.chatAddSystem('你向TA发出了一份问卷（' + d.qs.length + ' 题）。', { special: 'ask-msg' }); } catch (e) {}
    // v3.33.x #521：问卷本体以长卡片插入聊天（ask-survey）——与单题 ask-card 同层级观感；
    // 题列表快照随消息持久化，作答进度由 surveySyncCard→chatSyncSurveyCard 回写
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
    // v3.33.x #523：发出后自动关闭批量设置页、回聊天看问卷卡片（用户报「点了发出没返回聊天页」）
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
    // #1415：多选题上限回显——这一格与「问问TA」半框里那行是同一个 per-cid 键，任一处改完另一处跟上
    const mmaxEl = document.getElementById('ta-survey-mmax-val');
    if (mmaxEl) mmaxEl.value = typeof window.askMultiMaxLoad === 'function' ? window.askMultiMaxLoad() : 3;
    const st = document.getElementById('ta-survey-status');
    if (st) {
      if (d.status === 'draft') {
        const nS = d.qs.filter(q => q.type === 'single').length;
        // #1415：多选题单独计一格，草稿态一眼看出这一卷里几种题型各有多少
        const nM = d.qs.filter(q => q.type === 'multi').length;
        const brk = d.qs.length ? '（单选 ' + nS + ' 题' + (nM ? ' / 多选 ' + nM + ' 题' : '') + ' / 文字 ' + (d.qs.length - nS - nM) + ' 题）' : '';
        const cap = (typeof window.askMultiMaxLoad === 'function' ? window.askMultiMaxLoad() : 3);
        // #1480：有题自带「最多N」时点名说明——杆上那格只是没单独限选的题的默认档
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
  // v3.26.x：标记本次批量问卷「从聊天页半框进入」——返回时回聊天页而非 TA 的询问设置页
  let surveyOpenFromChat = false;
  // v3.26.x：供「聊天页 · 问问TA 半框」的「批量设置问卷」按钮调用：打开批量问卷页（返回时回聊天页）
  window.openAskSurvey = function () {
    if (!surveyPage) { toast('批量问卷加载失败'); return; }
    surveyOpenFromChat = true;
    // #472 修复：不再隐藏桌面聊天图标（.app[data-app="chat"]）——它位于 #page-phone 内，
    // 全 .page 隐藏时本就不可见；且只 hide 不 show 会留下「返回后桌面聊天图标永久消失」隐患。
    document.querySelectorAll('.page').forEach(p => p.hidden = true);
    surveyPage.hidden = false;
    surveyRender();
  };
  // v3.33.x #523：只读「问卷详情」弹窗（点聊天里的问卷卡片打开）——题干/选项/TA 逐题作答，
  // 不再跳批量设置问卷页（用户报「点已交卷卡片却打开了批量设置问卷的页面」）。
  // #713 问卷详情（用户直派：详情里没有整体卡片的收藏、也没有单个问题的批量收藏）：
  // ①「收藏整份问卷」→ 聊天收藏夹（复用 chat.js favCardFromMsg 卡片快照/判重，含 TA 作答留档）；
  // ②逐题勾选「☆ 收藏所选」/「★ 全部收藏题目」→ 题目按文本查重后存入 问问TA 题库（我的添加·日常），
  //   单选题带选项（≥2 个才成单选，与批量导入同口径），以后可再问。
  // 弹层走 openTCPanel（TA的小问题结果面板同款壳；openModal 只塞得下纯文本、挂不了按钮）
  window.openSurveyDetail = function (rec) {
    try {
      const qs = Array.isArray(rec && rec.surveyQs) ? rec.surveyQs : [];
      const answers = Array.isArray(rec && rec.surveyAnswers) ? rec.surveyAnswers : [];
      const done = !!(rec && rec.surveyStatus === 'done');
      const nDone = answers.filter(a => typeof a === 'string' && a.trim()).length;
      if (!qs.length) { toast('这份问卷没有题目'); return; }
      // 题库文本查重（系统预设与我的添加都算「已在题库」，避免收藏出重复题）
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
      // 收藏进题库：按题干精确查重；成功后就地刷新 ★ 徽标（面板保持打开，可继续读/继续选）
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
  // v3.33.x #523：关闭批量问卷页并回到聊天页（「发出后自动返回」与返回键共用；
  // enterChat 兜底缺失时回 TA 询问页，防 #472「全 .page 隐藏→底栏飞到最顶」复发）
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
      // v3.26.x：#472 修复统一收进 surveyGoChat（恢复聊天页本体，防「全 .page 隐藏→底栏飞到最顶」）
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
    // v3.33.x #523：整行可点（用户可能点「交卷时间（到点TA自动交卷）」文字而不是右侧小按钮）
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
    // v3.33.x #523：TA 的作答是否逐条发到聊天（默认开＝与单题一致；题多怕刷屏可在发出前关掉）
    const schat = document.getElementById('ta-survey-chat');
    if (schat) schat.addEventListener('change', () => {
      const d = surveyLoad();
      d.settings.sendToChat = schat.checked;
      surveySave(d);
      toast(schat.checked ? 'TA 的每条作答都会发送到聊天消息' : 'TA 的作答只写入问卷卡片，不再逐条发到聊天消息');
    });
    // #1415：多选题「最多选几个」。这一行与「问问TA」半框里那行读写同一个 per-cid 键
    // （ask-multi-max，定义与取数都在 chat.js）——两处一起调，不会各量一把尺。
    const mmaxRow = document.getElementById('ta-survey-mmax');
    if (mmaxRow) {
      const mmaxVal = document.getElementById('ta-survey-mmax-val');
      const clampMMax = () => {
        // 与半框那一行同一条收边：越界钉在端点，不打回默认值（两处控件读写同一个键，行为也得一致）
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

  // v3.9.x：安卓键盘弹起（viewport interactive-widget=resizes-content）时 layout viewport
  // 收缩 → page-ta-ask 重排 → .ta-add 内 ce-box 文字合成层停在旧位置，表现=输入文字与
  // 输入框边框分离（框移新位、文字留旧位）。mobile-adapt.js 安卓未监听键盘做合成层同步，
  // 此处补：监听 visualViewport.resize/window.resize，防抖后对可见 .ta-add 的 ce-box 强制
  // reflow + toggle transform 触发合成层重新提交位置。仅 page-ta-ask 可见时生效，开销可控。
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
  // v3.7.x：多桌面——会话级触发/已问题目/链计数是模块级，残留会让新桌面继承旧桌面的状态
  document.addEventListener('contact-switched', function () {
    _tcSessionTriggered = false;
    _tcAskedIds = [];
    _tcChain = 0;
    _tcuSessionTriggered = false;
    _trSessionTriggered = false;
  });
  // v3.28.x：全站原生分组/分类下拉统一换成自定义样式（含未走 bindNewGrp 的 .ta-type）
  try { if (window.cardGroups) window.cardGroups.ensureCustomSelects(); } catch (e) {}
})();
