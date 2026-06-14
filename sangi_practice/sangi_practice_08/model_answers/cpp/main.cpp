#include <iostream>
using namespace std;

long long gcd_ll(long long a, long long b) {
    while (b != 0) {
        long long t = a % b;
        a = b;
        b = t;
    }
    return a;
}

int main() {
    int n;
    cin >> n;
    long long a;
    cin >> a;
    long long g = a, l = a;
    for (int i = 1; i < n; i++) {
        cin >> a;
        g = gcd_ll(g, a);
        l = l / gcd_ll(l, a) * a;
    }
    cout << g << " " << l << "\n";
    return 0;
}
