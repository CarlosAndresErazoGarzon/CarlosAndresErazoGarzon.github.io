require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

let editor;

let virtualFS = {
    'src/main.c': `#include "apm32f10x.h"\n#include "apm32_config.h"\n\n/* USER CODE BEGIN Includes */\n/* USER CODE END Includes */\n\nint main(void) {\n    // Configures clocks and selected components\n    APM32_Init();\n    \n    /* USER CODE BEGIN Init */\n    /* USER CODE END Init */\n\n    while(1) {\n        /* USER CODE BEGIN While */\n        GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2\n        delay_ms(500);\n\n        /* USER CODE END While */\n    }\n    \n    return 0;\n}`,
    'src/apm32_config.c': `#include "apm32_config.h"\n\n/* USER CODE BEGIN Includes */\n/* USER CODE END Includes */\n\nvoid APM32_Init(void) {\n    // System Initialization (Main Clocks)\n    SystemInit();\n    \n    // Initialization of selected components\n    SysTick_Init(); // Inicializar timer de delay\n    RCM->APB2CLKEN |= (1 << 3); // Habilitar reloj GPIOB\n    \n    // Configurar LED en PB2 como salida Push-Pull (50MHz)\n    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);\n\n    /* USER CODE BEGIN APM32_Init */\n    /* USER CODE END APM32_Init */\n}\n\n/* USER CODE BEGIN Private Functions */\n/* USER CODE END Private Functions */`,
    'inc/apm32_config.h': `#ifndef APM_CFG\n#define APM_CFG\n#include "apm32f10x.h"\n\nvoid APM32_Init(void);\n\n#endif`,
    'src/delay.c': `#include "delay.h"\n#include "apm32f10x.h"\n\nvolatile uint32_t msTicks = 0;\n\nvoid SysTick_Init(void) {\n    // Update SystemCoreClock variable in case HSE fails and HSI (8MHz) is used\n    SystemCoreClockUpdate();\n    \n    // Configure SysTick for 1ms intervals\n    if (SysTick_Config(SystemCoreClock / 1000)) {\n        while (1); // Error trap\n    }\n    \n    // Set SysTick to the highest priority (0) to prevent delay_ms() from deadlocking\n    NVIC_SetPriority(SysTick_IRQn, 0);\n}\n\nvoid delay_ms(uint32_t ms) {\n    uint32_t start = msTicks;\n    while ((msTicks - start) < ms);\n}\n\nvoid SysTick_Handler(void) {\n    msTicks++;\n}`,
    'inc/delay.h': `#ifndef DELAY_H\n#define DELAY_H\n\n#include <stdint.h>\n\nextern volatile uint32_t msTicks;\n\n// Prototipos\nvoid SysTick_Init(void);\nvoid delay_ms(uint32_t ms);\n\n#endif`
};
let currentFile = 'src/main.c';
let lastCompileMarkers = {};

// Configuración de Temas
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
let isDark = localStorage.getItem('theme') !== 'light';

// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar(show) {
    if (show) {
        sidebar.classList.remove('w-0', 'border-0', 'opacity-0', 'pointer-events-none');
        sidebar.classList.add('w-64', 'border-r', 'lg:border-2');
        if (window.innerWidth < 1024) {
            sidebarOverlay.classList.remove('hidden');
        }
    } else {
        sidebar.classList.add('w-0', 'border-0', 'opacity-0', 'pointer-events-none');
        sidebar.classList.remove('w-64', 'border-r', 'lg:border-2');
        sidebarOverlay.classList.add('hidden');
    }
}

mobileMenuBtn.onclick = () => {
    const isClosed = sidebar.classList.contains('w-0');
    toggleSidebar(isClosed);
};
sidebarOverlay.onclick = () => toggleSidebar(false);

// Inicialización: Abierto por defecto en desktop
if (window.innerWidth >= 1024) {
    sidebar.classList.remove('w-0', 'border-0', '-translate-x-full'); 
    sidebar.classList.add('w-64', 'border-r', 'lg:border-2');
} else {
    toggleSidebar(false);
}

function applyTheme() {
    if (!isDark) {
        document.body.classList.add('light-theme');
        themeIcon.innerHTML = `<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>`;
        if (editor) monaco.editor.setTheme('vs');
    } else {
        document.body.classList.remove('light-theme');
        themeIcon.innerHTML = `<path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"></path>`;
        if (editor) monaco.editor.setTheme('vs-dark');
    }
}

themeToggle.onclick = () => {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
    renderFileList();
};

// Cargar Monaco Editor
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: virtualFS[currentFile],
        language: 'c',
        theme: isDark ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
        fontSize: 14
    });
    applyTheme(); // Asegurar que el tema de monaco coincida
    renderFileList();
    
    // Wake up Render Backend (Free Tier) on load to avoid cold-start delays
    fetch(`${CONFIG.API_URL}/health`).catch(() => {});
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
            
            const cacheBuster = `?t=${Date.now()}`;
            for (const file of exampleDef.files) {
                logmsg(`Loading ${file}...`, "warn");
                const res = await fetch(`examples/${exampleDef.id}/${file}${cacheBuster}`);
                if (!res.ok) throw new Error(`Failed to load ${file}`);
                fetchedFiles[file] = await res.text();
            }
            
            virtualFS = fetchedFiles;
            currentFile = Object.keys(fetchedFiles).find(f => f === 'main.c' || f.endsWith('/main.c')) || Object.keys(fetchedFiles)[0];
            
            if (editor) {
                const model = editor.getModel();
                if (model) {
                    editor.setValue(virtualFS[currentFile]);
                    monaco.editor.setModelLanguage(model, 'c');
                }
                lastCompileMarkers = {};
                monaco.editor.setModelMarkers(editor.getModel(), "compiler", []);
                renderFileList();
            }
            logmsg(`Workspace loaded: ${exampleDef.name}`, 'success');
        } catch (err) {
            logmsg(`Error loading workspace: ${err.message}`, "error");
        } finally {
            exampleSelector.value = "";
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
    if (filename === currentFile) return;
    saveCurrentFile();
    currentFile = filename;
    editor.setValue(virtualFS[filename]);
    
    const ext = filename.split('.').pop();
    const lang = (ext === 'h' || ext === 'c' || ext === 'cpp') ? 'c' : 'plaintext';
    monaco.editor.setModelLanguage(editor.getModel(), lang);
    
    monaco.editor.setModelMarkers(editor.getModel(), "compiler", lastCompileMarkers[filename] || []);
    
    renderFileList();
    if (window.innerWidth < 1024) toggleSidebar(false); // Solo cerrar en mobile/tablet
}
function renderFileList() {
    fileList.innerHTML = '';
    
    // Group files by folder
    const groups = { 'src': [], 'inc': [], 'others': [] };
    for (const filename in virtualFS) {
        if (filename.startsWith('src/')) groups.src.push(filename);
        else if (filename.startsWith('inc/')) groups.inc.push(filename);
        else groups.others.push(filename);
    }

    const renderGroup = (title, files) => {
        if (files.length === 0) return;
        
        const fragment = document.createDocumentFragment();
        
        const header = document.createElement('div');
        header.className = "flex items-center gap-2 text-[9px] font-bold uppercase mt-5 mb-2 px-1 tracking-[0.2em]";
        header.style.color = "var(--header-text)"; // Usar variable de tema
        header.innerHTML = `<span class="w-1.5 h-1.5 rounded-sm" style="background-color: var(--active-border)"></span> ${title}`;
        fragment.appendChild(header);

        files.sort().forEach(filename => {
            const div = document.createElement('div');
            const isActive = filename === currentFile;
            
            div.className = `group p-2.5 cursor-pointer rounded-sm flex justify-between items-center text-xs transition-all duration-200 border-l-2`;
            div.onclick = () => loadFile(filename); // Toda el área es clickeable
            
            // Aplicar estilos según estado activo
            if (isActive) {
                div.style.backgroundColor = "var(--active-bg)";
                div.style.color = "var(--active-text)";
                div.style.borderColor = "var(--active-border)";
                div.style.boxShadow = "inset 4px 0 10px rgba(0,0,0,0.05)";
            } else {
                div.style.backgroundColor = "transparent";
                div.style.color = "var(--sidebar-text)";
                div.style.borderColor = "transparent";
            }

            // Hover effect
            div.onmouseenter = () => { if(!isActive) div.style.backgroundColor = "rgba(100,100,100,0.1)"; };
            div.onmouseleave = () => { if(!isActive) div.style.backgroundColor = "transparent"; };
            
            const displayName = filename.split('/').pop();
            
            const nameContainer = document.createElement('div');
            nameContainer.className = "flex items-center gap-3 overflow-hidden pointer-events-none";
            
            const isH = filename.endsWith('.h');
            const iconColor = isH ? (isDark ? 'text-amber-500' : 'text-amber-600') : (isDark ? 'text-cyan-500' : 'text-cyan-600');
            
            nameContainer.innerHTML = `
                <svg class="w-3.5 h-3.5 flex-shrink-0 ${iconColor} ${isActive ? 'animate-pulse' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path></svg>
                <span class="truncate font-medium tracking-wide">${displayName}</span>
            `;
            div.appendChild(nameContainer);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = "relative flex items-center opacity-0 group-hover:opacity-100 transition-opacity";
            
            const menuBtn = document.createElement('button');
            menuBtn.innerHTML = `
                <svg class="w-4 h-4 text-indigo-400 hover:text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                </svg>`;
            menuBtn.className = "p-1 rounded hover:bg-white/10 transition-colors";
            
            const dropdown = document.createElement('div');
            dropdown.className = "hidden absolute right-0 top-8 w-32 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded shadow-2xl z-50 py-1 backdrop-blur-md file-dropdown";
            
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.file-dropdown').forEach(d => { if(d !== dropdown) d.classList.add('hidden'); });
                dropdown.classList.toggle('hidden');
            };

            const renameOpt = document.createElement('button');
            renameOpt.className = "w-full text-left px-4 py-2 text-[10px] text-[var(--sidebar-text)] hover:bg-indigo-500/10 hover:text-[var(--active-text)] flex items-center uppercase tracking-tight font-bold";
            renameOpt.innerText = `Rename`;
            renameOpt.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.add('hidden');
                let newBase = prompt("Rename to:", displayName);
                if (!newBase || newBase.trim() === displayName) return;
                
                const pathParts = filename.split('/');
                pathParts.pop();
                const folder = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
                const newFilename = folder + newBase.trim();
                
                if (virtualFS[newFilename]) {
                    alert("File already exists!");
                    return;
                }
                
                virtualFS[newFilename] = virtualFS[filename];
                delete virtualFS[filename];
                if (currentFile === filename) currentFile = newFilename;
                renderFileList();
            };
            dropdown.appendChild(renameOpt);

            if (displayName !== 'main.c') {
                const deleteOpt = document.createElement('button');
                deleteOpt.className = "w-full text-left px-4 py-2 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center uppercase tracking-tight font-bold";
                deleteOpt.innerText = `Delete`;
                deleteOpt.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    if(confirm(`Delete ${displayName}?`)) {
                        delete virtualFS[filename];
                        if (currentFile === filename) {
                            const nextFile = Object.keys(virtualFS)[0];
                            loadFile(nextFile);
                        } else {
                            renderFileList();
                        }
                    }
                };
                dropdown.appendChild(deleteOpt);
            }

            actionsDiv.appendChild(menuBtn);
            actionsDiv.appendChild(dropdown);
            div.appendChild(actionsDiv);
            fragment.appendChild(div);
        });
        
        fileList.appendChild(fragment);
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.file-dropdown').forEach(d => d.classList.add('hidden'));
    });

    renderGroup('Source Files (src)', groups.src);
    renderGroup('Header Files (inc)', groups.inc);
    renderGroup('Others', groups.others);
}

newFileBtn.onclick = () => {
    let filename = prompt("Enter file name (e.g., utils.c, config.h):");
    if (!filename) return;
    filename = filename.trim();
    
    // Auto-organize into folders if not specified
    if (!filename.includes('/')) {
        const ext = filename.split('.').pop();
        filename = (ext === 'h') ? 'inc/' + filename : 'src/' + filename;
    }

    if (virtualFS[filename] !== undefined) {
        alert("File already exists!");
        return;
    }
    virtualFS[filename] = '// ' + filename + '\n';
    loadFile(filename);
};

if (downloadBtn) {
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
}

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
    let color = isDark ? '#d4d4d4' : '#1e1b4b';
    if(type === 'error') color = isDark ? '#ff5b5b' : '#991b1b';
    if(type === 'success') color = isDark ? '#a3be8c' : '#065f46';
    if(type === 'warn') color = isDark ? '#ebcb8b' : '#92400e';
    logDiv.innerHTML += `<div style="color: ${color}">>> ${msg}</div>`;
    
    setTimeout(() => {
        logDiv.scrollTop = logDiv.scrollHeight;
    }, 10);
}

let processor = null;

// Unified Link Function (USB + Serial)
const handleLink = async (requestPermissions = true) => {
    if (processor) {
        logmsg("Hardware already linked.", "info");
        return;
    }

    try {
        let device;
        const devices = await navigator.usb.getDevices();
        
        if (devices.length > 0) {
            device = devices[0]; // Auto-select the first known device
            logmsg(`Auto-detected: ${device.productName || 'DAP-Link'}`, 'info');
        } else if (requestPermissions) {
            logmsg("Requesting USB permissions...", 'warn');
            device = await navigator.usb.requestDevice({
                filters: [
                    { classCode: 255 },
                    { vendorId: 0x0D28 }
                ]
            });
        }

        if (!device) return;

        const transport = new DAPjs.WebUSB(device);
        processor = new DAPjs.CortexM(transport, 0, 1000000); 
        
        await processor.connect();
        logmsg(`Connected to USB Support`, 'success');
        
        flashBtn.disabled = false;
        disconnectBtn.classList.remove('hidden');
        flashBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        // Sequence Serial initialization
        setTimeout(async () => {
            await handleSerialConnect(requestPermissions);
        }, 300);

    } catch(err) {
        if (requestPermissions) {
            logmsg("Connection error: " + err.message, 'error');
        }
    }
};

connectBtn.onclick = (e) => {
    if (e) e.stopPropagation();
    handleLink(true);
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

// Documentation Logic
const docsModal = document.getElementById('docsModal');
const showDocsBtn = document.getElementById('showDocsBtn');
const closeDocsBtn = document.getElementById('closeDocsBtn');
const docContent = document.getElementById('docContent');

showDocsBtn.onclick = () => {
    docsModal.classList.remove('hidden');
    loadDoc('PINOUT_APM32.md');
};
closeDocsBtn.onclick = () => docsModal.classList.add('hidden');

async function loadDoc(file, el) {
    // Handle tab styling
    if (el) {
        document.querySelectorAll('.doc-tab').forEach(tab => tab.classList.remove('active'));
        el.classList.add('active');
    }

    try {
        docContent.innerHTML = "<div class='text-center py-10 opacity-50 uppercase tracking-widest text-xs animate-pulse font-mono'>Decrypting Reference...</div>";
        const res = await fetch(`docs/${file}`);
        let md = await res.text();
        
        // Rewrite image paths to point to docs/img/ correctly
        md = md.replace(/\.\/img\//g, 'docs/img/');
        
        docContent.innerHTML = `<article class='prose prose-invert'>${marked.parse(md)}</article>`;
    } catch(err) {
        docContent.innerHTML = "<div class='text-red-400 font-bold'>Error loading documentation. Please ensure the backend is running.</div>";
    }
}

// Random ASCII Title Logic
const fonts = [
    'ansi_compact.txt', 'ansi_regular.txt', 'ansi_shadow.txt', 'big_money.txt', 
    'big_money_ne.txt', 'big_money_nw.txt', 'big_money_se.txt', 'big_money_sw.txt', 
    'diam_font.txt', 'dos.txt', 'emboss.txt', 'emboss2.txt', 'future.txt', 
    'hex.txt', 'larry_3d.txt', 'lean.txt', 'morse.txt', 'old_banner.txt', 
    'os2.txt', 'pagga.txt', 'pawp.txt', 'rowan.txt', 'rubiFont.txt', 
    'shadow.txt', 'speed.txt', 'star_strips.txt', 'terrance.txt', 
    'ticks.txt', 'ticks2.txt'
];

async function initTitle() {
    const titleEl = document.getElementById('projectTitle');
    if (!titleEl) return;
    
    try {
        const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
        const res = await fetch(`fonts/${randomFont}`);
        if (!res.ok) throw new Error();
        const art = await res.text();
        titleEl.textContent = art.trimRight();
    } catch (err) {
        titleEl.textContent = "APM32_STATION";
        titleEl.classList.add('text-lg', 'lg:text-xl');
    }
}

// Global Initialization
window.addEventListener('DOMContentLoaded', () => {
    initTitle();
});

// Web Serial Logic
const terminalPane = document.getElementById('terminalPane');
const toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
const openTerminalBtn = document.getElementById('openTerminalBtn');
const serialOutput = document.getElementById('serialOutput');
const serialConnectBtn = document.getElementById('serialConnectBtn');
const baudRateSelect = document.getElementById('baudRate');
const serialClearBtn = document.getElementById('serialClearBtn');
const serialStatusLed = document.getElementById('serialStatusLed');
const serialInputField = document.getElementById('serialInput');
const serialSendBtn = document.getElementById('serialSendBtn');

const toggleTerminal = () => {
    const isClosed = terminalPane.classList.contains('h-8');
    if (isClosed) {
        terminalPane.classList.remove('h-8');
        terminalPane.classList.add('h-48');
        toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(0deg)';
    } else {
        terminalPane.classList.remove('h-48');
        terminalPane.classList.add('h-8');
        toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(180deg)';
    }
};

const terminalHeader = document.getElementById('terminalHeader');
if (terminalHeader) terminalHeader.onclick = toggleTerminal;
if (openTerminalBtn) openTerminalBtn.onclick = toggleTerminal;
if (toggleTerminalBtn) toggleTerminalBtn.onclick = toggleTerminal;

let serialPort = null;
let serialReader = null;

serialClearBtn.onclick = () => { serialOutput.innerHTML = ''; };

const updateSerialLed = (connected) => {
    if (connected) {
        serialStatusLed.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-300';
    } else {
        serialStatusLed.className = 'w-2.5 h-2.5 rounded-full bg-slate-600 shadow-[0_0_5px_rgba(71,85,105,0.5)] transition-all duration-300';
    }
};

const handleSerialDisconnect = async () => {
    if (serialPort) {
        if (serialReader) {
            await serialReader.cancel();
            serialReader = null;
        }
        await serialPort.close();
        serialPort = null;
        serialConnectBtn.innerText = 'Connect';
        serialConnectBtn.classList.remove('text-red-400');
        updateSerialLed(false);
    }
};

const handleSerialConnect = async () => {
    if (serialPort) {
        await handleSerialDisconnect();
        return;
    }

    try {
        // Auto-detect if already authorized to avoid double-prompt if possible
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
            serialPort = ports[0];
            logmsg("Port auto-detected via saved permissions.", "success");
        } else {
            logmsg("Requesting Serial permissions (Browser Security)...", 'warn');
            serialPort = await navigator.serial.requestPort();
        }

        const baudRate = parseInt(baudRateSelect.value);
        await serialPort.open({ baudRate });
        
        serialConnectBtn.innerText = 'Disconnect';
        serialConnectBtn.classList.add('text-red-400');
        updateSerialLed(true);
        
        // Auto-show terminal
        terminalPane.classList.remove('h-8');
        terminalPane.classList.add('h-48');
        toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(0deg)';

        const decoder = new TextDecoderStream();
        const inputDone = serialPort.readable.pipeTo(decoder.writable);
        serialReader = decoder.readable.getReader();

        while (true) {
            const { value, done } = await serialReader.read();
            if (done) break;
            if (value) {
                serialOutput.innerText += value;
                serialOutput.scrollTop = serialOutput.scrollHeight;
            }
        }
    } catch (err) {
        logmsg("Serial Error: " + err.message, "error");
        updateSerialLed(false);
    }
};

serialConnectBtn.onclick = handleSerialConnect;

const sendSerialData = async () => {
    if (!serialPort || !serialPort.writable) {
        logmsg("Serial not connected or not writable", "error");
        return;
    }
    const text = serialInputField.value;
    if (!text) return;

    const encoder = new TextEncoder();
    const writer = serialPort.writable.getWriter();
    await writer.write(encoder.encode(text + '\n'));
    writer.releaseLock();
    serialInputField.value = '';
};

if (serialSendBtn) serialSendBtn.onclick = (e) => { e.stopPropagation(); sendSerialData(); };
if (serialInputField) {
    serialInputField.onclick = (e) => e.stopPropagation();
    serialInputField.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') sendSerialData();
    };
}

// Removed redundant connectBtn override since it's consolidated above

// Update disconnectBtn to also handle Serial
const originalDisconnectBtnClick = disconnectBtn.onclick;
disconnectBtn.onclick = async (e) => {
    if (e) e.stopPropagation();
    await originalDisconnectBtnClick();
    await handleSerialDisconnect();
};

// Prevent header toggle when clicking controls
[baudRateSelect, serialConnectBtn, serialClearBtn].forEach(el => {
    if (el) el.addEventListener('click', (e) => e.stopPropagation());
});

// Auto-Link Trigger on Load
window.addEventListener('load', () => {
    setTimeout(() => {
        handleLink(false); // Try silent link (no prompts)
    }, 1000);
});
