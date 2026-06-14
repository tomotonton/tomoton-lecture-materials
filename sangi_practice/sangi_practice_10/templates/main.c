#include <stdio.h>

int main(void) {
    static char grid[55][55];
    int h, w, i;
    scanf("%d %d", &h, &w);
    for (i = 0; i < h; i++) {
        scanf("%s", grid[i]);
    }

    /* ここで BFS を行い、最短歩数（到達不可なら -1）を出力する */

    return 0;
}
