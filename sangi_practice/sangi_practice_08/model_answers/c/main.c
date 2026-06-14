#include <stdio.h>

long long gcd_ll(long long a, long long b) {
    long long t;
    while (b != 0) {
        t = a % b;
        a = b;
        b = t;
    }
    return a;
}

int main(void) {
    int n, i;
    long long a, g, l;
    scanf("%d", &n);
    scanf("%lld", &a);
    g = a;
    l = a;
    for (i = 1; i < n; i++) {
        scanf("%lld", &a);
        g = gcd_ll(g, a);
        l = l / gcd_ll(l, a) * a;
    }
    printf("%lld %lld\n", g, l);
    return 0;
}
