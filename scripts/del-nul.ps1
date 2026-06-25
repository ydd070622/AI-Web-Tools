$path = "\\\\.\\G:\\04-Vibe coding\\02-Ai_agent\\05-LingWorks\\nul"
if (Test-Path -LiteralPath $path) {
  Remove-Item -LiteralPath $path -Force
  Write-Output "deleted"
} else {
  Write-Output "not found via device path"
}
# Also try alternate path format
$path2 = "\\\\?\\G:\\04-Vibe coding\\02-Ai_agent\\05-LingWorks\\nul"
if (Test-Path -LiteralPath $path2) {
  Remove-Item -LiteralPath $path2 -Force
  Write-Output "deleted via \\\\?\\"
} else {
  Write-Output "not found via \\\\?\\path"
}
