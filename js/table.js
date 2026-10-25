/**
 * Web Circuit Simulator - Interactive Data Table & Sampling Manager
 * User-Centric UX for Multisim Live & Experiment 8:
 * - Free switching between 'Target Voltage' (V -> t) and 'Target Time' (t -> V)
 * - Clean Table: ONLY displays explicitly added data points via (+) or chip click
 * - Option to delete individual rows, clear table, or toggle raw simulation data
 * - Syncs with Oscilloscope Cursor 1 on row click/add
 */

export class DataTableManager {
  constructor(tableContainerElement, engine) {
    this.container = tableContainerElement;
    this.engine = engine;
    this.simResult = null;

    // State
    this.currentMode = 'voltage'; // 'voltage' or 'time'
    this.sampledRows = []; // array of user-added data rows
    this.showRawData = false; // toggle for full raw simulation data

    // DOM Elements
    this.tbody = document.getElementById('table-body');
    this.thead = document.getElementById('table-head');
    this.queryResultEl = document.getElementById('query-result-badge');

    // Mode Switcher Buttons
    this.btnModeV = document.getElementById('btn-mode-v');
    this.btnModeT = document.getElementById('btn-mode-t');
    this.subpanelV = document.getElementById('subpanel-voltage');
    this.subpanelT = document.getElementById('subpanel-time');

    // Input fields & Add buttons
    this.targetVInput = document.getElementById('target-v-input');
    this.btnAddV = document.getElementById('btn-add-v');

    this.targetTInput = document.getElementById('target-t-input');
    this.btnAddT = document.getElementById('btn-add-t');

    // Action buttons
    this.btnClear = document.getElementById('btn-clear-table');
    this.btnExport = document.getElementById('btn-export-csv');
    this.btnToggleRaw = document.getElementById('btn-toggle-raw-data');

    this.initEvents();
  }

  initEvents() {
    // 1. Mode Switcher (Target Voltage vs Target Time)
    if (this.btnModeV) {
      this.btnModeV.addEventListener('click', () => this.switchMode('voltage'));
    }
    if (this.btnModeT) {
      this.btnModeT.addEventListener('click', () => this.switchMode('time'));
    }

    // 2. Add Target Voltage Event (+)
    if (this.btnAddV) {
      this.btnAddV.addEventListener('click', () => {
        const v = parseFloat(this.targetVInput.value);
        if (!isNaN(v)) {
          this.addVoltageSample(v);
        } else {
          alert('Masukkan nilai tegangan yang valid (misal: 3.16)');
        }
      });
    }

    if (this.targetVInput) {
      this.targetVInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const v = parseFloat(this.targetVInput.value);
          if (!isNaN(v)) this.addVoltageSample(v);
        }
      });
    }

    // 3. Add Target Time Event (+)
    if (this.btnAddT) {
      this.btnAddT.addEventListener('click', () => {
        const t = parseFloat(this.targetTInput.value);
        if (!isNaN(t) && t >= 0) {
          this.addTimeSample(t);
        } else {
          alert('Masukkan nilai waktu yang valid dalam ms (misal: 1.0)');
        }
      });
    }

    if (this.targetTInput) {
      this.targetTInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const t = parseFloat(this.targetTInput.value);
          if (!isNaN(t) && t >= 0) this.addTimeSample(t);
        }
      });
    }

    // 4. Preset Chips Click Delegations
    document.addEventListener('click', (e) => {
      // Voltage Chip Click
      const vChip = e.target.closest('.btn-target-v-chip');
      if (vChip) {
        const v = parseFloat(vChip.dataset.v);
        if (this.targetVInput) this.targetVInput.value = v;
        if (!isNaN(v)) this.addVoltageSample(v);
        return;
      }

      // Time Chip Click
      const tChip = e.target.closest('.btn-target-t-chip');
      if (tChip) {
        const t = parseFloat(tChip.dataset.t);
        if (this.targetTInput) this.targetTInput.value = t;
        if (!isNaN(t)) this.addTimeSample(t);
        return;
      }

      // Single Row Delete Button Click
      const delBtn = e.target.closest('.btn-del-row');
      if (delBtn) {
        const rowId = delBtn.dataset.rowId;
        if (rowId) this.deleteRow(rowId);
        return;
      }

      // Table Row Click to Jump Cursor 1
      const tr = e.target.closest('tr.sample-row');
      if (tr && !e.target.closest('.btn-del-row')) {
        const tSec = parseFloat(tr.dataset.timeSec);
        if (!isNaN(tSec) && window.app && window.app.oscilloscope) {
          window.app.oscilloscope.setCursor1Time(tSec);
        }
      }
    });

    // 5. Global Table Actions
    if (this.btnClear) {
      this.btnClear.addEventListener('click', () => this.clearSampledRows());
    }

    if (this.btnExport) {
      this.btnExport.addEventListener('click', () => this.exportCSV());
    }

    if (this.btnToggleRaw) {
      this.btnToggleRaw.addEventListener('click', () => this.toggleRawData());
    }
  }

  switchMode(mode) {
    this.currentMode = mode;
    if (mode === 'voltage') {
      if (this.btnModeV) this.btnModeV.classList.add('active');
      if (this.btnModeT) this.btnModeT.classList.remove('active');
      if (this.subpanelV) this.subpanelV.style.display = 'flex';
      if (this.subpanelT) this.subpanelT.style.display = 'none';
    } else {
      if (this.btnModeT) this.btnModeT.classList.add('active');
      if (this.btnModeV) this.btnModeV.classList.remove('active');
      if (this.subpanelT) this.subpanelT.style.display = 'flex';
      if (this.subpanelV) this.subpanelV.style.display = 'none';
    }
  }

  setData(simulationResult) {
    this.simResult = simulationResult;
    // When simulation re-runs, update existing sampled rows with fresh values:
    this.recomputeSampledRows();
    this.render();
  }

  recomputeSampledRows() {
    if (!this.simResult || this.simResult.type !== 'transient' || this.sampledRows.length === 0) return;

    const { time, traces } = this.simResult;
    const vCapTrace = traces[1] ? traces[1].data : traces[0].data;

    this.sampledRows.forEach(row => {
      if (row.type === 'voltage') {
        // Find closest index for target voltage
        let bestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < vCapTrace.length; i++) {
          const diff = Math.abs(vCapTrace[i] - row.targetVal);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
          }
        }
        row.timeSec = time[bestIdx];
        row.timeMs = row.timeSec * 1000;
        row.vIn = traces[0] ? traces[0].data[bestIdx] : 5.0;
        row.vOut = vCapTrace[bestIdx];
        row.currentMa = traces[2] ? traces[2].data[bestIdx] : 0;
        row.energyUj = (0.5 * 1e-6 * row.vOut * row.vOut * 1e6);
      } else if (row.type === 'time') {
        const sample = this.engine.sampleAtSpecificTime(row.timeSec, this.simResult);
        if (sample) {
          row.vIn = sample.vIn;
          row.vOut = sample.vOut;
          row.currentMa = sample.current * 1000;
          row.energyUj = (0.5 * 1e-6 * sample.vOut * sample.vOut * 1e6);
        }
      }
    });
  }

  /**
   * Mode 1: Add Target Voltage (V -> t)
   */
  addVoltageSample(targetVoltage) {
    if (!this.simResult || this.simResult.type !== 'transient') {
      alert('Pencarian target tegangan aktif pada mode Transient (time).');
      return;
    }

    const { time, traces } = this.simResult;
    const vCapTrace = traces[1] ? traces[1].data : traces[0].data;

    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < vCapTrace.length; i++) {
      const diff = Math.abs(vCapTrace[i] - targetVoltage);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    const foundTimeSec = time[bestIdx];
    const foundTimeMs = foundTimeSec * 1000;
    const actualV = vCapTrace[bestIdx];
    const vIn = traces[0] ? traces[0].data[bestIdx] : 5.0;
    const curMa = traces[2] ? traces[2].data[bestIdx] : 0;
    const energyUj = (0.5 * 1e-6 * actualV * actualV * 1e6);

    const newRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: 'voltage',
      targetVal: targetVoltage,
      timeSec: foundTimeSec,
      timeMs: foundTimeMs,
      vIn: vIn,
      vOut: actualV,
      currentMa: curMa,
      energyUj: energyUj
    };

    // Prepend to list
    this.sampledRows.unshift(newRow);
    this.showRawData = false;
    this.render();

    // Sync oscilloscope Cursor 1 to this exact point
    if (window.app && window.app.oscilloscope) {
      window.app.oscilloscope.setCursor1Time(foundTimeSec);
    }

    this.showFeedback(`✓ Ditambahkan: Target <strong>${targetVoltage} V</strong> ➔ Waktu t = <strong>${foundTimeMs.toFixed(3)} ms</strong> (Vc = ${actualV.toFixed(3)} V)`);
  }

  /**
   * Mode 2: Add Target Time (t -> V)
   */
  addTimeSample(targetTimeMs) {
    if (!this.simResult || this.simResult.type !== 'transient') {
      alert('Pencarian target waktu aktif pada mode Transient (time).');
      return;
    }

    const tSeconds = targetTimeMs / 1000.0;
    const result = this.engine.sampleAtSpecificTime(tSeconds, this.simResult);

    if (result) {
      const vIn = result.vIn;
      const vOut = result.vOut;
      const curMa = result.current * 1000;
      const energyUj = (0.5 * 1e-6 * vOut * vOut * 1e6);

      const newRow = {
        id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: 'time',
        targetVal: targetTimeMs,
        timeSec: tSeconds,
        timeMs: targetTimeMs,
        vIn: vIn,
        vOut: vOut,
        currentMa: curMa,
        energyUj: energyUj
      };

      this.sampledRows.unshift(newRow);
      this.showRawData = false;
      this.render();

      // Sync oscilloscope Cursor 1 to this point
      if (window.app && window.app.oscilloscope) {
        window.app.oscilloscope.setCursor1Time(tSeconds);
      }

      this.showFeedback(`✓ Ditambahkan: Waktu t = <strong>${targetTimeMs.toFixed(3)} ms</strong> ➔ Vc = <strong>${vOut.toFixed(3)} V</strong>, I = ${curMa.toFixed(3)} mA`);
    }
  }

  deleteRow(rowId) {
    this.sampledRows = this.sampledRows.filter(r => r.id !== rowId);
    this.render();
  }

  clearSampledRows() {
    if (this.sampledRows.length === 0) return;
    this.sampledRows = [];
    this.render();
    this.showFeedback('Semua baris sampel berhasil dibersihkan.');
  }

  toggleRawData() {
    this.showRawData = !this.showRawData;
    if (this.btnToggleRaw) {
      this.btnToggleRaw.classList.toggle('active', this.showRawData);
      this.btnToggleRaw.textContent = this.showRawData ? '📋 Tabel Sampel' : '👁️ Raw Data';
    }
    this.render();
  }

  showFeedback(html) {
    if (this.queryResultEl) {
      this.queryResultEl.innerHTML = html;
      this.queryResultEl.style.display = 'block';
      clearTimeout(this._fbTimeout);
      this._fbTimeout = setTimeout(() => {
        if (this.queryResultEl) this.queryResultEl.style.display = 'none';
      }, 5000);
    }
  }

  render() {
    if (!this.simResult) return;

    if (this.simResult.type === 'ac_sweep') {
      this.renderACSweepTable();
      return;
    }

    if (this.showRawData) {
      this.renderRawTransientTable();
    } else {
      this.renderSampledTable();
    }
  }

  renderSampledTable() {
    this.thead.innerHTML = `
      <tr>
        <th style="width: 40px; text-align: center;">#</th>
        <th>Parameter Target</th>
        <th>Waktu t (ms)</th>
        <th>Sumber V1 (V)</th>
        <th>Kapasitor Vc (V)</th>
        <th>Arus I(R) (mA)</th>
        <th>Energi Cap (μJ)</th>
        <th style="width: 50px; text-align: center;">Aksi</th>
      </tr>
    `;

    if (this.sampledRows.length === 0) {
      this.tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 36px 16px; color: #94a3b8;">
            <div style="font-size: 26px; margin-bottom: 6px;">📋</div>
            <div style="font-weight: 600; font-size: 13px; color: #cbd5e1;">Belum Ada Data Sampel yang Ditambahkan</div>
            <div style="font-size: 11px; margin-top: 5px; color: #94a3b8;">
              Pilih <strong>Target Voltage</strong> atau <strong>Target Time</strong> di atas, lalu klik <strong>➕ Tambah Data (+)</strong> atau chip cepat untuk memasukkan titik pengujian praktikum.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const rowsHtml = this.sampledRows.map((r, idx) => {
      const typeBadge = r.type === 'voltage' 
        ? `<span class="badge-type v">🎯 Target Vc: ${r.targetVal} V</span>`
        : `<span class="badge-type t">⏱️ Target t: ${r.targetVal} ms</span>`;

      return `
        <tr class="sample-row highlighted" data-time-sec="${r.timeSec}" style="cursor: pointer;" title="Klik baris untuk memposisikan kursor osiloskop ke waktu ini">
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td>${typeBadge}</td>
          <td style="font-weight: 700; color: #f8fafc;">${r.timeMs.toFixed(3)} ms</td>
          <td style="color: #38bdf8; font-weight: 600;">${r.vIn.toFixed(3)} V</td>
          <td style="color: #fbbf24; font-weight: 700;">${r.vOut.toFixed(3)} V</td>
          <td style="color: #34d399; font-weight: 600;">${r.currentMa.toFixed(3)} mA</td>
          <td style="color: #cbd5e1;">${r.energyUj.toFixed(4)} μJ</td>
          <td style="text-align: center;">
            <button class="btn-del-row" data-row-id="${r.id}" title="Hapus baris sampel ini">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    this.tbody.innerHTML = rowsHtml;
  }

  renderRawTransientTable() {
    this.thead.innerHTML = `
      <tr>
        <th>Waktu (ms)</th>
        <th>Sumber V1 (V)</th>
        <th>Kapasitor Vc (V)</th>
        <th>Arus I(R) (mA)</th>
        <th>Energi Cap (μJ)</th>
      </tr>
    `;

    if (!this.simResult.tableData) return;

    const rows = this.simResult.tableData.map((row, idx) => `
      <tr data-time="${row.time}" id="row-step-${idx}">
        <td><strong>${row.timeMs}</strong> ms</td>
        <td style="color:#38bdf8">${row.vIn} V</td>
        <td style="color:#fbbf24">${row.vOut} V</td>
        <td style="color:#34d399">${row.currentMa} mA</td>
        <td>${row.energyUj} μJ</td>
      </tr>
    `).join('');

    this.tbody.innerHTML = rows;
  }

  renderACSweepTable() {
    this.thead.innerHTML = `
      <tr>
        <th>Frekuensi (Hz)</th>
        <th>Magnitude |H(f)| (dB)</th>
        <th>Fase ∠H(f) (°)</th>
      </tr>
    `;

    if (!this.simResult.tableData) return;

    const rows = this.simResult.tableData.map(row => `
      <tr>
        <td><strong>${row.freqHz}</strong></td>
        <td style="color:#38bdf8">${row.magDb} dB</td>
        <td style="color:#fbbf24">${row.phaseDeg}°</td>
      </tr>
    `).join('');

    this.tbody.innerHTML = rows;
  }

  /**
   * Export table contents to standard CSV file
   */
  exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";

    if (this.simResult && this.simResult.type === 'ac_sweep') {
      csvContent += "Frequency_Hz,Magnitude_dB,Phase_deg\n";
      if (this.simResult.tableData) {
        this.simResult.tableData.forEach(r => {
          csvContent += `${r.freq},${r.magDb},${r.phaseDeg}\n`;
        });
      }
    } else if (this.sampledRows.length > 0 && !this.showRawData) {
      csvContent += "No,Parameter_Target,Time_ms,Vin_V,Vout_Cap_V,Current_mA,Energy_uJ\n";
      this.sampledRows.forEach((r, idx) => {
        csvContent += `${idx + 1},${r.type === 'voltage' ? 'Target_' + r.targetVal + 'V' : 'Target_' + r.targetVal + 'ms'},${r.timeMs.toFixed(4)},${r.vIn.toFixed(4)},${r.vOut.toFixed(4)},${r.currentMa.toFixed(4)},${r.energyUj.toFixed(4)}\n`;
      });
    } else if (this.simResult && this.simResult.tableData) {
      csvContent += "Time_ms,Vin_V,Vout_V,Current_mA,Energy_uJ\n";
      this.simResult.tableData.forEach(r => {
        csvContent += `${r.timeMs},${r.vIn},${r.vOut},${r.currentMa},${r.energyUj}\n`;
      });
    } else {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `circuit_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
