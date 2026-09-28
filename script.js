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
// Sample curves in JavaScript; SVG geometry reads after path writes force the
// browser to recalculate geometry in the middle of every animation frame.
function sampledCurve(points) {
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const length=lengths.at(-1);
  return {length,getPointAtLength(distance) {
    distance=Math.max(0,Math.min(length,distance));
    let lo=0,hi=lengths.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(lengths[mid]<distance)lo=mid;else hi=mid;}
    const mix=(distance-lengths[lo])/(lengths[hi]-lengths[lo]||1);
    return{x:points[lo].x+(points[hi].x-points[lo].x)*mix,y:points[lo].y+(points[hi].y-points[lo].y)*mix};
  }};
}
function readCurve(path) {
  const length=path.getTotalLength();
  return sampledCurve(Array.from({length:65},(_,i)=>path.getPointAtLength(length*i/64)));
}
function setCurve(path,values) {
  const [x0,y0,x1,y1,x2,y2,x3,y3]=values;
  path.setAttribute('d',`M${x0.toFixed(2)} ${y0.toFixed(2)} C${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x3.toFixed(2)} ${y3.toFixed(2)}`);
  return sampledCurve(Array.from({length:33},(_,i)=>{
    const t=i/32,u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
    return{x:a*x0+b*x1+c*x2+d*x3,y:a*y0+b*y1+c*y2+d*y3};
  }));
}

const routes = new Map([...document.querySelectorAll('.network-lines path')].map(path => [
  path.id.replace('flow-', ''), {
    path:readCurve(path), length:path.getTotalLength(), next:path.dataset.next.split(' ').filter(Boolean)
  }
]));
const surfaceCurrents = [...document.querySelectorAll('.surface-currents path')];
const smokePuffs = [...document.querySelectorAll('.smoke-puff')].filter((node,i)=>{if(i>=18){node.remove();return false;}return true;});
const doorLeft = document.querySelector('.door-left');
const doorRight = document.querySelector('.door-right');
const walkers = travellers.map((node,i) => ({
  node, pose:node.querySelector('.runner-pose'),
  left:node.querySelector('.left-leg'), right:node.querySelector('.right-leg'),
  edge:'threshold', distance:0, wait:.9+i*4.2, visits:0, journeys:0, stride:i*1.7, routeBias:0, coupled:false
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
for(const walker of walkers) {
  walker.aura=svgNode('ellipse',{cx:0,cy:-48,rx:27,ry:49,fill:'#c99650',opacity:0,'class':'machine-aura'},walker.node);
  walker.node.prepend(walker.aura);
}
const streamColors = ['#ac743c','#7b8561','#ae6548','#687f79'];
let chain = [], chainLinks = [], packets = [], flights = [], nextPacket = 0;
let basinArrival = -100, outlets = null, basinMapping = null;
if (couplingLayer) couplingLayer.replaceChildren();
function measureOutlets() {
  if (!network || !water) return;
  const inverse = network.getScreenCTM()?.inverse();
  const basinMatrix = document.querySelector('.basin-water').getScreenCTM();
  if (!inverse || !basinMatrix) return;
  basinMapping=inverse.multiply(basinMatrix);
  const basin = new DOMPoint(875,572).matrixTransform(basinMatrix).matrixTransform(inverse);
  const edge = new DOMPoint(innerWidth+65,document.querySelector('.basin-opening').getBoundingClientRect().bottom+35).matrixTransform(inverse);
  outlets = {basin,edge,factory:{x:292.56,y:763}};
  // Keep a flight aimed at the same destination after a responsive layout change.
  for (const flight of flights) {
    const progress=flight.distance/flight.length;
    if(flight.basinOrigin) flight.origin=basinToNetwork(flight.basinOrigin);
    flight.path.setAttribute('d',flightCurve(flight.origin,flight.target));
    flight.geometry=readCurve(flight.path);flight.length=flight.geometry.length; flight.distance=progress*flight.length;
    flight.tail.setAttribute('d',flight.path.getAttribute('d'));
    flight.tail.setAttribute('stroke-dasharray',`48 ${flight.length+48}`);
  }
}
if (network) {
  new ResizeObserver(measureOutlets).observe(document.querySelector('main'));
  window.addEventListener('resize',measureOutlets);
  document.fonts.ready.then(measureOutlets);
  measureOutlets();
}
function flightCurve(point,target) {
  const end=outlets[target];
  if(target==='factory') return `M${point.x} ${point.y} C${point.x+130} ${point.y+220} ${end.x-170} ${end.y-160} ${end.x} ${end.y}`;
  return target === 'basin'
    ? `M${point.x} ${point.y} C${point.x-150} ${point.y-170} ${end.x-180} ${end.y+150} ${end.x} ${end.y}`
    : `M${point.x} ${point.y} C${point.x+220} ${point.y-220} ${end.x-260} ${end.y-170} ${end.x} ${end.y}`;
}
function launchFlight(point,color,time,target,basinOrigin=null) {
  const d=flightCurve(point,target);
  const group=svgNode('g',{'class':'escaped-current'+(target==='factory'?' return-current':'')});
  const path=svgNode('path',{d,'class':'flight-thread',stroke:color},group);
  const geometry=readCurve(path);
  const tail=svgNode('path',{d,'class':'flight-tail',stroke:color,'stroke-dasharray':`48 ${geometry.length+48}`},group);
  const dot=svgNode('circle',{r:target==='edge'?2.2:3,fill:color,'class':'stream-packet'},group);
  flights.push({group,path,geometry,tail,dot,target,color,basinOrigin,origin:{x:point.x,y:point.y},length:geometry.length,distance:0,born:time});
}
function releaseCurrent(point,color,time) {
  if (!outlets || flights.length > 14) return;
  for(const target of ['basin','edge']) launchFlight(point,color,time,target);
}
// The basin is another producer: an arriving current is redistributed through
// floating pieces, changes the water, then returns as new input to the factory.
const basinSurface = document.querySelector('.basin-water');
const basinLayer = basinSurface ? svgNode('g',{'class':'basin-recombinations','clip-path':'url(#water-area)'},basinSurface) : null;
const pieceCenters = [[460,385],[637,487],[453,590],[702,690],[1116,604],[1065,451]];
let basinEvents=[], basinPhase=0, basinCharge=0, nextBasinReturn=0, factoryReturn=-100;
// A slow envelope changes tempo, never position or phase at the instant of impact.
let basinTempo=1, basinTempoTarget=1, nextBasinMood=0, basinMood=0;
function stepBasinMood(elapsed,moving) {
  if(!moving)return;
  const blend=1-Math.exp(-elapsed/2.5);
  const active=basinEvents.length>0;
  basinTempo+=((active?basinTempoTarget:1)-basinTempo)*blend;
  basinPhase+=elapsed*basinTempo;
}
const pieceDrifts=pieceCenters.map(()=>({x:0,y:0,angle:0}));
const floatingPoint=i=>({x:pieceCenters[i][0]+pieceDrifts[i].x,y:pieceCenters[i][1]+pieceDrifts[i].y});
function basinToNetwork(point) {
  return new DOMPoint(point.x,point.y).matrixTransform(basinMapping);
}
function receiveBasin(color,time) {
  basinArrival=time;
  if (!basinLayer || basinEvents.length>=3) return;
  if(time>=nextBasinMood) {
    basinTempoTarget=[.8,1.22,.86,1.16][basinMood++%4];
    nextBasinMood=time+8;
  }
  const group=svgNode('g',{'class':'basin-event'},basinLayer);
  const ring=svgNode('ellipse',{cx:875,cy:572,rx:5,ry:2,fill:'none',stroke:color,'stroke-width':1.3},group);
  const offset=Math.floor(Math.random()*pieceCenters.length);
  const pieces=[offset,(offset+2)%6,(offset+3)%6];
  // One current encounters a body, splits, then recombines at a different body.
  const connections=[[-1,0,0],[0,1,1.25],[0,2,1.8],[1,2,3.1]];
  const strands=connections.map(([from,to,delay],i)=>{
    const path=svgNode('path',{fill:'none',stroke:streamColors[(offset+i)%4],'stroke-width':1.7},group);
    const bead=svgNode('circle',{r:3.5,fill:streamColors[(offset+i)%4]},group);
    const echo=svgNode('circle',{r:2,fill:streamColors[(offset+i+1)%4]},group);
    return {path,bead,echo,from,to,delay,duration:2.2+i*.16,hand:i%2?1:-1};
  });
  basinEvents.push({born:time,group,ring,strands,pieces,returned:false,outputs:0,returnAllowed:false,color});
}
function transformBasin(time,elapsed,moving) {
  basinCharge=0;
  basinEvents=basinEvents.filter(event=>{
    const age=time-event.born;
    if(age>9.5) {event.group.remove();return false;}
    const force=Math.sin(Math.min(1,age/9.5)*Math.PI);
    basinCharge+=force;
    event.group.setAttribute('opacity',String(Math.min(1,age*2,(9.5-age)/2.5)*.48));
    event.ring.setAttribute('rx',String(12+age*35));event.ring.setAttribute('ry',String(4+age*11));
    event.ring.setAttribute('opacity',String(Math.max(0,1-age/4)));
    event.strands.forEach(strand=>{
      const start=strand.from<0?{x:875,y:572}:floatingPoint(event.pieces[strand.from]);
      const end=floatingPoint(event.pieces[strand.to]);
      const dx=end.x-start.x,dy=end.y-start.y,span=Math.max(1,Math.hypot(dx,dy));
      const nx=-dy/span,ny=dx/span;
      const bend=strand.hand*(45+span*.17+Math.sin(time*.17+strand.to)*12);
      const geometry=setCurve(strand.path,[start.x,start.y,start.x+dx*.24+nx*bend,start.y+dy*.24+ny*bend,end.x-dx*.3+nx*bend,end.y-dy*.3+ny*bend,end.x,end.y]);
      const length=geometry.length;
      const progress=Math.max(0,Math.min(1,(age-strand.delay)/strand.duration));
      strand.path.setAttribute('stroke-dasharray',`${length} ${length}`);
      strand.path.setAttribute('stroke-dashoffset',String(length*(1-progress)));
      const p=geometry.getPointAtLength(progress*length);
      strand.bead.setAttribute('cx',p.x);strand.bead.setAttribute('cy',p.y);
      strand.bead.setAttribute('opacity',String(progress>0&&progress<1?1:0));
      const echoProgress=(age-strand.delay-.28)/strand.duration;
      const echoPoint=geometry.getPointAtLength(Math.max(0,Math.min(1,echoProgress))*length);
      strand.echo.setAttribute('cx',echoPoint.x);strand.echo.setAttribute('cy',echoPoint.y);
      strand.echo.setAttribute('opacity',String(echoProgress>0&&echoProgress<1 ? .7 : 0));

    });
    if(moving && age>6.1 && !event.returned) {
      event.returned=true;
      event.returnAllowed=time>=nextBasinReturn && !!outlets;
      if(event.returnAllowed)nextBasinReturn=time+5.2;
    }
    // A single input becomes a small, uneven phrase at a different outlet.
    if(moving && event.returnAllowed && event.outputs<3 && age>6.1+[0,.32,.87][event.outputs]) {
      const origin=floatingPoint(event.pieces[2]);
      const source=basinToNetwork(origin);
      const color=streamColors[(streamColors.indexOf(event.color)+2+event.outputs)%4];
      launchFlight(source,color,time,'factory',origin);
      launchFlight(source,color,time,'edge',origin);
      event.outputs++;
    }
    return true;
  });
  basinCharge=Math.min(1.4,basinCharge);
  if(network) network.style.setProperty('--factory-return',String(Math.max(0,1-(time-factoryReturn)/2)));
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
  old.forEach(w=>{w.coupled=false;w.node.classList.remove('is-coupled');w.aura.setAttribute('opacity','0');});
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
    link.geometry=setCurve(link.path,[previous.x,previous.y,previous.x+dx*.33+nx*bend,previous.y+dy*.33+ny*bend,end.x-dx*.33+nx*bend,end.y-dy*.33+ny*bend,end.x,end.y]);
    link.length=link.geometry.length; previous=end;
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
    const p=link.geometry.getPointAtLength(packet.distance);packet.point=p;
    packet.node.setAttribute('cx',p.x);packet.node.setAttribute('cy',p.y);
    packet.node.setAttribute('fill',streamColors[packet.hop%4]);
    packet.node.setAttribute('r',2.4+packet.hop*.35);
    return true;
  });
  chain.forEach(w=>w.aura.setAttribute('opacity',String(.025+Math.max(0,1-(time-(w.energized??-100))/1.2)*.12)));
  flights=flights.filter(f=>{
    if(moving) f.distance+=elapsed*210;
    const p=f.geometry.getPointAtLength(Math.min(f.distance,f.length));
    f.dot.setAttribute('cx',p.x);f.dot.setAttribute('cy',p.y);
    f.tail.setAttribute('stroke-dashoffset',String(48-f.distance));
    if(f.distance>=f.length) {
      if(f.target==='basin')receiveBasin(f.color,time);
      if(f.target==='factory') {
        factoryReturn=time; nextPacket=time;
        walkers.forEach(w=>{w.routeBias++;w.energized=time;});
      }
      f.group.remove();return false;
    }
    return true;
  });
}

let lastFrame = 0, flowTime = 0, stillComposition = false;
function moveFigures(now) {
  const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
  lastFrame = now;
  const moving = !paused && !document.hidden;
  if (!moving && (flowTime>0 || stillComposition)) {
    if (travellers.length || water) requestAnimationFrame(moveFigures);
    return;
  }
  if (moving) flowTime += elapsed;
  // Reduced motion starts with an inhabited, open factory, rather than an empty page.
  if (paused && flowTime === 0 && !stillComposition) {
    walkers.forEach((walker,i) => { walker.wait = 0; advanceWalker(walker,18+i*115,i); });
    doorOpening = 1; stillComposition = true; rebuildChain(0);
  }
  walkers.forEach((walker,i) => {
    if (moving) {
      if (walker.wait > 0) walker.wait = Math.max(0,walker.wait-elapsed);
      else advanceWalker(walker,elapsed*(21+i%3*2),i);
    }
    drawWalker(walker,i,flowTime);
  });
  stepBasinMood(elapsed,moving);
  basinPieces.forEach((node,i) => {
    const [cx,cy]=pieceCenters[i], t=basinPhase/(2.2+i*.19), phase=i*1.3;
    // Original trajectories and amplitudes remain intact. A smoothly integrated
    // clock eases into distinct slower/faster rhythms; arrivals never kick or reset a piece.
    const dx=Math.sin(t+phase)*(i===5?12:45)+Math.sin(basinPhase/7+phase)*16;
    const dy=Math.cos(t*1.3+phase)*15;
    const angle=Math.sin(t+phase)*(i===2?9:15);
    Object.assign(pieceDrifts[i],{x:dx,y:dy,angle});
    node.setAttribute('transform',`translate(${dx} ${dy}) rotate(${angle} ${cx} ${cy})`);
  });
  drawChains(flowTime,elapsed,moving);
  transformBasin(flowTime,elapsed,moving);
  if (doorLeft) {
    const opening = flowTime-factoryReturn<1.5 || walkers.some(w => (w.wait > 0 && w.wait < 1.2) || (w.wait === 0 && w.edge === 'threshold' && w.distance < 28));
    if (moving) doorOpening += ((opening ? 1 : .12)-doorOpening)*Math.min(1,elapsed*3);
    const a = 1-1.8*doorOpening, b = .4*doorOpening;
    doorLeft.setAttribute('transform',`matrix(${a} ${b} 0 1 ${504*(1-a)} ${-504*b})`);
    doorRight.setAttribute('transform',`matrix(${a} ${-b} 0 1 ${550*(1-a)} ${550*b})`);
  }
  smokePuffs.forEach((node,i) => {
    const stack = i%3, age = (flowTime/(6.5+stack) + Math.floor(i/3)/6)%1;
    const origins = [[680,289],[919,394],[986,480]];
    const [x,y] = origins[stack];
    const spread = 10 + age*74;
    const drift = age*age*(170-stack*25) + Math.sin(age*8+i*.8)*age*34;
    node.setAttribute('cx',String(x+drift));node.setAttribute('cy',String(y-age*(340-stack*45)));
    node.setAttribute('rx',String(spread));node.setAttribute('ry',String(spread*.8));
    node.setAttribute('opacity',String(Math.sin(Math.PI*age)**.7*.72));
  });
  if (water) {
    const sway=Math.sin(basinPhase/1.8);
    water.setAttribute('transform',`translate(${sway*19} ${Math.sin(basinPhase/1.4)*9}) rotate(${sway*1.8} 730 530)`);
    distortion.setAttribute('scale',String(18+Math.sin(basinPhase/1.6)*12));
    surfaceCurrents.forEach((path,i)=>{
      const y=340+i*57;
      let d='';
      for(let x=130;x<=1320;x+=36) {
        const wave=Math.sin(x/85-basinPhase*2+i*.7)*10+Math.sin(x/160+basinPhase*1.4)*8;
        d+=`${x===130?'M':'L'}${x} ${y+wave} `;
      }
      path.setAttribute('d',d);
      path.removeAttribute('opacity');
    });
    ripples.forEach((node,i)=>{
      const pulse=(basinPhase/5+i*.5)%1;
      node.setAttribute('rx',String(38+pulse*115));
      node.setAttribute('ry',String(12+pulse*34));
      node.setAttribute('opacity',String((1-pulse)*.4));
    });
  }

  if (travellers.length || water) requestAnimationFrame(moveFigures);
}
if (travellers.length || water) requestAnimationFrame(moveFigures);
