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

      // Check if this is an imported diagrams request
      if (hash.startsWith('import:')) {
        await this.loadImportedDiagramsPage(hash);
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

      window.__OUTPUT_SCATTERING_CONFIG = JSON.parse(JSON.stringify(config));
      window.__OUTPUT_DIAGRAMS = [];

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
        couplingOrders: { ...(v.couplingOrders || {}) },
        sympy_data: (v.sympy_data && typeof v.sympy_data === 'object' && !Array.isArray(v.sympy_data))
          ? { ...v.sympy_data }
          : {}
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
          baryon: Number(p.baryon) || 0,
          sympy_data: (p.sympy_data && typeof p.sympy_data === 'object' && !Array.isArray(p.sympy_data))
            ? { ...p.sympy_data }
            : {}
        })),
        customLists: sharedCustomLists,
        customVertices: sharedCustomVertices,
        couplingList: Array.isArray(config.couplingList) ? [...config.couplingList] : [],
        couplingOrders: { ...(config.couplingOrders || {}) },
        formulaText: `${config.incoming.map(p => p.symbol || p.name || p.id).join(' + ')} → ${config.outgoing.map(p => p.symbol || p.name || p.id).join(' + ')}`
      };

      const catalogFn = (global.Vertices && global.Vertices.buildVertexCatalog)
        || global.buildVertexCatalog
        || (typeof window !== 'undefined' && window.buildVertexCatalog);

      if (typeof catalogFn !== 'function') {
        throw new Error('Vertices.buildVertexCatalog function is missing.');
      }

      const catalog = catalogFn({
        disabledParticles: config.disabledParticles || [],
        customParticles: config.customParticles || [],
        customVertices: config.customVertices || [],
        customLists: config.customLists || []
      });
      window.__OUTPUT_CATALOG = catalog;

      const inStates = config.incoming.map(p => new global.InState(global.Particles.get(p.id) || p));
      const outStates = config.outgoing.map(p => new global.OutState(global.Particles.get(p.id) || p));

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
        customLists: config.customLists || [],
        catalog: catalog
      };

      const maxTotalOrder = Object.values(config.couplingOrders || {}).reduce((a, b) => a + (parseInt(b, 10) || 0), 0) || 12;
      const minTotalOrder = Math.max(0, parseInt(config.minTotalOrder, 10) || 0);

      this.abortToken = { aborted: false };
      let totalCount = 0;

      for (let exactOrder = minTotalOrder; exactOrder <= maxTotalOrder; exactOrder++) {
        if (this.abortToken.aborted) break;

        if (window.OutputUI) {
          OutputUI.setStatus(exactOrder, false, totalCount);
        }

        await new Promise(resolve => setTimeout(resolve, 20));

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
    },

    async loadImportedDiagramsPage(hash) {
      try {
        const token = decodeURIComponent(hash.replace(/^import:/, ''));
        let importedPayload = window.__IMPORTED_DIAGRAMS_DATA__ || null;

        if (!importedPayload && token) {
          try {
            const raw = sessionStorage.getItem(token) || localStorage.getItem(token);
            if (raw) importedPayload = JSON.parse(raw);
          } catch (_) {}
        }

        if (!importedPayload && window.opener && window.opener.__IMPORTED_DIAGRAMS_TARGET__) {
          importedPayload = window.opener.__IMPORTED_DIAGRAMS_TARGET__;
        }

        if (!importedPayload) {
          if (window.OutputUI) OutputUI.showError('Unable to load imported diagrams: data missing from storage or parent window.');
          return;
        }

        await this.renderImportedDiagrams(importedPayload);
      } catch (err) {
        console.error('Failed to load imported diagrams:', err);
        if (window.OutputUI) OutputUI.showError('Import Error: ' + (err.message || err));
      }
    },

    async renderImportedDiagrams(importedPayload) {
      const common = importedPayload.common || {};
      const sc = common.scattering || importedPayload.scatteringConfig || {};
      const rawDiagrams = Array.isArray(importedPayload.diagrams) ? importedPayload.diagrams : [];

      // 1. Register custom particles
      const customParticles = common.customParticles || sc.customParticles || (importedPayload.sharedData && importedPayload.sharedData.customParticles) || [];
      if (Array.isArray(customParticles)) {
        customParticles.forEach(pDef => {
          try { global.Particles.registerCustom(pDef); } catch (_) {}
        });
      }

      // 2. Resolve catalog with safe fallback
      let catalog = null;
      if (Array.isArray(common.particles) && common.particles.length > 0) {
        const pMap = new Map();
        common.particles.forEach((p, idx) => {
          if (p && p.id) {
            pMap.set(String(p.id).trim().toLowerCase(), idx);
            pMap.set(p.id, idx);
          }
        });
        catalog = {
          particles: common.particles,
          basicVertices: common.basicVertices || [],
          vertexConfigurations: common.vertexConfigurations || [],
          particleIdToIndex: pMap
        };
      } else {
        const catalogFn = (global.Vertices && global.Vertices.buildVertexCatalog)
          || global.buildVertexCatalog
          || (typeof window !== 'undefined' && window.buildVertexCatalog);

        if (typeof catalogFn === 'function') {
          catalog = catalogFn({
            disabledParticles: sc.disabledParticles || [],
            customParticles: customParticles,
            customVertices: common.customVertices || sc.customVertices || [],
            customLists: common.customLists || sc.customLists || []
          });
        } else {
          catalog = { particles: [], basicVertices: [], vertexConfigurations: [], particleIdToIndex: new Map() };
        }
      }
      window.__OUTPUT_CATALOG = catalog;
      window.__OUTPUT_SCATTERING_CONFIG = sc;

      // 3. Formula text display
      const incomingList = sc.incoming || [];
      const outgoingList = sc.outgoing || [];
      const inStr = incomingList.map(p => p.symbol || p.name || p.id).join(' + ');
      const outStr = outgoingList.map(p => p.symbol || p.name || p.id).join(' + ');
      const formulaText = (incomingList.length && outgoingList.length)
        ? `${inStr} → ${outStr}`
        : ((importedPayload.sharedData && importedPayload.sharedData.formulaText) || 'Imported Diagram Stream');

      if (window.OutputUI) {
        OutputUI.setFormula(formulaText);
      }

      // 4. Shared inspector data
      window.__DIAGRAM_SHARED_DATA = {
        customParticles: customParticles,
        customLists: common.customLists || sc.customLists || [],
        customVertices: common.customVertices || sc.customVertices || [],
        couplingList: sc.couplingList || [],
        couplingOrders: { ...(sc.couplingOrders || {}) },
        formulaText: formulaText
      };

      window.__OUTPUT_DIAGRAMS = [];

      function getFallbackParticle(id) {
        const p = {
          id: id || 'gamma',
          name: id || 'Photon',
          symbol: id || 'γ',
          matterType: 'particle',
          categories: [],
          aliases: []
        };
        p.hasCategory = function() { return false; };
        Object.defineProperty(p, 'isSelfConjugate', { value: true, enumerable: false });
        return p;
      }

      function makeParticle(infoOrIndex) {
        if (infoOrIndex === null || infoOrIndex === undefined) return getFallbackParticle('gamma');
        let info = infoOrIndex;
        if (typeof infoOrIndex === 'number' && catalog.particles && catalog.particles[infoOrIndex]) {
          info = catalog.particles[infoOrIndex];
        }
        if (!info) return getFallbackParticle('gamma');

        const id = (typeof info === 'object' ? (info.id || info.symbol) : String(info)) || '';
        const registered = (global.Particles && typeof global.Particles.get === 'function') ? global.Particles.get(id) : null;
        if (registered && typeof registered.hasCategory === 'function') return registered;

        const custom = (customParticles || []).find(def => {
          return def.id === id || (def.isPair && id === def.id + '_bar');
        });
        const fallback = {
          id: id,
          name: (typeof info === 'object' && info.name) || id,
          symbol: (typeof info === 'object' && (info.symbol || info.name)) || id,
          matterType: (typeof info === 'object' && info.matterType) || (info.isAnti ? 'antiparticle' : 'particle'),
          categories: custom ? [custom.category || 'other', 'custom'] : ((typeof info === 'object' && info.categories) || []),
          aliases: [id]
        };
        fallback.hasCategory = function(cat) { return Array.isArray(this.categories) && this.categories.includes(cat); };
        Object.defineProperty(fallback, 'isSelfConjugate', { value: fallback.matterType === 'both', enumerable: false });
        return fallback;
      }

      // 5. Group diagrams by exact total order
      const orderGroups = new Map();
      rawDiagrams.forEach((item, originalIndex) => {
        const dData = item.diagramData || item;
        let totOrder = dData.totalOrder;
        if (totOrder === undefined) {
          totOrder = Object.values(dData.order || {}).reduce((a, b) => a + (Number(b) || 0), 0);
        }
        totOrder = Number(totOrder) || 0;
        if (!orderGroups.has(totOrder)) orderGroups.set(totOrder, []);
        orderGroups.get(totOrder).push({ dData, originalIndex: originalIndex + 1 });
      });

      const sortedOrders = [...orderGroups.keys()].sort((a, b) => a - b);
      let totalCount = 0;

      for (const exactOrder of sortedOrders) {
        const group = orderGroups.get(exactOrder);
        let gridElement = null;
        if (window.OutputUI) {
          gridElement = OutputUI.createOrderSection(exactOrder, group.length);
        }

        for (const entry of group) {
          totalCount++;
          const dData = entry.dData;

          const inStates = (dData.inStates || []).map((n, idx) => ({
            index: n.index !== undefined ? n.index : idx,
            type: 'inState',
            particleIndex: n.particleIndex,
            particle: makeParticle(n.particleIndex != null ? n.particleIndex : n.particle),
            pos: n.pos ? { x: Number(n.pos.x), y: Number(n.pos.y) } : null
          }));

          const outStates = (dData.outStates || []).map((n, idx) => ({
            index: n.index !== undefined ? n.index : idx,
            type: 'outState',
            particleIndex: n.particleIndex,
            particle: makeParticle(n.particleIndex != null ? n.particleIndex : n.particle),
            pos: n.pos ? { x: Number(n.pos.x), y: Number(n.pos.y) } : null
          }));

          const vertices = (dData.vertices || []).map((n, idx) => {
            let vOrder = n.order;
            if ((!vOrder || Object.keys(vOrder).length === 0) && n.configIndex !== undefined && catalog.vertexConfigurations && catalog.vertexConfigurations[n.configIndex]) {
              vOrder = catalog.vertexConfigurations[n.configIndex].order;
            }
            return {
              index: n.index !== undefined ? n.index : idx,
              type: 'vertex',
              configIndex: n.configIndex,
              basicVertexIndex: n.basicVertexIndex,
              order: { ...(vOrder || {}) },
              pos: n.pos ? { x: Number(n.pos.x), y: Number(n.pos.y) } : null,
              sympy_data: n.sympy_data || {}
            };
          });

          function resolvePort(ref) {
            if (!ref) return null;
            if (ref.type === 'inState') return inStates[ref.index] || null;
            if (ref.type === 'outState') return outStates[ref.index] || null;
            if (ref.type === 'vertex') return vertices[ref.index] || null;
            return null;
          }

          const lines = (dData.lines || []).map((l, idx) => {
            const p = makeParticle(l.particleIndex != null ? l.particleIndex : l.particle);
            const inP = resolvePort(l.inPort);
            const outP = resolvePort(l.outPort);
            return {
              index: l.index !== undefined ? l.index : idx,
              particleIndex: l.particleIndex,
              particle: p,
              particleType: l.particleType || (p ? p.matterType : 'particle'),
              shape: l.shape || 'straight',
              sagitta: Number(l.sagitta || 0),
              inPos: l.inPos ? { x: Number(l.inPos.x), y: Number(l.inPos.y) } : (inP && inP.pos ? { ...inP.pos } : null),
              outPos: l.outPos ? { x: Number(l.outPos.x), y: Number(l.outPos.y) } : (outP && outP.pos ? { ...outP.pos } : null),
              inPort: inP,
              outPort: outP
            };
          });

          const diag = {
            order: { ...(dData.order || {}) },
            totalOrder: exactOrder,
            noOfLoops: Number(dData.noOfLoops || 0),
            inStates,
            outStates,
            vertices,
            lines
          };

          // Position layout fallback if coordinates are missing
          const needsLayout = !inStates.every(s => s.pos) || !vertices.every(v => v.pos) || !outStates.every(s => s.pos) || !lines.every(l => l.inPos && l.outPos);
          if (needsLayout && global.ImageEngine && typeof global.ImageEngine.computeDiagramPositions === 'function') {
            global.ImageEngine.computeDiagramPositions(diag);
          }

          const visualSvg = global.ImageEngine.renderDiagramSVG(diag);
          const diagramData = (dData.inStates && dData.lines) ? dData : global.ImageEngine.extractDiagramData(diag);

          window.__OUTPUT_DIAGRAMS.push(diagramData);

          if (gridElement) {
            const couplingEntries = Object.entries(diag.order || {}).filter(([_, val]) => (val || 0) > 0);
            const couplingBadges = couplingEntries.length > 0
              ? couplingEntries.map(([th, val]) => `<span class="text-amber-300">${th}: ${val}</span>`).join('<span class="text-slate-600">, </span>')
              : '<span class="text-slate-500">Order 0</span>';

            const card = document.createElement('div');
            card.className = 'diagram-card bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3 flex flex-col justify-between cursor-pointer hover:border-slate-600 transition-colors';
            card.id = `diagram-card-${totalCount}`;
            card.title = 'Open diagram in a new tab';
            card._diagramData = diagramData;

            card.innerHTML = `
              <template class="diagram-data" style="display: none;">${JSON.stringify(diagramData)}</template>
              <div class="space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono-code flex-wrap gap-2">
                  <span class="font-bold text-slate-100">Diagram #${totalCount}</span>
                  <div class="flex items-center gap-2 text-slate-400 flex-wrap text-[11px]">
                    <span>Loops: ${diag.noOfLoops}</span>
                    <span class="text-slate-600">|</span>
                    <span>Total: ${diag.totalOrder}</span>
                    <span class="text-slate-600">|</span>
                    <span>(${couplingBadges})</span>
                  </div>
                </div>
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
        }
      }

      if (window.OutputUI) {
        OutputUI.setStatus(null, true, totalCount);
        const headerStatus = document.getElementById('header-status');
        if (headerStatus) {
          headerStatus.textContent = `Import Complete - Loaded ${totalCount} Diagram(s)`;
        }
        const btnStop = document.getElementById('btn-stop-generation');
        if (btnStop) {
          btnStop.disabled = true;
          btnStop.classList.add('opacity-40', 'cursor-not-allowed');
        }
      }
    }
  };

  global.MainEngine = MainEngine;
})(typeof window !== 'undefined' ? window : globalThis);
