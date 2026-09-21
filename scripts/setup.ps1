<#
.SYNOPSIS
  One-shot Windows setup for FishAI: virtual environment, dependencies, model weights, smoke test.

.DESCRIPTION
  git clone <repo>; cd <repo>; .\scripts\setup.ps1
  Re-running is safe. Flags:
    -NoML        skip torch/ultralytics (motion detector + built-in tracker only)
    -NoModels    skip weight downloads
    -Gpu         install CUDA torch (cu124 wheels) before ultralytics
    -Python      python launcher to use (default: py -3.11, then python)

  Requires: Python 3.10+ (https://www.python.org/downloads/, tick "Add to PATH"), git.
  Optional: Ollama (https://ollama.com) for the local reasoner:  ollama pull qwen2.5:7b
#>
[CmdletBinding()]
param(
    [switch]$NoML,
    [switch]$NoModels,
    [switch]$Gpu,
    [string]$Python = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
Write-Host "FishAI setup in $Root" -ForegroundColor Cyan

function Find-Python {
    if ($Python) { return $Python }
    foreach ($cand in @("py -3.12", "py -3.11", "py -3.10", "python3", "python")) {
        try {
            $v = & cmd /c "$cand -c `"import sys;print(sys.version_info[0]*100+sys.version_info[1])`"" 2>$null
            if ($LASTEXITCODE -eq 0 -and [int]$v -ge 310) { return $cand }
        } catch {}
    }
    throw "Python 3.10+ not found. Install from https://www.python.org/downloads/ and tick 'Add python.exe to PATH'."
}

$py = Find-Python
Write-Host "using $py"
if (-not (Test-Path ".venv")) {
    & cmd /c "$py -m venv .venv"
    if ($LASTEXITCODE -ne 0) { throw "venv creation failed" }
}
$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
& $venvPy -m pip install --upgrade pip wheel | Out-Null
& $venvPy -m pip install -r requirements-dev.txt
if (-not $NoML) {
    if ($Gpu) {
        Write-Host "installing CUDA torch (cu124)..." -ForegroundColor Cyan
        & $venvPy -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
    }
    & $venvPy -m pip install -r requirements-ml.txt
}
& $venvPy -m pip install -e . | Out-Null

if (-not $NoModels -and -not $NoML) {
    Write-Host "downloading default model weights..." -ForegroundColor Cyan
    & $venvPy scripts\download_models.py
}

New-Item -ItemType Directory -Force -Path "runs" | Out-Null
Write-Host "running tests..." -ForegroundColor Cyan
& $venvPy -m pytest -q
Write-Host "checking the installation..." -ForegroundColor Cyan
& $venvPy -m fishai doctor --offline
Write-Host ""
Write-Host "Done. Try:" -ForegroundColor Green
Write-Host "  .\scripts\run.ps1 demo"
Write-Host "  .\scripts\run.ps1 process C:\path\to\aquarium.mp4 --detector yolo --tracker bytetrack"
