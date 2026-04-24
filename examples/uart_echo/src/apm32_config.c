#include "apm32_config.h"
#include "delay.h"
#include "uart.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();
    
    // Initialization of selected components
    SysTick_Init(); // Initialize delay timer
    RCM->APB2CLKEN |= (1 << 3); // Enable GPIOB clock
    
    // Configure PB2 (LED) as Push-Pull output (50MHz)
    GPIOB->CFGLOW &= ~(0x0F << 8);
    GPIOB->CFGLOW |= (0x03 << 8); 

    // Initialize UART at 115200 baud
    UART_Init(115200);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
