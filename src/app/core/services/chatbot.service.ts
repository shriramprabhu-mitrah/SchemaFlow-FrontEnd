import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable,BehaviorSubject, Subject, tap } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface ChatbotCategory {
  category_id: number;
  name: string;
  description: string;
  icon: string;
  audience: string;
  display_order: number;
}

export interface ChatbotNode {
  node_id: number;
  category_id: number;
  parent_node_id?: number | null;
  title: string;
  content: string;
  action_type: string;
  action_url?: string | null;
  options: Array<{
    label: string;
    nextNodeId?: number;
    action?: string;
    url?: string;
  }>;
  keywords?: string[];
  audience?: string;
}

export interface ChatbotSessionResponse {
  sessionId: string;
  userType: 'guest' | 'authenticated';
  settings: {
    is_enabled: boolean;
    bot_name: string;
    welcome_title: string;
    welcome_subtitle: string;
    fallback_email: string;
    enable_guest_access: boolean;
    show_feedback_thumbs: boolean;
  };
  categories: ChatbotCategory[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private sessionId: string | null = null;
  private readonly GUEST_TOKEN_KEY = 'dbnexus_chat_guest_token';
  private readonly SESSION_ID_KEY = 'dbnexus_chat_session_id';
  private readonly BOT_HIDDEN_KEY = 'dbnexus_chatbot_hidden';

  private readonly botHidden$ = new BehaviorSubject<boolean>(this.checkIfHidden());

  get isHidden$(): Observable<boolean> {
    return this.botHidden$.asObservable();
  }

  get isHidden(): boolean {
    return this.botHidden$.value;
  }

  setHidden(hidden: boolean): void {
    this.botHidden$.next(hidden);
    if (typeof window !== 'undefined' && window.localStorage) {
      if (hidden) {
        localStorage.setItem(this.BOT_HIDDEN_KEY, 'true');
      } else {
        localStorage.removeItem(this.BOT_HIDDEN_KEY);
      }
    }
  }

  private checkIfHidden(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return localStorage.getItem(this.BOT_HIDDEN_KEY) === 'true';
  }

  readonly closeChat$ = new Subject<void>();
  readonly closeHeaderMenus$ = new Subject<void>();

  closeChat(): void {
    this.closeChat$.next();
  }

  closeHeaderMenus(): void {
    this.closeHeaderMenus$.next();
  }

  private get endpoints() {
    return this.appConfig.environment?.chatbotApiUrls || {};
  }

  private get baseUrl(): string {
    return this.appConfig.environment?.apiConfig?.baseUrl || 'http://localhost:4007';
  }

  getGuestToken(): string {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'guest-ssr';
    }
    let token = localStorage.getItem(this.GUEST_TOKEN_KEY);
    if (!token) {
      token = 'gst_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem(this.GUEST_TOKEN_KEY, token);
    }
    return token;
  }

  getCurrentSessionId(): string | null {
    if (this.sessionId) return this.sessionId;
    if (typeof window !== 'undefined' && window.localStorage) {
      this.sessionId = localStorage.getItem(this.SESSION_ID_KEY);
    }
    return this.sessionId;
  }

  setSessionId(id: string): void {
    this.sessionId = id;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.SESSION_ID_KEY, id);
    }
  }

  initSession(currentPage: string = '/'): Observable<{ statusCode: number; data: ChatbotSessionResponse }> {
    const url = this.endpoints.session || `${this.baseUrl}/api/chatbot/sessions`;
    const payload = {
      guestToken: this.getGuestToken(),
      currentPage
    };

    return this.http.post<{ statusCode: number; data: ChatbotSessionResponse }>(url, payload).pipe(
      tap(res => {
        if (res?.data?.sessionId) {
          this.setSessionId(res.data.sessionId);
        }
      })
    );
  }

  getCategories(): Observable<{ statusCode: number; data: ChatbotCategory[] }> {
    const url = this.endpoints.categories || `${this.baseUrl}/api/chatbot/categories`;
    return this.http.get<{ statusCode: number; data: ChatbotCategory[] }>(url);
  }

  getCategoryNodes(categoryId: number): Observable<{ statusCode: number; data: ChatbotNode[] }> {
    let url = this.endpoints.categoryNodes;
    if (url) {
      url = url.replace('{id}', String(categoryId));
    } else {
      url = `${this.baseUrl}/api/chatbot/categories/${categoryId}/nodes`;
    }
    return this.http.get<{ statusCode: number; data: ChatbotNode[] }>(url);
  }

  getNodeDetail(nodeId: number): Observable<{ statusCode: number; data: ChatbotNode }> {
    let url = this.endpoints.nodeById;
    if (url) {
      url = url.replace('{id}', String(nodeId));
    } else {
      url = `${this.baseUrl}/api/chatbot/nodes/${nodeId}`;
    }

    const sessionId = this.getCurrentSessionId();
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return this.http.get<{ statusCode: number; data: ChatbotNode }>(`${url}${query}`);
  }

  search(query: string): Observable<{ statusCode: number; data: { matched: boolean; results?: ChatbotNode[]; message?: string; options?: any[] } }> {
    const base = this.endpoints.search || `${this.baseUrl}/api/chatbot/search`;
    const sessionId = this.getCurrentSessionId() || '';
    const url = `${base}?q=${encodeURIComponent(query)}&sessionId=${encodeURIComponent(sessionId)}`;
    return this.http.get<{ statusCode: number; data: { matched: boolean; results?: ChatbotNode[]; message?: string; options?: any[] } }>(url);
  }

  logFeedback(nodeId: number, wasHelpful: boolean): Observable<any> {
    const url = this.endpoints.interaction || `${this.baseUrl}/api/chatbot/interactions`;
    const payload = {
      sessionId: this.getCurrentSessionId(),
      nodeId,
      wasHelpful
    };
    return this.http.post(url, payload);
  }

  escalateTicket(enquiry: {
    first_name: string;
    last_name?: string;
    company_email: string;
    phone_number?: string;
    subject?: string;
    message: string;
    enquiry_type?: string;
  }): Observable<{ statusCode: number; message: string; data: any }> {
    const url = this.endpoints.escalate || `${this.baseUrl}/api/chatbot/escalate`;
    const payload = {
      sessionId: this.getCurrentSessionId(),
      ...enquiry
    };
    return this.http.post<{ statusCode: number; message: string; data: any }>(url, payload);
  }
}

