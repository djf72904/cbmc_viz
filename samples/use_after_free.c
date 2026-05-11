//Use already freed memory
//Pointer is dereferenced after allocated memory is freed.
//--pointer-check

#include <stdio.h>
#include <stdlib.h>

int main(){

    //Allocate memory
    int *ptr = malloc(sizeof(int));

    *ptr = 10;

    //Free memory
    free(ptr);

    //BUG HERE. USING MEMORY AFTER FREE
    printf("Value: %d", *ptr);

    return 0;
}
