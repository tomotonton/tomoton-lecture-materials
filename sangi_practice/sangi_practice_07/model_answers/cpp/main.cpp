#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    cin >> s;
    int i = 0, j = (int)s.size() - 1;
    bool ok = true;
    while (i < j) {
        if (s[i] != s[j]) {
            ok = false;
            break;
        }
        i++;
        j--;
    }
    cout << (ok ? "YES" : "NO") << "\n";
    return 0;
}
