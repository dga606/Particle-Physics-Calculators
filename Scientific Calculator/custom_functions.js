/**
 * Custom Function Definitions File (custom_functions.js)
 * Exports an object containing all custom mathematical functions.
 */

// Placeholder for mass data, which will be provided by app.js in the context
let globalMassesData = {};

// Function to set the mass data, used by app.js during initialization
export function setMassesData(masses) {
    globalMassesData = masses;
}

function sum(arr, func = x => x) {
    if (!Array.isArray(arr)) throw new Error("Sum function requires a list variable.");
    return arr.reduce((acc, x) => acc + func(x), 0);
}


export const customFunctions = {
    
    

    /**
     * Looks up the mass of a particle (in MeV/c²).
     * Relies on 'globalMassesData' being set by the application logic.
     * @param {string} key - The particle identifier (e.g., 'p' for proton).
     */
    m: (key) => {
        const mass = globalMassesData[key];
        if (typeof mass === 'number' && !isNaN(mass)) {
            return mass;
        }
        throw new Error(`Mass for particle '${key}' not found or is invalid.`);
    },
    
    
    
    
    
    
    
    
    
    /**
     * Calculates the generalized expression for n variables in a list:
     * Result = Sum(x_i²) - 2 * Sum(x_i * x_j) for all i < j.
     * This follows the pattern requested for the 3-variable case.
     * @param {Array<number>} list - A list of numbers.
     */
    triangleFn: (list) => {
        if (!Array.isArray(list) || list.length < 2) {
            throw new Error("triangleFn requires a list of at least two numbers.");
        }
        
        let sumOfSquares = 0; // x1² + x2² + ...
        let sumOfProducts = 0; // x1*x2 + x1*x3 + x2*x3 + ...
        const n = list.length;
        
        // 1. Calculate Sum of Squares (x_i^2)
        for (let i = 0; i < n; i++) {
            sumOfSquares += list[i] * list[i];
        }
        
        // 2. Calculate Sum of Products (x_i * x_j) for i < j
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                sumOfProducts += list[i] * list[j];
            }
        }
        
        // Result: Sum(x_i²) - 2 * Sum(x_i * x_j) for all i < j
        const sumOfAllCrossProducts = 2 * sumOfProducts;
        
        return sumOfSquares - sumOfAllCrossProducts;
    },
    
    TwoParticleDecayEnergy: (m, m1, m2, n) => {
        if (m < m1 + m2) {
            throw new Error("Decay is forbidden or results in zero kinetic energy (m < m1 + m2).");
        }
        if (m === 0) {
            throw new Error("Parent mass (m) cannot be zero for this calculation.");
        }

        const mSq = m * m;
        const m1Sq = m1 * m1;
        const m2Sq = m2 * m2;
        
        let numerator;

        if (n === 1) {
            // Energy of the first particle (m1): (m² + m1² - m2²)
            numerator = mSq + m1Sq - m2Sq;
        } else if (n === 2) {
            // Energy of the second particle (m2): (m² - m1² + m2²)
            numerator = mSq - m1Sq + m2Sq;
        } else {
            throw new Error("Argument 'n' must be 1 (for E1) or 2 (for E2).");
        }

        return numerator / (2 * m);
    },
    
    DecayProductMaxEnergy: (m, m1, list) => { 
        const M = sum(list);
        
        
        if (m < m1 + M) {
            throw new Error("Decay is forbidden or results in zero kinetic energy (m < m1 + M).");
        }
        if (m === 0) {
            throw new Error("Parent mass (m) cannot be zero for this calculation.");
        }

        const mSq = m * m;
        const m1Sq = m1 * m1;
        const MSq = M * M;
        
        const numerator = mSq + m1Sq - MSq;
        
        return numerator / (2 * m);
    }
    
    
};