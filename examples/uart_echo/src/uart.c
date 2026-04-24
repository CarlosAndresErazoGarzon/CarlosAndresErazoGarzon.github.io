#include "uart.h"

extern uint32_t SystemCoreClock;

void UART_Init(uint32_t baudrate) {
    // Activar Relojes RCM
    RCM->APB2CLKEN |= (1 << 2) | (1 << 14);

    // Configurar Pines (PA9 = AF-PP, PA10 = Input)
    GPIOA->CFGHIG &= ~(0xFF << 4); 
    GPIOA->CFGHIG |= (0x0B << 4);  
    GPIOA->CFGHIG |= (0x04 << 8);  

    // Configurar Baudrate dinámico 
    USART1->BR = SystemCoreClock / baudrate;

    // Habilitar USART1 (UE, TE, RE)
    USART1->CTRL1 = (1 << 13) | (1 << 3) | (1 << 2);
}

void UART_Tx(char c) {
    while (!(USART1->STS & (1 << 7))); 
    USART1->DATA = (uint16_t)c;
}

void UART_SendString(const char *msg) {
    while(*msg) UART_Tx(*msg++);
}

uint8_t UART_Available(void) {
    // RXBNE (bit 5): 1 si hay un dato nuevo
    return (USART1->STS & (1 << 5)) ? 1 : 0;
}

uint8_t UART_Rx(void) {
    return (uint8_t)USART1->DATA;
}

int _write(int file, char *ptr, int len) {
    for (int i = 0; i < len; i++) {
        UART_Tx(ptr[i]);
    }
    return len;
}
