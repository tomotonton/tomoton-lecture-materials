#include <stdio.h>

static int mn(int x, int y) { return x < y ? x : y; }
static int mx(int x, int y) { return x > y ? x : y; }

int main(void) {
    int a, b, c, median;
    scanf("%d %d %d", &a, &b, &c);
    /* 最大値でも最小値でもない値が中央値 */
    median = mx(mn(a, b), mn(mx(a, b), c));
    printf("%d\n", median);
    return 0;
}
