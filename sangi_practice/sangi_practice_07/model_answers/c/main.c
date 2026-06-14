#include <stdio.h>
#include <string.h>

int main(void) {
    char s[1005];
    int i, j, ok;
    scanf("%1000s", s);
    i = 0;
    j = (int)strlen(s) - 1;
    ok = 1;
    while (i < j) {
        if (s[i] != s[j]) {
            ok = 0;
            break;
        }
        i++;
        j--;
    }
    printf("%s\n", ok ? "YES" : "NO");
    return 0;
}
