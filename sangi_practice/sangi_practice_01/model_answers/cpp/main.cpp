#include <iostream>
using namespace std;

int main() {
    int p, n, m;
    cin >> p >> n >> m;
    int total = p * n;
    int change = m - total;
    cout << total << "\n" << change << "\n";
    return 0;
}
