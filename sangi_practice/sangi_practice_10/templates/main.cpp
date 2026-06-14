#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    int h, w;
    cin >> h >> w;
    vector<string> g(h);
    for (int i = 0; i < h; i++) cin >> g[i];

    // ここで BFS を行い、最短歩数（到達不可なら -1）を出力する

    return 0;
}
