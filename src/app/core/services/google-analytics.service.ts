import { Injectable, Inject, PLATFORM_ID, Optional } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environment/environment';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth.service';

// Declare `gtag` globally
declare var gtag: any;

// Extend `Navigator` to include battery & network connection APIs
declare global {
  interface Navigator {
    getBattery?: () => Promise<any>;
    connection?: any;
    mozConnection?: any;
    webkitConnection?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAnalyticsService {
  public gTagId: string = '';
  private measurementProtocolSecret: string = '';
  private isBrowser: boolean;
  private cachedDownloadSpeed: number | null = null;
  private downloadSpeedPromise: Promise<number> | null = null;
  private cachedIpAddress: string | null = null;
  private ipLookupPromise: Promise<string> | null = null;
  private isScriptInjected = false;
  private appVersion: string = '1.4.0';

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Optional() private router?: Router,
    @Optional() private authService?: AuthService,
    @Optional() private appConfig?: AppConfigService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.refreshConfig();
  }

  /**
   * Dynamically refresh Google Analytics configuration from AppConfigService or environment
   */
  public refreshConfig(): void {
    const configEnv = this.appConfig?.environment;
    this.gTagId =
      configEnv?.googleAnalyticsMeasurementId ||
      configEnv?.googleAnalytics?.measurementId ||
      environment.googleAnalyticsMeasurementId ||
      '';

    this.measurementProtocolSecret =
      configEnv?.googleAnalyticsMeasurementProtocolSecret ||
      configEnv?.googleAnalytics?.measurementProtocolSecret ||
      (environment as any).googleAnalyticsMeasurementProtocolSecret ||
      '';
  }

  /**
   * Flag to temporarily enable Google Analytics in local development for testing.
   * Set to true to test locally; set to false to enforce strict production-only tracking.
   */
  public enableForLocalTesting: boolean = false;

  /**
   * Check if current application environment is real production
   */
  public isRealProduction(): boolean {
    if (this.appConfig?.environment?.production !== undefined) {
      return !!this.appConfig.environment.production;
    }
    return !!environment.production;
  }

  /**
   * Check if tracking is allowed (production environment or enabled for local testing)
   */
  public isProduction(): boolean {
    if (this.enableForLocalTesting) {
      return true;
    }
    return this.isRealProduction();
  }

  /**
   * Injects gtag.js script dynamically and sets up Google Analytics.
   * Runs in production or when enableForLocalTesting is true.
   * Also listens for router changes if autoTrackRoutes is enabled.
   */
  public initializeGtagJs(autoTrackRoutes: boolean = true): void {
    if (!this.isBrowser || typeof document === 'undefined' || !this.isProduction()) {
      return;
    }

    this.refreshConfig();

    if (!this.gTagId) {
      console.warn('[GoogleAnalyticsService] No Google Analytics Measurement ID configured.');
      return;
    }

    if (this.enableForLocalTesting && !this.isRealProduction()) {
      console.log(`[GoogleAnalyticsService] GA4 enabled for local testing with Measurement ID: ${this.gTagId}`);
    }

    if (!this.isScriptInjected) {
      const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${this.gTagId}"]`);
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gTagId}`;
        script.async = true;
        document.head.appendChild(script);

        const inlineScript = document.createElement('script');
        inlineScript.text = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
        `;
        document.head.appendChild(inlineScript);
      }
      this.isScriptInjected = true;
    }

    // Pre-warm client IP lookup in background
    this.getClientIp();

    // Initialize either as authenticated user or anonymous user
    if (this.authService?.isLoggedIn()) {
      this.initializeUser();
    } else {
      this.anonymousInitialize();
    }

    // Listen to route changes for SPA page views
    if (autoTrackRoutes && this.router) {
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          this.trackPageView(this.getRouteData()?.name || this.getRouteData()?.title, event.urlAfterRedirects);
        });
    }
  }

  /**
   * Initialize GA4 with user-specific data (called upon login or app launch for active session).
   */
  public initializeUser(customUserData?: any): void {
    if (!this.isBrowser || typeof gtag === 'undefined' || !this.gTagId || !this.isProduction()) {
      return;
    }

    const user = this.resolveUserData(customUserData);
    const safeUserId = user.id ? user.id : undefined;

    gtag('config', this.gTagId, {
      user_id: safeUserId,
      account_type: user.accountType,
      org_role: user.orgRole,
      organization_id: user.organizationId,
      is_super_admin: user.isSuperAdmin,
      auth_provider: user.authProvider,
      plan_slug: user.planSlug,
      plan_status: user.planStatus,
      client_ip: this.cachedIpAddress || undefined,
      send_page_view: false,
      ...(this.enableForLocalTesting && !this.isRealProduction() ? { debug_mode: true } : {})
    });

    this.recordUserData(user);
  }

  /**
   * Legacy alias matching example code
   */
  public initialize(dataForFrontend?: any): void {
    this.initializeUser(dataForFrontend);
  }

  /**
   * Initialize Google Analytics anonymously for visitors / public pages.
   */
  public anonymousInitialize(): void {
    if (!this.isBrowser || typeof gtag === 'undefined' || !this.gTagId || !this.isProduction()) {
      return;
    }

    gtag('config', this.gTagId, {
      user_id: undefined,
      ...(this.enableForLocalTesting && !this.isRealProduction() ? { debug_mode: true } : {})
    });

    gtag('event', 'page_view', {
      session_source: typeof document !== 'undefined' ? document.referrer : '',
      page_location: typeof window !== 'undefined' ? window.location.href : '',
      page_path: this.router?.url || '/',
      ...(this.enableForLocalTesting && !this.isRealProduction() ? { debug_mode: true } : {})
    });
  }

  /**
   * Set user properties in Google Analytics.
   */
  public recordUserData(customUserData?: any): void {
    if (!this.isBrowser || typeof gtag === 'undefined' || !this.gTagId || !this.isProduction()) {
      return;
    }

    const user = this.resolveUserData(customUserData);
    gtag('set', 'user_properties', {
      user_id_encoded: user.id || 'anonymous',
      account_type: user.accountType || 'individual',
      org_role: user.orgRole || 'none',
      organization_id: user.organizationId ? String(user.organizationId) : 'none',
      is_super_admin: user.isSuperAdmin ? 'true' : 'false',
      auth_provider: user.authProvider ? 'sso' : 'standard',
      plan_slug: user.planSlug || 'free',
      plan_status: user.planStatus || 'active',
      client_ip: this.cachedIpAddress || 'unknown',
      theme_mode: this.getThemeMode(),
      device_type: this.getDeviceType(),
      language_code: this.getLanguageCode(),
      timezone: this.getTimezone()
    });

    // If client IP is not yet resolved, update user property when it resolves
    if (!this.cachedIpAddress) {
      this.getClientIp().then((ip) => {
        if (ip && typeof gtag !== 'undefined') {
          gtag('set', 'user_properties', { client_ip: ip });
        }
      });
    }
  }

  /**
   * Extract comprehensive details about the active user from AuthService, LocalStorage, or parameters.
   */
  public resolveUserData(customData?: any): {
    id: string;
    rawId: number | string | null;
    email: string;
    accountType: string;
    orgRole: string;
    organizationId: number | null;
    isSuperAdmin: boolean;
    authProvider: boolean;
    planSlug: string;
    planStatus: string;
    userName: string;
    entitlementsCount: number;
  } {
    const rawId = customData?.id || customData?.userId || this.authService?.getUserId() || null;
    let email = customData?.email || this.authService?.getUserEmail() || '';
    if (!this.authService?.isLoggedIn()) {
      email = '';
    }

    let userName = customData?.name || customData?.userName || '';
    if (!userName && this.isBrowser) {
      try {
        const storedUser = localStorage.getItem('user_data');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          userName = parsed?.name || parsed?.username || parsed?.fullName || '';
        }
      } catch {}
    }

    const entitlements = this.authService?.getEntitlements() || [];

    return {
      id: rawId ? this.safeBtoa(String(rawId)) : '',
      rawId: rawId,
      email: email ? this.safeBtoa(email) : '',
      accountType: customData?.accountType || this.authService?.getAccountType() || 'individual',
      orgRole: customData?.orgRole || this.authService?.getOrgRole() || 'none',
      organizationId: customData?.organizationId || this.authService?.getOrganizationId() || null,
      isSuperAdmin: customData?.isSuperAdmin !== undefined ? !!customData.isSuperAdmin : !!this.authService?.isSuperAdmin(),
      authProvider: customData?.authProvider !== undefined ? !!customData.authProvider : !!this.authService?.getAuthProvider(),
      planSlug: customData?.planSlug || this.authService?.getCurrentPlanSlug() || 'free',
      planStatus: customData?.planStatus || this.authService?.getCurrentPlanStatus() || 'active',
      userName: userName,
      entitlementsCount: Array.isArray(entitlements) ? entitlements.length : 0
    };
  }

  /**
   * Track a custom event with rich telemetry (network speed, battery, device metrics, route data, API telemetry).
   */
  public async trackEvent(
    eventCategory: string,
    eventName: string,
    eventInformation: any = {},
    apiServerStatus?: number,
    reqDuration?: number
  ): Promise<void> {
    if (!this.isBrowser || typeof gtag === 'undefined' || !this.gTagId || !eventName || !this.isProduction()) {
      return;
    }

    try {
      const speed = await this.getDownloadSpeed();
      const batteryStatus = await this.getBatteryStatus();
      const ip = await this.getClientIp();
      const networkInfo = this.getNetworkInfo();
      const routeData = this.getRouteData();

      gtag('event', eventName, {
        event_category: eventCategory,
        event_custom_data: typeof eventInformation === 'string' ? eventInformation : JSON.stringify(eventInformation),
        client_ip: ip || 'unknown',
        network_speed: speed,
        network_effective_type: networkInfo?.effectiveType || 'unknown',
        battery: JSON.stringify(batteryStatus),
        app_version: this.appVersion,
        viewing_language_code: this.getLanguageCode(),
        window_width: typeof window !== 'undefined' ? window.innerWidth : 0,
        window_height: typeof window !== 'undefined' ? window.innerHeight : 0,
        screen_resolution: typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : 'unknown',
        device_type: this.getDeviceType(),
        channel: 'web',
        theme_mode: this.getThemeMode(),
        page_screen_view: routeData?.name || routeData?.title || (typeof window !== 'undefined' ? window.location.pathname : ''),
        api_server_status: apiServerStatus,
        api_request_duration: reqDuration != null ? `${reqDuration}ms` : '0ms',
        ...(this.enableForLocalTesting && !this.isRealProduction() ? { debug_mode: true } : {})
      });

      if (this.enableForLocalTesting && !this.isRealProduction()) {
        console.log(`[GoogleAnalyticsService] [Local Test] Event: "${eventName}" (Category: "${eventCategory}")`, eventInformation);
      }
    } catch (error) {
      console.error('[GoogleAnalyticsService] Error tracking event:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Common & Simple Application Events
  // ─────────────────────────────────────────────────────────────

  /**
   * Track SPA Page / Screen View
   */
  public trackPageView(pageTitle?: string, pagePath?: string): void {
    if (!this.isBrowser || typeof gtag === 'undefined' || !this.gTagId || !this.isProduction()) return;

    const path = pagePath || (this.router?.url ? this.router.url : typeof window !== 'undefined' ? window.location.pathname : '/');
    const title = pageTitle || (typeof document !== 'undefined' ? document.title : '');

    gtag('event', 'page_view', {
      page_title: title,
      page_location: typeof window !== 'undefined' ? window.location.href : '',
      page_path: path,
      ...(this.enableForLocalTesting && !this.isRealProduction() ? { debug_mode: true } : {})
    });

    if (this.enableForLocalTesting && !this.isRealProduction()) {
      console.log(`[GoogleAnalyticsService] [Local Test] PageView: "${path}" (${title})`);
    }
  }

  /**
   * Track user login event
   */
  public trackLogin(method: string = 'password'): void {
    this.trackEvent('Authentication', 'login', { method });
    this.initializeUser();
  }

  /**
   * Track user registration event
   */
  public trackSignUp(method: string = 'password'): void {
    this.trackEvent('Authentication', 'sign_up', { method });
    this.initializeUser();
  }

  /**
   * Track user logout event
   */
  public trackLogout(): void {
    this.trackEvent('Authentication', 'logout', { session_duration: 'ended' });
    this.anonymousInitialize();
  }

  /**
   * Track diagram creation
   */
  public trackDiagramCreated(diagramName?: string, source: string = 'blank'): void {
    this.trackEvent('Diagram', 'diagram_create', {
      diagram_name: diagramName || 'Untitled',
      source
    });
  }

  /**
   * Track opening / loading a diagram
   */
  public trackDiagramOpened(diagramId: string | number, diagramName?: string): void {
    this.trackEvent('Diagram', 'diagram_open', {
      diagram_id: diagramId,
      diagram_name: diagramName || ''
    });
  }

  /**
   * Track saving diagram
   */
  public trackDiagramSaved(diagramId?: string | number, isDraft: boolean = false): void {
    this.trackEvent('Diagram', 'diagram_save', {
      diagram_id: diagramId,
      is_draft: isDraft
    });
  }

  /**
   * Track exporting diagram (e.g. PNG, SVG, PDF, SQL, DBML)
   */
  public trackDiagramExported(exportType: string, diagramId?: string | number): void {
    this.trackEvent('Diagram', 'diagram_export', {
      export_type: exportType,
      diagram_id: diagramId
    });
  }

  /**
   * Track importing schema (e.g. SQL, SQLite, DBML, JSON)
   */
  public trackDiagramImported(importType: string, fileSize?: number): void {
    this.trackEvent('Diagram', 'diagram_import', {
      import_type: importType,
      file_size_bytes: fileSize || 0
    });
  }

  /**
   * Track AI chat prompt interaction
   */
  public trackAiChatPrompt(model?: string, promptLength?: number): void {
    this.trackEvent('AI_Assistant', 'ai_prompt_sent', {
      model: model || 'default',
      prompt_length: promptLength || 0
    });
  }

  /**
   * Track subscription upgrade / click
   */
  public trackSubscriptionClick(planSlug: string, billingCycle?: string): void {
    this.trackEvent('Monetization', 'subscription_intent', {
      plan_slug: planSlug,
      billing_cycle: billingCycle || 'monthly'
    });
  }

  /**
   * Track workspace / organization switch
   */
  public trackWorkspaceSwitched(workspaceId: number | string): void {
    this.trackEvent('Workspace', 'workspace_switch', {
      workspace_id: workspaceId
    });
  }

  /**
   * Track client or API errors
   */
  public trackError(errorMessage: string, errorSource: string = 'frontend', fatal: boolean = false): void {
    this.trackEvent('Diagnostics', 'app_error', {
      error_message: errorMessage,
      error_source: errorSource,
      fatal
    });
  }

  /**
   * Track API latency and response status
   */
  public trackApiCall(endpoint: string, status: number, reqDurationMs: number): void {
    this.trackEvent('API_Telemetry', 'api_request', {
      endpoint
    }, status, reqDurationMs);
  }

  // ─────────────────────────────────────────────────────────────
  // Device, Network, & Telemetry Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch public IP address with caching (in memory and sessionStorage).
   * Times out gracefully after 2.5s if network is slow or blocked.
   */
  public async getClientIp(): Promise<string> {
    if (!this.isBrowser) {
      return '';
    }

    if (this.cachedIpAddress) {
      return this.cachedIpAddress;
    }

    try {
      const stored = sessionStorage.getItem('client_ip');
      if (stored) {
        this.cachedIpAddress = stored;
        return stored;
      }
    } catch {}

    if (this.ipLookupPromise) {
      return await this.ipLookupPromise;
    }

    this.ipLookupPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const response = await fetch('https://api.ipify.org?format=json', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data?.ip) {
            this.cachedIpAddress = data.ip;
            try {
              sessionStorage.setItem('client_ip', data.ip);
            } catch {}
            return data.ip;
          }
        }
      } catch {
        // Silently continue if blocked/offline
      }
      return '';
    })();

    return await this.ipLookupPromise;
  }

  /**
   * Fetch battery status using Battery API
   */
  public async getBatteryStatus(): Promise<any> {
    if (!this.isBrowser || typeof navigator === 'undefined' || !navigator.getBattery) {
      return {};
    }

    try {
      const battery = await navigator.getBattery();
      if (battery) {
        return {
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level === 1 ? 100 : Math.round(battery.level * 100)
        };
      }
    } catch {
      // Ignore if access blocked by security policy
    }
    return {};
  }

  /**
   * Return network connection information if supported by browser
   */
  public getNetworkInfo(): any {
    if (!this.isBrowser || typeof navigator === 'undefined') {
      return {};
    }
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }
    return {};
  }

  /**
   * Wrapper method to get download speed.
   * Caches result to avoid continuous downloading.
   */
  public async getDownloadSpeed(): Promise<number> {
    if (!this.isBrowser) {
      return 0;
    }

    // First check Navigator NetworkInformation API downlink if available (instant, no extra network load)
    const conn = this.getNetworkInfo();
    if (conn && typeof conn.downlink === 'number' && conn.downlink > 0) {
      return Math.round(conn.downlink * 100) / 100;
    }

    if (this.cachedDownloadSpeed !== null) {
      return this.cachedDownloadSpeed;
    }

    if (this.downloadSpeedPromise !== null) {
      return await this.downloadSpeedPromise;
    }

    this.downloadSpeedPromise = this.processDownloadSpeed()
      .then((speed) => {
        this.cachedDownloadSpeed = speed;
        return speed;
      })
      .catch(() => {
        this.downloadSpeedPromise = null;
        return 0;
      });

    return await this.downloadSpeedPromise;
  }

  /**
   * Measure network download speed by fetching a small test asset
   */
  public async processDownloadSpeed(): Promise<number> {
    const fileUrl = 'https://raw.githubusercontent.com/jrquick17/ng-speed-test/02c59e4afde67c35a5ba74014b91d44b33c0b3fe/demo/src/assets/500kb.jpg';
    const startTime = new Date().getTime();

    try {
      const response = await fetch(fileUrl, { cache: 'no-store' });
      const blob = await response.blob();
      const endTime = new Date().getTime();

      const fileSizeInBytes = blob.size;
      const durationInSeconds = Math.max((endTime - startTime) / 1000, 0.05);
      const fileSizeInBits = fileSizeInBytes * 8;
      const speedMbps = fileSizeInBits / (1024 * 1024) / durationInSeconds;

      return Math.round(speedMbps * 100) / 100;
    } catch {
      return 0;
    }
  }

  /**
   * Determine device category
   */
  public getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (!this.isBrowser || typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Determine active UI theme
   */
  public getThemeMode(): string {
    if (!this.isBrowser) return 'light';
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Get client browser language
   */
  public getLanguageCode(): string {
    if (!this.isBrowser || typeof navigator === 'undefined') return 'en';
    return navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  }

  /**
   * Get client timezone
   */
  public getTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /**
   * Resolve active route metadata from Router snapshot hierarchy
   */
  public getRouteData(): any {
    if (!this.router?.routerState?.root) {
      return null;
    }
    let route: any = this.router.routerState.root;
    let data = route.snapshot?.data || {};
    while (route.firstChild) {
      route = route.firstChild;
      data = { ...data, ...route.snapshot?.data };
    }
    return data;
  }

  /**
   * Construct GA4 Measurement Protocol endpoint URL
   */
  public getMeasurementProtocolAPI(): string {
    this.refreshConfig();
    return `https://www.google-analytics.com/mp/collect?measurement_id=${this.gTagId}&api_secret=${this.measurementProtocolSecret}`;
  }

  /**
   * Helper for safe base64 encoding
   */
  private safeBtoa(val: string): string {
    if (!val) return '';
    try {
      return btoa(val);
    } catch {
      return encodeURIComponent(val);
    }
  }
}
