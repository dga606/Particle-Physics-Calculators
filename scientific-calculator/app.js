
import { CONSTANTS, DEP_CONSTANTS, LIST_VARIABLES, MASSES } from './data.js';

import { customFunctions, setMassesData } from './custom_functions.js';

let parsedConstants = {};
let parsedListVariables = {};
let parsedMasses = {};
let parsedMasses_type={};

let elementToRestore = null;

let prevResult = '';

let history_list =[];

// --- Initialization and Parsing ---

function parseConstants(constantsObj) {
    return Object.fromEntries(
        Object.entries(constantsObj).map(([key, value]) => [key, parseFloat(value)])
    );
}

function parseMasses_p(massesObj) {
    const parsed = {};
    for (const key in massesObj) {
        parsed[key] = parseFloat(massesObj[key]);
        if (isNaN(parsed[key])) {
            console.warn(`Mass value for '${key}' is invalid.`);
        }
    }
    return parsed;
}
function parseMasses(massesObj) {
    const parsed = {};
    for (const key in massesObj) {
        parsed[key] = parseMasses_p(massesObj[key]);
        
    }
    return parsed;
}

function mergeDict(dict) {
    const newDict = {};
    for (const [key_, value_] of Object.entries(dict)) {
        for (const [key, value] of Object.entries(value_)) {
        newDict[key] = value;
    }}
    return newDict;
}


function parseLists(listVarsObj, constantsMap) {
    const processedLists = {};
    const massPattern = /^m\(([^)]+)\)$/; // Regex to match m(key)
    
    for (const listName in listVarsObj) {
        const itemNames = listVarsObj[listName];
        if (Array.isArray(itemNames)) {
            processedLists[listName] = itemNames.map(name => {
                
                // 1. Check if the item is a standard constant (e.g., "c")
                const constValue = constantsMap[name];
                if (typeof constValue === 'number' && !isNaN(constValue)) {
                    return constValue;
                }

                // 2. Check if the item is a mass function call (e.g., "m(p)")
                const match = name.match(massPattern);
                if (match) {
                    const particleKey = match[1]; // 'p'
                    const massValue = parsedMasses[particleKey];
                    if (typeof massValue === 'number' && !isNaN(massValue)) {
                        return massValue;
                    }
                    throw new Error(`Particle mass 'm(${particleKey})' in list '${listName}' not found or invalid.`);
                }
                
                // 3. If neither, throw an error
                throw new Error(`List item '${name}' in list '${listName}' is not a valid constant or mass key.`);
            });
        }
    }
    return processedLists;
}

// --- Execution Scope Preparation ---

function getExecutionContext(constants, lists, customFuncs, masses) {
    const customAggregates = {
        sum: (arr, func = x => x) => {
            if (!Array.isArray(arr)) throw new Error("Sum function requires a list variable.");
            return arr.reduce((acc, x) => acc + func(x), 0);
        },
        product: (arr) => {
            if (!Array.isArray(arr)) throw new Error("Product function requires a list variable.");
            return arr.reduce((acc, x) => acc * x, 1);
        },
    };

    const standardMath = {
        // Expose Math object methods globally
        Math: Math,
        sin: (ang) => {
            return parseFloat(Math.sin(ang).toFixed(15));
        },
        cos: (ang) => {
            return parseFloat(Math.cos(ang).toFixed(15));
        },
        tan: (ang) => {
            return parseFloat(Math.tan(ang).toFixed(15));
        },        
        arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, 
        log: Math.log, log10: Math.log10, exp: Math.exp, 
        sqrt: Math.sqrt, abs: Math.abs, pow: Math.pow,
        PI: Math.PI, E: Math.E, "π": Math.PI, pi:Math.PI,
        fact: (n)=> {
            let result = 1;
            for (let i = 2; i <= n; i++) {result *= i;}
            return result;
        }
        
        
        
    };

    return {
        ...standardMath,
        ...customAggregates,
        ...customFuncs,
        ...constants,
        ...lists,
    };
}




// mathFunctions

const mathFunctions = [
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".",  "+", "-", "*", "/", "^", "%"],
    [",", "(", ")", "[", "]"],
    ["sin()", "cos()", "tan()","arcsin()", "arccos()", "arctan()", "π"],
    ["log()", "log10()", "exp()", "sqrt()", "abs()", "pow()", "fact()", "E"],
    ["sum()", "product()"]
]

// --- UI Rendering ---

function renderVariables(constants, lists, customFuncs, masses) {
    const constantsListEl = document.getElementById('constants-list');
    const listsListEl = document.getElementById('lists-display');
    const massesListEl = document.getElementById('masses-list-display');
    const mathFunctionsListEl = document.getElementById('math-functions-list');
    const functionsListEl = document.getElementById('functions-list');
    
    // Render Constants
    constantsListEl.innerHTML = '';
    for (const [key, value] of Object.entries(constants)) {
        const constantCard = document.createElement('button');
        constantCard.onclick = function() { insertTextAtCursor(`${key}`)};
        constantCard.onmousedown= saveFocus ;
        constantCard.ontouchstart=saveFocus;
        constantCard.className = 'p-2 bg-indigo-50 rounded-lg border border-gray-200 shadow-sm transition duration-200 transform active:scale-75 active:bg-gray-100 active:shadow-inner';
        constantCard.innerHTML = `
            <p class="text-sm font-medium text-gray-900" >${key}: 
            <code class="text-xs text-secondary font-mono break-all">${value.toPrecision(5)}</code></p>
        `;
        constantsListEl.appendChild(constantCard);
    }

    // Render Lists
    listsListEl.innerHTML = '';
    
    

    // Lists Content (Displays the calculated values in the list)
    for (const [key, values] of Object.entries(lists)) {
        const listCard = document.createElement('button');
        listCard.onmousedown= saveFocus ;
        listCard.ontouchstart=saveFocus;
        listCard.className = 'p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm mb-4 transition duration-200 transform active:scale-75 active:bg-gray-100 active:shadow-inner';
        
        // Find the original string list for display clarity
        const originalList = LIST_VARIABLES[key];
        
        
        listCard.onclick = function() { insertTextAtCursor(`${key}`)};

        listCard.innerHTML = `
            <p class="text-sm font-medium text-gray-900 mb-2">${key} (Array of Values)</p>
            <div class="px-2">
                ${values.map((v, i) => 
                    `<code class="list-item" title="Source: ${originalList[i]}">${originalList[i]}:${v.toPrecision(4)}</code>`
                ).join('')}
            </div>
        `;
        listsListEl.appendChild(listCard);
    }
    
    
    //Render Masses
    
    massesListEl.innerHTML = '';
    
    const massGrid = document.createElement('div');
    massGrid.className = 'grid grid-cols-1 gap-0';
    
    for (const [key_, masses_] of Object.entries(masses)) {
        const massTypeTitle = document.createElement('h3');
        massTypeTitle.className = 'text-l font-semibold text-gray-600  ';
        massTypeTitle.innerHTML = `${key_}:`;
        
        const massGrid_ = document.createElement('div');
        massGrid_.className = 'grid grid-cols-2 gap-2';
        
        //const massKeys = Object.keys(masses).sort();
        const massKeys = Object.keys(masses_);
        const keysToDisplay = massKeys.slice(0, massKeys.length); //replace massKeys.length by 10 to display only 10
    
        keysToDisplay.forEach(key => {
            const massEntry = document.createElement('button');
            massEntry.onclick = function() { insertTextAtCursor(`m(\"${key}\")`)};
            massEntry.onmousedown= saveFocus ;
            massEntry.ontouchstart=saveFocus;
             massEntry.className = 'p-2 bg-indigo-50 rounded-md border border-indigo-200 text-sm shadow-sm transition duration-200 transform active:scale-75 active:bg-indigo-10 active:shadow-inner';
             massEntry.innerHTML = `
                 <span class="font-medium text-indigo-700">m(\"${key}\"):</span>
                 <code class="font-mono text-xs text-gray-600">${masses_[key].toPrecision(4)}</code>
             `;
             massGrid_.appendChild(massEntry);
        });
        
        massGrid.appendChild(massTypeTitle);
        massGrid.appendChild(massGrid_);
    }
    
    /**
    if (massKeys.length > 10) {
         const more = document.createElement('p');
         more.className = 'text-xs text-gray-500 mt-2 col-span-2';
         more.textContent = `... and ${massKeys.length - 10} more. Use m(key) for lookup.`;
         massGrid.appendChild(more);
    }
    */
    
    massesListEl.appendChild(massGrid);
    
    
    
    //  Render Math Functions
    mathFunctionsListEl.innerHTML = '';
    for (const [i,mathFuncSet] of Object.entries(mathFunctions)) {
    for (const [index,key] of Object.entries(mathFuncSet)) {
         const funcCard = document.createElement('button');
        funcCard.onclick = function() { insertTextAtCursor(`${key}`)};
        funcCard.onmousedown= saveFocus ;
        funcCard.ontouchstart=saveFocus;
        funcCard.className = 'min-w-7 p-2 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm transition duration-200 transform active:scale-75 active:bg-gray-100 active:shadow-inner';
        // Attempt to extract arguments for display
        //const argsMatch = func.toString().match(/\((.*?)\)/);
        //const args = argsMatch ? argsMatch[1].replace(/\s*,\s*/g, ', ') : '';
        
        funcCard.innerHTML = `
            <p class="text-sm font-medium text-indigo-700">${key}</p>
        `;
        mathFunctionsListEl.appendChild(funcCard);
    }mathFunctionsListEl.appendChild(document.createElement('br'))
    }


    //  Render Custom Functions
    functionsListEl.innerHTML = '';
    for (const [key, func] of Object.entries(customFuncs)) {
         const funcCard = document.createElement('button');
        funcCard.onclick = function() { insertTextAtCursor(`${key}()`)};
        funcCard.onmousedown= saveFocus;
        funcCard.ontouchstart=saveFocus;
        funcCard.className = 'p-2 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm transition duration-200 transform active:scale-75 active:bg-gray-100 active:shadow-inner';
        // Attempt to extract arguments for display
        const argsMatch = func.toString().match(/\((.*?)\)/);
        const args = argsMatch ? argsMatch[1].replace(/\s*,\s*/g, ', ') : '';
        funcCard.innerHTML = `
            <p class="text-sm font-medium text-indigo-700">${key}(<span class="font-mono text-xs text-indigo-500">${args}</span>)</p>
        `;
        functionsListEl.appendChild(funcCard);
    }
}

// hotkeys for entering functions and other variables to input area

function saveFocus() {
    // Check if the currently active element is our target input
    // The browser hasn't yet processed the full click/tap and shifted focus.
    const inputElement = document.getElementById('expression-input');
    if (document.activeElement === inputElement) {
        elementToRestore = inputElement;
    } else {
        // Clear the reference if the input wasn't the active element
        elementToRestore = null; 
    }
}




function insertTextAtCursor( textToInsert, input_element='expression-input', take_in_para=true) {
  // 1. Get the input element
  const input = document.getElementById(input_element);
  
  // 2. Check if the element exists and is a text input
  if (!input) {
    console.error(`Could not find the input element with id \"${input_element}\".`);
    return;
  }

  // 3. Get the current cursor position (selection start and end)
  const startPos = input.selectionStart;
  const endPos = input.selectionEnd;
  const originalValue = input.value;

  // 4. Construct the new value
  // This takes the part before the cursor, adds the new text, and then adds the part after the cursor.
  const newValue = originalValue.substring(0, startPos) + 
                   textToInsert + 
                   originalValue.substring(endPos, originalValue.length);

  // 5. Update the input value
  input.value = newValue;

  // 6. Calculate the new cursor position
  // The cursor should be moved forward by the length of the text we inserted.
  let newCursorPos = startPos + textToInsert.length;
    
  if (take_in_para) {
      if (textToInsert[textToInsert.length - 1]==")" && textToInsert[textToInsert.length-2]=="(") {
          newCursorPos = newCursorPos - 1;
      }
  }

  // 7. Set the cursor position (must be done *after* changing the value)
  // We use a small timeout to ensure the DOM has fully updated, which is safer for cursor manipulation.
  setTimeout(() => {
    input.selectionStart = newCursorPos;
    input.selectionEnd = newCursorPos;
    // Bring focus back to the input field so the user can keep typing immediately
    //input.focus({ preventScroll:true, focusVisible: true});
    elementToRestore.focus({ preventScroll:true, focusVisible: true});
      
  }, 0);
    
}


function insertResult (input_element_='expression-input') {
    
    insertTextAtCursor(`${prevResult}`, input_element_, false);
}



function shiftCursor( amount=1, input_element='expression-input') {
  // 1. Get the input element
  const input = document.getElementById(input_element);
    
    
  
  // Check if the element exists and is a text input
  if (!input) {
    console.error(`Could not find the input element with id \"${input_element}\".`);
    return;
  }
    

  // Get the current cursor position (selection start and end)
  const startPos = input.selectionStart;
  const endPos = input.selectionEnd;
    
  let s_r = startPos;
  if (amount>=0) {s_r=endPos;}  
    
    if(startPos!=endPos){amount=0;}
    

  // 6. Calculate the new cursor position
  // The cursor should be moved forward by the length of the text we inserted.
  let newCursorPos = s_r + amount;
  

  // 7. Set the cursor position (must be done *after* changing the value)
  // We use a small timeout to ensure the DOM has fully updated, which is safer for cursor manipulation.
  setTimeout(() => {
    input.selectionStart = newCursorPos;
    input.selectionEnd = newCursorPos;
    // Bring focus back to the input field so the user can keep typing immediately
    //input.focus({ preventScroll:true, focusVisible: true});
    elementToRestore.focus({ preventScroll:true, focusVisible: true});
      
  }, 0);
    
}

function setInput(value, input_element='expression-input') {
    const input = document.getElementById(input_element);
    
  // Check if the element exists and is a text input
  if (!input) {
    console.error(`Could not find the input element with id \"${input_element}\".`);
    return;
  }
  
    input.value=value;
  
}


function emptyInput(input_element='expression-input') {
  
    setInput('',input_element);
  

  
  // We use a small timeout to ensure the DOM has fully updated, which is safer for cursor manipulation.
  setTimeout(() => {
    
    // Bring focus back to the input field so the user can keep typing immediately
    //input.focus({ preventScroll:true, focusVisible: true});
    elementToRestore.focus({ preventScroll:true, focusVisible: true});
      
  }, 0);
    
}


function backSpace(input_element='expression-input', take_in_para=true) {
  // 1. Get the input element
  const input = document.getElementById(input_element);
  
  // 2. Check if the element exists and is a text input
  if (!input) {
    console.error(`Could not find the input element with id \"${input_element}\".`);
    return;
  }

  // 3. Get the current cursor position (selection start and end)
  const startPos = input.selectionStart;
  const endPos = input.selectionEnd;
  const originalValue = input.value;
    
    
    
  let newValue = "";
  let newCursorPos = 0;  

  // Construct the new value
  // This takes the part before the cursor, adds the new text, and then adds the part after the cursor.
  if (startPos==0) {
      newValue = originalValue;
      
  } else if (startPos == endPos){
    newValue = originalValue.substring(0, startPos-1) + originalValue.substring(endPos, originalValue.length);
    newCursorPos = startPos-1;  
  } else {newValue = originalValue.substring(0, startPos) + originalValue.substring(endPos, originalValue.length);
    newCursorPos = startPos;  
  }
  // 5. Update the input value
  input.value = newValue;

  // 6. Calculate the new cursor position
  // The cursor should be moved forward by the length of the text we inserted.
  
    
  

  // 7. Set the cursor position (must be done *after* changing the value)
  // We use a small timeout to ensure the DOM has fully updated, which is safer for cursor manipulation.
  setTimeout(() => {
    input.selectionStart = newCursorPos;
    input.selectionEnd = newCursorPos;
    // Bring focus back to the input field so the user can keep typing immediately
    //input.focus({ preventScroll:true, focusVisible: true});
    elementToRestore.focus({ preventScroll:true, focusVisible: true});
      
  }, 0);
    
}


function disableDiv(elemID) {
    // Store the original display value (if needed, otherwise default is fine)
    // Here we just set it directly to 'none'
    document.getElementById(elemID).style.display = 'none';
}

function enableDiv(elemID) {
    // Restore the original display value (e.g., 'block', 'inline-block', etc.)
    document.getElementById(elemID).style.display = 'block'; // Or whatever its original display type was
}


function addToHistory(input_, result_, precision_=10, historyElId='history-list', input_element='expression-input', result_element='result-value') {
    const newEntry = [input_,result_];
    const index_ = history_list.findIndex(entry => entry[0] === input_);
    if ( index_ > -1) {
        history_list.splice(index_,1);
        document.getElementById(`history-${input_}`).remove();
    }
    history_list.push(newEntry);
    
    const hisEl = document.getElementById(historyElId);
    
    const hisCard = document.createElement('button');
    hisCard.id = `history-${input_}`;
    hisCard.onclick = function() { 
        setInput(input_, input_element);
        document.getElementById(result_element).textContent = result_.toPrecision(precision_);
        disableDiv('history');
        enableDiv('app');
    };
    
    hisCard.className = 'p-2 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm transition duration-200 transform active:scale-75 active:bg-gray-100 active:shadow-inner';
    hisCard.innerHTML = `${input_} &nbsp = ${result_.toPrecision(precision_)}`;
    
    hisEl.appendChild(hisCard);
    
}













// --- Core Calculation Logic ---

function calculate() {
    
    const inputElement = document.getElementById('expression-input');
    const resultElement = document.getElementById('result-value');
    const expression = inputElement.value;

    if (!expression.trim()) {
        resultElement.textContent = '0';
        return;
    }

    try {
        const context = getExecutionContext(parsedConstants, parsedListVariables, customFunctions, parsedMasses);
        // Replace ^ with ** for standard JavaScript power operation
        const preparedExpression = expression.trim().replace(/\^/g, '**').replaceAll('%','*0.01');

        const argNames = Object.keys(context);
        const argValues = Object.values(context);
        
        // Use the Function constructor for safe, dynamic evaluation
        const func = new Function(...argNames, `return ${preparedExpression};`);
        
        const result = func(...argValues);

        if (typeof result !== 'number' || isNaN(result) || result === Infinity || result === -Infinity) {
            throw new Error("Invalid result or undefined expression outcome. Check syntax.");
        }
        
        prevResult = result;
        addToHistory(expression,result,10, 'history-list', 'expression-input', 'result-value');
        resultElement.textContent = result.toPrecision(10); 
        inputElement.classList.remove('border-red-500', 'border-2');
        
        
    } catch (e) {
        console.error("Calculation Error:", e);
        resultElement.textContent = 'Error';
        inputElement.classList.add('border-red-500', 'border-2');
    }
}

// Allows calculation on Enter key press
function handleKey(event) {
    if (event.key === 'Enter') {
        calculate();
        event.preventDefault();
    }
    
    
}

// --- Application Setup (Runs on load) ---

function init() {
    try {
        // 1. Parse and validate all data
        parsedConstants = parseConstants({ ...CONSTANTS, ...DEP_CONSTANTS});
        parsedMasses_type = parseMasses(MASSES);
        parsedMasses = mergeDict(parsedMasses_type);
        // Lists depend on valid constants AND masses
        parsedListVariables = parseLists(LIST_VARIABLES, parsedConstants);

        // 2. Provide masses data to the custom_functions module for the m() lookup
        setMassesData(parsedMasses);

        // 3. Render UI
        renderVariables(parsedConstants, parsedListVariables, customFunctions, parsedMasses_type);

        // 4. Expose functions globally for the HTML event handlers (onclick, onkeydown)
        window.app = {
            calculate: calculate,
            shiftCursor: shiftCursor,
            saveFocus: saveFocus,
            insertResult: insertResult,
            emptyInput: emptyInput,
            backSpace: backSpace,
            disableDiv: disableDiv,
            enableDiv: enableDiv
            
        };
        window.handleKey = handleKey;

        // 5. Set an initial expression
        document.getElementById('expression-input').value = ''; // Test the new list!
        calculate();

    } catch (e) {
        console.error("Application Initialization Error:", e);
        // Fallback state if initialization fails
        document.getElementById('result-value').textContent = 'INIT ERROR';
    }
}

window.onload = init;
