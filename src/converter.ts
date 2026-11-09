export type TableAlignment = "default" | "left" | "center" | "right";

export interface ConvertOptions {
  firstRowAsHeader: boolean;
  alignment: TableAlignment;
  trimCells: boolean;
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
  if (!text.includes("\t") || !text.includes("\n")) {
    return false;
  }

  const rows = parseDelimited(text).filter((row) =>
    row.some((cell) => cell.trim() !== "")
  );
  if (rows.length < 2) {
    return false;
  }

  const tabularRows = rows.filter(
    (row) => row.filter((cell) => cell.trim() !== "").length >= 2
  );
  return tabularRows.length >= 2;
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
  const table = document.querySelector("table");
  if (!table) {
    return null;
  }

  return gridToMarkdown(htmlTableToGrid(table as HTMLTableElement), options);
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

function alignmentToken(alignment: TableAlignment): string {
  switch (alignment) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
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

  const header = options.firstRowAsHeader ? grid[0] : new Array<string>(width).fill("");
  const body = options.firstRowAsHeader ? grid.slice(1) : grid;
  const formatRow = (row: string[]) =>
    `| ${row.map(escapeCellContent).join(" | ")} |`;
  const separator = `| ${new Array<string>(width)
    .fill(alignmentToken(options.alignment))
    .join(" | ")} |`;

  return [formatRow(header), separator, ...body.map(formatRow)].join("\n");
}
