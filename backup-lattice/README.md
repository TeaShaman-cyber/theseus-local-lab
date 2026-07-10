# Backup Lattice Service

Docker Compose wrapper for the portable backup lattice.

Start:

```powershell
docker compose up -d --build backup-runner
```

Status:

```powershell
docker compose ps
docker compose logs --tail=80 backup-runner
```

Stop:

```powershell
docker compose down
```

By default the service runs every 6 hours and mirrors archives to
`backups/cloud-mirror`. To mirror into a real cloud-sync folder, set
`BACKUP_MIRROR_DIR` in `.env.local` before starting the service.
