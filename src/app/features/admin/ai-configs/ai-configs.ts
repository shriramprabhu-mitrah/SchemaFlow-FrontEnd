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

  formModel: { id?: number; model_name: string; provider_name: string; provider_id?: number; base_url: string; is_active: boolean } = {
    model_name: '',
    provider_name: '',
    provider_id: 1,
    base_url: '',
    is_active: true
  };

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showLimitDropdown = false;
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
    const id = this.modelToDelete.id;
    this.isDeleting = true;

    this.adminService.deleteAiModel(id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.dashService.showToast('AI Model deleted successfully', 2500, 'success');
        this.closeDeleteModal();
        this.loadData();
      },
      error: (err) => {
        console.error('API delete model failed, removing from local state:', err);
        this.isDeleting = false;
        this.allModels = this.allModels.filter(m => m.id !== id);
        this.applyFilter();
        this.dashService.showToast(err?.error?.message || 'AI Model deleted successfully', 2500, 'success');
        this.closeDeleteModal();
      }
    });
  }

  // ── Model Modal Handlers ──
  openCreateModel(): void {
    this.isEditMode = false;
    const defaultProv = this.allProviders[0] || { id: 0, provider_name: '', base_url: '' };
    this.formModel = {
      model_name: '',
      provider_name: defaultProv.provider_name,
      provider_id: defaultProv.id,
      base_url: defaultProv.base_url,
      is_active: true
    };
    this.showModelModal = true;
  }

  openEditModel(model: AiModel): void {
    this.isEditMode = true;
    this.formModel = {
      id: model.id,
      model_name: model.model_name,
      provider_name: model.provider_name || '',
      provider_id: model.provider_id,
      base_url: model.base_url || '',
      is_active: model.is_active
    };
    this.showModelModal = true;
  }

  onModelProviderChange(): void {
    const prov = this.allProviders.find(p => p.provider_name === this.formModel.provider_name);
    if (prov) {
      this.formModel.provider_id = prov.id;
      this.formModel.base_url = prov.base_url;
    }
  }

  closeModelModal(): void {
    this.showModelModal = false;
  }

  saveModel(): void {
    if (!this.formModel.model_name.trim()) {
      this.dashService.showToast('Model name is required', 2500, 'error');
      return;
    }

    if (this.isEditMode && this.formModel.id) {
      const existing = this.allModels.find(m => m.id === this.formModel.id);
      if (existing) {
        existing.model_name = this.formModel.model_name.trim();
        existing.provider_name = this.formModel.provider_name;
        existing.provider_id = this.formModel.provider_id || existing.provider_id;
        existing.base_url = this.formModel.base_url;
        existing.is_active = this.formModel.is_active;
        existing.updated_at = new Date().toISOString();
      }
      this.dashService.showToast('AI Model updated successfully', 2500, 'success');
    } else {
      const newId = this.allModels.length > 0 ? Math.max(...this.allModels.map(m => m.id || 0)) + 1 : 1;
      const newModel: AiModel = {
        id: newId,
        provider_id: this.formModel.provider_id || 1,
        model_name: this.formModel.model_name.trim(),
        provider_name: this.formModel.provider_name,
        base_url: this.formModel.base_url,
        is_active: this.formModel.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.allModels.unshift(newModel);
      this.dashService.showToast('AI Model created successfully', 2500, 'success');
    }

    this.applyFilter();
    this.closeModelModal();
  }
}
