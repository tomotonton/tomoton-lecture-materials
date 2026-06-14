#include <stdio.h>

int main(void) {
    static int dp[10005];
    int n, w, i, j, cost, value;
    scanf("%d %d", &n, &w);
    for (i = 0; i <= w; i++) {
        dp[i] = 0;
    }
    for (i = 0; i < n; i++) {
        scanf("%d %d", &cost, &value);
        for (j = w; j >= cost; j--) {
            if (dp[j - cost] + value > dp[j]) {
                dp[j] = dp[j - cost] + value;
            }
        }
    }
    printf("%d\n", dp[w]);
    return 0;
}
