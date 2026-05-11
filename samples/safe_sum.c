//Safe sum
//Correctly sums values in an array.
//--bounds-check

#include <stdio.h>

int main(){

    int nums[] = {1, 2, 3, 4};

    int total = 0;

    for(int i = 0; i < 4; i++){
        total += nums[i];
    }

    printf("Total: %d\n", total);

    return 0;
}
