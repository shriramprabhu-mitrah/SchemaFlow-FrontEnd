export type DiffType = 'equal' | 'added' | 'removed' | 'modified' | 'empty';

export interface DiffToken {
  text: string;
  type: 'plain' | 'added' | 'removed' | 'string' | 'key' | 'number' | 'keyword' | 'bracket';
}

export interface DiffLine {
  lineNum?: number;
  text: string;
  type: DiffType;
  tokens?: DiffToken[];
}

export interface SideBySideRow {
  left: DiffLine;
  right: DiffLine;
}

export interface UnifiedLine {
  type: DiffType;
  oldLineNum?: number;
  newLineNum?: number;
  text: string;
  tokens?: DiffToken[];
}

export interface DiffStats {
  additions: number;
  deletions: number;
  modifications: number;
  totalLeftLines: number;
  totalRightLines: number;
  isIdentical: boolean;
}

export interface DiffResult {
  sideBySideRows: SideBySideRow[];
  unifiedLines: UnifiedLine[];
  stats: DiffStats;
}

/**
 * Pure TypeScript Myers Diff Algorithm implementation (Zero npm packages).
 * Computes shortest edit script (SES) / Longest Common Subsequence (LCS).
 */
export class DiffEngine {
  /**
   * Main entry point to compute side-by-side and unified diffs.
   */
  public static computeDiff(originalText: string, modifiedText: string, ignoreWhitespace = false): DiffResult {
    const rawLinesA = this.splitLines(originalText);
    const rawLinesB = this.splitLines(modifiedText);

    // If both are empty
    if (rawLinesA.length === 0 && rawLinesB.length === 0) {
      return {
        sideBySideRows: [],
        unifiedLines: [],
        stats: { additions: 0, deletions: 0, modifications: 0, totalLeftLines: 0, totalRightLines: 0, isIdentical: true }
      };
    }

    // Line interning for fast integer comparison
    const { indexedA, indexedB } = this.internLines(rawLinesA, rawLinesB, ignoreWhitespace);

    // Run Myers diff
    const editScript = this.myersDiff(indexedA, indexedB);

    // Build aligned side-by-side rows and unified lines
    return this.buildDiffResult(rawLinesA, rawLinesB, editScript);
  }

  private static splitLines(text: string): string[] {
    if (!text) return [];
    // Normalize line endings
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized.split('\n');
  }

  /**
   * Intern lines so comparison between lines is a fast integer lookup.
   */
  private static internLines(linesA: string[], linesB: string[], ignoreWhitespace: boolean): { indexedA: number[]; indexedB: number[] } {
    const map = new Map<string, number>();
    let counter = 0;

    const getIndex = (line: string): number => {
      const key = ignoreWhitespace ? line.trim() : line;
      let id = map.get(key);
      if (id === undefined) {
        id = counter++;
        map.set(key, id);
      }
      return id;
    };

    return {
      indexedA: linesA.map(getIndex),
      indexedB: linesB.map(getIndex)
    };
  }

  /**
   * Correct Myers O(ND) algorithm computing shortest edit script (SES).
   */
  private static myersDiff(a: number[], b: number[]): Array<{ op: 'keep' | 'delete' | 'insert'; aIndex?: number; bIndex?: number }> {
    const n = a.length;
    const m = b.length;
    const max = n + m;
    if (max === 0) return [];

    const v = new Int32Array(2 * max + 2);
    v[1 + max] = 0;

    const trace: Int32Array[] = [];
    let finalD = -1;

    for (let d = 0; d <= max; d++) {
      trace.push(new Int32Array(v));

      for (let k = -d; k <= d; k += 2) {
        const down = (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max]));
        const kPrev = down ? k + 1 : k - 1;

        let x = down ? v[k + 1 + max] : v[k - 1 + max] + 1;
        let y = x - k;

        while (x < n && y < m && a[x] === b[y]) {
          x++;
          y++;
        }

        v[k + max] = x;

        if (x >= n && y >= m) {
          finalD = d;
          break;
        }
      }

      if (finalD !== -1) break;
    }

    // Backtrack
    const script: Array<{ op: 'keep' | 'delete' | 'insert'; aIndex?: number; bIndex?: number }> = [];
    let x = n;
    let y = m;

    for (let d = finalD; d > 0; d--) {
      const vPrev = trace[d];
      const k = x - y;
      const down = (k === -d || (k !== d && vPrev[k - 1 + max] < vPrev[k + 1 + max]));
      const prevK = down ? k + 1 : k - 1;

      const prevX = vPrev[prevK + max];
      const prevY = prevX - prevK;

      while (x > prevX && y > prevY) {
        x--;
        y--;
        script.push({ op: 'keep', aIndex: x, bIndex: y });
      }

      if (down) {
        y--;
        script.push({ op: 'insert', bIndex: y });
      } else {
        x--;
        script.push({ op: 'delete', aIndex: x });
      }
    }

    while (x > 0 && y > 0) {
      x--;
      y--;
      script.push({ op: 'keep', aIndex: x, bIndex: y });
    }

    return script.reverse();
  }

  /**
   * Assembles the raw edit operations into side-by-side aligned rows and unified lines.
   */
  private static buildDiffResult(
    linesA: string[],
    linesB: string[],
    editScript: Array<{ op: 'keep' | 'delete' | 'insert'; aIndex?: number; bIndex?: number }>
  ): DiffResult {
    const sideBySideRows: SideBySideRow[] = [];
    const unifiedLines: UnifiedLine[] = [];

    let leftLineNum = 1;
    let rightLineNum = 1;

    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    let i = 0;
    while (i < editScript.length) {
      const current = editScript[i];

      if (current.op === 'keep') {
        const textA = linesA[current.aIndex!];
        const tokens = this.tokenizeLine(textA);

        sideBySideRows.push({
          left: { lineNum: leftLineNum, text: textA, type: 'equal', tokens },
          right: { lineNum: rightLineNum, text: textA, type: 'equal', tokens }
        });

        unifiedLines.push({
          type: 'equal',
          oldLineNum: leftLineNum,
          newLineNum: rightLineNum,
          text: textA,
          tokens
        });

        leftLineNum++;
        rightLineNum++;
        i++;
      } else {
        // Collect consecutive deletions and insertions for block matching
        const delIndices: number[] = [];
        const insIndices: number[] = [];

        while (i < editScript.length && editScript[i].op !== 'keep') {
          if (editScript[i].op === 'delete') {
            delIndices.push(editScript[i].aIndex!);
          } else if (editScript[i].op === 'insert') {
            insIndices.push(editScript[i].bIndex!);
          }
          i++;
        }

        const maxPair = Math.max(delIndices.length, insIndices.length);

        for (let p = 0; p < maxPair; p++) {
          const hasDel = p < delIndices.length;
          const hasIns = p < insIndices.length;

          if (hasDel && hasIns) {
            // Modified line (pair deletion + insertion)
            const textL = linesA[delIndices[p]];
            const textR = linesB[insIndices[p]];
            const { leftTokens, rightTokens } = this.computeWordDiff(textL, textR);

            sideBySideRows.push({
              left: { lineNum: leftLineNum, text: textL, type: 'modified', tokens: leftTokens },
              right: { lineNum: rightLineNum, text: textR, type: 'modified', tokens: rightTokens }
            });

            unifiedLines.push({
              type: 'removed',
              oldLineNum: leftLineNum,
              text: textL,
              tokens: leftTokens
            });
            unifiedLines.push({
              type: 'added',
              newLineNum: rightLineNum,
              text: textR,
              tokens: rightTokens
            });

            modifications++;
            deletions++;
            additions++;
            leftLineNum++;
            rightLineNum++;
          } else if (hasDel) {
            // Deletion only
            const textL = linesA[delIndices[p]];
            const tokens = this.tokenizeLine(textL);

            sideBySideRows.push({
              left: { lineNum: leftLineNum, text: textL, type: 'removed', tokens },
              right: { text: '', type: 'empty' }
            });

            unifiedLines.push({
              type: 'removed',
              oldLineNum: leftLineNum,
              text: textL,
              tokens
            });

            deletions++;
            leftLineNum++;
          } else if (hasIns) {
            // Addition only
            const textR = linesB[insIndices[p]];
            const tokens = this.tokenizeLine(textR);

            sideBySideRows.push({
              left: { text: '', type: 'empty' },
              right: { lineNum: rightLineNum, text: textR, type: 'added', tokens }
            });

            unifiedLines.push({
              type: 'added',
              newLineNum: rightLineNum,
              text: textR,
              tokens
            });

            additions++;
            rightLineNum++;
          }
        }
      }
    }

    const isIdentical = additions === 0 && deletions === 0;

    return {
      sideBySideRows,
      unifiedLines,
      stats: {
        additions,
        deletions,
        modifications,
        totalLeftLines: linesA.length,
        totalRightLines: linesB.length,
        isIdentical
      }
    };
  }

  /**
   * Word/token-level diffing between two modified lines.
   * Highlights specific words or characters changed within the line.
   */
  private static computeWordDiff(textA: string, textB: string): { leftTokens: DiffToken[]; rightTokens: DiffToken[] } {
    const wordsA = this.splitIntoTokens(textA);
    const wordsB = this.splitIntoTokens(textB);

    const { indexedA, indexedB } = this.internLines(wordsA, wordsB, false);
    const script = this.myersDiff(indexedA, indexedB);

    const leftTokens: DiffToken[] = [];
    const rightTokens: DiffToken[] = [];

    for (const step of script) {
      if (step.op === 'keep') {
        const text = wordsA[step.aIndex!];
        leftTokens.push({ text, type: this.classifyToken(text) });
        rightTokens.push({ text, type: this.classifyToken(text) });
      } else if (step.op === 'delete') {
        const text = wordsA[step.aIndex!];
        leftTokens.push({ text, type: 'removed' });
      } else if (step.op === 'insert') {
        const text = wordsB[step.bIndex!];
        rightTokens.push({ text, type: 'added' });
      }
    }

    return { leftTokens, rightTokens };
  }

  /**
   * Splits a line into tokens (words, digits, punctuation, whitespace chunks).
   */
  private static splitIntoTokens(line: string): string[] {
    const tokens: string[] = [];
    const regex = /([a-zA-Z_]+|[0-9]+|\s+|"[^"]*"|'[^']*'|[^\w\s])/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(line.slice(lastIndex, match.index));
      }
      tokens.push(match[0]);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      tokens.push(line.slice(lastIndex));
    }

    return tokens.length > 0 ? tokens : [line];
  }

  /**
   * Syntax highlighting classifier for tokens (JSON, DBML, code).
   */
  private static classifyToken(text: string): DiffToken['type'] {
    if (/^"[^"]*"$|^'[^']*'$/.test(text)) {
      return 'string';
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return 'number';
    }
    if (/^(Table|Ref|Enum|TableGroup|Project|true|false|null|pk|not\s+null|unique|default|int|varchar|boolean|datetime|timestamp)$/i.test(text)) {
      return 'keyword';
    }
    if (/^[{}[\]()]$/.test(text)) {
      return 'bracket';
    }
    return 'plain';
  }

  /**
   * Syntax tokenizes an entire line for display when no word-diff is active.
   */
  public static tokenizeLine(line: string): DiffToken[] {
    const tokens = this.splitIntoTokens(line);
    return tokens.map(t => ({
      text: t,
      type: this.classifyToken(t)
    }));
  }
}
