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
      { in: [Particles.chargedLeptons, Particles.antichargedLeptons], out: [Particles.photon], order: { QED: 1 } },
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.photon], order: { QED: 1 } }
    ],
    qcd: [
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.gluon], order: { QCD: 1 } },
      { in: [Particles.gluon, Particles.gluon], out: [Particles.gluon], order: { QCD: 1 } },
      { in: [Particles.gluon, Particles.gluon], out: [Particles.gluon, Particles.gluon], order: { QCD: 2 } }
    ],
    ew: [
      { in: [Particles.chargedLeptons, Particles.antichargedLeptons], out: [Particles.z0], order: { EW: 1 } },
      { in: [Particles.neutrinos, Particles.antineutrinos], out: [Particles.z0], order: { EW: 1 } },
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.z0], order: { EW: 1 } },
      { in: [Particles.chargedLeptons, Particles.antineutrinos], out: [Particles.wMinus], order: { EW: 1 } },
      { in: [Particles.upTypeQuarks, Particles.antiDownTypeQuarks], out: [Particles.wPlus], order: { EW: 1 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.photon], order: { QED: 1 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.z0], order: { EW: 1 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.wPlus, Particles.wMinus], order: { EW: 2 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.photon, Particles.photon], order: { QED: 2 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.z0, Particles.z0], order: { EW: 2 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.photon, Particles.z0], order: { QED: 1, EW: 1 } }
    ],
    higgs: [
      { in: [Particles.chargedLeptons, Particles.antichargedLeptons], out: [Particles.higgs], order: { Higgs: 1 } },
      { in: [Particles.quarks, Particles.antiquarks], out: [Particles.higgs], order: { Higgs: 1 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.higgs], order: { Higgs: 1 } },
      { in: [Particles.z0, Particles.z0], out: [Particles.higgs], order: { Higgs: 1 } },
      { in: [Particles.wPlus, Particles.wMinus], out: [Particles.higgs, Particles.higgs], order: { Higgs: 2 } },
      { in: [Particles.z0, Particles.z0], out: [Particles.higgs, Particles.higgs], order: { Higgs: 2 } },
      { in: [Particles.higgs, Particles.higgs], out: [Particles.higgs], order: { Higgs: 1 } },
      { in: [Particles.higgs, Particles.higgs], out: [Particles.higgs, Particles.higgs], order: { Higgs: 2 } }
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
      concreteVertices.push({ in: concreteIn, out: concreteOut, order: { ...order } });
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

        // Every physical interaction vertex must have at least one incoming
        // and one outgoing leg. Reject the empty-side crossing cases (0->N/N->0).
        if (currentIn.length === 0 || currentOut.length === 0) continue;

        if ([...currentIn, ...currentOut].some(p => isParticleBlacklisted(p, blacklist))) continue;

        const sig = getVertexSignature(currentIn, currentOut);
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          results.push({
            in: sortParticles(currentIn),
            out: sortParticles(currentOut),
            order: { ...concrete.order }
          });
        }
      }
    }
    return results;
  }

  const Vertices = { theoryVertices, getVertexConfigurations, expandBasicVertex, isParticleBlacklisted };

  global.theoryVertices = theoryVertices;
  global.getVertexConfigurations = getVertexConfigurations;
  global.Vertices = Vertices;
})(typeof window !== 'undefined' ? window : globalThis);
