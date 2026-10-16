(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const speciesSelect = get('network-species'), canvas = get('network-canvas'), context = canvas.getContext('2d');
  const status = get('network-status'), search = get('network-search'), detail = get('network-node-detail');
  const cache = new Map();
  let graph = null, neighbors = [], sample = null, request = 0, controller;
  let selected = -1, pinned = false, scale = 1, offsetX = 0, offsetY = 0;
  let width = 600, height = 540, frame = 0, drag = null, baseDirty = true;
  const base = document.createElement('canvas');
  const colors = { fungi: '#d78038', bacteria: '#3d8ac2' };
  const names = { fungi: '真菌', bacteria: '细菌' };
  const ranks = ['门 Phylum', '纲 Class', '目 Order', '科 Family', '属 Genus'];
  const textElement = (tag, text, className) => {
    const element = document.createElement(tag); element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const screen = node => [width/2 + offsetX + node.x*unit(), height/2 + offsetY + node.y*unit()];
  const unit = () => Math.max(1, Math.min(width,height)*.43)*scale;
  function radius(index) { return Math.min(5, Math.max(1.8, 1.5 + Math.log2(neighbors[index].length+1)*.22)) * Math.min(1.6,Math.sqrt(scale)); }
  function redraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function draw() {
    frame = 0;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio,0,0,ratio,0,0);
    context.clearRect(0,0,width,height);
    if (!graph) return;
    const points = graph.nodes.map(screen);
    if (baseDirty) {
      base.width = canvas.width; base.height = canvas.height;
      const ctx = base.getContext('2d'); ctx.setTransform(ratio,0,0,ratio,0,0);
      const dark = document.documentElement.dataset.theme === 'dark';
      ctx.strokeStyle = dark ? 'rgba(183,202,194,.10)' : 'rgba(67,93,80,.09)'; ctx.lineWidth = .55;
      ctx.beginPath();
      for (const [a,b] of graph.edges) { ctx.moveTo(...points[a]); ctx.lineTo(...points[b]); }
      ctx.stroke();
      for (let i=0;i<graph.nodes.length;i++) {
        ctx.fillStyle=colors[graph.nodes[i].group]; ctx.beginPath(); ctx.arc(...points[i],radius(i),0,Math.PI*2); ctx.fill();
      }
      baseDirty=false;
    }
    context.globalAlpha=selected>=0 ? .22 : 1;
    context.drawImage(base,0,0,width,height); context.globalAlpha=1;
    if (selected<0) return;
    context.strokeStyle = '#72936e'; context.lineWidth=1.1; context.beginPath();
    for (const link of neighbors[selected]) { context.moveTo(...points[selected]); context.lineTo(...points[link.index]); }
    context.stroke();
    for (const i of [selected,...neighbors[selected].map(link=>link.index)]) {
      context.fillStyle=colors[graph.nodes[i].group]; context.beginPath(); context.arc(...points[i],radius(i)+(i===selected?2:0),0,Math.PI*2); context.fill();
    }
    context.strokeStyle=document.documentElement.dataset.theme==='dark'?'#fff':'#18271d';
    context.lineWidth=2; context.beginPath(); context.arc(...points[selected],radius(selected)+3,0,Math.PI*2); context.stroke();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width=Math.max(1,rect.width); height=Math.max(1,rect.height);
    const ratio=window.devicePixelRatio||1;
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    baseDirty=true; redraw();
  }
  function clearSelection() {
    selected=-1; pinned=false; get('network-unlock').hidden=true;
    detail.replaceChildren(textElement('p','悬停网络节点，查看分类信息和关联节点。','network-empty'));
    redraw();
  }
  function selectNode(index, lock=false) {
    if (!graph || !graph.nodes[index]) return;
    if (lock) pinned=true;
    get('network-unlock').hidden=!pinned;
    if (selected===index) { redraw(); return; }
    selected=index;
    const node=graph.nodes[index];
    const title=textElement('h4',`${node.id} · ${names[node.group]}`);
    const taxonomy=document.createElement('dl'); taxonomy.className='network-taxonomy';
    node.taxonomy.forEach((name,i)=>{
      const row=document.createElement('div'); row.append(textElement('dt',ranks[i]),textElement('dd',name)); taxonomy.append(row);
    });
    const links=[...neighbors[index]].sort((a,b)=>b.r-a.r || a.index-b.index);
    const heading=textElement('h4',`关联节点（${links.length}）`);
    const list=document.createElement('div'); list.className='network-neighbors';
    let shown=0;
    const more=textElement('button','显示更多关联节点','platform-button'); more.type='button';
    function addNeighbors() {
      const stop=Math.min(shown+30,links.length);
      for (;shown<stop;shown++) {
        const link=links[shown], other=graph.nodes[link.index];
        const item=document.createElement('div'); item.className='network-neighbor';
        const button=textElement('button',`${other.id} · ${names[other.group]}`); button.type='button';
        button.addEventListener('click',()=>selectNode(link.index,true));
        item.append(button,textElement('span',`Spearman ρ = ${link.r.toFixed(3)} · BH P = ${link.q.toExponential(2)}`));
        item.append(textElement('p',other.taxonomy.map((v,i)=>`${['p','c','o','f','g'][i]}_${v}`).join('; ')));
        list.append(item);
      }
      more.hidden=shown===links.length;
    }
    more.addEventListener('click',addNeighbors); addNeighbors();
    detail.replaceChildren(title,taxonomy,heading,list,more); redraw();
  }
  function hit(event) {
    if(!graph) return -1;
    const rect=canvas.getBoundingClientRect(), x=event.clientX-rect.left,y=event.clientY-rect.top;
    let best=-1,distance=64;
    graph.nodes.forEach((node,i)=>{const [px,py]=screen(node),d=(x-px)**2+(y-py)**2;if(d<distance){distance=d;best=i;}});
    return best;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!graph) return;
    drag={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(drag){
      if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4) drag.moved=true;
      if(drag.moved){offsetX+=event.clientX-drag.lastX;offsetY+=event.clientY-drag.lastY;baseDirty=true;redraw();}
      drag.lastX=event.clientX;drag.lastY=event.clientY;return;
    }
    if(!pinned){const index=hit(event);if(index>=0)selectNode(index);}
  });
  canvas.addEventListener('pointerup',event=>{
    if(drag&&!drag.moved){const index=hit(event);if(index>=0)selectNode(index,true);else clearSelection();}
    drag=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  function zoom(factor,x=width/2,y=height/2) {
    const next=Math.min(20,Math.max(.3,scale*factor)),ratio=next/scale;
    offsetX=(offsetX+width/2-x)*ratio+x-width/2;
    offsetY=(offsetY+height/2-y)*ratio+y-height/2;
    scale=next;baseDirty=true;redraw();
  }
  canvas.addEventListener('wheel',event=>{
    if(!graph)return;event.preventDefault();const rect=canvas.getBoundingClientRect();
    zoom(Math.exp(-Math.sign(event.deltaY)*.15),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Escape'){clearSelection();return;}
    if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.3);}
    if(event.key==='-'){event.preventDefault();zoom(1/1.3);}
  });
  get('network-zoom-in').addEventListener('click',()=>zoom(1.3));
  get('network-zoom-out').addEventListener('click',()=>zoom(1/1.3));
  get('network-reset').addEventListener('click',()=>{scale=1;offsetX=offsetY=0;clearSelection();baseDirty=true;redraw();});
  get('network-unlock').addEventListener('click',clearSelection);
  search.addEventListener('input',()=>{
    const results=get('network-search-results'); results.replaceChildren();
    const query=search.value.trim().toLowerCase();if(!graph||!query)return;
    const matches=graph.nodes.map((node,i)=>({node,i})).filter(({node})=>`${node.id} ${node.taxonomy.join(' ')}`.toLowerCase().includes(query));
    results.append(textElement('p',`匹配 ${matches.length} 个节点${matches.length>30?'，显示前30个；可继续输入缩小范围':''}`));
    for(const {node,i} of matches.slice(0,30)){
      const button=textElement('button',`${node.id} · ${names[node.group]} · ${node.taxonomy[4]}`);button.type='button';
      button.addEventListener('click',()=>selectNode(i,true));results.append(button);
    }
  });
  function stats(entry) {
    for(const key of ['nodes','links','fungi','bacteria'])get(`network-${key}`).textContent=entry ? entry[key].toLocaleString('en-US') : '—';
  }
  function validate(data) {
    if(!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw Error('无效网络数据');
    const threshold=data.correlationThreshold ?? .6;
    data.nodes.forEach(node=>{if(!Number.isFinite(node.x)||!Number.isFinite(node.y)||!colors[node.group]||node.taxonomy?.length!==5)throw Error('无效节点');});
    data.edges.forEach(([a,b,r,q])=>{if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=data.nodes.length||b>=data.nodes.length||a===b||!(r>threshold&&r<=1&&q>=0&&q<.05))throw Error('无效关联');});
    return data;
  }
  async function load(point) {
    if (point?.species && sample?.species === point.species && graph) { sample=point; return; }
    sample=point;const token=++request;controller?.abort();controller=new AbortController();
    graph=null;neighbors=[];clearSelection();stats(null);search.value='';search.disabled=true;
    get('network-search-results').replaceChildren();get('network-retry').hidden=true;
    scale=1;offsetX=offsetY=0;baseDirty=true;status.hidden=false;
    get('network-site').textContent=point?`当前物种：${point.speciesName}`:'请选择物种查看网络';
    const entry=window.MICROBE_NETWORKS?.[point?.species];
    if(!point){status.textContent='请选择上方的物种查看网络';return;}
    if(!entry){status.textContent='该物种的网络结果暂不可用';return;}
    stats(entry);
    if(entry.status==='empty'){status.textContent='按当前阈值未检出显著正相关关联，无可展示网络。';return;}
    status.textContent='网络加载中…';
    try {
      let data=cache.get(point.species);
      if(!data){
        const response=await fetch(entry.file,{signal:controller.signal});if(!response.ok)throw Error(`HTTP ${response.status}: ${entry.file}`);
        data=validate(await response.json());
      }
      if(token!==request)return;
      cache.delete(point.species);cache.set(point.species,data);if(cache.size>6)cache.delete(cache.keys().next().value);
      graph=data;neighbors=data.nodes.map(()=>[]);
      for(const [a,b,r,q] of data.edges){neighbors[a].push({index:b,r,q});neighbors[b].push({index:a,r,q});}
      status.hidden=true;search.disabled=false;resize();
    } catch(error) {
      if(token!==request||error.name==='AbortError')return;
      status.textContent=window.location?.protocol==='file:'?'请通过本地 HTTP 预览或 GitHub Pages 打开网页，以加载网络结果。':'网络暂未加载，请确认 assets/networks 文件已完整上传后重试。';get('network-retry').hidden=false;
      console.error('微生物网络加载失败', error);
    }
  }
  get('network-retry').addEventListener('click',()=>load(sample));
  speciesSelect.addEventListener('change',()=>load(speciesSelect.value ? {
    species: speciesSelect.value, speciesName: speciesSelect.selectedOptions[0].textContent
  } : null));
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(()=>{baseDirty=true;redraw();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  resize();
})();
