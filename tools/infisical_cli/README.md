# Infisical CLI Tool Cache

Local npm install location for the Infisical CLI. This keeps the Windows host
clean while allowing repeatable `infisical run` smoke tests.

Install:

```powershell
npm install --prefix tools/infisical_cli @infisical/cli
```

Run:

```powershell
.\tools\infisical_cli\node_modules\.bin\infisical.cmd --version
```

Do not commit `node_modules` or `package-lock.json` from this directory.
