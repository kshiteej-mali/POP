


function formatNumber(num, decimals = 4) {
  if (isNaN(num) || num === null) return "0";
  
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  return rounded.toString();
}




function initWarpText() {
  const container = document.getElementById("warp-text-box");
  const canvas = document.getElementById("warp-canvas");
  if (!container || !canvas) return;

  const textToRender = "POP";
  let gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });

  
  if (!gl) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const render2D = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const fontSize = Math.min(Math.max(width * 0.12, 48), 92);
      ctx.font = `900 ${fontSize}px "Georgia", "Times New Roman", serif, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#F2DFD7"; 
      ctx.shadowColor = "#C47AC0";
      ctx.shadowBlur = 24;
      ctx.fillText(textToRender, width / 2, height / 2);
    };
    window.addEventListener("resize", render2D);
    render2D();
    return;
  }

  
  const vsSource = `#version 300 es
  in vec2 a_position;
  in vec2 a_uv;
  out vec2 vUv;
  void main() {
    vUv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }`;

  const fsSource = `#version 300 es
  precision highp float;
  uniform sampler2D uTextTexture;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uPointerActive;
  uniform float uTime;
  uniform float uWarpStrength;
  uniform float uWarpScale;
  uniform float uSpeed;
  uniform float uPointerInfluence;
  uniform float uPointerStrength;
  uniform float uRefraction;

  in vec2 vUv;
  out vec4 fragColor;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  vec4 sampleText(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      return vec4(0.0);
    }
    return texture(uTextTexture, uv);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    float time = uTime * uSpeed;
    float scale = max(uWarpScale, 0.001);

    vec2 drift = vec2(time * 0.055, -time * 0.045);
    float n1 = fbm(uv * scale * 3.1 + drift);
    float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
    vec2 ambient = (vec2(n1, n2) - 0.5) * uWarpStrength * 0.045;

    vec2 pointerDelta = uv - uPointer;
    vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
    float dist = length(aspectDelta);
    float radius = max(uPointerInfluence, 0.001);
    float t = clamp(dist / radius, 0.0, 1.0);
    float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
    float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
    vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);

    float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
    float rippleRing = (rippleWave - 0.5) * 1.0;
    vec2 pointerWarp = -dir * bulge * uPointerStrength * 0.045;
    pointerWarp += dir * rippleRing * bulge * uPointerStrength * 0.016;

    vec2 displaced = uv + ambient + pointerWarp;
    vec2 splitDir = ambient + pointerWarp;
    float splitLen = length(splitDir);
    splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
    vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65);

    vec4 base = sampleText(displaced);
    float r = sampleText(displaced + split).r;
    float g = base.g;
    float b = sampleText(displaced - split).b;
    float a = max(max(sampleText(displaced + split).a, base.a), sampleText(displaced - split).a);
    vec3 baseWhite = vec3(1.0, 1.0, 1.0);
    vec3 orchidMist = vec3(0.768, 0.478, 0.753);
    vec3 powderPetal = vec3(0.949, 0.875, 0.843);
    vec3 warpColor = mix(baseWhite, orchidMist, clamp(length(splitDir) * 1.5, 0.0, 0.6));
    warpColor = mix(warpColor, powderPetal, lens * 0.4);

    vec3 finalRgb = (vec3(r, g, b) * warpColor) + (lens * base.a * orchidMist * 0.4);
    fragColor = vec4(finalRgb, a);
  }`;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);

  
  
  const positions = new Float32Array([
    -1, -1, 0, 1,
     1, -1, 1, 1,
    -1,  1, 0, 0,
    -1,  1, 0, 0,
     1, -1, 1, 1,
     1,  1, 1, 0
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, "a_position");
  const aUv = gl.getAttribLocation(program, "a_uv");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

  
  const uResLoc = gl.getUniformLocation(program, "uResolution");
  const uPointerLoc = gl.getUniformLocation(program, "uPointer");
  const uPointerActiveLoc = gl.getUniformLocation(program, "uPointerActive");
  const uTimeLoc = gl.getUniformLocation(program, "uTime");
  const uWarpStrengthLoc = gl.getUniformLocation(program, "uWarpStrength");
  const uWarpScaleLoc = gl.getUniformLocation(program, "uWarpScale");
  const uSpeedLoc = gl.getUniformLocation(program, "uSpeed");
  const uPointerInfluenceLoc = gl.getUniformLocation(program, "uPointerInfluence");
  const uPointerStrengthLoc = gl.getUniformLocation(program, "uPointerStrength");
  const uRefractionLoc = gl.getUniformLocation(program, "uRefraction");
  const uTextTextureLoc = gl.getUniformLocation(program, "uTextTexture");

  
  const textCanvas = document.createElement("canvas");
  const textCtx = textCanvas.getContext("2d");
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  function rasterizeText(w, h, dpr) {
    textCanvas.width = Math.max(1, Math.floor(w * dpr));
    textCanvas.height = Math.max(1, Math.floor(h * dpr));
    textCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    textCtx.clearRect(0, 0, w, h);

    
    const fontSize = Math.min(Math.max(w * 0.12, 48), 96);
    textCtx.font = `900 ${fontSize}px "Georgia", "Times New Roman", serif, -apple-system, sans-serif`;
    textCtx.textAlign = "center";
    textCtx.textBaseline = "middle";
    textCtx.fillStyle = "#F2DFD7"; 

    textCtx.fillText(textToRender, w / 2, h / 2);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  }

  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, activeTarget: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 180;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    rasterizeText(w, h, dpr);
  }

  resize();
  window.addEventListener("resize", resize);

  container.addEventListener("pointermove", (e) => {
    const rect = container.getBoundingClientRect();
    pointer.tx = (e.clientX - rect.left) / rect.width;
    pointer.ty = (e.clientY - rect.top) / rect.height; 
    pointer.activeTarget = 1;
  });

  container.addEventListener("pointerleave", () => {
    pointer.activeTarget = 0;
  });

  const startTime = performance.now();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function render(time) {
    const elapsed = (time - startTime) * 0.001;

    
    const idleX = 0.5 + Math.sin(elapsed * 0.8) * 0.15;
    const idleY = 0.5 + Math.cos(elapsed * 0.6) * 0.12;
    const targetX = pointer.activeTarget > 0 ? pointer.tx : idleX;
    const targetY = pointer.activeTarget > 0 ? pointer.ty : idleY;

    pointer.x += (targetX - pointer.x) * 0.1;
    pointer.y += (targetY - pointer.y) * 0.1;
    pointer.active += ((pointer.activeTarget > 0 ? 1 : 0.3) - pointer.active) * 0.06;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform2f(uPointerLoc, pointer.x, pointer.y);
    gl.uniform1f(uPointerActiveLoc, pointer.active);
    gl.uniform1f(uTimeLoc, elapsed);
    gl.uniform1f(uWarpStrengthLoc, 0.1);
    gl.uniform1f(uWarpScaleLoc, 1.8);
    gl.uniform1f(uSpeedLoc, 0.6);
    gl.uniform1f(uPointerInfluenceLoc, 0.35);
    gl.uniform1f(uPointerStrengthLoc, 0.45);
    gl.uniform1f(uRefractionLoc, 0.024);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uTextTextureLoc, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWarpText);
} else {
  initWarpText();
}






function initVernierSimulator() {
  const toggleBtn = document.getElementById("toggle-vernier-sim-btn");
  const wrapper = document.getElementById("vernier-sim-wrapper");
  const canvas = document.getElementById("vernier-canvas");
  const slider = document.getElementById("vsim-slider");
  const sliderDisp = document.getElementById("vsim-slider-val");
  const zoomWrapper = document.getElementById("vsim-zoom-wrapper");
  const zoomInBtn = document.getElementById("vsim-zoom-in");
  const zoomOutBtn = document.getElementById("vsim-zoom-out");
  const zoomResetBtn = document.getElementById("vsim-zoom-reset");
  const flipBtn = document.getElementById("vsim-flip-btn");
  const objButtons = document.querySelectorAll(".obj-btn");
  const simBtnText = document.getElementById("sim-btn-text");

  if (!toggleBtn || !wrapper || !canvas) return;

  const ctx = canvas.getContext("2d");
  let isOpen = false;
  let currentReadingMm = 0.0; 
  let currentZoom = 1.0;
  let isVerticalFlipped = false;
  let selectedObject = "none";
  let activeObjectData = null;

  
  const BEAM_Y = 120;
  const BEAM_H = 46;
  const BEAM_LEFT = 90;
  const BEAM_RIGHT = 860; 
  const ZERO_PIXEL = 160;
  const PIXELS_PER_MM = 5.0; 

  
  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    if (isOpen) {
      wrapper.style.display = "block";
      simBtnText.textContent = "Close Virtual Caliper";
      drawCaliper();
    } else {
      wrapper.style.display = "none";
      simBtnText.textContent = "Open Interactive Virtual Caliper";
    }
  });

  
  slider.addEventListener("input", (e) => {
    currentReadingMm = parseFloat(e.target.value);
    sliderDisp.textContent = `${currentReadingMm.toFixed(1)} mm`;
    drawCaliper();
  });

  
  function applyZoom(z) {
    currentZoom = Math.min(Math.max(Math.round(z * 100) / 100, 0.4), 2.5);
    zoomWrapper.style.transform = `scale(${currentZoom})`;
    if (zoomResetBtn) {
      zoomResetBtn.textContent = `Zoom: ${Math.round(currentZoom * 100)}%`;
    }
  }

  zoomInBtn.addEventListener("click", () => applyZoom(currentZoom + 0.2));
  zoomOutBtn.addEventListener("click", () => applyZoom(currentZoom - 0.2));
  zoomResetBtn.addEventListener("click", () => applyZoom(1.0));

  
  flipBtn.addEventListener("click", () => {
    isVerticalFlipped = !isVerticalFlipped;
    if (isVerticalFlipped) {
      canvas.classList.add("vertical-flipped");
      flipBtn.textContent = "🔄 Flip to Horizontal (Jaw Mode)";
      flipBtn.classList.add("active");
    } else {
      canvas.classList.remove("vertical-flipped");
      flipBtn.textContent = "🔄 Flip to Vertical (Depth Mode)";
      flipBtn.classList.remove("active");
    }
    drawCaliper();
  });

  
  objButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      objButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedObject = btn.dataset.obj;

      if (selectedObject === "none") {
        activeObjectData = null;
      } else {
        const size = parseFloat(btn.dataset.size);
        const type = btn.dataset.type;
        activeObjectData = { size, type, name: btn.textContent.trim() };
        currentReadingMm = size;
        slider.value = size;
        sliderDisp.textContent = `${size.toFixed(1)} mm`;

        
        if (type === "depth" && !isVerticalFlipped) {
          isVerticalFlipped = true;
          canvas.classList.add("vertical-flipped");
          flipBtn.textContent = "🔄 Flip to Horizontal (Jaw Mode)";
        } else if (type !== "depth" && isVerticalFlipped) {
          isVerticalFlipped = false;
          canvas.classList.remove("vertical-flipped");
          flipBtn.textContent = "🔄 Flip to Vertical (Depth Mode)";
        }
      }
      drawCaliper();
    });
  });

  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartMm = 0;

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartMm = currentReadingMm;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const deltaX = (e.clientX - dragStartX) * (canvas.width / canvas.clientWidth);
    const deltaMm = isVerticalFlipped ? (deltaX / (PIXELS_PER_MM * currentZoom)) : (deltaX / (PIXELS_PER_MM * currentZoom));
    let newMm = Math.min(Math.max(dragStartMm + deltaMm, 0), 120);
    newMm = Math.round(newMm * 10) / 10;
    currentReadingMm = newMm;
    slider.value = newMm;
    sliderDisp.textContent = `${newMm.toFixed(1)} mm`;
    drawCaliper();
  });

  canvas.addEventListener("pointerup", (e) => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener("pointercancel", () => { isDragging = false; });

  
  function drawCaliper() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const slidePx = currentReadingMm * PIXELS_PER_MM;
    const vernierZeroX = ZERO_PIXEL + slidePx;

    
    
    ctx.save();
    const depthBarW = slidePx;
    if (depthBarW > 0) {
      ctx.fillStyle = "#cbd5e1";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      const barY = BEAM_Y + 18;
      const barH = 10;
      ctx.fillRect(BEAM_RIGHT, barY, depthBarW, barH);
      ctx.strokeRect(BEAM_RIGHT, barY, depthBarW, barH);

      
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(BEAM_RIGHT + depthBarW - 3, barY, 3, barH);

      
      if (slidePx > 30) {
        ctx.fillStyle = "#C47AC0";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Depth Rod: ${currentReadingMm.toFixed(1)} mm`, BEAM_RIGHT + depthBarW / 2, barY - 6);
      }
    }
    ctx.restore();

    
    ctx.save();
    
    const beamGrad = ctx.createLinearGradient(0, BEAM_Y, 0, BEAM_Y + BEAM_H);
    beamGrad.addColorStop(0, "#e2e8f0");
    beamGrad.addColorStop(0.3, "#f8fafc");
    beamGrad.addColorStop(0.7, "#cbd5e1");
    beamGrad.addColorStop(1, "#94a3b8");

    ctx.fillStyle = beamGrad;
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.fillRect(BEAM_LEFT, BEAM_Y, BEAM_RIGHT - BEAM_LEFT, BEAM_H);
    ctx.strokeRect(BEAM_LEFT, BEAM_Y, BEAM_RIGHT - BEAM_LEFT, BEAM_H);

    
    ctx.beginPath();
    
    ctx.moveTo(BEAM_LEFT, BEAM_Y);
    ctx.lineTo(ZERO_PIXEL, BEAM_Y);
    ctx.lineTo(ZERO_PIXEL, BEAM_Y + BEAM_H + 150); 
    ctx.lineTo(ZERO_PIXEL - 14, BEAM_Y + BEAM_H + 150); 
    ctx.bezierCurveTo(ZERO_PIXEL - 24, BEAM_Y + BEAM_H + 90, BEAM_LEFT - 30, BEAM_Y + BEAM_H + 30, BEAM_LEFT - 30, BEAM_Y + BEAM_H);
    ctx.lineTo(BEAM_LEFT - 30, BEAM_Y);
    
    ctx.lineTo(BEAM_LEFT - 30, BEAM_Y - 70);
    ctx.lineTo(ZERO_PIXEL - 10, BEAM_Y - 70);
    ctx.lineTo(ZERO_PIXEL, BEAM_Y);
    ctx.closePath();
    ctx.fillStyle = beamGrad;
    ctx.fill();
    ctx.stroke();

    
    ctx.fillStyle = "#475569";
    ctx.fillRect(ZERO_PIXEL - 3, BEAM_Y + BEAM_H + 50, 3, 100); 
    ctx.fillRect(ZERO_PIXEL - 3, BEAM_Y - 70, 3, 40); 
    ctx.restore();

    
    ctx.save();
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";

    const totalMm = Math.floor((BEAM_RIGHT - ZERO_PIXEL - 20) / PIXELS_PER_MM);
    for (let m = 0; m <= totalMm; m++) {
      const x = ZERO_PIXEL + m * PIXELS_PER_MM;
      let tickH = 6;
      if (m % 10 === 0) {
        tickH = 15;
        
        ctx.fillText((m / 10).toString(), x, BEAM_Y + BEAM_H - 18);
      } else if (m % 5 === 0) {
        tickH = 10;
      }
      ctx.beginPath();
      ctx.moveTo(x, BEAM_Y + BEAM_H);
      ctx.lineTo(x, BEAM_Y + BEAM_H - tickH);
      ctx.stroke();
    }
    
    ctx.font = "bold 9px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("cm / mm (1 div = 1 mm)", BEAM_LEFT + 15, BEAM_Y + 16);
    ctx.restore();

    
    if (activeObjectData && activeObjectData.type === "outer") {
      drawExternalObject(ctx, ZERO_PIXEL, vernierZeroX, BEAM_Y + BEAM_H + 50, activeObjectData);
    } else if (activeObjectData && activeObjectData.type === "inner") {
      drawInternalObject(ctx, ZERO_PIXEL, vernierZeroX, BEAM_Y - 60, activeObjectData);
    } else if (activeObjectData && activeObjectData.type === "depth") {
      drawDepthObject(ctx, BEAM_RIGHT, slidePx, BEAM_Y + 18, activeObjectData);
    }

    
    ctx.save();
    const vernierGrad = ctx.createLinearGradient(vernierZeroX - 40, BEAM_Y - 20, vernierZeroX + 130, BEAM_Y + BEAM_H + 20);
    vernierGrad.addColorStop(0, "#f1f5f9");
    vernierGrad.addColorStop(0.5, "#e2e8f0");
    vernierGrad.addColorStop(1, "#cbd5e1");

    
    ctx.beginPath();
    
    ctx.moveTo(vernierZeroX, BEAM_Y);
    
    ctx.lineTo(vernierZeroX, BEAM_Y - 70);
    ctx.lineTo(vernierZeroX + 16, BEAM_Y - 70);
    ctx.lineTo(vernierZeroX + 50, BEAM_Y - 20);
    
    ctx.lineTo(vernierZeroX + 120, BEAM_Y - 20);
    ctx.lineTo(vernierZeroX + 120, BEAM_Y + BEAM_H + 25);
    
    ctx.bezierCurveTo(vernierZeroX + 120, BEAM_Y + BEAM_H + 45, vernierZeroX + 90, BEAM_Y + BEAM_H + 55, vernierZeroX + 75, BEAM_Y + BEAM_H + 35);
    ctx.lineTo(vernierZeroX + 45, BEAM_Y + BEAM_H + 35);
    
    ctx.bezierCurveTo(vernierZeroX + 45, BEAM_Y + BEAM_H + 90, vernierZeroX + 22, BEAM_Y + BEAM_H + 130, vernierZeroX + 14, BEAM_Y + BEAM_H + 150);
    ctx.lineTo(vernierZeroX, BEAM_Y + BEAM_H + 150); 
    ctx.lineTo(vernierZeroX, BEAM_Y);
    ctx.closePath();

    ctx.fillStyle = vernierGrad;
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    
    ctx.fillStyle = "#334155";
    ctx.fillRect(vernierZeroX, BEAM_Y + BEAM_H + 50, 3, 100);
    ctx.fillRect(vernierZeroX, BEAM_Y - 70, 3, 40);

    
    drawScrewKnob(ctx, vernierZeroX + 55, BEAM_Y - 26, 16, 12);
    drawScrewKnob(ctx, vernierZeroX + 155, BEAM_Y - 26, 16, 12);

    
    ctx.fillStyle = "#cbd5e1";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.fillRect(vernierZeroX + 135, BEAM_Y - 14, 38, BEAM_H + 28);
    ctx.strokeRect(vernierZeroX + 135, BEAM_Y - 14, 38, BEAM_H + 28);
    
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(vernierZeroX + 120, BEAM_Y + 16, 15, 6);

    
    const vWindowX = vernierZeroX;
    const vWindowY = BEAM_Y + 8;
    const vWindowW = 9 * PIXELS_PER_MM; 
    const vWindowH = 34;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.fillRect(vWindowX - 2, vWindowY, vWindowW + 8, vWindowH);
    ctx.strokeRect(vWindowX - 2, vWindowY, vWindowW + 8, vWindowH);

    
    const currentFraction = currentReadingMm - Math.floor(currentReadingMm);
    const bestCoincidenceDiv = Math.round(currentFraction * 10);

    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i <= 10; i++) {
      
      const vx = vernierZeroX + (i * 0.9 * PIXELS_PER_MM);
      const isCoincident = (i === bestCoincidenceDiv);

      ctx.beginPath();
      ctx.moveTo(vx, vWindowY);
      ctx.lineTo(vx, vWindowY + (i % 5 === 0 ? 14 : 9));

      if (isCoincident) {
        ctx.strokeStyle = "#C47AC0"; 
        ctx.lineWidth = 2.2;
      } else {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      
      if (i === 0 || i === 5 || i === 10) {
        ctx.fillStyle = isCoincident ? "#C47AC0" : "#334155";
        ctx.fillText(i.toString(), vx, vWindowY + 24);
      }
    }

    
    ctx.fillStyle = "#C47AC0";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Vernier (LC 0.1 mm)", vWindowX, vWindowY + vWindowH - 2);

    
    const coincidentX = vernierZeroX + (bestCoincidenceDiv * 0.9 * PIXELS_PER_MM);
    ctx.fillStyle = "#C47AC0";
    ctx.beginPath();
    ctx.moveTo(coincidentX, vWindowY - 3);
    ctx.lineTo(coincidentX - 4, vWindowY - 8);
    ctx.lineTo(coincidentX + 4, vWindowY - 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  
  function drawScrewKnob(c, x, y, w, h) {
    c.save();
    const knobGrad = c.createLinearGradient(x, y, x + w, y);
    knobGrad.addColorStop(0, "#94a3b8");
    knobGrad.addColorStop(0.5, "#f1f5f9");
    knobGrad.addColorStop(1, "#64748b");
    c.fillStyle = knobGrad;
    c.strokeStyle = "#475569";
    c.lineWidth = 1;
    c.fillRect(x - w / 2, y, w, h);
    c.strokeRect(x - w / 2, y, w, h);
    
    c.strokeStyle = "rgba(0,0,0,0.3)";
    for (let i = x - w / 2 + 2; i < x + w / 2; i += 3) {
      c.beginPath();
      c.moveTo(i, y);
      c.lineTo(i, y + h);
      c.stroke();
    }
    c.restore();
  }

  
  function drawExternalObject(c, leftX, rightX, midY, obj) {
    const gap = rightX - leftX;
    if (gap <= 2) return;
    c.save();
    const cx = (leftX + rightX) / 2;
    const cy = midY + 45;

    if (obj.type === "outer" && obj.name.includes("Marble")) {
      const radius = Math.min(gap / 2, 45);
      const grad = c.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, "#93c5fd");
      grad.addColorStop(0.5, "#3b82f6");
      grad.addColorStop(1, "#1e3a8a");
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#60a5fa";
      c.stroke();
    } else {
      
      const w = gap;
      const h = 75;
      const grad = c.createLinearGradient(leftX, 0, rightX, 0);
      grad.addColorStop(0, "#b45309");
      grad.addColorStop(0.3, "#fde047");
      grad.addColorStop(0.7, "#eab308");
      grad.addColorStop(1, "#78350f");
      c.fillStyle = grad;
      c.fillRect(leftX, cy - h / 2, w, h);
      c.strokeStyle = "#451a03";
      c.lineWidth = 1.5;
      c.strokeRect(leftX, cy - h / 2, w, h);
    }
    c.restore();
  }

  
  function drawInternalObject(c, leftX, rightX, topY, obj) {
    const gap = rightX - leftX;
    if (gap <= 2) return;
    c.save();
    c.strokeStyle = "#38bdf8";
    c.lineWidth = 3;
    c.fillStyle = "rgba(56, 189, 248, 0.15)";
    
    c.strokeRect(leftX - 12, topY - 15, gap + 24, 30);
    c.fillRect(leftX - 12, topY - 15, gap + 24, 30);
    c.fillStyle = "#38bdf8";
    c.font = "10px sans-serif";
    c.textAlign = "center";
    c.fillText("Inner Bore Ring", (leftX + rightX) / 2, topY + 4);
    c.restore();
  }

  
  function drawDepthObject(c, originX, depthPx, barY, obj) {
    c.save();
    const wellW = depthPx + 20;
    const wellH = 50;
    c.fillStyle = "rgba(196, 122, 192, 0.15)";
    c.strokeStyle = "#C47AC0";
    c.lineWidth = 2;
    
    c.strokeRect(originX, barY - 15, depthPx, 40);
    c.fillRect(originX, barY - 15, depthPx, 40);
    c.fillStyle = "#C47AC0";
    c.font = "bold 10px sans-serif";
    c.textAlign = "left";
    c.fillText(`Well Cavity: ${activeObjectData.size} mm`, originX + 10, barY + 35);
    c.restore();
  }

  
  drawCaliper();
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVernierSimulator);
} else {
  initVernierSimulator();
}




const vernierForm = document.getElementById("vernier-form");
const vernierResetBtn = document.getElementById("vernier-reset-btn");
const vernierResultBox = document.getElementById("vernier-result-box");
const vernierErrorBox = document.getElementById("vernier-error-box");
const vernierSteps = document.getElementById("vernier-steps");
const vernierFinalValue = document.getElementById("vernier-final-value");

if (vernierForm) {
  vernierForm.addEventListener("submit", function (e) {
    e.preventDefault();
    vernierErrorBox.classList.remove("active");
    vernierResultBox.classList.remove("active");

    const msrVal = document.getElementById("vernier-msr").value.trim();
    const vsrVal = document.getElementById("vernier-vsr").value.trim();
    const lcVal = document.getElementById("vernier-lc").value.trim();
    const zeVal = document.getElementById("vernier-ze").value.trim();
    const unit = document.getElementById("vernier-unit").value;

    if (msrVal === "" || vsrVal === "" || lcVal === "" || zeVal === "") {
      showError(vernierErrorBox, "Please fill in all required fields.");
      return;
    }

    const msr = parseFloat(msrVal);
    const vsr = parseFloat(vsrVal);
    const lc = parseFloat(lcVal);
    const ze = parseFloat(zeVal);

    if (isNaN(msr) || isNaN(vsr) || isNaN(lc) || isNaN(ze)) {
      showError(vernierErrorBox, "Please enter valid numeric values for all inputs.");
      return;
    }

    if (lc <= 0) {
      showError(vernierErrorBox, "Least Count must be a positive number greater than 0.");
      return;
    }

    if (vsr < 0) {
      showError(vernierErrorBox, "Vernier Scale Reading (coincidence) cannot be negative.");
      return;
    }

    
    
    
    const vernierPart = vsr * lc;
    const observed = msr + vernierPart;
    const corrected = observed - ze;

    const zeSignStr = ze >= 0 ? `+${formatNumber(ze)}` : `${formatNumber(ze)}`;
    const zeSubtractionStr = ze >= 0 
      ? `${formatNumber(observed)} − ${formatNumber(ze)}` 
      : `${formatNumber(observed)} − (${formatNumber(ze)}) = ${formatNumber(observed)} + ${formatNumber(Math.abs(ze))}`;

    vernierSteps.innerHTML = `
      <div class="step-row"><strong>Main Scale Reading (MSR)</strong> = ${formatNumber(msr)} ${unit}</div>
      <div class="step-row"><strong>Vernier Reading (VSR)</strong> = ${formatNumber(vsr)} div</div>
      <div class="step-row"><strong>Least Count (LC)</strong> = ${formatNumber(lc)} ${unit}</div>
      <div class="step-row"><strong>Zero Error (ZE)</strong> = ${zeSignStr} ${unit}</div>
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
      <div class="step-row"><strong>Observed Reading</strong> = MSR + (VSR × LC)</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(msr)} + (${formatNumber(vsr)} × ${formatNumber(lc)})</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(msr)} + ${formatNumber(vernierPart)}</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>${formatNumber(observed)} ${unit}</strong></div>
      <div class="step-row" style="margin-top: 0.5rem;"><strong>Corrected Reading</strong> = Observed Reading − Zero Error</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${zeSubtractionStr}</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>${formatNumber(corrected)} ${unit}</strong></div>
    `;

    vernierFinalValue.textContent = `${formatNumber(corrected)} ${unit}`;
    vernierResultBox.classList.add("active");
  });

  vernierResetBtn.addEventListener("click", function () {
    vernierForm.reset();
    vernierErrorBox.classList.remove("active");
    vernierResultBox.classList.remove("active");
  });
}






function initScrewSimulator() {
  const toggleBtn = document.getElementById("toggle-screw-sim-btn");
  const wrapper = document.getElementById("screw-sim-wrapper");
  const canvas = document.getElementById("screw-canvas");
  const slider = document.getElementById("ssim-slider");
  const sliderDisp = document.getElementById("ssim-slider-val");
  const zoomWrapper = document.getElementById("ssim-zoom-wrapper");
  const zoomInBtn = document.getElementById("ssim-zoom-in");
  const zoomOutBtn = document.getElementById("ssim-zoom-out");
  const zoomResetBtn = document.getElementById("ssim-zoom-reset");
  const simBtnText = document.getElementById("screw-sim-btn-text");
  const objButtons = document.querySelectorAll("#screw-object-buttons .obj-btn");

  if (!toggleBtn || !wrapper || !canvas) return;

  const ctx = canvas.getContext("2d");
  let isOpen = false;
  let currentReadingMm = 0.0; 
  let currentZoom = 1.0;
  let activeObjectData = null;

  
  const CENTER_Y = 190;
  const FRAME_LEFT = 110;
  const ANVIL_FACE_X = 230;     
  const SLEEVE_START_X = 520;   
  const SLEEVE_LEN = 360;       
  const SLEEVE_H = 68;          
  const PIXELS_PER_MM = 14.0;   

  
  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    if (isOpen) {
      wrapper.style.display = "block";
      simBtnText.textContent = "Close Virtual Screw Gauge";
      drawScrewGauge();
    } else {
      wrapper.style.display = "none";
      simBtnText.textContent = "Open Interactive Virtual Screw Gauge";
    }
  });

  
  slider.addEventListener("input", (e) => {
    currentReadingMm = parseFloat(e.target.value);
    sliderDisp.textContent = `${currentReadingMm.toFixed(2)} mm`;
    drawScrewGauge();
  });

  
  function applyZoom(z) {
    currentZoom = Math.min(Math.max(Math.round(z * 100) / 100, 0.4), 2.5);
    zoomWrapper.style.transform = `scale(${currentZoom})`;
    if (zoomResetBtn) {
      zoomResetBtn.textContent = `Zoom: ${Math.round(currentZoom * 100)}%`;
    }
  }

  zoomInBtn.addEventListener("click", () => applyZoom(currentZoom + 0.2));
  zoomOutBtn.addEventListener("click", () => applyZoom(currentZoom - 0.2));
  zoomResetBtn.addEventListener("click", () => applyZoom(1.0));

  
  objButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      objButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const objType = btn.dataset.obj;

      if (objType === "none") {
        activeObjectData = null;
      } else {
        const size = parseFloat(btn.dataset.size);
        activeObjectData = { size, name: btn.textContent.trim(), type: objType };
        currentReadingMm = size;
        slider.value = size;
        sliderDisp.textContent = `${size.toFixed(2)} mm`;
      }
      drawScrewGauge();
    });
  });

  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartMm = 0;

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartMm = currentReadingMm;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const deltaX = (e.clientX - dragStartX) * (canvas.width / canvas.clientWidth);
    const deltaMm = deltaX / (PIXELS_PER_MM * currentZoom);
    let newMm = Math.min(Math.max(dragStartMm + deltaMm, 0), 25);
    newMm = Math.round(newMm * 100) / 100;
    currentReadingMm = newMm;
    slider.value = newMm;
    sliderDisp.textContent = `${newMm.toFixed(2)} mm`;
    drawScrewGauge();
  });

  canvas.addEventListener("pointerup", (e) => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener("pointercancel", () => { isDragging = false; });

  
  function drawScrewGauge() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const spindleDisplacement = currentReadingMm * PIXELS_PER_MM;
    const spindleTipX = ANVIL_FACE_X + spindleDisplacement;
    const thimbleEdgeX = SLEEVE_START_X + spindleDisplacement;

    
    ctx.save();
    const frameGrad = ctx.createLinearGradient(FRAME_LEFT, CENTER_Y - 140, FRAME_LEFT + 380, CENTER_Y + 160);
    frameGrad.addColorStop(0, "#475569");
    frameGrad.addColorStop(0.3, "#64748b");
    frameGrad.addColorStop(0.7, "#334155");
    frameGrad.addColorStop(1, "#1e293b");

    ctx.lineWidth = 42;
    ctx.strokeStyle = frameGrad;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    ctx.beginPath();
    
    ctx.moveTo(ANVIL_FACE_X - 45, CENTER_Y);
    ctx.lineTo(FRAME_LEFT + 40, CENTER_Y);
    
    ctx.bezierCurveTo(FRAME_LEFT - 20, CENTER_Y + 220, ANVIL_FACE_X + 220, CENTER_Y + 220, SLEEVE_START_X - 10, CENTER_Y + 20);
    ctx.lineTo(SLEEVE_START_X - 10, CENTER_Y);
    ctx.stroke();

    
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();

    
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("0 - 25 mm  0.01 mm", (FRAME_LEFT + SLEEVE_START_X) / 2 - 30, CENTER_Y + 130);
    ctx.fillStyle = "#C47AC0";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("PRECISION MICROMETER", (FRAME_LEFT + SLEEVE_START_X) / 2 - 30, CENTER_Y + 148);
    ctx.restore();

    
    ctx.save();
    const anvilGrad = ctx.createLinearGradient(0, CENTER_Y - 20, 0, CENTER_Y + 20);
    anvilGrad.addColorStop(0, "#e2e8f0");
    anvilGrad.addColorStop(0.5, "#ffffff");
    anvilGrad.addColorStop(1, "#94a3b8");

    ctx.fillStyle = anvilGrad;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.fillRect(ANVIL_FACE_X - 35, CENTER_Y - 18, 35, 36);
    ctx.strokeRect(ANVIL_FACE_X - 35, CENTER_Y - 18, 35, 36);

    
    ctx.fillStyle = "#334155";
    ctx.fillRect(ANVIL_FACE_X - 4, CENTER_Y - 18, 4, 36);
    ctx.restore();

    
    if (activeObjectData && activeObjectData.type !== "none") {
      drawScrewObject(ctx, ANVIL_FACE_X, spindleTipX, CENTER_Y, activeObjectData);
    }

    
    ctx.save();
    const spindleW = SLEEVE_START_X - spindleTipX;
    if (spindleW > 0) {
      const spGrad = ctx.createLinearGradient(0, CENTER_Y - 18, 0, CENTER_Y + 18);
      spGrad.addColorStop(0, "#cbd5e1");
      spGrad.addColorStop(0.3, "#f8fafc");
      spGrad.addColorStop(0.7, "#e2e8f0");
      spGrad.addColorStop(1, "#64748b");

      ctx.fillStyle = spGrad;
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.fillRect(spindleTipX, CENTER_Y - 18, spindleW, 36);
      ctx.strokeRect(spindleTipX, CENTER_Y - 18, spindleW, 36);

      
      ctx.fillStyle = "#334155";
      ctx.fillRect(spindleTipX, CENTER_Y - 18, 4, 36);
    }
    ctx.restore();

    
    ctx.save();
    const sleeveGrad = ctx.createLinearGradient(0, CENTER_Y - SLEEVE_H / 2, 0, CENTER_Y + SLEEVE_H / 2);
    sleeveGrad.addColorStop(0, "#e2e8f0");
    sleeveGrad.addColorStop(0.3, "#ffffff");
    sleeveGrad.addColorStop(0.8, "#cbd5e1");
    sleeveGrad.addColorStop(1, "#94a3b8");

    ctx.fillStyle = sleeveGrad;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.fillRect(SLEEVE_START_X, CENTER_Y - SLEEVE_H / 2, SLEEVE_LEN, SLEEVE_H);
    ctx.strokeRect(SLEEVE_START_X, CENTER_Y - SLEEVE_H / 2, SLEEVE_LEN, SLEEVE_H);

    
    ctx.beginPath();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.8;
    ctx.moveTo(SLEEVE_START_X, CENTER_Y);
    ctx.lineTo(SLEEVE_START_X + SLEEVE_LEN, CENTER_Y);
    ctx.stroke();

    
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.lineWidth = 1.2;

    for (let m = 0; m <= 25; m++) {
      const gx = SLEEVE_START_X + (m * PIXELS_PER_MM);
      if (gx > thimbleEdgeX) break; 

      
      ctx.beginPath();
      ctx.moveTo(gx, CENTER_Y);
      ctx.lineTo(gx, CENTER_Y - (m % 5 === 0 ? 16 : 10));
      ctx.stroke();

      if (m % 5 === 0) {
        ctx.fillText(m.toString(), gx, CENTER_Y - 20);
      }

      
      if (m < 25) {
        const hx = gx + (0.5 * PIXELS_PER_MM);
        if (hx <= thimbleEdgeX) {
          ctx.beginPath();
          ctx.moveTo(hx, CENTER_Y);
          ctx.lineTo(hx, CENTER_Y + 10);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    
    ctx.save();
    const BEVEL_W = 55;
    const THIMBLE_BODY_W = 160;
    const THIMBLE_H = 88;
    const thimbleGrad = ctx.createLinearGradient(0, CENTER_Y - THIMBLE_H / 2, 0, CENTER_Y + THIMBLE_H / 2);
    thimbleGrad.addColorStop(0, "#f8fafc");
    thimbleGrad.addColorStop(0.3, "#e2e8f0");
    thimbleGrad.addColorStop(0.7, "#cbd5e1");
    thimbleGrad.addColorStop(1, "#64748b");

    
    ctx.beginPath();
    ctx.moveTo(thimbleEdgeX, CENTER_Y - SLEEVE_H / 2 - 2);
    ctx.lineTo(thimbleEdgeX + BEVEL_W, CENTER_Y - THIMBLE_H / 2);
    ctx.lineTo(thimbleEdgeX + BEVEL_W + THIMBLE_BODY_W, CENTER_Y - THIMBLE_H / 2);
    ctx.lineTo(thimbleEdgeX + BEVEL_W + THIMBLE_BODY_W, CENTER_Y + THIMBLE_H / 2);
    ctx.lineTo(thimbleEdgeX + BEVEL_W, CENTER_Y + THIMBLE_H / 2);
    ctx.lineTo(thimbleEdgeX, CENTER_Y + SLEEVE_H / 2 + 2);
    ctx.closePath();

    ctx.fillStyle = thimbleGrad;
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.stroke();

    
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    const gripStart = thimbleEdgeX + BEVEL_W + 15;
    const gripEnd = thimbleEdgeX + BEVEL_W + THIMBLE_BODY_W - 15;
    for (let k = gripStart; k <= gripEnd; k += 5) {
      ctx.beginPath();
      ctx.moveTo(k, CENTER_Y - THIMBLE_H / 2 + 4);
      ctx.lineTo(k, CENTER_Y + THIMBLE_H / 2 - 4);
      ctx.stroke();
    }

    
    
    const pitch = 1.0; 
    const totalDivisions = 100;
    const fractionMm = currentReadingMm - Math.floor(currentReadingMm);
    const centerDivision = (fractionMm / pitch) * totalDivisions; 

    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";

    
    const pxPerDivision = 3.6; 
    for (let dOffset = -15; dOffset <= 15; dOffset++) {
      let divVal = Math.round(centerDivision + dOffset);
      divVal = (divVal % totalDivisions + totalDivisions) % totalDivisions;
      const tickY = CENTER_Y - (dOffset * pxPerDivision);

      if (tickY < CENTER_Y - SLEEVE_H / 2 + 2 || tickY > CENTER_Y + SLEEVE_H / 2 - 2) continue;

      const isDatumAligned = (Math.abs(dOffset) < 0.25);

      ctx.beginPath();
      ctx.moveTo(thimbleEdgeX, tickY);
      ctx.lineTo(thimbleEdgeX + (divVal % 5 === 0 ? 18 : 10), tickY);

      if (isDatumAligned) {
        ctx.strokeStyle = "#C47AC0"; 
        ctx.lineWidth = 2.4;
      } else {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      if (divVal % 5 === 0) {
        ctx.fillStyle = isDatumAligned ? "#C47AC0" : "#1e293b";
        ctx.fillText(divVal.toString(), thimbleEdgeX + 22, tickY + 3);
      }
    }

    
    ctx.fillStyle = "#C47AC0";
    ctx.beginPath();
    ctx.moveTo(thimbleEdgeX - 2, CENTER_Y);
    ctx.lineTo(thimbleEdgeX - 8, CENTER_Y - 5);
    ctx.lineTo(thimbleEdgeX - 8, CENTER_Y + 5);
    ctx.closePath();
    ctx.fill();

    
    const RATCHET_START = thimbleEdgeX + BEVEL_W + THIMBLE_BODY_W;
    const RATCHET_W = 55;
    const RATCHET_H = 34;

    
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(RATCHET_START, CENTER_Y - 8, 14, 16);
    ctx.strokeRect(RATCHET_START, CENTER_Y - 8, 14, 16);

    
    const rGrad = ctx.createLinearGradient(0, CENTER_Y - RATCHET_H / 2, 0, CENTER_Y + RATCHET_H / 2);
    rGrad.addColorStop(0, "#cbd5e1");
    rGrad.addColorStop(0.5, "#f1f5f9");
    rGrad.addColorStop(1, "#64748b");

    ctx.fillStyle = rGrad;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.fillRect(RATCHET_START + 14, CENTER_Y - RATCHET_H / 2, RATCHET_W, RATCHET_H);
    ctx.strokeRect(RATCHET_START + 14, CENTER_Y - RATCHET_H / 2, RATCHET_W, RATCHET_H);

    
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    for (let r = RATCHET_START + 18; r < RATCHET_START + 14 + RATCHET_W; r += 4) {
      ctx.beginPath();
      ctx.moveTo(r, CENTER_Y - RATCHET_H / 2 + 2);
      ctx.lineTo(r, CENTER_Y + RATCHET_H / 2 - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  
  function drawScrewObject(c, leftX, rightX, midY, obj) {
    const gap = rightX - leftX;
    if (gap <= 1) return;
    c.save();
    const cx = (leftX + rightX) / 2;

    if (obj.type === "wire") {
      
      c.fillStyle = "#f97316";
      c.strokeStyle = "#c2410c";
      c.lineWidth = 1.5;
      c.fillRect(leftX, midY - 60, gap, 120);
      c.strokeRect(leftX, midY - 60, gap, 120);
    } else if (obj.type === "sheet") {
      
      c.fillStyle = "rgba(56, 189, 248, 0.4)";
      c.strokeStyle = "#38bdf8";
      c.lineWidth = 1.5;
      c.fillRect(leftX, midY - 70, gap, 140);
      c.strokeRect(leftX, midY - 70, gap, 140);
    } else if (obj.type === "lead") {
      
      const rad = Math.min(gap / 2, 45);
      const grad = c.createRadialGradient(cx - rad * 0.3, midY - rad * 0.3, rad * 0.1, cx, midY, rad);
      grad.addColorStop(0, "#f87171");
      grad.addColorStop(0.6, "#ef4444");
      grad.addColorStop(1, "#991b1b");
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, midY, rad, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#b91c1c";
      c.stroke();
    } else {
      
      const rad = Math.min(gap / 2, 50);
      const grad = c.createRadialGradient(cx - rad * 0.3, midY - rad * 0.3, rad * 0.1, cx, midY, rad);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#cbd5e1");
      grad.addColorStop(0.8, "#64748b");
      grad.addColorStop(1, "#1e293b");
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, midY, rad, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#475569";
      c.stroke();
    }
    c.restore();
  }

  
  drawScrewGauge();
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initScrewSimulator);
} else {
  initScrewSimulator();
}




const screwForm = document.getElementById("screw-form");
const screwResetBtn = document.getElementById("screw-reset-btn");
const screwResultBox = document.getElementById("screw-result-box");
const screwErrorBox = document.getElementById("screw-error-box");
const screwSteps = document.getElementById("screw-steps");
const screwFinalValue = document.getElementById("screw-final-value");

if (screwForm) {
  screwForm.addEventListener("submit", function (e) {
    e.preventDefault();
    screwErrorBox.classList.remove("active");
    screwResultBox.classList.remove("active");

    const pitchVal = document.getElementById("screw-pitch").value.trim();
    const csdVal = document.getElementById("screw-csd").value.trim();
    const msrVal = document.getElementById("screw-msr").value.trim();
    const csrVal = document.getElementById("screw-csr").value.trim();
    const zeVal = document.getElementById("screw-ze").value.trim();
    const unit = document.getElementById("screw-unit").value;

    if (pitchVal === "" || csdVal === "" || msrVal === "" || csrVal === "" || zeVal === "") {
      showError(screwErrorBox, "Please fill in all required fields.");
      return;
    }

    const pitch = parseFloat(pitchVal);
    const csd = parseFloat(csdVal);
    const msr = parseFloat(msrVal);
    const csr = parseFloat(csrVal);
    const ze = parseFloat(zeVal);

    if (isNaN(pitch) || isNaN(csd) || isNaN(msr) || isNaN(csr) || isNaN(ze)) {
      showError(screwErrorBox, "Please enter valid numbers in all inputs.");
      return;
    }

    if (csd <= 0) {
      showError(screwErrorBox, "Number of Circular Scale Divisions must be greater than 0 to prevent division by zero.");
      return;
    }

    if (pitch <= 0) {
      showError(screwErrorBox, "Pitch must be a positive number greater than 0.");
      return;
    }

    if (csr < 0) {
      showError(screwErrorBox, "Circular Scale Reading cannot be negative.");
      return;
    }

    
    
    
    
    const lc = pitch / csd;
    const circularPart = csr * lc;
    const observed = msr + circularPart;
    const corrected = observed - ze;

    const zeSignStr = ze >= 0 ? `+${formatNumber(ze)}` : `${formatNumber(ze)}`;
    const zeSubtractionStr = ze >= 0 
      ? `${formatNumber(observed)} − ${formatNumber(ze)}` 
      : `${formatNumber(observed)} − (${formatNumber(ze)}) = ${formatNumber(observed)} + ${formatNumber(Math.abs(ze))}`;

    screwSteps.innerHTML = `
      <div class="step-row"><strong>Pitch</strong> = ${formatNumber(pitch)} ${unit}</div>
      <div class="step-row"><strong>Circular Scale Divisions</strong> = ${formatNumber(csd)}</div>
      <div class="step-row"><strong>Calculated Least Count (LC)</strong> = Pitch / Divisions = ${formatNumber(pitch)} / ${formatNumber(csd)} = <strong>${formatNumber(lc)} ${unit}</strong></div>
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
      <div class="step-row"><strong>Main Scale Reading (MSR/PSR)</strong> = ${formatNumber(msr)} ${unit}</div>
      <div class="step-row"><strong>Circular Scale Reading (CSR)</strong> = ${formatNumber(csr)} div</div>
      <div class="step-row"><strong>Zero Error (ZE)</strong> = ${zeSignStr} ${unit}</div>
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
      <div class="step-row"><strong>Observed Reading</strong> = MSR + (CSR × LC)</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(msr)} + (${formatNumber(csr)} × ${formatNumber(lc)})</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(msr)} + ${formatNumber(circularPart)}</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>${formatNumber(observed)} ${unit}</strong></div>
      <div class="step-row" style="margin-top: 0.5rem;"><strong>Corrected Reading</strong> = Observed Reading − Zero Error</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${zeSubtractionStr}</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>${formatNumber(corrected)} ${unit}</strong></div>
    `;

    screwFinalValue.textContent = `${formatNumber(corrected)} ${unit}`;
    screwResultBox.classList.add("active");
  });

  screwResetBtn.addEventListener("click", function () {
    screwForm.reset();
    screwErrorBox.classList.remove("active");
    screwResultBox.classList.remove("active");
  });
}








function initSpherometerSimulator() {
  const toggleBtn = document.getElementById("toggle-sphero-sim-btn");
  const wrapper = document.getElementById("sphero-sim-wrapper");
  const canvas = document.getElementById("spherometer-canvas");
  const slider = document.getElementById("spherom-slider");
  const sliderDisp = document.getElementById("spherom-slider-val");
  const zoomWrapper = document.getElementById("spherom-zoom-wrapper");
  const zoomInBtn = document.getElementById("spherom-zoom-in");
  const zoomOutBtn = document.getElementById("spherom-zoom-out");
  const zoomResetBtn = document.getElementById("spherom-zoom-reset");
  const simBtnText = document.getElementById("sphero-sim-btn-text");
  const surfaceButtons = document.querySelectorAll("#sphero-surface-buttons .obj-btn");

  if (!toggleBtn || !wrapper || !canvas) return;

  const ctx = canvas.getContext("2d");
  let isOpen = false;
  let currentElevationH = 0.00; 
  let currentZoom = 1.0;
  let activeSurface = "flat";

  
  const CENTER_X = 660;          
  const BASE_Y = 270;            
  const BASE_RADIUS_X = 220;     
  const BASE_RADIUS_Y = 46;      
  const LEG_BOTTOM_Y = 380;      
  const PIXELS_PER_MM = 15.0;    

  
  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    if (isOpen) {
      wrapper.style.display = "block";
      simBtnText.textContent = "Close Virtual Spherometer";
      drawSpherometer();
    } else {
      wrapper.style.display = "none";
      simBtnText.textContent = "Open Interactive Virtual Spherometer";
    }
  });

  
  slider.addEventListener("input", (e) => {
    currentElevationH = parseFloat(e.target.value);
    sliderDisp.textContent = `${currentElevationH >= 0 ? "+" : ""}${currentElevationH.toFixed(2)} mm`;
    drawSpherometer();
  });

  
  function applyZoom(z) {
    currentZoom = Math.min(Math.max(Math.round(z * 100) / 100, 0.4), 2.5);
    zoomWrapper.style.transform = `scale(${currentZoom})`;
    if (zoomResetBtn) {
      zoomResetBtn.textContent = `Zoom: ${Math.round(currentZoom * 100)}%`;
    }
  }

  zoomInBtn.addEventListener("click", () => applyZoom(currentZoom + 0.2));
  zoomOutBtn.addEventListener("click", () => applyZoom(currentZoom - 0.2));
  zoomResetBtn.addEventListener("click", () => applyZoom(1.0));

  
  surfaceButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      surfaceButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeSurface = btn.dataset.surf;
      const hVal = parseFloat(btn.dataset.h);
      currentElevationH = hVal;
      slider.value = hVal;
      sliderDisp.textContent = `${hVal >= 0 ? "+" : ""}${hVal.toFixed(2)} mm`;
      drawSpherometer();
    });
  });

  
  let isDragging = false;
  let dragStartY = 0;
  let dragStartH = 0;

  canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    dragStartY = e.clientY;
    dragStartH = currentElevationH;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    
    const deltaY = (dragStartY - e.clientY) * (canvas.height / canvas.clientHeight);
    const deltaH = deltaY / (PIXELS_PER_MM * currentZoom);
    let newH = Math.min(Math.max(dragStartH + deltaH, -5), 10);
    newH = Math.round(newH * 100) / 100;
    currentElevationH = newH;
    slider.value = newH;
    sliderDisp.textContent = `${newH >= 0 ? "+" : ""}${newH.toFixed(2)} mm`;
    drawSpherometer();
  });

  canvas.addEventListener("pointerup", (e) => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener("pointercancel", () => { isDragging = false; });

  
  function drawSpherometer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    
    const hPx = currentElevationH * PIXELS_PER_MM;
    const centralScrewTipY = LEG_BOTTOM_Y - hPx;

    
    
    const DISC_ZERO_Y = 145;
    const discCenterY = DISC_ZERO_Y - hPx;

    
    drawTestSurface(ctx, activeSurface, LEG_BOTTOM_Y, centralScrewTipY);

    
    
    const leftLegX = CENTER_X - 150;
    const rightLegX = CENTER_X + 150;
    const backLegX = CENTER_X;

    
    drawSteelLeg(ctx, backLegX, BASE_Y - 20, LEG_BOTTOM_Y - 10, true);

    
    ctx.save();
    const screwW = 28;
    const screwTopY = discCenterY;
    const screwBottomY = centralScrewTipY;

    
    const screwGrad = ctx.createLinearGradient(CENTER_X - screwW / 2, 0, CENTER_X + screwW / 2, 0);
    screwGrad.addColorStop(0, "#94a3b8");
    screwGrad.addColorStop(0.3, "#f1f5f9");
    screwGrad.addColorStop(0.7, "#cbd5e1");
    screwGrad.addColorStop(1, "#475569");

    ctx.fillStyle = screwGrad;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.fillRect(CENTER_X - screwW / 2, screwTopY, screwW, screwBottomY - screwTopY);
    ctx.strokeRect(CENTER_X - screwW / 2, screwTopY, screwW, screwBottomY - screwTopY);

    
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.2;
    for (let sy = screwTopY + 4; sy < screwBottomY - 14; sy += 3.5) {
      ctx.beginPath();
      ctx.moveTo(CENTER_X - screwW / 2, sy);
      ctx.lineTo(CENTER_X + screwW / 2, sy + 3);
      ctx.stroke();
    }

    
    ctx.beginPath();
    ctx.moveTo(CENTER_X - screwW / 2, screwBottomY - 14);
    ctx.lineTo(CENTER_X, screwBottomY);
    ctx.lineTo(CENTER_X + screwW / 2, screwBottomY - 14);
    ctx.closePath();
    ctx.fillStyle = "#475569";
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    
    ctx.save();
    const BASE_THICKNESS = 24;

    
    ctx.beginPath();
    ctx.ellipse(CENTER_X, BASE_Y + BASE_THICKNESS, BASE_RADIUS_X, BASE_RADIUS_Y, 0, 0, Math.PI);
    ctx.lineTo(CENTER_X - BASE_RADIUS_X, BASE_Y);
    ctx.ellipse(CENTER_X, BASE_Y, BASE_RADIUS_X, BASE_RADIUS_Y, 0, Math.PI, 0, true);
    ctx.closePath();
    const rimGrad = ctx.createLinearGradient(0, BASE_Y, 0, BASE_Y + BASE_THICKNESS);
    rimGrad.addColorStop(0, "#334155");
    rimGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.stroke();

    
    ctx.beginPath();
    ctx.ellipse(CENTER_X, BASE_Y, BASE_RADIUS_X, BASE_RADIUS_Y, 0, 0, Math.PI * 2);
    const topGrad = ctx.createRadialGradient(CENTER_X - 60, BASE_Y - 15, 20, CENTER_X, BASE_Y, BASE_RADIUS_X);
    topGrad.addColorStop(0, "#475569");
    topGrad.addColorStop(0.5, "#1e293b");
    topGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.stroke();

    
    ctx.beginPath();
    ctx.ellipse(CENTER_X, BASE_Y, 34, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ca8a04";
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.stroke();
    ctx.restore();

    
    drawSteelLeg(ctx, leftLegX, BASE_Y + 12, LEG_BOTTOM_Y, false);
    drawSteelLeg(ctx, rightLegX, BASE_Y + 12, LEG_BOTTOM_Y, false);

    
    
    ctx.save();
    const SCALE_X = CENTER_X - 195;
    const SCALE_W = 34;
    const SCALE_TOP_Y = 40;
    const SCALE_BOTTOM_Y = 260;

    
    const scaleGrad = ctx.createLinearGradient(SCALE_X, 0, SCALE_X + SCALE_W, 0);
    scaleGrad.addColorStop(0, "#fde047");
    scaleGrad.addColorStop(0.3, "#fef08a");
    scaleGrad.addColorStop(0.7, "#eab308");
    scaleGrad.addColorStop(1, "#a16207");

    ctx.fillStyle = scaleGrad;
    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = 2;
    ctx.fillRect(SCALE_X, SCALE_TOP_Y, SCALE_W, SCALE_BOTTOM_Y - SCALE_TOP_Y);
    ctx.strokeRect(SCALE_X, SCALE_TOP_Y, SCALE_W, SCALE_BOTTOM_Y - SCALE_TOP_Y);

    
    ctx.beginPath();
    ctx.arc(SCALE_X + SCALE_W / 2, SCALE_TOP_Y, SCALE_W / 2, Math.PI, 0);
    ctx.fillStyle = scaleGrad;
    ctx.fill();
    ctx.stroke();

    
    
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.3;
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";

    for (let mm = -8; mm <= 8; mm++) {
      const markY = DISC_ZERO_Y - (mm * PIXELS_PER_MM);
      if (markY < SCALE_TOP_Y + 6 || markY > SCALE_BOTTOM_Y - 6) continue;

      let tickW = 10;
      if (mm % 5 === 0) {
        tickW = 20;
        ctx.fillText(Math.abs(mm).toString(), SCALE_X + 4, markY + 3.5);
      } else {
        tickW = 12;
      }
      ctx.beginPath();
      ctx.moveTo(SCALE_X + SCALE_W, markY);
      ctx.lineTo(SCALE_X + SCALE_W - tickW, markY);
      ctx.stroke();
    }

    
    ctx.fillStyle = "#C47AC0";
    ctx.beginPath();
    ctx.moveTo(SCALE_X + SCALE_W + 2, discCenterY);
    ctx.lineTo(SCALE_X + SCALE_W + 12, discCenterY - 6);
    ctx.lineTo(SCALE_X + SCALE_W + 12, discCenterY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    
    ctx.save();
    const DISC_RADIUS_X = 145;
    const DISC_RADIUS_Y = 28;
    const DISC_THICKNESS = 14;

    
    ctx.beginPath();
    ctx.ellipse(CENTER_X, discCenterY + DISC_THICKNESS, DISC_RADIUS_X - 10, DISC_RADIUS_Y - 2, 0, 0, Math.PI);
    ctx.lineTo(CENTER_X - DISC_RADIUS_X, discCenterY);
    ctx.ellipse(CENTER_X, discCenterY, DISC_RADIUS_X, DISC_RADIUS_Y, 0, Math.PI, 0, true);
    ctx.closePath();

    const brassBevelGrad = ctx.createLinearGradient(0, discCenterY, 0, discCenterY + DISC_THICKNESS);
    brassBevelGrad.addColorStop(0, "#ca8a04");
    brassBevelGrad.addColorStop(1, "#854d0e");
    ctx.fillStyle = brassBevelGrad;
    ctx.fill();
    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    
    ctx.beginPath();
    ctx.ellipse(CENTER_X, discCenterY, DISC_RADIUS_X, DISC_RADIUS_Y, 0, 0, Math.PI * 2);
    const discTopGrad = ctx.createRadialGradient(CENTER_X - 40, discCenterY - 8, 10, CENTER_X, discCenterY, DISC_RADIUS_X);
    discTopGrad.addColorStop(0, "#fef08a");
    discTopGrad.addColorStop(0.4, "#eab308");
    discTopGrad.addColorStop(0.85, "#ca8a04");
    discTopGrad.addColorStop(1, "#a16207");
    ctx.fillStyle = discTopGrad;
    ctx.fill();
    ctx.stroke();

    
    
    const pitch = 1.0; 
    const fraction = currentElevationH - Math.floor(currentElevationH);
    const circularReadingDiv = ((fraction >= 0 ? fraction : 1 + fraction) / pitch) * 100;
    const angleOffset = -(circularReadingDiv / 100) * Math.PI * 2;

    ctx.strokeStyle = "#451a03";
    ctx.fillStyle = "#451a03";
    ctx.lineWidth = 1.2;

    for (let d = 0; d < 100; d += 2) {
      const angle = angleOffset + (d / 100) * Math.PI * 2;
      
      if (Math.sin(angle) < -0.15) continue;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const rOuterX = DISC_RADIUS_X;
      const rOuterY = DISC_RADIUS_Y;
      let tickLength = (d % 10 === 0) ? 18 : ((d % 5 === 0) ? 12 : 7);

      const p1x = CENTER_X + cosA * (rOuterX - 2);
      const p1y = discCenterY + sinA * (rOuterY - 2);
      const p2x = CENTER_X + cosA * (rOuterX - tickLength);
      const p2y = discCenterY + sinA * (rOuterY - tickLength * (rOuterY / rOuterX));

      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();

      
      if (d % 10 === 0) {
        const textX = CENTER_X + cosA * (rOuterX - 26);
        const textY = discCenterY + sinA * (rOuterY - 10);
        ctx.font = "bold 8.5px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(d.toString(), textX, textY + 3);
      }
    }
    ctx.restore();

    
    ctx.save();
    const COLLAR_W = 44;
    const COLLAR_H = 22;
    const collarY = discCenterY - COLLAR_H;

    
    const collarGrad = ctx.createLinearGradient(CENTER_X - COLLAR_W / 2, 0, CENTER_X + COLLAR_W / 2, 0);
    collarGrad.addColorStop(0, "#ca8a04");
    collarGrad.addColorStop(0.5, "#fef08a");
    collarGrad.addColorStop(1, "#a16207");
    ctx.fillStyle = collarGrad;
    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = 1.5;
    ctx.fillRect(CENTER_X - COLLAR_W / 2, collarY, COLLAR_W, COLLAR_H);
    ctx.strokeRect(CENTER_X - COLLAR_W / 2, collarY, COLLAR_W, COLLAR_H);

    
    const KNOB_W = 36;
    const KNOB_H = 65;
    const knobY = collarY - KNOB_H;

    const knobGrad = ctx.createLinearGradient(CENTER_X - KNOB_W / 2, 0, CENTER_X + KNOB_W / 2, 0);
    knobGrad.addColorStop(0, "#a16207");
    knobGrad.addColorStop(0.3, "#fef08a");
    knobGrad.addColorStop(0.7, "#eab308");
    knobGrad.addColorStop(1, "#713f12");
    ctx.fillStyle = knobGrad;
    ctx.fillRect(CENTER_X - KNOB_W / 2, knobY, KNOB_W, KNOB_H);
    ctx.strokeRect(CENTER_X - KNOB_W / 2, knobY, KNOB_W, KNOB_H);

    
    ctx.beginPath();
    ctx.ellipse(CENTER_X, knobY, KNOB_W / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    for (let kx = CENTER_X - KNOB_W / 2 + 3; kx < CENTER_X + KNOB_W / 2; kx += 3.5) {
      ctx.beginPath();
      ctx.moveTo(kx, knobY + 4);
      ctx.lineTo(kx, knobY + KNOB_H - 2);
      ctx.stroke();
    }
    ctx.restore();

    
    ctx.save();
    const msr = Math.floor(currentElevationH);
    const fractionH = currentElevationH - msr;
    const csr = Math.round(fractionH * 100);
    const radiusR = currentElevationH > 0 ? ((45 * 45) / (6 * currentElevationH)) + (currentElevationH / 2) : 0;

    ctx.fillStyle = "rgba(30, 7, 36, 0.85)";
    ctx.strokeStyle = "rgba(196, 122, 192, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(canvas.width - 340, 20, 315, 115);
    ctx.strokeRect(canvas.width - 340, 20, 315, 115);

    ctx.fillStyle = "#C47AC0";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("SPHEROMETER MICROMETRIC READING", canvas.width - 325, 42);

    ctx.font = "12px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Pitch Scale (MSR) : ${msr} mm`, canvas.width - 325, 66);
    ctx.fillText(`Circular Head (CSR): ${csr} div (× 0.01 mm)`, canvas.width - 325, 86);

    ctx.fillStyle = "#F2DFD7";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`Sagitta (h) = ${currentElevationH.toFixed(2)} mm`, canvas.width - 325, 112);
    if (radiusR > 0) {
      ctx.fillStyle = "#C47AC0";
      ctx.fillText(`Curvature (R) ≈ ${radiusR.toFixed(1)} mm`, canvas.width - 150, 112);
    }
    ctx.restore();
  }

  
  function drawSteelLeg(c, x, topY, bottomY, isBack) {
    c.save();
    const w = 15;
    const h = bottomY - topY;

    const grad = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    if (isBack) {
      grad.addColorStop(0, "#475569");
      grad.addColorStop(0.5, "#94a3b8");
      grad.addColorStop(1, "#334155");
    } else {
      grad.addColorStop(0, "#94a3b8");
      grad.addColorStop(0.3, "#f8fafc");
      grad.addColorStop(0.7, "#cbd5e1");
      grad.addColorStop(1, "#475569");
    }
    c.fillStyle = grad;
    c.strokeStyle = "#334155";
    c.lineWidth = 1.5;

    c.fillRect(x - w / 2, topY, w, h - 12);
    c.strokeRect(x - w / 2, topY, w, h - 12);

    
    c.beginPath();
    c.moveTo(x - w / 2, topY + h - 12);
    c.lineTo(x, bottomY);
    c.lineTo(x + w / 2, topY + h - 12);
    c.closePath();
    c.fillStyle = isBack ? "#334155" : "#64748b";
    c.fill();
    c.stroke();
    c.restore();
  }

  
  function drawTestSurface(c, surf, groundY, centerTipY) {
    c.save();
    const surfLeft = CENTER_X - 260;
    const surfRight = CENTER_X + 260;

    if (surf === "flat") {
      
      const glassH = 25;
      c.fillStyle = "rgba(56, 189, 248, 0.25)";
      c.strokeStyle = "#38bdf8";
      c.lineWidth = 2;
      c.fillRect(surfLeft, groundY, surfRight - surfLeft, glassH);
      c.strokeRect(surfLeft, groundY, surfRight - surfLeft, glassH);

      c.fillStyle = "#38bdf8";
      c.font = "bold 11px sans-serif";
      c.textAlign = "center";
      c.fillText("Optical Flat Glass Plane (Datum Zero)", CENTER_X, groundY + 16);
    } else if (surf.startsWith("convex")) {
      
      const bulgeHeight = Math.max((groundY - centerTipY), 8);
      c.beginPath();
      c.moveTo(surfLeft, groundY + 20);
      c.lineTo(surfLeft, groundY);
      c.quadraticCurveTo(CENTER_X, groundY - bulgeHeight * 2, surfRight, groundY);
      c.lineTo(surfRight, groundY + 20);
      c.closePath();

      const lensGrad = c.createRadialGradient(CENTER_X, groundY - bulgeHeight, 10, CENTER_X, groundY, 240);
      lensGrad.addColorStop(0, "rgba(196, 122, 192, 0.45)");
      lensGrad.addColorStop(1, "rgba(56, 189, 248, 0.2)");
      c.fillStyle = lensGrad;
      c.fill();
      c.strokeStyle = "#C47AC0";
      c.lineWidth = 2.5;
      c.stroke();

      c.fillStyle = "#F2DFD7";
      c.font = "bold 11px sans-serif";
      c.textAlign = "center";
      c.fillText(`Convex Spherical Surface (Sagitta h = ${(groundY - centerTipY > 0 ? (groundY - centerTipY) / 15 : 0).toFixed(2)} mm)`, CENTER_X, groundY + 14);
    } else if (surf === "concave") {
      
      const sagittaDepth = Math.max((centerTipY - groundY), 8);
      c.beginPath();
      c.moveTo(surfLeft, groundY);
      c.quadraticCurveTo(CENTER_X, groundY + sagittaDepth * 2, surfRight, groundY);
      c.lineTo(surfRight, groundY + 25);
      c.lineTo(surfLeft, groundY + 25);
      c.closePath();

      c.fillStyle = "rgba(244, 63, 94, 0.25)";
      c.strokeStyle = "#f43f5e";
      c.lineWidth = 2.5;
      c.fill();
      c.stroke();

      c.fillStyle = "#fecdd3";
      c.font = "bold 11px sans-serif";
      c.textAlign = "center";
      c.fillText(`Concave Spherical Mirror (Cavity Depth = -${((centerTipY - groundY) / 15).toFixed(2)} mm)`, CENTER_X, groundY + 20);
    }
    c.restore();
  }

  
  drawSpherometer();
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpherometerSimulator);
} else {
  initSpherometerSimulator();
}




const spherometerForm = document.getElementById("spherometer-form");
const spherometerResetBtn = document.getElementById("sphero-reset-btn");
const spherometerResultBox = document.getElementById("spherometer-result-box");
const spherometerErrorBox = document.getElementById("spherometer-error-box");
const spherometerSteps = document.getElementById("spherometer-steps");
const spherometerFinalValue = document.getElementById("spherometer-final-value");

if (spherometerForm) {
  spherometerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    spherometerErrorBox.classList.remove("active");
    spherometerResultBox.classList.remove("active");

    const pitchVal = document.getElementById("sphero-pitch").value.trim();
    const csdVal = document.getElementById("sphero-csd").value.trim();
    const msrVal = document.getElementById("sphero-msr").value.trim();
    const csrVal = document.getElementById("sphero-csr").value.trim();
    const zeVal = document.getElementById("sphero-ze").value.trim();
    const legsVal = document.getElementById("sphero-legs").value.trim();
    const unit = document.getElementById("sphero-unit").value;

    if (pitchVal === "" || csdVal === "" || msrVal === "" || csrVal === "" || zeVal === "") {
      showError(spherometerErrorBox, "Please fill in all required measurement fields.");
      return;
    }

    const pitch = parseFloat(pitchVal);
    const csd = parseFloat(csdVal);
    const msr = parseFloat(msrVal);
    const csr = parseFloat(csrVal);
    const ze = parseFloat(zeVal);
    const legs = legsVal !== "" ? parseFloat(legsVal) : null;

    if (isNaN(pitch) || isNaN(csd) || isNaN(msr) || isNaN(csr) || isNaN(ze)) {
      showError(spherometerErrorBox, "Please enter valid numeric readings.");
      return;
    }

    if (csd <= 0) {
      showError(spherometerErrorBox, "Number of Circular Scale Divisions must be greater than 0.");
      return;
    }

    if (pitch <= 0) {
      showError(spherometerErrorBox, "Pitch must be greater than 0.");
      return;
    }

    if (legs !== null && (isNaN(legs) || legs <= 0)) {
      showError(spherometerErrorBox, "Distance between legs (l) must be a positive number.");
      return;
    }

    
    
    
    
    const lc = pitch / csd;
    const circularPart = csr * lc;
    const observedH = msr + circularPart;
    const correctedH = observedH - ze;

    const zeSignStr = ze >= 0 ? `+${formatNumber(ze)}` : `${formatNumber(ze)}`;
    const zeSubtractionStr = ze >= 0 
      ? `${formatNumber(observedH)} − ${formatNumber(ze)}` 
      : `${formatNumber(observedH)} − (${formatNumber(ze)}) = ${formatNumber(observedH)} + ${formatNumber(Math.abs(ze))}`;

    let radiusSteps = "";
    let finalOutputText = `h = ${formatNumber(correctedH)} ${unit}`;

    if (legs !== null) {
      if (correctedH <= 0) {
        radiusSteps = `
          <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
          <div class="step-row" style="color: #b91c1c;"><strong>Radius of Curvature Calculation Notice:</strong></div>
          <div class="step-row" style="color: #b91c1c;">Corrected sagitta (h) is ${formatNumber(correctedH)} ${unit} (≤ 0). Radius of curvature formula R = (l² / 6h) + (h / 2) cannot divide by zero or compute a meaningful positive curvature for flat/negative reading.</div>
        `;
      } else {
        const lSquared = legs * legs;
        const denominator = 6 * correctedH;
        const term1 = lSquared / denominator;
        const term2 = correctedH / 2;
        const R = term1 + term2;

        radiusSteps = `
          <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
          <div class="step-row"><strong>Distance between legs (l)</strong> = ${formatNumber(legs)} ${unit}</div>
          <div class="step-row"><strong>Radius of Curvature Formula:</strong> R = (l² / 6h) + (h / 2)</div>
          <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= (${formatNumber(legs)}² / (6 × ${formatNumber(correctedH)})) + (${formatNumber(correctedH)} / 2)</div>
          <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= (${formatNumber(lSquared)} / ${formatNumber(denominator)}) + ${formatNumber(term2)}</div>
          <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(term1)} + ${formatNumber(term2)}</div>
          <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>R = ${formatNumber(R)} ${unit}</strong></div>
        `;
        finalOutputText = `h = ${formatNumber(correctedH)} ${unit} | R = ${formatNumber(R)} ${unit}`;
      }
    }

    spherometerSteps.innerHTML = `
      <div class="step-row"><strong>Pitch</strong> = ${formatNumber(pitch)} ${unit}</div>
      <div class="step-row"><strong>Circular Scale Divisions</strong> = ${formatNumber(csd)}</div>
      <div class="step-row"><strong>Least Count (LC)</strong> = Pitch / Divisions = ${formatNumber(pitch)} / ${formatNumber(csd)} = <strong>${formatNumber(lc)} ${unit}</strong></div>
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
      <div class="step-row"><strong>Main Scale Reading (MSR)</strong> = ${formatNumber(msr)} ${unit}</div>
      <div class="step-row"><strong>Circular Scale Reading (CSR)</strong> = ${formatNumber(csr)} div</div>
      <div class="step-row"><strong>Zero Error (ZE)</strong> = ${zeSignStr} ${unit}</div>
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);" />
      <div class="step-row"><strong>Observed Height / Depth (h<sub>obs</sub>)</strong> = MSR + (CSR × LC)</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${formatNumber(msr)} + (${formatNumber(csr)} × ${formatNumber(lc)})</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>${formatNumber(observedH)} ${unit}</strong></div>
      <div class="step-row" style="margin-top: 0.5rem;"><strong>Corrected Reading (h)</strong> = Observed − Zero Error</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= ${zeSubtractionStr}</div>
      <div class="step-row">&nbsp;&nbsp;&nbsp;&nbsp;= <strong>h = ${formatNumber(correctedH)} ${unit}</strong></div>
      ${radiusSteps}
    `;

    spherometerFinalValue.textContent = finalOutputText;
    spherometerResultBox.classList.add("active");
  });

  spherometerResetBtn.addEventListener("click", function () {
    spherometerForm.reset();
    spherometerErrorBox.classList.remove("active");
    spherometerResultBox.classList.remove("active");
  });
}


function showError(element, message) {
  element.textContent = message;
  element.classList.add("active");
}
