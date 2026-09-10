import { Injectable } from '@angular/core';
import { TocItem } from '../models/cms-docs.model';

if (typeof window !== 'undefined') {
  (window as any).copyDocCodeSnippet = function(btn: HTMLElement) {
    const wrapper = btn.closest('.doc-code-wrapper');
    const codeBlock = wrapper?.querySelector('.doc-code-block') || wrapper?.querySelector('code');
    if (!codeBlock) return;

    const textToCopy = (codeBlock as HTMLElement).innerText.trim();
    const setSuccess = () => {
      const oldText = 'Copy';
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = oldText;
        btn.classList.remove('copied');
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(setSuccess).catch(() => {
        fallbackCopyTextToClipboard(textToCopy, setSuccess);
      });
    } else {
      fallbackCopyTextToClipboard(textToCopy, setSuccess);
    }
  };

  function fallbackCopyTextToClipboard(text: string, onSuccess: () => void) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      if (document.execCommand('copy')) {
        onSuccess();
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseInlineText(text: string): string {
  if (!text) return '';
  let res = text;

  // Video Embeds ![video:caption](url)
  res = res.replace(/!\[video:([^\]]*)\]\(([^)]+)\)/gi, (match, caption, src) => {
    const cleanSrc = src.trim();
    const cleanCap = caption.trim();
    if (cleanSrc.includes('youtube.com') || cleanSrc.includes('youtu.be')) {
      const embedUrl = cleanSrc.replace('watch?v=', 'embed/');
      return `<div class="doc-media-embed doc-video-embed"><iframe src="${embedUrl}" title="${escapeHtml(cleanCap)}" frameborder="0" allowfullscreen></iframe></div>`;
    }
    return `<div class="doc-media-embed doc-video-embed"><video controls src="${cleanSrc}"></video><div class="doc-media-caption">${escapeHtml(cleanCap)}</div></div>`;
  });

  // Images ![alt](url)
  res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/gi, (match, alt, src) => {
    const cleanSrc = src.trim();
    const cleanAlt = alt.trim();
    return `<div class="doc-media-embed doc-image-embed"><img class="doc-markdown-img" alt="${escapeHtml(cleanAlt)}" src="${cleanSrc}" loading="lazy" onerror="this.onerror=null; let parent=this.closest('.doc-media-embed'); if(parent) parent.remove(); else this.remove();" /><div class="doc-media-caption">${escapeHtml(cleanAlt)}</div></div>`;
  });

  // Links [text](url)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/gi, '<a class="doc-markdown-link" href="$2" target="_blank" rel="noopener">$1</a>');

  // Inline code `code`
  res = res.replace(/`([^`]+)`/g, (match, codeText) => {
    return `<code class="doc-inline-code">${escapeHtml(codeText)}</code>`;
  });

  // Bold **text** or __text__
  res = res.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  // Italic *text* or _text_
  res = res.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
  // Strikethrough ~~text~~
  res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');

  return res;
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownRendererService {

  render(markdown: string): { html: string; toc: TocItem[] } {
    if (!markdown) {
      return { html: '', toc: [] };
    }

    const toc: TocItem[] = [];

    // Extract TOC headings (# ## ###)
    const rawLines = markdown.split('\n');
    rawLines.forEach(line => {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/[\*_`]/g, '');
        const id = 'heading-' + text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        toc.push({ id, text, level });
      }
    });

    const lines = markdown.split('\n');
    const htmlBlocks: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code block (```)
      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim().toUpperCase() || 'CODE';
        i++;
        const codeLines: string[] = [];
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith('```')) {
          i++;
        }

        const formattedCodeLines = codeLines.map((cLine: string) => escapeHtml(cLine)).join('\n');

        htmlBlocks.push(`<div class="doc-code-wrapper">
  <div class="doc-code-header">
    <span class="doc-code-lang">${lang}</span>
    <button type="button" class="doc-code-copy-btn" onclick="if(window.copyDocCodeSnippet)window.copyDocCodeSnippet(this)">Copy</button>
  </div>
  <pre class="doc-code-block"><code class="language-${lang.toLowerCase()}">${formattedCodeLines}</code></pre>
</div>`);
        continue;
      }

      // Table (| col1 | col2 |)
      if (line.trim().startsWith('|') && line.includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        let maxCols = 0;
        const parsedRows: string[][] = [];
        tableLines.forEach((tLine) => {
          if (tLine.replace(/[\s|:-]/g, '') === '') {
            return; // Skip separator line |---|---|
          }
          const cells = tLine.split('|').slice(1, -1).map(c => c.trim());
          if (cells.length > maxCols) maxCols = cells.length;
          parsedRows.push(cells);
        });

        let tableHtml = '<div class="table-responsive"><table class="doc-markdown-table"><thead>';
        if (parsedRows.length > 0) {
          const headerCells = parsedRows[0];
          while (headerCells.length < maxCols) {
            headerCells.push('');
          }
          tableHtml += '<tr>' + headerCells.map(c => `<th>${parseInlineText(c)}</th>`).join('') + '</tr></thead><tbody>';

          for (let r = 1; r < parsedRows.length; r++) {
            const rowCells = parsedRows[r];
            while (rowCells.length < maxCols) {
              rowCells.push('');
            }
            const finalCells = rowCells.slice(0, maxCols);
            tableHtml += '<tr>' + finalCells.map(c => `<td>${parseInlineText(c)}</td>`).join('') + '</tr>';
          }
        }
        tableHtml += '</tbody></table></div>';
        htmlBlocks.push(tableHtml);
        continue;
      }

      // Headings (# ## ### ####)
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = 'heading-' + text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        htmlBlocks.push(`<h${level} id="${id}" class="doc-heading doc-h${level}">${parseInlineText(text)}</h${level}>`);
        i++;
        continue;
      }

      // Callouts / Blockquotes (> [!NOTE], > text)
      if (line.trim().startsWith('>')) {
        let alertType: string | null = null;
        const alertMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (alertMatch) {
          alertType = alertMatch[1].toLowerCase();
        }
        const bqLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          let bLine = lines[i].trim().slice(1).trim();
          if (bLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)) {
            i++;
            continue;
          }
          bqLines.push(bLine);
          i++;
        }
        const contentStr = bqLines.map(b => parseInlineText(b)).join('<br/>');
        if (alertType) {
          htmlBlocks.push(`<blockquote class="doc-alert doc-alert-${alertType}"><div class="doc-alert-title">${alertType.toUpperCase()}</div><p>${contentStr}</p></blockquote>`);
        } else {
          htmlBlocks.push(`<blockquote class="doc-blockquote"><p>${contentStr}</p></blockquote>`);
        }
        continue;
      }

      // Lists (- item, 1. item)
      if (line.trim().match(/^[-*+]\s+/) || line.trim().match(/^\d+\.\s+/)) {
        const isOl = !!line.trim().match(/^\d+\.\s+/);
        const listTag = isOl ? 'ol' : 'ul';
        const listClass = isOl ? 'doc-ol' : 'doc-ul';
        let listHtml = `<${listTag} class="${listClass}">`;
        while (i < lines.length && (lines[i].trim().match(/^[-*+]\s+/) || lines[i].trim().match(/^\d+\.\s+/))) {
          let itemText = lines[i].trim().replace(/^([-*+]|\d+\.)\s+/, '');
          listHtml += `<li>${parseInlineText(itemText)}</li>`;
          i++;
        }
        listHtml += `</${listTag}>`;
        htmlBlocks.push(listHtml);
        continue;
      }

      // Paragraph / Blank line
      if (line.trim() === '') {
        i++;
        continue;
      }

      htmlBlocks.push(`<p class="doc-paragraph">${parseInlineText(line)}</p>`);
      i++;
    }

    return { html: htmlBlocks.join('\n'), toc };
  }
}
