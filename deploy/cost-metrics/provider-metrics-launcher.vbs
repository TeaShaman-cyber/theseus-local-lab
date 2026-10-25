' Hidden launcher for the provider metrics collector.
' A scheduled task that invokes powershell.exe directly flashes a console window
' every run; WScript.Shell.Run with window style 0 launches it fully hidden.
Dim sh, cmd
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Apps\theseus-metrics\provider-metrics.ps1"""
sh.Run cmd, 0, False
