import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int p = sc.nextInt(), d = sc.nextInt(), t = sc.nextInt();
        int discounted = p * (100 - d) / 100;
        int total = discounted * (100 + t) / 100;
        System.out.println(total);
    }
}
