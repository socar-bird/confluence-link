#!/bin/bash
set -euo pipefail

REPO="socar-bird/confluence-link"
TAG="v1.5.0"
PLUGIN_NAME="confluence-link"
DOWNLOAD_BASE="https://github.com/${REPO}/releases/download/${TAG}"
TMP_DIR=$(mktemp -d)

echo "=== Confluence Link 설치 (Mermaid + Callout 지원 포크) ==="
echo ""

# 1. Download release assets
echo "[1/3] 플러그인 다운로드 중..."
for file in main.js manifest.json styles.css; do
    curl -sL "${DOWNLOAD_BASE}/${file}" -o "${TMP_DIR}/${file}"
done
echo "  -> 다운로드 완료"

# 2. Find Obsidian vaults
echo "[2/3] Obsidian 볼트 검색 중..."

VAULTS=()
OBSIDIAN_CONFIG="$HOME/Library/Application Support/obsidian/obsidian.json"

if [[ -f "$OBSIDIAN_CONFIG" ]]; then
    while IFS= read -r vault_path; do
        if [[ -n "$vault_path" && -d "$vault_path" ]]; then
            VAULTS+=("$vault_path")
        fi
    done < <(python3 -c "
import json
with open('$OBSIDIAN_CONFIG') as f:
    data = json.load(f)
for v in data.get('vaults', {}).values():
    path = v.get('path', '')
    if path:
        print(path)
" 2>/dev/null)
fi

if [[ ${#VAULTS[@]} -eq 0 ]]; then
    echo "  ERROR: Obsidian 볼트를 찾을 수 없습니다."
    echo ""
    read -rp "  볼트 경로를 직접 입력하세요: " MANUAL_PATH
    if [[ -d "$MANUAL_PATH/.obsidian" ]]; then
        VAULTS=("$MANUAL_PATH")
    else
        echo "  ERROR: 유효하지 않은 볼트 경로입니다."
        rm -rf "$TMP_DIR"
        read -rp "아무 키나 누르면 종료합니다..."
        exit 1
    fi
fi

# 3. Select vault if multiple
TARGET_VAULT=""
if [[ ${#VAULTS[@]} -eq 1 ]]; then
    TARGET_VAULT="${VAULTS[0]}"
else
    echo ""
    echo "  볼트가 여러 개 발견되었습니다:"
    for i in "${!VAULTS[@]}"; do
        echo "    [$((i+1))] ${VAULTS[$i]}"
    done
    echo "    [0] 전체 설치"
    echo ""
    read -rp "  선택 (0-${#VAULTS[@]}): " CHOICE

    if [[ "$CHOICE" == "0" ]]; then
        TARGET_VAULT="__ALL__"
    elif [[ "$CHOICE" -ge 1 && "$CHOICE" -le ${#VAULTS[@]} ]]; then
        TARGET_VAULT="${VAULTS[$((CHOICE-1))]}"
    else
        echo "  잘못된 선택입니다."
        rm -rf "$TMP_DIR"
        read -rp "아무 키나 누르면 종료합니다..."
        exit 1
    fi
fi

# 4. Install
echo "[3/3] 플러그인 설치 중..."
echo ""

install_to_vault() {
    local vault="$1"
    local plugin_dir="$vault/.obsidian/plugins/$PLUGIN_NAME"
    mkdir -p "$plugin_dir"
    cp "$TMP_DIR/main.js" "$plugin_dir/"
    cp "$TMP_DIR/manifest.json" "$plugin_dir/"
    cp "$TMP_DIR/styles.css" "$plugin_dir/"
    echo "  -> $vault"
}

if [[ "$TARGET_VAULT" == "__ALL__" ]]; then
    for v in "${VAULTS[@]}"; do
        install_to_vault "$v"
    done
else
    install_to_vault "$TARGET_VAULT"
fi

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "=== 설치 완료 ==="
echo ""
echo "Obsidian을 재시작하세요."
echo ""
echo "지원 기능:"
echo "  - Mermaid 다이어그램 → Confluence Mermaid Diagrams 매크로"
echo "  - Callout ([!warning] 등) → Confluence Panel"
echo "  - Blockquote 리치 콘텐츠 보존"
echo ""
read -rp "아무 키나 누르면 종료합니다..."
