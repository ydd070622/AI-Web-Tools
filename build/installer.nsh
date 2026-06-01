!macro customInit
  ${If} ${FileExists} "$DESKTOP\${PRODUCT_NAME}.lnk"
    CopyFiles /SILENT "$DESKTOP\${PRODUCT_NAME}.lnk" "$TEMP\${PRODUCT_NAME}_desktop_backup.lnk"
  ${EndIf}
!macroend

!macro customInstall
  ${If} ${FileExists} "$TEMP\${PRODUCT_NAME}_desktop_backup.lnk"
    CopyFiles /SILENT "$TEMP\${PRODUCT_NAME}_desktop_backup.lnk" "$DESKTOP\${PRODUCT_NAME}.lnk"
    Delete "$TEMP\${PRODUCT_NAME}_desktop_backup.lnk"
  ${EndIf}
!macroend
