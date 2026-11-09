import { App, Editor, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
  ConvertOptions,
  TableAlignment,
  convertHtmlToMarkdown,
  gridToMarkdown,
  htmlHasTable,
  looksLikeSpreadsheetText,
  parseDelimited,
} from "./converter";

interface ExcelTablePasteSettings {
  autoConvert: boolean;
  convertHtmlTables: boolean;
  firstRowAsHeader: boolean;
  alignment: TableAlignment;
  trimCells: boolean;
}

const DEFAULT_SETTINGS: ExcelTablePasteSettings = {
  autoConvert: true,
  convertHtmlTables: true,
  firstRowAsHeader: true,
  alignment: "default",
  trimCells: true,
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

    if (!markdown) {
      return;
    }

    event.preventDefault();
    this.insertBlock(editor, markdown);
  }

  private convertSelection(editor: Editor) {
    const selection = editor.getSelection();
    if (selection.trim() === "") {
      new Notice("请先选中以制表符分隔的表格文本");
      return;
    }

    const grid = parseDelimited(selection).filter((row) =>
      row.some((cell) => cell.trim() !== "")
    );
    if (grid.length === 0 || grid.every((row) => row.length < 2)) {
      new Notice("选中内容不是可识别的表格数据");
      return;
    }

    const markdown = gridToMarkdown(grid, this.toConvertOptions());
    if (!markdown) {
      new Notice("未能转换选中内容");
      return;
    }

    this.insertBlock(editor, markdown);
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
      .setDesc("检测到 Excel、网页表格或制表符分隔的文本时，自动转换为 Markdown 表格。")
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
      .setDesc("写入 Markdown 表格分隔行，例如居中为 :---:。")
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
  }
}
