$processes = Get-Process -Name "LingWorks","electron" -ErrorAction SilentlyContinue
if ($processes) {
  $processes | ForEach-Object { 
    Write-Output "Killing: $($_.ProcessName) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue 
  }
}
Start-Sleep -Seconds 2
$releasePath = "G:\04-Vibe coding\02-Ai_agent\05-LingWorks\release"
if (Test-Path $releasePath) {
  Remove-Item -Path $releasePath -Recurse -Force -ErrorAction SilentlyContinue
  Write-Output "Removed release directory"
}
