//Division by zero
//Division operation performed with a zero divisor.
//--div-by-zero-check

#include <stdio.h>

//Divide two numbers
int divide(int a, int b){
    return a / b;   //BUG HERE. DIVIDING BY ZERO
}

int main(){

    int result = divide(10, 0);

    printf("Result: %d", result);

    return 0;
}
