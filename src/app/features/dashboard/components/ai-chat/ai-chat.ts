import { Component, EventEmitter, Output, inject, signal, effect, ViewChild, ElementRef, AfterViewChecked, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { EntitlementService } from '../../../../core/services/entitlement.service';
import { AuthService } from '../../../../core/services/auth.service';

export interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    codeSnippet?: string;
    applied?: boolean;
    modelName?: string;
    providerName?: string;
    summarize?: string;
    isStreaming?: boolean;
    streamingStage?: 'code' | 'text';
    displayText?: string;
    displayCodeSnippet?: string;
    historyId?: number;
    sessionId?: number;
}

export interface AiChatModel {
    id: number | string;
    provider_id?: number;
    model_name: string;
    provider_name: string;
    base_url?: string;
    max_tokens?: number | null;
    api_key?: string | null;
    has_api_key?: boolean;
}

export interface AiSessionItem {
    session_id: number;
    application_id?: number;
    model_id?: number;
    name: string;
    is_active?: boolean;
    created_by?: number;
    created_at: string;
    updated_by?: number | null;
    updated_at?: string;
    model_name?: string;
    provider_name?: string;
    message_count?: number;
    last_message?: string | null;
}

export interface AiHistoryItem {
    id: number;
    session_id: number;
    user_query: string;
    answer: string;
    is_active?: boolean;
    created_by?: number;
    created_at: string;
    updated_by?: number | null;
    updated_at?: string;
    summarize?: string;
    is_applied?: boolean;
    isApplied?: boolean;
    applied?: boolean;
}

export interface PromptCard {
    id: string;
    title: string;
    desc: string;
    icon: 'table_groups' | 'timestamp' | 'relationships' | 'indexes' | 'learn' | 'remap';
    hasChevron?: boolean;
    prompt: string;
}

export const DEFAULT_DBNEXUS_MODEL: AiChatModel = {
    id: 21,
    provider_id: 7,
    model_name: 'dbnexus-1.0',
    provider_name: 'dbnexus AI',
    has_api_key: false
};

@Component({
    selector: 'app-ai-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ai-chat.html'
})
export class AiChatComponent implements OnInit, AfterViewChecked, OnDestroy {
    @Output() close = new EventEmitter<void>();
    @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;
    @ViewChild('messagesEnd') private messagesEnd?: ElementRef<HTMLDivElement>;
    @ViewChild('promptTextarea') private promptTextarea?: ElementRef<HTMLTextAreaElement>;

    constructor() {
        effect(() => {
            const text = this.promptText();
            if (!text) {
                this.resetTextareaHeight();
            } else {
                setTimeout(() => this.autoExpandTextarea(), 0);
            }
        });
    }

    public svc = inject(DashboardService);
    private http = inject(HttpClient);
    private appConfig = inject(AppConfigService);
    private entitlementService = inject(EntitlementService);
    private sanitizer = inject(DomSanitizer);
    private auth = inject(AuthService);
    private streamingTimer: any = null;
    private streamCompleteTimer: any = null;
    private applySnippetTimer: any = null;
    private diagramResetSub?: Subscription;
    private diffClosedSub?: Subscription;

    availableModels = signal<AiChatModel[]>([{ ...DEFAULT_DBNEXUS_MODEL }]);
    selectedModel = signal<AiChatModel | null>({ ...DEFAULT_DBNEXUS_MODEL });
    isLoadingModels = signal<boolean>(false);
    isModelDropdownOpen = signal<boolean>(false);

    // Current Session ID tracking & pagination
    currentSessionId = signal<number | null>(null);
    isLoadingSessions = signal<boolean>(false);
    isLoadingHistory = signal<boolean>(false);
    isLoadingMoreHistory = signal<boolean>(false);
    hasMoreHistory = signal<boolean>(false);
    oldestHistoryId: number | null = null;
    latestSession = signal<AiSessionItem | null>(null);
    private pendingModelIdFromSession: number | null = null;

    // API Key Pop-up Card State
    showApiKeyModal = signal<boolean>(false);
    showApiKeyText = signal<boolean>(false);
    isSavingApiKey = signal<boolean>(false);
    pendingModelForApiKey: AiChatModel | null = null;
    apiKeyInput = '';
    maxTokensInput = 4096;

    // Usage Limit Pop-up Card State (dbnexus AI default model)
    isUsagePopupOpen = signal<boolean>(false);
    usedTokens = signal<number>(0);

    // Model Switch Disclaimer State
    showModelDisclaimer = signal<boolean>(false);
    private modelDisclaimerTimer: any = null;
    tokenLimit = signal<number>(50000);
    hasRemainingQuota = signal<boolean>(true);

    sessionTitle = signal<string>(this.formatSessionTitle());
    promptText = signal<string>('');
    isThinking = signal<boolean>(false);
    messages = signal<ChatMessage[]>([]);
    copiedSnippetId = signal<string | null>(null);
    applyingSnippetMsgId = signal<string | null>(null);
    isCreatingSession = signal<boolean>(false);
    isDeletingChat = signal<boolean>(false);
    private statusTimers: any[] = [];
    thinkingStatus = signal<string>('Preparing');

    readonly promptCards: PromptCard[] = [
        {
            id: 'table_groups',
            title: 'Create Table Groups',
            desc: 'Organize your tables into logical groups by domain and functionality with distinct colors',
            icon: 'table_groups',
            prompt: 'Create logical TableGroups for my current database schema with distinct domain colors.'
        },
        {
            id: 'timestamp',
            title: 'Add Timestamp Columns',
            desc: 'Add created_at and updated_at columns to tables that need audit tracking',
            icon: 'timestamp',
            prompt: 'Add created_at and updated_at timestamp audit columns to all tables in my diagram.'
        },
        {
            id: 'relationships',
            title: 'Add Relationships',
            desc: 'Automatically detect and add foreign key relationships based on naming conventions',
            icon: 'relationships',
            prompt: 'Analyze my tables and generate foreign key references based on column naming conventions.'
        },
        {
            id: 'indexes',
            title: 'Add Indexes',
            desc: 'Add index blocks for foreign keys and commonly queried columns',
            icon: 'indexes',
            prompt: 'Suggest optimal indexes for primary keys, foreign keys, and frequently filtered fields in my schema.'
        },
        {
            id: 'learn',
            title: 'Learn Database Design',
            desc: 'Learn about database design',
            icon: 'learn',
            prompt: 'What are the key database normalization rules and best practices for relational design?'
        },
        {
            id: 'remap',
            title: 'Remap Data Types',
            desc: 'Convert data types to match your target database system',
            icon: 'remap',
            hasChevron: true,
            prompt: 'Remap my DBML column data types to match PostgreSQL standard conventions.'
        }
    ];

    private shouldScrollToBottom = false;

    ngOnInit(): void {
        if (!this.entitlementService.canUseFeature('ai_chat') || this.svc.isSampleDiagram()) {
            this.close.emit();
            this.svc.closeAiChat();
            if (!this.svc.isSampleDiagram() && !this.entitlementService.orgHasFeature('ai_chat')) {
                this.svc.showUpgradeModal('ai_chat');
            }
            return;
        }
        if (typeof window !== 'undefined') {
            localStorage.removeItem('dbnexus_ai_used_tokens');
            localStorage.removeItem('dbnexus_ai_limit');
            localStorage.removeItem('dbnexus_ai_has_quota');
        }
        this.loadModels();
        this.loadLatestSessionAndHistory();
        this.diagramResetSub = this.svc.diagramReset$.subscribe(() => {
            this.onDiagramReset();
        });
        this.diffClosedSub = this.svc.aiDiffReviewClosed.subscribe((accepted) => {
            if (!accepted) {
                this.messages.update(msgs => msgs.map(m => m.applied ? { ...m, applied: false } : m));
            }
        });
    }

    ngOnDestroy(): void {
        this.stopThinkingStatusCycle();
        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }
        if (this.streamCompleteTimer) {
            clearTimeout(this.streamCompleteTimer);
            this.streamCompleteTimer = null;
        }
        if (this.applySnippetTimer) {
            clearTimeout(this.applySnippetTimer);
            this.applySnippetTimer = null;
        }
        if (this.diagramResetSub) {
            this.diagramResetSub.unsubscribe();
        }
        if (this.diffClosedSub) {
            this.diffClosedSub.unsubscribe();
        }
        if (this.modelDisclaimerTimer) {
            clearTimeout(this.modelDisclaimerTimer);
            this.modelDisclaimerTimer = null;
        }
    }

    private onDiagramReset(): void {
        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }
        if (this.streamCompleteTimer) {
            clearTimeout(this.streamCompleteTimer);
            this.streamCompleteTimer = null;
        }
        if (this.applySnippetTimer) {
            clearTimeout(this.applySnippetTimer);
            this.applySnippetTimer = null;
        }
        this.stopThinkingStatusCycle();
        this.isThinking.set(false);
        this.applyingSnippetMsgId.set(null);
        this.svc.isDiagramLoading.set(false);

        // Reset applied state on all messages since the unaccepted AI code was discarded
        this.messages.update(msgs =>
            msgs.map(m => m.applied ? { ...m, applied: false } : m)
        );
    }

    private startThinkingStatusCycle(): void {
        this.stopThinkingStatusCycle();
        this.thinkingStatus.set('Preparing');

        const t1 = setTimeout(() => {
            if (this.isThinking() && this.thinkingStatus() === 'Preparing') {
                this.thinkingStatus.set('Thinking');
            }
        }, 1800);

        const t2 = setTimeout(() => {
            if (this.isThinking() && (this.thinkingStatus() === 'Preparing' || this.thinkingStatus() === 'Thinking')) {
                this.thinkingStatus.set('Processing');
            }
        }, 4800);

        this.statusTimers.push(t1, t2);
    }

    private stopThinkingStatusCycle(): void {
        if (this.statusTimers && this.statusTimers.length > 0) {
            this.statusTimers.forEach(t => clearTimeout(t));
            this.statusTimers = [];
        }
    }

    private getSessionHistoryUrl(sessionId: number): string {
        const template: string = this.appConfig.environment?.adminApiUrls?.aiSessionHistory ||
            this.appConfig.environment?.aiSessionHistory ||
            '';
        if (template) {
            return template
                .replace(':sessionId', String(sessionId))
                .replace('{sessionId}', String(sessionId))
                .replace('{id}', String(sessionId));
        }
        const sessionsBase: string = this.appConfig.environment?.adminApiUrls?.aiSessions ||
            this.appConfig.environment?.aiSessions ||
            '';
        return sessionsBase ? `${sessionsBase.replace(/\/+$/, '')}/${sessionId}/history` : '';
    }

    private getDeleteSessionHistoryUrl(sessionId: number | string): string {
        const template: string = this.appConfig.environment?.adminApiUrls?.deleteSessionHistory ||
            this.appConfig.environment?.deleteSessionHistory ||
            this.appConfig.environment?.adminApiUrls?.aiSessionHistory ||
            this.appConfig.environment?.aiSessionHistory ||
            '';
        if (template) {
            return template
                .replace(':sessionId', String(sessionId))
                .replace('{sessionId}', String(sessionId))
                .replace('{id}', String(sessionId));
        }
        const sessionsBase: string = this.appConfig.environment?.adminApiUrls?.aiSessions ||
            this.appConfig.environment?.aiSessions ||
            '';
        return sessionsBase ? `${sessionsBase.replace(/\/+$/, '')}/${sessionId}/history` : '';
    }

    loadLatestSessionAndHistory(): void {
        this.isLoadingSessions.set(true);
        const url = this.appConfig.environment?.adminApiUrls?.aiSessions ||
            this.appConfig.environment?.aiSessions;

        if (!url) {
            console.warn('aiSessions URL not configured');
            this.isLoadingSessions.set(false);
            return;
        }

        this.http.get<any>(`${url}?limit=155`, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isLoadingSessions.set(false);
                const sessions: AiSessionItem[] = Array.isArray(res?.data) ? res.data : [];

                if (sessions.length === 0) {
                    this.currentSessionId.set(null);
                    this.messages.set([]);
                    this.hasMoreHistory.set(false);
                    this.oldestHistoryId = null;
                    this.sessionTitle.set(this.formatSessionTitle());
                    return;
                }

                // Determine latest session (check updated_at/created_at or default to first item)
                const sortedSessions = [...sessions].sort((a, b) => {
                    const timeA = new Date(a.updated_at || a.created_at).getTime() || a.session_id;
                    const timeB = new Date(b.updated_at || b.created_at).getTime() || b.session_id;
                    return timeB - timeA;
                });
                const latest = sortedSessions[0] || sessions[0];
                this.latestSession.set(latest);

                if (latest.session_id) {
                    this.currentSessionId.set(latest.session_id);
                }
                if (latest.name) {
                    this.sessionTitle.set(latest.name);
                } else {
                    this.sessionTitle.set(this.formatSessionTitle());
                }
                if (latest.model_id) {
                    this.pendingModelIdFromSession = latest.model_id;
                    this.syncModelWithSession(latest.model_id);
                }

                // Now call the session history API for this latest session
                if (latest.session_id) {
                    this.loadSessionHistory(latest.session_id, latest);
                }
            },
            error: (err) => {
                this.isLoadingSessions.set(false);
                console.warn('Could not load AI sessions:', err);
                this.currentSessionId.set(null);
                this.messages.set([]);
                this.hasMoreHistory.set(false);
                this.oldestHistoryId = null;
                this.sessionTitle.set(this.formatSessionTitle());
            }
        });
    }

    loadSessionHistory(sessionId: number, sessionContext?: AiSessionItem): void {
        this.isLoadingHistory.set(true);
        this.hasMoreHistory.set(false);
        this.oldestHistoryId = null;

        const historyBaseUrl = this.getSessionHistoryUrl(sessionId);
        if (!historyBaseUrl) {
            console.warn('aiSessionHistory URL not configured');
            this.isLoadingHistory.set(false);
            return;
        }

        const historyUrl = `${historyBaseUrl}?limit=5`;

        this.http.get<any>(historyUrl, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isLoadingHistory.set(false);
                const historyList: AiHistoryItem[] = Array.isArray(res?.data?.history)
                    ? res.data.history
                    : (Array.isArray(res?.data) ? res.data : []);

                const meta = res?.data?.meta;
                if (meta) {
                    this.hasMoreHistory.set(!!meta.hasMore);
                    if (meta.oldestId !== undefined && meta.oldestId !== null) {
                        this.oldestHistoryId = meta.oldestId;
                    } else if (historyList.length > 0) {
                        this.oldestHistoryId = Math.min(...historyList.map(h => h.id));
                    }
                } else if (historyList.length > 0) {
                    this.oldestHistoryId = Math.min(...historyList.map(h => h.id));
                    this.hasMoreHistory.set(historyList.length >= 5);
                } else {
                    this.hasMoreHistory.set(false);
                }

                if (historyList.length === 0) {
                    this.messages.set([]);
                    return;
                }

                // Ensure chronological order (oldest first, latest last)
                const sorted = [...historyList].sort((a, b) => {
                    const timeA = new Date(a.created_at).getTime() || a.id;
                    const timeB = new Date(b.created_at).getTime() || b.id;
                    return timeA - timeB;
                });

                const chatMessages: ChatMessage[] = [];

                sorted.forEach((item) => {
                    // 1. User Message
                    if (item.user_query) {
                        chatMessages.push({
                            id: `hist-user-${item.id}`,
                            historyId: item.id,
                            sessionId: item.session_id ? Number(item.session_id) : (this.currentSessionId() ?? undefined),
                            sender: 'user',
                            text: item.user_query,
                            timestamp: item.created_at ? new Date(item.created_at) : new Date()
                        });
                    }

                    // 2. Assistant Message
                    if (item.answer) {
                        const parsed = this.parseAnswer(item.answer);
                        const validSnippet = (parsed.dbmlQuery && this.isDbmlCode(parsed.dbmlQuery)) ? parsed.dbmlQuery : undefined;
                        chatMessages.push({
                            id: `hist-asst-${item.id}`,
                            historyId: item.id,
                            sessionId: item.session_id ? Number(item.session_id) : (this.currentSessionId() ?? undefined),
                            sender: 'assistant',
                            text: parsed.displayText,
                            codeSnippet: validSnippet,
                            modelName: sessionContext?.model_name || this.selectedModel()?.model_name,
                            providerName: sessionContext?.provider_name || this.selectedModel()?.provider_name,
                            summarize: item.summarize || undefined,
                            timestamp: item.updated_at ? new Date(item.updated_at) : (item.created_at ? new Date(item.created_at) : new Date()),
                            applied: item.is_applied === true || item.isApplied === true || item.applied === true
                        });
                    }
                });

                this.messages.set(chatMessages);
                this.shouldScrollToBottom = true;
            },
            error: (err) => {
                this.isLoadingHistory.set(false);
                this.hasMoreHistory.set(false);
                this.oldestHistoryId = null;
                if (err?.status === 403) {
                    const msg = err?.error?.message || 'You do not have access to this chat session history';
                    this.svc.showToast(msg, 3500, 'error');
                    this.startNewChat();
                } else if (err?.status === 404) {
                    const msg = err?.error?.message || 'Chat session not found';
                    console.warn(msg);
                    this.startNewChat();
                } else {
                    console.warn('Could not load chat history:', err);
                    this.messages.set([]);
                }
            }
        });
    }

    onChatScroll(event: Event): void {
        const el = event.target as HTMLElement;
        if (!el) return;

        // When user scrolls near top (within 40px), fetch older messages
        if (el.scrollTop <= 40 && this.hasMoreHistory() && !this.isLoadingMoreHistory() && !this.isLoadingHistory()) {
            this.loadMoreHistory();
        }
    }

    loadMoreHistory(): void {
        const sessionId = this.currentSessionId();
        if (this.isLoadingMoreHistory() || !this.hasMoreHistory() || this.oldestHistoryId === null || !sessionId) {
            return;
        }

        this.isLoadingMoreHistory.set(true);
        const container = this.messagesContainer?.nativeElement;
        const prevScrollHeight = container ? container.scrollHeight : 0;
        const prevScrollTop = container ? container.scrollTop : 0;

        const historyBaseUrl = this.getSessionHistoryUrl(sessionId);
        if (!historyBaseUrl) {
            this.isLoadingMoreHistory.set(false);
            return;
        }

        const historyUrl = `${historyBaseUrl}?beforeId=${this.oldestHistoryId}&limit=5`;

        this.http.get<any>(historyUrl, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isLoadingMoreHistory.set(false);
                const historyList: AiHistoryItem[] = Array.isArray(res?.data?.history)
                    ? res.data.history
                    : (Array.isArray(res?.data) ? res.data : []);

                const meta = res?.data?.meta;
                if (meta) {
                    this.hasMoreHistory.set(!!meta.hasMore);
                    if (meta.oldestId !== undefined && meta.oldestId !== null) {
                        this.oldestHistoryId = meta.oldestId;
                    } else if (historyList.length > 0) {
                        this.oldestHistoryId = Math.min(...historyList.map(h => h.id));
                    }
                } else if (historyList.length > 0) {
                    this.oldestHistoryId = Math.min(...historyList.map(h => h.id));
                    this.hasMoreHistory.set(historyList.length >= 5);
                } else {
                    this.hasMoreHistory.set(false);
                }

                if (historyList.length === 0) {
                    return;
                }

                // Sort older messages chronologically
                const sorted = [...historyList].sort((a, b) => {
                    const timeA = new Date(a.created_at).getTime() || a.id;
                    const timeB = new Date(b.created_at).getTime() || b.id;
                    return timeA - timeB;
                });

                const olderMessages: ChatMessage[] = [];
                const sessionContext = this.latestSession();

                sorted.forEach((item) => {
                    // 1. User Message
                    if (item.user_query) {
                        olderMessages.push({
                            id: `hist-user-${item.id}`,
                            historyId: item.id,
                            sessionId: item.session_id ? Number(item.session_id) : (this.currentSessionId() ?? undefined),
                            sender: 'user',
                            text: item.user_query,
                            timestamp: item.created_at ? new Date(item.created_at) : new Date()
                        });
                    }

                    // 2. Assistant Message
                    if (item.answer) {
                        const parsed = this.parseAnswer(item.answer);
                        const validSnippet = (parsed.dbmlQuery && this.isDbmlCode(parsed.dbmlQuery)) ? parsed.dbmlQuery : undefined;
                        olderMessages.push({
                            id: `hist-asst-${item.id}`,
                            historyId: item.id,
                            sessionId: item.session_id ? Number(item.session_id) : (this.currentSessionId() ?? undefined),
                            sender: 'assistant',
                            text: parsed.displayText,
                            codeSnippet: validSnippet,
                            modelName: sessionContext?.model_name || this.selectedModel()?.model_name,
                            providerName: sessionContext?.provider_name || this.selectedModel()?.provider_name,
                            summarize: item.summarize || undefined,
                            timestamp: item.updated_at ? new Date(item.updated_at) : (item.created_at ? new Date(item.created_at) : new Date()),
                            applied: item.is_applied === true || item.isApplied === true || item.applied === true
                        });
                    }
                });

                // Prepend older messages
                this.messages.update(prev => [...olderMessages, ...prev]);

                // Maintain scroll position seamlessly
                setTimeout(() => {
                    if (container) {
                        const newScrollHeight = container.scrollHeight;
                        container.scrollTop = (newScrollHeight - prevScrollHeight) + prevScrollTop;
                    }
                }, 0);
            },
            error: (err) => {
                this.isLoadingMoreHistory.set(false);
                console.warn('Could not load older chat history:', err);
            }
        });
    }

    isDbmlCode(code: string | null | undefined): boolean {
        if (!code) return false;
        const trimmed = code.trim();
        if (!trimmed) return false;

        const lower = trimmed.toLowerCase();
        if (
            lower.startsWith('no existing dbml') ||
            lower.startsWith('no dbml') ||
            lower.startsWith('no schema') ||
            lower === 'none' ||
            lower === 'none.' ||
            lower === 'n/a' ||
            lower === 'null' ||
            lower === 'undefined' ||
            lower === 'no response generated'
        ) {
            return false;
        }

        // Must contain at least one valid DBML declaration: Table, TableGroup, Enum, Project, or Ref
        const dbmlStructureRegex = /\b(?:Table(?:Group)?|Enum|Project)\s+(?:["'`\[]?[\w_.]+(?:["'`\]])?)\s*[\s\S]*?\{|\bRef(?:\s*[\w_.]+)?\s*:\s*[\w_.]+\s*[><-]\s*[\w_.]+|\bRef\s*\{/i;
        return dbmlStructureRegex.test(trimmed);
    }

    formatAiErrorMessage(err: any): string {
        let raw = '';
        if (typeof err === 'string') {
            raw = err;
        } else if (typeof err?.error === 'string') {
            try {
                const parsed = JSON.parse(err.error);
                raw = parsed?.message || parsed?.error || err.error;
            } catch {
                raw = err.error;
            }
        } else {
            raw = err?.error?.message || err?.error?.error || err?.message || '';
        }
        raw = (raw || '').trim();

        const statusCode = err?.error?.statusCode || err?.statusCode || err?.status;

        if (
            /rate limit or quota was exceeded/i.test(raw) ||
            /Provider HTTP 429/i.test(raw) ||
            /Rate limit reached for model/i.test(raw) ||
            (statusCode === 502 && (/rate limit/i.test(raw) || /quota/i.test(raw) || /429/i.test(raw)))
        ) {
            return 'The provider rate limit or quota was exceeded. Try again later or check your quota.';
        }
        return raw || 'Failed to process message with AI model.';
    }

    isAiErrorContent(text: string | null | undefined): boolean {
        if (!text) return false;
        const lower = text.trim().toLowerCase();
        return lower.includes('rate limit or quota was exceeded') ||
            lower.includes('provider http 429') ||
            lower.includes('rate limit reached for model') ||
            lower.includes('failed to process message with ai model') ||
            lower.includes('internal server error') ||
            lower.includes('bad gateway') ||
            lower.includes('invalid api key') ||
            lower.startsWith('error:');
    }

    cleanDisplayText(text: string | null | undefined): string {
        if (!text) return '';
        if (/rate limit or quota was exceeded/i.test(text) || /Provider HTTP 429/i.test(text) || /Rate limit reached for model/i.test(text)) {
            return 'The provider rate limit or quota was exceeded. Try again later or check your quota.';
        }
        // If text starts with "No existing DBML." or similar non-code preamble, strip it if there is further description
        const stripped = text.replace(/^No existing DBML\.?\s*/i, '').trim();
        return stripped || text.trim();
    }

    private parseAnswer(answer: string): { displayText: string; dbmlQuery?: string } {
        if (!answer) return { displayText: '' };
        const trimmed = answer.trim();

        if (trimmed.toLowerCase() === 'no response generated') {
            return { displayText: trimmed };
        }

        // 1. Markdown code block
        const codeBlockRegex = /```(?:dbml|sql)?\s*([\s\S]*?)```/i;
        const codeMatch = trimmed.match(codeBlockRegex);
        if (codeMatch) {
            const rawCode = codeMatch[1].trim();
            if (this.isDbmlCode(rawCode)) {
                const rawDisplay = trimmed.replace(codeMatch[0], '').trim();
                const displayText = this.cleanDisplayText(rawDisplay);
                return {
                    displayText: displayText || 'Here is the database schema:',
                    dbmlQuery: rawCode
                };
            }
        }

        // 2. Raw DBML blocks (Table/TableGroup/Enum/Project/Ref definitions)
        const fullDbmlRegex = /((?:(?:Table(?:Group)?|Enum|Project)\s+[\w_.]+\s*(?:\[[^\]]*\])?\s*\{[\s\S]*?\}|Ref:\s*[\w_.]+\s*[><-]\s*[\w_.]+)(?:\s*(?:(?:Table(?:Group)?|Enum|Project)\s+[\w_.]+\s*(?:\[[^\]]*\])?\s*\{[\s\S]*?\}|Ref:\s*[\w_.]+\s*[><-]\s*[\w_.]+))*)/i;
        const dbmlMatch = trimmed.match(fullDbmlRegex);
        if (dbmlMatch) {
            const rawCode = dbmlMatch[0].trim();
            if (this.isDbmlCode(rawCode)) {
                const rawDisplay = trimmed.replace(dbmlMatch[0], '').trim();
                const displayText = this.cleanDisplayText(rawDisplay);
                return {
                    displayText: displayText || 'Here is the database schema:',
                    dbmlQuery: rawCode
                };
            }
        }

        return { displayText: this.cleanDisplayText(trimmed) };
    }

    isNoApiKeyRequired(model: AiChatModel | null | undefined): boolean {
        if (!model) return false;
        return Number(model.id) === 21 ||
            (model.model_name?.toLowerCase() === 'dbnexus-1.0') ||
            (model.provider_name?.toLowerCase() === 'dbnexus ai');
    }

    /**
     * Checks if the user has provided or configured an API key for the model.
     * Note: dbnexus AI returns false here because it does not require/have a user API key.
     */
    hasUserApiKey(model: AiChatModel | null | undefined): boolean {
        if (!model) return false;
        if (this.isNoApiKeyRequired(model)) return false;
        if (model.api_key === null) return false;
        return !!(
            model.has_api_key === true ||
            (typeof model.has_api_key === 'string' && model.has_api_key === 'true') ||
            (model.api_key && typeof model.api_key === 'string' && model.api_key.trim().length > 0) ||
            this.getSavedApiKey(model)
        );
    }

    /**
     * Checks if the model is ready to be used (either dbnexus AI or has a valid user API key).
     */
    hasValidApiKey(model: AiChatModel | null | undefined): boolean {
        if (!model) return false;
        if (this.isNoApiKeyRequired(model)) return true;
        return this.hasUserApiKey(model);
    }

    /**
     * Determines which model should be automatically selected:
     * - If the user has an API key for any model, that model is selected automatically.
     * - If the user has no API key for any model, dbnexus AI is selected as default.
     */
    getAutoSelectedModel(models: AiChatModel[], preferredModelId?: number | string | null): AiChatModel {
        const dbnexusModel = models.find(m => this.isNoApiKeyRequired(m)) || { ...DEFAULT_DBNEXUS_MODEL };
        const modelsWithApiKey = models.filter(m => this.hasUserApiKey(m));

        if (modelsWithApiKey.length > 0) {
            // 1. If preferredModelId is among modelsWithApiKey, use it
            if (preferredModelId !== undefined && preferredModelId !== null) {
                const matchedPreferred = modelsWithApiKey.find(m => String(m.id) === String(preferredModelId));
                if (matchedPreferred) return matchedPreferred;
            }

            // 2. If user previously selected a model that has an API key, keep it
            const savedId = localStorage.getItem('ai_selected_model_id');
            if (savedId) {
                const savedMatch = modelsWithApiKey.find(m => String(m.id) === savedId);
                if (savedMatch) return savedMatch;
            }

            // 3. Otherwise, automatically select the first model that has an API key
            return modelsWithApiKey[0];
        }

        // If the user has no API key for any model, dbnexus AI is the default
        return dbnexusModel;
    }

    private syncModelWithSession(modelId: number): void {
        const models = this.availableModels();
        if (models.length > 0 && !this.isLoadingModels()) {
            const matched = models.find(m => Number(m.id) === Number(modelId));
            if (matched && this.hasUserApiKey(matched)) {
                this.selectedModel.set(matched);
                localStorage.setItem('ai_selected_model_id', String(matched.id));
            } else {
                const modelToSelect = this.getAutoSelectedModel(models);
                this.selectedModel.set(modelToSelect);
                localStorage.setItem('ai_selected_model_id', String(modelToSelect.id));
            }
            this.pendingModelIdFromSession = null;
        }
    }

    loadModels(): void {
        this.isLoadingModels.set(true);
        const url = this.appConfig.environment?.adminApiUrls?.aiChatModels ||
            this.appConfig.environment?.aiChatModels;

        if (!url) {
            console.warn('aiChatModels URL not configured');
            this.isLoadingModels.set(false);
            const defaultModel: AiChatModel = { ...DEFAULT_DBNEXUS_MODEL };
            this.availableModels.set([defaultModel]);
            this.selectedModel.set(defaultModel);
            return;
        }

        this.http.get<any>(url, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isLoadingModels.set(false);
                let data: AiChatModel[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

                // Ensure dbnexus AI model is included in availableModels
                const defaultModelIdx = data.findIndex(m => Number(m.id) === 21 || m.model_name?.toLowerCase() === 'dbnexus-1.0');
                if (defaultModelIdx === -1) {
                    data = [{ ...DEFAULT_DBNEXUS_MODEL }, ...data];
                }

                // Restore any locally stored API keys if not returned by server
                data.forEach(m => {
                    if (this.isNoApiKeyRequired(m)) {
                        if (m.max_tokens && typeof m.max_tokens === 'number' && m.max_tokens > 0) {
                            this.tokenLimit.set(m.max_tokens);
                        }
                        this.updateUsageFromApiResponse(m);
                        return;
                    }
                    if (m.api_key === null) {
                        m.has_api_key = false;
                        return;
                    }
                    const savedKey = this.getSavedApiKey(m);
                    const isConfiguredOnServer = !!(m.has_api_key || (m.api_key && m.api_key.trim().length > 0) || (m as any).is_configured || (m as any).has_config);
                    if (!m.api_key && savedKey) {
                        m.api_key = savedKey;
                        m.has_api_key = true;
                    } else if (isConfiguredOnServer) {
                        m.has_api_key = true;
                    }
                });

                this.availableModels.set(data);

                // Auto-select:
                // If user has an API key for a model, select that model automatically.
                // If user has no API key for any model, select dbnexus AI as default.
                const modelToSelect = this.getAutoSelectedModel(data, this.pendingModelIdFromSession);
                this.selectedModel.set(modelToSelect);
                localStorage.setItem('ai_selected_model_id', String(modelToSelect.id));
                this.pendingModelIdFromSession = null;
            },
            error: (err) => {
                console.error('Failed to load AI models from API:', err);
                this.isLoadingModels.set(false);
                const defaultModel: AiChatModel = { ...DEFAULT_DBNEXUS_MODEL };
                this.availableModels.set([defaultModel]);
                this.selectedModel.set(defaultModel);
            }
        });
    }

    private getModelConfigUrl(modelId: number | string): string {
        const template: string = this.appConfig.environment?.adminApiUrls?.aiModelConfig ||
            this.appConfig.environment?.aiModelConfig ||
            '';

        if (!template) return '';

        return template
            .replace(':modelId', String(modelId))
            .replace('{modelId}', String(modelId))
            .replace('{id}', String(modelId));
    }

    private getSavedApiKey(model: AiChatModel): string | null {
        return localStorage.getItem(`ai_key_${model.id}`);
    }

    private storeApiKey(model: AiChatModel, key: string): void {
        localStorage.setItem(`ai_key_${model.id}`, key);
    }

    triggerModelDisclaimer(showToast = true): void {
        this.showModelDisclaimer.set(true);
        if (this.modelDisclaimerTimer) {
            clearTimeout(this.modelDisclaimerTimer);
        }
        this.modelDisclaimerTimer = setTimeout(() => {
            this.showModelDisclaimer.set(false);
            this.modelDisclaimerTimer = null;
        }, 8000);

        // if (showToast) {
        //     this.svc.showToast('Warning: Changing the model may affect response accuracy and token consumption.', 4000, 'info');
        // }
    }

    dismissModelDisclaimer(): void {
        if (this.modelDisclaimerTimer) {
            clearTimeout(this.modelDisclaimerTimer);
            this.modelDisclaimerTimer = null;
        }
        this.showModelDisclaimer.set(false);
    }

    onModelSelect(model: AiChatModel, event?: Event): void {
        if (event) event.stopPropagation();
        this.isModelDropdownOpen.set(false);

        const current = this.selectedModel();
        const isDifferentModel = !!current && String(current.id) !== String(model.id);

        if (this.isNoApiKeyRequired(model)) {
            this.selectedModel.set(model);
            localStorage.setItem('ai_selected_model_id', String(model.id));
            if (isDifferentModel) {
                this.triggerModelDisclaimer();
            }
            return;
        }

        if (!this.hasValidApiKey(model)) {
            this.openApiKeyModal(model);
        } else {
            this.selectedModel.set(model);
            localStorage.setItem('ai_selected_model_id', String(model.id));
            if (isDifferentModel) {
                this.triggerModelDisclaimer();
            }
        }
    }

    openApiKeyModal(model: AiChatModel, event?: Event): void {
        if (event) event.stopPropagation();
        if (this.isNoApiKeyRequired(model)) {
            this.svc.showToast('dbnexus AI does not require an API key', 2500, 'info');
            return;
        }
        const isEditingApiKey = this.hasUserApiKey(model);
        this.pendingModelForApiKey = model;
        this.apiKeyInput = isEditingApiKey ? '' : (model.api_key || this.getSavedApiKey(model) || '');
        this.maxTokensInput = model.max_tokens || 4096;
        this.showApiKeyText.set(false);
        this.showApiKeyModal.set(true);

        // Check if existing config is present on server if not present locally
        if (!isEditingApiKey && !this.apiKeyInput) {
            const url = this.getModelConfigUrl(model.id);
            if (url) {
                this.http.get<any>(url, { withCredentials: true }).subscribe({
                    next: (res) => {
                        const cfg = res?.data || res;
                        if (cfg) {
                            if (cfg.api_key && !this.apiKeyInput) {
                                this.apiKeyInput = cfg.api_key;
                                model.api_key = cfg.api_key;
                                model.has_api_key = true;
                            }
                            if (cfg.max_tokens) {
                                this.maxTokensInput = cfg.max_tokens;
                                model.max_tokens = cfg.max_tokens;
                            }
                        }
                    },
                    error: () => {
                        // Silently ignore if not configured yet
                    }
                });
            }
        }
    }

    closeApiKeyModal(): void {
        if (this.isSavingApiKey()) return;
        this.showApiKeyModal.set(false);
        this.pendingModelForApiKey = null;
        this.apiKeyInput = '';

        // If currently selected model has no valid API key, revert to best available model
        const current = this.selectedModel();
        if (!this.hasValidApiKey(current)) {
            const bestModel = this.getAutoSelectedModel(this.availableModels());
            this.selectedModel.set(bestModel);
            localStorage.setItem('ai_selected_model_id', String(bestModel.id));
        }
    }

    toggleShowApiKeyText(): void {
        this.showApiKeyText.set(!this.showApiKeyText());
    }

    saveApiKey(): void {
        const key = this.apiKeyInput.trim();
        if (!key || !this.pendingModelForApiKey || this.isSavingApiKey()) return;

        const model = this.pendingModelForApiKey;
        const modelId = model.id;
        this.isSavingApiKey.set(true);

        const payload = {
            api_key: key,
            max_tokens: Number(this.maxTokensInput) || 4096,
            is_active: true
        };

        const url = this.getModelConfigUrl(modelId);
        if (!url) {
            this.isSavingApiKey.set(false);
            this.svc.showToast('AI Model Config endpoint not configured', 3000, 'error');
            return;
        }

        const applySuccess = (res?: any) => {
            this.isSavingApiKey.set(false);
            model.api_key = key;
            model.has_api_key = true;
            model.max_tokens = payload.max_tokens;

            // Only this model's API response should reflect the configured key.
            this.availableModels.update(models =>
                models.map(m => {
                    if (String(m.id) === String(model.id)) {
                        return { ...m, api_key: key, has_api_key: true, max_tokens: payload.max_tokens };
                    }
                    return m;
                })
            );

            const prev = this.selectedModel();
            const isDifferentModel = !!prev && String(prev.id) !== String(model.id);

            this.storeApiKey(model, key);
            this.selectedModel.set(model);
            localStorage.setItem('ai_selected_model_id', String(model.id));

            const successMsg = res?.message || `API key configured for ${model.provider_name}`;
            this.svc.showToast(successMsg, 2500, 'success');
            this.closeApiKeyModal();

            if (isDifferentModel) {
                this.triggerModelDisclaimer(false);
            }
        };

        const applyError = (err: any) => {
            this.isSavingApiKey.set(false);
            console.error('Failed to configure model API key:', err);
            const errMsg = this.formatAiErrorMessage(err);
            this.svc.showToast(errMsg, 3500, 'error');
        };

        this.http.put<any>(url, payload, { withCredentials: true }).subscribe({
            next: (res) => applySuccess(res),
            error: (err) => {
                if (err?.status === 404 || err?.status === 405) {
                    // Fallback to POST in case environment route expects POST
                    this.http.post<any>(url, payload, { withCredentials: true }).subscribe({
                        next: (res) => applySuccess(res),
                        error: (postErr) => applyError(postErr)
                    });
                } else {
                    applyError(err);
                }
            }
        });
    }

    getApiKeyPlaceholder(provider?: string): string {
        const p = (provider || '').toUpperCase();
        if (p === 'CLAUDE' || p === 'ANTHROPIC') return 'sk-ant-api03-...';
        if (p === 'OPENAI') return 'sk-proj-...';
        if (p === 'GEMINI') return 'AIzaSy...';
        if (p === 'GROQ') return 'gsk_...';
        return 'Enter your API key...';
    }

    ngAfterViewChecked(): void {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }

    formatSessionTitle(): string {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US');
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${dateStr}, ${timeStr}`;
    }

    selectCard(card: PromptCard): void {
        if (this.svc.aiDiffReviewActive()) {
            this.svc.showToast('Please accept or reject the applied code before giving the next prompt.', 3000, 'info');
            return;
        }
        this.promptText.set(card.prompt);
        this.sendMessage();
    }

    autoExpandTextarea(): void {
        const el = this.promptTextarea?.nativeElement;
        if (!el) return;
        // Temporarily reset height to auto to calculate accurate scrollHeight
        el.style.height = 'auto';
        const minHeight = 36;
        const maxHeight = 120; // Limit: up to ~6 lines of text as shown in screenshot; scroll when exceeding
        const contentHeight = el.scrollHeight;
        if (contentHeight > maxHeight) {
            el.style.height = `${maxHeight}px`;
            el.style.overflowY = 'auto';
        } else {
            el.style.height = `${Math.max(minHeight, contentHeight)}px`;
            el.style.overflowY = 'hidden';
        }
    }

    resetTextareaHeight(): void {
        const el = this.promptTextarea?.nativeElement;
        if (!el) return;
        el.style.height = '36px';
        el.style.overflowY = 'hidden';
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        if (this.promptText()) {
            this.autoExpandTextarea();
        }
    }

    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (this.svc.aiDiffReviewActive()) {
                this.svc.showToast('Please accept or reject the applied code before giving the next prompt.', 3000, 'info');
                return;
            }
            this.sendMessage();
        }
    }

    onSendClick(): void {
        if (this.svc.aiDiffReviewActive()) {
            this.svc.showToast('Please accept or reject the applied code before giving the next prompt.', 3000, 'info');
            return;
        }
        if (this.isSendDisabled()) {
            return;
        }
        this.sendMessage();
    }

    isSendDisabled(): boolean {
        return !this.promptText().trim() ||
            this.isThinking() ||
            this.svc.aiDiffReviewActive() ||
            (this.isNoApiKeyRequired(this.selectedModel()) && (!this.hasRemainingQuota() || (this.getMaxTokens() > 0 && this.usedTokens() >= this.getMaxTokens())));
    }

    sendMessage(): void {
        if (this.svc.aiDiffReviewActive()) {
            this.svc.showToast('Please accept or reject the applied code before giving the next prompt.', 3000, 'info');
            return;
        }
        if (!this.entitlementService.canUseFeature('ai_chat')) {
            if (!this.entitlementService.orgHasFeature('ai_chat')) {
                this.svc.showUpgradeModal('ai_chat');
            }
            return;
        }
        const text = this.promptText().trim();
        if (!text || this.isThinking()) return;
        this.dismissModelDisclaimer();
        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }

        let currentModel = this.selectedModel();
        if (!currentModel) {
            currentModel = this.getAutoSelectedModel(this.availableModels());
            this.selectedModel.set(currentModel);
            localStorage.setItem('ai_selected_model_id', String(currentModel.id));
        }

        if (!this.hasValidApiKey(currentModel)) {
            const bestModel = this.getAutoSelectedModel(this.availableModels());
            currentModel = bestModel;
            this.selectedModel.set(bestModel);
            localStorage.setItem('ai_selected_model_id', String(bestModel.id));
            if (this.isNoApiKeyRequired(bestModel)) {
                this.svc.showToast('Using dbnexus AI (no API key required)', 2500, 'info');
            }
        }

        if (this.isNoApiKeyRequired(currentModel) && (!this.hasRemainingQuota() || (this.getMaxTokens() > 0 && this.usedTokens() >= this.getMaxTokens()))) {
            this.svc.showToast('Monthly token usage limit reached for dbnexus AI. Please switch to another model or configure an API key.', 4000, 'error');
            return;
        }

        const userMsg: ChatMessage = {
            id: 'msg-' + Date.now(),
            sender: 'user',
            text,
            timestamp: new Date()
        };

        this.messages.update(prev => [...prev, userMsg]);
        this.promptText.set('');
        this.resetTextareaHeight();
        this.isThinking.set(true);
        this.shouldScrollToBottom = true;
        this.scrollToBottom();
        requestAnimationFrame(() => this.scrollToBottom());

        const payload: { message: string; modelId: number; sessionId?: number; diagramId?: number } = {
            message: text,
            modelId: Number(currentModel.id)
        };

        if (this.currentSessionId() !== null && this.currentSessionId() !== undefined) {
            payload.sessionId = this.currentSessionId()!;
        }

        // Attach DBML / Diagram ID if available
        let activeDiagramId = this.svc.diagramId();
        if ((activeDiagramId === null || activeDiagramId === undefined || isNaN(Number(activeDiagramId))) && typeof window !== 'undefined') {
            const storedId = localStorage.getItem('active_diagram_id');
            if (storedId && !isNaN(Number(storedId))) {
                activeDiagramId = Number(storedId);
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                const queryId = urlParams.get('id');
                if (queryId && !isNaN(Number(queryId))) {
                    activeDiagramId = Number(queryId);
                }
            }
        }

        if (activeDiagramId && !isNaN(Number(activeDiagramId)) && Number(activeDiagramId) > 0) {
            payload.diagramId = Number(activeDiagramId);
        }

        const url = this.appConfig.environment?.adminApiUrls?.aiChat ||
            this.appConfig.environment?.aiChat;

        if (!url) {
            this.svc.showToast('AI Chat endpoint not configured', 3000, 'error');
            this.isThinking.set(false);
            this.stopThinkingStatusCycle();
            this.messages.update(prev => prev.filter(m => m.id !== userMsg.id));
            if (!this.promptText()) {
                this.promptText.set(text);
                setTimeout(() => this.autoExpandTextarea(), 0);
            }
            return;
        }
        //replaced code

        this.startThinkingStatusCycle();

        const token = this.auth.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch(url, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ ...payload, stream: true })
        }).then(async (response) => {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream') && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    const parts = buffer.split(/\r?\n\r?\n/);
                    buffer = parts.pop() || '';

                    for (const part of parts) {
                        if (!part.trim()) continue;
                        let eventType = 'message';
                        let dataStr = '';

                        for (const line of part.split(/\r?\n/)) {
                            if (line.startsWith('event:')) {
                                eventType = line.slice(6).trim();
                            } else if (line.startsWith('data:')) {
                                dataStr = line.slice(5).trim();
                            }
                        }

                        if (!dataStr) continue;

                        try {
                            const parsedData = JSON.parse(dataStr);
                            if (eventType === 'status') {
                                if (parsedData.status) {
                                    this.thinkingStatus.set(parsedData.status);
                                }
                            } else if (eventType === 'complete') {
                                this.isThinking.set(false);
                                this.stopThinkingStatusCycle();
                                this.handleChatSuccessResponse(parsedData, userMsg, currentModel);
                            } else if (eventType === 'error') {
                                this.isThinking.set(false);
                                this.stopThinkingStatusCycle();
                                this.handleChatErrorResponse(parsedData, currentModel, userMsg);
                            }
                        } catch (e) {
                            console.warn('Error parsing SSE event chunk:', e);
                        }
                    }
                }
            } else {
                let parsedJson: any = null;
                try {
                    parsedJson = await response.json();
                } catch {
                    parsedJson = { statusCode: response.status, message: response.statusText };
                }
                this.isThinking.set(false);
                this.stopThinkingStatusCycle();

                if (!response.ok) {
                    this.handleChatErrorResponse(parsedJson, currentModel, userMsg);
                } else {
                    this.handleChatSuccessResponse(parsedJson, userMsg, currentModel);
                }
            }
        }).catch((err) => {
            this.isThinking.set(false);
            this.stopThinkingStatusCycle();
            this.handleChatErrorResponse(err, currentModel, userMsg);
        });
    }

    private handleChatSuccessResponse(res: any, userMsg: ChatMessage, currentModel: AiChatModel): void {
        const isHttpError = !res ||
            (typeof res.statusCode === 'number' && res.statusCode >= 400) ||
            (typeof res.status === 'number' && res.status >= 400) ||
            res.success === false;

        if (isHttpError && !res?.data) {
            this.handleChatErrorResponse(res, currentModel, userMsg);
            return;
        }

        // Check if the response body contains an error message rather than a valid answer
        const rawContent = res?.data?.answer || res?.data?.explanation || res?.message || '';
        if (!res?.data?.dbml_query && this.isAiErrorContent(rawContent)) {
            this.handleChatErrorResponse(rawContent || res, currentModel, userMsg);
            return;
        }

        if (res && res.data) {
            const data = res.data;

            if (data.sessionId !== undefined && data.sessionId !== null) {
                this.currentSessionId.set(Number(data.sessionId));
                this.svc.latestAiChatSessionId.set(Number(data.sessionId));
            }
            if (data.sessionName) {
                this.sessionTitle.set(data.sessionName);
            }
            if (data.messageId) {
                this.svc.latestAiChatMessageId.set(Number(data.messageId));
            }

            // Extract display explanation or answer
            let displayText = data.explanation ? this.cleanDisplayText(data.explanation) : '';
            let dbmlQuery = data.dbml_query || '';

            // If dbmlQuery is not valid DBML (e.g. "No existing DBML."), discard it
            if (dbmlQuery && !this.isDbmlCode(dbmlQuery)) {
                dbmlQuery = '';
            }

            if (!displayText && data.answer) {
                if (dbmlQuery && data.answer.includes(dbmlQuery)) {
                    displayText = this.cleanDisplayText(data.answer.replace(dbmlQuery, '').trim());
                } else {
                    const parsed = this.parseAnswer(data.answer);
                    displayText = parsed.displayText;
                    if (parsed.dbmlQuery && !dbmlQuery && this.isDbmlCode(parsed.dbmlQuery)) {
                        dbmlQuery = parsed.dbmlQuery;
                    }
                }
            }

            if (!dbmlQuery && data.answer) {
                const parsed = this.parseAnswer(data.answer);
                if (parsed.dbmlQuery && this.isDbmlCode(parsed.dbmlQuery)) {
                    dbmlQuery = parsed.dbmlQuery;
                    if (!displayText) {
                        displayText = parsed.displayText;
                    }
                }
            }

            if (!dbmlQuery && displayText) {
                const parsed = this.parseAnswer(displayText);
                if (parsed.dbmlQuery && this.isDbmlCode(parsed.dbmlQuery)) {
                    dbmlQuery = parsed.dbmlQuery;
                    displayText = parsed.displayText || displayText;
                }
            }

            if (dbmlQuery && !this.isDbmlCode(dbmlQuery)) {
                dbmlQuery = '';
            }

            if (displayText) {
                displayText = this.cleanDisplayText(displayText);
            }

            if (!displayText) {
                displayText = res.message || 'Processed successfully';
            }

            const trimmedDbml = dbmlQuery ? dbmlQuery.trim() : undefined;
            const hasSnippet = !!trimmedDbml;
            const histId = data.messageId ? Number(data.messageId) : undefined;
            const sessId = (data.sessionId !== undefined && data.sessionId !== null)
                ? Number(data.sessionId)
                : (this.currentSessionId() ?? undefined);

            // Associate the user's preceding message with this historyId and sessionId
            if (histId) {
                this.messages.update(prev => prev.map(m => m.id === userMsg.id ? { ...m, historyId: histId, sessionId: sessId } : m));
            }

            const assistantMsg: ChatMessage = {
                id: 'msg-' + (data.messageId || Date.now()),
                historyId: histId,
                sessionId: sessId,
                sender: 'assistant',
                text: displayText,
                codeSnippet: trimmedDbml,
                displayCodeSnippet: hasSnippet ? '' : undefined,
                displayText: '',
                isStreaming: true,
                streamingStage: hasSnippet ? 'code' : 'text',
                modelName: data.modelName || currentModel.model_name,
                providerName: data.providerName || currentModel.provider_name,
                summarize: data.summarize || undefined,
                timestamp: data.createdAt ? new Date(data.createdAt) : new Date(),
                applied: false
            };

            this.messages.update(prev => [...prev, assistantMsg]);

            // Stream line by line like ChatGPT
            // Query will be applied ONLY AFTER the chat response has completely displayed
            this.streamMessageLineByLine(assistantMsg, displayText, trimmedDbml, () => {
                if (assistantMsg.codeSnippet && !assistantMsg.applied && this.isDbmlCode(assistantMsg.codeSnippet)) {
                    this.applySnippet(assistantMsg, true);
                }
            });
        } else {
            let fallbackSnippet: string | undefined;
            let fallbackText = res?.message || 'Response received.';
            if (res?.message) {
                const parsed = this.parseAnswer(res.message);
                if (parsed.dbmlQuery && this.isDbmlCode(parsed.dbmlQuery)) {
                    fallbackSnippet = parsed.dbmlQuery;
                    fallbackText = parsed.displayText || fallbackText;
                } else {
                    fallbackText = parsed.displayText || fallbackText;
                }
            }

            if (fallbackText) {
                fallbackText = this.cleanDisplayText(fallbackText);
            }

            const trimmedFallbackSnippet = (fallbackSnippet && this.isDbmlCode(fallbackSnippet)) ? fallbackSnippet.trim() : undefined;
            const hasFallbackSnippet = !!trimmedFallbackSnippet;
            const fallbackMsg: ChatMessage = {
                id: 'msg-' + Date.now(),
                sender: 'assistant',
                text: fallbackText,
                codeSnippet: trimmedFallbackSnippet,
                displayCodeSnippet: hasFallbackSnippet ? '' : undefined,
                displayText: '',
                isStreaming: true,
                streamingStage: hasFallbackSnippet ? 'code' : 'text',
                modelName: currentModel.model_name,
                timestamp: new Date(),
                applied: false
            };

            this.messages.update(prev => [...prev, fallbackMsg]);

            // Stream line by line like ChatGPT
            // Query will be applied ONLY AFTER the chat response has completely displayed
            this.streamMessageLineByLine(fallbackMsg, fallbackText, trimmedFallbackSnippet, () => {
                if (fallbackMsg.codeSnippet && !fallbackMsg.applied && this.isDbmlCode(fallbackMsg.codeSnippet)) {
                    this.applySnippet(fallbackMsg, true);
                }
            });
        }

        // Update token usage and limit for dbnexus AI default model
        if (this.isNoApiKeyRequired(currentModel)) {
            this.updateUsageFromApiResponse(res);
        }

        this.shouldScrollToBottom = true;
    }

    private handleChatErrorResponse(err: any, currentModel: AiChatModel, userMsg?: ChatMessage): void {
        console.error('AI chat error:', err);

        // Update token usage and limit if provided in the error response (e.g. token limit reached)
        this.updateUsageFromApiResponse(err);

        const errMsg = this.formatAiErrorMessage(err);
        this.svc.showToast(errMsg, 4000, 'error');

        // The error should only be displayed in the toaster, not in the chat as response
        if (userMsg) {
            this.messages.update(prev => prev.filter(m => m.id !== userMsg.id));
            if (!this.promptText()) {
                this.promptText.set(userMsg.text);
                setTimeout(() => this.autoExpandTextarea(), 0);
            }
        }
        this.isThinking.set(false);
        this.stopThinkingStatusCycle();
    }

    private updateUsageFromApiResponse(res: any): void {
        if (!res) return;

        let data = res;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch {
                return;
            }
        }

        let errorObj = data?.error;
        if (typeof errorObj === 'string') {
            try {
                errorObj = JSON.parse(errorObj);
            } catch {
                errorObj = null;
            }
        }

        const payloadData = data?.data;

        // 1. Update Limit from response if provided (e.g. data.limit = 50000)
        const responseLimit =
            data?.limit ??
            payloadData?.limit ??
            errorObj?.limit ??
            (typeof data?.error === 'object' ? data?.error?.limit : undefined);

        if (responseLimit !== undefined && responseLimit !== null && !isNaN(Number(responseLimit))) {
            const limitNum = Number(responseLimit);
            if (limitNum > 0) {
                this.tokenLimit.set(limitNum);
            }
        }

        // 2. Update Usage from response (e.g. data.usage = 53576)
        const responseUsage =
            data?.usage ??
            data?.used_tokens ??
            data?.tokens_used ??
            data?.usedTokens ??
            payloadData?.usage ??
            payloadData?.used_tokens ??
            payloadData?.tokens_used ??
            payloadData?.usedTokens ??
            errorObj?.usage ??
            errorObj?.used_tokens ??
            errorObj?.tokens_used ??
            errorObj?.usedTokens ??
            (typeof data?.error === 'object'
                ? (data?.error?.usage ?? data?.error?.used_tokens ?? data?.error?.tokens_used ?? data?.error?.usedTokens)
                : undefined);

        if (responseUsage !== undefined && responseUsage !== null && !isNaN(Number(responseUsage))) {
            this.updateUsedTokens(Number(responseUsage));
        } else {
            const rawTokens =
                data?.total_tokens ??
                data?.tokens ??
                payloadData?.total_tokens ??
                payloadData?.tokens;
            if (rawTokens !== undefined && rawTokens !== null && !isNaN(Number(rawTokens))) {
                this.updateUsedTokens(this.usedTokens() + Number(rawTokens));
            }
        }

        // 3. Update Remaining Quota boolean flag if provided (e.g. data.hasRemainingQuota = false)
        const remainingQuota =
            data?.hasRemainingQuota ??
            payloadData?.hasRemainingQuota ??
            errorObj?.hasRemainingQuota ??
            (typeof data?.error === 'object' ? data?.error?.hasRemainingQuota : undefined);

        if (remainingQuota !== undefined && remainingQuota !== null) {
            this.hasRemainingQuota.set(Boolean(remainingQuota));
        } else if (this.getMaxTokens() > 0 && this.usedTokens() >= this.getMaxTokens()) {
            this.hasRemainingQuota.set(false);
        }
    }

    getMaxTokens(): number {
        if (this.tokenLimit() > 0) {
            return this.tokenLimit();
        }
        const model = this.selectedModel();
        if (model && model.max_tokens && typeof model.max_tokens === 'number' && model.max_tokens > 0) {
            return model.max_tokens;
        }
        const dbnexus = this.availableModels().find(m => this.isNoApiKeyRequired(m));
        if (dbnexus && dbnexus.max_tokens && typeof dbnexus.max_tokens === 'number' && dbnexus.max_tokens > 0) {
            return dbnexus.max_tokens;
        }
        return 50000;
    }

    getUsagePercentage(): number {
        const max = this.getMaxTokens();
        if (!max || max <= 0) return 0;
        const pct = Math.round((this.usedTokens() / max) * 100);
        return Math.min(100, Math.max(0, pct));
    }

    getResetDate(): string {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `1 ${monthNames[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`;
    }

    formatNumber(val: number): string {
        return (val || 0).toLocaleString('en-US');
    }

    toggleUsagePopup(event?: Event): void {
        if (event) event.stopPropagation();
        this.isUsagePopupOpen.update(v => !v);
    }

    closeUsagePopup(): void {
        this.isUsagePopupOpen.set(false);
    }

    updateUsedTokens(newCount: number): void {
        const val = Math.max(0, newCount);
        this.usedTokens.set(val);
        if (this.getMaxTokens() > 0 && val >= this.getMaxTokens()) {
            this.hasRemainingQuota.set(false);
        }
    }

    toggleModelDropdown(event?: Event): void {
        if (event) event.stopPropagation();
        this.isModelDropdownOpen.set(!this.isModelDropdownOpen());
    }

    closeModelDropdown(): void {
        this.isModelDropdownOpen.set(false);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement | null;
        if (!target?.closest('.model-dropdown-container')) {
            this.isModelDropdownOpen.set(false);
        }
        if (!target?.closest('.ai-usage-limit-container')) {
            this.isUsagePopupOpen.set(false);
        }
    }

    private prepareTextChunks(text: string): { chunk: string; isNewline: boolean }[] {
        if (!text) return [];
        const lines = text.split('\n');
        const result: { chunk: string; isNewline: boolean }[] = [];

        lines.forEach((line, lineIdx) => {
            const isFirstLine = lineIdx === 0;
            const words = line.split(' ').filter(w => w.length > 0);

            if (words.length === 0) {
                // Preserves empty line / paragraph spacing
                result.push({ chunk: '', isNewline: !isFirstLine });
                return;
            }

            // If line is short (<= 8 words), stream the whole line at once
            if (words.length <= 8) {
                result.push({ chunk: line, isNewline: !isFirstLine });
                return;
            }

            // If line is longer, split into natural phrase chunks of ~4-6 words
            let cur: string[] = [];
            let isFirstChunkOfLine = true;
            for (const w of words) {
                cur.push(w);
                if (cur.length >= 5 || w.endsWith('.') || w.endsWith('!') || w.endsWith('?') || w.endsWith(':') || w.endsWith(';')) {
                    result.push({
                        chunk: cur.join(' '),
                        isNewline: isFirstChunkOfLine && !isFirstLine
                    });
                    cur = [];
                    isFirstChunkOfLine = false;
                }
            }
            if (cur.length > 0) {
                result.push({
                    chunk: cur.join(' '),
                    isNewline: isFirstChunkOfLine && !isFirstLine
                });
            }
        });

        return result;
    }

    private streamMessageLineByLine(
        msg: ChatMessage,
        fullText: string,
        fullCode?: string,
        onComplete?: () => void
    ): void {
        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }

        const codeLines = fullCode ? fullCode.split('\n') : [];
        const textChunks = this.prepareTextChunks(fullText);

        let codeIdx = 0;
        let textIdx = 0;

        msg.isStreaming = true;
        msg.streamingStage = codeLines.length > 0 ? 'code' : 'text';
        msg.displayCodeSnippet = codeLines.length > 0 ? '' : undefined;
        msg.displayText = '';
        this.messages.update(m => [...m]);

        this.streamingTimer = setInterval(() => {
            // 1. Stream code snippet line by line first if present
            if (codeLines.length > 0 && codeIdx < codeLines.length) {
                msg.streamingStage = 'code';
                const nextCodeLine = codeLines[codeIdx];
                msg.displayCodeSnippet = (msg.displayCodeSnippet !== undefined && msg.displayCodeSnippet.length > 0)
                    ? msg.displayCodeSnippet + '\n' + nextCodeLine
                    : nextCodeLine;
                codeIdx++;
                this.messages.update(m => [...m]);
                this.shouldScrollToBottom = true;
                this.scrollToBottom();
                requestAnimationFrame(() => this.scrollToBottom());
                return;
            }

            // 2. Stream explanation / description text line by line / phrase by phrase
            if (textChunks.length > 0 && textIdx < textChunks.length) {
                msg.streamingStage = 'text';
                const next = textChunks[textIdx];
                if (msg.displayText === undefined || msg.displayText.length === 0) {
                    msg.displayText = next.chunk;
                } else {
                    const sep = next.isNewline ? '\n' : ' ';
                    msg.displayText = msg.displayText + sep + next.chunk;
                }
                textIdx++;
                this.messages.update(m => [...m]);
                this.shouldScrollToBottom = true;
                this.scrollToBottom();
                requestAnimationFrame(() => this.scrollToBottom());
                return;
            }

            // 3. Completed streaming
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
            msg.isStreaming = false;
            msg.streamingStage = undefined;
            msg.displayText = fullText;
            if (fullCode) {
                msg.displayCodeSnippet = fullCode;
            }
            this.messages.update(m => [...m]);
            this.shouldScrollToBottom = true;
            this.scrollToBottom();
            requestAnimationFrame(() => this.scrollToBottom());

            // Apply query ONLY AFTER chat response is completely displayed on screen
            if (onComplete) {
                if (this.streamCompleteTimer) {
                    clearTimeout(this.streamCompleteTimer);
                }
                this.streamCompleteTimer = setTimeout(() => {
                    this.streamCompleteTimer = null;
                    onComplete();
                }, 600);
            }
        }, 80);
    }

    resetChat(): void {
        if (this.isDeletingChat() || this.isCreatingSession()) return;

        const sessionId = this.currentSessionId();
        if (!sessionId) {
            this.startNewChat('Chat reset successfully');
            return;
        }

        const deleteUrl = this.getDeleteSessionHistoryUrl(sessionId);
        if (!deleteUrl) {
            console.warn('deleteSessionHistory URL not configured, falling back to startNewChat');
            this.startNewChat('Chat reset successfully');
            return;
        }

        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }
        this.stopThinkingStatusCycle();
        this.isThinking.set(false);
        this.isDeletingChat.set(true);

        this.http.delete<any>(deleteUrl, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isDeletingChat.set(false);
                this.messages.set([]);
                this.promptText.set('');
                this.resetTextareaHeight();
                this.hasMoreHistory.set(false);
                this.oldestHistoryId = null;
                this.isLoadingMoreHistory.set(false);
                this.shouldScrollToBottom = false;

                const currentLatest = this.latestSession();
                if (currentLatest) {
                    this.latestSession.set({
                        ...currentLatest,
                        message_count: 0
                    });
                }

                const msg = res?.message || 'Chat history reset successfully';
                this.svc.showToast(msg, 2500, 'success');
            },
            error: (err) => {
                this.isDeletingChat.set(false);
                console.error('Failed to reset chat history:', err);
                const errMsg = err?.error?.message || err?.message || 'Failed to reset chat history';
                this.svc.showToast(errMsg, 3000, 'error');

                // If session was not found (404), create a fresh session
                if (err?.status === 404) {
                    this.startNewChat('New chat session created');
                }
            }
        });
    }

    startNewChat(toastMessage: string = 'New chat session created'): void {
        this.dismissModelDisclaimer();
        if (this.streamingTimer) {
            clearInterval(this.streamingTimer);
            this.streamingTimer = null;
        }
        this.stopThinkingStatusCycle();
        this.isThinking.set(false);

        if (this.isCreatingSession()) return;

        let currentModel = this.selectedModel();
        if (!this.hasValidApiKey(currentModel)) {
            currentModel = this.getAutoSelectedModel(this.availableModels());
            this.selectedModel.set(currentModel);
            localStorage.setItem('ai_selected_model_id', String(currentModel.id));
        }
        const url = this.appConfig.environment?.adminApiUrls?.aiSessions ||
            this.appConfig.environment?.aiSessions;

        if (!url || !currentModel) {
            // Local fallback if URL or model is not ready
            this.messages.set([]);
            this.currentSessionId.set(null);
            this.latestSession.set(null);
            this.sessionTitle.set(this.formatSessionTitle());
            this.isThinking.set(false);
            this.promptText.set('');
            this.isModelDropdownOpen.set(false);
            this.hasMoreHistory.set(false);
            this.oldestHistoryId = null;
            this.isLoadingMoreHistory.set(false);
            this.svc.showToast(toastMessage || 'Chat reset', 2500, 'info');
            return;
        }

        this.isCreatingSession.set(true);

        const payload: { name: string; modelId: number } = {
            name: this.formatSessionTitle(),
            modelId: Number(currentModel.id)
        };

        this.http.post<any>(url, payload, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isCreatingSession.set(false);
                const sessionData: AiSessionItem = res?.data || res;
                const newSessionId = sessionData?.session_id;

                this.currentSessionId.set(newSessionId || null);
                this.latestSession.set(sessionData || null);
                this.sessionTitle.set(sessionData?.name || this.formatSessionTitle());
                this.messages.set([]);
                this.isThinking.set(false);
                this.promptText.set('');
                this.isModelDropdownOpen.set(false);
                this.hasMoreHistory.set(false);
                this.oldestHistoryId = null;
                this.isLoadingMoreHistory.set(false);

                this.svc.showToast(toastMessage, 2500, 'success');
            },
            error: (err) => {
                this.isCreatingSession.set(false);
                console.error('Failed to create new AI session:', err);
                const errMsg = err?.error?.message || 'Failed to create new session';
                this.svc.showToast(errMsg, 3000, 'error');

                // Fallback to local reset
                this.messages.set([]);
                this.currentSessionId.set(null);
                this.latestSession.set(null);
                this.sessionTitle.set(this.formatSessionTitle());
                this.isThinking.set(false);
                this.promptText.set('');
                this.isModelDropdownOpen.set(false);
                this.hasMoreHistory.set(false);
                this.oldestHistoryId = null;
                this.isLoadingMoreHistory.set(false);
            }
        });
    }

    onClose(): void {
        this.close.emit();
        // this.svc.closeAiChat();
    }

    // copySnippet(snippet: string, msgId: string): void {
    //     if (!snippet) return;
    //     navigator.clipboard.writeText(snippet).then(() => {
    //         this.copiedSnippetId.set(msgId);
    //         setTimeout(() => {
    //             if (this.copiedSnippetId() === msgId) {
    //                 this.copiedSnippetId.set(null);
    //             }
    //         }, 2000);
    //     });
    // }
    async copySnippet(snippetOrMsg: string | ChatMessage, maybeMsgId?: string): Promise<void> {
        let textToCopy = '';
        let msgId = '';

        if (typeof snippetOrMsg === 'object' && snippetOrMsg !== null) {
            msgId = snippetOrMsg.id;
            textToCopy = (snippetOrMsg.displayCodeSnippet !== undefined && snippetOrMsg.displayCodeSnippet !== null && snippetOrMsg.displayCodeSnippet.trim() !== '')
                ? snippetOrMsg.displayCodeSnippet
                : (snippetOrMsg.codeSnippet || '');
        } else {
            textToCopy = snippetOrMsg || '';
            msgId = maybeMsgId || '';
        }

        textToCopy = (textToCopy || '').trim();
        if (!textToCopy) {
            this.svc.showToast('No code snippet available to copy.', 2000, 'info');
            return;
        }

        let copied = false;

        // 1. Try modern navigator.clipboard (available in secure contexts like HTTPS/localhost)
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(textToCopy);
                copied = true;
            } catch (err) {
                console.warn('navigator.clipboard.writeText failed, trying fallback textarea copy...', err);
            }
        }

        // 2. Reliable fallback for non-secure contexts (HTTP, LAN IP address, iframes, etc.)
        if (!copied && typeof document !== 'undefined') {
            try {
                const ta = document.createElement('textarea');
                ta.value = textToCopy;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '-9999px';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                ta.setSelectionRange(0, textToCopy.length);
                copied = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch (fallbackErr) {
                console.warn('Fallback document.execCommand copy failed', fallbackErr);
            }
        }

        if (copied) {
            if (msgId) {
                this.copiedSnippetId.set(msgId);
                setTimeout(() => {
                    if (this.copiedSnippetId() === msgId) {
                        this.copiedSnippetId.set(null);
                    }
                }, 2000);
            }
            this.svc.showToast('Code copied to clipboard!', 2000, 'success');
        } else {
            this.svc.showToast('Failed to copy to clipboard.', 2500, 'error');
        }
    }

    private extractTableNames(code: string): string[] {
        if (!code) return [];
        const matches = Array.from(code.matchAll(/\bTable\s+(?:["'`\[]?)([A-Za-z0-9_.]+)(?:["'`\]]?)/gi));
        return matches.map(m => m[1].toLowerCase());
    }

    private findUserQueryForMessage(msg: ChatMessage): string {
        const msgs = this.messages();
        const idx = msgs.findIndex(m => m.id === msg.id);
        if (idx > 0) {
            for (let i = idx - 1; i >= 0; i--) {
                if (msgs[i].sender === 'user') {
                    return msgs[i].text || '';
                }
            }
        }
        return '';
    }

    applySnippet(msg: ChatMessage, showToast = true): void {
        // Query should be applied only after the chat response is completely displayed
        if (!msg.codeSnippet || msg.isStreaming || msg.applied || this.applyingSnippetMsgId() !== null) return;

        // Never apply non-DBML code
        if (!this.isDbmlCode(msg.codeSnippet)) {
            console.warn('Skipping applySnippet: code is not valid DBML', msg.codeSnippet);
            return;
        }

        // Show diagram loader over the canvas/page with blur (as in the screenshot)
        this.applyingSnippetMsgId.set(msg.id);
        this.svc.isDiagramLoading.set(true);

        if (this.applySnippetTimer) {
            clearTimeout(this.applySnippetTimer);
        }
        this.applySnippetTimer = setTimeout(() => {
            this.applySnippetTimer = null;
            if (this.applyingSnippetMsgId() !== msg.id) {
                return;
            }
            try {
                let snippet = msg.codeSnippet!.trim();
                // Strip markdown code fences if present (e.g. ```dbml ... ```)
                snippet = snippet.replace(/^```(?:dbml|sql)?\r?\n?/i, '').replace(/\r?\n?```$/i, '').trim();
                const wasReviewActive = this.svc.aiDiffReviewActive();
                const currentCode = (wasReviewActive
                    ? this.svc.getCommittedAiDiffCode()
                    : (this.svc.code || '')).trim();

                let proposedCode = '';
                if (!currentCode) {
                    proposedCode = snippet;
                } else {
                    const existingTables = this.extractTableNames(currentCode);
                    const newTables = this.extractTableNames(snippet);
                    const hasOverlap = newTables.some(t => existingTables.includes(t));
                    const missingTables = existingTables.filter(t => !newTables.includes(t));

                    const userQuery = this.findUserQueryForMessage(msg);
                    const combinedContext = `${userQuery} ${msg.text || ''}`.toLowerCase();
                    const deletionKeywords = /\b(?:delete|deleted|deleting|drop|dropped|dropping|remove|removed|removing|destroy|truncate|eliminate|omit|omitted)\b/i;
                    const isDeletion = deletionKeywords.test(combinedContext) ||
                        missingTables.some(t => combinedContext.includes(t.toLowerCase()));

                    // If deletion is requested/detected or multiple tables are returned (full schema),
                    // proposedCode must use the new snippet so deleted tables/columns/refs show up as deletions in Myers diff!
                    if (isDeletion || newTables.length > 1 || (existingTables.length > 0 && newTables.length >= existingTables.length)) {
                        proposedCode = snippet;
                    } else if (hasOverlap && newTables.length === 1 && existingTables.length > 1 && !snippet.includes('Ref:')) {
                        // Isolated single-table update (e.g. user asked "add column to table_b" and AI returned only table_b without touching other tables)
                        let updatedCode = currentCode;
                        const tableName = newTables[0];
                        const escName = tableName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const tableRegex = new RegExp(`\\bTable\\s+${escName}\\s*(\\[[^\\]]*\\])?\\s*\\{[\\s\\S]*?\\}`, 'i');
                        const snippetTableMatch = snippet.match(tableRegex);
                        if (snippetTableMatch && tableRegex.test(updatedCode)) {
                            updatedCode = updatedCode.replace(tableRegex, snippetTableMatch[0]);
                            proposedCode = updatedCode;
                        } else {
                            proposedCode = snippet;
                        }
                    } else if (hasOverlap) {
                        proposedCode = snippet;
                    } else {
                        proposedCode = `${currentCode}\n\n${snippet}`;
                    }
                }

                // Ensure any standalone references referencing dropped / non-existent tables are purged from proposedCode
                const proposedTableNames = new Set(this.extractTableNames(proposedCode));
                if (proposedTableNames.size > 0) {
                    const refLineRegex = /^[ \t]*Ref(?:\s+[A-Za-z0-9_]+)?\s*:\s*"?([A-Za-z0-9_]+)"?\."?([A-Za-z0-9_]+)"?\s*(?:<->|<>|>|<|-)\s*"?([A-Za-z0-9_]+)"?\."?([A-Za-z0-9_]+)"?[ \t]*(?:\r?\n|$)/gim;
                    proposedCode = proposedCode.replace(refLineRegex, (match, fromT, _fromC, toT, _toC) => {
                        if (!proposedTableNames.has(fromT.toLowerCase()) || !proposedTableNames.has(toT.toLowerCase())) {
                            return '';
                        }
                        return match;
                    });
                }

                // Strip any trailing newlines from proposedCode and currentCode so trailing newlines are never added or considered as a change
                proposedCode = proposedCode.replace(/[\r\n]+$/, '');
                const normCurrent = currentCode.replace(/[\r\n]+$/, '');
                const normProposed = proposedCode;

                // If changes are proposed, initiate AI Diff Review with Accept and Reject options
                if (normCurrent !== normProposed) {
                    let histId = msg.historyId;
                    if (!histId && msg.id.startsWith('hist-')) {
                        const parsed = parseInt(msg.id.replace(/^hist-(?:user|asst)-/, ''), 10);
                        if (!isNaN(parsed)) histId = parsed;
                    }
                    if (!histId) {
                        histId = this.svc.latestAiChatMessageId() ?? undefined;
                    }
                    const sessId = msg.sessionId ?? this.currentSessionId() ?? this.svc.latestAiChatSessionId() ?? undefined;

                    this.svc.startAiDiffReview(normCurrent, normProposed, {
                        chat_history_id: histId,
                        session_id: sessId
                    });
                    msg.applied = true;
                    this.messages.update(msgs =>
                        msgs.map(m => m.id === msg.id ? { ...m, applied: true } : (m.applied ? { ...m, applied: false } : m))
                    );

                    if (showToast) {
                        this.svc.showToast('AI changes ready for review. Click Accept or Reject.', 3000, 'info');
                    }
                } else {
                    if (wasReviewActive) {
                        this.svc.closeAiDiffReview(false);
                    }
                    msg.applied = true;
                    this.messages.update(msgs =>
                        msgs.map(m => m.id === msg.id ? { ...m, applied: true } : (m.applied ? { ...m, applied: false } : m))
                    );

                    if (showToast) {
                        this.svc.showToast('Current DBML already matches AI response.', 2500, 'info');
                    }
                }
            } finally {
                this.svc.isDiagramLoading.set(false);
                this.applyingSnippetMsgId.set(null);
            }
        }, 600);
    }

    private scrollToBottom(): void {
        const el = this.messagesContainer?.nativeElement;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
        if (this.messagesEnd?.nativeElement) {
            this.messagesEnd.nativeElement.scrollIntoView({ block: 'end', behavior: 'auto' });
        }
    }

    isLatestMessage(msg: ChatMessage): boolean {
        const list = this.messages();
        if (!list || list.length === 0) return false;
        return list[list.length - 1].id === msg.id;
    }

    private getDeleteChatHistoryUrl(historyId: number): string {
        const template: string = this.appConfig.environment?.adminApiUrls?.aiChatHistoryById ||
            this.appConfig.environment?.aiChatHistoryById ||
            '';
        if (template) {
            return template.replace('{id}', String(historyId)).replace(':id', String(historyId));
        }
        const chatBase: string = this.appConfig.environment?.adminApiUrls?.aiChat ||
            this.appConfig.environment?.aiChat ||
            '';
        return chatBase ? `${chatBase.replace(/\/+$/, '')}/history/${historyId}` : '';
    }

    deleteLatestChat(targetMsg?: ChatMessage): void {
        if (this.isDeletingChat() || this.isThinking()) return;

        const list = this.messages();
        if (!list || list.length === 0) return;

        const lastMsg = targetMsg || list[list.length - 1];

        // Resolve historyId
        let historyId = lastMsg.historyId;
        if (!historyId && lastMsg.id.startsWith('hist-')) {
            const parsed = parseInt(lastMsg.id.replace(/^hist-(?:user|asst)-/, ''), 10);
            if (!isNaN(parsed)) historyId = parsed;
        }

        // If lastMsg didn't have historyId, check if previous message in turn has it
        if (!historyId && list.length >= 2) {
            const prevMsg = list[list.length - 2];
            if (prevMsg.historyId) {
                historyId = prevMsg.historyId;
            } else if (prevMsg.id.startsWith('hist-')) {
                const parsed = parseInt(prevMsg.id.replace(/^hist-(?:user|asst)-/, ''), 10);
                if (!isNaN(parsed)) historyId = parsed;
            }
        }

        // If no backend historyId exists (e.g. local unsaved or failed message), remove locally
        if (!historyId) {
            this.messages.update(prev => {
                const copy = [...prev];
                if (copy.length >= 2 && copy[copy.length - 1].sender === 'assistant' && copy[copy.length - 2].sender === 'user') {
                    copy.splice(copy.length - 2, 2);
                } else {
                    copy.pop();
                }
                return copy;
            });
            this.svc.showToast('Chat removed', 2000, 'info');
            return;
        }

        const url = this.getDeleteChatHistoryUrl(historyId);
        if (!url) {
            this.svc.showToast('Delete chat endpoint not configured', 3000, 'error');
            return;
        }

        this.isDeletingChat.set(true);

        this.http.delete<any>(url, { withCredentials: true }).subscribe({
            next: (res) => {
                this.isDeletingChat.set(false);
                // Remove all messages associated with this history turn
                this.messages.update(prev => {
                    const filtered = prev.filter(m => {
                        if (m.historyId && m.historyId === historyId) return false;
                        if (m.id === `hist-user-${historyId}` || m.id === `hist-asst-${historyId}`) return false;
                        return true;
                    });
                    if (filtered.length === prev.length) {
                        const copy = [...prev];
                        if (copy.length >= 2 && copy[copy.length - 1].sender === 'assistant' && copy[copy.length - 2].sender === 'user') {
                            copy.splice(copy.length - 2, 2);
                        } else {
                            copy.pop();
                        }
                        return copy;
                    }
                    return filtered;
                });

                this.latestSession.update(s => s ? { ...s, message_count: Math.max(0, (s.message_count || 1) - 1) } : s);

                const msg = res?.message || 'Chat deleted successfully';
                this.svc.showToast(msg, 2500, 'success');
            },
            error: (err) => {
                this.isDeletingChat.set(false);
                console.error('Failed to delete chat message:', err);
                const errMsg = err?.error?.message || err?.message || 'Failed to delete chat message';
                this.svc.showToast(errMsg, 3500, 'error');
            }
        });
    }

    private colorizedCache = new Map<string, SafeHtml>();

    colorizeDbml(text: string | undefined): SafeHtml {
        if (!text) return '';
        const cached = this.colorizedCache.get(text);
        if (cached) return cached;

        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const lines = escaped.split('\n');
        const highlighted = lines.map(line => {
            const commentIndex = line.indexOf('//');
            let codePart = line;
            let commentPart = '';
            if (commentIndex !== -1) {
                codePart = line.substring(0, commentIndex);
                commentPart = `<span class="comment-line">${line.substring(commentIndex)}</span>`;
            }

            codePart = codePart.replace(
                /\b(TableGroup|Table|Ref|Note|Project|enum|indexes)(:)?(?=\s|$)/gi,
                (match, p1, p2) => `<span class="keyword">${p1}${p2 || ''}</span>`
            );

            codePart = codePart.replace(
                /(<span class="keyword">TableGroup<\/span>)\s+("[^"]+"|[A-Za-z0-9_]+)/gi,
                '$1 <span class="groupName">$2</span>'
            );

            codePart = codePart.replace(
                /(&#039;.*?&#039;|'.*?')/g,
                '<span class="attribute">$1</span>'
            );

            codePart = codePart.replace(
                /^(\s*(?:["'`][^"'`]+["'`]|[A-Za-z0-9_.]+)\s+)(integer|varchar|text|timestamp|date|decimal|boolean|float|datetime|int|bigint|objectid|json|bson|array|uuid|map|mixed|char|blob|serial|numeric|real|double|tinyint|smallint|mediumint|binary|varbinary)\b/gim,
                '$1<span class="datatype">$2</span>'
            );

            codePart = codePart.replace(
                /(\([\d\s,]+\))/g,
                '<span class="number">$1</span>'
            );

            codePart = codePart.replace(
                /\[(.*?)\]/g,
                '<span class="attribute">[$1]</span>'
            );

            return codePart + commentPart;
        });

        const safeHtml = this.sanitizer.bypassSecurityTrustHtml(highlighted.join('\n'));
        if (this.colorizedCache.size > 200) {
            this.colorizedCache.clear();
        }
        this.colorizedCache.set(text, safeHtml);
        return safeHtml;
    }
}
