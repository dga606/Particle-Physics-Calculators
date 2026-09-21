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
      this._nid = -1;
    }
  }

  class OutState {
    constructor(particle) {
      this.particle = particle;
      this.pos = null;
      this._nid = -1;
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
    constructor(type, inLines = [], sympy_data = {}) {
      this.type = type;
      this.inLines = [...inLines];
      this.outLines = [];
      this.pos = null;
      this._nid = -1;
      this.sympy_data = (sympy_data && typeof sympy_data === 'object' && !Array.isArray(sympy_data))
        ? { ...sympy_data }
        : ((type && type.sympy_data && typeof type.sympy_data === 'object') ? { ...type.sympy_data } : {});
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
      this.totalOrderVal = 0;
      this.noOfLoops = 0;
      this.openLines = [];
      this.unmatchedOutStates = [];
    }

    get totalOrder() {
      return this.totalOrderVal;
    }

    clone() {
      const copy = new Diagram();
      copy.order = { ...this.order };
      copy.totalOrderVal = this.totalOrderVal;
      copy.noOfLoops = this.noOfLoops;
      const inStateMap = new Map();
      const outStateMap = new Map();
      const vertexMap = new Map();
      const lineMap = new Map();

      copy.inStates = this.inStates.map(is => {
        const c = new InState(is.particle);
        c.pos = is.pos ? { ...is.pos } : null;
        c._nid = is._nid;
        inStateMap.set(is, c);
        return c;
      });

      copy.outStates = this.outStates.map(os => {
        const c = new OutState(os.particle);
        c.pos = os.pos ? { ...os.pos } : null;
        c._nid = os._nid;
        outStateMap.set(os, c);
        return c;
      });

      copy.vertices = this.vertices.map(v => {
        const c = new Vertex(v.type, [], { ...(v.sympy_data || {}) });
        c.pos = v.pos ? { ...v.pos } : null;
        c._nid = v._nid;
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
    for (let i = 0; i < diagram.lines.length; i++) {
      const l = diagram.lines[i];
      if (l.inPort && l.outPort && l.inPort === l.outPort && l.inPort instanceof Vertex) return true;
    }
    return false;
  }

  function isConnected(diagram) {
    const allNodes = [...diagram.inStates, ...diagram.vertices, ...diagram.outStates];
    if (allNodes.length <= 1) return true;

    const visitedNodes = new Set([allNodes[0]]);
    const visitedLines = new Set();
    const queue = [allNodes[0]];

    while (queue.length > 0) {
      const curr = queue.shift();

      for (let i = 0; i < diagram.lines.length; i++) {
        const line = diagram.lines[i];
        if (line.inPort !== curr && line.outPort !== curr) continue;

        visitedLines.add(line);
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

  function particleSignature(list) {
    if (!list || list.length === 0) return '';
    if (list.length === 1) {
      const p = list[0];
      return p && p.id ? p.id : String(p);
    }
    return list.map(p => (p && p.id ? p.id : String(p))).sort().join(',');
  }

  // Fast integer-indexed disjoint set union for exact cyclomatic number E - N + C
  function getPartialGraphLoopRank(diag) {
    const totalNodes = diag.inStates.length + diag.outStates.length + diag.vertices.length;
    if (totalNodes === 0) return 0;

    const parent = new Int32Array(totalNodes);
    for (let i = 0; i < totalNodes; i++) parent[i] = i;

    function find(i) {
      let r = i;
      while (parent[r] !== r) r = parent[r];
      let curr = i;
      while (curr !== r) {
        let nxt = parent[curr];
        parent[curr] = r;
        curr = nxt;
      }
      return r;
    }

    let cycles = 0;
    for (let i = 0; i < diag.lines.length; i++) {
      const l = diag.lines[i];
      if (!l.inPort || !l.outPort) continue;
      const u = l.inPort._nid;
      const v = l.outPort._nid;
      if (u < 0 || v < 0) continue;
      const ru = find(u);
      const rv = find(v);
      if (ru === rv) {
        cycles++;
      } else {
        parent[ru] = rv;
      }
    }
    return cycles;
  }

  // High-performance compact signature avoiding Map/Set/Object allocations
  function getDiagramTopologySignature(diag) {
    const edgeStrs = new Array(diag.lines.length);
    for (let i = 0; i < diag.lines.length; i++) {
      const l = diag.lines[i];
      const inId = l.inPort ? l.inPort._nid : -1;
      const outId = l.outPort ? l.outPort._nid : -1;
      const pid = l.particle ? l.particle.id : '?';
      edgeStrs[i] = `${inId}>${outId}:${pid}`;
    }
    edgeStrs.sort();

    const unmatched = new Array(diag.unmatchedOutStates.length);
    for (let i = 0; i < diag.unmatchedOutStates.length; i++) {
      unmatched[i] = diag.unmatchedOutStates[i]._nid;
    }
    unmatched.sort();

    return `${edgeStrs.join(';')}|U:${unmatched.join(',')}`;
  }

  async function searchDiagramsForExactTotalOrder({
    targetTotalOrder, allowedVertexConfigs, budget, inStates, outStates,
    maxLoops, noTadpoles, allowDisconnected, seenSignatures, abortToken
  }) {
    const orderResults = [];
    const rootDiagram = new Diagram();
    rootDiagram.inStates = [...inStates];
    rootDiagram.outStates = [...outStates];
    rootDiagram.unmatchedOutStates = [...outStates];

    // Assign continuous integer node IDs for fast array-indexed DSU and topology
    let nidCounter = 0;
    for (const is of inStates) {
      is._nid = nidCounter++;
      const line = new Lines(is.particle, is, null, 'straight');
      rootDiagram.lines.push(line);
      rootDiagram.openLines.push(line);
    }
    for (const os of outStates) {
      os._nid = nidCounter++;
    }

    const vertexConfigs = allowedVertexConfigs.filter(v =>
      Array.isArray(v && v.in) && Array.isArray(v && v.out) &&
      v.in.length > 0 && v.out.length > 0 &&
      Object.values(v.order || {}).reduce((a, b) => a + (Number(b) || 0), 0) > 0
    );

    const configsByInSignature = new Map();
    const arities = new Set();
    for (const v of vertexConfigs) {
      // Pre-calculate orders and normalized coupling entries to eliminate Object.entries inside backtrack
      v._totalOrder = Object.values(v.order || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      v._orderEntries = Object.entries(v.order || {}).map(([th, val]) => [normalizeTheoryName(th), Number(val) || 0]);

      const sig = particleSignature(v.in);
      if (!configsByInSignature.has(sig)) configsByInSignature.set(sig, []);
      configsByInSignature.get(sig).push(v);
      arities.add(v.in.length);
    }
    const sortedArities = [...arities].sort((a, b) => a - b);

    const seenPartialStates = new Set();
    let searchSteps = 0;
    let lastYieldTime = performance.now();

    async function backtrack(diag) {
      if (abortToken && abortToken.aborted) return;
      searchSteps++;

      // Adaptive time-budget yield (prevents UI freeze while running at maximum CPU throughput)
      if ((searchSteps & 1023) === 0) {
        const now = performance.now();
        if (now - lastYieldTime > 20) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYieldTime = performance.now();
        }
      }

      const currentTotalOrder = diag.totalOrderVal;
      if (currentTotalOrder > targetTotalOrder) return;
      if (getPartialGraphLoopRank(diag) > maxLoops) return;

      const partialSig = getDiagramTopologySignature(diag);
      if (seenPartialStates.has(partialSig)) return;
      seenPartialStates.add(partialSig);

      if (diag.openLines.length === 0) {
        if (diag.unmatchedOutStates.length === 0 && currentTotalOrder === targetTotalOrder) {
          if (noTadpoles && hasTadpole(diag)) return;
          if (allowDisconnected !== true && !isConnected(diag)) return;

          const exactLoops = getPartialGraphLoopRank(diag);
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

      // Branch 1: resolve open line to compatible OutState
      for (const line of [...diag.openLines]) {
        const matchingStates = diag.unmatchedOutStates.filter(os =>
          os.particle && line.particle && os.particle.id === line.particle.id
        );
        for (const os of matchingStates) {
          const lineIndex = diag.openLines.indexOf(line);
          const outIndex = diag.unmatchedOutStates.indexOf(os);
          if (lineIndex < 0 || outIndex < 0) continue;
          line.outPort = os;
          diag.openLines.splice(lineIndex, 1);
          diag.unmatchedOutStates.splice(outIndex, 1);
          await backtrack(diag);
          diag.unmatchedOutStates.splice(outIndex, 0, os);
          diag.openLines.splice(lineIndex, 0, line);
          line.outPort = null;
        }
      }

      if (currentTotalOrder >= targetTotalOrder) return;

      // Branch 2: instantiate valid vertex matching combinations of open lines
      for (const arity of sortedArities) {
        if (arity > diag.openLines.length) continue;
        const chosen = [];
        const recurseCombinations = async (start, remaining) => {
          if (abortToken && abortToken.aborted) return;
          if (remaining === 0) {
            const inSig = particleSignature(chosen.map(l => l.particle));
            const matchingVertices = configsByInSignature.get(inSig) || [];
            for (const vType of matchingVertices) {
              if (currentTotalOrder >= targetTotalOrder) break;
              const vOrderSum = vType._totalOrder;
              if (vOrderSum <= 0 || currentTotalOrder + vOrderSum > targetTotalOrder) continue;

              let budgetExceeded = false;
              const nextOrder = { ...diag.order };
              for (let i = 0; i < vType._orderEntries.length; i++) {
                const [normKey, val] = vType._orderEntries[i];
                nextOrder[normKey] = (nextOrder[normKey] || 0) + val;
                if (nextOrder[normKey] > (budget[normKey] !== undefined ? budget[normKey] : Infinity)) {
                  budgetExceeded = true;
                  break;
                }
              }
              if (budgetExceeded) continue;

              const vertex = new Vertex(vType, chosen.slice(), vType.sympy_data || {});
              vertex._nid = inStates.length + outStates.length + diag.vertices.length;
              const newOutLines = vertex.generateOutLines();
              if (!Array.isArray(newOutLines) || newOutLines.length === 0) continue;

              for (const l of chosen) l.outPort = vertex;
              const oldOrder = diag.order;
              diag.order = nextOrder;
              diag.totalOrderVal += vOrderSum;
              diag.vertices.push(vertex);
              diag.lines.push(...newOutLines);

              const previousOpen = diag.openLines;
              const chosenSet = new Set(chosen);
              diag.openLines = previousOpen.filter(l => !chosenSet.has(l));
              diag.openLines.push(...newOutLines);

              await backtrack(diag);

              diag.openLines = previousOpen;
              diag.lines.splice(diag.lines.length - newOutLines.length, newOutLines.length);
              diag.vertices.pop();
              diag.totalOrderVal -= vOrderSum;
              diag.order = oldOrder;
              for (const l of chosen) l.outPort = null;
            }
            return;
          }

          const maxI = diag.openLines.length - remaining;
          for (let i = start; i <= maxI; i++) {
            chosen.push(diag.openLines[i]);
            await recurseCombinations(i + 1, remaining - 1);
            chosen.pop();
            if (abortToken && abortToken.aborted) return;
          }
        };
        await recurseCombinations(0, arity);
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

    const catalog = options.catalog || global.Vertices.buildVertexCatalog({
      disabledParticles: options.blacklist || [],
      customParticles: options.customParticles || [],
      customVertices: options.customVertices || [],
      customLists: options.customLists || []
    });

    // Reuse pre-resolved allowed configs across consecutive exactOrder searches
    let allowedVertexConfigs = options._allowedConfigs;
    if (!allowedVertexConfigs) {
      allowedVertexConfigs = (catalog.vertexConfigurations || [])
        .filter(cfg => isTheoryAllowed(cfg.order))
        .map(cfg => ({
          index: cfg.index,
          basicVertexIndex: cfg.basicVertexIndex,
          in: (cfg.in || []).map(idx => Particles.get(catalog.particles[idx].id) || catalog.particles[idx]),
          out: (cfg.out || []).map(idx => Particles.get(catalog.particles[idx].id) || catalog.particles[idx]),
          order: cfg.order,
          sympy_data: cfg.sympy_data
        }));
      options._allowedConfigs = allowedVertexConfigs;
    }

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
