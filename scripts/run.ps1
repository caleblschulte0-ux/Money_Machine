<#
.SYNOPSIS
  Run FishAI inside the project's virtual environment.
.EXAMPLE
  .\scripts\run.ps1 demo
  .\scripts\run.ps1 process C:\videos\tank.mp4 --detector yolo --tracker bytetrack --then-baseline
  .\scripts\run.ps1 assess latest
  .\scripts\run.ps1 doctor
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "No virtual environment yet. Run .\scripts\setup.ps1 first." -ForegroundColor Yellow
    exit 1
}
Set-Location $Root
& $venvPy -m fishai @args
exit $LASTEXITCODE
