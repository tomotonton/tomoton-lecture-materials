#include <stdio.h>
#include <string.h>

int main(void) {
    char s[1005];
    int i, len, run;
    scanf("%1000s", s);
    len = (int)strlen(s);
    i = 0;
    while (i < len) {
        run = 1;
        while (i + run < len && s[i + run] == s[i]) {
            run++;
        }
        printf("%c%d", s[i], run);
        i += run;
    }
    printf("\n");
    return 0;
}
