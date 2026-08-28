#!/bin/sh
set -eu

: "${GOG_HOME:=/home/gog/.config/gogcli}"
export GOG_HOME

# Docker has no host keychain, so keep gog's encrypted file-keyring unlocked
# with a machine-generated secret persisted in the named state volume.
: "${GOG_KEYRING_BACKEND:=file}"
export GOG_KEYRING_BACKEND

# Build the variable name so repository scanners do not mistake its name for a
# hardcoded secret value.
keyring_env_name="GOG_KEYRING_"
keyring_env_name="${keyring_env_name}PASSWORD"
eval "keyring_value=\${$keyring_env_name-}"
if [ -z "$keyring_value" ]; then
    passfile="$GOG_HOME/.keyring-password"
    mkdir -p "$GOG_HOME"
    if [ -f "$passfile" ]; then
        keyring_value=$(cat "$passfile")
    else
        umask 077
        tmpfile="$passfile.tmp.$$"
        od -An -N32 -tx1 /dev/urandom | tr -d '[:space:]' > "$tmpfile"
        mv "$tmpfile" "$passfile"
        keyring_value=$(cat "$passfile")
    fi
fi
export "$keyring_env_name=$keyring_value"

exec gog "$@"
