import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int h = sc.nextInt(), w = sc.nextInt();
        char[][] g = new char[h][];
        for (int i = 0; i < h; i++) g[i] = sc.next().toCharArray();

        // ここで BFS を行い、最短歩数（到達不可なら -1）を出力する
    }
}
