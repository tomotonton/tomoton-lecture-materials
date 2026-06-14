import java.util.Scanner;

public class Main {
    static long gcd(long a, long b) {
        while (b != 0) {
            long t = a % b;
            a = b;
            b = t;
        }
        return a;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long a = sc.nextLong();
        long g = a, l = a;
        for (int i = 1; i < n; i++) {
            a = sc.nextLong();
            g = gcd(g, a);
            l = l / gcd(l, a) * a;
        }
        System.out.println(g + " " + l);
    }
}
