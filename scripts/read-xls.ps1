$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open("C:\Users\27893\Desktop\客户信息表.xls")
$ws = $wb.Worksheets.Item(1)
$rows = $ws.UsedRange.Rows.Count
$cols = $ws.UsedRange.Columns.Count
Write-Output "Rows: $rows, Cols: $cols"
for ($r = 1; $r -le $rows; $r++) {
  $line = ""
  for ($c = 1; $c -le $cols; $c++) {
    $val = $ws.Cells.Item($r, $c).Text
    if ($val) { $line += $val }
    $line += "|"
  }
  Write-Output $line.TrimEnd("|")
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
