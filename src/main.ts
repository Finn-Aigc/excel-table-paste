import { App, Editor, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
  ConvertOptions,
  HtmlTableStrategy,
  TableAlignment,
  convertHtmlToMarkdown,
  gridToMarkdown,
  htmlHasTable,
  looksLikeSpreadsheetText,
  parseDelimited,
} from "./converter";
import { isInProtectedContext } from "./context";

interface ExcelTablePasteSettings {
  autoConvert: boolean;
  convertHtmlTables: boolean;
  htmlTableStrategy: HtmlTableStrategy;
  firstRowAsHeader: boolean;
  alignment: TableAlignment;
  trimCells: boolean;
  alignSourceWidths: boolean;
}

const DEFAULT_SETTINGS: ExcelTablePasteSettings = {
  autoConvert: true,
  convertHtmlTables: true,
  htmlTableStrategy: "largest",
  firstRowAsHeader: true,
  alignment: "default",
  trimCells: true,
  alignSourceWidths: true,
};

export default class ExcelTablePastePlugin extends Plugin {
  settings: ExcelTablePasteSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on("editor-paste", (event, editor) => {
        this.handlePaste(event, editor);
      })
    );

    this.addCommand({
      id: "convert-selection-to-markdown-table",
      name: "将选中内容转换为 Markdown 表格",
      editorCallback: (editor) => this.convertSelection(editor),
    });

    this.addCommand({
      id: "paste-clipboard-as-markdown-table",
      name: "从剪贴板粘贴为 Markdown 表格",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "v" }],
      editorCallback: async (editor) => {
        await this.pasteClipboardAsTable(editor);
      },
    });

    this.addSettingTab(new ExcelTablePasteSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private toConvertOptions(): ConvertOptions {
    return {
      firstRowAsHeader: this.settings.firstRowAsHeader,
      alignment: this.settings.alignment,
      trimCells: this.settings.trimCells,
      htmlTableStrategy: this.settings.htmlTableStrategy,
      alignSourceWidths: this.settings.alignSourceWidths,
    };
  }

  private handlePaste(event: ClipboardEvent, editor: Editor) {
    if (!this.settings.autoConvert) {
      return;
    }

    const clipboard = event.clipboardData;
    if (!clipboard) {
      return;
    }

    // Preserve Obsidian's "paste as plain text" for plain-text-only clipboards.
    const clipboardTypes = Array.from(clipboard.types);
    if (clipboardTypes.length === 1 && clipboardTypes[0] === "text/plain") {
      return;
    }

    const html = clipboard.getData("text/html");
    const text = clipboard.getData("text/plain");
    const options = this.toConvertOptions();
    let markdown: string | null = null;

    if (this.settings.convertHtmlTables && html && htmlHasTable(html)) {
      markdown = convertHtmlToMarkdown(html, options);
    }

    if (!markdown && text && looksLikeSpreadsheetText(text)) {
      markdown = gridToMarkdown(parseDelimited(text), options);
    }

    if (!markdown || this.isProtectedPaste(editor)) {
      return;
    }

    event.preventDefault();
    this.insertBlock(editor, markdown);
  }

  private isProtectedPaste(editor: Editor): boolean {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const maxLine = Math.max(from.line, to.line);
    const lines = Array.from({ length: maxLine + 1 }, (_, index) =>
      editor.getLine(index)
    );

    return (
      isInProtectedContext(lines, from.line) ||
      isInProtectedContext(lines, to.line)
    );
  }

  private convertSelection(editor: Editor) {
    const selection = editor.getSelection();
    if (selection.trim() === "") {
      new Notice("请先选中需要转换的表格文本");
      return;
    }

    const markdown = this.convertText(selection);
    if (!markdown) {
      new Notice("选中内容不是可识别的表格数据");
      return;
    }

    this.insertBlock(editor, markdown);
  }

  private async pasteClipboardAsTable(editor: Editor) {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      new Notice("无法读取剪贴板，请检查 Obsidian 的剪贴板权限");
      return;
    }

    if (text.trim() === "") {
      new Notice("剪贴板中没有可转换的文本");
      return;
    }

    const markdown = this.convertText(text);
    if (!markdown) {
      new Notice("剪贴板中没有可转换的表格数据");
      return;
    }

    this.insertBlock(editor, markdown);
  }

  private convertText(text: string): string | null {
    const grid = parseDelimited(text).filter((row) =>
      row.some((cell) => cell.trim() !== "")
    );
    if (grid.length === 0) {
      return null;
    }
    return gridToMarkdown(grid, this.toConvertOptions());
  }

  private insertBlock(editor: Editor, content: string) {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const before = (editor.getLine(from.line) ?? "").slice(0, from.ch);
    const after = (editor.getLine(to.line) ?? "").slice(to.ch);
    const leading = before.trim().length > 0 ? "\n\n" : "";
    const trailing = after.trim().length > 0 ? "\n\n" : "\n";

    editor.replaceSelection(`${leading}${content}${trailing}`);
  }
}

class ExcelTablePasteSettingTab extends PluginSettingTab {
  plugin: ExcelTablePastePlugin;

  constructor(app: App, plugin: ExcelTablePastePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Excel Table Paste 设置" });

    new Setting(containerEl)
      .setName("自动转换粘贴内容")
      .setDesc("自动识别 Excel 和网页表格；纯文本剪贴板保留 Obsidian 默认粘贴，可用命令或默认快捷键 Ctrl/Cmd+Alt+V 转换。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoConvert).onChange(async (value) => {
          this.plugin.settings.autoConvert = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("转换网页表格")
      .setDesc("识别剪贴板中的 HTML 表格；关闭后只按制表符分隔的纯文本识别。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.convertHtmlTables)
          .onChange(async (value) => {
            this.plugin.settings.convertHtmlTables = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("网页表格选择")
      .setDesc("网页包含多个表格时，自动选择单元格最多的表格，或始终使用第一个。")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("largest", "自动选择最大表格")
          .addOption("first", "仅第一个表格")
          .setValue(this.plugin.settings.htmlTableStrategy)
          .onChange(async (value) => {
            this.plugin.settings.htmlTableStrategy =
              value as HtmlTableStrategy;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("首行作为表头")
      .setDesc("关闭时生成空的表头行，并把所有行作为表格正文。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.firstRowAsHeader)
          .onChange(async (value) => {
            this.plugin.settings.firstRowAsHeader = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("单元格对齐方式")
      .setDesc("全表默认对齐；表头单元格以 ^l、^c、^r 开头可单独覆盖该列。")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("default", "默认")
          .addOption("left", "左对齐")
          .addOption("center", "居中")
          .addOption("right", "右对齐")
          .setValue(this.plugin.settings.alignment)
          .onChange(async (value) => {
            this.plugin.settings.alignment = value as TableAlignment;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("去除单元格首尾空白")
      .setDesc("启用后会去掉 Excel 单元格内容前后的空格。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.trimCells).onChange(async (value) => {
          this.plugin.settings.trimCells = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("源码列宽对齐")
      .setDesc("按显示宽度给单元格补空格，使源码模式下列对齐；关闭后输出紧凑表格。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.alignSourceWidths)
          .onChange(async (value) => {
            this.plugin.settings.alignSourceWidths = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
