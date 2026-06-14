import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long[][] ev = new long[2 * n][2];
        for (int i = 0; i < n; i++) {
            long s = sc.nextLong(), e = sc.nextLong();
            ev[2 * i][0] = s;     ev[2 * i][1] = 1;
            ev[2 * i + 1][0] = e; ev[2 * i + 1][1] = -1;
        }
        Arrays.sort(ev, (a, b) -> a[0] != b[0] ? Long.compare(a[0], b[0]) : Long.compare(a[1], b[1]));
        int cur = 0, best = 0;
        for (long[] p : ev) {
            cur += (int) p[1];
            if (cur > best) best = cur;
        }
        System.out.println(best);
    }
}
