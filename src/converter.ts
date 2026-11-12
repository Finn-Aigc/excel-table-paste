export type TableAlignment = "default" | "left" | "center" | "right";
export type HtmlTableStrategy = "largest" | "first";

export interface ConvertOptions {
  firstRowAsHeader: boolean;
  alignment: TableAlignment;
  trimCells: boolean;
  htmlTableStrategy: HtmlTableStrategy;
  alignSourceWidths: boolean;
}

export function parseDelimited(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
        } else {
          inQuotes = false;
          index += 1;
        }
      } else {
        field += char;
        index += 1;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
      index += 1;
    } else if (char === "\t") {
      row.push(field);
      field = "";
      index += 1;
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else if (char === "\r") {
      index += 1;
    } else {
      field += char;
      index += 1;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function looksLikeSpreadsheetText(text: string): boolean {
  if (!text.includes("\t")) {
    return false;
  }

  const rows = parseDelimited(text).filter((row) =>
    row.some((cell) => cell.trim() !== "")
  );
  return rows.some(
    (row) => row.filter((cell) => cell.trim() !== "").length >= 2
  );
}

export function htmlHasTable(html: string): boolean {
  return /<table[\s>]/i.test(html);
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function readCellText(cell: HTMLTableCellElement): string {
  const clone = cell.cloneNode(true) as HTMLTableCellElement;

  clone.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  clone.querySelectorAll("style, script").forEach((element) => element.remove());

  return normalizeNewlines(clone.textContent ?? "");
}

export function htmlTableToGrid(table: HTMLTableElement): string[][] {
  const grid: string[][] = [];
  // Rowspans carry their text into following rows, mirroring how Excel merges cells.
  const rowspanCarries = new Map<number, { text: string; remaining: number }>();

  for (const tableRow of Array.from(table.rows)) {
    const row: string[] = [];
    let column = 0;

    const fillCarries = () => {
      while (rowspanCarries.has(column)) {
        const carry = rowspanCarries.get(column)!;
        row[column] = carry.text;
        carry.remaining -= 1;
        if (carry.remaining <= 0) {
          rowspanCarries.delete(column);
        }
        column += 1;
      }
    };

    for (const cell of Array.from(tableRow.cells)) {
      fillCarries();

      const text = readCellText(cell);
      const colspan = Math.max(1, cell.colSpan || 1);
      const rowspan = Math.max(1, cell.rowSpan || 1);

      for (let offset = 0; offset < colspan; offset += 1) {
        row[column] = text;
        if (rowspan > 1) {
          rowspanCarries.set(column, { text, remaining: rowspan - 1 });
        }
        column += 1;
      }
    }

    fillCarries();
    grid.push(row);
  }

  return grid;
}

export function convertHtmlToMarkdown(
  html: string,
  options: ConvertOptions
): string | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(document.querySelectorAll("table"));
  if (tables.length === 0) {
    return null;
  }

  if (options.htmlTableStrategy === "first") {
    return gridToMarkdown(
      htmlTableToGrid(tables[0] as HTMLTableElement),
      options
    );
  }

  let bestGrid: string[][] | null = null;
  let bestScore = -1;
  let bestColumns = 0;

  for (const table of tables) {
    const grid = htmlTableToGrid(table as HTMLTableElement);
    const score = countNonEmptyCells(grid);
    const columns = grid.reduce(
      (max, row) => Math.max(max, row.length),
      0
    );

    if (score > bestScore || (score === bestScore && columns > bestColumns)) {
      bestGrid = grid;
      bestScore = score;
      bestColumns = columns;
    }
  }

  return bestGrid ? gridToMarkdown(bestGrid, options) : null;
}

function countNonEmptyCells(grid: string[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.trim() !== "") {
        count += 1;
      }
    }
  }
  return count;
}

function normalizeGrid(rawGrid: string[][], trimCells: boolean): string[][] {
  const grid = rawGrid.map((row) =>
    row.map((cell) => {
      const normalized = normalizeNewlines(cell);
      return trimCells ? normalized.trim() : normalized;
    })
  );

  while (grid.length > 0 && grid[grid.length - 1].every((cell) => cell.trim() === "")) {
    grid.pop();
  }
  while (grid.length > 0 && grid[0].every((cell) => cell.trim() === "")) {
    grid.shift();
  }
  if (grid.length === 0) {
    return grid;
  }

  let width = 0;
  for (const row of grid) {
    width = Math.max(width, row.length);
  }
  while (width > 0 && grid.every((row) => (row[width - 1] ?? "").trim() === "")) {
    width -= 1;
  }

  return grid.map((row) => {
    const padded = row.slice(0, width);
    while (padded.length < width) {
      padded.push("");
    }
    return padded;
  });
}

function escapeCellContent(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

const WIDE_CHARACTER =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]|[\u{1f300}-\u{1faff}]|[\u{20000}-\u{3fffd}]/u;

function displayWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint === 0x200d ||
      (codePoint >= 0x0300 && codePoint <= 0x036f) ||
      (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    ) {
      continue;
    }
    width += WIDE_CHARACTER.test(character) ? 2 : 1;
  }
  return width;
}

function padCell(value: string, width: number): string {
  const padding = width - displayWidth(value);
  return padding > 0 ? value + " ".repeat(padding) : value;
}

function minimumColumnWidth(alignment: TableAlignment): number {
  switch (alignment) {
    case "left":
      return 4;
    case "center":
      return 5;
    case "right":
      return 4;
    default:
      return 3;
  }
}

function separatorCell(alignment: TableAlignment, width: number): string {
  switch (alignment) {
    case "left":
      return `:${"-".repeat(width - 1)}`;
    case "center":
      return `:${"-".repeat(width - 2)}:`;
    case "right":
      return `${"-".repeat(width - 1)}:`;
    default:
      return "-".repeat(width);
  }
}

function alignmentFromMarker(marker: string): TableAlignment {
  switch (marker.toLowerCase()) {
    case "l":
      return "left";
    case "c":
      return "center";
    default:
      return "right";
  }
}

export function gridToMarkdown(
  rawGrid: string[][],
  options: ConvertOptions
): string | null {
  const grid = normalizeGrid(rawGrid, options.trimCells);
  if (grid.length === 0) {
    return null;
  }

  const width = grid[0].length;
  if (width === 0) {
    return null;
  }

  const header = options.firstRowAsHeader
    ? grid[0].slice()
    : new Array<string>(width).fill("");
  const body = options.firstRowAsHeader ? grid.slice(1) : grid;
  const columnAlignments = new Array<TableAlignment>(width).fill(options.alignment);

  if (options.firstRowAsHeader) {
    header.forEach((cell, index) => {
      const match = /^\^([lcr])/i.exec(cell);
      if (!match) {
        return;
      }
      columnAlignments[index] = alignmentFromMarker(match[1]);
      header[index] = cell.slice(2).trimStart();
    });
  }

  const escapedHeader = header.map(escapeCellContent);
  const escapedBody = body.map((row) => row.map(escapeCellContent));
  const columnWidths = columnAlignments.map((alignment) =>
    minimumColumnWidth(alignment)
  );

  if (options.alignSourceWidths) {
    for (let column = 0; column < width; column += 1) {
      columnWidths[column] = Math.max(
        columnWidths[column],
        displayWidth(escapedHeader[column])
      );
      for (const row of escapedBody) {
        columnWidths[column] = Math.max(
          columnWidths[column],
          displayWidth(row[column])
        );
      }
    }
  }

  const formatRow = (row: string[]) =>
    `| ${row
      .map((cell, column) =>
        options.alignSourceWidths
          ? padCell(cell, columnWidths[column])
          : cell
      )
      .join(" | ")} |`;
  const separator = `| ${columnAlignments
    .map((alignment, column) => separatorCell(alignment, columnWidths[column]))
    .join(" | ")} |`;

  return [formatRow(escapedHeader), separator, ...escapedBody.map(formatRow)].join("\n");
}
