require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

let editor;

// Cargar Monaco Editor
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: `#include "apm32f10x.h"
#include "delay.h"

int main(void) {
    // Configura relojes base automáticamente
    APM32_Init();
    
    // Activar reloj GPIOB
    RCM->APB2CLKEN |= (1 << 3);
    
    // Configurar PB2 como salida Push-Pull (0x3)
    // El puerto B (pines 0 a 7) está controlado por CFGLOW.
    // El pin 2 está desplazado ((pin) * 4) -> 8.
    GPIOB->CFGLOW &= ~(0x0F << 8); // Reset
    GPIOB->CFGLOW |=  (0x03 << 8); // Set a Out_PP 50Hz

    while(1) {
        // Intercambiar estado (Toggle) PB2 usando XOR en Output Data
        GPIOB->ODATA ^= (1 << 2);
        delay_ms(200); // 200 ms
    }
}
`,
        language: 'c',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false }
    });
});

// Configuración Global
const CONFIG = {
    API_URL: window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://apm32-baremetal-backend.onrender.com'
};

const logDiv = document.getElementById('logBox');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const flashBtn = document.getElementById('flashBtn');
const exampleSelector = document.getElementById('exampleSelector');
const downloadBtn = document.getElementById('downloadBtn');

let lastCompiledBinary = null;

const EXAMPLES = {
    blink: `#include "apm32f10x.h"
#include "delay.h"

int main(void) {
    APM32_Init();
    RCM->APB2CLKEN |= (1 << 3); // GPIOB
    GPIOB->CFGLOW &= ~(0x0F << 8); // Reset PB2
    GPIOB->CFGLOW |=  (0x03 << 8); // Out_PP 50Hz
    while(1) {
        GPIOB->ODATA ^= (1 << 2);
        delay_ms(200);
    }
}`,
    timer: `#include "apm32f10x.h"
#include "delay.h"

int main(void) {
    APM32_Init();
    RCM->APB2CLKEN |= (1 << 3); // GPIOB
    GPIOB->CFGLOW &= ~(0x0F << 8);
    GPIOB->CFGLOW |=  (0x03 << 8);
    while(1) {
        GPIOB->ODATA |= (1 << 2);
        delay_ms(1000);
        GPIOB->ODATA &= ~(1 << 2);
        delay_ms(100);
    }
}`,
    registers: `#include "apm32f10x.h"

int main(void) {
    // Basic direct register initialization
    SystemInit();
    RCM->APB2CLKEN |= 0x00000008; // Enable Port B
    GPIOB->CFGLOW = 0x44444344;   // PB2 as Output 50MHz
    while(1) {
        GPIOB->BSCLR = (1 << 2); // Set
        for(int i=0; i<1000000; i++) __NOP();
        GPIOB->BRCLR = (1 << 2); // Reset
        for(int i=0; i<1000000; i++) __NOP();
    }
}`
};

exampleSelector.onchange = () => {
    const val = exampleSelector.value;
    if (EXAMPLES[val]) {
        editor.setValue(EXAMPLES[val]);
        logmsg(`Example '${val}' loaded into editor.`, 'info');
    }
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
        
        const code = editor.getValue();
        const res = await fetch(`${CONFIG.API_URL}/compile`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ mainContent: code })
        });
        
        if(!res.ok) {
            const errLog = await res.json();
            logmsg("Error Reason: " + errLog.details, "error");
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
