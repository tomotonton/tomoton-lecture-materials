#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    cin >> s;
    int cnt = 0;
    for (char c : s) {
        if (c == 'a' || c == 'i' || c == 'u' || c == 'e' || c == 'o') {
            cnt++;
        }
    }
    cout << cnt << "\n";
    return 0;
}
