//Multiple issues
//Program contains both a divide-by-zero and a memory leak.
//--div-by-zero-check,--memory-leak-check

#include <stdio.h>
#include <stdlib.h>

//Calculate average
int average(int total, int count){
    return total / count;   //BUG HERE. DIVIDE BY ZERO
}

int main(){

    //Allocate memory for 3 integers
    int *scores = malloc(3 * sizeof(int));

    scores[0] = 80;
    scores[1] = 90;
    scores[2] = 100;

    //Calculate total
    int total = scores[0] + scores[1] + scores[2];

    //BUG HERE. COUNT SHOULD NOT BE ZERO
    int avg = average(total, 0);

    printf("Average: %d\n", avg);

    //BUG HERE. MEMORY NEVER FREED

    return 0;
}
