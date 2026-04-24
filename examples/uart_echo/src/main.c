#include "apm32_config.h"
#include "delay.h"
#include "uart.h"
#include <stdio.h>

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();
    
    printf("\r\n==================================\r\n");
    printf("   SISTEMA MODULAR APM32 OK       \r\n");
    printf("==================================\r\n");
    printf("Escribe algo y presiona SEND...\r\n");

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        /* Lógica de ECO (Instantánea) */
        if (UART_Available()) {
            uint8_t c = UART_Rx();
            
            // Re-enviamos el caracter recibido (Eco)
            UART_Tx(c);
            
            // Si es un retorno de carro, bajamos de línea
            if (c == '\r') UART_Tx('\n');
        }

        /* Lógica de Blink (No bloqueante) */
        // Comparación de tiempo con msTicks
        extern volatile uint32_t msTicks;
        static uint32_t last_blink = 0;
        
        if ((msTicks - last_blink) >= 2000) { // Cada 2 segundos
            last_blink = msTicks;
            GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2
            printf("\r\n[STATUS] Sistema Activo | Tiempo: %lu ms\r\n", msTicks);
        }

        /* USER CODE BEGIN While */
        /* USER CODE END While */
        
    }
}
