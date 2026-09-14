/**
 * latex.js - TikZ-Feynman Exporter
 */
(function (global) {
  'use strict';

  function toLatexMath(sym, id) {
    const raw = (sym || id || '').trim();
    if (!raw) return '';

    const LATEX_MAP = {
      'e-': 'e^-', 'e': 'e^-', 'electron': 'e^-', 'e⁻': 'e^-',
      'e+': 'e^+', 'positron': 'e^+', 'e⁺': 'e^+',
      'mu-': '\\mu^-', 'mu': '\\mu^-', 'muon': '\\mu^-', 'μ-': '\\mu^-', 'μ⁻': '\\mu^-',
      'mu+': '\\mu^+', 'antimuon': '\\mu^+', 'μ+': '\\mu^+', 'μ⁺': '\\mu^+',
      'tau-': '\\tau^-', 'tau': '\\tau^-', 'τ-': '\\tau^-', 'τ⁻': '\\tau^-',
      'tau+': '\\tau^+', 'antitau': '\\tau^+', 'τ+': '\\tau^+', 'τ⁺': '\\tau^+',
      'nu_e': '\\nu_e', 'nue': '\\nu_e', 've': '\\nu_e', 'ν_e': '\\nu_e', 'νₑ': '\\nu_e',
      'anti_nu_e': '\\bar{\\nu}_e', 'anti-nue': '\\bar{\\nu}_e', 'nu_e~': '\\bar{\\nu}_e', 'ν̄ₑ': '\\bar{\\nu}_e', 'ν̄_e': '\\bar{\\nu}_e',
      'nu_mu': '\\nu_\\mu', 'numu': '\\nu_\\mu', 'vmu': '\\nu_\\mu', 'ν_mu': '\\nu_\\mu', 'ν_μ': '\\nu_\\mu', 'νμ': '\\nu_\\mu',
      'anti_nu_mu': '\\bar{\\nu}_\\mu', 'anti-numu': '\\bar{\\nu}_\\mu', 'nu_mu~': '\\bar{\\nu}_\\mu', 'ν̄_μ': '\\bar{\\nu}_\\mu', 'ν̄_mu': '\\bar{\\nu}_\\mu',
      'nu_tau': '\\nu_\\tau', 'nutau': '\\nu_\\tau', 'vtau': '\\nu_\\tau', 'ν_tau': '\\nu_\\tau', 'ν_τ': '\\nu_\\tau', 'ντ': '\\nu_\\tau',
      'anti_nu_tau': '\\bar{\\nu}_\\tau', 'anti-nutau': '\\bar{\\nu}_\\tau', 'nu_tau~': '\\bar{\\nu}_\\tau', 'ν̄_τ': '\\bar{\\nu}_\\tau', 'ν̄_tau': '\\bar{\\nu}_\\tau',
      'u': 'u', 'up': 'u',
      'u_bar': '\\bar{u}', 'ubar': '\\bar{u}', 'u~': '\\bar{u}', 'ū': '\\bar{u}',
      'd': 'd', 'down': 'd',
      'd_bar': '\\bar{d}', 'dbar': '\\bar{d}', 'd~': '\\bar{d}', 'd̄': '\\bar{d}',
      'c': 'c', 'charm': 'c',
      'c_bar': '\\bar{c}', 'cbar': '\\bar{c}', 'c~': '\\bar{c}', 'c̄': '\\bar{c}',
      's': 's', 'strange': 's',
      's_bar': '\\bar{s}', 'sbar': '\\bar{s}', 's~': '\\bar{s}', 's̄': '\\bar{s}',
      't': 't', 'top': 't',
      't_bar': '\\bar{t}', 'tbar': '\\bar{t}', 't~': '\\bar{t}', 't̄': '\\bar{t}',
      'b': 'b', 'bottom': 'b',
      'b_bar': '\\bar{b}', 'bbar': '\\bar{b}', 'b~': '\\bar{b}', 'b̄': '\\bar{b}',
      'gamma': '\\gamma', 'photon': '\\gamma', 'a': '\\gamma', 'y': '\\gamma', 'γ': '\\gamma',
      'gluon': 'g', 'g': 'g', 'gluons': 'g',
      'z0': 'Z^0', 'z': 'Z^0', 'z⁰': 'Z^0',
      'w-': 'W^-', 'w⁻': 'W^-',
      'w+': 'W^+', 'w⁺': 'W^+',
      'h0': 'H^0', 'h': 'H^0', 'higgs': 'H^0', 'h⁰': 'H^0'
    };

    const key = raw.toLowerCase();
    if (LATEX_MAP[key]) return LATEX_MAP[key];
    if (LATEX_MAP[raw]) return LATEX_MAP[raw];

    let s = raw;
    const hasBar = s.includes('̄') || s.endsWith('_bar') || s.endsWith('~') || s.startsWith('anti_') || s.startsWith('anti-');
    s = s.replace(/_bar$|~$|^anti_|^anti-|\u0304|̄/g, '');

    const GREEK = {
      'alpha': '\\alpha', 'α': '\\alpha', 'beta': '\\beta', 'β': '\\beta',
      'gamma': '\\gamma', 'γ': '\\gamma', 'delta': '\\delta', 'δ': '\\delta',
      'epsilon': '\\epsilon', 'ε': '\\epsilon', 'zeta': '\\zeta', 'ζ': '\\zeta',
      'eta': '\\eta', 'η': '\\eta', 'theta': '\\theta', 'θ': '\\theta',
      'iota': '\\iota', 'ι': '\\iota', 'kappa': '\\kappa', 'κ': '\\kappa',
      'lambda': '\\lambda', 'λ': '\\lambda', 'mu': '\\mu', 'μ': '\\mu',
      'nu': '\\nu', 'ν': '\\nu', 'xi': '\\xi', 'ξ': '\\xi',
      'pi': '\\pi', 'π': '\\pi', 'rho': '\\rho', 'ρ': '\\rho',
      'sigma': '\\sigma', 'σ': '\\sigma', 'tau': '\\tau', 'τ': '\\tau',
      'phi': '\\phi', 'φ': '\\phi', 'chi': '\\chi', 'χ': '\\chi',
      'psi': '\\psi', 'ψ': '\\psi', 'omega': '\\omega', 'ω': '\\omega'
    };

    s = s.replace(/(\\[a-zA-Z]+|[a-zA-Z]+|[\u0370-\u03FF])/g, m => GREEK[m.toLowerCase()] || m);
    s = s.replace(/⁺/g, '^+').replace(/⁻/g, '^-').replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2')
         .replace(/ₑ/g, '_e').replace(/_μ/g, '_\\mu').replace(/_τ/g, '_\\tau').replace(/₁/g, '_1').replace(/₂/g, '_2');

    return hasBar ? `\\bar{${s}}` : s;
  }

  function generateTikzLatex(diagram) {
    if (!diagram) return '';

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const allNodes = [...(diagram.inStates || []), ...(diagram.vertices || []), ...(diagram.outStates || [])];
    allNodes.forEach(function(n) {
      if (n.pos) {
        minX = Math.min(minX, n.pos.x);
        minY = Math.min(minY, n.pos.y);
        maxX = Math.max(maxX, n.pos.x);
        maxY = Math.max(maxY, n.pos.y);
      }
    });

    if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 300; maxY = 200; }

    // Coordinates divided by 10 to keep values small and avoid TeX dimension limit errors
    function formatCoord(pos) {
      if (!pos) return '0.00, 0.00';
      const x = ((pos.x - minX) / 10).toFixed(2);
      const y = ((maxY - pos.y) / 10).toFixed(2);
      return x + ', ' + y;
    }

    const spanX = Math.max(10, (maxX - minX) / 10);
    const scaleFactor = +(15.0 / spanX).toFixed(3);

    function getNodeName(port) {
      if (!port) return null;
      const inIdx = (diagram.inStates || []).indexOf(port);
      if (inIdx !== -1) return 'i' + (inIdx + 1);
      const vIdx = (diagram.vertices || []).indexOf(port);
      if (vIdx !== -1) return 'v' + (vIdx + 1);
      const outIdx = (diagram.outStates || []).indexOf(port);
      if (outIdx !== -1) return 'f' + (outIdx + 1);
      return null;
    }

    function getLineOptions(line) {
      const p = line.particle;
      const pId = p ? (p.id || '').toLowerCase() : '';
      const isPhoton = pId === 'gamma' || pId === 'photon' || pId === 'a' || pId === 'y';
      const isGluon = pId === 'gluon' || pId === 'g' || (p && p.hasCategory && (p.hasCategory('qcd_boson') || p.hasCategory('gluons')));
      const isWeak = pId === 'w+' || pId === 'w-' || pId === 'z0' || pId === 'z' || (p && p.hasCategory && (p.hasCategory('charged_boson') || p.hasCategory('neutral_boson')));
      const isHiggs = pId === 'h0' || pId === 'h' || pId === 'higgs' || (p && p.hasCategory && (p.hasCategory('scalar_boson') || p.hasCategory('higgs_sector')));

      let style = 'plain';
      if (isPhoton) style = 'photon';
      else if (isGluon) style = 'gluon';
      else if (isWeak) style = 'boson';
      else if (isHiggs) style = 'scalar';
      else style = (line.particleType === 'antiparticle') ? 'anti fermion' : 'fermion';

      const opts = [style];
      if (line.sagitta) {
        const bend = Math.min(80, Math.max(-80, Math.round(line.sagitta * 1.8)));
        if (bend > 0) opts.push('bend right=' + bend);
        else if (bend < 0) opts.push('bend left=' + Math.abs(bend));
      }

      const label = toLatexMath(p ? p.symbol : '', p ? p.id : '');
      if (label) {
        opts.push('edge label=\\(' + label + '\\)');
      }
      return opts.join(', ');
    }

    let code = '% Requires \\usepackage[compat=1.1.0]{tikz-feynman} in LaTeX preamble\n';
    code += `\\begin{tikzpicture}[scale=${scaleFactor}]\n`;
    code += '  \\begin{feynman}\n';

    if (diagram.inStates && diagram.inStates.length > 0) {
      code += '    % Incoming states\n';
      diagram.inStates.forEach(function(n, idx) {
        const label = toLatexMath(n.particle ? n.particle.symbol : '', n.particle ? n.particle.id : '');
        code += '    \\vertex (i' + (idx + 1) + ') at (' + formatCoord(n.pos) + ')' + (label ? ' {\\(' + label + '\\)}' : '') + ';\n';
      });
    }

    if (diagram.vertices && diagram.vertices.length > 0) {
      code += '    % Interaction vertices\n';
      diagram.vertices.forEach(function(n, idx) {
        code += '    \\vertex (v' + (idx + 1) + ') at (' + formatCoord(n.pos) + ');\n';
      });
    }

    if (diagram.outStates && diagram.outStates.length > 0) {
      code += '    % Outgoing states\n';
      diagram.outStates.forEach(function(n, idx) {
        const label = toLatexMath(n.particle ? n.particle.symbol : '', n.particle ? n.particle.id : '');
        code += '    \\vertex (f' + (idx + 1) + ') at (' + formatCoord(n.pos) + ')' + (label ? ' {\\(' + label + '\\)}' : '') + ';\n';
      });
    }

    code += '\n    \\diagram* {\n';
    (diagram.lines || []).forEach(function(line) {
      const from = getNodeName(line.inPort);
      const to = getNodeName(line.outPort);
      if (!from || !to) return;
      code += '      (' + from + ') -- [' + getLineOptions(line) + '] (' + to + '),\n';
    });
    code += '    };\n';
    code += '  \\end{feynman}\n';
    code += '\\end{tikzpicture}';

    return code;
  }

  function setupLatexModal(getDiagramFn) {
    const btnLatex = document.getElementById('btn-latex');
    const modal = document.getElementById('latex-modal');
    const btnClose = document.getElementById('btn-close-latex');
    const btnCopy = document.getElementById('btn-copy-latex');
    const textarea = document.getElementById('latex-code-text');

    if (!btnLatex || !modal) return;

    btnLatex.addEventListener('click', function() {
      const diag = typeof getDiagramFn === 'function' ? getDiagramFn() : getDiagramFn;
      textarea.value = generateTikzLatex(diag);
      modal.style.display = 'flex';
    });

    if (btnClose) {
      btnClose.addEventListener('click', function() {
        modal.style.display = 'none';
      });
    }

    modal.addEventListener('click', function(e) {
      if (e.target === this) this.style.display = 'none';
    });

    if (btnCopy) {
      btnCopy.addEventListener('click', function() {
        textarea.select();
        const onSuccess = function() {
          const copyText = document.getElementById('copy-btn-text');
          if (copyText) {
            copyText.textContent = 'Copied!';
            setTimeout(function() { copyText.textContent = 'Copy'; }, 2000);
          }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textarea.value).then(onSuccess).catch(function() {
            document.execCommand('copy');
            onSuccess();
          });
        } else {
          document.execCommand('copy');
          onSuccess();
        }
      });
    }
  }

  const LatexEngine = {
    toLatexMath,
    generateTikzLatex,
    setupLatexModal
  };

  global.LatexEngine = LatexEngine;
})(typeof window !== 'undefined' ? window : globalThis);
