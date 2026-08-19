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
  @Output() closeDropdown = new EventEmitter<Event>();
  @Output() toggleTable = new EventEmitter<{ tableName: string; event?: Event }>();
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

  onToggleAll() {
    this.toggleAll.emit();
  }
}
