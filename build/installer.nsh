; StormPower NSIS hooks
; - Delete the Setup.exe a few seconds after install (locked while NSIS runs)
; - Sweep leftover StormPower-Setup*.exe from Desktop folders

!macro customInstall
  DetailPrint "Scheduling installer cleanup..."
  Exec 'cmd.exe /C ping -n 5 127.0.0.1 > nul & del /F /Q "$EXEPATH" & del /F /Q "%USERPROFILE%\Desktop\StormPower-Setup*.exe" & del /F /Q "%PUBLIC%\Desktop\StormPower-Setup*.exe" & del /F /Q "%USERPROFILE%\OneDrive\Desktop\StormPower-Setup*.exe"'
!macroend
