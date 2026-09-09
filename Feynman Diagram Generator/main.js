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

      this.abortToken = { aborted: false };
      let totalCount = 0;

      // Loop over exactOrder from 0 to maxTotalOrder
      for (let exactOrder = 0; exactOrder <= maxTotalOrder; exactOrder++) {
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
