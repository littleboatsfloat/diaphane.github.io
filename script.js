const motionButton = document.querySelector('#motion');
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = preference.matches;
try { paused ||= sessionStorage.getItem('pause-movement') === 'true'; } catch {}
function updateMotion() {
  document.documentElement.classList.toggle('still', paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.textContent = paused ? 'resume movement' : 'pause movement';
}
motionButton.hidden = false;
motionButton.addEventListener('click', () => {
  paused = !paused;
  updateMotion();
  try { sessionStorage.setItem('pause-movement', String(paused)); } catch {}
});
preference.addEventListener('change', event => { paused = event.matches; updateMotion(); });
updateMotion();

// Both indexes start open; deep links also reopen a folded section.
function revealHash() {
  const id = location.hash.slice(1);
  const target = document.getElementById(id);
  if (target?.tagName === 'DETAILS') target.open = true;
}
revealHash();
window.addEventListener('hashchange', revealHash);

const search = document.querySelector('#search');
const genre = document.querySelector('#genre');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
if (search) {
  const items = [...document.querySelectorAll('.shelf-item')];
  const groups = [...document.querySelectorAll('.genre-group')];
  function filter() {
    const term = normalize(search.value.trim());
    let count = 0;
    for (const item of items) {
      item.hidden = !normalize(item.dataset.search).includes(term) || (genre.value && item.dataset.genre !== genre.value);
      if (!item.hidden) count++;
    }
    for (const group of groups) group.hidden = ![...group.querySelectorAll('.shelf-item')].some(item => !item.hidden);
    document.querySelector('#result-count').textContent = `${count} of ${items.length}`;
    document.querySelector('#no-results').hidden = count !== 0;
  }
  search.addEventListener('input', filter);
  genre.addEventListener('change', filter);
  document.querySelector('#clear-filters').addEventListener('click', () => { search.value = ''; genre.value = ''; filter(); search.focus(); });
  filter();
}
for (const button of document.querySelectorAll('[data-open]')) {
  button.addEventListener('click', () => document.getElementById(button.dataset.open).showModal());
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
}
for (const image of document.querySelectorAll('.cover-frame img, .detail-cover')) {
  image.addEventListener('error', () => {
    const note = document.createElement('span');
    note.className = 'cover-unavailable';
    note.textContent = `${image.alt} — image unavailable`;
    image.replaceWith(note);
  }, { once:true });
}

// Every journey begins at the same threshold. At shared junctions the figures
// choose another connected segment, keeping their feet on the current.
const travellers = [...document.querySelectorAll('.travelling-figure')];
const basinPieces = [...document.querySelectorAll('.basin-piece')];
const water = document.querySelector('.sloshing-water');
const distortion = document.querySelector('#water-distortion feDisplacementMap');
const ripples = [...document.querySelectorAll('.basin-ripples ellipse')];
const routes = new Map([...document.querySelectorAll('.network-lines path')].map(path => [
  path.id.replace('flow-', ''), {
    path, length:path.getTotalLength(), next:path.dataset.next.split(' ').filter(Boolean)
  }
]));
const surfaceCurrents = [...document.querySelectorAll('.surface-currents path')];
const smokePuffs = [...document.querySelectorAll('.smoke-puff')];
const doorLeft = document.querySelector('.door-left');
const doorRight = document.querySelector('.door-right');
const walkers = travellers.map((node,i) => ({
  node, pose:node.querySelector('.runner-pose'),
  left:node.querySelector('.left-leg'), right:node.querySelector('.right-leg'),
  edge:'threshold', distance:0, wait:.9+i*4.2, visits:0, journeys:0, stride:i*1.7, routeBias:0, cooldown:0, coupled:false
}));
let doorOpening = .15;
function advanceWalker(walker, distance, i) {
  walker.distance += distance;
  let edge = routes.get(walker.edge);
  while (walker.distance >= edge.length) {
    walker.distance -= edge.length;
    if (!edge.next.length) {
      walker.edge = 'threshold'; walker.distance = 0;
      walker.wait = 2.5 + i*.35; walker.visits = 0; walker.journeys++;
      return;
    }
    const choice = (i + walker.journeys + walker.routeBias + walker.visits++) % edge.next.length;
    walker.edge = edge.next[choice];
    edge = routes.get(walker.edge);
  }
}
function drawWalker(walker,i,time) {
  const edge = routes.get(walker.edge);
  const point = edge.path.getPointAtLength(walker.distance);
  const ahead = edge.path.getPointAtLength(Math.min(edge.length,walker.distance+3));
  const behind = edge.path.getPointAtLength(Math.max(0,walker.distance-3));
  const dx = ahead.x-behind.x, dy = ahead.y-behind.y;
  const direction = dx < 0 ? -1 : 1;
  const slope = Math.max(-18,Math.min(18,Math.atan2(dy,Math.abs(dx))*180/Math.PI));
  const entrance = walker.edge === 'threshold' ? Math.min(1,walker.distance/52) : 1;
  const size = .2 + entrance*.43;
  const gait = Math.sin(time*8.8+walker.stride);
  const lift = Math.abs(gait)*1.1*entrance;
  const exit = edge.next.length ? 1 : Math.min(1,(edge.length-walker.distance)/35);
  walker.node.setAttribute('transform',`translate(${point.x} ${point.y-lift}) rotate(${slope*direction*.45}) scale(${size})`);
  walker.node.setAttribute('opacity',walker.wait > 0 ? '0' : String(exit*.88));
  walker.pose.setAttribute('transform',`skewX(${direction*(-5+gait*1.5)*entrance})`);
  walker.left.setAttribute('transform',`rotate(${gait*15*entrance} -5 -35)`);
  walker.right.setAttribute('transform',`rotate(${-gait*15*entrance} 5 -35)`);
}
// A machine's output becomes another's input. The current crosses a changing
// chain of moving figures, then forks into the basin and beyond the page.
const couplingLayer = document.querySelector('.coupling-layer');
const network = document.querySelector('.figure-network');
const walkerPoint = w => routes.get(w.edge).path.getPointAtLength(w.distance);
const svgNode = (tag,attributes,parent=couplingLayer) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key,value));
  parent.append(node); return node;
};
const streamColors = ['#ac743c','#7b8561','#ae6548','#687f79'];
let chain = [], chainLinks = [], packets = [], flights = [], nextPacket = 0;
let basinArrival = -100, outlets = null;
if (couplingLayer) couplingLayer.replaceChildren();
function measureOutlets() {
  if (!network || !water) return;
  const inverse = network.getScreenCTM()?.inverse();
  const basinMatrix = document.querySelector('.basin-water').getScreenCTM();
  if (!inverse || !basinMatrix) return;
  const basin = new DOMPoint(875,572).matrixTransform(basinMatrix).matrixTransform(inverse);
  const edge = new DOMPoint(innerWidth+65,document.querySelector('.basin-opening').getBoundingClientRect().bottom+35).matrixTransform(inverse);
  outlets = {basin,edge};
}
if (network) {
  new ResizeObserver(measureOutlets).observe(document.querySelector('main'));
  window.addEventListener('resize',measureOutlets);
  document.fonts.ready.then(measureOutlets);
  measureOutlets();
}
function releaseCurrent(point,color,time) {
  if (!outlets || flights.length > 22) return;
  for (const target of ['basin','edge']) {
    const end = outlets[target];
    const d = target === 'basin'
      ? `M${point.x} ${point.y} C${point.x-150} ${point.y-170} ${end.x-180} ${end.y+150} ${end.x} ${end.y}`
      : `M${point.x} ${point.y} C${point.x+220} ${point.y-220} ${end.x-260} ${end.y-170} ${end.x} ${end.y}`;
    const group = svgNode('g',{'class':'escaped-current'});
    const path = svgNode('path',{d,'class':'flight-thread',stroke:color},group);
    const tail = svgNode('path',{'class':'flight-tail',stroke:color},group);
    const dot = svgNode('circle',{r:target==='basin'?3:2.2,fill:color,'class':'stream-packet'},group);
    flights.push({group,path,tail,dot,target,length:path.getTotalLength(),distance:0,born:time});
  }
}
function rebuildChain(time) {
  const candidates = walkers.filter(w => {
    const p=walkerPoint(w);
    return !w.wait && w.edge!=='threshold' && p.x>20 && p.y>120;
  });
  const old = chain;
  // Keep existing couplings until a machine leaves; new machines extend the chain.
  const members = old.filter(w=>candidates.includes(w));
  const additions = candidates.filter(w=>!members.includes(w)).sort(()=>Math.random()-.5);
  for (const w of additions) if (members.length<6) members.push(w);
  if (members.length<3) {
    if (!old.length) return;
    members.length=0;
  }
  if (members.length===old.length && members.every((w,i)=>w===old[i])) return;
  // In-flight material is released, rather than destroyed by a changed coupling.
  for (const packet of packets) {
    if (packet.point) releaseCurrent(packet.point,streamColors[packet.hop%4],time);
    packet.node.remove();
  }
  packets=[];
  chainLinks.forEach(link=>link.path.remove()); chainLinks=[];
  old.forEach(w=>{w.coupled=false;w.node.classList.remove('is-coupled');w.node.style.removeProperty('--coupling-glow');});
  chain=members;
  if (!chain.length) return;
  // Spatial order follows the current upward, with crossings as bodies keep moving.
  chain.sort((a,b)=>walkerPoint(b).y-walkerPoint(a).y);
  chain.forEach(w=>{w.coupled=true;w.node.classList.add('is-coupled');});
  for(let i=0;i<chain.length;i++) chainLinks.push({path:svgNode('path',{'class':'machine-current',stroke:streamColors[i%4]}),length:0});
  nextPacket=Math.min(nextPacket,time+.3);
}
function drawChains(time,elapsed,moving) {
  if (!couplingLayer) return;
  couplingLayer.setAttribute('opacity','1');
  if (moving) rebuildChain(time);
  let previous={x:292.56,y:763};
  chainLinks.forEach((link,i)=>{
    const p=walkerPoint(chain[i]), end={x:p.x,y:p.y-30};
    const dx=end.x-previous.x,dy=end.y-previous.y,span=Math.max(1,Math.hypot(dx,dy));
    const bend=(i%2?1:-1)*Math.min(55,span*.36);
    const nx=-dy/span,ny=dx/span;
    link.path.setAttribute('d',`M${previous.x} ${previous.y} C${previous.x+dx*.33+nx*bend} ${previous.y+dy*.33+ny*bend} ${end.x-dx*.33+nx*bend} ${end.y-dy*.33+ny*bend} ${end.x} ${end.y}`);
    link.length=link.path.getTotalLength(); previous=end;
  });
  if(moving && chain.length>=3 && time>=nextPacket) {
    packets.push({node:svgNode('circle',{r:2.7,'class':'stream-packet',fill:streamColors[0]}),hop:0,distance:0,point:null});
    nextPacket=time+1.7;
  }
  packets=packets.filter(packet=>{
    if(moving) packet.distance+=elapsed*150;
    while(chainLinks[packet.hop] && packet.distance>=chainLinks[packet.hop].length) {
      packet.distance-=chainLinks[packet.hop].length;
      const receiver=chain[packet.hop];
      receiver.energized=time; receiver.routeBias++; receiver.stride+=.35;
      packet.hop++;
    }
    const link=chainLinks[packet.hop];
    if(!link) {
      if(packet.point) releaseCurrent(previous,streamColors[packet.hop%4],time);
      packet.node.remove(); return false;
    }
    const p=link.path.getPointAtLength(packet.distance);packet.point=p;
    packet.node.setAttribute('cx',p.x);packet.node.setAttribute('cy',p.y);
    packet.node.setAttribute('fill',streamColors[packet.hop%4]);
    packet.node.setAttribute('r',2.4+packet.hop*.35);
    return true;
  });
  chain.forEach(w=>w.node.style.setProperty('--coupling-glow',String(.15+Math.max(0,1-(time-(w.energized??-100))/1.2)*.8)));
  flights=flights.filter(f=>{
    if(moving) f.distance+=elapsed*210;
    const p=f.path.getPointAtLength(Math.min(f.distance,f.length));
    f.dot.setAttribute('cx',p.x);f.dot.setAttribute('cy',p.y);
    let d='';
    for(let n=0;n<=8;n++) {
      const tail=f.path.getPointAtLength(Math.max(0,f.distance-48+n*6));
      d+=`${n?'L':'M'}${tail.x} ${tail.y} `;
    }
    f.tail.setAttribute('d',d);
    if(f.distance>=f.length) {if(f.target==='basin')basinArrival=time;f.group.remove();return false;}
    return true;
  });
}

let lastFrame = 0, flowTime = 0, stillComposition = false;
function moveFigures(now) {
  const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
  lastFrame = now;
  const moving = !paused && !document.hidden;
  if (moving) flowTime += elapsed;
  // Reduced motion starts with an inhabited, open factory, rather than an empty page.
  if (paused && flowTime === 0 && !stillComposition) {
    walkers.forEach((walker,i) => { walker.wait = 0; advanceWalker(walker,18+i*115,i); });
    doorOpening = 1; stillComposition = true;
  }
  walkers.forEach((walker,i) => {
    if (moving) {
      if (walker.wait > 0) walker.wait = Math.max(0,walker.wait-elapsed);
      else advanceWalker(walker,elapsed*(21+i%3*2),i);
    }
    drawWalker(walker,i,flowTime);
  });
  drawChains(flowTime,elapsed,moving);
  if (doorLeft) {
    const opening = walkers.some(w => (w.wait > 0 && w.wait < 1.2) || (w.wait === 0 && w.edge === 'threshold' && w.distance < 28));
    if (moving) doorOpening += ((opening ? 1 : .12)-doorOpening)*Math.min(1,elapsed*3);
    const a = 1-1.8*doorOpening, b = .4*doorOpening;
    doorLeft.setAttribute('transform',`matrix(${a} ${b} 0 1 ${504*(1-a)} ${-504*b})`);
    doorRight.setAttribute('transform',`matrix(${a} ${-b} 0 1 ${550*(1-a)} ${550*b})`);
  }
  basinPieces.forEach((node,i) => {
    const centers = [[460,385],[637,487],[453,590],[702,690],[1116,604],[1065,451]];
    const [cx,cy] = centers[i];
    const t = flowTime / (2.2 + i * .19), phase = i * 1.3;
    const dx = Math.sin(t + phase) * (i === 5 ? 12 : 45) + Math.sin(flowTime/7+phase)*16;
    const dy = Math.cos(t * 1.3 + phase) * 15;
    const angle = Math.sin(t + phase) * (i === 2 ? 9 : 15);
    node.setAttribute('transform', `translate(${dx} ${dy}) rotate(${angle} ${cx} ${cy})`);
  });
  smokePuffs.forEach((node,i) => {
    const stack = i%3, age = (flowTime/(6.5+stack) + Math.floor(i/3)/14)%1;
    const origins = [[680,289],[919,394],[986,480]];
    const [x,y] = origins[stack];
    const spread = 10 + age*74;
    const drift = age*age*(170-stack*25) + Math.sin(age*8+i*.8)*age*34;
    node.setAttribute('cx',String(x+drift));node.setAttribute('cy',String(y-age*(340-stack*45)));
    node.setAttribute('rx',String(spread));node.setAttribute('ry',String(spread*.8));
    node.setAttribute('opacity',String(Math.sin(Math.PI*age)**.7*.72));
  });
  if (water) {
    const sway = Math.sin(flowTime / 1.8);
    water.setAttribute('transform', `translate(${sway * 19} ${Math.sin(flowTime / 1.4) * 9}) rotate(${sway * 1.8} 730 530)`);
    distortion.setAttribute('scale', String(18 + Math.sin(flowTime / 1.6) * 12));
    surfaceCurrents.forEach((path,i) => {
      const y = 340+i*57;
      let d = '';
      for (let x=130;x<=1320;x+=18) {
        const wave = Math.sin(x/85-flowTime*2+i*.7)*10 + Math.sin(x/160+flowTime*1.4)*8;
        d += `${x===130?'M':'L'}${x} ${y+wave} `;
      }
      path.setAttribute('d',d);
    });
    ripples.forEach((node,i) => {
      const pulse = (flowTime / 5 + i * .5) % 1;
      node.setAttribute('rx', String(38 + pulse * 115));
      node.setAttribute('ry', String(12 + pulse * 34));
      node.setAttribute('opacity', String((1 - pulse) * .4 + Math.max(0,1-(flowTime-basinArrival)/2)*.45));
    });
  }
  if (travellers.length || water) requestAnimationFrame(moveFigures);
}
if (travellers.length || water) requestAnimationFrame(moveFigures);
