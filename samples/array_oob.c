//Array out-of-bounds
//Off-by-one in a `for (i = 0; i <= N; i++)` loop.
//--bounds-check

#include <stdio.h>

//Create array of size 5
int array[] = {1, 2, 3, 4, 5};

//Sum all items in array
int sum() {
    unsigned i, total = 0;

    for(i=0; i<=5; i++){
        total+=array[i];    //BUG HERE. GOING PAST ARRAY BOUNDS
    }
    return total;
}

int main(){
    //Call buggy sum function
    int total = sum();

    printf("Sum: %u", total);

    return 0;
}
