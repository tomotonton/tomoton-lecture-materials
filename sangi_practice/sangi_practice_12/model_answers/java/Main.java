import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt(), w = sc.nextInt();
        int[] dp = new int[w + 1];
        for (int i = 0; i < n; i++) {
            int cost = sc.nextInt(), value = sc.nextInt();
            for (int j = w; j >= cost; j--) {
                dp[j] = Math.max(dp[j], dp[j - cost] + value);
            }
        }
        System.out.println(dp[w]);
    }
}
