/**
 * Web Circuit Simulator - Schematic Canvas & Circuit State
 * Advanced SVG viewBox Pan & Zoom Engine, true coordinate transformation,
 * Component 90° Rotation, Live Manhattan Wire Routing & Pin Tracking,
 * and Single-Click Component Property Inspector Card.
 */

export class CircuitCanvas {
  constructor(containerElement, onCircuitChanged) {
    this.container = containerElement;
    this.onCircuitChanged = onCircuitChanged;
    this.svg = document.getElementById('schematic-svg');
    this.gridSize = 15;
    
    // Tools: 'select', 'wire', 'delete'
    this.currentTool = 'select';
    
    // Circuit elements
    this.components = [];
    this.wires = [];
    this.selectedElement = null;
    this.selectedWire = null;
    
    // SVG viewBox Pan & Zoom State
    this.viewBox = { x: 0, y: 0, w: 1200, h: 700 };
    this.baseViewBox = { w: 1200, h: 700 };
    this.zoomLevel = 1.0;
    this.isPanning = false;
    this.hasPannedDuringRightClick = false;
    this.panStartMouse = { x: 0, y: 0 };
    this.panStartViewBox = { x: 0, y: 0 };

    // Component Drag & Multi-Select Block State (Marquee Box Selection)
    this.draggedComp = null;
    this.dragStartSvgPos = { x: 0, y: 0 };
    this.compStartSvgPos = { x: 0, y: 0 };
    this.compStartPositions = [];
    this.hasMovedDuringDrag = false;
    this.selectedComponents = [];
    this.selectedWires = [];
    this.isSelectingBox = false;
    this.boxStartSvg = { x: 0, y: 0 };
    this.hoveredComp = null;
    
    // Wire drawing state
    this.activePin = null;

    // Floating UI elements
    this.wireTooltipEl = document.getElementById('wire-delete-tooltip');
    this.propCardEl = document.getElementById('floating-prop-card');
    this.propInputEl = document.getElementById('card-prop-input');
    this.propTitleEl = document.getElementById('card-comp-name');
    this.propPresetsEl = document.getElementById('card-presets-grid');
    this.btnCardDel = document.getElementById('btn-card-del-comp');
    this.btnCardRot = document.getElementById('btn-card-rot-comp');
    this.btnCardClose = document.getElementById('btn-close-prop-card');
    this.zoomBadgeEl = document.getElementById('zoom-percentage');

    this.initEventListeners();
    this.initPropertyCardEvents();
    this.loadDefaultScreenshotCircuit();
  }

  loadDefaultScreenshotCircuit() {
    this.components = [
      {
        id: 'bat1',
        type: 'battery',
        name: 'V1',
        value: '5V',
        x: 315,
        y: 345,
        rotation: 0,
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
        rotation: 0,
        pins: [
          { id: 'gnd1_p', name: 'gnd', relX: 0, relY: -25, node: 0 }
        ]
      },
      {
        id: 'r1',
        type: 'resistor',
        name: 'R1',
        value: '1kΩ',
        x: 435,
        y: 240,
        rotation: 0,
        pins: [
          { id: 'r1_1', name: '1', relX: -45, relY: 0, node: 1 },
          { id: 'r1_2', name: '2', relX: 45, relY: 0, node: 2 }
        ]
      },
      {
        id: 'c1',
        type: 'capacitor',
        name: 'C1',
        value: '1uF',
        x: 555,
        y: 345,
        rotation: 0,
        pins: [
          { id: 'c1_1', name: '+', relX: 0, relY: -45, node: 2 },
          { id: 'c1_2', name: '-', relX: 0, relY: 45, node: 0 }
        ]
      },
      {
        id: 'vp1',
        type: 'probe',
        name: 'VR',
        value: 'CH1',
        x: 390,
        y: 180,
        rotation: 0,
        pins: [
          { id: 'vp1_p', name: 'p', relX: 0, relY: 30, node: 1 }
        ]
      },
      {
        id: 'vp2',
        type: 'probe',
        name: 'VC',
        value: 'CH2',
        x: 555,
        y: 180,
        rotation: 0,
        pins: [
          { id: 'vp2_p', name: 'p', relX: 0, relY: 30, node: 2 }
        ]
      }
    ];

    this.wires = [
      { id: 'w_bat_r', fromPin: 'bat1_p', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w_vp1', fromPin: 'vp1_p', toPin: 'r1_1', node: 1, type: 'hot' },
      { id: 'w_r_c', fromPin: 'r1_2', toPin: 'c1_1', node: 2, type: 'hot' },
      { id: 'w_vp2', fromPin: 'vp2_p', toPin: 'c1_1', node: 2, type: 'hot' },
      { id: 'w_bat_gnd', fromPin: 'bat1_n', toPin: 'gnd1_p', node: 0, type: 'ground' },
      { id: 'w_gnd_c', fromPin: 'gnd1_p', toPin: 'c1_2', node: 0, type: 'ground' }
    ];

    this.render();
    this.updateViewBox();
  }

  /* =========================================================================
     True Coordinate Transformation (Client Screen <-> SVG Canvas)
     ========================================================================= */
  clientToSvgPoint(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    const rect = this.container.getBoundingClientRect();
    const scaleX = this.viewBox.w / rect.width;
    const scaleY = this.viewBox.h / rect.height;
    return {
      x: (clientX - rect.left) * scaleX + this.viewBox.x,
      y: (clientY - rect.top) * scaleY + this.viewBox.y
    };
  }

  svgToClientPoint(svgX, svgY) {
    const pt = this.svg.createSVGPoint();
    pt.x = svgX;
    pt.y = svgY;
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm);
      return { x: transformed.x, y: transformed.y };
    }
    const rect = this.container.getBoundingClientRect();
    const relX = (svgX - this.viewBox.x) / this.viewBox.w * rect.width;
    const relY = (svgY - this.viewBox.y) / this.viewBox.h * rect.height;
    return { x: rect.left + relX, y: rect.top + relY };
  }

  updateViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
    this.zoomLevel = this.baseViewBox.w / this.viewBox.w;
    if (this.zoomBadgeEl) {
      this.zoomBadgeEl.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  zoomAt(clientX, clientY, factor) {
    const pBefore = this.clientToSvgPoint(clientX, clientY);
    
    const minW = 300;
    const maxW = 3600;
    const newW = Math.max(minW, Math.min(maxW, this.viewBox.w * factor));
    const newH = Math.max(minW * (700/1200), Math.min(maxW * (700/1200), this.viewBox.h * factor));

    this.viewBox.w = newW;
    this.viewBox.h = newH;

    const rect = this.container.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    this.viewBox.x = pBefore.x - normX * this.viewBox.w;
    this.viewBox.y = pBefore.y - normY * this.viewBox.h;

    this.updateViewBox();
    this.hidePropertyCard();
    this.hideWireTooltip();
  }

  zoomIn() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.85);
  }

  zoomOut() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.18);
  }

  zoomReset() {
    this.viewBox = { x: 0, y: 0, w: 1200, h: 700 };
    this.updateViewBox();
  }

  clearCircuit() {
    this.components = [];
    this.wires = [];
    this.clearSelection();
    this.zoomReset();
    this.render();
    if (this.onCircuitChanged) {
      this.onCircuitChanged(this.getCircuitData());
    }
  }

  clearSelection() {
    this.selectedElement = null;
    this.selectedWire = null;
    this.selectedComponents = [];
    this.selectedWires = [];
    this.hidePropertyCard();
    this.hideWireTooltip();
    this.svg.querySelectorAll('.comp-group').forEach(g => g.classList.remove('selected'));
    this.svg.querySelectorAll('.wire-path').forEach(w => w.classList.remove('selected-wire'));
  }

  addComponent(type, x, y) {
    // If coordinates are not provided, place at center of current visible viewBox
    if (x === undefined || y === undefined) {
      x = this.viewBox.x + this.viewBox.w / 2;
      y = this.viewBox.y + this.viewBox.h / 2;
    }

    // Snap to grid
    x = Math.round(x / this.gridSize) * this.gridSize;
    y = Math.round(y / this.gridSize) * this.gridSize;

    const count = this.components.filter(c => c.type === type).length + 1;
    const uid = Math.random().toString(36).substr(2, 5);
    let id = `${type}_${uid}`;
    let name = '';
    let val = '';
    let pins = [];

    switch (type) {
      case 'resistor':
        id = `r_${uid}`;
        name = `R${count}`;
        val = '1kΩ';
        pins = [
          { id: `${id}_1`, name: '1', relX: -45, relY: 0 },
          { id: `${id}_2`, name: '2', relX: 45, relY: 0 }
        ];
        break;

      case 'capacitor':
        id = `c_${uid}`;
        name = `C${count}`;
        val = '1uF';
        pins = [
          { id: `${id}_1`, name: '+', relX: 0, relY: -45 },
          { id: `${id}_2`, name: '-', relX: 0, relY: 45 }
        ];
        break;

      case 'inductor':
        id = `l_${uid}`;
        name = `L${count}`;
        val = '10mH';
        pins = [
          { id: `${id}_1`, name: '1', relX: -45, relY: 0 },
          { id: `${id}_2`, name: '2', relX: 45, relY: 0 }
        ];
        break;

      case 'battery':
      case 'dc_source':
        id = `v_${uid}`;
        name = `V${count}`;
        val = '5V';
        pins = [
          { id: `${id}_p`, name: '+', relX: 0, relY: -45 },
          { id: `${id}_n`, name: '-', relX: 0, relY: 45 }
        ];
        break;

      case 'ac_source':
        id = `vac_${uid}`;
        name = `V${count}`;
        val = '5V 1kHz';
        pins = [
          { id: `${id}_p`, name: '+', relX: -30, relY: 0 },
          { id: `${id}_n`, name: '-', relX: 30, relY: 0 }
        ];
        break;

      case 'ground':
        id = `gnd_${uid}`;
        name = 'GND';
        val = '0V';
        pins = [
          { id: `${id}_p`, name: 'gnd', relX: 0, relY: -25, node: 0 }
        ];
        break;

      case 'probe':
        id = `vp_${uid}`;
        name = `VP${count}`;
        val = count === 1 ? 'CH1' : 'CH2';
        pins = [
          { id: `${id}_p`, name: 'p', relX: 0, relY: 30 }
        ];
        break;

      case 'diode':
        id = `d_${uid}`;
        name = `D${count}`;
        val = '1N4007';
        pins = [
          { id: `${id}_1`, name: '1', relX: -30, relY: 0 },
          { id: `${id}_2`, name: '2', relX: 30, relY: 0 }
        ];
        break;

      default:
        id = `comp_${uid}`;
        name = `${type.toUpperCase()}${count}`;
        val = '1';
        pins = [
          { id: `${id}_1`, name: '1', relX: -30, relY: 0 },
          { id: `${id}_2`, name: '2', relX: 30, relY: 0 }
        ];
    }

    const newComp = {
      id,
      type,
      name,
      value: val,
      x,
      y,
      rotation: 0,
      pins
    };

    this.components.push(newComp);
    this.render();
    this.showPropertyCard(newComp);

    if (this.onCircuitChanged) {
      this.onCircuitChanged(this.getCircuitData());
    }

    return newComp;
  }

  setTool(tool) {
    this.currentTool = tool;
    if (tool === 'wire') {
      this.container.classList.add('wiring-mode');
    } else {
      this.container.classList.remove('wiring-mode');
    }
  }

  getPinById(pinId) {
    for (const comp of this.components) {
      if (comp.pins) {
        const found = comp.pins.find(p => p.id === pinId);
        if (found) return { pin: found, comp };
      }
    }
    return null;
  }

  getPinAbsolutePos(pinId) {
    const item = this.getPinById(pinId);
    if (!item) return null;
    const rot = item.comp.rotation || 0;
    const rad = (rot * Math.PI) / 180;
    const cos = Math.round(Math.cos(rad));
    const sin = Math.round(Math.sin(rad));
    const relX = item.pin.relX || 0;
    const relY = item.pin.relY || 0;
    const rotX = relX * cos - relY * sin;
    const rotY = relX * sin + relY * cos;
    return {
      x: item.comp.x + rotX,
      y: item.comp.y + rotY
    };
  }

  render(voltages = { v1: 5.0, v2: 4.6 }) {
    // 1. Wires SVG
    const wiresSvg = this.wires.map(wire => this.renderWire(wire)).join('');

    // 2. Components SVG
    const componentsSvg = this.components.map(comp => this.renderComponent(comp)).join('');

    // 3. Dynamic Voltage Annotations
    const annotationsSvg = `
      <g id="annotations-group">
        <text x="370" y="235" class="voltage-annotation">${voltages.v1.toFixed(1)} V</text>
        <text x="500" y="235" class="voltage-annotation">${voltages.v2.toFixed(1)} V</text>
        <text x="290" y="450" class="voltage-annotation" style="fill:#2563eb">0 V</text>
      </g>
    `;

    this.svg.innerHTML = `
      <defs>
        <pattern id="dot-grid" width="15" height="15" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" class="grid-dot" />
        </pattern>
      </defs>
      <rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#dot-grid)" id="bg-grid-rect" style="cursor: grab;" />
      <g id="wires-layer">${wiresSvg}</g>
      <path id="preview-wire" class="preview-wire-path" d="" style="display:none;" />
      <g id="components-layer">${componentsSvg}</g>
      ${annotationsSvg}
      <rect id="marquee-selection-box" class="selection-marquee" x="0" y="0" width="0" height="0" style="display:none;" />
    `;

    this.updateViewBox();
    this.attachDomHandlers();
  }

  getWireEndpoints(wire) {
    let pStart, pEnd;
    if (wire.fromPin && wire.toPin) {
      pStart = this.getPinAbsolutePos(wire.fromPin);
      pEnd = this.getPinAbsolutePos(wire.toPin);
    } else if (wire.points && wire.points.length >= 2) {
      pStart = wire.points[0];
      pEnd = wire.points[wire.points.length - 1];
    }
    if (!pStart || !pEnd) return null;

    // Check circuit physics to establish conventional current flow direction:
    // 1. Current flows INTO ground
    const fromItem = wire.fromPin ? this.getPinById(wire.fromPin) : null;
    const toItem = wire.toPin ? this.getPinById(wire.toPin) : null;

    let reverseArrow = false;
    if (fromItem && fromItem.comp.type === 'ground') {
      reverseArrow = true;
    } else if (toItem && (toItem.comp.type === 'battery' || toItem.comp.type === 'dc_source' || toItem.comp.type === 'ac_source') && toItem.pin.name === '+') {
      reverseArrow = true;
    }

    return { pStart, pEnd, reverseArrow };
  }

  renderWire(wire) {
    const endpoints = this.getWireEndpoints(wire);
    if (!endpoints) return '';
    const { pStart, pEnd, reverseArrow } = endpoints;

    let d = '';
    const dx = Math.abs(pEnd.x - pStart.x);
    const dy = Math.abs(pEnd.y - pStart.y);
    let arrowX = (pStart.x + pEnd.x) / 2;
    let arrowY = (pStart.y + pEnd.y) / 2;
    let arrowAngle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x) * 180 / Math.PI;

    if (dx < 2 || dy < 2) {
      d = `M ${pStart.x} ${pStart.y} L ${pEnd.x} ${pEnd.y}`;
    } else {
      const midX = pEnd.x;
      const midY = pStart.y;
      d = `M ${pStart.x} ${pStart.y} L ${midX} ${midY} L ${pEnd.x} ${pEnd.y}`;

      const len1 = Math.hypot(midX - pStart.x, midY - pStart.y);
      const len2 = Math.hypot(pEnd.x - midX, pEnd.y - midY);
      if (len1 >= len2) {
        arrowX = (pStart.x + midX) / 2;
        arrowY = (pStart.y + midY) / 2;
        arrowAngle = Math.atan2(midY - pStart.y, midX - pStart.x) * 180 / Math.PI;
      } else {
        arrowX = (midX + pEnd.x) / 2;
        arrowY = (midY + pEnd.y) / 2;
        arrowAngle = Math.atan2(pEnd.y - midY, pEnd.x - midX) * 180 / Math.PI;
      }
    }

    if (reverseArrow) {
      arrowAngle = (arrowAngle + 180) % 360;
    }

    const isSelected = (this.selectedWire && this.selectedWire.id === wire.id) || 
                       (this.selectedWires && this.selectedWires.some(w => w.id === wire.id));
    const wireClass = wire.type === 'ground' ? 'wire-path wire-ground' : 'wire-path wire-hot';
    const dotColor = wire.type === 'ground' ? '#2563eb' : '#ef4444';

    return `
      <g class="wire-group" id="group_${wire.id}">
        <path d="${d}" stroke="transparent" stroke-width="14" fill="none" class="wire-hitbox" data-wire-id="${wire.id}" />
        <path d="${d}" class="${wireClass} ${isSelected ? 'selected-wire' : ''}" id="${wire.id}" data-wire-id="${wire.id}" />
        <path d="${d}" class="wire-current-flow" id="flow_${wire.id}" />
        <polygon points="-5,-4 6,0 -5,4" fill="#facc15" class="wire-arrow-marker" id="arrow_${wire.id}" transform="translate(${arrowX}, ${arrowY}) rotate(${arrowAngle})" />
        <circle cx="${pStart.x}" cy="${pStart.y}" r="3" fill="${dotColor}" />
        <circle cx="${pEnd.x}" cy="${pEnd.y}" r="3" fill="${dotColor}" />
      </g>
    `;
  }

  renderComponent(comp) {
    const isSelected = (this.selectedElement && this.selectedElement.id === comp.id) ||
                       (this.selectedComponents && this.selectedComponents.some(c => c.id === comp.id));
    let shapeSvg = '';
    let labelSvg = '';

    switch (comp.type) {
      case 'resistor':
        shapeSvg = `
          <path d="M -45 0 L -25 0 L -20 -8 L -10 8 L 0 -8 L 10 8 L 20 -8 L 25 0 L 45 0" class="comp-body" />
        `;
        labelSvg = `
          <text x="-15" y="-14" class="comp-label">${comp.name}</text>
          <text x="5" y="-14" class="comp-value" id="val_label_${comp.id}">· ${comp.value}</text>
        `;
        break;

      case 'capacitor':
        shapeSvg = `
          <path d="M 0 -45 L 0 -8 M -16 -8 L 16 -8 M -16 8 L 16 8 M 0 8 L 0 45" class="comp-body" />
        `;
        labelSvg = `
          <text x="20" y="-4" class="comp-label">${comp.name}</text>
          <text x="34" y="-4" class="comp-value" id="val_label_${comp.id}">· ${comp.value}</text>
        `;
        break;

      case 'inductor':
        shapeSvg = `
          <path d="M -45 0 L -30 0 A 7 7 0 0 1 -15 0 A 7 7 0 0 1 0 0 A 7 7 0 0 1 15 0 A 7 7 0 0 1 30 0 L 45 0" class="comp-body" />
        `;
        labelSvg = `
          <text x="-15" y="-14" class="comp-label">${comp.name}</text>
          <text x="5" y="-14" class="comp-value" id="val_label_${comp.id}">· ${comp.value}</text>
        `;
        break;

      case 'battery':
      case 'dc_source':
        shapeSvg = `
          <path d="M 0 -45 L 0 -14 M -16 -14 L 16 -14 M -8 -4 L 8 -4 M -16 4 L 16 4 M -8 14 L 8 14 M 0 14 L 0 45" class="comp-body" />
          <text x="8" y="-18" font-size="12" font-weight="700" fill="#475569">+</text>
          <text x="8" y="26" font-size="14" font-weight="700" fill="#475569">-</text>
        `;
        labelSvg = `
          <text x="-52" y="-6" class="comp-label">${comp.name}</text>
          <text x="-26" y="-6" class="comp-value" id="val_label_${comp.id}">${comp.value}</text>
        `;
        break;

      case 'ac_source':
        shapeSvg = `
          <circle cx="0" cy="0" r="16" class="comp-body" />
          <path d="M -30 0 L -16 0 M 16 0 L 30 0 M -8 0 Q -4 -7 0 0 T 8 0" class="comp-body" />
          <text x="-24" y="-7" font-size="10" font-weight="700" fill="#475569">+</text>
          <text x="18" y="-7" font-size="12" font-weight="700" fill="#475569">-</text>
        `;
        labelSvg = `
          <text x="-24" y="-22" class="comp-label">${comp.name}</text>
          <text x="5" y="-22" class="comp-value" id="val_label_${comp.id}">${comp.value}</text>
        `;
        break;

      case 'ground':
        shapeSvg = `
          <path d="M 0 -25 L 0 0 M -14 0 L 14 0 M -9 5 L 9 5 M -4 10 L 4 10" class="comp-body" />
        `;
        labelSvg = `
          <text x="-26" y="-10" class="comp-label" style="fill:#2563eb">GND</text>
        `;
        break;

      case 'probe':
        shapeSvg = `
          <circle cx="0" cy="-6" r="9" fill="#1e293b" />
          <path d="M 0 3 L 0 30" stroke="#1e293b" stroke-width="2" />
          <polygon points="0,30 -4,22 4,22" fill="#1e293b" />
          <text x="-6" y="-3" font-size="8" font-weight="700" fill="#ffffff">VP</text>
        `;
        labelSvg = `
          <text x="-8" y="-18" class="comp-label">${comp.name}</text>
        `;
        break;

      case 'diode':
        shapeSvg = `
          <path d="M -30 0 L -12 0 M 12 0 L 30 0 M -12 -10 L 12 0 L -12 10 Z M 12 -10 L 12 10" class="comp-body" />
        `;
        labelSvg = `
          <text x="-15" y="-14" class="comp-label">${comp.name}</text>
          <text x="5" y="-14" class="comp-value" id="val_label_${comp.id}">· ${comp.value}</text>
        `;
        break;

      default:
        shapeSvg = `<rect x="-15" y="-15" width="30" height="30" class="comp-body" />`;
    }

    const pinsSvg = (comp.pins || []).map(p => {
      const relX = p.relX || 0;
      const relY = p.relY || 0;
      return `
        <g class="pin-anchor" data-pin-id="${p.id}" data-comp-id="${comp.id}">
          <circle cx="${relX}" cy="${relY}" r="14" fill="transparent" class="comp-pin-hitbox" data-pin-id="${p.id}" data-comp-id="${comp.id}" style="cursor: crosshair;" />
          <circle cx="${relX}" cy="${relY}" r="5" class="comp-pin" data-pin-id="${p.id}" data-comp-id="${comp.id}" title="Klik untuk sambung kabel" />
        </g>
      `;
    }).join('');

    const rot = comp.rotation || 0;

    return `
      <g class="comp-group ${isSelected ? 'selected' : ''}" id="${comp.id}" transform="translate(${comp.x}, ${comp.y})" style="cursor: move;">
        <g transform="rotate(${rot})">
          <rect x="-42" y="-35" width="84" height="70" fill="transparent" class="comp-drag-hitbox" />
          ${shapeSvg}
          ${pinsSvg}
        </g>
        ${labelSvg}
      </g>
    `;
  }

  attachDomHandlers() {
    // 1. Component Click & Drag handlers
    this.svg.querySelectorAll('.comp-group').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('comp-pin') || e.target.classList.contains('comp-pin-hitbox')) return;
        if (e.button !== 0) {
          if (e.button === 2) {
            if (this.activePin) {
              this.cancelAllActions();
              return;
            }
            // Allow right-click drag to pan canvas from anywhere
            this.isPanning = true;
            this.hasPannedDuringRightClick = false;
            this.panStartMouse = { x: e.clientX, y: e.clientY };
            this.panStartViewBox = { x: this.viewBox.x, y: this.viewBox.y };
            this.svg.style.cursor = 'grabbing';
            e.preventDefault();
          }
          return; // Only left click for comp drag
        }

        if (this.currentTool === 'delete') {
          this.deleteComponent(el.id);
          return;
        }

        const comp = this.components.find(c => c.id === el.id);
        if (!comp) return;

        // If not already part of multi-selection, select this component
        if (!this.selectedComponents.some(c => c.id === comp.id)) {
          if (!e.shiftKey) {
            this.clearSelection();
            this.selectedComponents = [comp];
          } else {
            this.selectedComponents.push(comp);
          }
        }

        this.selectedElement = comp;
        this.selectedWire = null;
        this.hideWireTooltip();
        this.draggedComp = comp;
        this.hasMovedDuringDrag = false;

        const svgPt = this.clientToSvgPoint(e.clientX, e.clientY);
        this.dragStartSvgPos = svgPt;
        this.compStartPositions = this.selectedComponents.map(c => ({ id: c.id, x: c.x, y: c.y }));

        this.selectedComponents.forEach(c => {
          const gEl = document.getElementById(c.id);
          if (gEl) gEl.classList.add('selected');
        });

        e.stopPropagation();
      });

      // Track hovered component for 'R' / 'Space' shortcut
      el.addEventListener('mouseenter', () => {
        this.hoveredComp = this.components.find(c => c.id === el.id);
      });
      el.addEventListener('mouseleave', () => {
        if (this.hoveredComp && this.hoveredComp.id === el.id) {
          this.hoveredComp = null;
        }
      });
    });

    // 2. Pin Hitbox & Click for Wire Connection
    this.svg.querySelectorAll('.comp-pin, .comp-pin-hitbox').forEach(pinEl => {
      pinEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) {
          if (e.button === 2) {
            if (this.activePin) {
              this.cancelAllActions();
              return;
            }
            this.isPanning = true;
            this.hasPannedDuringRightClick = false;
            this.panStartMouse = { x: e.clientX, y: e.clientY };
            this.panStartViewBox = { x: this.viewBox.x, y: this.viewBox.y };
            this.svg.style.cursor = 'grabbing';
            e.preventDefault();
          }
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        const pinId = pinEl.dataset.pinId;
        const compId = pinEl.dataset.compId;
        if (pinId && compId) {
          this.handlePinClick(pinId, compId);
        }
      });
    });

    // 3. Wire Click & Hitbox for Deletion / Selection
    this.svg.querySelectorAll('.wire-hitbox, .wire-path').forEach(wireEl => {
      wireEl.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          if (this.activePin) {
            this.cancelAllActions();
            return;
          }
          this.isPanning = true;
          this.hasPannedDuringRightClick = false;
          this.panStartMouse = { x: e.clientX, y: e.clientY };
          this.panStartViewBox = { x: this.viewBox.x, y: this.viewBox.y };
          this.svg.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }
      });
      wireEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const wireId = wireEl.dataset.wireId;
        if (!wireId) return;

        if (this.currentTool === 'delete') {
          this.deleteWire(wireId);
          return;
        }

        const wire = this.wires.find(w => w.id === wireId);
        if (wire) {
          this.selectWire(wire, e.clientX, e.clientY);
        }
      });
    });
  }

  initEventListeners() {
    // Context Menu (Right Click) everywhere on canvas -> Cancel & Unselect if not panning
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.hasPannedDuringRightClick) {
        this.hasPannedDuringRightClick = false;
        return;
      }
      this.cancelAllActions();
    });

    // A. Canvas Background Mousedown:
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1 || e.altKey) {
        // If actively drawing a wire, right-clicking cancels wiring immediately
        if (e.button === 2 && this.activePin) {
          this.cancelAllActions();
          e.preventDefault();
          return;
        }

        // Right-Click, Middle click, or Alt -> Pan Canvas
        this.isPanning = true;
        this.hasPannedDuringRightClick = false;
        this.panStartMouse = { x: e.clientX, y: e.clientY };
        this.panStartViewBox = { x: this.viewBox.x, y: this.viewBox.y };
        this.svg.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      if (e.target.id === 'bg-grid-rect' || e.target.tagName === 'svg') {
        if (e.button === 1 || e.altKey) {
          // Middle click or Alt -> Pan Canvas
          this.isPanning = true;
          this.panStartMouse = { x: e.clientX, y: e.clientY };
          this.panStartViewBox = { x: this.viewBox.x, y: this.viewBox.y };
          this.svg.style.cursor = 'grabbing';
        } else if (e.button === 0) {
          // If in wire drawing mode or active pin is selected, clicking empty canvas cancels!
          if (this.activePin) {
            this.cancelAllActions();
            e.preventDefault();
            return;
          }

          // Left Click -> Start Marquee Box Selection (Nge-block komponen)
          this.isSelectingBox = true;
          this.boxStartSvg = this.clientToSvgPoint(e.clientX, e.clientY);

          if (!e.shiftKey) {
            this.clearSelection();
          }

          const boxEl = document.getElementById('marquee-selection-box');
          if (boxEl) {
            boxEl.setAttribute('x', this.boxStartSvg.x);
            boxEl.setAttribute('y', this.boxStartSvg.y);
            boxEl.setAttribute('width', 0);
            boxEl.setAttribute('height', 0);
            boxEl.style.display = 'block';
          }
        }
        e.preventDefault();
      }
    });

    // B. Mouse Wheel Zoom centered on cursor
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // C. Window Mousemove for dragging, live wiring, marquee box selection, and panning
    window.addEventListener('mousemove', (e) => {
      // 1. Canvas Pan
      if (this.isPanning) {
        const dx = e.clientX - this.panStartMouse.x;
        const dy = e.clientY - this.panStartMouse.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.hasPannedDuringRightClick = true;
        }
        const rect = this.container.getBoundingClientRect();
        const scaleX = this.viewBox.w / rect.width;
        const scaleY = this.viewBox.h / rect.height;

        this.viewBox.x = this.panStartViewBox.x - dx * scaleX;
        this.viewBox.y = this.panStartViewBox.y - dy * scaleY;
        this.updateViewBox();
        return;
      }

      // 2. Marquee Box Selection (Nge-block banyak komponen secara visual)
      if (this.isSelectingBox) {
        const curSvg = this.clientToSvgPoint(e.clientX, e.clientY);
        const xMin = Math.min(this.boxStartSvg.x, curSvg.x);
        const yMin = Math.min(this.boxStartSvg.y, curSvg.y);
        const boxW = Math.abs(curSvg.x - this.boxStartSvg.x);
        const boxH = Math.abs(curSvg.y - this.boxStartSvg.y);

        const boxEl = document.getElementById('marquee-selection-box');
        if (boxEl) {
          boxEl.setAttribute('x', xMin);
          boxEl.setAttribute('y', yMin);
          boxEl.setAttribute('width', boxW);
          boxEl.setAttribute('height', boxH);
        }

        if (boxW > 6 || boxH > 6) {
          this.selectedComponents = [];
          this.components.forEach(comp => {
            const inBox = (comp.x + 35 >= xMin && comp.x - 35 <= xMin + boxW &&
                           comp.y + 35 >= yMin && comp.y - 35 <= yMin + boxH);
            const compEl = document.getElementById(comp.id);
            if (inBox) {
              this.selectedComponents.push(comp);
              if (compEl) compEl.classList.add('selected');
            } else if (!e.shiftKey) {
              if (compEl) compEl.classList.remove('selected');
            }
          });

          this.selectedWires = [];
          this.wires.forEach(wire => {
            const p1 = this.getPinAbsolutePos(wire.fromPin);
            const p2 = this.getPinAbsolutePos(wire.toPin);
            const wireEl = document.getElementById(wire.id);
            if (p1 && p2) {
              const inBox = (p1.x >= xMin && p1.x <= xMin + boxW && p1.y >= yMin && p1.y <= yMin + boxH) &&
                            (p2.x >= xMin && p2.x <= xMin + boxW && p2.y >= yMin && p2.y <= yMin + boxH);
              if (inBox) {
                this.selectedWires.push(wire);
                if (wireEl) wireEl.classList.add('selected-wire');
              } else if (!e.shiftKey) {
                if (wireEl) wireEl.classList.remove('selected-wire');
              }
            }
          });
        }
        return;
      }

      // 3. Component Dragging (with Batch Move support!)
      if (this.draggedComp) {
        const svgCur = this.clientToSvgPoint(e.clientX, e.clientY);
        const rawDx = svgCur.x - this.dragStartSvgPos.x;
        const rawDy = svgCur.y - this.dragStartSvgPos.y;

        if (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3) {
          this.hasMovedDuringDrag = true;
          this.hidePropertyCard();
          this.hideWireTooltip();
        }

        const dx = Math.round(rawDx / this.gridSize) * this.gridSize;
        const dy = Math.round(rawDy / this.gridSize) * this.gridSize;

        this.compStartPositions.forEach(start => {
          const comp = this.components.find(c => c.id === start.id);
          if (comp) {
            comp.x = start.x + dx;
            comp.y = start.y + dy;
            const groupEl = document.getElementById(comp.id);
            if (groupEl) {
              groupEl.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);
            }
            this.updateConnectedWiresInDom(comp.id);
          }
        });
      }

      // 4. Live Preview Wire
      if (this.activePin) {
        this.updatePreviewWire(e.clientX, e.clientY);
      }
    });

    // D. Window Mouseup (Instant click response & box selection finalization)
    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = 'default';
      }

      if (this.isSelectingBox) {
        this.isSelectingBox = false;
        const boxEl = document.getElementById('marquee-selection-box');
        if (boxEl) boxEl.style.display = 'none';

        if (this.selectedComponents.length === 1) {
          this.selectedElement = this.selectedComponents[0];
          this.showPropertyCard(this.selectedElement);
        } else if (this.selectedComponents.length > 1) {
          this.hidePropertyCard();
        }
      }

      if (this.draggedComp) {
        const comp = this.draggedComp;
        const moved = this.hasMovedDuringDrag;
        this.draggedComp = null;

        if (moved) {
          this.render();
          if (this.onCircuitChanged) {
            this.onCircuitChanged(this.getCircuitData());
          }
        } else {
          // User just clicked the component without dragging!
          // NEVER re-render here to preserve DOM click target:
          this.selectedElement = comp;
          this.showPropertyCard(comp);
        }
      }
    });

    // E. EasyEDA-style Keyboard Shortcuts: R (rotate), W (wire tool), Del (batch delete), Ctrl+A (select all)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'r' || e.key === 'R' || e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (this.selectedComponents && this.selectedComponents.length > 1) {
          // Batch rotate all multi-selected components
          this.selectedComponents.forEach(c => {
            c.rotation = ((c.rotation || 0) + 90) % 360;
          });
          this.render();
          if (this.onCircuitChanged) this.onCircuitChanged(this.getCircuitData());
        } else {
          const target = this.selectedElement || this.hoveredComp;
          if (target) {
            this.rotateComponent(target.id);
          }
        }
      } else if (e.key === 'w' || e.key === 'W') {
        this.setTool('wire');
        if (window.app && window.app.updateToolButtons) {
          window.app.updateToolButtons('wire');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedComponents && this.selectedComponents.length > 0) {
          // BATCH DELETE ALL BLOCKED / MULTI-SELECTED COMPONENTS & WIRES!
          const idsToDelete = new Set(this.selectedComponents.map(c => c.id));
          this.components = this.components.filter(c => !idsToDelete.has(c.id));
          this.wires = this.wires.filter(w => {
            const p1 = this.getPinById(w.fromPin);
            const p2 = this.getPinById(w.toPin);
            const p1Dead = p1 && idsToDelete.has(p1.comp.id);
            const p2Dead = p2 && idsToDelete.has(p2.comp.id);
            const wireSelected = this.selectedWires && this.selectedWires.some(sw => sw.id === w.id);
            return !p1Dead && !p2Dead && !wireSelected;
          });
          this.clearSelection();
          this.render();
          if (this.onCircuitChanged) this.onCircuitChanged(this.getCircuitData());
        } else if (this.selectedWire) {
          this.deleteWire(this.selectedWire.id);
        } else if (this.selectedElement) {
          this.deleteComponent(this.selectedElement.id);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.selectedComponents = [...this.components];
        this.selectedWires = [...this.wires];
        this.svg.querySelectorAll('.comp-group').forEach(g => g.classList.add('selected'));
        this.svg.querySelectorAll('.wire-path').forEach(w => w.classList.add('selected-wire'));
      } else if (e.key === 'Escape') {
        this.cancelAllActions();
      }
    });

    // Wire delete tooltip button click
    if (this.wireTooltipEl) {
      this.wireTooltipEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedWire) {
          this.deleteWire(this.selectedWire.id);
        }
      });
    }

    // HTML5 Drag & Drop from left sidebar into canvas
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (type) {
        const svgPt = this.clientToSvgPoint(e.clientX, e.clientY);
        this.addComponent(type, svgPt.x, svgPt.y);
      }
    });
  }

  /* =========================================================================
     Component Rotation & Property Inspector Card
     ========================================================================= */
  rotateComponent(compId) {
    const comp = this.components.find(c => c.id === compId);
    if (!comp) return;

    comp.rotation = ((comp.rotation || 0) + 90) % 360;

    this.render();
    this.showPropertyCard(comp);
    if (this.onCircuitChanged) this.onCircuitChanged(this.getCircuitData());
  }

  showPropertyCard(comp) {
    if (!this.propCardEl) return;

    this.selectedElement = comp;
    this.selectedWire = null;
    this.hideWireTooltip();

    // Docked Right Side Inspector Panel
    this.propCardEl.style.left = '';
    this.propCardEl.style.top = '';
    this.propCardEl.classList.add('active');

    const typeNames = {
      resistor: 'Resistor',
      capacitor: 'Kapasitor',
      battery: 'Baterai (DC)',
      dc_source: 'Sumber DC',
      ac_source: 'Sumber AC',
      inductor: 'Induktor',
      diode: 'Dioda',
      ground: 'Ground',
      probe: 'Probe Tegangan'
    };
    this.propTitleEl.textContent = `${comp.name} · ${typeNames[comp.type] || comp.type}`;

    const stdSection = document.getElementById('standard-comp-controls');
    const acSection = document.getElementById('ac-source-controls');

    if (comp.type === 'ac_source') {
      if (stdSection) stdSection.style.display = 'none';
      if (acSection) acSection.style.display = 'flex';

      // Initialize AC Source parameters if not already present
      comp.acMode = comp.acMode || 'amplitude';
      if (comp.acVoltage === undefined) {
        comp.acVoltage = parseFloat(comp.value) || 5.0;
      }
      if (!comp.acFreq) {
        const parts = (comp.value || '').split(/\s+/);
        comp.acFreq = parts.length > 1 ? parts[1] : '1 kHz';
      }

      this.updateAcSourceInspector(comp);
    } else {
      if (stdSection) stdSection.style.display = 'flex';
      if (acSection) acSection.style.display = 'none';

      if (this.propInputEl) {
        this.propInputEl.value = comp.value;
      }

      let presets = [];
      if (comp.type === 'resistor') {
        presets = ['100Ω', '500Ω', '1kΩ', '2kΩ', '5kΩ', '10kΩ'];
      } else if (comp.type === 'capacitor') {
        presets = ['100nF', '470nF', '1uF', '2uF', '10uF'];
      } else if (comp.type === 'battery' || comp.type === 'dc_source') {
        presets = ['3V', '5V', '9V', '12V', '24V'];
      } else if (comp.type === 'inductor') {
        presets = ['1uH', '10uH', '100uH', '1mH', '10mH'];
      }

      if (this.propPresetsEl) {
        if (presets.length > 0) {
          this.propPresetsEl.innerHTML = presets.map(val => {
            const isActive = comp.value.toLowerCase().replace(/\s/g, '') === val.toLowerCase().replace(/\s/g, '');
            return `<button class="btn-preset-chip ${isActive ? 'active' : ''}" data-val="${val}">${val}</button>`;
          }).join('');

          this.propPresetsEl.querySelectorAll('.btn-preset-chip').forEach(btn => {
            btn.addEventListener('click', () => {
              const newVal = btn.dataset.val;
              if (this.propInputEl) this.propInputEl.value = newVal;
              this.applyPropertyValue(comp, newVal);
              this.showPropertyCard(comp);
            });
          });
        } else {
          this.propPresetsEl.innerHTML = '<span style="font-size:11px;color:#94a3b8;">Ketik nilai langsung di atas.</span>';
        }
      }
    }
  }

  updateAcSourceInspector(comp) {
    const acVoltageInput = document.getElementById('ac-voltage-input');
    const acFreqInput = document.getElementById('ac-freq-input');
    const acVoltageLabel = document.getElementById('ac-voltage-label');
    const convVp = document.getElementById('conv-vp');
    const convVrms = document.getElementById('conv-vrms');
    const convVpp = document.getElementById('conv-vpp');
    const modeTabs = document.querySelectorAll('#ac-mode-tabs .btn-ac-mode');

    modeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === comp.acMode);
    });

    const modeLabels = {
      amplitude: 'Tegangan Amplitudo (Vp):',
      rms: 'Tegangan Efektif (Vrms):',
      pkpk: 'Tegangan Peak-to-Peak (Vpp):'
    };
    if (acVoltageLabel) {
      acVoltageLabel.textContent = modeLabels[comp.acMode] || 'Tegangan AC:';
    }

    if (acVoltageInput) {
      acVoltageInput.value = comp.acVoltage;
    }
    if (acFreqInput) {
      acFreqInput.value = comp.acFreq;
    }

    // Live multi-mode calculations
    const val = parseFloat(comp.acVoltage) || 0;
    let vp = 0, vrms = 0, vpp = 0;
    if (comp.acMode === 'amplitude') {
      vp = val;
      vrms = vp / Math.SQRT2;
      vpp = vp * 2;
    } else if (comp.acMode === 'rms') {
      vrms = val;
      vp = vrms * Math.SQRT2;
      vpp = vp * 2;
    } else { // pkpk
      vpp = val;
      vp = vpp / 2;
      vrms = vp / Math.SQRT2;
    }

    if (convVp) convVp.textContent = `${vp.toFixed(2)} V`;
    if (convVrms) convVrms.textContent = `${vrms.toFixed(2)} V`;
    if (convVpp) convVpp.textContent = `${vpp.toFixed(2)} V`;

    // Format display string
    let suffix = 'Vpk';
    if (comp.acMode === 'rms') suffix = 'Vrms';
    if (comp.acMode === 'pkpk') suffix = 'Vpp';
    comp.value = `${val}${suffix} ${comp.acFreq}`;

    const valLabel = document.getElementById(`val_label_${comp.id}`);
    if (valLabel) {
      valLabel.textContent = comp.value;
    }

    if (this.onCircuitChanged) {
      this.onCircuitChanged(this.getCircuitData());
    }
  }

  applyPropertyValue(comp, newVal) {
    if (!newVal || newVal.trim() === '') return;
    comp.value = newVal.trim();

    const valLabel = document.getElementById(`val_label_${comp.id}`);
    if (valLabel) {
      valLabel.textContent = comp.type === 'resistor' || comp.type === 'capacitor' || comp.type === 'inductor' ? `· ${comp.value}` : comp.value;
    }

    if (this.onCircuitChanged) {
      this.onCircuitChanged(this.getCircuitData());
    }
  }

  initPropertyCardEvents() {
    if (this.propInputEl) {
      this.propInputEl.addEventListener('input', (e) => {
        if (this.selectedElement) {
          this.applyPropertyValue(this.selectedElement, e.target.value);
        }
      });

      this.propInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.hidePropertyCard();
        }
      });
    }

    // AC Source Spec Mode Tabs (Amplitude, RMS, Pk-Pk)
    const modeTabs = document.querySelectorAll('#ac-mode-tabs .btn-ac-mode');
    modeTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.selectedElement && this.selectedElement.type === 'ac_source') {
          this.selectedElement.acMode = btn.dataset.mode;
          this.updateAcSourceInspector(this.selectedElement);
        }
      });
    });

    // AC Source Voltage Input
    const acVoltageInput = document.getElementById('ac-voltage-input');
    if (acVoltageInput) {
      acVoltageInput.addEventListener('input', (e) => {
        if (this.selectedElement && this.selectedElement.type === 'ac_source') {
          this.selectedElement.acVoltage = parseFloat(e.target.value) || 0;
          this.updateAcSourceInspector(this.selectedElement);
        }
      });
    }

    // AC Source Frequency Input
    const acFreqInput = document.getElementById('ac-freq-input');
    if (acFreqInput) {
      acFreqInput.addEventListener('input', (e) => {
        if (this.selectedElement && this.selectedElement.type === 'ac_source') {
          this.selectedElement.acFreq = e.target.value;
          this.updateAcSourceInspector(this.selectedElement);
        }
      });
    }

    // AC Source Frequency Presets
    const freqPresets = document.querySelectorAll('#ac-freq-presets .btn-preset-chip');
    freqPresets.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.selectedElement && this.selectedElement.type === 'ac_source') {
          this.selectedElement.acFreq = btn.dataset.freq;
          freqPresets.forEach(b => b.classList.toggle('active', b === btn));
          this.updateAcSourceInspector(this.selectedElement);
        }
      });
    });

    if (this.btnCardClose) {
      this.btnCardClose.addEventListener('click', () => {
        this.hidePropertyCard();
      });
    }

    if (this.btnCardRot) {
      this.btnCardRot.addEventListener('click', () => {
        if (this.selectedElement) {
          this.rotateComponent(this.selectedElement.id);
        }
      });
    }

    if (this.btnCardDel) {
      this.btnCardDel.addEventListener('click', () => {
        if (this.selectedElement) {
          this.deleteComponent(this.selectedElement.id);
          this.hidePropertyCard();
        }
      });
    }
  }

  hidePropertyCard() {
    if (this.propCardEl) this.propCardEl.classList.remove('active');
  }

  /* =========================================================================
     Wire Management & Live Preview
     ========================================================================= */
  handlePinClick(pinId, compId) {
    const item = this.getPinById(pinId);
    if (!item) return;

    if (!this.activePin) {
      // Start wiring from this pin
      this.activePin = { pinId, compId, pin: item.pin, comp: item.comp };
      const pinEl = this.svg.querySelector(`.comp-pin[data-pin-id="${pinId}"]`);
      if (pinEl) pinEl.classList.add('pin-active');
      this.setTool('wire');
      if (window.app && window.app.updateToolButtons) {
        window.app.updateToolButtons('wire');
      }
    } else {
      // Clicked on target pin
      if (this.activePin.pinId === pinId) {
        // Same pin: cancel
        this.cancelWiring();
        return;
      }

      const fromItem = this.getPinById(this.activePin.pinId);
      const toItem = this.getPinById(pinId);

      if (fromItem && toItem) {
        // Prevent duplicate wires between exact same pins
        const exists = this.wires.some(w => 
          (w.fromPin === this.activePin.pinId && w.toPin === pinId) ||
          (w.fromPin === pinId && w.toPin === this.activePin.pinId)
        );

        if (!exists) {
          const wireId = `w_${Date.now()}`;
          const isGround = (fromItem.comp.type === 'ground' || toItem.comp.type === 'ground');
          
          let node = 1;
          if (isGround) {
            node = 0;
          } else if (fromItem.pin.node !== undefined && fromItem.pin.node !== null) {
            node = fromItem.pin.node;
          } else if (toItem.pin.node !== undefined && toItem.pin.node !== null) {
            node = toItem.pin.node;
          } else {
            const usedNodes = this.wires.map(w => w.node || 0);
            node = usedNodes.length > 0 ? Math.max(...usedNodes) + 1 : 1;
          }

          fromItem.pin.node = node;
          toItem.pin.node = node;

          this.wires.push({
            id: wireId,
            fromPin: this.activePin.pinId,
            toPin: pinId,
            node,
            type: isGround ? 'ground' : 'hot'
          });
        }
      }

      this.cancelWiring();
      this.render();
      if (this.onCircuitChanged) {
        this.onCircuitChanged(this.getCircuitData());
      }
    }
  }

  cancelWiring() {
    this.activePin = null;
    this.hidePreviewWire();
    this.svg.querySelectorAll('.comp-pin').forEach(p => p.classList.remove('pin-active'));
  }

  cancelAllActions() {
    this.cancelWiring();
    this.clearSelection();
    this.setTool('select');
    if (this.isSelectingBox) {
      this.isSelectingBox = false;
      const boxEl = document.getElementById('marquee-selection-box');
      if (boxEl) boxEl.style.display = 'none';
    }
    if (this.draggedComp) {
      this.draggedComp = null;
    }
    if (window.app && window.app.updateToolButtons) {
      window.app.updateToolButtons('select');
    }
  }

  updatePreviewWire(clientX, clientY) {
    if (!this.activePin) return;
    const pStart = this.getPinAbsolutePos(this.activePin.pinId);
    if (!pStart) return;

    const svgMouse = this.clientToSvgPoint(clientX, clientY);
    let curX = Math.round(svgMouse.x / this.gridSize) * this.gridSize;
    let curY = Math.round(svgMouse.y / this.gridSize) * this.gridSize;

    const d = `M ${pStart.x} ${pStart.y} L ${curX} ${pStart.y} L ${curX} ${curY}`;
    const previewEl = document.getElementById('preview-wire');
    if (previewEl) {
      previewEl.setAttribute('d', d);
      previewEl.style.display = 'block';
    }
  }

  hidePreviewWire() {
    const previewEl = document.getElementById('preview-wire');
    if (previewEl) previewEl.style.display = 'none';
    this.svg.querySelectorAll('.comp-pin').forEach(p => p.classList.remove('pin-active'));
  }

  selectWire(wire, clickX, clickY) {
    this.selectedWire = wire;
    this.selectedElement = null;
    this.hidePropertyCard();

    this.svg.querySelectorAll('.wire-path').forEach(w => {
      w.classList.toggle('selected-wire', w.dataset.wireId === wire.id);
    });

    if (this.wireTooltipEl) {
      const containerRect = this.container.getBoundingClientRect();
      const x = clickX - containerRect.left;
      const y = clickY - containerRect.top;
      this.wireTooltipEl.style.left = `${x}px`;
      this.wireTooltipEl.style.top = `${y}px`;
      this.wireTooltipEl.style.display = 'flex';
    }
  }

  deleteWire(wireId) {
    this.wires = this.wires.filter(w => w.id !== wireId);
    this.selectedWire = null;
    this.hideWireTooltip();
    this.render();
    if (this.onCircuitChanged) this.onCircuitChanged(this.getCircuitData());
  }

  hideWireTooltip() {
    if (this.wireTooltipEl) this.wireTooltipEl.style.display = 'none';
  }

  updateConnectedWiresInDom(compId) {
    this.wires.forEach(wire => {
      const p1Item = this.getPinById(wire.fromPin);
      const p2Item = this.getPinById(wire.toPin);

      if ((p1Item && p1Item.comp.id === compId) || (p2Item && p2Item.comp.id === compId)) {
        const endpoints = this.getWireEndpoints(wire);
        if (!endpoints) return;
        const { pStart, pEnd, reverseArrow } = endpoints;

        let d = '';
        const dx = Math.abs(pEnd.x - pStart.x);
        const dy = Math.abs(pEnd.y - pStart.y);
        let arrowX = (pStart.x + pEnd.x) / 2;
        let arrowY = (pStart.y + pEnd.y) / 2;
        let arrowAngle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x) * 180 / Math.PI;

        if (dx < 2 || dy < 2) {
          d = `M ${pStart.x} ${pStart.y} L ${pEnd.x} ${pEnd.y}`;
        } else {
          const midX = pEnd.x;
          const midY = pStart.y;
          d = `M ${pStart.x} ${pStart.y} L ${midX} ${midY} L ${pEnd.x} ${pEnd.y}`;

          const len1 = Math.hypot(midX - pStart.x, midY - pStart.y);
          const len2 = Math.hypot(pEnd.x - midX, pEnd.y - midY);
          if (len1 >= len2) {
            arrowX = (pStart.x + midX) / 2;
            arrowY = (pStart.y + midY) / 2;
            arrowAngle = Math.atan2(midY - pStart.y, midX - pStart.x) * 180 / Math.PI;
          } else {
            arrowX = (midX + pEnd.x) / 2;
            arrowY = (midY + pEnd.y) / 2;
            arrowAngle = Math.atan2(pEnd.y - midY, pEnd.x - midX) * 180 / Math.PI;
          }
        }

        if (reverseArrow) {
          arrowAngle = (arrowAngle + 180) % 360;
        }

        const pathEl = document.getElementById(wire.id);
        if (pathEl) pathEl.setAttribute('d', d);

        const flowEl = document.getElementById(`flow_${wire.id}`);
        if (flowEl) flowEl.setAttribute('d', d);

        const arrowEl = document.getElementById(`arrow_${wire.id}`);
        if (arrowEl) arrowEl.setAttribute('transform', `translate(${arrowX}, ${arrowY}) rotate(${arrowAngle})`);

        const groupEl = document.getElementById(`group_${wire.id}`);
        if (groupEl) {
          const hitbox = groupEl.querySelector('.wire-hitbox');
          if (hitbox) hitbox.setAttribute('d', d);

          const circles = groupEl.querySelectorAll('circle');
          if (circles[0]) { circles[0].setAttribute('cx', pStart.x); circles[0].setAttribute('cy', pStart.y); }
          if (circles[1]) { circles[1].setAttribute('cx', pEnd.x); circles[1].setAttribute('cy', pEnd.y); }
        }
      }
    });
  }



  deleteComponent(compId) {
    this.components = this.components.filter(c => c.id !== compId);
    this.wires = this.wires.filter(w => !w.fromPin.startsWith(compId) && !w.toPin.startsWith(compId));
    this.selectedElement = null;
    this.hidePropertyCard();
    this.render();
    if (this.onCircuitChanged) this.onCircuitChanged(this.getCircuitData());
  }

  getCircuitData() {
    return {
      components: this.components,
      wires: this.wires
    };
  }
}
