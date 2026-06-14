#include <stdio.h>

int main(void) {
    int p, n, m, total, change;
    scanf("%d %d %d", &p, &n, &m);
    total = p * n;
    change = m - total;
    printf("%d\n%d\n", total, change);
    return 0;
}
