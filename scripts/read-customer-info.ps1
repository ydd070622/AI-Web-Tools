$path = "G:\04-Vibe coding\02-Ai_agent\05-LingWorks\scripts\customer-info.xls"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($path)
$ws = $wb.Worksheets.Item(1)
$rows = $ws.UsedRange.Rows.Count
$cols = $ws.UsedRange.Columns.Count
Write-Output "=== Rows: $rows, Cols: $cols ==="
for ($r = 1; $r -le $rows; $r++) {
  $arr = @()
  for ($c = 1; $c -le $cols; $c++) {
    $val = $ws.Cells.Item($r, $c).Text
    $arr += if ($val) { $val } else { "" }
  }
  Write-Output ($arr -join " | ")
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
