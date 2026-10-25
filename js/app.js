/**
 * Web Circuit Simulator - Main Application Coordinator
 */

import { CircuitCanvas } from './circuit.js';
import { CircuitEngine } from './engine.js';
import { Oscilloscope } from './oscilloscope.js';
import { DataTableManager } from './table.js';
import { PracticumAssistant } from './practicum.js';

class App {
  constructor() {
    this.engine = new CircuitEngine();
    this.canvas = null;
    this.oscilloscope = null;
    this.tableManager = null;
    this.isScopeVisible = true;

    this.init();
  }

  init() {
    // 1. Initialize Circuit Canvas
    const canvasViewport = document.getElementById('canvas-viewport');
    this.canvas = new CircuitCanvas(canvasViewport, () => this.runSimulation());

    // 2. Initialize Oscilloscope
    const scopeCanvas = document.getElementById('scope-canvas');
    const readoutEl = document.getElementById('cursor-readout');
    this.oscilloscope = new Oscilloscope(scopeCanvas, readoutEl);

    // 3. Initialize Data Table Manager
    const tableContainer = document.getElementById('scope-table-view');
    this.tableManager = new DataTableManager(tableContainer, this.engine);

    // 4. Initialize Practicum Assistant
    this.practicum = new PracticumAssistant(this);

    // 5. Attach UI Toolbar Controls, Split Resizer & Practicum
    this.bindToolbarEvents();
    this.bindSidebarComponents();
    this.bindScopeTabs();
    this.bindPracticumEvents();
    this.initSplitResizer();

    // 6. Start simulation running on startup (interactive Falstad / Multisim experience)
    this.updateSimulationState(true);
  }

  runSimulation() {
    const circuitData = this.canvas.getCircuitData();

    // Check if circuit is blank
    if (!circuitData.components || circuitData.components.length === 0) {
      const statusSummary = document.getElementById('status-summary');
      if (statusSummary) {
        statusSummary.innerHTML = `
          <span class="status-badge" style="background:#fef3c7; color:#92400e;">
            <span class="status-badge-dot" style="background:#f59e0b"></span> Kanvas Kosong (Tambahkan komponen dari sidebar kiri)
          </span>
        `;
      }
      return;
    }

    const result = this.engine.simulate(circuitData);

    // Update Oscilloscope
    this.oscilloscope.setData(result);

    // Update Table
    this.tableManager.setData(result);

    // Update Live Voltage Annotations on Schematic Canvas
    if (result.type === 'transient') {
      const v1 = result.traces[0] ? result.traces[0].data[result.traces[0].data.length - 1] : 5.0;
      const v2 = result.traces[1] ? result.traces[1].data[result.traces[1].data.length - 1] : 4.6;
      this.canvas.render({ v1, v2 });

      // Update Channel Vpp labels
      const ch1Badge = document.getElementById('ch1-badge');
      const ch2Badge = document.getElementById('ch2-badge');
      if (ch1Badge) ch1Badge.innerHTML = `<span class="dot dot-ch1"></span> CH1 VP · Vpp ${v1.toFixed(2)} V`;
      if (ch2Badge) ch2Badge.innerHTML = `<span class="dot dot-ch2"></span> CH2 VP · Vpp ${v2.toFixed(2)} V`;
    } else {
      const ch1Badge = document.getElementById('ch1-badge');
      const ch2Badge = document.getElementById('ch2-badge');
      if (ch1Badge) ch1Badge.innerHTML = `<span class="dot dot-ch1"></span> Mag |H| (dB)`;
      if (ch2Badge) ch2Badge.innerHTML = `<span class="dot dot-ch2"></span> Phase ∠H (°)`;
    }

    // Update Status Bar
    const statusSummary = document.getElementById('status-summary');
    if (statusSummary) {
      statusSummary.innerHTML = `
        <span class="status-badge"><span class="status-badge-dot pulse"></span> Solved</span>
        <span>${result.summary.nodes} nodes</span>
        <span>Total power ${result.summary.powerMw} mW</span>
        <span>${result.summary.points} pts</span>
      `;
    }
  }

  bindToolbarEvents() {
    // Simulation Mode Selector (Transient vs AC Sweep)
    const modeSelect = document.getElementById('sim-mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.engine.mode = e.target.value;
        this.runSimulation();
      });
    }

    // Interactive Run / Stop Simulation Buttons (Multisim Live Style)
    const btnRun = document.getElementById('btn-run');
    const btnStop = document.getElementById('btn-stop');

    if (btnRun) {
      btnRun.addEventListener('click', () => {
        this.updateSimulationState(!this.isRunning);
      });
    }

    if (btnStop) {
      btnStop.addEventListener('click', () => {
        this.updateSimulationState(false);
      });
    }
  }

  updateSimulationState(running) {
    this.isRunning = running;
    const btnRun = document.getElementById('btn-run');
    const btnStop = document.getElementById('btn-stop');
    const statusSummary = document.getElementById('status-summary');
    const simStatusBanner = document.getElementById('sim-status-banner');

    document.body.classList.toggle('sim-running', running);
    document.body.classList.toggle('sim-stopped', !running);

    if (running) {
      if (btnRun) {
        btnRun.innerHTML = `
          <span class="btn-run-pulse"></span>
          <span>Running</span>
        `;
        btnRun.classList.add('running');
      }
      if (btnStop) btnStop.classList.remove('active');

      if (simStatusBanner) {
        simStatusBanner.className = 'sim-status-banner running';
        simStatusBanner.innerHTML = '<span class="status-badge-dot pulse" style="background:#22c55e"></span> Simulasi Berjalan • Arus Mengalir';
      }

      this.runSimulation();
      if (this.oscilloscope) {
        this.oscilloscope.startPlayhead();
      }

      if (statusSummary) {
        statusSummary.innerHTML = `
          <span class="status-badge" style="background:#052e16; color:#4ade80; border:1px solid #166534;">
            <span class="status-badge-dot pulse" style="background:#22c55e"></span> Running
          </span>
          <span>Arus kabel aktif</span>
          <span>Timeline scope aktif</span>
        `;
      }
    } else {
      if (btnRun) {
        btnRun.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Run</span>
        `;
        btnRun.classList.remove('running');
      }
      if (btnStop) btnStop.classList.add('active');

      if (simStatusBanner) {
        simStatusBanner.className = 'sim-status-banner stopped';
        simStatusBanner.innerHTML = '<span class="status-badge-dot" style="background:#ef4444"></span> Simulasi Berhenti (Paused)';
      }

      if (this.oscilloscope) {
        this.oscilloscope.stopPlayhead();
      }

      if (statusSummary) {
        statusSummary.innerHTML = `
          <span class="status-badge" style="background:#450a0a; color:#fca5a5; border:1px solid #991b1b;">
            <span class="status-badge-dot" style="background:#ef4444"></span> Stopped
          </span>
          <span>Simulasi dihentikan</span>
          <span>Klik Run untuk melanjutkan</span>
        `;
      }
    }

    // Tool Selector (Select, Wire, Delete)
    const toolSelect = document.getElementById('tool-select');
    const toolWire = document.getElementById('tool-wire');
    const toolDelete = document.getElementById('tool-delete');

    const updateToolBtns = (activeBtn) => {
      [toolSelect, toolWire, toolDelete].forEach(b => b && b.classList.remove('active'));
      if (activeBtn) activeBtn.classList.add('active');
    };

    this.updateToolButtons = (toolName) => {
      const btnMap = { select: toolSelect, wire: toolWire, delete: toolDelete };
      updateToolBtns(btnMap[toolName] || toolSelect);
    };

    if (toolSelect) {
      toolSelect.addEventListener('click', () => {
        this.canvas.setTool('select');
        updateToolBtns(toolSelect);
      });
    }

    if (toolWire) {
      toolWire.addEventListener('click', () => {
        this.canvas.setTool('wire');
        updateToolBtns(toolWire);
      });
    }

    if (toolDelete) {
      toolDelete.addEventListener('click', () => {
        this.canvas.setTool('delete');
        updateToolBtns(toolDelete);
      });
    }

    // Toggle Oscilloscope visibility
    const btnToggleScope = document.getElementById('btn-toggle-scope');
    const scopePanel = document.getElementById('oscilloscope-panel');
    if (btnToggleScope && scopePanel) {
      btnToggleScope.addEventListener('click', () => {
        this.isScopeVisible = !this.isScopeVisible;
        if (this.isScopeVisible) {
          scopePanel.classList.remove('hidden');
          btnToggleScope.textContent = 'Hide oscilloscope';
          setTimeout(() => this.oscilloscope.render(), 100);
        } else {
          scopePanel.classList.add('hidden');
          btnToggleScope.textContent = 'Show oscilloscope';
        }
      });
    }

    // Grid snap toggle
    const btnGrid = document.getElementById('btn-toggle-grid');
    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        const gridDots = document.querySelectorAll('.grid-dot');
        const isVisible = gridDots[0] && gridDots[0].style.display !== 'none';
        gridDots.forEach(d => d.style.display = isVisible ? 'none' : 'block');
        btnGrid.classList.toggle('active', !isVisible);
      });
    }

    // New circuit
    const btnNew = document.getElementById('btn-new');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        const choice = confirm('Mulai skematik kosong (blank)?\n\nKlik OK untuk kanvas kosong bersih,\natau Batal untuk memuat ulang sirkuit default praktikum.');
        if (choice) {
          this.canvas.clearCircuit();
        } else {
          this.canvas.loadDefaultScreenshotCircuit();
        }
        this.runSimulation();
      });
    }

    // Layout Switcher (Schematic, Split, Grapher)
    const btnLayoutSchematic = document.getElementById('layout-schematic');
    const btnLayoutSplit = document.getElementById('layout-split');
    const btnLayoutGrapher = document.getElementById('layout-grapher');
    const layoutBtns = [btnLayoutSchematic, btnLayoutSplit, btnLayoutGrapher];

    const setLayout = (mode) => {
      document.body.classList.remove('layout-schematic', 'layout-split', 'layout-grapher');
      layoutBtns.forEach(btn => btn && btn.classList.remove('active'));

      if (mode === 'schematic') {
        document.body.classList.add('layout-schematic');
        if (btnLayoutSchematic) btnLayoutSchematic.classList.add('active');
        if (this.canvas) setTimeout(() => this.canvas.render(), 50);
      } else if (mode === 'grapher') {
        document.body.classList.add('layout-grapher');
        if (btnLayoutGrapher) btnLayoutGrapher.classList.add('active');
        if (this.oscilloscope) setTimeout(() => this.oscilloscope.render(), 50);
      } else {
        document.body.classList.add('layout-split');
        if (btnLayoutSplit) btnLayoutSplit.classList.add('active');
        if (this.canvas) setTimeout(() => this.canvas.render(), 50);
        if (this.oscilloscope) setTimeout(() => this.oscilloscope.render(), 50);
      }
    };

    if (btnLayoutSchematic) btnLayoutSchematic.addEventListener('click', () => setLayout('schematic'));
    if (btnLayoutSplit) btnLayoutSplit.addEventListener('click', () => setLayout('split'));
    if (btnLayoutGrapher) btnLayoutGrapher.addEventListener('click', () => setLayout('grapher'));

    // Set initial default layout: split
    setLayout('split');

    // Canvas Zoom In, Out, and Reset (viewBox based)
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        if (this.canvas) this.canvas.zoomIn();
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        if (this.canvas) this.canvas.zoomOut();
      });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        if (this.canvas) this.canvas.zoomReset();
      });
    }

    // Simulation Settings Modal (Multisim Live Document Tab)
    this.bindSettingsModalEvents();

    // Fullscreen toggle
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Download / Export Schematic SVG
    const btnDownload = document.getElementById('btn-download');
    const svgEl = document.getElementById('schematic-svg');
    if (btnDownload && svgEl) {
      btnDownload.addEventListener('click', () => {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = svgUrl;
        downloadLink.download = 'schematic_circuit.svg';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(svgUrl);
      });
    }
  }

  bindSidebarComponents() {
    // Add components on click & drag
    const partItems = document.querySelectorAll('.part-item');
    partItems.forEach(item => {
      const type = item.dataset.type;
      
      // 1. Click to add component at center of current visible canvas
      item.addEventListener('click', () => {
        if (type && this.canvas) {
          this.canvas.addComponent(type);
        }
      });

      // 2. Drag & Drop from sidebar directly to canvas
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (e) => {
        if (type) {
          e.dataTransfer.setData('text/plain', type);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });

    // Search filter
    const searchInput = document.getElementById('part-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        partItems.forEach(item => {
          const name = item.querySelector('.part-name').textContent.toLowerCase();
          item.style.display = name.includes(term) ? 'flex' : 'none';
        });
      });
    }

    // Collapse sidebar
    const btnCollapse = document.getElementById('btn-collapse-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (btnCollapse && sidebar) {
      btnCollapse.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
          if (this.canvas) this.canvas.render();
        }, 150);
      });
    }
  }

  initSplitResizer() {
    const resizer = document.getElementById('split-resizer');
    const wrapper = document.getElementById('main-split-wrapper');
    const workspace = document.querySelector('.workspace-container');
    const scopePanel = document.getElementById('oscilloscope-panel');

    if (!resizer || !wrapper || !workspace || !scopePanel) return;

    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = wrapper.getBoundingClientRect();
      const rawRatio = (e.clientX - rect.left) / rect.width;
      const ratio = Math.max(0.2, Math.min(0.8, rawRatio));

      workspace.style.flex = `0 0 ${ratio * 100}%`;
      scopePanel.style.flex = `1 1 ${(1 - ratio) * 100}%`;

      if (this.canvas) this.canvas.render();
      if (this.oscilloscope) this.oscilloscope.render();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        if (this.canvas) this.canvas.render();
        if (this.oscilloscope) this.oscilloscope.render();
      }
    });
  }

  bindScopeTabs() {
    const tabGraph = document.getElementById('tab-scope-graph');
    const tabTable = document.getElementById('tab-scope-table');
    const graphView = document.getElementById('scope-graph-view');
    const tableView = document.getElementById('scope-table-view');

    if (tabGraph && tabTable) {
      tabGraph.addEventListener('click', () => {
        tabGraph.classList.add('active');
        tabTable.classList.remove('active');
        graphView.style.display = 'flex';
        tableView.classList.remove('active');
        this.oscilloscope.render();
      });

      tabTable.addEventListener('click', () => {
        tabTable.classList.add('active');
        tabGraph.classList.remove('active');
        graphView.style.display = 'none';
        tableView.classList.add('active');
      });
    }
  }

  bindPracticumEvents() {
    const btnOpen = document.getElementById('btn-open-practicum');
    const btnClose = document.getElementById('btn-close-practicum');
    const modal = document.getElementById('practicum-modal');

    if (btnOpen && modal) {
      btnOpen.addEventListener('click', () => {
        this.renderPracticumTables();
        modal.classList.add('active');
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    // Tab switching in modal
    const tabs = [
      { tab: 'tab-exp8-1', panel: 'panel-exp8-1' },
      { tab: 'tab-exp8-2', panel: 'panel-exp8-2' },
      { tab: 'tab-exp8-3', panel: 'panel-exp8-3' }
    ];

    tabs.forEach(({ tab, panel }) => {
      const tabEl = document.getElementById(tab);
      const panelEl = document.getElementById(panel);
      if (tabEl && panelEl) {
        tabEl.addEventListener('click', () => {
          tabs.forEach(t => {
            const b = document.getElementById(t.tab);
            const p = document.getElementById(t.panel);
            if (b) b.classList.remove('active');
            if (p) p.style.display = 'none';
          });
          tabEl.classList.add('active');
          panelEl.style.display = 'block';
        });
      }
    });

    // Preset Buttons
    const btnGbr81 = document.getElementById('btn-load-gbr81');
    const btnGbr85 = document.getElementById('btn-load-gbr85');
    const btnGbr86 = document.getElementById('btn-load-gbr86');

    if (btnGbr81) {
      btnGbr81.addEventListener('click', () => {
        this.practicum.loadRCChargingPreset(1000, 0.000001);
        modal.classList.remove('active');
      });
    }

    if (btnGbr85) {
      btnGbr85.addEventListener('click', () => {
        this.practicum.loadRCDischargingPreset(1000, 0.000001);
        modal.classList.remove('active');
      });
    }

    if (btnGbr86) {
      btnGbr86.addEventListener('click', () => {
        this.practicum.loadRLCPreset();
        modal.classList.remove('active');
      });
    }

    // Copy Table to Clipboard Buttons
    const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text).then(() => {
        alert('Tabel berhasil disalin ke clipboard!');
      }).catch(() => {
        alert('Gagal menyalin. Silakan seleksi tabel secara manual.');
      });
    };

    const btnCopyT81 = document.getElementById('btn-copy-t81');
    if (btnCopyT81) {
      btnCopyT81.addEventListener('click', () => {
        const rows = this.practicum.generateTable8_1();
        let txt = "Resistor\tCapacitor\tTime_3.16V\tTime_4.325V\tTime_4.75V\n";
        rows.forEach(r => { txt += `${r.r}\t${r.c}\t${r.t_3_16}\t${r.t_4_325}\t${r.t_4_75}\n`; });
        copyToClipboard(txt);
      });
    }

    const btnCopyT82 = document.getElementById('btn-copy-t82');
    if (btnCopyT82) {
      btnCopyT82.addEventListener('click', () => {
        const rows = this.practicum.generateTable8_2();
        let txt = "Resistor\tCapacitor\tTime_1.84V\tTime_0.675V\tTime_0.25V\n";
        rows.forEach(r => { txt += `${r.r}\t${r.c}\t${r.t_1_84}\t${r.t_0_675}\t${r.t_0_25}\n`; });
        copyToClipboard(txt);
      });
    }

    const btnCopyT83 = document.getElementById('btn-copy-t83');
    if (btnCopyT83) {
      btnCopyT83.addEventListener('click', () => {
        const rows = this.practicum.generateTable8_3();
        let txt = "Frequency\tMag_R\tMag_C\tMag_L\tPhase_R\tPhase_C\tPhase_L\n";
        rows.forEach(r => { txt += `${r.freq}\t${r.magR}\t${r.magC}\t${r.magL}\t${r.phaseR}\t${r.phaseC}\t${r.phaseL}\n`; });
        copyToClipboard(txt);
      });
    }
  }

  renderPracticumTables() {
    // Populate Table 8.1
    const tbody81 = document.getElementById('tbody-t81');
    if (tbody81) {
      const data81 = this.practicum.generateTable8_1();
      tbody81.innerHTML = data81.map(r => `
        <tr>
          <td><strong>${r.r}</strong></td>
          <td>${r.c}</td>
          <td>${r.tau} ms</td>
          <td class="highlight">${r.t_3_16}</td>
          <td class="highlight">${r.t_4_325}</td>
          <td class="highlight">${r.t_4_75}</td>
        </tr>
      `).join('');
    }

    // Populate Table 8.2
    const tbody82 = document.getElementById('tbody-t82');
    if (tbody82) {
      const data82 = this.practicum.generateTable8_2();
      tbody82.innerHTML = data82.map(r => `
        <tr>
          <td><strong>${r.r}</strong></td>
          <td>${r.c}</td>
          <td>${r.tau} ms</td>
          <td class="highlight">${r.t_1_84}</td>
          <td class="highlight">${r.t_0_675}</td>
          <td class="highlight">${r.t_0_25}</td>
        </tr>
      `).join('');
    }

    // Populate Table 8.3
    const tbody83 = document.getElementById('tbody-t83');
    if (tbody83) {
      const data83 = this.practicum.generateTable8_3();
      tbody83.innerHTML = data83.map(r => `
        <tr>
          <td><strong>${r.freq}</strong></td>
          <td class="highlight">${r.magR}</td>
          <td class="highlight">${r.magC}</td>
          <td class="highlight">${r.magL}</td>
          <td>${r.phaseR}</td>
          <td>${r.phaseC}</td>
          <td>${r.phaseL}</td>
        </tr>
      `).join('');
    }
  }

  bindSettingsModalEvents() {
    const modal = document.getElementById('settings-modal');
    const btnOpen = document.getElementById('btn-open-settings');
    const btnClose = document.getElementById('btn-close-settings');
    const btnCancel = document.getElementById('btn-cancel-settings');
    const btnSave = document.getElementById('btn-save-settings');

    const simTypeSelect = document.getElementById('setting-sim-type');
    const transientFields = document.getElementById('settings-transient-fields');
    const acFields = document.getElementById('settings-ac-fields');

    const inputTstart = document.getElementById('setting-tstart');
    const inputTend = document.getElementById('setting-tend');
    const selectInitCond = document.getElementById('setting-init-cond');

    const inputFstart = document.getElementById('setting-fstart');
    const inputFstop = document.getElementById('setting-fstop');
    const inputPtsDecade = document.getElementById('setting-points-decade');

    if (!modal) return;

    // Toggle fields based on simulation type
    const updateModalFields = (type) => {
      if (type === 'transient') {
        if (transientFields) transientFields.style.display = 'block';
        if (acFields) acFields.style.display = 'none';
      } else {
        if (transientFields) transientFields.style.display = 'none';
        if (acFields) acFields.style.display = 'block';
      }
    };

    if (simTypeSelect) {
      simTypeSelect.addEventListener('change', (e) => {
        updateModalFields(e.target.value);
      });
    }

    // Open Modal and populate current engine parameters
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        const mode = this.engine.mode || 'transient';
        if (simTypeSelect) simTypeSelect.value = mode;
        updateModalFields(mode);

        const params = this.engine.params || {};
        if (inputTstart) inputTstart.value = params.tStart ?? 0;
        if (inputTend) inputTend.value = params.tStop ?? 0.01;
        if (selectInitCond) selectInitCond.value = params.initialConditions ?? 'zero';

        if (inputFstart) inputFstart.value = params.fStart ?? 1;
        if (inputFstop) inputFstop.value = params.fStop ?? 1e10;
        if (inputPtsDecade) inputPtsDecade.value = params.pointsPerDecade ?? 10;

        modal.classList.add('active');
      });
    }

    // Close Modal
    const closeModal = () => modal.classList.remove('active');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Save Settings and Re-simulate
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const selectedMode = simTypeSelect ? simTypeSelect.value : 'transient';
        this.engine.mode = selectedMode;

        // Sync toolbar mode dropdown
        const toolbarModeSelect = document.getElementById('sim-mode-select');
        if (toolbarModeSelect) toolbarModeSelect.value = selectedMode;

        const parseNum = (val, fallback) => {
          const n = parseFloat(val);
          return isNaN(n) ? fallback : n;
        };

        this.engine.setParams({
          tStart: parseNum(inputTstart ? inputTstart.value : 0, 0),
          tStop: parseNum(inputTend ? inputTend.value : 0.01, 0.01),
          initialConditions: selectInitCond ? selectInitCond.value : 'zero',
          fStart: parseNum(inputFstart ? inputFstart.value : 1, 1),
          fStop: parseNum(inputFstop ? inputFstop.value : 1e10, 1e10),
          pointsPerDecade: parseInt(inputPtsDecade ? inputPtsDecade.value : 10, 10) || 10
        });

        closeModal();
        this.runSimulation();
      });
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
