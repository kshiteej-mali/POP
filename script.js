
document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.add('active');
    });
  });
  document.querySelectorAll('.card-nav').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.target;
      const navBtn = document.querySelector(`.nav-btn[data-target="${target}"]`);
      if (navBtn) navBtn.click();
    });
  });
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      const homeBtn = document.querySelector('.nav-btn[data-target="home"]');
      if (homeBtn) homeBtn.click();
    });
  }
  initVernier();
  initScrew();
  initSpherometer();
});
function initVernier() {
  const mainTicksContainer = document.getElementById('main-ticks');
  const vernierTicksContainer = document.getElementById('vernier-ticks');
  const slider = document.getElementById('vernier-slider');
  const depthBlade = document.getElementById('depth-blade');
  const modeBtn = document.getElementById('vernier-mode-btn');
  const svg = document.getElementById('vernier-svg');
  const caliperAssembly = document.getElementById('caliper-assembly');
  const depthBeaker = document.getElementById('depth-beaker');
  const valInput = document.getElementById('vernier-val');
  const errorInput = document.getElementById('vernier-error');
  const msrInput = document.getElementById('vernier-msr-input');
  const vsdInput = document.getElementById('vernier-vsd-input');
  const msrSpan = document.getElementById('vernier-msr');
  const vsrSpan = document.getElementById('vernier-vsr');
  const observedSpan = document.getElementById('vernier-observed');
  const correctedSpan = document.getElementById('vernier-corrected');
  for (let i = 0; i <= 50; i++) {
    const x = 150 + i * 10;
    const isMajor = i % 10 === 0;
    const isHalf = i % 5 === 0 && !isMajor;
    const height = isMajor ? 16 : (isHalf ? 11 : 7);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 100);
    line.setAttribute('x2', x);
    line.setAttribute('y2', 100 - height);
    line.setAttribute('stroke', '#2c2c2e');
    line.setAttribute('stroke-width', isMajor ? '2' : '1');
    mainTicksContainer.appendChild(line);
    if (isMajor) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', 80);
      text.setAttribute('fill', '#1c1c1e');
      text.setAttribute('font-size', '11');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = i / 10;
      mainTicksContainer.appendChild(text);
    }
  }
  for (let i = 0; i <= 10; i++) {
    const x = 150 + i * 9;
    const isMajor = i % 5 === 0;
    const height = isMajor ? 12 : 7;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 100);
    line.setAttribute('x2', x);
    line.setAttribute('y2', 100 + height);
    line.setAttribute('stroke', '#1c1c1e');
    line.setAttribute('stroke-width', '1.5');
    vernierTicksContainer.appendChild(line);
    if (isMajor) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', 124);
      text.setAttribute('fill', '#1c1c1e');
      text.setAttribute('font-size', '9');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = i;
      vernierTicksContainer.appendChild(text);
    }
  }
  let activeTrigger = null;
  let activeObj = 'none';
  function update() {
    let rawVal = parseFloat(valInput.value);
    const zeroError = parseFloat(errorInput.value) || 0;
    if (activeTrigger === 'inputs') {
      const msrVal = parseInt(msrInput.value) || 0;
      const vsdVal = parseInt(vsdInput.value) || 0;
      const observedVal = msrVal + vsdVal * 0.1;
      rawVal = Math.max(0, observedVal - zeroError);
      valInput.value = rawVal;
    } else {
      const observedVal = rawVal + zeroError;
      const msr = Math.floor(observedVal);
      const vsd = Math.round((observedVal - msr) * 10);
      msrInput.value = msr;
      vsdInput.value = vsd;
    }
    slider.setAttribute('transform', `translate(${rawVal * 10}, 0)`);
    vernierTicksContainer.setAttribute('transform', `translate(${zeroError * 10}, 0)`);
    const finalObserved = rawVal + zeroError;
    const finalMSR = Math.floor(finalObserved);
    const finalVSD = Math.round((finalObserved - finalMSR) * 10);
    const finalVSR = finalVSD * 0.1;
    const finalCorrected = finalObserved - zeroError;
    msrSpan.textContent = `${finalMSR.toFixed(1)} mm`;
    vsrSpan.textContent = `${finalVSR.toFixed(1)} mm (Div: ${finalVSD})`;
    observedSpan.textContent = `${finalObserved.toFixed(1)} mm`;
    correctedSpan.textContent = `${finalCorrected.toFixed(1)} mm`;
    const readoutBox = document.querySelector('#vernier .readout');
    let isMatch = false;
    if (activeObj === 'cylOut' && Math.abs(finalCorrected - 24.0) < 0.05) isMatch = true;
    if (activeObj === 'cylIn' && Math.abs(finalCorrected - 16.0) < 0.05) isMatch = true;
    if (activeObj === 'rect' && Math.abs(finalCorrected - 42.5) < 0.05) isMatch = true;
    if (activeObj === 'sq' && Math.abs(finalCorrected - 30.0) < 0.05) isMatch = true;
    if (isMatch) {
      readoutBox.style.borderColor = 'var(--accent)';
      readoutBox.style.boxShadow = '0 0 15px rgba(228, 184, 66, 0.6)';
    } else {
      readoutBox.style.borderColor = '';
      readoutBox.style.boxShadow = '';
    }
  }
  valInput.addEventListener('input', () => {
    activeTrigger = 'slider';
    update();
  });
  errorInput.addEventListener('input', () => {
    if (!activeTrigger) activeTrigger = 'slider';
    update();
  });
  msrInput.addEventListener('input', () => {
    activeTrigger = 'inputs';
    update();
  });
  vsdInput.addEventListener('input', () => {
    activeTrigger = 'inputs';
    update();
  });
  let mode = 'jaw';
  let zoomLevel = 1.0;
  const vernierViewport = document.getElementById('vernier-viewport');
  const zoomInBtn = document.getElementById('vernier-zoom-in');
  const zoomOutBtn = document.getElementById('vernier-zoom-out');
  let isPanning = false;
  let startX = 0, startY = 0;
  let panX = 0, panY = 0;
  let currentPanX = 0, currentPanY = 0;
  function applyZoom() {
    const scale = 1 / zoomLevel;
    const px = panX + currentPanX;
    const py = panY + currentPanY;
    if (mode === 'jaw') {
      vernierViewport.style.transform = `scale(${scale}) translate(${px}px, ${py}px)`;
    } else {
      vernierViewport.style.transform = `scale(${scale}) translate(${-375 + px}px, ${-55 + py}px)`;
    }
  }
  zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.max(0.4, zoomLevel - 0.1);
    applyZoom();
  });
  zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.min(2.0, zoomLevel + 0.1);
    applyZoom();
  });
  function startPan(clientX, clientY) {
    isPanning = true;
    startX = clientX;
    startY = clientY;
    currentPanX = 0;
    currentPanY = 0;
    svg.style.cursor = 'grabbing';
  }
  function movePan(clientX, clientY) {
    if (!isPanning) return;
    currentPanX = (clientX - startX) * zoomLevel;
    currentPanY = (clientY - startY) * zoomLevel;
    applyZoom();
  }
  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    panX += currentPanX;
    panY += currentPanY;
    currentPanX = 0;
    currentPanY = 0;
    svg.style.cursor = 'grab';
  }
  svg.addEventListener('mousedown', (e) => startPan(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => movePan(e.clientX, e.clientY));
  window.addEventListener('mouseup', endPan);
  svg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
  });
  window.addEventListener('touchmove', (e) => {
    if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener('touchend', endPan);
  svg.style.cursor = 'grab';
  modeBtn.addEventListener('click', () => {
    const graphicBox = document.querySelector('.sim-graphic');
    if (mode === 'jaw') {
      mode = 'depth';
      modeBtn.textContent = 'Flip to Jaw Mode';
      caliperAssembly.style.transform = 'rotate(90deg)';
      depthBeaker.style.opacity = '1';
    } else {
      mode = 'jaw';
      modeBtn.textContent = 'Flip to Depth Mode';
      caliperAssembly.style.transform = 'rotate(0deg)';
      depthBeaker.style.opacity = '0';
    }
    panX = 0; panY = 0;
    applyZoom();
  });
  const objBtns = {
    none: document.getElementById('obj-none-btn'),
    cylOut: document.getElementById('obj-cyl-out-btn'),
    cylIn: document.getElementById('obj-cyl-in-btn'),
    rect: document.getElementById('obj-rect-btn'),
    sq: document.getElementById('obj-sq-btn')
  };
  const svgObjs = {
    cylOut: document.getElementById('svg-obj-cyl-out'),
    cylIn: document.getElementById('svg-obj-cyl-in'),
    rect: document.getElementById('svg-obj-rect'),
    sq: document.getElementById('svg-obj-square')
  };
  const objDesc = document.getElementById('object-desc');
  function selectObject(objKey, targetVal, descText) {
    Object.values(objBtns).forEach(btn => btn.classList.remove('active'));
    objBtns[objKey].classList.add('active');
    activeObj = objKey;
    Object.keys(svgObjs).forEach(key => {
      svgObjs[key].style.display = (key === objKey) ? 'block' : 'none';
    });
    objDesc.textContent = descText;
    if (objKey !== 'none') {
      activeTrigger = 'slider';
      valInput.value = targetVal;
    }
    update();
  }
  objBtns.none.addEventListener('click', () => selectObject('none', 0, 'Drag the slider or adjust inputs to measure freely.'));
  objBtns.cylOut.addEventListener('click', () => selectObject('cylOut', 24.0, 'Target outer diameter: 24.0 mm. Jaws aligned to clamp the metallic cylinder.'));
  objBtns.cylIn.addEventListener('click', () => selectObject('cylIn', 16.0, 'Target inner diameter: 16.0 mm. Internal jaws expanded inside the hollow ring.'));
  objBtns.rect.addEventListener('click', () => selectObject('rect', 42.5, 'Target width: 42.5 mm. Jaws aligned to measure the wooden block.'));
  objBtns.sq.addEventListener('click', () => selectObject('sq', 30.0, 'Target width: 30.0 mm. Jaws aligned to measure the acrylic block.'));
  update();
}
function initScrew() {
  const mainTicks = document.getElementById('screw-main-ticks');
  const circularTicks = document.getElementById('circular-ticks');
  const spindle = document.getElementById('spindle');
  const thimble = document.getElementById('thimble');
  const valInput = document.getElementById('screw-val');
  const errorInput = document.getElementById('screw-error');
  const psrSpan = document.getElementById('screw-psr');
  const csrSpan = document.getElementById('screw-csr');
  const observedSpan = document.getElementById('screw-observed');
  const correctedSpan = document.getElementById('screw-corrected');
  for (let i = 0; i <= 30; i++) {
    const x = 180 + i * 6;
    const isUpper = i % 2 === 0;
    const y1 = 120;
    const y2 = isUpper ? 110 : 130;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#c9b1d6');
    line.setAttribute('stroke-width', '1.5');
    mainTicks.appendChild(line);
    if (isUpper && i % 10 === 0) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', 102);
      text.setAttribute('fill', '#e5b842');
      text.setAttribute('font-size', '10');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = i / 2;
      mainTicks.appendChild(text);
    }
  }
  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseline.setAttribute('x1', 180);
  baseline.setAttribute('y1', 120);
  baseline.setAttribute('x2', 360);
  baseline.setAttribute('y2', 120);
  baseline.setAttribute('stroke', '#c9b1d6');
  baseline.setAttribute('stroke-width', '2');
  mainTicks.appendChild(baseline);
  function drawCircularScale(offsetDiv) {
    circularTicks.innerHTML = '';
    for (let i = -10; i <= 10; i++) {
      const divNum = (Math.round(offsetDiv) + i + 100) % 100;
      const y = 120 - i * 5;
      if (y >= 90 && y <= 150) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', y);
        line.setAttribute('x2', 15);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#f9f2fc');
        line.setAttribute('stroke-width', divNum % 5 === 0 ? '2' : '1');
        circularTicks.appendChild(line);
        if (divNum % 5 === 0) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', 25);
          text.setAttribute('y', y + 3);
          text.setAttribute('fill', '#e5b842');
          text.setAttribute('font-size', '9');
          text.textContent = divNum;
          circularTicks.appendChild(text);
        }
      }
    }
  }
  function update() {
    const rawVal = parseFloat(valInput.value);
    const zeroError = parseFloat(errorInput.value) || 0;
    const visualVal = rawVal + zeroError;
    const xPos = 180 + visualVal * 12;
    thimble.setAttribute('transform', `translate(${xPos}, 0)`);
    spindle.setAttribute('transform', `translate(${rawVal * 12}, 0)`);
    const pitch = 1.0;
    const psr = Math.floor(visualVal / pitch) * pitch;
    const csrVal = ((visualVal - psr) * 100) % 100;
    const csrDiv = Math.round(csrVal);
    const csr = csrDiv * 0.01;
    const observed = psr + csr;
    const corrected = observed - zeroError;
    drawCircularScale(csrDiv);
    psrSpan.textContent = `${psr.toFixed(2)} mm`;
    csrSpan.textContent = `${csr.toFixed(2)} mm (Div: ${csrDiv})`;
    observedSpan.textContent = `${observed.toFixed(2)} mm`;
    correctedSpan.textContent = `${corrected.toFixed(2)} mm`;
  }
  let zoomLevel = 1.0;
  const svg = document.getElementById('screw-svg');
  const zoomInBtn = document.getElementById('screw-zoom-in');
  const zoomOutBtn = document.getElementById('screw-zoom-out');
  let isPanning = false;
  let startX = 0, startY = 0;
  let panX = 0, panY = 0;
  let currentPanX = 0, currentPanY = 0;
  function applyZoom() {
    const w = 800 * zoomLevel;
    const h = 250 * zoomLevel;
    const x = 400 - w / 2 - (panX + currentPanX);
    const y = 125 - h / 2 - (panY + currentPanY);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }
  zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.max(0.4, zoomLevel - 0.1);
    applyZoom();
  });
  zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.min(2.0, zoomLevel + 0.1);
    applyZoom();
  });
  function startPan(clientX, clientY) {
    isPanning = true;
    startX = clientX;
    startY = clientY;
    currentPanX = 0;
    currentPanY = 0;
    svg.style.cursor = 'grabbing';
  }
  function movePan(clientX, clientY) {
    if (!isPanning) return;
    currentPanX = (clientX - startX) * zoomLevel;
    currentPanY = (clientY - startY) * zoomLevel;
    applyZoom();
  }
  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    panX += currentPanX;
    panY += currentPanY;
    currentPanX = 0;
    currentPanY = 0;
    svg.style.cursor = 'grab';
  }
  svg.addEventListener('mousedown', (e) => startPan(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => movePan(e.clientX, e.clientY));
  window.addEventListener('mouseup', endPan);
  svg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
  });
  window.addEventListener('touchmove', (e) => {
    if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener('touchend', endPan);
  svg.style.cursor = 'grab';
  valInput.addEventListener('input', update);
  errorInput.addEventListener('input', update);
  update();
}
function initSpherometer() {
  const base = document.getElementById('spherometer-base');
  const screw = document.getElementById('spherometer-screw');
  const discTicks = document.getElementById('disc-ticks');
  const surfaceSelect = document.getElementById('spherometer-surface');
  const aInput = document.getElementById('spherometer-a');
  const hInput = document.getElementById('spherometer-h');
  const errorInput = document.getElementById('spherometer-error');
  const hValSpan = document.getElementById('spherometer-h-val');
  const rSpan = document.getElementById('spherometer-r');
  function drawDiscScale(offsetDiv) {
    discTicks.innerHTML = '';
    for (let i = 0; i < 360; i += 18) {
      const angle = (i * Math.PI) / 180;
      const x1 = 400 + Math.cos(angle) * 28;
      const y1 = 80 + Math.sin(angle) * 28;
      const x2 = 400 + Math.cos(angle) * 35;
      const y2 = 80 + Math.sin(angle) * 35;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', '#f9f2fc');
      line.setAttribute('stroke-width', i % 90 === 0 ? '2' : '1');
      discTicks.appendChild(line);
    }
  }
  function update() {
    const surface = surfaceSelect.value;
    const a = parseFloat(aInput.value) || 50;
    const hRaw = parseFloat(hInput.value);
    const zeroError = parseFloat(errorInput.value) || 0;
    let baseD = "M 200 220 L 600 220";
    let yScrewOffset = 0;
    if (surface === "convex") {
      baseD = "M 200 220 Q 400 180 600 220";
      yScrewOffset = -25;
    } else if (surface === "concave") {
      baseD = "M 200 220 Q 400 260 600 220";
      yScrewOffset = 25;
    }
    base.setAttribute('d', baseD);
    const travel = hRaw * 10;
    screw.setAttribute('transform', `translate(0, ${yScrewOffset + travel})`);
    const correctedH = Math.max(0, hRaw - zeroError);
    hValSpan.textContent = `${correctedH.toFixed(2)} mm`;
    if (correctedH === 0) {
      rSpan.textContent = "Infinity";
    } else {
      const r = (a * a) / (6 * correctedH) + correctedH / 2;
      rSpan.textContent = `${r.toFixed(2)} mm`;
    }
    const discDiv = Math.round((hRaw * 100) % 100);
    drawDiscScale(discDiv);
  }
  let zoomLevel = 1.0;
  const svg = document.getElementById('spherometer-svg');
  const zoomInBtn = document.getElementById('sph-zoom-in');
  const zoomOutBtn = document.getElementById('sph-zoom-out');
  let isPanning = false;
  let startX = 0, startY = 0;
  let panX = 0, panY = 0;
  let currentPanX = 0, currentPanY = 0;
  function applyZoom() {
    const w = 800 * zoomLevel;
    const h = 250 * zoomLevel;
    const x = 400 - w / 2 - (panX + currentPanX);
    const y = 125 - h / 2 - (panY + currentPanY);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }
  zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.max(0.4, zoomLevel - 0.1);
    applyZoom();
  });
  zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.min(2.0, zoomLevel + 0.1);
    applyZoom();
  });
  function startPan(clientX, clientY) {
    isPanning = true;
    startX = clientX;
    startY = clientY;
    currentPanX = 0;
    currentPanY = 0;
    svg.style.cursor = 'grabbing';
  }
  function movePan(clientX, clientY) {
    if (!isPanning) return;
    currentPanX = (clientX - startX) * zoomLevel;
    currentPanY = (clientY - startY) * zoomLevel;
    applyZoom();
  }
  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    panX += currentPanX;
    panY += currentPanY;
    currentPanX = 0;
    currentPanY = 0;
    svg.style.cursor = 'grab';
  }
  svg.addEventListener('mousedown', (e) => startPan(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => movePan(e.clientX, e.clientY));
  window.addEventListener('mouseup', endPan);
  svg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
  });
  window.addEventListener('touchmove', (e) => {
    if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener('touchend', endPan);
  svg.style.cursor = 'grab';
  surfaceSelect.addEventListener('change', update);
  aInput.addEventListener('input', update);
  hInput.addEventListener('input', update);
  errorInput.addEventListener('input', update);
  update();
}
