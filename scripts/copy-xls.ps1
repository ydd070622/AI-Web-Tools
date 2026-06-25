$path = Join-Path $env:USERPROFILE "Desktop\客户信息表.xls"
Write-Output "Path: $path"
Write-Output "Exists: $(Test-Path $path)"
if (Test-Path $path) {
  Copy-Item -Path $path -Destination "G:\04-Vibe coding\02-Ai_agent\05-LingWorks\scripts\customer-info.xls" -Force
  Write-Output "Copied successfully"
} else {
  # try dir listing
  Get-ChildItem "$env:USERPROFILE\Desktop\*.xls*" | ForEach-Object { Write-Output $_.FullName }
}
