const FENCE_MARKER = /^\s*(`{3,}|~{3,})/;
const FENCE_CLOSER = /^\s*(`{3,}|~{3,})\s*$/;

export function isInProtectedContext(lines: string[], lineNumber: number): boolean {
  if (lineNumber < 0 || lineNumber >= lines.length) {
    return false;
  }

  return (
    isInFrontmatter(lines, lineNumber) ||
    isInFencedCodeBlock(lines, lineNumber) ||
    isMarkdownTableRow(lines[lineNumber] ?? "")
  );
}

function isInFrontmatter(lines: string[], lineNumber: number): boolean {
  if (lines.length === 0) {
    return false;
  }

  const firstLine = (lines[0] ?? "").replace(/^\uFEFF/, "");
  if (!/^---\s*$/.test(firstLine)) {
    return false;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (/^(---|\.\.\.)\s*$/.test(lines[index] ?? "")) {
      return lineNumber <= index;
    }
  }

  return true;
}

function isInFencedCodeBlock(lines: string[], lineNumber: number): boolean {
  let fenceCharacter: string | null = null;
  let fenceLength = 0;

  for (let index = 0; index < lineNumber; index += 1) {
    const line = lines[index] ?? "";
    const markerMatch = FENCE_MARKER.exec(line);
    if (!markerMatch) {
      continue;
    }

    const marker = markerMatch[1];
    if (fenceCharacter === null) {
      fenceCharacter = marker[0];
      fenceLength = marker.length;
    } else if (
      marker[0] === fenceCharacter &&
      marker.length >= fenceLength &&
      FENCE_CLOSER.test(line)
    ) {
      fenceCharacter = null;
      fenceLength = 0;
    }
  }

  if (fenceCharacter !== null) {
    return true;
  }

  return FENCE_MARKER.test(lines[lineNumber] ?? "");
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return false;
  }
  return (trimmed.match(/\|/g)?.length ?? 0) >= 2;
}