/**
 * particles.js - Standard Model Particle Registry (IIFE Encapsulated)
 */
(function (global) {
  class Particle {
    constructor({
      id, name, symbol = null, mass = 0, charge = 0, spin = 0.5,
      matterType = 'particle', categories = [], generation = null,
      lepton = 0, baryon = 0, aliases = []
    }) {
      this.id = id;
      this.name = name || id;
      this.symbol = symbol || name || id;
      this.mass = mass;
      this.charge = charge;
      this.spin = spin;
      this.matterType = matterType;
      this.categories = Array.isArray(categories) ? categories : [categories];
      this.generation = generation;
      this.lepton = lepton;
      this.baryon = baryon;
      this.aliases = [id, this.symbol, ...aliases];
      this.anti = null;
    }
    hasCategory(cat) { return this.categories.includes(cat); }
    get isSelfConjugate() { return this.matterType === 'both' || this.anti === this; }
    get isFermion() { return this.hasCategory('fermion') || this.spin === 0.5; }
    get isBoson() { return this.hasCategory('boson') || this.spin === 0 || this.spin === 1; }
    get isLepton() { return this.hasCategory('lepton'); }
    get isQuark() { return this.hasCategory('quark'); }
    get isNeutrino() { return this.hasCategory('neutrino'); }
  }

  const registry = new Map();

  function registerPair({ particle, antiparticle = null }) {
    const p = new Particle({ ...particle, matterType: antiparticle ? 'particle' : 'both' });
    if (!antiparticle) {
      p.anti = p;
      registry.set(p.id, p);
      p.aliases.forEach(alias => registry.set(alias.toLowerCase(), p));
      return [p];
    }

    const antiCategories = antiparticle.categories || p.categories.map(c => {
      if (c === 'matter') return 'antimatter';
      if (c === 'fermion') return 'antifermion';
      if (c === 'quark') return 'antiquark';
      if (c === 'lepton') return 'antilepton';
      return c;
    });

    const antiP = new Particle({
      ...antiparticle,
      matterType: 'antiparticle',
      spin: p.spin,
      generation: p.generation,
      categories: antiCategories
    });

    p.anti = antiP;
    antiP.anti = p;

    registry.set(p.id, p);
    p.aliases.forEach(alias => registry.set(alias.toLowerCase(), p));
    registry.set(antiP.id, antiP);
    antiP.aliases.forEach(alias => registry.set(alias.toLowerCase(), antiP));

    return [p, antiP];
  }

  // --- Leptons ---
  const [electron, positron] = registerPair({
    particle: { id: 'e-', name: 'Electron', symbol: 'e⁻', mass: 5.1099895e5, charge: -1, lepton: 1, spin: 0.5, categories: ['fermion', 'lepton', 'charged_lepton', 'matter'], generation: 1, aliases: ['e', 'electron'] },
    antiparticle: { id: 'e+', name: 'Positron', symbol: 'e⁺', mass: 5.1099895e5, charge: +1, lepton: -1, categories: ['antifermion', 'antilepton', 'charged_lepton', 'antimatter'], aliases: ['positron'] }
  });
  const [muon, antimuon] = registerPair({
    particle: { id: 'mu-', name: 'Muon', symbol: 'μ⁻', mass: 1.056583755e8, charge: -1, lepton: 1, spin: 0.5, categories: ['fermion', 'lepton', 'charged_lepton', 'matter'], generation: 2, aliases: ['mu', 'muon'] },
    antiparticle: { id: 'mu+', name: 'Antimuon', symbol: 'μ⁺', mass: 1.056583755e8, charge: +1, lepton: -1, categories: ['antifermion', 'antilepton', 'charged_lepton', 'antimatter'], aliases: ['antimuon'] }
  });
  const [tau, antitau] = registerPair({
    particle: { id: 'tau-', name: 'Tau', symbol: 'τ⁻', mass: 1.77686e9, charge: -1, lepton: 1, spin: 0.5, categories: ['fermion', 'lepton', 'charged_lepton', 'matter'], generation: 3, aliases: ['tau'] },
    antiparticle: { id: 'tau+', name: 'Antitau', symbol: 'τ⁺', mass: 1.77686e9, charge: +1, lepton: -1, categories: ['antifermion', 'antilepton', 'charged_lepton', 'antimatter'], aliases: ['antitau'] }
  });
  const [nu_e, antinu_e] = registerPair({
    particle: { id: 'nu_e', name: 'Electron Neutrino', symbol: 'νₑ', mass: 0.1, charge: 0, lepton: 1, spin: 0.5, categories: ['fermion', 'lepton', 'neutrino', 'neutral_lepton', 'matter'], generation: 1, aliases: ['nue', 've'] },
    antiparticle: { id: 'anti_nu_e', name: 'Electron Antineutrino', symbol: 'ν̄ₑ', mass: 0.1, charge: 0, lepton: -1, categories: ['antifermion', 'antilepton', 'neutrino', 'neutral_lepton', 'antimatter'], aliases: ['nu_e~', 'anti-nue'] }
  });
  const [nu_mu, antinu_mu] = registerPair({
    particle: { id: 'nu_mu', name: 'Muon Neutrino', symbol: 'ν_μ', mass: 0.1, charge: 0, lepton: 1, spin: 0.5, categories: ['fermion', 'lepton', 'neutrino', 'neutral_lepton', 'matter'], generation: 2, aliases: ['numu', 'vmu'] },
    antiparticle: { id: 'anti_nu_mu', name: 'Muon Antineutrino', symbol: 'ν̄_μ', mass: 0.1, charge: 0, lepton: -1, categories: ['antifermion', 'antilepton', 'neutrino', 'neutral_lepton', 'antimatter'], aliases: ['nu_mu~', 'anti-numu'] }
  });
  const [nu_tau, antinu_tau] = registerPair({
    particle: { id: 'nu_tau', name: 'Tau Neutrino', symbol: 'ν_τ', mass: 0.1, charge: 0, lepton: 1, spin: 0.5, categories: ['fermion', 'lepton', 'neutrino', 'neutral_lepton', 'matter'], generation: 3, aliases: ['nutau', 'vtau'] },
    antiparticle: { id: 'anti_nu_tau', name: 'Tau Antineutrino', symbol: 'ν̄_τ', mass: 0.1, charge: 0, lepton: -1, categories: ['antifermion', 'antilepton', 'neutrino', 'neutral_lepton', 'antimatter'], aliases: ['nu_tau~', 'anti-nutau'] }
  });

  // --- Quarks ---
  const [upQuark, antiupQuark] = registerPair({
    particle: { id: 'u', name: 'Up Quark', symbol: 'u', mass: 2.16e6, charge: 2/3, baryon: 1/3, spin: 0.5, categories: ['fermion', 'quark', 'up_type_quark', 'matter'], generation: 1, aliases: ['up'] },
    antiparticle: { id: 'u_bar', name: 'Antiup Quark', symbol: 'ū', mass: 2.16e6, charge: -2/3, baryon: -1/3, categories: ['antifermion', 'antiquark', 'up_type_quark', 'antimatter'], aliases: ['u~', 'ubar'] }
  });
  const [downQuark, antidownQuark] = registerPair({
    particle: { id: 'd', name: 'Down Quark', symbol: 'd', mass: 4.67e6, charge: -1/3, baryon: 1/3, spin: 0.5, categories: ['fermion', 'quark', 'down_type_quark', 'matter'], generation: 1, aliases: ['down'] },
    antiparticle: { id: 'd_bar', name: 'Antidown Quark', symbol: 'd̄', mass: 4.67e6, charge: 1/3, baryon: -1/3, categories: ['antifermion', 'antiquark', 'down_type_quark', 'antimatter'], aliases: ['d~', 'dbar'] }
  });
  const [charmQuark, anticharmQuark] = registerPair({
    particle: { id: 'c', name: 'Charm Quark', symbol: 'c', mass: 1.27e9, charge: 2/3, baryon: 1/3, spin: 0.5, categories: ['fermion', 'quark', 'up_type_quark', 'matter'], generation: 2, aliases: ['charm'] },
    antiparticle: { id: 'c_bar', name: 'Anticharm Quark', symbol: 'c̄', mass: 1.27e9, charge: -2/3, baryon: -1/3, categories: ['antifermion', 'antiquark', 'up_type_quark', 'antimatter'], aliases: ['c~', 'cbar'] }
  });
  const [strangeQuark, antistrangeQuark] = registerPair({
    particle: { id: 's', name: 'Strange Quark', symbol: 's', mass: 9.34e7, charge: -1/3, baryon: 1/3, spin: 0.5, categories: ['fermion', 'quark', 'down_type_quark', 'matter'], generation: 2, aliases: ['strange'] },
    antiparticle: { id: 's_bar', name: 'Antistrange Quark', symbol: 's̄', mass: 9.34e7, charge: 1/3, baryon: -1/3, categories: ['antifermion', 'antiquark', 'down_type_quark', 'antimatter'], aliases: ['s~', 'sbar'] }
  });
  const [topQuark, antitopQuark] = registerPair({
    particle: { id: 't', name: 'Top Quark', symbol: 't', mass: 1.7269e11, charge: 2/3, baryon: 1/3, spin: 0.5, categories: ['fermion', 'quark', 'up_type_quark', 'matter'], generation: 3, aliases: ['top'] },
    antiparticle: { id: 't_bar', name: 'Antitop Quark', symbol: 't̄', mass: 1.7269e11, charge: -2/3, baryon: -1/3, categories: ['antifermion', 'antiquark', 'up_type_quark', 'antimatter'], aliases: ['t~', 'tbar'] }
  });
  const [bottomQuark, antibottomQuark] = registerPair({
    particle: { id: 'b', name: 'Bottom Quark', symbol: 'b', mass: 4.18e9, charge: -1/3, baryon: 1/3, spin: 0.5, categories: ['fermion', 'quark', 'down_type_quark', 'matter'], generation: 3, aliases: ['bottom'] },
    antiparticle: { id: 'b_bar', name: 'Antibottom Quark', symbol: 'b̄', mass: 4.18e9, charge: 1/3, baryon: -1/3, categories: ['antifermion', 'antiquark', 'down_type_quark', 'antimatter'], aliases: ['b~', 'bbar'] }
  });

  // --- Bosons ---
  const [photon] = registerPair({
    particle: { id: 'gamma', name: 'Photon', symbol: 'γ', mass: 0, charge: 0, spin: 1, categories: ['boson', 'gauge_boson', 'vector_boson', 'electroweak_boson'], aliases: ['photon', 'a', 'y'] }
  });
  const [gluon] = registerPair({
    particle: { id: 'gluon', name: 'Gluon', symbol: 'g', mass: 0, charge: 0, spin: 1, categories: ['boson', 'gauge_boson', 'vector_boson', 'qcd_boson', 'gluons'], aliases: ['g', 'gluon', 'gluons'] }
  });
  const [z0] = registerPair({
    particle: { id: 'Z0', name: 'Z Boson', symbol: 'Z⁰', mass: 9.11876e10, charge: 0, spin: 1, categories: ['boson', 'gauge_boson', 'vector_boson', 'electroweak_boson', 'neutral_boson'], aliases: ['Z', 'z', 'z0'] }
  });
  const [wMinus, wPlus] = registerPair({
    particle: { id: 'W-', name: 'W- Boson', symbol: 'W⁻', mass: 8.0377e10, charge: -1, spin: 1, categories: ['boson', 'gauge_boson', 'vector_boson', 'electroweak_boson', 'charged_boson'], aliases: ['w-'] },
    antiparticle: { id: 'W+', name: 'W+ Boson', symbol: 'W⁺', mass: 8.0377e10, charge: 1, categories: ['boson', 'gauge_boson', 'vector_boson', 'electroweak_boson', 'charged_boson'], aliases: ['w+'] }
  });
  const [higgs] = registerPair({
    particle: { id: 'H0', name: 'Higgs Boson', symbol: 'H⁰', mass: 1.2525e11, charge: 0, spin: 0, categories: ['boson', 'scalar_boson', 'higgs_sector'], aliases: ['H', 'h', 'higgs'] }
  });

  const leptons = [electron, muon, tau, nu_e, nu_mu, nu_tau];
  const antileptons = [positron, antimuon, antitau, antinu_e, antinu_mu, antinu_tau];
  const chargedLeptons = [electron, muon, tau];
  const antichargedLeptons = [positron, antimuon, antitau];
  const neutrinos = [nu_e, nu_mu, nu_tau];
  const antineutrinos = [antinu_e, antinu_mu, antinu_tau];
  const quarks = [upQuark, downQuark, charmQuark, strangeQuark, topQuark, bottomQuark];
  const antiquarks = [antiupQuark, antidownQuark, anticharmQuark, antistrangeQuark, antitopQuark, antibottomQuark];
  const upTypeQuarks = [upQuark, charmQuark, topQuark];
  const antiUpTypeQuarks = [antiupQuark, anticharmQuark, antitopQuark];
  const downTypeQuarks = [downQuark, strangeQuark, bottomQuark];
  const antiDownTypeQuarks = [antidownQuark, antistrangeQuark, antibottomQuark];
  const gaugeBosons = [photon, gluon, z0, wPlus, wMinus];
  const scalarBosons = [higgs];
  const bosons = [...gaugeBosons, ...scalarBosons];
  const fermions = [...leptons, ...quarks];
  const antifermions = [...antileptons, ...antiquarks];
  const allParticles = [...leptons, ...antileptons, ...quarks, ...antiquarks, ...bosons];

  const Particles = {
    Particle, registerPair,
    registerCustom(customDef) {
      const isPair = !!customDef.isPair;
      const p1 = {
        id: customDef.id, name: customDef.symbol || customDef.id, symbol: customDef.symbol || customDef.id,
        charge: parseFloat(customDef.charge) || 0, lepton: parseFloat(customDef.lepton) || 0, baryon: parseFloat(customDef.baryon) || 0,
        categories: [customDef.category || 'other', 'custom']
      };
      if (isPair) {
        const p2 = {
          id: customDef.id + '_bar', name: customDef.antiSymbol || (customDef.symbol + '̄'), symbol: customDef.antiSymbol || (customDef.symbol + '̄'),
          charge: -(parseFloat(customDef.charge) || 0), lepton: -(parseFloat(customDef.lepton) || 0), baryon: -(parseFloat(customDef.baryon) || 0),
          categories: [customDef.category || 'other', 'custom', 'antimatter']
        };
        return registerPair({ particle: p1, antiparticle: p2 });
      } else {
        return registerPair({ particle: p1 });
      }
    },
    get(identifier) {
      if (!identifier) return null;
      if (typeof identifier === 'object' && identifier.id) return identifier;
      const cleanId = String(identifier).trim().toLowerCase();
      return registry.get(cleanId) || registry.get(identifier) || null;
    },
    electron, positron, muon, antimuon, tau, antitau, nu_e, antinu_e, nu_mu, antinu_mu, nu_tau, antinu_tau,
    up: upQuark, antiup: antiupQuark, down: downQuark, antidown: antidownQuark,
    charm: charmQuark, anticharm: anticharmQuark, strange: strangeQuark, antistrange: antistrangeQuark,
    top: topQuark, antitop: antitopQuark, bottom: bottomQuark, antibottom: antibottomQuark,
    upTypeQuarks, antiUpTypeQuarks, downTypeQuarks, antiDownTypeQuarks, photon, gluon, z0, wPlus, wMinus, higgs,
    leptons, antileptons, chargedLeptons, antichargedLeptons, neutrinos, antineutrinos,
    quarks, antiquarks, gaugeBosons, scalarBosons, bosons, fermions, antifermions,
    all: allParticles
  };

  global.Particle = Particle;
  global.Particles = Particles;
})(typeof window !== 'undefined' ? window : globalThis);
