

(function () {
  'use strict';
  var qsa = function (root, selector) { return Array.from(root.querySelectorAll(selector)); };
  var fmt = function (value, digits) { var n = Math.abs(value) < Math.pow(10, -(digits || 2)) / 2 ? 0 : value; return n.toFixed(digits == null ? 2 : digits); };
  var vector = function (values, digits) { return '[' + values.map(function (value) { return fmt(value, digits == null ? 2 : digits); }).join(', ') + ']'; };
  var add = function (a, b) { return a.map(function (value, index) { return value + b[index]; }); };
  var scale = function (a, factor) { return a.map(function (value) { return value * factor; }); };
  var escapeHtml = function (value) { return String(value).replace(/[&<>"']/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]; }); };
  var nodeById = function (id) { var graph = window.DSGraph; return graph && Array.isArray(graph.nodes) ? graph.nodes.find(function (node) { return node.id === id; }) : null; };
  var nodeLink = function (id, label) {
    var node = nodeById(id), prefix = id.split('.')[0];
    var groups = { attn: 'attention', vision: 'vision', output: 'output', csa: 'cross-layer', ced: 'cross-layer', moe: 'moe', cache: 'cache' };
    var group = node && node.group || groups[prefix] || prefix;
    var hash = node ? 'node=' + encodeURIComponent(id) + '&level=1&group=' + encodeURIComponent(group) : 'level=0&group=' + encodeURIComponent(group);
    return '<a class="vl-node-link" data-node-id="' + escapeHtml(id) + '" href="math-pathways.html#' + hash + '">' + escapeHtml(label) + '</a>';
  };
  var roving = function (root, selector, activate) {
    root.addEventListener('keydown', function (event) {
      var button = event.target.closest(selector);
      if (!button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      var buttons = qsa(root, selector), index = buttons.indexOf(button);
      if (index < 0) return;
      event.preventDefault();
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = buttons.length - 1;
      else index = (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      activate(buttons[index]);
      qsa(root, selector)[index]?.focus({ preventScroll: true });
    });
  };
  var playback = function (root, maximum, getStep, setStep, render, duration) {
    var playing = false, frame = 0, last = 0, elapsed = 0;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    function sync() {
      root.dataset.playing = String(playing);
      var play = root.querySelector('[data-vl-play]'), previous = root.querySelector('[data-vl-previous]'), next = root.querySelector('[data-vl-next]');
      if (play) play.textContent = playing ? '暂停' : getStep() >= maximum ? '重播' : getStep() > 0 ? '继续播放' : '播放过程';
      if (previous) previous.disabled = getStep() <= 0;
      if (next) next.disabled = getStep() >= maximum;
    }
    function stop() { playing = false; cancelAnimationFrame(frame); frame = 0; last = 0; elapsed = 0; sync(); }
    function commit(step) { setStep(Math.max(0, Math.min(maximum, step))); render(); sync(); }
    function tick(time) {
      if (!playing) return;
      if (last) elapsed += Math.min(100, time - last);
      last = time;
      if (elapsed >= duration) { elapsed = 0; commit(getStep() + 1); }
      if (getStep() >= maximum) stop(); else frame = requestAnimationFrame(tick);
    }
    function toggle() {
      if (playing) { stop(); return; }
      if (getStep() >= maximum) commit(0);
      if (reduce.matches) { commit(maximum); return; }
      playing = true; sync(); frame = requestAnimationFrame(tick);
    }
    root.addEventListener('click', function (event) {
      if (event.target.closest('[data-vl-play]')) toggle();
      if (event.target.closest('[data-vl-previous]')) { stop(); commit(getStep() - 1); }
      if (event.target.closest('[data-vl-next]')) { stop(); commit(getStep() + 1); }
      if (event.target.closest('[data-vl-finish]')) { stop(); commit(maximum); }
      if (event.target.closest('[data-vl-reset]')) { stop(); commit(0); }
    });
    reduce.addEventListener('change', function () { if (reduce.matches && playing) { stop(); commit(maximum); } });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) { if (!entries[0].isIntersecting) stop(); }).observe(root);
    sync();
    return { stop: stop, commit: commit, sync: sync };
  };



  var vectorCells = function (values, label) {
    return '<div class="vl-vector" aria-label="' + escapeHtml(label + '，完整三维教学向量 ' + vector(values, 2)) + '">' + values.map(function (value, index) {




      var text = fmt(value, 2);
      var body = text.charAt(0) === '-'
        ? '<i aria-hidden="true">-</i>' + text.slice(1)
        : text;
      return '<span><small>' + (index + 1) + '</small><b>' + body + '</b></span>';
    }).join('') + '</div>';
  };

  function initMoe(root) {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true'; root.classList.add('vl-lab', 'vl-moe', 'moe-story');
    root.innerHTML = '<div class="vl-controller moe-story-controls" aria-label="MoE 四阶段控制"><div class="moe-stage-track" role="group" aria-label="直接查看一个阶段" data-vl-moe-tabs></div></div>' +
      '<p class="moe-stage-line" data-vl-status role="status" aria-live="polite"></p>' +
      '<div class="moe-canvas" data-vl-moe-flow role="group" aria-label="输入向量经过路由、专家加工和加权汇合的四步图">' +
      '<svg class="moe-wires" viewBox="0 0 1000 430" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="moe-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker><marker id="moe-arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker><marker id="moe-arrow-gold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker><marker id="moe-arrow-violet" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker><marker id="moe-arrow-teal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs><path class="moe-wire moe-wire-input" d="M170 215 C178 215 182 215 190 215"></path><path class="moe-wire moe-wire-route moe-wire-route-one" d="M420 195 C430 195 431 126 440 126"></path><path class="moe-wire moe-wire-route moe-wire-route-two" d="M420 205 C430 205 431 240 440 240"></path><path class="moe-wire moe-wire-shared" d="M170 235 C265 385 350 354 440 354"></path><path class="moe-wire moe-wire-to-merge moe-wire-from-one" d="M750 126 C760 126 761 184 770 184"></path><path class="moe-wire moe-wire-to-merge moe-wire-from-two" d="M750 240 C760 240 761 216 770 216"></path><path class="moe-wire moe-wire-to-merge moe-wire-from-shared" d="M750 354 C762 354 760 250 770 250"></path></svg>' +
      '<section class="moe-node moe-input-node"><small>同一位置</small><strong>本例输入 x</strong><span>完整教学向量 · 3 维</span>' + vectorCells([0.5, -0.3, 0.8], '输入 x') + '</section>' +
      '<section class="moe-node moe-router-node"><header><small>路由专家</small><strong>路由器 · 教学 4 选 2</strong></header><div class="moe-score-list" data-vl-scores></div><div class="moe-selection" data-vl-selected></div></section>' +
      '<section class="moe-expert-bank"><header><small>各自加工</small><strong>专家加工 + 共享旁路</strong></header><div class="moe-expert-stack" data-vl-outputs></div></section>' +
      '<section class="moe-node moe-merge-node" data-vl-combine></section></div>' +
      '<details class="moe-evidence" data-vl-moe-real><summary>实际配置与本例核算</summary><div class="moe-evidence-body" data-vl-moe-evidence></div></details>' +
      '<div class="vl-links moe-links">' + nodeLink('moe.router_scores', '路由打分') + nodeLink('moe.router_select', '选择专家') + nodeLink('moe.routed_experts', '路由专家') + nodeLink('moe.shared_expert', '共享专家') + nodeLink('moe.combine', '加权合并') + '</div>';
    var graph = window.DSGraph || {}, config = graph.config && graph.config.text || {};
    var input = [0.5, -0.3, 0.8], scores = [0.62, 0.21, 0.51, 0.35];
    var outputs = [[0.4, 0.1, -0.2], [-0.1, 0.7, 0.3], [0.6, -0.4, 0.2], [0.2, 0.3, 0.9]];
    var selectedExperts = [0, 2], sharedOutput = [0.15, -0.05, 0.25];
    var total = selectedExperts.reduce(function (sum, index) { return sum + scores[index]; }, 0);
    var normalizedWeights = selectedExperts.map(function (index) { return scores[index] / total; });
    var routedScaling = Number(config.routedScalingFactor || config.routed_scaling_factor || 1.5);
    var coefficients = normalizedWeights.map(function (weight) { return weight * routedScaling; });
    var weightedResults = selectedExperts.map(function (index, position) { return scale(outputs[index], coefficients[position]); });
    var routedResult = weightedResults.reduce(function (sum, item) { return add(sum, item); }, [0, 0, 0]);
    var result = add(routedResult, sharedOutput), stage = 0, inspected = 0;
    var labels = ['打分', '选 2 位', '生成向量', '合并结果'];
    function connectExperts() {
      var svg = root.querySelector('.moe-wires'), bounds = svg.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      svg.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height);
      qsa(svg, 'marker').forEach(function (marker) {
        marker.setAttribute('markerUnits', 'userSpaceOnUse');
        marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6'); marker.setAttribute('refX', '10');
      });
      function box(selector) { var b = root.querySelector(selector).getBoundingClientRect(); return { left:b.left-bounds.left, right:b.right-bounds.left, top:b.top-bounds.top, bottom:b.bottom-bounds.top, y:(b.top+b.bottom)/2-bounds.top }; }
      function path(selector, points) {
        var d = 'M' + points[0].join(' ');
        for (var i=1;i<points.length-1;i++) {
          var a=points[i-1],b=points[i],c=points[i+1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(6,l1/2,l2/2);
          if (!l1 || !l2) continue;
          d+=' L'+[b[0]-(b[0]-a[0])*r/l1,b[1]-(b[1]-a[1])*r/l1].join(' ')+' Q'+b.join(' ')+' '+[b[0]+(c[0]-b[0])*r/l2,b[1]+(c[1]-b[1])*r/l2].join(' ');
        }
        root.querySelector(selector).setAttribute('d', d+' L'+points[points.length-1].join(' '));
      }
      var input=box('.moe-input-node'),router=box('.moe-router-node'),one=box('.moe-routed-card'),two=box('.moe-routed-card:nth-child(2)'),shared=box('.moe-shared-card'),merge=box('.moe-merge-node');
      path('.moe-wire-input',[[input.right,input.y],[router.left-3,input.y]]);


      [one,two].forEach(function (target,i) {
        var x=Math.min(router.right+7,(router.right+target.left)/2),y=router.y+(i?9:-9);
        path(i?'.moe-wire-route-two':'.moe-wire-route-one',[[router.right,y],[x,y],[x,target.y],[target.left-3,target.y]]);
      });
      var lane=Math.max(input.bottom,router.bottom,shared.bottom)+18,entry=Math.max(router.right+6,shared.left-25);
      path('.moe-wire-shared',[[input.right-16,input.bottom],[input.right-16,lane],[entry,lane],[entry,shared.y],[shared.left-3,shared.y]]);
      var bus=Math.max(one.right+10,merge.left-22);
      [one,two,shared].forEach(function (source,i) { path(['.moe-wire-from-one','.moe-wire-from-two','.moe-wire-from-shared'][i],[[source.right,source.y],[bus,source.y]]); });
      ['bus','result'].forEach(function(name){if(!svg.querySelector('.moe-wire-'+name)){var line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('class','moe-wire moe-wire-to-merge moe-wire-'+name);svg.append(line);}});
      path('.moe-wire-bus',[[bus,one.y],[bus,shared.y]]);
      path('.moe-wire-result',[[bus,merge.y],[merge.left-3,merge.y]]);
    }
    root.querySelector('[data-vl-moe-tabs]').innerHTML = labels.map(function (label, index) { return '<button type="button" data-vl-moe-stage="' + index + '" data-vl-phase="' + index + '"' + (index === 3 ? ' data-vl-finish' : '') + '><span>' + (index + 1) + '</span><b>' + label + '</b></button>'; }).join('');
    function update() {
      var real = { routedExperts: Number(config.nRoutedExperts || config.n_routed_experts || 384), expertsPerToken: Number(config.numExpertsPerTok || config.num_experts_per_tok || 6), sharedExperts: Number(config.nSharedExperts || config.n_shared_experts || 1), routedScaling: routedScaling, vectorDimension: Number(config.hidden_size || 5120) };
      root.dataset.stage = String(stage);
      qsa(root, '[data-vl-moe-stage]').forEach(function (button) { var index = Number(button.dataset.vlMoeStage); button.setAttribute('aria-pressed', String(index === stage)); button.setAttribute('aria-current', index === stage ? 'step' : 'false'); });
      qsa(root, '[data-vl-phase]').forEach(function (phase) { var index = Number(phase.dataset.vlPhase); phase.dataset.visible = String(index <= stage); phase.dataset.current = String(index === stage); });
      root.querySelector('[data-vl-scores]').innerHTML = scores.map(function (score, index) { var chosen = selectedExperts.includes(index); return '<button type="button" data-vl-expert="' + index + '" aria-label="专家 E' + (index + 1) + '，路由分数 ' + fmt(score, 2) + (stage >= 1 ? chosen ? '，入选' : '，未入选' : '') + '" aria-pressed="' + (inspected === index) + '" data-chosen="' + chosen + '"><span>E' + (index + 1) + '</span><i aria-hidden="true"><b style="width:' + (score / scores[0] * 100) + '%"></b></i><strong>' + fmt(score, 2) + '</strong><small>' + (stage >= 1 ? chosen ? '入选' : '未选' : '分数') + '</small></button>'; }).join('');
      root.querySelector('[data-vl-selected]').setAttribute('aria-hidden', String(stage === 0));
      root.querySelector('[data-vl-combine]').setAttribute('aria-hidden', String(stage < 3));
      root.querySelector('[data-vl-selected]').innerHTML = '<span>选中</span><b>E1 · E3</b><small>w = ' + fmt(normalizedWeights[0], 3) + ' / ' + fmt(normalizedWeights[1], 3) + '</small>';
      root.querySelector('[data-vl-outputs]').innerHTML = selectedExperts.map(function (index, position) { return '<article class="moe-expert-card moe-routed-card"><header><b>' + (stage === 0 ? '待选路由名额 ' + (position + 1) : '路由专家 E' + (index + 1)) + '</b><span>× ' + fmt(coefficients[position], 3) + '</span></header><div class="moe-output-vector" aria-hidden="' + (stage < 2) + '">' + vectorCells(outputs[index], '路由专家 E' + (index + 1) + ' 的完整输出向量') + '</div></article>'; }).join('') + '<article class="moe-expert-card moe-shared-card"><header><b>共享专家 Eₛ</b><span>独立旁路</span></header><div class="moe-output-vector" aria-hidden="' + (stage < 2) + '">' + vectorCells(sharedOutput, '共享专家的完整输出向量') + '</div></article>';
      root.querySelector('[data-vl-combine]').innerHTML = '<header><small>按权重汇总</small><strong>输出 y ≈</strong></header><div class="moe-merge-sigma" aria-hidden="true">Σ</div><div class="moe-result-vector">' + vectorCells(result, 'MoE 合并后的完整三维教学向量') + '</div>';
      root.querySelector('[data-vl-moe-evidence]').innerHTML = '<div><small>V4.1 Flash 的一层</small><strong>' + real.routedExperts + ' 个路由专家中选 ' + real.expertsPerToken + ' 个 + ' + real.sharedExperts + ' 个共享专家</strong><span>每位专家输出 ' + real.vectorDimension.toLocaleString('en-US') + ' 维向量；路由分支缩放系数为 ' + fmt(real.routedScaling, 1) + '。</span></div><div class="moe-math-lines"><small>教学数值核算</small><code>w = [0.62, 0.51] ÷ 1.13 = [' + fmt(normalizedWeights[0], 6) + ', ' + fmt(normalizedWeights[1], 6) + ']，Σw = ' + fmt(normalizedWeights.reduce(function (sum, value) { return sum + value; }, 0), 1) + '</code><code>c = 1.5w = [' + fmt(coefficients[0], 6) + ', ' + fmt(coefficients[1], 6) + ']，Σc = ' + fmt(coefficients.reduce(function (sum, value) { return sum + value; }, 0), 1) + '</code><code>y = c₁E1(x) + c₂E3(x) + Eₛ(x) = ' + vector(result, 6) + '</code><span>共享专家独立加入，不参与 Top-2 选择、权重归一化或 1.5 路由缩放。</span></div>';
      var messages = ['① 路由器只比较四个标量分数；输入 x 始终保留为一条完整三维教学向量。', '② 最高分的 E1、E3 被选中；两者的归一化权重之和为 1。', '③ E1、E3 与共享专家各自产生一条完整向量；共享专家不参与 4 选 2。', '④ 两条路由输出按系数缩放，再与共享输出逐分量相加，得到完整向量 y。'];
      root.querySelector('[data-vl-status]').textContent = messages[stage];
      root.dataset.state = JSON.stringify({ stage: stage, progress: stage / 3, inspectedExpert: inspected, teaching: { input: input, routerScores: scores, selectedExperts: selectedExperts, normalizedWeights: normalizedWeights, routedScaling: routedScaling, coefficients: coefficients, expertOutputs: outputs, sharedExpertOutput: sharedOutput, weightedResults: weightedResults, routedResult: routedResult, result: result, selection: '4-select-2' }, real: real });
      requestAnimationFrame(connectExperts);
    }
    var animation = playback(root, 3, function () { return stage; }, function (value) { stage = value; }, update, 850);
    root.addEventListener('click', function (event) { var stageButton = event.target.closest('[data-vl-moe-stage]'), expertButton = event.target.closest('[data-vl-expert]'); if (stageButton) { animation.stop(); stage = Number(stageButton.dataset.vlMoeStage); update(); animation.sync(); } if (expertButton) { inspected = Number(expertButton.dataset.vlExpert); update(); } });
    root.addEventListener('v2-context', function (event) { var node = event.detail && event.detail.node; animation.stop(); stage = node === 'moe.router_scores' ? 0 : node === 'moe.router_select' ? 1 : node === 'moe.routed_experts' || node === 'moe.shared_expert' ? 2 : 3; update(); });
    roving(root, '[data-vl-moe-stage]', function (button) { button.click(); }); roving(root, '[data-vl-expert]', function (button) { button.click(); });
    update(); animation.sync();
    new ResizeObserver(connectExperts).observe(root.querySelector('.moe-canvas'));
    document.fonts.ready.then(connectExperts);
  }

  function initLayers(root) {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true'; root.classList.add('vl-lab', 'vl-layers');
    var graph = window.DSGraph || {}, layers = Array.isArray(graph.layers) ? graph.layers : [], selectedLayer = layers.length > 25 ? 25 : Math.max(0, layers.length - 1), focusMode = 'all';
    root.innerHTML = '<header class="vl-heading"><div><p class="vl-kicker">CED 与 CSA² 已建立之后</p><h3>选一层，看它从哪里取得三种跨层对象</h3><p>先沿 40 层条找到当前位置，再顺着三条读取关系找来源。主 KV 与 Indexer K 可以同源于一层，但由不同投影产生，维度与用途也不同。</p></div></header>' +
      '<div class="vl-controller vl-layer-controller"><span>先看典型层</span><div class="vl-switches" role="group" aria-label="选择典型层"><button type="button" data-vl-layer-example="20">L20 · 建立</button><button type="button" data-vl-layer-example="24">L24 · 重做索引</button><button type="button" data-vl-layer-example="25" aria-pressed="true">L25 · 复用</button></div></div>' +
      '<div class="vl-layer-map"><div class="vl-region-labels"><span>因果 Encoder<b>L0–L19 · 第 1–20 层</b></span><span>因果 Decoder<b>L20–L39 · 第 21–40 层</b></span></div><div class="vl-layer-strip" data-vl-layer-strip role="group" aria-label="40 层来源视图"></div><div class="vl-layer-legend"><span data-mode="SWA-only">纯 SWA</span><span data-mode="Full">Full · 建立对象</span><span data-mode="Reindex">Reindex · 更新 Top-K</span><span data-mode="Reuse">Reuse · 复用</span></div></div>' +
      '<div class="vl-layer-question" data-vl-layer-question role="status"></div><div class="vl-source-flow" data-vl-source-flow></div><p class="vl-status" data-vl-status role="status" aria-live="polite"></p>' +
      '<div class="vl-links">' + nodeLink('csa.shared_kv', '共享主 KV') + nodeLink('csa.shared_index_k', '共享 Indexer K') + nodeLink('csa.reused_topk', '复用 Top-K') + nodeLink('cache.swa', '逐层 SWA') + '</div>' +
      '<details class="vl-table-details"><summary>高级查看：40 层逐层来源表</summary><div class="vl-table-tools"><div class="vl-switches" role="group" aria-label="在表中突出一种模式"><button type="button" data-vl-mode="all" aria-pressed="true">全部</button><button type="button" data-vl-mode="Full">Full</button><button type="button" data-vl-mode="Reindex">Reindex</button><button type="button" data-vl-mode="Reuse">Reuse</button></div></div><div class="vl-table-wrap" tabindex="0"><table class="vl-layer-table"><thead><tr><th>层</th><th>区域</th><th>模式</th><th>主 KV 源</th><th>Indexer K 源</th><th>Top-K 源</th><th>局部 SWA</th></tr></thead><tbody data-vl-layer-table></tbody></table></div></details>';
    function identity(type, source) { return source == null ? null : type + ':layer-' + source; }
    function sourceCard(kind, source, dimension, purpose, tone) { var available = source != null; return '<div class="vl-source-row" data-tone="' + tone + '" data-available="' + available + '"><small class="vl-src-kind">' + kind + '</small><b class="vl-src-name">' + (available ? 'L' + source + ' 产生' : '当前层没有这项跨层来源') + '</b><span class="vl-src-shape">' + dimension + '</span><i aria-hidden="true"></i><small class="vl-use-kind">交给当前层</small><b class="vl-use-name">' + (available ? purpose : '本层无需读取') + '</b></div>'; }
    function updateTable() { root.querySelector('[data-vl-layer-table]').innerHTML = layers.map(function (layer) { var focused = focusMode === 'all' || layer.mode === focusMode; return '<tr data-selected="' + (layer.index === selectedLayer) + '" data-focused="' + focused + '"><td><button type="button" data-vl-pick-layer="' + layer.index + '">L' + layer.index + '</button></td><td>' + (layer.index < 20 ? 'Encoder' : 'Decoder') + '</td><td><span class="vl-mode-tag" data-mode="' + layer.mode + '">' + layer.mode + '</span></td><td>' + (layer.kvSource == null ? '—' : 'L' + layer.kvSource) + '</td><td>' + (layer.kvSource == null ? '—' : 'L' + layer.kvSource + ' · 128 维') + '</td><td>' + (layer.indexSource == null ? '—' : 'L' + layer.indexSource) + '</td><td>本层 · 128 窗口</td></tr>'; }).join(''); }
    function update() {
      var layer = layers[selectedLayer];
      qsa(root, '[data-vl-layer-example]').forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.vlLayerExample) === selectedLayer)); });
      qsa(root, '[data-vl-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.vlMode === focusMode)); });
      if (!layer) { root.querySelector('[data-vl-layer-strip]').innerHTML = ''; root.querySelector('[data-vl-layer-question]').innerHTML = '<b>40 层配置暂不可用</b><span>共享图数据尚未载入。</span>'; root.querySelector('[data-vl-source-flow]').innerHTML = ''; root.querySelector('[data-vl-status]').textContent = '无法建立层来源视图。'; root.dataset.state = JSON.stringify({ error: 'graph-layers-unavailable', layerCount: 0 }); return; }

      var marked = [selectedLayer, layer.kvSource, layer.indexSource];
      var tick = function (index) { return index % 5 === 0 || index === 39; };
      var cell = function (item) { var related = marked.indexOf(item.index) >= 0; var label = tick(item.index) || related ? 'L' + item.index : ''; return '<button type="button" data-vl-pick-layer="' + item.index + '" data-related="' + related + '" data-mode="' + item.mode + '" aria-pressed="' + (item.index === selectedLayer) + '" aria-label="L' + item.index + '，第 ' + (item.index + 1) + ' 层，' + item.mode + '"><span>' + label + '</span></button>'; };
      root.querySelector('[data-vl-layer-strip]').innerHTML = layers.map(cell).join('');



      var strip = root.querySelector('[data-vl-layer-strip]');
      if (strip.getBoundingClientRect().width > 0) {
        var rank = function (span) { var host = span.parentElement, index = Number(host.dataset.vlPickLayer); return tick(index) ? 0 : host.getAttribute('aria-pressed') === 'true' ? 1 : 2; };
        var placed = [];
        qsa(strip, 'button span').filter(function (span) { return span.textContent; }).sort(function (a, b) { return rank(a) - rank(b); }).forEach(function (span) {
          var box = span.getBoundingClientRect();
          if (rank(span) < 2) return placed.push(box);
          var clash = placed.some(function (kept) { return box.left - 2 < kept.right && box.right + 2 > kept.left; });
          if (clash) span.style.visibility = 'hidden';
          else placed.push(box);
        });
      }



      var scroller = root.querySelector('.vl-layer-map'), active = root.querySelector('[data-vl-layer-strip] [aria-pressed="true"]');
      if (scroller && active && scroller.scrollWidth > scroller.clientWidth + 1) scroller.scrollLeft += active.getBoundingClientRect().left - scroller.getBoundingClientRect().left - (scroller.clientWidth - active.offsetWidth) / 2;
      var question = layer.index === 20 ? 'L20 会建立哪些对象？' : layer.index === 24 ? 'L24 为什么只更新索引结果？' : layer.index === 25 ? 'L25 读取谁的缓存？' : 'L' + layer.index + ' 从哪些层读取？';
      var answer = layer.mode === 'SWA-only' ? '它只使用本层最近 128 个位置的 SWA，没有跨层主 KV、Indexer K 或 Top-K。' : '主 KV 与 Indexer K 来自 L' + layer.kvSource + '；Top-K 位置编号来自 L' + layer.indexSource + '；本层 SWA 仍独立保留最近 128 个位置。';
      root.querySelector('[data-vl-layer-question]').innerHTML = '<div><small>当前问题</small><b>' + question + '</b></div><p>' + answer + '</p><span>L' + layer.index + ' · 第 ' + (layer.index + 1) + ' / 40 层 · ' + (layer.index < 20 ? 'Encoder' : 'Decoder') + ' · ' + layer.mode + '</span>';
      root.querySelector('[data-vl-source-flow]').innerHTML = sourceCard('主 KV', layer.kvSource, '512 维完整值表示', '稀疏注意力真正读取的历史内容', 'teal') + sourceCard('Indexer K', layer.kvSource, '128 维索引键', '与 Indexer Q 匹配并给历史位置打分', 'gold') + sourceCard('Top-K', layer.indexSource, '一组历史位置编号', '决定本层从主 KV 取哪些条目', 'violet') + sourceCard('逐层 SWA', layer.index, '最近 128 个位置的本层 KV', '补充局部窗口；身份不与主 KV 合并', 'blue');
      root.querySelector('[data-vl-status]').innerHTML = '<b>读图结论</b><span>' + (layer.mode === 'Full' ? '本层同时建立主 KV、Indexer K 与 Top-K，后续层可引用。' : layer.mode === 'Reindex' ? '本层沿用旧的主 KV 与 Indexer K，只重新产生 Top-K 位置编号。' : layer.mode === 'Reuse' ? '本层直接沿用最近来源层留下的三种跨层对象。' : '前两层先以局部 SWA 工作。') + '</span>';
      root.dataset.state = JSON.stringify({ selectedLayer: layer.index, focusMode: focusMode, layer: layer, region: layer.index < 20 ? 'encoder' : 'decoder', layerCount: layers.length, question: question, sharedReferences: { sourceLayer: layer.kvSource, mainKV: identity('main-kv', layer.kvSource), indexerK: identity('indexer-k', layer.kvSource), topK: identity('topk', layer.indexSource), swa: identity('swa-kv', layer.index) }, shapes: { mainKV: 512, indexerK: 128, topK: 'index ids', swaWindow: 128 }, sourceView: true });
      updateTable();
    }
    root.addEventListener('click', function (event) { var example = event.target.closest('[data-vl-layer-example]'), layerButton = event.target.closest('[data-vl-pick-layer]'), modeButton = event.target.closest('[data-vl-mode]'); if (example) selectedLayer = Number(example.dataset.vlLayerExample); if (layerButton) selectedLayer = Number(layerButton.dataset.vlPickLayer); if (modeButton) focusMode = modeButton.dataset.vlMode; if (example || layerButton || modeButton) update(); });
    root.addEventListener('v2-context', function (event) { var value = Number(event.detail && event.detail.layer); if (Number.isInteger(value) && value >= 0 && value < layers.length) selectedLayer = value; update(); });
    roving(root, '[data-vl-layer-example]', function (button) { button.click(); }); roving(root, '[data-vl-layer-strip] button', function (button) { button.click(); }); roving(root, '[data-vl-mode]', function (button) { button.click(); }); update();
  }

  function initAll() {
    qsa(document, '[data-v2-lab="moe"]').forEach(initMoe); qsa(document, '[data-v2-lab="layers"]').forEach(initLayers);
    qsa(document, '.vl-lab').forEach(function(root) {
      root.addEventListener('click', function(event) {
        var b=event.target.closest('button');
        if(b&&document.activeElement===b) event.vlFocus=[b,Array.from(b.attributes).find(a=>a.name.startsWith('data-vl-'))];
      },true);
      root.addEventListener('click',function(event) {
        var saved=event.vlFocus;
        if(!saved||saved[0].isConnected||!saved[1]||document.activeElement!==document.body)return;
        var key=saved[1],next=qsa(root,'['+key.name+']').find(b=>b.getAttribute(key.name)===key.value);
        next?.focus({preventScroll:true});
      });
    });
  }




  var FFN_BOX = function (x, y, w, h, tone, title, note) {
    return '<g><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" class="ffn-box ffn-box-' + tone + '"></rect>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + (note ? h / 2 - 2 : h / 2 + 5)) + '" class="ffn-box-title">' + title + '</text>' +
      (note ? '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 16) + '" class="ffn-box-note">' + note + '</text>' : '') + '</g>';
  };

  function buildExpertInside() {
    var section = document.getElementById('expert-inside');
    if (!section || section.firstChild) return;
    var svg = '<svg viewBox="0 0 840 250" role="img" aria-label="一个专家内部：输入向量分成两条支路，一条乘 W1 后过 SiLU，另一条乘 W3 不过激活，两条逐元素相乘后乘 W2 回到 5,120 维。">' +
      '<path d="M118 120H150V54H180" class="ffn-wire"></path>' +
      '<path d="M118 120H150V186H180" class="ffn-wire"></path>' +
      '<path d="M312 54H344" class="ffn-wire"></path>' +
      '<path d="M454 54H500V96" class="ffn-wire"></path>' +
      '<path d="M312 186H500V144" class="ffn-wire"></path>' +
      '<path d="M520 120H542" class="ffn-wire"></path>' +
      '<path d="M680 120H710" class="ffn-wire"></path>' +

      ['M172 48L180 54L172 60','M172 180L180 186L172 192','M336 48L344 54L336 60','M542 114L550 120L542 126','M708 114L716 120L708 126']
        .map(function (d) { return '<path d="' + d + 'Z" class="ffn-arrow"></path>'; }).join('') +
      '<path d="M494 90L500 98L506 90Z" class="ffn-arrow"></path>' +
      '<path d="M494 150L500 142L506 150Z" class="ffn-arrow"></path>' +
      FFN_BOX(8, 94, 110, 52, 'plain', '输入 x', '5,120 维') +
      FFN_BOX(180, 30, 132, 48, 'weight', '× W₁', '得到 2,304 维') +
      FFN_BOX(344, 30, 110, 48, 'act', 'SiLU', '逐元素') +
      FFN_BOX(180, 162, 132, 48, 'weight', '× W₃', '得到 2,304 维') +
      '<circle cx="500" cy="120" r="20" class="ffn-gate"></circle>' +
      '<text x="500" y="126" class="ffn-gate-mark">⊙</text>' +


      '<text x="470" y="126" class="ffn-gate-note" text-anchor="end">逐元素相乘</text>' +
      FFN_BOX(542, 94, 138, 52, 'weight', '× W₂', '回到 5,120 维') +
      FFN_BOX(716, 94, 116, 52, 'plain', '这个专家的输出', '5,120 维') +
      '<text x="246" y="20" class="ffn-branch-label">门控支路</text>' +
      '<text x="246" y="232" class="ffn-branch-label">数值支路</text>' +
      '</svg>';

    var rows = [
      ['专家前馈内部', 'SiLU，配门控即 SwiGLU', '逐元素作用在 2,304 维中间向量上'],
      ['注意力权重', 'softmax（每头另有一个 sink 进分母）', '作用在一整组分数上，不是逐元素'],
      ['路由打分', 'softplus 后开方', '每个专家得到一个非负分数'],
      ['mHC 系数', 'sigmoid（C 用 2×sigmoid）', '只作用在少量混合系数上'],
      ['Engram 门控', 'sigmoid', '每一路一个门，决定注入多少'],
      ['输出概率', 'softmax', '作用在词表的 129,280 个分数上']
    ];

    section.className = 'ffn-inside story-section';
    section.innerHTML = '<h3>打开一个专家：里面是什么？</h3>' +
      '<p>上面两张图都把专家当成一个方块。它内部其实是固定的三步：同一条输入分成两条支路，一条过激活函数当「门」，另一条不过，两条逐元素相乘之后再投影回原来的维度。</p>' +
      '<div class="ffn-figure"><div class="ffn-canvas">' + svg + '</div>' +
      '<p class="ffn-legend">琥珀 = 训练得到、推理时固定的矩阵；青绿 = 这里唯一的逐元素非线性。一个专家进出都是 5,120 维，中间那段是 2,304 维——比主干<b>更窄</b>：把宽度做大的是专家的<b>数量</b>，不是单个专家的宽度。传统前馈网络只有一个，中间层通常比主干宽几倍；这里换成 385 个各自很窄的专家，每个 token 只用上其中 7 个（6 个路由专家 + 1 个共享专家）。</p>' +
      '</div>' +
      '<details class="ffn-points-detail"><summary>专家有多少个？参数量从哪里来？为什么要截断数值？</summary>' +
      '<ul class="ffn-points">' +
        '<li><b>384 个路由专家和 1 个共享专家结构完全一样</b>，只是三张矩阵的权重不同。「专家」不是一种特殊结构，是同一套前馈网络的很多份副本。</li>' +
        '<li><b>三张矩阵就是参数量的来源。</b>一个专家 3 × 5,120 × 2,304，乘上每层 385 个专家、40 层，得到后面参数一章里那约 545B。</li>' +
        '<li><b>路由专家的两条支路上还各有一次数值截断。</b>clamp 把每个分量限制在 −10 到 10 之间，超出就记成边界值。<b>10 在这里是很大的数</b>：本页算例里的分量都在 ±2 以内，正常训练出来的激活也多在个位数以内，所以这一刀几乎不碰到正常数值，只拦住个别异常放大的分量——它们会让整段数值在换算成低精度格式时溢出。共享专家不带这一步。</li>' +
      '</ul></details>' +
      '<details class="ffn-activation"><summary>那激活函数在整个网络里出现在哪些地方？</summary>' +
        '<p>逐元素的非线性只有专家内部这一处——那条 5,120 维的主干表示，一路上只在这里被逐个分量地弯折。其余几处都作用在「系数、分数、概率」上，不直接变换主干向量。</p>' +
        '<table class="ffn-activation-table"><thead><tr><th>出现的位置</th><th>用的函数</th><th>作用在什么上</th></tr></thead><tbody>' +
        rows.map(function (row) {
          return '<tr><th scope="row">' + row[0] + '</th><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>';
        }).join('') +
        '</tbody></table>' +
        '<p>另外，层里反复出现的 RMSNorm 是把数值缩放到稳定范围的归一化，不是激活函数；两者常常前后相邻，但作用不同。</p>' +
      '</details>' +
      '<div class="vl-links ffn-links">' + nodeLink('moe.routed_experts', '路由专家公式') + nodeLink('moe.shared_expert', '共享专家公式') + nodeLink('moe.router_scores', '路由打分') + '</div>';
  }

  window.Namespacevl = Object.assign(window.Namespacevl || {}, { initMoe: initMoe, initLayers: initLayers });
  function boot() { initAll(); buildExpertInside(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

(function(){
 'use strict';
 const G=window.DSGraph;if(!G)return;
 const anchors={input:'embedding',vision:'tensor-3d',engram:'engram-location',mhc:'mhc-3d',attention:'attention-3d',csa:'v2-layers',moe:'v2-moe',cache:'v2-cache',output:'v2-output-loop',dspark:'viz-dspark',training:'training'};
 function crossPage(){if(!location.hash.startsWith('#v2-node='))return;const p=new URLSearchParams(location.hash.slice(4));const node=G.nodes.find(n=>n.id===p.get('node'));if(!node)return;const projection=['attn.q_lowrank','attn.kv_window_projection'].includes(node.id);const anchor=projection?'v2-projection':anchors[node.group],target=document.getElementById(anchor); if(target){for(let a=target.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;target.scrollIntoView({block:'start'}); const focusTarget=target.classList.contains('v3-compat-anchor')&&target.nextElementSibling||target;focusTarget.tabIndex=-1;focusTarget.classList.add('v3-nav-focus');focusTarget.focus({preventScroll:true});}const lab=document.querySelector(`[data-v2-lab="${projection?'projection':node.group==='csa'?'layers':node.group}"]`);if(lab)lab.dispatchEvent(new CustomEvent('v2-context',{detail:Object.fromEntries(p)}));}
 window.addEventListener('hashchange',crossPage);setTimeout(crossPage,100);
 document.querySelectorAll('[data-v2-lab]').forEach(root=>{const id=root.dataset.v2Lab;if(!root.id)root.id='v2-'+id;});
})();

(function(){
 'use strict';
 function init(){
  const section=document.getElementById('csa-modes');
  if(section){
   const stack=section.querySelector('.scv9-mode-stack'),panels=[...stack.children],nav=document.createElement('div');nav.className='v2-comparison-tabs';nav.setAttribute('role','group');nav.setAttribute('aria-label','比较三种层职责');
   nav.innerHTML=['Full · 建缓存并选位置','Reindex · 复用缓存，重选位置','Reuse · 缓存与所选位置都复用'].map((label,i)=>`<button type="button" data-v2-csa-panel="${i}" aria-pressed="${i===0}">${label}</button>`).join('');stack.before(nav);
   const summary=document.createElement('div');summary.className='v2-mode-summary';summary.innerHTML='<span><b>主 KV / Indexer K</b>Full 新建；其余引用已有对象</span><span><b>Top-K 位置编号</b>Full、Reindex 重算；Reuse 引用</span><span><b>本层主注意力</b>三种模式都会继续计算</span>';nav.before(summary);
   function show(i){panels.forEach((p,j)=>p.hidden=j!==i);nav.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));section.dataset.v2Mode=i;}
   nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(+b.dataset.v2CsaPanel);});nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let i=+section.dataset.v2Mode;i=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowLeft'?-1:1)+3)%3;show(i);nav.children[i].focus();});show(0);
  }
  const draft=document.querySelector('.dv9-process');
  if(draft){
   const phases=[...draft.querySelectorAll(':scope > .dv9-phase')];
   const controls=document.createElement('div');controls.className='v3-draft-controls';controls.innerHTML='<button type="button" data-v3-draft-reset>从头开始</button><span>先看当前结果，再选择继续。</span>';draft.prepend(controls);
   const second=document.createElement('section'),third=document.createElement('section');second.className=third.className='v3-draft-phase';second.id='v3-draft-verify';third.id='v3-draft-accept';second.innerHTML='<h4 tabindex="-1">② 主模型验证候选 <small data-v3-verify-ready>等待草稿</small></h4><p class="v3-draft-preview">主模型会同时检查这些草稿位置，判断前面连续多少项可以采用。</p>';third.innerHTML='<h4 tabindex="-1">③ 采用连续通过的部分 <small data-v3-accept-ready>等待验证</small></h4><p class="v3-draft-preview">通过的连续前缀加入已有文本；遇到首个不同预测时，由主模型接上结果。</p>';
   phases[1].before(second);second.append(phases[1]);phases[2].before(third);third.append(phases[2]);[second,third].forEach(section=>{Object.defineProperty(section,'open',{get(){return this.dataset.open==='true';},set(value){this.dataset.open=String(value);this.querySelector('.dv9-phase').hidden=!value;this.querySelector('.v3-draft-preview').hidden=value;}});section.open=false;});
   const next1=document.createElement('button'),next2=document.createElement('button');next1.type=next2.type='button';next1.className=next2.className='v3-draft-continue';next1.textContent='继续到验证 ↓';next2.textContent='继续到采用结果 ↓';phases[0].append(next1);phases[1].append(next2);
   function update(){const verify=draft.querySelector('[data-dv9-action="verify"]'),inspect=draft.querySelector('[data-dv9-inspect]'),ready=!verify.disabled||!inspect.disabled,done=!inspect.disabled;next1.disabled=!ready;next2.disabled=!done;second.querySelector('small').textContent=ready?'草稿已准备好':'等待草稿';third.querySelector('small').textContent=done?'验证结果已保留':'等待验证';draft.dataset.v3Presentation='continuous';}
   function enter(section){section.open=true;window.DSNavigation.go('#'+section.id,{focus:false});section.querySelector('h4').focus({preventScroll:true});}
   next1.onclick=()=>enter(second);next2.onclick=()=>enter(third);controls.querySelector('button').onclick=()=>{draft.querySelector('[data-dv9-action="reset"]').click();second.open=false;third.open=false;draft.scrollIntoView({block:'start'});};
   new MutationObserver(update).observe(draft.querySelector('[data-dv9-action="verify"]'),{attributes:true,attributeFilter:['disabled']});new MutationObserver(update).observe(draft.querySelector('[data-dv9-inspect]'),{attributes:true,attributeFilter:['disabled']});update();
  }

 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

window.DSModelHistory = {
  "models": [
    {
      "id": "deepseek-v2",
      "name": "DeepSeek-V2",
      "totalB": 236,
      "activeB": 21,
      "architecture": "DeepSeekMoE + MLA（多头潜注意力）",
      "parameterScope": "官方报告称总参数为 236B。",
      "totalSource": "v2-readme",
      "activeSource": "v2-readme",
      "compute": null,
      "computeExplanation": "官方同时报告相对 DeepSeek 67B 的训练成本、KV 缓存和吞吐改进，但这些是不同系统指标，且未与后续型号按同一 FLOPs 条件重测，因此不填成统一计算量。",
      "notes": "总参数表示模型拥有的权重规模；MoE 路由只让每个 token 经过其中一部分专家，所以激活参数远小于总参数。"
    },
    {
      "id": "deepseek-v3",
      "name": "DeepSeek-V3",
      "totalB": 671,
      "activeB": 37,
      "architecture": "DeepSeekMoE + MLA + 无辅助损失负载均衡 + MTP",
      "parameterScope": "671B 是主模型权重。官方发布 README 以约 685B 描述权重包，其中 MTP 模块约 14B；更细的权重文档列 MTP 独有参数为 11.5B，并共享主模型的输入嵌入与输出头。发布包口径与独有参数口径分开保留。",
      "totalSource": "v3-readme",
      "activeSource": "v3-readme",
      "compute": {
        "metric": "完整训练的加速器时间",
        "value": 2.788,
        "unit": "百万 H800 GPU 小时",
        "conditions": "DeepSeek-V3 最终完整训练流程；官方另列预训练为 2.664M H800 GPU 小时，完整训练合计 2.788M。该值不是 FLOPs，也不包含研发试验的统一核算。",
        "source": "v3-readme"
      },
      "computeExplanation": "GPU 小时同时受硬件、并行策略和利用率影响，只适合说明 V3 官方披露的训练资源，不能与 V4 的单 token 推理 FLOPs 或实际时延混画。",
      "notes": "权重说明进一步给出：主模型激活量为 36.7B（含共享的输入嵌入与输出头，各约 0.9B），顶层资料将其四舍五入为 37B。",
      "detailSources": [
        "v3-weights"
      ]
    },
    {
      "id": "deepseek-v3.2",
      "name": "DeepSeek-V3.2",
      "totalB": 671,
      "activeB": 37,
      "architecture": "V3 系列 MoE + MLA 的 MQA 模式 + DSA（DeepSeek 稀疏注意力）",
      "parameterScope": "采用 V4 官方跨型号表给出的 671B。V3.2 在 V3.1-Terminus 上继续训练并加入稀疏注意力索引器；顶层表没有为索引器另报可相加的参数量。",
      "totalSource": "v4-report",
      "activeSource": "v4-report",
      "compute": {
        "metric": "单 token 推理等效 FP8 FLOPs（相对基准）",
        "value": 100,
        "unit": "%",
        "conditions": "1M-token 上下文；V4 报告把 DeepSeek-V3.2 设为 100%，并按等效 FP8 FLOPs估算。",
        "source": "v4-report"
      },
      "computeExplanation": "这是给 V4-Flash 与 V4-Pro 使用的同条件相对基准，不是绝对 FLOPs。DSA 将主注意力复杂度从 O(L²) 降到 O(Lk)，其中每个查询选 2,048 个 KV token；索引器仍为 O(L²)，但计算量较小。",
      "notes": "参数规模几乎不变不代表计算路径不变：DSA 改变的是长上下文中被主注意力读取的历史位置数。",
      "detailSources": [
        "v32-report"
      ]
    },
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek-V4-Flash",
      "totalB": 284,
      "activeB": 13,
      "architecture": "DeepSeekMoE + CSA/HCA 混合注意力 + mHC + MTP",
      "parameterScope": "V4 模型卡称 284B 为总参数；后续 V4.1 报告跨型号表称同一数值为骨干参数。顶层表没有单独拆出 MTP 参数。",
      "totalSource": "v4-model-card",
      "activeSource": "v4-model-card",
      "compute": {
        "metric": "单 token 推理等效 FP8 FLOPs（相对 V3.2）",
        "value": 10,
        "unit": "%",
        "conditions": "1M-token 上下文；V3.2=100%；报告按等效 FP8 FLOPs 估算。",
        "source": "v4-report"
      },
      "computeExplanation": "10% 来自与 V3.2 同一张官方长上下文计算图，包含稀疏/压缩注意力和精度折算的影响；它不是 13B/37B 的简单比例，也不是实测时延或吞吐。",
      "notes": "V4 推理版本的路由专家使用 FP4，多数其它参数使用 FP8；参数个数与运算的数值精度是两条不同维度。",
      "detailSources": [
        "v41-report"
      ]
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek-V4-Pro",
      "totalB": 1600,
      "activeB": 49,
      "architecture": "DeepSeekMoE + CSA/HCA 混合注意力 + mHC + MTP",
      "parameterScope": "V4 模型卡称 1.6T 为总参数；后续 V4.1 报告跨型号表称同一数值为骨干参数。顶层表没有单独拆出 MTP 参数。",
      "totalSource": "v4-model-card",
      "activeSource": "v4-model-card",
      "compute": {
        "metric": "单 token 推理等效 FP8 FLOPs（相对 V3.2）",
        "value": 27,
        "unit": "%",
        "conditions": "1M-token 上下文；V3.2=100%；报告按等效 FP8 FLOPs 估算。",
        "source": "v4-report"
      },
      "computeExplanation": "虽然 49B 激活参数多于 V3.2 的 37B，V4-Pro 在 1M 上下文的估算单 token FLOPs 只有 V3.2 的 27%；差异主要来自 CSA/HCA 对长上下文注意力路径的压缩，而不是只看 MoE 激活量。",
      "notes": "这个例子说明“激活参数更多”与“长上下文总计算更多”并不等价。",
      "detailSources": [
        "v41-report"
      ]
    },
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek-V4.1-Flash",
      "totalB": 552,
      "activeB": {
        "prefill": 8,
        "decode": 16
      },
      "architecture": "40 层 CED（20 层因果编码器 + 20 层解码器）+ CSA² + DeepSeekMoE + Single-Pass mHC + Engram + DSpark；原生多模态",
      "parameterScope": "552B 是报告标注的骨干参数；报告另列 196B Engram 查表参数。发布页面的文件元数据为 763B。报告没有逐项解释骨干与 Engram 的算术和 748B 与文件计数 763B 之间的约 15B，因此保留三个统计范围。",
      "totalSource": "v41-report",
      "activeSource": "v41-report",
      "compute": {
        "metric": "单 token 解码 FLOPs 的上下文增长",
        "value": 1.25,
        "unit": "倍（1M 相对 4K）",
        "conditions": "上下文从 4K 增至 1M（长度为 256 倍）；报告图 2 将 BF16、FP8、FP4 运算分别按 1、0.5、0.25 加权。",
        "source": "v41-report"
      },
      "computeExplanation": "官方表述为解码 FLOPs 只增加约四分之一，即 1M 约为 4K 的 1.25 倍。这个自身增长率与 V4 报告的“V3.2=100%”不是同一个归一化序列，不能直接把 1.25 与 10、27 比大小。",
      "notes": "Engram 是按 token/n-gram 哈希稀疏查表的条件记忆：196B 描述表的容量，不表示每个 token 都做 196B 参数规模的矩阵乘法。CED 让提示主体先经过 20 层编码器，解码使用完整 40 层路径；SWA Bounded Replay 还可能对提示末尾做有限重算，因此官方分别报告 8B 与 16B。",
      "detailSources": [
        "v41-model-card"
      ]
    }
  ],
  "sources": [
    {
      "id": "v2-readme",
      "title": "DeepSeek-V2 官方 GitHub README",
      "url": "https://github.com/deepseek-ai/DeepSeek-V2",
      "locator": "§1 Introduction（在线文本行 177–180）；§3 Model Downloads（行 185–192）",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v3-readme",
      "title": "DeepSeek-V3 官方 GitHub README",
      "url": "https://github.com/deepseek-ai/DeepSeek-V3",
      "locator": "§1 Introduction（在线文本行 187–190）；§2 Model Summary / Pre-Training（行 201–205）；§3 Model Downloads",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v3-weights",
      "title": "DeepSeek-V3 官方权重结构说明",
      "url": "https://github.com/deepseek-ai/DeepSeek-V3/blob/main/README_WEIGHTS.md",
      "locator": "§Weight Structure Overview → Main Model Weights / Multi-Token Prediction Modules",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v32-report",
      "title": "DeepSeek-V3.2 官方技术报告",
      "url": "https://arxiv.org/html/2512.02556v1",
      "locator": "§2.1（在线文本行 89–123）；§2.3 Inference Costs（行 135–142）",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v4-model-card",
      "title": "DeepSeek-V4-Flash 官方 Hugging Face 模型卡",
      "url": "https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash",
      "locator": "Introduction；Model Downloads；Base Model 表（在线文本行 191–217）",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v4-report",
      "title": "DeepSeek-V4 官方技术报告",
      "url": "https://arxiv.org/html/2606.19348v1",
      "locator": "Abstract（在线文本行 140–145）；§1 Introduction（行 202–218）；§2.1 Designs Inherited from DeepSeek-V3（行 246–253）",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v41-model-card",
      "title": "DeepSeek-V4.1-Flash 官方 Hugging Face 模型卡",
      "url": "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash",
      "locator": "Introduction 与 Architecture（在线文本行 167–184）；Base Model 表（行 189–197）；Hugging Face 文件元数据 Model size（行 299–305）",
      "checkedAt": "2026-09-12",
      "primary": true
    },
    {
      "id": "v41-report",
      "title": "DeepSeek-V4.1-Flash 官方技术报告 PDF",
      "url": "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf",
      "locator": "p.1 Abstract；p.5 Figure 2 与正文；p.7 §2.1 Overview；p.13 §2.4.2 Engram；p.22 §4.2.1 Model Setups；p.24 Table 1",
      "checkedAt": "2026-09-12",
      "primary": true,
      "localCopy": "references/deepseek-ai/DeepSeek-V4.1-Flash/2026-09-12/DeepSeek_V41_Tech_Report.pdf",
      "localTextLines": "16–18, 201–207, 260–263, 388–395, 736–753, 1245–1254, 1353–1360"
    }
  ],
  "notes": [
    {
      "id": "definitions",
      "title": "先统一三个名词",
      "text": "总参数回答“模型保存了多少训练得到的权重”；激活参数回答“一个 token 的这次前向路径经过多少权重”；计算量还要加上注意力随上下文长度变化的运算、数值精度、预填充/解码阶段和实现开销。三者有关，但不能互相替代。"
    },
    {
      "id": "active-is-not-flops",
      "title": "激活参数不是 FLOPs",
      "text": "约 2×N_active FLOPs/token 只可作为线性投影和 FFN 主项的一阶估算；它漏掉注意力、路由、归一化、缓存读写、稀疏索引器、视觉编码器和推测解码，也没有反映不同精度。因此本数据没有把该公式冒充官方实测。"
    },
    {
      "id": "engram-scope",
      "title": "Engram 的 196B 怎样看",
      "text": "196B 是两组 Engram 表的总容量，报告称其通过确定性哈希稀疏访问并可从主机内存预取。它能扩大记忆容量，却不等于每个 token 都激活 196B；官方未给出把 Engram 换算成“激活参数 B”的统一数字。"
    },
    {
      "id": "published-scope",
      "title": "顶层参数口径并非完全一致",
      "text": "V3 的 671B 明确指主模型，发布包另含 MTP；V4 模型卡称 284B/1.6T 为总参数，V4.1 报告的同一跨型号表称其为骨干参数；V4.1 的 552B 也明确是骨干，另有 196B Engram，而官方 Hugging Face 文件元数据为 763B。比较图应把这一列标为“官方发布的主模型/骨干规模”，并就近显示范围提示。"
    },
    {
      "id": "quality-separate",
      "title": "规模不等于能力评分",
      "text": "参数更多、激活更多或 FLOPs 更高都不能单独推出模型性能。架构、训练数据、训练方法、上下文条件和推理预算都会改变结果；本数据只描述规模与计算口径。"
    }
  ],
  "comparisons": {
    "publishedMainOrBackboneB": {
      "label": "官方发布的主模型/骨干参数规模",
      "unit": "B",
      "values": {
        "deepseek-v2": 236,
        "deepseek-v3": 671,
        "deepseek-v3.2": 671,
        "deepseek-v4-flash": 284,
        "deepseek-v4-pro": 1600,
        "deepseek-v4.1-flash": 552
      },
      "caution": "V3 发布包另含 MTP；V4 顶层资料对“总参数/骨干参数”的标签不完全一致；V4.1 另有 196B Engram，当前 Hugging Face 文件元数据为 763B。"
    },
    "activatedPerTokenB": {
      "label": "官方发布的每 token 激活参数",
      "unit": "B",
      "values": {
        "deepseek-v2": 21,
        "deepseek-v3": 37,
        "deepseek-v3.2": 37,
        "deepseek-v4-flash": 13,
        "deepseek-v4-pro": 49,
        "deepseek-v4.1-flash": {
          "prefill": 8,
          "decode": 16
        }
      },
      "caution": "V4.1 必须分预填充和解码显示；Engram 没有官方可相加的激活参数值。"
    },
    "v4LongContextRelativeFlops": {
      "label": "1M 上下文的单 token 推理等效 FP8 FLOPs",
      "unit": "% of DeepSeek-V3.2",
      "values": {
        "deepseek-v3.2": 100,
        "deepseek-v4-flash": 10,
        "deepseek-v4-pro": 27
      },
      "conditions": "同一 V4 技术报告的估算口径；不能加入 V2、V3 的 GPU 小时，也不能加入 V4.1 的上下文增长倍数。",
      "source": "v4-report"
    },
    "v41DecodeContextGrowth": {
      "label": "V4.1-Flash 单 token 解码 FLOPs 随上下文增长",
      "unit": "×",
      "values": {
        "4K": 1,
        "1M": 1.25
      },
      "conditions": "上下文长度扩大 256 倍；BF16/FP8/FP4 运算权重分别为 1/0.5/0.25。1.25 来自报告所述“增加约四分之一”。",
      "source": "v41-report"
    }
  }
};

(function(){
'use strict';const data=window.DSModelHistory;if(!data)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=v=>v>=1000?(v/1000).toFixed(1)+'T':v+'B';
const scopes={'deepseek-v2':'报告总参数','deepseek-v3':'主模型；MTP 另计','deepseek-v3.2':'V4 报告跨型号表','deepseek-v4-flash':'模型卡总参数 / 后续报告骨干','deepseek-v4-pro':'模型卡总参数 / 后续报告骨干','deepseek-v4.1-flash':'骨干；Engram 另计'};
const extras={'deepseek-v3':'MTP（Multi-Token Prediction，多 token 预测）：权重文档列出 11.5B 独有参数，并共享主模型的嵌入与输出头。发布 README 另以约 14B 描述 MTP 模块、约 685B 描述整个权重包。','deepseek-v4.1-flash':'报告另外列出 196B Engram 查表参数；发布页面的文件元数据为 763B。骨干、查表容量与文件计数分别保留原统计范围。'};
const activeNotes={'deepseek-v3':'官方顶层资料取整为 37B；权重说明细分为主模型激活 36.7B，其中输入嵌入和输出头各约 0.9B。MTP 单独执行时的激活范围另计。','deepseek-v4.1-flash':'提示主体读入走 20 层编码器，逐 token 生成经过完整 40 层路径，分别报告约 8B 与 16B；提示尾部还可能进行有限的 SWA 重放。Engram 表容量不等于逐 token 激活量。'};
function links(ids){const set=new Set(ids);return data.sources.filter(s=>set.has(s.id)).map(s=>'<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a> · '+esc(s.locator)+'</p>').join('');}
function init(){document.querySelectorAll('[data-v3-model-history]').forEach(root=>{root.id='v3-model-history-chart';root.className='v3-model-history';let metric='parameters',selected='deepseek-v4.1-flash';root.innerHTML='<div class="v3-history-tabs" role="group" aria-label="比较口径"><button type="button" data-history-metric="parameters">总参数与统计范围</button><button type="button" data-history-metric="active">每 token 激活量</button><button type="button" data-history-metric="compute">同条件计算量</button></div><p class="v3-history-context"></p><p class="v3-history-current" aria-live="polite"></p><div class="v3-history-chart"></div><div class="v3-history-extra"></div><div class="v3-history-result"></div><details class="v3-history-sources"><summary></summary><div></div></details>';
function render(){const model=data.models.find(m=>m.id===selected);root.dataset.metric=metric;root.querySelectorAll('[data-history-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.historyMetric===metric)));let rows,maximum=0,unit,context;
if(metric==='parameters'){unit='参数个数';context='这里选取 V2 至 V4.1 的主要架构代际。每行保留原报告的统计范围，额外模块单独说明。选择模型可查看其范围与来源。';rows=data.models.map(m=>({m,value:m.totalB,label:count(m.totalB),sub:scopes[m.id]}));}
else if(metric==='active'){maximum=49;unit='每 token 激活参数';context='MoE 让每个 token 只经过少量专家。V4.1 还区分读入与生成：浅绿为主体读入 8B，深绿延伸至生成时的 16B。';rows=data.models.map(m=>({m,value:typeof m.activeB==='number'?m.activeB:m.activeB.decode,low:typeof m.activeB==='object'?m.activeB.prefill:null,label:typeof m.activeB==='number'?count(m.activeB):'8B / 16B',sub:typeof m.activeB==='number'?'每 token':'读入 / 生成'}));}
else{maximum=100;unit='相对 FLOPs';context='同一 V4 技术报告、1M-token 上下文：V3.2 设为 100%，按等效 FP8（8 位浮点）的单 token 推理 FLOPs 估算。';rows=data.models.filter(m=>['deepseek-v3.2','deepseek-v4-flash','deepseek-v4-pro'].includes(m.id)).map(m=>({m,value:m.compute.value,label:m.compute.value+'%',sub:'激活 '+count(m.activeB)}));}
root.querySelector('.v3-history-context').textContent=context;


const current=rows.find(r=>r.m.id===selected);root.querySelector('.v3-history-current').textContent='当前模型 '+model.name.replace('DeepSeek-','')+'：'+current.label+(metric==='parameters'?'，'+current.sub:'');
root.querySelector('.v3-history-chart').innerHTML=rows.map(r=>'<button type="button" data-history-model="'+r.m.id+'" aria-pressed="'+(selected===r.m.id)+'"><span>'+esc(r.m.name.replace('DeepSeek-',''))+(metric==='parameters'?'':'<small>'+esc(r.sub)+'</small>')+'</span>'+(metric==='parameters'?'<span class="v3-history-scope">'+esc(r.sub)+'</span>':'<i aria-hidden="true"><b style="width:'+r.value/maximum*100+'%"></b>'+(r.low?'<em class="is-low" style="left:0;width:'+r.low/maximum*100+'%"></em>':'')+'</i>')+'<strong>'+r.label+'</strong></button>').join('');
root.querySelector('.v3-history-extra').innerHTML=metric==='parameters'&&extras[selected]?'<p><b>另外列出的模块</b> '+esc(extras[selected])+'</p>':'';
root.querySelector('.v3-history-result').innerHTML=metric==='parameters'?'<b>总参数描述能保存多少权重；一次计算实际动用的部分，要接着看激活量。</b>':metric==='active'?'<b>V3 与 V3.2 激活量都约为 37B，注意力路径仍不同。激活量可以解释专家调用规模，完整计算还要考虑历史长度。</b>':'<b>V4-Pro 激活约 49B，高于 V3.2 的 37B；在这组长上下文条件下，估算计算量却为 27%。注意力压缩改变了总工作量。</b><details class="v3-history-other"><summary>另一种比较：同一模型的上下文变长</summary><p>V4.1 的上下文从 4K 增至 1M（256 倍），单 token 解码 FLOPs 约为原来的 1.25 倍。此处比较的是 V4.1 自身增长率。</p>'+links(['v41-report'])+'</details><details class="v3-history-other"><summary>训练资源为什么单独列？</summary><p>V3 披露完整训练约 278.8 万 H800 GPU 小时。GPU 小时还受硬件与利用率影响，与单 token 推理的运算次数分属不同指标。</p>'+links(['v3-readme'])+'</details>';
let body,sourceIds;if(metric==='parameters'){body=model.parameterScope;sourceIds=[model.totalSource,...(model.detailSources||[])];}else if(metric==='active'){body=activeNotes[selected]||'该模型官方报告的每 token 激活参数为 '+count(model.activeB)+'。路由只选择一部分专家，激活规模小于模型拥有的全部参数。';sourceIds=[model.activeSource,...(selected==='deepseek-v3'?['v3-weights']:[])];}else{body=model.computeExplanation+' '+model.compute.conditions;sourceIds=[model.compute.source];}
root.querySelector('.v3-history-sources summary').textContent=metric==='parameters'?'查看当前模型的参数范围与来源':metric==='active'?'查看当前模型的激活口径与来源':'查看当前模型的计算条件与来源';root.querySelector('.v3-history-sources>div').innerHTML='<h4>'+esc(model.name)+'</h4><p>'+esc(body)+'</p>'+links(sourceIds);root.dataset.state=JSON.stringify({metric,selected,unit,rows:rows.map(r=>({id:r.m.id,value:r.value,extra:0,low:r.low??null})),maximum,extraModule:metric==='parameters'&&selected==='deepseek-v4.1-flash'?{name:'Engram',parametersB:196}:null});
}
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.historyMetric){metric=b.dataset.historyMetric;if(metric==='compute'&&!['deepseek-v3.2','deepseek-v4-flash','deepseek-v4-pro'].includes(selected))selected='deepseek-v3.2';render();}if(b.dataset.historyModel){selected=b.dataset.historyModel;render();root.querySelector('[data-history-model="'+selected+'"]').focus({preventScroll:true});}});render();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
 'use strict';
 const concepts=[
  {id:'input',label:'输入内容',at:[0,0],target:'u2',terms:['文本与 token','图像与 patch']},
  {id:'representation',label:'形成数值表示',at:[1,0],target:'embedding',terms:['词嵌入 Embedding','视觉编码器','邻域拼接与视觉 MLP']},
  {id:'attention',label:'从上下文取信息',at:[2,0],target:'qv15-overview',terms:['查询 Q、键 K、值 V','点积、遮罩与 softmax','旋转位置编码 RoPE','多头与输出投影']},
  {id:'experts',label:'加工当前位置',at:[3,0],target:'v2-moe',terms:['前馈网络','专家混合 MoE','路由、共享专家与加权合并']},
  {id:'residual',label:'保留并更新状态',at:[4,0],target:'mhc-3d',terms:['残差连接','四路 mHC','固定参数与当前混合系数']},
  {id:'output',label:'产生并追加输出',at:[5,0],target:'v3-output-loop',terms:['最终汇合与归一化','输出头、候选分数','概率、选择与追加']},
  {id:'history',label:'组织层与历史',at:[2,1],target:'u4',terms:['CED 因果编码器—解码器','CSA² 压缩稀疏注意力','Engram 查表记忆','KV 缓存与 SWA','压缩、量化与有界重放']},
  {id:'draft',label:'一次验证多个候选',at:[5,1],target:'u6',terms:['DSpark 草稿','批量验证与连续前缀']},
  {id:'training',label:'从反馈中学习参数',at:[1,1],target:'u7',terms:['总参数、激活参数与计算量','预训练与后训练','SFT、RL 与 OPD']},
  {id:'evaluation',label:'比较实际效果',at:[4,1],target:'u8',terms:['任务与评测口径','效率、质量与执行条件']}
 ];
 const pairs=[['input','representation'],['representation','attention'],['attention','experts'],['experts','residual'],['residual','output'],['history','attention'],['history','residual'],['output','draft'],['draft','output'],['training','representation'],['output','evaluation']];
 const active={u1:['input','output'],u2:['input','representation'],u3:['attention','experts','residual'],u4:['history','residual'],u5:['history','output'],u6:['draft','output'],u7:['training'],u8:['evaluation','output']};
 const names={u1:'一轮回答',u2:'输入表示',u3:'一层内的更新',u4:'层间协作',u5:'保存与恢复历史',u6:'提出和验证草稿',u7:'参数与训练',u8:'评测与回顾'};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mobileQuery=matchMedia('(max-width:650px)');
 function conceptRoutes(rects,mobile){
  const byId=new Map(rects.map(r=>[r.id,r])),center=r=>({x:r.x+r.w/2,y:r.y+r.h/2}),lines=[];
  for(const [from,to] of pairs){
   if((from==='output'&&to==='draft')||(from==='draft'&&to==='output'))continue;
   const a=byId.get(from),b=byId.get(to),ac=center(a),bc=center(b);let points;
   if(from==='history'&&to==='residual'){
    if(mobile)points=[{x:ac.x,y:a.y-3},{x:bc.x,y:b.y+b.h+5}];
    else{const lane=(b.y+b.h+a.y)/2;points=[{x:a.x+a.w+3,y:ac.y},{x:a.x+a.w+12,y:ac.y},{x:a.x+a.w+12,y:lane},{x:bc.x,y:lane},{x:bc.x,y:b.y+b.h+5}];}
   }else if(from==='output'&&to==='evaluation'){
    if(mobile)points=[{x:a.x+a.w+3,y:ac.y},{x:334,y:ac.y},{x:334,y:b.y-24},{x:bc.x,y:b.y-24},{x:bc.x,y:b.y-5}];
    else points=[{x:a.x+18,y:a.y+a.h+3},{x:a.x+18,y:a.y+a.h+14},{x:a.x-16,y:a.y+a.h+14},{x:a.x-16,y:bc.y},{x:b.x+b.w+5,y:bc.y}];
   }else if(mobile&&((from==='history'&&to==='attention')||(from==='training'&&to==='representation'))){
    const lane=from==='training'?8:b.y-24,x=from==='training'?5:12;
    points=[{x:a.x,y:ac.y},{x,y:ac.y},{x,y:lane},{x:b.x+18,y:lane},{x:b.x+18,y:b.y-5}];
   }else if(Math.abs(ac.y-bc.y)<1){const dir=Math.sign(bc.x-ac.x);points=[{x:ac.x+dir*(a.w/2+3),y:ac.y},{x:bc.x-dir*(b.w/2+5),y:bc.y}];}
   else{const dir=Math.sign(bc.y-ac.y);points=[{x:ac.x,y:ac.y+dir*(a.h/2+3)},{x:bc.x,y:bc.y-dir*(b.h/2+5)}];}
   const tip=points.at(-1),prev=points.at(-2),angle=Math.atan2(tip.y-prev.y,tip.x-prev.x),head=[tip,{x:tip.x-6*Math.cos(angle-.5),y:tip.y-6*Math.sin(angle-.5)},{x:tip.x-6*Math.cos(angle+.5),y:tip.y-6*Math.sin(angle+.5)}];
   lines.push({from,to,points,head,kind:['training','history','draft'].includes(from)?'shared':'data'});
  }
  return lines;
 }

 function svg(unit,mini){const mobile=mobileQuery.matches,positions={input:[0,0],representation:[1,0],attention:[1,1],experts:[0,1],residual:[0,2],output:[1,2],history:[0,3],draft:[1,3],training:[0,4],evaluation:[1,4]},width=mobile?340:1000,height=mobile?407:mini?150:220,cw=mobile?132:126,ch=mobile?42:mini?35:47,rects=concepts.map(c=>({...c,x:mobile?22+positions[c.id][0]*164:12+c.at[0]*165,y:mobile?30+positions[c.id][1]*76:c.at[1]?(mini?99:149):20,w:cw,h:ch}));const lines=conceptRoutes(rects,mobile);let html=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="模型概念总图${unit?'，当前'+names[unit]:''}">`;for(const edge of lines){if((edge.from==='output'&&edge.to==='draft')||(edge.from==='draft'&&edge.to==='output'))continue;if(edge.hidden)continue;html+=`<polyline points="${edge.points.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="#a5bdc3" stroke-width="1.5" ${edge.kind==='shared'?'stroke-dasharray="4 3"':''}/><polygon points="${edge.head.map(p=>p.x+','+p.y).join(' ')}" fill="#789aa6"/>`;}
  const output=rects.find(r=>r.id==='output'),draft=rects.find(r=>r.id==='draft'),center=output.x+output.w/2,top=output.y+output.h+3,bottom=draft.y-3;html+='<g aria-label="生成候选与追加验证结果"><path d="M '+(center-10)+' '+top+' V '+(bottom-6)+'" fill="none" stroke="#789aa6" stroke-width="1.5"/><path d="M '+(center-14)+' '+(bottom-7)+' L '+(center-10)+' '+bottom+' L '+(center-6)+' '+(bottom-7)+' Z" fill="#789aa6"/><path d="M '+(center+10)+' '+bottom+' V '+(top+6)+'" fill="none" stroke="#789aa6" stroke-width="1.5"/><path d="M '+(center+6)+' '+(top+7)+' L '+(center+10)+' '+top+' L '+(center+14)+' '+(top+7)+' Z" fill="#789aa6"/></g>';
  for(const r of rects){const on=active[unit]?.includes(r.id);html+=`<a href="#${r.target}" data-concept="${r.id}" aria-label="${esc(r.label)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="7" fill="${on?'#e3f1ee':'#fff'}" stroke="${on?'#217e79':'#cedde1'}" stroke-width="${on?2:1}"/><text x="${r.x+r.w/2}" y="${r.y+r.h/2+5}" text-anchor="middle" fill="${on?'#115852':'#476572'}" font-size="14" font-weight="${on?650:400}">${r.label}</text></a>`;}
  return html+'</svg>';
 }
 function init(){
  function renderMaps(){document.querySelectorAll('[data-v3-global-map]').forEach(host=>{host.className='v3-concept-map';host.id=host.id||'v3-global-map';host.innerHTML='<div class="v3-map-heading"><h2>把这些概念放到同一张图里</h2><p>沿箭头阅读一次生成的主线，再看历史管理、草稿、训练与评测怎样关联。</p></div>'+svg('',false)+'<details class="v3-map-terms"><summary>展开各部分涉及的概念</summary><div>'+concepts.map(c=>`<a href="#${c.target}"><b>${c.label}</b><span>${c.terms.map(esc).join(' · ')}</span></a>`).join('')+'</div></details>';});
  document.querySelectorAll('[data-v3-chapter-map]').forEach(host=>{const unit=host.dataset.v3ChapterMap;host.className='v3-chapter-map';host.innerHTML='<div><span>本章在全程中的位置</span><b>'+names[unit]+'</b><a class="v3-map-pathway-link" href="math-pathways.html">进入三维计算通路 ↗</a></div>'+(mobileQuery.matches&&unit!=='u1'?'<details class="v3-mobile-map"><summary>展开本章所在的全程图</summary>'+svg(unit,true)+'</details>':svg(unit,unit!=='u1'));});}
  renderMaps();mobileQuery.addEventListener('change',renderMaps);
  const toc=document.querySelector('.toc');if(toc){const space=document.createElement('a');space.className='v3-pathways-entry';space.href='math-pathways.html';space.innerHTML='<b>三维计算通路 ↗</b><span>从输入到输出，自动播放并逐层展开</span>';toc.append(space);const current=document.createElement('a');current.className='v3-current-map';current.href='#v3-global-map';current.innerHTML='<small>沿同一张总图阅读</small><b>查看模型全程 ↗</b>';toc.append(current);let queued=false;const update=()=>{queued=false;let unit='u1';for(const el of document.querySelectorAll('.v2-unit'))if(el.getBoundingClientRect().top<innerHeight*.45)unit=el.id;if(names[unit]){current.querySelector('b').textContent=names[unit]+' · 查看总图 ↗';current.dataset.currentUnit=unit;}};addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}}, {passive:true});update();}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
 'use strict';
 const vector=[1,.5,-.2],weights=[[1.5,1,.5],[.4,1.6,.5],[-.2,.6,.5]],labels=['睡觉','玩耍','奔跑'];
 const scores=weights.map(row=>Number(row.reduce((s,w,i)=>s+w*vector[i],0).toFixed(10))),e=scores.map(Math.exp),sum=e.reduce((a,b)=>a+b,0),prob=e.map(x=>x/sum);
 const contextText='午后，小猫趴在窗边，正在';
 const stages=[['末端表示','最后一层留下的一串数值，概括了当前已经读到的信息。'],['候选分数','输出投影把这串数值转换成各候选的分数。投影参数在训练中学得，生成时保持固定。'],['候选概率','把分数转成一组总和为 1 的概率，便于决定下一项。'],['选中一项','这个教学例子选择概率最大的“睡觉”。实际生成也可以按设定的策略抽样。'],['追加到输入','“睡觉”加入原有前文，随后以更新后的序列开始下一轮。']];
 function init(){document.querySelectorAll('[data-v3-output-loop]').forEach(root=>{root.id='v3-output-loop';root.className='v3-output-loop';let step=0;root.innerHTML='<div class="v3-output-head"><h3>一串内部数值，怎样变成下一项输出？</h3><p>沿用前文“午后，小猫趴在窗边，正在”，接着看输出端的五步变化。</p></div><div class="v3-output-controls"><button type="button" data-output-prev>上一步</button><button type="button" data-output-next>下一步</button><button type="button" data-output-reset>从头看</button><span data-output-count></span></div><div class="v3-output-route"></div><div class="v3-output-stage" aria-live="polite"></div><p class="v3-output-boundary">本例用三个候选和三维数值演示关系；真实输出头覆盖整个词表。</p>';
  function render(){root.querySelector('.v3-output-route').innerHTML=stages.map((s,i)=>`<button type="button" data-output-step="${i}" aria-current="${step===i}"><small>${i+1}</small>${s[0]}</button>`).join('');const diagram=step===0?`<div class="v3-output-vector"><span>当前位置的末端表示</span>${vector.map((v,i)=>`<b><small>分量 ${i+1}</small>${v.toFixed(1)}</b>`).join('')}</div>`:step===1?`<div class="v3-output-scores">${labels.map((label,i)=>`<div><span>${label}</span><b>${scores[i].toFixed(1)}</b><small>候选分数</small></div>`).join('')}</div>`:step===2?`<div class="v3-output-probs">${labels.map((label,i)=>`<div><span>${label}</span><i style="--prob:${prob[i]*100}%"></i><b>${(prob[i]*100).toFixed(1)}%</b></div>`).join('')}</div>`:step===3?`<div class="v3-output-selection"><span>从三个候选中选出</span><b>睡觉</b><span>本例取概率最大的一项：${(prob[0]*100).toFixed(1)}%</span></div>`:'<div class="v3-output-append"><span>原有前文（整体显示）</span><b class="v3-output-prefix">午后，小猫趴在窗边，正在</b><b class="is-new">睡觉</b><span>→ 继续下一轮</span></div>';root.querySelector('.v3-output-stage').innerHTML='<div><strong>'+stages[step][0]+'</strong><p>'+stages[step][1]+'</p></div>'+diagram;if(step===1){const grid=root.querySelector('.v3-output-scores'),wrap=document.createElement('div');wrap.className='v3-output-projection';grid.before(wrap);wrap.innerHTML='<p class="v3-output-projection-hint">同一条向量 h = [1.0, 0.5, −0.2]，分别与 W 的每一行做点积。</p>';wrap.append(grid);const details=document.createElement('details');details.innerHTML='<summary>查看固定权重 W 与点积</summary><div>'+window.DSFormulaMath.render(String.raw`\begin{bmatrix}1.5&1&0.5\\0.4&1.6&0.5\\-0.2&0.6&0.5\end{bmatrix}\begin{bmatrix}1\\0.5\\-0.2\end{bmatrix}=\begin{bmatrix}1.9\\1.1\\0\end{bmatrix}`)+'</div><p>每个候选使用 W 的一行；每一行都读取 h 的三个分量。W 在本次生成中保持固定。</p>';wrap.append(details);}root.querySelector('[data-output-prev]').disabled=step===0;root.querySelector('[data-output-next]').disabled=step===4;root.querySelector('[data-output-count]').textContent=(step+1)+' / 5';root.dataset.state=JSON.stringify({step,vector,weights,scores,probabilities:prob,selected:step>=3?'睡觉':null,contextText,outputText:contextText+(step===4?'睡觉':''),sequence:step===4?[contextText,'睡觉']:[contextText]});}
  root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;const focused=b.hasAttribute('data-output-step');if(focused)step=+b.dataset.outputStep;else if(b.hasAttribute('data-output-next'))step=Math.min(4,step+1);else if(b.hasAttribute('data-output-prev'))step=Math.max(0,step-1);else if(b.hasAttribute('data-output-reset'))step=0;render();if(focused)root.querySelector(`[data-output-step="${step}"]`).focus({preventScroll:true});});render();});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function () {
  'use strict';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const arrowSvg = (vertical) => vertical
    ? '<svg class="ap-flow-arrow" viewBox="0 0 28 36" aria-hidden="true"><line x1="14" y1="2" x2="14" y2="27"></line><path d="M9 24 L14 31 L19 24 Z"></path></svg>'
    : '<span class="ap-horizontal-arrow" aria-hidden="true"><svg viewBox="0 0 30 24"><line x1="2" y1="12" x2="23" y2="12"></line><path d="M20 7 L28 12 L20 17 Z"></path></svg></span>';

  const round = value => Math.round(value * 10) / 10;



  function shapeOf(node) {
    return node.querySelector('rect, ellipse, circle, polygon') || node;
  }



  function edgeX(box, radius, y) {
    const top = box.y + radius, bottom = box.y + box.height - radius;
    if (!radius || (y >= top && y <= bottom)) return box.x + box.width;
    const dy = y < top ? top - y : y - bottom;
    if (dy >= radius) return box.x + box.width - radius;
    return box.x + box.width - radius + Math.sqrt(radius * radius - dy * dy);
  }



  function shiftNode(overview, name, dx) {
    const node = overview.querySelector('[data-qv14-node="' + name + '"]');
    if (!node) return;
    const move = el => {
      ['x', 'cx', 'x1', 'x2'].forEach(attr => {
        const value = el.getAttribute(attr);
        if (value === null || value === '' || isNaN(parseFloat(value))) return;
        el.setAttribute(attr, String(round(parseFloat(value) + dx)));
      });
      const path = el.getAttribute('d');
      if (path) el.setAttribute('d', path.replace(/M(-?[\d.]+)/g, (all, x) => 'M' + round(parseFloat(x) + dx)));
    };
    move(node);
    node.querySelectorAll('*').forEach(move);
  }



  function fanOut(overview, sourceName, targetNames) {
    const node = name => overview.querySelector('[data-qv14-node="' + name + '"]');
    const source = node(sourceName);
    if (!source || !source.getBBox) return;
    const shape = shapeOf(source);
    const a = shape.getBBox();
    if (!a.width || !a.height) return;
    const radius = Math.min(Number(shape.getAttribute && shape.getAttribute('rx')) || 0, a.height / 2);
    const right = round(a.x + a.width);
    const rows = targetNames
      .map(name => {
        const target = node(name);
        if (!target) return null;
        const b = shapeOf(target).getBBox();
        return b.width ? { name, y: round(b.y + b.height / 2), x: round(b.x) } : null;
      })
      .filter(Boolean);
    const step = a.height / (rows.length + 1);
    rows.forEach((row, index) => {
      const line = overview.querySelector(
        '[data-qv14-from="' + sourceName + '"][data-qv14-to="' + row.name + '"]',
      );
      if (!line) return;
      const inside = row.y >= a.y + 8 && row.y <= a.y + a.height - 8;
      if (inside) {
        line.setAttribute('d', 'M' + right + ' ' + row.y + 'H' + row.x);
        return;
      }
      const exit = round(Math.min(Math.max(a.y + step * (index + 1), a.y + 1), a.y + a.height - 1));


      const elbow = round(Math.max(Math.min(right + (row.x - right) / 2, row.x - 30), right + 8));
      line.setAttribute(
        'd',
        'M' + round(edgeX(a, radius, exit)) + ' ' + exit + 'H' + elbow + 'V' + row.y + 'H' + row.x,
      );
    });
  }

  function polishOverview() {
    const overview = document.getElementById('qv15-overview');
    if (!overview || overview.dataset.apPolished) return;
    overview.dataset.apPolished = 'true';
    overview.querySelectorAll('marker').forEach(marker => {
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '5');
    });


    overview.querySelectorAll('.qv14-edge-label').forEach(label => label.remove());





    shiftNode(overview, 'WQ', -20);
    shiftNode(overview, 'WK', -20);
    shiftNode(overview, 'WV', -20);
    ['Q', 'K', 'V'].forEach(name => shiftNode(overview, name, -30));





    shiftNode(overview, 'S', 26);
    const guides = overview.querySelectorAll('.qv14-guide');
    [-20, 26].forEach((dx, index) => {
      const guide = guides[index];
      if (guide) guide.setAttribute('x', String(round(parseFloat(guide.getAttribute('x')) + dx)));
    });
    const precisePaths = {
      'WQ>Q': 'M360 106H400', 'WK>K': 'M360 316H400', 'WV>V': 'M360 526H400',
      'Q>S': 'M545 106H575M627 106H652V288H682', 'K>S': 'M545 316H575M627 316H682',
      'S>normalize': 'M856 302H888', 'normalize>A': 'M992 394V438',
      'A>AV': 'M935 512V545', 'V>AV': 'M545 526H652V585H870', 'AV>Z': 'M1000 585H1040'
    };
    overview.querySelectorAll('[data-qv14-from][data-qv14-to]').forEach(path => {
      const key = path.dataset.qv14From + '>' + path.dataset.qv14To;
      if (precisePaths[key]) path.setAttribute('d', precisePaths[key]);
    });
    const svg = overview.querySelector('svg.qv14-diagram');
    if (svg && !svg.querySelector('[data-qv14-rope]')) {
      const NS = 'http://www.w3.org/2000/svg';
      [['q', 86], ['k', 296]].forEach(([tone, top]) => {
        const group = document.createElementNS(NS, 'g');
        group.setAttribute('class', 'qv14-rope qv14-rope-' + tone);
        group.setAttribute('data-qv14-rope', tone);
        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('x', '575');
        box.setAttribute('y', String(top));
        box.setAttribute('width', '52');
        box.setAttribute('height', '40');
        box.setAttribute('rx', '11');
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', '601');
        label.setAttribute('y', String(top + 25));
        label.textContent = 'RoPE';
        group.append(box, label);
        const title = document.createElementNS(NS, 'title');
        title.textContent = tone === 'q' ? '查询 Q 按所在位置旋转' : '键 K 按所在位置旋转';
        group.prepend(title);
        svg.append(group);
      });


      const lit = new Set(['all', '2']);
      const syncRope = () => {
        const current = overview.dataset.qv15Current || 'all';
        svg.querySelectorAll('[data-qv14-rope]').forEach(pill => {
          pill.classList.toggle('qv15-muted', !lit.has(current));
        });
      };
      new MutationObserver(syncRope).observe(overview, { attributes: true, attributeFilter: ['data-qv15-current'] });
      syncRope();
    }



    fanOut(overview, 'H', ['WQ', 'WK', 'WV']);
    overview.querySelectorAll('.qv14-trunk, .qv14-junction').forEach(node => node.remove());
  }

  function replaceStageArrows() {
    document.querySelectorAll('.qv9-module > .qv9-down').forEach(connector => {
      if (connector.querySelector('.ap-flow-arrow')) return;
      connector.innerHTML = arrowSvg(true);
    });
  }





  const KV_ROW_Y = [62, 116, 170, 238];
  const KV_HEAD_NAMES = ['1', '2', '3', '64'];
  const KV_ELLIPSIS_Y = 204;
  const KV_SHARED_Y = 150;
  const KV_COLUMNS = [300, 480, 660];
  const KV_READOUT = {
    general: '<b>通用多头：</b>64 个头各有自己的 k 和 v。一个位置就要存下 64 组。',
    v41: '<b>V4.1：</b>一个位置只留一条 512 维向量，64 个头全部读它；这条向量同时充当 K 和 V。'
  };
  const KV_LABEL = {
    general: '通用多头的 K/V 结构：64 个查询头，每个头在每个位置上都有自己的一组 k 和 v。',
    v41: 'V4.1 的 K/V 结构：64 个查询头的连线汇成一条，每个位置只有一条 512 维 KV。'
  };

  function kvHeads(colors, backgrounds) {
    return KV_HEAD_NAMES.map((name, i) => ({
      name,
      y: KV_ROW_Y[i],
      color: colors[i] || '#657a87',
      background: backgrounds[i] || '#f1f5f7'
    }));
  }

  function kvDots(x, y) {
    return [y - 6, y, y + 6]
      .map(cy => '<circle cx="' + x + '" cy="' + cy + '" r="1.7" class="ap-kv-dot"></circle>')
      .join('');
  }


  function kvQueryColumn(heads) {
    return '<text x="8" y="21" class="ap-kv-side-label">查询头 Q · 64 个 × 512 维</text>' +
      heads.map(head =>
        '<g><rect x="8" y="' + (head.y - 20) + '" width="118" height="40" rx="8" fill="#fff" stroke="#d5dfe5"></rect>' +
        '<rect x="8" y="' + (head.y - 20) + '" width="4" height="40" rx="2" fill="' + head.color + '"></rect>' +
        '<text x="30" y="' + (head.y + 6) + '" class="ap-kv-head-label">头 ' + head.name + '</text></g>'
      ).join('') +
      kvDots(67, KV_ELLIPSIS_Y);
  }

  function kvColumnHeads() {
    return KV_COLUMNS.map((x, i) =>
      '<text x="' + (x + 80) + '" y="21" class="ap-kv-column-label">位置 ' + (i + 1) + '</text>'
    ).join('');
  }

  function kvArrow(x, y) {
    return '<path d="M' + x + ' ' + (y - 6) + ' L' + (x + 8) + ' ' + y + ' L' + x + ' ' + (y + 6) + ' Z" class="ap-kv-arrowhead"></path>';
  }

  function kvGeneralLayer(heads) {
    const wires = heads.map(head =>
      '<path d="M126 ' + head.y + 'H820" class="ap-kv-wire"></path>' + kvArrow(286, head.y)
    ).join('');
    const chips = heads.map(head => KV_COLUMNS.map(x =>
      '<g><rect x="' + x + '" y="' + (head.y - 19) + '" width="160" height="38" rx="7" fill="' + head.background + '" stroke="' + head.color + '"></rect>' +
      '<text x="' + (x + 80) + '" y="' + (head.y + 5) + '" class="ap-kv-chip-label">k<tspan class="ap-kv-sup" dy="-5">(' + head.name + ')</tspan><tspan dy="5">　v</tspan><tspan class="ap-kv-sup" dy="-5">(' + head.name + ')</tspan></text></g>'
    ).join('')).join('');
    const dots = KV_COLUMNS.map(x => kvDots(x + 80, KV_ELLIPSIS_Y)).join('');
    const count = KV_COLUMNS.map(x =>
      '<text x="' + (x + 80) + '" y="277" class="ap-kv-count">每个位置 64 组</text>'
    ).join('');
    return '<g class="ap-kv-layer" data-ap-kv-layer="general">' + wires + chips + dots + count + '</g>';
  }

  function kvSharedLayer(heads) {
    const wires = heads.map(head =>
      '<path d="M126 ' + head.y + 'H214V' + KV_SHARED_Y + '" class="ap-kv-wire"></path>'
    ).join('') +
      '<path d="M214 ' + KV_SHARED_Y + 'H820" class="ap-kv-wire"></path>' +
      '<circle cx="214" cy="' + KV_SHARED_Y + '" r="3.4" class="ap-kv-junction"></circle>' +
      kvArrow(286, KV_SHARED_Y);
    const chips = KV_COLUMNS.map(x =>
      '<g><path d="M' + (x + 80) + ' 30V' + (KV_SHARED_Y - 26) + '" class="ap-kv-column-guide"></path>' +
      '<rect x="' + x + '" y="' + (KV_SHARED_Y - 24) + '" width="160" height="48" rx="7" class="ap-kv-shared-chip"></rect>' +
      '<text x="' + (x + 80) + '" y="' + (KV_SHARED_Y + 6) + '" class="ap-kv-chip-label ap-kv-shared-label">KV · 512 维</text></g>'
    ).join('');
    const count = KV_COLUMNS.map(x =>
      '<text x="' + (x + 80) + '" y="277" class="ap-kv-count">每个位置 1 条</text>'
    ).join('');
    return '<g class="ap-kv-layer is-off" data-ap-kv-layer="v41">' + wires + chips + count + '</g>';
  }

  function kvShapeMarkup(colors, backgrounds) {
    const heads = kvHeads(colors, backgrounds);
    return '<h4>V4.1 的头之间，K/V 不是各算各的</h4>' +
      '<p>通用的多头注意力里，64 个查询头各自带着一组 K/V。V4.1 保留全部 64 个查询头，只把 K/V 换成一条——切换看同一张图的两个状态，左列的头一直是这 64 个。</p>' +
      '<div class="ap-kv-switch" role="group" aria-label="切换 K/V 结构">' +
        '<button type="button" data-ap-kv="general" aria-pressed="true">通用多头</button>' +
        '<button type="button" data-ap-kv="v41" aria-pressed="false">V4.1</button>' +
      '</div>' +
      '<div class="ap-kv-canvas">' +
        '<svg viewBox="0 0 840 290" role="img" data-ap-kv-figure aria-label="' + KV_LABEL.general + '">' +
          kvColumnHeads() + kvQueryColumn(heads) + kvGeneralLayer(heads) + kvSharedLayer(heads) +
        '</svg>' +
      '</div>' +
      '<p class="ap-kv-legend">左列是 64 个查询头，图中画出头 1–3 与头 64，中间的点代表其余的头；右侧只画 3 个位置。每条线表示一个头读取哪些 K/V。</p>' +
      '<p class="ap-kv-readout" data-ap-kv-readout role="status" aria-live="polite">' + KV_READOUT.general + '</p>' +
      '<ul class="ap-kv-points">' +
        '<li><b>KV 头数是 1。</b>发布配置写作 <code class="ap-kv-code">num_key_value_heads=1</code>：64 个查询头共用一条 KV。这种做法称多查询注意力（Multi-Query Attention，MQA）。</li>' +
        '<li><b>K 和 V 是同一条向量。</b>局部窗口的 KV 与压缩后的主 KV 都是这个形状，后面缓存一章说的「一条主 KV」，指的就是这样一条向量。</li>' +
        '<li><b>每头 512 维，不是 5,120 ÷ 64。</b>查询先降到 1,280 维低秩再升成 64 × 512；正因为 KV 只有一条，每个头才给得起 512 维。</li>' +
      '</ul>' +
      '<details class="ap-kv-details"><summary>V4.1 注意力还有三处与通用算例不同</summary>' +
        '<div class="ap-kv-grid">' +
          '<div><small>查询 Q 的位置信息</small><b>每头末 64 维旋转</b><span>64 × 512 维查询中，只有末 64 维使用 Rotary Position Embedding（旋转位置编码，RoPE）。</span></div>' +
          '<div><small>归一化</small><b>softmax + 每头 sink</b><span>sink 进入分母，因此分给可见位置的有效权重和可以小于 1。</span></div>' +
          '<div><small>输出</small><b>逆 RoPE 到 8 组投影，回到 5,120 维</b><span>每组读取 8 个头，经分组降维后再统一上投影。</span></div>' +
        '</div>' +
        '<nav class="ap-kv-links" aria-label="V4.1 注意力公开资料与计算图入口"><a href="math-pathways.html#node=attn.q_heads&amp;level=1&amp;group=attention">在计算图查看 Q 头</a><a href="math-pathways.html#node=attn.kv_window_projection&amp;level=1&amp;group=attention">查看共享 KV 投影</a><a href="math-pathways.html#node=attn.softmax_sink&amp;level=1&amp;group=attention">查看 attention sink</a><a href="math-pathways.html#node=attn.output_group_proj&amp;level=1&amp;group=attention">查看分组输出投影</a><a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json" target="_blank" rel="noopener noreferrer">官方发布配置</a><a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/model.py" target="_blank" rel="noopener noreferrer">官方参考实现</a></nav>' +
      '</details>';
  }

  function wireKvShape(section) {
    const shape = section.querySelector('.ap-kv-shape');
    if (!shape) return;
    const buttons = Array.from(shape.querySelectorAll('[data-ap-kv]'));
    const figure = shape.querySelector('[data-ap-kv-figure]');
    const readout = shape.querySelector('[data-ap-kv-readout]');
    const show = state => {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.apKv === state)));
      shape.querySelectorAll('[data-ap-kv-layer]').forEach(layer =>
        layer.classList.toggle('is-off', layer.dataset.apKvLayer !== state));
      figure.setAttribute('aria-label', KV_LABEL[state]);
      readout.innerHTML = KV_READOUT[state];
      shape.dataset.kvState = state;
      shape.dataset.state = JSON.stringify({
        shown: state,
        queryHeads: 64,
        keyValueHeads: state === 'v41' ? 1 : 64,
        headDimension: 512,
        keyAndValueShareOneVector: state === 'v41'
      });
    };
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => show(button.dataset.apKv));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
        show(buttons[next].dataset.apKv);
        buttons[next].focus();
      });
    });
    show('general');
  }

  function buildMultihead() {
    const section = document.querySelector('.qv10-heads');
    if (!section || section.dataset.apPolished) return;
    section.dataset.apPolished = 'true';
    section.classList.add('ap-multihead');
    const vectorValues = [[.78, .85], [.24, 1.12], [1.03, .31]];
    const vectors = vectorValues.map(vector => '[' + vector.map(value => value.toFixed(2)).join(', ') + ']');
    const names = ['头 1', '头 2', '头 3'];
    const colors = ['#667fc6', '#8a70b6', '#338f81'];
    const backgrounds = ['#eef2ff', '#f4effb', '#edf8f5'];
    const kvHost = document.getElementById('kv-shape');
    section.innerHTML = '<h4 id="qv10-heads-title">多个注意力头怎样合成一次输出？</h4>' +
      '<p>每个头都独立完成“查询 → 匹配 → 汇总”，得到自己的一条结果。三条结果并列保留，随后按头编号拼接，再经过一次输出投影。</p>' +
      '<p class="ap-parameter-note"><b>参数与当前结果分开：</b>W<sub>Q</sub>、W<sub>K</sub>、W<sub>V</sub>、W<sub>O</sub> 是训练得到且推理时固定的矩阵；注意力权重 A 与各头输出 z 会随当前输入改变。</p>' +
      '<div class="ap-heads-core">' +
      '<div class="ap-heads-flow" aria-label="各头输出、拼接与输出投影流程">' +
        '<div class="ap-flow-stage"><small>1 · 各头输出并列</small><div class="ap-head-outputs">' + names.map((name, i) =>
          '<div class="ap-head-output" data-ap-head-output="' + i + '" style="--ap-head-color:' + colors[i] + ';--ap-head-bg:' + backgrounds[i] + '"><b>z<sub>3</sub><sup>(' + (i + 1) + ')</sup></b><span>' + vectors[i] + '</span></div>'
        ).join('') + '</div></div>' + arrowSvg(false) +
        '<div class="ap-flow-stage ap-concat-vector"><small>2 · 按头编号拼接</small><strong>Concat(z<sub>3</sub><sup>(1)</sup>, z<sub>3</sub><sup>(2)</sup>, z<sub>3</sub><sup>(3)</sup>)</strong><span>拼接保留每个头的分量身份，得到一条更长的向量。</span></div>' + arrowSvg(false) +
        '<div class="ap-flow-stage ap-output-projection"><small>3 · 输出投影</small><span class="ap-fixed-parameter">W<sub>O</sub>：训练得到，推理时固定</span><p class="ap-heads-equation">O = Concat(z<sub>3</sub><sup>(1)</sup>, z<sub>3</sub><sup>(2)</sup>, z<sub>3</sub><sup>(3)</sup>) × W<sub>O</sub></p><span>把拼接结果混合回这一层需要的输出维度。</span></div>' +
      '</div></div>' +
      '<p class="qv9-caption">这里继续追踪位置 3，用三条二维教学向量说明合并关系；下标 3 是位置，上标 (1)、(2)、(3) 是头编号。头之间还可以共享同一条 K/V，这与后文的跨层缓存共享是两种不同的共享关系；V4.1 的做法见下面一节。</p>' +
      '';

    if (kvHost) {
      section.append(kvHost);
      kvHost.className = 'ap-kv-shape';
      kvHost.innerHTML = kvShapeMarkup(colors, backgrounds);
    }


    section.dataset.state = JSON.stringify({ trackedPosition: 3, headOutputs: vectorValues, concatenationOrder: [1, 2, 3], outputProjection: { parameter: 'W_O', learnedDuringTraining: true, fixedDuringInference: true }, teachingDimensions: 2 });
    wireKvShape(section);
  }

  ready(() => { polishOverview(); replaceStageArrows(); buildMultihead(); });
}());

(function(){
 'use strict';
 function setupConnection(root){
  if(!root||root.dataset.mhcV3Polished)return;
  root.dataset.mhcV3Polished='true';
  root.classList.add('mhc-v3-connection');
  const lab=root.querySelector('[data-lm17-lab]');
  if(!lab)return;
  const caption=lab.querySelector('figcaption');
  if(caption){
   const title=caption.querySelector('strong'),note=caption.querySelector('span');
   if(title)title.textContent='沿着一个 V4.1 子模块，看三组系数分别在何时使用';
   if(note)note.textContent='A 把四路送入计算；B 保留并交换旧状态；C 把新结果加入四路。';
  }
  const layout=lab.querySelector('.lm17-mhc-layout');
  if(layout&&!lab.querySelector('.mhc-v3-sequence')){
   const sequence=document.createElement('div');
   sequence.className='mhc-v3-sequence';
   sequence.setAttribute('aria-label','Single-Pass mHC 中 A、B、C 的使用顺序');
   sequence.innerHTML='<span><small>进入本块前</small><b>A<sub>ℓ−1</sub> 已经算好</b><em>现在用它组合四路输入</em></span><i aria-hidden="true">→</i><span><small>本块读取 X<sub>ℓ</sub></small><b>算出 A<sub>ℓ</sub>、B<sub>ℓ</sub>、C<sub>ℓ</sub></b><em>B、C 用于本块；A 交给下一块</em></span><i aria-hidden="true">→</i><span><small>本块完成</small><b>保留旧状态 + 加入新结果</b><em>输出仍是四路</em></span><p>主干第一块没有前一块，起始 A 为 [1, 0, 0, 0]；后续块才沿用这条传递关系。</p>';
   layout.before(sequence);
  }
  const buttons=lab.querySelectorAll('[data-lm17-mode-button]');
  buttons.forEach(button=>{
   if(button.dataset.lm17ModeButton==='original')button.innerHTML='<small>原 mHC</small>使用本块 A<sub>ℓ</sub>';
   if(button.dataset.lm17ModeButton==='single')button.innerHTML='<small>V4.1 Single-Pass</small>使用前一块 A<sub>ℓ−1</sub>';
  });
  const single=lab.querySelector('[data-lm17-mode-button="single"]');
  if(single&&single.getAttribute('aria-pressed')!=='true')single.click();
 }
 function setupCoefficients(panel){
  if(!panel||panel.dataset.mhcV3Polished)return;
  panel.dataset.mhcV3Polished='true';
  panel.classList.add('mhc-v3-coeff');
  panel.innerHTML='<header class="mhc-v3-coeff-heading"><span>真实模型 · 系数从哪里来</span><h4>同一套投影参数，为什么会得到不同的 A、B、C？</h4><p>参数在训练中学会怎样读四路状态。推理时参数保持固定；每个 token 的四路状态不同，所以本次算出的 A、B、C 也不同。</p></header>'+
   '<div class="mhc-v3-phase" role="group" aria-label="查看训练和推理时参数是否变化"><button type="button" data-mhc-phase="inference" aria-pressed="true">推理时</button><button type="button" data-mhc-phase="training" aria-pressed="false">训练时</button><p data-mhc-phase-note><b>W<sub>mix</sub> 保持固定。</b>当前四路 X 经过它，产生这个 token 的 A、C、B。</p></div>'+
   '<div class="mhc-v3-source-grid">'+
    '<article class="mhc-v3-live"><header><span>当前计算的数据</span><b>四路状态 X<sub>ℓ</sub></b></header><div class="mhc-v3-streams"><i>路 1<small>5,120 个数</small></i><i>路 2<small>5,120 个数</small></i><i>路 3<small>5,120 个数</small></i><i>路 4<small>5,120 个数</small></i></div><strong>拼接并按整体 RMS 缩放</strong><p>4 × 5,120 = <b>20,480</b> 个输入数。token 或网络位置变化时，这条数据随之变化。</p></article>'+
    '<div class="mhc-v3-meet" aria-hidden="true"><span>共同参与<br>一次线性投影</span></div>'+
    '<article class="mhc-v3-fixed"><header><span>模型参数</span><b>W<sub>mix</sub></b></header><div class="mhc-v3-weight"><b>24 行</b><i>×</i><b>20,480 列</b></div><strong>训练得到 · 推理时固定</strong><p>注意力块和 MoE 块各有一套 W，另有 3 个缩放值和 24 个偏置值。</p></article>'+
   '</div>'+
   '<div class="mhc-v3-projection"><span>固定 W<sub>mix</sub><small>24 × 20,480</small></span><i aria-hidden="true">×</i><span>当前列向量 x<small>20,480 × 1</small></span><i aria-hidden="true">→</i><strong>24 个本次原始值</strong></div>'+
   '<div class="mhc-v3-split" aria-label="24 个原始值分成 A、C、B 三组"><article><header><b>A · 4 个</b><small>输入混合</small></header><div class="mhc-v3-mini-row"><i></i><i></i><i></i><i></i></div><p>sigmoid(·) + ε<sub>hc</sub></p><strong>交给下一个块</strong></article><article><header><b>C · 4 个</b><small>加入新结果</small></header><div class="mhc-v3-mini-row"><i></i><i></i><i></i><i></i></div><p>2 × sigmoid(·)</p><strong>用于当前块</strong></article><article><header><b>B · 16 个</b><small>混合旧状态</small></header><div class="mhc-v3-mini-square">'+Array.from({length:16},()=>'<i></i>').join('')+'</div><p>行 softmax + ε<sub>hc</sub>，再做 20 次 Sinkhorn</p><strong>用于当前块</strong></article></div>'+
   '<details class="mhc-v3-implementation"><summary>展开：代码名称、完整尺寸与约束顺序</summary><div><p>图中的 W<sub>mix</sub> 是便于阅读的总称；公开 <code>model.py</code> 中，注意力与 MoE 分别使用 <code>hc_attn_fn</code> 和 <code>hc_ffn_fn</code>。配置给出 <code>hc_mult = 4</code>、<code>dim = 5120</code>，因此输入宽度 <code>hc_dim = 4 × 5120 = 20480</code>；输出宽度 <code>mix_hc = (2 + 4) × 4 = 24</code>，权重形状正是 24 × 20,480。</p><p>内核按 <b>4 个 A → 4 个 C → 16 个 B</b> 拆分 24 个值。A 使用 <code>sigmoid(scale × value + bias) + hc_eps</code>；C 使用 <code>2 × sigmoid(scale × value + bias)</code>；B 先经行 softmax、加入 <code>hc_eps</code>，再交替做行列归一化 20 次。用于整体 RMS 缩放的是独立的 <code>norm_eps</code>。</p><p>Single-Pass 只改变 A 的使用时点：本块使用前一块给出的 A；本块新算的 A 留给下一块。B、C 仍直接用于本块。</p><p><a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/model.py#L935" target="_blank" rel="noopener">查看 model.py 中的参数尺寸</a>　<a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/kernel.py#L406" target="_blank" rel="noopener">查看 kernel.py 中的约束顺序</a></p></div></details>';
  const note=panel.querySelector('[data-mhc-phase-note]');
  panel.querySelectorAll('[data-mhc-phase]').forEach(button=>button.addEventListener('click',()=>{
   const phase=button.dataset.mhcPhase;
   panel.dataset.phase=phase;
   panel.querySelectorAll('[data-mhc-phase]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
   note.innerHTML=phase==='inference'?'<b>W<sub>mix</sub> 保持固定。</b>当前四路 X 经过它，产生这个 token 的 A、C、B。':'<b>W<sub>mix</sub> 会随训练步骤更新。</b>在一次前向计算里，它仍读取当前 X 并产生本次 A、C、B；梯度随后用于调整参数。';
  }));
  panel.dataset.phase='inference';
 }
 function init(){
  setupConnection(document.getElementById('single-pass-mhc'));
  document.querySelectorAll('#single-pass-mhc .mh26-coeff, .mh26-coeff').forEach(setupCoefficients);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
'use strict';let serial=0,frame=0,lastCard=null;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function stop(){serial++;cancelAnimationFrame(frame);frame=0;}
function resolve(hash){if(!hash||hash.includes('='))return null;try{return document.getElementById(decodeURIComponent(hash.slice(1)));}catch{return null;}}
async function go(hash,{focus=true,animate=true,push=false}={}){
 let el=resolve(hash);if(!el)return;stop();const turn=serial;
 if(hash==='#visual-atlas'&&lastCard?.isConnected&&!lastCard.hidden){el=lastCard;const toc=document.querySelector('.mobile-toc');if(toc)toc.open=false;}
 if(hash==='#chapter-directory'&&el.tagName==='DETAILS')el.open=true;
 for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
 if(push&&location.hash!==hash)history.pushState({tutorialNavigation:true},'',hash);
 await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(turn!==serial)return;
 const style=getComputedStyle(el),padding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0,margin=parseFloat(style.scrollMarginTop)||0;
 const from=scrollY,top=el.getBoundingClientRect().top+from,center=el===lastCard&&hash==='#visual-atlas';
 const to=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,center?top-(innerHeight-el.getBoundingClientRect().height)/2:top-padding-margin)),distance=to-from;
 document.body.dataset.navigationTarget=el.id||el.dataset.atlasKey||hash;
 function finish(){if(turn!==serial)return;if(focus){ const target=el.matches('.v3-compat-anchor,.v2-legacy-anchor')&&el.nextElementSibling||el;if(!target.matches('a[href],button,input,select,textarea,summary,[tabindex]'))target.tabIndex=-1;target.classList.add('v3-nav-focus');target.focus({preventScroll:true});}document.body.dataset.navigationSettled='true';}
 document.body.dataset.navigationSettled='false';
 if(!animate||reduced.matches||Math.abs(distance)>innerHeight*1.4){scrollTo({top:to,behavior:'instant'});finish();return;}
 const start=performance.now(),duration=Math.min(320,180+Math.abs(distance)*.12);
 function tick(now){if(turn!==serial)return;const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);scrollTo({top:from+distance*ease,behavior:'instant'});if(t<1)frame=requestAnimationFrame(tick);else finish();}
 frame=requestAnimationFrame(tick);
}
window.DSNavigation={go,stop};




(function(){
 const selector='a[href^="math-pathways.html"]';
 function mark(root){
  if(!root||root.nodeType!==1)return;
  if(root.matches?.(selector))open(root);
  root.querySelectorAll?.(selector).forEach(open);
 }
 function open(link){
  if(link.target==='_blank')return;
  link.target='_blank';
  link.rel=link.rel?link.rel+' noopener':'noopener';
 }
 function init(){
  mark(document.body);
  new MutationObserver(records=>{
   for(const record of records)for(const node of record.addedNodes)mark(node);
  }).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
document.addEventListener('click',event=>{
 const a=event.target.closest('a[href]');if(!a||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||a.hasAttribute('download')||a.target==='_blank')return;
 let url;try{url=new URL(a.getAttribute('href'),location.href);}catch{return;}if(url.pathname!==location.pathname||url.search!==location.search||!resolve(url.hash))return;
 event.preventDefault();event.stopImmediatePropagation();if(a.matches('.atlas34-item'))lastCard=a;
 const dialog=a.closest('dialog');if(dialog?.open)dialog.close();go(url.hash,{push:true});
},true);
addEventListener('wheel',stop,{passive:true});addEventListener('touchstart',stop,{passive:true});addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))stop();});
addEventListener('hashchange',()=>go(location.hash,{animate:false,focus:false}));
addEventListener('popstate',()=>go(location.hash,{animate:false,focus:false}));
function init(){if(resolve(location.hash))go(location.hash,{animate:false,focus:false});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function () {
  'use strict';



  var ICON =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" ' +
    'stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M10.3 13.7a4.9 4.9 0 0 0 7 0l3.1-3.1a4.9 4.9 0 1 0-7-7L11.9 5.1"/>' +
    '<path d="M13.7 10.3a4.9 4.9 0 0 0-7 0l-3.1 3.1a4.9 4.9 0 1 0 7 7l1.5-1.5"/></svg>'

  function linkFor(id) {
    return location.href.split('#')[0] + '#' + id;
  }


  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); },
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.append(box);
    box.select();
    var done = false;
    try { done = document.execCommand('copy'); } catch (error) { done = false; }
    box.remove();
    return done;
  }



  var TITLE_TAGS = /^(H[1-6]|B|STRONG|SPAN)$/;
  function titleLine(node) {
    var first = node.firstElementChild;


    if (node.tagName === 'P') return node;
    if (!first || node.children.length < 2) return node;
    if (!TITLE_TAGS.test(first.tagName)) return node;
    if (first.textContent.trim().length > 60) return node;
    return first;
  }


  var HEADINGS = 'h2, h3, h4, figcaption, caption, summary';
  function place(section) {
    if (/^H[1-6]$/.test(section.tagName)) return { node: section, mode: 'in' };
    var direct = section.querySelector(
      ':scope > h2, :scope > h3, :scope > h4, :scope > header > h2, :scope > header > h3, :scope > header > h4, :scope > figcaption, :scope > caption, :scope > summary',
    );
    if (direct) return { node: titleLine(direct), mode: 'in' };
    var deep = section.querySelector(HEADINGS);
    if (deep) return { node: titleLine(deep), mode: 'in' };




    var steps = 0;
    for (var previous = section.previousElementSibling; previous && steps < 3; previous = previous.previousElementSibling) {
      if (previous.classList && previous.classList.contains('hl-copy')) continue;
      steps += 1;
      var lead = titleLine(previous);
      if (lead !== previous && !lead.querySelector('.hl-copy')) return { node: lead, mode: 'in' };
      var heading = /^H[1-6]$/.test(previous.tagName)
        ? previous
        : previous.querySelector && previous.querySelector('h2, h3, h4, h5, h6');

      if (heading && !heading.querySelector('.hl-copy')) return { node: heading, mode: 'in' };
    }

    var holder = section.closest('details');
    var summary = holder && holder.querySelector(':scope > summary');
    if (summary && !summary.querySelector('.hl-copy')) return { node: titleLine(summary), mode: 'in' };
    return { node: section, mode: 'before' };
  }

  function attach(section, id) {
    if (document.querySelector('.hl-copy[data-hl-target="' + id + '"]')) return;
    var spot = place(section);
    if (spot.mode === 'in' && spot.node.querySelector('.hl-copy')) return;
    var name = (spot.mode === 'in' ? spot.node : section).textContent.trim().slice(0, 40);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'hl-copy' + (spot.mode === 'before' ? ' hl-copy-loose' : '');
    button.dataset.hlTarget = id;
    button.setAttribute('aria-label', '复制本节链接' + (name ? '：' + name : ''));
    button.title = '复制本节链接';
    button.innerHTML = ICON;

    if (spot.mode === 'in') spot.node.append(button);
    else spot.node.before(button);
  }



  function announcer() {
    var node = document.getElementById('hl-copy-live');
    if (node) return node;
    node = document.createElement('p');
    node.id = 'hl-copy-live';
    node.className = 'hl-copy-live';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    document.body.append(node);
    return node;
  }

  function flash(button, text, ok) {
    button.dataset.hlDone = ok ? 'true' : 'false';
    button.dataset.hlNote = text;
    announcer().textContent = text;
    clearTimeout(button.hlTimer);
    button.hlTimer = setTimeout(function () {
      delete button.dataset.hlDone;
      delete button.dataset.hlNote;
      announcer().textContent = '';
    }, 1600);
  }

  function init() {
    var seen = Object.create(null);

    document
      .querySelectorAll('.toc a[href^="#"], .mobile-toc a[href^="#"], .atlas34-item[href^="#"]')
      .forEach(function (link) {
        var id = link.getAttribute('href').slice(1);
        if (!id || seen[id]) return;
        seen[id] = true;
        var section = document.getElementById(id);
        if (section) attach(section, id);
      });
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('.hl-copy');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      var url = linkFor(button.dataset.hlTarget);
      copy(url).then(function (ok) {
        if (ok) {

          if (history.replaceState) history.replaceState(null, '', '#' + button.dataset.hlTarget);
          flash(button, '已复制链接', true);
        } else {
          flash(button, '复制失败，请手动复制地址栏', false);
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

(function () {
  'use strict';


  var groups = [].slice.call(document.querySelectorAll('.toc [data-toc-sections]'));
  if (!groups.length) return;
  var links = [].slice.call(document.querySelectorAll('.toc [data-toc-section]'));
  var queued = false;

  function update() {
    queued = false;
    var line = innerHeight * 0.32;
    var unit = '';
    [].forEach.call(document.querySelectorAll('.v2-unit'), function (el) {
      if (el.getBoundingClientRect().top < line) unit = el.id;
    });
    var current = '';
    links.forEach(function (link) {
      var target = document.getElementById(link.dataset.tocSection);


      if (!target || link.closest('[data-toc-sections]').dataset.tocSections !== unit) return;
      if (target.getBoundingClientRect().top < line) current = link.dataset.tocSection;
    });
    groups.forEach(function (group) {
      group.dataset.open = String(group.dataset.tocSections === unit);
    });
    links.forEach(function (link) {
      if (link.dataset.tocSection === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  addEventListener(
    'scroll',
    function () {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  addEventListener('resize', update);
  update();
})();

(function () {
  'use strict';


  var items = [].slice.call(document.querySelectorAll('[data-quiz-item]'));
  if (!items.length) return;

  items.forEach(function (item) {
    var choices = [].slice.call(item.querySelectorAll('[data-quiz-choice]'));
    var note = item.querySelector('[data-quiz-note]');
    if (!choices.length || !note) return;
    note.setAttribute('aria-live', 'polite');

    choices.forEach(function (button) {
      button.addEventListener('click', function () {
        if (item.dataset.quizItem === 'done') return;
        var right = button.hasAttribute('data-quiz-correct');
        item.dataset.quizItem = 'done';
        item.dataset.quizResult = right ? 'right' : 'wrong';
        choices.forEach(function (other) {

          if (other.hasAttribute('data-quiz-correct')) other.dataset.quizState = 'correct';
          else if (other === button) other.dataset.quizState = 'chosen';
          other.setAttribute('aria-pressed', String(other === button));
        });
        note.hidden = false;
      });
    });
  });
})();
