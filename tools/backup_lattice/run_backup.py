"""One backup run for the Theseus lab: snapshot, push to every repository, verify.

Designed to be called by a scheduled task. It never asks anything, writes a
single machine-readable heartbeat line per run, and exits non-zero on any
failure so the scheduler records a failure instead of a silent no-op.

Repositories are declared, not discovered, because each holds a different tier:
  local  - everything, fastest restore
  s3     - everything, immutable (Object Lock), off-site
  drive  - survival kit only, because the free quota cannot hold the full repo

Retention is grandfather-father-son, applied per repository.
"""
from __future__ import annotations

import hashlib
import os
import pathlib
import subprocess
import sys
import time

STAGING = pathlib.Path(r"D:/theseus-backups/staging")
SURVIVAL = pathlib.Path(r"D:/theseus-backups/survival")
RESTORE_CHECK = pathlib.Path(r"D:/theseus-backups/restore-check")
HEARTBEAT = pathlib.Path.home() / "AppData/Local/hermes/logs/backup-lattice.log"
S3_ENV = pathlib.Path(r"D:/theseus-backups/.s3-env")

FULL_REPOS = {
    "local": "D:/theseus-backups/restic",
    "s3": "s3:https://s3.twcstorage.ru/theseus-lab-backups/restic",
}
SMALL_REPOS = {
    "drive": "rclone:gdrive:theseus-backups/restic",
}

KEEP = ["--keep-daily", "14", "--keep-weekly", "8", "--keep-monthly", "6"]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def env_with_s3() -> dict:
    env = dict(os.environ)
    if S3_ENV.exists():
        for line in S3_ENV.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def run(cmd: list[str], env: dict, timeout: int = 7200) -> tuple[int, str]:
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=timeout)
    return r.returncode, (r.stdout + r.stderr).strip()


def restic(repo: str, args: list[str], env: dict, timeout: int = 7200) -> tuple[int, str]:
    return run(["restic", "-r", repo] + args, env, timeout)


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def backup_repo(name: str, repo: str, source: pathlib.Path, env: dict) -> dict:
    started = time.time()
    code, out = restic(repo, ["backup", str(source), "--tag", "lab", "--host", "theseus-laptop"], env)
    if code != 0:
        return {"repo": name, "ok": False, "stage": "backup", "detail": out[-300:]}

    code, out = restic(repo, ["forget", "--prune"] + KEEP, env)
    if code != 0:
        return {"repo": name, "ok": False, "stage": "forget", "detail": out[-300:]}

    code, out = restic(repo, ["snapshots", "--json"], env)
    count = out.count('"short_id"') if code == 0 else 0

    return {
        "repo": name,
        "ok": True,
        "stage": "done",
        "snapshots": count,
        "duration_s": round(time.time() - started, 1),
    }


def verify(env: dict) -> dict:
    """Restore the bank dump from the local repository and compare hashes."""
    source = STAGING / "data" / "hindsight.dump"
    if not source.exists():
        return {"ok": False, "detail": "no dump to verify"}

    if RESTORE_CHECK.exists():
        subprocess.run(["rm", "-rf", str(RESTORE_CHECK)], timeout=300)

    code, out = restic(
        FULL_REPOS["local"],
        ["restore", "latest", "--target", str(RESTORE_CHECK), "--include", "*hindsight.dump"],
        env,
    )
    if code != 0:
        return {"ok": False, "detail": out[-200:]}

    restored = next(RESTORE_CHECK.rglob("hindsight.dump"), None)
    if restored is None:
        return {"ok": False, "detail": "restore produced no file"}

    same = sha256(restored) == sha256(source)
    return {"ok": same, "detail": "sha256 match" if same else "sha256 MISMATCH"}


def heartbeat(parts: dict) -> None:
    HEARTBEAT.parent.mkdir(parents=True, exist_ok=True)
    line = " ".join(f"{k}={v}" for k, v in parts.items())
    with HEARTBEAT.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    log(line)


def main() -> int:
    started = time.time()
    env = env_with_s3()
    env.setdefault("RESTIC_PASSWORD_FILE", r"D:/theseus-backups/.restic-password")

    log("preparing snapshot")
    code, out = run([sys.executable, str(pathlib.Path(__file__).with_name("prepare_snapshot.py"))], env, 3600)
    if code != 0:
        heartbeat({"event": "BACKUP_RUN", "status": "fail", "stage": "prepare",
                   "detail": out[-200:].replace(" ", "_")})
        return 1

    results = []
    for name, repo in FULL_REPOS.items():
        log(f"backup -> {name}")
        results.append(backup_repo(name, repo, STAGING, env))
    for name, repo in SMALL_REPOS.items():
        log(f"backup -> {name} (survival kit)")
        results.append(backup_repo(name, repo, SURVIVAL, env))

    failed = [r for r in results if not r["ok"]]

    log("verifying by restore")
    v = verify(env)

    for r in results:
        if r["ok"]:
            heartbeat({"event": "BACKUP_RUN", "status": "ok", "repo": r["repo"],
                       "snapshots": r["snapshots"], "duration_s": r["duration_s"]})
        else:
            heartbeat({"event": "BACKUP_RUN", "status": "fail", "repo": r["repo"],
                       "stage": r["stage"], "detail": r["detail"].replace(" ", "_")[:200]})

    heartbeat({"event": "BACKUP_DRILL", "status": "ok" if v["ok"] else "fail",
               "detail": v["detail"].replace(" ", "_"),
               "total_s": round(time.time() - started, 1)})

    return 0 if (not failed and v["ok"]) else 1


if __name__ == "__main__":
    sys.exit(main())
