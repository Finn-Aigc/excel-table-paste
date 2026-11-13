# Excel Table Paste

English | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Finn-Aigc/excel-table-paste/actions/workflows/ci.yml/badge.svg)](https://github.com/Finn-Aigc/excel-table-paste/actions/workflows/ci.yml)

Paste tables copied from Excel, WPS, or web pages into Obsidian as Markdown tables.

## Features

- Detects Excel and web tables automatically: parses HTML `<table>` first, with tab-separated text as a fallback
- When a page contains several tables, picks the one with the most non-empty cells by default
- Converts multi-column tables on a normal paste
- Single-column or plain-text clipboards: use the command or the `Ctrl/Cmd+Alt+V` hotkey
- Expands merged cells, preserves in-cell line breaks, and escapes `|`
- Strips leading all-empty rows, trailing empty rows, and trailing empty columns
- Skips pastes inside frontmatter, fenced code blocks, and existing Markdown table rows
- Source column width alignment: pads by display width, counting CJK/full-width characters as two columns; can be disabled
- Per-column alignment: start a header cell with `^l`, `^c`, or `^r`
- Settings for auto-convert, web tables, table selection, first-row header, table alignment, trimming, and source alignment
- No network requests, no telemetry

### How it differs from plain TSV conversion

- Parses HTML tables first, so web tables convert too
- Picks the table with the most non-empty cells when a page has several
- Expands `colspan` / `rowspan` merged cells
- Fully parses quoted line breaks and tabs, and escapes every `|`
- Aligns source columns by display width, counting CJK and full-width characters as two columns
- In-plugin settings, plus automatic cleanup of empty rows and columns

## Installation

### Manual

1. Download `main.js` and `manifest.json` from the latest GitHub Release of this repository
2. Create the folder `<your-vault>/.obsidian/plugins/excel-table-paste/`
3. Copy both files into that folder
4. Reload Obsidian and enable **Excel Table Paste** under Settings → Community plugins

### Via BRAT

1. Install and enable BRAT
2. Add the beta plugin: `Finn-Aigc/excel-table-paste`

A GitHub Release matching the version in `manifest.json` must already exist in the repository.

### Community plugins

Once the plugin is approved by Obsidian, you can install it from Settings → Community plugins → Browse.

## Usage

### Normal paste

1. Select and copy a table in Excel, WPS, or a web page
2. Paste into the Obsidian editor
3. The plugin inserts a Markdown table automatically

A `text/plain`-only clipboard keeps Obsidian's default paste behavior (including `Shift+Cmd+V` plain-text paste); use the command or hotkey below to convert it.

Auto-conversion skips YAML frontmatter, fenced code blocks, and existing Markdown table rows to avoid corrupting them. You can still run the command manually in those places.

### Commands and hotkeys

- **Paste clipboard as Markdown table**: default hotkey `Ctrl/Cmd+Alt+V`; supports single-column tables and plain-text clipboards
- **Convert selection to Markdown table**: converts the selected text, including single-column data

You can rebind the hotkey under Settings → Hotkeys.

### Per-column alignment markers

With "First row as header" enabled, start a header cell with `^l`, `^c`, or `^r` to control that column's alignment (left, center, right). The marker itself is removed from the final table; columns without a marker use the default alignment from the settings.

```markdown
| ^l Name | ^c Qty | ^r Note |
| --- | --- | --- |
| Router | 1 | Core |
| Switch | 2 | Edge |
```

After conversion:

```markdown
| Name   | Qty   | Note |
| :----- | :---: | ---: |
| Router | 1     | Core |
| Switch | 2     | Edge |
```

### Source column width

The result pads each column to its maximum display width so the columns line up in source mode. CJK and full-width characters count as two columns; the backslash from an escaped `|` and `<br>` also count toward the width. Preview and rendering are unaffected.

Source alignment is estimated for monospace fonts, so themes using proportional fonts may look slightly off. You can disable "Align source column widths" in the settings to output compact Markdown tables instead.

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| Auto-convert pasted content | Detect Excel and web tables automatically; plain-text clipboards keep the default paste | On |
| Convert web tables | Recognize HTML tables in the clipboard | On |
| Web table selection | Pick the table with the most non-empty cells when several exist, or always use the first | Largest table |
| First row as header | When off, generates an empty header and treats every row as body | On |
| Cell alignment | Default alignment for the whole table; `^l` / `^c` / `^r` in a header cell overrides a single column | Default |
| Trim cell whitespace | Strip leading/trailing spaces from cell content | On |
| Align source column widths | Pad by display width so columns line up in source mode; off outputs compact tables | On |

## Notes and limitations

- Markdown tables do not support merged cells, cell colors, or exact column widths; merged cells are expanded into regular cells
- Single-column data does not trigger auto-conversion on a normal paste; use the hotkey or command
- Table appearance is controlled by your Obsidian theme; the plugin injects no custom styles
- Source widths are estimated for monospace fonts and do not affect the rendered layout
- The plugin never modifies existing tables; re-paste to convert again
- The plugin makes no network requests and collects no telemetry

## Development

Requires Node.js 22.22.2 or later (a requirement of the jsdom test dependency).

```bash
git clone https://github.com/Finn-Aigc/excel-table-paste.git
cd excel-table-paste
npm install
npm run dev
npm run build
npm test
```

`npm run dev` watches the source and emits `main.js`; `npm run build` type-checks and builds for production; `npm test` runs the Vitest unit tests under `tests/` (converter, context protection, and paste handling, with the `obsidian` module mocked by `tests/__mocks__/obsidian.ts`).

To debug in a vault, copy `main.js` and `manifest.json` into `<your-vault>/.obsidian/plugins/excel-table-paste/`, or symlink that folder to the repository, then enable the plugin in Obsidian. After editing the source, `npm run dev` rebuilds automatically; reload the plugin in Obsidian to pick up the change.

### Manual testing

`test-data/excel-table-paste-test.xlsx` is a manual test workbook with the following sheets:

| Sheet | What it tests |
| --- | --- |
| 说明 (Instructions) | Usage and expected results for each sheet |
| 基本表格 (Basic table) | Copy A1:J7; multi-column tables, empty cells, and source width alignment |
| 合并单元格 (Merged cells) | Copy A1:D6; `colspan` / `rowspan` merged-cell expansion |
| 特殊内容 (Special content) | Copy A1:C11; in-cell line breaks, pipes, quotes, spaces, and long text |
| 单列数据 (Single column) | Copy A1:A10; single-column tables via the command or `Ctrl/Cmd+Alt+V` |
| 标题行 (Header row) | Copy A1:J5; default header behavior when the first row contains only URLs |

Open it in Excel or WPS, follow the 说明 (Instructions) sheet, copy the indicated range, paste into Obsidian, and check the result.

## Release

The repository includes GitHub Actions CI and a release workflow. CI runs tests and the build on push/PR. The release workflow triggers on a tag matching the version: it first verifies versions (`manifest.json`, `package.json`, and `package-lock.json` match the tag, and `versions.json` contains an entry for it), then runs tests, builds the plugin, and creates a GitHub Release.

1. Bump the version in `manifest.json`, `package.json`, and `versions.json` (sync `package-lock.json` with `npm version --no-git-tag-version <version>`)
2. Commit the source and push
3. Create and push a tag without a `v` prefix:

   ```bash
   git tag 1.0.0
   git push origin 1.0.0
   ```

4. Wait for the Release workflow to finish and confirm that `main.js` and `manifest.json` are attached to the Release
5. Open a PR to `obsidianmd/obsidian-releases` adding the plugin entry to `community-plugins.json`

`main.js` is a build artifact, ignored in `.gitignore`, and is built and attached to the Release automatically by the release workflow.

## License

[MIT](LICENSE)
