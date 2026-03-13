## Confluence Link (socar-bird fork)

> **Fork of [BungaRazvan/confluence-link](https://github.com/BungaRazvan/confluence-link)**
> 원본에서 지원하지 않는 Mermaid 다이어그램, Callout, Blockquote 리치 콘텐츠 변환을 추가한 포크입니다.

### Fork 변경사항

| 기능 | 원본 | 이 포크 |
|------|------|---------|
| Mermaid 다이어그램 | `// TODO` skip 처리 | **Confluence Mermaid Diagrams 매크로**(`extension` ADF 노드)로 변환. 다이어그램이 렌더링됨 |
| Callout (`[!warning]`, `[!tip]` 등) | 텍스트만 추출, 타입 무시 | **Confluence Panel**로 변환 (info/note/warning/error/success). 25종 callout 타입 매핑 |
| Blockquote 내부 콘텐츠 | `node.textContent`로 플레인 텍스트만 | 자식 노드를 재귀 탐색하여 **볼드, 코드, 리스트 등 서식 보존** |
| DIV 노드 처리 | 미처리 (무시) | callout이 DIV로 렌더링되는 케이스 처리 |

### 설치 (클론 불필요)

[Releases](https://github.com/socar-bird/confluence-link/releases) 에서 `install-confluence-link.command` 다운로드 후 **더블클릭**하면 Obsidian 볼트를 자동으로 찾아 설치합니다.

또는 직접 설치:
```bash
git clone https://github.com/socar-bird/confluence-link.git
cd confluence-link
./install.sh                          # 볼트 자동 탐색
./install.sh /path/to/your/vault      # 특정 볼트 지정
```

### 요구사항 (Mermaid)

Mermaid 다이어그램이 Confluence에서 렌더링되려면 **[Mermaid Diagrams for Confluence](https://marketplace.atlassian.com/apps/1226567)** 앱이 Confluence Cloud에 설치되어 있어야 합니다.

---

Welcome to the `Confluence Link` project. The objective of this project is to make it easy to write documentation on Obsidian and quicky create a Confluence page to share with you team members.

## Setting things up

1. Open the plugin settings and configure the following fields:

-   `Confluence Domain`: The URL of your Atlassian Confluence instance
-   `Atlassian User Name`: Your Atlassian account's email address
-   `Atlassian API Token`: Your Atlassian API token. You can generate one from your [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens).
-   (Optional) `Confluence Default Space`: The space identifier where all you confluence pages will be created

![Settings](./images/settings_tab.png)

2. (Optional) Open the default obsidian hotkeys settings:

-   search for `confluence-link`
-   add hotkeys

![Hotkeys](./images/hotkeys.png)

## Usage

1. Open a md file
2. Press the hotkey set at step 2 in [Settings things up](#Setting-things-up) section or use the command pallet (`Ctrl/Cmd + P` ) and search for `Confluence Link` commands to execute

![Commands](./images/commands.png)

## Nice to know

While the spaces modal is opened you can mark or unmark spaces as favorites by clicking the star icon. This will make them appear as the first results the next time you open this modal.

![Favorite_Spaces](./images/fav_spaces.png)

If a space is not in the initial list you can type `??` followed by the space title for a "fuzzy search" using all the spaces you have access to, not just the up to 250 that the confluence API can return in one request.

![Search](./images/search_spaces.png)

## Issues

Please log issues or feature requests to https://github.com/BungaRazvan/confluence-link/issues as this is where the code is being developed
