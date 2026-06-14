#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    int a, b, c;
    cin >> a >> b >> c;
    int median = max(min(a, b), min(max(a, b), c));
    cout << median << "\n";
    return 0;
}
