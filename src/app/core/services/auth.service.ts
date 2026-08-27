import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private appConfig: AppConfigService
  ) { }

  login(payload: any): Observable<any> {
    // withCredentials: true tells the browser to store the HttpOnly
    // refreshToken cookie the server sends back in Set-Cookie
    const url = this.appConfig.environment?.authApiUrls?.login ?? '';
    return this.http.post<any>(url, payload, { withCredentials: true }).pipe(
      tap((res) => {
        const data = res?.data || res;
        const token = data?.token || data?.accessToken;
        const refreshToken = data?.refreshToken;
        if (token) {
          this.setToken(token);
        } else {
          console.warn('Login response did not contain a recognizable access token field.');
        }
        if (refreshToken) {
          this.setRefreshToken(refreshToken);
        }
        const email = payload?.email || res?.data?.user?.email || res?.user?.email || res?.email;
        if (email) {
          this.setUserEmail(email);
        }
        const profilePic = res?.data?.profilePicture || res?.profilePicture;
        if (profilePic) {
          this.setUserProfilePicture(profilePic);
        }
        // Store organization context and super admin flag
        if (data?.organizationId) {
          this.setOrganizationId(data.organizationId);
        }
        if (data?.isSuperAdmin !== undefined) {
          this.setSuperAdmin(data.isSuperAdmin);
        }

        // Store account type returned from login
        const accountType = payload?.accountType || data?.accountType;
        if (accountType) {
          this.setAccountType(accountType);
        }
        if (data?.organizationId) {
          this.setOrganizationId(data.organizationId);
        }
        // Store org role if returned
        const orgRole = data?.orgRole;
        if (orgRole) {
          this.setOrgRole(orgRole);
        }
        // Store purchased plan
        if (data?.purchasedPlan?.slug) {
          this.setCurrentPlanSlug(data.purchasedPlan.slug);
        }
        // Store entitlements
        if (data?.entitlements) {
          this.setEntitlements(data.entitlements);
        }
      })
    );
  }

  register(payload: any): Observable<any> {
    const url = this.appConfig.environment?.authApiUrls?.register ?? '';
    return this.http.post<any>(url, payload, { withCredentials: true }).pipe(
      tap((res) => {
        const data = res?.data || res;
        const token = data?.token || data?.accessToken;
        if (token) {
          this.setToken(token);
        }
        const email = payload?.email || res?.data?.user?.email || res?.user?.email || res?.email;
        if (email) {
          this.setUserEmail(email);
        }
        // Store account type from payload (user chose during signup)
        const accountType = payload?.accountType || data?.accountType;
        if (accountType) {
          this.setAccountType(accountType);
        }
        // Store organization context if returned
        if (data?.organizationId) {
          this.setOrganizationId(data.organizationId);
        }
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    const url = this.appConfig.environment?.authApiUrls?.forgetPassword ?? '';
    return this.http.post<any>(url, { email });
  }

  resetPassword(payload: any, token: string): Observable<any> {
    const baseUrl = this.appConfig.environment?.authApiUrls?.resetPassword ?? '';
    const url = `${baseUrl}?token=${token}`;
    return this.http.post<any>(url, payload);
  }
  setUserEmail(email: string): void {
    if (isPlatformBrowser(this.platformId) && email) {
      localStorage.setItem('user_email', email);
    }
  }

  setUserProfilePicture(profilePicture: string): void {
    if (isPlatformBrowser(this.platformId) && profilePicture) {
      localStorage.setItem('user_profile_picture', profilePicture);
    }
  }

  getUserProfilePicture(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('user_profile_picture');
    }
    return null;
  }

  getUserEmail(): string {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_email');
      if (saved) return saved;
      const token = this.getToken();
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.email) return payload.email;
            if (payload.username && payload.username.includes('@')) return payload.username;
            if (payload.sub && payload.sub.includes('@')) return payload.sub;
          }
        } catch (e) { }
      }
    }
    return 'tdemo6764@gmail.com';
  }

  setToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('auth_token', token);
      localStorage.removeItem('dbml_code');
      localStorage.removeItem('drag position');
      localStorage.removeItem('ref colors');
    }
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  setRefreshToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('refresh_token', token);
    }
  }

  getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  refreshToken(): Observable<any> {
    const url = this.appConfig.environment?.authApiUrls?.refreshToken ?? '';
    const refreshToken = this.getRefreshToken();
    return this.http.post<any>(url, { refreshToken }, { withCredentials: true }).pipe(
      tap((res) => {
        const data = res?.data || res;
        const token = data?.token || data?.accessToken;
        const newRefreshToken = data?.refreshToken;
        if (token) {
          this.setToken(token);
        }
        if (newRefreshToken) {
          this.setRefreshToken(newRefreshToken);
        }
      })
    );
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // ── Organization Context ──

  setOrganizationId(orgId: number): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('organization_id', String(orgId));
    }
  }

  getOrganizationId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const val = localStorage.getItem('organization_id');
      return val ? parseInt(val, 10) : null;
    }
    return null;
  }

  setSuperAdmin(isSuperAdmin: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('is_super_admin', String(isSuperAdmin));
    }
  }

  isSuperAdmin(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Check local storage flag
      const stored = localStorage.getItem('is_super_admin');
      if (stored === 'true') return true;

      // 2. Fallback: Decode current JWT token payload
      const payload = this.getTokenPayload();
      if (payload && (payload.isSuperAdmin === true || payload.is_super_admin === true)) {
        // Synchronize local storage flag
        localStorage.setItem('is_super_admin', 'true');
        return true;
      }
    }
    return false;
  }

  getTokenPayload(): any {
    const token = this.getToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        return JSON.parse(atob(parts[1]));
      }
    } catch (e) { }
    return null;
  }

  // ── Account Type ──

  setAccountType(type: string): void {
    if (isPlatformBrowser(this.platformId) && type) {
      localStorage.setItem('account_type', type);
    }
  }

  getAccountType(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('account_type');
      if (stored) return stored;
      // Fallback: try to infer from JWT payload
      const payload = this.getTokenPayload();
      if (payload?.accountType) return payload.accountType;
    }
    return null;
  }

  isOrganizationAccount(): boolean {
    return this.getAccountType() === 'organization';
  }

  // Organization Owner role has been removed. Admins now have top-level access.

  setOrgRole(role: string): void {
    if (isPlatformBrowser(this.platformId) && role) {
      localStorage.setItem('org_role', role);
    }
  }

  getOrgRole(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      let role = localStorage.getItem('org_role');
      if (role === 'owner') role = 'admin';
      return role;
    }
    return null;
  }

  isOrganizationAdmin(): boolean {
    return this.getOrgRole() === 'admin';
  }

  isOrganizationMember(): boolean {
    return this.getOrgRole() === 'member';
  }

  hasDiagramEditPermission(): boolean {
    const role = this.getOrgRole();
    return !role || role === 'admin' || role === 'member';
  }

  hasWorkspaceCreatePermission(): boolean {
    const role = this.getOrgRole();
    return !role || role === 'admin';
  }


  setCurrentPlanSlug(slug: string): void {
    if (isPlatformBrowser(this.platformId) && slug) {
      localStorage.setItem('current_plan_slug', slug);
    }
  }

  getCurrentPlanSlug(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('current_plan_slug');
    }
    return null;
  }

  setEntitlements(entitlements: any[]): void {
    if (isPlatformBrowser(this.platformId) && entitlements) {
      localStorage.setItem('user_entitlements', JSON.stringify(entitlements));
    }
  }

  getEntitlements(): any[] {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('user_entitlements');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  }

  clearLocalState(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user_profile_picture');
      localStorage.removeItem('organization_id');
      localStorage.removeItem('is_super_admin');

      localStorage.removeItem('org_role');
      localStorage.removeItem('account_type');
      localStorage.removeItem('dbml_code');
      localStorage.removeItem('active_diagram_code');
      localStorage.removeItem('active_diagram_name');
      localStorage.removeItem('active_diagram_id');
      localStorage.removeItem('drag position');
      localStorage.removeItem('ref colors');
      localStorage.removeItem('user_entitlements');
      localStorage.removeItem('current_plan_slug');
    }
  }

  logout(): void {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.clearLocalState();

    const url = this.appConfig.environment?.authApiUrls?.logout ?? '';
    if (url) {
      this.http.post(url, {}, { headers, withCredentials: true }).subscribe({
        next: () => console.log('Successfully logged out from server session.'),
        error: (err) => console.error('Server logout failed:', err)
      });
    }
  }

  getUserDetails(): Observable<any> {
    const url = this.appConfig.environment?.userApiUrls?.userDetails ?? '';
    return this.http.get<any>(url, { withCredentials: true });
  }

  updateProfile(payload: any): Observable<any> {
    const url = this.appConfig.environment?.userApiUrls?.updateProfile ?? '';
    return this.http.put<any>(url, payload, { withCredentials: true });
  }

  getUserFeatures(orgId?: number): Observable<any> {
    let url = (this.appConfig.environment?.userApiUrls as any)?.userFeatures ?? 'http://localhost:4000/api/user-features';
    if (orgId) {
      url += `?orgId=${orgId}`;
    }
    return this.http.get<any>(url, { withCredentials: true });
  }

}
