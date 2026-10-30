# dsh-skill-prompt-injector

**Search, pin, combine and inject skills & prompts into the current conversation — from the DSH right sidebar.**

在 DeepSeek Harness 右侧栏里搜索、收藏、组合 Skill 与提示词，一键追加到当前对话输入框。

![Skills & prompts injector](docs/screenshot.png)

## Features

- **Skills catalog** — mirrors the live DSH skill registry of the current session (workspace and agent-preset aware), with search across name, description, body and tags.
- **Prompts** — create, edit and delete your own reusable snippets.
- **Tags & favorites** — both entry kinds can be favorited and tagged locally.
- **Combinations** — save a named set of skills + prompts, load it later, rename it, or update it in place. Combinations always reference the latest prompt body.
- **One-click inject** — appends the selection to the current composer as plain text, keeping your draft, references and attachments; `Ctrl+Z` undoes the insertion in one step.
- **Never sends for you** — injection only fills the draft; you review and send.
- **Kept mounted** — lives in the right sidebar beside the shipped tabs, so switching sessions does not tear it down.

## 功能

- **技能目录**：跟随当前会话的工作区与预设，直接读 Harness 原生 Skill 注册表；可按名称、描述、正文与标签搜索。
- **提示词**：新增、编辑、删除自用固定文本。
- **标签与收藏**：两类条目都支持本地标签与收藏。
- **组合**：把若干技能与提示词存成命名组合，可载入、重命名、覆盖更新；组合始终引用最新提示词正文。
- **一键注入**：把所选内容追加到当前输入框，保留原草稿、引用与附件；`Ctrl+Z` 一步撤销。
- **不替你发送**：只填草稿，发送仍由你决定。
- **右侧栏常驻 tab**。

## Install

预构建产物 `lib/` 已随仓库提交，安装时无需再构建。

1. 克隆或下载本仓库。
2. 在 DSH 打开 **插件**，安装本地 bundle，选中包目录。

或用 DSH CLI：

```powershell
git clone https://github.com/Larliers/dsh-skill-prompt-injector.git
dsh plugin --profile <profile> add link:<absolute-path-to-clone>
```

安装后正常退出并重启 DSH，让 Host 与 Client 两侧同时加载新产物。

### English

Clone this repository, then install the package directory through the DSH **Plugins** page, or from a shell:

```powershell
dsh plugin --profile <profile> add link:<absolute-path-to-clone>
```

No build step is required: the package ships its `lib/` artifacts. Restart DSH afterwards.

## Requirements

- DeepSeek Harness `>=0.2.1-rc.3 <0.2.2` (declared as `engines.dsh`)
- A DSH build that provides the right sidebar slot `sidebar.right.pane.tab`

## Usage

1. 打开右侧栏，选择 **技能与快捷提示**。
2. 在 **Skills** 分页勾选条目；切到 **Prompts** 管理提示词。
3. 用 **组合** 保存或载入常用搭配。
4. 点 **追加到当前对话输入框**，检查草稿后手动发送。

Skills 的可见性来自当前会话的工作区与预设；正文由 DSH 原生的 `/skill-name` 机制在发送后加载。拖动改变注入顺序，不会建立串行工作流。

## Data

收藏、标签、组合与提示词都保存在包目录之外，位于 `$DSH_HOME/skill-prompt-injector/`（默认 `~/.dsh/skill-prompt-injector/`）：

- `prompts.json` — 提示词的标题、正文、标签与收藏
- `library.json` — 技能的标签/收藏，以及组合的引用与顺序

两份文件都带 `schemaVersion: 1` 与宿主维护的 `revision`；请通过界面修改。写入前校验版本、串行执行并原子替换，`.bak` 保留上一份有效文件。插件不会改写你的 `SKILL.md`。

如需换位置，改插件 Config 里的 `dataDirectory` 即可。

## Development

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

产物：`lib/index.js`（Host）与 `lib/client.js`（Client）。两侧通过 Harness 原生 Typert Remote 通道通信，没有额外服务器或 MCP。

## License

[MIT](LICENSE) © 2026 Larliers
