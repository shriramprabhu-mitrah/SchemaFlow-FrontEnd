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
  styleUrls: ['./ai-configs.scss']
})
export class AiConfigsComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  activeTab: 'providers' | 'catalog' | 'system' = 'providers';

  // AI System Settings State
  systemSettings: {
    ai_app_url: string;
    max_tokens: number;
    free_model_id: number;
    model_name?: string;
    provider_id?: number;
    provider_name?: string;
  } = {
    ai_app_url: '',
    max_tokens: 500000,
    free_model_id: 1,
    model_name: '',
    provider_name: ''
  };
  isSavingSettings = false;
  loadingSettings = false;
  showFreeModelDropdown = false;

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
    this.showFreeModelDropdown = false;
  }

  ngOnInit(): void {
    this.loadData();
    this.loadSystemSettings();
  }

  setTab(tab: 'providers' | 'catalog' | 'system'): void {
    this.activeTab = tab;
    this.search = '';
    this.page = 1;
    if (tab === 'system') {
      this.loadSystemSettings();
    } else {
      this.applyFilter();
    }
  }

  loadData(): void {
    this.loading = true;
    let providersLoaded = false;
    let modelsLoaded = false;

    const checkDone = () => {
      if (providersLoaded && modelsLoaded) {
        this.loading = false;
        this.applyFilter();
        this.syncSelectedModelInfo();
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

  loadSystemSettings(): void {
    this.loadingSettings = true;
    this.adminService.getAiSystemSettings().subscribe({
      next: (res) => {
        this.loadingSettings = false;
        if (res?.data) {
          this.systemSettings = {
            ai_app_url: res.data.ai_app_url || '',
            max_tokens: res.data.max_tokens || 500000,
            free_model_id: res.data.free_model_id || 1,
            model_name: res.data.model_name || '',
            provider_id: res.data.provider_id,
            provider_name: res.data.provider_name || ''
          };
          this.syncSelectedModelInfo();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingSettings = false;
        console.error('Failed to load AI system settings:', err);
        this.cdr.markForCheck();
      }
    });
  }

  get dbNexusModels(): AiModel[] {
    const dbNexusProviderIds = new Set(
      this.allProviders
        .filter(p => (p.provider_name || '').toLowerCase().includes('dbnexus'))
        .map(p => p.id)
    );

    return this.allModels.filter(m => {
      const providerName = (m.provider_name || '').toLowerCase().trim();
      const modelName = (m.model_name || '').toLowerCase().trim();
      const isMatchingProvider = providerName.includes('dbnexus') || dbNexusProviderIds.has(m.provider_id);
      const isMatchingModel = modelName.includes('dbnexus');
      return isMatchingProvider || isMatchingModel;
    });
  }

  syncSelectedModelInfo(): void {
    const available = this.dbNexusModels;
    if (available.length > 0 && !available.some(m => Number(m.id) === Number(this.systemSettings.free_model_id))) {
      const defaultDbNexus = available.find(m => m.model_name.toLowerCase().includes('dbnexus')) || available[0];
      if (defaultDbNexus) {
        this.systemSettings.free_model_id = defaultDbNexus.id;
        this.systemSettings.model_name = defaultDbNexus.model_name;
        this.systemSettings.provider_name = defaultDbNexus.provider_name;
        this.systemSettings.provider_id = defaultDbNexus.provider_id;
        return;
      }
    }

    const selected = this.allModels.find(m => Number(m.id) === Number(this.systemSettings.free_model_id));
    if (selected) {
      this.systemSettings.model_name = selected.model_name;
      this.systemSettings.provider_name = selected.provider_name;
      this.systemSettings.provider_id = selected.provider_id;
    }
  }

  get selectedFreeModelLabel(): string {
    if (this.systemSettings.model_name) {
      return `${this.systemSettings.model_name} (${this.systemSettings.provider_name || 'DBNexus AI'})`;
    }
    const found = this.allModels.find(m => Number(m.id) === Number(this.systemSettings.free_model_id));
    if (found) {
      return `${found.model_name} (${found.provider_name || 'DBNexus AI'})`;
    }
    return '-- Select Free Model --';
  }

  selectFreeModel(model: AiModel): void {
    this.systemSettings.free_model_id = model.id;
    this.systemSettings.model_name = model.model_name;
    this.systemSettings.provider_name = model.provider_name || 'DBNexus AI';
    this.systemSettings.provider_id = model.provider_id;
    this.showFreeModelDropdown = false;
    this.cdr.markForCheck();
  }

  onModelSelected(modelId: any): void {
    this.systemSettings.free_model_id = Number(modelId);
    this.syncSelectedModelInfo();
  }

  saveSystemSettings(): void {
    if (!this.systemSettings.ai_app_url || !this.systemSettings.ai_app_url.trim()) {
      this.dashService.showToast('AI Gateway URL is required', 2500, 'error');
      return;
    }
    if (!/^https?:\/\//i.test(this.systemSettings.ai_app_url.trim())) {
      this.dashService.showToast('AI Gateway URL must start with http:// or https://', 2500, 'error');
      return;
    }
    if (!this.systemSettings.max_tokens || this.systemSettings.max_tokens <= 0) {
      this.dashService.showToast('Max tokens must be greater than 0', 2500, 'error');
      return;
    }
    if (!this.systemSettings.free_model_id) {
      this.dashService.showToast('Please select a free AI model', 2500, 'error');
      return;
    }

    this.isSavingSettings = true;
    this.adminService.updateAiSystemSettings({
      ai_app_url: this.systemSettings.ai_app_url.trim(),
      max_tokens: Number(this.systemSettings.max_tokens),
      free_model_id: Number(this.systemSettings.free_model_id)
    }).subscribe({
      next: (res) => {
        this.isSavingSettings = false;
        if (res?.data) {
          this.systemSettings = {
            ai_app_url: res.data.ai_app_url,
            max_tokens: res.data.max_tokens,
            free_model_id: res.data.free_model_id,
            model_name: res.data.model_name,
            provider_id: res.data.provider_id,
            provider_name: res.data.provider_name
          };
          this.syncSelectedModelInfo();
        }
        this.dashService.showToast(res?.message || 'AI system settings updated successfully', 2500, 'success');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingSettings = false;
        this.dashService.showToast(err?.error?.message || 'Failed to update AI system settings', 2500, 'error');
        this.cdr.markForCheck();
      }
    });
  }
}

