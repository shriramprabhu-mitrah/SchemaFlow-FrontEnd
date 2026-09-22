import { Component, ElementRef, OnDestroy, OnInit, Renderer2, HostListener, ViewChild, AfterViewInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-interactive-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interactive-preview.html'
})
export class InteractivePreviewComponent implements AfterViewInit, OnDestroy {
  activeTab: 'diagram' | 'sql' | 'dbml' | 'diff' = 'diagram';

  constructor(
    private el: ElementRef, 
    private renderer: Renderer2,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
  }

  // Mock Tables
  tables: {
    id: string;
    name: string;
    x: number;
    y: number;
    zIndex: number;
    fields: { name: string; type: string; isPk: boolean; isFk: boolean; }[];
  }[] = [
    {
      id: 'departments',
      name: 'departments',
      x: 100,
      y: 120,
      zIndex: 2,
      fields: [
        { name: 'id', type: 'int', isPk: true, isFk: false },
        { name: 'name', type: 'varchar', isPk: false, isFk: false },
        { name: 'location', type: 'varchar', isPk: false, isFk: false }
      ]
    },
    {
      id: 'employees',
      name: 'employees',
      x: 450,
      y: 50,
      zIndex: 2,
      fields: [
        { name: 'id', type: 'int', isPk: true, isFk: false },
        { name: 'dept_id', type: 'int', isPk: false, isFk: true },
        { name: 'name', type: 'varchar', isPk: false, isFk: false },
        { name: 'role', type: 'varchar', isPk: false, isFk: false }
      ]
    },
    {
      id: 'projects',
      name: 'projects',
      x: 450,
      y: 250,
      zIndex: 2,
      fields: [
        { name: 'id', type: 'int', isPk: true, isFk: false },
        { name: 'dept_id', type: 'int', isPk: false, isFk: true },
        { name: 'name', type: 'varchar', isPk: false, isFk: false },
        { name: 'status', type: 'varchar', isPk: false, isFk: false }
      ]
    }
  ];

  relationships = [
    { from: 'departments', to: 'employees' },
    { from: 'departments', to: 'projects' }
  ];

  diffLines = new Array(35);

  // Drag state
  draggingTable: any = null;
  dragOffsetX = 0;
  dragOffsetY = 0;
  highestZIndex = 2;
  private cachedContainerRect: DOMRect | null = null;

  getPath(rel: any): string {
    const fromTable = this.tables.find(t => t.id === rel.from);
    const toTable = this.tables.find(t => t.id === rel.to);
    if (!fromTable || !toTable) return '';

    // Calculate closest edges
    const fromWidth = 200;
    const toWidth = 200;
    const yOffset = 45; // roughly the middle of the fields

    let startX = fromTable.x + fromWidth;
    let endX = toTable.x;
    
    // Determine if we should connect right-to-left or left-to-right
    if (fromTable.x > toTable.x + toWidth) {
      startX = fromTable.x;
      endX = toTable.x + toWidth;
    } else if (fromTable.x + fromWidth < toTable.x) {
      startX = fromTable.x + fromWidth;
      endX = toTable.x;
    } else {
      // Overlapping or closely stacked horizontally
      startX = fromTable.x;
      endX = toTable.x;
    }

    const y1 = fromTable.y + yOffset;
    const y2 = toTable.y + yOffset;
    
    // Midpoint for the orthogonal bend
    let midX = startX + (endX - startX) / 2;
    if (Math.abs(startX - endX) < 40) {
       midX = Math.min(startX, endX) - 30;
    }

    const radius = Math.min(12, Math.abs(midX - startX) / 2, Math.abs(y2 - y1) / 2);
    if (radius > 3 && Math.abs(y2 - y1) > 6) {
      const dirY = y2 > y1 ? 1 : -1;
      const startDirX = midX > startX ? 1 : -1;
      const endDirX = endX > midX ? 1 : -1;

      return `M ${startX} ${y1} ` +
             `L ${midX - startDirX * radius} ${y1} ` +
             `Q ${midX} ${y1} ${midX} ${y1 + dirY * radius} ` +
             `L ${midX} ${y2 - dirY * radius} ` +
             `Q ${midX} ${y2} ${midX + endDirX * radius} ${y2} ` +
             `L ${endX} ${y2}`;
    }

    return `M ${startX} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${endX} ${y2}`;
  }

  getLabelPos(rel: any): {x: number, y: number} {
    const fromTable = this.tables.find(t => t.id === rel.from);
    const toTable = this.tables.find(t => t.id === rel.to);
    if (!fromTable || !toTable) return {x: 0, y: 0};
    
    const fromWidth = 200;
    const toWidth = 200;
    const yOffset = 45;

    let endX = toTable.x;
    if (fromTable.x > toTable.x + toWidth) {
      endX = toTable.x + toWidth;
    } else if (fromTable.x + fromWidth < toTable.x) {
      endX = toTable.x;
    } else {
      endX = toTable.x;
    }

    // Adjust label to sit just outside the end point
    const labelX = (endX === toTable.x) ? endX - 15 : endX + 10;
    return { x: labelX, y: toTable.y + yOffset - 5 };
  }

  // Code strings
  sqlCode = `-- Generated by drawDB
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255)
);

CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dept_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);

CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dept_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(255),
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);`;

  dbmlCode = `// Generated by drawDB
Table departments {
  id int [pk, increment]
  name varchar [not null]
  location varchar
}

Table employees {
  id int [pk, increment]
  dept_id int [not null]
  name varchar [not null]
  role varchar
}

Table projects {
  id int [pk, increment]
  dept_id int [not null]
  name varchar [not null]
  status varchar
}

Ref: employees.dept_id > departments.id
Ref: projects.dept_id > departments.id`;

  diffOldCode = `Table departments {
  id int [pk, increment]
  name varchar [not null]
@@EMPTY@@
}

Table employees {
  id int [pk, increment]
  dept_id int [not null]
  name varchar [not null]
@@EMPTY@@
}

@@EMPTY@@
@@EMPTY@@
@@EMPTY@@
@@EMPTY@@
@@EMPTY@@
@@EMPTY@@`;

  diffNewCode = `Table departments {
  id int [pk, increment]
  name varchar [not null]
@@ADD@@  location varchar@@ENDADD@@
}

Table employees {
  id int [pk, increment]
  dept_id int [not null]
  name varchar [not null]
@@ADD@@  role varchar@@ENDADD@@
}

Table projects {
  id int [pk, increment]
  dept_id int [not null]
  name varchar [not null]
  status varchar
}`;

  sqlLines = this.sqlCode.split('\n');
  dbmlLines = this.dbmlCode.split('\n');
  diffOldLines = this.diffOldCode.split('\n');
  diffNewLines = this.diffNewCode.split('\n');

  syncScroll(source: HTMLElement, target: HTMLElement) {
    if (target.scrollTop !== source.scrollTop) {
      target.scrollTop = source.scrollTop;
    }
    if (target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  }

  getHighlightedCode(code: string, lang: 'sql' | 'dbml'): SafeHtml {
    if (!code) return '';
    const lines = code.split('\n');
    const highlightedString = lines.map(line => {
      let commentIdx = line.indexOf('//');
      if (commentIdx === -1) commentIdx = line.indexOf('--');
      
      let codePart = line;
      let commentPart = '';
      if (commentIdx !== -1) {
        codePart = line.substring(0, commentIdx);
        commentPart = line.substring(commentIdx);
      }
      
      let htmlCode = this.escapeHtml(codePart);
      
      if (lang === 'dbml') {
        // Types
        const types = ['int', 'varchar', 'boolean', 'datetime', 'timestamp', 'date', 'decimal', 'float', 'text', 'bigint', 'integer'];
        types.forEach(t => {
          const regex = new RegExp(`\\b${t}\\b`, 'g');
          htmlCode = htmlCode.replace(regex, `<span class="ip-syntax-type">${t}</span>`);
        });

        // Keywords
        const keywords = ['Table', 'Ref:', 'Enum', 'Project', 'TableGroup', 'Note'];
        keywords.forEach(kw => {
          htmlCode = htmlCode.replace(new RegExp(`\\b${kw.replace(':', '')}:?`, 'g'), `<span class="ip-syntax-dbml-kw">$&</span>`);
        });
        
        // Brackets and attributes
        htmlCode = htmlCode.replace(/\[(.*?)\]/g, '<span class="ip-syntax-attr">[$1]</span>');

        // Numbers in parentheses
        htmlCode = htmlCode.replace(/(\([\d\s,]+\))/g, '<span class="ip-syntax-number">$1</span>');
      } else if (lang === 'sql') {
        // Types
        const types = ['INT', 'VARCHAR', 'BOOLEAN', 'DATETIME', 'DATE', 'TEXT', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'BIGINT'];
        types.forEach(t => {
          const regex = new RegExp(`\\b${t}\\b`, 'g');
          htmlCode = htmlCode.replace(regex, `<span class="ip-syntax-type">${t}</span>`);
        });

        // SQL keywords
        const keywords = [
          'CREATE TABLE', 'PRIMARY KEY', 'AUTO_INCREMENT', 'FOREIGN KEY', 'REFERENCES'
        ];
        keywords.forEach(kw => {
          const regex = new RegExp(`\\b${kw}\\b`, 'g');
          htmlCode = htmlCode.replace(regex, `<span class="ip-syntax-keyword">${kw}</span>`);
        });

        // Constraints and attributes
        const attrs = ['NOT NULL', 'UNIQUE'];
        attrs.forEach(a => {
          const regex = new RegExp(`\\b${a}\\b`, 'g');
          htmlCode = htmlCode.replace(regex, `<span class="ip-syntax-attr">${a}</span>`);
        });

        // Numbers in parentheses (e.g. (255))
        htmlCode = htmlCode.replace(/(\([\d\s,]+\))/g, '<span class="ip-syntax-number">$1</span>');
      }
      
      if (commentPart) {
        htmlCode += `<span class="ip-syntax-comment">${this.escapeHtml(commentPart)}</span>`;
      }
      
      // Parse Diff Additions and Empties
      htmlCode = htmlCode.replace(/@@ADD@@/g, '<span class="ip-diff-added-line">');
      htmlCode = htmlCode.replace(/@@ENDADD@@/g, '</span>');
      htmlCode = htmlCode.replace(/@@EMPTY@@/g, '<span class="ip-diff-empty-line"> </span>');

      return htmlCode;
    }).join('\n');
    
    return this.sanitizer.bypassSecurityTrustHtml(highlightedString);
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private boundMouseMove: (e: any) => void;
  private boundMouseUp: (e: any) => void;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundMouseUp);
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  setTab(tab: 'diagram' | 'sql' | 'dbml' | 'diff') {
    this.activeTab = tab;
  }

  onTableMouseDown(event: MouseEvent, table: any) {
    if (!isPlatformBrowser(this.platformId) || event.button !== 0) return;
    this.draggingTable = table;
    table.zIndex = ++this.highestZIndex;

    const container = (this.el.nativeElement as HTMLElement).querySelector('.ip-canvas-container') as HTMLElement;
    if (container) {
      this.cachedContainerRect = container.getBoundingClientRect();
    }

    const target = (event.currentTarget as HTMLElement).closest('.ip-table-node') as HTMLElement;
    if (target) {
      const rect = target.getBoundingClientRect();
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
    }

    event.preventDefault(); // Prevent text selection
    this.cdr.detectChanges();
  }

  onMouseMove(event: MouseEvent) {
    if (!this.draggingTable || !isPlatformBrowser(this.platformId)) return;

    if (!this.cachedContainerRect) {
      const container = (this.el.nativeElement as HTMLElement).querySelector('.ip-canvas-container') as HTMLElement;
      if (!container) return;
      this.cachedContainerRect = container.getBoundingClientRect();
    }

    let newX = event.clientX - this.cachedContainerRect.left - this.dragOffsetX;
    let newY = event.clientY - this.cachedContainerRect.top - this.dragOffsetY;

    // Actual table dimensions
    const tableWidth = 200;
    const tableHeight = 135;
    const maxX = Math.max(0, this.cachedContainerRect.width - tableWidth);
    const maxY = Math.max(0, this.cachedContainerRect.height - tableHeight);

    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX > maxX) newX = maxX;
    if (newY > maxY) newY = maxY;

    this.draggingTable.x = newX;
    this.draggingTable.y = newY;
    this.cdr.detectChanges();
  }

  onMouseUp(event?: MouseEvent) {
    if (this.draggingTable) {
      this.draggingTable = null;
      this.cachedContainerRect = null;
      this.cdr.detectChanges();
    }
  }

  trackByTableId(index: number, table: any): string {
    return table.id;
  }

  trackByRel(index: number, rel: any): string {
    return rel.from + '-' + rel.to;
  }
}
