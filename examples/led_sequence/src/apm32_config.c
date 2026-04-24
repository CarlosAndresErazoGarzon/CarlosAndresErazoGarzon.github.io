#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();
    
    // Initialization of selected components
    SysTick_Init(); // Initialize delay timer
    RCM->APB2CLKEN |= (1 << 3); // Enable GPIOB clock
    
    // Configure LED on PB2 as Push-Pull output (50MHz)
    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
