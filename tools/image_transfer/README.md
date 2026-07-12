# Docker Image Transfer Handoff

This handoff kit moves Docker image layers from Windows Docker Desktop to the
Theseus Ubuntu VM without pulling them again over the mobile network.

It is intentionally scoped to image layers only. Do not use it for volumes,
`.env` files, raw memory dumps, backup archives, or private transcripts.

## Roles

- Target Unix workflow: receive an archive on the Ubuntu VM, verify it, load it,
  and inspect the resulting image.
- Temporary Windows bridge: export an image from Docker Desktop into a tar file
  plus a small manifest.
- VS Code tasks: thin launchers for the two sides of the flow.

## First Candidate

Use `theseus-mempalace:pilot` as the first migration candidate. It is a safe
pilot image and can be rebuilt from source if needed. Do not transfer AutoMem
data or volumes in this step.

## Checkpoints

1. Export locally and inspect the manifest.
2. Confirm the tar size is reasonable and the SHA256 is recorded.
3. Copy only the tar and manifest to the VM.
4. Verify SHA256 and size on Ubuntu before `docker load`.
5. Stop if SSH asks for a password, host-key confirmation, or Docker needs sudo.

## Temporary Windows Bridge

Run from the project root in the user VS Code terminal where Docker Desktop is
available:

```powershell
node tools/image_transfer/export_image.mjs theseus-mempalace:pilot
```

This writes:

- `work/image-transfer/theseus-mempalace-pilot.tar`
- `work/image-transfer/theseus-mempalace-pilot.manifest.json`

`work/` is ignored by Git.

The manifest contract is versioned in
`tools/image_transfer/manifest.schema.json`. The Ubuntu loader currently accepts
only `schema_version: 1`.

## Copy To Ubuntu

After the first checkpoint:

```bash
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes theseus-ubuntu-vm \
  'mkdir -p "$HOME/theseus-local-lab/incoming"'

scp -o BatchMode=yes -o StrictHostKeyChecking=yes \
  work/image-transfer/theseus-mempalace-pilot.tar \
  work/image-transfer/theseus-mempalace-pilot.manifest.json \
  theseus-ubuntu-vm:~/theseus-local-lab/incoming/
```

## Target Unix Workflow

Install or refresh the VM-side loader:

```bash
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes theseus-ubuntu-vm \
  'mkdir -p "$HOME/theseus-local-lab/bin"'

scp -o BatchMode=yes -o StrictHostKeyChecking=yes \
  tools/image_transfer/load_image_archive.sh \
  theseus-ubuntu-vm:~/theseus-local-lab/bin/load_image_archive.sh

ssh -o BatchMode=yes -o StrictHostKeyChecking=yes theseus-ubuntu-vm \
  'chmod +x "$HOME/theseus-local-lab/bin/load_image_archive.sh"'
```

On the Ubuntu VM:

```bash
~/theseus-local-lab/bin/load_image_archive.sh \
  ~/theseus-local-lab/incoming/theseus-mempalace-pilot.tar \
  ~/theseus-local-lab/incoming/theseus-mempalace-pilot.manifest.json
```

The script verifies SHA256 and file size before loading the image.

For a protocol-only check without Docker:

```bash
~/theseus-local-lab/bin/load_image_archive.sh --verify-only \
  ~/theseus-local-lab/incoming/theseus-mempalace-pilot.tar \
  ~/theseus-local-lab/incoming/theseus-mempalace-pilot.manifest.json
```

Validation emits a machine-readable JSON result with `status`, `stage`, and
`reason`. Examples: `sha256_mismatch`, `archive_name_mismatch`,
`unsupported_schema_version`.

On Windows or any environment without Bash/WSL, use the Node verifier for the
same archive/manifest contract:

```bash
node tools/image_transfer/verify_manifest.mjs \
  work/image-transfer/theseus-mempalace-pilot.tar \
  work/image-transfer/theseus-mempalace-pilot.manifest.json
```

This verifier never calls Docker or SSH.
