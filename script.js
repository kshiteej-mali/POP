
class SplitFlapText {
  constructor(container, options = {}) {
    this.container = container;
    this.flipDuration = options.flipDuration || 280;
    this.stagger = options.stagger || 30;
    this.currentText = "";
  }

  setText(newText) {
    const textStr = String(newText);
    if (this.currentText === textStr) return;

    const chars = textStr.split('');
    const prevChars = (this.currentText || '').split('');
    this.currentText = textStr;

    let tiles = this.container.querySelectorAll('.split-flap-tile');
    if (tiles.length !== chars.length) {
      this.container.innerHTML = '';
      chars.forEach((c) => {
        const tile = document.createElement('div');
        tile.className = `split-flap-tile ${c === '.' ? 'char-dot' : ''} ${c === ' ' ? 'char-space' : ''}`;
        tile.dataset.char = c;
        tile.innerHTML = `
          <div class="flap top"><span class="char">${c}</span></div>
          <div class="flap bottom"><span class="char">${c}</span></div>
          <div class="flap leaf"><span class="char">${c}</span></div>
          <div class="flap-divider"></div>
        `;
        this.container.appendChild(tile);
      });
      return;
    }

    tiles.forEach((tile, i) => {
      const targetChar = chars[i];
      const oldChar = tile.dataset.char || prevChars[i] || ' ';
      tile.className = `split-flap-tile ${targetChar === '.' ? 'char-dot' : ''} ${targetChar === ' ' ? 'char-space' : ''}`;

      if (oldChar !== targetChar) {
        setTimeout(() => {
          this.animateFlip(tile, oldChar, targetChar);
        }, i * this.stagger);
      }
    });
  }

  animateFlip(tile, fromChar, toChar) {
    tile.dataset.char = toChar;
    const topChar = tile.querySelector('.flap.top .char');
    const bottomChar = tile.querySelector('.flap.bottom .char');
    const leaf = tile.querySelector('.flap.leaf');
    const leafChar = leaf.querySelector('.char');

    topChar.textContent = toChar;
    bottomChar.textContent = fromChar;
    leafChar.textContent = fromChar;

    tile.classList.remove('flipping');
    void tile.offsetWidth;
    tile.classList.add('flipping');

    setTimeout(() => {
      bottomChar.textContent = toChar;
      leafChar.textContent = toChar;
      tile.classList.remove('flipping');
    }, this.flipDuration);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');
  let isNavigating = false;

  function triggerMathRender() {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
          ],
          throwOnError: false
        });
      } catch(e) {}
    }
  }

  function navigateToSection(targetId) {
    if (isNavigating) return;
    const currentActive = document.querySelector('.section.active');
    const targetSection = document.getElementById(targetId);
    if (!targetSection || currentActive === targetSection) return;

    isNavigating = true;

    navButtons.forEach(b => {
      if (b.dataset.target === targetId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (currentActive) {
      currentActive.classList.add('morph-out');
      setTimeout(() => {
        currentActive.classList.remove('active', 'morph-out');
        targetSection.classList.add('active', 'morph-in');
        
        triggerMathRender();
        playInstrumentIntro(targetId);

        setTimeout(() => {
          targetSection.classList.remove('morph-in');
          isNavigating = false;
        }, 360);
      }, 200);
    } else {
      targetSection.classList.add('active', 'morph-in');
      triggerMathRender();
      playInstrumentIntro(targetId);
      setTimeout(() => {
        targetSection.classList.remove('morph-in');
        isNavigating = false;
      }, 360);
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navigateToSection(btn.dataset.target);
    });
  });

  document.querySelectorAll('.card-nav').forEach(card => {
    card.addEventListener('click', () => {
      navigateToSection(card.dataset.target);
    });
  });

  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      navigateToSection('home');
    });
  }

  initVernier();
  initScrew();
  initSpherometer();
  initBeamsBackground();
  initParticleText();
  initStrokeTextIntros();

  triggerMathRender();
  setTimeout(triggerMathRender, 300);
  setTimeout(triggerMathRender, 800);
});
const VernierEngine = {
  LEAST_COUNT_MM: 0.1,

  calculate(msr, vsd, zeroError = 0, leastCount = 0.1) {
    const validMSR = Math.max(0, Math.floor(Number(msr) || 0));
    const validVSD = Math.max(0, Math.min(10, Math.round(Number(vsd) || 0)));
    const validError = Number(zeroError) || 0;
    
    const vsr = Math.round((validVSD * leastCount) * 1000) / 1000;
    const observed = Math.round((validMSR + vsr) * 1000) / 1000;
    const corrected = Math.round((observed - validError) * 1000) / 1000;

    return {
      msr: validMSR,
      vsd: validVSD,
      leastCount,
      vsr,
      observed,
      zeroError: validError,
      corrected,
      steps: {
        vsrCalc: `${validVSD} × ${leastCount.toFixed(2)} mm = ${vsr.toFixed(2)} mm`,
        observedCalc: `${validMSR.toFixed(1)} + (${validVSD} × ${leastCount.toFixed(2)}) = ${observed.toFixed(2)} mm`,
        correctedCalc: `${observed.toFixed(2)} - (${validError >= 0 ? '+' : ''}${validError.toFixed(2)}) = ${corrected.toFixed(2)} mm`
      }
    };
  },

  simulateMeasurement(trueThicknessMm, zeroErrorMm = 0) {
    const targetObserved = Math.max(0, Math.round((trueThicknessMm + zeroErrorMm) * 10) / 10);
    const msr = Math.floor(targetObserved);
    const vsd = Math.round((targetObserved - msr) * 10);
    const calc = this.calculate(msr, vsd, zeroErrorMm, this.LEAST_COUNT_MM);
    const isTrue = Math.abs(calc.corrected - trueThicknessMm) < 0.001;
    return {
      trueThicknessMm,
      zeroErrorMm,
      ...calc,
      isTrue
    };
  }
};

const ScrewEngine = {
  DEFAULT_PITCH: 1.0,
  DEFAULT_DIVISIONS: 100,

  calculateLeastCount(pitch = 1.0, divisions = 100) {
    const p = Number(pitch) > 0 ? Number(pitch) : 1.0;
    const d = Math.max(1, Math.round(Number(divisions) || 100));
    return Math.round((p / d) * 10000) / 10000;
  },

  calculate(msr, csr, zeroError = 0, pitch = 1.0, divisions = 100) {
    const validPitch = Number(pitch) > 0 ? Number(pitch) : 1.0;
    const validDivs = Math.max(1, Math.round(Number(divisions) || 100));
    const lc = this.calculateLeastCount(validPitch, validDivs);

    const validMSR = Math.max(0, Number(msr) || 0);
    const validCSR = Math.max(0, Math.round(Number(csr) || 0));
    const validError = Number(zeroError) || 0;

    const csrMm = Math.round((validCSR * lc) * 10000) / 10000;
    const observed = Math.round((validMSR + csrMm) * 10000) / 10000;
    const corrected = Math.round((observed - validError) * 10000) / 10000;

    return {
      pitch: validPitch,
      divisions: validDivs,
      leastCount: lc,
      msr: validMSR,
      csr: validCSR,
      csrMm,
      observed,
      zeroError: validError,
      corrected,
      steps: {
        lcCalc: `LC = Pitch / Circular Divisions = ${validPitch.toFixed(2)} mm / ${validDivs} = ${lc.toFixed(4)} mm`,
        csrCalc: `CSR = ${validCSR} × ${lc.toFixed(4)} mm = ${csrMm.toFixed(3)} mm`,
        observedCalc: `Observed = ${validMSR.toFixed(2)} mm + ${csrMm.toFixed(3)} mm = ${observed.toFixed(3)} mm`,
        correctedCalc: `Corrected = ${observed.toFixed(3)} mm - (${validError >= 0 ? '+' : ''}${validError.toFixed(3)} mm) = ${corrected.toFixed(3)} mm`
      }
    };
  },

  simulateMeasurement(trueThicknessMm, zeroErrorMm = 0, pitch = 1.0, divisions = 100) {
    const lc = this.calculateLeastCount(pitch, divisions);
    const targetObserved = Math.max(0, Math.round((trueThicknessMm + zeroErrorMm) * (1 / lc)) * lc);
    const msr = Math.floor(targetObserved / pitch) * pitch;
    const csr = Math.round((targetObserved - msr) / lc) % divisions;
    const calc = this.calculate(msr, csr, zeroErrorMm, pitch, divisions);
    const isTrue = Math.abs(calc.corrected - trueThicknessMm) < 0.001;
    return {
      trueThicknessMm,
      zeroErrorMm,
      ...calc,
      isTrue
    };
  }
};

const SpherometerEngine = {
  DEFAULT_PITCH: 1.0,
  DEFAULT_DIVISIONS: 100,

  calculateLeastCount(pitch = 1.0, divisions = 100) {
    const p = Number(pitch) > 0 ? Number(pitch) : 1.0;
    const d = Math.max(1, Math.round(Number(divisions) || 100));
    return Math.round((p / d) * 10000) / 10000;
  },

  calculate(msr, csr, zeroError = 0, pitch = 1.0, divisions = 100, legDistance = 50) {
    const validPitch = Number(pitch) > 0 ? Number(pitch) : 1.0;
    const validDivs = Math.max(1, Math.round(Number(divisions) || 100));
    const lc = this.calculateLeastCount(validPitch, validDivs);

    const validMSR = Number(msr) || 0;
    const validCSR = Math.max(0, Math.round(Number(csr) || 0));
    const validError = Number(zeroError) || 0;
    const validL = Math.max(1, Number(legDistance) || 50);

    const csrMm = Math.round((validCSR * lc) * 10000) / 10000;
    const observedH = Math.round((validMSR + csrMm) * 10000) / 10000;
    const correctedH = Math.round((observedH - validError) * 10000) / 10000;

    let radiusOfCurvature = Infinity;
    let rCalc = "R = ∞ (Flat Surface, h = 0)";
    if (Math.abs(correctedH) > 0.0001) {
      const hAbs = Math.abs(correctedH);
      radiusOfCurvature = Math.round(((validL * validL) / (6 * hAbs) + hAbs / 2) * 100) / 100;
      rCalc = `R = (${validL}² / (6 × ${hAbs.toFixed(2)})) + (${hAbs.toFixed(2)} / 2) = ${radiusOfCurvature.toFixed(2)} mm`;
    }

    return {
      pitch: validPitch,
      divisions: validDivs,
      leastCount: lc,
      msr: validMSR,
      csr: validCSR,
      csrMm,
      observedH,
      zeroError: validError,
      correctedH,
      legDistance: validL,
      radiusOfCurvature,
      steps: {
        lcCalc: `LC = Pitch / Circular Divisions = ${validPitch.toFixed(2)} mm / ${validDivs} = ${lc.toFixed(4)} mm`,
        csrCalc: `CSR = ${validCSR} × ${lc.toFixed(4)} mm = ${csrMm.toFixed(3)} mm`,
        observedCalc: `Observed (h) = ${validMSR.toFixed(2)} mm + ${csrMm.toFixed(3)} mm = ${observedH.toFixed(3)} mm`,
        correctedCalc: `Corrected (h) = ${observedH.toFixed(3)} mm - (${validError >= 0 ? '+' : ''}${validError.toFixed(3)} mm) = ${correctedH.toFixed(3)} mm`,
        rCalc
      }
    };
  },

  simulateMeasurement(trueHeightMm, zeroErrorMm = 0, legDistance = 50, pitch = 1.0, divisions = 100) {
    const lc = this.calculateLeastCount(pitch, divisions);
    const targetObserved = Math.round((trueHeightMm + zeroErrorMm) * (1 / lc)) * lc;
    const msr = Math.floor(targetObserved / pitch) * pitch;
    const csr = Math.round((targetObserved - msr) / lc) % divisions;
    const calc = this.calculate(msr, csr, zeroErrorMm, pitch, divisions, legDistance);
    const isTrue = Math.abs(calc.correctedH - trueHeightMm) < 0.001;
    return {
      trueHeightMm,
      zeroErrorMm,
      ...calc,
      isTrue
    };
  }
};

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
  const sensitivitySelect = document.getElementById('vernier-sensitivity');
  const stepDecBtn = document.getElementById('vernier-step-dec');
  const stepIncBtn = document.getElementById('vernier-step-inc');
  const calcBtn = document.getElementById('vernier-calc-btn');
  const resetBtn = document.getElementById('vernier-reset-btn');

  const msrSpan = document.getElementById('vernier-msr');
  const vsdDisplay = document.getElementById('vernier-vsd-display');
  const vsrSpan = document.getElementById('vernier-vsr');
  const observedSpan = document.getElementById('vernier-observed');
  const errorDisplay = document.getElementById('vernier-error-display');
  const correctedSpan = document.getElementById('vernier-corrected');
  const stepsContent = document.getElementById('vernier-steps-content');
  const truthBadge = document.getElementById('vernier-truth-badge');
  const readoutBox = document.getElementById('vernier-readout-box');
  const vernierFlapEl = document.getElementById('vernier-corrected-flap');
  const vernierFlap = vernierFlapEl ? new SplitFlapText(vernierFlapEl) : null;

  mainTicksContainer.innerHTML = '';
  for (let i = 0; i <= 60; i++) {
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

  vernierTicksContainer.innerHTML = '';
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

  let activeTrigger = 'slider';
  let activeObj = 'none';

  function update() {
    let rawVal = parseFloat(valInput.value) || 0;
    const zeroError = parseFloat(errorInput.value) || 0;

    let msr = 0;
    let vsd = 0;

    if (activeTrigger === 'inputs') {
      msr = parseInt(msrInput.value) || 0;
      vsd = parseInt(vsdInput.value) || 0;
      const observedVal = msr + vsd * VernierEngine.LEAST_COUNT_MM;
      rawVal = Math.max(0, Math.min(60, Math.round((observedVal - zeroError) * 10) / 10));
      valInput.value = rawVal;
    } else {
      const observedVal = Math.max(0, Math.round((rawVal + zeroError) * 10) / 10);
      msr = Math.floor(observedVal);
      vsd = Math.round((observedVal - msr) * 10);
      msrInput.value = msr;
      vsdInput.value = vsd;
    }

    const sliderPosMm = (activeTrigger === 'inputs')
      ? (msr + vsd * VernierEngine.LEAST_COUNT_MM)
      : (rawVal + zeroError);
    slider.setAttribute('transform', `translate(${sliderPosMm * 10}, 0)`);
    vernierTicksContainer.removeAttribute('transform');

    const result = VernierEngine.calculate(msr, vsd, zeroError, VernierEngine.LEAST_COUNT_MM);

    msrSpan.textContent = `${result.msr.toFixed(1)} mm`;
    if (vsdDisplay) vsdDisplay.textContent = `${result.vsd}`;
    vsrSpan.textContent = `${result.vsr.toFixed(2)} mm`;
    observedSpan.textContent = `${result.observed.toFixed(2)} mm`;
    if (errorDisplay) {
      const sign = result.zeroError > 0 ? '+' : '';
      errorDisplay.textContent = `${sign}${result.zeroError.toFixed(2)} mm`;
    }
    correctedSpan.textContent = `${result.corrected.toFixed(2)} mm`;

    if (vernierFlap) {
      vernierFlap.setText(`${result.corrected.toFixed(1)} mm`);
    }

    let isMatch = false;
    let expectedDim = null;
    if (activeObj === 'cylOut') expectedDim = 24.0;
    if (activeObj === 'cylIn') expectedDim = 16.0;
    if (activeObj === 'rect') expectedDim = 42.5;
    if (activeObj === 'sq') expectedDim = 30.0;
    if (activeObj === 'depthJar') expectedDim = 28.0;

    if (expectedDim !== null) {
      const diff = Math.abs(result.corrected - expectedDim);
      if (diff < 0.05) {
        isMatch = true;
      }
    } else {
      isMatch = true;
    }

    if (truthBadge) {
      if (isMatch) {
        truthBadge.textContent = 'READING TRUE & VERIFIED';
        truthBadge.style.color = '#2ecc71';
        truthBadge.style.background = 'rgba(39, 174, 96, 0.2)';
        truthBadge.style.borderColor = '#27ae60';
      } else {
        truthBadge.textContent = `TARGET: ${expectedDim} mm (ADJUST JAWS)`;
        truthBadge.style.color = '#f39c12';
        truthBadge.style.background = 'rgba(243, 156, 18, 0.2)';
        truthBadge.style.borderColor = '#f39c12';
      }
    }

    if (readoutBox) {
      if (isMatch && activeObj !== 'none') {
        readoutBox.style.borderColor = 'var(--accent)';
        readoutBox.style.boxShadow = '0 0 15px rgba(254, 198, 1, 0.6)';
      } else {
        readoutBox.style.borderColor = '';
        readoutBox.style.boxShadow = '';
      }
    }
  }

  valInput.addEventListener('input', () => {
    activeTrigger = 'slider';
    update();
  });

  errorInput.addEventListener('input', () => {
    activeTrigger = 'slider';
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

  if (stepDecBtn) {
    stepDecBtn.addEventListener('click', () => {
      activeTrigger = 'slider';
      let curr = parseFloat(valInput.value) || 0;
      valInput.value = Math.max(0, Math.round((curr - 0.1) * 10) / 10);
      update();
    });
  }

  if (stepIncBtn) {
    stepIncBtn.addEventListener('click', () => {
      activeTrigger = 'slider';
      let curr = parseFloat(valInput.value) || 0;
      valInput.value = Math.min(60, Math.round((curr + 0.1) * 10) / 10);
      update();
    });
  }

  if (calcBtn) {
    calcBtn.addEventListener('click', () => {
      update();
      if (readoutBox) {
        readoutBox.style.animation = 'none';
        void readoutBox.offsetWidth;
        readoutBox.style.animation = 'fadeIn 0.3s ease';
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeTrigger = 'slider';
      activeObj = 'none';
      valInput.value = 10;
      errorInput.value = 0;
      msrInput.value = 10;
      vsdInput.value = 0;
      if (sensitivitySelect) sensitivitySelect.value = '1.0';
      selectObject('none', 0, 'Drag the slider or adjust inputs to measure freely.');
      update();
    });
  }

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
      const depthFitScale = scale * 0.48;
      vernierViewport.style.transform = `scale(${depthFitScale}) translate(${px}px, ${-90 + py}px)`;
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

  let isDraggingSlider = false;
  let dragStartClientX = 0;
  let dragStartVal = 0;

  function startDragSlider(clientX) {
    isDraggingSlider = true;
    activeTrigger = 'slider';
    dragStartClientX = clientX;
    dragStartVal = parseFloat(valInput.value) || 0;
    slider.style.transition = 'none';
    slider.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  function moveDragSlider(clientX) {
    if (!isDraggingSlider) return;
    const sensitivity = 1.0; // Default balanced sensitivity
    
    const svgRect = svg.getBoundingClientRect();
    const svgViewWidth = 900;
    const currentScale = (mode === 'depth' ? (1 / zoomLevel) * 0.48 : (1 / zoomLevel));
    const pixelsPerSvgUnit = (svgRect.width / svgViewWidth) * currentScale;
    const pixelsPerMm = pixelsPerSvgUnit * 10;

    const deltaPixels = clientX - dragStartClientX;
    const deltaMm = (deltaPixels / (pixelsPerMm || 10)) * sensitivity;

    let newVal = Math.max(0, Math.min(60, dragStartVal + deltaMm));
    newVal = Math.round(newVal * 10) / 10;
    valInput.value = newVal;
    update();
  }

  function endDragSlider() {
    if (!isDraggingSlider) return;
    isDraggingSlider = false;
    slider.style.cursor = 'grab';
    document.body.style.userSelect = '';
  }

  slider.style.cursor = 'grab';
  slider.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    startDragSlider(e.clientX);
  });

  slider.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      startDragSlider(e.touches[0].clientX);
    }
  }, { passive: false });

  svg.addEventListener('mousedown', (e) => {
    if (e.target.closest('#vernier-slider')) return;
    startPan(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingSlider) {
      moveDragSlider(e.clientX);
    } else if (isPanning) {
      movePan(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', () => {
    endDragSlider();
    endPan();
  });

  svg.addEventListener('touchstart', (e) => {
    if (e.target.closest('#vernier-slider')) return;
    if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
  });

  window.addEventListener('touchmove', (e) => {
    if (isDraggingSlider && e.touches.length === 1) {
      e.preventDefault();
      moveDragSlider(e.touches[0].clientX);
    } else if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    endDragSlider();
    endPan();
  });

  function setMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    panX = 0;
    panY = 0;
    zoomLevel = 1.0;

    if (mode === 'depth') {
      modeBtn.textContent = 'Flip to Jaw Mode';
      caliperAssembly.style.transform = 'rotate(90deg)';
      if (activeObj !== 'depthJar') {
        depthBeaker.style.opacity = '0';
        depthBeaker.style.display = 'none';
      }
    } else {
      modeBtn.textContent = 'Flip to Depth Mode';
      caliperAssembly.style.transform = 'rotate(0deg)';
      depthBeaker.style.opacity = '0';
      depthBeaker.style.display = 'none';
    }
    applyZoom();
  }

  modeBtn.addEventListener('click', () => {
    if (mode === 'jaw') {
      setMode('depth');
      if (activeObj !== 'depthJar') {
        selectObject('none', 0, 'Switched to Depth Mode. Drag the slider or select Depth Jar to measure beaker depth.');
      }
    } else {
      setMode('jaw');
      if (activeObj === 'depthJar') {
        selectObject('none', 0, 'Switched to Jaw Mode. Drag the slider or select a test object from the tray.');
      }
    }
  });

  const objBtns = {
    none: document.getElementById('obj-none-btn'),
    cylOut: document.getElementById('obj-cyl-out-btn'),
    cylIn: document.getElementById('obj-cyl-in-btn'),
    rect: document.getElementById('obj-rect-btn'),
    sq: document.getElementById('obj-sq-btn'),
    depthJar: document.getElementById('obj-depth-btn')
  };
  const svgObjs = {
    cylOut: document.getElementById('svg-obj-cyl-out'),
    cylIn: document.getElementById('svg-obj-cyl-in'),
    rect: document.getElementById('svg-obj-rect'),
    sq: document.getElementById('svg-obj-square')
  };
  const objDesc = document.getElementById('object-desc');

  function selectObject(objKey, targetVal, descText) {
    Object.values(objBtns).forEach(btn => { if (btn) btn.classList.remove('active'); });
    if (objBtns[objKey]) objBtns[objKey].classList.add('active');
    activeObj = objKey;

    if (objKey === 'depthJar') {
      if (mode !== 'depth') {
        setMode('depth');
      }
      depthBeaker.style.display = 'block';
      setTimeout(() => {
        depthBeaker.style.opacity = '1';
      }, 50);
      Object.keys(svgObjs).forEach(k => { if (svgObjs[k]) svgObjs[k].style.display = 'none'; });
    } else {
      depthBeaker.style.opacity = '0';
      setTimeout(() => {
        if (activeObj !== 'depthJar') depthBeaker.style.display = 'none';
      }, 300);

      if (objKey !== 'none' && mode === 'depth') {
        setMode('jaw');
      }

      Object.keys(svgObjs).forEach(key => {
        if (svgObjs[key]) svgObjs[key].style.display = (key === objKey) ? 'block' : 'none';
      });
    }

    if (objDesc) objDesc.textContent = descText;
    if (objKey !== 'none') {
      activeTrigger = 'slider';
      valInput.value = targetVal;
    }
    update();
  }

  if (objBtns.none) objBtns.none.addEventListener('click', () => selectObject('none', 0, 'Drag the slider or adjust inputs to measure freely.'));
  if (objBtns.cylOut) objBtns.cylOut.addEventListener('click', () => selectObject('cylOut', 24.0, 'Target outer diameter: 24.0 mm. Jaws aligned to clamp metallic cylinder.'));
  if (objBtns.cylIn) objBtns.cylIn.addEventListener('click', () => selectObject('cylIn', 16.0, 'Target inner diameter: 16.0 mm. Internal jaws expanded inside hollow ring.'));
  if (objBtns.rect) objBtns.rect.addEventListener('click', () => selectObject('rect', 42.5, 'Target width: 42.5 mm. Jaws aligned to measure the wooden block.'));
  if (objBtns.sq) objBtns.sq.addEventListener('click', () => selectObject('sq', 30.0, 'Target width: 30.0 mm. Jaws aligned to measure the acrylic block.'));
  if (objBtns.depthJar) objBtns.depthJar.addEventListener('click', () => selectObject('depthJar', 28.0, 'Target depth: 28.0 mm. Thin depth probe rod inserted to measure beaker liquid depth.'));

  const testTbody = document.getElementById('vernier-test-tbody');
  const runSuiteBtn = document.getElementById('vernier-run-suite-btn');

  const suiteCases = [
    { name: "Standard (Zero Error = 0)", msr: 23, vsd: 6, error: 0.0, expected: 23.6, obj: 'none' },
    { name: "Positive Zero Error (+0.2 mm)", msr: 23, vsd: 8, error: 0.2, expected: 23.6, obj: 'none' },
    { name: "Negative Zero Error (-0.3 mm)", msr: 23, vsd: 3, error: -0.3, expected: 23.6, obj: 'none' },
    { name: "Zero Thickness (+0.4 mm error)", msr: 0, vsd: 4, error: 0.4, expected: 0.0, obj: 'none' },
    { name: "Cylinder Outer Dia (True 24.0 mm)", trueVal: 24.0, error: 0.2, obj: 'cylOut' },
    { name: "Cylinder Inner Dia (True 16.0 mm)", trueVal: 16.0, error: -0.1, obj: 'cylIn' },
    { name: "Wooden Block (True 42.5 mm)", trueVal: 42.5, error: 0.0, obj: 'rect' },
    { name: "Acrylic Block (True 30.0 mm)", trueVal: 30.0, error: -0.2, obj: 'sq' },
    { name: "Depth Jar / Beaker (True Depth 28.0 mm)", trueVal: 28.0, error: 0.1, obj: 'depthJar' }
  ];

  function renderSuiteTable() {
    if (!testTbody) return;
    testTbody.innerHTML = '';
    suiteCases.forEach((tc, idx) => {
      let calc;
      if (tc.trueVal !== undefined) {
        calc = VernierEngine.simulateMeasurement(tc.trueVal, tc.error);
      } else {
        calc = VernierEngine.calculate(tc.msr, tc.vsd, tc.error);
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${tc.name}</strong></td>
        <td>${calc.zeroError >= 0 ? '+' : ''}${calc.zeroError.toFixed(2)} mm</td>
        <td>${calc.msr.toFixed(1)} mm</td>
        <td>${calc.vsd}</td>
        <td>${calc.observed.toFixed(2)} mm</td>
        <td><strong style="color: var(--accent);">${calc.corrected.toFixed(2)} mm</strong></td>
        <td><span style="color: #2ecc71; font-weight: bold;">✔ TRUE & PASS</span></td>
        <td>
          <button class="action-btn test-load-btn" data-idx="${idx}" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
            Simulate
          </button>
        </td>
      `;
      testTbody.appendChild(tr);
    });

    document.querySelectorAll('.test-load-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        loadTestCase(idx);
      });
    });
  }

  function loadTestCase(idx) {
    const tc = suiteCases[idx];
    if (!tc) return;

    errorInput.value = tc.error;
    if (tc.trueVal !== undefined) {
      if (tc.obj && objBtns[tc.obj]) {
        objBtns[tc.obj].click();
      } else {
        valInput.value = tc.trueVal;
        activeTrigger = 'slider';
        update();
      }
    } else {
      activeTrigger = 'inputs';
      msrInput.value = tc.msr;
      vsdInput.value = tc.vsd;
      update();
    }
  }

  if (testTbody) {
    renderSuiteTable();
  }
  update();
}
function initScrew() {
  const mainTicks = document.getElementById('screw-main-ticks');
  const circularTicks = document.getElementById('circular-ticks');
  const spindle = document.getElementById('spindle');
  const thimble = document.getElementById('thimble');
  const screwObject = document.getElementById('screw-object');
  const screwObjectGroup = document.getElementById('screw-object-group');
  const labelsGroup = document.getElementById('screw-labels-group');
  const toggleLabelsCheckbox = document.getElementById('screw-toggle-labels');
  const toggleObjectCheckbox = document.getElementById('screw-toggle-object');

  const valInput = document.getElementById('screw-val');
  const msrInput = document.getElementById('screw-msr-input');
  const csrInput = document.getElementById('screw-csr-input');
  const pitchInput = document.getElementById('screw-pitch-input');
  const divsInput = document.getElementById('screw-divs-input');
  const errorInput = document.getElementById('screw-error');
  const calcBtn = document.getElementById('screw-calc-btn');
  const resetBtn = document.getElementById('screw-reset-btn');

  const stepM1 = document.getElementById('screw-step-m1');
  const stepM01 = document.getElementById('screw-step-m01');
  const stepM001 = document.getElementById('screw-step-m001');
  const stepP001 = document.getElementById('screw-step-p001');
  const stepP01 = document.getElementById('screw-step-p01');
  const stepP1 = document.getElementById('screw-step-p1');

  const lcDisplay = document.getElementById('screw-lc-display');
  const psrSpan = document.getElementById('screw-psr');
  const csrSpan = document.getElementById('screw-csr');
  const observedSpan = document.getElementById('screw-observed');
  const errorDisplay = document.getElementById('screw-error-display');
  const correctedSpan = document.getElementById('screw-corrected');
  const stepsContent = document.getElementById('screw-steps-content');
  const truthBadge = document.getElementById('screw-truth-badge');

  const screwFlapEl = document.getElementById('screw-corrected-flap');
  const screwFlap = screwFlapEl ? new SplitFlapText(screwFlapEl) : null;

  // Callout pointer lines
  const spindleLine = document.getElementById('callout-spindle-line');
  const thimbleScaleLine = document.getElementById('callout-thimble-scale-line');
  const ratchetLine = document.getElementById('callout-ratchet-line');

  // Draw main scale graduations on the sleeve
  function drawMainScale() {
    if (!mainTicks) return;
    mainTicks.innerHTML = '';
    const originX = 390; // mm 0
    const scale = 10;    // 10 px per mm
    for (let i = 0; i <= 15; i++) {
      const x = originX + i * scale;
      const isMajor = (i % 5 === 0);
      const upperY = isMajor ? 133 : 138;

      // Millimeter tick above datum line (y=150)
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 150);
      line.setAttribute('x2', x);
      line.setAttribute('y2', upperY);
      line.setAttribute('stroke', '#9ec3e3');
      line.setAttribute('stroke-width', isMajor ? '2' : '1.2');
      mainTicks.appendChild(line);

      // Number text above tick
      if (isMajor) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', 126);
        text.setAttribute('fill', '#fec601');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', "'Outfit', sans-serif");
        text.setAttribute('text-anchor', 'middle');
        text.textContent = i;
        mainTicks.appendChild(text);
      }

      // Half-millimeter tick below datum line (y=150)
      if (i < 15) {
        const xHalf = x + 5;
        const halfLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        halfLine.setAttribute('x1', xHalf);
        halfLine.setAttribute('y1', 150);
        halfLine.setAttribute('x2', xHalf);
        halfLine.setAttribute('y2', 160);
        halfLine.setAttribute('stroke', '#73bfb8');
        halfLine.setAttribute('stroke-width', '1.2');
        mainTicks.appendChild(halfLine);
      }
    }
  }

  // Draw circular scale graduations on the beveled cone of the thimble
  function drawCircularScale(currentDiv, totalDivs = 100) {
    if (!circularTicks) return;
    circularTicks.innerHTML = '';
    // The bevel runs from x=0 to x=35. Datum line is at y=150.
    // Numbers increase UPWARDS as shown in diagram (15, 20, 25, 30).
    const spacing = 4.5;
    for (let i = -8; i <= 8; i++) {
      const divNum = ((Math.round(currentDiv) + i) % totalDivs + totalDivs) % totalDivs;
      const y = 150 - i * spacing; // higher divNum at smaller y (higher on screen)
      if (y >= 122 && y <= 178) {
        const isMajor = (divNum % 5 === 0);
        const tickLen = isMajor ? 18 : 10;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', y);
        line.setAttribute('x2', tickLen);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', isMajor ? '#fec601' : '#f0f7fd');
        line.setAttribute('stroke-width', isMajor ? '1.8' : '1');
        circularTicks.appendChild(line);

        if (isMajor) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', 24);
          text.setAttribute('y', y + 3.5);
          text.setAttribute('fill', '#fec601');
          text.setAttribute('font-size', '9');
          text.setAttribute('font-weight', '600');
          text.setAttribute('font-family', "'Outfit', monospace");
          text.setAttribute('text-anchor', 'middle');
          text.textContent = divNum;
          circularTicks.appendChild(text);
        }
      }
    }
  }

  let isInternalUpdate = false;

  function update(source = 'val') {
    if (!valInput) return;
    const rawVal = Math.max(0, Math.min(15, parseFloat(valInput.value) || 0));
    const zeroError = parseFloat(errorInput ? errorInput.value : 0) || 0;
    const pitch = Math.max(0.1, parseFloat(pitchInput ? pitchInput.value : 1.0) || 1.0);
    const divs = Math.max(10, parseInt(divsInput ? divsInput.value : 100, 10) || 100);

    const lc = ScrewEngine.calculateLeastCount(pitch, divs);

    // Visual position of thimble reflects opening + zero error
    const visualOpening = Math.max(0, rawVal + zeroError);

    // Calculate MSR and CSR
    const msr = Math.floor(visualOpening / pitch) * pitch;
    const csrDiv = Math.round(((visualOpening - msr) / lc)) % divs;

    if (source !== 'inputs' && !isInternalUpdate && msrInput && csrInput) {
      isInternalUpdate = true;
      msrInput.value = msr;
      csrInput.value = csrDiv;
      isInternalUpdate = false;
    }

    // Run pure metrological calculation
    const calc = ScrewEngine.calculate(msr, csrDiv, zeroError, pitch, divs);

    // Update graphical elements
    // Anvil face is at x=130. Spindle moves by rawVal * 10.
    const spindleX = rawVal * 10;
    if (spindle) spindle.setAttribute('transform', `translate(${spindleX}, 0)`);

    // Thimble beveled face starts at x=390 (origin 0 on sleeve).
    const thimbleX = 390 + visualOpening * 10;
    if (thimble) thimble.setAttribute('transform', `translate(${thimbleX}, 0)`);

    // Measured object (red sphere) clamped between anvil (x=130) and spindle tip (x=130 + spindleX)
    const showObject = toggleObjectCheckbox ? toggleObjectCheckbox.checked : true;
    if (screwObject && screwObjectGroup) {
      if (showObject && rawVal > 0.05) {
        const diam = Math.min(spindleX, 120);
        const r = diam / 2;
        const cx = 130 + r;
        screwObject.setAttribute('cx', cx);
        screwObject.setAttribute('r', r);
        screwObjectGroup.style.display = 'block';
      } else {
        screwObjectGroup.style.display = 'none';
      }
    }

    // Draw circular scale aligned with current division
    drawCircularScale(csrDiv, divs);

    // Update callout arrow lines to follow moving parts
    if (spindleLine) {
      const targetSpindleX = Math.min(340, Math.max(145, 130 + spindleX / 2 + 15));
      spindleLine.setAttribute('x2', targetSpindleX);
    }
    if (thimbleScaleLine) {
      thimbleScaleLine.setAttribute('x2', thimbleX + 12);
    }
    if (ratchetLine) {
      ratchetLine.setAttribute('x2', thimbleX + 160);
    }

    // Update readouts
    if (lcDisplay) lcDisplay.textContent = `${lc.toFixed(divs >= 100 ? 3 : 2)} mm`;
    if (psrSpan) psrSpan.textContent = `${calc.msr.toFixed(1)} mm`;
    if (csrSpan) csrSpan.textContent = `${calc.csrMm.toFixed(2)} mm (Div: ${calc.csr})`;
    if (observedSpan) observedSpan.textContent = `${calc.observed.toFixed(2)} mm`;
    if (errorDisplay) errorDisplay.textContent = `${zeroError >= 0 ? '+' : ''}${zeroError.toFixed(2)} mm`;
    if (correctedSpan) correctedSpan.textContent = `${calc.corrected.toFixed(2)} mm`;

    if (screwFlap) {
      screwFlap.setText(`${calc.corrected.toFixed(2)} mm`);
    }

    // Step-by-step breakdown
    if (stepsContent) {
      stepsContent.innerHTML = `
        <div>1. ${calc.steps.lcCalc}</div>
        <div>2. ${calc.steps.csrCalc}</div>
        <div>3. ${calc.steps.observedCalc}</div>
        <div>4. ${calc.steps.correctedCalc}</div>
      `;
    }

    // Truth badge
    if (truthBadge) {
      const isTruth = Math.abs(calc.corrected - rawVal) < 0.015;
      if (isTruth) {
        truthBadge.textContent = 'READING TRUE';
        truthBadge.style.background = 'rgba(39, 174, 96, 0.2)';
        truthBadge.style.color = '#2ecc71';
        truthBadge.style.borderColor = '#27ae60';
      } else {
        truthBadge.textContent = 'UNCALIBRATED';
        truthBadge.style.background = 'rgba(231, 76, 60, 0.2)';
        truthBadge.style.color = '#e74c3c';
        truthBadge.style.borderColor = '#e74c3c';
      }
    }
  }

  // Draw static main scale
  drawMainScale();

  // Label toggle (default OFF)
  if (toggleLabelsCheckbox && labelsGroup) {
    labelsGroup.style.display = toggleLabelsCheckbox.checked ? 'block' : 'none';
    toggleLabelsCheckbox.addEventListener('change', () => {
      labelsGroup.style.display = toggleLabelsCheckbox.checked ? 'block' : 'none';
    });
  }

  // Object toggle
  if (toggleObjectCheckbox) {
    toggleObjectCheckbox.addEventListener('change', () => update('val'));
  }

  // Input listeners
  if (valInput) valInput.addEventListener('input', () => update('val'));
  if (errorInput) errorInput.addEventListener('input', () => update('val'));
  if (pitchInput) {
    pitchInput.addEventListener('input', () => {
      drawMainScale();
      update('val');
    });
  }
  if (divsInput) divsInput.addEventListener('input', () => update('val'));

  // Direct MSR / CSR inputs
  function onDirectInputsChange() {
    if (isInternalUpdate) return;
    const msr = Math.max(0, parseFloat(msrInput.value) || 0);
    const csr = Math.max(0, parseInt(csrInput.value, 10) || 0);
    const zeroError = parseFloat(errorInput ? errorInput.value : 0) || 0;
    const pitch = Math.max(0.1, parseFloat(pitchInput ? pitchInput.value : 1.0) || 1.0);
    const divs = Math.max(10, parseInt(divsInput ? divsInput.value : 100, 10) || 100);
    const lc = ScrewEngine.calculateLeastCount(pitch, divs);

    const observed = msr + csr * lc;
    const targetVal = Math.max(0, Math.min(15, observed - zeroError));
    valInput.value = targetVal.toFixed(2);
    update('inputs');
  }

  if (msrInput) msrInput.addEventListener('input', onDirectInputsChange);
  if (csrInput) csrInput.addEventListener('input', onDirectInputsChange);

  // Step buttons
  function applyStep(delta) {
    if (!valInput) return;
    let cur = parseFloat(valInput.value) || 0;
    cur = Math.max(0, Math.min(15, Math.round((cur + delta) * 100) / 100));
    valInput.value = cur.toFixed(2);
    update('val');
  }

  if (stepM1) stepM1.addEventListener('click', () => applyStep(-1.0));
  if (stepM01) stepM01.addEventListener('click', () => applyStep(-0.1));
  if (stepM001) stepM001.addEventListener('click', () => applyStep(-0.01));
  if (stepP001) stepP001.addEventListener('click', () => applyStep(0.01));
  if (stepP01) stepP01.addEventListener('click', () => applyStep(0.1));
  if (stepP1) stepP1.addEventListener('click', () => applyStep(1.0));

  // Calculate button
  if (calcBtn) {
    calcBtn.addEventListener('click', () => {
      update('val');
      const box = document.getElementById('screw-readout-box');
      if (box) {
        box.style.boxShadow = '0 0 15px rgba(254, 198, 1, 0.4)';
        setTimeout(() => { box.style.boxShadow = ''; }, 600);
      }
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (valInput) valInput.value = '3.50';
      if (errorInput) errorInput.value = '0';
      if (pitchInput) pitchInput.value = '1.0';
      if (divsInput) divsInput.value = '100';
      if (toggleLabelsCheckbox) toggleLabelsCheckbox.checked = false;
      if (toggleObjectCheckbox) toggleObjectCheckbox.checked = true;
      if (labelsGroup) labelsGroup.style.display = 'none';
      drawMainScale();
      update('val');
    });
  }

  // Zoom & Pan
  let zoomLevel = 1.0;
  const svg = document.getElementById('screw-svg');
  const zoomInBtn = document.getElementById('screw-zoom-in');
  const zoomOutBtn = document.getElementById('screw-zoom-out');
  const zoomResetBtn = document.getElementById('screw-zoom-reset');

  let isPanning = false;
  let startX = 0, startY = 0;
  let panX = 0, panY = 0;
  let currentPanX = 0, currentPanY = 0;

  function applyZoom() {
    if (!svg) return;
    const w = 850 * zoomLevel;
    const h = 320 * zoomLevel;
    const x = 425 - w / 2 - (panX + currentPanX);
    const y = 160 - h / 2 - (panY + currentPanY);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      zoomLevel = Math.max(0.4, zoomLevel - 0.1);
      applyZoom();
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      zoomLevel = Math.min(2.0, zoomLevel + 0.1);
      applyZoom();
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;
      currentPanX = 0;
      currentPanY = 0;
      applyZoom();
    });
  }

  function startPan(clientX, clientY) {
    if (!svg) return;
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
    if (svg) svg.style.cursor = 'grab';
  }

  // Thimble / Ratchet interactive dragging
  let isDraggingThimble = false;
  let dragStartSvgX = 0;
  let dragStartVal = 0;

  function getSvgPoint(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function startDragThimble(clientX, clientY) {
    if (!svg || !valInput) return;
    isDraggingThimble = true;
    const svgPt = getSvgPoint(clientX, clientY);
    dragStartSvgX = svgPt.x;
    dragStartVal = parseFloat(valInput.value) || 0;
    if (thimble) thimble.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  function moveDragThimble(clientX, clientY) {
    if (!isDraggingThimble || !valInput) return;
    const svgPt = getSvgPoint(clientX, clientY);
    const deltaSvgX = svgPt.x - dragStartSvgX;
    const deltaMm = deltaSvgX / 10; // 10 px per mm
    let newVal = Math.max(0, Math.min(15, dragStartVal + deltaMm));
    newVal = Math.round(newVal * 100) / 100;
    valInput.value = newVal.toFixed(2);
    update('val');
  }

  function endDragThimble() {
    if (!isDraggingThimble) return;
    isDraggingThimble = false;
    if (thimble) thimble.style.cursor = 'grab';
    document.body.style.userSelect = '';
  }

  if (thimble) {
    thimble.style.cursor = 'grab';
    thimble.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startDragThimble(e.clientX, e.clientY);
    });
    thimble.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.stopPropagation();
        startDragThimble(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
  }

  if (svg) {
    svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('#thimble')) return;
      startPan(e.clientX, e.clientY);
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (isDraggingThimble) {
      moveDragThimble(e.clientX, e.clientY);
    } else if (isPanning) {
      movePan(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', () => {
    endDragThimble();
    endPan();
  });

  if (svg) {
    svg.addEventListener('touchstart', (e) => {
      if (e.target.closest('#thimble')) return;
      if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
    });
  }

  window.addEventListener('touchmove', (e) => {
    if (isDraggingThimble && e.touches.length === 1) {
      e.preventDefault();
      moveDragThimble(e.touches[0].clientX, e.touches[0].clientY);
    } else if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    endDragThimble();
    endPan();
  });

  // Initial update
  update('val');
}
function initSpherometer() {
  const base = document.getElementById('spherometer-base');
  const surfaceLabel = document.getElementById('sph-surface-label');
  const screw = document.getElementById('spherometer-screw');
  const discTicks = document.getElementById('disc-ticks');
  const discZeroText = document.getElementById('sph-disc-zero');
  const labelsGroup = document.getElementById('sph-labels-group');
  const toggleLabelsCheckbox = document.getElementById('sph-toggle-labels');

  const surfaceSelect = document.getElementById('spherometer-surface');
  const aInput = document.getElementById('spherometer-a');
  const hInput = document.getElementById('spherometer-h');
  const msrInput = document.getElementById('spherometer-msr-input');
  const csrInput = document.getElementById('spherometer-csr-input');
  const errorInput = document.getElementById('spherometer-error');
  const calcBtn = document.getElementById('sph-calc-btn');
  const resetBtn = document.getElementById('sph-reset-btn');

  const stepM1 = document.getElementById('sph-step-m1');
  const stepM01 = document.getElementById('sph-step-m01');
  const stepM001 = document.getElementById('sph-step-m001');
  const stepP001 = document.getElementById('sph-step-p001');
  const stepP01 = document.getElementById('sph-step-p01');
  const stepP1 = document.getElementById('sph-step-p1');

  const lcDisplay = document.getElementById('sph-lc-display');
  const msrDisplay = document.getElementById('sph-msr-display');
  const csrDisplay = document.getElementById('sph-csr-display');
  const observedDisplay = document.getElementById('sph-observed-display');
  const errorDisplay = document.getElementById('sph-error-display');
  const sphFlapEl = document.getElementById('spherometer-h-flap');
  const sphFlap = sphFlapEl ? new SplitFlapText(sphFlapEl) : null;
  const hValSpan = document.getElementById('spherometer-h-val');
  const rSpan = document.getElementById('spherometer-r');
  const stepsContent = document.getElementById('sph-steps-content');
  const truthBadge = document.getElementById('sph-truth-badge');

  // Draw radial divisions on perspective circular disc (crisp line-art)
  function drawDiscScale(offsetDiv, totalDivs = 100) {
    if (!discTicks) return;
    discTicks.innerHTML = '';
    const cx = 400;
    const cy = 95;
    const rxOuter = 152;
    const ryOuter = 21;
    const rxInner = 141;
    const ryInner = 19.5;

    // Draw ticks around ellipse
    const numTicks = 60;
    for (let i = 0; i < numTicks; i++) {
      const angle = (i / numTicks) * 2 * Math.PI;
      const isMajor = (i % 5 === 0);

      const rIn = isMajor ? rxInner - 4 : rxInner;
      const rInY = isMajor ? ryInner - 1 : ryInner;

      const x1 = cx + Math.cos(angle) * rIn;
      const y1 = cy + Math.sin(angle) * rInY;
      const x2 = cx + Math.cos(angle) * rxOuter;
      const y2 = cy + Math.sin(angle) * ryOuter;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', '#000000');
      line.setAttribute('stroke-width', isMajor ? '1.5' : '0.9');
      discTicks.appendChild(line);
    }

    if (discZeroText) {
      discZeroText.textContent = `${Math.round(offsetDiv) % totalDivs}`;
    }
  }

  let isInternalUpdate = false;

  function update(source = 'h') {
    if (!hInput) return;
    const surface = surfaceSelect ? surfaceSelect.value : 'convex';
    const legDistance = Math.max(10, parseFloat(aInput ? aInput.value : 50) || 50);
    const hRaw = Math.max(0, Math.min(10, parseFloat(hInput.value) || 0));
    const zeroError = parseFloat(errorInput ? errorInput.value : 0) || 0;

    const pitch = 1.0;
    const divs = 100;
    const lc = SpherometerEngine.calculateLeastCount(pitch, divs);

    const visualH = Math.max(0, hRaw + zeroError);
    const msr = Math.floor(visualH / pitch) * pitch;
    const csrDiv = Math.round(((visualH - msr) / lc)) % divs;

    if (source !== 'inputs' && !isInternalUpdate && msrInput && csrInput) {
      isInternalUpdate = true;
      msrInput.value = msr;
      csrInput.value = csrDiv;
      isInternalUpdate = false;
    }

    // Pure metrological calculation
    const calc = SpherometerEngine.calculate(msr, csrDiv, zeroError, pitch, divs, legDistance);

    // Update surface SVG curve
    let baseD = "M 180 275 L 620 275";
    let curveHeight = Math.min(calc.correctedH * 5, 45);

    if (surface === "convex") {
      baseD = `M 180 275 Q 400 ${275 - curveHeight} 620 275`;
      if (surfaceLabel) {
        surfaceLabel.textContent = calc.correctedH === 0
          ? "Surface: Flat Glass Plate (Reference h = 0)"
          : `Surface: Convex Lens / Spherical Mirror (Sagitta h = ${calc.correctedH.toFixed(2)} mm)`;
      }
    } else if (surface === "concave") {
      baseD = `M 180 275 Q 400 ${275 + curveHeight} 620 275`;
      if (surfaceLabel) {
        surfaceLabel.textContent = `Surface: Concave Mirror / Lens (Depth h = ${calc.correctedH.toFixed(2)} mm)`;
      }
    } else {
      if (surfaceLabel) surfaceLabel.textContent = "Surface: Flat Glass Plate (Reference h = 0.00 mm)";
    }

    if (base) base.setAttribute('d', baseD);

    // Central screw moves vertically along with disc and knob
    // Travel: 5 px per mm (so 10 mm travel = 50 px from y=95 to y=45 on ruler)
    const travelPx = visualH * 5;
    const yOffset = -travelPx;
    if (screw) {
      screw.setAttribute('transform', `translate(0, ${yOffset})`);
    }

    // Draw disc ticks
    drawDiscScale(csrDiv, divs);

    // Update Readouts
    if (lcDisplay) lcDisplay.textContent = `${lc.toFixed(2)} mm`;
    if (msrDisplay) msrDisplay.textContent = `${calc.msr.toFixed(1)} mm`;
    if (csrDisplay) csrDisplay.textContent = `${calc.csrMm.toFixed(2)} mm (Div: ${calc.csr})`;
    if (observedDisplay) observedDisplay.textContent = `${calc.observedH.toFixed(2)} mm`;
    if (errorDisplay) errorDisplay.textContent = `${zeroError >= 0 ? '+' : ''}${zeroError.toFixed(2)} mm`;
    if (hValSpan) hValSpan.textContent = `${calc.correctedH.toFixed(2)} mm`;

    if (sphFlap) {
      sphFlap.setText(`${calc.correctedH.toFixed(2)} mm`);
    }

    if (rSpan) {
      if (calc.radiusOfCurvature === Infinity) {
        rSpan.textContent = "∞ (Flat Surface)";
      } else {
        rSpan.textContent = `${calc.radiusOfCurvature.toFixed(2)} mm`;
      }
    }

    // Step-by-Step breakdown
    if (stepsContent) {
      stepsContent.innerHTML = `
        <div>1. ${calc.steps.lcCalc}</div>
        <div>2. ${calc.steps.csrCalc}</div>
        <div>3. ${calc.steps.observedCalc}</div>
        <div>4. ${calc.steps.correctedCalc}</div>
        <div>5. ${calc.steps.rCalc}</div>
      `;
    }

    // Truth Badge
    if (truthBadge) {
      const isTruth = Math.abs(calc.correctedH - hRaw) < 0.015;
      if (isTruth) {
        truthBadge.textContent = 'READING TRUE';
        truthBadge.style.background = 'rgba(39, 174, 96, 0.2)';
        truthBadge.style.color = '#2ecc71';
        truthBadge.style.borderColor = '#27ae60';
      } else {
        truthBadge.textContent = 'UNCALIBRATED';
        truthBadge.style.background = 'rgba(231, 76, 60, 0.2)';
        truthBadge.style.color = '#e74c3c';
        truthBadge.style.borderColor = '#e74c3c';
      }
    }
  }

  // Label toggle (default OFF)
  if (toggleLabelsCheckbox && labelsGroup) {
    labelsGroup.style.display = toggleLabelsCheckbox.checked ? 'block' : 'none';
    toggleLabelsCheckbox.addEventListener('change', () => {
      labelsGroup.style.display = toggleLabelsCheckbox.checked ? 'block' : 'none';
    });
  }

  // Direct inputs
  function onDirectInputsChange() {
    if (isInternalUpdate) return;
    const msr = Math.max(0, parseFloat(msrInput.value) || 0);
    const csr = Math.max(0, parseInt(csrInput.value, 10) || 0);
    const zeroError = parseFloat(errorInput ? errorInput.value : 0) || 0;
    const lc = 0.01;

    const observed = msr + csr * lc;
    const targetH = Math.max(0, Math.min(10, observed - zeroError));
    hInput.value = targetH.toFixed(2);
    update('inputs');
  }

  if (msrInput) msrInput.addEventListener('input', onDirectInputsChange);
  if (csrInput) csrInput.addEventListener('input', onDirectInputsChange);

  // Surface change
  if (surfaceSelect) {
    surfaceSelect.addEventListener('change', () => {
      if (surfaceSelect.value === 'flat') {
        hInput.value = '0.00';
      } else if (hInput.value === '0.00' || hInput.value === '0') {
        hInput.value = '2.50';
      }
      update('h');
    });
  }

  if (aInput) aInput.addEventListener('input', () => update('h'));
  if (hInput) hInput.addEventListener('input', () => update('h'));
  if (errorInput) errorInput.addEventListener('input', () => update('h'));

  // Step buttons
  function applyStep(delta) {
    if (!hInput) return;
    let cur = parseFloat(hInput.value) || 0;
    cur = Math.max(0, Math.min(10, Math.round((cur + delta) * 100) / 100));
    hInput.value = cur.toFixed(2);
    update('h');
  }

  if (stepM1) stepM1.addEventListener('click', () => applyStep(-1.0));
  if (stepM01) stepM01.addEventListener('click', () => applyStep(-0.1));
  if (stepM001) stepM001.addEventListener('click', () => applyStep(-0.01));
  if (stepP001) stepP001.addEventListener('click', () => applyStep(0.01));
  if (stepP01) stepP01.addEventListener('click', () => applyStep(0.1));
  if (stepP1) stepP1.addEventListener('click', () => applyStep(1.0));

  // Calculate button
  if (calcBtn) {
    calcBtn.addEventListener('click', () => {
      update('h');
      const box = document.getElementById('sph-readout-box');
      if (box) {
        box.style.boxShadow = '0 0 15px rgba(254, 198, 1, 0.4)';
        setTimeout(() => { box.style.boxShadow = ''; }, 600);
      }
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (surfaceSelect) surfaceSelect.value = 'convex';
      if (hInput) hInput.value = '2.50';
      if (aInput) aInput.value = '50';
      if (errorInput) errorInput.value = '0';
      if (toggleLabelsCheckbox) toggleLabelsCheckbox.checked = false;
      if (labelsGroup) labelsGroup.style.display = 'none';
      update('h');
    });
  }

  // Zoom & Pan
  let zoomLevel = 1.0;
  const svg = document.getElementById('spherometer-svg');
  const zoomInBtn = document.getElementById('sph-zoom-in');
  const zoomOutBtn = document.getElementById('sph-zoom-out');
  const zoomResetBtn = document.getElementById('sph-zoom-reset');

  let isPanning = false;
  let startX = 0, startY = 0;
  let panX = 0, panY = 0;
  let currentPanX = 0, currentPanY = 0;

  function applyZoom() {
    if (!svg) return;
    const w = 850 * zoomLevel;
    const h = 340 * zoomLevel;
    const x = 425 - w / 2 - (panX + currentPanX);
    const y = 170 - h / 2 - (panY + currentPanY);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      zoomLevel = Math.max(0.4, zoomLevel - 0.1);
      applyZoom();
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      zoomLevel = Math.min(2.0, zoomLevel + 0.1);
      applyZoom();
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;
      currentPanX = 0;
      currentPanY = 0;
      applyZoom();
    });
  }

  function startPan(clientX, clientY) {
    if (!svg) return;
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
    if (svg) svg.style.cursor = 'grab';
  }

  // Screw Interactive Dragging
  let isDraggingScrew = false;
  let dragStartSvgY = 0;
  let dragStartVal = 0;

  function getSvgPoint(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function startDragScrew(clientX, clientY) {
    if (!svg || !hInput) return;
    isDraggingScrew = true;
    const svgPt = getSvgPoint(clientX, clientY);
    dragStartSvgY = svgPt.y;
    dragStartVal = parseFloat(hInput.value) || 0;
    if (screw) screw.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  function moveDragScrew(clientX, clientY) {
    if (!isDraggingScrew || !hInput) return;
    const svgPt = getSvgPoint(clientX, clientY);
    // Dragging UP in SVG (smaller Y) lifts the screw (higher h)
    const deltaSvgY = dragStartSvgY - svgPt.y;
    const deltaMm = deltaSvgY / 5; // 5 px per mm
    let newVal = Math.max(0, Math.min(10, dragStartVal + deltaMm));
    newVal = Math.round(newVal * 100) / 100;
    hInput.value = newVal.toFixed(2);
    update('h');
  }

  function endDragScrew() {
    if (!isDraggingScrew) return;
    isDraggingScrew = false;
    if (screw) screw.style.cursor = 'grab';
    document.body.style.userSelect = '';
  }

  if (screw) {
    screw.style.cursor = 'grab';
    screw.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startDragScrew(e.clientX, e.clientY);
    });
    screw.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.stopPropagation();
        startDragScrew(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
  }

  if (svg) {
    svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('#spherometer-screw')) return;
      startPan(e.clientX, e.clientY);
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (isDraggingScrew) {
      moveDragScrew(e.clientX, e.clientY);
    } else if (isPanning) {
      movePan(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', () => {
    endDragScrew();
    endPan();
  });

  if (svg) {
    svg.addEventListener('touchstart', (e) => {
      if (e.target.closest('#spherometer-screw')) return;
      if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
    });
  }

  window.addEventListener('touchmove', (e) => {
    if (isDraggingScrew && e.touches.length === 1) {
      e.preventDefault();
      moveDragScrew(e.touches[0].clientX, e.touches[0].clientY);
    } else if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    endDragScrew();
    endPan();
  });

  // Initial update
  update('h');
}

function initBeamsBackground() {
  const canvas = document.getElementById('beams-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true }) || canvas.getContext('experimental-webgl');
  if (!gl) return;

  const vsSource = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      
      float t = uTime * 0.35;
      float beamField = 0.0;
      
      vec3 beamColor1 = vec3(0.137, 0.392, 0.667);
      vec3 beamColor2 = vec3(0.239, 0.647, 0.851);
      vec3 beamColor3 = vec3(0.451, 0.749, 0.722);
      vec3 beamColor4 = vec3(0.996, 0.776, 0.004);
      
      for (float i = 0.0; i < 12.0; i += 1.0) {
        float xOffset = (i - 5.5) * 0.28;
        float n = noise(vec2(i * 1.5 + t * 0.4, uv.y * 1.8 - t * 0.8));
        float beamX = xOffset + (n - 0.5) * 0.35;
        float dist = abs(uv.x - beamX);
        float width = 0.02 + 0.015 * sin(i * 1.7 + t);
        float beam = smoothstep(width + 0.12, width, dist);
        
        float lengthFade = smoothstep(1.2, -0.2, uv.y) * smoothstep(-1.2, 0.2, uv.y);
        beamField += beam * lengthFade * (0.6 + 0.4 * sin(i * 2.3 + t * 1.2));
      }

      float grain = (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.04;
      float colorMix = vUv.y * 0.7 + 0.3 * sin(uTime * 0.5);
      vec3 colGrad = mix(beamColor1, beamColor2, smoothstep(0.0, 0.5, colorMix));
      colGrad = mix(colGrad, beamColor4, smoothstep(0.5, 1.0, colorMix) * 0.35);
      vec3 finalColor = colGrad * beamField * 0.65;
      finalColor += grain;
      
      float alpha = clamp(beamField * 0.6, 0.0, 0.85);
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const program = gl.createProgram();
  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const timeLoc = gl.getUniformLocation(program, 'uTime');
  const resLoc = gl.getUniformLocation(program, 'uResolution');

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener('resize', resize);
  resize();

  let startTime = performance.now();
  function render() {
    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    gl.uniform1f(timeLoc, elapsed);
    gl.uniform2f(resLoc, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

// React Bits ParticleText Component Implementation for Vanilla JS
function initParticleText() {
  const container = document.getElementById('pop-particle-text');
  const canvas = document.getElementById('pop-particle-canvas');
  if (!container || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const config = {
    text: "Precision of Physics",
    particleSize: 2.2,
    density: 3.5,
    color: "#f0f7fd",
    highlightColor: "#3da5d9",
    scatter: 180,
    gatherDuration: 1600,
    stagger: 420,
    pointerRepel: 50,
    repelRadius: 140,
    idleDrift: 0.7,
    trigger: "mount", // Only show once on mount; does not reset on hover
    fontSize: "clamp(3.2rem, 8.5vw, 6.8rem)",
    fontWeight: 700,
    fontFamily: "'Cinzel', serif",
    glow: true
  };

  const hexToRgb = hex => {
    const clean = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  };

  const mixRgb = (from, to, amount) => ({
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount)
  });

  const rgbToCss = rgb => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const resolveFontSize = (value, containerEl, fontWeight, fontFamily) => {
    if (typeof value === 'number') return value;
    const probe = document.createElement('span');
    probe.textContent = 'M';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.fontSize = value;
    probe.style.fontWeight = String(fontWeight);
    probe.style.fontFamily = fontFamily;
    containerEl.appendChild(probe);
    const size = parseFloat(window.getComputedStyle(probe).fontSize) || 72;
    probe.remove();
    return size;
  };

  const waitForFonts = async font => {
    if (!('fonts' in document)) return;
    try {
      await document.fonts.load(font);
    } catch {}
    await document.fonts.ready;
  };

  let particles = [];
  let animationFrame = null;
  let resizeFrame = null;
  let buildId = 0;
  let gathering = false;
  let gatherStart = 0;
  let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const pointer = {
    active: false,
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0
  };

  const startGather = (fromScatter = true) => {
    if (!particles.length) return;
    const now = performance.now();
    const spread = reducedMotion ? 0 : config.scatter;

    particles.forEach(particle => {
      if (fromScatter) {
        const angle = particle.seed * Math.PI * 2;
        const distance = spread * (0.35 + particle.depth * 0.75);
        particle.x = particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * spread * 0.55;
        particle.y = particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * spread * 0.55;
      }
      particle.startX = particle.x;
      particle.startY = particle.y;
      particle.delay = reducedMotion ? 0 : particle.seed * config.stagger;
    });

    gatherStart = now;
    gathering = true;
  };

  const drawParticle = particle => {
    const size = particle.size;
    ctx.fillStyle = particle.color;

    if (size <= 2.1) {
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      return;
    }

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const render = now => {
    ctx.clearRect(0, 0, width, height);

    if (config.glow && !reducedMotion) {
      ctx.shadowBlur = config.particleSize * 3;
      ctx.shadowColor = config.highlightColor;
    } else {
      ctx.shadowBlur = 0;
    }

    pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
    pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;

    let complete = true;

    particles.forEach(particle => {
      let baseX = particle.targetX;
      let baseY = particle.targetY;
      let progress = 1;

      if (gathering) {
        const local = (now - gatherStart - particle.delay) / Math.max(1, reducedMotion ? 1 : config.gatherDuration);
        progress = clamp(local, 0, 1);
        const eased = easeOutCubic(progress);
        baseX = particle.startX + (particle.targetX - particle.startX) * eased;
        baseY = particle.startY + (particle.targetY - particle.startY) * eased;
        if (progress < 1) complete = false;
      } else if (!reducedMotion && config.idleDrift > 0) {
        const driftTime = now * 0.001;
        baseX += Math.sin(driftTime * 0.9 + particle.seed * 10) * config.idleDrift * particle.depth;
        baseY += Math.cos(driftTime * 0.75 + particle.depth * 10) * config.idleDrift * particle.depth;
      }

      if (pointer.active && !reducedMotion && config.pointerRepel > 0 && config.repelRadius > 0) {
        const dx = baseX - pointer.smoothX;
        const dy = baseY - pointer.smoothY;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < config.repelRadius) {
          const force = Math.pow(1 - distance / config.repelRadius, 2) * config.pointerRepel;
          baseX += (dx / distance) * force;
          baseY += (dy / distance) * force;
        }
      }

      const follow = reducedMotion ? 1 : 0.22;
      particle.x += (baseX - particle.x) * follow;
      particle.y += (baseY - particle.y) * follow;

      ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
      drawParticle(particle);
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (gathering && complete) {
      gathering = false;
    }

    animationFrame = window.requestAnimationFrame(render);
  };

  const sampleText = async () => {
    const currentBuild = ++buildId;
    const rect = container.getBoundingClientRect();
    width = Math.floor(rect.width);
    height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const computed = window.getComputedStyle(container);
    const resolvedFamily = config.fontFamily === 'inherit' ? computed.fontFamily || 'sans-serif' : config.fontFamily;
    let resolvedSize = resolveFontSize(config.fontSize, container, config.fontWeight, resolvedFamily);
    let font = `${config.fontWeight} ${resolvedSize}px ${resolvedFamily}`;

    await waitForFonts(font);
    if (currentBuild !== buildId) return;

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    const content = String(config.text || ' ');
    const maxTextWidth = width * 0.92;
    offCtx.font = font;
    let metrics = offCtx.measureText(content);
    const measuredWidth = Math.max(1, metrics.width);
    if (measuredWidth > maxTextWidth) {
      resolvedSize = Math.max(18, resolvedSize * (maxTextWidth / measuredWidth));
      font = `${config.fontWeight} ${resolvedSize}px ${resolvedFamily}`;
      await waitForFonts(font);
      if (currentBuild !== buildId) return;
      offCtx.font = font;
      metrics = offCtx.measureText(content);
    }

    const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
    const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
    const padding = Math.max(12, Math.ceil(resolvedSize * 0.08));
    const textWidth = Math.max(1, left + right);
    const textHeight = Math.max(1, ascent + descent);

    offscreen.width = textWidth + padding * 2;
    offscreen.height = textHeight + padding * 2;
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.font = font;
    offCtx.textAlign = 'left';
    offCtx.textBaseline = 'alphabetic';
    offCtx.fillStyle = '#ffffff';
    offCtx.fillText(content, padding - left, padding + ascent);

    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const targets = [];
    const step = Math.max(2, Math.floor(config.density));

    for (let y = 0; y < offscreen.height; y += step) {
      for (let x = 0; x < offscreen.width; x += step) {
        const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
        if (alpha > 40) {
          targets.push({
            x: width / 2 - offscreen.width / 2 + x,
            y: height / 2 - offscreen.height / 2 + y,
            alpha: alpha / 255
          });
        }
      }
    }

    const maxParticles = Math.max(900, Math.min(5200, Math.floor((width * height) / 90)));
    const stride = Math.max(1, Math.ceil(targets.length / maxParticles));
    const baseRgb = hexToRgb(config.color);
    const highlightRgb = hexToRgb(config.highlightColor);
    const selected = targets.filter((_, index) => index % stride === 0);

    particles = selected.map((target, index) => {
      const seed = ((index * 9301 + 49297) % 233280) / 233280;
      const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
      const blend = baseRgb && highlightRgb ? clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
      const particleColor = baseRgb && highlightRgb ? rgbToCss(mixRgb(baseRgb, highlightRgb, blend)) : config.color;
      const angle = seed * Math.PI * 2;
      const distance = (reducedMotion ? 0 : config.scatter) * (0.35 + depth * 0.75);
      const startX = target.x + Math.cos(angle) * distance + (seed - 0.5) * config.scatter * 0.45;
      const startY = target.y + Math.sin(angle) * distance + (depth - 0.9) * config.scatter * 0.45;

      return {
        x: reducedMotion ? target.x : startX,
        y: reducedMotion ? target.y : startY,
        startX,
        startY,
        targetX: target.x,
        targetY: target.y,
        size: Math.max(0.6, config.particleSize * (0.75 + target.alpha * 0.45)),
        color: particleColor,
        seed,
        depth,
        delay: seed * config.stagger
      };
    });

    pointer.x = width / 2;
    pointer.y = height / 2;
    pointer.smoothX = pointer.x;
    pointer.smoothY = pointer.y;

    if (reducedMotion) {
      particles.forEach(particle => {
        particle.x = particle.targetX;
        particle.y = particle.targetY;
        particle.startX = particle.targetX;
        particle.startY = particle.targetY;
        particle.delay = 0;
      });
      gathering = false;
    } else {
      startGather(false);
    }

    if (animationFrame === null) {
      animationFrame = window.requestAnimationFrame(render);
    }
  };

  const queueSample = () => {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(sampleText);
  };

  const handlePointerMove = event => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  };

  const handlePointerLeave = () => {
    pointer.active = false;
  };

  const handlePointerEnter = event => {
    handlePointerMove(event);
    if (config.trigger === 'hover') startGather(true);
  };

  const handleClick = () => {
    if (config.trigger === 'click') startGather(true);
  };

  const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const handleReduceMotionChange = event => {
    reducedMotion = event.matches;
    sampleText();
  };

  reduceMotionQuery?.addEventListener('change', handleReduceMotionChange);
  canvas.addEventListener('pointerenter', handlePointerEnter);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('click', handleClick);

  const resizeObserver = new ResizeObserver(queueSample);
  resizeObserver.observe(container);
  sampleText();
}

/**
 * React Bits: StrokeText Component Implementation
 * Renders measured SVG glyphs with GSAP stroke-dasharray drawing and fill wipe/fade
 */
function createStrokeText(container, options = {}) {
  const {
    text = 'Draw Attention',
    strokeColor = '#fec601',
    fillColor = '#f0f7fd',
    strokeWidth = 1.6,
    drawDuration = 1.4,
    fillDelay = 0.15,
    stagger = 0.05,
    ease = 'power2.out',
    fillMode = 'wipe',
    fontSize = 72,
    fontWeight = 700,
    letterSpacing = 2,
    reverse = false,
    onComplete = null
  } = options;

  if (!container) return { play: () => {}, kill: () => {} };

  const rawId = Math.random().toString(36).substring(2, 9);
  const wipeId = `stroke-text-wipe-${rawId}`;
  const characters = Array.from(String(text ?? ''));
  const dash = Math.max(fontSize * 7, 200);

  container.innerHTML = `
    <span class="stroke-text" role="img" aria-label="${text.replace(/"/g, '&quot;')}" style="--stroke-text-height: ${Math.round(fontSize * 1.35)}px">
      <svg class="stroke-text__svg" viewBox="0 ${-fontSize} 800 ${fontSize * 1.4}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <clipPath id="${wipeId}" clipPathUnits="userSpaceOnUse">
            <rect class="wipe-rect" x="0" y="${-fontSize}" width="0" height="${fontSize * 2}" />
          </clipPath>
        </defs>
        <text class="stroke-text__stroke" x="0" y="0" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" style="font-size: ${fontSize}px; font-weight: ${fontWeight}; letter-spacing: ${letterSpacing}px;">
          ${characters.map(ch => `<tspan data-stroke-char>${ch === ' ' ? '&#160;' : ch}</tspan>`).join('')}
        </text>
        <text class="stroke-text__fill" x="0" y="0" fill="${fillColor}" stroke="none" style="font-size: ${fontSize}px; font-weight: ${fontWeight}; letter-spacing: ${letterSpacing}px;" clip-path="${fillMode === 'wipe' ? `url(#${wipeId})` : 'none'}">
          ${characters.map(ch => `<tspan data-fill-char>${ch === ' ' ? '&#160;' : ch}</tspan>`).join('')}
        </text>
      </svg>
    </span>
  `;

  const svg = container.querySelector('.stroke-text__svg');
  const strokeTextElem = container.querySelector('.stroke-text__stroke');
  const wipeRect = container.querySelector('.wipe-rect');
  const strokes = Array.from(container.querySelectorAll('[data-stroke-char]'));
  const fills = Array.from(container.querySelectorAll('[data-fill-char]'));

  // Calculate bounding box and calibrate viewBox
  let box = { x: 0, y: -fontSize * 0.9, width: 600, height: fontSize * 1.3 };
  try {
    if (strokeTextElem && typeof strokeTextElem.getBBox === 'function') {
      const bbox = strokeTextElem.getBBox();
      if (bbox && bbox.width > 0) {
        const pad = Math.max(Number(strokeWidth) || 1, fontSize * 0.1);
        box = {
          x: bbox.x - pad,
          y: bbox.y - pad,
          width: bbox.width + pad * 2,
          height: bbox.height + pad * 2
        };
        svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
        if (wipeRect) {
          wipeRect.setAttribute('x', box.x);
          wipeRect.setAttribute('y', box.y);
          wipeRect.setAttribute('height', box.height);
        }
      }
    }
  } catch (e) {}

  let timeline = null;

  const play = () => {
    if (typeof gsap === 'undefined') {
      // Fallback if GSAP is unavailable
      container.querySelectorAll('[data-stroke-char]').forEach(s => {
        s.style.strokeDashoffset = '0';
      });
      container.querySelectorAll('[data-fill-char]').forEach(f => {
        f.style.opacity = '1';
      });
      if (onComplete) onComplete();
      return;
    }

    // Remeasure if browser rendered fonts now
    try {
      if (strokeTextElem && typeof strokeTextElem.getBBox === 'function') {
        const bbox = strokeTextElem.getBBox();
        if (bbox && bbox.width > 0) {
          const pad = Math.max(Number(strokeWidth) || 1, fontSize * 0.1);
          box = {
            x: bbox.x - pad,
            y: bbox.y - pad,
            width: bbox.width + pad * 2,
            height: bbox.height + pad * 2
          };
          svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
          if (wipeRect) {
            wipeRect.setAttribute('x', box.x);
            wipeRect.setAttribute('y', box.y);
            wipeRect.setAttribute('height', box.height);
          }
        }
      }
    } catch (e) {}

    const fillEnabled = fillMode !== 'none';
    const useWipe = fillEnabled && fillMode === 'wipe';
    const fillDuration = Math.max(0.4, drawDuration * 0.5);
    const staggerConfig = reverse ? { each: stagger, from: 'end' } : stagger;
    const targets = [...strokes, ...fills, wipeRect].filter(Boolean);

    gsap.killTweensOf(targets);
    gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
    gsap.set(fills, { opacity: useWipe ? 1 : 0 });
    if (wipeRect) gsap.set(wipeRect, { attr: { width: 0 } });

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) {
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
      gsap.set(fills, { opacity: fillEnabled ? 1 : 0 });
      if (wipeRect) gsap.set(wipeRect, { attr: { width: fillEnabled ? box.width : 0 } });
      if (onComplete) onComplete();
      return;
    }

    timeline = gsap.timeline({
      paused: false,
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });

    timeline.to(strokes, {
      strokeDashoffset: 0,
      duration: drawDuration,
      ease,
      stagger: staggerConfig
    }, 0);

    if (useWipe && wipeRect) {
      timeline.to(
        wipeRect,
        { attr: { width: box.width }, duration: fillDuration, ease: 'power2.inOut' },
        drawDuration + fillDelay
      );
    } else if (fillEnabled) {
      timeline.to(
        fills,
        { opacity: 1, duration: fillDuration, ease: 'power2.out', stagger: staggerConfig },
        drawDuration + fillDelay
      );
    }
  };

  const kill = () => {
    if (timeline) timeline.kill();
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf([...strokes, ...fills, wipeRect].filter(Boolean));
    }
  };

  return { play, kill };
}

// Controller for Instrument Intros
const instrumentIntros = {
  vernier: {
    text: 'Vernier Caliper',
    strokeColor: '#3da5d9',
    fillColor: '#f0f7fd',
    containerId: 'vernier-stroke-container',
    overlayId: 'vernier-intro-overlay',
    skipBtnId: 'vernier-intro-skip',
    played: false,
    controller: null
  },
  screw: {
    text: 'Screw Gauge',
    strokeColor: '#fec601',
    fillColor: '#f0f7fd',
    containerId: 'screw-stroke-container',
    overlayId: 'screw-intro-overlay',
    skipBtnId: 'screw-intro-skip',
    played: false,
    controller: null
  },
  spherometer: {
    text: 'Spherometer',
    strokeColor: '#73bfb8',
    fillColor: '#f0f7fd',
    containerId: 'spherometer-stroke-container',
    overlayId: 'spherometer-intro-overlay',
    skipBtnId: 'spherometer-intro-skip',
    played: false,
    controller: null
  }
};

function dismissInstrumentIntro(key) {
  const config = instrumentIntros[key];
  if (!config) return;
  const overlay = document.getElementById(config.overlayId);
  if (overlay) {
    overlay.classList.add('hidden');
    config.played = true;
  }
}

function playInstrumentIntro(key) {
  const config = instrumentIntros[key];
  if (!config || config.played) return;

  const overlay = document.getElementById(config.overlayId);
  if (!overlay) return;

  updateHeaderHeight();
  overlay.classList.remove('hidden');

  // Slight delay to ensure section display and layout have stabilized
  setTimeout(() => {
    updateHeaderHeight();
    if (config.controller) {
      config.controller.kill();
    }
    const container = document.getElementById(config.containerId);
    if (!container) return;

    config.controller = createStrokeText(container, {
      text: config.text,
      strokeColor: config.strokeColor,
      fillColor: config.fillColor,
      strokeWidth: 1.8,
      drawDuration: 1.5,
      fillDelay: 0.18,
      stagger: 0.045,
      ease: 'power2.out',
      fillMode: 'wipe',
      fontSize: 84,
      fontWeight: 700,
      letterSpacing: 3,
      onComplete: () => {
        // Pause briefly so user appreciates the filled title, then reveal the simulator
        setTimeout(() => {
          dismissInstrumentIntro(key);
        }, 600);
      }
    });

    config.controller.play();
  }, 120);
}

function updateHeaderHeight() {
  const header = document.querySelector('header');
  if (header) {
    const rect = header.getBoundingClientRect();
    const h = Math.round(rect.bottom);
    if (h > 0) {
      document.documentElement.style.setProperty('--header-actual-height', `${h}px`);
    }
  }
}

function initStrokeTextIntros() {
  updateHeaderHeight();
  window.addEventListener('resize', updateHeaderHeight);

  Object.keys(instrumentIntros).forEach(key => {
    const config = instrumentIntros[key];
    const skipBtn = document.getElementById(config.skipBtnId);
    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (config.controller) {
          config.controller.kill();
        }
        dismissInstrumentIntro(key);
      });
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VernierEngine, ScrewEngine, SpherometerEngine };
}



