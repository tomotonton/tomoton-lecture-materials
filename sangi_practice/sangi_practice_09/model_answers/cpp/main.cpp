#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    cin >> s;
    int n = (int)s.size();
    int i = 0;
    while (i < n) {
        int run = 1;
        while (i + run < n && s[i + run] == s[i]) {
            run++;
        }
        cout << s[i] << run;
        i += run;
    }
    cout << "\n";
    return 0;
}
