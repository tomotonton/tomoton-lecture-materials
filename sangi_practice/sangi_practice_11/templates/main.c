#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n, i;
    long long s, e;
    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%lld %lld", &s, &e);
        /* ここでイベント（開始 +1 / 終了 -1）として記録する */
    }

    /* ここでイベントを並べ替えて、最大重なり数を求めて出力する */

    return 0;
}
