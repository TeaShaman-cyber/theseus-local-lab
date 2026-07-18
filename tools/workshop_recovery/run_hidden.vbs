Option Explicit

Dim fso, shell, nodeExe, runner, command
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
nodeExe = "C:\Program Files\nodejs\node.exe"
runner = fso.GetParentFolderName(WScript.ScriptFullName) & "\recovery_contract.mjs"
command = Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & runner & Chr(34) & " --recover --quiet"
shell.Run command, 0, False
