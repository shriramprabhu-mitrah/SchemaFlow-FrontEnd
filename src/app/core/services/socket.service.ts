import { Injectable, PLATFORM_ID, Inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private isBrowser: boolean;

  private updateSubject = new Subject<{ dbml: string; name?: string; layout?: any; userId: number; username: string }>();
  private cursorSubject = new Subject<{ userId: number; username: string; line: number; col: number; x?: number; y?: number }>();

  private roomStateSubject = new Subject<{ users: any[]; permission: string }>();
  private userJoinedSubject = new Subject<{ userId: number; username: string; permission: string }>();
  private userLeftSubject = new Subject<{ userId: number; username: string }>();
  private errorSubject = new Subject<{ message: string }>();
  private savedSubject = new Subject<{ timestamp: number }>();
  private trialExpiredSubject = new Subject<any>();
  private connectSubject = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private appConfig: AppConfigService,
    private ngZone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get isConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  connect(): void {
    if (!this.isBrowser) return;

    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) {
        this.socket.connect();
      }
      return;
    }

    const token = this.getAuthToken();
    if (!token) return;

    const baseUrl = this.appConfig.environment?.apiConfig?.baseUrl || 'http://localhost:4000';

    this.socket = io(baseUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket'] // FORCE WEBSOCKETS ONLY. Long-polling is paused by browsers in background tabs!
    });

    this.setupListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinDiagram(diagramId: number): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('diagram:join', { diagramId });
    } else {
      this.connect();
      if (this.socket) {
        this.socket.once('connect', () => {
          this.socket?.emit('diagram:join', { diagramId });
        });
      }
    }
  }

  leaveDiagram(diagramId: number): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('diagram:leave', { diagramId });
    }
  }

  sendChange(diagramId: number, dbml: string, name?: string, layout?: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('diagram:change', { diagramId, dbml, name, layout });
    }
  }

  sendCursor(diagramId: number, line: number, col: number, x?: number, y?: number): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('diagram:cursor', { diagramId, line, col, x, y });
    }
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.ngZone.run(() => this.connectSubject.next());
    });
    this.socket.on('connect_error', (err) => console.error('[Socket] Socket.io connection error:', err));

    this.socket.on('diagram:update', (data) => {
      this.ngZone.run(() => this.updateSubject.next(data));
    });
    this.socket.on('diagram:cursor-update', (data) => {
      this.ngZone.run(() => this.cursorSubject.next(data));
    });
    this.socket.on('diagram:room-state', (data) => {
      this.ngZone.run(() => this.roomStateSubject.next(data));
    });
    this.socket.on('diagram:user-joined', (data) => {
      this.ngZone.run(() => this.userJoinedSubject.next(data));
    });
    this.socket.on('diagram:user-left', (data) => {
      this.ngZone.run(() => this.userLeftSubject.next(data));
    });
    this.socket.on('diagram:error', (data) => {
      this.ngZone.run(() => this.errorSubject.next(data));
    });
    this.socket.on('diagram:saved', (data) => {
      this.ngZone.run(() => this.savedSubject.next(data));
    });
    this.socket.on('diagram:trial_expired', (data) => {
      this.ngZone.run(() => this.trialExpiredSubject.next(data));
    });
  }

  onUpdate(): Observable<any> { return this.updateSubject.asObservable(); }
  onCursorUpdate(): Observable<any> { return this.cursorSubject.asObservable(); }
  onRoomState(): Observable<any> { return this.roomStateSubject.asObservable(); }
  onUserJoined(): Observable<any> { return this.userJoinedSubject.asObservable(); }
  onUserLeft(): Observable<any> { return this.userLeftSubject.asObservable(); }
  onError(): Observable<any> { return this.errorSubject.asObservable(); }
  onSaved(): Observable<any> { return this.savedSubject.asObservable(); }
  onTrialExpired(): Observable<any> { return this.trialExpiredSubject.asObservable(); }
  onConnect(): Observable<void> { return this.connectSubject.asObservable(); }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }
}
