#include "apm32_config.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();
    
    // Initialization of selected components
    SysTick_Init(); // Inicializar timer de delay
    RCM->APB2CLKEN |= (1 << 3); // Habilitar reloj GPIOB
    
    // Configurar LED en PB2 como salida Push-Pull (50MHz)
    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
