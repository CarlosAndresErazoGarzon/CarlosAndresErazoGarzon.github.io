#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();
    
    // LEDs: PB12, PB13, PB14, PB15 (Bits 16 to 31 in CFGHIG) -> 50MHz Outputs (0x3)
    // Clear configuration for top pins and set as Output PP 50MHz
    GPIOB->CFGHIG &= 0x0000FFFF; 
    GPIOB->CFGHIG |= 0x33330000;

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        
        // Turn off all sequential LEDs
        GPIOB->ODATA &= ~((1 << 12) | (1 << 13) | (1 << 14) | (1 << 15));
        delay_ms(500);

        // Sequential activation
        GPIOB->ODATA |= (1 << 12);
        delay_ms(500);

        GPIOB->ODATA |= (1 << 13);
        delay_ms(500);

        GPIOB->ODATA |= (1 << 14);
        delay_ms(500);

        GPIOB->ODATA |= (1 << 15);
        delay_ms(500);

        // Heartbeat LED PB2
        GPIOB->ODATA ^= (1 << 2);

        /* USER CODE BEGIN While */
        /* USER CODE END While */
    }
    
    return 0;
}
