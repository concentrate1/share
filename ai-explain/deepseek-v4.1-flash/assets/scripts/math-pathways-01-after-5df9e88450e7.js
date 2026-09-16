

(function(){
 'use strict';
 const colors={input:'#337fa4',vision:'#9c7837',engram:'#8270a4',mhc:'#bd7762',attention:'#37899d',csa:'#528e74',moe:'#a77699',cache:'#668395',output:'#3b9488',dspark:'#c59445',training:'#826ca8'};
 const shorts={input:'文字输入',vision:'图像支路',mhc:'mHC 四路',attention:'注意力',csa:'跨层共享',moe:'专家网络',cache:'历史缓存',output:'输出生成',dspark:'DSpark',training:'训练',engram:'Engram'};
 const positions={input:[0,1],vision:[0,2],mhc:[1,1],attention:[2,1],csa:[1,2],moe:[2,2],output:[3,1],dspark:[3,2],engram:[1,0],cache:[2,3],training:[3,0]};
 const kindPrefix={conditional:'条件：',shared:'共享：'};
 function edgeText(edge){const names={y_ffn:'FFN 输出向量',y_attn:'注意力输出向量',A_ffn:'FFN 侧混合系数',A_attn:'注意力侧混合系数'};return (kindPrefix[edge.kind]||'')+(edge.label||edge.kind||'依赖').replace(/\b(?:y_ffn|y_attn|A_ffn|A_attn)\b/g,key=>names[key]);}
 function aggregateEdges(edges,maxLabels=Infinity){
  const grouped=new Map();
  for(const edge of edges){
   if(!edge||!edge.from||!edge.to)continue;
   const key=edge.from+'\u0000'+edge.to;
   if(!grouped.has(key))grouped.set(key,{from:edge.from,to:edge.to,sources:[],labels:[],kinds:[]});
   const item=grouped.get(key),text=edgeText(edge);
   item.sources.push({...edge});
   if(!item.labels.includes(text))item.labels.push(text);
   if(!item.kinds.includes(edge.kind||'data'))item.kinds.push(edge.kind||'data');
  }
  return [...grouped.values()].map(item=>({
   from:item.from,to:item.to,label:item.labels.length>maxLabels?item.labels.slice(0,maxLabels).join('；')+'；另 '+(item.labels.length-maxLabels)+' 项':item.labels.join('；'),
   kind:item.kinds.length===1?item.kinds[0]:'mixed',kinds:item.kinds,sources:item.sources
  }));
 }
 function overlap(a,b,pad=0){return a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;}
 function wrapLabel(ctx,text,maxWidth){
  const lines=[];let line='';
  for(const token of text.match(/[A-Za-z0-9_²/.-]+|./gu)||[]){
   if(line&&ctx.measureText(line+token).width>maxWidth){lines.push(line);line=token;}else line+=token;
  }
  if(line)lines.push(line);
  return lines;
 }
 function labelGeometry(ctx,routes,rects,width,height){
  const placed=[];
  for(const edge of routes){
   if(edge.hidden||!edge.points?.length)continue;
   const maxWidth=width<700&&routes.length>8?106:Math.min(176,Math.max(92,width*.22)),lines=wrapLabel(ctx,edge.label||'依赖',maxWidth),textWidth=Math.max(...lines.map(line=>ctx.measureText(line).width),30),box={w:textWidth+12,h:lines.length*14+8};
   const segments=edge.points.slice(1).map((point,i)=>{const a=edge.points[i];return {a,b:point,length:Math.hypot(point.x-a.x,point.y-a.y),horizontal:Math.abs(point.y-a.y)<.1};}).sort((a,b)=>b.length-a.length);
   let choice=null;
   for(const segment of segments){
    for(const fraction of [.5,.25,.75]){
     const mx=segment.a.x+(segment.b.x-segment.a.x)*fraction,my=segment.a.y+(segment.b.y-segment.a.y)*fraction;
     for(const offset of [0,12,-12,24,-24]){
      const candidate={x:mx-box.w/2+(segment.horizontal?0:offset),y:my-box.h/2+(segment.horizontal?offset:0),w:box.w,h:box.h};
      if(candidate.x<10||candidate.y<37||candidate.x+candidate.w>width-10||candidate.y+candidate.h>height-18)continue;
      if(rects.some(rect=>overlap(candidate,rect,4))||placed.some(label=>overlap(candidate,label,3)))continue;
      choice=candidate;break;
     }
     if(choice)break;
    }
    if(choice)break;
   }
   if(!choice){const segment=segments[0],mx=segment?(segment.a.x+segment.b.x)/2:width/2,my=segment?(segment.a.y+segment.b.y)/2:height/2;choice={x:Math.max(10,Math.min(width-box.w-10,mx-box.w/2)),y:Math.max(37,Math.min(height-box.h-18,my-box.h/2)),w:box.w,h:box.h,congested:true};}
   placed.push({...choice,lines,edge});
  }
  return placed;
 }
 class FlowView{
  constructor(canvas,graph){this.canvas=canvas;this.graph=graph;this.ctx=canvas.getContext('2d');this.nodes=new Map(graph.nodes.map(n=>[n.id,n]));this.last=null;this.cachedKey='';this.transitionAnimations=[];}
  layout(state,w,h){
   const small=w<500,frame={x:8,y:8,w:w-16,h:h-35},rects=[],edges=[];let title='',backbone;
   const make=(n,x,y,width,height,extra={})=>rects.push({...n,x:x-width/2,y:y-height/2,w:width,h:height,...extra});
   if(state.autoView){
    title='语言主干 · L'+state.layer+'（第 '+(state.layer+1)+' / 40 层）';
    const ids=['mhc.attn_collapse','attn.aggregate','moe.combine','mhc.ffn_writeback'];
    if(this.graph.layers[state.layer]?.engram)ids.unshift('engram.inject');
    ids.forEach((id,i)=>{const n=this.nodes.get(id),cols=small?2:3,col=i%cols,row=Math.floor(i/cols),width=Math.min(174,(w-50)/cols-14);make(n,(col+.5)*(w-24)/cols+12,95+row*(h-140)/2,width,62);});
    ids.slice(1).forEach((id,i)=>edges.push({from:ids[i],to:id,kind:'data',label:'层内顺序'}));
   }else if(state.level===0){
    for(const g of this.graph.groups.filter(g=>state.scenario==='training'||g.id!=='training')){
     const [col,row]=positions[g.id]||[0,0],children=this.graph.nodes.filter(n=>n.group===g.id),cw=Math.min(small?84:156,(w-16)/4-32),ch=small?50:65;
     make({...g,group:g.id},(col+.5)*(w-16)/4+8,42+row*(h-106)/3,cw,ch,{children,container:true});
    }
    const core=rects.filter(r=>['mhc','attention','csa','moe'].includes(r.id));
    const left=Math.min(...core.map(r=>r.x))-7,top=Math.min(...core.map(r=>r.y))-22,right=Math.max(...core.map(r=>r.x+r.w))+7,bottom=Math.max(...core.map(r=>r.y+r.h))+9;
    backbone={x:left,y:top,w:right-left,h:bottom-top};
    for(const e of this.graph.edges){const from=this.nodes.get(e.from)?.group,to=this.nodes.get(e.to)?.group;if(!from||!to||from===to)continue;edges.push({...e,originalFrom:e.from,originalTo:e.to,from,to});}
   }else if(state.level===1){
    const children=this.graph.nodes.filter(n=>n.group===state.group),limit=small?6:12,index=Math.max(0,children.findIndex(n=>n.id===state.node)),page=Math.floor(index/limit),local=children.slice(page*limit,page*limit+limit),cols=small?2:3,rows=Math.ceil(local.length/cols),cellH=(h-82)/Math.max(2,rows);
    title=(this.graph.groups.find(g=>g.id===state.group)?.label||'模块')+' · '+children.length+' 个算子'+(children.length>limit?' · '+(page*limit+1)+'–'+(page*limit+local.length):'');
    local.forEach((n,i)=>make(n,(i%cols+.5)*(w-24)/cols+12,55+cellH*(Math.floor(i/cols)+.5),Math.min(170,(w-36)/cols-16),Math.min(58,cellH-14)));
    const ids=new Set(local.map(n=>n.id));edges.push(...this.graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)));
   }else{
    const n=this.nodes.get(state.node),incoming=[...new Set(this.graph.edges.filter(e=>e.to===n.id&&e.from!==n.id).map(e=>e.from))],outgoing=[...new Set(this.graph.edges.filter(e=>e.from===n.id&&e.to!==n.id).map(e=>e.to))].filter(id=>!incoming.includes(id));
    title=(this.graph.groups.find(g=>g.id===n.group)?.label||'模块')+' / '+n.label;
    const cw=Math.min(185,w*.24),ch=small?59:68;make(n,w*.5,h*.5,cw,ch,{selected:true});
    const side=(ids,inbound,xOverride,widthOverride)=>{const cols=1,rows=ids.length,cellH=(h-105)/Math.max(1,rows),height=Math.min(ch,cellH-8);ids.forEach((id,i)=>make(this.nodes.get(id),w*(xOverride??(inbound ? .16 : .84)),58+(i+.5)*cellH,widthOverride||cw,height));};
    if(incoming.length>5){const cols=Math.ceil(incoming.length/2),span=w*(outgoing.length ? .66 : .86),width=Math.min(132,span/cols-14),left=Math.max(width/2+7,48),right=span-width/2-7;incoming.forEach((id,i)=>{const col=i%cols,row=Math.floor(i/cols),x=cols===1?span/2:left+(right-left)*col/(cols-1);make(this.nodes.get(id),x,row?h-58:72,width,52);});side(outgoing,false,.91,Math.min(116,cw));}else{side(incoming,true);side(outgoing,false);}
    const ids=new Set(rects.map(r=>r.id));edges.push(...this.graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to));
   }
   const ids=new Set(rects.map(r=>r.id)),visible=edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&(state.scenario==='training'||e.kind!=='gradient'));
   return {rects,edges:aggregateEdges(visible,state.level===0?1:Infinity),frame,title,backbone};
  }
  draw(state,route,matching,progress=1){
   const {canvas,ctx}=this,b=canvas.getBoundingClientRect(),w=b.width,h=b.height;if(w<1||h<1)return {hits:[]};const ratio=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
   const key=[w,h,state.level,state.group,state.node,state.layer,state.autoView,state.scenario].join('|');
   if(key!==this.cachedKey){this.model=this.layout(state,w,h);this.routes=window.GraphRouting.route(this.model.rects,this.model.edges,{width:w,height:h});this.cachedKey=key;}
   const model=this.model,selected=this.nodes.get(state.node),routeSet=new Set(route),routeGroups=new Set(route.map(id=>this.nodes.get(id)?.group));
   if(model.backbone){const f=model.backbone;ctx.fillStyle='#edf5f4';ctx.strokeStyle='#cddfdd';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(f.x,f.y,f.w,f.h,12);ctx.fill();ctx.stroke();ctx.fillStyle='#52706f';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('语言主干 · 40 层',f.x+f.w/2,f.y+16);}
   if(state.level>0||state.autoView){ctx.fillStyle='#fcfefe';ctx.strokeStyle='#bfd8d6';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(model.frame.x,model.frame.y,model.frame.w,model.frame.h,12);ctx.fill();ctx.stroke();ctx.fillStyle='#39616c';ctx.font='600 13px system-ui';ctx.textAlign='left';let title=model.title;while(ctx.measureText(title).width>w-40)title=title.slice(0,-2);ctx.fillText(title,20,31);}
   for(const e of this.routes){if(!e.points?.length||e.hidden)continue;const active=state.level===0&&!state.autoView?(e.from===selected.group||e.to===selected.group):(e.from===state.node||e.to===state.node);e.active=active;const kinds=e.kinds||[e.kind],color=kinds.length===1&&kinds[0]==='gradient'?'#7962a5':active?'#347788':'#7699a4';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=active?2.3:1.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(kinds.length===1&&kinds[0]==='shared'?[6,4]:kinds.length===1&&kinds[0]==='conditional'?[2,4]:[]);
    const points=e.points;if(active&&progress<1){ctx.save();ctx.strokeStyle='#aec9d0';ctx.lineWidth=1.5;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();}let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);let remaining=active?total*progress:total;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++){const a=points[i-1],p=points[i],length=Math.hypot(p.x-a.x,p.y-a.y);if(remaining<length){ctx.lineTo(a.x+(p.x-a.x)*remaining/length,a.y+(p.y-a.y)*remaining/length);break;}ctx.lineTo(p.x,p.y);remaining-=length;}ctx.stroke();ctx.setLineDash([]);
    {const head=e.head||[];if(head.length===3){ctx.beginPath();head.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}ctx.beginPath();ctx.arc(e.start.x,e.start.y,active?3.1:2.5,0,Math.PI*2);ctx.fill();}
   }
   ctx.font=(w<500?'11':'12')+'px system-ui';const edgeLabels=labelGeometry(ctx,this.routes,model.rects,w,h);
   for(const item of edgeLabels){const active=item.edge.active;ctx.fillStyle=active?'#edf8f5ee':'#f8fbfbee';ctx.strokeStyle=active?'#73a9a4':'#bfd1d5';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(item.x,item.y,item.w,item.h,5);ctx.fill();ctx.stroke();ctx.fillStyle=active?'#1f5f67':'#3f626d';ctx.textAlign='center';item.lines.forEach((line,i)=>ctx.fillText(line,item.x+item.w/2,item.y+15+i*14));}
   for(const r of model.rects){const on=state.level===0&&!state.autoView?r.id===selected.group:r.id===state.node;const inPath=state.level===0&&!state.autoView?routeGroups.has(r.id):routeSet.has(r.id);ctx.fillStyle=on?'#e3f2ed':'#ffffff';ctx.strokeStyle=on?(colors[r.group]||'#347788'):'#b8cfd6';ctx.lineWidth=on?2:1;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,8);ctx.fill();ctx.stroke();ctx.fillStyle=colors[r.group]||'#347788';ctx.fillRect(r.x+1,r.y+8,3,r.h-16);ctx.fillStyle=on?'#183f4b':state.browse==='follow'&&!inPath?'#526e79':'#315361';ctx.font=(on?'600 ':'')+(w<500?'12':'13')+'px system-ui';ctx.textAlign='center';
    const label=w<500&&r.container?shorts[r.id]||r.label:r.label;let lines=[],line='';for(const token of label.match(/[A-Za-z0-9_²/.-]+|./gu)||[]){if(ctx.measureText(line+token).width>r.w-14&&line){lines.push(line);line=token;}else line+=token;}if(line)lines.push(line);lines=lines.slice(0,r.container?1:2);lines.forEach((s,i)=>{while(ctx.measureText(s).width>r.w-12)s=s.slice(0,-2)+'…';ctx.fillText(s,r.x+r.w/2,r.y+(r.container?20:r.h/2-(lines.length-1)*7)+i*14+4);});
    if(r.container){ctx.font='11px system-ui';ctx.fillStyle='#5b7982';const first=r.children[0]?.label||'';let preview=w<500?r.children.length+' 步':first+' · '+r.children.length+' 步';while(ctx.measureText(preview).width>r.w-14)preview=preview.slice(0,-2);ctx.fillText(preview,r.x+r.w/2,r.y+r.h-12);ctx.strokeStyle='#c9dbdd';ctx.lineWidth=1;ctx.strokeRect(r.x+9,r.y+r.h-6,r.w-18,2);}
   }
   this.last={...model,routes:this.routes,edgeLabels,width:w,height:h};const centered=[state.node,state.level,state.autoView].join('|');if(innerWidth<600&&this.lastCentered!==centered){const selectedRect=model.rects.find(r=>r.id===(state.level===0&&!state.autoView?selected.group:state.node));if(selectedRect)this.canvas.parentElement.scrollLeft=Math.max(0,selectedRect.x+selectedRect.w/2-this.canvas.parentElement.clientWidth/2);this.lastCentered=centered;}canvas.dataset.visibleNodes=model.rects.length;canvas.dataset.camera='{}';canvas.dataset.drawCount=+(canvas.dataset.drawCount||0)+1;
   return {hits:model.rects.map(r=>({id:r.id,x:r.x,y:r.y,w:r.w,h:r.h})),geometry:this.last};
  }
  capture(id){if(!this.last)return null;const box=this.last.rects.find(r=>r.id===id)||this.last.frame,copy=document.createElement('canvas');copy.width=this.canvas.width;copy.height=this.canvas.height;copy.getContext('2d').drawImage(this.canvas,0,0);return {copy,box};}
  transition(snapshot,state){if(!snapshot||innerWidth<600||matchMedia('(prefers-reduced-motion: reduce)').matches)return;this.transitionAnimations.forEach(a=>a.cancel());const host=this.canvas.parentElement,ghost=snapshot.copy;ghost.className='mp-transition-canvas';host.append(ghost);const outline=document.createElement('div');outline.className='mp-transition-outline';host.append(outline);const target=state.level===2?this.last.rects.find(r=>r.id===state.node):this.last.frame;const a=snapshot.box,b=target||this.last.frame;const animation=outline.animate([{left:a.x+'px',top:a.y+'px',width:a.w+'px',height:a.h+'px',opacity:1},{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px',opacity:0}],{duration:360,easing:'cubic-bezier(.2,.7,.2,1)'});const fade=ghost.animate([{opacity:1},{opacity:0}],{duration:280,easing:'ease-out'});this.transitionAnimations=[animation,fade];Promise.allSettled([animation.finished,fade.finished]).then(()=>{ghost.remove();outline.remove();});}
 }
 window.FlowView=FlowView;
})();

(function () {
  'use strict';

  const EPSILON = 1e-6;
  const CLEARANCE = 0.085;
  const PORT_GAP = 0.045;
  const LONG_SHARED_SEGMENT = 0.24;
  const IGNORED_KINDS = new Set(['parent', 'rack', 'layer', 'backbone']);
  const KIND_DEPTH = {
    data: 0,
    shared: -0.34,
    conditional: 0.36,
    gradient: 0.68,
    context: -0.66,
    reveal: 0.2
  };

  const finite = (value, fallback = 0) => Number.isFinite(+value) ? +value : fallback;
  const round = value => Math.round(value * 1000000) / 1000000;
  const point = value => ({x: round(finite(value?.x)), y: round(finite(value?.y)), z: round(finite(value?.z))});
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  const samePoint = (a, b) => Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON && Math.abs(a.z - b.z) < EPSILON;

  function edgeKey(edge, index) {
    return [edge.from, edge.to, edge.kind || '', edge.label || '', edge.connector || '', index].join('\u0001');
  }

  function centredSlot(index, count) {
    return index - (count - 1) / 2;
  }

  function rankedAxes(a, b) {
    const values = ['x', 'y', 'z'].map(axis => {
      const span = Math.max(0.2, (finite(a[axis === 'x' ? 'w' : axis === 'y' ? 'h' : 'd'], 0) + finite(b[axis === 'x' ? 'w' : axis === 'y' ? 'h' : 'd'], 0)) / 2);
      return {axis, score: Math.abs(finite(b[axis]) - finite(a[axis])) / span};
    });
    values.sort((left, right) => right.score - left.score || ['x', 'y', 'z'].indexOf(left.axis) - ['x', 'y', 'z'].indexOf(right.axis));
    return values.map(value => value.axis);
  }

  function makePort(object, other, slot, count, edge, entering, axis = rankedAxes(object, other)[0], signOverride = 0) {
    const sizeName = axis === 'x' ? 'w' : axis === 'y' ? 'h' : 'd';
    let sign = signOverride || Math.sign(finite(other[axis]) - finite(object[axis]));
    if (!sign) sign = entering ? -1 : 1;
    const result = point(object);
    result[axis] = finite(object[axis]) + sign * (finite(object[sizeName], 0) / 2 + CLEARANCE + PORT_GAP);

    const secondary = ['x', 'y', 'z'].filter(name => name !== axis);
    const firstSize = finite(object[secondary[0] === 'x' ? 'w' : secondary[0] === 'y' ? 'h' : 'd'], 0);
    const secondSize = finite(object[secondary[1] === 'x' ? 'w' : secondary[1] === 'y' ? 'h' : 'd'], 0);
    if(edge.mainChain){slot=0;count=1;}
    const columns = count<=6?Math.max(1,count):Math.ceil(Math.sqrt(Math.max(1, count)));
    const rows = Math.ceil(count / columns);
    const column = slot % columns, row = Math.floor(slot / columns);
    result[secondary[0]] += columns > 1 ? centredSlot(column, columns) * (firstSize * 0.52 / (columns - 1)) : 0;
    result[secondary[1]] += rows > 1 ? centredSlot(row, rows) * (secondSize * 0.52 / (rows - 1)) : 0;
    result[secondary[0]]+=finite(edge.portOffset,0);
    return {point: point(result), axis, sign};
  }

  function choosePort(object, other, slot, count, edge, entering, obstacles) {
    const axes = edge.portAxis?[edge.portAxis]:rankedAxes(object, other);
    for (const axis of axes) {
      const toward = Math.sign(finite(other[axis]) - finite(object[axis])) || (entering ? -1 : 1);
      for (const sign of [toward, -toward]) {
        const candidate = makePort(object, other, slot, count, edge, entering, axis, sign);
        if (!pointBlocked(candidate.point, obstacles)) return candidate;
      }
    }
    return makePort(object, other, slot, count, edge, entering);
  }

  function makeObstacle(object) {
    const x = finite(object.x), y = finite(object.y), z = finite(object.z);
    const w = Math.max(0, finite(object.w)), h = Math.max(0, finite(object.h)), d = Math.max(0, finite(object.d));
    return {
      id: object.id,
      min: {x: x - w / 2 - CLEARANCE, y: y - h / 2 - CLEARANCE, z: z - d / 2 - CLEARANCE},
      max: {x: x + w / 2 + CLEARANCE, y: y + h / 2 + CLEARANCE, z: z + d / 2 + CLEARANCE}
    };
  }

  function inside(value, min, max) {
    return value > min + EPSILON && value < max - EPSILON;
  }

  function pointBlocked(candidate, obstacles) {
    return obstacles.some(box => inside(candidate.x, box.min.x, box.max.x) && inside(candidate.y, box.min.y, box.max.y) && inside(candidate.z, box.min.z, box.max.z));
  }

  function segmentAxis(a, b) {
    const changed = ['x', 'y', 'z'].filter(axis => Math.abs(a[axis] - b[axis]) > EPSILON);
    return changed.length === 1 ? changed[0] : changed.length === 0 ? null : false;
  }

  function segmentBlocked(a, b, obstacles) {
    const axis = segmentAxis(a, b);
    if (axis === false) return true;
    if (axis === null) return pointBlocked(a, obstacles);
    const fixed = ['x', 'y', 'z'].filter(name => name !== axis);
    const low = Math.min(a[axis], b[axis]);
    const high = Math.max(a[axis], b[axis]);
    return obstacles.some(box => {
      if (!fixed.every(name => inside(a[name], box.min[name], box.max[name]))) return false;
      return high > box.min[axis] + EPSILON && low < box.max[axis] - EPSILON;
    });
  }

  function cleanPath(points) {
    const deduped = [];
    points.forEach(raw => {
      const current = point(raw);
      if (!deduped.length || !samePoint(deduped[deduped.length - 1], current)) deduped.push(current);
    });
    let changed = true;
    while (changed && deduped.length > 2) {
      changed = false;
      for (let index = 1; index < deduped.length - 1; index++) {
        const before = segmentAxis(deduped[index - 1], deduped[index]);
        const after = segmentAxis(deduped[index], deduped[index + 1]);
        const monotonic = before && before === after &&
          (deduped[index][before] - deduped[index - 1][before]) * (deduped[index + 1][before] - deduped[index][before]) > 0;
        if (monotonic) {
          deduped.splice(index, 1);
          changed = true;
          break;
        }
      }
    }
    return deduped;
  }

  function pathBlocked(points, obstacles) {
    if (points.some(candidate => pointBlocked(candidate, obstacles))) return true;
    for (let index = 1; index < points.length; index++) {
      if (segmentBlocked(points[index - 1], points[index], obstacles)) return true;
    }
    return false;
  }

  function permutations(values) {
    if (values.length < 2) return [values.slice()];
    const result = [];
    values.forEach((value, index) => {
      const rest = values.slice(0, index).concat(values.slice(index + 1));
      permutations(rest).forEach(tail => result.push([value].concat(tail)));
    });
    return result;
  }

  const AXIS_ORDERS = permutations(['x', 'y', 'z']);

  function manhattanCandidates(start, end) {
    const result = [];
    AXIS_ORDERS.forEach(order => {
      const cursor = point(start);
      const candidate = [point(start)];
      order.forEach(axis => {
        if (Math.abs(cursor[axis] - end[axis]) < EPSILON) return;
        cursor[axis] = end[axis];
        candidate.push(point(cursor));
      });
      result.push(cleanPath(candidate));
    });
    return result;
  }

  function pathLength(points) {
    let total = 0;
    for (let index = 1; index < points.length; index++) total += distance(points[index - 1], points[index]);
    return total;
  }

  function bestManhattan(start, end, obstacles) {
    return manhattanCandidates(start, end)
      .filter(candidate => !pathBlocked(candidate, obstacles))
      .sort((a, b) => pathLength(a) - pathLength(b) || a.length - b.length)[0] || null;
  }

  class MinHeap {
    constructor() { this.items = []; }
    push(item) {
      this.items.push(item);
      let index = this.items.length - 1;
      while (index) {
        const parent = (index - 1) >> 1;
        if (this.items[parent].score <= item.score) break;
        this.items[index] = this.items[parent];
        index = parent;
      }
      this.items[index] = item;
    }
    pop() {
      const first = this.items[0];
      const last = this.items.pop();
      if (this.items.length && last) {
        let index = 0;
        while (true) {
          let child = index * 2 + 1;
          if (child >= this.items.length) break;
          if (child + 1 < this.items.length && this.items[child + 1].score < this.items[child].score) child++;
          if (this.items[child].score >= last.score) break;
          this.items[index] = this.items[child];
          index = child;
        }
        this.items[index] = last;
      }
      return first;
    }
    get length() { return this.items.length; }
  }

  function uniqueSorted(values) {
    const seen = new Set();
    return values.filter(value => {
      const key = round(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(round).sort((a, b) => a - b);
  }

  function planePath(start, end, z, obstacles) {
    const direct = bestManhattan(start, end, obstacles);
    if (direct) return direct;
    const relevant = obstacles.filter(box => inside(z, box.min.z, box.max.z));
    const xs = uniqueSorted([start.x, end.x, ...relevant.flatMap(box => [box.min.x, box.max.x])]);
    const ys = uniqueSorted([start.y, end.y, ...relevant.flatMap(box => [box.min.y, box.max.y])]);
    const startX = xs.indexOf(round(start.x)), startY = ys.indexOf(round(start.y));
    const endX = xs.indexOf(round(end.x)), endY = ys.indexOf(round(end.y));
    const keyOf = (x, y, axis) => `${x},${y},${axis}`;
    const heap = new MinHeap();
    const costs = new Map(), parents = new Map();
    const startKey = keyOf(startX, startY, 2);
    costs.set(startKey, 0);
    heap.push({x: startX, y: startY, axis: 2, cost: 0, score: distance(start, end)});
    let finish = null;
    let visits = 0;
    while (heap.length && visits++ < 50000) {
      const current = heap.pop();
      const currentKey = keyOf(current.x, current.y, current.axis);
      if (current.cost > costs.get(currentKey) + EPSILON) continue;
      if (current.x === endX && current.y === endY) { finish = current; break; }
      const neighbors = [
        [current.x - 1, current.y, 0], [current.x + 1, current.y, 0],
        [current.x, current.y - 1, 1], [current.x, current.y + 1, 1]
      ];
      neighbors.forEach(([nextX, nextY, axis]) => {
        if (nextX < 0 || nextY < 0 || nextX >= xs.length || nextY >= ys.length) return;
        const a = {x: xs[current.x], y: ys[current.y], z};
        const b = {x: xs[nextX], y: ys[nextY], z};
        if (pointBlocked(b, obstacles) || segmentBlocked(a, b, obstacles)) return;
        const bend = current.axis === 2 || current.axis === axis ? 0 : 0.11;
        const nextCost = current.cost + distance(a, b) + bend;
        const nextKey = keyOf(nextX, nextY, axis);
        if (nextCost + EPSILON >= (costs.get(nextKey) ?? Infinity)) return;
        costs.set(nextKey, nextCost);
        parents.set(nextKey, currentKey);
        heap.push({x: nextX, y: nextY, axis, cost: nextCost, score: nextCost + Math.abs(xs[nextX] - end.x) + Math.abs(ys[nextY] - end.y)});
      });
    }
    if (!finish) return null;
    const reversed = [];
    let cursor = keyOf(finish.x, finish.y, finish.axis);
    while (cursor) {
      const [x, y] = cursor.split(',').map(Number);
      reversed.push({x: xs[x], y: ys[y], z});
      cursor = parents.get(cursor);
    }
    return cleanPath(reversed.reverse());
  }

  function routeViaPoints(start, vias, end, obstacles) {
    const anchors = [start].concat(vias.map(point), [end]);
    const result = [point(start)];
    for (let index = 1; index < anchors.length; index++) {
      const part = bestManhattan(anchors[index - 1], anchors[index], obstacles);
      if (!part) return null;
      result.push(...part.slice(1));
    }
    return cleanPath(result);
  }

  function laneRoute(start, end, z, obstacles) {
    const startAnchor = {x: start.x, y: start.y, z};
    const endAnchor = {x: end.x, y: end.y, z};
    let launch = bestManhattan(start, startAnchor, obstacles);
    let landing = bestManhattan(endAnchor, end, obstacles);
    if (!launch || !landing) return null;
    const middle = planePath(startAnchor, endAnchor, z, obstacles);
    if (!middle) return null;
    return cleanPath(launch.concat(middle.slice(1), landing.slice(1)));
  }

  function axisSegment(a, b) {
    const axis = segmentAxis(a, b);
    if (!axis) return null;
    const fixed = ['x', 'y', 'z'].filter(name => name !== axis);
    return {axis, fixed: fixed.map(name => a[name]), low: Math.min(a[axis], b[axis]), high: Math.max(a[axis], b[axis])};
  }

  function sharedLength(path, priorSegments) {
    let shared = 0;
    for (let index = 1; index < path.length; index++) {
      const current = axisSegment(path[index - 1], path[index]);
      if (!current) continue;
      priorSegments.forEach(previous => {
        if (previous.axis !== current.axis) return;
        if (previous.fixed.some((value, fixedIndex) => Math.abs(value - current.fixed[fixedIndex]) > EPSILON)) return;
        shared += Math.max(0, Math.min(previous.high, current.high) - Math.max(previous.low, current.low));
      });
    }
    return shared;
  }

  function storeSegments(path, target) {
    for (let index = 1; index < path.length; index++) {
      const segment = axisSegment(path[index - 1], path[index]);
      if (segment) target.push(segment);
    }
  }

  function route(model) {
    const objects = Array.isArray(model?.objects) ? model.objects : [];
    const edges = Array.isArray(model?.edges) ? model.edges : [];
    const objectById = new Map(objects.map(object => [object.id, object]));
    const obstacles = objects.filter(object => !IGNORED_KINDS.has(object.kind) && finite(object.w) >= 0 && finite(object.h) >= 0 && finite(object.d) >= 0).map(makeObstacle);
    const decorated = edges.map((edge, index) => ({edge, index, key: edgeKey(edge, index)}));
    const outgoing = new Map(), incoming = new Map(), pairGroups = new Map();
    decorated.forEach(item => {
      if (!outgoing.has(item.edge.from)) outgoing.set(item.edge.from, []);
      if (!incoming.has(item.edge.to)) incoming.set(item.edge.to, []);
      const pairKey = `${item.edge.from}\u0001${item.edge.to}`;
      if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
      outgoing.get(item.edge.from).push(item);
      incoming.get(item.edge.to).push(item);
      pairGroups.get(pairKey).push(item);
    });
    [outgoing, incoming, pairGroups].forEach(groups => groups.forEach(group => group.sort((a, b) => a.key.localeCompare(b.key))));

    const bounds = obstacles.reduce((result, box) => ({
      minZ: Math.min(result.minZ, box.min.z), maxZ: Math.max(result.maxZ, box.max.z)
    }), {minZ: Infinity, maxZ: -Infinity});
    if (!Number.isFinite(bounds.minZ)) { bounds.minZ = -1; bounds.maxZ = 1; }
    const priorSegments = [];

    return decorated.map(item => {
      const edge = item.edge;
      const source = objectById.get(edge.from), target = objectById.get(edge.to);
      if (!source || !target) {
        return {
          ...edge,
          worldPoints: [],
          routeIssue: {
            code: 'missing-endpoint',
            message: `Cannot route ${edge.from} -> ${edge.to}: ${!source ? edge.from : edge.to} is absent from model.objects.`
          }
        };
      }
      const face=(a,b,e)=>{const axis=e.portAxis||rankedAxes(a,b)[0];return axis+':'+(Math.sign(b[axis]-a[axis])||1);};
      const sourceFace=face(source,target,edge),targetFace=face(target,source,edge);
      const ordered=(items,object,entering,key)=>items.filter(i=>{const other=objectById.get(entering?i.edge.from:i.edge.to);return other&&face(object,other,i.edge)===key;}).sort((a,b)=>{const first=['x','y','z'].find(axis=>axis!==key[0]),pa=objectById.get(entering?a.edge.from:a.edge.to),pb=objectById.get(entering?b.edge.from:b.edge.to);return pa[first]-pb[first]||a.key.localeCompare(b.key);});
      if(edge.curve){
        const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
        let p0,p3,c1,c2;
        if(edge.curve==='loop'){
          const lane=Math.min(source.y,target.y)-5.3,depth=Math.max(source.z,target.z)+2;
          p0={x:source.x+source.w/2+.15,y:source.y,z:source.z};
          p3={x:target.x-target.w/2-.15,y:target.y,z:target.z};
          c1={x:p0.x+2.4,y:lane,z:depth};
          c2={x:p3.x-2.4,y:lane,z:depth};
        }else if(edge.curve==='cache'){
          p0={x:source.x-source.w/2-.1,y:source.y,z:source.z};p3={x:target.x-target.w/2-.1,y:target.y+.21,z:target.z};
          c1={x:-2.5,y:source.y-.3,z:source.z};c2={x:-2.5,y:target.y+1.1,z:target.z};
        }else{
          const goingUp=edge.curve==='prepare',offset=goingUp?-.4:.4;
          p0={x:source.x+offset,y:source.y+(goingUp?1:-1)*(source.h/2+.1),z:source.z};
          p3={x:target.x+offset,y:target.y+(goingUp?-1:1)*(target.h/2+.1),z:target.z};
          c1=mix(p0,p3,.33);c2=mix(p0,p3,.67);c1.x+=goingUp?-.48:.48;c2.x+=goingUp?-.48:.48;
        }
        const curve=Array.from({length:49},(_,i)=>{const t=i/48;return mix(mix(mix(p0,c1,t),mix(c1,c2,t),t),mix(mix(c1,c2,t),mix(c2,p3,t),t),t);});
        if(!curve.some(p=>pointBlocked(p,obstacles)))return{...edge,worldPoints:curve,curveMode:true};
      }
      const sourceGroup = ordered(outgoing.get(edge.from)||[item],source,false,sourceFace);
      const targetGroup = ordered(incoming.get(edge.to)||[item],target,true,targetFace);
      const sourceSlot = sourceGroup.indexOf(item), targetSlot = targetGroup.indexOf(item);
      const startPort = choosePort(source, target, sourceSlot, sourceGroup.length, edge, false, obstacles);
      const endPort = choosePort(target, source, targetSlot, targetGroup.length, edge, true, obstacles);
      const start = startPort.point, end = endPort.point;
      const maxLead=startPort.axis===endPort.axis&&startPort.sign!==endPort.sign?Math.min(.65,Math.abs(end[startPort.axis]-start[startPort.axis])*.36):.65;
      const lead = port => {for(const length of [.65,.5,.35,.2].map(n=>Math.min(n,maxLead))){const p={...port.point};p[port.axis]+=port.sign*length;if(!segmentBlocked(port.point,p,obstacles))return p;}return port.point;};
      const startLead=lead(startPort),endLead=lead(endPort);
      const withApproach=path=>cleanPath([start,...path,end]);
      const pair = pairGroups.get(`${edge.from}\u0001${edge.to}`) || [item];
      const pairSlot = centredSlot(pair.indexOf(item), pair.length);
      const kindDepth = finite(KIND_DEPTH[edge.kind], 0);
      const averageZ = (start.z + end.z) / 2;
      const desiredZ = round(model.mode === 'module' ? averageZ : averageZ + kindDepth + pairSlot * 0.19 + centredSlot(item.index % 5, 5) * 0.018);
      const externalLow = round(bounds.minZ - 0.22 - (item.index % 7) * 0.09);
      const externalHigh = round(bounds.maxZ + 0.22 + (item.index % 7) * 0.09);
      const zCandidates = uniqueSorted([
        desiredZ, ...(model.mode==='module'?[start.z,end.z]:[]),
        desiredZ - 0.26, desiredZ + 0.26,
        desiredZ - 0.52, desiredZ + 0.52,
        externalLow, externalHigh
      ]).sort((a, b) => Math.abs(a - desiredZ) - Math.abs(b - desiredZ) || a - b);

      const candidates = [];
      if(edge.mainChain&&!segmentBlocked(start,end,obstacles))candidates.push({path:[start,end],source:'direct',lane:desiredZ});
      if (Array.isArray(edge.via) && edge.via.length) {
        const viaPath = routeViaPoints(startLead, edge.via, endLead, obstacles);
        if (viaPath) candidates.push({path: withApproach(viaPath), source: 'via', lane: null});
      }
      zCandidates.forEach(z => {
        const candidate = laneRoute(startLead, endLead, z, obstacles);
        if (candidate) candidates.push({path: withApproach(candidate), source: 'channel', lane: z});
      });
      zCandidates.forEach(z=>{const compact=laneRoute(start,end,z,obstacles);if(compact)candidates.push({path:compact,source:'compact',lane:z});});
      const ranked = candidates.map(candidate => ({
        ...candidate,
        shared: sharedLength(candidate.path, priorSegments),
        score: (candidate.source==='compact'?(model.mode==='module'?.35:1.5):0) + pathLength(candidate.path) + (candidate.path.length - 2) * (model.mode==='module'?.18:.055) + (candidate.source === 'via' ? -0.18 : Math.abs(candidate.lane - desiredZ) * 0.12)
      })).sort((a, b) => {
        const aShared = a.shared > LONG_SHARED_SEGMENT ? 1 : 0;
        const bShared = b.shared > LONG_SHARED_SEGMENT ? 1 : 0;
        return aShared - bShared || a.score - b.score || a.shared - b.shared;
      });
      const chosen = model.mode==='module'?ranked[0]:(ranked.find(candidate => candidate.source === 'via' && candidate.shared <= LONG_SHARED_SEGMENT) || ranked[0]);
      if (chosen && chosen.shared <= LONG_SHARED_SEGMENT) {
        storeSegments(chosen.path, priorSegments);
        return {...edge, worldPoints: chosen.path};
      }

      const fallback = chosen?.path || manhattanCandidates(start, end)[0];
      storeSegments(fallback, priorSegments);
      return {
        ...edge,
        worldPoints: fallback,
        routeIssue: chosen ? {
          code: 'shared-channel',
          message: `No isolated channel was found for ${edge.from} -> ${edge.to}.`,
          sharedLength: round(chosen.shared),
          attempts: candidates.length
        } : {
          code: 'no-safe-route',
          message: `No obstacle-free orthogonal route was found for ${edge.from} -> ${edge.to}.`,
          attempts: zCandidates.length + (Array.isArray(edge.via) && edge.via.length ? 1 : 0)
        }
      };
    });
  }

  window.MPSpatialEdges = Object.freeze({route});
}());

(function () {
  'use strict';

  const BRANCHES = [
    {
      id: 'pretrain',
      label: '预训练',
      shortLabel: '预训练目标与参数分工',
      representative: 'training.next_token',
      nodeIds: [
        'training.next_token',
        'training.vision_contrastive',
        'training.vision_ar',
        'training.load_balance',
        'training.qat',
        'training.backward',
        'training.update_linear',
        'training.update_norm',
        'training.update_tables'
      ]
    },
    {
      id: 'posttrain',
      label: '后训练主干',
      shortLabel: 'SFT、RL、OPD 与 Backbone',
      representative: 'training.sft',
      nodeIds: [
        'training.sft',
        'training.rl_reward',
        'training.rl_objective',
        'training.opd',
        'training.qat',
        'training.backward',
        'training.update_backbone_post'
      ]
    },
    {
      id: 'draft',
      label: 'DSpark 专用',
      shortLabel: '专用目标与梯度隔离',
      representative: 'training.dspark_loss',
      nodeIds: [
        'training.dspark_loss',
        'training.dspark_stop_gradient',
        'training.update_dspark'
      ]
    }
  ];

  const BRANCH_BY_ID = new Map(BRANCHES.map(branch => [branch.id, branch]));
  const DEFAULT_BRANCH_FOR_NODE = new Map();
  for (const branch of [BRANCH_BY_ID.get('draft'), BRANCH_BY_ID.get('posttrain'), BRANCH_BY_ID.get('pretrain')]) {
    for (const id of branch.nodeIds) if (!DEFAULT_BRANCH_FOR_NODE.has(id)) DEFAULT_BRANCH_FOR_NODE.set(id, branch.id);
  }
  DEFAULT_BRANCH_FOR_NODE.set('training.backward', 'pretrain');
  DEFAULT_BRANCH_FOR_NODE.set('training.qat', 'pretrain');

  const PLACEMENTS = {
    pretrain: {
      'training.next_token': [-4.25, 1.75, 0, 2.75, .7],
      'training.vision_contrastive': [-4.25, .82, -.08, 2.75, .7],
      'training.vision_ar': [-4.25, -.11, .08, 2.75, .7],
      'training.load_balance': [-4.25, -1.04, -.08, 2.75, .7],
      'training.qat': [-4.25, -1.97, .08, 2.75, .7],
      'training.backward': [-.45, -.1, 0, 2.45, 3.45],
      'training.update_linear': [3.65, 1.25, -.08, 2.9, .76],
      'training.update_norm': [3.65, -.1, .08, 2.9, .76],
      'training.update_tables': [3.65, -1.45, -.08, 2.9, .76]
    },
    posttrain: {
      'training.sft': [-4.3, 1.72, 0, 2.7, .72],
      'training.rl_reward': [-4.3, .53, -.08, 2.7, .72],
      'training.rl_objective': [-1.45, .53, .08, 2.65, .72],
      'training.opd': [-4.3, -.66, 0, 2.7, .72],
      'training.qat': [-4.3, -1.85, -.08, 2.7, .72],
      'training.backward': [1.1, -.1, 0, 2.45, 3.05],
      'training.update_backbone_post': [4.35, -.1, -.08, 2.9, .86]
    },
    draft: {
      'training.dspark_loss': [-3.55, .45, 0, 2.85, .9],
      'training.update_dspark': [1.3, 1.15, -.08, 3.05, .86],
      'training.dspark_stop_gradient': [1.3, -1.0, .08, 3.05, .86]
    }
  };

  const TITLES = {
    pretrain: '预训练 · 多个目标分别汇入主任务反传，再按参数类别更新',
    posttrain: '后训练主干 · 各阶段主目标汇入反传，只更新 Backbone',
    draft: 'DSpark 专用 · 专用目标只更新 DSpark；通向 Backbone 的梯度在边界停止'
  };

  function branchForNode(nodeId) {
    return DEFAULT_BRANCH_FOR_NODE.get(nodeId) || 'pretrain';
  }

  function validBranch(value) {
    return BRANCH_BY_ID.has(value) ? value : null;
  }

  function graphNodeMap(graph) {
    return new Map((graph?.nodes || []).map(node => [node.id, node]));
  }

  function copyBranches(activeId) {
    return BRANCHES.map(branch => ({
      id: branch.id,
      label: branch.label,
      shortLabel: branch.shortLabel,
      representative: branch.representative,
      nodeIds: branch.nodeIds.slice(),
      active: branch.id === activeId
    }));
  }

  function build(graph, state = {}) {
    const nodes = graphNodeMap(graph);
    const explicit = validBranch(state.trainingBranch);
    const inferred = nodes.get(state.node)?.group === 'training' ? branchForNode(state.node) : null;
    const branchId = explicit || inferred || 'pretrain';
    const branch = BRANCH_BY_ID.get(branchId);
    const selected = nodes.get(state.node)?.group === 'training' ? state.node : branch.representative;
    const routeSet = new Set(Array.isArray(state.route) ? state.route : []);
    const matchSet = state.matching instanceof Set ? state.matching : new Set(state.matching || []);
    const objects = [];

    objects.push({
      id: '__parent', x: 0, y: -.05, z: 0, w: branchId==='posttrain'?15.4:11.95, h: 6.15, d: 2.45,
      kind: 'parent', virtual: true, noHit: true,
      label: `训练信号 · ${branch.label}`
    });

    for (const id of branch.nodeIds) {
      const node = nodes.get(id);
      const place = PLACEMENTS[branchId][id];
      if (!node || !place) continue;
      objects.push({
        id, x: branchId==='posttrain'?(id==='training.rl_objective'?-1.85:id==='training.backward'?1.85:id==='training.update_backbone_post'?5.55:-5.55):place[0], y: place[1], z: place[2], w: place[3], h: place[4], d: .42,
        kind: 'node', group: 'training', label: node.label,
        labelSize: 13, maxLines: 3,
        selected: id === selected,
        onRoute: routeSet.has(id),
        muted: matchSet.size > 0 && !matchSet.has(id)
      });
    }

    const visibleIds = new Set(branch.nodeIds);
    const edges = (graph?.edges || [])
      .filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to) && edge.from !== edge.to)
      .map(edge => ({...edge}));

    return {
      mode: 'module',
      objects,
      edges:edges.map(e=>({...e,portAxis:'x'})),
      selected,
      parentId: '__parent',
      title: TITLES[branchId],
      spanX: branchId==='posttrain'?17.1:13.9,
      spanY: 8.35,
      trainingBranch: branchId,
      trainingBranches: copyBranches(branchId)
    };
  }

  window.MPTrainingScene = {
    branches: copyBranches(null),
    branchForNode,
    build
  };
}());

(function () {
  'use strict';

  const COLORS = {
    input: '#337fa4', vision: '#a47b37', engram: '#8270a4', mhc: '#bd7762',
    attention: '#37899d', csa: '#528e74', moe: '#a77699', cache: '#668395',
    output: '#3b9488', dspark: '#c59445', training: '#826ca8'
  };
  const SHORT = {
    input: '文字输入', vision: '图像支路', engram: 'Engram', mhc: 'mHC',
    attention: '注意力', csa: '跨层共享', moe: '专家网络', cache: '缓存与索引',
    output: '输出生成', dspark: '草稿支路', training: '训练信号'
  };
  const MODULE_LABELS = {
    'csa.compressor_projection':'主 KV 压缩\n投影',
    'csa.compressor_gate':'组内压缩\n权重',
    'csa.compressor_pool':'非重叠压缩\n汇总',
    'dspark.target_hiddens':'DSpark 主干\n条件状态',
    'dspark.main_projection':'草稿主干\n条件投影',
    'dspark.noise_slots':'五个草稿\n输入槽',
    'dspark.blocks':'三层草稿\nTransformer',
    'dspark.attention':'草稿注意力\n半自回归',
    'dspark.scheduler':'吞吐量感知\n验证长度调度',
    'cache.index_fp4':'Indexer Q/K\n部署 FP4\n参考数值模拟',
    'cache.main_fp4':'主 KV\n部署 FP4\n参考数值模拟'
  };
  const CORE = new Set(['mhc', 'attention', 'csa', 'moe']);
  const STAGE_LABELS = {
    input: ['输入身份与数值表示'],
    vision: ['图像与网格准备', '视觉编码', '视觉层更新', '邻域重排与语言对齐'],
    engram: ['构造 n-gram 地址', '查表、门控与注入'],
    attention: ['准备查询 Q 与窗口 K/V', '确定可见位置并得到权重', '汇总 Value 并回投影'],
    csa: ['压缩主 KV 并建立索引', '筛选候选并共享 KV', '复用来源与 CED 编解码'],
    moe: ['计算路由并选择专家', '专家并行加工后汇总'],
    cache: ['缓存格式与共享对象', '重建局部尾窗'],
    output: ['从隐藏状态得到概率', '选出、追加并进入下一轮'],
    dspark: ['准备草稿条件与输入槽', '生成五位置草稿候选', '置信度、调度、验证与采用', '提交并回到生成主循环'],
    training: ['建立训练目标', '区分主干与草稿梯度', '反向传播与参数分工', '完成各类参数更新']
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));





  const labelFont = (size) => `600 ${size}px system-ui, "Microsoft YaHei", sans-serif`;
  const labelScriptFont = (size) => `600 ${Math.max(8, Math.round(size * 0.74))}px system-ui, "Microsoft YaHei", sans-serif`;
  const labelCodeFont = (size) => `600 ${Math.max(9, Math.round(size * 0.94))}px ui-monospace, SFMono-Regular, Consolas, monospace`;



  function scriptParts(token) {
    const sub = /^([A-Za-z])_([A-Za-z0-9]+)$/.exec(token) || /^([A-Za-z])(\d+)$/.exec(token);
    if (sub) return [{ text: sub[1] }, { text: sub[2], script: 'sub' }];
    const sup = /^([A-Za-z])\^(\S+)$/.exec(token);
    return sup ? [{ text: sup[1] }, { text: sup[2], script: 'sup' }] : null;
  }

  function labelRuns(line) {
    const segments = window.DSFormulaMath?.segments?.(line);
    if (!segments) return [{ text: String(line ?? '') }];
    const runs = [];
    for (const segment of segments) {
      if (segment.kind === 'code') { runs.push({ text: segment.value, code: true }); continue; }
      const parts = segment.kind === 'math' ? scriptParts(segment.value) : null;
      if (parts) runs.push(...parts); else runs.push({ text: segment.value });
    }

    return runs.reduce((merged, run) => {
      const last = merged[merged.length - 1];
      if (last && !last.script && !last.code && !run.script && !run.code) last.text += run.text;
      else merged.push({ ...run });
      return merged;
    }, []);
  }

  const runFont = (run, size) =>
    run.code ? labelCodeFont(size) : run.script ? labelScriptFont(size) : labelFont(size);

  function measureRuns(ctx, runs, size) {
    let width = 0;
    for (const run of runs) { ctx.font = runFont(run, size); width += ctx.measureText(run.text).width; }
    return width;
  }


  function fillRuns(ctx, runs, centerX, baseline, size) {
    const align = ctx.textAlign;
    ctx.textAlign = 'left';
    let x = centerX - measureRuns(ctx, runs, size) / 2;
    for (const run of runs) {
      ctx.font = runFont(run, size);
      const dy = run.script === 'sub' ? Math.round(size * 0.22) : run.script === 'sup' ? -Math.round(size * 0.34) : 0;
      ctx.fillText(run.text, x, baseline + dy);
      x += ctx.measureText(run.text).width;
    }
    ctx.textAlign = align;
  }
  const finite = (value, fallback) => Number.isFinite(+value) ? +value : fallback;

  class SpatialFlowView {
    constructor(canvas, graph) {
      this.canvas = canvas;
      this.graph = graph;
      this.ctx = canvas.getContext('2d');
      this.nodes = new Map(graph.nodes.map(node => [node.id, node]));
      this.groups = new Map(graph.groups.map(group => [group.id, group]));
      this.delegate = new window.FlowView(canvas, graph);
      this.camera = {yaw: -.16, pitch: .22};
      this.last = null;
      this.mode = 'space';
      this.transitionDuration = 560;
      this.transitionAnimations = [];
      this.transitionElements = [];
    }

    orbit(deltaYaw, deltaPitch) {
      this.camera.yaw += finite(deltaYaw, 0);
      this.camera.pitch = clamp(this.camera.pitch + finite(deltaPitch, 0), -.72, .72);
      return {...this.camera};
    }

    draw(state, route, matching, edgeProgress = 1) {
      this.canvas.dataset.group=state.group||this.nodes.get(state.node)?.group||'';
      if (state.layout === 'diagram') {
        this.mode = 'diagram';
        this.canvas.classList.remove('mp-spatial-canvas');
        this.canvas.parentElement?.classList.remove('mp-spatial-viewport');
        const result = this.delegate.draw({...state,level:2,autoView:false}, route, matching, edgeProgress);
        this.last = this.delegate.last ? {...this.delegate.last, spatial: false, mode: 'diagram'} : null;
        this.canvas.dataset.spatialMode = 'diagram';
        return {hits: result.hits, geometry: this.last};
      }

      this.mode = 'space';
      this.canvas.classList.add('mp-spatial-canvas');
      this.canvas.parentElement?.classList.add('mp-spatial-viewport');
      this.camera = {
        yaw: finite(state.yaw, this.camera.yaw),
        pitch: clamp(finite(state.pitch, this.camera.pitch), -.72, .72), zoom:clamp(finite(state.zoom,1),.65,2.2), panX:finite(state.panX,0), panY:finite(state.panY,0)
      };

      const box = this.canvas.getBoundingClientRect();
      const width = box.width, height = box.height;
      if (width < 1 || height < 1) return {hits: [], geometry: null};
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
        this.canvas.width = Math.round(width * ratio);
        this.canvas.height = Math.round(height * ratio);
      }
      this.ratio = ratio;
      const ctx = this.ctx;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const routeSet = new Set(Array.isArray(route) ? route : []);
      const matchSet = matching instanceof Set ? matching : new Set(matching || []);
      const model = state.autoView
        ? this.layerLayout(state)
        : state.level === 0
          ? this.globalLayout(state, routeSet, matchSet)
          : state.level===2 ? this.calculationLayout(state) : state.group==='training'&&window.MPTrainingScene ? window.MPTrainingScene.build(this.graph,state) : this.moduleLayout(state, routeSet, matchSet);
      const camera = this.makeCamera(model, width, height);
      const geometry = this.projectModel(model, camera, state);
      this.paint(model, geometry, state, routeSet, edgeProgress, width, height);

      this.last = {
        ...model,
        rects: geometry.rects,
        routes: geometry.routes,
        width,
        height,
        camera: {...this.camera},
        frame: {x: 8, y: 8, w: width - 16, h: height - 34},
        annotations:this.stageLabelBoxes||[],
        parentRect: geometry.parentRect,
        backbone: geometry.backbone,
        spatial: true,
        mode: model.mode, scope:{level:state.level,group:state.group,autoView:state.autoView,layer:state.layer,node:state.node}
      };
      const hits = geometry.rects.filter(rect => !rect.noHit && !rect.virtual).map(rect => ({
        id: rect.id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, depth: rect.depth
      }));
      const centerKey = [state.level, state.group, state.node, state.layer, state.autoView].join('|');
      if (window.innerWidth < 600 && this.lastCentered !== centerKey) {
        const selectedId = state.level === 0 && !state.autoView ? this.nodes.get(state.node)?.group : state.node;
        const selected = geometry.rects.find(rect => rect.id === selectedId);
        if (selected && this.canvas.parentElement) {
          this.canvas.parentElement.scrollLeft = Math.max(0, selected.x + selected.w / 2 - this.canvas.parentElement.clientWidth / 2);
        }
        this.lastCentered = centerKey;
      }
      this.canvas.dataset.visibleNodes = String(hits.length);
      this.canvas.dataset.camera = JSON.stringify(this.camera);
      this.canvas.dataset.spatialMode = model.mode;
      this.canvas.dataset.drawCount = String(+(this.canvas.dataset.drawCount || 0) + 1);
      return {hits, geometry: this.last};
    }

    globalLayout(state, routeSet, matchSet) {
      const selectedGroup = this.nodes.get(state.node)?.group || state.group || 'input';
      const groupMatches = new Map(this.graph.groups.map(group => [
        group.id,
        this.graph.nodes.some(node => node.group === group.id && matchSet.has(node.id))
      ]));
      const objects = [];
      const add = (id, x, y, z, w, h, d, extra = {}) => objects.push({id, x, y, z, w, h, d, ...extra});

      add('__backbone', 0, 0, 0, 8.4, 3.05, 2.05, {kind: 'backbone', virtual: true, noHit: true, label: '语言主干 · 40 层'});
      for (let layer = 0; layer < 40; layer++) {
        const x = -4.02 + layer * (8.04 / 39);
        add('__layer_' + layer, x, 0, 0, .055, 2.72, 1.72, {
          kind: 'layer', virtual: true, noHit: true, layer,
          label: layer === state.layer ? `第 ${layer + 1} 层（L${layer}）` : ''
        });
      }

      const points = {
        input: [-6.35, 0, 0], output: [6.35, 0, 0],
        vision: [-6.9, 3.45, 2.65], engram: [-3.05, 2.65, -2.65],
        cache: [.8, 4.1, -3.05], dspark: [4.8, 2.6, 2.75], training: [3.8, -2.2, -2.8],
        mhc: [-3.45, .53, -.92], attention: [0, .53, -.92],
        csa: [.6, 2.5, -2.05], moe: [3.45, .53, -.92]
      };
      for (const group of this.graph.groups) {
        if (!points[group.id]) continue;
        const [x, y, z] = points[group.id];
        const core = CORE.has(group.id);
        add(group.id, x, y, z, core ? 1.32 : 1.7, core ? .66 : .86, core ? .25 : .48, {
          kind: 'group', group: group.id, label: group.id === 'csa' ? '跨层共享' : group.id === 'moe' ? 'MoE 专家' : core ? SHORT[group.id] : group.label,
          labelSize: 13,
          selected: group.id === selectedGroup,
          onRoute: this.graph.nodes.some(node => node.group === group.id && routeSet.has(node.id)),
          muted: matchSet.size>0&&groupMatches.get(group.id) === false
        });
      }

      const edges = [
        {from: 'input', to: 'mhc', kind: 'data', label: '进入主干'},
        {from: 'mhc', to: 'attention', kind: 'data'},
        {from: 'attention', to: 'moe', kind: 'data'},
        {from: 'moe', to: 'output', kind: 'data', label: '送入输出头'}
      ];
      edges.forEach(edge=>{edge.portAxis='x';edge.mainChain=true;});
      edges.push({from:'attention',to:'csa',kind:'data',portAxis:'y',portOffset:-.24,label:'查询与状态',alwaysLabel:true,curve:'prepare'},{from:'csa',to:'attention',kind:'shared',portAxis:'y',portOffset:.24,label:'K/V 与索引',alwaysLabel:true,curve:'return'});
      const branches = {
        vision: [{from: 'vision', to: 'input', kind: 'conditional', label: '图像 token 合流'}],
        engram: [{from: 'engram', to: 'mhc', kind: 'shared', portAxis:'y', label: '第 2 / 15 层注入'}],
        cache: [{from: 'cache', to: 'attention', kind: 'shared', label: '局部 SWA 历史',curve:'cache'}],
        csa: [{from: 'cache', to: 'csa', kind: 'shared', label: '共享来源'}],
        dspark: [{from: 'moe', to: 'dspark', kind: 'conditional', label: '草稿条件'}, {from: 'dspark', to: 'output', kind: 'conditional', label: '验证后采用'}],
        training: [{from: 'training', to: 'attention', kind: 'gradient', label: '训练信号'}],
        input: [], output: [{from: 'output', to: 'input', kind: 'conditional', label: '追加后回到输入', curve: 'loop', alwaysLabel: true}]
      };
      const routeGroups = new Set([...routeSet].map(id => this.nodes.get(id)?.group));
      const related = new Set([selectedGroup,'cache']);
      if (selectedGroup === 'attention') related.add('cache');
      if (selectedGroup === 'csa') related.add('cache');
      if (selectedGroup === 'output') related.add('dspark');
      for (const id of related) edges.push(...(branches[id] || []));
      for (const id of ['vision', 'engram', 'cache', 'dspark', 'training']) {
        if (routeGroups.has(id) && !related.has(id)) edges.push(...(branches[id] || []));
      }
      return {
        mode: 'global', objects, edges, selected: selectedGroup,
        title: '主计算在中央；共享缓存与索引在后方；图像和草稿支路在前方',
        spanX: 16.4, spanY: 9.2
      };
    }

    layerLayout(state) {
      const objects = [], edges = [];
      const add = (id, x, y, z, w, h, d, extra = {}) => objects.push({id, x, y, z, w, h, d, ...extra});
      add('__rack', -5.2, 0, 0, 2.35, 5.45, 2.05, {kind: 'rack', virtual: true, noHit: true, label: '40 层主干'});
      for (let layer = 0; layer < 40; layer++) {
        const y = 2.48 - layer * (4.96 / 39);
        add('__layer_' + layer, -5.2, y, 0, 2.05, .045, 1.7, {
          kind: 'layer', virtual: true, noHit: true, layer,
          selected: layer === state.layer,
          label: layer === state.layer ? `第 ${layer + 1} 层（L${layer}）` : ''
        });
      }
      add('__parent', 1.5, 0, 0, 10.7, 5.25, 1.85, {
        kind: 'parent', virtual: true, noHit: true,
        label: `第 ${state.layer + 1} 层（L${state.layer}）· 层内计算`
      });
      const ids = ['mhc.attn_collapse', 'attn.aggregate', 'moe.combine', 'mhc.ffn_writeback'];
      if (this.graph.layers[state.layer]?.engram) ids.unshift('engram.inject');
      const base=[[-2.65,0,0],[-.15,0,0],[2.35,0,0],[4.85,0,0]];
      const slots=ids.length===5?[[-2.65,1.85,-.6],...base]:base;
      ids.forEach((id, index) => {
        const node = this.nodes.get(id);
        const [x, y, z] = slots[index];
        add(id, x + .8, y, z, 1.72, .82, .42, {
          kind: 'node', group: node?.group, label: node?.label || id,
          selected: id === state.node
        });
        if (index) edges.push({from: ids[index - 1], to: id, kind: 'data', label: '',portAxis:index===1&&ids.length===5?'y':'x',mainChain:true});
      });
      edges.unshift({from: '__layer_' + state.layer, to: ids[0], kind: 'reveal', label: '从这一层展开'});
      return {
        mode: 'layer', objects, edges, selected: state.node, parentId: '__parent',
        title: `40 层仍在左侧；当前第 ${state.layer + 1} 层（L${state.layer}）展开为层内步骤`,
        spanX: 16, spanY: 7.2
      };
    }

    moduleLayout(state, routeSet, matchSet) {
      const group = this.groups.get(state.group);
      const children = this.graph.nodes.filter(node => node.group === state.group);
      if (state.group === 'mhc') return this.mhcModuleLayout(state, routeSet, matchSet, group, children);
      const objects = [], edges = [];
      const add = (id, x, y, z, w, h, d, extra = {}) => objects.push({id, x, y, z, w, h, d, ...extra});
      add('__parent', 0, 0, 0, 11.8, 5.75, 2.55, {
        kind: 'parent', virtual: true, noHit: true,
        label: `${group?.label || '模块'} · 展开为 ${children.length} 个步骤`
      });

      const primaryKinds = state.group === 'training' ? new Set(['gradient']) : new Set(['data']);
      const localIds = new Set(children.map(node => node.id));
      const primary = this.graph.edges.filter(edge => localIds.has(edge.from) && localIds.has(edge.to) && edge.from !== edge.to && primaryKinds.has(edge.kind));
      const secondary = this.graph.edges.filter(edge => localIds.has(edge.from) && localIds.has(edge.to) && edge.from !== edge.to && !primaryKinds.has(edge.kind));
      const ordered = this.semanticOrder(children, primary);
      const columns = ordered.length >= 13 ? 5 : ordered.length >= 7 ? 4 : Math.max(1, Math.min(4, ordered.length));
      const rows = Math.ceil(ordered.length / columns);
      const extent=rows===2?1.95:Math.max(2.7,(rows-1)*1.25);
      const rowY = rows === 1 ? [0] : Array.from({length: rows}, (_, index) => extent - index * (extent*2 / Math.max(1, rows - 1)));
      objects[0].h=rows>=3?extent*2+1.55:5.55;
      const columnX = columns === 1 ? [0] : Array.from({length: columns}, (_, index) => -4.9 + index * (9.8 / Math.max(1, columns - 1)));
      const primaryIncident = new Set(primary.flatMap(edge => [edge.from, edge.to]));
      const secondaryIncident = new Set(secondary.flatMap(edge => [edge.from, edge.to]));
      const readingRows = [];
      ordered.forEach((node, index) => {
        const row = Math.floor(index / columns), column = index % columns;
        const referenceOnly = !primaryIncident.has(node.id) && secondaryIncident.has(node.id);
        const z = referenceOnly ? -.4 : 0;
        add(node.id, columnX[column], rowY[row], z, 1.95, 1.12, .44, {
          kind: 'node', group: node.group, label:MODULE_LABELS[node.id]||node.label, labelSize: node.id==='cache.index_fp4'||node.id==='cache.main_fp4'?12:13, maxLines: 3,
          order: index + 1, stage: row + 1, referenceOnly,
          selected: node.id === state.node,
          onRoute: routeSet.has(node.id), muted: matchSet.size && !matchSet.has(node.id)
        });
        if (!readingRows[row]) readingRows[row] = [];
        readingRows[row].push(node.id);
      });
      edges.push(...primary.filter(edge=>edge.from===state.node||edge.to===state.node));
      edges.push(...secondary.filter(edge => edge.from === state.node || edge.to === state.node));

      const imageRun=state.scenario==='image'||state.originScenario==='image';


      const crossVisible=edge=>{const other=this.nodes.get(edge.from===state.node?edge.to:edge.from);return !(other?.group==='vision'&&state.group!=='vision'&&!imageRun);};
      const cross=this.graph.edges.filter(e=>(e.to===state.node||e.from===state.node)&&this.nodes.get(e.from)?.group!==this.nodes.get(e.to)?.group).filter(crossVisible);
      const incoming=[...new Set(cross.filter(e=>e.to===state.node).map(e=>this.nodes.get(e.from)?.group))].filter(Boolean),outgoing=[...new Set(cross.filter(e=>e.from===state.node).map(e=>this.nodes.get(e.to)?.group))].filter(Boolean);
      const selectedObject=objects.find(object=>object.id===state.node);
      const contextSide=(selectedObject?.x||0)>=0?1:-1;
      const contextEntries=[...incoming.map(id=>({id,direction:'in'})),...outgoing.map(id=>({id,direction:'out'}))];
      const contextSpread=(contextEntries.length-1)*.64,contextLimit=Math.max(extent,contextSpread),contextCenter=clamp(selectedObject?.y||0,-contextLimit+contextSpread,contextLimit-contextSpread);
      contextEntries.forEach(({id,direction},index)=>add('__context_'+direction+'_'+id,contextSide*8,contextCenter+contextSpread-index*1.28,0,1.85,.94,.35,{kind:'context',virtual:true,noHit:true,group:id,label:SHORT[id]||id,maxLines:2,labelSize:12}));
      for(const edge of cross){const from=this.nodes.get(edge.from),to=this.nodes.get(edge.to);if(from&&to){const outgoing=from.group===state.group;edges.push({...edge,from:outgoing?edge.from:'__context_in_'+from.group,to:outgoing?'__context_out_'+to.group:edge.to});}}
      const grouped=[];for(const edge of edges){const previous=grouped.find(e=>e.from===edge.from&&e.to===edge.to&&e.kind===edge.kind);if(previous){if(edge.label&&!previous.label.includes(edge.label))previous.label+=' / '+edge.label;}else grouped.push({...edge});}
      edges.splice(0,edges.length,...grouped);
      return {
        mode: 'module', objects, edges, selected: state.node, parentId: '__parent', readingRows,
        stageLabels: STAGE_LABELS[state.group] || readingRows.map((_, index) => `阶段 ${index + 1}`),
        title: `${group?.label || '模块'} · ${children.length} 个步骤 · 点击查看输入与去向`,
        spanX: 19.2, spanY: 8.5
      };
    }

    semanticOrder(nodes, edges) {
      const index = new Map(nodes.map((node, position) => [node.id, position]));
      if (edges.every(edge => index.get(edge.from) <= index.get(edge.to))) return nodes.slice();
      const incoming = new Map(nodes.map(node => [node.id, 0]));
      const outgoing = new Map(nodes.map(node => [node.id, []]));
      edges.forEach(edge => {
        incoming.set(edge.to, incoming.get(edge.to) + 1);
        outgoing.get(edge.from).push(edge.to);
      });
      const queue = nodes.filter(node => incoming.get(node.id) === 0).sort((a, b) => index.get(a.id) - index.get(b.id));
      const ordered = [];
      while (queue.length) {
        const node = queue.shift();
        ordered.push(node);
        for (const id of outgoing.get(node.id)) {
          incoming.set(id, incoming.get(id) - 1);
          if (incoming.get(id) === 0) {
            queue.push(nodes[index.get(id)]);
            queue.sort((a, b) => index.get(a.id) - index.get(b.id));
          }
        }
      }
      return ordered.length === nodes.length ? ordered : nodes.slice();
    }

    dependencyRanks(nodes, edges) {
      const ids = new Set(nodes.map(node => node.id));
      const incoming = new Map(nodes.map(node => [node.id, 0]));
      const outgoing = new Map(nodes.map(node => [node.id, []]));
      edges.forEach(edge => {
        if (!ids.has(edge.from) || !ids.has(edge.to)) return;
        incoming.set(edge.to, incoming.get(edge.to) + 1);
        outgoing.get(edge.from).push(edge.to);
      });
      const queue = nodes.filter(node => incoming.get(node.id) === 0).map(node => node.id);
      const ranks = new Map(nodes.map(node => [node.id, 0]));
      let cursor = 0;
      while (cursor < queue.length) {
        const id = queue[cursor++];
        for (const target of outgoing.get(id)) {
          ranks.set(target, Math.max(ranks.get(target), ranks.get(id) + 1));
          incoming.set(target, incoming.get(target) - 1);
          if (incoming.get(target) === 0) queue.push(target);
        }
      }
      if (queue.length < nodes.length) {
        nodes.forEach((node, index) => {
          if (incoming.get(node.id) > 0) ranks.set(node.id, Math.max(ranks.get(node.id), index));
        });
      }
      return ranks;
    }

    mhcModuleLayout(state,routeSet,matchSet,group,children){
      const phase=/mhc\.(ffn|final|coeff_predict_ffn)/.test(state.node)?'ffn':'attention';
      const main=phase==='attention'?['mhc.expand','mhc.attn_collapse','mhc.attn_norm','__mhc_attention','mhc.attn_writeback']:['mhc.ffn_collapse','mhc.ffn_norm','__mhc_ffn','mhc.ffn_writeback','mhc.final_collapse'];
      const objects=[{id:'__parent',x:0,y:.4,z:0,w:14.2,h:6.1,d:2.5,kind:'parent',virtual:true,noHit:true,label:'Single-Pass mHC · '+(phase==='attention'?'注意力更新':'FFN 更新')}],edges=[];
      const add=(id,x,y,z,extra={})=>{const n=this.nodes.get(id);objects.push({id,x,y,z,w:2.05,h:.96,d:.42,kind:'node',group:n?.group||'mhc',label:n?.label||id,labelSize:13,maxLines:3,selected:id===state.node,onRoute:routeSet.has(id),...extra});};
      main.forEach((id,i)=>add(id,-5.4+i*2.7,-.55,0,id==='__mhc_attention'?{kind:'context',virtual:true,noHit:true,group:'attention',label:'注意力子模块'}:id==='__mhc_ffn'?{kind:'context',virtual:true,noHit:true,group:'moe',label:'FFN / MoE'}:{}));
      for(let i=1;i<main.length;i++){const actual=this.graph.edges.find(e=>e.from===main[i-1]&&e.to===main[i]);edges.push({...(actual||{}),from:main[i-1],to:main[i],kind:actual?.kind||'data',label:'',portAxis:'x',mainChain:true});}
      const local=new Set(main),selected=state.node;
      const extras=this.graph.edges.filter(e=>(e.from===selected||e.to===selected)&&e.from!==e.to&&this.nodes.get(e.from)?.group==='mhc'&&this.nodes.get(e.to)?.group==='mhc'&&!edges.some(m=>m.from===e.from&&m.to===e.to));
      const otherIds=[...new Set(extras.flatMap(e=>[e.from,e.to]).filter(id=>!local.has(id)))];
      if(!local.has(selected)&&!otherIds.includes(selected))otherIds.push(selected);
      const alias=id=>id==='mhc.ffn_writeback'&&phase==='attention'?'__previous_ffn':id==='mhc.attn_collapse'&&phase==='ffn'?'__next_attention':id;
      const targetX=objects.find(o=>o.id===selected)?.x||0;const supportCenter=Math.max(-5.4+(otherIds.length-1)*1.525,Math.min(5.4-(otherIds.length-1)*1.525,targetX));
      otherIds.forEach((id,i)=>add(alias(id),supportCenter+(i-(otherIds.length-1)/2)*3.05,2.25,-.8,{label:id==='mhc.ffn_writeback'?'上一层 FFN 写回':id==='mhc.attn_collapse'?'下一层注意力输入':id==='mhc.singlepass_provenance'?'跨块 A 传递':this.nodes.get(id)?.label,selected:id===selected,virtual:alias(id)!==id,noHit:alias(id)!==id}));
      for(const e of extras){const a=alias(e.from),b=alias(e.to);if(objects.some(o=>o.id===a)&&objects.some(o=>o.id===b))edges.push({...e,from:a,to:b,portAxis:local.has(e.from)!==local.has(e.to)?'y':'x'});}
      const merged=[];for(const e of edges){const prior=merged.find(p=>p.from===e.from&&p.to===e.to&&p.kind===e.kind);if(prior){if(e.label&&!prior.label.includes(e.label))prior.label+=' / '+e.label;}else merged.push({...e});}
      return{mode:'module',objects,edges:merged,selected:alias(selected),parentId:'__parent',spanX:16,spanY:8.1,title:(phase==='attention'?'① 注意力更新':'② FFN 更新')+' · 主链从左到右；上方显示当前步骤的系数来源与跨层关系'};
    }

    calculationLayout(state){
      const node=this.nodes.get(state.node),branch=node.group==='training'&&window.MPTrainingScene?MPTrainingScene.branches.find(b=>b.id===state.trainingBranch):null,allowed=id=>!branch||this.nodes.get(id)?.group!=='training'||branch.nodeIds.includes(id),incoming=[...new Set(this.graph.edges.filter(e=>e.to===node.id&&e.from!==node.id&&allowed(e.from)).map(e=>e.from))],outgoing=[...new Set(this.graph.edges.filter(e=>e.from===node.id&&e.to!==node.id&&allowed(e.to)).map(e=>e.to))].filter(id=>!incoming.includes(id));
      const sceneHeight=Math.max(6.3,Math.max(incoming.length,outgoing.length)*1.12+1.4);const objects=[{id:'__parent',x:0,y:0,z:0,w:13.4,h:sceneHeight,d:2.3,kind:'parent',virtual:true,noHit:true,label:node.label+' · 来源与去向'}];
      const add=(n,x,y,z,selected=false)=>objects.push({id:n.id,label:n.label,group:n.group,kind:'node',x,y,z,w:selected?2.8:2.6,h:selected?1.35:.92,d:.42,selected,labelSize:14,maxLines:3,onRoute:true});
      add(node,0,0,0,true);
      const side=(ids,x,z)=>ids.forEach((id,i)=>add(this.nodes.get(id),x,ids.length===1?0:(ids.length-1)*.56-i*1.12,z));
      side(incoming,-4.9,-.65);side(outgoing,4.9,.65);
      const ids=new Set(objects.map(o=>o.id)),edges=this.graph.edges.filter(e=>(e.from===node.id||e.to===node.id)&&ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to);
      return {mode:'calculation',objects,edges,selected:node.id,parentId:'__parent',spanX:15,spanY:sceneHeight+1.2,title:'左侧提供输入；中央执行当前运算；右侧接收结果'};
    }

    makeCamera(model, width, height) {
      return {
        ...this.camera,
        width,
        height,
        centerX: width * (.5+this.camera.panX),
        centerY: height * ((model.mode === 'global' ? .54 : .55)+this.camera.panY),
        unit: Math.min((width - 38) / model.spanX, (height - 54) / model.spanY)*this.camera.zoom,
        focal: model.mode === 'module' ? 48 : 18
      };
    }

    rotate(point, camera) {
      const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
      const x = cy * point.x + sy * point.z;
      const z = -sy * point.x + cy * point.z;
      const y = cp * point.y - sp * z;
      return {x, y, z: sp * point.y + cp * z};
    }

    project(point, camera) {
      const rotated = this.rotate(point, camera);
      const perspective = clamp(camera.focal / (camera.focal + rotated.z), .68, 1.42);
      return {
        x: camera.centerX + rotated.x * camera.unit * perspective,
        y: camera.centerY - rotated.y * camera.unit * perspective,
        depth: rotated.z,
        perspective
      };
    }

    corners(object) {
      const result = [];
      for (const dx of [-.5, .5]) for (const dy of [-.5, .5]) for (const dz of [-.5, .5]) {
        result.push({x: object.x + dx * object.w, y: object.y + dy * object.h, z: object.z + dz * object.d});
      }
      return result;
    }

    visiblePorts(points,source,target){
      const trim=(path,rect)=>{
        if(!rect||path.length<2)return path;
        const pad=1,minX=rect.x-pad,maxX=rect.x+rect.w+pad,minY=rect.y-pad,maxY=rect.y+rect.h+pad;
        const inside=p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY;
        if(!inside(path[0]))return path;
        const next=path.findIndex(p=>!inside(p));if(next<1)return path;
        const a=path[next-1],b=path[next];let low=0,high=1;
        for(let i=0;i<24;i++){const t=(low+high)/2,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(inside(p))low=t;else high=t;}
        return [{...a,x:a.x+(b.x-a.x)*high,y:a.y+(b.y-a.y)*high},...path.slice(next)];
      };
      const center=r=>({x:r.x+r.w/2,y:r.y+r.h/2,depth:r.depth});
      const linked=[...(source?[center(source)]:[]),...points,...(target?[center(target)]:[])];
      let result=trim(trim(linked,source).reverse(),target).reverse();
      const prune=(path,rect)=>{while(path.length>2&&Math.hypot(path[1].x-path[0].x,path[1].y-path[0].y)<16){const a=path[0],b=path[2];let blocked=false;for(let i=1;i<12;i++){const x=a.x+(b.x-a.x)*i/12,y=a.y+(b.y-a.y)*i/12;if(rect&&x>rect.x&&x<rect.x+rect.w&&y>rect.y&&y<rect.y+rect.h)blocked=true;}if(blocked)break;path.splice(1,1);}return path;};
      result=prune(result,source);return prune(result.reverse(),target).reverse();
    }

    projectModel(model, camera, state) {
      const projected = new Map();
      const rects = [];
      for (const object of model.objects) {
        const corners = this.corners(object).map(point => this.project(point, camera));
        const xs = corners.map(point => point.x), ys = corners.map(point => point.y);
        const rect = {
          ...object,
          x: Math.min(...xs), y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
          depth: corners.reduce((sum, point) => sum + point.depth, 0) / corners.length,
          world: {x: object.x, y: object.y, z: object.z, w: object.w, h: object.h, d: object.d},
          corners
        };
        projected.set(object.id, rect);
        rects.push(rect);
      }
      const routeKey=JSON.stringify({objects:model.objects.map(o=>[o.id,o.x,o.y,o.z,o.w,o.h,o.d,o.kind]),edges:model.edges});
      if(this.routingKey!==routeKey){this.routingKey=routeKey;this.routed=window.MPSpatialEdges.route(model);}
      const routes=this.routed.map(edge=>{const worldPoints=edge.worldPoints||[];const projectedPoints=worldPoints.map(p=>this.project(p,camera));const points=this.visiblePorts(projectedPoints,projected.get(edge.from),projected.get(edge.to));return {...edge,worldPoints,points,depth:points.length?points.reduce((sum,p)=>sum+p.depth,0)/points.length:0,hidden:false};});
      const annotations=this.readingAnnotations(model,projected);
      if(model.mode==='module'&&window.GraphRouting){
        const blockers=rects.filter(rect=>['node','group','context'].includes(rect.kind)).map(rect=>({id:rect.id,x:rect.x,y:rect.y,w:rect.w,h:rect.h}));
        blockers.push(...annotations);
        const screenEdges=model.edges.map(edge=>{const source=model.objects.find(object=>object.id===edge.from),target=model.objects.find(object=>object.id===edge.to);let sourceSide,targetSide;if(source&&target){if(source.kind==='context'||target.kind==='context'||Math.abs(source.y-target.y)<.15&&Math.abs(source.x-target.x)<3){sourceSide=source.x<target.x?'right':'left';targetSide=source.x<target.x?'left':'right';}else if(Math.abs(source.y-target.y)<.15){sourceSide='bottom';targetSide='bottom';}else{sourceSide=source.y>target.y?'bottom':'top';targetSide=source.y>target.y?'top':'bottom';}}return{...edge,sourceSide,targetSide};});
        const screenKey=JSON.stringify({blockers,edges:screenEdges});
        if(this.screenRoutingKey!==screenKey){this.screenRoutingKey=screenKey;this.screenRoutes=window.GraphRouting.route(blockers,screenEdges,{gap:3,clearance:2,terminalMin:10});}
        routes.forEach((route,index)=>{const screen=this.screenRoutes[index];if(screen&&!screen.hidden){route.points=screen.points;route.projectedRouting=true;}else if(screen?.hidden){route.routeIssue={code:'projection-route',message:screen.reason||'投影避让未找到路径'};}});
      }
      this.canvas.dataset.routeIssues=String(routes.filter(e=>e.routeIssue).length);
      return {
        rects,
        routes,
        projected,
        annotations,
        camera,
        parentRect: model.parentId ? projected.get(model.parentId) : null,
        backbone: projected.get('__backbone') || projected.get('__rack') || null
      };
    }

    paint(model, geometry, state, routeSet, edgeProgress, width, height) {
      const ctx = this.ctx;
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#fbfefd');
      gradient.addColorStop(.55, '#f2f8f6');
      gradient.addColorStop(1, '#eaf2f3');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      this.drawDepthBands(model, geometry, width, height);

      const parent = geometry.parentRect;
      if (parent) this.drawParent(parent);
      
      const structural = geometry.rects.filter(rect => ['backbone', 'rack', 'layer'].includes(rect.kind)).sort((a, b) => b.depth - a.depth);
      structural.forEach(rect => this.drawStructure(rect, state));

      this.labelBoxes=[];this.pendingRouteLabels=[];this.currentRouteLines=geometry.routes;
      this.stageLabelBoxes=geometry.annotations;
      this.labelObstacles=[...geometry.rects.filter(r=>['node','group','context'].includes(r.kind)),...this.stageLabelBoxes,{x:0,y:0,w:width,h:35}];
      geometry.routes.sort((a, b) => b.depth - a.depth).forEach(route => {
        const active = route.from === model.selected || route.to === model.selected || route.kind === 'reveal';
        this.drawRoute(route, active, active ? edgeProgress : 1);
      });
      const solids = geometry.rects.filter(rect => !['parent', 'backbone', 'rack', 'layer'].includes(rect.kind)).sort((a, b) => b.depth - a.depth);
      solids.forEach(rect => this.drawSolid(rect, state, routeSet));
      
      structural.filter(rect => rect.selected || rect.label).forEach(rect => this.drawStructureLabel(rect,model.mode));
      if (parent) this.drawParentLabel(parent, model);
      if (model.readingRows) this.drawReadingLabels(model, geometry);
      this.pendingRouteLabels.forEach(item=>this.drawRouteLabel(item.route,item.labelText,item.color));
      this.drawHeading(model.title, width);
      if (model.mode === 'global') this.drawSemanticLegend(width, height);
      this.drawAxis(width, height);
    }

    drawDepthBands(model, geometry, width, height) {
      if (model.mode !== 'global') return;
      const ctx = this.ctx;
      const bands = [
        {text: '前方 · 图像 / 草稿旁路', color: '#b8893b', y: 41},
        {text: '中央 · 40 层主计算', color: '#3a8b83', y: 58},
        {text: '后方 · 共享缓存 / 索引', color: '#73839b', y: 75}
      ];
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = '600 10px system-ui, sans-serif';
      bands.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, width - 14, item.y);
      });
      ctx.restore();
    }

    drawStructure(rect, state) {
      const ctx = this.ctx;
      if (rect.kind === 'layer') {
        const p = rect.corners;
        const face = rect.w < rect.h ? [p[4], p[5], p[7], p[6]] : [p[2], p[3], p[7], p[6]];
        ctx.save();
        ctx.beginPath();
        face.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.closePath();
        ctx.fillStyle = rect.selected || rect.layer === state.layer ? '#e0a84f' : '#8eb9b4';
        ctx.globalAlpha = rect.selected || rect.layer === state.layer ? .92 : .25;
        ctx.fill();
        ctx.strokeStyle = rect.selected || rect.layer === state.layer ? '#8c5f1c' : '#618f91';
        ctx.lineWidth = rect.selected || rect.layer === state.layer ? 1.7 : .55;
        ctx.stroke();
        ctx.restore();
        return;
      }
      const corners = rect.corners;
      const hull = this.hull(corners);
      ctx.save();
      ctx.beginPath();
      hull.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = rect.kind === 'rack' ? '#dfeceb' : '#e4f0ed';
      ctx.globalAlpha = .18;
      ctx.fill();
      ctx.globalAlpha = .78;
      ctx.strokeStyle = '#7fa8a4';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    }

    drawParent(rect) {
      const ctx = this.ctx, hull = this.hull(rect.corners);
      ctx.save();
      ctx.beginPath();
      hull.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = '#e8f3f1';
      ctx.globalAlpha = .24;
      ctx.fill();
      ctx.globalAlpha = .88;
      ctx.strokeStyle = '#72a19b';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([7, 5]);
      ctx.lineJoin='round';ctx.miterLimit=2;
      ctx.stroke();
      ctx.restore();
    }

    drawMhcGuide(geometry) {
      const ctx = this.ctx;
      const labels = [
        {point: {x: -5.15, y: 1.72, z: 0}, text: '① 注意力更新', align: 'left'},
        {point: {x: -5.15, y: -.55, z: 0}, text: '② FFN 更新', align: 'left'},
        {point: {x: 0, y: -.14, z: .2}, text: '注意力写回完成 ↓ 转入 FFN', align: 'center'}
      ];
      ctx.save();
      ctx.font = '700 13px system-ui, "Microsoft YaHei", sans-serif';
      labels.forEach(item => {
        const point = this.project(item.point, geometry.camera);
        const width = ctx.measureText(item.text).width + 12;
        const left = item.align === 'center' ? point.x - width / 2 : point.x;
        ctx.fillStyle = '#f8fcfbef';
        ctx.beginPath();
        ctx.roundRect(left, point.y - 13, width, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#2b6765';
        ctx.textAlign = item.align;
        ctx.textBaseline = 'middle';
        ctx.fillText(item.text, item.align === 'center' ? point.x : point.x + 6, point.y - 3);
      });
      ctx.restore();
    }

    drawReadingConnectors(model, geometry) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = '#6e9898';
      ctx.fillStyle = '#6e9898';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 4]);
      for (let row = 0; row + 1 < model.readingRows.length; row++) {
        const current = geometry.projected.get(model.readingRows[row][model.readingRows[row].length - 1]);
        const next = geometry.projected.get(model.readingRows[row + 1][0]);
        if (!current || !next) continue;
        const start = {x: current.x + current.w + 3, y: current.y + current.h / 2};
        const end = {x: next.x - 4, y: next.y + next.h / 2};
        const right = Math.max(start.x + 9, geometry.parentRect.x + geometry.parentRect.w - 8);
        const middleY = (start.y + end.y) / 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(right, start.y);
        ctx.lineTo(right, middleY);
        ctx.lineTo(end.x - 10, middleY);
        ctx.lineTo(end.x - 10, end.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 8, end.y - 4);
        ctx.lineTo(end.x - 8, end.y + 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    readingAnnotations(model,projected){
      const ctx=this.ctx;ctx.save();ctx.font='700 12px system-ui, "Microsoft YaHei", sans-serif';
      const result=(model.readingRows||[]).map((ids,row)=>{const members=ids.map(id=>projected.get(id)),first=members[0],text=`${row+1} · ${model.stageLabels[row]||'阶段 '+(row+1)}`,width=ctx.measureText(text).width+12;const below=members.filter(rect=>rect.x<first.x+width+4&&rect.x+rect.w>first.x-4);return{id:'__stage_label_'+row,x:first.x,y:Math.min(...below.map(rect=>rect.y))-28,w:width,h:19,text};});
      ctx.restore();return result;
    }

    drawReadingLabels(model, geometry) {
      const ctx = this.ctx;
      ctx.save();
      model.readingRows.forEach((ids, row) => {
        const first = geometry.projected.get(ids[0]);
        if (!first) return;
        const annotation=this.stageLabelBoxes[row];
        const text = annotation.text;
        ctx.font = '700 12px system-ui, "Microsoft YaHei", sans-serif';
        const width = ctx.measureText(text).width + 12;
        const x = annotation.x, y = annotation.y + 10;
        ctx.fillStyle = '#f8fcfbef';
        ctx.beginPath(); ctx.roundRect(x, y - 10, width, 19, 4); ctx.fill();
        ctx.fillStyle = '#2f6967';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 6, y);
        ids.forEach(id => {
          const rect = geometry.projected.get(id);
          if (!rect) return;
          const badgeX = rect.x - 5, badgeY = rect.y + 7;
          ctx.beginPath(); ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
          ctx.fillStyle = rect.selected ? '#236f70' : '#597f85';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(rect.order), badgeX, badgeY + .5);
        });
      });
      ctx.restore();
    }

    hull(points) {
      const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower = [], upper = [];
      for (const point of sorted) {
        while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
        lower.push(point);
      }
      for (let index = sorted.length - 1; index >= 0; index--) {
        const point = sorted[index];
        while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
        upper.push(point);
      }
      lower.pop(); upper.pop();
      return lower.concat(upper);
    }

    drawSolid(rect, state, routeSet) {
      const ctx=this.ctx,base=COLORS[rect.group]||'#4a8790',active=rect.selected;
      const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]
        .map((indices,index)=>({indices,index,points:indices.map(i=>rect.corners[i])}))
        .filter(face=>face.points.reduce((sum,p,i)=>{const q=face.points[(i+1)%face.points.length];return sum+p.x*q.y-q.x*p.y;},0)>0)
        .sort((a,b)=>b.points.reduce((sum,p)=>sum+p.depth,0)-a.points.reduce((sum,p)=>sum+p.depth,0));
      ctx.save();ctx.globalAlpha=1;ctx.lineJoin='round';ctx.lineCap='round';ctx.miterLimit=2;
      const edges=new Map();
      for(const face of faces){
        ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle=active?(face.index%2?'#d8eee9':'#ecf8f4'):face.index%2?this.mix(base,'#ffffff',rect.muted?.94:.76):this.mix(base,'#ffffff',rect.muted?.97:.88);ctx.fill();
        face.indices.forEach((a,i)=>{const b=face.indices[(i+1)%face.indices.length],key=[a,b].sort((x,y)=>x-y).join(':');edges.set(key,[rect.corners[a],rect.corners[b]]);});
      }
      ctx.strokeStyle=active?base:rect.muted?'#d8e3e4':this.mix(base,'#617984',.55);ctx.lineWidth=active?2:.85;
      ctx.beginPath();for(const [a,b] of edges.values()){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();
      rect.visibleFaceCount=faces.length;rect.outlineEdgeCount=edges.size;rect.outlineJoin='round';
      ctx.restore();this.drawLabel(rect,base,active);
    }

    drawLabel(rect, color, active) {
      const ctx = this.ctx;
      const centerX = rect.x + rect.w / 2, centerY = rect.y + rect.h / 2;
      const maxWidth = Math.max(38, rect.w - 6);
      const size = (rect.labelSize || (rect.kind === 'group' ? 13 : rect.kind === 'context' ? 12 : 12))*Math.min(1.65,Math.max(1,Math.pow(this.camera.zoom||1,.6)));
      const lines = this.wrap(rect.label || rect.id, maxWidth, size, rect.maxLines || (rect.kind === 'node' ? 2 : 1));
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${active ? 700 : 600} ${size}px system-ui, "Microsoft YaHei", sans-serif`;
      const pad = 4;
      const lineHeight = size + 3;
      const labelWidth = Math.min(maxWidth + 4, Math.max(...lines.map(line => ctx.measureText(line).width), 22) + pad * 2);
      const labelHeight = lines.length * lineHeight + 2;
      rect.displayLines=lines;rect.textBox={x:centerX-labelWidth/2,y:centerY-labelHeight/2,w:labelWidth,h:labelHeight};
      ctx.fillStyle = active ? '#f8fffc' : '#ffffffeb';
      ctx.beginPath();
      ctx.roundRect(centerX - labelWidth / 2, centerY - labelHeight / 2, labelWidth, labelHeight, 4);
      ctx.fill();
      ctx.fillStyle = active ? '#173f47' : rect.muted?'#879b9f':'#315462';
      lines.forEach((line, index) => ctx.fillText(line, centerX, centerY + (index - (lines.length - 1) / 2) * lineHeight));
      if (active) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    roundedRoute(points) {
      if(points.length<3)return points;
      const out=[points[0]],lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      for(let i=1;i<points.length-1;i++){
        const a=points[i-1],b=points[i],c=points[i+1],before=Math.hypot(b.x-a.x,b.y-a.y),after=Math.hypot(c.x-b.x,c.y-b.y);
        const radius=Math.min(12,before*.25,after*.25);
        if(radius<1){out.push(b);continue;}
        const from=lerp(b,a,radius/before),to=lerp(b,c,radius/after);out.push(from);
        for(let k=1;k<=6;k++){const t=k/6;out.push(lerp(lerp(from,b,t),lerp(b,to,t),t));}
      }
      out.push(points[points.length-1]);return out;
    }

    drawRoute(route, active, progress) {
      const ctx = this.ctx, points = this.roundedRoute(route.points);
      if (points.length < 2) return;
      const labelText=(route.label||'').replaceAll('A_attn','注意力侧 A').replaceAll('A_ffn','FFN 侧 A').replaceAll('y_attn','注意力侧 y').replaceAll('y_ffn','FFN 侧 y').replaceAll('第 0 层 A','首层 A').replaceAll('重建 encoder 尾窗','编码器尾窗').replaceAll('每次 prefill 重建 decoder 尾窗','解码器尾窗').replaceAll('decoder prefill 策略 / encoder prefix-cache 策略','Prefill / 前缀缓存策略').replaceAll('复用 cached global KV','复用全局 KV').replaceAll('后续层读取 compress_kv','读取压缩 KV');
      const color = route.kind === 'gradient' ? '#7662a9' : route.kind === 'conditional' ? '#aa7e35' : active ? '#237d7d' : '#587f88';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = active ? 2.25 : 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(route.kind === 'shared' ? [6, 4] : route.kind === 'conditional' ? [2, 4] : route.kind === 'context' ? [4, 5] : []);
      let total = 0;
      for (let index = 1; index < points.length; index++) total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
      let remaining = total * clamp(progress, 0, 1);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      let end = points[0];
      for (let index = 1; index < points.length; index++) {
        const from = points[index - 1], to = points[index];
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (remaining < length) {
          end = {x: from.x + (to.x - from.x) * remaining / Math.max(1, length), y: from.y + (to.y - from.y) * remaining / Math.max(1, length)};
          ctx.lineTo(end.x, end.y);
          break;
        }
        ctx.lineTo(to.x, to.y);
        end = to;
        remaining -= length;
      }
      const lineWidth=ctx.lineWidth;ctx.strokeStyle='#f3f9f6';ctx.lineWidth=lineWidth+2;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(points[0].x,points[0].y,active?2.6:2,0,Math.PI*2);ctx.fill();
      if (progress >= .98) {
        const prior = points[points.length - 2], tip = points[points.length - 1];
        const angle = Math.atan2(tip.y - prior.y, tip.x - prior.x);
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x - 8 * Math.cos(angle - .45), tip.y - 8 * Math.sin(angle - .45));
        ctx.lineTo(tip.x - 8 * Math.cos(angle + .45), tip.y - 8 * Math.sin(angle + .45));
        ctx.closePath();
        ctx.fill();
      }
      if(progress>=.98&&route.label&&(active||route.alwaysLabel))this.pendingRouteLabels.push({route,labelText,color});
      ctx.restore();
    }

    drawRouteLabel(route,labelText,color){
      const ctx=this.ctx;ctx.save();
        const lines=this.wrap(labelText,180,11,3).map(labelRuns);
        ctx.font=labelFont(11);ctx.textAlign='center';
        const labelWidth=Math.max(...lines.map(runs=>measureRuns(ctx,runs,11)))+10,labelHeight=lines.length*15+4;
        const offsetsY=[-labelHeight-9,9,-labelHeight-27,27,-labelHeight-45,45],offsetsX=[0,-labelWidth*.3,labelWidth*.3];
        const segments=route.points.slice(1).map((end,index)=>({a:route.points[index],b:end,index,length:Math.hypot(end.x-route.points[index].x,end.y-route.points[index].y)})).sort((a,b)=>b.length-a.length);
        const candidates=[];
        for(const segment of segments){const middle={x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2};offsetsY.forEach((dy,row)=>offsetsX.forEach((dx,column)=>candidates.push({slot:segment.index+":"+row+":"+column,x:clamp(middle.x-labelWidth/2+dx,5,this.canvas.clientWidth-labelWidth-5),y:middle.y+dy,w:labelWidth,h:labelHeight})));}
        const overlaps=(a,b)=>a.x<b.x+b.w+4&&a.x+a.w>b.x-4&&a.y<b.y+b.h+4&&a.y+a.h>b.y-4;
        const otherLines=this.currentRouteLines.filter(line=>line!==route).flatMap(line=>line.points.slice(1).map((p,i)=>{const a=line.points[i];return{x:Math.min(a.x,p.x)-1,y:Math.min(a.y,p.y)-1,w:Math.abs(p.x-a.x)+2,h:Math.abs(p.y-a.y)+2};}));
        const free=box=>box.y>36&&box.y+box.h<this.canvas.clientHeight-38&&![...this.labelObstacles,...this.labelBoxes,...otherLines].some(o=>overlaps(box,o));





        const key=route.from+'>'+route.to+'>'+route.kind;
        const memory=this.routeLabelSlots||(this.routeLabelSlots=new Map());
        const remembered=memory.get(key);
        let box=null;
        if(remembered){
          const keep=remembered.slot?candidates.find(b=>b.slot===remembered.slot):{...remembered.box,w:labelWidth,h:labelHeight};
          if(keep&&free(keep))box=keep;
        }
        if(!box){
          box=candidates.find(free);
          if(!box){const middle=route.points[Math.floor(route.points.length/2)];const spots=[];for(let y=42;y<this.canvas.clientHeight-labelHeight-40;y+=20)for(let x=8;x<this.canvas.clientWidth-labelWidth;x+=20){const b={x,y,w:labelWidth,h:labelHeight};if(free(b))spots.push(b);}box=spots.sort((a,b)=>Math.hypot(a.x+a.w/2-middle.x,a.y+a.h/2-middle.y)-Math.hypot(b.x+b.w/2-middle.x,b.y+b.h/2-middle.y))[0];}
          if(box)memory.set(key,box.slot?{slot:box.slot}:{box:{x:box.x,y:box.y}});
          else memory.delete(key);
        }
        if(box){this.labelBoxes.push(box);route.labelBox=box;ctx.fillStyle='#f8fcfbf2';ctx.beginPath();ctx.roundRect(box.x,box.y,box.w,box.h,3);ctx.fill();ctx.fillStyle=color;lines.forEach((runs,index)=>fillRuns(ctx,runs,box.x+box.w/2,box.y+13+index*15,11));}

      ctx.restore();
    }

    drawHeading(title, width) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = '650 12px system-ui, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#294f5a';
      ctx.textAlign = 'left';
      const shown = this.ellipsize(title, Math.max(160, width - 245), ctx);
      ctx.fillText(shown, 14, 22);
      ctx.restore();
    }

    drawSemanticLegend(width, height) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = '#54717a';
      ctx.textAlign = 'right';
      ctx.fillText('空间深度表示机制角色，不表示张量维度', width - 14, height - 13);
      ctx.restore();
    }

    drawAxis(width, height) {
      if (width < 520) return;
      const ctx = this.ctx, x = 25, y = height - 24;
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.font = '9px system-ui, sans-serif';
      const axes = [
        {dx: 36, dy: 0, color: '#438c89', text: '计算'},
        {dx: 0, dy: -27, color: '#78935c', text: '层次'},
        {dx: 20, dy: 15, color: '#9b748b', text: '支路深度'}
      ];
      axes.forEach(axis => {
        ctx.strokeStyle = axis.color;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + axis.dx, y + axis.dy); ctx.stroke();
        ctx.fillStyle = axis.color;
        ctx.fillText(axis.text, x + axis.dx + 3, y + axis.dy + 3);
      });
      ctx.restore();
    }

    drawStructureLabel(rect,mode) {
      if (!rect.label) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.font = `${rect.selected ? 700 : 600} 10px system-ui, sans-serif`;
      ctx.fillStyle = rect.selected ? '#87570f' : '#4b6d73';
      ctx.textAlign = 'center';
      const y = clamp(mode==='global'&&['layer','backbone'].includes(rect.kind)?rect.y+rect.h+(rect.kind==='layer'?15:30):rect.y-5, 35, this.canvas.getBoundingClientRect().height - 12);
      ctx.fillText(rect.label, rect.x + rect.w / 2, y);
      ctx.restore();
    }

    drawParentLabel(rect, model) {
      if (model?.readingRows) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.font = '700 12px system-ui, "Microsoft YaHei", sans-serif';
      const text = rect.label || '';
      const width = ctx.measureText(text).width + 18;
      const x = model?.readingRows ? rect.x + rect.w - width - 10 : rect.x + 10;
      const y = Math.max(31, rect.y + 8);
      ctx.fillStyle = '#f8fcfbe8';
      ctx.beginPath(); ctx.roundRect(x, y, width, 22, 5); ctx.fill();
      ctx.fillStyle = '#2f6865';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 9, y + 11);
      ctx.restore();
    }

    wrap(text, maxWidth, size, maxLines) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = `600 ${size}px system-ui, "Microsoft YaHei", sans-serif`;
      const tokens = String(text || '').match(/[A-Za-z0-9_²/.-]+|主干|投影|权重|调度|置信度|验证|\n|./gu) || [];
      const lines = [];
      let line = '';
      for (const token of tokens) {
        if(token==='\n'){if(line)lines.push(line);line='';continue;}
        if (ctx.measureText(line + token).width > maxWidth && line) {
          lines.push(line); line = token;
        } else line += token;
      }
      if (line) lines.push(line);
      const result = lines.slice(0, maxLines);
      if (lines.length > maxLines && result.length) result[result.length - 1] = this.ellipsize(result[result.length - 1] + '…', maxWidth, ctx);
      ctx.restore();
      return result.length ? result : [''];
    }

    ellipsize(text, maxWidth, ctx) {
      let shown = String(text || '');
      while (shown.length > 2 && ctx.measureText(shown).width > maxWidth) shown = shown.slice(0, -2) + '…';
      return shown;
    }

    mix(a, b, amount) {
      const parse = color => color.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16));
      const aa = parse(a), bb = parse(b);
      return '#' + aa.map((value, index) => Math.round(value + (bb[index] - value) * amount).toString(16).padStart(2, '0')).join('');
    }

    capture(id){
      if(!this.last)return null;
      const layer=/^layer:(\d+)$/.exec(String(id||'')),alias=layer?'__layer_'+layer[1]:id==='layers:backbone'?(this.last.mode==='layer'?'__rack':'__backbone'):id;
      const box=(id==='__scope'?this.last.parentRect||this.last.backbone:null)||this.last.rects?.find(r=>r.id===alias)||this.last.parentRect||this.last.backbone||this.last.frame;
      return {box:{x:box.x,y:box.y,w:box.w,h:box.h},label:box.label||'',scope:this.last.scope||{},mode:this.last.mode};
    }
    transition(snapshot,state){
      this.cancelTransition();const transitionId=this.transitionEpoch;this.lastTransitionMs=0;
      if(!snapshot||!this.last)return Promise.resolve();
      const old=snapshot.scope||{},sameScope=old.level===state.level&&old.autoView===state.autoView;
      if(snapshot.mode==='diagram'||this.last.mode==='diagram'||sameScope||matchMedia('(prefers-reduced-motion: reduce)').matches){this.canvas.dataset.transition='none';return Promise.resolve();}
      const closing=state.level<old.level||(old.autoView&&!state.autoView);
      const target=closing?(state.level===0?(old.autoView?this.last.rects.find(r=>r.id==='__layer_'+old.layer)||this.last.backbone:this.last.rects.find(r=>r.id===old.group)):this.last.rects.find(r=>r.id===old.node)||this.last.parentRect):this.last.parentRect||this.last.rects.find(r=>r.id===state.node)||this.last.frame;
      if(!target)return Promise.resolve();
      const host=this.canvas.parentElement,frame=document.createElement('div');frame.className='mp-scope-transition-frame';
      const label=document.createElement('div');label.className='mp-scope-transition-label';const targetName=closing?(old.autoView?'第 '+(old.layer+1)+' 层':old.level===2?this.nodes.get(old.node)?.label:this.groups.get(old.group)?.label):(state.autoView?'第 '+(state.layer+1)+' 层':state.level===2?this.nodes.get(state.node)?.label:this.groups.get(state.group)?.label);label.textContent=(closing?'收回：':'展开：')+(targetName||snapshot.label);
      host.append(frame,label);this.transitionElements=[frame,label];
      frame.dataset.targetId=target.id||'frame';frame.dataset.sourceGroup=old.group||'';const from=snapshot.box,to=target;const styles=r=>({left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
      Object.assign(frame.style,styles(from));Object.assign(label.style,{left:'14px',top:'42px'});
      const animation=frame.animate([{...styles(from),opacity:.9},{...styles(to),opacity:.15}],{duration:430,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
      const appearance=this.canvas.animate([{opacity:.18},{opacity:1}],{duration:300,delay:100,easing:'ease-out'});this.transitionAnimations=[animation,appearance];this.lastTransitionMs=430;
      this.canvas.dataset.transition=closing?'close-parent':'open-parent';
      return animation.finished.catch(()=>{}).then(()=>{if(this.transitionEpoch===transitionId)this.cancelTransition();});
    }

    cancelTransition() {
      this.transitionEpoch=(this.transitionEpoch||0)+1;
      this.transitionAnimations.forEach(animation => {
        try { animation.cancel(); } catch (_) {}
      });
      this.transitionElements.forEach(element => element.remove());
      this.transitionAnimations = [];
      this.transitionElements = [];
    }
  }

  window.SpatialFlowView = SpatialFlowView;
}());

(function(){
 'use strict';
 const layerSteps=['mhc.attn_collapse','attn.aggregate','moe.combine','mhc.ffn_writeback'];
 const stepCopy={
  'mhc.attn_collapse':'先把四路状态混合成这一层的注意力输入。',
  'attn.aggregate':'注意力按权重汇总 Value，形成当前层读到的上下文。',
  'moe.combine':'把路由专家与共享专家的结果汇总起来。',
  'mhc.ffn_writeback':'把 FFN 结果写回四路，完成这一层。'
 };
 const imagePacing={
  'vision.image_record':{tempoFactor:1.55,explanation:'先读取输入记录并解码为 RGB 图像；文件或网络读取属于模型外的 I/O。',cue:{kind:'introduce',label:'图像分支开始',holdAfterTransition:true},reveal:{from:'input',to:'vision.image_record',kind:'branch-entry'}},
  'vision.patch_projection':{tempoFactor:1.45,explanation:'把 14×14 像素块投影为视觉 token，图像由此进入视觉编码。',cue:{kind:'transform',label:'像素块变成视觉表示',holdAfterTransition:true},reveal:{from:'vision.pixels',to:'vision.patch_projection',kind:'representation-change'}},
  'vision.neighborhood':{tempoFactor:1.5,explanation:'汇集每个 3×3 邻域的九个位置，按特征分量打包成更长的表示；位置数量约缩小九倍。',cue:{kind:'transform',label:'九个位置合成一个邻域',holdAfterTransition:true},reveal:{from:'vision.final_norm',to:'vision.neighborhood',kind:'spatial-merge'}},
  'vision.projector1':{tempoFactor:1.65,explanation:'视觉对齐器开始把九个 1024 维视觉位置投影到语言隐藏维度。',cue:{kind:'boundary',label:'从视觉编码进入语言维度',holdAfterTransition:true},reveal:{from:'vision',to:'vision.projector1',kind:'vision-language-boundary'}},
  'vision.projector2':{tempoFactor:1.3,explanation:'对齐器输出与文字 embedding 相同维度的视觉 token 表示。',cue:{kind:'transform',label:'得到语言维度的视觉 token',holdAfterTransition:true}},
  'vision.span_merge':{tempoFactor:1.75,explanation:'把视觉表示写入图像占位位置，与文字表示汇入同一输入序列。',cue:{kind:'converge',label:'图像与文字汇入同一序列',holdAfterTransition:true},reveal:{from:'vision.placeholder_layout',to:'vision.span_merge',kind:'branch-converge'}}
 };
 const outputPacing={
  'mhc.final_collapse':{tempoFactor:1.85,explanation:'40 层全部完成后，四路残差流在这里汇成输出头需要的一条状态。',cue:{kind:'converge',label:'四路最终汇合',holdAfterTransition:true},reveal:{from:'layers:backbone',to:'mhc.final_collapse',kind:'final-converge'}},
  'output.norm':{tempoFactor:1.05,explanation:'先做输出头前的最后一次 RMSNorm。'},
  'output.head':{tempoFactor:1.2,explanation:'输出头把当前状态映射为完整词表的 logits。'},
  'output.probabilities':{tempoFactor:1.3,explanation:'把 logits 变成选择下一 token 所需的概率；温度为 0 时直接取最大值。'},
  'output.sample':{tempoFactor:1.4,explanation:'依据当前采样规则选出下一个 token。',cue:{kind:'decision',label:'选出下一 token',holdAfterTransition:true}},
  'output.append':{tempoFactor:1.65,explanation:'把选出的 token 追加到序列，完成这一轮生成。',cue:{kind:'complete',label:'追加并完成一轮',holdAfterTransition:true},reveal:{from:'output.sample',to:'output.append',kind:'generation-complete'}}
 };

 function nodeExplanation(graph,node){
  const item=graph.nodes.find(candidate=>candidate.id===node);
  return item?.description||item?.label||node;
 }

 function groupOf(graph,node){
  return graph.nodes.find(candidate=>candidate.id===node)?.group||null;
 }

 function moduleMetadata(graph,event,index,events,scenario){
  const previous=index>0?events[index-1]:null;
  const group=groupOf(graph,event.node),previousGroup=previous?groupOf(graph,previous.node):null;
  const metadata={tempoFactor:.9,explanation:nodeExplanation(graph,event.node),cue:{kind:'progress',label:event.phase||'继续沿通路推进',holdAfterTransition:false}};
  if(index===0){
   metadata.tempoFactor=1.35;
   metadata.cue={kind:'introduce',label:event.phase||'通路开始',holdAfterTransition:true};
  }else if(group&&previousGroup&&group!==previousGroup){
   metadata.tempoFactor=1.3;
   metadata.cue={kind:'boundary',label:'进入'+(graph.groups.find(item=>item.id===group)?.label||group),holdAfterTransition:true};
   metadata.reveal={from:previousGroup,to:event.node,kind:'group-transition'};
  }
  if(scenario==='image'&&imagePacing[event.node])Object.assign(metadata,imagePacing[event.node]);
  if(outputPacing[event.node])Object.assign(metadata,outputPacing[event.node]);
  if(event.node==='text.token_ids')metadata.explanation='先读取 token 编号。跟随序列中选定的位置，观察它怎样取得表示并参与后续计算。';
  if(event.node==='mhc.expand')Object.assign(metadata,{tempoFactor:1.7,explanation:'主干开始前，把同一表示复制到四条 mHC 残差流。接下来逐层跟随四个可暂停的关键步骤。',cue:{kind:'introduce',label:'进入 40 层语言主干',holdAfterTransition:true},reveal:{from:previousGroup||'input',to:'mhc.expand',kind:'enter-backbone'}});
  if(event.node==='dspark.main_token')Object.assign(metadata,{tempoFactor:1.55,explanation:'验证那一次前向已经算好主模型在每个位置的分布，所以第一个未通过的位置直接用主模型的结果，不必再为它走一遍主干。这也让一轮验证至少写下一个 token。',cue:{kind:'decision',label:'主模型补上一项',holdAfterTransition:true}});
  if(event.node==='output.next_round')Object.assign(metadata,{tempoFactor:1.7,explanation:'刚追加的 token 成为下一个位置的输入：只为这一个新位置查一次词嵌入，已经算过的位置直接复用缓存的 K/V。同一条主干再跑一轮，逐项写下去，直到遇到结束标记或达到长度上限。',cue:{kind:'loop',label:'回到开头，继续下一项',holdAfterTransition:true},reveal:{from:'output',to:'output.next_round',kind:'generation-loop'}});
  return metadata;
 }



 function layerLead(layer,modeOccurrence){
  if(layer.index===0)return '首次展开完整主干层：先从本层最近 128 个位置的局部窗口开始。';
  if(layer.index===20)return '这里是因果 Encoder 与因果 Decoder 的边界；Decoder 侧首次完整建立主 KV、Indexer K 与 Top-K。';
  if(layer.mode==='Full'&&modeOccurrence===1)return '首次完整建立主 KV、Indexer K 与 Top-K，供后续层引用。';
  if(layer.mode==='Reuse'&&modeOccurrence===1)return '首次沿用前一 Full 层留下的主 KV、Indexer K 与 Top-K。';
  if(layer.mode==='Reindex'&&modeOccurrence===1)return '首次只重算 Top-K 位置编号；主 KV 与 Indexer K 仍来自第 '+(layer.kvSource+1)+' 层。';
  if(layer.mode==='Full')return '再次完整建立一组可供后续层引用的跨层对象。';
  if(layer.mode==='Reindex')return '沿用第 '+(layer.kvSource+1)+' 层的主 KV 与 Indexer K，并更新本层使用的 Top-K。';
  if(layer.mode==='Reuse')return '沿用第 '+(layer.kvSource+1)+' 层建立的主 KV 与 Indexer K，以及第 '+(layer.indexSource+1)+' 层产生的 Top-K。';
  return '继续使用本层的局部窗口。';
 }

 function layerTempo(layer,stepIndex,modeOccurrence){
  if(layer.index===0)return [1.85,1.2,1.2,1.4][stepIndex];
  if(layer.index===20)return [2,.82,.82,.95][stepIndex];
  if(modeOccurrence===1)return [1.65,.86,.86,1][stepIndex];
  if(layer.mode==='Reuse')return [.62,.5,.5,.62][stepIndex];
  if(layer.mode==='Full')return [.84,.64,.64,.76][stepIndex];
  if(layer.mode==='Reindex')return [.9,.68,.68,.8][stepIndex];
  return [.72,.56,.56,.68][stepIndex];
 }

 function layerReveal(layer,modeOccurrence){
  if(layer.index===0)return {from:'mhc.expand',to:'layer:0',kind:'enter-layer-stack'};
  if(layer.index===20)return {from:'layer:19',to:'layer:20',kind:'encoder-decoder-boundary'};
  if(layer.mode==='Full'&&modeOccurrence===1)return {from:'layer:'+(layer.index-1),to:'layer:'+layer.index,kind:'first-full'};
  if(layer.mode==='Reuse'&&modeOccurrence===1)return {from:'layer:'+(layer.index-1),to:'layer:'+layer.index,kind:'first-reuse'};
  if(layer.mode==='Reindex'&&modeOccurrence===1)return {from:'layer:'+(layer.index-1),to:'layer:'+layer.index,kind:'first-reindex'};
  return null;
 }

 function plan(graph,scenario){
  const valid=new Set(graph.nodes.map(n=>n.id)),events=[];
  const add=(node,extra={})=>{if(valid.has(node))events.push({node,...extra});};
  if(scenario==='training'||scenario==='dspark'){
   (graph.routes[scenario]||[]).forEach(node=>add(node,{kind:'module'}));
  }else{
   if(scenario==='image'){
    add('text.token_ids',{kind:'module',phase:'图文输入 · 文字分支'});add('text.embedding',{kind:'module',phase:'图文输入 · 文字表示'});
    const image=graph.routes.image||[];for(const node of image){if(node==='mhc.expand')break;add(node,{kind:'module',phase:'图像输入'});}
   }else if(scenario==='recovery'){
    (graph.routes.recovery||[]).forEach(node=>add(node,{kind:'module',phase:'恢复历史'}));
   }
   if(scenario!=='image')add('text.token_ids',{kind:'module',phase:'文字输入'});
   if(scenario!=='image')add('text.embedding',{kind:'module',phase:'输入表示'});
   add('mhc.expand',{kind:'module',phase:'进入主干'});
   const modeCounts=new Map();
   for(const layer of graph.layers){
    const modeOccurrence=(modeCounts.get(layer.mode)||0)+1;modeCounts.set(layer.mode,modeOccurrence);
    if(layer.engram)add('engram.inject',{kind:'layer',layer:layer.index,phase:'第 '+(layer.index+1)+' / 40 层 · 查表记忆注入',tempoFactor:1.55,explanation:'先把 Engram 查到的 value 按不同门强度写入四条残差流，再进入本层计算。',cue:{kind:'mechanism',label:'Engram 注入后进入本层',holdAfterTransition:true},reveal:{from:'engram',to:'engram.inject',kind:'memory-injection'},turnKey:'engram-layer-'+layer.index,layerMode:layer.mode,modeOccurrence});
    for(let stepIndex=0;stepIndex<layerSteps.length;stepIndex++){
     const node=layerSteps[stepIndex],firstRole=layer.index===0,demonstratedRole=!firstRole;
     const repeatLabel=demonstratedRole?'沿用已讲过程，快速推进':null;
     const lead=stepIndex===0?layerLead(layer,modeOccurrence):'';
     const explanation=(lead?lead+' ':'')+(demonstratedRole&&stepIndex>0?repeatLabel+'；':'')+stepCopy[node];
     const reveal=stepIndex===0?layerReveal(layer,modeOccurrence):null;
     add(node,{kind:'layer',layer:layer.index,phase:'第 '+(layer.index+1)+' / 40 层 · '+layer.mode,tempoFactor:layerTempo(layer,stepIndex,modeOccurrence),explanation,cue:{kind:reveal?'mechanism':demonstratedRole?'repeat':'explain',label:reveal?lead:repeatLabel||'首次讲解层内步骤',holdAfterTransition:Boolean(reveal)},reveal:reveal||undefined,turnKey:reveal?'layer-'+layer.index+'-'+reveal.kind:undefined,layerMode:layer.mode,modeOccurrence,layerStep:stepIndex+1,firstRole,demonstratedRole,repeatLabel});
    }
   }
   for(const node of ['mhc.final_collapse','output.norm','output.head','output.probabilities','output.sample','output.append'])add(node,{kind:'module',layer:39,phase:'输出与追加'});
   add('output.next_round',{kind:'module',layer:39,phase:'接着下一轮'});
  }
  return events.map((event,index)=>{
   const enriched=event.explanation?event:{...event,...moduleMetadata(graph,event,index,events,scenario)};
   return enriched.cue?.holdAfterTransition&&enriched.cue.transitionMs===undefined?{...enriched,cue:{...enriched.cue,transitionMs:360}}:enriched;
  });
 }

 function duration(event,speed,options={}){
  const readingSeconds=Number.isFinite(Number(speed))?Math.min(2,Math.max(.09,Number(speed))):.65;
  let factor=Number.isFinite(Number(event?.tempoFactor))&&Number(event.tempoFactor)>0?Number(event.tempoFactor):1;
  if(options.reduced&&event?.reveal)factor=Math.max(1,factor-.2);
  const repeat=event?.cue?.kind==='repeat'&&!event?.reveal;const base=repeat?readingSeconds*1000*factor:Math.max(1800,Math.min(4400,(event?.explanation?.length||40)*45))*readingSeconds/.65;return Math.round(Math.min(7000,Math.max(70,base)));
 }

 window.ProcessPlayback={plan,duration,layerSteps};
})();

(function(){
'use strict';
function build(graph,scenario,options={}){
 let raw=ProcessPlayback.plan(graph,scenario);
 if(scenario==='training'&&window.MPTrainingScene){const branch=MPTrainingScene.branches.find(b=>b.id===options.trainingBranch)||MPTrainingScene.branches[0];const ids=new Set(branch.nodeIds);raw=raw.filter(e=>ids.has(e.node));}
 if(!raw.length)return [];
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),groups=new Map(graph.groups.map(g=>[g.id,g])),out=[];
 const label=id=>groups.get(id)?.label||id;
 const overview=(node,text,kind)=>({node,kind:'overview',presentation:true,viewLevel:0,explanation:text,cue:{kind,label:text},tempoFactor:1.6});
 out.push(overview(raw[0].node,'先看全局：输入从哪里进入，经过哪些模块，结果送往哪里。随后从高亮模块开始展开。','overview-start'));
 let previous=null;
 for(const event of raw){
  if((scenario==="image"&&event.node==="mhc.expand")||(scenario==="recovery"&&event.node==="text.token_ids")){out.push({...overview(event.node,"专属过程已完成，接下来接入共同的主干计算。","shared-entry"),sharedFlow:true});break;}
  const group=nodes.get(event.node).group,layer=event.kind==='layer',level=event.node==='mhc.expand'?0:1;
  if(previous){const oldGroup=nodes.get(previous.node).group;
   if(previous.kind==='layer'&&!layer){out.push(overview(previous.node,'四十层计算已经走完。先把当前层放回主干，再观察输出如何产生。','return-overview'));out.push(overview(event.node,'从主干的最终状态继续，准备汇成输出表示。','locate-next'));}
   else if(previous.kind!=='layer'&&!layer&&oldGroup!==group){
    if(previous.viewLevel!==0)out.push(overview(previous.node,label(oldGroup)+'已讲完，回到它在全局中的位置。','return-overview'));
    if(level!==0)out.push(overview(event.node,'接下来进入'+label(group)+'；先定位这个模块，再展开其中的步骤。','locate-next'));
   }
  }
  const value={...event,viewLevel:level,compute:true};if(event.node==='dspark.candidates'){for(let i=1;i<=5;i++)out.push({...value,draftStep:i,explanation:'依次采样第 '+i+' 个草稿输出；本例共提出五个候选。',cue:{kind:'draft-output',label:'草稿 '+i+' / 5'}});}else out.push(value);previous=value;
 }
 if(!out[out.length-1]?.sharedFlow)out.push(overview(raw[raw.length-1].node,scenario==='training'?'这条训练分支的目标、梯度范围与更新对象已看完。可以切换另一分支比较。':'一轮流程完成。回到全局，查看输出与下一轮输入的连接。','overview-complete'));
 return out;
}
window.MPPresentation={build};
})();

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

(function () {
  'use strict';
  const G = window.DSGraph;
  if (!G || !document.getElementById('mp-canvas')) return;
  const $ = id => document.getElementById('mp-' + id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textOf = v => typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  const nodes = new Map(G.nodes.map(n => [n.id,n]));
  const groups = new Map(G.groups.map(g => [g.id,g]));
  const colors = {input:'#337fa4',vision:'#9c7837',engram:'#8270a4',mhc:'#bd7762',attention:'#37899d',csa:'#528e74',moe:'#a77699',cache:'#668395',output:'#3b9488',dspark:'#c59445',training:'#826ca8'};
  const anchors = {input:'embedding',vision:'tensor-3d',engram:'engram-location',mhc:'mhc-3d',attention:'attention-3d',csa:'v2-layers',moe:'v2-moe',cache:'v2-cache',output:'v2-output-loop',dspark:'viz-dspark',training:'training'};
  const state = {level:0,group:null,node:G.nodes[0].id,layer:0,token:6,scenario:'text',originScenario:'',browse:'follow',step:0,query:'',filter:'all',yaw:-.16,pitch:.22,head:0,lane:0,expert:0,autoView:false,speed:.65,layout:'space',zoom:1,panX:0,panY:0,trainingBranch:'pretrain'};
  let boosting=false,boostWasPlaying=false,scrubWasPlaying=false,suppressTransition=false,started=false,playing=false,timer=null,hits=[],stack=[],drawCount=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');let edgeProgress=1,edgeFrame=0,lastMotionNode=null;
  const canvas=$('canvas'), ctx=canvas.getContext('2d');const view=new window.SpatialFlowView(canvas,G);
  function plan(){return window.MPPresentation.build(G,state.scenario,{trainingBranch:state.trainingBranch});}
  function route(){return plan().map(event=>event.node);}
  function hash() { const p=new URLSearchParams(); for(const k of ['node','level','group','layer','token','scenario','originScenario','browse','step','yaw','pitch','head','lane','expert','autoView','speed','layout','zoom','panX','panY','trainingBranch']) if(state[k]!==null)p.set(k,state[k]);return '#'+p; }
  function persist(push=false){const h=hash(),sectionAnchor=/^#mp-(coverage|detail)$/.test(location.hash);if((!sectionAnchor||push)&&location.hash!==h)history[push?'pushState':'replaceState']({...state},'',h);$('tutorial-link').href='guide.html#v2-'+h.slice(1);document.body.dataset.state=JSON.stringify({...state,playing,boosting,route:route()});}
  function restore(){const p=new URLSearchParams(location.hash.slice(1));for(const k of ['node','group','scenario','originScenario','browse','layout','trainingBranch'])if(p.has(k))state[k]=p.get(k);for(const k of ['level','layer','token','step','yaw','pitch','head','lane','expert','zoom','panX','panY'])if(p.has(k)&&Number.isFinite(+p.get(k)))state[k]=+p.get(k);if(!['space','diagram'].includes(state.layout))state.layout='space';state.level=Math.min(2,Math.max(0,state.level));state.layer=Math.min(39,Math.max(0,Math.trunc(state.layer)));state.token=Math.min(1048575,Math.max(0,Math.trunc(state.token)));if(!nodes.has(state.node))state.node=G.nodes[0].id;if(!groups.has(state.group))state.group=nodes.get(state.node).group;if(!['text','image','decode','recovery','dspark','training'].includes(state.scenario))state.scenario='text';state.step=Math.max(0,Math.min(route().length-1,state.step));state.autoView=p.get('autoView')==='true';if(p.has('speed'))state.speed=Math.max(.09,Math.min(2,+p.get('speed')||.65));}
  function syncPlay(){const b=$('play'),t=playLabel();b.setAttribute('aria-label',t);b.dataset.mpHint=t;b.dataset.mpPlaying=playing?'1':'0';}
function playLabel(){return playing?'暂停播放':started&&state.browse==='follow'&&state.step>=0&&state.step<plan().length-1?'继续播放':state.step>=plan().length-1?'重播全流程':'自动播放全流程';}
  function alignSection(){if(!/^#mp-(coverage|detail)$/.test(location.hash))return;const el=document.getElementById(location.hash.slice(1));document.fonts.ready.then(()=>requestAnimationFrame(()=>el?.scrollIntoView({block:'start'})));}
  function stop(){boosting=false;view.cancelTransition?.();cancelAnimationFrame(edgeFrame);edgeFrame=0;edgeProgress=1;playing=false;clearTimeout(timer);timer=null;syncPlay();}
  function select(id,expand=false,push=true){expand=expand&&state.level<2;started=false;const n=nodes.get(id);if(!n)return;if(n.group==='training'){state.scenario='training';const branch=MPTrainingScene.branches.find(b=>b.id===state.trainingBranch);if(!branch?.nodeIds.includes(id))state.trainingBranch=MPTrainingScene.branchForNode(id);}const snapshot=expand?view.capture(state.level===0?n.group:id):null;stop();state.autoView=false;if(expand){stack.push({...state});state.level=Math.min(2,state.level+1);}state.node=id;state.group=n.group;const index=plan().findIndex(e=>!e.presentation&&e.node===id&&(e.layer===undefined||e.layer===state.layer));if(index>=0)state.step=index;else state.browse='free';render(false);$('detail').scrollTop=0;persist(push);if(snapshot)view.transition(snapshot,state);}
  function enterGroup(id){started=false;if(id==='training')state.scenario='training';const snapshot=view.capture(id);stop();stack.push({...state});state.autoView=false;state.group=id;state.level=1;state.node=G.nodes.find(n=>n.group===id)?.id||state.node;state.browse='free';render(false);persist(true);view.transition(snapshot,state);}
  function filtered(){const q=state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);return G.nodes.filter(n=>{const hay=[n.label,n.description,n.formula,n.keywords,n.role,n.group,n.input,n.output,n.group==='vision'?'图片 图像 照片 像素 patch 邻域 投影':''].map(textOf).join(' ').toLowerCase();const matches=q.every(w=>hay.includes(w));const role=state.filter==='all'||(state.filter==='cache'?/cache|index|缓存|索引/.test(hay):state.filter==='weight'?/weight|parameter|权重|参数/.test(hay):state.filter==='training'?n.group==='training':/activation|vector|激活|向量|hidden/.test(hay));return matches&&role;});}
  function sourceFor(n){const ids=Array.isArray(n.source)?n.source:[n.source];return ids.map(id=>G.sources.find(s=>s.id===id)).filter(Boolean);}
  function sourceScope(n){return n.status==='uncertain'?'公开资料未提供完整计算细节；这里保留已披露的输入、输出与依赖。':n.status==='reported'?'这部分按技术报告描述展示符号关系。':'';}
  function groupedSources(){const byUrl=new Map();for(const s of G.sources){const key=s.url+'|'+s.title;if(!byUrl.has(key))byUrl.set(key,{url:s.url,title:s.title,locators:[]});for(const part of sourceLocator(s).split(/[；;]/).map(x=>x.trim()).filter(Boolean))if(!byUrl.get(key).locators.includes(part))byUrl.get(key).locators.push(part);}return [...byUrl.values()];}
  function sourceLocator(s){return (s.locator||'').replace(/(?:[；;·]\s*)?本地 SHA-256[^；;]*|本地快照\s*\d{4}-\d{2}-\d{2}/g,'').trim();}
  function scopeHTML(){return '';}
  function detail(){const n=nodes.get(state.node),g=groups.get(n.group);const sources=sourceFor(n),inline=window.DSFormulaMath.inline;const incoming=G.edges.filter(e=>e.to===n.id),outgoing=G.edges.filter(e=>e.from===n.id);const relation=(list,direction)=>list.map(e=>{const other=nodes.get(e[direction]);return other?`<li><button class="mp-link-button" data-select="${esc(other.id)}">${esc(other.label)}</button> ${inline(e.label||e.kind)}</li>`:'';}).join('');$('detail').innerHTML=`<span class="mp-status">${esc(g?.label)}</span><h2>${esc(n.label)}</h2><p>${inline(n.description.replaceAll('第 0 层','第 1 层（L0）'))}</p><div class="mp-formula" aria-label="算子公式">${window.DSFormulaMath.node(n)}<button class="mp-formula-expand" id="mp-formula-open" type="button">放大公式 ↗</button></div><div class="mp-shapes"><b>输入</b> ${window.DSFormulaMath.shape(textOf(n.input))}<br>↓<br><b>输出</b> ${window.DSFormulaMath.shape(textOf(n.output))}</div>${scopeHTML(n)}${window.DSMath?.example(n) ? `<details class="mp-example"><summary>教学数值与分量窗口</summary>${window.DSMath.example(n)}</details>` : ''}<p class="mp-route-note">${inline(n.condition||'随当前路径执行。')}</p><details><summary>相关步骤与来源</summary><strong>读入</strong><ul>${relation(incoming,'from')||'<li>路径入口 / 外部输入</li>'}</ul><strong>送往</strong><ul>${relation(outgoing,'to')||'<li>结果或边界节点</li>'}</ul>${sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> · ${esc(sourceLocator(s))}</p>`).join('')}<p>${sourceScope(n)}</p></details><button class="mp-enter" id="mp-enter" ${state.level===2?'disabled':''}>${state.level===0?'展开所在模块 →':state.level===1?'进入计算层 →':'当前：计算详情'}</button><p><a id="mp-local-link" href="guide.html#v2-${hash().slice(1)}">到综合教程查看局部图解 ↗</a></p>`;$('formula-open').onclick=()=>{stop();window.DSFormulaMath.openNode(n,$('formula-open'));};$('enter').onclick=()=>select(n.id,true);$('detail').querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>select(b.dataset.select,false));$('detail').querySelectorAll('[data-scope]').forEach(s=>s.onchange=()=>{state[s.dataset.scope]=+s.value;render();persist();});}
  function tree(){const list=filtered();const showAll=state.query||state.filter!=='all';const visible=showAll?list:state.level===0?null:list.filter(n=>n.group===state.group);$('result-count').textContent=visible?visible.length+' 项':G.groups.length+' 组';$('tree').innerHTML=visible?visible.length?visible.map(n=>`<button class="mp-node-button ${route().includes(n.id)?'mp-onpath':''}" data-select="${esc(n.id)}" aria-current="${n.id===state.node}">${esc(n.label)}<span>${esc(groups.get(n.group)?.label)}</span></button>`).join(''):'<p class="mp-empty">没有匹配项。试试“图片”“索引”或“归一化”。</p>':G.groups.map(g=>`<button class="mp-node-button" data-group="${esc(g.id)}" aria-current="${g.id===state.group}">${esc(g.label)}<span>${G.nodes.filter(n=>n.group===g.id).length} 个算子 · 点击展开</span></button>`).join('');$('tree').querySelectorAll('[data-select]').forEach(b=>{b.onclick=()=>{if(state.level===0)state.level=1;select(b.dataset.select);};b.ondblclick=()=>select(b.dataset.select,true);});$('tree').querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>enterGroup(b.dataset.group));}
  function draw(){const result=view.draw(state,route(),new Set(filtered().map(n=>n.id)),edgeProgress);hits=result.hits;document.body.dataset.renderedView=state.autoView?'layer':String(state.level);}
  function animateFocus(){if(lastMotionNode===state.node)return;lastMotionNode=state.node;cancelAnimationFrame(edgeFrame);if(boosting||suppressTransition||reduced.matches||document.hidden||currentEvent()?.cue?.kind==='repeat'){edgeProgress=1;draw();return;}edgeProgress=0;const start=performance.now();function frame(time){const t=Math.min(1,(time-start)/280);edgeProgress=1-Math.pow(1-t,3);draw();if(t<1)edgeFrame=requestAnimationFrame(frame);else edgeFrame=0;}edgeFrame=requestAnimationFrame(frame);}
  function render(save=true){const layer=G.layers.find(l=>l.index===state.layer)||G.layers[state.layer],n=nodes.get(state.node),r=route(),event=state.browse==='follow'?currentEvent():null;$('layer').value=state.layer;$('scenario').value=state.scenario;$('search').value=state.query;$('filter').value=state.filter;$('speed').value=String(state.speed);$('progress').textContent=state.browse==='free'?'自由浏览':`${state.step+1} / ${r.length} 步`;$('context').innerHTML='<b>'+esc(event?.presentation?'全局定位':event?.cue?.kind==='repeat'?'重复过程 · 加快推进':event?.reveal?'展开与讲解':'当前步骤')+'</b> '+esc(n.label)+(state.autoView||['mhc','attention','csa','moe','cache'].includes(n.group)?esc(' · 第 '+(state.layer+1)+' / 40 层（L'+state.layer+'）'):'')+'：'+window.DSFormulaMath.inline(event?.cue?.kind==='repeat'?event.repeatLabel:(state.group==='training'&&state.level===1&&state.browse==='free'?'分别查看训练目标、梯度范围与参数更新。':event?.explanation||n.description.split('。')[0]));tree();detail();draw();animateFocus();document.body.dataset.level=state.level;let mobile=$('current-mobile');if(!mobile){mobile=document.createElement('div');mobile.id='mp-current-mobile';mobile.className='mp-current-mobile';document.querySelector('.mp-playbar').after(mobile);}mobile.innerHTML='<b>'+esc(n.label)+'</b><p>'+window.DSFormulaMath.inline(n.description.split('。')[0])+'。</p><a href="#mp-detail">查看公式、形状与来源 ↓</a>';const space={vision:'tensor',attention:'attention',mhc:'mhc'}[n.group];$('space').hidden=!space;$('space').textContent=n.group==='vision'?'查看三维张量 ↗':'查看三维向量 ↗';if(save)persist();}
  let transitionWait=0;
  function currentEvent(){return plan()[state.step];}
  function nextDelay(){if(boosting)return 55;return Math.round(transitionWait*Math.min(1,state.speed/.65))+window.ProcessPlayback.duration(currentEvent(),state.speed,{reduced:reduced.matches});}
  function advance(delta){const events=plan();state.step=Math.max(0,Math.min(events.length-1,state.step+delta));const event=events[state.step],group=nodes.get(event.node).group;const before=view.capture(event.viewLevel===0?'__scope':event.kind==='layer'&&!state.autoView?'layer:'+event.layer:state.level===0?group:state.node);state.node=event.node;state.group=group;if(event.layer!==undefined)state.layer=event.layer;state.autoView=event.kind==='layer';state.level=event.viewLevel??1;state.browse='follow';render();if(boosting||suppressTransition){view.cancelTransition();transitionWait=0;}else{view.transition(before,state);transitionWait=reduced.matches?0:(view.lastTransitionMs||0);}document.body.dataset.playbackCue=event.cue?.kind||'explain';document.body.dataset.playbackDelay=String(nextDelay());if(event.sharedFlow){stop();persist();window.MPSharedFlow?.prompt();}}
  function tick(){if(!playing)return;if(state.step>=plan().length-1){stop();render();return;}advance(1);timer=setTimeout(tick,nextDelay());}
  $('layer').innerHTML=Array.from({length:40},(_,i)=>`<option value="${i}">第 ${i+1} 层（L${i}）</option>`).join('');
  $('layer').onchange=()=>{stop();state.layer=+$('layer').value;const events=plan(),index=events.findIndex(e=>e.layer===state.layer&&e.node===state.node&&!e.presentation),fallback=events.findIndex(e=>e.layer===state.layer&&e.kind==='layer');if(state.browse==='follow'&&(index>=0||fallback>=0)){state.step=index>=0?index:fallback;advance(0);}else{state.browse='free';render();}};$('scenario').onchange=()=>{started=false;stop();state.layout='space';state.zoom=1;state.panX=0;state.panY=0;state.yaw=-.16;state.pitch=.22;state.scenario=$('scenario').value;state.originScenario='';state.step=0;state.node=route()[0];state.group=nodes.get(state.node).group;state.level=0;state.autoView=false;render(false);persist(true);};$('search').oninput=()=>{stop();state.query=$('search').value;tree();draw();persist();};$('filter').onchange=()=>{stop();state.filter=$('filter').value;tree();draw();persist();};$('next').onclick=()=>{stop();advance(1);};$('prev').onclick=()=>{stop();advance(-1);};$('replay').onclick=()=>{started=false;stop();state.layout='space';state.zoom=1;state.panX=0;state.panY=0;state.yaw=-.16;state.pitch=.22;state.step=0;state.layer=0;advance(0);};$('play').onclick=()=>{if(playing){stop();draw();}else{const fromReference=state.layout==='diagram';state.layout='space';if(started&&fromReference)advance(0);if(!started||state.browse==='free'||state.step>=plan().length-1 ){state.layout='space';state.zoom=1;state.panX=0;state.panY=0;state.yaw=-.16;state.pitch=.22;state.step=0;state.layer=0;advance(0);}started=true;playing=true;timer=setTimeout(tick,nextDelay());}persist();syncPlay();};$('up').onclick=()=>{const snapshot=view.capture('__scope');stop();state.autoView=false;if(stack.length){const old=stack.pop();Object.assign(state,old);}else state.level=Math.max(0,state.level-1);if(state.level<2)state.layout='space';render(false);persist(true);view.transition(snapshot,state);$('up').focus();};$('home').onclick=()=>{stop();state.level=0;state.autoView=false;state.layout='space';state.browse='free';render();};$('speed').onchange=()=>{state.speed=+$('speed').value;if(playing){clearTimeout(timer);timer=setTimeout(tick,nextDelay());}persist();};
  canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;canvas.style.cursor=hits.some(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h)?'pointer':'default';};canvas.onpointerup=e=>{const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top,hit=hits.findLast(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(hit){if(state.level===0&&!state.autoView)enterGroup(hit.id);else select(hit.id);}};
  canvas.ondblclick=()=>{if(state.level<2)select(state.node,true);};
  canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const items=(view.last?.rects||[]).filter(r=>!r.noHit&&(nodes.has(r.id)||groups.has(r.id))),id=state.level===0&&!state.autoView?nodes.get(state.node).group:state.node,index=Math.max(0,items.findIndex(n=>n.id===id)),step=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-2:2,target=items[(index+step+items.length)%items.length];if(target){if(state.level===0&&!state.autoView){stop();state.node=G.nodes.find(n=>n.group===target.id).id;state.group=target.id;render();}else select(target.id,false,false);}}if(e.key==='Enter'){e.preventDefault();if(state.level===0)enterGroup(nodes.get(state.node).group);else select(state.node,true);}if(e.key==='Escape'&&state.level>0)$('up').click();if(e.key==='Home'){e.preventDefault();$('home').click();}};
  $('space').onclick=()=>{
    stop();persist();const n=nodes.get(state.node),kind={vision:'tensor',attention:'attention',mhc:'mhc'}[n.group];if(!kind)return;
    document.querySelectorAll('[data-spatial-slot]').forEach(slot=>slot.hidden=slot.dataset.spatialSlot!==kind);
    $('spatial-title').textContent={tensor:'图像张量：位置与特征分量',attention:'注意力：向量方向与点积',mhc:'四路向量：混合与写回'}[kind];
    $('spatial-note').textContent={tensor:'行、列定位图像位置，深度展开特征分量；方格组成完整向量，选择和抽出后保持同一个对象。',attention:'三个分量构成完整教学向量，方向与长度参与点积和汇总。这是标准注意力的几何算例；模型特有的共享 KV 与 sink 在计算图中单独说明。',mhc:'每条箭头是一条完整三维教学向量，颜色区分四路。旋转视角帮助观察向量关系，不改变数值。'}[kind];
    $('spatial-dialog').showModal();$('spatial-close').focus();
  };
  $('spatial-close').onclick=()=>$('spatial-dialog').close();$('spatial-dialog').addEventListener('close',()=>{$('space').focus({preventScroll:true});});
  reduced.addEventListener('change',()=>{stop();render();});window.addEventListener('popstate',()=>{stop();restore();render();});window.addEventListener('hashchange',()=>{stop();restore();render();alignSection();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();persist();}});new ResizeObserver(draw).observe(canvas);
  $('count').innerHTML=`<strong>${G.nodes.length}</strong>算子节点 · ${G.groups.length} 个模块`;
  $('coverage-body').innerHTML=`<details open><summary>模块与节点 · 各模块讲什么</summary><ul class="mp-module-cards">${G.groups.map(g=>{const ns=G.nodes.filter(n=>n.group===g.id);return`<li><button data-coverage-group="${g.id}">${esc(g.label)}</button><span>${ns.length} 个节点</span><p>${window.DSFormulaMath.inline(g.description||g.label)}</p></li>`;}).join('')}</ul></details><details><summary>来源与版本 · 到哪里深入阅读</summary><ul class="mp-source-list">${groupedSources().map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span>${s.locators.map(esc).join('　·　')}</span></li>`).join('')}</ul></details><details class="mp-evidence"><summary>共享、条件与未公开细节 · 哪些还不确定</summary><p class="mp-evidence-intro">选择一项，查看公开资料说明了什么，以及还有哪些实现细节未知。</p><div class="mp-evidence-browser"><div class="mp-evidence-picker"><p class="mp-evidence-picker-label">查看的机制</p>${[["dspark","草稿生成与验证"],["training","训练目标"]].map(([group,label])=>`<div role="group" aria-label="${label}"><b>${label}</b>${G.nodes.filter(n=>n.status==="uncertain"&&n.group===group).map(n=>`<button type="button" data-evidence-node="${n.id}" aria-pressed="false">${esc(n.label)}</button>`).join("")}</div>`).join("")}<small>生成循环可返回输入；梯度路径在训练情景中查看。</small></div><article id="mp-evidence-detail" aria-live="polite"></article></div></details>`;$('coverage-body').querySelectorAll('[data-coverage-group]').forEach(b=>b.onclick=()=>{enterGroup(b.dataset.coverageGroup);$('controls').scrollIntoView({block:'start'});$('up').focus();});$('coverage-body').querySelectorAll('[data-coverage-node]').forEach(b=>b.onclick=()=>{state.level=2;select(b.dataset.coverageNode);$('controls').scrollIntoView({block:'start'});});
  function showEvidence(chosen) {
    const buttons=[...document.querySelectorAll('[data-evidence-node]')];
    const current=chosen||buttons.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.evidenceNode||buttons[0]?.dataset.evidenceNode;
    const n=nodes.get(current);
    if(!n)return;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.evidenceNode===current)));
    $('evidence-detail').innerHTML=`<h3>${esc(n.label)}</h3><p>${window.DSFormulaMath.inline(n.description)}</p><button type="button">在计算图中查看此节点 →</button>`;
    $('evidence-detail').querySelector('button').onclick=()=>{state.level=2;select(n.id);$('controls').scrollIntoView({block:'start'});$('up').focus({preventScroll:true});};
  }
  document.querySelectorAll('[data-evidence-node]').forEach(b=>{b.onclick=()=>showEvidence(b.dataset.evidenceNode);});showEvidence();
  ['click','change'].forEach(type=>{document.querySelector('.mp-workbench').addEventListener(type,event=>{
    const control=event.target.closest('button,select,input');if(!control||document.activeElement!==control)return;
    const id=control.id,key=[...control.attributes].find(a=>a.name.startsWith('data-'));
    event.mpFocus={control,id,key};
  },true);document.querySelector('.mp-workbench').addEventListener(type,event=>{
    const saved=event.mpFocus;if(!saved||saved.control.isConnected||document.activeElement!==document.body)return;
    const {id,key}=saved;const replacement=(id?document.getElementById(id):key?[...document.querySelectorAll('['+key.name+']')].find(e=>e.getAttribute(key.name)===key.value):null)||document.querySelector('#mp-tree [aria-current="true"]')||$('up');replacement.focus({preventScroll:true});
  });});
  function continueShared(){const target=currentEvent().node;state.originScenario=state.scenario;state.scenario='text';state.step=plan().findIndex(e=>e.compute&&e.node===target);started=true;advance(0);playing=true;timer=setTimeout(tick,nextDelay());persist();syncPlay();}
  function seek(index){stop();state.step=Math.max(0,Math.min(plan().length-1,Math.round(index)));state.layout='space';started=true;suppressTransition=true;advance(0);suppressTransition=false;persist();}
  function scrubStart(){scrubWasPlaying=playing;stop();}
  function scrubEnd(){if(scrubWasPlaying&&state.step<plan().length-1){playing=true;timer=setTimeout(tick,nextDelay());}scrubWasPlaying=false;persist();syncPlay();}
  function boostStart(){if(boosting||state.step>=plan().length-1)return;boostWasPlaying=playing;clearTimeout(timer);boosting=true;state.layout='space';if(!started||state.browse==='free'){state.step=0;state.layer=0;state.zoom=1;state.panX=0;state.panY=0;advance(0);}started=true;playing=true;view.cancelTransition();timer=setTimeout(tick,0);persist();}
  function boostEnd(){if(!boosting)return;boosting=false;clearTimeout(timer);playing=boostWasPlaying&&state.step<plan().length-1;boostWasPlaying=false;if(playing)timer=setTimeout(tick,nextDelay());persist();syncPlay();}
  addEventListener('blur',()=>{stop();persist();});
  restore();render();alignSection();window.MPTest={state,route,plan,select,render,draw,stop,geometry:()=>view.last,advance,continueShared,seek,scrubStart,scrubEnd,boostStart,boostEnd};
})();

(function(){
 'use strict';const api=window.MPTest;if(!api)return;const stage=document.querySelector('.mp-viewport'),playbar=document.querySelector('.mp-playbar');stage.before(playbar);const contextual=document.createElement('div');contextual.className='mp-dynamic-context';contextual.setAttribute('aria-label','当前流程的补充操作');playbar.after(contextual);
 stage.after(document.querySelector('.mp-view-controls'));const key=document.createElement('div');key.className='mp-map-key';const legend=document.querySelector('.mp-legend');legend.before(key);key.append(legend,document.querySelector('.mp-reading-note'));
 const state=api.state,canvas=document.getElementById('mp-canvas'),reference=document.getElementById('mp-position-reference');
 function refresh(){if(window.MPSceneUI)MPSceneUI.refresh();document.querySelectorAll('[data-mp-layout]').forEach(b=>b.setAttribute('aria-pressed',String(state.layout===b.dataset.mpLayout)));document.getElementById('mp-camera-reset').hidden=state.layout==='diagram';document.getElementById('mp-view-help').textContent=state.layout==='diagram'?'已切换二维关系图；三维视角保留，可随时返回。':state.layout==='space'?'拖动旋转 · Shift＋拖动平移 · ＋/−缩放 · Enter 展开':'算子细读 · 左侧是输入，中央是当前运算，右侧是输出';}
 document.querySelectorAll('[data-mp-layout]').forEach(b=>b.onclick=()=>{api.stop();state.layout=b.dataset.mpLayout;if(state.layout==='diagram'){state.level=2;state.autoView=false;}api.render();});
 document.getElementById('mp-camera-reset').onclick=()=>{state.yaw=-.16;state.pitch=.22;state.zoom=1;state.panX=0;state.panY=0;api.render();};
 let drag=null;canvas.addEventListener('pointerdown',e=>{if(state.layout!=='space'||e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,panX:state.panX||0,panY:state.panY||0,panning:e.shiftKey,moved:false};canvas.setPointerCapture(e.pointerId);},true);
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(!drag.moved)return;e.stopImmediatePropagation();api.stop();if(drag.panning){state.panX=Math.max(-1,Math.min(1,drag.panX+dx/canvas.clientWidth));state.panY=Math.max(-1,Math.min(1,drag.panY+dy/canvas.clientHeight));}else{state.yaw=drag.yaw+dx*.006;state.pitch=Math.max(-.65,Math.min(.7,drag.pitch+dy*.004));}api.draw();canvas.style.cursor='grabbing';},true);
 canvas.addEventListener('pointerup',e=>{if(!drag)return;const moved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(moved){e.preventDefault();e.stopImmediatePropagation();api.render();}},true);
 canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('keydown',e=>{if(!e.altKey||state.layout!=='space'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();api.stop();if(e.key==='ArrowLeft')state.yaw-=.12;if(e.key==='ArrowRight')state.yaw+=.12;if(e.key==='ArrowUp')state.pitch=Math.min(.85,state.pitch+.08);if(e.key==='ArrowDown')state.pitch=Math.max(-.65,state.pitch-.08);api.render();},true);
 new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['data-state']});refresh();
})();

(function(){
'use strict';
const prefix=['午后','，','小猫','趴在','窗边','，','正在'],draft=['安静','地','晒太阳','呢','。'],mainWord='打盹',mainSlot=2;
function data(state,plan){
 const find=id=>plan.findIndex(e=>e.compute&&e.node===id),slots=find('dspark.noise_slots'),candidate=find('dspark.candidates'),verify=find('dspark.verify'),supply=find('dspark.main_token'),accept=find('dspark.accept');
 const current=plan[state.step]||{},started=slots>=0&&state.step>=slots;
 const count=started?(current.draftStep||(state.step>candidate&&candidate>=0?5:0)):0,checked=verify>=0&&state.step>=verify,supplied=supply>=0&&state.step>=supply,committed=accept>=0&&state.step>=accept;
 const confirmed=prefix.map((text,index)=>({text,index,kind:'text'}));
 if(committed){draft.slice(0,mainSlot).forEach((text,i)=>confirmed.push({text,index:prefix.length+i,kind:'accepted',status:'accepted'}));confirmed.push({text:mainWord,index:prefix.length+mainSlot,kind:'corrected',status:'supplied'});}
 const proposed=draft.map((text,i)=>{const index=prefix.length+i;
  if(i===mainSlot&&supplied)return{text:mainWord,index,kind:'corrected',status:'supplied'};
  return{text:i<count?text:'待预测',index,kind:'draft',status:i>=count?'pending':checked?(i<mainSlot?(committed?'accepted':'verified'):i===mainSlot?'rejected':'discarded'):'proposed'};});
 const label=committed?'本轮写下 3 项：2 项草稿通过，第 3 项由主模型补上，前文推进到位置 '+confirmed.length
  :supplied?'主模型补上位置 '+(prefix.length+mainSlot+1)+'：这份结果在验证那一次前向里已经算好'
  :checked?'验证完成：前两项通过':count?'正在展示草稿：'+count+' / 5 项，对应位置 '+(prefix.length+count):'已确认前文到位置 7，草稿位置 8 至 12 等待提出';
 return{confirmed,proposed,generatedCount:count,acceptedCount:committed?mainSlot:0,verifiedCount:checked?mainSlot:0,confirmedLength:confirmed.length,label,supplied,committed};
}
function html(item){return '<span data-token-kind="'+item.kind+'" class="mp-token-'+item.kind+(item.status?' is-'+item.status:'')+'"><small>位置 '+(item.index+1)+'</small><b>'+item.text+'</b>'+'<small>'+(item.status?{pending:'待提出',proposed:'草稿',verified:'验证通过',accepted:'已采用',rejected:'未通过',discarded:'后续未采用',supplied:'主模型补出'}[item.status]:'&#160;')+'</small></span>';}
function row(title,items){return '<div class="mp-sequence-row"><strong>'+title+'</strong><div class="mp-position-cells">'+items.map(html).join('')+'</div></div>';}
function render(state,plan){const d=data(state,plan);return{data:d,html:'<strong>'+d.label+'</strong>'+row('已确认前文',d.confirmed)+row('本轮五个位置',d.proposed)+'<span class="mp-sequence-note">固定教学例：依次展示五项草稿采样；前两项通过验证，第三项由主模型在同一次验证里给出的结果补上。词块是教学切分，候选及验证结果用于示意。</span>'};}
window.MPDraftSequence={data,render};
})();

(function(){
'use strict';
const api=window.MPTest;if(!api)return;
const state=api.state,select=document.getElementById('mp-scenario'),reference=document.getElementById('mp-position-reference');
const choices=[['text','生成一项','从前文出发，走到输出并接着下一轮'],['image','图像汇入','从像素到视觉 token'],['recovery','缓存恢复','工具返回后接着计算'],['dspark','DSpark 草稿','提议、验证与采用'],['training','训练与更新','目标、梯度与参数']];
const picker=document.createElement('fieldset');picker.className='mp-scenario-picker';
picker.innerHTML='<legend class="mp-picker-accessible">选择要观察的流程</legend><div class="mp-scenario-heading"><div><h2>选择要观察的流程</h2><p>从各自的起点出发，在衔接处进入共同主流程。</p></div></div><div class="mp-scenario-options" role="group" aria-label="选择运行流程">'+choices.map(c=>'<button type="button" data-mp-scenario="'+c[0]+'"><b>'+c[1]+'</b><span>'+c[2]+'</span></button>').join('')+'</div>';
const toolbar=document.querySelector('.mp-toolbar');toolbar.before(picker);picker.id='mp-controls';toolbar.removeAttribute('id');picker.querySelector('.mp-scenario-heading').append(document.getElementById('mp-advanced'));select.parentElement.hidden=true;toolbar.hidden=true;
picker.onclick=e=>{const b=e.target.closest('[data-mp-scenario]');if(b){select.value=b.dataset.mpScenario;select.dispatchEvent(new Event('change',{bubbles:true}));}};
const zoom=document.createElement('div');zoom.className='mp-zoom-controls';zoom.innerHTML='<span>缩放</span><button data-mp-zoom="out" aria-label="缩小三维图">−</button><output>100%</output><button data-mp-zoom="in" aria-label="放大三维图">＋</button>';
document.querySelector('.mp-view-controls').append(zoom);
function zoomBy(delta){api.stop();state.zoom=Math.max(.65,Math.min(2.2,Math.round(((state.zoom||1)+delta)*100)/100));api.render();}
zoom.onclick=e=>{const b=e.target.closest('[data-mp-zoom]');if(b)zoomBy(b.dataset.mpZoom==='in' ? .2 : -.2);};
const contextual=document.querySelector('.mp-dynamic-context');
const branches=document.createElement('div');branches.className='mp-training-branches';branches.setAttribute('role','group');branches.setAttribute('aria-label','选择训练分支');contextual.append(branches);
branches.onclick=e=>{const b=e.target.closest('[data-mp-training]');if(!b)return;const branch=MPTrainingScene.branches.find(x=>x.id===b.dataset.mpTraining);state.trainingBranch=branch.id;state.level=1;state.autoView=false;state.zoom=1;state.panX=0;state.panY=0;api.select(branch.nodeIds[0]);state.browse='free';api.render();};
const phases=document.createElement('div');phases.className='mp-training-branches mp-mhc-phases';phases.setAttribute('aria-label','mHC 更新阶段');phases.innerHTML='<button data-mp-mhc-phase="attention">① 注意力更新</button><button data-mp-mhc-phase="ffn">② FFN 更新</button>';contextual.append(phases);phases.onclick=e=>{const b=e.target.closest('[data-mp-mhc-phase]');if(!b)return;state.level=1;state.autoView=false;api.select(b.dataset.mpMhcPhase==='attention'?'mhc.attn_collapse':'mhc.ffn_collapse');api.render();};
function refresh(){
 phases.hidden=state.group!=='mhc'||state.level!==1||state.autoView;phases.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mpMhcPhase===(/mhc\.(ffn|final|coeff_predict_ffn)/.test(state.node)?'ffn':'attention'))));
 picker.querySelectorAll('[data-mp-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mpScenario===state.scenario)));
 const image=state.scenario==='image'||state.originScenario==='image',plan=api.plan(),merge=plan.findIndex(e=>e.node==='vision.span_merge'),ready=image&&(state.originScenario==='image'||merge>=0&&state.step>=merge);
 let entries=image?[{text:'请',kind:'text'},{text:'描述',kind:'text'},{text:'这张图',kind:'text'},...Array.from({length:4},(_,i)=>({text:(ready?'视觉 token ':'图像位 ')+(i+1),kind:'image',pending:!ready}))]:(state.scenario==='recovery'||state.originScenario==='recovery'?['已有','对话','…','工具','返回','的','结果']:['午后','，','小猫','趴在','窗边','，','正在']).map(text=>({text,kind:'text'}));
 const appended=plan.findIndex(e=>e.node==='output.append');
 const writes=!image&&state.scenario!=='recovery'&&state.originScenario!=='recovery'&&state.scenario!=='dspark',continuing=writes&&appended>=0&&state.step>=appended;
 if(writes)entries.push({text:continuing?'睡觉':'本轮生成',kind:'generated',pending:!continuing});
 if(state.scenario==='dspark')entries.push({text:'候选 1',kind:'draft'},{text:'候选 2',kind:'draft'});
 entries=entries.map((entry,index)=>({...entry,index}));
 const current=writes&&!continuing?entries.length-2:entries.length-1;
 const note=image?(ready?'图像位置已写入视觉向量，与文字一起进入语言主干。':'图像占位保留位置；视觉编码与对齐后写入对应向量。')+' 教学示意取 4 个图像位置，实际数量由网格决定。':writes?'前文分段用于位置示意，实际 token 切分由分词器决定；末尾一格留给本轮生成的新项。':'前文分段用于位置示意，实际 token 切分由分词器决定。';
 reference.dataset.sequence=JSON.stringify({entries,ready,scenario:state.scenario});
 reference.innerHTML='<strong>输入序列示意</strong><div class="mp-position-cells">'+entries.map(e=>'<span data-token-kind="'+e.kind+'" class="mp-token-'+e.kind+(e.pending?' is-pending':'')+(e.index===current?' is-current':'')+'"><small>位置 '+(e.index+1)+'</small><b>'+e.text+'</b></span>').join('')+'</div><span>公式中的位置从 0 计数，当前位置是第 '+(current+1)+' 个，记作 <b>t = '+current+'</b>。'+note+'</span>';
 if(state.scenario==='dspark'&&window.MPDraftSequence){const rendered=MPDraftSequence.render(state,plan);reference.innerHTML=rendered.html;reference.dataset.sequence=JSON.stringify(rendered.data);}
 zoom.hidden=state.layout!=='space';zoom.querySelector('output').textContent=Math.round((state.zoom||1)*100)+'%';
 branches.hidden=state.group!=='training'||state.level===0;
 if(window.MPTrainingScene)branches.innerHTML=MPTrainingScene.branches.map(b=>'<button data-mp-training="'+b.id+'" aria-pressed="'+(state.trainingBranch===b.id)+'">'+b.label+'</button>').join('');
}
document.getElementById('mp-canvas').addEventListener('keydown',e=>{if(state.layout==='space'&&['+','=','-'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();zoomBy(e.key==='-' ? -.2 : .2);}},true);
const advanced=document.getElementById('mp-advanced');
const floating=()=>advanced.open&&matchMedia('(min-width:821px)').matches;
document.addEventListener('pointerdown',e=>{if(floating()&&!advanced.contains(e.target))advanced.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&floating()){advanced.open=false;advanced.querySelector('summary').focus();}});
window.MPSceneUI={refresh,zoomBy};refresh();
})();

(function(){
'use strict';
const api=window.MPTest;if(!api)return;
const row=document.createElement('div');row.className='mp-tour-controls';
row.innerHTML='<span class="mp-tour-track"><input id="mp-tour-range" type="range" min="0" step="1" aria-label="总流程进度"></span>';
const playbar=document.querySelector('.mp-playbar');


const context=document.getElementById('mp-context');
const progress=document.getElementById('mp-progress');
if(context)context.before(row);
else playbar.after(row);


const meter=document.createElement('div');meter.className='mp-tour-progress';
meter.append(row.querySelector('.mp-tour-track'));
if(progress)meter.append(progress);

const now=document.createElement('div');now.className='mp-tour-now';
if(context){now.append(context);row.insertBefore(now,row.firstChild);}
row.append(playbar);
row.append(meter);

const SPEEDS=[{value:'0.65',label:'1×'},{value:'0.2167',label:'3×'},{value:'0.0929',label:'7×'}];
const speedValue=document.getElementById('mp-speed');
const speedButton=document.getElementById('mp-speed-cycle');
function speedIndex(){const i=SPEEDS.findIndex(s=>s.value===speedValue.value);return i<0?0:i;}
function syncSpeed(){const s=SPEEDS[speedIndex()];speedButton.textContent=s.label;speedButton.setAttribute('aria-label','播放速度 '+s.label+'，点击切换');}
speedButton.addEventListener('click',()=>{const s=SPEEDS[(speedIndex()+1)%SPEEDS.length];speedValue.value=s.value;speedValue.dispatchEvent(new Event('change'));syncSpeed();});
speedValue.addEventListener('change',syncSpeed);syncSpeed();
const range=row.querySelector('input');
const track=row.querySelector('.mp-tour-track');
const next=document.getElementById('mp-next');
function fill(){const max=Number(range.max)||1,value=Number(range.value)||0;track.style.setProperty('--mp-tour-fill',(max?value/max*100:0).toFixed(2)+'%');}let dragging=false,keyboard=false,pending=null,frame=0;
function refresh(){const plan=api.plan(),s=api.state,live=JSON.parse(document.body.dataset.state||'{}');const scope=({image:'图像汇入进度',recovery:'缓存恢复进度'}[s.scenario]||'总流程进度')+' · 拖动定位';range.setAttribute('aria-label',scope);track.title=scope;range.max=String(plan.length-1);if(!dragging&&!keyboard)range.value=String(s.step);range.setAttribute('aria-valuetext','第 '+(s.step+1)+' 步，共 '+plan.length+' 步，'+(plan[s.step]?.phase||plan[s.step]?.node||''));fill();next.dataset.mpBoosting=live.boosting?'1':'0';next.dataset.mpHint=live.boosting?'快进中…':'下一步 · 按住快进';}
function commit(){frame=0;if(pending!==null){const value=pending;pending=null;api.seek(value);}}
function queue(){pending=Number(range.value);if(!frame)frame=requestAnimationFrame(commit);}
function begin(){if(!dragging){dragging=true;api.scrubStart();}}
function end(){if(frame)cancelAnimationFrame(frame);commit();dragging=false;keyboard=false;api.scrubEnd();refresh();}
range.addEventListener('pointerdown',begin);range.addEventListener('input',()=>{if(!dragging&&!keyboard){keyboard=true;api.scrubStart();}fill();queue();});range.addEventListener('change',end);range.addEventListener('pointerup',()=>{if(dragging)end();});range.addEventListener('pointercancel',end);


const HOLD=1000;let holdTimer=0,held=false,suppress=false,keyDownAt=0;
function stopHold(){if(holdTimer){clearTimeout(holdTimer);holdTimer=0;}if(held){held=false;suppress=true;api.boostEnd();refresh();}}
next.addEventListener('pointerdown',e=>{if(e.button!==0||next.disabled)return;suppress=false;holdTimer=setTimeout(()=>{holdTimer=0;held=true;api.boostStart();refresh();},HOLD);});
['pointerup','pointercancel','pointerleave'].forEach(type=>next.addEventListener(type,stopHold));
next.addEventListener('blur',stopHold);addEventListener('blur',stopHold);


next.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key)||next.disabled)return;if(!e.repeat){keyDownAt=performance.now();return;}if(held||performance.now()-keyDownAt<HOLD)return;e.preventDefault();held=true;api.boostStart();refresh();});
next.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){keyDownAt=0;stopHold();}});


playbar.addEventListener('click',e=>{if(suppress&&e.target.closest('#mp-next')){suppress=false;e.stopPropagation();e.preventDefault();}},true);
new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['data-state']});refresh();
})();

(function(){
'use strict';
const api=window.MPTest;if(!api)return;
const dialog=document.createElement('dialog');dialog.id='mp-shared-dialog';dialog.className='mp-shared-dialog';dialog.setAttribute('aria-labelledby','mp-shared-title');
dialog.innerHTML='<h2 id="mp-shared-title">接下来进入共同主流程</h2><p id="mp-shared-copy"></p><p>后续沿用“生成一项”的主干计算与输出步骤，从对应位置接着看。</p><div><button id="mp-shared-continue" type="button">接入主流程并继续播放 →</button><button id="mp-shared-stay" type="button">留在这里</button></div>';
const viewport=document.querySelector('.mp-viewport'),shade=document.createElement('div');shade.className='mp-shared-shade';shade.hidden=true;viewport.append(shade,dialog);dialog.setAttribute('aria-modal','false');dialog.addEventListener('close',()=>{shade.hidden=true;});
const status=document.createElement('div');status.className='mp-shared-status';status.hidden=true;document.querySelector('.mp-dynamic-context').append(status);
function origin(){return api.state.scenario==='image'?'图像表示已经写入输入序列。接下来扩展为四路残差流。':'所需的局部状态已经恢复。接下来读取新位置的 token 编号。';}
function prompt(){dialog.querySelector('#mp-shared-copy').textContent=origin();shade.hidden=false;const x=scrollX,y=scrollY;if(!dialog.open){dialog.show();scrollTo(x,y);}dialog.querySelector('#mp-shared-continue').focus({preventScroll:true});}
dialog.querySelector('#mp-shared-continue').onclick=()=>{dialog.close();api.continueShared();document.getElementById('mp-play').focus({preventScroll:true});};
dialog.querySelector('#mp-shared-stay').onclick=()=>dialog.close();
function refresh(){const s=api.state,event=api.plan()[s.step];if(!event?.sharedFlow&&dialog.open)dialog.close();status.hidden=!event?.sharedFlow&&!s.originScenario;if(event?.sharedFlow){status.innerHTML='<span>'+origin()+'</span> <button type="button">接入共同主流程 →</button>';status.querySelector('button').onclick=prompt;}else if(s.originScenario){status.textContent='已从'+({image:'图像汇入',recovery:'缓存恢复'}[s.originScenario]||'另一个起点')+'接入共同主流程 · 保留当前输入，继续逐层计算。';}}
new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['data-state']});window.MPSharedFlow={prompt};refresh();
})();
