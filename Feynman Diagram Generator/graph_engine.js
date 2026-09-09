/**
 * graph_engine.js - Asynchronous Non-Blocking Feynman Diagram Generator
 */
(function (global) {
  const Particles = global.Particles;
  const theoryVertices = global.theoryVertices;
  const getVertexConfigurations = global.getVertexConfigurations;

  class InState {
    constructor(particle) {
      this.particle = particle;
      this.pos = null;
    }
  }

  class OutState {
    constructor(particle) {
      this.particle = particle;
      this.pos = null;
    }
  }

  class Lines {
    constructor(particle, inPort = null, outPort = null, shape = 'straight') {
      this.particle = particle;
      this.particleType = particle ? particle.matterType : 'particle';
      this.inPort = inPort;
      this.outPort = outPort;
      this.shape = shape;
      this.sagitta = 0;
      this.inPos = null;
      this.outPos = null;
    }
  }

  class Vertex {
    constructor(type, inLines = []) {
      this.type = type;
      this.inLines = [...inLines];
      this.outLines = [];
      this.pos = null;
    }
    generateOutLines() {
      this.outLines = (this.type.out || []).map(p => new Lines(p, this, null, 'straight'));
      return this.outLines;
    }
  }

  class Diagram {
    constructor() {
      this.inStates = [];
      this.outStates = [];
      this.vertices = [];
      this.lines = [];
      this.order = {};
      this.noOfLoops = 0;
      this.openLines = [];
      this.unmatchedOutStates = [];
    }

    get totalOrder() {
      return Object.values(this.order).reduce((acc, val) => acc + (val || 0), 0);
    }

    clone() {
      const copy = new Diagram();
      copy.order = { ...this.order };
      copy.noOfLoops = this.noOfLoops;
      const inStateMap = new Map();
      const outStateMap = new Map();
      const vertexMap = new Map();
      const lineMap = new Map();

      copy.inStates = this.inStates.map(is => {
        const c = new InState(is.particle);
        c.pos = is.pos ? { ...is.pos } : null;
        inStateMap.set(is, c);
        return c;
      });

      copy.outStates = this.outStates.map(os => {
        const c = new OutState(os.particle);
        c.pos = os.pos ? { ...os.pos } : null;
        outStateMap.set(os, c);
        return c;
      });

      copy.vertices = this.vertices.map(v => {
        const c = new Vertex(v.type, []);
        c.pos = v.pos ? { ...v.pos } : null;
        vertexMap.set(v, c);
        return c;
      });

      copy.lines = this.lines.map(l => {
        const c = new Lines(l.particle, null, null, l.shape);
        c.particleType = l.particleType;
        c.sagitta = l.sagitta || 0;
        c.inPos = l.inPos ? { ...l.inPos } : null;
        c.outPos = l.outPos ? { ...l.outPos } : null;
        lineMap.set(l, c);
        return c;
      });

      for (let i = 0; i < this.vertices.length; i++) {
        copy.vertices[i].inLines = this.vertices[i].inLines.map(l => lineMap.get(l)).filter(Boolean);
        copy.vertices[i].outLines = this.vertices[i].outLines.map(l => lineMap.get(l)).filter(Boolean);
      }

      for (let i = 0; i < this.lines.length; i++) {
        const origL = this.lines[i];
        const copyL = copy.lines[i];
        if (origL.inPort instanceof InState) copyL.inPort = inStateMap.get(origL.inPort);
        else if (origL.inPort instanceof Vertex) copyL.inPort = vertexMap.get(origL.inPort);
        if (origL.outPort instanceof OutState) copyL.outPort = outStateMap.get(origL.outPort);
        else if (origL.outPort instanceof Vertex) copyL.outPort = vertexMap.get(origL.outPort);
      }
      return copy;
    }
  }

  function hasTadpole(diagram) {
    for (const l of diagram.lines) {
      if (l.inPort instanceof Vertex && l.outPort instanceof Vertex && l.inPort === l.outPort) return true;
    }
    for (const v of diagram.vertices) {
      const hasExternal = v.inLines.some(l => l.inPort instanceof InState) || v.outLines.some(l => l.outPort instanceof OutState);
      if (!hasExternal && v.inLines.length === 1 && v.outLines.length === 1 && v.inLines[0].inPort === v && v.outLines[0].outPort === v) return true;
    }
    return false;
  }

  function isConnected(diagram) {
    // Test connectivity as a SINGLE undirected component.
    // The old implementation seeded the traversal with every incoming state,
    // which incorrectly made separate incoming->...->outgoing components look
    // connected. It also accepted multi-line order-0 diagrams as connected.
    const allNodes = [...diagram.inStates, ...diagram.vertices, ...diagram.outStates];
    if (allNodes.length === 0) return true;

    const visitedNodes = new Set([allNodes[0]]);
    const visitedLines = new Set();
    const queue = [allNodes[0]];

    while (queue.length > 0) {
      const curr = queue.shift();

      for (const line of diagram.lines) {
        if (line.inPort !== curr && line.outPort !== curr) continue;

        visitedLines.add(line);

        // Treat every propagator as an undirected edge for topology testing.
        const other = line.inPort === curr ? line.outPort : line.inPort;
        if (other && !visitedNodes.has(other)) {
          visitedNodes.add(other);
          queue.push(other);
        }
      }
    }

    return visitedNodes.size === allNodes.length &&
           visitedLines.size === diagram.lines.length;
  }

  function getCanonicalSignature(diagram) {
    const nodeIndexMap = new Map();
    diagram.inStates.forEach((is, idx) => nodeIndexMap.set(is, `IN_${idx}_${is.particle.id}`));
    diagram.outStates.forEach((os, idx) => nodeIndexMap.set(os, `OUT_${idx}_${os.particle.id}`));
    const vertexSignatures = diagram.vertices.map(v => {
      const inPart = v.inLines.map(l => l.particle.id).sort().join(',');
      const outPart = v.outLines.map(l => l.particle.id).sort().join(',');
      const ord = Object.entries(v.type.order || {}).map(([k, val]) => `${k}:${val}`).sort().join(';');
      return { v, sig: `V[${ord}|IN:${inPart}|OUT:${outPart}]` };
    });
    vertexSignatures.sort((a, b) => a.sig.localeCompare(b.sig)).forEach((item, idx) => nodeIndexMap.set(item.v, `V_${idx}_${item.sig}`));
    return diagram.lines.map(l => `(${nodeIndexMap.get(l.inPort) || 'NONE'}->${nodeIndexMap.get(l.outPort) || 'NONE'}:${l.particle.id})`).sort().join('|');
  }

  function normalizeTheoryName(name) {
    const low = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (low === 'electroweak' || low === 'ew') return 'EW';
    if (low === 'qed') return 'QED';
    if (low === 'qcd') return 'QCD';
    if (low === 'higgs') return 'Higgs';
    return name;
  }

  function sameParticles(listA, listB) {
    if (listA.length !== listB.length) return false;
    const idsA = listA.map(p => (p && p.id ? p.id : p)).sort();
    const idsB = listB.map(p => (p && p.id ? p.id : p)).sort();
    return idsA.every((id, i) => id === idsB[i]);
  }

  /**
   * Asynchronous backtracking with periodic event loop yields
   */
  async function searchDiagramsForExactTotalOrder({
    targetTotalOrder, allowedVertexConfigs, budget, inStates, outStates,
    maxLoops, noTadpoles, allowDisconnected, seenSignatures, abortToken
  }) {
    const orderResults = [];
    const rootDiagram = new Diagram();
    rootDiagram.inStates = [...inStates];
    rootDiagram.outStates = [...outStates];
    rootDiagram.unmatchedOutStates = [...outStates];

    for (const is of inStates) {
      const line = new Lines(is.particle, is, null, 'straight');
      rootDiagram.lines.push(line);
      rootDiagram.openLines.push(line);
    }

    let searchSteps = 0;

    async function backtrack(diag) {
      if (abortToken && abortToken.aborted) return;
      if (diag.vertices.length > 12) return;

      // Yield control every 350 steps so the browser never hangs
      if (++searchSteps % 350 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const currentTotalOrder = diag.totalOrder;
      if (currentTotalOrder > targetTotalOrder) return;

      // Invariant Pruning: Fermion Parity
      let openFermions = 0;
      for (let i = 0; i < diag.openLines.length; i++) {
        if (diag.openLines[i].particle.isFermion) openFermions++;
      }
      let outFermions = 0;
      for (let i = 0; i < diag.unmatchedOutStates.length; i++) {
        if (diag.unmatchedOutStates[i].particle.isFermion) outFermions++;
      }
      if ((openFermions + outFermions) % 2 !== 0) return;

      if (diag.openLines.length === 0) {
        if (diag.unmatchedOutStates.length === 0 && currentTotalOrder === targetTotalOrder) {
          if (noTadpoles && hasTadpole(diag)) return;
          // Hard gate: disconnected diagrams are excluded unless explicitly enabled.
          if (allowDisconnected !== true && !isConnected(diag)) return;

          const numIntEdges = diag.lines.filter(l => l.inPort instanceof Vertex && l.outPort instanceof Vertex).length;
          const exactLoops = diag.vertices.length > 0 ? Math.max(0, numIntEdges - diag.vertices.length + 1) : 0;
          if (exactLoops > maxLoops) return;

          diag.noOfLoops = exactLoops;
          const sig = getCanonicalSignature(diag);
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            orderResults.push(diag.clone());
          }
        }
        return;
      }

      const currentLine = diag.openLines[0];

      // Branch 1: Match directly to an open OutState (Order delta = 0)
      const triedOutIds = new Set();
      for (let i = 0; i < diag.unmatchedOutStates.length; i++) {
        const os = diag.unmatchedOutStates[i];
        if (os.particle.id === currentLine.particle.id && !triedOutIds.has(os.particle.id)) {
          triedOutIds.add(os.particle.id);
          currentLine.outPort = os;
          diag.openLines.splice(0, 1);
          diag.unmatchedOutStates.splice(i, 1);

          await backtrack(diag);

          diag.unmatchedOutStates.splice(i, 0, os);
          diag.openLines.splice(0, 0, currentLine);
          currentLine.outPort = null;
        }
      }

      // Branch 2: Connect via an interaction vertex (Order delta >= 1)
      if (currentTotalOrder >= targetTotalOrder) return;

      const otherOpenLines = diag.openLines.slice(1);
      const candidateSubsets = [[currentLine]];
      for (let i = 0; i < otherOpenLines.length; i++) {
        candidateSubsets.push([currentLine, otherOpenLines[i]]);
        for (let j = i + 1; j < otherOpenLines.length; j++) {
          candidateSubsets.push([currentLine, otherOpenLines[i], otherOpenLines[j]]);
        }
      }

      for (const subset of candidateSubsets) {
        const inParticles = subset.map(l => l.particle);

        for (const vType of allowedVertexConfigs) {
          if (!sameParticles(vType.in, inParticles)) continue;

          const vOrderSum = Object.values(vType.order || {}).reduce((a, b) => a + (b || 0), 0);
          if (currentTotalOrder + vOrderSum > targetTotalOrder) continue;

          let budgetExceeded = false;
          const nextOrder = { ...diag.order };
          for (const [th, val] of Object.entries(vType.order || {})) {
            const normKey = normalizeTheoryName(th);
            nextOrder[normKey] = (nextOrder[normKey] || 0) + val;
            if (nextOrder[normKey] > (budget[normKey] !== undefined ? budget[normKey] : Infinity)) {
              budgetExceeded = true;
              break;
            }
          }
          if (budgetExceeded) continue;

          const vertex = new Vertex(vType, subset);
          const newOutLines = vertex.generateOutLines();
          for (const l of subset) l.outPort = vertex;

          const prevOrder = { ...diag.order };
          diag.order = nextOrder;
          diag.vertices.push(vertex);
          diag.lines.push(...newOutLines);

          const prevOpenLines = [...diag.openLines];
          diag.openLines = diag.openLines.filter(l => !subset.includes(l));
          diag.openLines.push(...newOutLines);

          await backtrack(diag);

          diag.openLines = prevOpenLines;
          diag.lines.splice(diag.lines.length - newOutLines.length, newOutLines.length);
          diag.vertices.pop();
          diag.order = prevOrder;
          for (const l of subset) l.outPort = null;
        }
      }
    }

    await backtrack(rootDiagram);
    return orderResults;
  }

  async function generateGraphsForOrder(inStates, outStates, exactOrder, maxOrder = {}, maxLoops = 0, options = {}, abortToken = { aborted: false }) {
    const budget = {};
    for (const [k, v] of Object.entries(maxOrder)) {
      budget[normalizeTheoryName(k)] = Math.max(0, parseInt(v, 10) || 0);
    }

    const isTheoryAllowed = (order) => {
      for (const [th, val] of Object.entries(order || {})) {
        if (val > 0 && budget[normalizeTheoryName(th)] === 0) return false;
      }
      return true;
    };

    const customListsMap = {};
    (options.customLists || []).forEach(l => {
      customListsMap[l.id] = l;
      customListsMap[l.name] = l;
    });

    const allowedVertexConfigs = [];
    ['qed', 'qcd', 'ew', 'higgs'].forEach(th => {
      (theoryVertices[th] || []).forEach(basic => {
        getVertexConfigurations(basic, options.blacklist || [], customListsMap).forEach(cfg => {
          if (isTheoryAllowed(cfg.order)) allowedVertexConfigs.push(cfg);
        });
      });
    });

    (options.customVertices || []).forEach(custV => {
      const orderObj = {};
      for (const [ck, cv] of Object.entries(custV.couplingOrders || {})) {
        orderObj[normalizeTheoryName(ck)] = cv;
      }
      const template = {
        in: (custV.incoming || []).map(p => p.isList ? p : (Particles.get(p.id) || p)),
        out: (custV.outgoing || []).map(p => p.isList ? p : (Particles.get(p.id) || p)),
        order: orderObj
      };
      getVertexConfigurations(template, options.blacklist || [], customListsMap).forEach(cfg => {
        if (isTheoryAllowed(cfg.order)) allowedVertexConfigs.push(cfg);
      });
    });

    const seenSignatures = new Set();
    return await searchDiagramsForExactTotalOrder({
      targetTotalOrder: exactOrder,
      allowedVertexConfigs,
      budget,
      inStates,
      outStates,
      maxLoops,
      noTadpoles: options.noTadpoles !== false,
      allowDisconnected: options.allowDisconnected === true,
      seenSignatures,
      abortToken
    });
  }

  const GraphEngine = {
    InState, OutState, Lines, Vertex, Diagram,
    generateGraphsForOrder, hasTadpole, isConnected, getCanonicalSignature
  };

  global.InState = InState;
  global.OutState = OutState;
  global.Lines = Lines;
  global.Vertex = Vertex;
  global.Diagram = Diagram;
  global.generateGraphsForOrder = generateGraphsForOrder;
  global.GraphEngine = GraphEngine;
})(typeof window !== 'undefined' ? window : globalThis);
