#include <stdio.h>
#include <stdlib.h>

typedef struct { long long x; int d; } Event;

int cmp(const void *a, const void *b) {
    const Event *ea = (const Event *)a;
    const Event *eb = (const Event *)b;
    if (ea->x != eb->x) {
        return (ea->x < eb->x) ? -1 : 1;
    }
    return ea->d - eb->d;   /* 同じ座標では終了(-1)を開始(+1)より先に */
}

int main(void) {
    static Event ev[2005];
    int n, i, cur, best;
    long long s, e;
    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%lld %lld", &s, &e);
        ev[2 * i].x = s;      ev[2 * i].d = 1;
        ev[2 * i + 1].x = e;  ev[2 * i + 1].d = -1;
    }
    qsort(ev, 2 * n, sizeof(Event), cmp);
    cur = 0;
    best = 0;
    for (i = 0; i < 2 * n; i++) {
        cur += ev[i].d;
        if (cur > best) best = cur;
    }
    printf("%d\n", best);
    return 0;
}
