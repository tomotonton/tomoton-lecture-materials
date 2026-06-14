import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next();
        int n = s.length();
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < n) {
            int run = 1;
            while (i + run < n && s.charAt(i + run) == s.charAt(i)) {
                run++;
            }
            sb.append(s.charAt(i)).append(run);
            i += run;
        }
        System.out.println(sb.toString());
    }
}
