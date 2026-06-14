#include <stdio.h>

int main(void) {
    char s[1005];
    int i, cnt, c;
    cnt = 0;
    scanf("%1000s", s);
    for (i = 0; s[i] != '\0'; i++) {
        c = s[i];
        if (c == 'a' || c == 'i' || c == 'u' || c == 'e' || c == 'o') {
            cnt++;
        }
    }
    printf("%d\n", cnt);
    return 0;
}
