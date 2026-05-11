//Signed integer overflow
//Adding to INT_MAX causes signed integer overflow.
//--signed-overflow-check

#include <stdio.h>
#include <limits.h>

//Add two large integers
int add(int a, int b){
    return a + b;   //BUG HERE. SIGNED INTEGER OVERFLOW
}

int main(){

    int result = add(INT_MAX, 1);

    printf("Result: %d", result);

    return 0;
}
