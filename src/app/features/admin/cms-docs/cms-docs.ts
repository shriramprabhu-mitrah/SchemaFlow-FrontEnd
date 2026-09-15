import { Component, OnInit, inject, ViewEncapsulation, HostListener, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CmsDocsService } from '../../../core/services/cms-docs.service';
import { MarkdownRendererService } from '../../../core/services/markdown-renderer.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { DocPage, DocRevision, DocSection } from '../../../core/models/cms-docs.model';
import { Icons } from '../../../core/component/icons/icons';

export interface SampleMediaItem {
  id: string;
  type: 'image' | 'video';
  title: string;
  url: string;
  thumbnail: string;
}

@Component({
  selector: 'app-cms-docs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons],
  templateUrl: './cms-docs.html',
  styleUrls: ['./cms-docs.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CmsDocsComponent implements OnInit {
  @ViewChild('previewBody') previewBodyRef?: ElementRef<HTMLElement>;

  cmsService = inject(CmsDocsService);
  mdRenderer = inject(MarkdownRendererService);
  dashService = inject(DashboardService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      this.cmsService.mediaLoaded();
      this.updatePreview();
    });
  }

  // Form Dropdown Toggle States
  showStatusDropdown = false;
  showSectionDropdown = false;
  showParentDropdown = false;
  showNewPageSectionDropdown = false;

  // Active View Mode: 'editor' | 'navigation'
  activeViewMode: 'editor' | 'navigation' = 'editor';

  // Active Tab in Editor: 'content' | 'seo' | 'settings' | 'history' | 'versions'
  activeTab: 'content' | 'seo' | 'settings' | 'history' | 'versions' = 'content';

  // Active Pane View: 'both' (50/50) | 'editor-only' (100% editor) | 'preview-only' (100% preview)
  activePaneView: 'both' | 'editor-only' | 'preview-only' = 'both';

  // Expand editor workspace (collapses left sidebar & right info panel)
  isWorkspaceExpanded = false;

  // Search filter for pages tree
  searchQuery = '';

  // Currently selected page for editing
  selectedPage: DocPage | null = null;

  // Form edit buffer
  editForm: Partial<DocPage> = {};

  // Rendered Live Preview cache
  previewHtml = '';

  // Revisions for selected page
  revisions: DocRevision[] = [];

  // Modals state
  showNewPageModal = false;
  showNewSectionModal = false;
  newPageTitle = '';
  newPageSectionId = '';
  newSectionTitle = '';

  // Insert Image / Video Modal State
  showMediaModal = false;
  mediaModalType: 'image' | 'video' = 'video';
  mediaModalTab: 'upload' | 'library' | 'url' = 'upload';
  mediaUrl = '';
  mediaCaption = '';

  // Pre-populated Sample Media Library for 1-click Insertion
  sampleMediaLibrary: SampleMediaItem[] = [
    {
      id: 'm1',
      type: 'image',
      title: 'Full Workspace & Interactive Diagram Canvas',
      url: 'assets/images/app_full_workspace_preview.png',
      thumbnail: 'assets/images/app_full_workspace_preview.png'
    },
    {
      id: 'm2',
      type: 'image',
      title: 'DBML Code Editor with Syntax Highlighting',
      url: 'assets/images/app_dbml_code_editor.png',
      thumbnail: 'assets/images/app_dbml_code_editor.png'
    },
    {
      id: 'm3',
      type: 'image',
      title: 'Diagram Views & Schema Filtering Sidebar',
      url: 'assets/images/app_diagram_views_panel.png',
      thumbnail: 'assets/images/app_diagram_views_panel.png'
    },
    {
      id: 'm4',
      type: 'image',
      title: 'Auto-Layout & Connector Link Styles',
      url: 'assets/images/app_autolayout_link_styles.png',
      thumbnail: 'assets/images/app_autolayout_link_styles.png'
    },
    {
      id: 'm5',
      type: 'image',
      title: 'Data Dictionary & Searchable Schema Table',
      url: 'assets/images/app_data_dictionary_view.png',
      thumbnail: 'assets/images/app_data_dictionary_view.png'
    },
    {
      id: 'm6',
      type: 'image',
      title: 'Public Diagram Sharing & Access Controls',
      url: 'assets/images/app_share_modal_dialog.png',
      thumbnail: 'assets/images/app_share_modal_dialog.png'
    },
    {
      id: 'm7',
      type: 'image',
      title: 'Color-Coded TableGroups & Domain Clustering',
      url: 'assets/images/app_table_groups_clustering.png',
      thumbnail: 'assets/images/app_table_groups_clustering.png'
    },
    {
      id: 'm8',
      type: 'image',
      title: 'Workspaces Management & Selector Panel',
      url: 'assets/images/app_workspaces_modal_preview.png',
      thumbnail: 'assets/images/app_workspaces_modal_preview.png'
    }
  ];

  // Toast feedback message
  toastMessage: string | null = null;
  toastType: 'success' | 'error' | 'info' = 'success';

  ngOnInit(): void {
    this.dashService.applyTheme(this.dashService.theme());
    const pages = this.cmsService.getPages();
    if (pages.length > 0) {
      this.selectPage(pages[0]);
    }
  }

  isLightTheme(): boolean {
    return this.dashService.theme() === 'light';
  }

  toggleWorkspaceExpand(): void {
    this.isWorkspaceExpanded = !this.isWorkspaceExpanded;
  }

  toggleExpandEditor(): void {
    if (this.activePaneView === 'editor-only') {
      this.activePaneView = 'both';
    } else {
      this.activePaneView = 'editor-only';
    }
  }

  toggleExpandPreview(): void {
    if (this.activePaneView === 'preview-only') {
      this.activePaneView = 'both';
    } else {
      this.activePaneView = 'preview-only';
    }
  }

  get sections(): DocSection[] {
    return this.cmsService.getSections();
  }

  get allPages(): DocPage[] {
    return this.cmsService.getPages();
  }

  get filteredPages(): DocPage[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.allPages;
    return this.allPages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }

  getPagesForSection(sectionId: string): DocPage[] {
    return this.filteredPages
      .filter(p => p.sectionId === sectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Undo / Redo History Stacks
  undoStack: string[] = [];
  redoStack: string[] = [];

  selectPage(page: DocPage): void {
    this.selectedPage = page;
    this.editForm = { ...page };
    this.undoStack = [];
    this.redoStack = [];
    this.updatePreview();
    this.loadRevisions();
  }

  onContentChange(): void {
    this.recordHistoryState();
    this.updatePreview();
  }

  recordHistoryState(): void {
    const current = this.editForm.content || '';
    if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== current) {
      this.undoStack.push(current);
      if (this.undoStack.length > 50) this.undoStack.shift();
    }
  }

  getParentPageTitle(parentId?: string | null): string {
    if (!parentId) return '';
    const parent = this.allPages.find(p => p.id === parentId);
    return parent ? parent.title : '';
  }

  closeAllFormDropdowns(): void {
    this.showStatusDropdown = false;
    this.showSectionDropdown = false;
    this.showParentDropdown = false;
    this.showNewPageSectionDropdown = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllFormDropdowns();
    this.closeAllToolbarMenus();
  }

  onSectionOrParentChange(): void {
    if (this.selectedPage && this.editForm.id) {
      if (this.editForm.sectionId) {
        this.selectedPage.sectionId = this.editForm.sectionId;
      }
      this.selectedPage.parentId = this.editForm.parentId;
    }
  }

  updatePreview(): void {
    const content = this.editForm.content || '';
    const res = this.mdRenderer.render(content);
    this.previewHtml = res.html;
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const videoElements = document.querySelectorAll<HTMLVideoElement>('video');
        videoElements.forEach(v => {
          v.muted = true;
          if (v.src) {
            try {
              v.load();
              v.play().catch(() => {});
            } catch {}
          }
        });
      }, 100);
    }
  }

  loadRevisions(): void {
    if (this.selectedPage) {
      this.revisions = this.cmsService.getRevisions(this.selectedPage.id);
    } else {
      this.revisions = [];
    }
  }

  // Compute Line Numbers array for Editor Gutter
  getLineNumbers(): number[] {
    const content = this.editForm.content || '';
    const count = Math.max(1, content.split('\n').length);
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  onEditorScroll(textarea: HTMLTextAreaElement, gutter: HTMLElement): void {
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
    const previewBody = this.previewBodyRef?.nativeElement;
    if (previewBody && textarea.scrollHeight > textarea.clientHeight) {
      const scrollRatio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
      const maxPreviewScroll = previewBody.scrollHeight - previewBody.clientHeight;
      if (maxPreviewScroll > 0) {
        previewBody.scrollTop = scrollRatio * maxPreviewScroll;
      }
    }
  }

  isProcessingMedia = false;

  // Open Insert Media Modal
  openMediaModal(type: 'image' | 'video' = 'video'): void {
    this.closeAllToolbarMenus();
    this.mediaModalType = type;
    this.mediaModalTab = 'url';
    this.mediaUrl = '';
    this.isProcessingMedia = false;
    this.mediaCaption = type === 'video' ? 'Walkthrough Video' : 'Architecture Diagram';
    this.showMediaModal = true;
  }

  isDraggingMedia = false;

  onMediaDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMedia = true;
  }

  onMediaDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMedia = false;
  }

  onMediaFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMedia = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleSelectedMediaFile(event.dataTransfer.files[0]);
    }
  }

  onMediaFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.handleSelectedMediaFile(target.files[0]);
      target.value = '';
    }
  }

  private handleSelectedMediaFile(file: File): void {
    const cleanFileName = file.name.replace(/[^\w\.-]/g, '_');
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    if (!this.mediaCaption || this.mediaCaption === 'Architecture Diagram' || this.mediaCaption === 'Walkthrough Video') {
      this.mediaCaption = fileNameWithoutExt;
    }

    const mediaPath = `assets/uploads/${cleanFileName}`;

    // Save file to IndexedDB for persistent reload + create instant Blob URL
    this.cmsService.saveMediaFile(mediaPath, file);
    this.mediaUrl = mediaPath;
    this.isProcessingMedia = false;
  }

  selectLibraryMedia(item: SampleMediaItem): void {
    this.mediaUrl = item.url;
    this.mediaCaption = item.title;
    this.insertMediaFromModal();
  }

  insertMediaFromModal(): void {
    if (this.isProcessingMedia || !this.mediaUrl.trim()) return;

    let markdownSnippet = '';
    if (this.mediaModalType === 'video') {
      markdownSnippet = `![video:${this.mediaCaption.trim()}](${this.mediaUrl.trim()})`;
    } else {
      markdownSnippet = `![${this.mediaCaption.trim()}](${this.mediaUrl.trim()})`;
    }

    this.insertMarkdownAtCursor('\n' + markdownSnippet + '\n');
    this.showMediaModal = false;
    this.showToast(`${this.mediaModalType === 'video' ? 'Video' : 'Image'} inserted into Markdown!`, 'success');
  }

  savePageChanges(): void {
    if (!this.selectedPage) return;
    this.formSubmitted = true;

    if (!this.editForm.title || !this.editForm.title.trim()) {
      return;
    }

    if (!this.editForm.slug || !this.editForm.slug.trim()) {
      return;
    }

    if (this.editForm.sortOrder === null || this.editForm.sortOrder === undefined || isNaN(this.editForm.sortOrder as any) || (this.editForm.sortOrder as any) === '') {
      return;
    }

    const updated = this.cmsService.savePage({
      ...this.selectedPage,
      ...this.editForm,
      title: this.editForm.title.trim(),
      slug: this.editForm.slug.trim(),
      sortOrder: Number(this.editForm.sortOrder)
    }, 'Updated page content from CMS Editor');

    this.selectedPage = updated;
    this.editForm = { ...updated };
    this.loadRevisions();
    this.showToast('Changes saved successfully!', 'success');
  }

  togglePublishStatus(): void {
    if (!this.selectedPage) return;

    if (this.editForm.status === 'published') {
      const updated = this.cmsService.unpublishPage(this.selectedPage.id);
      if (updated) {
        this.selectedPage = updated;
        this.editForm.status = 'draft';
        this.showToast('Page unpublished to Draft', 'info');
      }
    } else {
      const updated = this.cmsService.publishPage(this.selectedPage.id);
      if (updated) {
        this.selectedPage = updated;
        this.editForm.status = 'published';
        this.showToast('Page published live to application docs!', 'success');
      }
    }
  }

  // Custom Confirmation Modal state
  showConfirmModal = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  private pendingConfirmAction: (() => void) | null = null;

  openConfirmModal(title: string, message: string, action: () => void): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.pendingConfirmAction = action;
    this.showConfirmModal = true;
  }

  executeConfirmAction(): void {
    if (this.pendingConfirmAction) {
      this.pendingConfirmAction();
    }
    this.showConfirmModal = false;
    this.pendingConfirmAction = null;
  }

  cancelConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingConfirmAction = null;
  }

  deleteCurrentPage(): void {
    if (!this.selectedPage) return;
    const pageTitle = this.selectedPage.title;
    const pageId = this.selectedPage.id;

    this.openConfirmModal('Delete Page', `Are you sure you want to delete "${pageTitle}"? This action cannot be undone.`, () => {
      this.cmsService.deletePage(pageId);
      this.showToast(`Page "${pageTitle}" deleted`, 'info');
      const pages = this.cmsService.getPages();
      if (pages.length > 0) {
        this.selectPage(pages[0]);
      } else {
        this.selectedPage = null;
        this.editForm = {};
      }
    });
  }

  duplicateCurrentPage(): void {
    if (!this.selectedPage) return;
    const dup = this.cmsService.duplicatePage(this.selectedPage.id);
    if (dup) {
      this.selectPage(dup);
      this.showToast('Page duplicated successfully', 'success');
    }
  }

  exportCurrentPageMarkdown(): void {
    if (!this.selectedPage) return;
    this.cmsService.exportAsMarkdownFile(this.selectedPage);
    this.showToast(`Exported ${this.selectedPage.slug}.md`, 'success');
  }

  restoreRevision(revision: DocRevision): void {
    if (!this.selectedPage) return;
    this.openConfirmModal('Restore Version', `Are you sure you want to restore Version ${revision.version}? Current editor changes will be updated.`, () => {
      const restored = this.cmsService.restoreRevision(this.selectedPage!.id, revision.id);
      if (restored) {
        this.selectPage(restored);
        this.showToast(`Restored Version ${revision.version}`, 'success');
      }
    });
  }

  // Rich Toolbar Dropdown States
  showHeadingMenu = false;
  showPlusMenu = false;
  showCalloutMenu = false;
  showTableMenu = false;
  showAlignMenu = false;
  showColorMenu = false;
  showMentionMenu = false;
  showEmojiMenu = false;
  showCodeLangMenu = false;
  isPagePinned = false;
  selectedHeadingLabel = 'Normal text';

  closeAllToolbarMenus(): void {
    this.showHeadingMenu = false;
    this.showPlusMenu = false;
    this.showCalloutMenu = false;
    this.showTableMenu = false;
    this.showAlignMenu = false;
    this.showColorMenu = false;
    this.showMentionMenu = false;
    this.showEmojiMenu = false;
    this.showCodeLangMenu = false;
  }

  toggleHeadingMenu(): void {
    const nextState = !this.showHeadingMenu;
    this.closeAllToolbarMenus();
    this.showHeadingMenu = nextState;
  }

  togglePlusMenu(): void {
    const nextState = !this.showPlusMenu;
    this.closeAllToolbarMenus();
    this.showPlusMenu = nextState;
  }

  toggleCalloutMenu(): void {
    const nextState = !this.showCalloutMenu;
    this.closeAllToolbarMenus();
    this.showCalloutMenu = nextState;
  }

  toggleTableMenu(): void {
    const nextState = !this.showTableMenu;
    this.closeAllToolbarMenus();
    this.showTableMenu = nextState;
  }

  toggleAlignMenu(): void {
    const nextState = !this.showAlignMenu;
    this.closeAllToolbarMenus();
    this.showAlignMenu = nextState;
  }

  toggleColorMenu(): void {
    const nextState = !this.showColorMenu;
    this.closeAllToolbarMenus();
    this.showColorMenu = nextState;
  }

  toggleMentionMenu(): void {
    const nextState = !this.showMentionMenu;
    this.closeAllToolbarMenus();
    this.showMentionMenu = nextState;
  }

  toggleEmojiMenu(): void {
    const nextState = !this.showEmojiMenu;
    this.closeAllToolbarMenus();
    this.showEmojiMenu = nextState;
  }

  toggleCodeLangMenu(): void {
    const nextState = !this.showCodeLangMenu;
    this.closeAllToolbarMenus();
    this.showCodeLangMenu = nextState;
  }

  applyHeading(prefix: string, label: string): void {
    this.selectedHeadingLabel = label;
    this.insertMarkdown(prefix, '');
    this.closeAllToolbarMenus();
  }

  applyTextColor(colorHex: string): void {
    this.insertMarkdown(`<span style="color: ${colorHex};">`, '</span>');
    this.closeAllToolbarMenus();
  }

  applyHighlightColor(colorHex: string): void {
    this.insertMarkdown(`<mark style="background: ${colorHex}; color: #0f172a; padding: 2px 6px; border-radius: 4px;">`, '</mark>');
    this.closeAllToolbarMenus();
  }

  applyAlignment(align: 'left' | 'center' | 'right' | 'justify'): void {
    this.insertMarkdown(`<div align="${align}">\n\n`, '\n\n</div>');
    this.closeAllToolbarMenus();
  }

  insertMentionTag(tag: string): void {
    this.insertMarkdownAtCursor(`@${tag} `);
    this.closeAllToolbarMenus();
  }

  insertEmoji(emoji: string): void {
    this.insertMarkdownAtCursor(`${emoji} `);
    this.closeAllToolbarMenus();
  }

  insertCodeBlock(lang: string = 'dbml'): void {
    this.insertMarkdownAtCursor(`\n\`\`\`${lang}\n// Write ${lang.toUpperCase()} code here...\n\`\`\`\n\n`);
    this.closeAllToolbarMenus();
  }

  togglePagePin(): void {
    this.isPagePinned = !this.isPagePinned;
    this.showToast(this.isPagePinned ? 'Page pinned to top quick-access bookmarks' : 'Page unpinned from bookmarks', 'info');
  }

  clearFormatting(): void {
    const textarea = document.getElementById('cms-markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    if (!selected) {
      this.showToast('Please select text to clear markdown formatting', 'info');
      return;
    }
    const cleanText = selected.replace(/[*_~`#|>+[\]()]/g, '');
    this.editForm.content = text.substring(0, start) + cleanText + text.substring(end);
    this.updatePreview();
    this.showToast('Formatting cleared from selection', 'success');
  }

  onEditorKeydown(event: KeyboardEvent): void {
    const isMac = typeof navigator !== 'undefined' && (navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

    if (ctrlKey) {
      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        this.insertMarkdown('**', '**');
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        this.insertMarkdown('*', '*');
        return;
      }
      if (key === 'u') {
        event.preventDefault();
        this.insertMarkdown('<u>', '</u>');
        return;
      }
      if (key === 'k') {
        event.preventDefault();
        this.insertMarkdown('[', '](https://)');
        return;
      }
    }

    if (event.key === 'Enter') {
      const textarea = event.target as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) return;

      const text = textarea.value;
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const currentLine = text.substring(lineStart, start);

      // 1. Task list item: - [ ] or - [x]
      const taskMatch = currentLine.match(/^(\s*)-\s*\[[ xX]\]\s*/);
      if (taskMatch) {
        if (currentLine.trim() === '- [ ]' || currentLine.trim() === '- [x]') {
          event.preventDefault();
          this.editForm.content = text.substring(0, lineStart) + text.substring(start);
          this.updatePreview();
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }
        event.preventDefault();
        const indent = taskMatch[1] || '';
        this.insertMarkdownAtCursor(`\n${indent}- [ ] `);
        return;
      }

      // 2. Unordered bullet list item: - or * or +
      const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const symbol = bulletMatch[2];
        if (currentLine.trim() === symbol) {
          event.preventDefault();
          this.editForm.content = text.substring(0, lineStart) + text.substring(start);
          this.updatePreview();
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }
        event.preventDefault();
        this.insertMarkdownAtCursor(`\n${indent}${symbol} `);
        return;
      }

      // 3. Ordered numbered list item: 1. or 2.
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (numberMatch) {
        const indent = numberMatch[1];
        const currentNum = parseInt(numberMatch[2], 10);
        if (currentLine.trim() === `${currentNum}.`) {
          event.preventDefault();
          this.editForm.content = text.substring(0, lineStart) + text.substring(start);
          this.updatePreview();
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }
        event.preventDefault();
        this.insertMarkdownAtCursor(`\n${indent}${currentNum + 1}. `);
        return;
      }
    }
  }

  insertCallout(type: 'NOTE' | 'TIP' | 'WARNING' | 'IMPORTANT'): void {
    const snippet = `\n> [!${type}]\n> Enter ${type.toLowerCase()} details here...\n\n`;
    this.insertMarkdownAtCursor(snippet);
    this.closeAllToolbarMenus();
  }

  insertTableGrid(cols: number = 3, rows: number = 2): void {
    let headers = '|';
    let separators = '|';
    for (let c = 1; c <= cols; c++) {
      headers += ` Header ${c} |`;
      separators += ' --- |';
    }
    let body = '';
    for (let r = 1; r <= rows; r++) {
      body += '|';
      for (let c = 1; c <= cols; c++) {
        body += ` Cell ${r}.${c} |`;
      }
      body += '\n';
    }
    const tableSnippet = `\n${headers}\n${separators}\n${body}\n`;
    this.insertMarkdownAtCursor(tableSnippet);
    this.closeAllToolbarMenus();
  }

  insertTaskList(): void {
    this.insertMarkdown('- [ ] ', '');
  }

  insertHorizontalRule(): void {
    this.insertMarkdownAtCursor('\n---\n');
    this.closeAllToolbarMenus();
  }

  triggerUndo(): void {
    const textarea = document.getElementById('cms-markdown-textarea') as HTMLTextAreaElement;
    if (textarea && document.activeElement === textarea) {
      document.execCommand('undo');
      this.updatePreview();
      return;
    }
    if (this.undoStack.length > 0) {
      const current = this.editForm.content || '';
      this.redoStack.push(current);
      const previous = this.undoStack.pop()!;
      this.editForm.content = previous;
      this.updatePreview();
      this.showToast('Reverted edit (Undo)', 'info');
    } else {
      this.showToast('Nothing to revert', 'info');
    }
  }

  triggerRedo(): void {
    const textarea = document.getElementById('cms-markdown-textarea') as HTMLTextAreaElement;
    if (textarea && document.activeElement === textarea) {
      document.execCommand('redo');
      this.updatePreview();
      return;
    }
    if (this.redoStack.length > 0) {
      const current = this.editForm.content || '';
      this.undoStack.push(current);
      const next = this.redoStack.pop()!;
      this.editForm.content = next;
      this.updatePreview();
      this.showToast('Forward edit (Redo)', 'info');
    } else {
      this.showToast('Nothing to redo', 'info');
    }
  }

  insertMarkdown(prefix: string, suffix: string = ''): void {
    this.recordHistoryState();
    const textarea = document.getElementById('cms-markdown-textarea') as HTMLTextAreaElement;
    const text = this.editForm.content || '';
    const start = (textarea && typeof textarea.selectionStart === 'number') ? textarea.selectionStart : text.length;
    const end = (textarea && typeof textarea.selectionEnd === 'number') ? textarea.selectionEnd : text.length;
    const savedScrollTop = textarea ? textarea.scrollTop : 0;

    const rawSelected = text.substring(start, end);

    let leadingSpaces = '';
    let trailingSpaces = '';
    let coreSelected = rawSelected;

    if (rawSelected.length > 0) {
      const matchLeading = rawSelected.match(/^(\s*)/);
      if (matchLeading) {
        leadingSpaces = matchLeading[1];
        coreSelected = coreSelected.substring(leadingSpaces.length);
      }
      const matchTrailing = coreSelected.match(/(\s*)$/);
      if (matchTrailing) {
        trailingSpaces = matchTrailing[1];
        coreSelected = coreSelected.substring(0, coreSelected.length - trailingSpaces.length);
      }
    }

    if (!coreSelected && !rawSelected) {
      coreSelected = 'Sample Text';
    }

    let replacement = '';
    let selectionStart = start + leadingSpaces.length + prefix.length;
    let selectionEnd = selectionStart + coreSelected.length;

    // Toggle un-formatting if already wrapped
    if (
      prefix &&
      suffix &&
      coreSelected.startsWith(prefix) &&
      coreSelected.endsWith(suffix) &&
      coreSelected.length >= prefix.length + suffix.length
    ) {
      const unwrapped = coreSelected.substring(prefix.length, coreSelected.length - suffix.length);
      replacement = leadingSpaces + unwrapped + trailingSpaces;
      selectionStart = start + leadingSpaces.length;
      selectionEnd = selectionStart + unwrapped.length;
    } else {
      replacement = leadingSpaces + prefix + coreSelected + suffix + trailingSpaces;
    }

    this.editForm.content = text.substring(0, start) + replacement + text.substring(end);
    this.updatePreview();

    if (textarea) {
      setTimeout(() => {
        try {
          (textarea as any).focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
        textarea.setSelectionRange(selectionStart, selectionEnd);
        textarea.scrollTop = savedScrollTop;
      }, 0);
    }
  }

  insertMarkdownAtCursor(snippet: string): void {
    this.recordHistoryState();
    const textarea = document.getElementById('cms-markdown-textarea') as HTMLTextAreaElement;
    const text = this.editForm.content || '';
    const start = (textarea && typeof textarea.selectionStart === 'number') ? textarea.selectionStart : text.length;
    const end = (textarea && typeof textarea.selectionEnd === 'number') ? textarea.selectionEnd : text.length;
    const savedScrollTop = textarea ? textarea.scrollTop : 0;

    this.editForm.content = text.substring(0, start) + snippet + text.substring(end);
    this.updatePreview();

    if (textarea) {
      setTimeout(() => {
        try {
          (textarea as any).focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
        const newPos = start + snippet.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.scrollTop = savedScrollTop;
      }, 0);
    }
  }

  newPageTitleTouched = false;
  newPageSubmitted = false;
  newSectionTitleTouched = false;
  newSectionSubmitted = false;
  titleTouched = false;
  slugTouched = false;
  sortOrderTouched = false;
  formSubmitted = false;

  openNewPageModal(sectionId?: string): void {
    this.newPageSectionId = sectionId || (this.sections[0]?.id || '');
    this.newPageTitle = '';
    this.newPageTitleTouched = false;
    this.newPageSubmitted = false;
    this.showNewPageModal = true;
  }

  createNewPage(): void {
    this.newPageTitleTouched = true;
    this.newPageSubmitted = true;
    if (!this.newPageTitle || !this.newPageTitle.trim()) {
      return;
    }
    const newPage = this.cmsService.savePage({
      title: this.newPageTitle.trim(),
      sectionId: this.newPageSectionId,
      status: 'draft'
    }, 'Created new page');
    this.showNewPageModal = false;
    this.newPageTitle = '';
    this.newPageTitleTouched = false;
    this.newPageSubmitted = false;
    this.selectPage(newPage);
    this.showToast('New documentation page created!', 'success');
  }

  openNewSectionModal(): void {
    this.newSectionTitle = '';
    this.newSectionTitleTouched = false;
    this.newSectionSubmitted = false;
    this.showNewSectionModal = true;
  }

  createNewSection(): void {
    this.newSectionTitleTouched = true;
    this.newSectionSubmitted = true;
    if (!this.newSectionTitle || !this.newSectionTitle.trim()) {
      return;
    }
    this.cmsService.saveSection({
      title: this.newSectionTitle.trim()
    });
    this.showNewSectionModal = false;
    this.newSectionTitle = '';
    this.newSectionTitleTouched = false;
    this.newSectionSubmitted = false;
    this.showToast('New navigation section created!', 'success');
  }

  deleteSection(section: DocSection, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const pages = this.getPagesForSection(section.id);
    const msg = pages.length > 0
      ? `Are you sure you want to delete section "${section.title}" and its ${pages.length} page(s)? This action cannot be undone.`
      : `Are you sure you want to delete section "${section.title}"? This action cannot be undone.`;

    this.openConfirmModal('Delete Section', msg, () => {
      this.cmsService.deleteSection(section.id);
      this.showToast(`Section "${section.title}" deleted`, 'info');
      if (this.selectedPage && this.selectedPage.sectionId === section.id) {
        const remaining = this.cmsService.getPages();
        if (remaining.length > 0) {
          this.selectPage(remaining[0]);
        } else {
          this.selectedPage = null;
          this.editForm = {};
        }
      }
    });
  }

  copyPublicLink(): void {
    if (!this.selectedPage) return;
    const url = `${window.location.origin}/docs/${this.selectedPage.slug}`;
    navigator.clipboard.writeText(url);
    this.showToast('Public link copied to clipboard!', 'success');
  }

  getPublicDocsUrl(): string {
    if (this.selectedPage && this.selectedPage.slug) {
      return `/docs/${this.selectedPage.slug}`;
    }
    return '/docs';
  }

  viewPublicDocs(): void {
    if (typeof window !== 'undefined') {
      window.open(this.getPublicDocsUrl(), '_blank');
    }
  }

  showToast(msg: string, type: 'success' | 'error' | 'info' = 'success', durationMs: number = 3000): void {
    this.dashService.showToast(msg, durationMs, type as any);
  }

  getSectionTitle(sectionId?: string): string {
    if (!sectionId) return 'Select Section';
    const sec = this.sections.find(s => s.id === sectionId);
    return sec ? sec.title : 'Select Section';
  }

  getWordCount(): number {
    const text = (this.editForm.content || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }

  getCharacterCount(): number {
    return (this.editForm.content || '').length;
  }
}
