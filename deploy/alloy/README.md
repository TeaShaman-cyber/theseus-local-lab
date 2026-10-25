# Grafana Alloy — host monitoring for the Theseus laptop

Canonical Git source for the laptop's host-metrics collector. Runtime state
(tokens, WAL, service state) stays outside Git.

Related issue: [#52](https://github.com/TeaShaman-cyber/theseus-local-lab/issues/52)

## What this is

One Windows service (`Alloy`) scrapes local host metrics and pushes them to
Grafana Cloud over **outbound HTTPS only** — no inbound port is opened.

Metrics: CPU per process, memory, logical disks, network, processor queue.

## Runtime boundary

| Artifact | Location | Why |
|---|---|---|
| Collector binary + service | `C:\Program Files\GrafanaLabs\Alloy\` | installed by winget |
| Live config | `C:\Program Files\GrafanaLabs\Alloy\config.alloy` | needs elevation to write |
| Grafana Cloud token | live config only | secret, never in Git |
| WAL / data | Alloy data dir | generated state |

`config.alloy` in this directory is the **canonical, secret-free** copy.

## Install (already done on this host, 2026-10-25)

```powershell
winget install --id GrafanaLabs.Alloy --accept-package-agreements --accept-source-agreements
```

Installs service `Alloy`, start type Automatic.

## Configure

Grafana Cloud → stack → Prometheus → **Details**, take:

- `Remote Write Endpoint` — e.g. `https://prometheus-prod-XX-<region>.grafana.net/api/prom/push`
- `User` — metrics instance ID (a number)
- Access policy token with `metrics:write` scope

Fill the three placeholders in this file, then copy it into place **from an
elevated shell**:

```powershell
# elevated
Copy-Item "deploy\alloy\config.alloy" "C:\Program Files\GrafanaLabs\Alloy\config.alloy" -Force
Restart-Service Alloy
```

Never commit the filled file. Commit only the placeholder version.

## Verify (evidence, not "service running")

1. Config parses:
   ```powershell
   & "C:\Program Files\GrafanaLabs\Alloy\alloy-windows-amd64.exe" fmt "C:\Program Files\GrafanaLabs\Alloy\config.alloy"
   ```
2. Service alive: `Get-Service Alloy`
3. Data actually arrived — query Grafana Cloud back:
   ```bash
   curl -s -u "<INSTANCE_ID>:<TOKEN>" \
     "https://<PROMETHEUS_HOST>/api/prom/api/v1/query?query=windows_cpu_time_total"
   ```
   `"result": []` means nothing arrived, regardless of service state.
4. Series count stays under 10 000 (free tier).

## Rollback

```powershell
winget uninstall GrafanaLabs.Alloy
```

Service and files are removed; the repo copy reverts with a normal `git revert`.
