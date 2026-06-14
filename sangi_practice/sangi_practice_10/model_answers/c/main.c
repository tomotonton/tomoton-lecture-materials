#include <stdio.h>

int main(void) {
    static char grid[55][55];
    static int dist[55][55];
    static int qr[2600], qc[2600];
    int dr[4] = {-1, 1, 0, 0};
    int dc[4] = {0, 0, -1, 1};
    int h, w, i, j, sr, sc, gr, gc, head, tail, r, c, nr, nc, k;
    scanf("%d %d", &h, &w);
    for (i = 0; i < h; i++) {
        scanf("%s", grid[i]);
    }
    sr = 0; sc = 0; gr = 0; gc = 0;
    for (i = 0; i < h; i++) {
        for (j = 0; j < w; j++) {
            dist[i][j] = -1;
            if (grid[i][j] == 'S') { sr = i; sc = j; }
            if (grid[i][j] == 'G') { gr = i; gc = j; }
        }
    }
    head = 0; tail = 0;
    qr[tail] = sr; qc[tail] = sc; tail++;
    dist[sr][sc] = 0;
    while (head < tail) {
        r = qr[head]; c = qc[head]; head++;
        for (k = 0; k < 4; k++) {
            nr = r + dr[k];
            nc = c + dc[k];
            if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
            if (grid[nr][nc] == '#') continue;
            if (dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            qr[tail] = nr; qc[tail] = nc; tail++;
        }
    }
    printf("%d\n", dist[gr][gc]);
    return 0;
}
