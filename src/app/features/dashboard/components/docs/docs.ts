import { Component, HostListener, OnInit, OnDestroy, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService } from '../../../../core/services/dashboard.service';

import { DocsTableDropdownComponent } from '../docs-table-dropdown/docs-table-dropdown';
import { ButtonComponent } from '../../../../shared/button/button';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, DocsTableDropdownComponent],
  templateUrl: './docs.html',
})
export class DocsComponent implements OnInit, OnDestroy {
  private sub = new Subscription();
  collapsedTables = new Set<string>();
  selectedTables = new Set<string>();
  isFilterActive = false;
  showTableDropdown = false;

  constructor(public svc: DashboardService, private cdr: ChangeDetectorRef) {
    effect(() => {
      // Track diagramId changes to reset the docs view for the new diagram
      const currentId = this.svc.diagramId();
      this.selectAll();
      this.collapsedTables.clear();
      this.isFilterActive = false;
    });
  }

  ngOnInit(): void {
    this.selectAll();
    this.sub.add(
      this.svc.forceRedraw$.subscribe(() => {
        if (this.isFilterActive) {
          const anyMatch = this.svc.tables.some(t => this.selectedTables.has(t.name));
          if (!anyMatch && this.svc.tables.length > 0) {
            this.selectAll();
          }
        } else {
          this.selectAll();
        }
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showTableDropdown = false;
  }

  toggleTableDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.showTableDropdown = !this.showTableDropdown;
  }

  toggleTable(tableName: string): void {
    if (this.collapsedTables.has(tableName)) {
      this.collapsedTables.delete(tableName);
    } else {
      this.collapsedTables.add(tableName);
    }
  }

  isTableCollapsed(tableName: string): boolean {
    return this.collapsedTables.has(tableName);
  }

  isAllExpanded(): boolean {
    return this.collapsedTables.size === 0;
  }

  expandAll(): void {
    this.collapsedTables.clear();
  }

  collapseAll(): void {
    this.svc.tables.forEach((t) => this.collapsedTables.add(t.name));
  }

  downloadDocs(): void {
    this.svc.downloadDocs();
  }

  toggleDiagramViews(): void {
    this.svc.showDiagramViews = !this.svc.showDiagramViews;
  }

  getTableRelationships(tableName: string) {
    return this.svc.getTableRelationships(tableName);
  }

  isTableSelected(tableName: string): boolean {
    return this.selectedTables.has(tableName);
  }

  getVisibleTables() {
    if (!this.isFilterActive) {
      return this.svc.tables;
    }
    return this.svc.tables.filter((t) => this.selectedTables.has(t.name));
  }

  getConnectedTableNames(tableName: string): string[] {
    const rels = this.getTableRelationships(tableName);
    const connected = new Set<string>();
    rels.forEach(rel => {
      if (rel.fromTable && rel.fromTable !== tableName) connected.add(rel.fromTable);
      if (rel.toTable && rel.toTable !== tableName) connected.add(rel.toTable);
    });
    return Array.from(connected);
  }

  toggleTableCheckbox(tableName: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.isFilterActive = true;

    const newSet = new Set(this.selectedTables);
    if (newSet.has(tableName)) {
      newSet.delete(tableName);
    } else {
      newSet.add(tableName);
      // Expand target table
      this.collapsedTables.delete(tableName);
    }
    this.selectedTables = newSet;
  }

  viewTableDetails(tableName: string, currentTable?: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.isFilterActive = true;

    const newSet = new Set(this.selectedTables);
    // Add target table (e.g. Employee)
    newSet.add(tableName);
    this.collapsedTables.delete(tableName);

    // If current table context was passed (e.g. Department), ensure it stays selected and expanded too
    if (currentTable) {
      newSet.add(currentTable);
      this.collapsedTables.delete(currentTable);
    }
    this.selectedTables = newSet;

    // Scroll target table card into view if needed
    setTimeout(() => {
      const cardEl = document.getElementById('docs-card-' + tableName);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  }

  selectAll(): void {
    this.isFilterActive = false;
    const newSet = new Set<string>();
    this.svc.tables.forEach((t) => newSet.add(t.name));
    this.selectedTables = newSet;
  }

  unselectAll(): void {
    this.isFilterActive = true;
    this.selectedTables = new Set();
  }

  isAllSelected(): boolean {
    return this.svc.tables.length > 0 && this.svc.tables.every((t) => this.selectedTables.has(t.name));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.unselectAll();
    } else {
      this.selectAll();
    }
  }

  clearSelections(): void {
    this.isFilterActive = false;
    this.selectedTables = new Set();
    this.selectAll();
  }
}
