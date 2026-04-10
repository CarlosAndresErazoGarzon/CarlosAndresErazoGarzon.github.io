#include "apm32f10x.h"
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
