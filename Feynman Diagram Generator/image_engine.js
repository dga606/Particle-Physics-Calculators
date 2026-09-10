/**
 * image_engine.js - Spatial Coordinate Solver with Arc Curving, MinVV/MinVL Relaxation, & Scaled SVG Renderer
 */
(function (global) {
  function dist(p1, p2) {
    if (!p1 || !p2) return Infinity;
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function getBezierPoint(a, c, b, t) {
    const invT = 1 - t;
    return {
      x: invT * invT * a.x + 2 * invT * t * c.x + t * t * b.x,
      y: invT * invT * a.y + 2 * invT * t * c.y + t * t * b.y
    };
  }

  function getBezierDerivative(a, c, b, t) {
    return {
      x: 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x),
      y: 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y)
    };
  }

  function getClosestPointOnSegment(p, a, b) {
    if (!p || !a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: a.x, y: a.y, dist: dist(p, a) };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return { x: projX, y: projY, t: t, dist: Math.hypot(p.x - projX, p.y - projY) };
  }

  function getClosestPointOnArc(p, a, c, b, samples = 20) {
    let minDist = Infinity;
    let bestPt = { x: a.x, y: a.y };
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pt = getBezierPoint(a, c, b, t);
      const d = dist(p, pt);
      if (d < minDist) {
        minDist = d;
        bestPt = pt;
      }
    }
    return { ...bestPt, dist: minDist };
  }

  /**
   * Assigns arc sagittas to parallel lines between the same endpoint pairs
   */
  function assignArcSagittas(diagram) {
    const groupMap = new Map();

    diagram.lines.forEach((line) => {
      const p1 = line.inPort;
      const p2 = line.outPort;
      if (!p1 || !p2) return;

      const id1 = p1.pos ? `${p1.pos.x}_${p1.pos.y}` : 'in';
      const id2 = p2.pos ? `${p2.pos.x}_${p2.pos.y}` : 'out';
      const pairKey = id1 < id2 ? `${id1}<->${id2}` : `${id2}<->${id1}`;

      if (!groupMap.has(pairKey)) groupMap.set(pairKey, []);
      groupMap.get(pairKey).push(line);
    });

    groupMap.forEach((lines) => {
      const count = lines.length;
      if (count === 1) {
        lines[0].sagitta = 0;
        return;
      }

      const p1 = lines[0].inPort.pos || { x: 0, y: 0 };
      const p2 = lines[0].outPort.pos || { x: 100, y: 0 };
      const chordLen = dist(p1, p2);
      const baseSagitta = Math.max(35, Math.min(75, chordLen * 0.35));

      if (count === 2) {
        // Simple 2-line loop (one curved above, one below)
        lines[0].sagitta = baseSagitta;
        lines[1].sagitta = -baseSagitta;
      } else if (count === 3) {
        // 3 lines: 1 straight, 2 curved above and below
        lines[0].sagitta = 0;
        lines[1].sagitta = baseSagitta;
        lines[2].sagitta = -baseSagitta;
      } else {
        // >= 4 lines: progressive multi-radii arcs
        const isOdd = count % 2 !== 0;
        let startIdx = 0;
        if (isOdd) {
          lines[0].sagitta = 0;
          startIdx = 1;
        }
        let step = 1;
        for (let i = startIdx; i < count; i += 2) {
          const s = baseSagitta * (1 + (step - 1) * 0.65);
          lines[i].sagitta = s;
          if (i + 1 < count) {
            lines[i + 1].sagitta = -s;
          }
          step++;
        }
      }
    });
  }

  function getLineControlPoint(line) {
    if (!line.inPos || !line.outPos) return null;
    const dx = line.outPos.x - line.inPos.x;
    const dy = line.outPos.y - line.inPos.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;

    const midX = (line.inPos.x + line.outPos.x) / 2;
    const midY = (line.inPos.y + line.outPos.y) / 2;
    const sagitta = line.sagitta || 0;

    return {
      x: midX + 2 * sagitta * nx,
      y: midY + 2 * sagitta * ny
    };
  }

  /**
   * Spatial Layout Solver with MinVV, MinVL, and multi-arc relaxation
   */
  function computeDiagramPositions(diagram, options = {}) {
    const minVV = Math.max(40, options.minVertexVertexDist !== undefined ? options.minVertexVertexDist : 70);
    const minVL = Math.max(20, options.minVertexLineDist !== undefined ? options.minVertexLineDist : 40);
    const originX = 70;
    const centerY = 140;
    const vGap = Math.max(minVV * 1.3, 70);

    const allNodes = [...diagram.inStates, ...diagram.vertices, ...diagram.outStates];

    // 1. Initial InStates Placement
    const inCount = diagram.inStates.length;
    const inStartY = centerY - ((inCount - 1) / 2) * vGap;
    diagram.inStates.forEach((is, idx) => {
      is.pos = { x: originX, y: inStartY + idx * vGap };
    });

    // 2. Vertex Topological Depth Calculation
    const depthMap = new Map();
    function getDepth(node, visited = new Set()) {
      if (!node || node instanceof global.InState) return 0;
      if (depthMap.has(node)) return depthMap.get(node);
      if (visited.has(node)) return 1;
      visited.add(node);

      let maxInDepth = 0;
      for (const l of (node.inLines || [])) {
        if (l.inPort) maxInDepth = Math.max(maxInDepth, getDepth(l.inPort, visited));
      }
      visited.delete(node);
      const d = maxInDepth + 1;
      depthMap.set(node, d);
      return d;
    }
    diagram.vertices.forEach(v => getDepth(v));

    // 3. Generous Initial Layer Spacing (Prevents dense clusters)
    const layerStep = Math.max(minVV * 1.7, 105);
    diagram.vertices.forEach(v => {
      const depth = depthMap.get(v) || 1;
      const targetX = originX + depth * layerStep;
      let sumY = 0, countY = 0;
      for (const inL of (v.inLines || [])) {
        if (inL.inPort && inL.inPort.pos) {
          sumY += inL.inPort.pos.y;
          countY++;
        }
      }
      const targetY = countY > 0 ? sumY / countY : centerY;
      v.pos = { x: targetX, y: targetY };
    });

    // 4. Initial OutStates Placement
    let maxVx = originX;
    for (const v of diagram.vertices) {
      if (v.pos && v.pos.x > maxVx) maxVx = v.pos.x;
    }
    const outX = Math.max(originX + 2 * layerStep, maxVx + layerStep);
    const outCount = diagram.outStates.length;
    const outStartY = centerY - ((outCount - 1) / 2) * vGap;

    diagram.outStates.forEach((os, idx) => {
      os.pos = { x: outX, y: outStartY + idx * vGap };
    });

    function syncLinePositions() {
      for (const line of diagram.lines) {
        if (line.inPort && line.inPort.pos) line.inPos = { ...line.inPort.pos };
        if (line.outPort && line.outPort.pos) line.outPos = { ...line.outPort.pos };
      }
    }
    syncLinePositions();
    assignArcSagittas(diagram);

    // 5. Relaxation Solver
    const maxIterations = 160;
    for (let iter = 0; iter < maxIterations; iter++) {
      let maxViolation = 0;

      // Constraint A: MinVV
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const n1 = allNodes[i];
          const n2 = allNodes[j];
          if (!n1.pos || !n2.pos) continue;

          const dx = n2.pos.x - n1.pos.x;
          const dy = n2.pos.y - n1.pos.y;
          const currentDist = Math.hypot(dx, dy);

          if (currentDist < minVV) {
            const violation = minVV - currentDist;
            if (violation > maxViolation) maxViolation = violation;

            const angle = currentDist > 0.001 ? Math.atan2(dy, dx) : (Math.PI / 2);
            const pushX = Math.cos(angle) * (violation / 2);
            const pushY = Math.sin(angle) * (violation / 2);

            const isFixed1 = n1 instanceof global.InState || n1 instanceof global.OutState;
            const isFixed2 = n2 instanceof global.InState || n2 instanceof global.OutState;

            if (!isFixed1) { n1.pos.x -= pushX * 0.8; n1.pos.y -= pushY; }
            else { n1.pos.y -= pushY * 1.5; }

            if (!isFixed2) { n2.pos.x += pushX * 0.8; n2.pos.y += pushY; }
            else { n2.pos.y += pushY * 1.5; }
          }
        }
      }

      syncLinePositions();

      // Constraint B: MinVL (Evaluated for straight lines and curved arcs)
      for (const node of allNodes) {
        if (!node.pos) continue;

        for (const line of diagram.lines) {
          if (!line.inPos || !line.outPos) continue;
          if (line.inPort === node || line.outPort === node) continue;

          let closest;
          if (!line.sagitta) {
            closest = getClosestPointOnSegment(node.pos, line.inPos, line.outPos);
          } else {
            const ctrl = getLineControlPoint(line);
            closest = getClosestPointOnArc(node.pos, line.inPos, ctrl, line.outPos, 20);
          }

          if (closest && closest.dist < minVL) {
            const violation = minVL - closest.dist;
            if (violation > maxViolation) maxViolation = violation;

            let nx = node.pos.x - closest.x;
            let ny = node.pos.y - closest.y;
            let nLen = Math.hypot(nx, ny);

            if (nLen < 0.001) {
              const segDx = line.outPos.x - line.inPos.x;
              const segDy = line.outPos.y - line.inPos.y;
              nx = -segDy;
              ny = segDx;
              nLen = Math.hypot(nx, ny) || 1;
            }

            const unitX = nx / nLen;
            const unitY = ny / nLen;
            const isFixed = node instanceof global.InState || node instanceof global.OutState;

            if (!isFixed) {
              node.pos.x += unitX * violation * 0.7;
              node.pos.y += unitY * violation * 0.9;
            } else {
              node.pos.y += (unitY >= 0 ? 1 : -1) * violation;
            }

            if (line.inPort instanceof global.Vertex) {
              line.inPort.pos.x -= unitX * violation * 0.25;
              line.inPort.pos.y -= unitY * violation * 0.35;
            }
            if (line.outPort instanceof global.Vertex) {
              line.outPort.pos.x -= unitX * violation * 0.25;
              line.outPort.pos.y -= unitY * violation * 0.35;
            }
          }
        }
      }

      // Preserve vertical ordering for boundary states
      for (let i = 0; i < diagram.inStates.length - 1; i++) {
        const is1 = diagram.inStates[i];
        const is2 = diagram.inStates[i + 1];
        if (is2.pos.y - is1.pos.y < minVV) {
          const diff = minVV - (is2.pos.y - is1.pos.y);
          is1.pos.y -= diff / 2;
          is2.pos.y += diff / 2;
        }
        is1.pos.x = originX;
        is2.pos.x = originX;
      }
      if (diagram.inStates.length === 1) diagram.inStates[0].pos.x = originX;

      for (let i = 0; i < diagram.outStates.length - 1; i++) {
        const os1 = diagram.outStates[i];
        const os2 = diagram.outStates[i + 1];
        if (os2.pos.y - os1.pos.y < minVV) {
          const diff = minVV - (os2.pos.y - os1.pos.y);
          os1.pos.y -= diff / 2;
          os2.pos.y += diff / 2;
        }
        os1.pos.x = outX;
        os2.pos.x = outX;
      }
      if (diagram.outStates.length === 1) diagram.outStates[0].pos.x = outX;

      diagram.vertices.forEach(v => {
        v.pos.x = Math.max(originX + minVV * 0.7, Math.min(outX - minVV * 0.7, v.pos.x));
      });

      syncLinePositions();
      if (maxViolation < 0.4) break;
    }

    allNodes.forEach(n => {
      if (n.pos) {
        n.pos.x = Math.round(n.pos.x);
        n.pos.y = Math.round(n.pos.y);
      }
    });
    syncLinePositions();
    assignArcSagittas(diagram);

    return diagram;
  }

  // --- SVG Path Generators Supporting Both Straight and Curved Lines ---

  function generatePhotonPath(a, c, b, sagitta = 0, amplitude = 5, wavelength = 12) {
    if (!sagitta) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const numCycles = Math.max(2, Math.round(L / wavelength));
      const totalSteps = numCycles * 24;
      let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`;
      for (let i = 1; i <= totalSteps; i++) {
        const t = i / totalSteps;
        const baseX = a.x + t * dx;
        const baseY = a.y + t * dy;
        const w = amplitude * Math.sin(2 * Math.PI * numCycles * t);
        const nx = -dy / L;
        const ny = dx / L;
        d += ` L ${(baseX + w * nx).toFixed(2)} ${(baseY + w * ny).toFixed(2)}`;
      }
      return d;
    }

    const chordLen = dist(a, b);
    const approxArcLen = Math.hypot(chordLen, sagitta * 2);
    const numCycles = Math.max(2, Math.round(approxArcLen / wavelength));
    const totalSteps = numCycles * 24;

    let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`;
    for (let i = 1; i <= totalSteps; i++) {
      const t = i / totalSteps;
      const pt = getBezierPoint(a, c, b, t);
      const deriv = getBezierDerivative(a, c, b, t);
      const dLen = Math.hypot(deriv.x, deriv.y) || 1;
      const nx = -deriv.y / dLen;
      const ny = deriv.x / dLen;
      const w = amplitude * Math.sin(2 * Math.PI * numCycles * t);
      d += ` L ${(pt.x + w * nx).toFixed(2)} ${(pt.y + w * ny).toFixed(2)}`;
    }
    return d;
  }

  function generateGluonPath(a, c, b, sagitta = 0, rx = 3.5, ry = 5.5, pitch = 11) {
    const chordLen = dist(a, b);
    const approxArcLen = sagitta ? Math.hypot(chordLen, sagitta * 2) : chordLen;
    const numLoops = Math.max(2, Math.round(approxArcLen / pitch));
    const totalSteps = numLoops * 20;

    let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`;
    for (let i = 1; i <= totalSteps; i++) {
      const t = i / totalSteps;
      const pt = sagitta ? getBezierPoint(a, c, b, t) : { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      const deriv = sagitta ? getBezierDerivative(a, c, b, t) : { x: b.x - a.x, y: b.y - a.y };
      const dLen = Math.hypot(deriv.x, deriv.y) || 1;
      const ux = deriv.x / dLen;
      const uy = deriv.y / dLen;
      const nx = -uy;
      const ny = ux;

      const angle = 2 * Math.PI * numLoops * t;
      const uDisp = -rx * Math.sin(angle);
      const vDisp = -ry * (1 - Math.cos(angle));

      const px = pt.x + uDisp * ux + vDisp * nx;
      const py = pt.y + uDisp * uy + vDisp * ny;
      d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    return d;
  }

  function generateZigZagPath(a, c, b, sagitta = 0, amplitude = 5, pitch = 8) {
    const chordLen = dist(a, b);
    const approxArcLen = sagitta ? Math.hypot(chordLen, sagitta * 2) : chordLen;
    const numPeaks = Math.max(4, Math.round(approxArcLen / pitch));

    let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`;
    for (let i = 1; i < numPeaks; i++) {
      const t = i / numPeaks;
      const pt = sagitta ? getBezierPoint(a, c, b, t) : { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      const deriv = sagitta ? getBezierDerivative(a, c, b, t) : { x: b.x - a.x, y: b.y - a.y };
      const dLen = Math.hypot(deriv.x, deriv.y) || 1;
      const nx = -deriv.y / dLen;
      const ny = deriv.x / dLen;

      const v = (i % 2 === 1 ? 1 : -1) * amplitude;
      d += ` L ${(pt.x + v * nx).toFixed(2)} ${(pt.y + v * ny).toFixed(2)}`;
    }
    d += ` L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    return d;
  }

  function getFermionArrowPolygon(midX, midY, angle, isAnti) {
    const arrowAngle = isAnti ? angle + Math.PI : angle;
    const cos = Math.cos(arrowAngle);
    const sin = Math.sin(arrowAngle);
    const tipLen = 5;
    const baseLen = 4;
    const halfWidth = 3.5;

    const p1x = midX + tipLen * cos;
    const p1y = midY + tipLen * sin;
    const p2x = midX - baseLen * cos - halfWidth * sin;
    const p2y = midY - baseLen * sin + halfWidth * cos;
    const p3x = midX - baseLen * cos + halfWidth * sin;
    const p3y = midY - baseLen * sin - halfWidth * cos;

    return `${p1x.toFixed(2)},${p1y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)} ${p3x.toFixed(2)},${p3y.toFixed(2)}`;
  }

  function renderDiagramSVG(diagram, options = {}) {
    const monochrome = !!options.monochrome;
    const showLabelBoxes = options.showLabelBoxes !== false;
    const lineColor = monochrome ? '#000' : null;
    const labelTextColor = monochrome ? '#000' : '#cbd5e1';
    const vertexFill = monochrome ? '#000' : '#f43f5e';
    const boundaryInFill = monochrome ? '#000' : '#10b981';
    const boundaryOutFill = monochrome ? '#000' : '#06b6d4';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const allNodes = [...diagram.inStates, ...diagram.vertices, ...diagram.outStates];

    allNodes.forEach(n => {
      if (n.pos) {
        minX = Math.min(minX, n.pos.x);
        minY = Math.min(minY, n.pos.y);
        maxX = Math.max(maxX, n.pos.x);
        maxY = Math.max(maxY, n.pos.y);
      }
    });

    // Factor in control points of curved arcs into viewBox
    diagram.lines.forEach(l => {
      if (l.sagitta) {
        const ctrl = getLineControlPoint(l);
        if (ctrl) {
          minX = Math.min(minX, ctrl.x);
          minY = Math.min(minY, ctrl.y);
          maxX = Math.max(maxX, ctrl.x);
          maxY = Math.max(maxY, ctrl.y);
        }
      }
    });

    if (minX === Infinity) { minX = 0; maxX = 300; minY = 0; maxY = 200; }
    const pad = 45;
    const viewBoxX = minX - pad;
    const viewBoxY = minY - pad;
    const viewBoxWidth = Math.max(300, (maxX - minX) + pad * 2);
    const viewBoxHeight = Math.max(200, (maxY - minY) + pad * 2);

    const svgElements = [];

    // 1. Draw Lines & Arcs
    diagram.lines.forEach((line) => {
      if (!line.inPos || !line.outPos) return;
      const a = line.inPos;
      const b = line.outPos;
      const sagitta = line.sagitta || 0;
      const ctrl = getLineControlPoint(line);

      const pId = line.particle.id.toLowerCase();
      const isPhoton = pId === 'gamma' || pId === 'photon' || pId === 'a' || pId === 'y';
      const isGluon = pId === 'gluon' || pId === 'g' || line.particle.hasCategory('qcd_boson') || line.particle.hasCategory('gluons');
      const isWeak = pId === 'w+' || pId === 'w-' || pId === 'z0' || pId === 'z' || line.particle.hasCategory('charged_boson') || line.particle.hasCategory('neutral_boson');
      const isHiggs = pId === 'h0' || pId === 'h' || pId === 'higgs' || line.particle.hasCategory('scalar_boson') || line.particle.hasCategory('higgs_sector');

      let edgeSvg = '';
      if (isPhoton) {
        const pathData = generatePhotonPath(a, ctrl, b, sagitta);
        edgeSvg = `<path d="${pathData}" fill="none" stroke="${lineColor || "#fbbf24"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      } else if (isGluon) {
        const pathData = generateGluonPath(a, ctrl, b, sagitta);
        edgeSvg = `<path d="${pathData}" fill="none" stroke="${lineColor || "#34d399"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      } else if (isWeak) {
        const pathData = generateZigZagPath(a, ctrl, b, sagitta);
        edgeSvg = `<path d="${pathData}" fill="none" stroke="${lineColor || "#f59e0b"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      } else if (isHiggs) {
        if (!sagitta) {
          edgeSvg = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${lineColor || "#c084fc"}" stroke-width="2" stroke-dasharray="6,4" stroke-linecap="round"/>`;
        } else {
          edgeSvg = `<path d="M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}" fill="none" stroke="${lineColor || "#c084fc"}" stroke-width="2" stroke-dasharray="6,4" stroke-linecap="round"/>`;
        }
      } else {
        // Fermion (Solid line or arc with tangent arrow)
        const midPt = sagitta ? getBezierPoint(a, ctrl, b, 0.5) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const deriv = sagitta ? getBezierDerivative(a, ctrl, b, 0.5) : { x: b.x - a.x, y: b.y - a.y };
        const angle = Math.atan2(deriv.y, deriv.x);
        const isAnti = line.particleType === 'antiparticle';

        let arrowSvg = '';
        if (!line.particle.isSelfConjugate) {
          const arrowPoints = getFermionArrowPolygon(midPt.x, midPt.y, angle, isAnti);
          arrowSvg = `<polygon points="${arrowPoints}" fill="${lineColor || "#60a5fa"}" />`;
        }

        if (!sagitta) {
          edgeSvg = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${lineColor || "#60a5fa"}" stroke-width="2" stroke-linecap="round"/>${arrowSvg}`;
        } else {
          edgeSvg = `<path d="M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}" fill="none" stroke="${lineColor || "#60a5fa"}" stroke-width="2" stroke-linecap="round"/>${arrowSvg}`;
        }
      }

      svgElements.push(edgeSvg);

      // Midpoint Particle Label
      const midPt = sagitta ? getBezierPoint(a, ctrl, b, 0.5) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const deriv = sagitta ? getBezierDerivative(a, ctrl, b, 0.5) : { x: b.x - a.x, y: b.y - a.y };
      const dLen = Math.hypot(deriv.x, deriv.y) || 1;
      const nx = -deriv.y / dLen;
      const ny = deriv.x / dLen;
      const labelOffset = sagitta !== 0 ? (sagitta > 0 ? 14 : -14) : -14;

      const lx = midPt.x + labelOffset * nx;
      const ly = midPt.y + labelOffset * ny;
      const sym = line.particle.symbol || line.particle.id;
      const labelWidth = Math.max(22, sym.length * 8 + 10);

      svgElements.push(`
        <g class="diagram-particle-label" data-line-index="${line.index ?? diagram.lines.indexOf(line)}" transform="translate(${lx}, ${ly})">
          ${showLabelBoxes ? `<rect x="${-labelWidth / 2}" y="-8" width="${labelWidth}" height="16" rx="4" fill="${monochrome ? "#fff" : "#090d16"}" stroke="${monochrome ? "#000" : "#1e293b"}" stroke-width="1"/>` : ''}
          <text x="0" y="0" fill="${labelTextColor}" font-family="'Fira Code', monospace" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="central">${sym}</text>
        </g>
      `);
    });

    // 2. Draw Vertices
    diagram.vertices.forEach((v) => {
      if (!v.pos) return;
      svgElements.push(`
        <circle cx="${v.pos.x}" cy="${v.pos.y}" r="5" fill="${vertexFill}" stroke="${monochrome ? "#000" : "#020617"}" stroke-width="2"/>
      `);
    });

    // 3. Draw InStates (dot larger than the vertex dot)
    diagram.inStates.forEach((is) => {
      if (!is.pos) return;
      svgElements.push(`
        <circle cx="${is.pos.x}" cy="${is.pos.y}" r="6.5" fill="${boundaryInFill}" stroke="${monochrome ? "#000" : "#020617"}" stroke-width="2"/>
      `);
    });

    // 4. Draw OutStates (dot larger than the vertex dot)
    diagram.outStates.forEach((os) => {
      if (!os.pos) return;
      svgElements.push(`
        <circle cx="${os.pos.x}" cy="${os.pos.y}" r="6.5" fill="${boundaryOutFill}" stroke="${monochrome ? "#000" : "#020617"}" stroke-width="2"/>
      `);
    });

    return `
      <svg viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" 
           preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg" 
           class="w-full h-full max-h-[360px] select-none">
        ${svgElements.join('\n')}
      </svg>
    `;
  }

  /**
   * Stores the minimum non-circular particle identity needed to recreate a line.
   * The full Particle object is intentionally NOT stored because it points to its
   * antiparticle and would create circular data.
   */
  function extractParticleInfo(p) {
    if (!p) return null;
    return {
      id: p.id || '',
      name: p.name || p.id || '',
      symbol: p.symbol || p.name || p.id || '',
      matterType: p.matterType || 'particle' // 'particle', 'antiparticle', or 'both'
    };
  }

  /**
   * Captures all diagram geometry, positions, vertices, and lines without circular refs
   */
  function extractDiagramData(diag) {
    const inStates = (diag.inStates || []).map((is, idx) => ({
      index: idx,
      type: 'inState',
      particle: extractParticleInfo(is.particle),
      pos: is.pos ? { x: is.pos.x, y: is.pos.y } : null
    }));

    const outStates = (diag.outStates || []).map((os, idx) => ({
      index: idx,
      type: 'outState',
      particle: extractParticleInfo(os.particle),
      pos: os.pos ? { x: os.pos.x, y: os.pos.y } : null
    }));

    const vertices = (diag.vertices || []).map((v, idx) => ({
      index: idx,
      type: 'vertex',
      pos: v.pos ? { x: v.pos.x, y: v.pos.y } : null,
      order: v.type && v.type.order ? { ...v.type.order } : {}
    }));

    const lines = (diag.lines || []).map((l, idx) => {
      let inPortRef = null;
      if (l.inPort) {
        const inIdx = diag.inStates.indexOf(l.inPort);
        if (inIdx !== -1) {
          inPortRef = { type: 'inState', index: inIdx };
        } else {
          const vIdx = diag.vertices.indexOf(l.inPort);
          if (vIdx !== -1) inPortRef = { type: 'vertex', index: vIdx };
        }
      }

      let outPortRef = null;
      if (l.outPort) {
        const outIdx = diag.outStates.indexOf(l.outPort);
        if (outIdx !== -1) {
          outPortRef = { type: 'outState', index: outIdx };
        } else {
          const vIdx = diag.vertices.indexOf(l.outPort);
          if (vIdx !== -1) outPortRef = { type: 'vertex', index: vIdx };
        }
      }

      return {
        index: idx,
        particle: extractParticleInfo(l.particle),
        particleType: l.particleType || (l.particle ? l.particle.matterType : 'particle'),
        shape: l.shape || 'straight',
        sagitta: l.sagitta || 0,
        inPos: l.inPos ? { x: l.inPos.x, y: l.inPos.y } : null,
        outPos: l.outPos ? { x: l.outPos.x, y: l.outPos.y } : null,
        inPort: inPortRef,
        outPort: outPortRef
      };
    });

    return {
      order: { ...(diag.order || {}) },
      totalOrder: diag.totalOrder || 0,
      noOfLoops: diag.noOfLoops || 0,
      inStates,
      outStates,
      vertices,
      lines
    };
  }

  function renderDiagramToContainer(gridElement, exactOrder, diagramIndex, diag) {
    computeDiagramPositions(diag);

    const visualSvg = renderDiagramSVG(diag);
    const diagramData = extractDiagramData(diag);
    const serializedJson = JSON.stringify(diagramData);

    // Format individual coupling orders (e.g. "QED: 2, EW: 1")
    const couplingEntries = Object.entries(diag.order || {}).filter(([_, val]) => (val || 0) > 0);
    const couplingBadges = couplingEntries.length > 0
      ? couplingEntries.map(([th, val]) => `<span class="text-amber-300">${th}: ${val}</span>`).join('<span class="text-slate-600">, </span>')
      : '<span class="text-slate-500">Order 0</span>';

    const card = document.createElement('div');
    card.className = 'diagram-card bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3 flex flex-col justify-between cursor-pointer hover:border-slate-600 transition-colors';
    card.id = `diagram-card-${diagramIndex}`;
    card.title = 'Open diagram in a new tab';

    // Direct in-memory attachment
    card._diagramData = diagramData;

    card.innerHTML = `
      <!-- Hidden Diagram Data Block (Not displayed on screen) -->
      <template class="diagram-data" style="display: none;">${serializedJson}</template>

      <div class="space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono-code flex-wrap gap-2">
          <span class="font-bold text-slate-100">Diagram #${diagramIndex}</span>
          <div class="flex items-center gap-2 text-slate-400 flex-wrap text-[11px]">
            <span>Loops: ${diag.noOfLoops}</span>
            <span class="text-slate-600">|</span>
            <span>Total: ${diag.totalOrder}</span>
            <span class="text-slate-600">|</span>
            <span>(${couplingBadges})</span>
          </div>
        </div>

        <!-- SVG Diagram Visual Canvas -->
        <div class="w-full aspect-[16/10] bg-slate-950 rounded-xl border border-slate-800/80 p-2 flex items-center justify-center overflow-hidden">
          ${visualSvg}
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      if (typeof global.openDiagramEditor === 'function') {
        global.openDiagramEditor(diagramData);
      }
    });

    gridElement.appendChild(card);
  }

  const ImageEngine = {
    dist,
    getClosestPointOnSegment,
    getClosestPointOnArc,
    getLineControlPoint,
    computeDiagramPositions,
    renderDiagramSVG,
    renderDiagramToContainer
  };

  global.ImageEngine = ImageEngine;
})(typeof window !== 'undefined' ? window : globalThis);
