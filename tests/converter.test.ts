// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertHtmlToMarkdown,
  gridToMarkdown,
  htmlHasTable,
  htmlTableToGrid,
  looksLikeSpreadsheetText,
  parseDelimited,
  type ConvertOptions,
} from "../src/converter";

const baseOptions: ConvertOptions = {
  firstRowAsHeader: true,
  alignment: "default",
  trimCells: true,
  htmlTableStrategy: "largest",
  alignSourceWidths: true,
};

function withOptions(overrides: Partial<ConvertOptions> = {}): ConvertOptions {
  return { ...baseOptions, ...overrides };
}

function parseTable(html: string): HTMLTableElement {
  const document = new DOMParser().parseFromString(html, "text/html");
  return document.querySelector("table") as HTMLTableElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseDelimited", () => {
  it("解析基本制表符分隔文本", () => {
    expect(parseDelimited("a\tb\nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("忽略 CRLF 中的回车", () => {
    expect(parseDelimited("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("支持引号包裹的制表符和换行", () => {
    expect(parseDelimited('"a\tb"\t"c\nd"')).toEqual([["a\tb", "c\nd"]]);
  });

  it("解析双引号转义", () => {
    expect(parseDelimited('"say ""hi"""\tx')).toEqual([['say "hi"', "x"]]);
  });

  it("引号出现在字段中间时按普通字符处理", () => {
    expect(parseDelimited('a"b\tc')).toEqual([['a"b', "c"]]);
  });

  it("空文本返回空数组", () => {
    expect(parseDelimited("")).toEqual([]);
  });

  it("保留中间空行", () => {
    expect(parseDelimited("a\tb\n\nc\td")).toEqual([["a", "b"], [""], ["c", "d"]]);
  });

  it("结尾制表符产生空单元格", () => {
    expect(parseDelimited("a\t")).toEqual([["a", ""]]);
  });

  it("结尾换行不产生多余行", () => {
    expect(parseDelimited("a\tb\n")).toEqual([["a", "b"]]);
  });

  it("未闭合引号保留到文本结尾", () => {
    expect(parseDelimited('"abc')).toEqual([["abc"]]);
  });

  it("引号字段可以出现在任意列", () => {
    expect(parseDelimited('a\t"b\tc"\td')).toEqual([["a", "b\tc", "d"]]);
  });

  it("空引号字段解析为空单元格", () => {
    expect(parseDelimited('""\t""')).toEqual([["", ""]]);
  });

  it("闭合引号后的普通字符并入字段", () => {
    expect(parseDelimited('"a"b\tc')).toEqual([["ab", "c"]]);
  });

  it("引号内保留回车符", () => {
    expect(parseDelimited('"a\rb"\tc')).toEqual([["a\rb", "c"]]);
  });
});

describe("looksLikeSpreadsheetText", () => {
  it("含制表符且有多列时返回 true", () => {
    expect(looksLikeSpreadsheetText("a\tb")).toBe(true);
    expect(looksLikeSpreadsheetText("a\tb\nc\td")).toBe(true);
  });

  it("没有制表符时返回 false", () => {
    expect(looksLikeSpreadsheetText("a b\nc d")).toBe(false);
  });

  it("纯单列文本返回 false", () => {
    expect(looksLikeSpreadsheetText("a\nb\nc")).toBe(false);
  });

  it("只有空单元格时返回 false", () => {
    expect(looksLikeSpreadsheetText("\t\n\t")).toBe(false);
  });

  it("引号内的制表符不算多列", () => {
    expect(looksLikeSpreadsheetText('"a\tb"')).toBe(false);
  });

  it("任意一行有两列即识别为表格", () => {
    expect(looksLikeSpreadsheetText("a\nb\tc")).toBe(true);
  });
});

describe("htmlHasTable", () => {
  it("识别 table 标签", () => {
    expect(htmlHasTable("<table><tr><td>a</td></tr></table>")).toBe(true);
  });

  it("大小写不敏感并支持属性", () => {
    expect(htmlHasTable('<TABLE class="x">')).toBe(true);
  });

  it("非表格 HTML 返回 false", () => {
    expect(htmlHasTable("<div>text</div>")).toBe(false);
    expect(htmlHasTable("<tablet>")).toBe(false);
  });
});

describe("htmlTableToGrid", () => {
  it("展开 colspan 为重复单元格", () => {
    const grid = htmlTableToGrid(
      parseTable("<table><tr><td colspan=\"2\">合并</td><td>C</td></tr></table>")
    );
    expect(grid).toEqual([["合并", "合并", "C"]]);
  });

  it("rowspan 文本延续到后续行", () => {
    const grid = htmlTableToGrid(
      parseTable(
        "<table>" +
          '<tr><td rowspan="3">纵向</td><td>a</td></tr>' +
          "<tr><td>b</td></tr>" +
          "<tr><td>c</td></tr>" +
          "</table>"
      )
    );
    expect(grid).toEqual([
      ["纵向", "a"],
      ["纵向", "b"],
      ["纵向", "c"],
    ]);
  });

  it("rowspan 结束后后续单元格回到正确列", () => {
    const grid = htmlTableToGrid(
      parseTable(
        "<table>" +
          '<tr><td rowspan="2">A</td><td>B</td></tr>' +
          "<tr><td>C</td></tr>" +
          "</table>"
      )
    );
    expect(grid).toEqual([
      ["A", "B"],
      ["A", "C"],
    ]);
  });

  it("同时展开 colspan 和 rowspan", () => {
    const grid = htmlTableToGrid(
      parseTable(
        "<table>" +
          '<tr><td colspan="2" rowspan="2">M</td><td>A</td></tr>' +
          "<tr><td>B</td></tr>" +
          "<tr><td>C</td><td>D</td><td>E</td></tr>" +
          "</table>"
      )
    );
    expect(grid).toEqual([
      ["M", "M", "A"],
      ["M", "M", "B"],
      ["C", "D", "E"],
    ]);
  });

  it("同一行多个 rowspan 各自延续", () => {
    const grid = htmlTableToGrid(
      parseTable(
        "<table>" +
          '<tr><td rowspan="2">A</td><td rowspan="2">B</td><td>C</td></tr>' +
          "<tr><td>D</td></tr>" +
          "</table>"
      )
    );
    expect(grid).toEqual([
      ["A", "B", "C"],
      ["A", "B", "D"],
    ]);
  });

  it("rowspan 超出表格末尾时安全结束", () => {
    const grid = htmlTableToGrid(
      parseTable(
        "<table>" +
          '<tr><td rowspan="5">A</td><td>B</td></tr>' +
          "<tr><td>C</td></tr>" +
          "</table>"
      )
    );
    expect(grid).toEqual([
      ["A", "B"],
      ["A", "C"],
    ]);
  });

  it("读取 thead/tbody 中的 th 和 td", () => {
    const grid = htmlTableToGrid(
      parseTable(
        "<table><thead><tr><th>H1</th><th>H2</th></tr></thead>" +
          "<tbody><tr><td>a</td><td>b</td></tr></tbody></table>"
      )
    );
    expect(grid).toEqual([
      ["H1", "H2"],
      ["a", "b"],
    ]);
  });

  it("非法 colspan 按 1 处理", () => {
    const grid = htmlTableToGrid(
      parseTable('<table><tr><td colspan="abc">a</td><td>b</td></tr></table>')
    );
    expect(grid).toEqual([["a", "b"]]);
  });
});

describe("convertHtmlToMarkdown", () => {
  it("转换简单 HTML 表格", () => {
    const html =
      "<table>" +
      "<tr><th>名称</th><th>数量</th></tr>" +
      "<tr><td>路由器</td><td>1</td></tr>" +
      "</table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| 名称   | 数量 |\n| ------ | ---- |\n| 路由器 | 1    |"
    );
  });

  it("br 转换为单元格内换行", () => {
    const html =
      "<table>" +
      "<tr><td>第一行<br>第二行</td><td>x</td></tr>" +
      "<tr><td>1</td><td>2</td></tr>" +
      "</table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| 第一行<br>第二行 | x   |\n| ---------------- | --- |\n| 1                | 2   |"
    );
  });

  it("移除 style 和 script 内容", () => {
    const html =
      "<table>" +
      "<tr><td>文本<style>.a{color:red}</style><script>alert(1)</script></td><td>b</td></tr>" +
      "<tr><td>1</td><td>2</td></tr>" +
      "</table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| 文本 | b   |\n| ---- | --- |\n| 1    | 2   |"
    );
  });

  it("保留嵌套标签中的文本", () => {
    const html =
      "<table>" +
      "<tr><td><b>粗</b><span>体</span></td><td>b</td></tr>" +
      "<tr><td>1</td><td>2</td></tr>" +
      "</table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| 粗体 | b   |\n| ---- | --- |\n| 1    | 2   |"
    );
  });

  it("没有表格时返回 null", () => {
    expect(convertHtmlToMarkdown("<p>hi</p>", baseOptions)).toBeNull();
  });

  it("多个表格时默认选择单元格最多的表格", () => {
    const html =
      "<table><tr><td>A</td></tr></table>" +
      "<table>" +
      "<tr><td>B</td><td>C</td></tr>" +
      "<tr><td>D</td><td>E</td></tr>" +
      "</table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| B   | C   |\n| --- | --- |\n| D   | E   |"
    );
  });

  it("可配置为只转换第一个表格", () => {
    const html =
      "<table><tr><td>A</td></tr></table>" +
      "<table><tr><td>B</td><td>C</td></tr></table>";
    expect(
      convertHtmlToMarkdown(
        html,
        withOptions({ htmlTableStrategy: "first" })
      )
    ).toBe("| A   |\n| --- |");
  });

  it("环境没有 DOMParser 时返回 null", () => {
    vi.stubGlobal("DOMParser", undefined);
    expect(
      convertHtmlToMarkdown("<table><tr><td>a</td></tr></table>", baseOptions)
    ).toBeNull();
  });

  it("单元格数相同时选择列数更多的表格", () => {
    const html =
      "<table><tr><td>A</td></tr><tr><td>B</td></tr></table>" +
      "<table><tr><td>C</td><td>D</td></tr></table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| C   | D   |\n| --- | --- |"
    );
  });

  it("评分完全相同时保留第一个表格", () => {
    const html =
      "<table><tr><td>A</td></tr></table>" +
      "<table><tr><td>B</td></tr></table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe("| A   |\n| --- |");
  });

  it("空表格或全空单元格返回 null", () => {
    expect(convertHtmlToMarkdown("<table></table>", baseOptions)).toBeNull();
    expect(
      convertHtmlToMarkdown("<table><tr><td> </td></tr></table>", baseOptions)
    ).toBeNull();
  });

  it("解码 HTML 实体", () => {
    const html =
      "<table>" +
      "<tr><td>A &amp; B</td><td>&lt;tag&gt;</td></tr>" +
      "<tr><td>1</td><td>2</td></tr>" +
      "</table>";
    expect(convertHtmlToMarkdown(html, baseOptions)).toBe(
      "| A & B | <tag> |\n| ----- | ----- |\n| 1     | 2     |"
    );
  });
});

describe("gridToMarkdown", () => {
  it("首行作为表头", () => {
    expect(
      gridToMarkdown(
        [
          ["名称", "数量"],
          ["路由器", "1"],
        ],
        baseOptions
      )
    ).toBe("| 名称   | 数量 |\n| ------ | ---- |\n| 路由器 | 1    |");
  });

  it("关闭首行表头时生成空表头", () => {
    expect(
      gridToMarkdown(
        [
          ["a", "b"],
          ["c", "d"],
        ],
        withOptions({ firstRowAsHeader: false, alignment: "center" })
      )
    ).toBe("|       |       |\n| :---: | :---: |\n| a     | b     |\n| c     | d     |");
  });

  it.each([
    ["left", "| a    | b    |\n| :--- | :--- |\n| 1    | 2    |"],
    ["center", "| a     | b     |\n| :---: | :---: |\n| 1     | 2     |"],
    ["right", "| a    | b    |\n| ---: | ---: |\n| 1    | 2    |"],
    ["default", "| a   | b   |\n| --- | --- |\n| 1   | 2   |"],
  ] as const)("全表对齐 %s", (alignment, expected) => {
    expect(
      gridToMarkdown([["a", "b"], ["1", "2"]], withOptions({ alignment }))
    ).toBe(expected);
  });

  it("表头对齐标记覆盖列对齐并从表头移除", () => {
    expect(
      gridToMarkdown(
        [
          ["^l 名称", "^c 数量", "^r 备注"],
          ["a", "1", "b"],
        ],
        baseOptions
      )
    ).toBe(
      "| 名称 | 数量  | 备注 |\n| :--- | :---: | ---: |\n| a    | 1     | b    |"
    );
  });

  it("对齐标记大小写不敏感", () => {
    expect(
      gridToMarkdown(
        [
          ["^C 数量", "名称"],
          ["1", "a"],
        ],
        baseOptions
      )
    ).toBe("| 数量  | 名称 |\n| :---: | ---- |\n| 1     | a    |");
  });

  it("关闭首行表头时不解析对齐标记", () => {
    expect(
      gridToMarkdown(
        [
          ["^l a", "b"],
          ["c", "d"],
        ],
        withOptions({ firstRowAsHeader: false })
      )
    ).toBe("|      |     |\n| ---- | --- |\n| ^l a | b   |\n| c    | d   |");
  });

  it("转义竖线并把换行转为 br", () => {
    expect(
      gridToMarkdown(
        [
          ["a|b", "x\ny"],
          ["1", "2"],
        ],
        baseOptions
      )
    ).toBe("| a\\|b | x<br>y |\n| ---- | ------ |\n| 1    | 2      |");
  });

  it("去除首尾空白行和末尾空列", () => {
    expect(
      gridToMarkdown(
        [
          ["", "", ""],
          ["名称", "数量", ""],
          ["路由器", "1", ""],
          ["", "", ""],
        ],
        baseOptions
      )
    ).toBe("| 名称   | 数量 |\n| ------ | ---- |\n| 路由器 | 1    |");
  });

  it("补齐参差不齐的行", () => {
    expect(
      gridToMarkdown([["a", "b", "c"], ["1"]], baseOptions)
    ).toBe("| a   | b   | c   |\n| --- | --- | --- |\n| 1   |     |     |");
  });

  it("转换单列表格", () => {
    expect(gridToMarkdown([["a"], ["b"]], baseOptions)).toBe(
      "| a   |\n| --- |\n| b   |"
    );
  });

  it("中文列按两列宽度对齐", () => {
    expect(
      gridToMarkdown(
        [
          ["序号", "名称", "备注"],
          ["1", "路由器", "核心"],
          ["2", "交换机", "接入"],
        ],
        baseOptions
      )
    ).toBe(
      "| 序号 | 名称   | 备注 |\n| ---- | ------ | ---- |\n| 1    | 路由器 | 核心 |\n| 2    | 交换机 | 接入 |"
    );
  });

  it("空单元格按列宽补齐", () => {
    expect(
      gridToMarkdown(
        [
          ["a", "", "c"],
          ["", "b", ""],
        ],
        baseOptions
      )
    ).toBe("| a   |     | c   |\n| --- | --- | --- |\n|     | b   |     |");
  });

  it("关闭源码对齐时输出紧凑表格", () => {
    expect(
      gridToMarkdown(
        [
          ["名称", "数量"],
          ["路由器", "1"],
        ],
        withOptions({ alignSourceWidths: false })
      )
    ).toBe("| 名称 | 数量 |\n| --- | --- |\n| 路由器 | 1 |");
  });

  it("关闭源码对齐时仍应用按列对齐标记", () => {
    expect(
      gridToMarkdown(
        [
          ["^l 名称", "^c 数量", "^r 备注"],
          ["a", "1", "b"],
        ],
        withOptions({ alignSourceWidths: false })
      )
    ).toBe("| 名称 | 数量 | 备注 |\n| :--- | :---: | ---: |\n| a | 1 | b |");
  });

  it("去除单元格首尾空白", () => {
    expect(
      gridToMarkdown(
        [
          [" a ", " b "],
          ["c", "d"],
        ],
        baseOptions
      )
    ).toBe("| a   | b   |\n| --- | --- |\n| c   | d   |");
  });

  it("关闭去空格时保留单元格空白", () => {
    expect(
      gridToMarkdown(
        [
          [" a ", "b"],
          ["c", "d"],
        ],
        withOptions({ trimCells: false })
      )
    ).toBe("|  a  | b   |\n| --- | --- |\n| c   | d   |");
  });

  it("空数据返回 null", () => {
    expect(gridToMarkdown([], baseOptions)).toBeNull();
    expect(gridToMarkdown([["", ""]], baseOptions)).toBeNull();
  });

  it("只有表头行时不输出正文", () => {
    expect(gridToMarkdown([["a", "b"]], baseOptions)).toBe(
      "| a   | b   |\n| --- | --- |"
    );
  });

  it("只有对齐标记的表头变为空表头", () => {
    expect(gridToMarkdown([["^l", "^c"], ["1", "2"]], baseOptions)).toBe(
      "|      |       |\n| :--- | :---: |\n| 1    | 2     |"
    );
  });

  it("对齐标记后没有空格也能识别", () => {
    expect(gridToMarkdown([["^l名称"], ["a"]], baseOptions)).toBe(
      "| 名称 |\n| :--- |\n| a    |"
    );
  });

  it("无效对齐标记按普通文本处理", () => {
    expect(gridToMarkdown([["^x a", "b"], ["1", "2"]], baseOptions)).toBe(
      "| ^x a | b   |\n| ---- | --- |\n| 1    | 2   |"
    );
  });

  it("对齐标记不在开头时不解析", () => {
    expect(gridToMarkdown([["a^l", "b"], ["1", "2"]], baseOptions)).toBe(
      "| a^l | b   |\n| --- | --- |\n| 1   | 2   |"
    );
  });

  it("emoji 按两列宽度对齐", () => {
    expect(gridToMarkdown([["📦", "x"], ["1", "2"]], baseOptions)).toBe(
      "| 📦  | x   |\n| --- | --- |\n| 1   | 2   |"
    );
  });

  it("组合字符不占显示宽度", () => {
    expect(gridToMarkdown([["e\u0301", "x"], ["1", "2"]], baseOptions)).toBe(
      "| e\u0301   | x   |\n| --- | --- |\n| 1   | 2   |"
    );
  });

  it("单元格内 CRLF 转为 br", () => {
    expect(gridToMarkdown([["a\r\nb"], ["1"]], baseOptions)).toBe(
      "| a<br>b |\n| ------ |\n| 1      |"
    );
  });

  it("保留中间空行", () => {
    expect(
      gridToMarkdown([["a", "b"], ["", ""], ["c", "d"]], baseOptions)
    ).toBe("| a   | b   |\n| --- | --- |\n|     |     |\n| c   | d   |");
  });

  it("保留开头空列", () => {
    expect(gridToMarkdown([["", "a"], ["", "b"]], baseOptions)).toBe(
      "|     | a   |\n| --- | --- |\n|     | b   |"
    );
  });

  it("后续行更长时按最大列数补齐", () => {
    expect(gridToMarkdown([["a"], ["b", "c"]], baseOptions)).toBe(
      "| a   |     |\n| --- | --- |\n| b   | c   |"
    );
  });
});
