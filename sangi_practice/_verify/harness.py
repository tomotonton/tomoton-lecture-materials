#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
サンギハッカソン対策 練習問題の検証ハーネス。

各 sangi_practice_NN/ について:
  1. model_answers/c/main.c   を MSVC(cl) でコンパイル
  2. model_answers/cpp/main.cpp を MSVC(cl) でコンパイル
  3. model_answers/java/Main.java を javac でコンパイル
  4. test_cases/*.in を各言語の実行体に流し込み、標準出力を取得
  5. C の出力を正本として .out を生成（--gen 時）または既存 .out と照合
  6. C / C++ / Java の出力が「単語単位（空白区切り・浮動小数点は誤差許容）」で
     すべて一致するか検証

使い方（必ず run_tests.bat 経由で。vcvars 済み環境が必要）:
  run_tests.bat            … 既存 .out と照合して検証
  run_tests.bat --gen      … C モデルから .out を生成し直してから検証
  run_tests.bat 03 07      … 指定番号だけ検証
"""
import os, sys, subprocess, shutil, tempfile, glob

# Windows コンソールでも日本語・記号(✓✗🎉)を出せるよう stdout を UTF-8 に固定
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # sangi_practice/
GEN = "--gen" in sys.argv
ONLY = [a.zfill(2) for a in sys.argv[1:] if a.isdigit()]

GREEN, RED, YEL, DIM, RST = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"

def normalize(raw_bytes):
    t = raw_bytes.decode("utf-8", errors="replace")
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.rstrip() for ln in t.split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)

def tok_equal(a, b):
    """単語単位比較。各トークンが数値なら誤差許容で比較。"""
    ta, tb = a.split(), b.split()
    if len(ta) != len(tb):
        return False
    for x, y in zip(ta, tb):
        if x == y:
            continue
        try:
            fx, fy = float(x), float(y)
        except ValueError:
            return False
        if abs(fx - fy) > 1e-6 * max(1.0, abs(fx), abs(fy)):
            return False
    return True

def run(exe_cmd, stdin_bytes):
    p = subprocess.run(exe_cmd, input=stdin_bytes, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, timeout=15)
    return normalize(p.stdout), p.returncode, p.stderr.decode("utf-8", "replace")

def compile_all(pdir, build):
    """戻り値: dict(lang -> 実行コマンド list) と エラーメッセージ list"""
    errors = []
    runners = {}
    # ASCII パスの一時ディレクトリにコピーしてからコンパイル（日本語パス回避）
    c_src   = os.path.join(pdir, "model_answers", "c", "main.c")
    cpp_src = os.path.join(pdir, "model_answers", "cpp", "main.cpp")
    java_src= os.path.join(pdir, "model_answers", "java", "Main.java")

    if os.path.exists(c_src):
        dst = os.path.join(build, "main.c"); shutil.copyfile(c_src, dst)
        exe = os.path.join(build, "c_main.exe")
        r = subprocess.run(["cl", "/nologo", "/O2", "/D_CRT_SECURE_NO_WARNINGS",
                            "/Fe:" + exe, "/Fo:" + build + os.sep, dst],
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=build)
        if r.returncode != 0 or not os.path.exists(exe):
            errors.append("C コンパイル失敗:\n" + r.stdout.decode("utf-8", "replace"))
        else:
            runners["C"] = [exe]
    else:
        errors.append("C モデルが無い: " + c_src)

    if os.path.exists(cpp_src):
        dst = os.path.join(build, "main.cpp"); shutil.copyfile(cpp_src, dst)
        exe = os.path.join(build, "cpp_main.exe")
        r = subprocess.run(["cl", "/nologo", "/O2", "/EHsc", "/std:c++17",
                            "/Fe:" + exe, "/Fo:" + build + os.sep, dst],
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=build)
        if r.returncode != 0 or not os.path.exists(exe):
            errors.append("C++ コンパイル失敗:\n" + r.stdout.decode("utf-8", "replace"))
        else:
            runners["C++"] = [exe]
    else:
        errors.append("C++ モデルが無い: " + cpp_src)

    if os.path.exists(java_src):
        jb = os.path.join(build, "java"); os.makedirs(jb, exist_ok=True)
        dst = os.path.join(jb, "Main.java"); shutil.copyfile(java_src, dst)
        r = subprocess.run(["javac", "-d", jb, dst],
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if r.returncode != 0 or not os.path.exists(os.path.join(jb, "Main.class")):
            errors.append("Java コンパイル失敗:\n" + r.stdout.decode("utf-8", "replace"))
        else:
            runners["Java"] = ["java", "-cp", jb, "Main"]
    else:
        errors.append("Java モデルが無い: " + java_src)

    return runners, errors

def main():
    pdirs = sorted(glob.glob(os.path.join(ROOT, "sangi_practice_*")))
    if ONLY:
        pdirs = [p for p in pdirs if os.path.basename(p)[-2:] in ONLY]
    if not pdirs:
        print("対象問題が見つかりません:", ROOT); return 1

    total_fail = 0
    summary = []
    for pdir in pdirs:
        name = os.path.basename(pdir)
        tc_dir = os.path.join(pdir, "test_cases")
        ins = sorted(glob.glob(os.path.join(tc_dir, "*.in")))
        print(f"\n=== {name}  ({len(ins)} cases) ===")
        if not ins:
            print(RED + "  .in が無い" + RST); total_fail += 1
            summary.append((name, "NO-INPUT")); continue

        with tempfile.TemporaryDirectory() as build:
            runners, errors = compile_all(pdir, build)
            for e in errors:
                print(RED + "  " + e.splitlines()[0] + RST)
                for ln in e.splitlines()[1:8]:
                    print(DIM + "    " + ln + RST)
            if "C" not in runners:
                total_fail += 1; summary.append((name, "C-COMPILE-FAIL")); continue

            prob_fail = 0
            for inf in ins:
                base = os.path.basename(inf)[:-3]
                outf = os.path.join(tc_dir, base + ".out")
                with open(inf, "rb") as f:
                    stdin_bytes = f.read()
                # C を正本に
                cout, rc, cerr = run(runners["C"], stdin_bytes)
                if rc != 0:
                    print(RED + f"  [{base}] C 実行が異常終了 rc={rc}" + RST)
                    if cerr.strip(): print(DIM + "    " + cerr.strip()[:200] + RST)
                    prob_fail += 1; continue
                if GEN or not os.path.exists(outf):
                    with open(outf, "w", encoding="utf-8", newline="\n") as f:
                        f.write(cout + ("\n" if cout else ""))
                with open(outf, "rb") as f:
                    expected = normalize(f.read())

                marks = []
                ok_all = True
                # C vs expected
                cflag = tok_equal(cout, expected); ok_all &= cflag
                marks.append("C" + ("✓" if cflag else "✗"))
                for lang in ("C++", "Java"):
                    if lang not in runners:
                        marks.append(lang + "—"); ok_all = False; continue
                    o, rc2, er2 = run(runners[lang], stdin_bytes)
                    f2 = (rc2 == 0) and tok_equal(o, expected)
                    ok_all &= f2
                    marks.append(lang + ("✓" if f2 else "✗"))
                    if not f2:
                        print(RED + f"  [{base}] {lang} 不一致 (rc={rc2})" + RST)
                        print(DIM + "    expected: " + expected.replace("\n"," / ")[:120] + RST)
                        print(DIM + "    got     : " + o.replace("\n"," / ")[:120] + RST)
                        if er2.strip(): print(DIM + "    stderr: " + er2.strip()[:160] + RST)
                if ok_all:
                    print(GREEN + f"  [{base}] OK  " + " ".join(marks) + RST)
                else:
                    if cflag and all(m.endswith("✓") for m in marks):
                        pass
                    print(("  " if ok_all else RED + "  ") + f"[{base}] " + " ".join(marks) + RST)
                    prob_fail += 0 if ok_all else 1

            if prob_fail == 0:
                print(GREEN + f"  => {name} 全{len(ins)}ケース PASS" + RST)
                summary.append((name, "PASS"))
            else:
                print(RED + f"  => {name} {prob_fail} ケース FAIL" + RST)
                summary.append((name, f"{prob_fail} FAIL")); total_fail += 1

    print("\n" + "=" * 40 + "\n結果サマリ")
    for n, s in summary:
        c = GREEN if s == "PASS" else RED
        print(f"  {c}{n:24s} {s}{RST}")
    print("=" * 40)
    print((GREEN + "ALL PASS 🎉" if total_fail == 0 else RED + f"{total_fail} 問に問題あり") + RST)
    return 0 if total_fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
