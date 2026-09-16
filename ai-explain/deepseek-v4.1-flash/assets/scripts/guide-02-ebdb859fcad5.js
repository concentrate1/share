(function () {
  'use strict';
  class Scene {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.home = { yaw: options.yaw ?? .65, pitch: options.pitch ?? .45 };
      this.camera = { ...this.home };
      this.span = options.span || 6;
      this.center = options.center || [0, 0, 0];
      this.render = () => {};
      this.shapes = [];
      this.labels = [];
      this.hits = [];
      let pointer;
      canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, initialX: event.clientX, initialY: event.clientY, touch: event.pointerType === 'touch', distance: 0 };
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
        pointer.distance = Math.max(pointer.distance, Math.hypot(event.clientX - pointer.initialX, event.clientY - pointer.initialY));
        if (pointer.distance > 5) {
          this.camera.yaw += dx * .009;
          if (!pointer.touch) this.camera.pitch = Math.max(-1.15, Math.min(1.15, this.camera.pitch + dy * .009));
          this.render();
        }
        pointer.x = event.clientX; pointer.y = event.clientY;
      });
      canvas.addEventListener('pointerup', event => {
        if (pointer && pointer.id === event.pointerId && pointer.distance <= 5 && options.select) {
          const rect = canvas.getBoundingClientRect();
          const hit = this.hits.findLast(hit => this.contains(hit.points, event.clientX - rect.left, event.clientY - rect.top));
          if (hit) options.select(hit.data);
        }
        pointer = null;
      });
      for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { pointer = null; });
      canvas.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') this.camera = { ...this.home };
        if (event.key === 'ArrowLeft') this.camera.yaw -= .13;
        if (event.key === 'ArrowRight') this.camera.yaw += .13;
        if (event.key === 'ArrowUp') this.camera.pitch = Math.max(-1.15, this.camera.pitch - .13);
        if (event.key === 'ArrowDown') this.camera.pitch = Math.min(1.15, this.camera.pitch + .13);
        this.render();
      });
      new ResizeObserver(() => { this.resize(); this.render(); }).observe(canvas);
      this.resize();
    }
    reset() { this.camera = { ...this.home }; this.render(); }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width; this.height = rect.height;
      this.ratio = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(rect.width * this.ratio);
      this.canvas.height = Math.round(rect.height * this.ratio);
    }
    project(point) {
      const [x, y, z] = point.map((x, i) => x - this.center[i]);
      const rx = Math.cos(this.camera.yaw) * x + Math.sin(this.camera.yaw) * z;
      const rz = -Math.sin(this.camera.yaw) * x + Math.cos(this.camera.yaw) * z;
      const ry = Math.cos(this.camera.pitch) * y - Math.sin(this.camera.pitch) * rz;
      const unit = Math.min((this.width - 60) / this.span, (this.height - 54) / this.span);
      return { x: this.width / 2 + rx * unit, y: this.height * .53 - ry * unit, z: Math.sin(this.camera.pitch) * y + Math.cos(this.camera.pitch) * rz };
    }
    start() { this.shapes = []; this.labels = []; this.hits = []; }
    polygon(points, fill, stroke = '#d5dfe3', data) {
      const projected = points.map(p => this.project(p));
      this.shapes.push({ type: 'polygon', points: projected, fill, stroke, data, depth: projected.reduce((s, p) => s + p.z, 0) / points.length });
    }
    cube(center, size, color, selected = false, data) {
      const [x, y, z] = center, d = size / 2;
      const p = [[x-d,y-d,z-d],[x+d,y-d,z-d],[x+d,y+d,z-d],[x-d,y+d,z-d],[x-d,y-d,z+d],[x+d,y-d,z+d],[x+d,y+d,z+d],[x-d,y+d,z+d]];
      [[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[0,1,5,4],[3,2,6,7]].forEach((face,index) => {
        const factor = [.94,.98,.95,.91,.9,1][index];
        const shade = '#' + color.slice(1).match(/../g).map(part => Math.round(parseInt(part,16)*factor).toString(16).padStart(2,'0')).join('');
        this.polygon(face.map(i => p[i]), shade, selected ? '#294a60' : '#ffffff', data);
      });
    }
    line(a, b, color = '#c3cfd5', thickness = 1, dashed = false, arrow = false) {
      const from = this.project(a), to = this.project(b);
      this.shapes.push({ type: 'line', from, to, color, thickness, dashed, arrow, depth: (from.z + to.z) / 2 });
    }
    arrow(a, b, color, label, thickness = 3) { this.line(a, b, color, thickness, false, true); if (label) this.label(b, label, color, true); }
    label(point, text, color = '#647581', strong = false) { this.labels.push({ point: this.project(point), text, color, strong }); }
    axes(length = 2.4, names = ['第 1 分量', '第 2 分量', '第 3 分量']) {
      for(let i=-3;i<=3;i++) {
        this.line([i*.5,0,-1.5],[i*.5,0,1.5],'#e9eef0');
        this.line([-1.5,0,i*.5],[1.5,0,i*.5],'#e9eef0');
      }
      for (let i = 0; i < 3; i++) {
        const a = [0, 0, 0], b = [0, 0, 0]; a[i] = -length * .65; b[i] = length;
        this.line(a, b, '#b9c6cd', 1, false, true); this.label(b, names[i]);
      }
      this.label([0, 0, 0], '0');
    }
    finish() {
      const ctx = this.ctx; if (!ctx) return;
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, this.width, this.height);
      const ordered = this.shapes.sort((a, b) => a.depth - b.depth);
      for (const s of ordered) {
        ctx.save(); ctx.lineJoin = 'round';
        if (s.type === 'polygon') {
          ctx.beginPath(); s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
          ctx.fillStyle = s.fill; ctx.fill(); ctx.strokeStyle = s.stroke; ctx.lineWidth = .8; ctx.stroke();
          if (s.data !== undefined) this.hits.push({ points: s.points, data: s.data });
        } else {
          const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y;
          ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.thickness; ctx.lineCap = 'round';
          ctx.setLineDash(s.dashed ? [4, 4] : []); ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke();
          if (s.arrow && Math.hypot(dx, dy) > 3) {
            const angle = Math.atan2(dy, dx), tip = Math.min(9, Math.hypot(dx, dy) * .35);
            ctx.beginPath(); ctx.moveTo(s.to.x, s.to.y); ctx.lineTo(s.to.x - tip * Math.cos(angle - .42), s.to.y - tip * Math.sin(angle - .42)); ctx.lineTo(s.to.x - tip * Math.cos(angle + .42), s.to.y - tip * Math.sin(angle + .42)); ctx.closePath(); ctx.fill();
          }
        }
        ctx.restore();
      }
      const placed = [];
      this.labels.sort((a, b) => Number(b.strong) - Number(a.strong)).forEach(label => {
        ctx.font = (label.strong ? '600 15px' : '12px') + ' system-ui, "Microsoft YaHei", sans-serif';
        const w = ctx.measureText(label.text).width + 10, h = 23;
        let box;
        for (const [dx, dy] of [[8,-24],[8,6],[-w-8,-24],[-w-8,6],[8,-48],[-w/2,30]]) {
          box = { x: Math.max(4, Math.min(this.width-w-4,label.point.x+dx)), y: Math.max(3,Math.min(this.height-h-3,label.point.y+dy)), w, h };
          if (!placed.some(p => box.x < p.x+p.w+2 && box.x+w+2 > p.x && box.y < p.y+p.h+2 && box.y+h+2 > p.y)) break;
        }
        placed.push(box); ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = label.color; ctx.fillText(label.text, box.x+5, box.y+16);
      });
      this.canvas.dataset.camera = JSON.stringify(this.camera);
    }
    contains(points, x, y) {
      let inside = false;
      for (let i=0,j=points.length-1;i<points.length;j=i++) {
        const a=points[i],b=points[j];
        if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
      }
      return inside;
    }
  }
  window.Guide3D = { Scene };
  document.addEventListener('click', event => {
    const link = event.target.closest('#three-d-experiments a[href^="#"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault(); history.pushState(null, '', link.hash);
    target.tabIndex = -1; target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
})();

(function () {
  'use strict';
  function init() {
    const root = document.getElementById('attention-3d');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const $ = selector => root.querySelector(selector);
    const canvas = $('[data-a3d-canvas]');
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const keys = [[1.7, .25, .6], [-.4, 1.6, .7], [.1, -.6, 1.8]];
    const values = [[1.4, .2, -.5], [-.5, 1.5, .5], [.2, -.6, 1.8]];
    const words = ['小猫', '正在', '睡觉'];
    const colors = ['#007972', '#7953ce', '#93611a'];
    const subs = ['₁', '₂', '₃'];
    const origin = [0, 0, 0];
    const defaults = { azimuth: 25, elevation: 20, length: 1.8 };
    let controls = { ...defaults }, mode = 'match', progress = 0, playing = false, played = false;
    let camera = { yaw: .65, pitch: .42 }, pointer = null, animation = 0, lastTime = 0;
    let query, scores, weights, output, contributions, previousWeights = null, targetPreset = null;
    let width = 0, height = 0, sceneScale = 1;
    const sum = (a, b) => a.map((x, i) => x + b[i]);
    const scale = (v, n) => v.map(x => x * n);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const number = (n, digits = 2) => (Math.abs(n) < .5 * Math.pow(10, -digits) ? 0 : n).toFixed(digits);
    const vector = (v, digits = 2) => '[' + v.map(x => number(x, digits)).join(', ') + ']';

    $('[data-a3d-rows]').innerHTML = words.map((word, i) =>
      '<div class="a3d-table-row" role="row" data-a3d-row="' + i + '" style="--position-color:' + colors[i] + '">' +
      '<div role="cell"><b style="color:' + colors[i] + '">' + (i + 1) + ' · ' + word + '</b><small data-a3d-vector="' + i + '"></small></div>' +
      '<div role="cell" data-a3d-score="' + i + '"></div>' +
      '<div role="cell"><span data-a3d-weight="' + i + '"></span><span class="a3d-weight-track" aria-hidden="true"><i data-a3d-bar="' + i + '"></i></span></div></div>'
    ).join('');

    function calculate() {
      previousWeights = weights ? weights.slice() : null;
      const a = controls.azimuth * Math.PI / 180, e = controls.elevation * Math.PI / 180;
      query = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)].map(x => x * controls.length);
      scores = keys.map(k => k.reduce((total, x, i) => total + x * query[i], 0) / Math.sqrt(3));
      const largest = Math.max(...scores), exp = scores.map(x => Math.exp(x - largest));
      const total = exp.reduce((a, b) => a + b, 0);
      weights = exp.map(x => x / total);
      contributions = values.map((v, i) => scale(v, weights[i]));
      output = contributions.reduce(sum, origin);
      root.dataset.state = JSON.stringify({ kind: 'standard-attention-three-dimensional-teaching-example', query, keys, values, scores, weights, output, targetPreset, realLatentData: false });
    }

    function updateReadout() {
      $('[data-a3d-query]').textContent = vector(query);
      $('[data-a3d-output]').textContent = vector(output, 3);
      words.forEach((_, i) => {
        $('[data-a3d-vector="' + i + '"]').textContent = (mode === 'match' ? 'k' : 'v') + subs[i] + ' = ' + vector((mode === 'match' ? keys : values)[i]);
        $('[data-a3d-score="' + i + '"]').textContent = number(scores[i], 3);
        $('[data-a3d-weight="' + i + '"]').textContent = number(weights[i] * 100, 1) + '%';
        $('[data-a3d-bar="' + i + '"]').style.width = (weights[i] * 100) + '%';
      });
      Object.keys(controls).forEach(key => {
        $('[data-a3d-input="' + key + '"]').value = controls[key];
        $('[data-a3d-' + key + '-value]').textContent = key === 'length' ? number(controls[key]) : number(controls[key], 1) + '°';
      });
      const lead = weights.indexOf(Math.max(...weights));
      const changes = previousWeights ? weights.map((weight, i) => weight - previousWeights[i]) : [0, 0, 0];
      const rise = changes.indexOf(Math.max(...changes));
      const meaningfulRise = changes[rise] > .0005;
      $('[data-a3d-insight]').textContent = controls.length === 0
        ? 'Q 的长度为 0：三个分数都是 0，三个位置各得到 33.3%。'
        : meaningfulRise
          ? '「' + words[rise] + '」的权重增加 ' + number(changes[rise] * 100, 1) + ' 个百分点；当前最高是「' + words[lead] + '」' + number(weights[lead] * 100, 1) + '%。'
          : '当前「' + words[lead] + '」权重最高，为 ' + number(weights[lead] * 100, 1) + '%；继续改变 Q，比较三条权重。';
      words.forEach((_, i) => {
        const row = $('[data-a3d-row="' + i + '"]');
        row.classList.toggle('is-leading', i === lead);
        row.classList.toggle('is-rising', meaningfulRise && i === rise);
      });
      root.querySelectorAll('[data-a3d-preset]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.a3dPreset) === targetPreset)));
      canvas.setAttribute('aria-label', (mode === 'match' ? 'Q/K 匹配' : 'V 加权汇总') + '三维图。q=' + vector(query) + '；权重=' + weights.map(x => number(x, 3)).join('、') + '；z=' + vector(output, 3) + '。拖动或方向键旋转，Home 恢复视角。');
    }

    function project(v) {
      const x = Math.cos(camera.yaw) * v[0] + Math.sin(camera.yaw) * v[2];
      const z = -Math.sin(camera.yaw) * v[0] + Math.cos(camera.yaw) * v[2];
      const y = Math.cos(camera.pitch) * v[1] - Math.sin(camera.pitch) * z;
      return { x: width * .49 + x * sceneScale, y: height * .53 - y * sceneScale, depth: Math.sin(camera.pitch) * v[1] + Math.cos(camera.pitch) * z };
    }

    function line(a, b, color, thickness = 1, dash = [], alpha = 1, arrow = false) {
      const p = project(a), q = project(b), dx = q.x - p.x, dy = q.y - p.y;
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.lineWidth = thickness; ctx.setLineDash(dash); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      const length = Math.hypot(dx, dy);
      if (arrow && length > 2) {
        const angle = Math.atan2(dy, dx), tip = Math.min(length * .34, thickness > 2 ? 7.5 : 5.5);
        ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x - tip * Math.cos(angle - .4), q.y - tip * Math.sin(angle - .4));
        ctx.lineTo(q.x - tip * Math.cos(angle + .4), q.y - tip * Math.sin(angle + .4));
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    function draw() {
      if (!ctx || !width || !query) return;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      const span = mode === 'match' ? 5.5 : 3.8;
      sceneScale = Math.min((width - 68) / span, (height - 46) / span);
      for (let i = -4; i <= 4; i++) {
        line([i * .6, 0, -2.4], [i * .6, 0, 2.4], '#e7ecee');
        line([-2.4, 0, i * .6], [2.4, 0, i * .6], '#e7ecee');
      }
      const labels = [];
      const label = (point, text, color, priority = 0) => labels.push({ point, text, color, priority });
      const axis = mode === 'match' ? 2.7 : 1.65;
      [[axis, 0, 0], [0, axis, 0], [0, 0, axis]].forEach((v, i) => {
        line(scale(v, -.85), v, '#b6c2c9', 1.1, [], 1, true);
        label(v, '第 ' + (i + 1) + ' 分量', '#647581', -1);
        const unit = v.map(x => x / axis); const mark = project(unit);
        ctx.fillStyle = '#7d8c96'; ctx.font = '11px system-ui'; ctx.fillText('1', mark.x + 4, mark.y + 12);
      });
      const arrows = [];
      const addArrow = (a, b, color, name, thickness = 2, dash = [], alpha = 1) => {
        arrows.push({ a, b, color, thickness, dash, alpha, depth: (project(a).depth + project(b).depth) / 2 });
        if (name) label(b, name, color, 1);
      };
      if (mode === 'match') {
        keys.forEach((v, i) => addArrow(origin, v, colors[i], 'k' + subs[i]));
        addArrow(origin, query, '#315cf4', controls.length === 0 ? 'q = [0, 0, 0]' : 'q', 3.4);
      } else {
        values.forEach((v, i) => addArrow(origin, v, colors[i], '', 1.4, [4, 4], .3));
        const shrink = clamp(progress, 0, 1);
        contributions.forEach((v, i) => {
          const visible = scale(values[i], (1 - shrink) + shrink * weights[i]);
          let start = origin;
          if (i === 1) start = scale(contributions[0], clamp(progress - 1, 0, 1));
          if (i === 2) start = scale(sum(contributions[0], contributions[1]), clamp(progress - 2, 0, 1));
          addArrow(start, sum(start, visible), colors[i], progress < 1 ? 'v' + subs[i] + ' → α' + subs[i] + 'v' + subs[i] : 'α' + subs[i] + 'v' + subs[i], 2);
          if (progress >= 1) {
            const p = project(start); ctx.fillStyle = colors[i]; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
          }
        });
        if (progress >= 3) addArrow(origin, output, '#152b3c', 'z', 2.5);
      }
      arrows.sort((a, b) => b.depth - a.depth).forEach(a => line(a.a, a.b, a.color, a.thickness, a.dash, a.alpha, true));
      const zero = project(origin); ctx.fillStyle = '#71828d'; ctx.beginPath(); ctx.arc(zero.x, zero.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif'; ctx.fillText('0', zero.x - 12, zero.y + 15);
      const placed = [];
      labels.sort((a, b) => b.priority - a.priority).forEach(item => {
        const p = project(item.point); ctx.font = (item.priority > 0 ? '600 15px' : '12px') + ' system-ui, "Microsoft YaHei", sans-serif';
        const w = ctx.measureText(item.text).width + 10, h = 23;
        const offsets = [[9, -25], [9, 7], [-w - 9, -25], [-w - 9, 7], [9, -49], [-w / 2, 26], [-w - 9, -49]];
        let box;
        for (const [dx, dy] of offsets) {
          const candidate = { x: clamp(p.x + dx, 5, width - w - 5), y: clamp(p.y + dy, 4, height - h - 4), w, h };
          box = candidate;
          if (!placed.some(b => candidate.x < b.x + b.w + 3 && candidate.x + w + 3 > b.x && candidate.y < b.y + b.h + 3 && candidate.y + h + 3 > b.y)) break;
        }
        placed.push(box);
        const anchorX = clamp(p.x, box.x, box.x + w), anchorY = clamp(p.y, box.y, box.y + h);
        if (Math.hypot(anchorX - p.x, anchorY - p.y) > 5) {
          ctx.save(); ctx.strokeStyle = item.color; ctx.globalAlpha = item.priority > 0 ? .75 : .45; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(anchorX, anchorY); ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(box.x, box.y, w, h);
        ctx.fillStyle = item.color; ctx.fillText(item.text, box.x + 5, box.y + 16);
      });
      root.dataset.camera = JSON.stringify(camera);
      root.dataset.progress = String(progress);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); draw();
    }

    function playbackLabels() {
      const button = $('[data-a3d-play]');
      button.textContent = playing ? '暂停' : progress > 0 && progress < 3 ? '继续相加' : played ? '重播向量相加' : '播放向量相加';
      $('[data-a3d-step]').disabled = playing || progress >= 3;
      const captions = ['准备 · 三个 v 从同一原点出发。', '1 / 3 · 用各自权重缩放 v，得到三个贡献向量。', '2 / 3 · 平移 α₂v₂，让它接在 α₁v₁ 的末端。', '3 / 3 · 接上 α₃v₃；原点到最终端点的向量是 z。'];
      const caption = captions[playing ? Math.min(3, Math.floor(progress) + 1) : Math.ceil(progress)];
      if ($('[data-a3d-progress]').textContent !== caption) $('[data-a3d-progress]').textContent = caption;
      const swatch = (color, text) => '<i style="background:' + color + '" aria-hidden="true"></i>' + text;
      $('[data-a3d-scene-legend]').innerHTML = mode === 'match'
        ? swatch('#315cf4', '查询 q') + words.map((word, i) => swatch(colors[i], 'k' + subs[i] + ' ' + word)).join('')
        : swatch('#152b3c', '汇总 z') + words.map((word, i) => swatch(colors[i], 'v' + subs[i] + ' ' + word)).join('') + '<em>虚线为原始 v，实线为 αᵢvᵢ</em>';
      root.dataset.playing = String(playing);
    }

    function stop() { playing = false; cancelAnimationFrame(animation); lastTime = 0; playbackLabels(); }
    function tick(time) {
      if (!playing) return;
      if (lastTime) progress = Math.min(3, progress + Math.min(time - lastTime, 80) / 1100);
      lastTime = time; draw(); playbackLabels();
      if (progress >= 3) stop(); else animation = requestAnimationFrame(tick);
    }
    function setMode(next) {
      stop(); if(next === 'sum' && !played) progress = 0; mode = next;
      root.dataset.mode = mode;
      root.querySelectorAll('[data-a3d-mode]').forEach(button => {
        const selected = button.dataset.a3dMode === mode;
        button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      });
      $('#a3d-panel').setAttribute('aria-labelledby', 'a3d-tab-' + mode);
      $('[data-a3d-space]').textContent = mode === 'match' ? '匹配空间 · q 与 k' : '汇总空间 · v 与 z';
      $('[data-a3d-vector-heading]').textContent = mode === 'match' ? '键向量 kᵢ' : '值向量 vᵢ';
      $('[data-a3d-formula]').innerHTML = mode === 'match' ? '分数 sᵢ = q · kᵢ / √3<br>权重 α = softmax(s)' : '沿用匹配视图的注意力权重<br>输出 z = Σ αᵢvᵢ';
      $('[data-a3d-sum-controls]').hidden = mode !== 'sum';
      $('[data-a3d-progress]').hidden = mode !== 'sum';
      $('[data-a3d-query-controls]').hidden = mode !== 'match';
      updateReadout(); playbackLabels(); draw();
    }
    root.querySelectorAll('[data-a3d-mode]').forEach(button => {
      button.addEventListener('click', () => setMode(button.dataset.a3dMode));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? 'match' : event.key === 'End' ? 'sum' : mode === 'match' ? 'sum' : 'match';
        setMode(next); $('[data-a3d-mode="' + next + '"]').focus();
      });
    });
    root.querySelectorAll('[data-a3d-input]').forEach(input => input.addEventListener('input', () => {
      stop(); progress = 3;
      if (input.dataset.a3dInput !== 'length') targetPreset = null;
      controls[input.dataset.a3dInput] = Number(input.value);
      calculate(); updateReadout(); playbackLabels(); draw();
    }));
    root.querySelectorAll('[data-a3d-preset]').forEach(button => button.addEventListener('click', () => {
      stop(); progress = 3; targetPreset = Number(button.dataset.a3dPreset);
      const target = keys[targetPreset], flat = Math.hypot(target[0], target[2]);
      controls.azimuth = Math.atan2(target[2], target[0]) * 180 / Math.PI;
      controls.elevation = Math.atan2(target[1], flat) * 180 / Math.PI;
      if (controls.length === 0) controls.length = defaults.length;
      calculate(); updateReadout(); playbackLabels(); draw();
    }));
    $('[data-a3d-camera-reset]').addEventListener('click', () => {
      camera = { yaw: .65, pitch: .42 };
      $('[data-a3d-camera-status]').textContent = '观察视角已恢复；Q/K/V 数值没有改变。';
      draw();
    });
    $('[data-a3d-reset]').addEventListener('click', () => {
      controls = { ...defaults }; camera = { yaw: .65, pitch: .42 }; played = false; targetPreset = null; weights = null;
      calculate(); setMode('match');
    });
    $('[data-a3d-play]').addEventListener('click', () => {
      if (playing) { stop(); return; }
      played = true; if (progress >= 3) progress = 0;
      if (reduce.matches) { progress = 3; playbackLabels(); draw(); return; }
      playing = true; lastTime = 0; playbackLabels(); animation = requestAnimationFrame(tick);
    });
    $('[data-a3d-step]').addEventListener('click', () => { stop(); progress = Math.min(3, Math.floor(progress) + 1); playbackLabels(); draw(); });
    $('[data-a3d-replay]').addEventListener('click', () => { stop(); progress = 0; playbackLabels(); draw(); });
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      camera.yaw += dx * .009; camera.pitch = clamp(camera.pitch + (pointer.touch ? 0 : dy * .009), -1.2, 1.2);
      pointer.x = event.clientX; pointer.y = event.clientY; draw();
      $('[data-a3d-camera-status]').textContent = '正在改变观察视角；Q/K/V 数值与权重保持不变。';
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => { pointer = null; });
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') camera = { yaw: .65, pitch: .42 };
      if (event.key === 'ArrowLeft') camera.yaw -= .12;
      if (event.key === 'ArrowRight') camera.yaw += .12;
      if (event.key === 'ArrowUp') camera.pitch = clamp(camera.pitch - .12, -1.2, 1.2);
      if (event.key === 'ArrowDown') camera.pitch = clamp(camera.pitch + .12, -1.2, 1.2);
      $('[data-a3d-camera-status]').textContent = '观察视角已改变；Q/K/V 数值与权重保持不变。';
      draw();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
    reduce.addEventListener('change', () => { if (reduce.matches && playing) { stop(); progress = 3; playbackLabels(); draw(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting && playing) stop(); }).observe(root);
    calculate(); setMode('match');
    new ResizeObserver(resize).observe(canvas); resize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

(function(){
 'use strict';
 function init(){
  const root=document.getElementById('mhc-3d');
  if(!root||root.dataset.initialized)return;
  root.dataset.initialized='true';
  const $=selector=>root.querySelector(selector),canvas=$('[data-m3d-canvas]');
  const X=[[1,0,.5],[.2,1,-.2],[-.5,.4,1.2],[.8,-.6,.3]],A=[.25,.25,.25,.25],C=[1,.8,1.2,.6],y=[.4,-.2,.6];
  const B0=[[.7,.2,.1,0],[.2,.6,.1,.1],[.1,.1,.7,.1],[0,.1,.1,.8]];
  const colors=['#087f78','#7650b5','#93611a','#47729e'],sub=['₁','₂','₃','₄'],zero=[0,0,0],modes=['input','module','residual','write'];
  const add=(left,right)=>left.map((number,index)=>number+right[index]);
  const scale=(value,factor)=>value.map(number=>number*factor);
  const sum=values=>values.reduce(add,[0,0,0]);
  const mix=weights=>sum(X.map((value,index)=>scale(value,weights[index])));
  const number=(value,digits=2)=>(Math.abs(value)<.5*10**(-digits)?0:value).toFixed(digits);
  const vector=(value,digits=2)=>'['+value.map(item=>number(item,digits)).join(', ')+']';
  const percent=value=>Math.round(value*100)+'%';
  let mode='input',route=0,lambda=1,B,R,outputs,u,inputParts,residualParts;
  const baseSpan=2.1,zoomMin=.75,zoomMax=1.35,zoomStep=.15;
  let zoom=1;
  const scene=new Guide3D.Scene(canvas,{span:baseSpan,center:[.05,.15,.15],yaw:.72,pitch:.37});
  function calculate(){
   B=B0.map((row,rowIndex)=>row.map((value,columnIndex)=>(1-lambda)*(rowIndex===columnIndex?1:0)+lambda*value));
   inputParts=X.map((value,index)=>scale(value,A[index]));
   residualParts=B.map(row=>X.map((value,index)=>scale(value,row[index])));
   R=residualParts.map(sum);
   u=mix(A);
   outputs=R.map((value,index)=>add(value,scale(y,C[index])));
   root.dataset.state=JSON.stringify({X,A,B,C,R,outputs,route,lambda,u,y});
  }
  function midpoint(left,right){return left.map((value,index)=>(value+right[index])/2);}
  function tipToTail(parts){
   let start=zero;
   return parts.map((part,index)=>{const end=add(start,part),segment={start,end,middle:midpoint(start,end),index};scene.arrow(start,end,colors[index],'',2.25);start=end;return segment;});
  }
  function callout(point,text,color,dx,dy){
   const ctx=scene.ctx,p=scene.project(point),font='600 14px system-ui, "Microsoft YaHei", sans-serif';
   ctx.save();ctx.font=font;
   const width=ctx.measureText(text).width+14,height=24;
   const x=Math.max(5,Math.min(scene.width-width-5,p.x+dx)),y=Math.max(4,Math.min(scene.height-height-4,p.y+dy));
   const edgeX=dx>=0?x:x+width,edgeY=y+height/2;
   ctx.strokeStyle='rgba(91,111,121,.72)';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(edgeX,edgeY);ctx.stroke();
   ctx.setLineDash([]);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillRect(x,y,width,height);
   ctx.fillStyle=color;ctx.fillText(text,x+7,y+17);ctx.restore();
  }
  function endpoint(point,color){
   const ctx=scene.ctx,p=scene.project(point);ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,4.2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  function draw(){
   let segments=[];
   scene.start();scene.axes(1.58);
   if(mode==='input'){
    X.forEach((value,index)=>scene.line(zero,value,colors[index],1,true,true));
    segments=tipToTail(inputParts);
    scene.arrow(zero,u,'#152b3c','',2.5);
   }else if(mode==='module'){
    scene.arrow(zero,u,'#315cf4','',2.4);
    scene.arrow(zero,y,'#087f78','',2.5);
   }else if(mode==='residual'){
    X.forEach((value,index)=>scene.line(zero,value,colors[index],1,true,true));
    segments=tipToTail(residualParts[route]);
    scene.arrow(zero,R[route],'#152b3c','',2.5);
   }else{
    scene.line(zero,outputs[route],'#49616e',1,true,false);
    scene.arrow(zero,R[route],colors[route],'',2.2);
    scene.arrow(R[route],outputs[route],'#315cf4','',2.5);
   }
   scene.finish();
   if(mode==='input'){
    const offsets=[[42,-52],[-78,-66],[-94,-10],[48,-20]];
    segments.forEach((segment,index)=>callout(segment.middle,'A'+sub[index]+'X'+sub[index],colors[index],offsets[index][0],offsets[index][1]));
    endpoint(u,'#152b3c');callout(u,'u = Σ AⱼXⱼ','#152b3c',43,25);
   }else if(mode==='module'){
    callout(midpoint(zero,u),'输入 u','#315cf4',-74,-46);endpoint(y,'#087f78');callout(y,'新结果 y = F(u)','#087f78',36,-34);
   }else if(mode==='residual'){
    endpoint(R[route],'#152b3c');callout(R[route],'保留 R'+sub[route]+' = Σ B'+sub[route]+'ⱼXⱼ','#152b3c',36,-38);
   }else{
    callout(midpoint(zero,R[route]),'保留 R'+sub[route],colors[route],-86,-48);
    callout(midpoint(R[route],outputs[route]),'加入 C'+sub[route]+'y','#315cf4',30,-52);
    endpoint(outputs[route],'#152b3c');callout(outputs[route],'更新后 X′'+sub[route],'#152b3c',28,17);
   }
   root.dataset.mode=mode;
  }
  function setZoom(next){
   zoom=Math.max(zoomMin,Math.min(zoomMax,Math.round(next*100)/100));scene.span=baseSpan/zoom;
   $('[data-m3d-zoom-value]').value=Math.round(zoom*100)+'%';$('[data-m3d-zoom-out]').disabled=zoom<=zoomMin;$('[data-m3d-zoom-in]').disabled=zoom>=zoomMax;
   root.dataset.zoom=String(zoom);draw();
  }
  function resetView(){zoom=1;scene.span=baseSpan;$('[data-m3d-zoom-value]').value='100%';$('[data-m3d-zoom-out]').disabled=false;$('[data-m3d-zoom-in]').disabled=false;root.dataset.zoom='1';scene.reset();}
  function setFormula(markup,key){
   const target=$('[data-m3d-formula]');
   if(target.dataset.formula===key)return;
   target.innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML">'+markup+'</math>';
   target.dataset.formula=key;
  }
  function update(){
   calculate();
   root.style.setProperty('--m3d-route-color',colors[route]);
   root.style.setProperty('--m3d-result-color',mode==='module'?'#087f78':mode==='write'?'#315cf4':'#152b3c');
   $('[data-m3d-inputs]').innerHTML=X.map((value,index)=>'<tr aria-selected="false"><td style="color:'+colors[index]+'">路 '+(index+1)+'</td><td>'+vector(value)+'</td><td>'+number(A[index])+'</td><td>'+vector(inputParts[index])+'</td></tr>').join('');
   $('[data-m3d-residual-parts]').innerHTML=residualParts[route].map((value,index)=>'<tr><td style="color:'+colors[index]+'">路 '+(index+1)+'</td><td>'+number(B[route][index],3)+'</td><td>'+vector(value,3)+'</td></tr>').join('');
   $('[data-m3d-matrix]').innerHTML=B.map((row,index)=>'<tr aria-selected="'+(index===route)+'"><td>路 '+(index+1)+'</td>'+row.map(value=>'<td>'+number(value,3)+'</td>').join('')+'<td>'+number(row.reduce((total,value)=>total+value,0),3)+'</td></tr>').join('');
   root.querySelectorAll('[data-m3d-col]').forEach((cell,index)=>cell.textContent=number(B.reduce((total,row)=>total+row[index],0),3));
   $('[data-m3d-outputs]').innerHTML=outputs.map((value,index)=>'<tr aria-selected="'+(index===route)+'"><td style="color:'+colors[index]+'">路 '+(index+1)+'</td><td>'+vector(R[index])+'</td><td>'+vector(scale(y,C[index]))+'</td><td>'+vector(value)+'</td></tr>').join('');
   $('[data-m3d-module-input]').textContent=vector(u,3);$('[data-m3d-module-output]').textContent=vector(y,3);
   $('[data-m3d-input-info]').hidden=mode!=='input';$('[data-m3d-module-info]').hidden=mode!=='module';$('[data-m3d-residual-info]').hidden=mode!=='residual';$('[data-m3d-write-info]').hidden=mode!=='write';$('[data-m3d-mix-control]').hidden=!['residual','write'].includes(mode);$('.m3d-route-control').hidden=!['residual','write'].includes(mode);
   const titles={input:'四个完整向量首尾相加，得到一次计算的输入',module:'同一个原点对照子模块输入 u 与新结果 y',residual:'路 '+(route+1)+'：四个旧状态贡献首尾相加',write:'路 '+(route+1)+'：在保留结果的末端加入 C'+sub[route]+'y'};
   const questions={input:'A 怎样把四路变成一条子模块输入？',module:'子模块拿到什么，又交回什么？',residual:'B 怎样混合并保留已有四路？',write:'C 怎样把新结果加入每一路？'};
   $('[data-m3d-scene-title]').textContent=titles[mode];$('[data-m3d-stage-number]').textContent='阶段 '+(modes.indexOf(mode)+1)+' / 4';$('[data-m3d-stage-question]').textContent=questions[mode];
   $('[data-m3d-residual-summary]').textContent='查看路 '+(route+1)+' 的四项贡献与完整 B';
   if(mode==='input')setFormula('<mi>u</mi><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mn>4</mn></munderover><msub><mi>A</mi><mi>j</mi></msub><msub><mi>X</mi><mi>j</mi></msub>','input');
   if(mode==='module')setFormula('<mi>y</mi><mo>=</mo><mi>F</mi><mo>(</mo><mi>u</mi><mo>)</mo>','module');
   if(mode==='residual')setFormula('<msub><mi>R</mi><mi>i</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mn>4</mn></munderover><msub><mi>B</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub><msub><mi>X</mi><mi>j</mi></msub>','residual');
   if(mode==='write')setFormula('<msubsup><mi>X</mi><mi>i</mi><mo>′</mo></msubsup><mo>=</mo><msub><mi>R</mi><mi>i</mi></msub><mo>+</mo><msub><mi>C</mi><mi>i</mi></msub><mi>y</mi>','write');
   const current=mode==='input'?u:mode==='module'?y:mode==='residual'?R[route]:outputs[route];
   const labels={input:'合成后的子模块输入 u',module:'子模块产生的新结果 y',residual:'路 '+(route+1)+' 保留下来的状态 R'+sub[route],write:'路 '+(route+1)+' 更新后的完整状态 X′'+sub[route]};
   const details={input:'A = ['+A.map(value=>number(value)).join(', ')+']',module:'输入 u = '+vector(u,3),residual:'B 第 '+(route+1)+' 行 = ['+B[route].map(value=>number(value,3)).join(', ')+']',write:'R'+sub[route]+' '+vector(R[route])+' + C'+sub[route]+'y '+vector(scale(y,C[route]))};
   $('[data-m3d-result-label]').textContent=labels[mode];$('[data-m3d-result]').textContent='≈ '+vector(current,3);$('[data-m3d-result-detail]').textContent=details[mode];
   $('[data-m3d-write-description]').innerHTML='每一路保留 R<sub>i</sub>，再加入按 C<sub>i</sub> 缩放的新结果 y。';
   const legends={input:'虚线 X 是四路原向量 · 实色链是 AⱼXⱼ · 深色轮廓指向合成结果 u',module:'蓝色 u 是子模块输入 · 青色 y 是子模块交回的新结果',residual:'虚线 X 是四路原向量 · 实色链是 BᵢⱼXⱼ · 深色终点是保留结果 Rᵢ',write:'路色段是保留 Rᵢ · 蓝色段从其末端加入 Cᵢy · 空心终点是更新后 X′ᵢ'};
   $('[data-m3d-legend]').textContent=legends[mode];$('[data-m3d-mix-value]').textContent=percent(lambda);
   root.querySelectorAll('[data-m3d-route]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.m3dRoute)===route)));
   const description=mode==='input'?'四路贡献首尾相加，合成输入 u='+vector(u):mode==='module'?'子模块输入 u='+vector(u)+'，新结果 y='+vector(y):mode==='residual'?'第 '+(route+1)+' 路保留结果 R='+vector(R[route]):'第 '+(route+1)+' 路保留 R='+vector(R[route])+'，加入量='+vector(scale(y,C[route]))+'，更新结果='+vector(outputs[route]);
   canvas.setAttribute('aria-label','mHC 三维教学图，阶段 '+(modes.indexOf(mode)+1)+'，追踪路 '+(route+1)+'。'+description+'。方向键旋转，加号或减号缩放，Home 恢复视角与缩放。');
   updateStatus();draw();
  }
  function updateStatus(){
   const message=mode==='residual'?(lambda===0?'0%：路 '+(route+1)+' 只保留自己的 X'+sub[route]+'。':percent(lambda)+'：路 '+(route+1)+' 混合四条旧状态。'):'';
   if($('[data-m3d-status]').textContent!==message)$('[data-m3d-status]').textContent=message;
  }
  function setMode(next){mode=next;root.querySelectorAll('[data-m3d-mode]').forEach(button=>{const active=button.dataset.m3dMode===mode;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});$('#m3d-panel').setAttribute('aria-labelledby','m3d-tab-'+mode);update();}
  root.querySelectorAll('[data-m3d-mode]').forEach(button=>{
   button.addEventListener('click',()=>setMode(button.dataset.m3dMode));
   button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?modes.length-1:(modes.indexOf(mode)+(event.key==='ArrowRight'?1:modes.length-1))%modes.length;setMode(modes[index]);$('[data-m3d-mode="'+mode+'"]').focus();});
  });
  root.querySelectorAll('[data-m3d-route]').forEach(button=>button.addEventListener('click',()=>{route=Number(button.dataset.m3dRoute);update();}));
  $('[data-m3d-mix]').addEventListener('input',event=>{lambda=Number(event.target.value);update();});
  $('[data-m3d-zoom-out]').addEventListener('click',()=>setZoom(zoom-zoomStep));
  $('[data-m3d-zoom-in]').addEventListener('click',()=>setZoom(zoom+zoomStep));
  $('[data-m3d-camera-reset]').addEventListener('click',resetView);
  canvas.addEventListener('keydown',event=>{if(!['+','=','-','_'].includes(event.key))return;event.preventDefault();setZoom(zoom+(['+','='].includes(event.key)?zoomStep:-zoomStep));});
  canvas.addEventListener('keydown',event=>{if(event.key!=='Home')return;resetView();});
  scene.render=draw;update();setZoom(1);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
 'use strict';
 function init(){
  const root=document.getElementById('tensor-3d');if(!root||root.dataset.initialized)return;root.dataset.initialized='true';
  const $=selector=>root.querySelector(selector),$$=selector=>Array.from(root.querySelectorAll(selector));
  const canvas=$('[data-t3d-canvas]'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const colors=['#6c91ed','#45a89d','#a78acb','#d0a656','#c9788c'],lights=['#e5edff','#e0f0ed','#eee7f6','#f7edda','#f6e4e9'];
  const sourceColors=['#5473d6','#4f93c8','#459f9a','#66a86d','#b2933e','#ca7847','#c56772','#946cb0','#705ca1'];
  const dimensions=5,pipelineStages=['source','packed','linear1','gelu','linear2','token'];
  const stageMessages={
   source:'先观察选中的九块：视觉编码器为每个位置保存一条 1,024 维特征向量。',
   packed:'按特征分量打包：先收齐第 1 个分量的九个空间位置，再处理后续分量，最终得到 9,216 维向量。',
   linear1:'第一层使用训练学得的 W₁ 和 b₁，把 9,216 维输入投影到语言隐藏维度 5,120。',
   gelu:'GELU 对第一层的 5,120 个结果逐分量激活，为第二层加入非线性。',
   linear2:'第二层使用训练学得的 W₂ 和 b₂，仍输出一条 5,120 维向量。',
   token:'完成：这一条 5,120 维向量就是供语言主干读取的视觉 token。点击四格可追溯各自的九块来源。'
  };
  const tensor=Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>Array.from({length:dimensions},(_,k)=>(((r+1)*17+(c+1)*11+k*7)%19-9)/10)));
  const visualTokens=Array.from({length:4},(_,index)=>{
   const output=[Math.floor(index/2),index%2],start=[output[0]*3,output[1]*3];
   const sourcePatches=Array.from({length:9},(__,i)=>[start[0]+Math.floor(i/3),start[1]+i%3]);
   return {index,label:'视觉 token '+(index+1),output,sourcePatches,inputShape:[9,1024],packedShape:[9216],outputShape:[5120]};
  });
  let row=1,col=1,channel=0,mode='vector',extracted=false,progress=0,playing=false,frame=0,lastTime=0,pipelineStep=0,dialogReturnFocus=null;
  const scene=new Guide3D.Scene(canvas,{span:6.8,yaw:.65,pitch:.54,select:hit=>{row=hit.r;col=hit.c;extracted=false;stop();progress=0;update();}});
  const value=x=>Math.abs(x)<.05?'0.0':x.toFixed(1);
  const groupIndex=()=>Math.floor(row/3)*2+Math.floor(col/3);
  const group=()=>visualTokens[groupIndex()].sourcePatches.map(([r,c])=>({r,c}));
  const groupName=index=>['左上','右上','左下','右下'][index];

  for(const type of ['row','col'])$('[data-t3d-'+type+']').innerHTML=Array.from({length:6},(_,i)=>'<option value="'+i+'">第 '+(i+1)+(type==='row'?' 行':' 列')+'</option>').join('');
  const photoGrid=$('[data-t3d-photo-grid]'),crop=$('[data-t3d-crop]'),photo=$('[data-t3d-photo]'),source=new Image();
  source.onload=()=>{
   const bitmap=document.createElement('canvas');bitmap.width=84;bitmap.height=84;
   bitmap.getContext('2d').drawImage(source,0,0,84,84);
   const pixels='assets/images/image-c98d880599171868.png';photo.src=pixels;crop.style.backgroundImage='url("'+pixels+'")';root.dataset.photoReady='true';
  };
  source.onerror=()=>{root.dataset.photoReady='error';};source.src=photo.getAttribute('src');
  photoGrid.innerHTML=Array.from({length:36},(_,i)=>'<button type="button" data-t3d-photo-cell="'+Math.floor(i/6)+','+(i%6)+'" aria-label="图片第 '+(Math.floor(i/6)+1)+' 行，第 '+(i%6+1)+' 列图像小块" aria-pressed="false"></button>').join('');
  function selectPhoto(r,c){row=r;col=c;stop();progress=0;extracted=false;if(mode==='pipeline')pipelineStep=0;update();}
  photoGrid.addEventListener('click',event=>{const cell=event.target.closest('[data-t3d-photo-cell]');if(cell)selectPhoto(...cell.dataset.t3dPhotoCell.split(',').map(Number));});
  photoGrid.addEventListener('keydown',event=>{
   if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();let r=row,c=col;
   if(event.key==='ArrowUp')r=Math.max(0,r-1);if(event.key==='ArrowDown')r=Math.min(5,r+1);
   if(event.key==='ArrowLeft')c=Math.max(0,c-1);if(event.key==='ArrowRight')c=Math.min(5,c+1);
   if(event.key==='Home')c=0;if(event.key==='End')c=5;
   selectPhoto(r,c);photoGrid.children[r*6+c].focus();
  });

  function draw(){
   root.style.setProperty('--pack-scale',String(.35+.65*progress));
   root.dataset.progress=String(Number(progress.toFixed(3)));root.dataset.playing=String(playing);
   if(mode==='pipeline')return;
   scene.start();scene.span=mode==='pack'?7.7:6.8;
   const selectedGroup=group();
   for(let r=0;r<6;r++)for(let c=0;c<6;c++)for(let k=0;k<dimensions;k++){
    if(mode==='slice'&&k!==channel)continue;
    const index=selectedGroup.findIndex(p=>p.r===r&&p.c===c);
    if(mode==='pack'&&index<0)continue;
    let point=[(c-2.5)*.7,(k-(dimensions-1)/2)*.58,(r-2.5)*.7];
    if(mode==='vector'&&extracted&&r===row&&c===col)point=[2.75,(k-(dimensions-1)/2)*.58,2.75];
    if(mode==='pack'){
     const target=[(index-4)*.65,(k-(dimensions-1)/2)*.58,0];point=point.map((x,j)=>x*(1-progress)+target[j]*progress);
    }
    const exact=r===row&&c===col,inGroup=mode==='pack'&&index>=0;
    scene.cube(point,.51,exact||inGroup?colors[k]:lights[k],exact,{r,c,k});
   }
   if(mode==='pack'){
    scene.label([0,1.95,0],progress===1?'五个分量段，每段九个位置：教学共 45 维':'收集同一 3 × 3 区域的九条向量','#315cf4',true);
    if(progress===1)for(let i=0;i<9;i++)scene.label([(i-4)*.65,-1.95,0],String(i+1));
   }else{
    scene.label(extracted?[2.75,2.1,2.75]:[(col-2.5)*.7,1.8,(row-2.5)*.7],(row+1)+','+(col+1),'#315cf4',true);
    scene.line([-2.3,-1.65,-2.3],[2.3,-1.65,-2.3],'#9fadb6',1,false,true);scene.label([2.3,-1.65,-2.3],'列');
    scene.line([-2.3,-1.65,-2.3],[-2.3,-1.65,2.3],'#9fadb6',1,false,true);scene.label([-2.3,-1.65,2.3],'行');
    scene.line([-2.3,-1.65,-2.3],[-2.3,1.8,-2.3],'#9fadb6',1,false,true);scene.label([-2.3,1.8,-2.3],'特征分量');
    if(extracted&&mode==='vector')scene.line([(col-2.5)*.7,-1.1,(row-2.5)*.7],[2.75,-1.1,2.75],'#728994',1.2,true);
   }
   scene.finish();
  }

  function sourceGroupState(index,items){return {index,label:groupName(index)+'区域',patches:items.map(({r,c})=>[r,c])};}
  function updatePipeline(items){
   const selected=groupIndex(),stage=pipelineStages[pipelineStep];
   $('[data-t3d-source-label]').textContent='当前：'+groupName(selected)+'区域 → token '+(selected+1);
   $('[data-t3d-visual-tokens]').innerHTML=visualTokens.map(token=>'<button type="button" data-t3d-token="'+token.index+'" aria-pressed="'+(token.index===selected)+'" aria-label="视觉 token '+(token.index+1)+'，来自照片'+groupName(token.index)+'的九块"><span>token '+(token.index+1)+'</span><small>[5,120]</small></button>').join('');
   $$('[data-t3d-stage]').forEach(node=>{
    const index=pipelineStages.indexOf(node.dataset.t3dStage);node.dataset.stageStatus=index===pipelineStep?'current':index<pipelineStep?'past':'future';
   });
   $('[data-t3d-pipeline-result] p').textContent=stageMessages[stage];
   $('[data-t3d-pipeline-prev]').disabled=pipelineStep===0;
   $('[data-t3d-pipeline-next]').disabled=pipelineStep===pipelineStages.length-1;
   $('[data-t3d-pipeline-next]').textContent=['按分量打包','经过线性层 1','经过 GELU','经过线性层 2','生成视觉 token','已生成视觉 token'][pipelineStep];
   $('[data-t3d-pipeline-progress]').textContent='视觉 token 流程 · '+pipelineStep+' / 5';
   root.dataset.pipelineState=stage;root.dataset.sourceGroup=JSON.stringify(sourceGroupState(selected,items));root.dataset.visualTokens=JSON.stringify(visualTokens);
   $('[data-t3d-pipeline-panel]').setAttribute('aria-label','当前第 '+(pipelineStep+1)+' 阶段：'+stageMessages[stage]+' 左右方向键切换，Home 重置，End 到结果。');
  }

  function update(){
   const v=tensor[row][col],items=group(),packedLayout=Array.from({length:dimensions},(_,k)=>items.map((p,sourceIndex)=>({channel:k,sourceIndex,r:p.r,c:p.c,value:tensor[p.r][p.c][k]}))).flat(),packed=packedLayout.map(item=>item.value),selectedGroup=groupIndex(),stage=pipelineStages[pipelineStep];
   const state={schemaVersion:1,shape:[6,6,dimensions],row,col,channel,vector:v,slice:tensor.map(line=>line.map(vector=>vector[channel])),group:items,packed,packingOrder:'channel-major-spatial-row-major',packedLayout,pipelineState:stage,pipelineStep,sourceGroup:sourceGroupState(selectedGroup,items),visualTokens};
   root.dataset.stateSchema='tensor-v3-1';root.dataset.mode=mode;root.dataset.state=JSON.stringify(state);root.dataset.pipelineState=stage;root.dataset.sourceGroup=JSON.stringify(state.sourceGroup);root.dataset.visualTokens=JSON.stringify(visualTokens);
   $('[data-t3d-position]').textContent='第 '+(row+1)+' 行，第 '+(col+1)+' 列';
   $('[data-t3d-photo-position]').textContent='第 '+(row+1)+' 行，第 '+(col+1)+' 列';
   $('[data-t3d-pixel-range]').textContent='像素行 '+(row*14+1)+'–'+((row+1)*14)+'，列 '+(col*14+1)+'–'+((col+1)*14);
   $('[data-t3d-photo-hint]').textContent=mode==='pack'||mode==='pipeline'?'蓝色九块组成一个 3 × 3 来源区域，共覆盖 42 × 42 像素。':'照片实际缩为 84 × 84 像素后显示；每框是一块 14 × 14 像素的 patch。';
   $('[data-t3d-image-title]').textContent=mode==='pipeline'?'来源图 · 选择一个输出，回看它来自哪里':'教学输入 · 84 × 84 像素';
   crop.style.backgroundPosition=(col*20)+'% '+(row*20)+'%';crop.setAttribute('aria-label','图片第 '+(row+1)+' 行，第 '+(col+1)+' 列图像小块的放大图');
   Array.from(photoGrid.children).forEach((cell,i)=>{
    const r=Math.floor(i/6),c=i%6,exact=r===row&&c===col,sourceIndex=items.findIndex(p=>p.r===r&&p.c===c),inGroup=sourceIndex>=0,showGroup=mode==='pack'||mode==='pipeline';
    cell.setAttribute('aria-pressed',String(exact));cell.tabIndex=exact?0:-1;cell.dataset.group=String(showGroup&&inGroup);cell.dataset.current=String(exact);cell.style.setProperty('--source-color',inGroup?sourceColors[sourceIndex]:'transparent');cell.textContent=mode==='pack'&&inGroup?String(sourceIndex+1):exact&&!showGroup?(row+1)+','+(col+1):'';
   });
   $('[data-t3d-vector]').innerHTML=v.map((x,k)=>'<span style="--channel:'+colors[k]+';--channel-light:'+lights[k]+'"><small>分量 '+(k+1)+'</small><b>'+value(x)+'</b></span>').join('');
   $('[data-t3d-row]').value=row;$('[data-t3d-col]').value=col;$('[data-t3d-channel-value]').textContent=(channel+1)+' / '+dimensions;
   $('[data-t3d-slice-title]').textContent='只取第 '+(channel+1)+' 个分量：得到一张 6 × 6 数值切片';
   $('[data-t3d-slice]').innerHTML=tensor.flatMap((line,r)=>line.map((vector,c)=>'<button type="button" data-t3d-cell="'+r+','+c+'" aria-label="第'+(r+1)+'行第'+(c+1)+'列，第'+(channel+1)+'分量值'+value(vector[channel])+'" aria-pressed="'+(r===row&&c===col)+'">'+value(vector[channel])+'</button>')).join('');
   $('[data-t3d-group-title]').textContent=groupName(selectedGroup)+'区域：第 '+(items[0].r+1)+'–'+(items[8].r+1)+' 行，第 '+(items[0].c+1)+'–'+(items[8].c+1)+' 列；编号 1–9 是稳定的来源位置';
   $('[data-t3d-pack-segments]').innerHTML=items.map((p,i)=>'<div class="t3d-pack-segment" style="--source-color:'+sourceColors[i]+'" data-selected="'+(p.r===row&&p.c===col)+'" aria-label="来源'+(i+1)+'，图像第'+(p.r+1)+'行第'+(p.c+1)+'列，完整教学向量 '+tensor[p.r][p.c].map(value).join('，')+'"><b>'+(i+1)+' · '+(p.r+1)+','+(p.c+1)+'</b><span class="t3d-pack-mini">'+colors.map(color=>'<i style="--channel:'+color+'"></i>').join('')+'</span></div>').join('');
   $('[data-t3d-strip]').innerHTML=Array.from({length:dimensions},(_,k)=>'<div class="t3d-packed-channel" style="--channel:'+colors[k]+';--channel-light:'+lights[k]+'"><b>分量 '+(k+1)+'</b>'+items.map((p,i)=>'<i style="--source-color:'+sourceColors[i]+'" title="打包第 '+(k*9+i+1)+' 项：分量 '+(k+1)+'，来源 '+(i+1)+'，值 '+value(tensor[p.r][p.c][k])+'"><span>'+(i+1)+'</span></i>').join('')+'</div>').join('');
   $('[data-t3d-order-list]').innerHTML=items.map((p,i)=>'<li>来源 '+(i+1)+'：位置 '+(p.r+1)+','+(p.c+1)+'</li>').join('');
   $('[data-t3d-vector-info]').hidden=mode!=='vector';$('[data-t3d-slice-info]').hidden=mode!=='slice';$('[data-t3d-pack-info]').hidden=mode!=='pack';
   $('[data-t3d-channel-control]').hidden=mode!=='slice';$('[data-t3d-pack-controls]').hidden=mode!=='pack';$('[data-t3d-pipeline-controls]').hidden=mode!=='pipeline';$('[data-t3d-location-controls]').hidden=mode==='pipeline';
   $('[data-t3d-pipeline-panel]').hidden=mode!=='pipeline';
   $('[data-t3d-extract]').textContent=extracted?'放回原位置':'拉出这条向量';$('[data-t3d-extract]').setAttribute('aria-pressed',String(extracted));
   $('[data-t3d-scene-title]').textContent=mode==='vector'?'6 × 6 × 5 · 教学特征张量':mode==='slice'?'第 '+(channel+1)+' 个分量 · 6 × 6 切片':'3 × 3 × 5 → 5 × 9 = 45 · 按分量打包';
   canvas.setAttribute('aria-label','教学张量，六行六列，每位置五分量。选中第'+(row+1)+'行第'+(col+1)+'列，完整向量['+v.map(value).join(',')+']。拖动或方向键旋转，Home 恢复视角。');
   updatePipeline(items);status();draw();
  }

  function status(){
   $('[data-t3d-play]').textContent=playing?'暂停':progress>0&&progress<1?'继续拼接':progress===1?'重播拼接':'播放拼接';
   $('[data-t3d-pack-prev]').disabled=progress===0;$('[data-t3d-finish]').disabled=progress===1;
   const message=mode==='vector'?(extracted?'完整五维向量已移出；分量数值和次序保持不变。':'选择照片中的一块，再拉出它对应的完整教学向量。'):mode==='slice'?'当前只看一个分量在 6 × 6 位置上的分布；它仍是一条完整向量的一个切片。':mode==='pack'?(progress===1?'打包完成：五个分量段各收集九个来源位置，共 45 维；真实模型用 1,024 段得到 9,216 维。':'选择任一图像小块会定位它所属的 3 × 3 区域；播放后可看九条向量按分量重新排列。'):'选择右侧 2 × 2 输出格，可直接查看每个视觉 token 的九块来源。';
   if($('[data-t3d-status]').textContent!==message)$('[data-t3d-status]').textContent=message;
  }
  function stop(){playing=false;cancelAnimationFrame(frame);lastTime=0;status();}
  function tick(time){if(!playing)return;if(lastTime)progress=Math.min(1,progress+Math.min(time-lastTime,80)/1350);lastTime=time;draw();if(progress>=1){stop();draw();}else frame=requestAnimationFrame(tick);}
  function setMode(next){
   stop();mode=next;progress=0;extracted=false;if(mode==='pipeline')pipelineStep=0;
   $$('[data-t3d-mode]').forEach(button=>{const active=button.dataset.t3dMode===mode;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
   $('#t3d-panel').setAttribute('aria-labelledby','t3d-tab-'+mode);update();
  }
  $$('[data-t3d-mode]').forEach(button=>{
   button.addEventListener('click',()=>setMode(button.dataset.t3dMode));
   button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const modes=['vector','slice','pack','pipeline'];let index=modes.indexOf(mode);index=event.key==='Home'?0:event.key==='End'?modes.length-1:(index+(event.key==='ArrowRight'?1:modes.length-1))%modes.length;setMode(modes[index]);$('[data-t3d-mode="'+mode+'"]').focus();});
  });
  for(const key of ['row','col'])$('[data-t3d-'+key+']').addEventListener('change',event=>{stop();if(key==='row')row=Number(event.target.value);else col=Number(event.target.value);progress=0;extracted=false;update();});
  $('[data-t3d-channel]').addEventListener('input',event=>{channel=Number(event.target.value)-1;update();});
  $('[data-t3d-slice]').addEventListener('click',event=>{const button=event.target.closest('[data-t3d-cell]');if(button){[row,col]=button.dataset.t3dCell.split(',').map(Number);update();}});
  $('[data-t3d-extract]').addEventListener('click',()=>{extracted=!extracted;update();});
  $('[data-t3d-camera-reset]').addEventListener('click',()=>scene.reset());
  $('[data-t3d-play]').addEventListener('click',()=>{if(playing){stop();draw();return;}if(progress===1)progress=0;if(reduce.matches){progress=1;status();draw();return;}playing=true;lastTime=0;status();frame=requestAnimationFrame(tick);});
  $('[data-t3d-pack-prev]').addEventListener('click',()=>{stop();progress=0;status();draw();});
  $('[data-t3d-finish]').addEventListener('click',()=>{stop();progress=1;status();draw();});
  $('[data-t3d-reset]').addEventListener('click',()=>{stop();progress=0;status();draw();});
  function setPipelineStep(next){pipelineStep=Math.max(0,Math.min(pipelineStages.length-1,next));update();}
  $('[data-t3d-pipeline-prev]').addEventListener('click',()=>setPipelineStep(pipelineStep-1));
  $('[data-t3d-pipeline-next]').addEventListener('click',()=>setPipelineStep(pipelineStep+1));
  $('[data-t3d-pipeline-reset]').addEventListener('click',()=>setPipelineStep(0));
  $('[data-t3d-pipeline-panel]').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.target.closest('button'))return;event.preventDefault();setPipelineStep(event.key==='Home'?0:event.key==='End'?pipelineStages.length-1:pipelineStep+(event.key==='ArrowRight'?1:-1));});
  function selectToken(index,focus){const token=visualTokens[index];row=token.sourcePatches[4][0];col=token.sourcePatches[4][1];pipelineStep=pipelineStages.length-1;update();if(focus)$('[data-t3d-token="'+index+'"]').focus();}
  $('[data-t3d-visual-tokens]').addEventListener('click',event=>{const button=event.target.closest('[data-t3d-token]');if(button)selectToken(Number(button.dataset.t3dToken),true);});
  $('[data-t3d-visual-tokens]').addEventListener('keydown',event=>{const button=event.target.closest('[data-t3d-token]');if(!button||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let index=Number(button.dataset.t3dToken);if(event.key==='ArrowUp')index=Math.max(0,index-2);if(event.key==='ArrowDown')index=Math.min(3,index+2);if(event.key==='ArrowLeft')index=Math.max(0,index-1);if(event.key==='ArrowRight')index=Math.min(3,index+1);if(event.key==='Home')index=0;if(event.key==='End')index=3;selectToken(index,true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();draw();}});
  reduce.addEventListener('change',()=>{if(reduce.matches&&playing){stop();progress=1;status();draw();}});
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&playing){stop();draw();}}).observe(root);

  const dimensionDialog=$('#t3d-dimension-dialog'),realStrip=$('[data-t3d-length-real]'),dimensionTrigger=$('[data-t3d-dimension-open]');


  $('[data-t3d-length-toy]').innerHTML=colors.map(color=>'<i style="background:'+color+'"></i>').join('');
  realStrip.innerHTML=Array.from({length:1024},(_,i)=>'<i data-dimension-slot="'+(i+1)+'"></i>').join('');
  function visibleDimensions(){
   const scroll=$('[data-t3d-length-scroll]'),first=Math.max(1,Math.floor(scroll.scrollLeft/8)+1),last=Math.min(1024,Math.ceil((scroll.scrollLeft+scroll.clientWidth)/8));
   $('[data-t3d-length-visible]').textContent='当前可见：'+first+'–'+last+' 项';
  }
  $('[data-t3d-length-scroll]').addEventListener('scroll',visibleDimensions);
  dimensionTrigger.addEventListener('click',()=>{stop();dialogReturnFocus=document.activeElement;dimensionDialog.showModal();$('[data-t3d-length-scroll]').scrollLeft=0;visibleDimensions();$('[data-t3d-dimension-close]').focus();});
  $('[data-t3d-dimension-close]').addEventListener('click',()=>dimensionDialog.close());
  dimensionDialog.addEventListener('close',()=>{if(dialogReturnFocus&&document.contains(dialogReturnFocus))dialogReturnFocus.focus();dialogReturnFocus=null;});
  scene.render=draw;update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
