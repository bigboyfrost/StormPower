; StormPower NSIS hooks
; Delete Setup.exe a few seconds after a successful install (file is locked while NSIS runs)

!macro customInstall
  DetailPrint "Scheduling installer cleanup..."
  Exec 'cmd.exe /C ping -n 5 127.0.0.1 > nul & del /F /Q "$EXEPATH"'
!macroend
