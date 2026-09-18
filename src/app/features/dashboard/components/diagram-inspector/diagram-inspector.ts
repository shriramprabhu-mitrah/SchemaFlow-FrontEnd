import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, TableDef, Column, RefDef } from '../../../../core/services/dashboard.service';

@Component({
  selector: 'app-diagram-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diagram-inspector.html',
  styleUrls: ['./diagram-inspector.scss']
})
export class DiagramInspectorComponent implements OnInit {
  @Input() activeTab: 'tables' | 'refs' = 'tables';
  @Output() tabChange = new EventEmitter<'tables' | 'refs'>();
  @Output() close = new EventEmitter<void>();

  tableFilter = '';
  refFilter = '';

  expandedTables = new Set<string>();
  expandedRefs = new Set<number>();
  activeMenuTable: string | null = null;
  activeFieldMenu: { table: string; field: string } | null = null;
  activeTypeDropdown: { table: string; field: string } | null = null;

  editingTableName: string | null = null;
  newTableNameVal = '';

  // Palette matching ChartDB
  stripeColors = [
    '#22c55e', // green
    '#a855f7', // purple
    '#eab308', // yellow
    '#3b82f6', // blue
    '#ef4444', // red
    '#14b8a6', // teal
    '#f97316', // orange
    '#ec4899', // pink
    '#6366f1', // indigo
    '#06b6d4'  // cyan
  ];

  dataTypes = [
    'int',
    'bigint',
    'smallint',
    'varchar',
    'text',
    'char',
    'boolean',
    'timestamp',
    'timestamptz',
    'datetime',
    'date',
    'decimal',
    'float',
    'numeric',
    'json',
    'jsonb',
    'uuid',
    'serial'
  ];

  constructor(
    public svc: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // By default expand the first table if exists
    if (this.svc.tables.length > 0) {
      this.expandedTables.add(this.svc.tables[0].name);
    }
    if (this.svc.refs.length > 0) {
      this.expandedRefs.add(0);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuTable = null;
    this.activeFieldMenu = null;
    this.activeTypeDropdown = null;
  }

  setTab(tab: 'tables' | 'refs'): void {
    this.activeTab = tab;
    this.tabChange.emit(tab);
    this.cdr.markForCheck();
  }

  // ============ TABLES ============

  get filteredTables(): TableDef[] {
    const q = this.tableFilter.trim().toLowerCase();
    if (!q) return this.svc.tables;
    return this.svc.tables.filter(t => {
      if (t.name.toLowerCase().includes(q)) return true;
      return t.columns.some(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q));
    });
  }

  getTableColor(table: TableDef, index: number): string {
    if (this.svc.tableColorsMap && this.svc.tableColorsMap[table.name]) {
      return this.svc.tableColorsMap[table.name];
    }
    return this.stripeColors[index % this.stripeColors.length];
  }

  isTableExpanded(name: string): boolean {
    return this.expandedTables.has(name);
  }

  toggleTableExpand(name: string, e?: Event): void {
    if (e) e.stopPropagation();
    if (this.expandedTables.has(name)) {
      this.expandedTables.delete(name);
    } else {
      this.expandedTables.add(name);
    }
    this.cdr.markForCheck();
  }

  collapsedFieldsTables = new Set<string>();

  isFieldsExpanded(tableName: string): boolean {
    return !this.collapsedFieldsTables.has(tableName);
  }

  toggleFieldsExpand(tableName: string, e?: Event): void {
    if (e) e.stopPropagation();
    if (this.collapsedFieldsTables.has(tableName)) {
      this.collapsedFieldsTables.delete(tableName);
    } else {
      this.collapsedFieldsTables.add(tableName);
    }
    this.cdr.markForCheck();
  }


  startRenameTable(table: TableDef, e?: Event): void {
    if (e) e.stopPropagation();
    this.editingTableName = table.name;
    this.newTableNameVal = table.name;
    this.activeMenuTable = null;
    this.cdr.markForCheck();
    setTimeout(() => {
      const input = document.querySelector('.table-rename-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  cancelRenameTable(): void {
    this.editingTableName = null;
    this.cdr.markForCheck();
  }

  finishRenameTable(oldName: string): void {
    if (!this.editingTableName) return;
    const newName = (this.newTableNameVal || '').trim();
    this.editingTableName = null;
    if (!newName || newName === oldName) {
      this.cdr.markForCheck();
      return;
    }

    this.svc.renameTableInCode(oldName, newName);

    if (this.expandedTables.has(oldName)) {
      this.expandedTables.delete(oldName);
      this.expandedTables.add(newName);
    }
    if (this.collapsedFieldsTables.has(oldName)) {
      this.collapsedFieldsTables.delete(oldName);
      this.collapsedFieldsTables.add(newName);
    }

    this.svc.showToast(`Table renamed to "${newName}" successfully.`, 2500, 'success');
    this.cdr.markForCheck();
  }

  deleteTable(tableName: string, e?: Event): void {
    if (e) e.stopPropagation();
    this.activeMenuTable = null;
    this.svc.deleteTableInCode(tableName);
    this.expandedTables.delete(tableName);
    this.collapsedFieldsTables.delete(tableName);
    this.cdr.markForCheck();
  }

  addField(table: TableDef, e?: Event): void {
    if (e) e.stopPropagation();
    const colNames = new Set(table.columns.map(c => c.name.toLowerCase()));
    let newCol = 'new_column';
    let counter = 1;
    while (colNames.has(newCol.toLowerCase())) {
      newCol = `new_column_${counter++}`;
    }

    const tableRegex = new RegExp(`(Table\\s+${table.name}\\s*\\{[\\s\\S]*?)(\\s*\\})`, 'i');
    if (tableRegex.test(this.svc.code)) {
      this.svc.code = this.svc.code.replace(tableRegex, `$1  ${newCol} varchar\n$2`);
      this.svc.updateGutter();
      this.svc.parseAndLayout();
      this.svc.forceRedraw$.next();
      this.cdr.markForCheck();
    }
  }

  deleteField(table: TableDef, col: Column, e?: Event): void {
    if (e) e.stopPropagation();
    this.activeFieldMenu = null;
    const tableRegex = new RegExp(`(Table\\s+${table.name}\\s*\\{)([\\s\\S]*?)(\\})`, 'i');
    const match = this.svc.code.match(tableRegex);
    if (match) {
      const body = match[2];
      const newBody = body
        .split('\n')
        .filter(line => {
          const m = line.trim().match(/^([A-Za-z0-9_]+)\s+/);
          return !(m && m[1] === col.name);
        })
        .join('\n');
      this.svc.code = this.svc.code.replace(tableRegex, `$1${newBody}$3`);
      this.svc.updateGutter();
      this.svc.parseAndLayout();
      this.svc.forceRedraw$.next();
      this.cdr.markForCheck();
    }
  }

  onFieldNameBlur(table: TableDef, col: Column, e: FocusEvent): void {
    const input = e.target as HTMLInputElement;
    const newName = (input.value || '').trim();
    if (!newName || newName === col.name) {
      input.value = col.name;
      return;
    }
    this.replaceFieldInDbml(table.name, col.name, newName, col.type, col.pk, col.notNull);
    col.name = newName;
  }

  onFieldTypeChange(table: TableDef, col: Column, newType: string): void {
    col.type = newType;
    this.replaceFieldInDbml(table.name, col.name, col.name, newType, col.pk, col.notNull);
  }

  togglePk(table: TableDef, col: Column, e?: Event): void {
    if (e) e.stopPropagation();
    col.pk = !col.pk;
    this.replaceFieldInDbml(table.name, col.name, col.name, col.type, col.pk, col.notNull);
  }

  toggleNotNull(table: TableDef, col: Column, e?: Event): void {
    if (e) e.stopPropagation();
    col.notNull = !col.notNull;
    this.replaceFieldInDbml(table.name, col.name, col.name, col.type, col.pk, col.notNull);
  }

  private replaceFieldInDbml(tableName: string, oldColName: string, newColName: string, type: string, pk: boolean, notNull: boolean): void {
    const tableRegex = new RegExp(`(Table\\s+${tableName}\\s*\\{)([\\s\\S]*?)(\\})`, 'i');
    const match = this.svc.code.match(tableRegex);
    if (match) {
      const body = match[2];
      const newBody = body
        .split('\n')
        .map(line => {
          const m = line.trim().match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)(.*)/);
          if (m && m[1] === oldColName) {
            const rawAttrs = m[3] || '';
            const attrs: string[] = [];
            if (pk) attrs.push('pk');
            if (notNull) attrs.push('not null');
            if (rawAttrs.includes('increment')) attrs.push('increment');
            if (rawAttrs.includes('unique')) attrs.push('unique');
            const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
            return `  ${newColName} ${type}${attrStr}`;
          }
          return line;
        })
        .join('\n');
      this.svc.code = this.svc.code.replace(tableRegex, `$1${newBody}$3`);
      this.svc.updateGutter();
      this.svc.parseAndLayout();
      this.svc.forceRedraw$.next();
      this.cdr.markForCheck();
    }
  }

  focusTable(tableName: string, e?: Event): void {
    if (e) e.stopPropagation();
    this.activeMenuTable = null;
    const pos = this.svc.tablePositions[tableName];
    if (pos) {
      this.svc.view = {
        x: -pos.x + 240,
        y: -pos.y + 180,
        scale: 1
      };
      this.svc.hoveredTableName = tableName;
      this.svc.forceRedraw$.next();
    }
  }

  toggleTableMenu(tableName: string, e: Event): void {
    e.stopPropagation();
    this.activeMenuTable = this.activeMenuTable === tableName ? null : tableName;
    this.activeFieldMenu = null;
  }

  toggleFieldMenu(tableName: string, fieldName: string, e: Event): void {
    e.stopPropagation();
    if (this.activeFieldMenu && this.activeFieldMenu.table === tableName && this.activeFieldMenu.field === fieldName) {
      this.activeFieldMenu = null;
    } else {
      this.activeFieldMenu = { table: tableName, field: fieldName };
    }
    this.activeMenuTable = null;
  }

  isTypeDropdownOpen(tableName: string, fieldName: string): boolean {
    return this.activeTypeDropdown?.table === tableName && this.activeTypeDropdown?.field === fieldName;
  }

  toggleTypeDropdown(tableName: string, fieldName: string, e: Event): void {
    e.stopPropagation();
    if (this.isTypeDropdownOpen(tableName, fieldName)) {
      this.activeTypeDropdown = null;
    } else {
      this.activeTypeDropdown = { table: tableName, field: fieldName };
      this.activeFieldMenu = null;
      this.activeMenuTable = null;
    }
    this.cdr.markForCheck();
  }

  selectFieldType(table: TableDef, col: Column, newType: string, e?: Event): void {
    if (e) e.stopPropagation();
    this.activeTypeDropdown = null;
    this.onFieldTypeChange(table, col, newType);
  }



  // ============ REFS ============

  get filteredRefs(): RefDef[] {
    const q = this.refFilter.trim().toLowerCase();
    if (!q) return this.svc.refs;
    return this.svc.refs.filter((r, idx) => {
      const name = this.getRefName(r, idx).toLowerCase();
      return (
        name.includes(q) ||
        r.fromTable.toLowerCase().includes(q) ||
        r.toTable.toLowerCase().includes(q) ||
        r.fromCol.toLowerCase().includes(q) ||
        r.toCol.toLowerCase().includes(q)
      );
    });
  }

  getRefName(ref: RefDef, index: number): string {
    return `fk_${ref.fromTable}__${ref.toTable}__${index + 1}`;
  }

  isRefExpanded(index: number): boolean {
    return this.expandedRefs.has(index);
  }

  toggleRefExpand(index: number, e?: Event): void {
    if (e) e.stopPropagation();
    if (this.expandedRefs.has(index)) {
      this.expandedRefs.delete(index);
    } else {
      this.expandedRefs.add(index);
    }
    this.cdr.markForCheck();
  }



}
