import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int h = sc.nextInt(), w = sc.nextInt();
        char[][] g = new char[h][];
        for (int i = 0; i < h; i++) g[i] = sc.next().toCharArray();
        int[][] dist = new int[h][w];
        for (int[] row : dist) Arrays.fill(row, -1);
        int sr = 0, scol = 0, gr = 0, gc = 0;
        for (int i = 0; i < h; i++) {
            for (int j = 0; j < w; j++) {
                if (g[i][j] == 'S') { sr = i; scol = j; }
                if (g[i][j] == 'G') { gr = i; gc = j; }
            }
        }
        int[] dr = {-1, 1, 0, 0};
        int[] dc = {0, 0, -1, 1};
        ArrayDeque<int[]> q = new ArrayDeque<>();
        q.add(new int[]{sr, scol});
        dist[sr][scol] = 0;
        while (!q.isEmpty()) {
            int[] cur = q.poll();
            int r = cur[0], c = cur[1];
            for (int k = 0; k < 4; k++) {
                int nr = r + dr[k], nc = c + dc[k];
                if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
                if (g[nr][nc] == '#') continue;
                if (dist[nr][nc] != -1) continue;
                dist[nr][nc] = dist[r][c] + 1;
                q.add(new int[]{nr, nc});
            }
        }
        System.out.println(dist[gr][gc]);
    }
}
