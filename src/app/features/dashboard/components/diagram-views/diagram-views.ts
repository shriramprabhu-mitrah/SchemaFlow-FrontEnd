import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../../core/services/dashboard.service';

export interface GroupData {
  name: string;
  tables: string[];
}

export interface RootSection {
  type: 'table' | 'tableGroup';
  title: string;
  items?: string[]; // for flat tables
  groups?: GroupData[]; // for table groups
}

@Component({
  selector: 'app-diagram-views',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diagram-views.html'
})
export class DiagramViews implements OnInit, AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>
  searchQuery: string = '';
  selectedViews = {
    table: true,
    tableGroup: false
  };
  groupByDropdownOpen: boolean = false;
  collapsedGroups = new Set<string>();

  get hasTableGroups(): boolean {
    return !!(this.svc.groups && this.svc.groups.length > 0);
  }

  constructor(
    public svc: DashboardService,
    private elementRef: ElementRef
  ) { }
ngAfterViewInit(): void {
    if (this.svc.focusDiagramViewsSearch) {
      this.focusSearchInput();
    }
  }
 
  focusSearchInput(): void {
    const focus = () => {
      const el = this.searchInput?.nativeElement;
      if (el) { 
        el.focus();
      }
    };
    focus();
    setTimeout(focus, 50);
    setTimeout(focus, 150);
    setTimeout(focus, 300);
  }
  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.svc.showDiagramViews) return;

    // Check if the click was inside the Diagram Views panel
    const element = this.elementRef.nativeElement;
    // An element might be removed from the DOM during click processing (e.g. *ngIf eye icon swap).
    // If it is no longer in the document body, it was clicked inside but is now an orphan.
    const clickedInside = element.contains(event.target as Node) ||
      !document.body.contains(event.target as Node);

    // Also check if they clicked the toggle button in the canvas controls
    // to prevent double-toggling (panel opening and immediately closing)
    const clickedToggleButton = (event.target as HTMLElement).closest('[data-tt="Diagram Views"], [data-tt="Search / Diagram Views"]') ||
      (event.target as HTMLElement).closest('.group-by-trigger');

    if (!clickedInside && !clickedToggleButton) {
      this.svc.showDiagramViews = false;
    }
  }

  ngOnInit(): void {
    // Expand all groups by default
    this.collapsedGroups.clear();
    if (this.hasTableGroups) {
      this.selectedViews.tableGroup = true;
    }
  }

  closePanel(): void {
    this.svc.showDiagramViews = false;
  }

  toggleViewSelection(type: 'table' | 'tableGroup'): void {
    if (type === 'tableGroup' && !this.hasTableGroups) return;
    this.selectedViews[type] = !this.selectedViews[type];
  }

  // Parse tables and organize into root sections depending on the selectedViews
  getFilteredSections(): RootSection[] {
    const sections: RootSection[] = [];
    const query = this.searchQuery.trim().toLowerCase();

    // 1. Table Section
    if (this.selectedViews.table) {
      const allTables = this.svc.tables.map(t => t.name);
      let matchingTables = allTables;

      if (query) {
        matchingTables = allTables.filter((t) => {
          const displayName = this.getTableDisplayName(t).toLowerCase();
          const fullName = t.toLowerCase();
          return fullName.includes(query) || displayName.includes(query);
        });
      }

      if (matchingTables.length > 0) {
        sections.push({
          type: 'table',
          title: 'Table',
          items: matchingTables
        });
      }
    }

    // 2. Table Group Section
    if (this.selectedViews.tableGroup && this.hasTableGroups) {
      const rawGroups: GroupData[] = [];
      const groupedTableNames = new Set<string>();

      // Add existing DBML TableGroups
      this.svc.groups.forEach((g) => {
        const resolvedTables = g.tables.map((tblName) => {
          const found = this.svc.tables.find(
            (t) => t.name === tblName || (t.name.includes('.') && t.name.split('.')[1] === tblName)
          );
          return found ? found.name : tblName;
        });

        rawGroups.push({
          name: g.name,
          tables: resolvedTables
        });

        resolvedTables.forEach((t) => {
          groupedTableNames.add(t);
          const base = t.includes('.') ? t.split('.')[1] : t;
          groupedTableNames.add(base);
        });
      });

      // Add "Ungrouped" for tables not in any group
      const ungroupedTables = this.svc.tables
        .map((t) => t.name)
        .filter((name) => {
          const base = name.includes('.') ? name.split('.')[1] : name;
          return !groupedTableNames.has(name) && !groupedTableNames.has(base);
        });

      if (ungroupedTables.length > 0) {
        rawGroups.push({
          name: 'Ungrouped',
          tables: ungroupedTables
        });
      }

      // Apply Search Query Filtering
      let filteredGroups = rawGroups;
      if (query) {
        filteredGroups = rawGroups
          .map((g) => {
            const matchingTables = g.tables.filter((t) => {
              const displayName = this.getTableDisplayName(t).toLowerCase();
              const fullName = t.toLowerCase();
              return fullName.includes(query) || displayName.includes(query);
            });

            const isGroupMatch = g.name.toLowerCase().includes(query);
            return {
              name: g.name,
              tables: isGroupMatch ? g.tables : matchingTables
            };
          })
          .filter((g) => g.tables.length > 0);
      }

      if (filteredGroups.length > 0) {
        sections.push({
          type: 'tableGroup',
          title: 'TableGroup',
          groups: filteredGroups
        });
      }
    }

    return sections;
  }

  isGroupCollapsed(groupName: string): boolean {
    return this.collapsedGroups.has(groupName);
  }

  toggleGroupCollapse(groupName: string): void {
    if (this.collapsedGroups.has(groupName)) {
      this.collapsedGroups.delete(groupName);
    } else {
      this.collapsedGroups.add(groupName);
    }
  }

  isTableHidden(tableName: string): boolean {
    this.svc.hiddenTables();
    return this.svc.isTableHidden(tableName);
  }

  toggleTableVisibility(tableName: string): void {
    this.svc.toggleTableVisibility(tableName);
  }

  getVisibleTableCount(g: GroupData): number {
    return g.tables.filter((t) => !this.isTableHidden(t)).length;
  }

  isGroupFullyVisible(g: GroupData): boolean {
    return g.tables.every((t) => !this.isTableHidden(t));
  }

  toggleGroupVisibility(g: GroupData): void {
    const isFullyVisible = this.isGroupFullyVisible(g);
    g.tables.forEach((tableName) => {
      this.svc.setTableVisibility(tableName, !isFullyVisible);
    });
  }

  getSectionVisibleCount(section: RootSection): number {
    if (section.type === 'table' && section.items) {
      return section.items.filter((t) => !this.isTableHidden(t)).length;
    } else if (section.type === 'tableGroup' && section.groups) {
      let count = 0;
      section.groups.forEach(g => {
        count += this.getVisibleTableCount(g);
      });
      return count;
    }
    return 0;
  }

  getSectionTotalCount(section: RootSection): number {
    if (section.type === 'table' && section.items) {
      return section.items.length;
    } else if (section.type === 'tableGroup' && section.groups) {
      let count = 0;
      section.groups.forEach(g => {
        count += g.tables.length;
      });
      return count;
    }
    return 0;
  }

  isSectionFullyVisible(section: RootSection): boolean {
    const total = this.getSectionTotalCount(section);
    if (total === 0) return true;
    return this.getSectionVisibleCount(section) === total;
  }

  toggleSectionVisibility(section: RootSection): void {
    const isFullyVisible = this.isSectionFullyVisible(section);
    if (section.type === 'table' && section.items) {
      section.items.forEach(t => {
        this.svc.setTableVisibility(t, !isFullyVisible);
      });
    } else if (section.type === 'tableGroup' && section.groups) {
      section.groups.forEach(g => {
        g.tables.forEach(t => {
          this.svc.setTableVisibility(t, !isFullyVisible);
        });
      });
    }
  }

  toggleAllVisibility(): void {
    const anyHidden = this.svc._hiddenTables.size > 0;
    if (anyHidden) {
      // Show all — clear hidden set
      this.svc._hiddenTables.clear();
    } else {
      // Hide all — add every table's name and id
      this.svc.tables.forEach((t) => {
        if (t.id) this.svc._hiddenTables.add(t.id);
        this.svc._hiddenTables.add(t.name);
      });
    }
    this.svc.hiddenTables.set(new Set(this.svc._hiddenTables));
    this.svc.forceRedraw$.next();
  }

  getTableDisplayName(tableName: string): string {
    const tableObj = this.svc.tables.find(t => (t.id && t.id === tableName) || t.name === tableName);
    const fullName = tableObj ? tableObj.name : tableName;
    const parts = fullName.split('.');
    return parts.length > 1 ? parts[1] : fullName;
  }

  getHiddenTablesList(): string[] {
    this.svc.hiddenTables();
    const hiddenList: string[] = [];
    const seen = new Set<string>();
    this.svc.tables.forEach((t) => {
      const identifier = t.id || t.name;
      if (this.svc.isTableHidden(identifier) || this.svc.isTableHidden(t.name)) {
        if (!seen.has(t.name)) {
          seen.add(t.name);
          hiddenList.push(t.name);
        }
      }
    });
    return hiddenList;
  }

  saveView(): void {
    this.svc.showToast('Diagram View configurations saved successfully.', 2500, 'success');
  }

  trackByGroup(index: number, group: GroupData): string {
    return group.name;
  }

  trackByTable(index: number, table: string): string {
    return table;
  }

  trackBySection(index: number, section: RootSection): string {
    return section.type;
  }
}
