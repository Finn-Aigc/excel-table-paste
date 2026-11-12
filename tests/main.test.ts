// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExcelTablePastePlugin from "../src/main";
import { mockState as state } from "./__mocks__/obsidian";

interface FakeEditor {
  getCursor: (which: "from" | "to") => { line: number; ch: number };
  getLine: (index: number) => string;
  getSelection: () => string;
  replaceSelection: ReturnType<typeof vi.fn>;
}

function createEditor(
  lines: string[],
  cursor = { line: 0, ch: 0 },
  to = cursor
): FakeEditor {
  return {
    getCursor: (which) => (which === "from" ? cursor : to),
    getLine: (index) => lines[index] ?? "",
    getSelection: () => "",
    replaceSelection: vi.fn(),
  };
}

function createPasteEvent(data: Record<string, string>) {
  return {
    clipboardData: {
      types: Object.keys(data),
      getData: (type: string) => data[type] ?? "",
    },
    preventDefault: vi.fn(),
  };
}

async function createPlugin() {
  const pasteHandlers: Array<(event: unknown, editor: unknown) => void> = [];
  const app = {
    workspace: {
      on: (
        name: string,
        callback: (event: unknown, editor: unknown) => void
      ) => {
        if (name === "editor-paste") {
          pasteHandlers.push(callback);
        }
        return {};
      },
    },
  };
  const plugin = new ExcelTablePastePlugin(app as never, {} as never);
  await plugin.onload();
  return {
    plugin,
    paste: (event: unknown, editor: unknown) => pasteHandlers[0](event, editor),
    command: (id: string) =>
      state.commands.find((entry) => entry.id === id)!.editorCallback,
  };
}

const HTML_TABLE =
  "<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>";
const TSV = "a\tb\n1\t2";
const TABLE_MARKDOWN = "| a   | b   |\n| --- | --- |\n| 1   | 2   |";

beforeEach(() => {
  state.commands.length = 0;
  state.notices.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("editor-paste 自动转换", () => {
  it("HTML 表格剪贴板自动转换并阻止默认粘贴", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor([""]);
    const event = createPasteEvent({
      "text/html": HTML_TABLE,
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(editor.replaceSelection).toHaveBeenCalledWith(TABLE_MARKDOWN + "\n");
  });

  it("纯文本剪贴板保留默认粘贴", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor([""]);
    const event = createPasteEvent({ "text/plain": TSV });
    paste(event, editor);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it("HTML 表格优先于制表符文本", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor([""]);
    const event = createPasteEvent({
      "text/html": "<table><tr><td>h</td></tr></table>",
      "text/plain": "x\ty",
    });
    paste(event, editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith("| h   |\n| --- |\n");
  });

  it("HTML 中没有表格时回退到制表符文本", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor([""]);
    const event = createPasteEvent({
      "text/html": "<p>hi</p>",
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith(TABLE_MARKDOWN + "\n");
  });

  it("单列制表符文本不触发自动转换", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor([""]);
    const event = createPasteEvent({ "text/html": "", "text/plain": "a\nb\nc" });
    paste(event, editor);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it("关闭自动转换后不处理粘贴", async () => {
    const { plugin, paste } = await createPlugin();
    plugin.settings.autoConvert = false;
    const editor = createEditor([""]);
    const event = createPasteEvent({
      "text/html": HTML_TABLE,
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it("关闭网页表格转换后只按制表符文本识别", async () => {
    const { plugin, paste } = await createPlugin();
    plugin.settings.convertHtmlTables = false;
    const editor = createEditor([""]);
    const event = createPasteEvent({
      "text/html": "<table><tr><td>h</td></tr></table>",
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith(TABLE_MARKDOWN + "\n");
  });

  it("围栏代码块内不自动转换", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor(["```ts", "const a = 1;", "```"], {
      line: 1,
      ch: 0,
    });
    const event = createPasteEvent({
      "text/html": HTML_TABLE,
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it("frontmatter 内不自动转换", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor(["---", "title: test", "---"], {
      line: 1,
      ch: 0,
    });
    const event = createPasteEvent({
      "text/html": HTML_TABLE,
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it("已有 Markdown 表格行内不自动转换", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor(["| a | b |", "| --- | --- |"], {
      line: 0,
      ch: 3,
    });
    const event = createPasteEvent({
      "text/html": HTML_TABLE,
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it("光标前后有内容时插入空行分隔", async () => {
    const { paste } = await createPlugin();
    const editor = createEditor(["前文后文"], { line: 0, ch: 2 });
    const event = createPasteEvent({
      "text/html": HTML_TABLE,
      "text/plain": TSV,
    });
    paste(event, editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith(
      "\n\n" + TABLE_MARKDOWN + "\n\n"
    );
  });
});

describe("命令", () => {
  it("转换选中的制表符文本", async () => {
    const { command } = await createPlugin();
    const editor = createEditor(
      ["a\tb", "1\t2"],
      { line: 0, ch: 0 },
      { line: 1, ch: 3 }
    );
    editor.getSelection = () => "a\tb\n1\t2";
    command("convert-selection-to-markdown-table")(editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith(TABLE_MARKDOWN + "\n");
  });

  it("未选中内容时提示且不插入", async () => {
    const { command } = await createPlugin();
    const editor = createEditor([""]);
    command("convert-selection-to-markdown-table")(editor);
    expect(editor.replaceSelection).not.toHaveBeenCalled();
    expect(state.notices.length).toBe(1);
  });

  it("选中普通文本时转换为单单元格表格", async () => {
    const { command } = await createPlugin();
    const editor = createEditor(
      ["普通文本"],
      { line: 0, ch: 0 },
      { line: 0, ch: 4 }
    );
    editor.getSelection = () => "普通文本";
    command("convert-selection-to-markdown-table")(editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith(
      "| 普通文本 |\n| -------- |\n"
    );
  });

  it("从剪贴板粘贴支持单列文本", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn(async () => "a\nb\nc") },
    });
    const { command } = await createPlugin();
    const editor = createEditor([""]);
    await command("paste-clipboard-as-markdown-table")(editor);
    expect(editor.replaceSelection).toHaveBeenCalledWith(
      "| a   |\n| --- |\n| b   |\n| c   |\n"
    );
  });

  it("剪贴板读取失败时提示且不插入", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        readText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
    });
    const { command } = await createPlugin();
    const editor = createEditor([""]);
    await command("paste-clipboard-as-markdown-table")(editor);
    expect(editor.replaceSelection).not.toHaveBeenCalled();
    expect(state.notices.length).toBe(1);
  });

  it("剪贴板为空时提示且不插入", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn(async () => "  ") },
    });
    const { command } = await createPlugin();
    const editor = createEditor([""]);
    await command("paste-clipboard-as-markdown-table")(editor);
    expect(editor.replaceSelection).not.toHaveBeenCalled();
    expect(state.notices.length).toBe(1);
  });
});