import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next();
        int cnt = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == 'a' || c == 'i' || c == 'u' || c == 'e' || c == 'o') {
                cnt++;
            }
        }
        System.out.println(cnt);
    }
}
