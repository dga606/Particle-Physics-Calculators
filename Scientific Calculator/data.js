/**
 * Local Data Configuration File (data.js)
 * Exports constants, lists, and particle masses.
 */




/**

const special_letters = {
    // Uppercase Greek Letters
    Alpha: 'Α',
    Beta: 'Β',
    Gamma: 'Γ',
    Delta: 'Δ',
    Epsilon: 'Ε',
    Zeta: 'Ζ',
    Eta: 'Η',
    Theta: 'Θ',
    Iota: 'Ι',
    Kappa: 'Κ',
    Lambda: 'Λ',
    Mu: 'Μ',
    Nu: 'Ν',
    Xi: 'Ξ',
    Omicron: 'Ο',
    Pi: 'Π',
    Rho: 'Ρ',
    Sigma: 'Σ',
    Tau: 'Τ',
    Upsilon: 'Υ',
    Phi: 'Φ',
    Chi: 'Χ',
    Psi: 'Ψ',
    Omega: 'Ω',

    // Lowercase Greek Letters
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    epsilon: 'ε',
    zeta: 'ζ',
    eta: 'η',
    theta: 'θ',
    iota: 'ι',
    kappa: 'κ',
    lambda: 'λ',
    mu: 'μ',
    nu: 'ν',
    xi: 'ξ',
    omicron: 'ο',
    pi: 'π',
    rho: 'ρ',
    sigma: 'σ',
    tau: 'τ',
    upsilon: 'υ',
    phi: 'φ',
    chi: 'χ',
    psi: 'ψ',
    omega: 'ω',

    // Special symbols (non-Greek)
    hbar: 'ℏ',        
    infinity: '∞',    
    partial: '∂',     
    nabla: '∇',       
    thetaSymbol: 'ϑ'  
};


*/








export const CONSTANTS = {
    "e": "1.602176634e-19",
    "c": "299792458",
    "h": "6.62607015e-34",
    "R": "8.3144621",
    "G": "6.6743e-11",
    //"π": `${Math.PI}`,
    //"E": `${Math.E}`,
    //"e": "2.71828182845",
    "m_e": "9.1093837015e-31",
    "m_p": "1.67262192595e-27",
    "ℏ": "1.05457e-34",
    //"ℏ_MeV": "6.58212e-22",
    "α":`${1/137.035999177}`,
    "θw": `${28.76*Math.PI/180}`,
    "gg": "1.214"
    
};


export const DEP_CONSTANTS = {
    /*"e2":`${CONSTANTS["e"]**2}`*/
    
    "ε0": `${(CONSTANTS["e"]**2)/(CONSTANTS["α"]*CONSTANTS["ℏ"]*CONSTANTS["c"]*4*Math.PI)}`,
    
    "ge":`${Math.sqrt(4*Math.PI*CONSTANTS["α"])}`,
    get "gW"(){ 
        return this["ge"]/Math.sin(CONSTANTS["θw"]);
    },  
    get "gZ"(){ 
        return this["ge"]/(Math.sin(CONSTANTS["θw"])*Math.cos(CONSTANTS["θw"]));
    },
    
    
    
    
    
    
};    



/**
 * Particle Masses in MeV/c²
 * Accessible via m(key) in the calculator.
 */
export const MASSES = {
    "Fundamental Particles" : {
        // --- FUNDAMENTAL PARTICLES (Quarks, Leptons and Bosons) ---
        "u": 2.16,           // Up Quark  
        "d": 4.70,           // Down Quark  
        "s": 93.5,          // Strange Quark  
        "c": 1273.0,        // Charm Quark  
        "b": 4183,        // Bottom Quark  
        "t": 172520.00,      // Top Quark  
        "e": 0.511,          // Electron
        "μ": 105.66,        // Muon
        "τ": 1776.93,       // Tauon
        "ν_e": 0.0,         // Electron Neutrino (approx 0)
        "ν_μ": 0.0,        // Muon Neutrino (approx 0)
        "ν_τ": 0.0,       // Tauon Neutrino (approx 0)
        "γ": 0.0,        // Photon
        "g": 0.0,            // Gluon
        "W": 80369.2,        // W Boson
        "Z": 91188.0,        // Z Boson
        "H": 125200.0,       // Higgs Boson
        
    },
    
    "Baryons (Spin 1/2)" : {
        // --- BARYONS (Spin 1/2 Octet & Spin 3/2 Decuplet) ---
        // Nucleons (N)
        "p": 938.27,         // Proton
        "n": 939.57,         // Neutron
        
        // Lambda (Λ)
        "Λ": 1115.68,   // Lambda 
        
        // Sigma (Σ)
        "Σ+": 1189.37,    // Sigma plus (Spin 1/2)
        "Σ0": 1192.64,    // Sigma zero (Spin 1/2)
        "Σ-": 1197.45,    // Sigma minus (Spin 1/2)
        
        // Xi (Ξ)
        "Ξ0": 1314.86,       // Xi zero (Spin 1/2)
        "Ξ-": 1321.71,       // Xi minus (Spin 1/2)
        
        // --- CHARMED BARYONS    
        "Λc+": 2286.46,  // Lambda c plus  
        
        // --- BOTTOM BARYONS (Representative) ---
        "Σb+": 5810.56,   // Sigma b plus
        "Σb-": 5815.64,   // Sigma b minus        
    },
    
    "Baryons (Spin 3/2)" : {
    
        // Delta (Δ) (Spin 3/2)
        "Δ": 1232.0, // Delta (Average mass)
        
        "Σ*": 1385,
        
        "Ξ*": 1530,
        
        // Omega (Ω)
        "Ω-": 1672.45,   // Omega minus (Spin 3/2)
    },
    
    "Pseudoscalar Mesons (Spin 0)": {
        
        // --- MESONS (Spin 0 Pseudoscalar & Spin 1 Vector) ---
        // Pions (π)
        "π+": 139.57,       // Pion plus (Pseudoscalar)
        "π-": 139.57,
        "π0": 134.98,       // Pion zero (Pseudoscalar)
        
        // Kaons (K)
        "K+": 493.68,        // Kaon plus (Pseudoscalar)
        "K-": 493.68,
        "K0": 497.61,        // Kaon zero (Pseudoscalar)
        
        // Eta (η)
        "η": 547.86,       // Eta (Pseudoscalar)
        "η\'": 957.78,  // Eta prime (Pseudoscalar)
        
        // --- D/B MESONS (Quarkonia & Heavy Flavor) ---
        "D+": 1869.66,        // D plus (Pseudoscalar)
        "D-": 1869.66,        // D minus (Pseudoscalar)
        "D0": 1864.84,        // D zero (Pseudoscalar)
        "Ds": 1968.35,        // D_s plus/minus 
        "B+": 5279.41,        // B plus (Pseudoscalar)
        "B-": 5279.41,        // B minus (Pseudoscalar)
        "B0": 5279.72,        // B zero (Pseudoscalar)
        
    },
    
    
    "Vector Mesons (Spin 1)": {
        
        // Rho (ρ)
        "ρ": 775.26,        // Rho (Vector)
        
        "K*": 894,
        
        // Omega (ω)
        "ω": 782.66,   // Omega vector meson (Vector)
        
        "J/ψ": 3096.90,      // J/Psi (Charmonium - Vector)
        
        "D*0": 2006.85,
        "D*+": 2010.26,
        "D*-": 2010.26,
        
        "Υ": 9460.40,   // Upsilon (Bottomonium - Vector)
        
        "φ": 1019.46,      // Phi (Vector)
        
        
    }    
    
    
};

export const LIST_VARIABLES = {
    
    "Leptons": ["m(e)", "m(μ)", "m(τ)", "m(ν_e)", "m(ν_μ)", "m(ν_τ)"],
    "Nucleons": ["m(p)", "m(n)"]
};





















/**

// SUBSCRIPT DICTIONARY
const sub_letters = {
    // Numbers
    0: '₀',
    1: '₁',
    2: '₂',
    3: '₃',
    4: '₄',
    5: '₅',
    6: '₆',
    7: '₇',
    8: '₈',
    9: '₉',

    // Latin letters (available in Unicode)
    a: 'ₐ',
    e: 'ₑ',
    h: 'ₕ',
    i: 'ᵢ',
    j: 'ⱼ',
    k: 'ₖ',
    l: 'ₗ',
    m: 'ₘ',
    n: 'ₙ',
    o: 'ₒ',
    p: 'ₚ',
    r: 'ᵣ',
    s: 'ₛ',
    t: 'ₜ',
    u: 'ᵤ',
    v: 'ᵥ',
    x: 'ₓ',

    // Greek Letters (ONLY those that Unicode supports)
    beta: 'ᵦ',
    gamma: 'ᵧ',  // actually a gamma symbol
    rho: 'ᵨ',
    phi: 'ᵩ',
    chi: 'ᵪ',

    // Math symbols (where Unicode supports them)
    plus: '₊',
    minus: '₋',
    equals: '₌',
    leftParen: '₍',
    rightParen: '₎'
};



// SUPERSCRIPT DICTIONARY
const sup_letters = {
    // Numbers
    0: '⁰',
    1: '¹',
    2: '²',
    3: '³',
    4: '⁴',
    5: '⁵',
    6: '⁶',
    7: '⁷',
    8: '⁸',
    9: '⁹',

    // Latin letters (available in Unicode)
    a: 'ᵃ',
    b: 'ᵇ',
    c: 'ᶜ',
    d: 'ᵈ',
    e: 'ᵉ',
    f: 'ᶠ',
    g: 'ᶢ',
    h: 'ʰ',
    i: 'ⁱ',
    j: 'ʲ',
    k: 'ᵏ',
    l: 'ˡ',
    m: 'ᵐ',
    n: 'ⁿ',
    o: 'ᵒ',
    p: 'ᵖ',
    r: 'ʳ',
    s: 'ˢ',
    t: 'ᵗ',
    u: 'ᵘ',
    v: 'ᵛ',
    w: 'ʷ',
    x: 'ˣ',
    y: 'ʸ',
    z: 'ᶻ',

    // Greek letters (only Unicode-supported)
    alpha: 'ᵅ',
    beta: 'ᵝ',
    gamma: 'ᵞ',
    delta: 'ᵟ',
    theta: 'ᶿ',
    phi: 'ᵠ',
    chi: 'ᵡ',

    // Math symbols
    plus: '⁺',
    minus: '⁻',
    equals: '⁼',
    leftParen: '⁽',
    rightParen: '⁾'
};

const special_letters_unicode = {
    // Lowercase Greek letters
    alpha: '\u03B1',     // α
    beta: '\u03B2',      // β
    gamma: '\u03B3',     // γ
    delta: '\u03B4',     // δ
    epsilon: '\u03B5',   // ε
    zeta: '\u03B6',      // ζ
    eta: '\u03B7',       // η
    theta: '\u03B8',     // θ
    iota: '\u03B9',      // ι
    kappa: '\u03BA',     // κ
    lambda: '\u03BB',    // λ
    mu: '\u03BC',        // μ
    nu: '\u03BD',        // ν
    xi: '\u03BE',        // ξ
    omicron: '\u03BF',   // ο
    pi: '\u03C0',        // π
    rho: '\u03C1',       // ρ
    sigma: '\u03C3',     // σ
    tau: '\u03C4',       // τ
    upsilon: '\u03C5',   // υ
    phi: '\u03C6',       // φ
    chi: '\u03C7',       // χ
    psi: '\u03C8',       // ψ
    omega: '\u03C9',     // ω
    
    // Uppercase Greek letters
    ALPHA: '\u0391',     // Α
    BETA: '\u0392',      // Β
    GAMMA: '\u0393',     // Γ
    DELTA: '\u0394',     // Δ
    EPSILON: '\u0395',   // Ε
    ZETA: '\u0396',      // Ζ
    ETA: '\u0397',       // Η
    THETA: '\u0398',     // Θ
    IOTA: '\u0399',      // Ι
    KAPPA: '\u039A',     // Κ
    LAMBDA: '\u039B',    // Λ
    MU: '\u039C',        // Μ
    NU: '\u039D',        // Ν
    XI: '\u039E',        // Ξ
    OMICRON: '\u039F',   // Ο
    PI: '\u03A0',        // Π
    RHO: '\u03A1',       // Ρ
    SIGMA: '\u03A3',     // Σ
    TAU: '\u03A4',       // Τ
    UPSILON: '\u03A5',   // Υ
    PHI: '\u03A6',       // Φ
    CHI: '\u03A7',       // Χ
    PSI: '\u03A8',       // Ψ
    OMEGA: '\u03A9',     // Ω

    // Special symbols
    hbar: '\u210F',      // ℏ 
    infinity: '\u221E',   // ∞ 
    partial: '\u2202',    // ∂ 
    nabla: '\u2207',      // ∇ 
    thetaSymbol: '\u03D1' // ϑ 
};

*/









