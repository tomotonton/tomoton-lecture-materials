#include <stdio.h>

int main(void) {
    int p, d, t, discounted, total;
    scanf("%d %d %d", &p, &d, &t);
    discounted = p * (100 - d) / 100;   /* 先に割引（切り捨て） */
    total = discounted * (100 + t) / 100; /* そのあと税（切り捨て） */
    printf("%d\n", total);
    return 0;
}
