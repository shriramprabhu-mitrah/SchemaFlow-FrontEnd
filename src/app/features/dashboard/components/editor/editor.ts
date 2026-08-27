import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../../../shared/button/button';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './editor.html',
})
export class EditorComponent implements OnInit, OnDestroy {
  // Local view value, kept in sync with svc.code$ via manual subscription.
  // (Avoids the [ngModel] + async-pipe anti-pattern, which stops reflecting
  // external updates — e.g. from SQL import — once the user has typed.)
  @ViewChild('highlight') highlight!: ElementRef<HTMLPreElement>;

  displayCode = '';
  highlightedHtml = '';
  backdropTransform = 'translate(0px, 0px)';

  private codeSub?: Subscription;

  constructor(
    public svc: DashboardService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    // Re-render cursors whenever the remoteCursors signal changes
    effect(() => {
      const cursors = this.svc.remoteCursors();
      if (this.highlight?.nativeElement) {
        this.highlight.nativeElement.innerHTML = this.colorize(this.displayCode);
      }
    });
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  goToLogin(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      if (this.svc.code.trim()) {
        localStorage.setItem('pending_save_after_login', 'true');
      }
    }
    this.router.navigate(['/login']);
  }

  ngOnInit(): void {

  }
  ngAfterViewInit(): void {
    this.codeSub = this.svc.code$.subscribe(val => {

      this.displayCode = val;

      this.highlight.nativeElement.innerHTML =
        this.colorize(val);

      this.svc.updateGutter();
      this.cdr.markForCheck();

    });
  }

  ngOnDestroy(): void {
    this.codeSub?.unsubscribe();
  }

  highlightCode(code: string): string {
    if (!code) return '';
    const lines = code.split('\n');
    const highlighted = lines.map(line => {
      const commentIndex = line.indexOf('//');
      if (commentIndex !== -1) {
        const codePart = line.substring(0, commentIndex);
        const commentPart = line.substring(commentIndex);
        return this.escapeHtml(codePart) + `<span class="comment-line" style="color: #4ade80; font-weight: 500;">${this.escapeHtml(commentPart)}</span>`;
      }
      return this.escapeHtml(line);
    });
    let html = highlighted.join('\n');
    if (code.endsWith('\n')) {
      html += ' ';
    }
    return html;
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  onTextInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    const val = ta.value;
    this.displayCode = val;
    this.svc.code = val;
    this.onCodeInput();
    this.emitCursor(ta);
  }

  onCodeChange(val: string): void {
    this.displayCode = val;
    this.svc.code = val;
    this.onCodeInput();
  }
  
  onCursorEvent(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    this.emitCursor(ta);
  }
  
  private emitCursor(ta: HTMLTextAreaElement): void {
    if (this.svc.diagramWorkspaceType() !== 'Team') return;
    const pos = ta.selectionStart;
    const textBefore = ta.value.substring(0, pos);
    const linesBefore = textBefore.split('\n');
    const line = linesBefore.length;
    const col = linesBefore[linesBefore.length - 1].length;
    
    const id = this.svc.diagramId();
    if (id) {
      this.svc.socketService.sendCursor(id, line, col);
    }
  }

  private renderTimer: any = null;

  onCodeInput(): void {
    this.svc.updateGutter();
    this.highlight.nativeElement.innerHTML = this.colorize(this.displayCode);
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.svc.parseAndLayout(), 150);
  }

  onEditorScroll(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    this.svc.gutterTransform = `translateY(-${ta.scrollTop}px)`;
    this.backdropTransform = `translate(-${ta.scrollLeft}px, -${ta.scrollTop}px)`;
    this.highlight.nativeElement.scrollTop = ta.scrollTop;
    this.highlight.nativeElement.scrollLeft = ta.scrollLeft;
  }
  escapeHtmlBasic(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  colorize(text: string) {
    // Escape HTML special characters to prevent layout breakdown and sync issues
    text = this.escapeHtmlBasic(text);

    text = text.replace(
      /\b(TableGroup|Table|Ref|Note)\b/g,
      '<span class="keyword">$1</span>'
    );

    // Highlight the names after TableGroup in orange (preserving original quotes and text length)
    text = text.replace(
      /(<span class="keyword">TableGroup<\/span>)\s+("[A-Za-z0-9_]+"|[A-Za-z0-9_]+)/g,
      '$1 <span class="groupName">$2</span>'
    );

    // Highlight single-quoted string literals in orange
    text = text.replace(
      /(&#039;.*?&#039;|'.*?')/g,
      '<span class="attribute">$1</span>'
    );

    text = text.replace(
      /\b(integer|varchar|text|timestamp|date|decimal|boolean|float|datetime|int|bigint)\b/g,
      '<span class="datatype">$1</span>'
    );

    // Highlight numbers and commas inside parentheses, e.g., (100) or (10,2)
    text = text.replace(
      /(\([\d\s,]+\))/g,
      '<span class="number">$1</span>'
    );

    text = text.replace(
      /\[(.*?)\]/g,
      '<span class="attribute">[$1]</span>'
    );

    if (text.endsWith('\n')) {
      text += ' ';
    }
    
    // Inject remote cursors
    if (this.svc.diagramWorkspaceType() === 'Team') {
      const cursors = this.svc.remoteCursors();
      const lines = text.split('\n');
      
      for (const userId of Object.keys(cursors)) {
        const c = cursors[Number(userId)];
        if (c && c.line > 0 && c.line <= lines.length) {
          const lineIdx = c.line - 1;
          const lineText = lines[lineIdx];
          
          // Account for editor padding: 16px top, 52px left. Font is 15px with 1.62 line height (24.3px).
          // Monospace char width for 15px is typically exactly 9px (15 * 0.6).
          const topPos = 16 + (lineIdx * 24.3);
          const leftPos = 52 + (c.col * 9);
          
          const cursorHtml = `
            <span class="remote-cursor" style="position: absolute; left: ${leftPos}px; top: ${topPos}px; height: 20px; border-left: 2px solid ${c.color}; z-index: 10; pointer-events: none;">
              <span style="position: absolute; top: -18px; left: 0px; background-color: ${c.color}; color: white; font-size: 10px; line-height: 1; padding: 3px 5px; border-radius: 3px; border-bottom-left-radius: 0; white-space: nowrap; font-family: system-ui, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                ${c.username}
              </span>
            </span>
          `;
          lines[lineIdx] = lineText + cursorHtml;
        }
      }
      text = lines.join('\n');
    }

    return text;
  }
}