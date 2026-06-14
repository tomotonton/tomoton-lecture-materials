import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next();
        int i = 0, j = s.length() - 1;
        boolean ok = true;
        while (i < j) {
            if (s.charAt(i) != s.charAt(j)) {
                ok = false;
                break;
            }
            i++;
            j--;
        }
        System.out.println(ok ? "YES" : "NO");
    }
}
