import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int p = sc.nextInt(), n = sc.nextInt(), m = sc.nextInt();
        int total = p * n;
        int change = m - total;
        System.out.println(total);
        System.out.println(change);
    }
}
