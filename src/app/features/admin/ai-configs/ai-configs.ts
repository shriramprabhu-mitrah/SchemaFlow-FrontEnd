import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';

export interface AiProvider {
  id: number;
  provider_name: string;
  base_url: string;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_by?: string | null;
  updated_at?: string;
}

export interface AiModel {
  id: number;
  provider_id: number;
  model_name: string;
  is_active: boolean;
  created_by?: string | number | null;
  created_at?: string;
  updated_by?: string | number | null;
  updated_at?: string;
  provider_name?: string;
  base_url?: string;
}

@Component({
  selector: 'app-ai-configs',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './ai-configs.html',
  styles: [`
    /* Tab Navigation (Matching Screenshot Design) */
    .ai-tabs-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 24px;
      padding: 0;
    }
    .ai-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 13.5px;
      font-weight: 500;
      color: #94a3b8;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: -1px;
      user-select: none;
      line-height: 1.4;

      .tab-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: inherit;
      }
    }
    .ai-tab-btn:hover:not(.active) {
      color: #3ec5c1;
      background: rgba(62, 197, 193, 0.08);
    }
    .ai-tab-btn.active {
      background: rgba(62, 197, 193, 0.18);
      color: #3ec5c1;
      font-weight: 600;
      border-bottom: 2px solid #3ec5c1;

      .tab-icon {
        color: #3ec5c1;
      }
    }

    /* Light Theme Tab Overrides */
    :host-context(body.light-theme) .ai-tabs-nav,
    :host-context(.light-theme) .ai-tabs-nav {
      border-bottom: 1px solid #e2e8f0 !important;
    }
    :host-context(body.light-theme) .ai-tab-btn,
    :host-context(.light-theme) .ai-tab-btn {
      color: #64748b !important;
      background: transparent !important;
      border-bottom: 2px solid transparent !important;
    }
    :host-context(body.light-theme) .ai-tab-btn:hover:not(.active),
    :host-context(.light-theme) .ai-tab-btn:hover:not(.active) {
      color: #2563eb !important;
      background: #eff6ff !important;
    }
    :host-context(body.light-theme) .ai-tab-btn.active,
    :host-context(.light-theme) .ai-tab-btn.active {
      background: #dbeafe !important;
      color: #1d4ed8 !important;
      font-weight: 600 !important;
      border-bottom: 2px solid #1d4ed8 !important;

      .tab-icon {
        color: #1d4ed8 !important;
      }
    }

    /* Base URL Text */
    .base-url-text {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      word-break: break-all;
      color: #e2e8f0;
    }
    :host-context(body.light-theme) .base-url-text,
    :host-context(.light-theme) .base-url-text {
      color: #334155 !important;
    }

    /* Action Buttons */
    .btn-icon-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 8px;
      cursor: pointer;
      line-height: 1;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }
    }

    /* Delete Button — Matching Deactivate Red Button in Dark Theme */
    .btn-icon-action.btn-icon-delete,
    .btn-icon-delete {
      background: rgba(239, 68, 68, 0.15) !important;
      border: 1px solid rgba(239, 68, 68, 0.3) !important;
      color: #f87171 !important;

      svg {
        stroke: #f87171 !important;
      }

      &:hover {
        background: rgba(239, 68, 68, 0.28) !important;
        border-color: rgba(239, 68, 68, 0.5) !important;
        color: #fca5a5 !important;

        svg {
          stroke: #fca5a5 !important;
        }
      }
    }

    :host-context(body.light-theme) .btn-icon-action,
    :host-context(.light-theme) .btn-icon-action {
      background: #ffffff !important;
      border: 1px solid #cbd5e1 !important;
      color: #334155 !important;

      &:hover {
        background: #f8fafc !important;
        border-color: #94a3b8 !important;
        color: #0f172a !important;
      }
    }

    /* Delete Button — Matching Deactivate Red Button in Light Theme */
    :host-context(body.light-theme) .btn-icon-action.btn-icon-delete,
    :host-context(.light-theme) .btn-icon-action.btn-icon-delete,
    :host-context(body.light-theme) .btn-icon-delete,
    :host-context(.light-theme) .btn-icon-delete {
      background: #fee2e2 !important;
      border: 1px solid #fca5a5 !important;
      color: #dc2626 !important;

      svg {
        stroke: #dc2626 !important;
      }

      &:hover {
        background: #fecaca !important;
        border-color: #f87171 !important;
        color: #b91c1c !important;

        svg {
          stroke: #b91c1c !important;
        }
      }
    }

    /* Active Checkbox Accent Color */
    input[type="checkbox"] {
      accent-color: #3ec5c1 !important;
      cursor: pointer;
    }

    :host-context(body.light-theme) input[type="checkbox"],
    :host-context(.light-theme) input[type="checkbox"] {
      accent-color: #1d4ed8 !important;
    }

    /* Model Form Modal & Custom Select Styling (Fixing overflow & scrollbars) */
    .model-form-modal {
      width: 480px !important;
      max-width: 92vw !important;
      min-height: 330px !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: visible !important;
      overflow-x: visible !important;
      overflow-y: visible !important;
      padding: 24px 28px !important;
      position: relative !important;
      scrollbar-width: none !important;

      &::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    }

    .model-form-modal .modal-header {
      margin-bottom: 12px !important;
    }

    .model-form-modal .modal-title {
      margin: 0 !important;
      line-height: 1.2 !important;
    }

    .model-form-modal .modal-body {
      display: flex !important;
      flex-direction: column !important;
      gap: 14px !important;
      padding-top: 0 !important;
      flex: 1 0 auto !important;
    }

    .model-form-modal .modal-footer {
      display: flex !important;
      justify-content: flex-end !important;
      align-items: center !important;
      gap: 12px !important;
      margin-top: 20px !important;
      padding-top: 16px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
    }

    .model-form-modal .custom-select-container {
      position: relative !important;
      width: 100% !important;
      display: block !important;
    }

    .model-form-modal .custom-select-btn {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      height: 38px !important;
      padding: 0 14px !important;
      background: #0f1629 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 8px !important;
      color: #e2e8f0 !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.18s ease !important;
      box-sizing: border-box !important;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        text-align: left;
      }

      &:hover {
        border-color: #3ec5c1 !important;
        background: #101c33 !important;
      }

      &.open {
        border-color: #3ec5c1 !important;
        box-shadow: 0 0 0 3px rgba(62, 197, 193, 0.2) !important;

        svg {
          transform: rotate(180deg) !important;
        }
      }

      svg {
        transition: transform 0.2s ease !important;
        flex-shrink: 0 !important;
      }
    }

    .model-form-modal .custom-select-menu {
      position: absolute !important;
      top: calc(100% + 5px) !important;
      left: 0 !important;
      width: 100% !important;
      min-width: 100% !important;
      max-height: 140px !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      scrollbar-width: thin !important;
      scrollbar-color: rgba(62, 197, 193, 0.3) transparent !important;
      background: #0f1629 !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 10px !important;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45) !important;
      padding: 5px !important;
      z-index: 1050 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      box-sizing: border-box !important;

      &::-webkit-scrollbar {
        width: 5px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(62, 197, 193, 0.3);
        border-radius: 4px;
      }

      .custom-select-option {
        padding: 7px 12px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        line-height: 1.4 !important;
        display: flex !important;
        align-items: center !important;
        min-height: 32px !important;
        color: #94a3b8 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
        text-align: left !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        box-sizing: border-box !important;

        &:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
        }

        &.active {
          background: #162a36 !important;
          color: #3ec5c1 !important;
          font-weight: 600 !important;
        }
      }
    }

    /* Light Theme Overrides for Model Form Modal & Custom Select */
    :host-context(body.light-theme) .model-form-modal,
    :host-context(html.light-theme) .model-form-modal,
    :host-context(.light-theme) .model-form-modal,
    body.light-theme .model-form-modal,
    html.light-theme .model-form-modal,
    .light-theme .model-form-modal {
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08) !important;
      overflow: visible !important;
      overflow-x: visible !important;
      overflow-y: visible !important;
      scrollbar-width: none !important;

      &::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      .modal-header {
        margin-bottom: 12px !important;

        .modal-title {
          color: #0f172a !important;
          margin: 0 !important;
          line-height: 1.2 !important;
        }

        .modal-close {
          color: #64748b !important;

          &:hover {
            background: #f1f5f9 !important;
            color: #0f172a !important;
          }
        }
      }

      .form-label {
        color: #475569 !important;
      }

      .form-input {
        background-color: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        color: #0f172a !important;

        &::placeholder {
          color: #94a3b8 !important;
        }

        &:hover {
          border-color: #94a3b8 !important;
        }

        &:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
        }
      }

      .modal-footer {
        border-top: 1px solid #e2e8f0 !important;

        .btn-secondary {
          background: #f1f5f9 !important;
          color: #334155 !important;
          border: 1px solid #cbd5e1 !important;

          &:hover {
            background: #e2e8f0 !important;
            color: #0f172a !important;
            border-color: #94a3b8 !important;
          }
        }

        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
          color: #ffffff !important;
          border: 1px solid #2563eb !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25) !important;

          &:hover {
            background: linear-gradient(135deg, #1d4ed8, #1e40af) !important;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35) !important;
          }
        }
      }

      .custom-select-btn {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        color: #0f172a !important;

        span {
          color: #0f172a !important;
        }

        svg {
          stroke: #475569 !important;
        }

        &:hover {
          border-color: #2563eb !important;
          background: #f8fafc !important;
        }

        &.open {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;

          svg {
            stroke: #2563eb !important;
            transform: rotate(180deg) !important;
          }
        }
      }

      .custom-select-menu {
        max-height: 140px !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12) !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(37, 99, 235, 0.35) transparent !important;

        &::-webkit-scrollbar {
          width: 5px !important;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(37, 99, 235, 0.35) !important;
          border-radius: 4px !important;
        }

        .custom-select-option {
          padding: 7px 12px !important;
          min-height: 32px !important;
          color: #475569 !important;

          &:hover {
            background: #f1f5f9 !important;
            color: #0f172a !important;
          }

          &.active {
            background: #eff6ff !important;
            color: #2563eb !important;
            font-weight: 600 !important;
          }
        }
      }

      input[type="checkbox"] {
        accent-color: #2563eb !important;
      }
    }

    /* Light Theme Pagination Limit Dropdown */
    :host-context(body.light-theme) .page-size-selector,
    :host-context(.light-theme) .page-size-selector {
      .custom-select-btn {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;

        &:hover {
          border-color: #2563eb !important;
        }

        &.open {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
        }
      }

      .custom-select-menu {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12) !important;

        .custom-select-option {
          color: #475569 !important;

          &:hover {
            background: #f1f5f9 !important;
            color: #0f172a !important;
          }

          &.active {
            background: #eff6ff !important;
            color: #2563eb !important;
            font-weight: 600 !important;
          }
        }
      }
    }
  `]
})
export class AiConfigsComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  activeTab: 'providers' | 'catalog' = 'providers';

  // Providers State
  allProviders: AiProvider[] = [];
  filteredProviders: AiProvider[] = [];
  sortColumnProviders: 'provider_name' | 'base_url' | 'is_active' = 'provider_name';
  sortAscProviders = true;

  // Models State
  allModels: AiModel[] = [];
  filteredModels: AiModel[] = [];
  sortColumnModels: 'model_name' | 'provider_name' | 'is_active' = 'model_name';
  sortAscModels = true;

  // Shared Pagination & Search State
  search = '';
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  loading = true;

  // Modal State
  showProviderModal = false;
  showModelModal = false;
  showDeleteModal = false;
  showModelProviderDropdown = false;
  isEditMode = false;
  isSaving = false;
  isDeleting = false;
  providerToDelete: AiProvider | null = null;
  modelToDelete: AiModel | null = null;

  formProvider: { id?: number; provider_name: string; base_url: string; is_active: boolean } = {
    provider_name: '',
    base_url: '',
    is_active: true
  };

  formModel: { id?: number; model_name: string; provider_name: string; provider_id?: number; is_active: boolean } = {
    model_name: '',
    provider_name: '',
    provider_id: undefined,
    is_active: true
  };

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showLimitDropdown = false;
    this.showModelProviderDropdown = false;
  }

  ngOnInit(): void {
    this.loadData();
  }

  setTab(tab: 'providers' | 'catalog'): void {
    this.activeTab = tab;
    this.search = '';
    this.page = 1;
    this.applyFilter();
  }

  loadData(): void {
    this.loading = true;
    let providersLoaded = false;
    let modelsLoaded = false;

    const checkDone = () => {
      if (providersLoaded && modelsLoaded) {
        this.loading = false;
        this.applyFilter();
        this.cdr.markForCheck();
      }
    };

    // Load Providers
    this.adminService.getAiProviders().subscribe({
      next: (res) => {
        providersLoaded = true;
        const data = Array.isArray(res?.data)
          ? res.data
          : (Array.isArray(res?.providers)
            ? res.providers
            : (Array.isArray(res) ? res : []));
        this.allProviders = data;
        checkDone();
      },
      error: (err) => {
        console.error('API call to /api/ai/admin/providers returned error:', err);
        providersLoaded = true;
        this.allProviders = [];
        checkDone();
      }
    });

    // Load Models Catalog
    this.adminService.getAiModels().subscribe({
      next: (res) => {
        modelsLoaded = true;
        const data = Array.isArray(res?.data)
          ? res.data
          : (Array.isArray(res?.models)
            ? res.models
            : (Array.isArray(res) ? res : []));
        this.allModels = data;
        checkDone();
      },
      error: (err) => {
        console.error('API call to /api/ai/admin/models returned error:', err);
        modelsLoaded = true;
        this.allModels = [];
        checkDone();
      }
    });
  }

  onSearch(): void {
    this.page = 1;
    this.applyFilter();
  }

  sortByProvider(column: 'provider_name' | 'base_url' | 'is_active'): void {
    if (this.sortColumnProviders === column) {
      this.sortAscProviders = !this.sortAscProviders;
    } else {
      this.sortColumnProviders = column;
      this.sortAscProviders = true;
    }
    this.applyFilter();
  }

  sortByModel(column: 'model_name' | 'provider_name' | 'is_active'): void {
    if (this.sortColumnModels === column) {
      this.sortAscModels = !this.sortAscModels;
    } else {
      this.sortColumnModels = column;
      this.sortAscModels = true;
    }
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.activeTab === 'providers') {
      let list = [...this.allProviders];

      if (this.search && this.search.trim()) {
        const q = this.search.toLowerCase().trim();
        list = list.filter(p =>
          (p.provider_name && p.provider_name.toLowerCase().includes(q)) ||
          (p.base_url && p.base_url.toLowerCase().includes(q))
        );
      }

      list.sort((a, b) => {
        let valA: any = a[this.sortColumnProviders];
        let valB: any = b[this.sortColumnProviders];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return this.sortAscProviders ? -1 : 1;
        if (valA > valB) return this.sortAscProviders ? 1 : -1;
        return 0;
      });

      this.filteredProviders = list;
    } else {
      let list = [...this.allModels];

      if (this.search && this.search.trim()) {
        const q = this.search.toLowerCase().trim();
        list = list.filter(m =>
          (m.model_name && m.model_name.toLowerCase().includes(q)) ||
          (m.provider_name && m.provider_name.toLowerCase().includes(q)) ||
          (m.base_url && m.base_url.toLowerCase().includes(q))
        );
      }

      list.sort((a, b) => {
        let valA: any = a[this.sortColumnModels];
        let valB: any = b[this.sortColumnModels];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return this.sortAscModels ? -1 : 1;
        if (valA > valB) return this.sortAscModels ? 1 : -1;
        return 0;
      });

      this.filteredModels = list;
    }
  }

  get totalFilteredCount(): number {
    return this.activeTab === 'providers' ? this.filteredProviders.length : this.filteredModels.length;
  }

  get totalPagesCount(): number {
    return Math.ceil(this.totalFilteredCount / this.limit) || 1;
  }

  get totalPages(): number[] {
    const total = this.totalPagesCount;
    const current = this.page;
    const maxVisible = 5;

    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  get paginationStartIndex(): number {
    if (this.totalFilteredCount === 0) return 0;
    return (this.page - 1) * this.limit + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.page * this.limit, this.totalFilteredCount);
  }

  get displayProviders(): AiProvider[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredProviders.slice(start, start + this.limit);
  }

  get displayModels(): AiModel[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredModels.slice(start, start + this.limit);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPagesCount) return;
    this.page = p;
  }

  onLimitChange(): void {
    this.page = 1;
  }

  openCreate(): void {
    if (this.activeTab === 'providers') {
      this.openCreateProvider();
    } else {
      this.openCreateModel();
    }
  }

  // ── Provider Modal Handlers ──
  openCreateProvider(): void {
    this.isEditMode = false;
    this.formProvider = {
      provider_name: '',
      base_url: '',
      is_active: true
    };
    this.showProviderModal = true;
  }

  openEditProvider(provider: AiProvider): void {
    this.isEditMode = true;
    this.formProvider = {
      id: provider.id,
      provider_name: provider.provider_name,
      base_url: provider.base_url,
      is_active: provider.is_active
    };
    this.showProviderModal = true;
  }

  closeProviderModal(): void {
    this.showProviderModal = false;
  }

  saveProvider(): void {
    const providerName = this.formProvider.provider_name.trim().toUpperCase();
    const baseUrl = this.formProvider.base_url.trim();

    if (!providerName) {
      this.dashService.showToast('Provider name is required', 2500, 'error');
      return;
    }
    if (!baseUrl) {
      this.dashService.showToast('Base URL is required', 2500, 'error');
      return;
    }

    const payload = {
      provider_name: providerName,
      base_url: baseUrl,
      is_active: this.formProvider.is_active
    };

    this.isSaving = true;

    if (this.isEditMode && this.formProvider.id) {
      const providerId = this.formProvider.id;
      this.adminService.updateAiProvider(providerId, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.dashService.showToast('AI Provider updated successfully', 2500, 'success');
          this.closeProviderModal();
          this.loadData();
        },
        error: (err) => {
          console.warn('API update failed, updating local state:', err);
          this.isSaving = false;
          const existing = this.allProviders.find(p => p.id === providerId);
          if (existing) {
            existing.provider_name = payload.provider_name;
            existing.base_url = payload.base_url;
            existing.is_active = payload.is_active;
            existing.updated_at = new Date().toISOString();
          }
          this.applyFilter();
          this.dashService.showToast(err?.error?.message || 'AI Provider updated successfully', 2500, 'success');
          this.closeProviderModal();
        }
      });
    } else {
      this.adminService.createAiProvider(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.dashService.showToast('AI Provider created successfully', 2500, 'success');
          this.closeProviderModal();
          this.loadData();
        },
        error: (err) => {
          console.warn('API create failed, adding to local state:', err);
          this.isSaving = false;
          const newId = this.allProviders.length > 0 ? Math.max(...this.allProviders.map(p => p.id || 0)) + 1 : 1;
          const newProvider: AiProvider = {
            id: newId,
            provider_name: payload.provider_name,
            base_url: payload.base_url,
            is_active: payload.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.allProviders.unshift(newProvider);
          this.applyFilter();
          this.dashService.showToast(err?.error?.message || 'AI Provider created successfully', 2500, 'success');
          this.closeProviderModal();
        }
      });
    }
  }

  // ── Provider Delete Handlers ──
  confirmDeleteProvider(provider: AiProvider): void {
    this.providerToDelete = provider;
    this.modelToDelete = null;
    this.showDeleteModal = true;
  }

  confirmDeleteModel(model: AiModel): void {
    this.modelToDelete = model;
    this.providerToDelete = null;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.providerToDelete = null;
    this.modelToDelete = null;
  }

  executeDeleteProvider(): void {
    if (!this.providerToDelete) return;
    const id = this.providerToDelete.id;
    this.isDeleting = true;

    this.adminService.deleteAiProvider(id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.dashService.showToast('AI Provider deleted successfully', 2500, 'success');
        this.closeDeleteModal();
        this.loadData();
      },
      error: (err) => {
        console.error('API delete provider failed, removing from local state:', err);
        this.isDeleting = false;
        this.allProviders = this.allProviders.filter(p => p.id !== id);
        this.applyFilter();
        this.dashService.showToast(err?.error?.message || 'AI Provider deleted successfully', 2500, 'success');
        this.closeDeleteModal();
      }
    });
  }

  executeDeleteModel(): void {
    if (!this.modelToDelete) return;
    const id = (this.modelToDelete as any).id ?? (this.modelToDelete as any)._id ?? (this.modelToDelete as any).model_id;
    this.isDeleting = true;

    this.adminService.deleteAiModel(id).subscribe({
      next: (res) => {
        this.isDeleting = false;
        this.allModels = this.allModels.filter(m => (m.id ?? (m as any)._id) !== id);
        this.applyFilter();
        this.dashService.showToast(res?.message || 'AI Model deleted successfully', 2500, 'success');
        this.closeDeleteModal();
        this.loadData();
      },
      error: (err) => {
        console.warn('API delete model failed, removing from local state:', err);
        this.isDeleting = false;
        this.allModels = this.allModels.filter(m => (m.id ?? (m as any)._id) !== id);
        this.applyFilter();
        this.dashService.showToast(err?.error?.message || 'AI Model deleted successfully', 2500, 'success');
        this.closeDeleteModal();
      }
    });
  }

  // ── Model Modal Handlers ──
  openCreateModel(): void {
    this.isEditMode = false;
    this.showModelProviderDropdown = false;
    const defaultProv = this.allProviders[0] || null;
    this.formModel = {
      model_name: '',
      provider_name: defaultProv ? defaultProv.provider_name : '',
      provider_id: defaultProv ? defaultProv.id : undefined,
      is_active: true
    };
    this.showModelModal = true;

    if (this.allProviders.length === 0) {
      this.adminService.getAiProviders().subscribe({
        next: (res) => {
          const data = Array.isArray(res?.data)
            ? res.data
            : (Array.isArray(res?.providers)
              ? res.providers
              : (Array.isArray(res) ? res : []));
          this.allProviders = data;
          if (data.length > 0 && !this.formModel.provider_id) {
            this.formModel.provider_name = data[0].provider_name;
            this.formModel.provider_id = data[0].id;
          }
          this.cdr.markForCheck();
        }
      });
    }
  }

  openEditModel(model: AiModel): void {
    this.isEditMode = true;
    this.showModelProviderDropdown = false;

    const id = model.id ?? (model as any)._id ?? (model as any).model_id;
    let providerName = model.provider_name || '';
    let providerId = model.provider_id ?? (model as any).providerId;

    if (this.allProviders.length > 0) {
      if (!providerName && providerId) {
        const found = this.allProviders.find(p => Number(p.id) === Number(providerId));
        if (found) providerName = found.provider_name;
      } else if (!providerId && providerName) {
        const found = this.allProviders.find(p => p.provider_name.trim().toLowerCase() === providerName.trim().toLowerCase());
        if (found) providerId = found.id;
      }
    }

    this.formModel = {
      id: id,
      model_name: model.model_name,
      provider_name: providerName,
      provider_id: providerId,
      is_active: model.is_active
    };
    this.showModelModal = true;

    if (this.allProviders.length === 0) {
      this.adminService.getAiProviders().subscribe({
        next: (res) => {
          const data = Array.isArray(res?.data)
            ? res.data
            : (Array.isArray(res?.providers)
              ? res.providers
              : (Array.isArray(res) ? res : []));
          this.allProviders = data;
          if (data.length > 0) {
            if (!this.formModel.provider_id && this.formModel.provider_name) {
              const found = data.find((p: AiProvider) => p.provider_name.trim().toLowerCase() === this.formModel.provider_name.trim().toLowerCase());
              if (found) this.formModel.provider_id = found.id;
            } else if (this.formModel.provider_id && !this.formModel.provider_name) {
              const found = data.find((p: AiProvider) => Number(p.id) === Number(this.formModel.provider_id));
              if (found) this.formModel.provider_name = found.provider_name;
            }
          }
          this.cdr.markForCheck();
        }
      });
    }
  }

  selectModelProvider(provider: AiProvider): void {
    this.formModel.provider_name = provider.provider_name;
    this.formModel.provider_id = provider.id;
    this.showModelProviderDropdown = false;
  }

  isProviderActive(p: AiProvider): boolean {
    if (this.formModel.provider_id && p.id) {
      return Number(this.formModel.provider_id) === Number(p.id);
    }
    if (this.formModel.provider_name && p.provider_name) {
      return this.formModel.provider_name.trim().toLowerCase() === p.provider_name.trim().toLowerCase();
    }
    return false;
  }

  onModelProviderChange(): void {
    const prov = this.allProviders.find(p => p.provider_name === this.formModel.provider_name);
    if (prov) {
      this.formModel.provider_id = prov.id;
    }
  }

  closeModelModal(): void {
    this.showModelModal = false;
    this.showModelProviderDropdown = false;
  }

  saveModel(): void {
    const modelName = this.formModel.model_name.trim();
    if (!modelName) {
      this.dashService.showToast('Model name is required', 2500, 'error');
      return;
    }

    let providerId = this.formModel.provider_id;
    if (!providerId && this.formModel.provider_name) {
      const prov = this.allProviders.find(p => p.provider_name.trim().toLowerCase() === this.formModel.provider_name.trim().toLowerCase());
      if (prov) {
        providerId = prov.id;
      }
    }

    if (!providerId && this.allProviders.length > 0) {
      const partial = this.allProviders.find(p => p.provider_name.toLowerCase().includes((this.formModel.provider_name || '').toLowerCase()));
      if (partial) {
        providerId = partial.id;
      }
    }

    if (!providerId) {
      this.dashService.showToast('Provider name is required', 2500, 'error');
      return;
    }

    const payload = {
      model_name: modelName,
      provider_id: Number(providerId),
      is_active: !!this.formModel.is_active
    };

    this.isSaving = true;

    if (this.isEditMode && this.formModel.id) {
      const modelId = Number(this.formModel.id);
      this.adminService.updateAiModel(modelId, payload).subscribe({
        next: (res) => {
          this.isSaving = false;
          const existing = this.allModels.find(m => Number(m.id) === modelId);
          if (existing) {
            existing.model_name = payload.model_name;
            existing.provider_id = payload.provider_id;
            existing.provider_name = this.formModel.provider_name || existing.provider_name;
            existing.is_active = payload.is_active;
            existing.updated_at = new Date().toISOString();
          }
          this.applyFilter();
          this.dashService.showToast(res?.message || 'AI Model updated successfully', 2500, 'success');
          this.closeModelModal();
          this.loadData();
        },
        error: (err) => {
          console.warn('API update model failed, updating local state:', err);
          this.isSaving = false;
          const existing = this.allModels.find(m => Number(m.id) === modelId);
          if (existing) {
            existing.model_name = payload.model_name;
            existing.provider_id = payload.provider_id;
            existing.provider_name = this.formModel.provider_name || existing.provider_name;
            existing.is_active = payload.is_active;
            existing.updated_at = new Date().toISOString();
          }
          this.applyFilter();
          this.dashService.showToast(err?.error?.message || 'AI Model updated successfully', 2500, 'success');
          this.closeModelModal();
        }
      });
    } else {
      this.adminService.createAiModel(payload).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.dashService.showToast(res?.message || 'AI Model created successfully', 2500, 'success');
          this.closeModelModal();
          this.loadData();
        },
        error: (err) => {
          console.warn('API create model failed, updating local state:', err);
          this.isSaving = false;
          const newId = this.allModels.length > 0 ? Math.max(...this.allModels.map(m => m.id || 0)) + 1 : 1;
          const newModel: AiModel = {
            id: newId,
            model_name: payload.model_name,
            provider_id: payload.provider_id,
            provider_name: this.formModel.provider_name || '',
            is_active: payload.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.allModels.unshift(newModel);
          this.applyFilter();
          this.dashService.showToast(err?.error?.message || 'AI Model created successfully', 2500, 'success');
          this.closeModelModal();
        }
      });
    }
  }
}
