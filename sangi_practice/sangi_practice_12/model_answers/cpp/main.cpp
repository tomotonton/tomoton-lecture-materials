#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    int n, w;
    cin >> n >> w;
    vector<int> dp(w + 1, 0);
    for (int i = 0; i < n; i++) {
        int cost, value;
        cin >> cost >> value;
        for (int j = w; j >= cost; j--) {
            dp[j] = max(dp[j], dp[j - cost] + value);
        }
    }
    cout << dp[w] << "\n";
    return 0;
}
