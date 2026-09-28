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

// The figures travel in diagonal currents, turning beyond the left viewport edge.
const travellers = [...document.querySelectorAll('.travelling-figure')];
const basinPieces = [...document.querySelectorAll('.basin-piece')];
const water = document.querySelector('.sloshing-water');
const distortion = document.querySelector('#water-distortion feDisplacementMap');
const ripples = [...document.querySelectorAll('.basin-ripples ellipse')];
const routes = [...document.querySelectorAll('.network-lines path')];
let routeLengths = routes.map(path => path.getTotalLength());
const surfaceCurrents = [...document.querySelectorAll('.surface-currents path')];
const smokePuffs = [...document.querySelectorAll('.smoke-puff')];
const network = document.querySelector('.figure-network');
const factory = document.querySelector('.factory-scene');
function measureConnections() {
  if (!network || !factory) return;
  const n = network.getBoundingClientRect(), f = factory.getBoundingClientRect();
  const scale = n.width / 600;
  const compact = window.matchMedia('(max-width: 550px)').matches;
  const doorX = compact ? 350 : (f.left + f.width * .343 - n.left) / scale;
  const doorY = compact ? 640 : (f.top + f.height * .9 - n.top) / scale;
  // Shared couplings split, loop, and meet again; no single privileged outlet.
  const inlet = `M${doorX} ${doorY} C${doorX-75} ${doorY-100} 470 560 350 470`;
  const secondInlet = `M${doorX+48} ${doorY-20} C${doorX+140} ${doorY-210} 535 495 350 470`;
  const branches = [
    `${inlet} C210 448 330 315 205 290 C105 270 158 166 58 135 S-90 175 -250 80`,
    `${inlet} C405 410 462 320 360 245 C250 165 165 225 205 290 C260 385 76 403 -245 355`,
    `${secondInlet} C235 540 104 488 145 415 C196 330 300 405 205 290 C85 177 -30 250 -250 220`,
    `${secondInlet} C425 395 365 352 290 390 C170 450 135 328 205 290 C278 250 332 132 220 103 S45 110 -230 35`,
    `M205 290 C100 327 113 409 145 415 C210 450 325 456 350 470 C450 512 489 580 406 607 S193 558 145 415`,
    `M350 470 C408 422 420 299 360 245 C295 185 361 120 408 158 C471 211 296 365 205 290`
  ];
  routes.forEach((path,i) => path.setAttribute('d', branches[i]));
  routeLengths = routes.map(path => path.getTotalLength());
}
if (network) {
  new ResizeObserver(measureConnections).observe(document.querySelector('main'));
  window.addEventListener('resize',measureConnections);
  measureConnections();
}
let lastFrame = 0, flowTime = 0;
function moveFigures(now) {
  const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
  lastFrame = now;
  if (!paused && !document.hidden) flowTime += elapsed;
  travellers.forEach((node,i) => {
    const journey = flowTime / (64 + (i % 3) * 9) + i / travellers.length;
    const lane = (i + Math.floor(journey) * 2) % routes.length;
    const progress = journey % 1;
    const point = routes[lane].getPointAtLength(progress * routeLengths[lane]);
    const emergence = Math.min(1, progress / .055);
    const size = .3 + emergence * .38;
    node.setAttribute('transform', `translate(${point.x} ${point.y}) skewX(${Math.sin(flowTime*1.2+i)*2}) scale(${size})`);
    node.setAttribute('opacity', String(Math.min(1, progress / .035, (1-progress)/.045)));
  });
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
      node.setAttribute('opacity', String((1 - pulse) * .4));
    });
  }
  if (travellers.length || water) requestAnimationFrame(moveFigures);
}
if (travellers.length || water) requestAnimationFrame(moveFigures);
