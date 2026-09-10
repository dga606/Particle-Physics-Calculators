/**
 * main.js - Central Generation & Stream Controller
 */
(function (global) {
  const MainEngine = {
    abortToken: { aborted: false },

    generate() {
      if (typeof window.getScatteringState !== 'function') {
        alert('Error: Cannot retrieve scattering state.');
        return;
      }

      const config = window.getScatteringState();
      if (!config || !config.incoming || !config.outgoing || config.incoming.length === 0 || config.outgoing.length === 0) {
        alert('Please configure at least one incoming and one outgoing particle.');
        return;
      }

      // Store in URL hash - zero cross-origin security restrictions on file:///
      const payload = encodeURIComponent(JSON.stringify(config));
      window.open('output.html#' + payload, '_blank');
    },

    stop() {
      this.abortToken.aborted = true;
    },

    async runOutputPage() {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) {
        if (window.OutputUI) OutputUI.showError('No scattering query provided in URL hash.');
        return;
      }

      let config = null;
      try {
        config = JSON.parse(decodeURIComponent(hash));
      } catch (e) {
        if (window.OutputUI) OutputUI.showError('Failed to parse scattering setup from URL.');
        return;
      }

      if (config.customParticles && Array.isArray(config.customParticles)) {
        config.customParticles.forEach(pDef => global.Particles.registerCustom(pDef));
      }

      // Keep the exact serializable scattering configuration supplied to output.html
      // so Download JSON can reproduce the setup that is passed to inspect.html.
      window.__OUTPUT_SCATTERING_CONFIG = JSON.parse(JSON.stringify(config));
      window.__OUTPUT_DIAGRAMS = [];

      // Shared, output-page-level data used by every diagram editor tab.
      // IMPORTANT: never carry Particle objects into this data. Keep only plain
      // serializable particle identity and the custom-definition information.
      const serializeParticleRef = (p) => {
        if (!p) return null;
        return {
          id: p.id || '',
          name: p.name || p.symbol || p.id || '',
          symbol: p.symbol || p.name || p.id || '',
          matterType: p.matterType || (p.isAnti ? 'antiparticle' : 'particle')
        };
      };
      const serializeSlot = (slot) => {
        if (!slot) return null;
        if (slot.isList) {
          return {
            isList: true,
            id: slot.id || slot.name || '',
            name: slot.name || slot.id || '',
            particles: Array.isArray(slot.particles) ? slot.particles.map(serializeParticleRef).filter(Boolean) : []
          };
        }
        return serializeParticleRef(slot);
      };
      const sharedCustomVertices = (Array.isArray(config.customVertices) ? config.customVertices : []).map(v => ({
        id: v.id || '',
        incoming: Array.isArray(v.incoming) ? v.incoming.map(serializeSlot).filter(Boolean) : [],
        outgoing: Array.isArray(v.outgoing) ? v.outgoing.map(serializeSlot).filter(Boolean) : [],
        couplingOrders: { ...(v.couplingOrders || {}) }
      }));
      const sharedCustomLists = (Array.isArray(config.customLists) ? config.customLists : []).map(l => ({
        id: l.id || l.name || '',
        name: l.name || l.id || '',
        description: l.description || '',
        particles: Array.isArray(l.particles) ? l.particles.map(serializeParticleRef).filter(Boolean) : []
      }));
      window.__DIAGRAM_SHARED_DATA = {
        customParticles: (Array.isArray(config.customParticles) ? config.customParticles : []).map(p => ({
          isPair: !!p.isPair,
          id: p.id || '',
          symbol: p.symbol || p.id || '',
          antiSymbol: p.antiSymbol || '',
          category: p.category || 'other',
          charge: Number(p.charge) || 0,
          lepton: Number(p.lepton) || 0,
          baryon: Number(p.baryon) || 0
        })),
        customLists: sharedCustomLists,
        customVertices: sharedCustomVertices,
        couplingList: Array.isArray(config.couplingList) ? [...config.couplingList] : [],
        couplingOrders: { ...(config.couplingOrders || {}) },
        formulaText: `${config.incoming.map(p => p.symbol || p.name || p.id).join(' + ')} → ${config.outgoing.map(p => p.symbol || p.name || p.id).join(' + ')}`
      };

      const inStates = config.incoming.map(p => new global.InState(global.Particles.get(p.id) || p));
      const outStates = config.outgoing.map(p => new global.OutState(global.Particles.get(p.id) || p));

      // Display Reaction Formula in the sticky header
      const inStr = config.incoming.map(p => p.symbol || p.name || p.id).join(' + ');
      const outStr = config.outgoing.map(p => p.symbol || p.name || p.id).join(' + ');
      const formulaText = `${inStr} → ${outStr}`;

      if (window.OutputUI) {
        OutputUI.setFormula(formulaText);
      }

      const generatorOptions = {
        noTadpoles: !config.includeTadpoles,
        allowDisconnected: !!config.includeDisconnected,
        blacklist: config.disabledParticles || [],
        customVertices: config.customVertices || [],
        customLists: config.customLists || []
      };

      const maxTotalOrder = Object.values(config.couplingOrders || {}).reduce((a, b) => a + (parseInt(b, 10) || 0), 0) || 12;
      const minTotalOrder = Math.max(0, parseInt(config.minTotalOrder, 10) || 0);

      this.abortToken = { aborted: false };
      let totalCount = 0;

      // Loop over exactOrder from minTotalOrder to maxTotalOrder
      for (let exactOrder = minTotalOrder; exactOrder <= maxTotalOrder; exactOrder++) {
        if (this.abortToken.aborted) break;

        if (window.OutputUI) {
          OutputUI.setStatus(exactOrder, false, totalCount);
        }

        await new Promise(resolve => setTimeout(resolve, 20));

        // Generate diagrams of EXACTLY this exactOrder (asynchronously)
        const diagrams = await global.GraphEngine.generateGraphsForOrder(
          inStates,
          outStates,
          exactOrder,
          config.couplingOrders || {},
          config.maxLoops || 0,
          generatorOptions,
          this.abortToken
        );

        if (this.abortToken.aborted) break;

        if (diagrams && diagrams.length > 0) {
          let gridElement = null;
          if (window.OutputUI) {
            gridElement = OutputUI.createOrderSection(exactOrder, diagrams.length);
          }

          for (const diag of diagrams) {
            totalCount++;
            if (gridElement && global.ImageEngine) {
              global.ImageEngine.renderDiagramToContainer(gridElement, exactOrder, totalCount, diag);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 20));
      }

      if (!this.abortToken.aborted && window.OutputUI) {
        OutputUI.setStatus(null, true, totalCount);
      }
    }
  };

  global.MainEngine = MainEngine;
})(typeof window !== 'undefined' ? window : globalThis);
