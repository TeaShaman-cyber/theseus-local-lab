# VMware Ubuntu Lab

Purpose: keep the Ubuntu VM as a clean Linux test stand for agent workbench
experiments before moving any primary Codex/ChatGPT Work project state.

## Current VM

- Product: VMware Workstation.
- Control CLI: `C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe`.
- VMX: `C:\Users\s.poklad\Documents\Virtual Machines\Ubuntu 64-bit\Ubuntu 64-bit.vmx`.
- Display name: `Ubuntu 64-bit`.
- Guest OS type: `ubuntu-64`.
- vCPU: 2.
- RAM: 4096 MB.
- Network: NAT.
- Current IP from VMware Tools: `192.168.121.130`.
- VMware Tools state: `running`.

## Operating Rule

Treat this VM as a test stand, not the primary home for Codex state. Windows
keeps ChatGPT Work, Codex task history, Google Drive backup, and the current
AutoMem MCP bridge until the VM passes restore and inventory drills.

## Next Steps

1. Configure SSH inside the Ubuntu guest.
2. Prefer SSH or VS Code Remote SSH for routine Linux work.
3. Use `vmrun` for lifecycle control and emergency guest operations only.
4. Run read-only inventory:
   - Ubuntu version and kernel.
   - CPU, RAM, disk pressure.
   - Git, Python, Node.js, Docker or Podman.
   - Network and proxy route.
   - SSH service status.
   - Access to GitHub and local AutoMem where appropriate.
5. Decide whether the VM becomes:
   - a temporary Linux workbench,
   - a backup agent lab,
   - or a future migration target.

## VS Code Access

SSH alias configured in the normal Windows user profile:

```text
Host theseus-ubuntu-vm
  HostName 192.168.121.130
  User sysadmin
  StrictHostKeyChecking accept-new
```

In VS Code:

1. Run `Remote-SSH: Connect to Host...`.
2. Choose `theseus-ubuntu-vm`.
3. Open or create a Linux workspace such as `~/theseus-local-lab`.

Workspace tasks:

- `Theseus VM: open SSH terminal`
- `Theseus VM: agent SSH health`
- `Theseus VM: inventory over SSH`
- `Theseus VM: inventory over SSH key`

Inventory writes JSON snapshots to `outputs/local_inventory/`.

### Verification

- 2026-07-11: VS Code Remote SSH connected to `theseus-ubuntu-vm`.
- Remote platform detected: Ubuntu Linux x86_64.
- VS Code Server `1.128.0` downloaded, verified, and started under
  `/home/sysadmin/.vscode-server`.
- Extension host agent started successfully.
- Agent key login verified from the normal Windows user context:
  `ssh -F .\work\ssh\config theseus-ubuntu-vm "printf 'ssh-ok\n'"`
  returned `ssh-ok`.
- Remote identity check returned `sysadmin`, host `ubuntu2204lts`, and
  `/home/sysadmin`.
- Practical note: direct sandbox TCP connect to the VM can still fail with a
  Windows socket permission error, so agent SSH probes should run outside the
  sandbox with the dedicated ignored key in `work/ssh/`.

## Caution

Do not migrate the primary project state into this VM until backup, restore,
GitHub sync, AutoMem export/import, and Google Drive sync have all been tested.
