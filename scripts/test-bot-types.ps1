$types = @("ilink", "mcp", "openclaw", "assistant", "claude_code", "codex", "cursor", "weixin_claude", "zcode", "weixin_claw", "claw")
foreach ($t in $types) {
  $resp = Invoke-WebRequest -Uri "https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=$t" -UseBasicParsing -TimeoutSec 5
  $body = $resp.Content
  Write-Output "$t => $body"
}