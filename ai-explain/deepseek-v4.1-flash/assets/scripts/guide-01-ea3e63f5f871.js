const BENCH_DATA=[{"name":"DeepSWE v1.1","metric":"Resolved · %","values":[54.4,74.2,74,73],"message":"V4.1 明显高于 V4-Flash；这个任务上与所列闭源模型接近。"},{"name":"Terminal-Bench 2.1","metric":"Pass@1 · %","values":[82.7,90.6,89.1,88.8],"message":"这一版本任务上，V4.1 的报告分数较高。"},{"name":"Terminal-Bench 4.0","metric":"Pass@1 · %","values":[7,31.2,51.8,39.9],"message":"换到 4.0，V4.1 虽高于 V4-Flash，仍低于图中两种闭源模型。"},{"name":"GPQA Diamond","metric":"Pass@1 · %","values":[89.9,90.9,93.4,94.1],"message":"知识推理这项只比 V4-Flash 高 1.0 个百分点。"}];

(function(root){
const token=(t,i,cls='')=>`<span class="fv9-token ${cls}"><small>位置 ${i}</small><b>${t}</b></span>`;
const rail=(a,cls='')=>`<div class="fv9-tokenrail">${a.map((t,i)=>token(t,i+1,cls)).join('')}</div>`;
const connector='<div class="fv9-connector" aria-hidden="true"><i></i></div>';
const section=(id,title,p,body)=>`<section class="story-section" id="${id}"><h3>${title}</h3><p class="section-lead">${p}</p>${body}</section>`;
const fig=(body,cap)=>`<figure class="fv9-figure">${body}<figcaption>${cap}</figcaption></figure>`;
const generationPrompt=['午后','，','小猫','趴在','窗边','，','正在'];
const generationContinuation=['睡觉','，','尾巴','轻轻','摆动','。'];
const generationCandidates=[
 [['睡觉',.58],['休息',.27],['玩耍',.15]],
 [['，',.64],['。',.28],['并且',.08]],
 [['尾巴',.52],['它的',.32],['窗外',.16]],
 [['轻轻',.55],['缓缓',.31],['不停',.14]],
 [['摆动',.57],['摇晃',.29],['晃动',.14]],
 [['。',.82],['，',.12],['着',.06]]
];
const generationLastStep=generationContinuation.length*3;
function generationV9State(step=0){
 const s=Math.max(0,Math.min(generationLastStep,Math.trunc(Number(step)||0))),done=s===generationLastStep;
 const accepted=Math.floor(s/3),round=Math.min(accepted,generationContinuation.length-1),phase=s%3;
 const known=generationPrompt.concat(generationContinuation.slice(0,accepted));
 const chosen=phase===2?generationContinuation[round]:done?generationContinuation.at(-1):null;
 const currentOutputPosition=done?known.length:known.length+1;
 const confirmed=chosen&&!done?known.concat(chosen):known;
 return {step:s,lastStep:generationLastStep,round:round+1,phase,done,accepted,known,confirmed,outputPosition:currentOutputPosition,candidate:phase>0,candidates:generationCandidates[round],result:chosen||'？',
 label:done?'整句已经生成完成':phase===0?(s===0?'已经给定的开头':`“${generationContinuation[accepted-1]}”已经加入输入`):phase===1?`第 ${round+1} 轮 · 下一项还只是候选`:`第 ${round+1} 轮 · 选出“${chosen}”`,
 work:done?'这段演示在句号处结束':phase===0?(s===0?'准备处理 7 个已知位置':`准备处理刚加入的位置 ${known.length}`):phase===1?`根据位置 ${known.length} 的计算结果，预测位置 ${currentOutputPosition}`:'本轮候选中已经选定一个 token',
 detail:done?'六轮选择已经完成。新生成的六项都已接入上方输入，整句保留在下方。':phase===0?(s===0?'开头的 7 个位置已经给定。先根据这些输入，计算下一项的候选。':`“${generationContinuation[accepted-1]}”已接入上方输入。接下来计算它的内部状态，预测后面的内容。`):phase===1?`位置 ${currentOutputPosition} 有了候选概率，还未选定结果，因此输出仍是问号。`:`已选出“${chosen}”，尚未送入下一轮计算。下一步把它接到上方输入的右端。`,
 next:done?'句子已完成':phase===0?'计算下一项候选':phase===1?`选出“${generationContinuation[round]}”`:`把“${chosen}”加入输入`
 };
}
function generationV10Known(s){return `<div class="fv9-tokenrail fv10-long-rail">${s.known.map((t,i)=>token(t,i+1,i>=generationPrompt.length?'fv10-feedback':'')).join('')}</div>`}
function generationV10Confirmed(s){return `<span class="fv10-original-text">${generationPrompt.join('')}</span><strong>${s.confirmed.slice(generationPrompt.length).join('')}</strong>${s.done?'':'<span class="fv10-writing-caret" aria-hidden="true"></span>'}`}
function generationV9Markup(){const s=generationV9State(0);return section('generation-rounds','一个词怎样从候选变成下一轮的输入？','从较长的开头“午后，小猫趴在窗边，正在”出发，观察后面的整句怎样逐步形成。模型处理的文字小单位叫 token，图中的词块是为教学安排的切分。',fig(`<div class="fv12-generation-workbench"><div class="fv12-generation-heading"><h4 id="fv9-gen-title">${s.label}</h4><span id="fv9-gen-counter">已加入 0 / 6 个新 token</span></div><div class="fv10-cycle-steps" aria-label="每轮包含三个动作">${['计算候选','选出输出','加入输入'].map((t,i)=>`<span data-gen-dot="${i}" class="${i===0?'current':''}"><b>${i+1}</b>${t}</span>`).join('')}</div><div class="fv9-gen-scene fv10-long-scene" id="fv9-gen-scene" data-step="0" data-phase="0"><div class="fv9-gen-zone fv12-input-zone"><div class="fv12-input-label"><b>已有文字 · 输入</b><span>按位置排列，新增项接在右端</span></div><div class="fv10-input-scroll" id="fv9-gen-input">${generationV10Known(s)}</div></div>${connector}<div class="fv12-generation-compute"><div class="fv9-gen-engine"><b id="fv9-gen-work">${s.work}</b><span class="fv11-prob-scale">候选概率 · 满长为 100%</span><div id="fv9-gen-candidates" class="fv9-candidates" aria-label="教学候选分布，横条长度表示概率，满长为百分之百"><div class="fv9-skeleton" aria-hidden="true"><span>&#160;</span><i style="--width:55%"></i><small>&#160;</small></div><div class="fv9-skeleton" aria-hidden="true"><span>&#160;</span><i style="--width:31%"></i><small>&#160;</small></div><div class="fv9-skeleton" aria-hidden="true"><span>&#160;</span><i style="--width:14%"></i><small>&#160;</small></div><span class="fv9-placeholder">点击下方“计算下一项候选”，这里会列出三个候选和各自的概率</span></div></div><div class="fv12-choice-arrow" aria-hidden="true">→</div><div class="fv9-gen-zone fv9-gen-output"><span class="fv9-axislabel">本轮输出</span><div id="fv9-gen-output">${token('？',8,'pending')}</div><span id="fv12-output-state">尚未选定</span></div></div></div><div class="fv12-action-area"><p id="fv9-gen-detail" class="fv9-live-note" aria-live="polite">${s.detail}</p><div class="fv9-controls fv10-generation-controls"><button id="fv9-gen-prev" disabled>上一步</button><button id="fv9-gen-next" class="primary">${s.next} <span aria-hidden="true">→</span></button><button id="fv10-gen-round" disabled>完成下一轮</button><button id="fv9-gen-reset" class="quiet">重新开始</button></div><div class="fv10-confirmed"><span>已经确定的文字</span><p id="fv10-confirmed-text" aria-live="polite">${generationV10Confirmed(s)}</p></div></div></div><p class="fv10-controls-note">首轮逐步观察；熟悉后，可用“完成本轮／下一轮”依次完成该轮剩余动作。上方保留输入，问号表示本轮输出尚未选定。</p>`,'词块切分、概率与选择结果均为教学设定。演示在句号处结束；真实生成由模型与请求设置共同决定停止条件。'))+section('generation-inside','模型里，数字沿着一层层计算继续变化。','每轮都使用同一组模型参数。注意力把不同位置的信息联系起来；前馈网络继续变换各位置的表示。',fig(`<div class="in21"><div class="in21-input"><small>第一轮 · 已知输入</small><b>午后，小猫趴在窗边，正在</b></div><ol class="in21-stages"><li><span class="in21-num">1</span><div><b>嵌入与位置处理</b><span>每个文字 token 查表得到一条向量。V4.1 的嵌入向量有 <strong>5,120 个分量（5,120 维）</strong>，如 <i>h</i> = [0.2, −0.4, …]。</span></div></li><li><span class="in21-num">2</span><div class="in21-layer"><b>Transformer 层 · 逐层更新隐藏向量</b><div class="in21-pair"><span><strong>注意力</strong><small>汇总可见位置的信息</small></span><i aria-hidden="true">→</i><span><strong>前馈网络</strong><small>变换各位置的表示</small></span></div><small>这样的层依次堆叠，持续更新向量的各个分量。主干中每路隐藏表示保持 5,120 维；注意力与前馈模块内部会使用其他维度。</small></div></li><li><span class="in21-num">3</span><div><b>输出层</b><span>末尾位置“正在”的最终隐藏向量 → 下一 token 的候选分布。</span></div></li></ol><div class="in21-output"><span>从候选中选出本轮输出</span><strong>睡觉</strong><span>接回输入，进入下一轮</span></div><p class="in21-note">向量就是按顺序排列的一组数；“维度”是这组数的个数。方括号展示前几个分量，省略号代表其余分量。后面会展开 V4.1 如何让同一位置同时保留四路这样的向量。</p></div>`,'这组负责语言计算的层，统称语言主干。图中省略多头注意力内部、归一化与残差细节；下一章先解释位置，第 3 章再放大一个注意力头，并说明多个头如何合并。'))}
const vectors=[[.2,-.4,.1,.8],[.7,.1,-.3,.4],[-.1,.6,.9,-.2]];
function embeddingV9State(i){const index=Math.max(0,Math.min(2,i));return {index,word:['小猫','正在','睡觉'][index],vector:vectors[index]}}
function embeddingPanel(i){const s=embeddingV9State(i);return `<div><small>位置 ${i+1} · ${s.word}</small><b>这个位置对应的嵌入向量</b><div class="fv11-embedding-vector" role="img" aria-label="示意向量：${s.vector.join('，')}"><span class="fv11-vector-bracket">[</span>${s.vector.map((v,j)=>`<span class="fv11-vector-number"><em>${v.toFixed(1)}</em><small>第 ${j+1} 维</small></span>${j<s.vector.length-1?'<span class="fv11-vector-comma">,</span>':''}`).join('')}<span class="fv11-vector-comma">,</span><span class="fv11-vector-more">…</span><span class="fv11-vector-bracket">]</span></div></div><p>括号里是这组向量的数值，包含正数和负数。这里只展示前 4 个维度；位置处理还会帮助注意力区分先后顺序。</p>`}
function causalV9State(row=1,appended=false){const r=Math.max(0,Math.min(appended?3:2,row));return {row:r,count:appended?4:3,known:['小猫','正在','睡觉',...(appended?['。']:[])],visible:Array.from({length:r+1},(_,i)=>i),next:['正在','睡觉','。','后续内容'][r]}}
function causalV9Matrix(row=1,appended=false){const s=causalV9State(row,appended),ts=['小猫','正在','睡觉','。'];return `<table class="fv9-mask"><caption>每一行计算一个位置的表示；每一列是可供参考的输入。</caption><thead><tr><th>正在更新<br>哪个位置？</th>${ts.map((t,i)=>`<th class="${i>=s.count?'fv9-inactive':''}"><small>参考位置 ${i+1}</small>${i>=s.count?'待加入':t}</th>`).join('')}</tr></thead><tbody>${ts.map((t,i)=>`<tr class="${i===s.row?'fv9-selected-row':''} ${i>=s.count?'fv9-inactive':''}"><th><button data-fv9-row="${i}" ${i>=s.count?'disabled':''} aria-pressed="${i===s.row}"><small>位置 ${i+1}</small>${i>=s.count?'待加入':t}</button></th>${ts.map((_,j)=>`<td class="${i>=s.count||j>=s.count?'inactive':j<=i?'allowed':'blocked'}" aria-label="${i>=s.count||j>=s.count?'尚未加入输入':j<=i?'可以参考':'被因果遮罩挡住'}">${i>=s.count||j>=s.count?'—':j<=i?'●':'×'}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
function representationV9Markup(){return section('embedding','输入序列中的每个位置先取得一条数值向量。','以“小猫 正在 睡觉”为例：位置 1、2、3 先标出次序；每个位置的 token 身份决定查词嵌入（embedding）表中的哪一行，得到的整行数值就是该位置的初始向量。',fig(`<div class="fv9-known-stamp"><span>用户已提供</span><b>小猫正在睡觉</b></div><p class="fv9-instruction">将鼠标移到词块上，查看这个位置对应的数字。触屏可点按，键盘可聚焦。</p><div class="fv9-embed-tokens">${['小猫','正在','睡觉'].map((t,i)=>`<button data-fv9-embed="${i}" aria-pressed="${i===0}"><small>位置 ${i+1}</small><b>${t}</b><span>查看表示</span></button>`).join('')}</div><div class="fv9-embed-panel" id="fv9-embed-panel" aria-live="polite">${embeddingPanel(0)}</div>`,'数字为教学示意；词义通常由多个维度共同表达，真实向量包含更多维度。'))+section('causality','词的身份进入模型后，表示会随上下文继续更新。','输入先确定每个位置的词身份。因果 Transformer 随后用当前位置及其左侧内容更新这个位置的表示，并用更新结果预测下一项；可参考的范围由因果遮罩规定。',fig(`<div class="fv9-causal-context"><b>本图的输入已经给定</b><div id="fv9-causal-known">${rail(['小猫','正在','睡觉'])}</div></div><div class="fv12-causal-toolbar"><p class="fv9-instruction">点选一行，观察该位置能参考哪些输入。</p><button id="fv9-causal-append">把句号加入已知输入</button></div><div class="fv12-causal-workspace"><div><div class="fv9-table-scroll" id="fv9-causal-matrix">${causalV9Matrix()}</div><div class="fv9-mask-key"><span>● 可以参考</span><span>× 被因果遮罩挡住</span><span>— 尚未加入</span></div></div><aside class="fv12-causal-observation" aria-label="选中位置的含义"><div class="fv9-causal-concrete" id="fv9-causal-concrete"><div><small>已知词</small><b>位置 2 · 正在</b></div><div><small>本轮要计算的对象</small><b>位置 2 的内部表示</b><span>利用“小猫、正在”</span></div><div><small>表示用于预测</small><b>位置 3 的候选</b><span>训练时与目标“睡觉”比较</span></div></div><p class="fv9-live-note" id="fv9-causal-note" aria-live="polite">位置 2 的表示只用“小猫、正在”。“睡觉”是训练中要预测的下一项，不能用来计算位置 2 的表示。</p></aside></div><p class="fv9-invariant" id="fv9-causal-invariant">把句号加入后，位置 2 原来允许参考的两个位置保持不变。</p>`,'完整已知句子可以在训练中一起处理，但每个位置仍遵守同样的因果限制。推理时尚未生成的未来文字自然还未进入输入。'))}
function prefillV11References(position){return `<div class="fv11-reference-set" aria-label="可参考位置 1${position>1?' 至 '+position:''}">${[1,2,3].map(j=>`<span class="${j<=position?'fv11-reference-visible':'fv11-reference-masked'}" aria-label="位置 ${j}，${j<=position?'可以参考':'未来位置，被遮罩挡住'}"><b>${j}</b><i aria-hidden="true">${j<=position?'✓':'×'}</i></span>`).join('')}</div>`}
function phasesV9Markup(){return section('phase-sequence','已知的一段输入，可以按层一起处理。','同一层的三个位置都从这一层的输入读取信息，因此可以组成矩阵一起计算。等这一层完成，三个位置的输出一起成为下一层的输入。',fig(`<div class="fv9-batch"><span class="lab-label">首次读入 · Prefill</span><div class="fv11-batch-guide"><b>横向：同一层的 3 个位置</b><span>纵向：从第 1 层依次到第 3 层</span></div><div class="fv9-batch-row"><span>已知输入</span>${['小猫','正在','睡觉'].map((t,i)=>token(t,i+1)).join('')}</div><div class="fv11-reference-legend"><span><i class="fv11-visible-key">✓</i>能参考的位置</span><span><i class="fv11-masked-key">×</i>未来位置，因果遮罩挡住</span><small>每个编号对应上方同一列的词。</small></div>${[1,2,3].map(n=>`<div class="fv9-batch-row"><span>第 ${n} 层<small>${n===1?'读嵌入表示':'读第 '+(n-1)+' 层输出'}</small></span>${[1,2,3].map(i=>`<div class="fv9-batch-cell"><b>更新位置 ${i}</b><small>注意力可参考</small>${prefillV11References(i)}</div>`).join('')}</div>`).join('')}<div class="fv11-batch-result"><b>读图示例</b><p>第 2 层更新“正在”（位置 2）时，参考的是第 1 层产生的位置 1、2 的表示。相同的因果边界在每一层都成立。</p></div></div>`,'每个编号块代表一个输入位置，✓ / × 表示可见性，不表示注意力权重或计算耗时。这里展示 3 层通用教学模型；V4.1 的实际 40 层结构在第 6 章展示。'))+section('phase-decode','逐步生成时，下一项要等上一轮选定。','例如“睡觉”被选出后，它才成为新的已知位置。计算这个位置的表示，才能得到后面句号、逗号等候选。',fig(`<ol class="fv9-time-list"><li><span>01</span><div><small>首次读入</small><b>已知“小猫 · 正在” → 计算 → 选出“睡觉”</b><p>处理多个已知位置，建立它们的 K/V 缓存。</p></div></li><li><span>02</span><div><small>继续生成 · Decode</small><b>新位置“睡觉” → 计算 → 选出“。”</b><p>复用历史 K/V，只为刚确定的新位置追加状态。</p></div></li><li><span>03</span><div><small>后续轮次</small><b>用户或工具带来新内容 → 再次读入</b><p>命中的前缀可沿用缓存；新增内容需要计算。</p></div></li></ol>`,'“读入少做一些计算”和“生成时一次接受多个 token”作用于不同环节。后文分别由 CED 与 DSpark 展开。'))}
function initFoundationsV9(){
let step=0,row=1,appended=false,lastKnownCount=7,lastCandidateKey=0,lastOutputKey='？:8';const el=id=>document.getElementById(id);
function renderGen(){const s=generationV9State(step);el('fv9-gen-scene').dataset.step=s.step;el('fv9-gen-scene').dataset.phase=s.phase;el('fv9-gen-counter').textContent=`已加入 ${s.accepted} / 6 个新 token`;el('fv9-gen-title').textContent=s.label;el('fv9-gen-work').textContent=s.work;el('fv12-output-state').textContent=s.done?'已加入输入':s.phase===2?'已选定 · 待加入输入':'尚未选定';const scroll=el('fv9-gen-input');if(lastKnownCount!==s.known.length){scroll.innerHTML=generationV10Known(s);scroll.scrollLeft=scroll.scrollWidth;lastKnownCount=s.known.length}const outputKey=s.result+':'+s.outputPosition;if(lastOutputKey!==outputKey){el('fv9-gen-output').innerHTML=token(s.result,s.outputPosition,s.result==='？'?'pending':'new');lastOutputKey=outputKey}const candidateKey=s.candidate?s.round:s.done?-1:0;if(lastCandidateKey!==candidateKey){el('fv9-gen-candidates').innerHTML=s.candidate?s.candidates.map(([t,n])=>`<div><span>${t}</span><i style="--width:${n*100}%"></i><small>${Math.round(n*100)}%</small></div>`).join(''):`${s.done?'':'<div class="fv9-skeleton" aria-hidden="true"><span>&#160;</span><i style="--width:55%"></i><small>&#160;</small></div><div class="fv9-skeleton" aria-hidden="true"><span>&#160;</span><i style="--width:31%"></i><small>&#160;</small></div><div class="fv9-skeleton" aria-hidden="true"><span>&#160;</span><i style="--width:14%"></i><small>&#160;</small></div>'}<span class="fv9-placeholder">${s.done?'六轮续写完成':'点击下方“计算下一项候选”，这里会列出三个候选和各自的概率'}</span>`;lastCandidateKey=candidateKey}el('fv10-confirmed-text').innerHTML=generationV10Confirmed(s);el('fv9-gen-detail').textContent=s.detail;el('fv9-gen-prev').disabled=s.step===0;el('fv9-gen-next').disabled=s.done;el('fv10-gen-round').disabled=s.step<3||s.done;el('fv10-gen-round').textContent=s.phase===0?'完成下一轮':'完成本轮';el('fv9-gen-next').innerHTML=s.next+' <span aria-hidden="true">→</span>';document.querySelectorAll('[data-gen-dot]').forEach((d,i)=>{d.classList.toggle('current',!s.done&&i===s.phase);d.classList.toggle('done',s.done||i<s.phase)});el('fv9-gen-scene').classList.toggle('fv9-result-ready',s.phase===2)}
function renderEmbed(i){el('fv9-embed-panel').innerHTML=embeddingPanel(i);document.querySelectorAll('[data-fv9-embed]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.fv9Embed)===i))}
function renderCausal(){const s=causalV9State(row,appended);row=s.row;el('fv9-causal-known').innerHTML=rail(s.known);const word=s.known[row],prefix=s.known.slice(0,row+1).join('、');el('fv9-causal-matrix').innerHTML=causalV9Matrix(row,appended);el('fv9-causal-concrete').innerHTML=`<div><small>已知词</small><b>位置 ${row+1} · ${word}</b></div><div><small>本轮要计算的对象</small><b>位置 ${row+1} 的内部表示</b><span>利用“${prefix}”</span></div><div><small>表示用于预测</small><b>位置 ${row+2} 的候选</b><span>${row<2?'训练时与目标“'+s.next+'”比较':'例如“'+s.next+'”'}</span></div>`;el('fv9-causal-note').textContent=`位置 ${row+1} 的表示只用“${prefix}”。`+(row<2?`“${s.next}”是训练中要预测的下一项，不能用来计算位置 ${row+1} 的表示。`:'当前词已经知道；这里在计算它用于预测下一项的内部表示。');el('fv9-causal-append').textContent=appended?'移除刚加入的句号':'把句号加入已知输入';el('fv9-causal-invariant').textContent=appended&&row<3?`句号已经加入。位置 ${row+1} 依旧只能参考原来的 ${row+1} 个位置，内部表示不因右侧新增文字而改变。`:'旧位置的表示只依赖原来的前文，这为后面的缓存复用提供了条件。'}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='fv9-gen-next'&&step<generationLastStep){step++;renderGen()}if(b.id==='fv9-gen-prev'&&step>0){step--;renderGen()}if(b.id==='fv10-gen-round'&&step>=3&&step<generationLastStep){step=Math.min(generationLastStep,(Math.floor(step/3)+1)*3);renderGen()}if(b.id==='fv9-gen-reset'){step=0;renderGen()}if('fv9Embed'in b.dataset)renderEmbed(Number(b.dataset.fv9Embed));if('fv9Row'in b.dataset){row=Number(b.dataset.fv9Row);renderCausal();const replacement=document.querySelector(`[data-fv9-row="${row}"]`);if(replacement)replacement.focus({preventScroll:true})}if(b.id==='fv9-causal-append'){appended=!appended;renderCausal()}});
for(const event of ['mouseover','focusin'])document.addEventListener(event,e=>{const b=e.target.closest('[data-fv9-embed]');if(b)renderEmbed(Number(b.dataset.fv9Embed))});
}
Object.assign(root,{generationV9Markup,representationV9Markup,phasesV9Markup,generationV9State,embeddingV9State,causalV9State,causalV9Matrix,prefillV11References,initFoundationsV9});
})(globalThis);

(function (root) {
  'use strict';
  const H = [[1, 0], [0, 1], [1, 1]];
  const WQ = [[1, 0], [0, .5]];
  const WK = [[.5, 0], [0, 1]];
  const WV = [[1, .2], [.1, 1]];
  const TOKENS = ['小猫', '正在', '睡觉'];
  const multiply = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, v, k) => sum + v * b[k][j], 0)));
  const Q = multiply(H, WQ), K = multiply(H, WK), V = multiply(H, WV);
  const scalar = n => Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const decimal = n => n.toFixed(3);
  const variable = (letter, index) => `<i>${letter}</i><sub>${index}</sub>`;
  const math = content => `<math xmlns="http://www.w3.org/1998/Math/MathML">${content}</math>`;
  const symbol = (letter, index) => `<msub><mi>${letter}</mi>${/^\d+$/.test(String(index)) ? `<mn>${index}</mn>` : `<mi>${index}</mi>`}</msub>`;
  const vectorNodes = values => `<mrow><mo fence="true" stretchy="false">[</mo>${values.map(n => `<mn>${scalar(n)}</mn>`).join('<mo separator="true">,</mo>')}<mo fence="true" stretchy="false">]</mo></mrow>`;
  const vector = values => `<span class="qv9-vector">${math(vectorNodes(values))}</span>`;
  const equality = (letter, index, values, approximate=false) => `<span class="qv11-equality">${math(`${symbol(letter,index)}<mo>${approximate?'≈':'='}</mo>${vectorNodes(values)}`)}</span>`;
  const matrixNodes = values => `<mrow><mo fence="true" stretchy="true">[</mo><mtable>${values.map(row=>`<mtr>${row.map(n=>`<mtd><mn>${scalar(n)}</mn></mtd>`).join('')}</mtr>`).join('')}</mtable><mo fence="true" stretchy="true">]</mo></mrow>`;
  const weightBar = value => `<div class="qv11-weight-scale"><div class="qv9-weight-bar" role="img" aria-label="权重 ${(value*100).toFixed(1)}%，整条轨道代表100%"><span style="--weight:${value*100}%"></span></div><div class="qv11-scale-labels"><span>0%</span><span>100%</span></div></div>`;
  const headSymbol = n => `<msup><mi>Z</mi><mrow><mo>(</mo><mn>${n}</mn><mo>)</mo></mrow></msup>`;
  function qkvV9Attention(query, visibleCount = 3) {
    if (!Array.isArray(query) || query.length !== 2 || query.some(n => !Number.isFinite(n))) throw new TypeError('query must contain two finite numbers');
    if (!Number.isInteger(visibleCount) || visibleCount < 1 || visibleCount > 3) throw new RangeError('visibleCount must be 1, 2 or 3');
    const scores = K.map((k, i) => i < visibleCount ? query.reduce((sum, v, j) => sum + v * k[j], 0) / Math.SQRT2 : -Infinity);
    const max = Math.max(...scores), exp = scores.map(n => Math.exp(n - max)), sum = exp.reduce((a, b) => a + b, 0);
    const weights = exp.map(n => n / sum);
    const contributions = V.map((v, i) => v.map(n => n * weights[i]));
    const output = [0, 1].map(j => contributions.reduce((s, v) => s + v[j], 0));
    return {query:query.slice(), scores, weights, contributions, output};
  }
  const a = qkvV9Attention(Q[2]);
  const positions = () => TOKENS.map((word, i) => `<span class="qv9-position"><small>位置 ${i+1}</small><b>${word}</b></span>`).join('');
  const pair = (index, cls='') => `<span class="qv9-kv ${cls}"><span class="qv9-k">${variable('k', index)}</span><span class="qv9-v">${variable('v', index)}</span></span>`;
  const caption = text => `<p class="qv9-caption">${text}</p>`;
  const connector = () => '<div class="qv9-down" aria-hidden="true"><span></span></div>';
  function matrixRow(letter, desc, data, className) {
    return `<tr class="${className}"><th scope="row"><b>${letter}</b><small>${desc}</small></th>${data.map((v, i) => `<td data-qv9-pos="${i+1}">${equality(letter.toLowerCase(),i+1,v)}</td>`).join('')}</tr>`;
  }
  function qkvV14Overview() {
    const sub = (letter,index) => `${letter}<tspan baseline-shift="sub" font-size="70%">${index}</tspan>`;
    const matrix = (id,x,y,letter,description,tone='neutral') => `<g data-qv14-node="${id}" data-qv15-stage="1" role="button" tabindex="0" aria-label="第 1 步：${letter}，${description}" aria-pressed="false" class="qv14-tone-${tone}"><rect class="qv14-matrix-box" x="${x}" y="${y}" width="145" height="92" rx="31"/><text class="qv14-letter" x="${x+23}" y="${y+54}">${letter}</text><text class="qv14-equals" x="${x+46}" y="${y+54}">=</text><path class="qv14-bracket" d="M${x+64} ${y+15}h-7v62h7 M${x+118} ${y+15}h7v62h-7"/><text class="qv14-rows" x="${x+88}" y="${y+28}">${sub(letter.toLowerCase(),1)}</text><text class="qv14-rows" x="${x+88}" y="${y+49}">${sub(letter.toLowerCase(),2)}</text><text class="qv14-rows" x="${x+88}" y="${y+70}">${sub(letter.toLowerCase(),3)}</text><text class="qv14-node-caption" x="${x+72.5}" y="${y+119}">${description}</text></g>`;
    const projection=(letter,y,description,tone)=>`<g data-qv14-node="W${letter}" data-qv15-stage="1" role="button" tabindex="0" aria-label="第 1 步：${description}" aria-pressed="false" class="qv14-tone-${tone}"><rect class="qv14-operation-box" x="230" y="${y}" width="150" height="92" rx="6"/><text class="qv14-projection" x="305" y="${y+37}">乘 <tspan class="qv14-math">${sub('W',letter)}</tspan></text><text class="qv14-small" x="305" y="${y+68}">${description}</text></g>`;
    const edge=(from,to,d,tone='neutral')=>`<path data-qv14-from="${from}" data-qv14-to="${to}" class="qv14-edge qv14-tone-${tone}" d="${d}" marker-end="url(#qv14-arrow-${tone})"/>`;
    return `<figure class="qv14-overview" id="qv15-overview" data-qv15-current="all" aria-labelledby="qv14-overview-title">
      <figcaption id="qv14-overview-title"><b>一个注意力头的完整计算路径</b><span>连线总览 · 四步算例</span></figcaption>
      <p class="qv14-overview-intro">输入 <i>H</i> 的每一行对应一个位置。三组投影分别产生 <span class="qv9-q">查询 Q</span>、<span class="qv9-k">键 K</span> 和 <span class="qv9-v">值 V</span>；查询与键决定权重，权重再用于汇总值。</p>
      <div class="qv15-controls" role="group" aria-label="选择计算步骤或查看算例">
        <button type="button" class="qv15-show-all" data-qv15-select="all" aria-pressed="true">全图</button>
        ${['三组投影','查询与键匹配','分数变成权重','按权重汇总'].map((name,i)=>`<div class="qv15-step-control" data-qv15-control="${i+1}"><button type="button" data-qv15-select="${i+1}" aria-pressed="false"><span>${i+1}</span>${name}</button><a href="#qv9-step-${i+1}" aria-label="查看第 ${i+1} 步算例：${name}">详解</a></div>`).join('')}
      </div>
      <p id="qv15-selection-note" class="qv15-selection-note" aria-live="polite" aria-atomic="true">全图：从 H 的三组投影开始，沿连线追踪到输出 Z。</p>
      <div class="qv14-scroll-hint">图内可以横向滑动，查看右侧的权重与输出。</div>
      <div class="qv14-diagram-scroll" tabindex="0" role="region" aria-label="完整注意力计算图">
      <svg class="qv14-diagram" viewBox="0 0 1120 644" xmlns="http://www.w3.org/2000/svg" role="group" aria-labelledby="qv14-svg-title qv14-svg-desc">
        <title id="qv14-svg-title">H 经三组投影产生 Q、K、V，计算权重后汇总 V，得到 Z</title>
        <desc id="qv14-svg-desc">本图同时包含三个已知位置，每个矩阵的三行分别对应小猫、正在、睡觉。H 分别乘查询、键和值的投影矩阵，得到 Q、K、V。Q 乘 K 的转置得到分数 S。分数除以键维数的平方根，遮住未来位置，再对每行做 softmax（把一行分数换成总和为 1 的权重），得到权重 A。A 乘 V 得到该头输出 Z。下方算例追踪第 3 行。</desc>
        <defs>${['neutral','q','k','v'].map(tone=>`<marker id="qv14-arrow-${tone}" markerWidth="8" markerHeight="8" refX="9.4" refY="5" orient="auto" viewBox="0 0 10 10"><path class="qv14-arrow-fill qv14-tone-${tone}" d="M0 0L10 5L0 10Z"/></marker>`).join('')}</defs>
        <text class="qv14-guide" x="305" y="27">① 三组投影</text><text class="qv14-guide" x="743" y="208">② 查询与键匹配</text>
        <path class="qv14-trunk" d="M165 316H202 M202 106V526"/><circle class="qv14-junction" cx="202" cy="316" r="3.5"/>
        ${edge('H','WQ','M202 106H230','q')}${edge('H','WK','M202 316H230','k')}${edge('H','WV','M202 526H230','v')}
        ${edge('WQ','Q','M380 106H430','q')}${edge('WK','K','M380 316H430','k')}${edge('WV','V','M380 526H430','v')}
        ${edge('Q','S','M575 106H620V268H656','q')}${edge('K','S','M575 316H620V336H656','k')}
        ${edge('S','normalize','M830 302H888')}${edge('normalize','A','M992 394V438','q')}
        ${edge('A','AV','M935 512V545','q')}${edge('V','AV','M575 526H650V585H870','v')}${edge('AV','Z','M1000 585H1040','v')}
        <text class="qv14-node-caption" x="92.5" y="252">该层输入</text>${matrix('H',20,270,'H','每行一个位置')}
        ${projection('Q',60,'查询投影','q')}${projection('K',270,'键投影','k')}${projection('V',480,'值投影','v')}
        ${matrix('Q',430,60,'Q','各位置的查询','q')}${matrix('K',430,270,'K','各位置的键','k')}${matrix('V',430,480,'V','各位置的值','v')}
        <g data-qv14-node="S" data-qv15-stage="2" role="button" tabindex="0" aria-label="第 2 步：查询与键匹配" aria-pressed="false" class="qv14-tone-neutral"><rect class="qv14-operation-box" x="656" y="240" width="174" height="124" rx="8"/><text class="qv14-operation-title" x="743" y="277">矩阵相乘</text><text class="qv14-equation qv14-math" x="743" y="316">S = QK<tspan baseline-shift="super" font-size="70%">T</tspan></text><text class="qv14-small" x="743" y="345">每个查询 × 各个键</text></g>
        <text class="qv14-edge-label" x="612" y="370">K<tspan baseline-shift="super" font-size="70%">T</tspan></text><text class="qv14-edge-label" x="858" y="286">S</text>
        <g data-qv14-node="normalize" data-qv15-stage="3" role="button" tabindex="0" aria-label="第 3 步：缩放、因果遮罩与 softmax" aria-pressed="false" class="qv14-tone-neutral"><rect class="qv14-operation-box" x="888" y="174" width="208" height="220" rx="8"/><text class="qv14-operation-title" x="992" y="207">③ 分数变成权重</text><text class="qv14-small" x="992" y="248">除以 <tspan class="qv14-math">√d<tspan baseline-shift="sub" font-size="70%">k</tspan></tspan></text><text class="qv14-small" x="992" y="280">未来位置设为 −∞</text><text class="qv14-small" x="992" y="312">每行做 softmax</text><text class="qv14-footnote" x="992" y="365">d<tspan baseline-shift="sub" font-size="70%">k</tspan> 是每个键的维数</text></g>
        <g data-qv14-node="A" data-qv15-stage="3" role="button" tabindex="0" aria-label="第 3 步：注意力权重" aria-pressed="false" class="qv14-tone-q"><rect class="qv14-matrix-box" x="888" y="438" width="208" height="74" rx="28"/><text class="qv14-operation-title" x="992" y="467">注意力权重 A</text><text class="qv14-small" x="992" y="494">每行权重总和为 1</text></g>
        <text class="qv14-footnote" x="724" y="425">未来位置的权重为 0</text><text class="qv14-footnote" x="724" y="454">可见位置的 V 按权重相加</text>
        <g data-qv14-node="AV" data-qv15-stage="4" role="button" tabindex="0" aria-label="第 4 步：按权重汇总 V" aria-pressed="false" class="qv14-tone-v"><rect class="qv14-operation-box" x="870" y="545" width="130" height="80" rx="8"/><text class="qv14-equation qv14-math" x="935" y="578">A × V</text><text class="qv14-small" x="935" y="609">④ 加权汇总</text></g>
        <g data-qv14-node="Z" data-qv15-stage="4" role="button" tabindex="0" aria-label="第 4 步：输出表示" aria-pressed="false" class="qv14-tone-v"><rect class="qv14-matrix-box" x="1040" y="545" width="65" height="80" rx="25"/><text class="qv14-letter" x="1072.5" y="578">Z</text><text class="qv14-small" x="1072.5" y="609">输出</text></g>
        <text class="qv14-edge-label qv14-tone-v" x="812" y="568">V</text>
      </svg></div>
      <p class="qv14-overview-note">图中三个位置同时保留：矩阵 <i>H</i>、<i>Q</i>、<i>K</i>、<i>V</i>、<i>Z</i> 的第 3 行都对应“睡觉”。<i>A</i> 的第 3 行给出它读取各位置的权重。下方追踪这一行的具体数字。</p><p class="qv14-overview-note"><strong>Rotary Position Embedding（旋转位置编码，RoPE）</strong>把一条向量的分量两两配对，按它所在的位置旋转。旋转不改变每一对分量的长度，只让两个位置的<b>相对距离</b>影响后面的点积——所以它必须发生在投影之后、打分之前。<b>V 不旋转</b>，输入处的 embedding 也不因此改变；每一层都重做一次，因为每层都有自己新算出的 Q 和 K。V4.1 里每个头的 512 维只有末 64 维参与旋转，其余分量原样参加点积；索引器另有一套自己的 Q、K，同样在打分前旋转末 64 维。</p>
    </figure>`;
  }
  function qkvV9Markup() {
    return `<div class="qv9-module">
      <div class="qv9-heading"><span class="qv9-badge">通用基础 · 后续创新的起点</span><h3>注意力怎样汇总不同位置的信息？</h3><p>这次输入已经完整给定：<strong>“小猫 正在 睡觉”</strong>。这一次要算的是位置 3 的内部表示；它经过后续层和输出层，才能用于预测<strong>“睡觉”后面的内容</strong>。</p></div>
      <p class="qv10-single-head-note"><strong>这里放大的是一个注意力头。</strong>多头注意力（Multi-Head Attention）会并行执行多组查询与汇总，再合并结果。下面只沿其中一个头计算，末尾再看怎样合并。</p><div class="qv9-context"><span>本次已知输入</span><div>${positions()}</div><span class="qv9-target">本节跟踪位置 3 的计算</span></div>
      ${qkvV14Overview()}
      <section class="qv9-stage" aria-labelledby="qv9-step-1"><div class="qv9-stage-head"><span>1</span><div><h4 id="qv9-step-1">同一个位置，生成三种用途的数字</h4><p>该层输入 <i>H</i> 每个位置占一行。分别乘三组矩阵，就得到查询 <i>Q</i>、键 <i>K</i>、值 <i>V</i>；这个乘法叫<strong>投影</strong>。</p></div></div>
      <div class="qv9-equations">${['Q','K','V'].map(l=>`<div class="qv9-${l.toLowerCase()}">${math(`<mi>${l}</mi><mo>=</mo><mi>H</mi><mo>×</mo>${symbol('W',l)}`)}</div>`).join('')}</div>
      <div class="qv9-table-scroll"><table class="qv9-position-table"><thead><tr><th scope="col">沿一列看同一位置</th>${TOKENS.map((t,i)=>`<th scope="col"><small>位置 ${i+1}</small><b>${t}</b></th>`).join('')}</tr></thead><tbody>${matrixRow('H','这一层的输入表示',H,'qv9-h')}${matrixRow('Q','查询：与各位置的键匹配',Q,'qv9-q')}${matrixRow('K','键：参与匹配，得到分数',K,'qv9-k')}${matrixRow('V','值：提供被加权汇总的内容',V,'qv9-v')}</tbody></table></div>
      ${caption('大写 H、Q、K、V 表示包含所有位置的矩阵；小写 h₃、q₃、k₃、v₃ 表示其中位置 3 的那一行。等号右侧的方括号列出向量分量。为便于核算，本例只用 2 维教学数字，各维共同构成数值特征。')}
      <details class="qv9-details"><summary>查看本例使用的三组矩阵</summary><p><i>W</i> 是训练得到、推理时使用的参数。下列数字仅用于这个算例，乘法在每个位置上都相同。</p><div class="qv9-parameter-matrices">${[['Q',WQ],['K',WK],['V',WV]].map(([l,w])=>`<div>${math(`${symbol('W',l)}<mo>=</mo>${matrixNodes(w)}`)}</div>`).join('')}</div></details></section>
      ${connector()}
      <section class="qv9-stage" aria-labelledby="qv9-step-2"><div class="qv9-stage-head"><span>2</span><div><h4 id="qv9-step-2">位置 3 的查询，分别与三个键匹配</h4><p>继续使用上表的 ${variable('q',3)}。因为三个位置都在它的可见范围内，这次得到三个匹配分数。</p></div></div>
      <div class="qv9-query-band"><span class="qv9-q">${equality('q',3,Q[2])}</span><span>同一个查询，参与下面三次匹配</span></div>
      <div class="qv9-three-cols">${TOKENS.map((word,i)=>`<div class="qv9-match-cell" data-qv9-pos="${i+1}"><small>位置 ${i+1} · ${word}</small><div class="qv9-key-vector"><span class="qv9-k">${equality('k',i+1,K[i])}</span></div><div class="qv9-mini-operation">${math(`<mfrac><mrow>${symbol('q','3')}<mo>·</mo>${symbol('k',String(i+1))}</mrow><msqrt><mn>2</mn></msqrt></mfrac>`)}</div><strong class="qv11-score-result"><span>≈</span> ${decimal(a.scores[i])}</strong><span class="qv9-cell-label">匹配分数</span></div>`).join('')}</div>
      ${caption('向量点积得到分数，再除以 √2（本例每个键有 2 维）。如果计算位置 2，位置 3 属于未来，它的分数会被遮罩为 −∞，最终权重为 0。')}</section>
      ${connector()}
      <section class="qv9-stage" aria-labelledby="qv9-step-3"><div class="qv9-stage-head"><span>3</span><div><h4 id="qv9-step-3">把三个分数变成总和为 1 的权重</h4><p><strong>softmax</strong> 是这里的归一化计算：分数越高，分到的权重越大。每条轨道的全长都代表 100%，蓝色填充的长度表示这一项权重。</p></div></div>
      <div class="qv9-three-cols">${TOKENS.map((word,i)=>`<div class="qv9-weight-cell" data-qv9-pos="${i+1}"><small>位置 ${i+1} · ${word}</small><span class="qv9-weight-before">分数 ${decimal(a.scores[i])}</span>${weightBar(a.weights[i])}<strong>${(a.weights[i]*100).toFixed(1)}<small>%</small></strong><span class="qv9-cell-label">注意力权重</span></div>`).join('')}</div><div class="qv9-total">三个权重相加 = 100%</div></section>
      ${connector()}
      <section class="qv9-stage" aria-labelledby="qv9-step-4"><div class="qv9-stage-head"><span>4</span><div><h4 id="qv9-step-4">按权重汇总三个值，得到新的表示</h4><p>回到上表的 ${variable('v',1)}、${variable('v',2)}、${variable('v',3)}。每个值先乘自己的权重，再把结果相加。</p></div></div>
      <div class="qv9-three-cols">${TOKENS.map((word,i)=>`<div class="qv9-value-cell" data-qv9-pos="${i+1}"><small>位置 ${i+1} · ${word}</small><div class="qv9-v">${equality('v',i+1,V[i])}</div><div class="qv9-value-product">${math(`<mn>${a.weights[i].toFixed(3)}</mn><mo>×</mo>${symbol('v',i+1)}`)}</div><div class="qv11-contribution">${math(`<mo>≈</mo>${vectorNodes(a.contributions[i])}`)}</div><span class="qv9-cell-label">这一位置的加权结果</span></div>`).join('')}</div>
      ${connector()}<div class="qv9-output"><span>三个加权结果相加</span><strong>${equality('z',3,a.output,true)}</strong><p>位置 3 得到一次注意力计算的输出。它汇入该位置的后续计算；此处输出的是<strong>数字表示</strong>。</p></div>
      ${caption('显示数字经过四舍五入，实际计算使用未舍入值，所以这里用 ≈ 表示近似。这仍是一个注意力头的局部输出；它还要与其他头合并，再经过后续网络。')}
      <details class="qv9-details qv9-toy qv12-toy"><summary>动手计算：查询变化，汇总结果怎样变化？</summary><p>沿用上面的三个键和值，实验查询设为 ${math('<mi>q</mi><mo>=</mo><mo>[</mo><mi>x</mi><mo>,</mo><mn>1</mn><mo>−</mo><mi>x</mi><mo>]</mo>')}。拖动滑块，紧邻的输出向量会随之变化。</p><div class="qv12-control-result"><div class="qv12-current-query"><span>当前查询</span><strong id="qv12-toy-query">${math(`<mi>q</mi><mo>=</mo>${vectorNodes([.5,.5])}`)}</strong></div><label for="qv9-query-slider">第一分量 x <output id="qv9-query-value">0.50</output><span class="qv11-slider-complement">第二分量 = 1 − x</span><input id="qv9-query-slider" type="range" min="0" max="1" step="0.05" value="0.5" aria-describedby="qv12-toy-hint" aria-valuetext="第一分量 0.50，第二分量 0.50"></label><div class="qv12-immediate-output" aria-live="polite" aria-atomic="true"><span>加权汇总后的输出</span><strong id="qv12-toy-output">${math(`<mi>z</mi><mo>≈</mo>${vectorNodes(qkvV9Attention([.5,.5]).output)}`)}</strong></div></div><p id="qv12-toy-hint" class="qv9-caption">每次拖动都会重新计算下面三行；三行的加权结果相加，就是上方输出。K、V 和模型参数保持不变。</p><div id="qv9-toy-result">${qkvV9ToyMarkup(.5)}</div></details></section>
      <section class="qv10-heads" aria-labelledby="qv10-heads-title"><h4 id="qv10-heads-title">多个注意力头怎样合成一次输出？</h4><p>同一层的输入同时送入多个头。各头可以得到不同的权重与汇总结果，再把这些结果拼接，经过输出投影。</p><div class="qv10-heads-parallel">${[1,2,3].map(n=>`<div><small>注意力头 ${n}</small><b>查询 → 匹配 → 汇总</b><span>得到本头结果 ${math(headSymbol(n))}</span></div>`).join('')}</div>${connector()}<div class="qv10-heads-merge"><span>拼接各头结果，再做一次矩阵乘法</span>${math(`<mi>O</mi><mo>=</mo><mi mathvariant="normal">Concat</mi><mo>(</mo>${headSymbol(1)}<mo>,</mo>${headSymbol(2)}<mo>,</mo><mo>…</mo><mo>)</mo><mo>×</mo>${symbol('W','O')}`)}</div>${caption('上标 (1)、(2) 表示头编号；每个大写 Z 都是一整个头的结果矩阵，其中每行仍对应一个位置。这里用 3 个头示意多头计算。多个查询头也可以共享 K/V；这与后文的跨层缓存共享是两种不同的共享关系。')}</section>
      <section class="qv9-cache-section" aria-labelledby="qv9-cache-title"><div class="qv9-heading"><span class="qv9-badge">把上面的计算接回逐步生成</span><h3 id="qv9-cache-title">同一层为什么只需为新位置追加 K/V？</h3><p>现在回到生成场景：最初只提供“<strong>小猫 正在</strong>”。模型算完这两个位置，选出“睡觉”；随后把刚选出的词送回模型，为预测后面的内容做准备。</p></div>
      <div class="qv9-cache-scroll"><table class="qv9-cache-table"><thead><tr><th scope="col">沿时间向下看</th>${TOKENS.map((t,i)=>`<th scope="col"><small>位置 ${i+1}</small><b>${i===2?'即将新增的位置':t}</b></th>`).join('')}</tr></thead><tbody>
      <tr><th scope="row"><span class="qv9-time">A</span><b>处理完输入</b><small>下一项的分布已得到</small></th><td>${pair(1,'qv9-existing')}<small>已保存</small></td><td>${pair(2,'qv9-existing')}<small>已保存</small></td><td class="qv9-not-yet"><span>下一项尚未选出</span></td></tr>
      <tr><th scope="row"><span class="qv9-time">B</span><b>选出“睡觉”</b><small>文字已经确定</small></th><td>${pair(1,'qv9-existing')}<small>保持原样</small></td><td>${pair(2,'qv9-existing')}<small>保持原样</small></td><td><span class="qv9-new-word">睡觉</span><small>自己的 K/V 待下一轮计算</small></td></tr>
      <tr><th scope="row"><span class="qv9-time">C</span><b>处理“睡觉”</b><small>预测再下一项</small></th><td>${pair(1,'qv9-reused')}<small class="qv9-success">沿用已有结果</small></td><td>${pair(2,'qv9-reused')}<small class="qv9-success">沿用已有结果</small></td><td>${pair(3,'qv9-added')}<small class="qv9-amber">由新位置计算</small></td></tr>
      </tbody></table></div>
      <div class="qv9-cache-read"><b class="qv9-q">本轮新算 ${variable('q',3)}</b><p>仍按上面的四步：与 ${variable('k',1)}、${variable('k',2)}、${variable('k',3)} 匹配，再汇总 ${variable('v',1)}、${variable('v',2)}、${variable('v',3)}。</p></div>
      <div class="qv9-conclusion"><strong>旧位置的前文保持相同，因此旧 K/V 可以继续用。</strong><p>右侧加入“睡觉”后，位置 1、2 仍只能读取原来的前文。新一轮需要新的查询 ${variable('q',3)}，这次匹配由新查询发起。</p></div>
      ${caption('这里展示标准因果自注意力的一层。不同层通常各有自己的缓存；DeepSeek 对哪些层共享、保存哪些形式的状态作出的改动，将在后文单独标出。KV 缓存本身是沿用的通用技术。')}</section>
      <p class="qv9-source">基础公式参考：<a href="https://arxiv.org/html/1706.03762v7#S3.SS2" target="_blank" rel="noopener noreferrer">Attention Is All You Need · §3.2</a></p>
    </div>`;
  }
  function qkvV9ToyMarkup(x) {
    const result=qkvV9Attention([x,1-x]);
    return `<div class="qv12-calculation-rows">${result.weights.map((w,i)=>`<div class="qv12-calculation-row"><div class="qv12-row-position"><small>位置 ${i+1}</small><strong>${TOKENS[i]}</strong></div><div class="qv12-row-score"><small>匹配分数</small><span>≈ ${decimal(result.scores[i])}</span></div><div class="qv12-row-weight"><small>权重 <b>${(w*100).toFixed(1)}%</b></small>${weightBar(w)}</div><div class="qv12-row-contribution"><small>本行加权结果</small><span>${math(`<mn>${decimal(w)}</mn><mo>×</mo>${symbol('v',i+1)}<mo>≈</mo>${vectorNodes(result.contributions[i])}`)}</span></div></div>`).join('')}</div>`;
  }
  function initQkvV15Overview() {
    const overview=document.getElementById('qv15-overview');
    if (!overview || overview.dataset.initialized) return;
    overview.dataset.initialized='true';
    const steps={
      '1':{nodes:['H','WQ','WK','WV','Q','K','V'],edges:['H:WQ','H:WK','H:WV','WQ:Q','WK:K','WV:V'],note:'第 1 步：H 的每一行分别乘三组矩阵，得到该位置的 q、k、v。'},
      '2':{nodes:['Q','K','S'],edges:['Q:S','K:S'],note:'第 2 步：每个查询与各个键匹配。矩阵 S 的一行保存一个查询得到的全部分数。'},
      '3':{nodes:['S','normalize','A'],edges:['S:normalize','normalize:A'],note:'第 3 步：分数经缩放、因果遮罩与 softmax，得到权重 A；每行的权重总和为 1。'},
      '4':{nodes:['A','V','AV','Z'],edges:['A:AV','V:AV','AV:Z'],note:'第 4 步：A 的每行权重分别乘各位置的 V，再相加，得到 Z 中对应位置的一行。'}
    };
    function select(stage) {
      if(stage!=='all' && !steps[stage]) return;
      overview.dataset.qv15Current=stage;
      const state=steps[stage];
      overview.querySelectorAll('[data-qv14-node]').forEach(node=>{
        const active=!state || state.nodes.includes(node.dataset.qv14Node);
        node.classList.toggle('qv15-active',active);
        node.classList.toggle('qv15-muted',!active);
        node.setAttribute('aria-pressed',String(stage===node.dataset.qv15Stage));
      });
      overview.querySelectorAll('[data-qv14-from]').forEach(edge=>{
        const active=!state || state.edges.includes(edge.dataset.qv14From+':'+edge.dataset.qv14To);
        edge.classList.toggle('qv15-active',active);
        edge.classList.toggle('qv15-muted',!active);
      });
      overview.querySelectorAll('[data-qv15-select]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.qv15Select===stage)));
      overview.querySelectorAll('[data-qv15-control]').forEach(group=>group.classList.toggle('qv15-selected',group.dataset.qv15Control===stage));
      document.getElementById('qv15-selection-note').textContent=state?state.note:'全图：从 H 的三组投影开始，沿连线追踪到输出 Z。';
    }
    overview.querySelectorAll('[data-qv15-select]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.qv15Select)));
    overview.querySelectorAll('[data-qv15-stage]').forEach(node=>{
      node.addEventListener('click',()=>select(node.dataset.qv15Stage));
      node.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();select(node.dataset.qv15Stage);}
      });
    });
    select('all');
  }
  function initQkvV9() {
    initQkvV15Overview();
    const slider=document.getElementById('qv9-query-slider');
    if (!slider || slider.dataset.initialized) return;
    slider.dataset.initialized='true';
    slider.addEventListener('input',()=>{
      const n=Number(slider.value);
      const result=qkvV9Attention([n,1-n]);
      document.getElementById('qv9-query-value').textContent=n.toFixed(2);
      slider.setAttribute('aria-valuetext',`第一分量 ${n.toFixed(2)}，第二分量 ${(1-n).toFixed(2)}`);
      document.getElementById('qv12-toy-query').innerHTML=math(`<mi>q</mi><mo>=</mo>${vectorNodes(result.query)}`);
      document.getElementById('qv12-toy-output').innerHTML=math(`<mi>z</mi><mo>≈</mo>${vectorNodes(result.output)}`);
      document.getElementById('qv9-toy-result').innerHTML=qkvV9ToyMarkup(n);
    });
  }
  root.qkvV9Markup=qkvV9Markup;
  root.initQkvV9=initQkvV9;
  root.qkvV9Attention=qkvV9Attention;
  root.qkvV9Matrices=()=>({H:H.map(x=>x.slice()),Q:Q.map(x=>x.slice()),K:K.map(x=>x.slice()),V:V.map(x=>x.slice()),WQ:WQ.map(x=>x.slice()),WK:WK.map(x=>x.slice()),WV:WV.map(x=>x.slice())});
})(globalThis);


(function(root){
'use strict';
const kv='<span class="cv9-k">K</span> / <span class="cv9-v">V</span>';
const down='<div class="cv9-down" aria-hidden="true"></div>';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokens=a=>'<div class="cv9-tokens">'+a.map(s=>'<span class="cv9-token">'+esc(s)+'</span>').join('')+'</div>';
const unit=(small,head,body='',cls='')=>`<div class="cv9-unit ${cls}"><small>${small}</small><strong>${head}</strong>${body?'<div class="cv9-unit-body">'+body+'</div>':''}</div>`;
const heading=(n,t,p)=>`<header class="cv9-subhead"><span class="cv9-step-label">${n}</span><h3>${t}</h3><p>${p}</p></header>`;
const source=(s)=>`<p class="cv9-source">${s}</p>`;
function primer(){return `<section class="cv9-section" id="ced9-names">${heading('01 · 信息怎样组织','同样是中文输入、中文输出，可以走两种路径。','用同一项任务比较：读一段中文，再用一句中文概括。关键在于输入与输出是否分别组织成两条序列，以及输出从哪里获得输入的信息。')}<div class="cv9-task-context"><small>共同任务 · 概括这段话</small><p>小猫趴在窗边，听见响声后睁开眼睛。</p><span>两种架构都已经输出「小猫」，现在预测后面接什么。</span></div><div class="cv9-compare cv9-primer-compare cv12-primer">
<figure class="cv9-panel"><figcaption><span class="cv9-badge cv9-inherited">已有架构</span><strong>编码器–解码器</strong><span>源序列与输出序列分别处理</span></figcaption>
<div class="cv9-source-sentence"><small>源序列 · 已给定的资料</small>小猫趴在窗边，听见响声后睁开眼睛。</div>${down}${unit('先处理源序列','编码器','经典 Transformer 中，每个源位置可以利用整个源序列。')}${down}<div class="cv9-memory"><small>源侧 · 供解码器反复参考</small><strong>编码器输出 → 交叉注意力的 K/V</strong></div>${down}<div class="cv12-decoder-block"><div class="cv12-output-input"><small>输出序列 · 作为解码器的输入</small><span>已有输出 <b>小猫</b></span></div><div class="cv12-decoder-operation"><strong>解码器</strong><ol><li>用因果自注意力处理已有输出。</li><li>由输出侧状态产生 <span class="cv9-q">Q</span>，与上方源侧 <span class="cv9-k">K</span> 匹配，再汇总源侧 <span class="cv9-v">V</span>。</li></ol><span>这一步跨越两条序列，叫作<strong>交叉注意力</strong>。</span></div></div>${down}<div class="cv9-output"><small>选出下一项 · 继续输出中文</small><strong>醒了</strong></div><div class="cv9-bottom-note"><b>两条序列、两组层</b>：资料由编码器处理；已有输出由解码器处理，并读取编码器的结果。</div></figure>
<figure class="cv9-panel"><figcaption><span class="cv9-badge cv9-inherited">已有架构</span><strong>仅解码器 · decoder-only</strong><span>资料、指令与已有输出排成一条序列</span></figcaption><div class="cv9-unified-sequence"><div><small>序列前段 · 任务与资料</small><span>概括：小猫趴在窗边，听见响声后睁开眼睛。</span></div><div><small>序列末尾 · 已有输出</small><strong>小猫</strong></div></div>${down}${unit('处理同一条序列','因果 Transformer 层','每个位置利用自己及其之前的内容。输出位置通过自注意力，直接参考前面的任务、资料和已有输出。')}${down}<div class="cv12-output-state"><small>末尾位置完成各层计算</small><strong>得到输出「小猫」的上下文表示</strong><span>经输出层转换，得到下一项的候选分布。</span></div>${down}<div class="cv9-output"><small>选出下一项 · 继续输出中文</small><strong>醒了</strong></div><div class="cv9-bottom-note"><b>一条序列、一组层</b>：资料与输出共用这些层。自注意力的 Q 与 K/V 来自同一条序列。</div></figure></div><p class="cv9-takeaway">这两种架构都可以完成同语言任务。经典编码器–解码器的特点是<strong>分别组织源序列与输出序列，再用交叉注意力连接</strong>。V4.1 的 CED 则是在<strong>同一条因果序列内部</strong>重新分配前后两段的职责。</p>${source('<a href="https://arxiv.org/html/1706.03762v7#S3.SS1" target="_blank" rel="noopener">原始 Transformer 论文 §3.1、§3.2.3 ↗</a>；“醒了”为教学选词。这里只比较信息路径，完整层结构还包括前馈网络、残差连接等。')}</section>`;}
function numberedLayers(start){return '<div class="cv9-layer-numbers" aria-label="第 '+start+' 至 '+(start+19)+' 层">'+Array.from({length:20},(_,i)=>'<span>'+ (start+i)+'</span>').join('')+'</div>';}
function indexerPrimer(){return `<figure class="cv13-indexer" aria-labelledby="cv13-indexer-title"><figcaption><strong id="cv13-indexer-title">先筛选条目，再用主注意力汇总信息。</strong><span>索引器是负责筛选的轻量组件。它使用自己的一套 Q、K，回答“这次应取哪些历史条目？”</span></figcaption><div class="cv13-indexer-grid">
<div class="cv13-indexer-stage"><h4><span>1</span>筛选用的向量从哪里来？</h4><div class="cv13-indexer-origin cv13-query-origin"><small>当前要计算的位置</small><strong>该位置的状态</strong><div class="cv13-conversion">乘查询转换矩阵</div><b>索引器 Q</b></div><div class="cv13-indexer-origin cv13-key-origin"><small>历史中每一个主 K/V 条目</small><strong>主 K/V：#1　#2　#3　#4</strong><div class="cv13-conversion">各条目分别乘键转换矩阵</div><b>索引器 K：#1　#2　#3　#4</b></div><p>转换矩阵的数值由训练确定。原主 K/V 仍然保留，额外生成的索引器 K 用于筛选。</p></div>
<div class="cv13-indexer-stage"><h4><span>2</span>按分数，选出条目编号</h4><p>索引器 Q 与各条目的索引器 K 匹配，得到筛选分数。</p><table class="cv13-indexer-scores"><thead><tr><th scope="col">条目</th><th scope="col">筛选分数</th><th scope="col">本次选择</th></tr></thead><tbody><tr class="cv13-index-selected"><th scope="row">#1</th><td>0.9</td><td>选中</td></tr><tr><th scope="row">#2</th><td>0.2</td><td>—</td></tr><tr><th scope="row">#3</th><td>0.4</td><td>—</td></tr><tr class="cv13-index-selected"><th scope="row">#4</th><td>0.8</td><td>选中</td></tr></tbody></table><div class="cv13-index-result"><small>选取最高的 2 个 · Top-2</small><strong>条目编号 #1、#4</strong></div><p>Top-K 中的 K 是“选几个”的数量；与向量名称 K 含义不同。此处只取 2 个作示意，报告配置为 Top-512。</p></div>
<div class="cv13-indexer-stage"><h4><span>3</span>取回原数据，计算输出</h4><div class="cv13-main-query"><small>当前状态另行转换</small><strong class="cv9-q">主注意力 Q</strong></div><div class="cv13-main-data"><div><small>按编号取回</small><strong>原主 K/V：#1、#4</strong></div><span aria-hidden="true">+</span><div><small>本层最近窗口</small><strong>局部 K/V</strong></div></div><div class="cv13-main-operation"><b>主 Q 与这些 K 匹配</b><span>得到注意力权重，按权重汇总 V</span></div><div class="cv13-main-output">本层新的输出表示</div><p>筛选分数决定选谁；主注意力重新计算权重，决定怎样汇总。两种分数承担不同职责。</p></div></div>
<section class="cv13-indexer-detail cv16-indexer-example" aria-labelledby="indexer-projection-title"><h4 id="indexer-projection-title">主 K/V 怎样转换成索引器 K？</h4><div class="cv13-projection-example"><p><strong>索引器 K = 主 K/V 条目 × 键转换矩阵。</strong>用 3 个数表示一条主 K/V；把它乘一个 3 × 2 的矩阵，得到含 2 个数的索引器 K。</p><div class="cv13-projection-equation"><div><small>原主 K/V 条目 #1 的向量 c<sub>1</sub></small><math xmlns="http://www.w3.org/1998/Math/MathML"><mo>[</mo><mn>1</mn><mo>,</mo><mn>2</mn><mo>,</mo><mn>0</mn><mo>]</mo></math></div><span aria-hidden="true">×</span><div><small>键转换矩阵 W<sub>索引 K</sub></small><math xmlns="http://www.w3.org/1998/Math/MathML"><mo>[</mo><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>0</mn></mtd></mtr><mtr><mtd><mn>0</mn></mtd><mtd><mn>1</mn></mtd></mtr><mtr><mtd><mn>1</mn></mtd><mtd><mn>1</mn></mtd></mtr></mtable><mo>]</mo></math></div><span aria-hidden="true">=</span><div><small>额外生成的索引器 K</small><math xmlns="http://www.w3.org/1998/Math/MathML"><mo>[</mo><mn>1</mn><mo>,</mo><mn>2</mn><mo>]</mo></math></div></div><p>#1、#2、#3、#4 应用同一个矩阵，可批量转换；每个索引器 K 都能对应回原来的主 K/V 条目。筛选得到编号后，主注意力按这些编号取回原数据。</p></div></section><p class="cv13-indexer-footnote">分数、维数、矩阵均为教学设定，用于说明数据来源；矩阵算例与上方筛选分数相互独立。报告将主 K/V 与对应的索引器 K 合称为全局缓存；跨层共享规则在下一章展开。依据：V4.1 报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.3</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a>（第 10–11 页）。</p></figure>`;}
function mathematicalWiringV14(){return `<section class="cv14-wiring" id="ced-mathematical-connection" aria-labelledby="cv14-wiring-title">
<h4 id="cv14-wiring-title">把区别落实到一层里的连接：Q 从哪里来，主 K/V 又从哪里来？</h4>
<p>记 <i>X</i><sub>ℓ</sub> 为第 ℓ 层的输入，<i>H</i><sub>20</sub> 为编码器最后一层的输出；两者都包含各个位置的数字表示。下面选择两个实际的层作对照。前面 mHC 一节的 X 指一个 token 的四路状态（四条各 5,120 维），与这里按位置排列的层输入 H 不是同一个对象；报告也分别记作 X 与 H。</p>
<div class="cv14-wiring-pair">
 <div class="cv14-layer-panel" data-ced14-side="encoder">
  <header><span>前 20 层 · 因果编码器</span><strong>第 9 层：建立一份主 K/V</strong></header>
  <div class="cv14-source-pair">
   <div class="cv14-branch cv14-current-branch"><div class="cv14-source"><small>本层的输入</small><strong>X<sub>9</sub></strong></div><span class="cv14-down" aria-hidden="true"></span><div class="cv14-derived"><b class="cv9-q">本层 Q<sub>9</sub></b><span>以及本层的局部 K/V</span></div></div>
   <div class="cv14-branch cv14-main-branch"><div class="cv14-source"><small>主 K/V 的来源</small><strong>X<sub>9</sub></strong><span>同样取自本层输入</span></div><span class="cv14-down" aria-hidden="true"></span><div class="cv14-derived cv14-main-cache"><b>生成主 K/V</b><span>每 2 个位置聚合成 1 条</span><small>建立缓存 E2，供第 9–14 层使用</small><a class="cv15-csa-link" href="#csa-real-config">CSA² 压缩与共享配置</a></div></div>
  </div>
  <div class="cv14-join" aria-hidden="true"><i></i></div><div class="cv14-core"><b>第 9 层的主注意力</b><span>Q<sub>9</sub> 匹配选中的主 K 与局部 K<br>按得到的权重汇总两组 V</span></div>
  <div class="cv14-source-equations"><small>主 K/V 候选及聚合权重分数</small><math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>C</mi><mn>9</mn></msub><mo>=</mo><msub><mi>X</mi><mn>9</mn></msub><msubsup><mi>W</mi><mn>9</mn><mi>KV</mi></msubsup></math><math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>Z</mi><mrow><mtext>comp</mtext><mo>,</mo><mn>9</mn></mrow></msub><mo>=</mo><msub><mi>X</mi><mn>9</mn></msub><msubsup><mi>W</mi><mn>9</mn><mi>Z</mi></msubsup></math></div>
 </div>
 <div class="cv14-layer-panel cv14-decoder-panel" data-ced14-side="decoder">
  <header><span>后 20 层 · 解码器</span><strong>第 25 层：读取编码器准备的主 K/V</strong></header>
  <div class="cv14-source-pair">
   <div class="cv14-branch cv14-current-branch"><div class="cv14-source"><small>本层的输入</small><strong>X<sub>25</sub></strong></div><span class="cv14-down" aria-hidden="true"></span><div class="cv14-derived"><b class="cv9-q">本层 Q<sub>25</sub></b><span>以及本层的局部 K/V</span></div></div>
   <div class="cv14-branch cv14-main-branch"><div class="cv14-source cv14-from-encoder"><small>主 K/V 的来源</small><strong>H<sub>20</sub></strong><span>改接编码器的输出</span></div><span class="cv14-down" aria-hidden="true"></span><div class="cv14-derived cv14-main-cache"><b>共享的主 K/V</b><span>每个位置对应 1 条</span><small>由第 21 层建立 D1，第 21–40 层共用</small><a class="cv15-csa-link" href="#csa-real-config">CSA² 压缩与共享配置</a></div></div>
  </div>
  <div class="cv14-join" aria-hidden="true"><i></i></div><div class="cv14-core"><b>第 25 层的主注意力</b><span>Q<sub>25</sub> 匹配选中的主 K 与局部 K<br>按得到的权重汇总两组 V</span></div>
  <div class="cv14-source-equations"><small>共享主 K/V 在第 21 层建立时</small><math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>C</mi><mn>21</mn></msub><mo>=</mo><msub><mi>H</mi><mn>20</mn></msub><msubsup><mi>W</mi><mn>21</mn><mi>KV</mi></msubsup></math><math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>Z</mi><mrow><mtext>comp</mtext><mo>,</mo><mn>21</mn></mrow></msub><mo>=</mo><msub><mi>H</mi><mn>20</mn></msub><msubsup><mi>W</mi><mn>21</mn><mi>Z</mi></msubsup></math></div>
 </div>
</div>
<p class="cv14-equation-key"><strong>C</strong> 是主 K/V 的候选数值；<strong>Z<sub>comp</sub></strong> 是聚合用的权重分数，对应报告式（1）中的 Z，与前文注意力输出 Z 区分。编码器这里每 2 个位置组成一组；解码器每组只有 1 个位置。<strong>W</strong> 是训练得到的转换矩阵，E2、D1 是两份缓存的名称。这里的 C 只表示主 K/V 的候选数值，与前面 mHC 一节把模块输出分配回四路的连接系数 C 不是同一个量；报告的两个式子都写作 C，本文沿用原记法。</p>
<div class="cv14-common"><strong>两边都继续做的计算</strong><span>从本层输入生成 Q 和局部 K/V</span><span>因果注意力：只使用自己及之前的位置</span><span>各层自己的后续前馈与残差计算</span></div>
<p class="cv14-wiring-conclusion"><strong>关键改动是主 K/V 投影式里的输入来源。</strong>对同一个历史位置，后 20 层使用由它的 H<sub>20</sub> 生成的共享主 K/V；各层的 Q 和局部 K/V 继续来自本层输入。较早历史因此可以省去后半段的完整计算。每个新位置仍经过全部 40 层：局部状态逐位置更新，主缓存按各自的分组规则更新；输入末尾的局部状态另需有界重放，后面将展示这部分工作。</p>
<p class="cv14-wiring-note">第 9 层被选作编码器的建缓存示例；编码器的其他建缓存层为第 3、15 层。第 25 层用已共享的 D1 重新筛选位置，随后计算自己的注意力。前两层只有局部 SWA。<a href="#csa-real-config">完整层配置</a>和<a href="#cache-compression">压缩分组过程</a>在后续章节展开。式子按报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.2</a> 式（1）及 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a> 的缓存共享规则表示；为突出数据来源，图中省略归一化、位置编码等细节。</p>
</section>
`;}

function architecture(){return `<section class="cv9-section" id="ced9-change">${heading('02 · 本代改动','编码器的作用：先把长历史准备成后面能直接使用的 K/V。','阅读长资料时，较早位置提供历史 K/V，序列末尾的位置负责预测下一项。CED 让前 20 层形成的历史表示，直接成为后 20 层主 K/V 的来源。')}<div class="cv9-role-split"><div><small>V4.1 的语言主干总计</small><strong>40 层</strong></div><span aria-hidden="true">=</span><div><small>处理全部输入，准备历史状态</small><strong>前 20 层 · 因果编码器</strong></div><span aria-hidden="true">+</span><div><small>利用历史，继续形成输出</small><strong>后 20 层 · 解码器</strong></div></div><p class="cv9-causal-difference">这里的前 20 层仍采用<strong>因果计算</strong>：位置 i 只能利用它自己及其之前的内容。读入长输入时，前 20 层处理全部位置，准备历史状态；后 20 层利用这些历史，只继续处理输入末尾的一小段。开始逐步生成后，每个新增位置都经过全部 40 层。经典源编码器通常可以利用整个源序列。</p><div class="cv9-kv-primer"><div><strong>主 K/V · 保存长历史，按需选择</strong><p>保存长历史中的主 K/V。每次注意力计算再从中选取部分条目；本次未选中的条目仍留在缓存中，供后续使用。</p></div><div><strong>局部 K/V · 保留最近窗口</strong><p>保存靠近当前位置的 128 个位置。这条局部路径称为 <b>SWA</b>，即 Sliding-Window Attention（滑动窗口注意力）。</p></div></div><div class="cv15-responsibilities"><p><b>CED · 改变来源</b><span>后半段主 K/V 由第 21 层从第 20 层的输出投影得到。</span></p><p><b>CSA² · 压缩、共享与筛选</b><span>安排每组包含几个位置、哪些层共用缓存，以及本层选用哪些条目。</span><a href="#csa-real-config">查看 CSA² 的实际层配置</a></p></div><details class="cv15-disclosure cv15-math-details"><summary><span><strong>编码器与解码器的连接细节</strong><small>对照具体层的 Q、主 K/V、局部 K/V 与投影公式</small></span><span class="cv15-disclosure-label"><span class="cv15-when-closed">展开</span><span class="cv15-when-open">收起</span><i class="cv15-chevron" aria-hidden="true"></i></span></summary><div class="cv15-disclosure-body">${mathematicalWiringV14()}</div></details><details class="cv14-indexer-details cv15-disclosure"><summary><span><strong>索引器怎样筛选历史条目？</strong><small>从主 K/V 转换筛选用的键，再按编号取回信息</small></span><span class="cv15-disclosure-label"><span class="cv15-when-closed">展开</span><span class="cv15-when-open">收起</span><i class="cv15-chevron" aria-hidden="true"></i></span></summary><div class="cv15-disclosure-body">${indexerPrimer()}</div></details><div class="cv9-compare cv9-architecture-compare">
<figure class="cv9-panel"><figcaption><span class="cv9-badge">同深度教学对照</span><strong>普通逐层构建 K/V</strong><span>用 40 层保持比较条件相同</span></figcaption>${unit('第 1–20 层','逐层更新各位置',numberedLayers(1))}${down}<div class="cv9-state"><strong>H<sub>20</sub></strong><span>每个位置完成第 20 层后的表示</span></div>${down}<div class="cv9-dependency"><div><b>第 21 层 K/V</b><span>历史位置的 H<sub>20</sub> → K/V<sub>21</sub></span></div><div class="cv9-small-down" aria-hidden="true"></div><div><b>先完成第 21 层计算</b><span>这个历史位置才能得到 H<sub>21</sub></span></div><div class="cv9-small-down" aria-hidden="true"></div><div><b>第 22 层 K/V</b><span>历史位置的 H<sub>21</sub> → K/V<sub>22</sub></span></div><p>同样的依赖继续到第 40 层。</p></div><div class="cv9-bottom-note">较早位置即使已经不负责输出，也要继续计算，才能准备各个高层要用的历史 K/V。</div></figure>
<figure class="cv9-panel cv9-emphasis"><figcaption><span class="cv9-badge cv9-new">V4.1 · CED</span><strong>后半段主 K/V 从 H<sub>20</sub> 投影建立</strong><span>Causal Encoder–Decoder · 因果编码器–解码器</span></figcaption>${unit('第 1–20 层 · 因果编码器','形成历史表示',numberedLayers(1))}${down}<div class="cv9-state"><strong>H<sub>20</sub></strong><span>每个位置完成第 20 层后的表示</span></div>${down}<div class="cv9-memory"><small>乘训练确定的矩阵，构建并保存</small><strong>后 20 层共用的主 ${kv}</strong><span>历史位置完成到第 20 层，就能建立这份主 K/V。</span></div>${down}${unit('第 21–40 层 · 解码器','继续计算当前需要输出的位置',numberedLayers(21))}<div class="cv9-bottom-note">后 20 层需要的历史主 K/V 已经准备好。较早历史位置可以在这里结束完整计算，当前输出位置继续向下。</div></figure></div><p class="cv9-takeaway"><strong>改接主 K/V 的来源，让较早历史省去后半段的完整计算。</strong>CED 让历史主 K/V 不再依赖后半段的逐层状态；CSA² 再安排多层共享这些 K/V。输入末尾仍需准备局部窗口，新生成位置仍会经过全部 40 层。</p>${source('V4.1 报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.2</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a>（第 9–11 页），40 层配置见 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2.1</a>（第 21–22 页）。左图是同深度的教学对照，不代表前代 DeepSeek 的实际层数。')}</section>`;}
const READERS={21:{q:'Q⁽²¹⁾',selected:[1,768,1536],weights:[.48,.19,.33],createsCache:true,selectsPositions:true,selectionLayer:21},25:{q:'Q⁽²⁵⁾',selected:[256,1024,1536],weights:[.22,.47,.31],createsCache:false,selectsPositions:true,selectionLayer:25},40:{q:'Q⁽⁴⁰⁾',selected:[512,1280,1536],weights:[.17,.28,.55],createsCache:false,selectsPositions:false,selectionLayer:37}};
function cedV9ReaderState(layer=21){layer=Object.hasOwn(READERS,layer)?Number(layer):21;const r=READERS[layer];return {layer,...r,cacheIdentity:'第 21 层从 H₂₀ 建立的同一份主 KV',localStart:1409,localEnd:1536};}
function readMarkup(layer=21){const s=cedV9ReaderState(layer);return `<div class="cv9-reader-current"><span>现在观察第 <b>${s.layer}</b> 层 · 位置 1,536</span><strong class="cv9-q">本层输入 × W<sub>Q</sub> → ${s.q}</strong></div><div class="cv9-reader-operations"><div class="${s.createsCache?'cv9-op-run':'cv9-op-shared'}"><small>历史主 K/V</small><strong>${s.createsCache?'本层从 H₂₀ 建立':'沿用第 21 层建立的数据'}</strong></div><div class="${s.selectsPositions?'cv9-op-run':'cv9-op-shared'}"><small>要读取的位置</small><strong>${s.selectsPositions?'本层进行筛选':'沿用第 37 层筛选的编号'}</strong></div></div><div class="cv9-reading-grid"><div class="cv9-read-source"><small>① 从共享历史中取得选中的条目</small><strong>同一份主 ${kv}</strong><p>${s.selectsPositions?'下面的编号由本层筛选。':'本层省去筛选步骤，直接沿用编号。'} 本例解码器缓存每个位置保留一条，因此条目编号对应原位置。</p><div class="cv9-selected">${s.selected.map(n=>`<span><small>条目</small><b>#${n.toLocaleString('en-US')}</b>${kv}</span>`).join('')}</div></div><div class="cv9-read-source"><small>② 加入本层自己的局部数据</small><strong>第 ${s.layer} 层的局部 ${kv}</strong><p>位置 1,409–1,536，共 128 个位置。</p><div class="cv9-local-line"><span>1,409</span><i></i><span>1,536</span></div></div></div><div class="cv9-join"><span>两组 K/V 合在一起</span>${down}</div><div class="cv9-attention"><strong><span class="cv9-q">${s.q}</span> 匹配 <span class="cv9-k">K</span>，得到权重；按权重汇总 <span class="cv9-v">V</span></strong><span>执行一次主注意力，得到第 ${s.layer} 层新的输出表示。</span></div><p class="cv9-reader-observation" aria-live="polite">${s.layer===21?'第 21 层建立主 K/V，并筛选本层要用的位置。':s.layer===25?'第 25 层沿用主 K/V，重新筛选要读取的位置。':'第 40 层沿用主 K/V，也沿用第 37 层筛选的位置；本层仍计算自己的 Q、权重和输出。'} 三种职责在下一章对应 Full、Reindex、Reuse。编号为教学设定。</p>`;}
function storageAndRead(){return `<section class="cv9-section" id="ced9-create-read">${heading('03 · 建立、保存、使用','历史 K/V 可以共用，各层继续计算自己的 Q 和输出。','沿着一个已经给定的长输入观察：有 1,536 个 token，每个位置都有自己的 H₂₀。先把这些表示转换成可供后半段使用的状态。')}
<figure class="cv9-panel cv9-create-panel"><div class="cv9-figure-title"><strong>先建立一次，后面多层使用同一份数据。</strong></div><div class="cv9-create-path"><div class="cv9-matrix"><small>第 20 层的输出 H<sub>20</sub></small><div><b>位置 1</b><span>0.2　−0.4　…</span></div><div><b>位置 2</b><span>0.7　0.1　…</span></div><div><b>…</b><span>…</span></div><div><b>位置 1,536</b><span>−0.1　0.6　…</span></div></div>${down}<div class="cv9-transform"><small>训练已经确定矩阵中的数值</small><strong>做矩阵乘法，把表示转换成主 K/V</strong><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mi>C</mi><mo>=</mo><msub><mi>H</mi><mn>20</mn></msub><msup><mi>W</mi><mi>KV</mi></msup></math><span>C 是得到的主 K/V，Wᴷⱽ 是转换矩阵。“投影”就是前文 Q/K/V 中用过的线性转换。</span></div>${down}<div class="cv9-memory cv9-permanent-store"><small>保存对象 · 后半段所有层共用</small><strong>位置 1　位置 2　…　位置 1,536</strong><div class="cv9-cache-strip">${Array.from({length:8},()=>'<span>'+kv+'</span>').join('')}</div><span>只画部分条目；数字、向量均为教学示例。</span></div></div><figcaption class="cv9-caption">报告中还计算压缩权重；这里聚焦主 K/V 的来源。后半段配置的压缩率为 1，因此可以先按“每位置一条主 KV”理解。</figcaption></figure>
<div class="cv11-range-key"><strong>同一条 1,536-token 历史，分成 12 段。</strong><span>每个矩形 = 128 个位置。紫色小点 = 一个被选中的示意位置；绿色整段 = 保留该段的全部 128 个位置。</span></div><div class="cv9-range-explainer"><div><strong>主 K/V：保存可见历史，选出其中一部分</strong><div class="cv9-range cv9-range-main">${Array.from({length:12},(_,i)=>'<span'+([0,5,11].includes(i)?' class="cv11-range-has-selection"':'')+'>'+([0,5,11].includes(i)?'<i aria-hidden="true"></i>':'')+'</span>').join('')}</div><span>示意选中位置 1、768、1,536，分别落在第 1、6、12 段。</span></div><div><strong>局部 K/V：保留最靠右的一整段</strong><div class="cv9-range cv9-range-local">${Array.from({length:12},(_,i)=>'<span'+(i===11?' class="cv9-range-selected"':'')+'></span>').join('')}</div><span>位置 1,409–1,536 · 最近 128 个位置全部保留。</span></div></div>
<p class="cv9-scope-caption">紫色小点只表示少数被选中的条目，周围浅紫色矩形表示其所在区段；深绿色矩形则代表局部窗口的完整覆盖范围。</p>
<div class="cv9-visible-map"><h4>两种 K/V 在全部 40 层中的分布</h4><p>局部窗口存在于每一层；主 K/V 的来源和共享范围随层的位置变化。</p><table class="cv9-system-map"><thead><tr><th scope="col">层的位置</th><th scope="col">主 K/V</th><th scope="col">局部 K/V</th></tr></thead><tbody><tr><th scope="row">第 1–2 层</th><td>这两层只使用局部注意力</td><td rowspan="3">每层分别计算和保存自己的最近 128 个位置</td></tr><tr><th scope="row">第 3–20 层<br><small>因果编码器</small></th><td>来自前半段自身计算，并在前半段内部按组共享</td></tr><tr><th scope="row">第 21–40 层<br><small>解码器</small></th><td>共用第 21 层从 H₂₀ 投影建立的同一份主 K/V</td></tr></tbody></table><p class="cv9-caption">在使用主 K/V 的层，选中的主 K/V 与该层的局部 K/V 拼接后，进入<strong>同一次主注意力计算</strong>。</p></div>
<div class="cv9-read-controls" aria-label="选择要观察的层"><span>观察哪一层使用这份主 K/V？</span><p class="cv9-query-notation">这里 Q 的上标是<strong>层号</strong>；查询始终对应同一个<strong>位置 1,536</strong>。切换层号，观察哪些对象改变、哪些保持相同。</p><div>${[21,25,40].map((n,i)=>`<button type="button" data-cv9-layer="${n}" aria-pressed="${i===0}">第 ${n} 层 · ${['建立并筛选','重新筛选','沿用筛选'][i]}</button>`).join('')}</div></div><div class="cv9-reader" id="cv9-reader">${readMarkup(21)}</div>
<p class="cv9-takeaway">“共用”指 <strong>多层指向同一份已保存的 K/V</strong>；“读取”指 <strong>本层 Q 与选中的 K 匹配，再按权重汇总 V</strong>。两者分别回答“数据放在哪里”和“这一层怎样利用数据”。</p>
${source('V4.1 报告图 4、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a>（第 10–11 页）、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2.1</a>（第 21–22 页）。选中位置是教学设定，不是真实模型的注意力结果；下一章解释哪些层重新选择、哪些层沿用选择。')}</section>`;}
function cedV9WorkState(mode='prompt'){
 mode=mode==='new'?'new':'prompt';const cells=[],unitTokens=mode==='prompt'?128:1,columnCount=mode==='prompt'?12:1;
 for(let layer=1;layer<=40;layer++)for(let column=0;column<columnCount;column++){
  const baseline=true,ced=mode==='new'||layer<=20||column===11;
  cells.push({layer,column,baseline,ced,tokenCount:unitTokens,start:mode==='new'?1537:column*128+1,end:mode==='new'?1537:(column+1)*128});
 }
 const baselineActiveCells=cells.filter(c=>c.baseline).length,cedActiveCells=cells.filter(c=>c.ced).length;
 return {mode,cells,columnCount,unitTokens,promptTokens:1536,windowTokens:128,newPosition:1537,baselineActiveCells,cedActiveCells,baselineActive:baselineActiveCells*unitTokens,cedActive:cedActiveCells*unitTokens,unit:'token·层'};
}
function gridRow(layer){return layer+(layer>20?1:0);}
function workAxis(){return '<div class="cv12-layer-axis">'+[1,20,21,40].map(layer=>`<span style="grid-row:${gridRow(layer)}">第 ${layer} 层</span>`).join('')+'</div>';}
function workKey(mode='prompt'){return mode==='new'?'新增位置读取历史 K/V，经过全部 40 层，为预测再下一个 token 准备状态。':'输入阶段：准备 1,536 个位置的历史状态，再预测回答的第一个 token。';}
function workloadGrid(kind){
 const s=cedV9WorkState('prompt'),count=s[kind+'Active'];
 return `<div class="cv12-stable-work" data-work-kind="${kind}" data-work-mode="prompt"><div class="cv12-map-head"><span>最初输入 · 1,536<small>12 列，每列 128 个</small></span><span class="gw26-new-heading">新增位置<small>每点 1 个 token</small></span></div><div class="cv12-combined-map">${workAxis()}<div class="cv12-history-cells">${s.cells.map(c=>`<span class="${c[kind]?'cv12-prepared':''}" data-cv12-history="${kind}-${c.layer}-${c.column}" style="grid-row:${gridRow(c.layer)};grid-column:${c.column+1}" aria-hidden="true"></span>`).join('')}</div><div class="gw24-grown-columns" aria-label="已生成并完成计算的 token 缓存"><i data-gw24-grown="0" style="grid-column:1;grid-row:1" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:2" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:3" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:4" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:5" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:6" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:7" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:8" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:9" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:10" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:11" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:12" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:13" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:14" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:15" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:16" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:17" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:18" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:19" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:20" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:22" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:23" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:24" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:25" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:26" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:27" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:28" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:29" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:30" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:31" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:32" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:33" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:34" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:35" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:36" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:37" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:38" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:39" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:40" aria-hidden="true"></i><i data-gw24-grown="0" style="grid-column:1;grid-row:41" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:1" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:2" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:3" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:4" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:5" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:6" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:7" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:8" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:9" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:10" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:11" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:12" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:13" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:14" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:15" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:16" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:17" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:18" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:19" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:20" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:22" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:23" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:24" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:25" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:26" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:27" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:28" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:29" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:30" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:31" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:32" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:33" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:34" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:35" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:36" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:37" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:38" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:39" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:40" aria-hidden="true"></i><i data-gw24-grown="1" style="grid-column:2;grid-row:41" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:1" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:2" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:3" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:4" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:5" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:6" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:7" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:8" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:9" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:10" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:11" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:12" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:13" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:14" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:15" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:16" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:17" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:18" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:19" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:20" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:22" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:23" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:24" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:25" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:26" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:27" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:28" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:29" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:30" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:31" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:32" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:33" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:34" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:35" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:36" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:37" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:38" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:39" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:40" aria-hidden="true"></i><i data-gw24-grown="2" style="grid-column:3;grid-row:41" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:1" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:2" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:3" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:4" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:5" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:6" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:7" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:8" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:9" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:10" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:11" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:12" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:13" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:14" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:15" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:16" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:17" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:18" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:19" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:20" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:22" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:23" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:24" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:25" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:26" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:27" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:28" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:29" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:30" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:31" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:32" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:33" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:34" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:35" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:36" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:37" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:38" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:39" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:40" aria-hidden="true"></i><i data-gw24-grown="3" style="grid-column:4;grid-row:41" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:1" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:2" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:3" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:4" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:5" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:6" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:7" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:8" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:9" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:10" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:11" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:12" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:13" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:14" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:15" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:16" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:17" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:18" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:19" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:20" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:22" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:23" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:24" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:25" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:26" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:27" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:28" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:29" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:30" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:31" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:32" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:33" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:34" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:35" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:36" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:37" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:38" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:39" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:40" aria-hidden="true"></i><i data-gw24-grown="4" style="grid-column:5;grid-row:41" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:1" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:2" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:3" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:4" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:5" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:6" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:7" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:8" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:9" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:10" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:11" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:12" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:13" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:14" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:15" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:16" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:17" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:18" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:19" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:20" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:22" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:23" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:24" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:25" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:26" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:27" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:28" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:29" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:30" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:31" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:32" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:33" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:34" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:35" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:36" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:37" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:38" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:39" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:40" aria-hidden="true"></i><i data-gw24-grown="5" style="grid-column:6;grid-row:41" aria-hidden="true"></i></div><div class="cv12-new-dots" aria-label="位置 1,537，尚未加入">${Array.from({length:40},(_,i)=>`<span class="cv12-new-dot" style="grid-row:${gridRow(i+1)}" aria-hidden="true"></span>`).join('')}</div><div class="cv12-history-ranges"><span>输入 1–1,536</span></div><div class="gw24-grown-range">回答尚未开始</div><div class="cv12-new-range">当前尾段 · 1,409–1,536</div></div><div class="cv12-work-totals"><div><small data-gw32-preparation>输入准备 · 已完成</small><strong data-gw24-prior>${count.toLocaleString('en-US')}</strong></div><span aria-hidden="true">+</span><div><small>生成阶段 · 累计</small><strong data-cv12-increment>0</strong></div><span aria-hidden="true">=</span><div><small>累计 token·层</small><strong data-cv12-total>${count.toLocaleString('en-US')}</strong></div></div><p class="cv12-count-formula">${kind==='baseline'?'输入目标：1,536 × 40':'输入目标：1,536 × 20 + 128 × 20'}<span data-cv12-formula>；新位置：尚未加入</span></p></div>`;
}
function workResult(mode='prompt'){return mode==='new'?`<strong>新增位置经过 40 层；已保存的历史 K/V 继续使用。</strong><p>位置 1,537 的文字已由上一轮选出；现在让它经过全部 40 层，读取已经保存的历史 K/V，为预测位置 1,538 准备状态。两种路径本步都增加 40 token·层。</p>`:`<strong>CED 省去较早 1,408 个位置在后 20 层的完整计算。</strong><p>普通路径为 61,440 token·层，CED 为 33,280 token·层，减少 <b>28,160 token·层</b>。CED 仍处理输入末尾 128 个位置，近似准备后半段局部 K/V。点第二步，观察新 token 怎样接着计算。</p>`;}
function workload(){return `<section class="cv9-section" id="ced9-work">${heading('04 · 为什么能少算','历史很长，生成刚刚开始。','假设用户刚提交一段 1,536 token 的资料，缓存尚未命中。旧输入已经全部给定；模型先准备这些位置的状态，再预测第 1,537 个 token。')}<p class="gw25-intro"><b>怎样读这张图：</b>矩形每格是 128 个输入 token 经过一层，右侧一个小点是 1 个新增 token，虚线框始终框住 128 个位置。蓝色是已完成的原始输入，淡金色是本阶段已生成的 token，深金色是当前 token。下面的累计值按 <b>token·层</b> 计：一个 token 经过一层记 1，用来比较两条路径各自处理了多少个位置。</p><div class="cv12-work-lab"><div class="cv12-work-toolbar"><div class="cv9-work-controls"><button type="button" data-cv9-work="prompt" aria-pressed="true">① 准备 1,536 个输入位置</button><button type="button" data-cv9-work="new" aria-pressed="false">② 接着处理 1 个新位置</button></div><div class="gw23-controls"><button type="button" data-gw23-play>播放生成</button><button type="button" data-gw23-next>前进 10 层 / 下一轮</button><button type="button" data-gw23-reset>重置本阶段</button><span class="gw23-status" data-gw23-status aria-live="polite">位置 1,537 · 0 / 40 层</span></div><p id="cv9-work-key" aria-live="polite">${workKey('prompt')}</p></div><div class="gw23" data-gw23><div class="gw23-belt" data-gw23-belt></div><p class="gw23-note">教学续写“小猫正在窗边安静地睡觉”，共 6 个演示 token。词块与选择结果为教学设定。</p></div><div class="cv12-work-legend"><span><i class="gw24-legend-pending"></i>待处理</span><span><i class="gw24-legend-grown"></i>淡金点：本阶段已生成</span><span><i class="cv12-key-history"></i>蓝格：已完成输入</span><span><i class="cv12-key-skipped"></i>灰格：省去完整计算</span><span><i class="cv12-key-new"></i>深金点：当前 token</span></div><div class="cv9-compare cv9-work-comparison"><figure class="cv9-panel"><figcaption><strong>普通逐层路径</strong><span>同为 40 层的教学对照</span></figcaption><div id="cv9-work-baseline">${workloadGrid('baseline')}</div></figure><figure class="cv9-panel cv9-emphasis"><figcaption><strong>V4.1 · CED</strong><span>后半段主 K/V 从 H<sub>20</sub> 投影建立</span></figcaption><div id="cv9-work-ced">${workloadGrid('ced')}</div></figure></div><div class="cv9-work-result" id="cv9-work-result" aria-live="polite">${workResult('prompt')}</div></div><details class="scv9-detail v3-figure-note"><summary>这张图的画法与计数口径</summary><p class="cv9-caption">阶段①把 1,536 个位置按 12 列等宽排列；阶段②先把末尾 128 个位置放大到绘图区的三分之一，较早的历史压缩显示，新增点及其位移再放大一次，便于逐个观察——实际范围以图中编号为准。token·层只计完整层处理的位置数，K/V 投影和稀疏选择另有计算开销；尾段移出窗口后，先前完成的计算仍留在累计值里。</p></details><p class="cv9-takeaway"><strong>本代减少的主要是长输入的准备工作。</strong>较早历史的主 K/V 由第 21 层从 H₂₀ 一次投影得到；后半段局部状态通过末尾窗口的有界重放近似恢复。重放范围外的更早局部依赖被截断，因此恢复的 K/V 可能与完整计算不同；已有全局 KV 继续使用。</p>${source('V4.1 报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.2</a>（第 9 页）、Decoder SWA Bounded Replay，<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=20" target="_blank" rel="noopener" title="打开 V4.1 原报告第 20 页">§3.2.2</a>（第 20 页）。以上 1,536-token 算例根据报告的 N·L/2 + 128·L/2 计算路径绘制；末尾重放得到的局部状态是近似值，并非完整前向计算的精确重现。128 为报告配置。')}</section>`;}
function updateWork(mode){
 if(root.workAnimation23){root.workAnimation23.setMode(mode);return;}
 document.querySelectorAll('[data-work-kind]').forEach(diagram=>{
  const kind=diagram.dataset.workKind, prior=cedV9WorkState('prompt')[kind+'Active'],increment=mode==='new'?40:0;
  diagram.dataset.workMode=mode;
  diagram.querySelectorAll('.cv12-new-dot').forEach(dot=>dot.classList.toggle('cv12-dot-active',mode==='new'));
  diagram.querySelector('.cv12-new-dots').setAttribute('aria-label',mode==='new'?'位置 1,537，新增经过 40 层的计算':'位置 1,537，尚未加入');
  diagram.querySelector('[data-cv12-increment]').textContent=String(increment);
  diagram.querySelector('[data-cv12-total]').textContent=(prior+increment).toLocaleString('en-US');
  diagram.querySelector('[data-cv12-formula]').textContent=mode==='new'?'；新增：1 × 40':'；新位置：尚未加入';
 });
 document.getElementById('cv9-work-result').innerHTML=workResult(mode);
 document.getElementById('cv9-work-key').textContent=workKey(mode);
}
function cedV9Markup(){return '<div class="cv9-lesson">'+primer()+architecture()+storageAndRead()+workload()+'</div>';}
function initCedV9(){if(typeof document==='undefined'||!document.getElementById('cv9-reader'))return;const host=document.getElementById('cv9-reader').closest('.cv9-lesson');if(host.dataset.cv9Ready)return;host.dataset.cv9Ready='true';host.addEventListener('click',event=>{const layer=event.target.closest('[data-cv9-layer]');if(layer){const n=Number(layer.dataset.cv9Layer);document.getElementById('cv9-reader').innerHTML=readMarkup(n);host.querySelectorAll('[data-cv9-layer]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cv9Layer)===n)));return;}const work=event.target.closest('[data-cv9-work]');if(work){const mode=work.dataset.cv9Work;host.querySelectorAll('[data-cv9-work]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cv9Work===mode)));updateWork(mode);}});}
Object.assign(root,{cedV9Markup,initCedV9,cedV9ReaderState,cedV9WorkState});
})(globalThis);

(function(root){
  'use strict';
  const letters=['#1','#2','#3','#4','#5','#6','#7','#8'];
  const presets=[
    {name:'Full',cn:'建立缓存，并选出位置',select:[0,3,6],scores:[9,3,2,8,4,1,7,5],weights:[.33,.22,.15],localWeight:.30,cache:'建立并保存',index:'本层重新计算',state:'new',summary:'建立主 KV 与索引器 K，供本层以及后面的层共用，直到下一个 Full 层为止；本层索引器给各条目打分，选出 #1、#4、#7。'},
    {name:'Reindex',cn:'共用缓存，重新选择位置',select:[1,3,7],scores:[3,9,2,8,4,1,5,7],weights:[.16,.36,.18],localWeight:.30,cache:'沿用 Full 的同一份',index:'本层重新计算',state:'shared',summary:'主 KV 和索引器 K 保持原样；本层产生新的索引器查询，重新打分后改选 #2、#4、#8。'},
    {name:'Reuse',cn:'共用缓存，也沿用选中位置',select:[1,3,7],scores:null,weights:[.32,.14,.24],localWeight:.30,cache:'沿用 Full 的同一份',index:'省去本层索引器计算',state:'shared',summary:'保留 #2、#4、#8，省去索引器查询、打分和 Top-K 选择；本层主查询仍会产生新的注意力权重与输出。'}
  ];
  const badge=(txt,type='new')=>`<span class="scv9-badge scv9-badge-${type}">${txt}</span>`;
  const note=txt=>`<p class="scv9-note">${txt}</p>`;
  const kv=(letter,selected=false,cls='')=>`<span class="scv9-kv ${selected?'is-selected':''} ${cls}"><strong>${letter}</strong><span><i>K</i><em>V</em></span></span>`;
  const ids=selected=>selected.map(i=>`<span class="scv9-index">${letters[i]}</span>`).join('');
  function csaV9State(mode){const m=presets[Math.max(0,Math.min(2,mode))];return {...m,select:[...m.select],weights:[...m.weights],scores:m.scores?[...m.scores]:null};}
  function csaV9Config(){
    const layers=Array.from({length:40},(_,i)=>{
      const layer=i+1,encoder=layer<=20;
      if(layer<=2)return {layer,phase:'encoder',mode:'SWA',cache:null,indexSource:null,local:'L'+layer,compression:null};
      const groupStart=encoder?3+6*Math.floor((layer-3)/6):21+4*Math.floor((layer-21)/4);
      return {layer,phase:encoder?'encoder':'decoder',mode:layer===groupStart?(encoder||layer===21?'Full':'Reindex'):'Reuse',cache:encoder?'E'+(1+Math.floor((layer-3)/6)):'D1',indexSource:groupStart,local:'L'+layer,compression:encoder?2:1};
    });
    return {layers,globalCaches:[{id:'E1',producer:3,layers:[3,8],compression:2},{id:'E2',producer:9,layers:[9,14],compression:2},{id:'E3',producer:15,layers:[15,20],compression:2},{id:'D1',producer:21,layers:[21,40],compression:1,source:'H20'}],counts:{layers:40,encoderGlobal:3,decoderGlobal:1,global:4,local:40,SWA:2,Full:4,Reindex:4,Reuse:30}};
  }
  function configLayer(layer){return `<div class="scv9-layer scv9-layer-${layer.mode.toLowerCase()}" data-scv9-layer="${layer.layer}" data-global-cache="${layer.cache||'none'}" data-index-source="${layer.indexSource||'none'}"><span>第 <b>${layer.layer}</b> 层</span><strong>${layer.mode==='SWA'?'纯 SWA':layer.mode}</strong><small>${layer.cache?'全局 '+layer.cache:'无全局 KV'}</small><small>${layer.indexSource?'索引 I'+layer.indexSource:'只有局部状态'}</small><em>局部 L${layer.layer}</em></div>`;}
  function configGroup(layers,label){return `<div class="scv9-config-group"><div class="scv9-config-group-label">${label}</div><div class="scv9-layer-row" style="--sc-layer-count:${layers.length}">${layers.map(configLayer).join('')}</div></div>`;}
  function csaV9ConfigMarkup(){return `<section class="scv9-section" id="csa-real-config"><div class="scv9-section-heading"><span class="scv9-badge scv9-badge-new">报告中的实际配置</span><h3>把三种职责放回真实的 40 层</h3></div><p>编码器有三份共享全局缓存；解码器五个索引组共同读取 D1。每层自己的局部 KV 均保留。</p><figure class="cfg23"><div class="cfg23-key"><span><b>Full</b> 建立缓存并筛选</span><span><b>Reindex</b> 共用缓存、重新筛选</span><span><b>Reuse</b> 沿用缓存与筛选结果</span></div><p class="cfg24-direction">层按箭头串联：每行从左向右，再接下一行；每个完整层各执行一次注意力与 MoE 更新。</p><div class="cfg23-heading"><span>主干分段</span><span>层号 · 职责</span><span>全局缓存 / 条目聚合</span><span>沿用哪次选择</span></div><div class="cfg23-row"><strong>起始<small>第 1–2 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-swa" data-scv9-layer="1" data-global-cache="none" data-index-source="none"><b>1</b> SWA</span><span class="cfg23-chip cfg23-swa" data-scv9-layer="2" data-global-cache="none" data-index-source="none"><b>2</b> SWA</span></div><div class="cfg23-cache"><b>—</b><small>仅局部 SWA</small></div><div class="cfg23-index"><b>—</b><small>各自的局部窗口</small></div></div><div class="cfg23-row"><strong>编码器<small>第 3–8 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-full" data-scv9-layer="3" data-global-cache="E1" data-index-source="3"><b>3</b> Full</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="4" data-global-cache="E1" data-index-source="3"><b>4</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="5" data-global-cache="E1" data-index-source="3"><b>5</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="6" data-global-cache="E1" data-index-source="3"><b>6</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="7" data-global-cache="E1" data-index-source="3"><b>7</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="8" data-global-cache="E1" data-index-source="3"><b>8</b> Reuse</span></div><div class="cfg23-cache"><b>E1</b><small>2 个位置 → 1 条</small></div><div class="cfg23-index"><b>I3</b><small>第 3 层选出</small></div></div><div class="cfg23-row"><strong>编码器<small>第 9–14 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-full" data-scv9-layer="9" data-global-cache="E2" data-index-source="9"><b>9</b> Full</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="10" data-global-cache="E2" data-index-source="9"><b>10</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="11" data-global-cache="E2" data-index-source="9"><b>11</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="12" data-global-cache="E2" data-index-source="9"><b>12</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="13" data-global-cache="E2" data-index-source="9"><b>13</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="14" data-global-cache="E2" data-index-source="9"><b>14</b> Reuse</span></div><div class="cfg23-cache"><b>E2</b><small>2 个位置 → 1 条</small></div><div class="cfg23-index"><b>I9</b><small>第 9 层选出</small></div></div><div class="cfg23-row"><strong>编码器<small>第 15–20 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-full" data-scv9-layer="15" data-global-cache="E3" data-index-source="15"><b>15</b> Full</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="16" data-global-cache="E3" data-index-source="15"><b>16</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="17" data-global-cache="E3" data-index-source="15"><b>17</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="18" data-global-cache="E3" data-index-source="15"><b>18</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="19" data-global-cache="E3" data-index-source="15"><b>19</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="20" data-global-cache="E3" data-index-source="15"><b>20</b> Reuse</span></div><div class="cfg23-cache"><b>E3</b><small>2 个位置 → 1 条</small></div><div class="cfg23-index"><b>I15</b><small>第 15 层选出</small></div></div><div class="cfg23-row"><strong>解码器<small>第 21–24 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-full" data-scv9-layer="21" data-global-cache="D1" data-index-source="21"><b>21</b> Full</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="22" data-global-cache="D1" data-index-source="21"><b>22</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="23" data-global-cache="D1" data-index-source="21"><b>23</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="24" data-global-cache="D1" data-index-source="21"><b>24</b> Reuse</span></div><div class="cfg23-cache"><b>D1</b><small>1 个位置 → 1 条</small></div><div class="cfg23-index"><b>I21</b><small>第 21 层选出</small></div></div><div class="cfg23-row"><strong>解码器<small>第 25–28 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-reindex" data-scv9-layer="25" data-global-cache="D1" data-index-source="25"><b>25</b> Reindex</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="26" data-global-cache="D1" data-index-source="25"><b>26</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="27" data-global-cache="D1" data-index-source="25"><b>27</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="28" data-global-cache="D1" data-index-source="25"><b>28</b> Reuse</span></div><div class="cfg23-cache"><b>D1</b><small>1 个位置 → 1 条</small></div><div class="cfg23-index"><b>I25</b><small>第 25 层选出</small></div></div><div class="cfg23-row"><strong>解码器<small>第 29–32 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-reindex" data-scv9-layer="29" data-global-cache="D1" data-index-source="29"><b>29</b> Reindex</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="30" data-global-cache="D1" data-index-source="29"><b>30</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="31" data-global-cache="D1" data-index-source="29"><b>31</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="32" data-global-cache="D1" data-index-source="29"><b>32</b> Reuse</span></div><div class="cfg23-cache"><b>D1</b><small>1 个位置 → 1 条</small></div><div class="cfg23-index"><b>I29</b><small>第 29 层选出</small></div></div><div class="cfg23-row"><strong>解码器<small>第 33–36 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-reindex" data-scv9-layer="33" data-global-cache="D1" data-index-source="33"><b>33</b> Reindex</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="34" data-global-cache="D1" data-index-source="33"><b>34</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="35" data-global-cache="D1" data-index-source="33"><b>35</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="36" data-global-cache="D1" data-index-source="33"><b>36</b> Reuse</span></div><div class="cfg23-cache"><b>D1</b><small>1 个位置 → 1 条</small></div><div class="cfg23-index"><b>I33</b><small>第 33 层选出</small></div></div><div class="cfg23-row"><strong>解码器<small>第 37–40 层</small></strong><div class="cfg23-layers"><span class="cfg23-chip cfg23-reindex" data-scv9-layer="37" data-global-cache="D1" data-index-source="37"><b>37</b> Reindex</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="38" data-global-cache="D1" data-index-source="37"><b>38</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="39" data-global-cache="D1" data-index-source="37"><b>39</b> Reuse</span><span class="cfg23-chip cfg23-reuse" data-scv9-layer="40" data-global-cache="D1" data-index-source="37"><b>40</b> Reuse</span></div><div class="cfg23-cache"><b>D1</b><small>1 个位置 → 1 条</small></div><div class="cfg23-index"><b>I37</b><small>第 37 层选出</small></div></div><div class="cfg23-footer"><span><b>4</b> Full</span><span><b>4</b> Reindex</span><span><b>30</b> Reuse</span><span><b>2</b> 纯 SWA</span></div><figcaption><b>E1–E3、D1</b> 是四份全局缓存，各含主 KV 与对应的索引器 K；E1、E2、E3 分别由第 3、9、15 层建立，D1 由第 21 层从 H<sub>20</sub> 建立。<b>I + 层号</b> 表示该层这一次选出的条目编号，后续层沿用到下一次 Full / Reindex。<b>第 j 层的局部缓存为 Lⱼ</b>，共 L1–L40 四十份，窗口上限 128；所有层继续计算自己的主查询和注意力输出。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2</a>。</figcaption></figure></section>`;}
  function cacheCopiesMarkup(){const config=csaV9Config();return `<div class="scv9-actual-copies"><div class="scv9-copy-title"><b>实际保存：3 份编码器全局 KV + 1 份解码器全局 KV</b><span>每个盒子是一份独立的逻辑缓存</span></div><div class="scv9-cache-rack">${config.globalCaches.map(c=>`<div class="scv9-cache-copy ${c.id==='D1'?'is-decoder':''}" data-cache-copy="${c.id}"><strong>${c.id}</strong><span>主 KV + 索引器 K</span><small>第 ${c.layers[0]}–${c.layers[1]} 层共用</small><em>${c.compression===2?'2 个位置 → 1 条主 KV':'每个位置 → 1 条主 KV'}</em></div>`).join('')}</div><div class="scv9-local-title"><b>另有 40 份各层自己的局部 SWA 状态</b><span>每份只覆盖近期窗口 · 窗口上限 128</span></div><div class="scv9-local-rack">${config.layers.map(l=>`<span data-local-cache="${l.local}" class="${l.phase==='decoder'?'is-decoder':''}">${l.local}</span>`).join('')}</div><p>全局缓存跨层共享，40 份局部 SWA 状态各层独立。每个盒子代表一份逻辑缓存。不论压缩比是多少，这里的每一条主 KV 都是前面那种向量：512 维，64 个查询头共用一条。</p></div>`;}
  function modeRow(mode){const m=csaV9State(mode);return `<article class="scv9-mode" data-scv9-mode="${mode}"><header><div><span class="scv9-mode-number">0${mode+1}</span><h4>${m.name}<small>${m.cn}</small></h4></div><span class="scv9-static-label">${mode===0?"保存新数据":mode===1?"改变选择":"接续选择"}</span></header><div class="scv9-lanes"><div class="scv9-work scv9-work-cache"><p class="scv9-stage-label">① 缓存</p><strong class="scv9-work-status ${mode?'is-shared':'is-new'}">${m.cache}</strong>${mode===0?`<div class="scv9-store-mini" aria-label="缓存 S 中保存的八个条目">${letters.map(l=>kv(l)).join('')}</div><p><b>缓存 S</b> · 主 KV ＋ 索引器 K</p>`:`<div class="scv9-store-reference"><span class="scv9-store-id">S</span><div><b>引用上面的缓存 S</b><small>数据仍放在原处<br>这里不另存一套</small></div></div><p>共用 Full 层建立的主 KV ＋ 索引器 K</p>`}</div><div class="scv9-work scv9-work-index"><p class="scv9-stage-label">② 用索引器选择位置</p><strong class="scv9-work-status ${mode===2?'is-skipped':'is-new'}">${m.index}</strong>${m.scores?`<div class="scv9-scores" aria-label="${m.name} 层的教学索引分数">${m.scores.map((s,i)=>`<div class="${m.select.includes(i)?'is-picked':''}"><em>${s}</em><span style="--score:${s/10}"></span><b>${letters[i]}</b></div>`).join('')}</div><p class="scv9-selection-label">柱高：索引分数 · 0–10 示意轴<br>选择分数最高的 3 项</p>`:`<div class="scv9-skip"><span aria-hidden="true">↳</span><p>从上面的 Reindex 层<br>直接接续 #2、#4、#8</p></div><p class="scv9-selection-label">这里没有再次打分</p>`}<div class="scv9-index-row">${ids(m.select)}</div></div><div class="scv9-work scv9-work-attention"><p class="scv9-stage-label">③ 本层继续做注意力</p><strong class="scv9-work-status is-query">新的主查询 Q</strong><div class="scv9-main-weights">${m.select.map((i,j)=>`<div><span>${letters[i]}</span><i style="--weight:${m.weights[j]}"></i><b>${Math.round(m.weights[j]*100)}%</b></div>`).join('')}<div class="scv9-local-weight"><span>局部</span><i style="--weight:${m.localWeight}"></i><b>${Math.round(m.localWeight*100)}%</b></div></div><p>条长表示权重 · 0–100%<br>主 KV 与局部 KV 的权重合计 100%。</p></div></div><p class="scv9-mode-outcome">${m.summary}</p></article>`;}
  function candidateV11Markup(){const scores=[1,4,9,3,5,8,2,6],selected=[2,5];return `<div class="scv11-pool-example"><div class="scv11-example-title"><b>先看一个可数清的小例子</b><span>64 个位置 → 8 个块 → 选择 2 块</span></div><p>每个小方格代表 1 个位置，8 格组成一个块。每块用其中最高的索引分数参与比较；这个例子选择分数最高的两个块。</p><div class="scv11-pool-blocks">${scores.map((score,i)=>`<div class="scv11-pool-block ${selected.includes(i)?'is-selected':''}" data-pool-block="${i+1}"><span>位置 ${i*8+1}–${i*8+8}</span><div aria-label="8 个位置">${Array.from({length:8},()=>'<i></i>').join('')}</div><small>块分数 <b>${score}</b><em>${selected.includes(i)?'✓ 进入候选池':'留在池外'}</em></small></div>`).join('')}</div><div class="scv11-pool-result"><b>候选池：位置 17–24 和 41–48</b><span>2 个块 × 8 个位置 = 16 个候选位置</span></div><p class="scv11-example-note">这里的长度、分数和选取数量均为教学设定。下面回到报告的实际上限。</p></div>`;}
  function csaV9Markup(){return `<div class="scv9-root">
    <section class="scv9-section" id="csa-objects"><div class="scv9-section-heading">${badge('V4.1 的本代设计')}<h3>一份缓存，可以被不同层以不同方式使用</h3></div><p>CSA² 是<strong>第二代压缩稀疏注意力</strong>（Compressed Sparse Attention 2）。它管理两种对象：保存下来的数据，以及这一次选中哪些数据。</p>
    <figure class="scv9-figure scv9-object-figure"><div class="scv9-object-label"><b>保存的数据</b><span>每个条目里有 K 和 V；#1–#8 是这份缓存中的条目编号。</span></div><div class="scv9-store-full">${letters.map((l,i)=>`<span class="scv9-entry-wrap">${kv(l,[0,3,6].includes(i))}<small>缓存条目</small></span>`).join('')}</div><div class="scv9-object-selection"><div><b>本次选中的条目编号</b><p>例如条目 #1、#4、#7。</p></div><div class="scv9-index-row">${ids([0,3,6])}</div></div><figcaption>原序列用“位置 1”，缓存条目用“#1”，缓存副本用 E1 / D1，Engram 查表用“地址”。条目编号在各自缓存内有效；主 K/V 数值保存在原处。这里用 8 个条目、选择 3 个缩小示意；实际条目可来自压缩后的历史位置。</figcaption></figure>
    <div class="scv9-term-pair"><p><b>索引器查询与索引器 K</b><span>每个主 K/V 条目还对应一组筛选用的键，叫索引器 K。本层的索引器查询与它们匹配，先选出要读的条目。</span></p><p><b class="scv9-q">主查询 Q</b><span>用于真正的注意力：与选中的 K 匹配，得到汇总 V 的权重。</span></p></div></section>
    <section class="scv9-section" id="csa-modes"><h3>同一组历史，三种层职责有什么区别？</h3><p>按分数选出最高的 K 个条目，称为 <b>Top-K</b>；名字里的 K 表示数量。本例选择 3 个条目，报告的配置选择 512 个。</p><p>三个对照按同一顺序阅读：“缓存 → 选位置 → 主注意力”。观察数据是否新增、索引是否重算、注意力是否继续。</p><div class="scv9-mode-stack">${[0,1,2].map(modeRow).join('')}</div><div class="scv9-conclusion"><b>Reindex 改的是选中位置；Reuse 省的是再次选择。</b><p>两者都可以使用同一份 KV。即使 Reuse 沿用 #2、#4、#8，本层的主查询不同，注意力权重仍可改变。各层自己的局部 SWA KV、注意力与后续计算也继续执行。</p></div>${note('条目、索引分数与注意力权重为教学示例。右栏“局部”一行合计多个局部条目的权重；真实模型把选中的主 KV 与局部 SWA KV 拼接，统一计算注意力。索引分数决定“选谁”，注意力权重决定“选中后怎样汇总”。Full 表示这一层承担完整组件职责，它仍然使用稀疏注意力。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a>、图 4。')}</section>
    ${csaV9ConfigMarkup()}
    <section class="scv9-section" id="csa-candidates"><div class="scv9-section-heading">${badge('V4.1 的本代设计')}<h3>还要重新选择时，搜索范围也能缩小</h3></div><p>长历史里，给所有位置反复打分也很费计算。解码器的首个 Full 层先看完整的可见范围，圈出候选区域，后续 Reindex 层在这些区域内重新选择。</p><figure class="scv9-figure scv9-candidate-figure"><div class="scv9-candidate-step"><span class="scv9-timeline-number">1</span><div><h4>首个 Full 层：扫描完整可见历史</h4>${candidateV11Markup()}<p>同时得到本层的 Top-512，以及供后续层使用的候选池。</p></div></div><div class="scv9-candidate-step"><span class="scv9-timeline-number">2</span><div><h4>候选池：最多 16,384 个位置</h4><div class="scv9-count-equation"><span><b>2,048</b> 个块</span><span class="scv9-operator">×</span><span>每块 <b>8</b> 个位置</span><span class="scv9-operator">=</span><strong>16,384</strong></div><p>块按其最高索引分数选择。候选池是后续索引器的搜索范围。</p></div></div><div class="scv9-candidate-step"><span class="scv9-timeline-number">3</span><div><h4>后续 Reindex 层：在池内选自己的 Top-512</h4><div class="scv9-selection-pair"><span>共同候选池</span><b>各层重新打分</b><strong>各自的 512 个位置</strong></div><p>这些位置对应本层实际使用的主 KV；不同层的最终选择可以不同。</p></div></div><figcaption>16,384 是搜索范围上限，512 是最终选择的数量；教学小例子的每块 8 格与每块 8 个位置一一对应。分层索引仅用于 CED 的解码器，首个 Full 层仍需完整扫描。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=11" target="_blank" rel="noopener" title="打开 V4.1 原报告第 11 页">§2.3.2</a>、图 5、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2</a>。</figcaption></figure>
    <details class="ds24-note"><summary>实现补充：DeepSelect 加速 Top-K 选择</summary><div><p>索引器先计算分数，DeepSelect 再从这些分数中高效返回选中的位置编号。它是 GPU 选择算子，并不承担 Q/K/V 投影、CED 分工或缓存管理。</p><p><a href="https://github.com/deepseek-ai/DeepSelect" target="_blank" rel="noopener">官方 DeepSelect 仓库 ↗</a> <a href="https://github.com/deepseek-ai/DeepSelect/blob/main/deep_select/interface.py" target="_blank" rel="noopener">查看 topk 接口 ↗</a></p>${note('报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=18" target="_blank" rel="noopener" title="打开 V4.1 原报告第 18 页">§3.2</a> 对选择算子的实现引用了 DeepSelect；仓库里的单算子性能数字，不能直接当成完整模型的加速倍率。')}</div></details></section>
  </div>`;}
  const recoverySteps=[
    {name:'旧前缀就绪',title:'旧前缀已经处理，等待工具返回。',description:'全局 KV 已保存；局部窗口仍可用，覆盖 897–1024。',next:'让工具返回'},
    {name:'等待结束',title:'工具返回，局部状态已经过期。',description:'新增 33 个位置。旧全局 KV 仍可用，先补回局部状态。',next:'重放末尾 128 个位置'},
    {name:'重放尾窗',title:'重放旧前缀末尾 128 个位置。',description:'重新计算 897–1024 的局部 KV；旧全局 KV 沿用。',next:'完成局部重建'},
    {name:'局部已恢复',title:'编码器局部状态已近似恢复。',description:'末尾 128 个位置已重放；更早的局部依赖被截断，K/V 可能与完整计算不同。',next:'处理 33 个新位置'},
    {name:'接入新结果',title:'接着处理 33 个新位置。',description:'为 1025–1057 生成全局与局部 KV，局部窗口随之移动。',next:'写入新状态'},
    {name:'编码器就绪',title:'编码器就绪，局部窗口向右移动。',description:'移出 33 个旧位置，加入 33 个新位置；窗口仍含 128 个位置。',next:'编码器恢复已完成'}
  ];
  function recoveryV9State(step){
    const n=Number(step),s=Number.isFinite(n)?Math.max(0,Math.min(5,Math.floor(n))):0;
    const replayDone=s>=3,suffixDone=s>=5;
    return {step:s,totalSteps:6,...recoverySteps[s],prefix:[1,1024],suffix:[1025,1057],replay:[897,1024],decoderWindow:[930,1057],suffixArrived:s>=1,
      global:{prefixIdentity:'cached-prefix-1-1024',prefixVersion:1,coverage:[1,suffixDone?1057:1024],prefixRecomputedTokens:0,prefixOverwrittenTokens:0,pendingSuffix:s===4?[1025,1057]:null,appendedSuffix:suffixDone?[1025,1057]:null},
      local:{status:['available','expired','rebuilding','approximate','updating','updated'][s],range:s===1||s===2?null:s===5?[930,1057]:[897,1024],pendingRange:s===2?[897,1024]:s===4?[930,1057]:null,approximate:s>=3},
      work:{kind:s===2?'replay':s===4?'suffix':'idle',activeRange:s===2?[897,1024]:s===4?[1025,1057]:null,activeTokens:s===2?128:s===4?33:0,completedReplayTokens:replayDone?128:0,completedSuffixTokens:suffixDone?33:0,completedTotalTokens:(replayDone?128:0)+(suffixDone?33:0)},
      completedSteps:Array.from({length:s},(_,i)=>i)};
  }
  const recoveryRange=r=>r?r.join('–'):'暂无';
  const recoverySegments=[{start:897,end:929,count:33},{start:930,end:1024,count:95},{start:1025,end:1057,count:33}];
  function recoverySegmentsMarkup(states){return recoverySegments.map((r,i)=>`<span class="scv14-range-segment ${states[i]}" data-range="${r.start}–${r.end}" data-positions="${r.count}"><i aria-hidden="true"></i></span>`).join('');}
  function recoveryTokenMarkup(s){return `<div class="scv14-range-key"><span>全局 KV 另保留较早的 <b>1–896</b></span><span>末尾 161 个位置 ↓</span></div><div class="scv14-axis"><span class="scv14-axis-name">输入位置</span><div class="scv14-range-track">${recoverySegments.map(r=>`<span><b>${r.start}<span>–${r.end}</span></b><small>${r.count} 个</small></span>`).join('')}</div></div><div class="scv14-range-row scv14-input-row"><div><b>已知输入</b><small>${s.step===0?'等待工具结果':s.step===2?'重放橙色范围':s.step===4?'处理橙色范围':'工具结果已接入'}</small></div><div class="scv14-range-track">${recoverySegmentsMarkup([s.step===2?'is-computing':'is-input',s.step===2?'is-computing':'is-input',s.step===0?'is-absent':s.step===4?'is-computing':'is-input-new'])}</div></div>`;}
  function recoveryStoresMarkup(s){const oldLocal=s.step===1?'is-expired':s.step===2?'is-rebuilding':'is-local',lastLocal=s.step===4?'is-pending':s.step===5?'is-local':'is-absent';const label=['897–1024 · 可用','已回收 · 等待重建','897–1024 · 近似重建中','897–1024 · 已近似恢复','897–1024 → 930–1057','930–1057 · 已更新'][s.step];return `<div class="scv14-range-row scv9-replay-global" data-scv9-global-coverage="${recoveryRange(s.global.coverage)}" data-prefix-recomputed="${s.global.prefixRecomputedTokens}" data-prefix-overwritten="${s.global.prefixOverwrittenTokens}"><div><b>全局 KV</b><small><span class="scv14-range-prefix">覆盖位置 </span>${recoveryRange(s.global.coverage)}</small></div><div class="scv14-range-track">${recoverySegmentsMarkup(['is-global','is-global',s.step===4?'is-pending':s.step===5?'is-global-new':'is-absent'])}</div></div><div class="scv14-range-row scv9-replay-local is-${s.local.status}" data-scv9-local-status="${s.local.status}" data-scv9-local-window="${s.local.range?recoveryRange(s.local.range):'none'}"><div><b>局部 SWA</b><small>各层独立</small></div><div class="scv14-range-track scv14-window-track">${recoverySegmentsMarkup([s.step===5?'is-moved-out':s.step===4?'is-moving-out':oldLocal,oldLocal,lastLocal])}<span class="scv14-window-bracket ${s.step>=4?'is-shifting':''} ${s.step===1?'is-missing':''}" aria-hidden="true"></span></div></div><div class="scv14-window-explain"><span class="scv14-window-status">${label}</span><span>${s.step===1?'虚线：局部状态已缺失':s.step===2?'斜纹：正在重新计算':s.step>=4?'移出 33 个旧位置，加入 33 个新位置':'括号圈出局部窗口：128 个位置'}</span></div>`;}
  function recoveryWorkMarkup(s){return `<div class="scv9-current-work ${s.work.kind==='idle'?'':'is-working'}" data-scv9-work-kind="${s.work.kind}" data-scv9-active-tokens="${s.work.activeTokens}" data-scv9-total-work="${s.work.completedTotalTokens}"><span>编码器本步计算</span><b>${s.work.activeRange?recoveryRange(s.work.activeRange):s.step===0?'等待工具返回':s.step===1?'等待启动恢复':s.step===3?'局部重建已完成':'编码器恢复已完成'}</b></div><div class="scv9-replay-meters" aria-label="编码器已完成的工作计数"><span><small>重放</small><b>${s.work.completedReplayTokens}</b></span><i aria-hidden="true">＋</i><span><small>新增</small><b>${s.work.completedSuffixTokens}</b></span><i aria-hidden="true">＝</i><span><small>累计</small><b>${s.work.completedTotalTokens}</b></span></div>`;}
  function recoveryTrailMarkup(s){return `<ol class="scv9-replay-trail" aria-label="恢复过程记录">${recoverySteps.map((r,i)=>`<li class="${i<s.step?'is-done':i===s.step?'is-current':''}" ${i===s.step?'aria-current="step"':''}><span>${i<s.step?'✓':i+1}</span><b>${r.name}</b></li>`).join('')}</ol>`;}
  function recoveryV9Markup(){const s=recoveryV9State(0);return `<div class="scv9-replay-lab scv13-recovery scv14-recovery" data-scv9-recovery-lab data-step="0"><div class="scv9-replay-caption" aria-live="polite" aria-atomic="true"><h4 data-scv9-recovery-title>${s.title}</h4><p data-scv9-recovery-description>${s.description}</p></div><div class="scv9-replay-toolbar"><span>编码器恢复 · <b data-scv9-recovery-counter>1 / 6</b></span><div><button type="button" data-scv9-recovery-action="reset">重置</button><button type="button" data-scv9-recovery-action="prev" disabled>上一步</button><button type="button" class="scv9-replay-next" data-scv9-recovery-action="next">${s.next} <span aria-hidden="true">→</span></button></div></div><div class="scv9-replay-scene"><div data-scv9-recovery-region="tokens">${recoveryTokenMarkup(s)}</div><div class="scv14-stores" data-scv9-recovery-region="stores">${recoveryStoresMarkup(s)}</div></div><div class="scv12-nearby-work" data-scv9-recovery-region="work">${recoveryWorkMarkup(s)}</div><div class="scv14-decoder-reminder"><b>之后仍需准备解码器</b><span>末尾 930–1057 的输出仍需经过后 20 层，才能开始生成。</span></div><div data-scv9-recovery-region="trail">${recoveryTrailMarkup(s)}</div></div>`;}
  function renderRecoveryV9(lab,step){const s=recoveryV9State(step);lab.dataset.step=String(s.step);lab.querySelector('[data-scv9-recovery-counter]').textContent=(s.step+1)+' / '+s.totalSteps;lab.querySelector('[data-scv9-recovery-title]').textContent=s.title;lab.querySelector('[data-scv9-recovery-description]').textContent=s.description;const regions={tokens:recoveryTokenMarkup,stores:recoveryStoresMarkup,work:recoveryWorkMarkup,trail:recoveryTrailMarkup};Object.keys(regions).forEach(key=>{lab.querySelector('[data-scv9-recovery-region="'+key+'"]').innerHTML=regions[key](s);});lab.querySelector('[data-scv9-recovery-action="prev"]').disabled=s.step===0;const next=lab.querySelector('[data-scv9-recovery-action="next"]');next.disabled=s.step===5;next.innerHTML=s.next+(s.step===5?'':' <span aria-hidden="true">→</span>');return s;}
  function compressionV15State(step){
    const n=Math.max(0,Math.min(2,Number(step)||0)),positions=1536+n;
    return {step:n,positions,completeGroups:Math.floor(positions/2),ungrouped:positions%2,decoderEntries:positions,localStart:positions-127,localEnd:positions,group769Ready:n===2};
  }
  function compressionV15TailMarkup(){return `<figure class="scv15-tail" data-scv15-compression-lab data-step="0"><header><div><h4>只增加一个位置时，末尾会怎样？</h4><p>放大同一条序列的末尾；每个方格代表 1 个位置。</p></div><div class="scv15-tail-controls"><button type="button" data-scv15-compression-action="prev" disabled aria-label="返回上一个追加状态">上一步</button><button type="button" data-scv15-compression-action="next">加入位置 1,537</button><button type="button" data-scv15-compression-action="reset">重置</button></div></header><div class="scv15-tail-scene"><p class="scv15-earlier">更早的 767 个完整组保留 · 位置 1–1,534</p><div class="scv15-tail-grid"><div class="scv15-tail-pair is-complete"><div class="scv15-tail-tokens"><span data-scv15-position="1535" data-known="true"><small>位置</small><b>1,535</b></span><span data-scv15-position="1536" data-known="true"><small>位置</small><b>1,536</b></span></div><i class="scv15-pair-connector" aria-hidden="true"></i><div class="scv15-group-result"><b>第 768 条</b><small>两位置聚合完成</small></div></div><div class="scv15-tail-pair" data-scv15-new-pair><div class="scv15-tail-tokens"><span data-scv15-position="1537" data-known="false"><small>待加入</small><b>1,537</b></span><span data-scv15-position="1538" data-known="false"><small>待加入</small><b>1,538</b></span></div><i class="scv15-pair-connector" aria-hidden="true"></i><div class="scv15-group-result"><b data-scv15-group-label>下一组尚未开始</b><small data-scv15-group-detail>等待位置 1,537 和 1,538</small></div></div></div><div class="scv15-tail-counts" aria-live="polite" aria-atomic="true"><div><b data-scv15-count="complete">768</b><span>完整的主 KV 条目</span></div><div><b data-scv15-count="ungrouped">0</b><span>末尾未成组的位置</span></div><div><b data-scv15-count="local">1,409–1,536</b><span>局部 SWA 可覆盖的位置</span></div></div></div><p class="scv15-tail-caption" data-scv15-tail-caption>已有 1,536 个位置。每两个相邻位置组成一条，各份编码器主缓存均有 768 条完整条目。</p><figcaption>这里跟踪连续序列的逻辑分组。若下一次输入接在位置 1,537 后面，新的位置 1,538 与它组成一组；配对沿总位置继续。报告给出分组规则，后台未完成组的具体暂存方式属于实现细节。</figcaption></figure>`;}
  function renderCompressionV15(lab,step){
    const s=compressionV15State(step);lab.dataset.step=String(s.step);
    const set=(selector,value)=>{const el=lab.querySelector(selector);if(el)el.textContent=value;};
    for(const pos of [1537,1538]){const token=lab.querySelector(`[data-scv15-position="${pos}"]`);if(token){token.dataset.known=String(pos<=s.positions);token.querySelector('small').textContent=pos<=s.positions?'已加入':'待加入';}}
    const pair=lab.querySelector('[data-scv15-new-pair]');if(pair){pair.classList.toggle('is-complete',s.group769Ready);pair.classList.toggle('is-waiting',s.step===1);}
    set('[data-scv15-group-label]',['下一组尚未开始','1 个位置等待配对','第 769 条'][s.step]);
    set('[data-scv15-group-detail]',['等待位置 1,537 和 1,538','近期信息可由局部 SWA 使用','位置 1,537 与 1,538 聚合完成'][s.step]);
    set('[data-scv15-count="complete"]',String(s.completeGroups));set('[data-scv15-count="ungrouped"]',String(s.ungrouped));
    set('[data-scv15-count="local"]',s.localStart.toLocaleString('en-US')+'–'+s.localEnd.toLocaleString('en-US'));
    set('[data-scv15-tail-caption]',[
      '已有 1,536 个位置。每两个相邻位置组成一条，各份编码器主缓存均有 768 条完整条目。',
      '加入位置 1,537：仍有 768 个完整组，末尾多出 1 个位置。它的信息可先由近期 128 个位置的局部 SWA 使用。',
      '再加入位置 1,538：最后两个位置聚合成第 769 条主 KV。解码器 D1 的比例为 1∶1，此时共有 1,538 条。'
    ][s.step]);
    const prev=lab.querySelector('[data-scv15-compression-action="prev"]'),next=lab.querySelector('[data-scv15-compression-action="next"]');
    if(prev)prev.disabled=s.step===0;if(next){next.disabled=s.step===2;next.textContent=['加入位置 1,537','再加入位置 1,538','最后一组已完成'][s.step];}
  }
  function initCompressionV15(){
    document.querySelectorAll('[data-scv15-compression-lab]').forEach(lab=>{
      if(lab.dataset.scv15Ready==='true')return;lab.dataset.scv15Ready='true';
      lab.addEventListener('click',event=>{const button=event.target.closest('[data-scv15-compression-action]');if(!button||button.disabled||!lab.contains(button))return;const action=button.getAttribute('data-scv15-compression-action'),step=Number(lab.dataset.step)||0;renderCompressionV15(lab,action==='reset'?0:step+(action==='next'?1:-1));});
    });
  }
  function compressionV13Markup(){return `<div class="scv13-compression scv15-compression" id="cache-compression"><div class="scv15-scope"><div><span>沿序列看</span><b>所有已完成的相邻组都按同一规则处理</b><p>位置 1、2 组成第 1 条，3、4 组成第 2 条，持续到 1,535、1,536 组成第 768 条。</p></div><div><span>沿网络看</span><b>2∶1 用在三份编码器主缓存 E1、E2、E3</b><p>解码器 D1 为 1∶1。每层的输入状态与 Q 仍逐位置计算，局部 SWA 也逐位置保留近期信息。</p></div></div><p class="scv13-compress-intro">因此，“压缩”的对象是<strong>供主注意力使用的历史 KV 条目</strong>。一条聚合记录承载相邻两个位置的数值特征；原输入的文字和位置继续保留。</p><div class="scv14-compress-groups" aria-label="相邻两个位置组成一条主 KV，直到位置1535和1536"><div class="scv14-compress-group"><div><span><small>位置</small> <b>1</b></span><span><small>位置</small> <b>2</b></span></div><i aria-hidden="true">↓</i><b>主 KV 第 1 条</b></div><div class="scv14-compress-group"><div><span><small>位置</small> <b>3</b></span><span><small>位置</small> <b>4</b></span></div><i aria-hidden="true">↓</i><b>主 KV 第 2 条</b></div><span class="scv14-compress-ellipsis" aria-label="继续按相邻两位置分组">…</span><div class="scv14-compress-group"><div><span><small>位置</small> <b>1535</b></span><span><small>位置</small> <b>1536</b></span></div><i aria-hidden="true">↓</i><b>主 KV 第 768 条</b></div></div><p class="scv14-compress-count"><b>1,536 个位置 → 768 条主 KV</b><span>每份编码器主缓存分别得到这一数量。</span></p>${compressionV15TailMarkup()}<div class="scv14-cache-generators"><h4>压缩比例与共享范围，都属于 CSA² 的配置</h4><div class="scv14-generator-row"><span>第 3 层输入的 <b>1,536</b> 个位置</span><i aria-hidden="true">→</i><strong>E1 · 768 条</strong><small>第 3–8 层共用</small></div><div class="scv14-generator-row"><span>第 9 层输入的 <b>1,536</b> 个位置</span><i aria-hidden="true">→</i><strong>E2 · 768 条</strong><small>第 9–14 层共用</small></div><div class="scv14-generator-row"><span>第 15 层输入的 <b>1,536</b> 个位置</span><i aria-hidden="true">→</i><strong>E3 · 768 条</strong><small>第 15–20 层共用</small></div><p>三份主缓存分别从各自所在层的状态产生，每份各 768 条；各层仍有 1,536 个位置继续计算。CED 决定解码器主 KV 从 H<sub>20</sub> 取得数值来源，CSA² 决定这些 KV 如何压缩、共享和选择。</p></div><div class="scv13-ratio-compare"><div><b>第 1–2 层：纯 SWA</b><span>各自保留近期最多 128 个位置的局部 KV。</span><strong>逐位置处理近期信息</strong></div><div><b>第 21–40 层：解码器 CSA²</b><span>第 21 层从 H<sub>20</sub> 投影出 D1，其余 19 层共用这一份；压缩比 1。</span><strong>1,536 个位置 → 1,536 条主 KV</strong></div></div><details class="scv9-detail scv14-aggregate-detail scv15-aggregate-detail"><summary>两个位置的信息，具体怎样合成一条？</summary><div class="scv15-aggregate-body"><p>先把每个位置的状态分别乘两组训练得到的矩阵：一组产生<strong>待保存的信息数值</strong>，另一组产生<strong>各个数值的聚合分数</strong>。组内的分数经 softmax 转成权重，再加权相加。</p><p class="scv15-toy-intro">用只有两个数值的教学例子，观察“信息”和“权重”怎样配合：</p><div class="scv15-aggregation-example"><div class="scv15-aggregation-row scv15-aggregation-head"><b>来自哪里</b><span>第 1 个数值</span><span>第 2 个数值</span></div><div class="scv15-aggregation-row"><b>位置 1</b><span><strong>2</strong><small>占权重 75%</small></span><span><strong>8</strong><small>占权重 25%</small></span></div><div class="scv15-aggregation-row"><b>位置 2</b><span><strong>6</strong><small>占权重 25%</small></span><span><strong>4</strong><small>占权重 75%</small></span></div><div class="scv15-aggregation-row is-result"><b>保存为一条</b><span><small>2 × 0.75 + 6 × 0.25</small><strong>= 3</strong></span><span><small>8 × 0.25 + 4 × 0.75</small><strong>= 5</strong></span></div></div><p>加权聚合的结果为 <b>[3, 5]</b>。每个数值维度可使用不同权重；一条记录浓缩了两个位置的信息。这是有损聚合，FP4 还会进一步降低每个数的保存精度。</p><p class="scv15-aggregate-source">报告用 C 表示待聚合的数值、Z 表示聚合分数。这里直接展示 softmax 后的教学权重；它们用于合成 KV，与前面“Q 和 K 匹配后汇总 V”的注意力权重分别计算。表格省略后续归一化等步骤。逐维加权的公式见 <a href="https://arxiv.org/html/2606.19348v1" target="_blank" rel="noopener noreferrer">V4 报告 §2.3.1，式 11–12</a>；V4.1 在此基础上改为互不重叠的分组，见本报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.3</a>。</p></div></details><p class="scv13-compress-boundary"><strong>因果边界：</strong>某个位置只使用已经完整落在其可见范围内的压缩组。位置 1,537 计算自己的状态时，第 769 组尚待位置 1,538 到来；它可通过局部 SWA 使用近期已有信息。依据：报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.3</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=10" target="_blank" rel="noopener" title="打开 V4.1 原报告第 10 页">§2.3.1</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2.1</a>；连续追加示意按这些规则推导。</p></div>`;}
  function cacheV9Markup(){return `<div class="scv9-root">
    <section class="scv9-section" id="cache-size"><h3>缓存占多少空间，取决于“存几份、存几项、每项多大”</h3><p>上一章解释了为什么多层可以共用数据。把这件事放回缓存容量，就能看到共享、压缩和数值格式分别改变什么。</p><div class="scv9-size-mechanisms"><article><header>${badge('本代：更多跨层共享')}<h4>① 减少独立副本</h4></header>${cacheCopiesMarkup()}</article><article><header>${badge('沿用压缩思路；调整配置','inherited')}<h4>② 减少历史条目数</h4></header>${compressionV13Markup()}</article><article><header>${badge('本代：主 KV 扩展到 FP4')}<h4>③ 每个数用更少的位保存</h4></header><div class="scv9-bit-compare"><div><b>FP8</b><span class="scv9-bits" aria-label="8 位">${Array(8).fill('<i></i>').join('')}</span><small>8 位浮点</small></div><div><b>FP4</b><span class="scv9-bits is-fp4" aria-label="4 位">${Array(4).fill('<i></i>').join('')}</span><small>4 位浮点</small></div></div><p>FP4 用 4 位浮点格式近似保存每个主 KV 数值，另存缩放信息。读取时把它们转换为计算所需的近似数值，这叫解量化；被舍去的精度不会因此恢复。局部 SWA KV 使用 8 位浮点格式 FP8。</p></article></div>${note('上面①「减少独立副本」按实际配置显示 4 份全局缓存和 40 份局部状态；②「减少历史条目数」展示相邻位置的连续分组，CSA² 的分组互不重叠。展开部分用两个数值的教学例子说明逐维加权聚合，省略输出归一化等步骤。编码器压缩比为 2，解码器为 1。压缩与稀疏选择在 V4 已有，V4.1 的新重点是跨层共享及主 KV 的 FP4。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.3</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=14" target="_blank" rel="noopener" title="打开 V4.1 原报告第 14 页">§2.4.4</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2</a>。')}
    <figure class="scv9-figure scv9-capacity-result"><div><span class="scv9-stage-label">上述设计共同作用 · 相同序列长度</span><h4>全局 KV：约为 V4-Flash 的 1/4</h4><div class="scv9-capacity-bars"><div><b>V4-Flash</b><span><i style="--capacity:1"></i></span><em>100%</em></div><div class="is-current"><b>V4.1-Flash</b><span><i style="--capacity:.25"></i></span><em>约 25%</em></div></div></div><div class="scv9-capacity-number"><strong>890 <small>B / token</small></strong><p>报告给出的全局 KV 占用<br>1,000,000 token 约为 0.89 GB</p></div><figcaption>这是共享、压缩和量化共同作用后的全局 KV 占用，包含主 KV 与索引器 K。0.89 GB 按十进制换算；模型权重、局部 KV 和运行工作区另计。依据：报告摘要、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=4" target="_blank" rel="noopener" title="打开 V4.1 原报告第 4 页">§1</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=25" target="_blank" rel="noopener" title="打开 V4.1 原报告第 25 页">§5</a>。</figcaption></figure></section>
    <section class="scv9-section" id="cache-lifetime"><div class="scv9-section-heading">${badge('本代：调整保存策略')}<h3>一段对话暂时停下，哪些状态值得长期保留？</h3></div><p>例如模型读完一份文档，正在等待工具返回结果。完整历史可能在之后再次使用；局部窗口状态主要服务当前会话的近期计算，两者适合不同的保存期限。</p><div class="scv9-lifetime-pair"><article><span class="scv9-lifetime-symbol" aria-hidden="true">G</span><div><h4>全局 KV · 供长历史再次使用</h4><p>进入 SSD / 主机内存中的持久缓存。报告部署保留至少 72 小时。</p><strong>以后命中这段历史，可以复用已有结果。</strong></div></article><article><span class="scv9-lifetime-symbol is-local" aria-hidden="true">L</span><div><h4>编码器局部 SWA KV · 服务近期窗口</h4><p>留在主机 DRAM 的短期池，按分钟级期限回收。</p><strong>过期后，用一小段已有输入近似重建。</strong></div></article></div><div class="cache30-storage" id="cache-storage-tiers"><h4>SSD、主机内存、GPU 显存，各保存什么？</h4><p>前面按用途区分“全局 KV”和“局部 SWA KV”；这里按硬件位置区分。<strong>同一份全局 KV，可以有供以后复用的持久副本，以及供当前计算读取的显存工作副本。</strong></p><div class="cache30-table-wrap"><table class="cache30-table"><thead><tr><th scope="col">存储位置</th><th scope="col">保存的 KV</th><th scope="col">使用时机</th></tr></thead><tbody><tr><th scope="row">SSD / 主机内存<br><small>持久缓存</small></th><td>全局 KV：主 K/V 与索引器 K</td><td>保留长历史，供后续请求命中前缀后加载复用。报告部署中的全局 KV 保留至少 72 小时。</td></tr><tr><th scope="row">主机 DRAM<br><small>短期分布式内存池</small></th><td>编码器各层的局部 SWA KV</td><td>服务活跃会话。报告用每台机器约 10% 的主机 DRAM 组成池，按分钟级存活时长（TTL）回收；缺失时重放前缀末尾 128 个位置。</td></tr><tr><th scope="row">GPU 显存（HBM）<br><small>当前计算的工作集</small></th><td>当前请求使用的全局 KV 与局部 SWA KV</td><td>注意力计算直接读取。解码器局部 SWA KV 在每次预填充末尾准备，随后用于生成。</td></tr></tbody></table></div><p class="cache30-note">解码器局部 SWA KV 只服务本次生成；跨请求的前缀缓存保留全局 KV，编码器局部状态由短期池补充。这里的“内存”指主机 DRAM，“显存”指 GPU HBM。依据：<a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=4" target="_blank" rel="noopener">报告 §1</a>、<a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=19" target="_blank" rel="noopener">§3.2.1（存储策略）</a>、<a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=20" target="_blank" rel="noopener">§3.2.2（恢复与解码）</a>。</p></div><figure class="scv9-figure scv9-persist"><h4>持久缓存里，省去长期保留的局部状态</h4><p class="scv11-chart-scale">条长表示持久缓存占用量 · 前代总量 = 100%</p><div class="scv9-persist-row"><b>V4-Flash</b><span class="scv9-persist-track"><i class="scv9-persist-global">全局 KV</i><i class="scv9-persist-local">局部 SWA KV</i></span></div><div class="scv9-persist-row is-current"><b>V4.1-Flash</b><span class="scv9-persist-track"><i class="scv9-persist-global" aria-label="全局 KV，总量约为前代的八分之一"></i></span><strong>仅全局 · 约 1/8</strong></div><figcaption>报告的同负载比较中，原持久缓存的局部状态接近一半；移除这部分，再将保留的全局 KV 缩至约 1/4，合计约为原持久缓存的 1/8。条形按这一近似关系绘制。此处的“持久缓存”与上面的“全局 KV”是两个统计口径。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=19" target="_blank" rel="noopener" title="打开 V4.1 原报告第 19 页">§3.2.1</a>。</figcaption></figure><div class="cache30-pricing" id="cache-hit-pricing"><h4>低价缓存命中：重复输入只按 1/50 的单价计费</h4><p>长文档、多轮对话和 Agent 往往反复携带相同前缀。DeepSeek 默认构建硬盘缓存：后续请求<strong>完整匹配已落盘的前缀单元</strong>时，这部分输入按缓存命中价格收费，其余输入按未命中价格收费。</p><div class="cache30-table-wrap"><table class="cache30-table cache30-prices"><caption>deepseek-flash（V4.1-Flash）· 元 / 百万输入 token · 2026-09-11 核对</caption><thead><tr><th scope="col">时段</th><th scope="col">缓存命中</th><th scope="col">缓存未命中</th><th scope="col">命中部分节省</th></tr></thead><tbody><tr><th scope="row">空闲</th><td><strong>0.02 元</strong></td><td>1 元</td><td>98%</td></tr><tr><th scope="row">高峰</th><td><strong>0.04 元</strong></td><td>2 元</td><td>98%</td></tr></tbody></table></div><div class="cache30-example"><b>例如：一次输入 100 万 token，其中 90 万命中</b><p>空闲时段输入费 = 0.9 × 0.02 + 0.1 × 1 = <strong>0.118 元</strong>。同样输入全部未命中为 1 元，本例节省 <strong>88.2%</strong>。新生成的输出另行计费。</p></div><p><strong>低成本的技术基础：</strong>SSD 承担大容量持久保存；CSA² 与 FP4 减少需保存和搬运的全局 KV；短期内存池与有界重放减少长期保留局部状态的开销。命中前缀后，服务复用已有计算结果，再处理新增内容。具体的 1/50 单价比例来自 API 定价。</p><p class="cache30-note">报告的“至少 72 小时”描述其部署配置。面向用户的 API 缓存按尽力而为提供，命中量以返回的 <code>prompt_cache_hit_tokens</code> 为准；缓存构建需要时间，保留时间通常为数小时到数天。价格与时段以<a href="https://api-docs.deepseek.com/zh-cn/quick_start/pricing/" target="_blank" rel="noopener">官方价格页</a>为准；匹配规则见<a href="https://api-docs.deepseek.com/zh-cn/guides/kv_cache/" target="_blank" rel="noopener">上下文硬盘缓存文档</a>。</p></div></section>
    <section class="scv9-section" id="cache-recovery"><div class="scv9-section-heading">${badge('本代：SWA 有界重放')}<h3>工具终于返回了；局部状态已经过期，怎样接着算？</h3></div><p>沿用这个具体例子：前一轮已有 <strong>1,024 个 token</strong>，工具又返回 <strong>33 个 token</strong>。旧输入叫“缓存前缀”，新结果叫“新增后缀”。这些长度是教学设定。</p>${recoveryV9Markup()}${note('图中全局范围概括各份主 KV 对应的输入位置，条形长度不表示条目数。新增 33 个位置在每份 2:1 编码器主缓存中形成 16 条完整条目；末尾 1057 尚未成组，在该路径中仍由局部 SWA 提供。1:1 解码器主缓存则追加 33 条。部署时可把重放与新增输入合在一次预填充中，编码器共处理 128 + 33 = 161 个位置。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=9" target="_blank" rel="noopener" title="打开 V4.1 原报告第 9 页">§2.3</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=20" target="_blank" rel="noopener" title="打开 V4.1 原报告第 20 页">§3.2.2</a>。')}
    <section class="scv9-detail scv11-recovery-handoff"><h4>编码器就绪后，准备解码器，再开始生成</h4><div class="scv9-two-windows"><div><h4>本节：恢复编码器局部状态</h4><p>条件是旧前缀的局部缓存缺失。重放<strong>旧前缀末尾</strong> 128 个位置：本例为 <b>897–1024</b>。</p></div><div><h4>CED：准备解码器局部状态</h4><p>读入结束时，把<strong>整个新输入末尾</strong> 128 个位置的编码器输出交给解码器：本例为 <b>930–1057</b>，为开始生成作准备。</p></div></div><p>第二个窗口是每次读入结束后仍要完成的工作：位置 930–1057 的编码器输出通过后 20 层，近似建立解码器局部 KV，随后才开始生成。上方的 161 个位置只统计编码器处理的位置数。解码器局部状态用于本次生成，不进入前缀缓存。报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=20" target="_blank" rel="noopener" title="打开 V4.1 原报告第 20 页">§3.2.2</a>。</p></section><div class="scv9-conclusion"><b>为什么可以少存？因为丢失的短期状态有便宜的恢复办法。</b><p>长期保留全局历史，把编码器局部状态留在短期池；局部状态偶尔失效时，再处理有限的尾部窗口。这才使“减少持久存储”成为可用的部署策略。</p></div>
    </section>
  </div>`;}
  function initCsaCacheV9(){
    if(typeof document==='undefined')return;
    initCompressionV15();
    document.querySelectorAll('[data-scv9-recovery-lab]').forEach(lab=>{
      if(lab.dataset.scv9Ready==='true')return;
      lab.dataset.scv9Ready='true';
      lab.addEventListener('click',event=>{
        const button=event.target.closest('[data-scv9-recovery-action]');
        if(!button||button.disabled||!lab.contains(button))return;
        const action=button.getAttribute('data-scv9-recovery-action'),step=Number(lab.dataset.step)||0;
        renderRecoveryV9(lab,action==='reset'?0:step+(action==='next'?1:-1));
      });
    });
  }
  root.compressionV15State=compressionV15State;root.csaV9State=csaV9State;root.csaV9Config=csaV9Config;root.recoveryV9State=recoveryV9State;
  root.csaV9Markup=csaV9Markup;root.cacheV9Markup=cacheV9Markup;root.initCsaCacheV9=initCsaCacheV9;
})(typeof globalThis!=='undefined'?globalThis:this);



const draftV9Data = Object.freeze({
  prefix: ['小猫', '正在'],
  proposal: ['睡觉', '，', '尾巴', '不停', '摇动'],
  distributions: [
    [['睡觉', .48], ['休息', .31], ['玩耍', .21]],
    [['，', .63], ['。', .24], ['但', .13]],
    [['它', .42], ['尾巴', .36], ['耳朵', .22]],
    [['轻轻', .49], ['不停', .29], ['慢慢', .22]],
    [['摇动', .51], ['摆动', .32], ['移动', .17]]
  ]
});
function draftV9State(stage = 0, inspect = 0) {
  const s = Math.max(0, Math.min(3, Math.trunc(Number(stage) || 0)));
  const i = Math.max(0, Math.min(4, Math.trunc(Number(inspect) || 0)));
  return {
    stage: s, inspect: i, drafted: s >= 1, verified: s >= 2, committed: s >= 3,
    oldPrefix: draftV9Data.prefix.concat(draftV9Data.proposal.slice(0, i)),
    finalPrefix: s >= 3 ? draftV9Data.prefix.concat(draftV9Data.proposal.slice(0, 3), '轻轻') : draftV9Data.prefix.slice(),
    status: s < 2 ? ['等待验证', '等待验证', '等待验证', '等待验证', '等待验证']
      : ['✓ 通过', '✓ 通过', '✓ 通过', '× 未通过', '— 作废']
  };
}
function draftV9Token(word, style = '') {
  return `<span class="dv9-token ${style}">${word}</span>`;
}
function draftV9Detail(stage = 0, index = 0) {
  const state = draftV9State(stage, index), i = state.inspect;
  if (!state.verified) return `<div class="dv9-inspect-empty"><span class="dv9-inspect-number">5</span><div><b>五份分布，由同一次验证得到</b><p>验证完成后，点按或移入任意一列，查看它当时依据的前文；键盘可用 Tab 聚焦。</p></div></div>`;
  const cls = i < 3 ? 'dv9-pass' : i === 3 ? 'dv9-fail' : 'dv9-invalid';
  const oldPrefix = state.oldPrefix.map((word, j) => draftV9Token(word, i === 4 && j === state.oldPrefix.length - 1 ? 'dv9-rejected' : '')).join('');
  const note = i < 3 ? '本例预设这项通过。是否接受由验证规则决定，不能只看谁的概率最高。'
    : i === 3 ? '本例预设“不停”未通过。在这一位置，主模型改为补出“轻轻”。'
    : '这份分布以“不停”为前提。“不停”被替换后，它就不能用于新的前文。';
  return `<div class="dv9-detail-top"><span>查看已算好的第 ${i + 1} 份分布</span><b class="${cls}">${state.status[i]}</b></div>
    <div class="dv9-detail-grid"><div class="dv9-context"><span class="dv9-label">计算时使用的前文</span><div class="dv9-inspect-rail">${oldPrefix}</div><p class="dv9-context-caption">在这段前文之后，预测“${draftV9Data.proposal[i]}”所在的位置。候选本身及右侧内容不可见。</p>${i === 4 && state.committed ? `<span class="dv9-label">现在实际使用的前文</span><div class="dv9-inspect-rail">${state.finalPrefix.map((word, j) => draftV9Token(word, j === state.finalPrefix.length - 1 ? 'dv9-corrected' : '')).join('')}</div>` : ''}</div>
    <div class="dv9-probabilities"><span class="dv9-label">主模型的下一项分布 · 人工示例</span><span class="dv11-prob-axis"><span>0%</span><span>100%</span></span>${draftV9Data.distributions[i].map(([word, probability]) => `<div class="dv9-prob-row ${word === draftV9Data.proposal[i] ? 'dv9-proposed-row' : ''}"><span>${word}</span><span class="dv9-prob-track"><i style="width:${probability * 100}%"></i></span><span>${Math.round(probability * 100)}%</span></div>`).join('')}</div></div>
    <p class="dv9-inspect-verdict ${cls}">${note}</p>`;
}
function draftV9Markup() {
  return `<div class="dv9" data-draft-v9 data-stage="0">
    <div class="dv9-motivation"><span class="dv9-new-label">V4.1 采用的新模块</span><h4>较小的模块先写一小段，主模型再一起核对</h4><p>前面的一般生成流程，每轮确定一个新 token。DSpark 希望主模型的一轮计算能留下多个 token。</p></div>
    <div class="dv9-process">
      <section class="dv9-phase dv9-phase-draft">
        <header class="dv9-phase-heading"><span class="dv9-number">01</span><div><h4>提出 5 项草稿</h4><p>已确定的文字是“小猫正在”。后面的内容暂时只是候选。</p></div></header>
        <div class="dv9-known"><span class="dv9-label">已确定的前文</span><div class="dv9-known-rail">${draftV9Data.prefix.map(x => draftV9Token(x)).join('')}</div></div>
        <div class="dv9-scroll"><div class="dv9-five dv9-proposals" tabindex="-1" aria-label="本次提出的五项草稿">${draftV9Data.proposal.map((word, i) => `<div class="dv9-proposal"><span>候选 ${i + 1}</span><b data-dv9-proposal="${i}">…</b><small data-dv9-draft-status>等待起草</small></div>`).join('')}</div></div>
        <div class="dv9-action-row"><button type="button" class="dv9-action dv9-primary" data-dv9-action="draft">提出 5 项草稿</button><span data-dv9-draft-note>这些候选还没有加入已确定的前文。</span></div>
      </section>
      <section class="dv9-phase dv9-phase-verify">
        <header class="dv9-phase-heading"><span class="dv9-number">02</span><div><h4>一次调用，验证这 5 项</h4><p>把草稿作为一批输入。主模型同时计算五个预测位置的分布，因果遮罩仍限制每个位置能看到的前文。</p></div></header>
        <div class="dv9-batch-head"><span class="dv9-batch-line"></span><strong>同一批验证 · 五个位置一起计算</strong><span class="dv9-batch-line"></span></div>
        <div class="dv9-scroll"><div class="dv9-five dv9-results" aria-label="同一批验证的五个结果">${draftV9Data.proposal.map((word, i) => `<button type="button" class="dv9-result" data-dv9-inspect="${i}" disabled aria-label="查看第 ${i + 1} 项已算好的分布" aria-controls="draft-v9-inspection"><span class="dv9-result-order">候选 ${i + 1}</span><strong data-dv9-verify-word="${i}">…</strong><span class="dv11-inspect-hint">验证后可查看分布</span><b data-dv9-status="${i}">等待验证</b></button>`).join('')}</div></div>
        <div class="dv9-action-row"><button type="button" class="dv9-action dv9-primary" data-dv9-action="verify" disabled>一次验证 5 个候选</button><span data-dv9-batch-note role="status" aria-live="polite">五份结果会一起显示。</span></div>
        <div id="draft-v9-inspection" class="dv9-inspection">${draftV9Detail()}</div>
        <p class="dv9-example-note">概率与通过情况均为教学设定，重点展示批量验证的数据依赖与前文更新。实际接受规则以对应采样验证算法为准。</p>
      </section>
      <section class="dv9-phase dv9-phase-commit">
        <header class="dv9-phase-heading"><span class="dv9-number">03</span><div><h4>保留通过的连续部分，接着往下写</h4><p>前 3 项通过，第 4 项“不停”未通过。主模型在这里补出“轻轻”；后续“摇动”的旧前提随之改变。</p></div></header>
        <div class="dv9-final-stage"><span class="dv9-label">本轮之后，实际使用的前文</span><div class="dv9-scroll"><div class="dv9-final-rail" data-dv9-final-rail tabindex="-1" aria-label="更新后的实际前文">${draftV9Data.prefix.map(x => draftV9Token(x)).join('')}<span class="dv9-final-placeholder">新内容将在采用结果后接到这里</span></div></div><div class="dv9-final-caption" data-dv9-final-caption><span>前文会保留在这里，作为下一轮起草的起点。</span></div></div>
        <div class="dv9-action-row"><button type="button" class="dv9-action dv9-primary" data-dv9-action="commit" disabled>采用验证结果</button><button type="button" class="dv9-action dv9-reset" data-dv9-action="reset">重新观察</button></div>
        <div class="dv9-legend"><span><i class="dv9-dot-pass"></i>草稿被接受</span><span><i class="dv9-dot-fail"></i>草稿未通过</span><span><i class="dv9-dot-corrected"></i>主模型补出</span><span><i class="dv9-dot-invalid"></i>旧前提失效</span></div>
      </section>
    </div>
    <div class="dv9-heritage"><div><span class="dv9-label">沿用的思路</span><p>提前提出多个候选、再由主模型验证，属于推测解码。DeepSeek-V3 的 MTP 已探索多 token 预测。</p></div><div><span class="dv9-label">本代采用的 DSpark</span><p>3 个 Transformer 块并行计算 5 个草稿位置的基础分数，再用轻量模块处理候选间的依赖。调度器结合接受概率和服务负载，选择实际验证长度。</p></div></div>
    <p class="dv9-source-note">技术报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=13" target="_blank" rel="noopener" title="打开 V4.1 原报告第 13 页">§2.4.3</a>，印刷页 13–14。这里演示选择验证 5 项的情形；实际请求的验证长度由调度器决定。</p>
  </div>`;
}
function initDraftV9() {
  const root = document.querySelector('[data-draft-v9]');
  if (!root || root.dataset.dv9Initialized === 'true') return;
  root.dataset.dv9Initialized = 'true';
  let stage = 0, index = 0;
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => Array.from(root.querySelectorAll(selector));
  function inspect(nextIndex) {
    if (stage < 2) return;
    index = draftV9State(stage, nextIndex).inspect;
    $('#draft-v9-inspection').innerHTML = draftV9Detail(stage, index);
    $$('[data-dv9-inspect]').forEach((column, i) => { column.classList.toggle('is-inspected', index === i); column.setAttribute('aria-pressed', String(index === i)); });
  }
  function render(nextStage) {
    stage = draftV9State(nextStage).stage;
    const state = draftV9State(stage, index);
    root.dataset.stage = String(stage);
    $$('[data-dv9-proposal]').forEach((node, i) => { node.textContent = state.drafted ? draftV9Data.proposal[i] : '…'; });
    $$('[data-dv9-draft-status]').forEach(node => { node.textContent = state.drafted ? '草稿 · 待主模型确认' : '等待起草'; });
    $$('[data-dv9-verify-word]').forEach((node, i) => { node.textContent = state.drafted ? draftV9Data.proposal[i] : '…'; });
    $$('[data-dv9-status]').forEach((node, i) => { node.textContent = state.status[i]; });
    $$('.dv11-inspect-hint').forEach(node=>{node.textContent=state.verified?'查看分布与前文 ↓':'验证后可查看分布'});
    $$('[data-dv9-inspect]').forEach((column, i) => {
      column.disabled = !state.verified;
      column.classList.toggle('dv9-pass', state.verified && i < 3);
      column.classList.toggle('dv9-fail', state.verified && i === 3);
      column.classList.toggle('dv9-invalid', state.verified && i === 4);
      if (!state.verified) { column.classList.remove('is-inspected'); column.removeAttribute('aria-pressed'); }
    });
    const draftButton = $('[data-dv9-action="draft"]'), verifyButton = $('[data-dv9-action="verify"]'), commitButton = $('[data-dv9-action="commit"]');
    draftButton.disabled = state.drafted;
    draftButton.textContent = state.drafted ? '✓ 已提出 5 项草稿' : '提出 5 项草稿';
    verifyButton.disabled = !state.drafted || state.verified;
    verifyButton.textContent = state.verified ? '✓ 一次验证已完成' : '一次验证 5 个候选';
    commitButton.disabled = !state.verified || state.committed;
    commitButton.textContent = state.committed ? '✓ 已更新前文' : '采用验证结果';
    $('[data-dv9-batch-note]').textContent = state.verified ? '五份结果已一起算好；悬停或聚焦只查看结果。' : '五份结果会一起显示。';
    $('[data-dv9-final-rail]').innerHTML = state.committed
      ? state.finalPrefix.map((word, i) => draftV9Token(word, i < 2 ? '' : i < 5 ? 'dv9-accepted' : 'dv9-corrected')).join('')
      : draftV9Data.prefix.map(x => draftV9Token(x)).join('') + '<span class="dv9-final-placeholder">新内容将在采用结果后接到这里</span>';
    $('[data-dv9-final-caption]').innerHTML = state.committed
      ? `<b>下一轮从“小猫正在睡觉，尾巴轻轻”继续。</b><span>一次主模型验证，留下 3 项草稿，并补出 1 项新内容。</span>`
      : '<span>前文会保留在这里，作为下一轮起草的起点。</span>';
    if (state.verified) inspect(index);
    else $('#draft-v9-inspection').innerHTML = draftV9Detail();
  }
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dv9-action]');
    if (button && root.contains(button) && !button.disabled) {
      const action = button.dataset.dv9Action;
      if (action === 'reset') { index = 0; render(0); }
      if (action === 'draft' && stage === 0) { render(1); $('.dv9-proposals').focus({ preventScroll: true }); }
      if (action === 'verify' && stage === 1) { render(2); $('[data-dv9-inspect="0"]').focus({ preventScroll: true }); }
      if (action === 'commit' && stage === 2) { render(3); $('[data-dv9-final-rail]').focus({ preventScroll: true }); }
    }
    const column = event.target.closest('[data-dv9-inspect]');
    if (column && root.contains(column)) inspect(column.dataset.dv9Inspect);
  });
  root.addEventListener('pointerover', event => { const column = event.target.closest('[data-dv9-inspect]'); if (column && root.contains(column)) inspect(column.dataset.dv9Inspect); });
  root.addEventListener('focusin', event => { const column = event.target.closest('[data-dv9-inspect]'); if (column && root.contains(column)) inspect(column.dataset.dv9Inspect); });
  render(0);
}

(function (root) {
  'use strict';
  const CASES = [
    {word:'小猫', ids:[12,57,103,188,241,366], weights:[30,25,18,12,10,5], outputs:[[1,.2],[2,.4],[3,.6],[4,.8],[5,1],[6,1.2]], shared:[.4,.1]},
    {word:'正在', ids:[9,57,116,188,270,349], weights:[28,24,18,14,10,6], outputs:[[.5,.1],[1.5,.3],[2.5,.5],[3.5,.7],[4.5,.9],[5.5,1.1]], shared:[.6,.2]},
    {word:'睡觉', ids:[12,88,142,241,309,366], weights:[32,23,17,13,9,6], outputs:[[2,.4],[1,.2],[4,.8],[3,.6],[6,1.2],[5,1]], shared:[.3,.15]}
  ];
  const number = n => Array.isArray(n)?'['+n.map(v=>Number(v.toFixed(3))).join(', ')+', …]':Number(n.toFixed(3)).toString();
  function moeV17State(index) {
    if (!Number.isInteger(index) || index < 0 || index >= CASES.length) throw new RangeError('Position must be 0, 1 or 2');
    const c = CASES[index];
    const contributions = c.outputs.map((output, i) => output.map(v=>v*c.weights[i]/100));
    const routed = contributions.reduce((a,b) => a.map((v,i)=>v+b[i]),[0,0]);
    return {index, position:index+1, word:c.word, ids:c.ids.slice(), weights:c.weights.slice(), outputs:c.outputs.slice(), shared:c.shared, contributions, routed, total:routed.map((v,i)=>v+c.shared[i])};
  }
  const arrow = () => '<span class="mv17-arrow" aria-hidden="true"></span>';
  function moeV17Markup() {
    const s = moeV17State(0);
    return `<section class="mv17-module" id="moe-routing" aria-labelledby="mv17-title">
      <div class="mv17-heading"><span class="mv17-tag">沿用 DeepSeekMoE · 每个位置选择部分专家</span><h3 id="mv17-title">同一层有很多专家，一个位置只调用其中几个</h3><p><strong>MoE</strong> 是 Mixture of Experts，中文常称<strong>混合专家</strong>。一个专家是一套前馈网络；路由器根据当前位置的输入表示，决定这次使用哪些专家。</p></div>
      <figure class="mv17-lab" data-mv17-lab aria-labelledby="mv17-lab-title">
        <figcaption id="mv17-lab-title"><b>观察一层 MoE，切换它正在处理的位置</b><span>三个位置均已给定 · 路由与数字为教学设置</span></figcaption>
        <div class="mv17-controls" role="group" aria-label="选择已经给定的输入位置">${CASES.map((c,i)=>`<button type="button" data-mv17-position="${i}" aria-pressed="${i===0}"><small>位置 ${i+1}</small><b>${c.word}</b></button>`).join('')}</div>
        <div class="mv17-route-row"><div class="mv17-input"><small>本层正在处理</small><b data-mv17-current>位置 1 · 小猫</b><span>该位置的一份输入表示</span></div>${arrow()}<div class="mv17-router"><small>路由器</small><b>给 384 个路由专家打分</b><span>选出本次参与的 6 个</span></div></div>
        <div class="mv17-route-connect"><span>输入送给选中的 6 个专家</span><span>同一份输入也送给共享专家</span></div>
        <div class="mv17-experts">
          <div class="mv17-routed-pool"><div class="mv17-pool-head"><b>384 个路由专家</b><span><strong>6</strong> 个本次参与</span></div>
            <div class="mv17-pool" data-mv17-pool tabindex="0" role="group" aria-label="384 个路由专家，每格一个。蓝色表示本次选中。左右方向键查看专家编号。">${Array.from({length:384},(_,i)=>`<span class="mv17-expert${s.ids.includes(i+1)?' mv17-selected':''}" data-mv17-expert="${i+1}" title="专家 ${i+1}${s.ids.includes(i+1)?' · 本次参与':''}" aria-hidden="true"></span>`).join('')}</div>
            <div class="mv17-pool-caption"><span>每格 = 1 个专家；蓝色 = 本次参与</span><span data-mv17-inspect>悬停或用方向键查看编号</span></div>
            <div class="mv17-selected-ids" aria-label="本次选中的专家编号">${s.ids.map((id,i)=>`<span data-mv17-id="${i}">#${id}</span>`).join('')}</div>
          </div>
          <div class="mv17-shared"><div class="mv17-pool-head"><b>1 个共享专家</b></div><div class="mv17-shared-symbol" aria-hidden="true"><span></span></div><strong>本次也参与</strong><p>每个位置都会经过它。</p><span class="mv17-shared-status">共享专家输出</span></div>
        </div>
        <div class="mv17-merge"><div><b>6 个专家输出按权重相加</b><span>同一专家可被多个位置调用</span></div><strong class="mv17-plus" aria-hidden="true">＋</strong><div><b>共享专家输出</b><span>随输入一起计算</span></div></div>
        <div class="mv17-output"><span class="mv17-output-arrow" aria-hidden="true"></span><div><small>合并结果</small><b>得到这个位置的 MoE 输出</b><span>教学示例的一维结果：<strong data-mv17-preview-total>3.02</strong></span></div></div>
        <p class="mv17-update" data-mv17-update aria-live="polite" aria-atomic="true">位置 1 · 小猫：选中 #12、#57、#103、#188、#241、#366，另加共享专家；共 7 个专家参与。</p>
        <details class="mv17-calculation"><summary>看一次数值合并：六份输出怎样变成一份？</summary><div class="mv17-calculation-body"><p>每位专家输出一条 <strong>5,120 维向量</strong>；方括号展示前两个分量，其余以省略号表示。权重乘整条向量，再逐分量相加；共享专家的向量另行加入。这里设置六个合计为 100% 的教学权重。</p><div class="mv17-contributions">${s.ids.map((id,i)=>`<div data-mv17-contribution="${i}"><b data-mv17-card-id="${i}">专家 #${id}</b><div><span>输出向量</span><strong data-mv17-card-output="${i}">${number(s.outputs[i])}</strong></div><div><span>合并权重</span><strong data-mv17-card-weight="${i}">${s.weights[i]}%</strong></div><div class="mv17-product"><span>相乘后贡献</span><strong data-mv17-card-product="${i}">${number(s.contributions[i])}</strong></div></div>`).join('')}</div><div class="mv17-equation"><div><span>路由专家加权和</span><b data-mv17-routed>${number(s.routed)}</b></div><strong>＋</strong><div><span>共享专家输出向量</span><b data-mv17-shared>${number(s.shared)}</b></div><strong>＝</strong><div class="mv17-final-number"><span>MoE 输出向量</span><b data-mv17-total>${number(s.total)}</b></div></div><p class="mv17-calculation-note">这是可核算的教学算例。真实路由还涉及归一化与缩放等配置；负载均衡的校正偏置用于选择专家，所选专家的输出权重仍取自原始路由分数。</p></div></details>
      </figure>
      <p class="mv17-boundary"><strong>把这一层放回整网：</strong>前 20 层因果编码器与后 20 层解码器都使用 MoE 前馈网络；40 层各自拥有专家和路由器。图中的 384 个路由专家与 1 个共享专家属于其中一层。</p>
      <p class="mv17-source">每个专家编号对应一套前馈网络权重。训练会形成各专家的分工；这里用位置切换展示路由变化。配置依据：DeepSeek-V4.1 报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=8" target="_blank" rel="noopener" title="打开 V4.1 原报告第 8 页">§2.1.1</a>、<a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2.1</a>。</p>
    </section>`;
  }
  function initMoEV17() {
    const doc = root.document;
    if (!doc) return;
    doc.querySelectorAll('[data-mv17-lab]').forEach(lab => {
      if (lab.dataset.mv17Ready === 'true') return;
      lab.dataset.mv17Ready = 'true';
      let active=0, inspected=1;
      const query = selector => lab.querySelector(selector);
      const pool = query('[data-mv17-pool]');
      const setText = (selector, text) => {const node=query(selector); if(node) node.textContent=text;};
      const inspect = id => {
        inspected = Math.min(384,Math.max(1,id));
        lab.querySelectorAll('[data-mv17-expert]').forEach(node=>node.classList.toggle('mv17-inspected',Number(node.dataset.mv17Expert)===inspected));
        setText('[data-mv17-inspect]',`专家 #${inspected} · ${CASES[active].ids.includes(inspected)?'本次参与':'本次未选中'}`);
      };
      const show = index => {
        if (active===index) return;
        active=index;
        const s=moeV17State(index);
        lab.querySelectorAll('[data-mv17-position]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.mv17Position)===index)));
        lab.querySelectorAll('[data-mv17-expert]').forEach(node=>{
          const id=Number(node.dataset.mv17Expert), selected=s.ids.includes(id);
          node.classList.toggle('mv17-selected',selected);
          node.title=`专家 ${id}${selected?' · 本次参与':''}`;
        });
        s.ids.forEach((id,i)=>{
          setText(`[data-mv17-id="${i}"]`,'#'+id);
          setText(`[data-mv17-card-id="${i}"]`,'专家 #'+id);
          setText(`[data-mv17-card-output="${i}"]`,number(s.outputs[i]));
          setText(`[data-mv17-card-weight="${i}"]`,s.weights[i]+'%');
          setText(`[data-mv17-card-product="${i}"]`,number(s.contributions[i]));
        });
        setText('[data-mv17-current]',`位置 ${s.position} · ${s.word}`);
        setText('[data-mv17-routed]',number(s.routed));
        setText('[data-mv17-shared]',number(s.shared));
        setText('[data-mv17-total]',number(s.total));
        setText('[data-mv17-preview-total]',number(s.total));
        setText('[data-mv17-update]',`位置 ${s.position} · ${s.word}：选中 ${s.ids.map(id=>'#'+id).join('、')}，另加共享专家；共 7 个专家参与。`);
        if (pool.dataset.mv17Inspecting==='true') inspect(inspected);
      };
      lab.addEventListener('click',event=>{
        const button=event.target.closest('[data-mv17-position]');
        if (button && lab.contains(button)) show(Number(button.dataset.mv17Position));
      });
      pool.addEventListener('mouseover',event=>{
        const node=event.target.closest('[data-mv17-expert]');
        if (node) {pool.dataset.mv17Inspecting='true';inspect(Number(node.dataset.mv17Expert));}
      });
      pool.addEventListener('focus',()=>{pool.dataset.mv17Inspecting='true';inspect(inspected);});
      pool.addEventListener('keydown',event=>{
        if (event.key==='ArrowRight'||event.key==='ArrowLeft'||event.key==='Home'||event.key==='End') {
          event.preventDefault();
          inspect(event.key==='Home'?1:event.key==='End'?384:inspected+(event.key==='ArrowRight'?1:-1));
        }
      });
      const endInspect = () => {pool.dataset.mv17Inspecting='false';lab.querySelectorAll('.mv17-inspected').forEach(node=>node.classList.remove('mv17-inspected'));setText('[data-mv17-inspect]','悬停或用方向键查看编号');};
      pool.addEventListener('mouseleave',()=>{if(doc.activeElement!==pool) endInspect();});
      pool.addEventListener('blur',endInspect);
    });
  }
  root.moeV17Markup=moeV17Markup;
  root.initMoEV17=initMoEV17;
  root.moeV17State=moeV17State;
})(globalThis);


(function(g){
function lm18Junction(up,half){return '<div class="lm18-junction '+(up?'lm18-join':'lm18-fork')+(half?' lm18-half-junction':'')+'" aria-hidden="true"><i class="lm18-stem"></i><i class="lm18-crossbar"></i><i class="lm18-left-leg"></i><i class="lm18-right-leg"></i></div>'; }
function lm17Down(){return '<span class="lm17-down" aria-hidden="true"></span>';}
function lm17Streams(output){return '<div class="lm17-streams" aria-label="同一个位置的四路残差流">'+[1,2,3,4].map(function(i){return '<span><small>第 '+i+' 路</small><b>'+(output?'x′':'x')+'<sup>('+i+')</sup></b><em>d 个数</em></span>';}).join('')+'</div>';}
function lm17HalfLayer(num,input,op,description,output,color){return '<article class="lm17-half '+color+'"><header><span>'+num+'</span><h4>'+op+'更新</h4></header><div class="lm17-state"><small>当前输入</small><b>'+input+'</b></div>'+lm18Junction(false,true)+'<div class="lm17-half-paths"><div class="lm17-transform-path"><div class="lm17-operation lm17-norm">归一化</div>'+lm17Down()+'<div class="lm17-operation"><strong>'+op+'</strong><small>'+description+'</small></div></div><div class="lm17-keep-path"><span>保留 '+input+'</span><i aria-hidden="true"></i></div></div>'+lm18Junction(true,true)+'<div class="lm17-add"><b>＋</b><span>原表示 + 变换结果</span><strong>'+output+'</strong></div></article>';}
function layersMHCv17Markup(){return `
<div class="lm17-lesson">
  <section class="lm17-section" id="transformer-full-layer">
    <header class="lm17-heading"><span class="lm17-tag">基础连接</span><h3>注意力与 MoE 在完整一层中的位置</h3><p>注意力从可见位置汇总信息；前馈网络继续变换每个位置的表示。在 V4.1 中，MoE 承担前馈网络的工作。</p></header>
    <figure class="lm17-card">
      <figcaption><strong>通用 pre-norm Transformer 层 · 理解连接的教学对照</strong><span>每个子模块前先归一化，再把计算结果加回原表示。图中跟随同一个位置，小写 h、u 表示该位置的向量。</span></figcaption>
      <div class="lm17-layer-pair">
        ${lm17HalfLayer('1','h','注意力','计算 Q/K/V，汇总可见信息','u','lm17-attention')}
        <div class="lm17-between" aria-hidden="true"><span>u</span><i></i></div>
        ${lm17HalfLayer('2','u','前馈网络 / MoE','路由专家，合并专家的输出','h′','lm17-feedforward')}
      </div>
      <div class="lm17-function-notes"><p><b>残差相加：</b>保留原表示，并加回子模块提供的更新。</p><p><b>归一化：</b>稳定输入的数值尺度，便于后续计算。</p></div>
      <p class="lm17-caption">一层输出 h′ 再进入下一层。V4.1 用下面的 mHC（流形约束超连接）组织残差连接，将这一条保留路径扩展为四路，并学习怎样混合它们。</p>
    </figure>
  </section>

  <section class="lm17-section mh23" id="single-pass-mhc"><header class="lm17-heading"><span class="lm17-tag">沿用 mHC · 本代改进 Single-Pass</span><h3>四路表示怎样经过一个子模块？</h3><p><b>mHC（流形约束超连接）让同一个 token 保有四份可分别更新的隐藏表示。</b>这些表示沿深层网络保留、交换信息；每个计算模块可以重新组合它们，获得适合本次计算的输入。受约束的混合帮助维持深层信息传递的稳定。</p></header>
<div class="mh23-definition" id="four-streams-title"><b>从文字 embedding 开始，追踪同一位置的向量</b><p>V4.1 的一个文字 token 查嵌入表，得到 <strong>5,120 维向量 h</strong>。进入主干时，这条向量复制为四路；起点相同，随后各路按学到的连接分别更新。四路让深层网络保留多份中间表示，并在每次注意力和 MoE 计算前重新组合信息。</p><div class="mh24-dimension"><span>文字 embedding<br><b>1 × 5,120</b></span><i>→</i><span>四路残差状态<br><b>4 × 5,120</b></span><i>→</i><span>子模块输入 / 输出<br><b>1 × 5,120</b></span><i>→</i><span>更新后的四路<br><b>4 × 5,120</b></span></div><p>5,120 是语言主干的隐藏宽度 d。注意力与 MoE 的输入、输出以及每路残差保持这个宽度；模块内部的 Q/K/V 投影、专家中间层等使用各自的维度。最后再把四路混成一路，由输出头映射到词表分数。</p></div>

<p class="mh23-lead"><b>注意力和前馈 / MoE 两次更新都使用四路连接。</b>一个完整 Transformer 层依次完成这两个块；其中注意力汇总可见位置的信息，MoE 变换当前位置的表示。</p>
<div class="mh23-symbols"><p><b>X<sub>ℓ</sub></b><span>当前 token 的四行向量组成的状态，形状为 4 × d。</span></p><p><b>ℓ（ell）</b><span>子模块块的顺序编号。ℓ+1 是下一块；“40 层”则数完整语言层。</span></p><p><b>A / B / C</b><span>三种连接职责：A 合成模块输入；B 混合保留路径；C 将模块输出分配回四路。下面是它们各自怎样作用，随后展开矩阵的尺寸和来源。</span></p></div>
<p class="mh23-lead">四条向量经过一个块时：A 决定怎样合成模块输入，B 处理保留路径，C 把模块输出分配回四路。下图分别观察注意力与 MoE 的更新。</p>
<figure class="mh23-lab" data-mh23-lab data-mh23-step="0"><figcaption><b>先看作用：A 混合输入，B 保留并混合原状态，C 分配更新</b><span>每个方括号都是 5,120 维向量；只展示前两个分量，其余以省略号表示。</span></figcaption>
<div class="mh23-controls"><div class="mh24-network-route"><span>四路输入</span><i>→</i><button type="button" data-mh23-module="attention" aria-pressed="true">① 注意力块</button><i>→</i><button type="button" data-mh23-module="moe" aria-pressed="false">② 随后的 MoE 块</button><i>→</i><span>四路进入下一层</span></div><div><button type="button" data-mh23-prev disabled>上一步</button><button type="button" data-mh23-next>下一步</button></div></div>
<div class="mh23-stage" data-mh23-stage aria-live="polite">1 / 4 · 观察当前输入</div><div class="mh23-compare"><div><h4>普通残差 · 一行</h4><svg viewBox="0 0 300 300" role="img" aria-label="普通残差：一行隐藏表示通过子模块计算更新，同时保留原表示，最后相加"><path d="M150 46V62H82V91M150 62H232V120M82 180V236H130M232 160V236H170M150 256V270" class="mh23-wire"/><g class="mh23-state"><rect x="70" y="10" width="160" height="36" rx="6"/><text x="150.0" y="33.0" text-anchor="middle" data-mh23-normal-input>h = [4, 0.6, …]</text></g><g class="mh23-f"><rect x="15" y="91" width="135" height="89" rx="6"/><text x="82.5" y="140.5" text-anchor="middle" data-mh23-normal-f>注意力</text></g><g class="mh23-state"><rect x="185" y="120" width="95" height="40" rx="6"/><text x="232.5" y="145.0" text-anchor="middle" >保留 h</text></g><circle cx="150" cy="236" r="20" class="mh23-sum"/><text x="150" y="242" text-anchor="middle">＋</text><g class="mh23-result"><rect x="70" y="270" width="160" height="28" rx="6"/><text x="150.0" y="289.0" text-anchor="middle" data-mh23-normal-output>等待更新</text></g></svg></div><div><h4>mHC · 同一位置的四行 X<sub>ℓ</sub></h4><svg viewBox="0 0 440 300" role="img" aria-label="四路 mHC：四行输入，经 A 混合送入一个子模块，C 将更新分配回四路；B 混合原有四路，两条路径相加仍得到四路"><path d="M58 46V53H382V46M166 46V53M274 46V53M220 53V59H105V73M220 59H340V101M105 111V125M105 169V181M105 219V239H203M340 160V239H237M220 256V263H58V270M220 263H382V270M166 263V270M274 263V270" class="mh23-wire"/><g class="mh23-state"><rect x="10" y="10" width="96" height="36" rx="6"/><text x="58.0" y="33.0" text-anchor="middle" data-mh23-in="0">[1, 0, …]</text></g><g class="mh23-result"><rect x="10" y="270" width="96" height="28" rx="6"/><text x="58.0" y="289.0" text-anchor="middle" data-mh23-out="0">—</text></g><g class="mh23-state"><rect x="118" y="10" width="96" height="36" rx="6"/><text x="166.0" y="33.0" text-anchor="middle" data-mh23-in="1">[3, 0.4, …]</text></g><g class="mh23-result"><rect x="118" y="270" width="96" height="28" rx="6"/><text x="166.0" y="289.0" text-anchor="middle" data-mh23-out="1">—</text></g><g class="mh23-state"><rect x="226" y="10" width="96" height="36" rx="6"/><text x="274.0" y="33.0" text-anchor="middle" data-mh23-in="2">[5, 0.8, …]</text></g><g class="mh23-result"><rect x="226" y="270" width="96" height="28" rx="6"/><text x="274.0" y="289.0" text-anchor="middle" data-mh23-out="2">—</text></g><g class="mh23-state"><rect x="334" y="10" width="96" height="36" rx="6"/><text x="382.0" y="33.0" text-anchor="middle" data-mh23-in="3">[7, 1.2, …]</text></g><g class="mh23-result"><rect x="334" y="270" width="96" height="28" rx="6"/><text x="382.0" y="289.0" text-anchor="middle" data-mh23-out="3">—</text></g><g class="mh23-a"><rect x="22" y="73" width="166" height="38" rx="6"/><text x="105.0" y="97.0" text-anchor="middle" data-mh23-a>用前一块 A 混合四路</text></g><g class="mh23-f"><rect x="22" y="125" width="166" height="44" rx="6"/><text x="105.0" y="152.0" text-anchor="middle" data-mh23-f>F · 注意力</text></g><g class="mh23-c"><rect x="22" y="181" width="166" height="38" rx="6"/><text x="105.0" y="205.0" text-anchor="middle" data-mh23-c>C · 更新分给 4 路</text></g><g class="mh23-b"><rect x="260" y="101" width="164" height="59" rx="6"/><text x="342.0" y="135.5" text-anchor="middle" >B · 保留并混合 4 路</text></g><circle cx="220" cy="239" r="17" class="mh23-sum"/><text x="220" y="245" text-anchor="middle">＋</text></svg></div></div><p class="mh23-observation" data-mh23-observation aria-live="polite">四路已在前面的计算中产生差异；本例从这个中间状态开始观察。</p><p class="mh23-note">教学向量与系数用于追踪连接：A 取四路平均，B 原样保留，C 把模块输出分别加到四路。F 包含归一化及注意力 / MoE 的内部计算；实际向量和系数由模型计算。</p></figure>
<section class="mh23-advanced"><h4>四路怎样连接相邻的块？</h4><figure class="lm17-card lm17-mhc-lab" data-lm17-lab data-lm17-mode="original">
      <figcaption><strong>对照同一连接：输入混合 A 从哪一个块取得？</strong><span>A 负责送入子模块，B 负责混合保留路径，C 负责把新结果分配回四路。</span></figcaption>
      <div class="lm17-mhc-layout">
        <div class="lm17-stream-diagram">
          <div class="lm17-stream-label"><strong>同一位置的输入 X<sub>ℓ</sub></strong><span>4 路 × 每路 d 维</span></div>
          <div class="lm17-streams" aria-label="同一个位置的四路残差流"><span><small>第 1 路</small><b>x<sup>(1)</sup></b><em>d 个数</em></span><span><small>第 2 路</small><b>x<sup>(2)</sup></b><em>d 个数</em></span><span><small>第 3 路</small><b>x<sup>(3)</sup></b><em>d 个数</em></span><span><small>第 4 路</small><b>x<sup>(4)</sup></b><em>d 个数</em></span></div>
          <div class="lm18-junction lm18-fork" aria-hidden="true"><i class="lm18-stem"></i><i class="lm18-crossbar"></i><i class="lm18-left-leg"></i><i class="lm18-right-leg"></i></div>
          <div class="lm17-mhc-branches">
            <div class="lm17-main-branch">
              <div class="lm17-operation lm17-a-node"><strong><b>A</b> · 输入混合</strong><small>4 路加权组合成 1 路</small><span class="lm17-a-source" data-lm17-a-source>A<sub>ℓ</sub>：来自当前块</span></div>
              <span class="lm17-down" aria-hidden="true"></span>
              <div class="lm17-operation lm17-f-node"><strong>F · 当前子模块</strong><small>注意力或 MoE<br>1 路输入 → 1 路结果</small></div>
              <span class="lm17-down" aria-hidden="true"></span>
              <div class="lm17-operation lm17-c-node"><strong><b>C</b> · 输出分配</strong><small>把 F 的结果分配回 4 路</small></div>
            </div>
            <div class="lm17-b-branch"><div class="lm17-operation lm17-b-node"><strong><b>B</b> · 保留路径混合</strong><small>4 路 → 4 路<br>各路之间也可交换信息</small></div><div class="lm18-b-return"><i aria-hidden="true"></i><span class="lm17-b-caption">保留路径<br>的结果</span></div></div>
          </div>
          <div class="lm18-junction lm18-join" aria-hidden="true"><i class="lm18-stem"></i><i class="lm18-crossbar"></i><i class="lm18-left-leg"></i><i class="lm18-right-leg"></i></div>
          <div class="lm17-merge"><b>＋</b><span>两条路径，按对应的流相加</span></div>
          <div class="lm17-streams" aria-label="同一个位置的四路残差流"><span><small>第 1 路</small><b>x′<sup>(1)</sup></b><em>d 个数</em></span><span><small>第 2 路</small><b>x′<sup>(2)</sup></b><em>d 个数</em></span><span><small>第 3 路</small><b>x′<sup>(3)</sup></b><em>d 个数</em></span><span><small>第 4 路</small><b>x′<sup>(4)</sup></b><em>d 个数</em></span></div>
          <div class="lm17-stream-label lm17-output-label"><strong>更新后的 X<sub>ℓ+1</sub></strong><span>仍然是 4 路</span></div>
        </div>
        <div class="lm17-dependency">
          <h4>Single-Pass 改变 A 的来源</h4>
          <div class="lm17-controls" role="group" aria-label="比较两种 mHC 的输入混合来源"><button type="button" data-lm17-mode-button="original" aria-pressed="true">V4 · 原 mHC</button><button type="button" data-lm17-mode-button="single" aria-pressed="false">V4.1 · Single-Pass mHC</button></div>
          <div class="lm17-origin lm17-previous-origin" data-lm17-origin="previous"><small>前一个块已经产生</small><strong>A<sub>ℓ−1</sub></strong><span data-lm17-previous-status>本模式使用当前块的 A</span></div>
          <div class="lm17-source-line lm17-previous-line" aria-hidden="true"><i></i><span>送入 A · 输入混合</span></div>
          <div class="lm17-origin lm17-current-origin" data-lm17-origin="current"><small>读取当前四路 X<sub>ℓ</sub>，预测系数</small><strong>A<sub>ℓ</sub>、B<sub>ℓ</sub>、C<sub>ℓ</sub></strong><span data-lm17-current-status>等待跨维度汇总完成，A 才可使用</span></div>
          <div class="lm17-source-line lm17-current-line" aria-hidden="true"><i></i><span data-lm17-current-line-label>A 送入当前块</span></div>
          <p class="lm17-mode-explanation" data-lm17-explanation aria-live="polite">当前块先汇总 X<sub>ℓ</sub> 的各个维度，算出 A<sub>ℓ</sub>，再读取 X<sub>ℓ</sub> 做输入混合。这条先后依赖带来额外的读取。</p>
          <p class="lm17-fixed-note">两种模式中的 B<sub>ℓ</sub>、C<sub>ℓ</sub>，都由当前四路状态产生；当前子模块 F 的计算仍然保留。</p>
        </div>
      </div>
      <p class="lm17-caption">ℓ 是当前子模块块的序号；ℓ−1 指前一块。一个完整语言层包含注意力块和 MoE 块。</p>
    </figure><div class="lm17-impact"><strong>Single-Pass 改变的是数据依赖，收益体现在部署时的读写。</strong><p>输入混合直接使用前一块已产生的 A，当前数据块到达后便可立即参与混合，同时累积新的系数。部署内核 <b>Mega-mHC</b> 因而能把残差更新、输入混合、系数预测合在一次遍历中。</p></div></section>
<section class="mh24-coeff mh26-coeff"><h4>再看来源：A、B、C 是怎样算出来的？</h4><p class="mh26-notation">下面的 A<sub>ℓ</sub> 表示第 ℓ 块为当前 token 产生的系数矩阵；ℓ 是块的编号。固定观察一个位置时，省略位置下标。</p><p class="mh26-intro">跟随同一个 token：<strong>本块读取它的四路向量，用训练得到的参数算出三组混合系数。</strong>新 token 带来新的状态，同一套参数据此算出新的系数。</p>
<div class="mh26-sources"><div class="mh26-state"><header><b>输入：当前 token 的四路状态</b><small>随位置与计算进度变化</small></header><div class="mh26-vectors"><span>x₁ = [1, 0, …]</span><span>x₂ = [3, 0.4, …]</span><span>x₃ = [5, 0.8, …]</span><span>x₄ = [7, 1.2, …]</span></div><p>每路 5,120 维 → 拼成 20,480 维 → 归一化</p></div><div class="mh26-parameters"><header><b>本块的模型参数</b><small>训练得到；生成时固定</small></header><p><strong>投影权重 W</strong><br>一个 24 行 × 20,480 列的矩阵</p><p>另有训练得到的缩放和偏置；注意力块与 MoE 块各有自己的一套参数。</p></div></div>
<svg class="mh26-join" viewBox="0 0 1000 28" preserveAspectRatio="none" aria-hidden="true"><path d="M250 0V12H750V0M500 12V25"/><path d="M494 19L500 25L506 19"/></svg>
<div class="mh26-project"><b>线性投影，得到 24 个原始分数</b><span>每个分数来自整条 20,480 维输入与 W 的对应行；再按三组分别缩放、加偏置并施加约束。</span></div>
<div class="mh26-score-groups" aria-label="24 个分数分为 A 的 4 个、B 的 16 个、C 的 4 个"><span>4 个分数 → A</span><span>16 个分数 → B</span><span>4 个分数 → C</span></div>
<div class="mh26-matrices">
<article class="mh26-a"><header><b>A<sub>ℓ</sub> · 输入混合系数</b><small>单个矩阵：1 行 × 4 列</small></header><div class="mh26-matrix mh26-row" role="img" aria-label="A 的一行四个系数"><span>a₁</span><span>a₂</span><span>a₃</span><span>a₄</span></div><p class="mh26-constraint">4 个分数 → sigmoid + 稳定项</p><div class="mh26-use"><b>交给下一块</b><span>四个系数分别乘下一块的四条输入向量，再相加成一条向量。</span></div></article>
<article class="mh26-b"><header><b>B<sub>ℓ</sub> · 保留路径系数</b><small>单个矩阵：4 行 × 4 列</small></header><div class="mh26-matrix mh26-square" role="img" aria-label="B 的四行四列，共十六个系数"><span>b₁₁</span><span>b₁₂</span><span>b₁₃</span><span>b₁₄</span><span>b₂₁</span><span>b₂₂</span><span>b₂₃</span><span>b₂₄</span><span>b₃₁</span><span>b₃₂</span><span>b₃₃</span><span>b₃₄</span><span>b₄₁</span><span>b₄₂</span><span>b₄₃</span><span>b₄₄</span></div><p class="mh26-constraint">16 个分数 → Sinkhorn 行列归一化</p><div class="mh26-use"><b>用于当前块</b><span>每一行组合原来的四条向量；四行分别得到四路保留结果。</span></div></article>
<article class="mh26-c"><header><b>C<sub>ℓ</sub> · 输出分配系数</b><small>单个矩阵：4 行 × 1 列</small></header><div class="mh26-matrix mh26-column" role="img" aria-label="C 的四行一列，共四个系数"><span>c₁</span><span>c₂</span><span>c₃</span><span>c₄</span></div><p class="mh26-constraint">4 个分数 → 2 × sigmoid</p><div class="mh26-use"><b>用于当前块</b><span>四个系数分别缩放本次模块输出，再加回 B 得到的对应路。</span></div></article>
</div>
<div class="mh26-bottom"><p><b>系数与向量怎样区分？</b>a₁ 是一个系数，x₁ 是一条 5,120 维向量。a₁ × x₁ 会缩放向量的每个分量；四项相加的结果仍是 5,120 维向量。</p><p><b>为什么 A 指向下一块？</b>V4.1 的 Single-Pass 连接让本块使用前一块给出的 A；本块新算的 A 继续向后传。B、C 则直接用于本块的四路更新。ℓ 是产生这些系数的子模块编号。</p></div>
<p class="mh23-note">向量数值为教学示例；矩阵中的小写字母标记各个系数。实现依据：<a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/model.py" target="_blank" rel="noopener">系数预测与混合</a>、<a href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/inference/kernel.py" target="_blank" rel="noopener">缩放、偏置与约束</a>。</p></section><details class="lm17-detail"><summary>进一步核对：连接公式与读写量</summary><div class="lm17-detail-body">
      <div class="lm17-equations"><div><small>原 mHC</small><p>X<sub>ℓ+1</sub> = B<sub>ℓ</sub>X<sub>ℓ</sub> + C<sub>ℓ</sub>F<sub>ℓ</sub>(<mark>A<sub>ℓ</sub></mark>X<sub>ℓ</sub>)</p></div><div><small>Single-Pass mHC</small><p>X<sub>ℓ+1</sub> = B<sub>ℓ</sub>X<sub>ℓ</sub> + C<sub>ℓ</sub>F<sub>ℓ</sub>(<mark>A<sub>ℓ−1</sub></mark>X<sub>ℓ</sub>)</p></div></div>
      <p>A 为 1 × 4，B 为 4 × 4，C 为 4 × 1；各系数由预测器根据 token 的状态产生。混合矩阵受到流形约束；具体构造见报告引用的 mHC 论文。上图展示这些矩阵在网络中的连接职责。</p>
      <div class="lm17-traffic-wrap"><table class="lm17-traffic"><thead><tr><th>相关实现</th><th>读写的数据元素数</th></tr></thead><tbody><tr><td>原多核 mHC（含 F 的输入预归一化）</td><td>(4n + 4)d = <b>20d</b></td></tr><tr><td>Mega-mHC 执行普通 mHC</td><td>(3n + 2)d = <b>14d</b></td></tr><tr><td>Mega-mHC 执行 Single-Pass mHC</td><td>(2n + 2)d = <b>10d</b></td></tr></tbody></table></div>
      <p>这里 n = 4，d 是每一路的维数。20d → 10d 衡量上述残差处理与输入预归一化涉及的激活读写量。整模型耗时还包含注意力、MoE、通信等计算；报告在预训练中仍采用多核实现，在部署中使用融合内核。</p>
    </div></details><p class="lm17-source">依据：V4.1 技术报告 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=12" target="_blank" rel="noopener" title="打开 V4.1 原报告第 12 页">§2.4.1</a>，式 (2)–(6)；4 路配置见 <a class="report-ref23" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf#page=21" target="_blank" rel="noopener" title="打开 V4.1 原报告第 21 页">§4.2.1</a>。完整层图为通用 pre-norm 教学结构，V4.1 的残差组织以上述 mHC 图为准。</p></section>
</div>`;}

function initLayersMHCv17(){
  document.querySelectorAll('[data-lm17-lab]').forEach(function(lab){
    if(lab.dataset.lm17Initialized)return;
    lab.dataset.lm17Initialized='true';
    lab.querySelectorAll('[data-lm17-mode-button]').forEach(function(button){button.addEventListener('click',function(){
      var single=button.dataset.lm17ModeButton==='single';
      lab.dataset.lm17Mode=single?'single':'original';
      lab.querySelectorAll('[data-lm17-mode-button]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});
      lab.querySelector('[data-lm17-a-source]').innerHTML=single?'A<sub>ℓ−1</sub>：来自前一个块':'A<sub>ℓ</sub>：来自当前块';
      lab.querySelector('[data-lm17-previous-status]').textContent=single?'系数已经可用，直接参与当前输入混合':'本模式使用当前块的 A';
      lab.querySelector('[data-lm17-current-status]').textContent=single?'当前 A 留给下一块；B、C 用于当前更新':'等待跨维度汇总完成，A 才可使用';
      lab.querySelector('[data-lm17-current-line-label]').textContent=single?'A 送往下一块':'A 送入当前块';
      lab.querySelector('[data-lm17-explanation]').innerHTML=single?'当前输入混合使用已就绪的 A<sub>ℓ−1</sub>。读取 X<sub>ℓ</sub> 的每个数据块时，可同时混合输入并预测新的系数，省去等待当前 A 后再次读取 X<sub>ℓ</sub> 的步骤。':'当前块先汇总 X<sub>ℓ</sub> 的各个维度，算出 A<sub>ℓ</sub>，再读取 X<sub>ℓ</sub> 做输入混合。这条先后依赖带来额外的读取。';
    });});
  });
}

g.layersMHCv17Markup=layersMHCv17Markup;
g.initLayersMHCv17=initLayersMHCv17;
})(globalThis);

'use strict';
initFoundationsV9();initQkvV9();initCedV9();initCsaCacheV9();initDraftV9();initMoEV17();initLayersMHCv17();
function renderBenchmark(i){const n=Math.max(0,Math.min(BENCH_DATA.length-1,i));const d=BENCH_DATA[n],names=['V4-Flash','V4.1-Flash','Opus-5 Max','GPT-5.6 Sol Max'];document.getElementById('bench-metric').textContent=d.metric+' · 0–100 轴';const chart=document.getElementById('benchmark-chart');if(!chart.children.length)chart.innerHTML=names.map((name,j)=>`<div><label>${name}<b data-bench-value="${j}"></b></label><span role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" data-bench-meter="${j}"><i data-bench-bar="${j}" class="${j===1?'highlight':''}"></i></span></div>`).join('');names.forEach((_,j)=>{chart.querySelector(`[data-bench-value="${j}"]`).textContent=d.values[j].toFixed(1);chart.querySelector(`[data-bench-bar="${j}"]`).style.width=d.values[j]+'%';chart.querySelector(`[data-bench-meter="${j}"]`).setAttribute('aria-valuenow',d.values[j])});document.getElementById('benchmark-message').textContent=d.message;document.querySelectorAll('[data-benchmark]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.benchmark)===n))}
document.addEventListener('click',e=>{const b=e.target.closest('[data-benchmark]');if(b)renderBenchmark(Number(b.dataset.benchmark));const a=e.target.closest('[data-mobile-nav]');if(a){const toc=a.closest('details');if(toc)toc.open=false}});
renderBenchmark(0);
if('IntersectionObserver'in window){const obs=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})},{rootMargin:'-5% 0px -75% 0px',threshold:0});document.querySelectorAll('.chapter,.hero').forEach(c=>obs.observe(c))}
let progressQueued=false;function updateProgress(){const span=document.documentElement.scrollHeight-window.innerHeight;document.getElementById('reading-progress').style.width=(span>0?Math.min(100,window.scrollY/span*100):0)+'%';progressQueued=false}window.addEventListener('scroll',()=>{if(!progressQueued){progressQueued=true;requestAnimationFrame(updateProgress)}},{passive:true});window.addEventListener('resize',updateProgress);updateProgress();


(function(root){
  'use strict';
  const lengths=[16384,131072,1048576];
  const fmt=n=>n.toLocaleString('en-US');
  function indexingV19State(n){
    n=Number(n);
    if(!lengths.includes(n)) n=lengths[0];
    const pool=Math.min(n,16384),baseline=5*n,reindex=4*pool,total=n+reindex,ratio=100*total/baseline;
    return {n,pool,baseline,reindex,total,ratio,reindexPercent:100*reindex/baseline};
  }
  function initIndexingV19(){
    const doc=root.document;
    if(!doc)return;
    const lab=doc.querySelector('[data-iv19-root]');
    if(!lab||lab.dataset.iv19Ready==='true')return;
    lab.dataset.iv19Ready='true';
    const buttons=Array.from(lab.querySelectorAll('[data-iv19-length]'));
    const text=(selector,value)=>{const node=lab.querySelector(selector);if(node)node.textContent=value;};
    function render(n){
      const s=indexingV19State(n);
      lab.dataset.iv19Length=String(s.n);
      buttons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.iv19Length)===s.n)));
      text('[data-iv19-current]',fmt(s.n)+' 个位置');
      text('[data-iv19-baseline]',fmt(s.baseline));
      text('[data-iv19-hierarchy]',fmt(s.total));
      text('[data-iv19-baseline-formula]',fmt(s.n)+' + 4 × '+fmt(s.n));
      text('[data-iv19-hierarchy-formula]',fmt(s.n)+' + 4 × '+fmt(s.pool));
      text('[data-iv19-ratio]',Number(s.ratio.toFixed(2))+'%');
      const fill=lab.querySelector('[data-iv19-reindex-fill]');
      if(fill)fill.style.width=s.reindexPercent+'%';
      const baselineBar=lab.querySelector('[data-iv19-baseline-bar]');
      if(baselineBar)baselineBar.setAttribute('aria-label','参考路径：Full '+fmt(s.n)+' 次，加 Reindex '+fmt(4*s.n)+' 次，共 '+fmt(s.baseline)+' 位置·次');
      const hierarchyBar=lab.querySelector('[data-iv19-hierarchy-bar]');
      if(hierarchyBar)hierarchyBar.setAttribute('aria-label','分层索引：Full '+fmt(s.n)+' 次，加 Reindex '+fmt(s.reindex)+' 次，共 '+fmt(s.total)+' 位置·次');
      text('[data-iv19-result]',s.n===16384?'16,384 个可见位置全部放入候选池，两种路径都需 81,920 位置·次。切到更长范围，观察候选池占比。':'Full 仍扫描全部 '+fmt(s.n)+' 个位置；四次 Reindex 合计 '+fmt(s.reindex)+' 次。总量为参考路径的 '+Number(s.ratio.toFixed(2))+'%。绿色段变短表示占比降低，Reindex 的绝对评分数仍为 65,536 次。');
    }
    buttons.forEach((button,index)=>{
      button.addEventListener('click',()=>render(button.dataset.iv19Length));
      button.addEventListener('keydown',event=>{
        let next=index;
        if(event.key==='ArrowRight')next=(index+1)%buttons.length;
        else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=buttons.length-1;
        else return;
        event.preventDefault();buttons[next].focus();render(buttons[next].dataset.iv19Length);
      });
    });
    render(lengths[0]);
  }
  root.indexingV19State=indexingV19State;
  root.initIndexingV19=initIndexingV19;
})(globalThis);

(function(root){
'use strict';
function trainingTaskV19State(scenario,step){
  var repair=scenario==='repair';
  step=Math.max(0,Math.min(2,Math.floor(Number(step)||0)));
  var fixed=repair&&step===2;
  var n=repair&&!fixed?1:2;
  var stages=['1 / 3 · 多个 agent 试做','2 / 3 · 独立验收','3 / 3 · 处理验收结果'];
  var s={scenario:repair?'repair':'ready',step:step,checks:n,revision:fixed?'任务包 v2 · 已补上负数检查':'任务包 v1',defaultCheck:n===1?'当前只检查两个正数相加。':fixed?'新增：add(-2, 3) 应为 1。':'负数检查：add(-2, 3) 应为 1。',scoreA:n+' / '+n+' 通过',scoreB:n===1?'1 / 1 通过':'1 / 2 通过',scoreBFailed:n===2,stage:stages[step],phase:['试做','验收',fixed?'修复 + 复验':'入库'][step],next:['下一步：独立验收',repair?'下一步：补测并复验':'下一步：任务包入库','已完成'][step],tone:'neutral'};
  if(step===0){
    s.title='用两份试做记录检验评分依据。';
    s.body=n===1?'甲、乙都通过唯一的正数检查，得分同为 1 / 1。乙处理负数时的错误没有影响得分。':'甲能处理负数，乙在负数输入上答错。现有验证器给出甲 2 / 2、乙 1 / 2。';
    s.status='接下来独立验收：题目要求与检查是否一致。';
  } else if(step===1&&repair){
    s.title='退回任务包：评分漏掉了负数要求。';
    s.body='−2 加 3 应为 1，乙却返回 5。只测正数会给甲、乙同样好的反馈，后续训练就难以凭此区分这两种行为。';
    s.status='修复对象：验证器；题目、环境和试做程序保持原样。';s.tone='bad';
  } else if(step===1){
    s.title='任务包通过：正确行为得到更好的反馈。';
    s.body='检查覆盖了正数与负数；甲通过两项，乙只通过一项。验收确认这份判分依据能区分本例中的正确与错误行为。';
    s.status='验收通过的是题目、环境和验证器组成的任务包。';s.tone='good';
  } else if(repair){
    s.title='补上负数检查，修复的是判分依据。';
    s.body='复验后甲为 2 / 2，乙为 1 / 2。程序输出保持原样，乙的错误现在会被计入反馈；修好的任务包存入训练任务库。';
    s.status='任务包 v2 可供后续 RL 采样；这一步完成任务验收。';s.tone='good';
  } else {
    s.title='把合格任务包存入训练任务库。';
    s.body='保存题目、运行环境、2 项检查和验收记录。后续模型重新生成程序，再通过这些检查获得训练反馈。';
    s.status='任务包 v1 可供后续 RL 采样；甲、乙继续作为试做证据保留。';s.tone='good';
  }
  return s;
}
function initTrainingTaskV19(){
  var lab=root.document&&root.document.querySelector('[data-tv19-lab]');
  if(!lab||lab.getAttribute('data-tv19-bound')==='true')return;
  lab.setAttribute('data-tv19-bound','true');
  var scenario='ready',step=0;
  function text(selector,value){var node=lab.querySelector(selector);if(node)node.textContent=value;}
  function render(){
    var s=trainingTaskV19State(scenario,step);
    lab.setAttribute('data-tv19-scenario',s.scenario);lab.setAttribute('data-tv19-step',String(s.step));
    lab.querySelectorAll('[data-tv19-case]').forEach(function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-tv19-case')===s.scenario));});
    text('[data-tv21-verifier-label]',s.scenario==='repair'&&s.step===2?'验证器（修复）':'验证器');text('[data-tv19-check-count]',s.checks+' 项检查');text('[data-tv19-default-check]',s.defaultCheck);text('[data-tv19-revision]',s.revision);
    text('[data-tv19-score-a]',s.scoreA);text('[data-tv19-score-b]',s.scoreB);lab.querySelector('[data-tv19-score-b]').setAttribute('data-tv19-test',s.scoreBFailed?'failed':'passed');
    text('[data-tv19-stage]',s.stage);text('[data-tv19-phase]',s.phase);text('[data-tv19-finding-title]',s.title);text('[data-tv19-finding-body]',s.body);text('[data-tv19-status]',s.status);
    lab.querySelector('[data-tv19-tone]').setAttribute('data-tv19-tone',s.tone);
    var prev=lab.querySelector('[data-tv19-prev]'),next=lab.querySelector('[data-tv19-next]');prev.disabled=s.step===0;next.disabled=s.step===2;next.textContent=s.next;
  }
  lab.querySelectorAll('[data-tv19-case]').forEach(function(button){button.addEventListener('click',function(){scenario=button.getAttribute('data-tv19-case');step=0;render();});});
  lab.querySelector('[data-tv19-prev]').addEventListener('click',function(){if(step>0){step--;render();}});
  lab.querySelector('[data-tv19-next]').addEventListener('click',function(){if(step<2){step++;render();}});
  render();
}
root.trainingTaskV19State=trainingTaskV19State;
root.initTrainingTaskV19=initTrainingTaskV19;
})(globalThis);

initIndexingV19();
initTrainingTaskV19();


(function(){
'use strict';
function trainingSignal21State(method,step){
 var k=['sft','rl','opd'].includes(method)?method:'sft';var n=Math.max(0,Math.min(2,step|0));
 var data={
 sft:{contextLabel:'题目 + 参考前缀',context:'实现加法；参考程序已给到 return a',origin:'这段前缀来自参考答案。',signal:['参考答案的下一项是 +','将模型预测与参考目标 + 比较','本次学习目标仍是参考答案中的 +'],detail:['先预测这个位置，再与参考答案比较。','模型给参考 token 的概率越低，这个位置的预测损失越大。','优化器利用一批参考位置的损失梯度，调整模型权重。'],update:'提高参考输出的可能性；以后遇到相近上下文，生成参考行为会更容易。'},
 rl:{contextLabel:'题目 + 学生自行生成的两次尝试',context:'甲：return a + b；乙：先将负数变正再相加',origin:'两份实现是模型尝试的结果，随后交给环境运行。',signal:['准备运行正数与负数检查','甲通过 2 / 2；乙通过 1 / 2','任务结果与长度等反馈构成奖励'],detail:['题目要求 −2 + 3 得到 1；负数检查能区分两份实现。','验证器将执行结果变成可比较的反馈，甲在本例中表现更好。','训练程序汇总一批尝试，利用奖励引导策略更新。'],update:'调整以后生成这些行为的概率，使策略更倾向取得较好奖励的尝试。'},
 opd:{contextLabel:'题目 + 学生自己生成的前缀',context:'学生写到 return a；教师也读取这一前缀',origin:'指导发生在学生实际走到的上下文上。',signal:['等待师生在同一位置给出分布','对 +：学生 40%，教师 80%（教学值）','比较全词表上的师生预测分布'],detail:['教师为学生的下一个预测位置提供分布信号。','其余候选也有各自的概率；下方 OPD 表格列出完整的教学分组。','蒸馏损失衡量师生分布差异，优化器据此更新学生权重。'],update:'让学生预测靠近教师指导；教师分布作为目标，学生的参数在这一步被训练。'}
 }[k];return Object.assign({method:k,step:n,stage:['1 / 3 · 准备本次学习材料','2 / 3 · 得到并比较学习信号','3 / 3 · 用信号更新权重'][n],signalLabel:['学习目标','可比较的反馈','权重更新依据'][n],updated:n===2,signal:data.signal[n],detail:data.detail[n]},data,{signal:data.signal[n],detail:data.detail[n]});
}
function initTrainingSignal21(){
 var lab=document.querySelector('[data-pt21-lab]');if(!lab||lab.dataset.pt21Bound)return;lab.dataset.pt21Bound='true';var method='sft',step=0;
 function render(){var s=trainingSignal21State(method,step);function put(k,v){lab.querySelector('[data-pt21-'+k+']').textContent=v;}
 lab.querySelectorAll('[data-pt21-method]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.pt21Method===method));});
 put('stage',s.stage);put('context-label',s.contextLabel);put('context',s.context);put('origin',s.origin);put('signal-label',s.signalLabel);put('signal',s.signal);put('detail',s.detail);
 put('update-title',s.updated?'优化器更新 → 得到更新后的模型权重':'模型权重：尚未执行这次更新');put('update-body',s.updated?s.update:step===0?'这一步准备学习材料；接下来取得模型预测或实际尝试结果。':'已经取得学习信号；下一步才汇总信号、更新权重。');
 lab.querySelector('[data-pt21-updated]').setAttribute('data-pt21-updated',String(s.updated));lab.querySelector('[data-pt21-prev]').disabled=step===0;lab.querySelector('[data-pt21-next]').disabled=step===2;
 }
 lab.querySelectorAll('[data-pt21-method]').forEach(function(b){b.addEventListener('click',function(){method=b.dataset.pt21Method;step=0;render();});});lab.querySelector('[data-pt21-prev]').addEventListener('click',function(){step=Math.max(0,step-1);render();});lab.querySelector('[data-pt21-next]').addEventListener('click',function(){step=Math.min(2,step+1);render();});render();
}
globalThis.trainingSignal21State=trainingSignal21State;globalThis.initTrainingSignal21=initTrainingSignal21;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTrainingSignal21);else initTrainingSignal21();
})();


(function(){
'use strict';
function imageGrid22(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('尺寸须为正整数');
 function once(w,h){
  if(w*h<295936){var up=Math.sqrt(295936/(w*h));w=Math.trunc(w*up);h=Math.trunc(h*up);}
  var bw=Math.ceil(w/14)*14,bh=Math.ceil(h/14)*14;
  function result(){var rows=Math.ceil(bh/42),cols=Math.ceil(bw/42);return {width:bw,height:bh,rows:rows,cols:cols,tokens:rows*(cols+1)+2};}
  var out=result();if(out.tokens<=1024)return out;
  var ratio=h/w,colsFloat=Math.sqrt(1022/ratio+.25)-.5,rowsFloat=colsFloat*ratio;
  if(colsFloat<1){bw=42;bh=511*42;}
  else if(rowsFloat<1){bh=42;bw=1021*42;}
  else{var scale=Math.min(Math.trunc(colsFloat)*42/w,Math.trunc(rowsFloat)*42/h);bw=Math.trunc(w*scale/14)*14;bh=Math.trunc(h*scale/14)*14;}
  return result();
 }
 var state=once(width,height);
 for(var i=1;i<10;i++){var next=once(state.width,state.height);if(Object.keys(state).every(function(k){return state[k]===next[k];}))return state;state=next;}
 throw new Error('尺寸计算未收敛');
}
function gridDrawing22(cols,rows,opt){
 opt=opt||{};var width=218,height=136,scale=Math.min(width/cols,height/rows),w=cols*scale,h=rows*scale,x=(240-w)/2,y=(158-h)/2;
 function f(v){return Number(v.toFixed(3));}
 var bg=opt.original?'#f7f2e7':'#e8f4ef',stroke=opt.original?'#b79b62':'#72a894';
 var s='<svg viewBox="0 0 240 158" role="img" aria-label="'+(opt.original?'原图长宽比例':rows+' 行、'+cols+' 列的网格')+'"><rect x="'+f(x)+'" y="'+f(y)+'" width="'+f(w)+'" height="'+f(h)+'" fill="'+bg+'" stroke="'+stroke+'"/>';
 if(!opt.original){
  if(opt.padX){s+='<rect x="'+f(x+w-scale*opt.padX)+'" y="'+f(y)+'" width="'+f(scale*opt.padX)+'" height="'+f(h)+'" fill="#d5dce0"/>';}
  if(opt.padY){s+='<rect x="'+f(x)+'" y="'+f(y+h-scale*opt.padY)+'" width="'+f(w)+'" height="'+f(scale*opt.padY)+'" fill="#d5dce0"/>';}
  function lines(step,color,sw){var d='';for(var c=step;c<cols;c+=step)d+='M'+f(x+c*scale)+' '+f(y)+'v'+f(h);for(var r=step;r<rows;r+=step)d+='M'+f(x)+' '+f(y+r*scale)+'h'+f(w);return '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'"/>';}

  var stride=opt.patches?3:1;
  if(opt.patches&&scale>=1.2)s+=lines(1,'#c3ddd2',.5);
  if(scale*stride>=.7)s+=lines(stride,'#76a994',.9);
 }
 if(opt.original&&w>90&&h>28)s+='<text x="120" y="83" text-anchor="middle" fill="#8e7547" font-size="13">同一张图片</text>';
 return s+'</svg>';
}
function engramLookup22(order,head){
 var n=[2,3,4].includes(order)?order:2,j=Math.max(1,Math.min(8,head|0)),words=['小猫','趴在','窗边','睡觉'].slice(4-n),ids=[5,11,17,29].slice(4-n);
 var prime=[101,103,107,109,113,127,131,137][j-1],address=ids.reduce(function(a,b){return (a*(j+2)+b)%prime;},n*7);
 var sub=function(v){return String(v).replace(/[0-9]/g,function(c){return '₀₁₂₃₄₅₆₇₈₉'[Number(c)];});},tag=sub(n)+','+sub(j),a=((address%9)-4)/10,b=(((address+j)%11)-5)/10;
 return {order:n,head:j,title:n+' 个 token · 第 '+j+' 个哈希头',sequence:words.join(' · ')+' → ['+ids.join(', ')+']',hash:'示例 Hash'+tag+'(['+ids.join(', ')+']) → 地址 '+address,vector:'T'+tag+'['+address+'] = ['+a.toFixed(1)+', '+b.toFixed(1)+', …] · 共 256 个分量'};
}
function initGuide22(){
 var lab=document.querySelector('[data-px22-lab]');
 if(lab&&!lab.dataset.px22Bound){lab.dataset.px22Bound='true';var wi=lab.querySelector('[data-px22-width]'),hi=lab.querySelector('[data-px22-height]');
 function put(k,v){lab.querySelector('[data-px22-'+k+']').textContent=v;}
 function renderImage(){var w=Number(wi.value),h=Number(hi.value),error=lab.querySelector('[data-px22-error]');
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8192||h>8192){error.hidden=false;error.textContent='请输入 1–8,192 之间的整数像素尺寸。';lab.setAttribute('data-px22-invalid','true');put('total','等待有效尺寸');return;}
  error.hidden=true;lab.setAttribute('data-px22-invalid','false');var g=imageGrid22(w,h),pw=g.width/14,ph=g.height/14,fmt=function(v){return v.toLocaleString('en-US');};
  put('total',fmt(g.tokens)+' token');put('resize',fmt(w)+' × '+fmt(h)+' → '+fmt(g.width)+' × '+fmt(g.height)+' px');
  put('action',(w*h<295936?'小图放大后对齐网格':(g.width<w||g.height<h)?'按 token 上限缩小并对齐网格':'对齐到 14 像素网格')+'；patch 大小保持 14 × 14。');
  put('patch-count',ph+' 行 × '+pw+' 列 = '+fmt(ph*pw)+' 个 patch');
  put('embedding-count',g.rows+' 行 × '+g.cols+' 列 = '+fmt(g.rows*g.cols)+' 个视觉内容 token');
  put('equation',g.rows+' × '+g.cols+' + '+g.rows+' + 2 = '+fmt(g.tokens)+' token');
  put('components','视觉内容 '+fmt(g.rows*g.cols)+' + 行末标记 '+g.rows+' + 图片起止标记 2'+((pw%3||ph%3)?'；特征网格边缘补齐到 3 的倍数。':'；当前特征网格可整齐分成 3 × 3 组。'));
  lab.querySelector('[data-px22-original]').innerHTML=gridDrawing22(w,h,{original:true});
  lab.querySelector('[data-px22-patches]').innerHTML=gridDrawing22(g.cols*3,g.rows*3,{patches:true,padX:g.cols*3-pw,padY:g.rows*3-ph});
  lab.querySelector('[data-px22-embeddings]').innerHTML=gridDrawing22(g.cols,g.rows,{});
  lab.querySelectorAll('[data-px22-preset]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.px22Preset===w+','+h));});
 }
 wi.addEventListener('input',renderImage);hi.addEventListener('input',renderImage);lab.querySelectorAll('[data-px22-preset]').forEach(function(b){b.addEventListener('click',function(){var a=b.dataset.px22Preset.split(',');wi.value=a[0];hi.value=a[1];renderImage();});});renderImage();
 }
 var eg=document.querySelector('[data-eg22-lab]');if(eg&&!eg.dataset.eg22Bound){eg.dataset.eg22Bound='true';
 function renderHead(n,j){var state=engramLookup22(n,j);eg.querySelectorAll('[data-eg29-token]').forEach(function(token){var used=Number(token.dataset.eg29Token)>=4-state.order;token.classList.toggle('eg29-used',used);token.setAttribute('aria-label',token.textContent+(used?'：属于当前查看的片段':'：在当前查看的片段之外'));});['title','sequence','hash','vector'].forEach(function(k){eg.querySelector('[data-eg22-'+k+']').textContent=state[k];});eg.querySelectorAll('[data-eg22-head]').forEach(function(b){b.setAttribute('aria-pressed',String(Number(b.dataset.eg22Order)===n&&Number(b.dataset.eg22Head)===j));});}
 eg.querySelectorAll('[data-eg22-head]').forEach(function(b){['mouseenter','focus','click'].forEach(function(eventName){b.addEventListener(eventName,function(){renderHead(Number(b.dataset.eg22Order),Number(b.dataset.eg22Head));});});});renderHead(2,1);
 }
 document.querySelectorAll('[data-v22-reveal]').forEach(function(a){if(a.dataset.v22Bound)return;a.dataset.v22Bound='true';a.addEventListener('click',function(){var target=document.getElementById(a.getAttribute('href').slice(1));if(target&&target.tagName==='DETAILS')target.open=true;});});
}
globalThis.imageGrid22=imageGrid22;globalThis.gridDrawing22=gridDrawing22;globalThis.engramLookup22=engramLookup22;globalThis.initGuide22=initGuide22;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initGuide22);else initGuide22();
})();

(function(root){
'use strict';
function scaleWork33(d, mode){
 const map=d.querySelector('.cv12-combined-map'),axis=d.querySelector('.cv12-layer-axis'),history=d.querySelector('.cv12-history-cells');
 const area=map.clientWidth-axis.getBoundingClientRect().width;
 if(area<=0)return;
 const gap=parseFloat(getComputedStyle(history).columnGap)||0;
 const tail=mode==='new'?area/3:(area-11*gap)/12;
 d.style.setProperty('--gw33-tail-width',`${tail}px`);
 d.style.setProperty('--gw33-future-width',`${mode==='new'?6*6:0}px`);
}
function alignWorkTail27(d, added, token){
 const cell=d.querySelector('[data-cv12-history="'+d.dataset.workKind+'-40-11"]'),range=d.querySelector('.cv12-new-range');
 if(!cell||!range)return;
 const box=cell.getBoundingClientRect(),label=range.getBoundingClientRect(),map=d.querySelector('.cv12-combined-map').getBoundingClientRect(),history=d.querySelector('.cv12-history-cells').getBoundingClientRect();
 if(!box.width||!label.width)return;
 const unit=6,start=box.left+added*unit,end=start+box.width;
 d.style.setProperty('--gw33-unit',`${unit}px`);
 d.style.setProperty('--gw26-current',`${token*unit}px`);
 d.style.setProperty('--gw33-window-left',`${start-map.left}px`);
 d.style.setProperty('--gw33-window-top',`${history.top-map.top}px`);
 d.style.setProperty('--gw33-window-height',`${history.height}px`);
 d.style.setProperty('--gw33-window-width',`${box.width}px`);
 const left=Math.max(0,start-label.left),width=box.width,right=Math.max(0,label.right-end);
 range.setAttribute('style',`--gw27-tail-left:${left}px;--gw27-tail-width:${width}px;--gw27-tail-right:${right}px`);
 return {left,width,right};
}
root.alignWorkTail27=alignWorkTail27;
function initGuide23(){
 document.querySelectorAll('[data-mh23-lab]').forEach(lab=>{
  if(lab.dataset.ready23)return;lab.dataset.ready23='true';let mode='attention',step=0;
  const put=(sel,value)=>{lab.querySelector(sel).textContent=value;};
  function render(){
   const isMoe=mode==='moe',name=isMoe?'MoE':'注意力',base=[[1,0],[3,.4],[5,.8],[7,1.2]],add=(a,b)=>a.map((x,i)=>+(x+b[i]).toFixed(2));
   const v=base.map(x=>isMoe?add(x,[2,.2]):x),h=isMoe?[6,.8]:[4,.6],delta=isMoe?[1,-.1]:[2,.2],vec=v=>'['+v.map(n=>String(n)).join(', ')+', …]';
   lab.dataset.mh23Step=String(step);
   lab.querySelectorAll('[data-mh23-module]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mh23Module===mode)));
   lab.querySelector('[data-mh23-prev]').disabled=mode==='attention'&&step===0;lab.querySelector('[data-mh23-next]').disabled=mode==='moe'&&step===3;
   put('[data-mh23-next]',mode==='attention'&&step===3?'进入 MoE 块 →':mode==='moe'&&step===3?'本层演示完成':'下一步');
   put('[data-mh23-prev]',mode==='moe'&&step===0?'← 返回注意力块':'上一步');
   put('[data-mh23-stage]',`${name}块 · ${step+1} / 4 · ${['观察当前向量','A 混合四条向量，送入 F','F 得到本次更新向量','B 保留原状态，C 分配更新，逐路相加'][step]}`);
   put('[data-mh23-normal-input]',`${isMoe?'u':'h'} = ${vec(h)}`);
   put('[data-mh23-normal-f]',step>=2?`返回 ${vec(delta)}`:`F · ${name}`);
   put('[data-mh23-normal-output]',step===3?vec(add(h,delta)):'等待更新');
   v.forEach((n,i)=>{put(`[data-mh23-in="${i}"]`,vec(n));put(`[data-mh23-out="${i}"]`,step===3?vec(add(n,delta)):'—');});
   put('[data-mh23-a]',step>=1?`混合结果 ${vec(h)}`:'用前一块 A 混合四路');
   put('[data-mh23-f]',step>=2?`F → ${vec(delta)}`:`F · ${name}`);
   put('[data-mh23-c]',step===3?'C · 各路加入更新向量':'C · 将结果分给四路');
   const intro=isMoe?'这个 MoE 块接续注意力块的四路输出；每条向量仍有 5,120 个分量。':'从计算中的一个位置观察：四路已形成不同向量。上排依次为第 1–4 路，下排是它们各自的更新结果。';
   put('[data-mh23-observation]',[intro,`本例使用前一块产生的 A = [¼, ¼, ¼, ¼]：单个矩阵，1 行 4 列。逐项平均四条向量，混合结果为 ${vec(h)}；原来的四条向量同时沿 B 保留。`,`${name} 接收一路 5,120 维输入，返回同宽度的更新 ${vec(delta)}。`, `本例 B 为单位矩阵，C 的四项均为 1：给每条原向量逐项加上 ${vec(delta)}，结果仍是四条 5,120 维向量。`][step]);
  }
  lab.querySelectorAll('[data-mh23-module]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mh23Module;step=0;render();}));
  lab.querySelector('[data-mh23-prev]').addEventListener('click',()=>{if(step===0&&mode==='moe'){mode='attention';step=3;}else{step=Math.max(0,step-1);}render();});
  lab.querySelector('[data-mh23-next]').addEventListener('click',()=>{if(step===3&&mode==='attention'){mode='moe';step=0;}else{step=Math.min(3,step+1);}render();});render();
 });
 const host=document.getElementById('ced9-work');
 if(host&&!host.dataset.gw23Ready){
  host.dataset.gw23Ready='true';const words=['小猫','正在','窗边','安静','地','睡觉'];let mode='prompt',prefill=0,token=0,layer=0,playing=false,timer=null,beltKey='',zooming=false,scaleTimer=null;
  const play=host.querySelector('[data-gw23-play]'),next=host.querySelector('[data-gw23-next]'),reset=host.querySelector('[data-gw23-reset]'),status=host.querySelector('[data-gw23-status]'),belt=host.querySelector('[data-gw23-belt]');
  const diagrams=Array.from(host.querySelectorAll('[data-work-kind]')).map(d=>({d,kind:d.dataset.workKind,dots:Array.from(d.querySelectorAll('.cv12-new-dot')),range:d.querySelector('.cv12-new-range'),history:Array.from(d.querySelectorAll('[data-cv12-history]')).map(n=>({n,layer:+n.dataset.cv12History.split('-')[1],col:+n.dataset.cv12History.split('-')[2]})),grown:Array.from(d.querySelectorAll('[data-gw24-grown]'))}));
  const key=document.getElementById('cv9-work-key'),result=document.getElementById('cv9-work-result');
  function stop(){playing=false;if(timer!==null){clearTimeout(timer);timer=null;}}
   function cancelScale(){if(scaleTimer!==null){clearTimeout(scaleTimer);scaleTimer=null;}zooming=false;}
   function enterGeneration(){
    const needsScale=mode!=='new';stop();cancelScale();mode='new';token=0;layer=0;
    zooming=needsScale&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    render();
    if(zooming)scaleTimer=setTimeout(()=>{scaleTimer=null;zooming=false;render();},720);
   }
   function done(){return mode==='prompt'?prefill===40:token===words.length-1&&layer===40;}
  function render(){
   play.textContent=zooming?'调整尺度中':done()?(mode==='prompt'?'输入准备完成':'生成演示完成'):playing?'暂停':mode==='prompt'?(prefill>0&&prefill<40?'继续输入准备':'播放输入准备'):(token>0||layer>0?'继续生成':'播放生成');play.disabled=zooming||done();reset.disabled=zooming;play.setAttribute('aria-pressed',String(playing));next.disabled=zooming||mode==='new'&&done();next.textContent=zooming?'放大后开始':mode==='new'&&done()?'本段演示结束':mode==='prompt'&&prefill===40?'选出首项，进入生成':mode==='new'&&layer===40?'选出下一项，加入前缀':'前进 10 层';
   host.querySelectorAll('[data-cv9-work]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.cv9Work===mode));b.disabled=b.dataset.cv9Work==='new'&&(prefill<40||zooming);});
   const inc=mode==='prompt'?0:token*40+layer,position=mode==='prompt'||zooming?1536:1537+token;
   const added=mode==='new'&&!zooming?token+1:0,tailStart=position-127,fmt=n=>n.toLocaleString('en-US');
   diagrams.forEach(({d,kind,dots,range,history,grown})=>{
    const prior=kind==='baseline'?1536*prefill:1536*Math.min(20,prefill)+128*Math.max(0,prefill-20);d.dataset.workMode=mode;scaleWork33(d,mode);
    history.forEach(({n,layer:l,col})=>{const needed=kind==='baseline'||l<=20||col===11;n.classList.toggle('gw26-window-cell',col===11);n.classList.toggle('cv12-prepared',needed&&l<=prefill);n.classList.toggle('gw24-pending',needed&&l>prefill);n.classList.toggle('gw24-preparing',mode==='prompt'&&l===prefill&&needed&&prefill<40);});
    dots.forEach((dot,i)=>{dot.classList.toggle('cv12-dot-active',mode==='new'&&i<layer);dot.classList.toggle('cv12-dot-current',mode==='new'&&i===layer-1&&layer<40);dot.classList.toggle('gw26-dot-done',mode==='new'&&layer===40);});
    grown.forEach(n=>n.classList.toggle('gw24-grown-active',mode==='new'&&Number(n.dataset.gw24Grown)<token));
    d.querySelector('.cv12-new-dots').setAttribute('aria-label',mode==='prompt'?'回答尚未开始':`位置 ${position}：已通过 ${layer} / 40 层`);
    range.textContent=`当前尾段 ${fmt(tailStart)}–${fmt(position)} · 128 个位置`;
    d.querySelector('.gw24-grown-range').textContent=added?`新增 1,537${token?'–'+fmt(position):''} · ${added} 个`:'回答尚未开始';
    d.querySelector('[data-gw32-preparation]').textContent=prefill===40?'输入准备 · 已完成':prefill===0?'输入准备 · 待开始':'输入准备 · 进行中';d.querySelector('[data-gw24-prior]').textContent=prior.toLocaleString('en-US');d.querySelector('[data-cv12-increment]').textContent=String(inc);
    d.querySelector('[data-cv12-total]').textContent=(prior+inc).toLocaleString('en-US');
    d.querySelector('[data-cv12-formula]').textContent=mode==='prompt'?`；已准备至第 ${prefill} 层`:`；新增：${token} × 40 + ${layer}`;
    alignWorkTail27(d,added,token);
   });
   const stamp=mode+'-'+zooming+'-'+token+'-'+(layer===40);
   if(stamp!==beltKey){beltKey=stamp;belt.innerHTML='<div class="gw24-prefix"><b>已知前缀：位置 1–'+position.toLocaleString('en-US')+'</b><div class="gw26-token-run"><span>最初输入 1–1,536</span>'+ (added?words.slice(0,added).map((w,i)=>`<span class="gw24-token" data-state="${i<token||layer===40?'done':'current'}">${1537+i} · ${w}</span>`).join(''):'')+'</div></div>';const run=belt.querySelector('.gw26-token-run');if(run)run.scrollLeft=run.scrollWidth;}
    if(zooming){
     status.textContent='放大尾窗 · 128 个位置';
     key.textContent='先调整横向尺度：较早的 1,408 个位置压缩显示，末尾 128 个位置占绘图区的三分之一。';
     result.innerHTML='<strong>先放大尾窗，再加入第一个新 token。</strong><p>放大完成后，用加宽的金色点观察新增 token；蓝色保留原始输入的已完成计算。</p>';return;
    }
    if(mode==='prompt'){
     status.textContent=`准备进度 · ${prefill} / 40 层`;
    key.textContent=prefill===0?'从第 1 层开始：两种路径先处理完整的 1,536 个已知位置。':prefill<20?`正在准备第 ${prefill} 层；两种路径都处理全部 1,536 个输入位置。`:prefill===20?'前 20 层完成。CED 可从 H₂₀ 构建后半段主 K/V，随后只重放末尾 128 个位置。':prefill<40?`第 ${prefill} 层：普通路径继续处理全部输入；CED 只处理末尾 128 个位置，准备局部状态。`:'输入准备完成；末尾状态给出首个回答 token 的候选分布。';
    result.innerHTML='<strong>输入准备：前 20 层处理全部输入；CED 后 20 层只重放尾段。</strong><p>蓝格随计算推进点亮；CED 灰格对应位置的主 K/V 由 H₂₀ 投影得到。</p>';return;
   }
   status.textContent=`位置 ${position.toLocaleString('en-US')} · ${layer} / 40 层`;
   key.textContent=layer===0?`“${words[token]}”从上一轮候选中选出，立刻加入前缀右端。现在前缀长 ${position.toLocaleString('en-US')}；开始计算这个位置。`:layer<40?`“${words[token]}”已通过第 ${layer} 层。之前生成的 token 留在右侧，显示为淡金色点；深金色表示当前 token。`:`位置 ${position.toLocaleString('en-US')} 完成全部 40 层；它的 K/V 将作为下一轮的历史，末尾状态用于预测下一项。`;
   result.innerHTML=`<strong>前缀已增长到 ${position.toLocaleString('en-US')} 个 token；两条路径累计新增 ${inc} token·层。</strong><p>当前尾段包含 <b>${128-added} 个原输入位置 + ${added} 个新增位置</b>，共 128 个位置。蓝色历史保留，先前生成的点转为淡金色；点与位移已放大显示，范围以编号为准。</p>`;
  }
   function advance(amount=1){
    if(zooming)return;
   if(mode==='prompt'){if(prefill<40)prefill=Math.min(40,prefill+amount);else{enterGeneration();return;}}else{if(done())return;if(layer===40){token++;layer=0;}else layer=Math.min(40,layer+amount);}render();
  }
  function tick(){if(!playing)return;advance();if(done()){stop();render();return;}timer=setTimeout(tick,mode==='new'&&(layer===40||layer===0)?230:42);}
  play.addEventListener('click',()=>{if(playing){stop();render();}else if(!zooming&&!done()){playing=true;render();timer=setTimeout(tick,55);}});
  next.addEventListener('click',()=>{stop();advance(10);});
  reset.addEventListener('click',()=>{stop();if(mode==='prompt')prefill=0;token=0;layer=0;render();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();render();}});
  root.workAnimation23={setMode(m){stop();if(m==='new'){if(prefill<40){render();return;}enterGeneration();return;}cancelScale();mode='prompt';prefill=0;token=0;layer=0;render();}};
  const realign=()=>diagrams.forEach(({d})=>{scaleWork33(d,mode);alignWorkTail27(d,mode==='new'&&!zooming?token+1:0,token);});
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(realign);diagrams.forEach(({d})=>{observer.observe(d);observer.observe(d.querySelector('.cv12-history-cells'));observer.observe(d.querySelector('[data-cv12-history="'+d.dataset.workKind+'-40-11"]'));});}
  if(typeof root.addEventListener==='function')root.addEventListener('resize',realign);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(realign);
  render();
 }
}
root.initGuide23=initGuide23;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initGuide23);else initGuide23();
})(globalThis);



(function(){
 const entries=[{"key":"generation","title":"逐 token 生成","group":"生成与注意力","target":"#generation-rounds","featured":true,"anchor":"generation-rounds","chapter":"c1","disclosure":false},{"key":"inside","title":"一次生成的内部路径","group":"生成与注意力","target":"#generation-inside","featured":false,"anchor":"generation-inside","chapter":"c1","disclosure":false},{"key":"embedding","title":"文字如何变成向量","group":"生成与注意力","target":"#embedding","featured":false,"anchor":"embedding","chapter":"c2","disclosure":false},{"key":"causality","title":"因果遮罩与可见位置","group":"生成与注意力","target":"#causality","featured":false,"anchor":"causality","chapter":"c2","disclosure":false},{"key":"qkv","title":"Q / K / V 完整路径","group":"生成与注意力","target":"#qv15-overview","featured":true,"anchor":"qv15-overview","chapter":"c3","disclosure":false},{"key":"qkv-math","title":"Q / K / V 数值算例","group":"生成与注意力","target":"#qv9-step-1","featured":false,"anchor":"qv9-step-1","chapter":"c3","disclosure":false},{"key":"heads","title":"多个注意力头怎样合并","group":"生成与注意力","target":".qv10-heads","featured":false,"anchor":"viz-heads","chapter":"c3","disclosure":false},{"key":"kv","title":"生成时复用 K / V","group":"生成与注意力","target":".qv9-cache-section","featured":false,"anchor":"viz-kv","chapter":"c3","disclosure":false},{"key":"prefill","title":"Prefill：一起读入已知位置","group":"生成与注意力","target":"#phase-sequence","featured":false,"anchor":"phase-sequence","chapter":"c4","disclosure":false},{"key":"decode","title":"读入、生成与后续轮次","group":"生成与注意力","target":"#phase-decode","featured":false,"anchor":"phase-decode","chapter":"c4","disclosure":false},{"key":"lineage","title":"前代到 V4.1 的技术脉络","group":"CED 与 KV 来源","target":"#lineage","featured":false,"anchor":"lineage","chapter":"c5","disclosure":false},{"key":"innovation","title":"本代主要改动地图","group":"CED 与 KV 来源","target":"#innovation-map","featured":false,"anchor":"innovation-map","chapter":"c5","disclosure":false},{"key":"architectures","title":"两种经典架构对照","group":"CED 与 KV 来源","target":"#ced9-names","featured":false,"anchor":"ced9-names","chapter":"c6","disclosure":false},{"key":"ced-layers","title":"CED 的 40 层分工","group":"CED 与 KV 来源","target":"#ced9-change","featured":false,"anchor":"ced9-change","chapter":"c6","disclosure":false},{"key":"ced-wiring","title":"CED 的数学连接","group":"CED 与 KV 来源","target":"#ced-mathematical-connection","featured":false,"anchor":"ced-mathematical-connection","chapter":"c6","disclosure":true},{"key":"kv-create","title":"从 H₂₀ 建立主 K / V","group":"CED 与 KV 来源","target":"#ced9-create-read","featured":false,"anchor":"ced9-create-read","chapter":"c6","disclosure":false},{"key":"kv-read","title":"后半段怎样读取 K / V","group":"CED 与 KV 来源","target":"#cv9-reader","featured":false,"anchor":"cv9-reader","chapter":"c6","disclosure":false},{"key":"indexer","title":"索引器怎样筛选历史","group":"CSA² 跨层共享","target":".cv13-indexer","featured":false,"anchor":"viz-indexer","chapter":"c6","disclosure":true},{"key":"ced","title":"长输入与滑动尾窗","group":"CED 与 KV 来源","target":"#ced9-work","featured":true,"anchor":"ced9-work","chapter":"c6","disclosure":false},{"key":"csa-objects","title":"缓存条目与条目编号","group":"CSA² 跨层共享","target":"#csa-objects","featured":false,"anchor":"csa-objects","chapter":"c7","disclosure":false},{"key":"csa-modes","title":"Full / Reindex / Reuse","group":"CSA² 跨层共享","target":"#csa-modes","featured":true,"anchor":"csa-modes","chapter":"c7","disclosure":false},{"key":"csa-layers","title":"40 层的实际共享配置","group":"CSA² 跨层共享","target":"#csa-real-config","featured":false,"anchor":"csa-real-config","chapter":"c7","disclosure":false},{"key":"candidates","title":"从全局历史到候选池","group":"CSA² 跨层共享","target":"#csa-candidates","featured":false,"anchor":"csa-candidates","chapter":"c7","disclosure":false},{"key":"workload","title":"上下文长度与索引工作量","group":"CSA² 跨层共享","target":"#indexing-work-count","featured":false,"anchor":"indexing-work-count","chapter":"c7","disclosure":true},{"key":"cache-size","title":"压缩、量化与缓存大小","group":"缓存与生成加速","target":"#cache-size","featured":false,"anchor":"cache-size","chapter":"c8","disclosure":false},{"key":"compression","title":"新增位置怎样凑成一组","group":"缓存与生成加速","target":".scv15-tail","featured":false,"anchor":"viz-compression","chapter":"c8","disclosure":false},{"key":"bits","title":"FP8 与 FP4 位数对比","group":"缓存与生成加速","target":".scv9-bit-compare","featured":false,"anchor":"viz-bits","chapter":"c8","disclosure":false},{"key":"global-cache","title":"全局 KV 缩小到多少","group":"缓存与生成加速","target":".scv9-capacity-result","featured":false,"anchor":"viz-global-cache","chapter":"c8","disclosure":false},{"key":"lifetime","title":"全局与局部缓存的寿命","group":"缓存与生成加速","target":"#cache-lifetime","featured":false,"anchor":"cache-lifetime","chapter":"c8","disclosure":false},{"key":"storage","title":"SSD、DRAM 与 GPU 缓存","group":"缓存与生成加速","target":"#cache-storage-tiers","featured":false,"anchor":"cache-storage-tiers","chapter":"c8","disclosure":false},{"key":"persist","title":"持久缓存的占用对比","group":"缓存与生成加速","target":".scv9-persist","featured":false,"anchor":"viz-persist","chapter":"c8","disclosure":false},{"key":"pricing","title":"缓存命中价格与算例","group":"缓存与生成加速","target":"#cache-hit-pricing","featured":false,"anchor":"cache-hit-pricing","chapter":"c8","disclosure":false},{"key":"approximation","title":"为什么尾窗恢复是近似的","group":"缓存与生成加速","target":".re15-detail-body","featured":false,"anchor":"viz-approximation","chapter":"c8","disclosure":true},{"key":"dspark","title":"DSpark：草稿、验证、采用","group":"缓存与生成加速","target":".dv9-process","featured":true,"anchor":"viz-dspark","chapter":"c9","disclosure":false},{"key":"active","title":"总参数与激活参数","group":"完整网络与参数","target":"#active-parameters","featured":false,"anchor":"active-parameters","chapter":"c10","disclosure":false},{"key":"moe","title":"MoE：路由与专家加权","group":"完整网络与参数","target":"#moe-routing","featured":true,"anchor":"moe-routing","chapter":"c10","disclosure":false},{"key":"transformer","title":"完整 Transformer 层","group":"完整网络与参数","target":"#transformer-full-layer","featured":false,"anchor":"transformer-full-layer","chapter":"c10","disclosure":false},{"key":"mhc","title":"四路 mHC：逐步混合与更新","group":"完整网络与参数","target":"[data-mh23-lab]","featured":true,"anchor":"viz-mhc","chapter":"c10","disclosure":false},{"key":"mhc-source","title":"相邻块的输入混合从哪来","group":"完整网络与参数","target":"[data-lm17-lab]","featured":false,"anchor":"viz-mhc-source","chapter":"c10","disclosure":false},{"key":"mhc-matrices","title":"A、B、C 系数怎样得到","group":"完整网络与参数","target":".mh26-coeff","featured":false,"anchor":"viz-mhc-matrices","chapter":"c10","disclosure":false},{"key":"parameters","title":"主干与 Engram 参数组成","group":"完整网络与参数","target":"#parameter-scale","featured":false,"anchor":"parameter-scale","chapter":"c10","disclosure":false},{"key":"vision","title":"文字与图片进入同一网络","group":"图文与 Engram","target":"#vision-and-causal-encoders","featured":true,"anchor":"vision-and-causal-encoders","chapter":"c10","disclosure":false},{"key":"image-tokens","title":"图片尺寸与 token 计算器","group":"图文与 Engram","target":"#image-token-calculator","featured":false,"anchor":"image-token-calculator","chapter":"c10","disclosure":false},{"key":"neighborhood","title":"九邻域拼接与 MLP","group":"图文与 Engram","target":"#vision-aligner-detail","featured":false,"anchor":"vision-aligner-detail","chapter":"c10","disclosure":false},{"key":"image-attention","title":"图内与序列的可见范围","group":"图文与 Engram","target":".vi21-mask-pair","featured":false,"anchor":"viz-image-attention","chapter":"c10","disclosure":true},{"key":"engram-location","title":"Engram 在网络中的位置","group":"图文与 Engram","target":"#engram-location","featured":false,"anchor":"engram-location","chapter":"c10","disclosure":false},{"key":"engram","title":"Engram：24 个哈希头查表","group":"图文与 Engram","target":"[data-eg22-lab]","featured":true,"anchor":"viz-engram","chapter":"c10","disclosure":false},{"key":"engram-projection","title":"记忆投影与四路门控","group":"图文与 Engram","target":".eg22-dims","featured":false,"anchor":"viz-engram-projection","chapter":"c10","disclosure":false},{"key":"training","title":"预训练与后训练的衔接","group":"训练与推理","target":"#training","featured":false,"anchor":"training","chapter":"c10","disclosure":false},{"key":"posttraining","title":"SFT、RL 与 OPD 怎么学","group":"训练与推理","target":"#posttraining-learning","featured":true,"anchor":"posttraining-learning","chapter":"c10","disclosure":false},{"key":"verifier","title":"任务、验证器与验收修复","group":"训练与推理","target":"#training-task-quality","featured":false,"anchor":"training-task-quality","chapter":"c10","disclosure":false},{"key":"reasoning","title":"推理强度怎样参与训练","group":"训练与推理","target":"#reasoning-effort","featured":false,"anchor":"reasoning-effort","chapter":"c10","disclosure":false},{"key":"evaluation","title":"不同评测数字的口径","group":"评测与回顾","target":"#evaluation-scopes","featured":false,"anchor":"evaluation-scopes","chapter":"c11","disclosure":false},{"key":"benchmarks","title":"切换任务，比较模型成绩","group":"评测与回顾","target":"#benchmarks","featured":true,"anchor":"benchmarks","chapter":"c11","disclosure":false},{"key":"harness","title":"执行框架怎样影响成绩","group":"评测与回顾","target":"#harness","featured":false,"anchor":"harness","chapter":"c11","disclosure":false},{"key":"summary","title":"六道选择题自测","group":"评测与回顾","target":"#conclusion-map","featured":false,"anchor":"conclusion-map","chapter":"c12","disclosure":false},{"key":"aggregation-math","title":"缓存聚合的加权算例","group":"缓存与生成加速","target":".scv15-aggregation-example","featured":false,"anchor":"viz-aggregation-math","chapter":"c8","disclosure":true},{"key":"training-signals","title":"SFT、RL、OPD 的学习信号","group":"训练与推理","target":".pt20-stages","featured":false,"anchor":"viz-training-signals","chapter":"c10","disclosure":false},{"key":"opd-distribution","title":"OPD：学生与教师分布","group":"训练与推理","target":".pt20-distributions","featured":false,"anchor":"viz-opd-distribution","chapter":"c10","disclosure":true},{"key":"attention-3d","title":"3D：查询匹配与向量汇总","group":"生成与注意力","chapter":"c3","target":"#attention-3d","anchor":"attention-3d","featured":false,"disclosure":false},{"key":"mhc-3d","title":"3D：mHC 四路混合与写回","group":"完整网络与参数","chapter":"c10","target":"#mhc-3d","anchor":"mhc-3d","featured":false,"disclosure":false},{"key":"tensor-3d","title":"3D：图片特征张量与拼接","group":"图文与 Engram","chapter":"c10","target":"#tensor-3d","anchor":"tensor-3d","featured":false,"disclosure":false},{"key":"output-loop","title":"内部表示怎样变成下一个 token","group":"生成与注意力","chapter":"c1","anchor":"v3-output-loop","route":"input","objects":"vector token","keywords":"输出 分数 概率 采样 追加","target":"#v3-output-loop","featured":true,"disclosure":false},{"key":"layers-flow","title":"选一层，查看历史从哪里来","group":"CSA² 跨层共享","chapter":"c7","anchor":"v2-layers","route":"shared","objects":"token cache","keywords":"CED CSA² CSA2 层 索引","target":"#v2-layers","featured":true,"disclosure":false},{"key":"moe-flow","title":"选择专家并合并结果","group":"完整网络与参数","chapter":"c10","anchor":"v2-moe","route":"layer","objects":"vector token","keywords":"MoE 专家 路由 加权","target":"#v2-moe","featured":true,"disclosure":false},{"key":"cache-flow","title":"历史怎样保留、恢复与继续使用","group":"缓存与生成加速","chapter":"c8","anchor":"v2-cache","route":"history","objects":"cache token","keywords":"缓存 窗口 重放","target":"#v2-cache","featured":true,"disclosure":false},{"key":"concept-map","title":"把所有概念放到同一张总图","group":"生成与注意力","chapter":"c1","anchor":"v3-global-map","route":"input","objects":"token vector cache","keywords":"全流程 进度 总图 概念","target":"#v3-global-map","featured":true,"disclosure":false},{"key":"model-history","title":"历代模型的参数、激活与计算量","group":"完整网络与参数","chapter":"c10","anchor":"v3-model-history","route":"training","objects":"matrix","keywords":"历代 V2 V3 V4 总参数 激活 FLOPs","target":"#v3-model-history","featured":true,"disclosure":false},{"key":"kv-shape","title":"V4.1 的 K/V 是什么形状","group":"生成与注意力","chapter":"c3","anchor":"kv-shape","route":"input","objects":"vector matrix","keywords":"MQA 多查询注意力 KV 头数 head dim 512 64 个查询头 共享一条 形状 num_key_value_heads","source":"heads","unit":3,"featured":false,"target":"#kv-shape","disclosure":false},{"key":"expert-inside","title":"打开一个专家：里面是什么","group":"完整网络与参数","chapter":"c10","anchor":"expert-inside","route":"layer","objects":"vector matrix","keywords":"前馈网络 FFN SwiGLU SiLU 门控 W1 W2 W3 激活函数 专家内部 参数量 逐元素","source":"moe","unit":3,"featured":false,"target":"#expert-inside","disclosure":false}];
 function initAtlas34(){
  const atlas=document.getElementById('visual-atlas');if(!atlas)return;
  const search=atlas.querySelector('[data-atlas-search]'),more=atlas.querySelector('[data-atlas-more]'),clear=atlas.querySelector('[data-atlas-clear]'),count=atlas.querySelector('[data-atlas-count]'),empty=atlas.querySelector('[data-atlas-empty]');
  let group='',expanded=false,lastLink=null;
  const items=entries.map(entry=>{
   const link=atlas.querySelector('[data-atlas-key="'+entry.key+'"]'),target=document.querySelector(entry.target);
   if(target){if(!target.id)target.id=entry.anchor;link.href='#'+target.id;target.dataset.atlasDestination=entry.key;}
   return {entry,link,target};
  });
  function render(){
   const normalize=value=>value.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'');
   const term=normalize(search.value.trim());
   const terms=search.value.trim().split(/\s+/u).map(normalize).filter(Boolean);
   const matches=items.filter(({entry,target})=>{
    const text=normalize(entry.title+' '+entry.group+' '+entry.key+' '+(entry.keywords||''));
    return target&&(!window.DSV2AtlasMatch||window.DSV2AtlasMatch(entry))&&(!group||entry.group===group)&&(!term||text.includes(term)||terms.every(word=>text.includes(word)));
   });
   const featured=!group&&!term&&!expanded&&!window.DSV2AtlasFiltered?.();
   const visible=featured?matches.filter(x=>x.entry.featured):matches;
   const selected=new Set(visible);items.forEach(item=>item.link.hidden=!selected.has(item));
   count.textContent=featured?'先看 '+visible.length+' 个核心图解 · 共 '+items.length+' 个':(group||'全部主题')+' · '+visible.length+' 个图解';
   empty.hidden=visible.length!==0;more.hidden=!!group||!!term||!!window.DSV2AtlasFiltered?.();
   more.textContent=expanded?'收起，保留核心图解':'展开全部 '+items.length+' 个图解';more.setAttribute('aria-expanded',String(expanded));
   clear.hidden=!group&&!term&&!window.DSV2AtlasFiltered?.();
   atlas.querySelectorAll('[data-atlas-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.atlasGroup===group)));
  }
  atlas.querySelectorAll('[data-atlas-group]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.atlasGroup;expanded=false;render();}));
  search.addEventListener('input',render);
  clear.addEventListener('click',()=>{search.value='';group='';expanded=false;render();search.focus();});
  more.addEventListener('click',()=>{const closing=expanded;expanded=!expanded;render();if(closing)atlas.scrollIntoView({block:'start',behavior:'instant'});});
  function reveal(hash,focus){
   let id;try{id=decodeURIComponent(hash.slice(1));}catch{return;}
   const returning=id==='visual-atlas';
   const target=returning&&lastLink&&!lastLink.hidden?lastLink:document.getElementById(id);if(!target)return;
   for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
   requestAnimationFrame(()=>{if(focus){if(!target.matches('a[href],button,input,select,textarea,summary,[tabindex]'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}target.scrollIntoView({block:returning&&target===lastLink?'center':'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  }
  atlas.addEventListener('click',event=>{const link=event.target.closest('.atlas34-item');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();lastLink=link;history.pushState(null,'',link.hash);reveal(link.hash,true);});
  const mobileToc=document.querySelector('.mobile-toc');
  if(mobileToc){
   mobileToc.id='chapter-directory';
   const bar=document.createElement('nav');bar.className='reading-return35';bar.setAttribute('aria-label','阅读快捷导航');bar.hidden=true;
   bar.innerHTML='<a href="#visual-atlas">返回图解导航</a><a href="#chapter-directory">章节目录</a>';
   document.body.append(bar);
   const chapter=document.getElementById('c1');let scheduled=false;
   const update=()=>{bar.hidden=chapter.getBoundingClientRect().top>window.innerHeight/2;scheduled=false;};
   const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
   window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
  }
  document.addEventListener('click',event=>{
   const link=event.target.closest('a[href="#visual-atlas"],a[href="#chapter-directory"]');
   if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();history.pushState(null,'',link.hash);
   if(link.hash==='#visual-atlas'){if(mobileToc)mobileToc.open=false;reveal(link.hash,true);}
   else if(mobileToc){mobileToc.open=true;mobileToc.querySelector('summary').focus({preventScroll:true});reveal(link.hash,false);}
  });
  
  render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initAtlas34,0));else initAtlas34();
})();
