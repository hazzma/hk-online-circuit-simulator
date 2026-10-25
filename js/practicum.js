/**
 * Web Circuit Simulator - Experiment 8 Practicum Assistant
 * Dedicated assistant for "Advance Computer-Aided Circuit Analysis" (Binus Physics 2 Lab)
 * Automates Table 8.1 (RC Charging), Table 8.2 (RC Discharging), and Table 8.3 (RLC AC Sweep).
 */

export class PracticumAssistant {
  constructor(app) {
    this.app = app;
    this.currentExp = 'exp8_1'; // 'exp8_1' (charging), 'exp8_2' (discharging), 'exp8_3' (rlc ac)
  }

  /**
   * Load Circuit Preset for Experiment 8.1: RC Charging (Figure 8.1)
   */
  loadRCChargingPreset(rVal = 1000, cVal = 0.000001) {
    const canvas = this.app.canvas;
    canvas.components = [
      {
        id: 'bat1',
        type: 'battery',
        name: 'V1',
        value: '5V',
        x: 315,
        y: 345,
        pins: [
          { id: 'bat1_p', name: '+', relX: 0, relY: -45, node: 1 },
          { id: 'bat1_n', name: '-', relX: 0, relY: 45, node: 0 }
        ]
      },
      {
        id: 'gnd1',
        type: 'ground',
        name: 'GND',
        value: '0V',
        x: 315,
        y: 465,
        pins: [
          { id: 'gnd1_p', name: 'gnd', relX: 0, relY: -25, node: 0 }
        ]
      },
      {
        id: 'r1',
        type: 'resistor',
        name: 'R1',
        value: rVal >= 1000 ? `${(rVal/1000).toFixed(2)}kΩ` : `${rVal}Ω`,
        x: 435,
        y: 240,
        pins: [
          { id: 'r1_1', name: '1', relX: -45, relY: 0, node: 1 },
          { id: 'r1_2', name: '2', relX: 45, relY: 0, node: 2 }
        ]
      },
      {
        id: 'c1',
        type: 'capacitor',
        name: 'C1',
        value: cVal >= 1e-6 ? `${(cVal*1e6).toFixed(2)}uF` : `${(cVal*1e9).toFixed(0)}nF`,
        x: 555,
        y: 345,
        pins: [
          { id: 'c1_1', name: '+', relX: 0, relY: -45, node: 2 },
          { id: 'c1_2', name: '-', relX: 0, relY: 45, node: 0 }
        ]
      },
      {
        id: 'vp1',
        type: 'probe',
        name: 'VR',
        value: 'VR+',
        x: 390,
        y: 180,
        pins: [{ id: 'vp1_p', name: 'p', relX: 0, relY: 30, node: 1 }]
      },
      {
        id: 'vp2',
        type: 'probe',
        name: 'VC',
        value: 'VC+',
        x: 555,
        y: 180,
        pins: [{ id: 'vp2_p', name: 'p', relX: 0, relY: 30, node: 2 }]
      }
    ];

    canvas.wires = [
      { id: 'w1', fromPin: 'bat1_p', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w2', fromPin: 'vp1_p', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w3', fromPin: 'r1_2', toPin: 'c1_1', node: 2, type: 'hot' },
      { id: 'w4', fromPin: 'vp2_p', toPin: 'c1_1', node: 2, type: 'hot' },
      { id: 'w5', fromPin: 'bat1_n', toPin: 'gnd1_p', node: 0, type: 'ground' },
      { id: 'w6', fromPin: 'gnd1_p', toPin: 'c1_2', node: 0, type: 'ground' }
    ];

    this.app.engine.mode = 'transient';
    document.getElementById('sim-mode-select').value = 'transient';
    canvas.render({ v1: 5.0, v2: 4.6 });
    this.app.runSimulation();
  }

  /**
   * Load Circuit Preset for Experiment 8.2: RC Discharging (Figure 8.5)
   */
  loadRCDischargingPreset(rVal = 1000, cVal = 0.000001) {
    const canvas = this.app.canvas;
    canvas.components = [
      {
        id: 'gnd1',
        type: 'ground',
        name: 'GND',
        value: '0V',
        x: 345,
        y: 435,
        pins: [{ id: 'gnd1_p', name: 'gnd', relX: 0, relY: -25, node: 0 }]
      },
      {
        id: 'r1',
        type: 'resistor',
        name: 'R1',
        value: rVal >= 1000 ? `${(rVal/1000).toFixed(2)}kΩ` : `${rVal}Ω`,
        x: 435,
        y: 240,
        pins: [
          { id: 'r1_1', name: '1', relX: -45, relY: 0, node: 1 },
          { id: 'r1_2', name: '2', relX: 45, relY: 0, node: 0 }
        ]
      },
      {
        id: 'c1',
        type: 'capacitor',
        name: 'C1 (5V init)',
        value: cVal >= 1e-6 ? `${(cVal*1e6).toFixed(2)}uF` : `${(cVal*1e9).toFixed(0)}nF`,
        x: 345,
        y: 330,
        pins: [
          { id: 'c1_1', name: '+', relX: 0, relY: -45, node: 1 },
          { id: 'c1_2', name: '-', relX: 0, relY: 45, node: 0 }
        ]
      },
      {
        id: 'vp2',
        type: 'probe',
        name: 'VC',
        value: 'VC',
        x: 345,
        y: 195,
        pins: [{ id: 'vp2_p', name: 'p', relX: 0, relY: 30, node: 1 }]
      }
    ];

    canvas.wires = [
      { id: 'w1', fromPin: 'c1_1', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w2', fromPin: 'vp2_p', toPin: 'c1_1', node: 1, type: 'hot' },
      { id: 'w3', fromPin: 'c1_2', toPin: 'gnd1_p', node: 0, type: 'ground' },
      { id: 'w4', fromPin: 'r1_2', toPin: 'gnd1_p', node: 0, type: 'ground' }
    ];

    this.app.engine.mode = 'transient';
    document.getElementById('sim-mode-select').value = 'transient';
    canvas.render({ v1: 5.0, v2: 0.0 });
    this.app.runSimulation();
  }

  /**
   * Load Circuit Preset for Experiment 8.3: RLC AC Sweep (Figure 8.6)
   */
  loadRLCPreset() {
    const canvas = this.app.canvas;
    canvas.components = [
      {
        id: 'v1_ac',
        type: 'ac_source',
        name: 'V1',
        value: '3.00V 1kHz',
        x: 315,
        y: 345,
        pins: [
          { id: 'v1_p', name: '+', relX: 0, relY: -45, node: 1 },
          { id: 'v1_n', name: '-', relX: 0, relY: 45, node: 0 }
        ]
      },
      {
        id: 'gnd1',
        type: 'ground',
        name: 'GND',
        value: '0V',
        x: 315,
        y: 465,
        pins: [{ id: 'gnd1_p', name: 'gnd', relX: 0, relY: -25, node: 0 }]
      },
      {
        id: 'r1',
        type: 'resistor',
        name: 'R1',
        value: '1.00kΩ',
        x: 435,
        y: 240,
        pins: [
          { id: 'r1_1', name: '1', relX: -45, relY: 0, node: 1 },
          { id: 'r1_2', name: '2', relX: 45, relY: 0, node: 2 }
        ]
      },
      {
        id: 'c1',
        type: 'capacitor',
        name: 'C1',
        value: '1.00uF',
        x: 555,
        y: 285,
        pins: [
          { id: 'c1_1', name: '+', relX: 0, relY: -35, node: 2 },
          { id: 'c1_2', name: '-', relX: 0, relY: 35, node: 3 }
        ]
      },
      {
        id: 'l1',
        type: 'inductor',
        name: 'L1',
        value: '1uH',
        x: 555,
        y: 390,
        pins: [
          { id: 'l1_1', name: '1', relX: 0, relY: -35, node: 3 },
          { id: 'l1_2', name: '2', relX: 0, relY: 35, node: 0 }
        ]
      },
      {
        id: 'vp_r',
        type: 'probe',
        name: 'VR',
        value: 'VR',
        x: 390,
        y: 180,
        pins: [{ id: 'vp_r_p', name: 'p', relX: 0, relY: 30, node: 1 }]
      },
      {
        id: 'vp_c',
        type: 'probe',
        name: 'VC',
        value: 'VC',
        x: 555,
        y: 180,
        pins: [{ id: 'vp_c_p', name: 'p', relX: 0, relY: 30, node: 2 }]
      },
      {
        id: 'vp_l',
        type: 'probe',
        name: 'VL',
        value: 'VL',
        x: 630,
        y: 390,
        pins: [{ id: 'vp_l_p', name: 'p', relX: -30, relY: 0, node: 3 }]
      }
    ];

    canvas.wires = [
      { id: 'w1', fromPin: 'v1_p', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w2', fromPin: 'vp_r_p', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w3', fromPin: 'r1_2', toPin: 'c1_1', node: 2, type: 'hot' },
      { id: 'w4', fromPin: 'vp_c_p', toPin: 'c1_1', node: 2, type: 'hot' },
      { id: 'w5', fromPin: 'c1_2', toPin: 'l1_1', node: 3, type: 'hot' },
      { id: 'w6', fromPin: 'l1_2', toPin: 'gnd1_p', node: 0, type: 'ground' },
      { id: 'w7', fromPin: 'v1_n', toPin: 'gnd1_p', node: 0, type: 'ground' }
    ];

    this.app.engine.mode = 'ac_sweep';
    document.getElementById('sim-mode-select').value = 'ac_sweep';
    canvas.render({ v1: 3.0, v2: 2.8 });
    this.app.runSimulation();
  }

  /**
   * Generate Table 8.1 data (RC Charging)
   */
  generateTable8_1() {
    const configs = [
      { r: 1000, c: 0.000001, labelR: '1000Ω', labelC: '1μF' },
      { r: 1000, c: 0.000002, labelR: '1000Ω', labelC: '2μF' },
      { r: 2000, c: 0.000001, labelR: '2000Ω', labelC: '1μF' },
      { r: 2000, c: 0.000002, labelR: '2000Ω', labelC: '2μF' }
    ];

    // Targets: Vc = 3.16V (1 tau), 4.325V (2 tau), 4.75V (3 tau)
    return configs.map(cfg => {
      const tau = cfg.r * cfg.c;
      const t1 = -tau * Math.log(1 - 3.16 / 5.0) * 1000;  // ms
      const t2 = -tau * Math.log(1 - 4.325 / 5.0) * 1000; // ms
      const t3 = -tau * Math.log(1 - 4.75 / 5.0) * 1000;  // ms

      return {
        r: cfg.labelR,
        c: cfg.labelC,
        tau: (tau * 1000).toFixed(2),
        t_3_16: t1.toFixed(3) + ' ms',
        t_4_325: t2.toFixed(3) + ' ms',
        t_4_75: t3.toFixed(3) + ' ms'
      };
    });
  }

  /**
   * Generate Table 8.2 data (RC Discharging)
   */
  generateTable8_2() {
    const configs = [
      { r: 1000, c: 0.000001, labelR: '1000Ω', labelC: '1μF' },
      { r: 1000, c: 0.000002, labelR: '1000Ω', labelC: '2μF' },
      { r: 2000, c: 0.000001, labelR: '2000Ω', labelC: '1μF' },
      { r: 2000, c: 0.000002, labelR: '2000Ω', labelC: '2μF' }
    ];

    // Targets: Vc = 1.84V (1 tau), 0.675V (2 tau), 0.25V (3 tau)
    return configs.map(cfg => {
      const tau = cfg.r * cfg.c;
      const t1 = -tau * Math.log(1.84 / 5.0) * 1000;
      const t2 = -tau * Math.log(0.675 / 5.0) * 1000;
      const t3 = -tau * Math.log(0.25 / 5.0) * 1000;

      return {
        r: cfg.labelR,
        c: cfg.labelC,
        tau: (tau * 1000).toFixed(2),
        t_1_84: t1.toFixed(3) + ' ms',
        t_0_675: t2.toFixed(3) + ' ms',
        t_0_25: t3.toFixed(3) + ' ms'
      };
    });
  }

  /**
   * Generate Table 8.3 data (RLC AC Sweep at 1Hz, 100kHz, 10GHz)
   */
  generateTable8_3() {
    const Vin = 3.00;
    const R = 1000;
    const C = 1e-6;
    const L = 1e-6;

    const freqs = [
      { f: 1, label: '1 Hz' },
      { f: 100000, label: '100 kHz' },
      { f: 10000000000, label: '10 GHz' }
    ];

    return freqs.map(item => {
      const f = item.f;
      const omega = 2 * Math.PI * f;
      const XL = omega * L;
      const XC = 1 / (omega * C);
      const X_net = XL - XC;

      const Z_mag = Math.sqrt(R * R + X_net * X_net);
      const I_mag = Vin / Z_mag;
      const phase_I = -Math.atan2(X_net, R); // rad

      // Voltages
      const VR = I_mag * R;
      const phase_VR = phase_I * (180 / Math.PI);

      const VC = I_mag * XC;
      const phase_VC = (phase_I - Math.PI / 2) * (180 / Math.PI);

      const VL = I_mag * XL;
      const phase_VL = (phase_I + Math.PI / 2) * (180 / Math.PI);

      const formatV = (v) => {
        if (v < 0.001) return (v * 1e6).toFixed(2) + ' μV';
        if (v < 1.0) return (v * 1000).toFixed(2) + ' mV';
        return v.toFixed(3) + ' V';
      };

      const normalizeDeg = (deg) => {
        let d = deg % 360;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        return d.toFixed(1) + '°';
      };

      return {
        freq: item.label,
        magR: formatV(VR),
        magC: formatV(VC),
        magL: formatV(VL),
        phaseR: normalizeDeg(phase_VR),
        phaseC: normalizeDeg(phase_VC),
        phaseL: normalizeDeg(phase_VL)
      };
    });
  }
}
