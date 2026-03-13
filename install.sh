#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME="confluence-link"

echo "=== confluence-link installer ==="
echo ""

# 1. Build the plugin
echo "[1/3] Building plugin..."
cd "$SCRIPT_DIR"
npm install --silent 2>/dev/null
npm run build 2>/dev/null
echo "  -> Build complete"

# 2. Find Obsidian vaults
echo "[2/3] Searching for Obsidian vaults..."

VAULTS=()

# macOS: Obsidian stores vault list in obsidian.json
OBSIDIAN_CONFIG="$HOME/Library/Application Support/obsidian/obsidian.json"

if [[ -f "$OBSIDIAN_CONFIG" ]]; then
    # Extract vault paths from obsidian.json
    while IFS= read -r vault_path; do
        if [[ -n "$vault_path" && -d "$vault_path" ]]; then
            VAULTS+=("$vault_path")
        fi
    done < <(python3 -c "
import json, sys
with open('$OBSIDIAN_CONFIG') as f:
    data = json.load(f)
for v in data.get('vaults', {}).values():
    path = v.get('path', '')
    if path:
        print(path)
" 2>/dev/null)
fi

# Fallback: search common locations
if [[ ${#VAULTS[@]} -eq 0 ]]; then
    echo "  -> obsidian.json not found, searching common locations..."
    while IFS= read -r d; do
        VAULTS+=("$d")
    done < <(find "$HOME/Documents" "$HOME/Desktop" "$HOME" -maxdepth 3 -name ".obsidian" -type d 2>/dev/null | sed 's|/.obsidian$||')
fi

if [[ ${#VAULTS[@]} -eq 0 ]]; then
    echo "  ERROR: No Obsidian vaults found."
    echo "  Usage: $0 /path/to/vault"
    exit 1
fi

# If path argument provided, use that instead
if [[ $# -ge 1 ]]; then
    TARGET_VAULT="$1"
    if [[ ! -d "$TARGET_VAULT/.obsidian" ]]; then
        echo "  ERROR: $TARGET_VAULT is not a valid Obsidian vault (.obsidian not found)"
        exit 1
    fi
    VAULTS=("$TARGET_VAULT")
fi

# 3. Install to each vault
echo "[3/3] Installing plugin..."
echo ""

for vault in "${VAULTS[@]}"; do
    PLUGIN_DIR="$vault/.obsidian/plugins/$PLUGIN_NAME"

    echo "  Vault: $vault"

    mkdir -p "$PLUGIN_DIR"
    cp "$SCRIPT_DIR/main.js" "$PLUGIN_DIR/"
    cp "$SCRIPT_DIR/manifest.json" "$PLUGIN_DIR/"
    if [[ -f "$SCRIPT_DIR/styles.css" ]]; then
        cp "$SCRIPT_DIR/styles.css" "$PLUGIN_DIR/"
    fi

    echo "  -> Installed to $PLUGIN_DIR"
    echo ""
done

echo "=== Done ==="
echo ""
echo "Restart Obsidian or run 'Reload app without saving' to activate."
echo ""
echo "Changes in this fork:"
echo "  - Mermaid diagrams: exported as code blocks (language: mermaid)"
echo "  - Callouts ([!warning], [!tip], etc.): converted to Confluence panels"
echo "  - Blockquote rich content: inner formatting preserved"
