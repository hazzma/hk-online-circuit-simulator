# ⚡ HK Online Circuit Simulator

A modern, responsive, and interactive in-browser SPICE-like electronic circuit simulator with real-time waveform graphing, transient & AC sweep analysis, animated electric current particles, sweep playhead timeline, and selective data sampling.

![Screenshot](https://img.shields.io/badge/Platform-Web%20Browser-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## 🌟 Key Features

1. **Interactive Schematic Canvas**:
   - Drag & drop components: Resistors, Capacitors, Inductors, DC/AC Voltage Sources, Batteries, Diodes, Op-Amps, Voltage Probes (VP), and Ground (GND).
   - EasyEDA / Multisim shortcuts: `W` for wire tool, `R` for component rotation, `Delete`/`Backspace` for single & batch deletion, `Ctrl+A` for select all, `Esc` to cancel.
   - Marquee box selection (block select multiple components & wires).
   - Mouse wheel zoom centered on cursor & smooth canvas panning.

2. **Visual Current Flow & Realistic Running State**:
   - **Real-time Current Animation**: Falstad & Multisim Live style golden electron particles flowing along wires with directional arrow markers reflecting circuit physics.
   - **Vivid Run / Stop Controls**: Green pulsing run badge with live canvas overlay and active red paused state.

3. **High-Performance Oscilloscope & Bode Grapher**:
   - Zero-stretch, DPR retina-scaled HTML5 Canvas CRT oscilloscope display.
   - **Live Sweep Timeline Playhead**: A vertical neon playhead sweeping across time $t=0$ to $t_{max}$, accompanied by glowing sample dots tracking trace voltages ($V_{in}, V_C$) in real time.
   - **Multisim Live Dual Cursors**: Interactive C1 and C2 draggable vertical cursors with real-time measurement badge ($\Delta X, \Delta Y$).

4. **Selective Data Table & Precision Sampling**:
   - **Mode Switcher**: Freely choose between **Target Voltage** ($V \to t$) or **Target Time** ($t \to V$).
   - **Clean Lab Log**: Table ONLY displays rows added intentionally via `➕ Tambah Data (+)` or quick preset chips.
   - One-click row deletion (`🗑️`), table clearing, and CSV export.

5. **Practicum Assistant (Experiment 8)**:
   - Built-in guidance and auto-calculation tables for RC Charging ($V_C(t) = V_S(1 - e^{-t/\tau})$), Discharging ($V_C(t) = V_0 e^{-t/\tau}$), and RLC Series AC resonance.

---

## 🚀 Live Demo

You can run this directly in any modern browser without any installation:
**[https://hazzma.github.io/hk-online-circuit-simulator/](https://hazzma.github.io/hk-online-circuit-simulator/)**

---

## 💻 Local Setup & Development

No build tools or heavy node modules required — built completely with pure vanilla HTML5, CSS3, and modern ES6 modules.

```bash
# Clone the repository
git clone https://github.com/hazzma/hk-online-circuit-simulator.git

# Navigate to the folder
cd hk-online-circuit-simulator

# Run using any static server, for example:
python -m http.server 3000
# or
npx serve .
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📄 License
MIT License. Created by **HK (hazzma)**.
