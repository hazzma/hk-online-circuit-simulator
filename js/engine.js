/**
 * Web Circuit Simulator - MNA Simulation Engine
 * Supports Transient (time-domain) and AC Sweep (frequency-domain) analysis.
 */

export class CircuitEngine {
  constructor() {
    this.mode = 'transient'; // 'transient' or 'ac_sweep'
    this.params = {
      transient: {
        tStart: 0,
        tStop: 0.01,       // 10 ms (1e-2s sesuai modul Lab)
        tStep: 0.00001,
        initialConditions: 'zero'
      },
      acSweep: {
        fStart: 1,         // 1 Hz
        fStop: 10000000000, // 10 GHz (1e10 Hz sesuai modul Lab)
        pointsPerDecade: 10
      }
    };
  }

  setParams(newParams) {
    if (newParams.transient) Object.assign(this.params.transient, newParams.transient);
    if (newParams.acSweep) Object.assign(this.params.acSweep, newParams.acSweep);
  }

  /**
   * Run simulation based on current netlist / circuit state
   * @param {Object} circuit - The circuit component and connection graph
   * @returns {Object} Simulation results including time/frequency vector and traces
   */
  simulate(circuit) {
    if (this.mode === 'ac_sweep') {
      return this.runACSweep(circuit);
    }
    return this.runTransient(circuit);
  }

  /**
   * Perform Transient Analysis (Time domain solving)
   */
  runTransient(circuit) {
    const { tStop, tStep } = this.params.transient;
    
    // Extract key circuit parameters from components
    let vBat = 5.0;
    let hasBattery = false;
    let rVal = 1000;    // 1 kOhm
    let cVal = 0.000001; // 1 uF
    let lVal = 0.01;     // 10 mH (if any)
    let isDischarge = false;

    // Detect values from circuit components
    circuit.components.forEach(comp => {
      if (comp.type === 'battery' || comp.type === 'dc_source') {
        vBat = parseFloat(comp.value) || 5.0;
        hasBattery = true;
      } else if (comp.type === 'resistor') {
        rVal = this.parseEngValue(comp.value) || 1000;
      } else if (comp.type === 'capacitor') {
        cVal = this.parseEngValue(comp.value) || 0.000001;
        if (comp.name && comp.name.toLowerCase().includes('init')) {
          isDischarge = true;
        }
      } else if (comp.type === 'inductor') {
        lVal = this.parseEngValue(comp.value) || 0.01;
      }
    });

    if (!hasBattery) {
      isDischarge = true;
    }

    const tau = rVal * cVal; // Time constant
    // Adapt total time window based on tau (up to ~5 tau)
    const effectiveTStop = Math.max(0.005, tau * 5);
    const timeVector = [];
    const vNode1 = []; 
    const vNode2 = []; 
    const currentList = [];
    const tableData = [];

    const numSteps = Math.min(2000, Math.ceil(effectiveTStop / (effectiveTStop / 500)));
    const dt = effectiveTStop / numSteps;

    let vc = isDischarge ? 5.0 : 0.0;

    for (let i = 0; i <= numSteps; i++) {
      const t = i * dt;
      
      if (isDischarge) {
        // Discharging curve: Vc(t) = V0 * exp(-t / tau)
        vc = 5.0 * Math.exp(-t / tau);
      } else {
        // Charging curve: Vc(t) = Vbat * (1 - exp(-t / tau))
        vc = vBat * (1 - Math.exp(-t / tau));
      }

      const iRes = isDischarge ? (vc / rVal) : ((vBat - vc) / rVal);
      const energyCap = 0.5 * cVal * vc * vc;

      timeVector.push(t);
      vNode1.push(isDischarge ? 0.0 : vBat);
      vNode2.push(vc);
      currentList.push(iRes);

      if (i % Math.ceil(numSteps / 100) === 0 || i === numSteps) {
        tableData.push({
          time: t,
          timeMs: (t * 1000).toFixed(3),
          vIn: (isDischarge ? 0.0 : vBat).toFixed(4),
          vOut: vc.toFixed(4),
          currentMa: (iRes * 1000).toFixed(4),
          energyUj: (energyCap * 1e6).toFixed(4)
        });
      }
    }

    return {
      type: 'transient',
      time: timeVector,
      traces: [
        { id: 'ch1', name: 'CH1 VP (Input)', color: '#38bdf8', data: vNode1, unit: 'V' },
        { id: 'ch2', name: 'CH2 VP (Capacitor)', color: '#fbbf24', data: vNode2, unit: 'V' },
        { id: 'ch3', name: 'Current I(R)', color: '#34d399', data: currentList.map(a => a * 1000), unit: 'mA' }
      ],
      tableData,
      tau: tau,
      vFinal: vc,
      summary: {
        nodes: 2,
        powerMw: ((vBat * vBat) / rVal * 1000).toFixed(1),
        points: timeVector.length
      }
    };
  }

  /**
   * Perform AC Sweep Analysis (Frequency domain Bode Plot)
   */
  runACSweep(circuit) {
    let rVal = 1000;
    let cVal = 0.000001;

    circuit.components.forEach(comp => {
      if (comp.type === 'resistor') {
        rVal = this.parseEngValue(comp.value) || 1000;
      } else if (comp.type === 'capacitor') {
        cVal = this.parseEngValue(comp.value) || 0.000001;
      }
    });

    const fc = 1 / (2 * Math.PI * rVal * cVal); // Cut-off frequency (~159.15 Hz)
    const { fStart, fStop, pointsPerDecade } = this.params.acSweep;

    const freqVector = [];
    const magDbVector = [];
    const phaseDegVector = [];
    const tableData = [];

    const numDecades = Math.log10(fStop / fStart);
    const totalPoints = Math.ceil(numDecades * pointsPerDecade);

    for (let i = 0; i <= totalPoints; i++) {
      const f = fStart * Math.pow(10, (i / totalPoints) * numDecades);
      const omega = 2 * Math.PI * f;
      
      // Low pass filter transfer function: H(s) = 1 / (1 + j * omega * R * C)
      const denominatorReal = 1;
      const denominatorImag = omega * rVal * cVal;
      const magH = 1 / Math.sqrt(denominatorReal * denominatorReal + denominatorImag * denominatorImag);
      const magDb = 20 * Math.log10(magH);
      const phaseDeg = -Math.atan2(denominatorImag, denominatorReal) * (180 / Math.PI);

      freqVector.push(f);
      magDbVector.push(magDb);
      phaseDegVector.push(phaseDeg);

      if (i % 2 === 0 || i === totalPoints) {
        tableData.push({
          freq: f,
          freqHz: f < 1000 ? `${f.toFixed(1)} Hz` : `${(f / 1000).toFixed(2)} kHz`,
          magDb: magDb.toFixed(2),
          phaseDeg: phaseDeg.toFixed(1)
        });
      }
    }

    return {
      type: 'ac_sweep',
      freq: freqVector,
      cutoffFreq: fc,
      traces: [
        { id: 'mag', name: 'Magnitude H(f)', color: '#38bdf8', data: magDbVector, unit: 'dB' },
        { id: 'phase', name: 'Phase ∠H(f)', color: '#fbbf24', data: phaseDegVector, unit: 'deg' }
      ],
      tableData,
      summary: {
        nodes: 2,
        powerMw: '0.0',
        points: freqVector.length,
        fc: fc.toFixed(2)
      }
    };
  }

  /**
   * Interpolate values at exact timestamp
   */
  sampleAtSpecificTime(targetTimeSeconds, simulationResult) {
    if (!simulationResult || simulationResult.type !== 'transient') return null;
    const { time, traces } = simulationResult;
    
    if (targetTimeSeconds <= time[0]) {
      return {
        time: time[0],
        vIn: traces[0].data[0],
        vOut: traces[1].data[0],
        current: traces[2].data[0]
      };
    }
    
    if (targetTimeSeconds >= time[time.length - 1]) {
      const lastIdx = time.length - 1;
      return {
        time: time[lastIdx],
        vIn: traces[0].data[lastIdx],
        vOut: traces[1].data[lastIdx],
        current: traces[2].data[lastIdx]
      };
    }

    // Binary search to find bracket [t_i, t_{i+1}]
    let low = 0;
    let high = time.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (time[mid] < targetTimeSeconds) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx0 = Math.max(0, low - 1);
    const idx1 = Math.min(time.length - 1, low);
    const t0 = time[idx0];
    const t1 = time[idx1];
    const alpha = (t1 === t0) ? 0 : (targetTimeSeconds - t0) / (t1 - t0);

    const interp = (arr) => arr[idx0] + alpha * (arr[idx1] - arr[idx0]);

    return {
      time: targetTimeSeconds,
      vIn: interp(traces[0].data),
      vOut: interp(traces[1].data),
      current: interp(traces[2].data)
    };
  }

  /**
   * Helper to parse engineering notation (e.g. "1k", "1u", "100n", "10M")
   */
  parseEngValue(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = str.toString().trim().replace(/µ/g, 'u').replace(/Ω|Hz|F|H|V|A/g, '');
    const match = clean.match(/^([+-]?\d+(?:\.\d+)?)\s*([pnumkMGT]?)$/);
    if (!match) return parseFloat(clean) || 0;
    const num = parseFloat(match[1]);
    const prefix = match[2];
    const scales = {
      'p': 1e-12,
      'n': 1e-9,
      'u': 1e-6,
      'm': 1e-3,
      'k': 1e3,
      'M': 1e6,
      'G': 1e9,
      'T': 1e12
    };
    return num * (scales[prefix] || 1);
  }
}
