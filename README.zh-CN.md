# Excel Table Paste

[English](README.md) | 简体中文

[![CI](https://github.com/Finn-Aigc/excel-table-paste/actions/workflows/ci.yml/badge.svg)](https://github.com/Finn-Aigc/excel-table-paste/actions/workflows/ci.yml)

将 Excel、WPS 或网页中的表格粘贴到 Obsidian 时，自动转换为标准 Markdown 表格。

## 功能

- 自动识别 Excel 和网页表格：优先解析 HTML `<table>`，并用制表符文本兜底
- 网页包含多个表格时，默认选择有效单元格最多的表格
- 普通粘贴时自动转换多列表格
- 单列或纯文本剪贴板：使用命令或快捷键 `Ctrl/Cmd+Alt+V`
- 支持合并单元格展开、单元格内换行和 `|` 转义
- 自动清理开头的全空行、末尾空行和空列
- 自动跳过 frontmatter、围栏代码块和已有 Markdown 表格行内的粘贴
- 源码列宽对齐：按显示宽度补空格，中文/全角字符按两列计算，可关闭
- 按列对齐：表头单元格以 `^l`、`^c`、`^r` 开头
- 提供设置：自动转换、网页表格、表格选择、首行表头、全表对齐、去空格、源码对齐
- 无网络请求、无遥测

### 与纯 TSV 转换方案的区别

- 优先解析 HTML 表格，网页表格也能转换
- 网页包含多个表格时，默认选择有效单元格最多的表格
- 展开 `colspan` / `rowspan` 合并单元格
- 完整解析引号内的换行和制表符，转义全部 `|`
- 源码列宽按显示宽度对齐，中文和全角字符按两列计算
- 提供插件内设置，并自动清理空行和空列

## 安装

### 手动安装

1. 从本仓库最新的 GitHub Release 下载 `main.js` 和 `manifest.json`
2. 在库中创建目录：`<你的库>/.obsidian/plugins/excel-table-paste/`
3. 将两个文件复制到该目录
4. 重新加载 Obsidian，在「设置 → 第三方插件」中启用 **Excel Table Paste**

### 使用 BRAT 安装

1. 安装并启用 BRAT
2. 在 BRAT 中添加 Beta 插件：`Finn-Aigc/excel-table-paste`

需要仓库中已存在与 `manifest.json` 版本号一致的 GitHub Release。

### 社区插件

插件通过 Obsidian 官方审核后，可以直接在「设置 → 第三方插件 → 浏览」中搜索安装。

## 使用

### 普通粘贴

1. 在 Excel、WPS 或网页中选中表格并复制
2. 在 Obsidian 编辑器中粘贴
3. 插件会自动插入 Markdown 表格

纯 `text/plain` 剪贴板会保留 Obsidian 的默认粘贴行为（包括 `Shift+Cmd+V` 纯文本粘贴），此时请使用下面的命令或快捷键转换。

自动转换会跳过 YAML frontmatter、围栏代码块和已有 Markdown 表格行，避免破坏原文。在这些位置仍可以手动执行下面的命令。

### 命令与快捷键

- **从剪贴板粘贴为 Markdown 表格**：默认快捷键 `Ctrl/Cmd+Alt+V`，支持单列表格和纯文本剪贴板
- **将选中内容转换为 Markdown 表格**：转换当前选中的文本，支持单列数据

快捷键可以在「设置 → 快捷键」中修改。

### 按列对齐标记

启用「首行作为表头」时，在表头单元格开头写 `^l`、`^c`、`^r`，可以单独控制该列的左对齐、居中、右对齐。标记本身不会出现在最终表格中；没有标记的列使用插件设置里的默认对齐。

```markdown
| ^l 名称 | ^c 数量 | ^r 备注 |
| --- | --- | --- |
| 路由器 | 1 | 核心 |
| 交换机 | 2 | 接入 |
```

转换后：

```markdown
| 名称   | 数量  | 备注 |
| :----- | :---: | ---: |
| 路由器 | 1     | 核心 |
| 交换机 | 2     | 接入 |
```

### 源码列宽

转换结果会按每列的最大显示宽度补齐空格，使源码模式下的表格各列对齐。中文和全角字符按两列计算，`|` 转义后的反斜杠和 `<br>` 也计入宽度；预览和渲染结果不受影响。

源码对齐基于等宽字体估算，如果主题使用了比例字体，视觉上可能略有偏差。可以在设置中关闭“源码列宽对齐”，关闭后输出紧凑的 Markdown 表格。

## 设置

| 设置 | 说明 | 默认 |
| --- | --- | --- |
| 自动转换粘贴内容 | 自动识别 Excel 和网页表格；纯文本剪贴板保留默认粘贴 | 开启 |
| 转换网页表格 | 识别剪贴板中的 HTML 表格 | 开启 |
| 网页表格选择 | 多个表格时选择有效单元格最多的表格，或只用第一个 | 自动选择最大表格 |
| 首行作为表头 | 关闭时生成空表头，所有行都作为表格正文 | 开启 |
| 单元格对齐方式 | 全表默认对齐；表头中的 `^l` / `^c` / `^r` 可覆盖单列 | 默认 |
| 去除单元格首尾空白 | 去掉 Excel 单元格内容前后的空格 | 开启 |
| 源码列宽对齐 | 按显示宽度补空格，使源码模式下列对齐；关闭后输出紧凑表格 | 开启 |

## 说明与限制

- Markdown 表格不支持合并单元格、单元格颜色和精确列宽；合并单元格会被展开为普通单元格
- 单列数据不会触发普通粘贴的自动转换，请使用快捷键或命令
- 表格外观由当前 Obsidian 主题决定，插件不注入自定义样式
- 源码列宽按等宽字体估算，不影响渲染后的表格布局
- 插件不会修改已有表格；需要重新粘贴才能重新转换
- 插件不发起网络请求，也不收集任何遥测数据

## 开发

需要 Node.js 22.22.2 或更高版本（测试依赖 jsdom 的要求）。

```bash
git clone https://github.com/Finn-Aigc/excel-table-paste.git
cd excel-table-paste
npm install
npm run dev
npm run build
npm test
```

`npm run dev` 会监听源码并生成 `main.js`；`npm run build` 执行类型检查和生产构建；`npm test` 运行 `tests/` 下的 Vitest 单元测试（转换器、上下文保护和粘贴处理逻辑，其中 `obsidian` 模块由 `tests/__mocks__/obsidian.ts` 模拟）。

在库中调试时，把 `main.js` 和 `manifest.json` 复制到 `<你的库>/.obsidian/plugins/excel-table-paste/`，或把该目录软链接到仓库目录，然后在 Obsidian 中启用插件。修改源码后 `npm run dev` 会自动重新构建，在 Obsidian 中重新加载插件即可生效。

### 手动测试

`test-data/excel-table-paste-test.xlsx` 是手动测试工作簿，包含以下工作表：

| 工作表 | 测试内容 |
| --- | --- |
| 说明 | 各工作表的用法和预期结果 |
| 基本表格 | 复制 A1:J7，测试多列表格、空单元格和源码列宽对齐 |
| 合并单元格 | 复制 A1:D6，测试 `colspan` / `rowspan` 合并单元格展开 |
| 特殊内容 | 复制 A1:C11，测试单元格内换行、竖线、引号、空格和长文本 |
| 单列数据 | 复制 A1:A10，用命令或 `Ctrl/Cmd+Alt+V` 测试单列表格 |
| 标题行 | 复制 A1:J5，观察首行只有 URL 时的默认表头行为 |

在 Excel 或 WPS 中打开，按「说明」工作表的指引复制对应区域并粘贴到 Obsidian，核对转换结果。

## 发布

仓库包含 GitHub Actions CI 和发布流程。CI 在 push/PR 时运行测试与构建；发布流程在推送与版本号一致的 tag 后先校验版本（`manifest.json`、`package.json`、`package-lock.json` 的版本号与 tag 一致，且 `versions.json` 包含该版本条目），再运行测试、构建插件并创建 GitHub Release。

1. 同步更新 `manifest.json`、`package.json`、`versions.json` 中的版本号（`package-lock.json` 可用 `npm version --no-git-tag-version <版本号>` 同步）
2. 提交源码并推送
3. 创建并推送 tag，不要加 `v` 前缀：

   ```bash
   git tag 1.0.0
   git push origin 1.0.0
   ```

4. 等待 Release workflow 完成，确认 Release 中附带了 `main.js` 和 `manifest.json`
5. 向 `obsidianmd/obsidian-releases` 提交 PR，在 `community-plugins.json` 中加入插件条目

`main.js` 是构建产物，已在 `.gitignore` 中忽略，由发布流程自动构建并附加到 Release。

## 许可证

[MIT](LICENSE)
