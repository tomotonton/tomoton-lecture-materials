#include <iostream>
#include <vector>
#include <string>
#include <queue>
using namespace std;

int main() {
    int h, w;
    cin >> h >> w;
    vector<string> g(h);
    for (int i = 0; i < h; i++) cin >> g[i];
    vector<vector<int>> dist(h, vector<int>(w, -1));
    int sr = 0, sc = 0, gr = 0, gc = 0;
    for (int i = 0; i < h; i++) {
        for (int j = 0; j < w; j++) {
            if (g[i][j] == 'S') { sr = i; sc = j; }
            if (g[i][j] == 'G') { gr = i; gc = j; }
        }
    }
    int dr[4] = {-1, 1, 0, 0};
    int dc[4] = {0, 0, -1, 1};
    queue<pair<int,int>> q;
    q.push({sr, sc});
    dist[sr][sc] = 0;
    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int k = 0; k < 4; k++) {
            int nr = r + dr[k], nc = c + dc[k];
            if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
            if (g[nr][nc] == '#') continue;
            if (dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            q.push({nr, nc});
        }
    }
    cout << dist[gr][gc] << "\n";
    return 0;
}
