#include <iostream>
using namespace std;

int main() {
    int p, d, t;
    cin >> p >> d >> t;
    int discounted = p * (100 - d) / 100;
    int total = discounted * (100 + t) / 100;
    cout << total << "\n";
    return 0;
}
