/**
 * vertices.js - Standard Model Interaction Vertices & Crossing Symmetries
 */
(function (global) {
  const Particles = global.Particles;

  function isParticleBlacklisted(particle, blacklist = []) {
    if (!blacklist || !Array.isArray(blacklist) || blacklist.length === 0 || !particle) return false;
    return blacklist.some(item => {
      if (!item) return false;
      if (typeof item === 'object' && item.id) return particle.id === item.id;
      const str = String(item).trim().toLowerCase();
      if (particle.id.toLowerCase() === str) return true;
      if (particle.name && particle.name.toLowerCase() === str) return true;
      if (particle.symbol && particle.symbol.toLowerCase() === str) return true;
      if (particle.aliases && particle.aliases.some(a => a.toLowerCase() === str)) return true;
      if (particle.categories && particle.categories.some(c => c.toLowerCase() === str)) return true;
      const resolved = Particles.get(str);
      if (resolved && (resolved.id === particle.id || (resolved.anti && resolved.anti.id === particle.id))) return true;
      return false;
    });
  }

  function sortParticles(particleArray) {
    return [...particleArray].sort((a, b) => a.id.localeCompare(b.id));
  }

  function getVertexSignature(inParticles, outParticles) {
    const inStr = sortParticles(inParticles).map(p => p.id).join(',');
    const outStr = sortParticles(outParticles).map(p => p.id).join(',');
    return `${inStr}->${outStr}`;
  }

  const theoryVertices = {
    qed: [
      { in: [Particles.chargedLeptons, Particles.antichargedLeptons], out: [Particles.photon], order: { QED: 1 }, sympy_data: {} },
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.photon], order: { QED: 1 }, sympy_data: {} }
    ],
    qcd: [
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.gluon], order: { QCD: 1 }, sympy_data: {} },
      { in: [Particles.gluon, Particles.gluon], out: [Particles.gluon], order: { QCD: 1 }, sympy_data: {} },
      { in: [Particles.gluon, Particles.gluon], out: [Particles.gluon, Particles.gluon], order: { QCD: 2 }, sympy_data: {} }
    ],
    ew: [
      { in: [Particles.chargedLeptons, Particles.antichargedLeptons], out: [Particles.z0], order: { EW: 1 }, sympy_data: {} },
      { in: [Particles.neutrinos, Particles.antineutrinos], out: [Particles.z0], order: { EW: 1 }, sympy_data: {} },
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.z0], order: { EW: 1 }, sympy_data: {} },
      { in: [Particles.chargedLeptons, Particles.antineutrinos], out: [Particles.wMinus], order: { EW: 1 }, sympy_data: {} },
      { in: [Particles.upTypeQuarks, Particles.antiDownTypeQuarks], out: [Particles.wPlus], order: { EW: 1 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.photon], order: { QED: 1 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.z0], order: { EW: 1 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.wPlus, Particles.wMinus], order: { EW: 2 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.photon, Particles.photon], order: { QED: 2 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.z0, Particles.z0], order: { EW: 2 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.photon, Particles.z0], order: { QED: 1, EW: 1 }, sympy_data: {} }
    ],
    higgs: [
      { in: [Particles.chargedLeptons, Particles.antichargedLeptons], out: [Particles.higgs], order: { Higgs: 1 }, sympy_data: {} },
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.higgs], order: { Higgs: 1 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.higgs], order: { Higgs: 1 }, sympy_data: {} },
      { in: [Particles.z0, Particles.z0], out: [Particles.higgs], order: { Higgs: 1 }, sympy_data: {} },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.higgs, Particles.higgs], order: { Higgs: 2 }, sympy_data: {} },
      { in: [Particles.z0, Particles.z0], out: [Particles.higgs, Particles.higgs], order: { Higgs: 2 }, sympy_data: {} },
      { in: [Particles.higgs, Particles.higgs], out: [Particles.higgs], order: { Higgs: 1 }, sympy_data: {} },
      { in: [Particles.higgs, Particles.higgs], out: [Particles.higgs, Particles.higgs], order: { Higgs: 2 }, sympy_data: {} }
    ]
  };

  theoryVertices.QED = theoryVertices.qed;
  theoryVertices.QCD = theoryVertices.qcd;
  theoryVertices.EW = theoryVertices.ew;
  theoryVertices.Higgs = theoryVertices.higgs;
  theoryVertices['Electro-Weak'] = theoryVertices.ew;

  function expandBasicVertex(basicVertex, customListsMap = {}) {
    const rawIn = Array.isArray(basicVertex.in) ? basicVertex.in : [basicVertex.in];
    const rawOut = Array.isArray(basicVertex.out) ? basicVertex.out : [basicVertex.out];
    const order = basicVertex.order || { QED: 0, EW: 0, QCD: 0, Higgs: 0 };
    const sympy_data = (basicVertex.sympy_data && typeof basicVertex.sympy_data === 'object' && !Array.isArray(basicVertex.sympy_data))
      ? { ...basicVertex.sympy_data }
      : {};

    function resolveSlot(slot) {
      if (slot && slot.isList) {
        const listData = customListsMap[slot.id] || customListsMap[slot.name];
        if (listData && listData.particles && listData.particles.length > 0) {
          return listData.particles.map(p => Particles.get(p.id) || p);
        }
      }
      if (Array.isArray(slot)) return slot.map(p => Particles.get(p) || p);
      const resolved = Particles.get(slot);
      return resolved ? [resolved] : (slot ? [slot] : []);
    }

    const inSlots = rawIn.map(resolveSlot);
    const outSlots = rawOut.map(resolveSlot);

    let maxLength = 1;
    [...inSlots, ...outSlots].forEach(slot => {
      if (slot.length > maxLength) maxLength = slot.length;
    });

    const concreteVertices = [];
    for (let i = 0; i < maxLength; i++) {
      const concreteIn = inSlots.map(slot => slot.length === maxLength ? slot[i] : slot[0]).filter(Boolean);
      const concreteOut = outSlots.map(slot => slot.length === maxLength ? slot[i] : slot[0]).filter(Boolean);
      concreteVertices.push({ in: concreteIn, out: concreteOut, order: { ...order }, sympy_data: { ...sympy_data } });
    }
    return concreteVertices;
  }

  function getVertexConfigurations(basicVertex, blacklist = [], customListsMap = {}) {
    if (!basicVertex) return [];

    const concreteVertices = expandBasicVertex(basicVertex, customListsMap);
    const results = [];
    const seenSignatures = new Set();

    for (const concrete of concreteVertices) {
      const allP = [...concrete.in, ...concrete.out];
      if (allP.some(p => isParticleBlacklisted(p, blacklist))) continue;

      const allInPool = [ ...concrete.in, ...concrete.out.map(p => p.anti || p) ];
      const numLegs = allInPool.length;
      const totalSubsets = 1 << numLegs;

      for (let mask = 0; mask < totalSubsets; mask++) {
        const currentIn = [];
        const currentOut = [];
        for (let bit = 0; bit < numLegs; bit++) {
          const p = allInPool[bit];
          if ((mask & (1 << bit)) !== 0) currentIn.push(p);
          else currentOut.push(p.anti || p);
        }

        if (currentIn.length === 0 || currentOut.length === 0) continue;
        if ([...currentIn, ...currentOut].some(p => isParticleBlacklisted(p, blacklist))) continue;

        const sig = getVertexSignature(currentIn, currentOut);
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          results.push({
            in: sortParticles(currentIn),
            out: sortParticles(currentOut),
            order: { ...concrete.order },
            sympy_data: { ...(concrete.sympy_data || {}) }
          });
        }
      }
    }
    return results;
  }




  function buildVertexCatalog({ disabledParticles = [], customParticles = [], customVertices = [], customLists = [] } = {}) {
    const disabledSet = new Set(
      (disabledParticles || []).map(p => (typeof p === 'object' && p ? p.id : String(p)).trim().toLowerCase())
    );

    function isIdDisabled(id) {
      if (!id) return false;
      return disabledSet.has(String(id).trim().toLowerCase());
    }

    const particles = [];
    const particleIdToIndex = new Map();

    function addParticle(p) {
      if (!p || !p.id || isIdDisabled(p.id)) return;
      const cleanId = String(p.id).trim().toLowerCase();
      if (particleIdToIndex.has(cleanId)) return;

      const idx = particles.length;
      particleIdToIndex.set(cleanId, idx);
      if (p.id) particleIdToIndex.set(p.id, idx);
      if (p.symbol) particleIdToIndex.set(String(p.symbol).trim().toLowerCase(), idx);

      particles.push({
        index: idx,
        id: p.id,
        name: p.name || p.id,
        symbol: p.symbol || p.id,
        matterType: p.matterType || 'particle',
        mass: p.mass || 0,
        charge: p.charge || 0,
        spin: p.spin !== undefined ? p.spin : 0.5,
        lepton: p.lepton || 0,
        baryon: p.baryon || 0,
        categories: [...(p.categories || [])],
        generation: p.generation || null,
        sympy_data: (p.sympy_data && typeof p.sympy_data === 'object' && !Array.isArray(p.sympy_data))
          ? { ...p.sympy_data }
          : {}
      });
    }

    (Particles.all || []).forEach(addParticle);

    (customParticles || []).forEach(cp => {
      addParticle({
        id: cp.id,
        name: cp.symbol || cp.id,
        symbol: cp.symbol || cp.id,
        matterType: 'particle',
        mass: 0,
        charge: Number(cp.charge) || 0,
        spin: 0.5,
        lepton: Number(cp.lepton) || 0,
        baryon: Number(cp.baryon) || 0,
        categories: [cp.category || 'other', 'custom'],
        sympy_data: cp.sympy_data || {}
      });
      if (cp.isPair) {
        addParticle({
          id: cp.id + '_bar',
          name: cp.antiSymbol || (cp.symbol + '̄'),
          symbol: cp.antiSymbol || (cp.symbol + '̄'),
          matterType: 'antiparticle',
          mass: 0,
          charge: -(Number(cp.charge) || 0),
          spin: 0.5,
          lepton: -(Number(cp.lepton) || 0),
          baryon: -(Number(cp.baryon) || 0),
          categories: [cp.category || 'other', 'custom', 'antimatter'],
          sympy_data: cp.sympy_data || {}
        });
      }
    });

    const customListsMap = {};
    (customLists || []).forEach(l => {
      customListsMap[l.id] = l;
      customListsMap[l.name] = l;
    });

    const basicVertices = [];
    const vertexConfigurations = [];

    function processRawBasicVertex(rawVertex, theoryName) {
      const concreteList = expandBasicVertex(rawVertex, customListsMap);
      for (const concrete of concreteList) {
        const allLegs = [...concrete.in, ...concrete.out];
        if (allLegs.some(p => !p || isIdDisabled(p.id))) continue;

        const bvIndex = basicVertices.length;
        const inIndices = concrete.in.map(p => particleIdToIndex.get(p.id.toLowerCase()));
        const outIndices = concrete.out.map(p => particleIdToIndex.get(p.id.toLowerCase()));

        const bvRecord = {
          index: bvIndex,
          name: `${concrete.in.map(p => p.symbol || p.id).join(' + ')} -> ${concrete.out.map(p => p.symbol || p.id).join(' + ')}`,
          theory: theoryName,
          in: inIndices,
          out: outIndices,
          order: { ...(concrete.order || {}) },
          sympy_data: (concrete.sympy_data && typeof concrete.sympy_data === 'object' && !Array.isArray(concrete.sympy_data))
            ? { ...concrete.sympy_data }
            : {}
        };
        basicVertices.push(bvRecord);

        const configs = getVertexConfigurations(concrete, disabledParticles, customListsMap);
        for (const cfg of configs) {
          const cfgIndex = vertexConfigurations.length;
          const cfgInIndices = cfg.in.map(p => particleIdToIndex.get(p.id.toLowerCase()));
          const cfgOutIndices = cfg.out.map(p => particleIdToIndex.get(p.id.toLowerCase()));

          vertexConfigurations.push({
            index: cfgIndex,
            basicVertexIndex: bvIndex,
            name: `${cfg.in.map(p => p.symbol || p.id).join(' + ')} -> ${cfg.out.map(p => p.symbol || p.id).join(' + ')}`,
            in: cfgInIndices,
            out: cfgOutIndices,
            order: { ...(cfg.order || {}) },
            sympy_data: (cfg.sympy_data && typeof cfg.sympy_data === 'object' && !Array.isArray(cfg.sympy_data))
              ? { ...cfg.sympy_data }
              : { ...bvRecord.sympy_data }
          });
        }
      }
    }

    ['qed', 'qcd', 'ew', 'higgs'].forEach(th => {
      (theoryVertices[th] || []).forEach(raw => processRawBasicVertex(raw, th.toUpperCase()));
    });

    (customVertices || []).forEach(custV => {
      const orderObj = {};
      for (const [ck, cv] of Object.entries(custV.couplingOrders || {})) {
        orderObj[ck] = cv;
      }
      const template = {
        id: custV.id,
        in: (custV.incoming || []).map(p => p.isList ? p : (Particles.get(p.id) || p)),
        out: (custV.outgoing || []).map(p => p.isList ? p : (Particles.get(p.id) || p)),
        order: orderObj,
        sympy_data: custV.sympy_data || {}
      };
      processRawBasicVertex(template, 'CUSTOM');
    });

    return {
      particles,
      particleIdToIndex,
      basicVertices,
      vertexConfigurations
    };
  }

  const Vertices = {
    theoryVertices,
    getVertexConfigurations,
    expandBasicVertex,
    isParticleBlacklisted,
    buildVertexCatalog
  };

  global.theoryVertices = theoryVertices;
  global.getVertexConfigurations = getVertexConfigurations;
  global.buildVertexCatalog = buildVertexCatalog;
  global.Vertices = Vertices;
})(typeof window !== 'undefined' ? window : globalThis);
