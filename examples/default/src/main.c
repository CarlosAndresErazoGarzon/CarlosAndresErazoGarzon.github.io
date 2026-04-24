#include "apm32f10x.h"
#include "apm32_config.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();
    
    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2
        delay_ms(500);

        /* USER CODE BEGIN While */
        /* USER CODE END While */
    }
    
    return 0;
}
