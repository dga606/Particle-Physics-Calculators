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

  function particleSignature(list) {
    return (list || [])
      .map(p => (p && p.id ? p.id : String(p)))
      .sort()
      .join(',');
  }

  function sameParticles(listA, listB) {
    return particleSignature(listA) === particleSignature(listB);
  }

  function getPartialGraphLoopRank(diag) {
    // Cyclomatic number E - N + C over the graph that has already been
    // connected. Open/dangling line ends are deliberately ignored here.
    // The rank cannot decrease as more endpoints are attached, so it is a
    // safe pruning bound while searching for diagrams with maxLoops.
    const nodes = new Set([...diag.inStates, ...diag.vertices, ...diag.outStates]);
    const parent = new Map();
    const rank = new Map();

    function makeSet(n) {
      if (!parent.has(n)) {
        parent.set(n, n);
        rank.set(n, 0);
      }
    }
    function find(x) {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r);
      while (parent.get(x) !== x) {
        const next = parent.get(x);
        parent.set(x, r);
        x = next;
      }
      return r;
    }
    function union(a, b) {
      makeSet(a); makeSet(b);
      let ra = find(a), rb = find(b);
      if (ra === rb) return false;
      if (rank.get(ra) < rank.get(rb)) [ra, rb] = [rb, ra];
      parent.set(rb, ra);
      if (rank.get(ra) === rank.get(rb)) rank.set(ra, rank.get(ra) + 1);
      return true;
    }

    nodes.forEach(makeSet);
    let edgeCount = 0;
    for (const line of diag.lines) {
      if (!line.inPort || !line.outPort) continue;
      makeSet(line.inPort);
      makeSet(line.outPort);
      edgeCount++;
      union(line.inPort, line.outPort);
    }

    const components = new Set();
    nodes.forEach(n => components.add(find(n)));
    return Math.max(0, edgeCount - nodes.size + components.size);
  }

  function getDiagramTopologySignature(diag) {
    // Stronger topology signature for partial-state memoization. Vertex IDs
    // are assigned from deterministic local descriptors; line endpoints use
    // those IDs and explicitly preserve dangling endpoints.
    const nodeDescriptors = [];
    diag.inStates.forEach((n, i) => nodeDescriptors.push({
      node: n,
      desc: `I:${i}:${n.particle && n.particle.id}`
    }));
    diag.outStates.forEach((n, i) => nodeDescriptors.push({
      node: n,
      desc: `O:${i}:${n.particle && n.particle.id}`
    }));
    diag.vertices.forEach((v, i) => nodeDescriptors.push({
      node: v,
      desc: `V:${i}:${particleSignature(v.inLines.map(l => l.particle))}>${particleSignature(v.outLines.map(l => l.particle))}:${particleSignature(Object.entries(v.type.order || {}).map(([k, val]) => `${normalizeTheoryName(k)}=${val}`))}`
    }));

    const nodeId = new Map(nodeDescriptors.map((x, i) => [x.node, `N${i}_${x.desc}`]));
    const edges = diag.lines.map(l => {
      const a = l.inPort ? nodeId.get(l.inPort) || 'UNKNOWN' : 'NONE';
      const b = l.outPort ? nodeId.get(l.outPort) || 'UNKNOWN' : 'DANGLING';
      return `${a}->${b}:${l.particle && l.particle.id}`;
    }).sort();

    const unmatchedOut = diag.unmatchedOutStates.map(s => s.particle && s.particle.id).sort();
    return `${edges.join('|')}||OUT:${unmatchedOut.join(',')}`;
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

    for (const is of inStates) {
      const line = new Lines(is.particle, is, null, 'straight');
      rootDiagram.lines.push(line);
      rootDiagram.openLines.push(line);
    }

    // Interaction vertices with zero total coupling order would make the
    // search non-terminating (arbitrarily many such insertions could be made).
    // They are therefore not valid searchable interaction definitions.
    const vertexConfigs = allowedVertexConfigs.filter(v =>
      Array.isArray(v && v.in) && Array.isArray(v && v.out) &&
      v.in.length > 0 && v.out.length > 0 &&
      Object.values(v.order || {}).reduce((a, b) => a + (Number(b) || 0), 0) > 0
    );

    const configsByInSignature = new Map();
    const arities = new Set();
    for (const v of vertexConfigs) {
      const sig = particleSignature(v.in);
      if (!configsByInSignature.has(sig)) configsByInSignature.set(sig, []);
      configsByInSignature.get(sig).push(v);
      arities.add(v.in.length);
    }
    const sortedArities = [...arities].sort((a, b) => a - b);

    // Memoize partial states reached by a different construction order.
    const seenPartialStates = new Set();
    let searchSteps = 0;

    async function backtrack(diag) {
      if (abortToken && abortToken.aborted) return;
      searchSteps++;
      if (searchSteps % 350 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const currentTotalOrder = diag.totalOrder;
      if (currentTotalOrder > targetTotalOrder) return;

      // No arbitrary vertex-count cutoff: a positive coupling order guarantees
      // finiteness for a fixed target order, while allowing any vertex arity.
      if (getPartialGraphLoopRank(diag) > maxLoops) return;

      const partialSig = getDiagramTopologySignature(diag) +
        `||ORDER:${Object.entries(diag.order).sort().map(([k,v]) => `${k}=${v}`).join(';')}`;
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

      // Branch 1: resolve ANY open line directly to ANY compatible OutState.
      // Restricting this to openLines[0] is incomplete for loop topologies.
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

      // Branch 2: instantiate ANY valid vertex whose complete incoming leg set
      // can be selected from ANY subset of the currently open lines.
      for (const arity of sortedArities) {
        if (arity > diag.openLines.length) continue;
        const chosen = [];
        const recurseCombinations = async (start, remaining) => {
          if (abortToken && abortToken.aborted) return;
          if (remaining === 0) {
            const inParticles = chosen.map(l => l.particle);
            const matchingVertices = configsByInSignature.get(particleSignature(inParticles)) || [];
            for (const vType of matchingVertices) {
              if (currentTotalOrder >= targetTotalOrder) break;
              const vOrderSum = Object.values(vType.order || {}).reduce((a, b) => a + (Number(b) || 0), 0);
              if (vOrderSum <= 0 || currentTotalOrder + vOrderSum > targetTotalOrder) continue;

              let budgetExceeded = false;
              const nextOrder = { ...diag.order };
              for (const [th, valRaw] of Object.entries(vType.order || {})) {
                const val = Number(valRaw) || 0;
                const normKey = normalizeTheoryName(th);
                nextOrder[normKey] = (nextOrder[normKey] || 0) + val;
                if (nextOrder[normKey] > (budget[normKey] !== undefined ? budget[normKey] : Infinity)) {
                  budgetExceeded = true;
                  break;
                }
              }
              if (budgetExceeded) continue;

              const vertex = new Vertex(vType, chosen.slice());
              const newOutLines = vertex.generateOutLines();
              if (!Array.isArray(newOutLines) || newOutLines.length === 0) continue;

              for (const l of chosen) l.outPort = vertex;
              const oldOrder = diag.order;
              diag.order = nextOrder;
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
