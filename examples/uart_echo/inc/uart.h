#ifndef UART_H
#define UART_H

#include "apm32f10x.h"
#include <stdint.h>


void UART_Init(uint32_t baudrate);
void UART_Tx(char c);
void UART_SendString(const char *msg);
uint8_t UART_Available(void);
uint8_t UART_Rx(void);

#endif
