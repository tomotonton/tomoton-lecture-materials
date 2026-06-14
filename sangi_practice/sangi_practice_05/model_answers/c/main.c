#include <stdio.h>

int main(void) {
    int n, cnt;
    cnt = 0;
    scanf("%d", &n);
    while (n > 0) {
        cnt += n & 1;
        n >>= 1;
    }
    printf("%d\n", cnt);
    return 0;
}
