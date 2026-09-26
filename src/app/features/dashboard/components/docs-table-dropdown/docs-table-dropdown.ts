import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../../core/services/dashboard.service';

@Component({
  selector: 'app-docs-table-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docs-table-dropdown.html',
  styleUrl: './docs-table-dropdown.scss'
})
export class DocsTableDropdownComponent {
  @Input() selectedTables: Set<string> = new Set();
  @Input() activeFocusedTable: string | null = null;
  @Output() closeDropdown = new EventEmitter<Event>();
  @Output() toggleTable = new EventEmitter<{ tableName: string; event?: Event }>();
  @Output() selectTable = new EventEmitter<{ tableName: string; event?: Event }>();
  @Output() toggleAll = new EventEmitter<void>();

  tableSearchQuery = '';

  constructor(public svc: DashboardService) {}

  getFilteredDropdownTables() {
    const q = this.tableSearchQuery.trim().toLowerCase();
    if (!q) return this.svc.tables;
    return this.svc.tables.filter(t => t.name.toLowerCase().includes(q));
  }

  isTableSelected(tableName: string): boolean {
    return this.selectedTables.has(tableName);
  }

  isTableFocused(tableName: string): boolean {
    if (!tableName) return false;
    const active = this.activeFocusedTable || this.svc.activeFocusedTable || this.svc.hoveredTableName;
    if (active) {
      if (active === tableName) return true;
      const baseActive = active.includes('.') ? active.split('.')[1] : active;
      const baseTarget = tableName.includes('.') ? tableName.split('.')[1] : tableName;
      if (baseActive.toLowerCase() === baseTarget.toLowerCase()) return true;
    }
    return false;
  }

  getTableRelationships(tableName: string) {
    return this.svc.getTableRelationships(tableName);
  }

  isAllSelected(): boolean {
    return this.svc.tables.length > 0 && this.svc.tables.every(t => this.selectedTables.has(t.name));
  }

  onClose(event: Event) {
    this.closeDropdown.emit(event);
  }

  onToggleTable(tableName: string, event?: Event) {
    this.toggleTable.emit({ tableName, event });
  }

  onSelectTable(tableName: string, event?: Event) {
    if (event) event.stopPropagation();
    this.svc.activeFocusedTable = tableName;
    this.selectTable.emit({ tableName, event });
  }

  onToggleAll() {
    this.toggleAll.emit();
  }
}
