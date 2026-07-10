# Theseus Local Lab Visual Map

This is the visual layer for the repo-native workflow. It should stay simple:
Mermaid diagrams are readable in Markdown, versioned in Git, and easy for Codex
to update without adding another service.

## Operating System

```mermaid
flowchart LR
    User["Semyon\nvisual + strategic guidance"]
    Chat["Chat\nbriefing + reflection"]
    Work["ChatGPT Work\nresearch outputs + reports"]
    Codex["Codex\nlocal engineering"]
    AutoMem["AutoMem\nworking long-term memory"]
    Git["GitHub repo\nsafe source of truth"]
    Drive["Google Drive\ncloud backup mirror"]
    Butler["ButlerBrain / Notion / Airtable\noptional semantic or visual layers"]
    CodeWhale["CodeWhale\nworker harness / conclave"]

    User --> Chat
    User --> Work
    User --> Codex
    Chat --> TASKS["TASKS.md\nbriefing to tasks"]
    Work --> Reports["outputs / reports / docs"]
    Codex --> Git
    Codex <--> AutoMem
    Codex --> CodeWhale
    CodeWhale --> Inbox["outputs/memory_inbox\nreview before memory"]
    Inbox --> AutoMem
    AutoMem --> Codex
    Git --> Drive
    Backups["backup-runner\nAutoMem + observatory + manifests"] --> Drive
    Observatory["stateful-agent-net\nobservatory packets"] --> Backups
    Butler -. "sync later only if useful" .- AutoMem
    Butler -. "visual/semantic navigation" .- User
```

## Kanban Flow

```mermaid
flowchart LR
    Inbox["Inbox\ncaptured but unshaped"]
    Ready["Ready\nclear next action"]
    Doing["Doing\none active focus"]
    Review["Review\nverify / user check / push"]
    Done["Done\ncommitted or documented"]
    Blocked["Blocked\nwaiting on access, limits, reboot, policy"]

    Inbox --> Ready
    Ready --> Doing
    Doing --> Review
    Review --> Done
    Doing --> Blocked
    Blocked --> Ready
    Review --> Ready
```

## Priority Matrix

```mermaid
quadrantChart
    title Priority And Energy
    x-axis Low unlock value --> High unlock value
    y-axis Low urgency --> High urgency
    quadrant-1 Do next
    quadrant-2 Protect now
    quadrant-3 Park
    quadrant-4 Plan calmly
    "Verify cloud backup restore path": [0.82, 0.78]
    "Backup retention policy": [0.74, 0.62]
    "Restore drill checklist": [0.68, 0.60]
    "ChatGPT Work beyond official docs": [0.66, 0.54]
    "Model/harness selection matrix": [0.72, 0.45]
    "Work briefing template": [0.56, 0.43]
    "GitHub Issues/Projects sync": [0.30, 0.18]
```

## Memory And Backup Circuit

```mermaid
flowchart TB
    subgraph "Live Local State"
        AutoMemDB["AutoMem\nFalkorDB + Qdrant"]
        ObservatoryDB["Observatory SQLite\nstateful-agent-net/data/state.db"]
        Repo["Repo files\nscripts, docs, tasks"]
    end

    subgraph "Snapshot Layer"
        AutoMemAPI["AutoMem /backup API"]
        SQLiteBackup["SQLite online backup"]
        Manifest["BACKUP_MANIFEST.md/json"]
        Archive["theseus-data-*.tar.gz"]
    end

    subgraph "Recovery Copies"
        Local["backups/data\nlocal archive"]
        CloudFolder["theseus-cloud-backups\nDrive-synced folder"]
        GitHub["GitHub private repo\nsource + docs"]
    end

    AutoMemDB --> AutoMemAPI
    ObservatoryDB --> SQLiteBackup
    Repo --> Manifest
    AutoMemAPI --> Archive
    SQLiteBackup --> Archive
    Manifest --> Archive
    Archive --> Local
    Archive --> CloudFolder
    Repo --> GitHub
```

## Research Safety Funnel

```mermaid
flowchart TD
    Claim["External claim or model output"]
    Classify{"Domain?"}
    General["General tech / product\nstandard verification"]
    Bio["Biology / medicine / mechanobiology\nextra caution"]
    Sources["Primary sources + independent sources"]
    SafeModel["Benign models, literature review,\ndata analysis, conceptual mechanisms"]
    Boundary["No clinical advice, no wet-lab protocol,\nno hazardous optimization"]
    Task["TASKS.md research task"]
    Limits["MODEL_LIMITATIONS.md evidence log"]

    Claim --> Classify
    Classify --> General
    Classify --> Bio
    General --> Sources
    Bio --> Sources
    Bio --> Boundary
    Sources --> SafeModel
    SafeModel --> Task
    Boundary --> Limits
    Task --> Limits
```

## Current Focus

```mermaid
mindmap
  root((Theseus Local Lab))
    P0 Protection
      Backups
      Restore drills
      Secrets boundary
    P1 Workflow
      TASKS.md
      AGILE.md
      VISUAL_MAP.md
      AutoMem decisions
    P1 Infrastructure
      Docker Desktop
      AutoMem
      Observatory
      Backup runner
    P2 Research
      ChatGPT Work reality check
      GPT-5.6 limitations
      Mechanobiology-safe methodology
    P2 Harnesses
      CodeWhale
      Bothub
      DeepSeek
      Local model runner
    Optional Visual Layers
      ButlerBrain
      Notion
      Airtable
      GitHub Projects
```
