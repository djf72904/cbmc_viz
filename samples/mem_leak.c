//Forgetting to free
//Dynamically allocated memory is never freed.
//--memory-leak-check

#include <stdio.h>
#include <stdlib.h>

int main(){

    //Allocate memory
    int *ptr = malloc(sizeof(int));

    *ptr = 42;

    printf("Value: %d", *ptr);

    //BUG HERE. MEMORY NEVER FREED

    return 0;
}
