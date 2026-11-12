import { describe, expect, it } from "vitest";
import { isInProtectedContext } from "../src/context";

describe("isInProtectedContext", () => {
  it("识别 frontmatter 区域", () => {
    const lines = ["---", "title: test", "tags: [a]", "---", "", "正文"];
    expect(isInProtectedContext(lines, 0)).toBe(true);
    expect(isInProtectedContext(lines, 2)).toBe(true);
    expect(isInProtectedContext(lines, 3)).toBe(true);
    expect(isInProtectedContext(lines, 4)).toBe(false);
    expect(isInProtectedContext(lines, 5)).toBe(false);
  });

  it("支持 BOM 和省略号形式的 frontmatter 结束符", () => {
    const lines = ["\uFEFF---", "title: test", "...", "正文"];
    expect(isInProtectedContext(lines, 1)).toBe(true);
    expect(isInProtectedContext(lines, 2)).toBe(true);
    expect(isInProtectedContext(lines, 3)).toBe(false);
  });

  it("未闭合的 frontmatter 保持保护", () => {
    const lines = ["---", "title: test", "正文"];
    expect(isInProtectedContext(lines, 2)).toBe(true);
  });

  it("识别反引号围栏代码块", () => {
    const lines = ["# 标题", "```ts", "const a = 1;", "```", "正文"];
    expect(isInProtectedContext(lines, 1)).toBe(true);
    expect(isInProtectedContext(lines, 2)).toBe(true);
    expect(isInProtectedContext(lines, 3)).toBe(true);
    expect(isInProtectedContext(lines, 4)).toBe(false);
  });

  it("识别波浪号围栏和更长的围栏", () => {
    const lines = ["~~~~", "```", "still code", "~~~~", "正文"];
    expect(isInProtectedContext(lines, 1)).toBe(true);
    expect(isInProtectedContext(lines, 2)).toBe(true);
    expect(isInProtectedContext(lines, 3)).toBe(true);
    expect(isInProtectedContext(lines, 4)).toBe(false);

    const longer = ["```", "~~~~", "still code", "````", "正文"];
    expect(isInProtectedContext(longer, 2)).toBe(true);
    expect(isInProtectedContext(longer, 3)).toBe(true);
    expect(isInProtectedContext(longer, 4)).toBe(false);
  });

  it("代码块内带文字的反引号不会结束围栏", () => {
    const lines = ["```", "```not a closer", "still code", "```", "正文"];
    expect(isInProtectedContext(lines, 1)).toBe(true);
    expect(isInProtectedContext(lines, 2)).toBe(true);
    expect(isInProtectedContext(lines, 4)).toBe(false);
  });

  it("识别已有 Markdown 表格行", () => {
    const lines = ["正文", "| a | b |", "| --- | --- |", "| 1 | 2 |", "正文"];
    expect(isInProtectedContext(lines, 1)).toBe(true);
    expect(isInProtectedContext(lines, 2)).toBe(true);
    expect(isInProtectedContext(lines, 3)).toBe(true);
    expect(isInProtectedContext(lines, 0)).toBe(false);
    expect(isInProtectedContext(lines, 4)).toBe(false);
  });

  it("普通文本和空行不保护", () => {
    expect(isInProtectedContext(["普通文本", "", "另一行"], 0)).toBe(false);
    expect(isInProtectedContext(["普通文本", "", "另一行"], 1)).toBe(false);
    expect(isInProtectedContext(["a | b", "c | d"], 0)).toBe(false);
  });

  it("越界行号返回 false", () => {
    expect(isInProtectedContext([], 0)).toBe(false);
    expect(isInProtectedContext(["a"], -1)).toBe(false);
    expect(isInProtectedContext(["a"], 2)).toBe(false);
  });
});