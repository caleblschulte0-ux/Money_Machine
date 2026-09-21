<#
.SYNOPSIS
  Register FishAI as Windows Scheduled Tasks so data collection runs unattended.

.DESCRIPTION
  Creates two tasks (run as the current user):
    FishAI Watch  - at logon, `fishai watch --source <Source>` (restarts if it exits)
    FishAI Daily  - every day at <DailyAt>, `fishai daily`
  Or, with -IngestFolder, a watch task that ingests new files from a folder instead of a camera.

  Remove with:  .\scripts\install_tasks.ps1 -Uninstall

.EXAMPLE
  .\scripts\install_tasks.ps1 -Source 0
  .\scripts\install_tasks.ps1 -Source "rtsp://192.168.1.20/stream" -DailyAt 07:30
  .\scripts\install_tasks.ps1 -IngestFolder "D:\tank-videos"
#>
[CmdletBinding()]
param(
    [string]$Source = "0",
    [string]$IngestFolder = "",
    [string]$DailyAt = "07:00",
    [switch]$Uninstall
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) { throw "Run .\scripts\setup.ps1 first (no .venv found)." }

$watchName = "FishAI Watch"
$dailyName = "FishAI Daily"

if ($Uninstall) {
    foreach ($n in @($watchName, $dailyName)) {
        if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $n -Confirm:$false
            Write-Host "removed task '$n'"
        }
    }
    exit 0
}

if ($IngestFolder) {
    $watchArgs = "-m fishai ingest `"$IngestFolder`" --watch --log-level INFO"
} else {
    $watchArgs = "-m fishai watch --source `"$Source`" --log-level INFO"
}
$watchAction = New-ScheduledTaskAction -Execute $venvPy -Argument $watchArgs -WorkingDirectory $Root
$watchTrigger = New-ScheduledTaskTrigger -AtLogOn
$watchSettings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365) -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $watchName -Action $watchAction -Trigger $watchTrigger -Settings $watchSettings -Force | Out-Null
Write-Host "registered '$watchName': $watchArgs"

$dailyAction = New-ScheduledTaskAction -Execute $venvPy -Argument "-m fishai daily --log-level INFO" -WorkingDirectory $Root
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$dailySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $dailyName -Action $dailyAction -Trigger $dailyTrigger -Settings $dailySettings -Force | Out-Null
Write-Host "registered '$dailyName' at $DailyAt"

Write-Host ""
Write-Host "Start the watcher now without logging out:  Start-ScheduledTask -TaskName '$watchName'" -ForegroundColor Green
Write-Host "Check it:  .\scripts\run.ps1 status"
Write-Host "Mark a feeding while it runs:  .\scripts\run.ps1 feed"
