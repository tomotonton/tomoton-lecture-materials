#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<pair<long long,int>> ev;
    for (int i = 0; i < n; i++) {
        long long s, e;
        cin >> s >> e;
        ev.push_back({s, 1});
        ev.push_back({e, -1});
    }
    sort(ev.begin(), ev.end());   // 座標昇順、同座標なら -1 が先
    int cur = 0, best = 0;
    for (auto &p : ev) {
        cur += p.second;
        best = max(best, cur);
    }
    cout << best << "\n";
    return 0;
}
