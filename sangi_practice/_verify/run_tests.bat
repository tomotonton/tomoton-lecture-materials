@echo off
rem Compile every model answer (C/C++/Java) and verify against all test cases.
rem Loads the MSVC environment (vcvars64.bat) first, then runs harness.py.
rem (ASCII-only on purpose: a Japanese-Windows cmd misreads UTF-8 comments.)
setlocal
chcp 65001 >nul
set "VCVARS=C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VCVARS%" (
  echo [ERROR] vcvars64.bat not found: "%VCVARS%"
  echo Edit run_tests.bat to match your Visual Studio install path.
  exit /b 1
)
call "%VCVARS%" >nul
python "%~dp0harness.py" %*
endlocal
