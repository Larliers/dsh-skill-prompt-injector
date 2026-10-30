# dsh-skill-prompt-injector

[English](README.en.md) | **中文**

**在 DeepSeek Harness 右侧栏里搜索、收藏、组合 Skill 与提示词，一键追加到当前对话输入框。**

![技能与快捷提示面板](docs/screenshot.png)

## 功能

- **技能目录**：跟随当前会话的工作区与预设，直接读 Harness 原生 Skill 注册表；可按名称、描述、正文与标签搜索。
- **提示词**：新增、编辑、删除自用固定文本。
- **标签与收藏**：两类条目都支持本地标签与收藏。
- **组合**：把若干技能与提示词存成命名组合，可载入、重命名、覆盖更新；组合始终引用最新提示词正文。
- **一键注入**：把所选内容追加到当前输入框，保留原草稿、引用与附件；`Ctrl+Z` 一步撤销。
- **不替你发送**：只填草稿，发送仍由你决定。
- **右侧栏常驻 tab**：与官方 tab 并列，切换会话不会被卸载。

## 要求

- DeepSeek Harness `>=0.2.1-rc.3 <0.2.2`（见 `engines.dsh`）
- 提供右侧栏 slot `sidebar.right.pane.tab` 的 DSH 版本

## 安装

预构建产物 `lib/` 已随仓库提交，安装时无需再构建。

```powershell
git clone https://github.com/Larliers/dsh-skill-prompt-injector.git
dsh plugin --profile <profile> add link:<克隆目录的绝对路径>
```

也可以在 DSH 打开 **插件**，把包目录作为本地 bundle 安装。

安装后正常退出并重启 DSH，让 Host 与 Client 两侧同时加载新产物。

## 使用

1. 打开右侧栏，选择 **技能与快捷提示**。
2. 在 **Skills** 分页勾选条目；切到 **Prompts** 管理提示词。
3. 用 **组合** 保存或载入常用搭配。
4. 点 **追加到当前对话输入框**，检查草稿后手动发送。

Skills 的可见性来自当前会话的工作区与预设；正文由 DSH 原生的 `/skill-name` 机制在发送后加载。拖动只改变注入顺序，不会建立串行工作流。

## 数据

收藏、标签、组合与提示词都保存在包目录之外，位于 `$DSH_HOME/skill-prompt-injector/`（默认 `~/.dsh/skill-prompt-injector/`）：

- `prompts.json` — 提示词的标题、正文、标签与收藏
- `library.json` — 技能的标签/收藏，以及组合的引用与顺序

两份文件都带 `schemaVersion: 1` 与宿主维护的 `revision`；请通过界面修改。写入前校验版本、串行执行并原子替换，`.bak` 保留上一份有效文件。插件不会改写你的 `SKILL.md`。

如需换位置，改插件 Config 里的 `dataDirectory` 即可。

## 开发

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

产物：`lib/index.js`（Host）与 `lib/client.js`（Client）。两侧通过 Harness 原生 Typert Remote 通道通信，没有额外服务器或 MCP。

## 许可证

[MIT](LICENSE) © 2026 Larliers
