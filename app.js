require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

let editor;

let virtualFS = {
    'main.c': `// Cargando entorno...`
};
let currentFile = 'main.c';
let lastCompileMarkers = {};

// Cargar Monaco Editor
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: virtualFS['main.c'],
        language: 'c',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false }
    });
    renderFileList();
});

// Configuración Global
const CONFIG = {
    API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') ? 'http://localhost:3000' : 'https://apm32-baremetal-backend.onrender.com'
};

const logDiv = document.getElementById('logBox');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const flashBtn = document.getElementById('flashBtn');
const exampleSelector = document.getElementById('exampleSelector');
const downloadBtn = document.getElementById('downloadBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const newFileBtn = document.getElementById('newFileBtn');
const fileList = document.getElementById('fileList');

let lastCompiledBinary = null;

let dynamicExamples = [];

exampleSelector.onchange = () => {
    if (exampleSelector.value) {
        loadExample(exampleSelector.value);
    }
};

async function loadExample(val) {
    const exampleDef = dynamicExamples.find(e => e.id === val);
    
    if (exampleDef) {
        try {
            logmsg(`Fetching '${exampleDef.name}'...`, "warn");
            const fetchedFiles = {};
            
            for (const file of exampleDef.files) {
                const res = await fetch(`examples/${exampleDef.id}/${file}`);
                if (!res.ok) throw new Error(`Failed to load ${file}`);
                fetchedFiles[file] = await res.text();
            }
            
            virtualFS = fetchedFiles;
            currentFile = exampleDef.files.includes('main.c') ? 'main.c' : exampleDef.files[0];
            
            if (editor) {
                editor.setValue(virtualFS[currentFile]);
                monaco.editor.setModelLanguage(editor.getModel(), 'c');
                
                lastCompileMarkers = {};
                monaco.editor.setModelMarkers(editor.getModel(), "compiler", []);
                
                renderFileList();
            }
            logmsg(`Workspace updated successfully!`, 'success');
        } catch (err) {
            logmsg(`Error loading workspace: ${err.message}`, "error");
        } finally {
            exampleSelector.value = ""; // reset dropdown visually
        }
    }
}

async function loadExampleRegistry() {
    try {
        const response = await fetch('examples/index.json');
        if (!response.ok) throw new Error("Index not found");
        dynamicExamples = await response.json();
        
        dynamicExamples.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            exampleSelector.appendChild(opt);
        });
        
        // Autoload the first example as the initial boilerplate
        if (dynamicExamples.length > 0) {
            await loadExample(dynamicExamples[0].id);
        }
    } catch (err) {
        console.warn("Could not load examples registry:", err);
    }
}
loadExampleRegistry();

function saveCurrentFile() {
    if (editor) virtualFS[currentFile] = editor.getValue();
}

function loadFile(filename) {
    saveCurrentFile();
    currentFile = filename;
    editor.setValue(virtualFS[filename]);
    
    const ext = filename.split('.').pop();
    const lang = (ext === 'h' || ext === 'c' || ext === 'cpp') ? 'c' : 'plaintext';
    monaco.editor.setModelLanguage(editor.getModel(), lang);
    
    monaco.editor.setModelMarkers(editor.getModel(), "compiler", lastCompileMarkers[filename] || []);
    
    renderFileList();
}

function renderFileList() {
    fileList.innerHTML = '';
    for (const filename in virtualFS) {
        const div = document.createElement('div');
        div.className = `p-2 cursor-pointer rounded flex justify-between items-center text-sm ${filename === currentFile ? 'bg-blue-100 border border-blue-300 font-semibold' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = filename;
        nameSpan.className = 'truncate max-w-[120px] block';
        nameSpan.onclick = () => loadFile(filename);
        div.appendChild(nameSpan);

        if (filename !== 'main.c') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = "flex gap-1 items-center";
            
            const renameBtn = document.createElement('button');
            renameBtn.innerHTML = '✏️';
            renameBtn.className = 'text-gray-500 hover:text-blue-600 text-[10px] px-1';
            renameBtn.title = "Rename File";
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                let newFilename = prompt("Enter new file name:", filename);
                if (!newFilename) return;
                newFilename = newFilename.trim();
                
                if (newFilename === filename) return;
                if (virtualFS[newFilename] !== undefined) {
                    alert("A file with that name already exists!");
                    return;
                }
                
                // Perform rename
                virtualFS[newFilename] = virtualFS[filename];
                delete virtualFS[filename];
                
                if (currentFile === filename) {
                    currentFile = newFilename;
                }
                renderFileList();
            };
            actionsDiv.appendChild(renameBtn);

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'text-red-500 hover:text-red-700 font-bold px-1';
            delBtn.title = "Delete File";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Delete " + filename + "?")) {
                    delete virtualFS[filename];
                    if (currentFile === filename) loadFile('main.c');
                    else renderFileList();
                }
            };
            actionsDiv.appendChild(delBtn);
            div.appendChild(actionsDiv);
        }
        
        fileList.appendChild(div);
    }
}

newFileBtn.onclick = () => {
    let filename = prompt("Enter file name (e.g., utils.c, config.h):");
    if (!filename) return;
    filename = filename.trim();
    if (virtualFS[filename] !== undefined) {
        alert("File already exists!");
        return;
    }
    virtualFS[filename] = '// ' + filename + '\n';
    loadFile(filename);
};

downloadBtn.onclick = () => {
    if (!lastCompiledBinary) return;
    const blob = new Blob([lastCompiledBinary], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firmware.bin';
    a.click();
    URL.revokeObjectURL(url);
};

downloadZipBtn.onclick = async () => {
    saveCurrentFile();
    const zip = new JSZip();
    for (const filename in virtualFS) {
        zip.file(filename, virtualFS[filename]);
    }
    const blob = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apm32_project.zip';
    a.click();
    URL.revokeObjectURL(url);
    logmsg("Downloaded project as ZIP successfully.", "success");
};

function logmsg(msg, type='info') {
    let color = '#d4d4d4';
    if(type === 'error') color = '#ff5b5b';
    if(type === 'success') color = '#a3be8c';
    if(type === 'warn') color = '#ebcb8b';
    logDiv.innerHTML += `<div style="color: ${color}">>> ${msg}</div>`;
    
    setTimeout(() => {
        logDiv.scrollTop = logDiv.scrollHeight;
    }, 10);
}

let processor = null;

// Conectar CMSIS-DAP
connectBtn.onclick = async () => {
    try {
        logmsg("Requesting USB connection...", 'warn');
        const device = await navigator.usb.requestDevice({
            filters: [
                { classCode: 255 }, // Generic Custom
                { vendorId: 0x0D28 } // ARM DAP
            ]
        });

        const transport = new DAPjs.WebUSB(device);
        processor = new DAPjs.CortexM(transport, 0, 1000000); 
        
        await processor.connect();
        logmsg(`Connected to USB Port: ${device.productName || 'CMSIS-DAP'}`, 'success');
        
        flashBtn.disabled = false;
        disconnectBtn.classList.remove('hidden');
        flashBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } catch(err) {
        logmsg("Connection error: " + err.message, 'error');
    }
};

disconnectBtn.onclick = async () => {
    if (processor) {
        try {
            await processor.disconnect();
            logmsg("USB device disconnected.", "info");
        } catch(e) {
            logmsg("Forced disconnection.", "warn");
        }
        processor = null;
        flashBtn.disabled = true;
        disconnectBtn.classList.add('hidden');
        flashBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

async function flashAPM32(processor, binArrayBuffer) {
    const FLASH_KEYR = 0x40022004;
    const FLASH_SR   = 0x4002200C;
    const FLASH_CR   = 0x40022010;
    
    logmsg(">> [FMC] Unlocking flash...", "info");
    await processor.writeMem32(FLASH_KEYR, 0x45670123);
    await processor.writeMem32(FLASH_KEYR, 0xCDEF89AB);
    
    let cr = await processor.readMem32(FLASH_CR);
    if ((cr & 0x80) !== 0) throw new Error("Failed to unlock Flash");

    logmsg(">> [FMC] Erasing memory (Mass Erase)...", "info");
    await processor.writeMem32(FLASH_CR, 0x00000004); // Set MER
    await processor.writeMem32(FLASH_CR, 0x00000044); // Set STRT + MER
    
    // Wait for BSY
    let sr = await processor.readMem32(FLASH_SR);
    while(sr & 0x01) sr = await processor.readMem32(FLASH_SR);
    
    await processor.writeMem32(FLASH_CR, 0x00000000); // Clear MER
    
    logmsg(">> [FMC] Writing binary (" + binArrayBuffer.byteLength + " bytes)...", "info");
    await processor.writeMem32(FLASH_CR, 0x00000001); // Set PG
    
    const data16 = new Uint16Array(binArrayBuffer);
    let address = 0x08000000;
    
    for (let i = 0; i < data16.length; i++) {
        await processor.writeMem16(address, data16[i]);
        sr = await processor.readMem32(FLASH_SR);
        while(sr & 0x01) sr = await processor.readMem32(FLASH_SR);
        address += 2;

        if (i > 0 && i % 512 === 0) {
            logmsg(">> Write progress: " + Math.round((i / data16.length) * 100) + "%");
        }
    }
    
    await processor.writeMem32(FLASH_CR, 0x00000000); // Clear PG
    logmsg(">> [FMC] Programming completed successfully.", "success");
}

// Compilar y Flashear
flashBtn.onclick = async () => {
    if (!processor) {
        logmsg("Please connect the USB device first.", "error");
        return;
    }

    try {
        logmsg("---------------------------------------");
        logmsg("1/3 Sending code to Compiler API...", "warn");
        
        lastCompileMarkers = {};
        if (editor) monaco.editor.setModelMarkers(editor.getModel(), "compiler", []);
        
        saveCurrentFile();
        const res = await fetch(`${CONFIG.API_URL}/compile`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ files: virtualFS })
        });
        
        if(!res.ok) {
            const errLog = await res.json();
            const rawError = errLog.details || '';
            
            // Parse GCC Errors
            const lines = rawError.split('\n');
            const regex = /(?:src|inc)\/([a-zA-Z0-9_\-\.]+):(\d+):.*?(error|warning):\s+(.*)/i;
            
            for (let line of lines) {
                const match = line.match(regex);
                if (match) {
                    const [, filename, lineNum, severity, message] = match;
                    if (!lastCompileMarkers[filename]) lastCompileMarkers[filename] = [];
                    
                    lastCompileMarkers[filename].push({
                        startLineNumber: parseInt(lineNum, 10),
                        startColumn: 1,
                        endLineNumber: parseInt(lineNum, 10),
                        endColumn: 1000,
                        message: message,
                        severity: severity.toLowerCase() === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error
                    });
                }
            }

            const errorFiles = Object.keys(lastCompileMarkers);
            if (errorFiles.length > 0) {
                if (!errorFiles.includes(currentFile)) {
                    loadFile(errorFiles[0]); // auto-switch to first errored file
                } else {
                    monaco.editor.setModelMarkers(editor.getModel(), "compiler", lastCompileMarkers[currentFile]);
                }
            }
            
            logmsg("Error Reason:\n" + rawError, "error");
            throw new Error("Compilation Failed");
        }

        const binArrayBuffer = await res.arrayBuffer();
        lastCompiledBinary = binArrayBuffer;
        
        // Show download button
        downloadBtn.classList.remove('hidden');
        
        // El binario debe alinear en Half-words
        let safeBuffer = binArrayBuffer;
        if (binArrayBuffer.byteLength % 2 !== 0) {
            safeBuffer = new ArrayBuffer(binArrayBuffer.byteLength + 1);
            new Uint8Array(safeBuffer).set(new Uint8Array(binArrayBuffer));
        }

        logmsg(`2/3 Compilation Successful! Received ${safeBuffer.byteLength} bytes.`, "success");

        logmsg("3/3 Injecting Firmware via WebUSB...", "warn");
        
        await processor.halt(); 
        await flashAPM32(processor, safeBuffer);
        
        logmsg("Rebooting device...", "info");
        await processor.writeMem32(0xE000ED0C, 0x05FA0004);
        
        logmsg("Device restarted successfully with your new code!", "success");

    } catch(err) {
        logmsg("Process failed: " + err.message, "error");
    }
};
