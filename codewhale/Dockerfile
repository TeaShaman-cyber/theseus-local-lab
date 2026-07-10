FROM ghcr.io/hmbown/codewhale:latest

USER root

RUN if command -v apt-get >/dev/null 2>&1; then \
      apt-get update \
      && apt-get install -y --no-install-recommends \
        bash ca-certificates curl git iputils-ping jq make nodejs npm \
        procps python3 python3-pip sqlite3 tini \
      && rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
      apk add --no-cache \
        bash ca-certificates curl git iputils jq make nodejs npm procps \
        python3 py3-pip sqlite tini; \
    else \
      echo "Unsupported base image package manager" >&2; exit 1; \
    fi

WORKDIR /workspace
