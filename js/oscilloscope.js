/**
 * Web Circuit Simulator - Oscilloscope & Bode Plot Graph Renderer
 * High-performance HTML5 Canvas waveform visualizer with Multisim Live Dual Cursors (C1, C2, Delta),
 * interactive drag handles, frequency/time domain measurement readouts,
 * Pixel-perfect retina DPR scaling (No stretching distortion!), and Mouse-wheel Time Zoom & Pan.
 */

export class Oscilloscope {
  constructor(canvasElement, readoutElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.readout = readoutElement;
    this.simResult = null;

    // Dual Cursors State (C1 & C2)
    this.c1_time = 0.001; // default 1 ms
    this.c2_time = 0.002; // default 2 ms
    this.c1_freq = 100;   // for AC sweep
    this.c2_freq = 10000;

    // Zoom & Pan State (Waveform Inspection)
    this.zoom = 1.0;      // 1.0 = 100% full range, up to 50x
    this.panTime = 0.0;   // start time in seconds
    this.isPanningGraph = false;
    this.panStartMouseX = 0;
    this.panStartTime = 0;

    this.draggingCursor = null; // 'c1', 'c2', or null
    this.hoverCursor = null;
    this.mousePos = { x: 0, y: 0 };
    this.onCursorMove = null;

    // Live Sweep Timeline / Playhead State
    this.playheadTime = 0.0;
    this.isSweeping = false;
    this.lastSweepTimestamp = null;
    this.sweepAnimId = null;

    this.initCanvasResize();
    this.initCursorAndZoomEvents();
  }

  startPlayhead() {
    this.isSweeping = true;
    this.lastSweepTimestamp = null;
    if (!this.simResult || !this.simResult.time) return;
    const tMaxTotal = this.simResult.time[this.simResult.time.length - 1] || 0.005;
    if (this.playheadTime >= tMaxTotal) {
      this.playheadTime = 0;
    }
    cancelAnimationFrame(this.sweepAnimId);

    const sweepLoop = (ts) => {
      if (!this.isSweeping) return;
      if (!this.lastSweepTimestamp) this.lastSweepTimestamp = ts;
      const dtMs = ts - this.lastSweepTimestamp;
      this.lastSweepTimestamp = ts;

      const tMax = (this.simResult && this.simResult.time) ? this.simResult.time[this.simResult.time.length - 1] : 0.005;
      const sweepRate = tMax / 2800; // full sweep in 2.8 seconds
      this.playheadTime += dtMs * sweepRate;

      if (this.playheadTime > tMax) {
        this.playheadTime = 0;
      }

      this.render();
      this.sweepAnimId = requestAnimationFrame(sweepLoop);
    };

    this.sweepAnimId = requestAnimationFrame(sweepLoop);
  }

  stopPlayhead() {
    this.isSweeping = false;
    cancelAnimationFrame(this.sweepAnimId);
    this.render();
  }

  resetPlayhead() {
    this.isSweeping = false;
    cancelAnimationFrame(this.sweepAnimId);
    this.playheadTime = 0;
    this.render();
  }

  setCursor1Time(timeSec) {
    this.c1_time = Math.max(0, timeSec);
    this.render();
  }

  initCanvasResize() {
    const resizeObserver = new ResizeObserver(() => {
      this.render();
    });
    if (this.canvas.parentElement) {
      resizeObserver.observe(this.canvas.parentElement);
    }
    window.addEventListener('resize', () => this.render());
  }

  initCursorAndZoomEvents() {
    // 1. Mousedown for Cursor Drag or Graph Pan
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.simResult) return;
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { plotW, paddingLeft, paddingTop, plotH } = this.getPlotDimensions(rect.width, rect.height);

      if (mouseX < paddingLeft || mouseX > paddingLeft + plotW || mouseY < paddingTop || mouseY > paddingTop + plotH) {
        return;
      }

      const c1X = this.timeToX(this.c1_time, plotW, paddingLeft);
      const c2X = this.timeToX(this.c2_time, plotW, paddingLeft);

      // Check Cursor 1 Handle or line
      if (Math.abs(mouseX - c1X) <= 12) {
        this.draggingCursor = 'c1';
        return;
      }

      // Check Cursor 2 Handle or line
      if (Math.abs(mouseX - c2X) <= 12) {
        this.draggingCursor = 'c2';
        return;
      }

      // Middle click or Right click or Shift+Click or click in zoomed mode pans the graph
      if (e.button === 1 || e.button === 2 || e.shiftKey || (this.zoom > 1.0 && Math.abs(mouseX - c1X) > 25 && Math.abs(mouseX - c2X) > 25)) {
        this.isPanningGraph = true;
        this.panStartMouseX = e.clientX;
        this.panStartTime = this.panTime;
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      // Left click moves closer cursor directly to clicked point
      const dist1 = Math.abs(mouseX - c1X);
      const dist2 = Math.abs(mouseX - c2X);
      const clickedTime = this.xToTime(mouseX, plotW, paddingLeft);

      if (dist1 <= dist2) {
        this.c1_time = clickedTime;
        this.draggingCursor = 'c1';
      } else {
        this.c2_time = clickedTime;
        this.draggingCursor = 'c2';
      }
      this.render();
    });

    // 2. Mousemove for dragging cursor or panning graph
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.mousePos = { x: mouseX, y: mouseY };

      const { plotW, paddingLeft } = this.getPlotDimensions(rect.width, rect.height);

      // A. Graph Panning
      if (this.isPanningGraph && this.simResult && this.simResult.time) {
        const dx = e.clientX - this.panStartMouseX;
        const tMaxTotal = this.simResult.time[this.simResult.time.length - 1] || 0.01;
        const span = tMaxTotal / this.zoom;
        const dt = -(dx / plotW) * span;

        this.panTime = Math.max(0, Math.min(tMaxTotal - span, this.panStartTime + dt));
        this.render();
        return;
      }

      // B. Cursor Dragging
      if (this.draggingCursor && this.simResult) {
        const newTime = this.xToTime(mouseX, plotW, paddingLeft);
        if (this.draggingCursor === 'c1') {
          this.c1_time = Math.max(0, newTime);
        } else if (this.draggingCursor === 'c2') {
          this.c2_time = Math.max(0, newTime);
        }
        this.render();

        if (this.onCursorMove) {
          this.onCursorMove(newTime);
        }
      } else if (this.simResult) {
        // C. Hover indicator
        const c1X = this.timeToX(this.c1_time, plotW, paddingLeft);
        const c2X = this.timeToX(this.c2_time, plotW, paddingLeft);
        if (Math.abs(mouseX - c1X) <= 8 || Math.abs(mouseX - c2X) <= 8) {
          this.canvas.style.cursor = 'ew-resize';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
      }
    });

    // 3. Mouseup to release dragging
    window.addEventListener('mouseup', () => {
      this.draggingCursor = null;
      if (this.isPanningGraph) {
        this.isPanningGraph = false;
        this.canvas.style.cursor = 'crosshair';
      }
    });

    // 4. Mouse Wheel Time Zooming (Centered on cursor)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const { plotW, paddingLeft } = this.getPlotDimensions(rect.width, rect.height);

      const centerTime = this.xToTime(mouseX, plotW, paddingLeft);
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      this.zoomGraph(factor, centerTime);
    }, { passive: false });

    // 5. Double click resets zoom to 1.0 (Fit 100%)
    this.canvas.addEventListener('dblclick', () => {
      this.resetZoom();
    });
  }

  zoomGraph(factor, centerTime) {
    if (!this.simResult || !this.simResult.time) return;
    const tMaxTotal = this.simResult.time[this.simResult.time.length - 1] || 0.01;

    const newZoom = Math.max(1.0, Math.min(50.0, this.zoom * factor));
    const currentSpan = tMaxTotal / this.zoom;
    const newSpan = tMaxTotal / newZoom;

    // Zoom centered on cursor time
    const ratio = (centerTime - this.panTime) / (currentSpan || 1);
    let newPan = centerTime - ratio * newSpan;
    newPan = Math.max(0, Math.min(tMaxTotal - newSpan, newPan));

    this.zoom = newZoom;
    this.panTime = newPan;
    this.render();
  }

  resetZoom() {
    this.zoom = 1.0;
    this.panTime = 0.0;
    this.render();
  }

  getPlotDimensions(w, h) {
    const paddingLeft = 56;
    const paddingRight = 40;
    const paddingTop = 32;
    const paddingBottom = 30;
    const plotW = Math.max(20, w - paddingLeft - paddingRight);
    const plotH = Math.max(20, h - paddingTop - paddingBottom);
    return { paddingLeft, paddingRight, paddingTop, paddingBottom, plotW, plotH };
  }

  timeToX(t, plotW, paddingLeft) {
    if (!this.simResult || !this.simResult.time) return paddingLeft;
    const tMaxTotal = this.simResult.time[this.simResult.time.length - 1] || 0.01;
    const span = tMaxTotal / this.zoom;
    const norm = (t - this.panTime) / (span || 1);
    return paddingLeft + norm * plotW;
  }

  xToTime(x, plotW, paddingLeft) {
    if (!this.simResult || !this.simResult.time) return 0;
    const tMaxTotal = this.simResult.time[this.simResult.time.length - 1] || 0.01;
    const span = tMaxTotal / this.zoom;
    const norm = (x - paddingLeft) / plotW;
    return this.panTime + norm * span;
  }

  setData(simulationResult) {
    this.simResult = simulationResult;
    if (simulationResult && simulationResult.time) {
      const tMax = simulationResult.time[simulationResult.time.length - 1];
      if (this.c1_time > tMax) this.c1_time = tMax * 0.2;
      if (this.c2_time > tMax) this.c2_time = tMax * 0.4;
    }
    this.render();
  }

  setCursor1Time(timeSeconds) {
    this.c1_time = Math.max(0, timeSeconds);
    this.render();
  }

  setCursor2Time(timeSeconds) {
    this.c2_time = Math.max(0, timeSeconds);
    this.render();
  }

  interpolateVoltage(tSec, traceIndex = 1) {
    if (!this.simResult || !this.simResult.time) return 0;
    const { time, traces } = this.simResult;
    const trace = traces[traceIndex] || traces[0];
    if (!trace) return 0;

    if (tSec <= time[0]) return trace.data[0];
    if (tSec >= time[time.length - 1]) return trace.data[time.length - 1];

    let low = 0, high = time.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (time[mid] < tSec) low = mid + 1;
      else high = mid - 1;
    }
    const i0 = Math.max(0, low - 1);
    const i1 = Math.min(time.length - 1, low);
    const dt = time[i1] - time[i0];
    const alpha = dt === 0 ? 0 : (tSec - time[i0]) / dt;
    return trace.data[i0] + alpha * (trace.data[i1] - trace.data[i0]);
  }

  /* =========================================================================
     Master Render Method: Pixel-Perfect DPR Buffer (Zero Stretch Distortion)
     ========================================================================= */
  render() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w <= 0 || h <= 0) return;

    // Synchronize physical canvas buffer with client CSS pixels to prevent bitmap stretching!
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Dark oscilloscope CRT screen
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    if (!this.simResult || !this.simResult.traces) {
      this.drawScopeGrid(ctx, w, h);
      return;
    }

    if (this.simResult.type === 'transient') {
      this.renderTransientScope(ctx, w, h);
    } else if (this.simResult.type === 'ac_sweep') {
      this.renderACSweepScope(ctx, w, h);
    }
  }

  renderTransientScope(ctx, w, h) {
    const { paddingLeft, paddingRight, paddingTop, paddingBottom, plotW, plotH } = this.getPlotDimensions(w, h);

    // Draw Crisp Grid
    this.drawScopeGrid(ctx, w, h, paddingLeft, paddingRight, paddingTop, paddingBottom);

    const { time, traces } = this.simResult;
    const tMaxTotal = time[time.length - 1] || 0.005;
    const span = tMaxTotal / this.zoom;
    const tStart = this.panTime;
    const tEnd = this.panTime + span;

    const vMax = 6.0;
    const vMin = -0.5;

    // Y-Axis Voltage Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    for (let v = 0; v <= 5; v += 1.0) {
      const y = paddingTop + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
      ctx.fillText(`${v.toFixed(1)} V`, paddingLeft - 8, y + 3);
    }

    // X-Axis Time Labels (Dynamic based on zoom level)
    ctx.textAlign = 'center';
    const divisions = 6;
    for (let f = 0; f <= divisions; f++) {
      const curT = tStart + (f / divisions) * span;
      const x = paddingLeft + (f / divisions) * plotW;
      
      let label = '';
      if (curT < 0.001) {
        label = `${(curT * 1e6).toFixed(0)} µs`;
      } else {
        label = `${(curT * 1000).toFixed(2)} ms`;
      }
      ctx.fillText(label, x, h - 8);
    }

    // Render Traces (Clipped inside plot area)
    ctx.save();
    ctx.beginPath();
    ctx.rect(paddingLeft, paddingTop, plotW, plotH);
    ctx.clip();

    traces.forEach(trace => {
      if (trace.unit === 'mA') return;
      ctx.beginPath();
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';

      let started = false;
      for (let i = 0; i < time.length; i++) {
        const t = time[i];
        if (t < tStart - span * 0.1 || t > tEnd + span * 0.1) continue;

        const v = trace.data[i];
        const x = this.timeToX(t, plotW, paddingLeft);
        const y = paddingTop + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // =======================================================================
    // Live Sweep Timeline / Playhead Indicator
    // =======================================================================
    const playheadX = this.timeToX(this.playheadTime, plotW, paddingLeft);
    if (playheadX >= paddingLeft && playheadX <= paddingLeft + plotW) {
      // 1. Glowing Vertical Sweep Line
      ctx.save();
      ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(playheadX, paddingTop);
      ctx.lineTo(playheadX, paddingTop + plotH);
      ctx.stroke();
      ctx.restore();

      // 2. Highlighting sample dots on each active trace at t_playhead
      traces.forEach(trace => {
        if (trace.unit === 'mA') return;
        const v = this.interpolateVoltage(this.playheadTime, trace.id === 'vc' ? 1 : 0);
        const y = paddingTop + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
        if (y >= paddingTop && y <= paddingTop + plotH) {
          ctx.save();
          ctx.shadowColor = trace.color;
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = trace.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(playheadX, y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // =======================================================================
    // Multisim Live Dual Cursors: C1 (Cyan) and C2 (Yellow)
    // =======================================================================
    const c1X = this.timeToX(this.c1_time, plotW, paddingLeft);
    const c2X = this.timeToX(this.c2_time, plotW, paddingLeft);

    // Draw Cursor 1 Line (Cyan)
    if (c1X >= paddingLeft && c1X <= paddingLeft + plotW) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(c1X, paddingTop);
      ctx.lineTo(c1X, paddingTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Cursor 2 Line (Yellow)
    if (c2X >= paddingLeft && c2X <= paddingLeft + plotW) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(c2X, paddingTop);
      ctx.lineTo(c2X, paddingTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); // End clipping for cursor handles

    // Draw Top Timeline Flag Badge
    if (playheadX >= paddingLeft - 10 && playheadX <= paddingLeft + plotW + 10) {
      ctx.save();
      const badgeT = `${(this.playheadTime * 1000).toFixed(2)} ms`;
      const vcNow = this.interpolateVoltage(this.playheadTime, 1);
      const isRunning = this.isSweeping;
      const badgeText = isRunning ? `▶ ${badgeT} (${vcNow.toFixed(2)}V)` : `⏸ ${badgeT}`;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const textMetrics = ctx.measureText(badgeText);
      const badgeW = textMetrics.width + 12;
      const badgeH = 17;
      let badgeX = playheadX - badgeW / 2;
      if (badgeX < paddingLeft + 2) badgeX = paddingLeft + 2;
      if (badgeX + badgeW > paddingLeft + plotW - 2) badgeX = paddingLeft + plotW - badgeW - 2;
      const badgeY = paddingTop - badgeH - 3;

      ctx.fillStyle = isRunning ? '#ef4444' : '#475569';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY > 3 ? badgeY : 3, badgeW, badgeH, 3);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + badgeW / 2, (badgeY > 3 ? badgeY : 3) + badgeH / 2);
      ctx.restore();
    }

    // Draw Cursor Handles at Top Header of Plot
    if (c1X >= paddingLeft - 6 && c1X <= paddingLeft + plotW + 6) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(c1X, paddingTop, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1', c1X, paddingTop + 3.5);
    }

    if (c2X >= paddingLeft - 6 && c2X <= paddingLeft + plotW + 6) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(c2X, paddingTop, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('2', c2X, paddingTop + 3.5);
    }

    // Multisim Live Realtime Readout Bar
    const c1_vCap = this.interpolateVoltage(this.c1_time, 1);
    const c2_vCap = this.interpolateVoltage(this.c2_time, 1);
    const deltaT = Math.abs(this.c2_time - this.c1_time);
    const deltaV = Math.abs(c2_vCap - c1_vCap);
    const playhead_vCap = this.interpolateVoltage(this.playheadTime, 1);

    if (this.readout) {
      const zoomText = this.zoom > 1.0 ? `🔍 ${this.zoom.toFixed(1)}x` : '1.0x';
      this.readout.innerHTML = `
        <span class="cursor-badge playhead" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5);">⏱ Timeline: <strong>${(this.playheadTime * 1000).toFixed(2)} ms</strong> (${playhead_vCap.toFixed(2)} V)</span>
        <span class="cursor-badge c1">📍 C1: <strong>${(this.c1_time * 1000).toFixed(3)} ms</strong> (${c1_vCap.toFixed(3)} V)</span>
        <span class="cursor-badge c2">📍 C2: <strong>${(this.c2_time * 1000).toFixed(3)} ms</strong> (${c2_vCap.toFixed(3)} V)</span>
        <span class="cursor-badge delta">ΔX: <strong>${(deltaT * 1000).toFixed(3)} ms</strong> | ΔY: <strong>${deltaV.toFixed(3)} V</strong></span>
        <button id="btn-scope-reset-zoom" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; padding:2px 8px; border-radius:4px; font-size:10px; cursor:pointer;" title="Reset Zoom (Double click canvas)">Fit: ${zoomText}</button>
      `;

      const btnReset = document.getElementById('btn-scope-reset-zoom');
      if (btnReset) {
        btnReset.addEventListener('click', (e) => {
          e.stopPropagation();
          this.resetZoom();
        });
      }
    }
  }

  renderACSweepScope(ctx, w, h) {
    const { paddingLeft, paddingRight, paddingTop, paddingBottom, plotW, plotH } = this.getPlotDimensions(w, h);

    this.drawScopeGrid(ctx, w, h, paddingLeft, paddingRight, paddingTop, paddingBottom);

    const { freq, traces, cutoffFreq } = this.simResult;
    const fMin = freq[0];
    const fMax = freq[freq.length - 1];
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);

    const magMin = -40;
    const magMax = 5;

    // Y-axis labels
    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    for (let db = -40; db <= 0; db += 10) {
      const y = paddingTop + plotH - ((db - magMin) / (magMax - magMin)) * plotH;
      ctx.fillText(`${db} dB`, paddingLeft - 6, y + 3);
    }

    // Right Phase labels
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText('0°', w - paddingRight + 6, paddingTop + 10);
    ctx.fillText('-45°', w - paddingRight + 6, paddingTop + plotH / 2);
    ctx.fillText('-90°', w - paddingRight + 6, paddingTop + plotH);

    // X-axis log frequency labels
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    [10, 100, 1000, 10000, 100000].forEach(f => {
      const logF = Math.log10(f);
      const x = paddingLeft + ((logF - logMin) / (logMax - logMin)) * plotW;
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(`${label}Hz`, x, h - 8);
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(paddingLeft, paddingTop, plotW, plotH);
    ctx.clip();

    // Magnitude trace
    const magTrace = traces[0];
    ctx.beginPath();
    ctx.strokeStyle = magTrace.color;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < freq.length; i++) {
      const f = freq[i];
      const db = magTrace.data[i];
      const x = paddingLeft + ((Math.log10(f) - logMin) / (logMax - logMin)) * plotW;
      const y = paddingTop + plotH - ((db - magMin) / (magMax - magMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Phase trace
    const phaseTrace = traces[1];
    ctx.beginPath();
    ctx.strokeStyle = phaseTrace.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    for (let i = 0; i < freq.length; i++) {
      const f = freq[i];
      const deg = phaseTrace.data[i];
      const x = paddingLeft + ((Math.log10(f) - logMin) / (logMax - logMin)) * plotW;
      const y = paddingTop + ((0 - deg) / 90) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Cutoff frequency line fc (-3dB marker)
    if (cutoffFreq) {
      const fcX = paddingLeft + ((Math.log10(cutoffFreq) - logMin) / (logMax - logMin)) * plotW;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(fcX, paddingTop);
      ctx.lineTo(fcX, paddingTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText(`fc = ${cutoffFreq.toFixed(1)} Hz (-3dB)`, fcX, paddingTop - 8);
    }

    ctx.restore();

    if (this.readout) {
      this.readout.innerHTML = `
        <span class="cursor-badge c1">📊 Respon Frekuensi AC Sweep</span>
        <span style="color:#ef4444">Cut-off fc: <strong>${cutoffFreq ? cutoffFreq.toFixed(1) : 159.2} Hz</strong> (-3 dB)</span>
      `;
    }
  }

  drawScopeGrid(ctx, w, h, pl = 56, pr = 40, pt = 32, pb = 30) {
    const pw = Math.max(10, w - pl - pr);
    const ph = Math.max(10, h - pt - pb);

    ctx.strokeStyle = '#1a2333';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 6; i++) {
      const y = pt + (i / 6) * ph;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(pl + pw, y);
      ctx.stroke();
    }

    for (let j = 0; j <= 8; j++) {
      const x = pl + (j / 8) * pw;
      ctx.beginPath();
      ctx.moveTo(x, pt);
      ctx.lineTo(x, pt + ph);
      ctx.stroke();
    }
  }
}
