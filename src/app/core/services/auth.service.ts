import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, switchMap, map, of, catchError, shareReplay, finalize } from 'rxjs';
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
        // Reset old session state completely on new login
        this.studentApprovalStatus = undefined;
        this.inflightStudentApproval$ = undefined;
        this.studentApprovalStatus$.next(null);
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem('student_is_approved');
          localStorage.removeItem('student_id');
          localStorage.removeItem('student_id_email');
          localStorage.removeItem('username');
          localStorage.removeItem('user_data');
          localStorage.removeItem('user_id');
          localStorage.removeItem('user_email');
          localStorage.removeItem('user_profile_picture');
          localStorage.removeItem('user_entitlements');
          localStorage.removeItem('member_feature_access');
        }

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
        const userId = data?.user?.id || data?.user?.userId || data?.user?.user_id || data?.userId || data?.id;
        if (userId && !isNaN(Number(userId))) {
          this.setUserId(Number(userId));
        }
        const studentId = data?.student_id || data?.studentId || data?.student?.id || data?.student?.student_id;
        if (studentId && !isNaN(Number(studentId))) {
          this.setStudentId(Number(studentId), email);
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
        if (data?.authProvider) {
          this.setAuthProvider(data.authProvider);
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
        const userId = data?.user?.id || data?.user?.userId || data?.user?.user_id || data?.userId || data?.id;
        if (userId && !isNaN(Number(userId))) {
          this.setUserId(Number(userId));
        }
      })
    );
  }

  sendRegisterOtp(email: string): Observable<any> {
    const url = this.appConfig.environment?.authApiUrls?.sendOtp || `${this.appConfig.environment?.apiConfig?.baseUrl || ''}/api/auth/send-otp`;
    return this.http.post<any>(url, { email });
  }

  verifyRegisterOtp(email: string, otp: string): Observable<any> {
    const url = this.appConfig.environment?.authApiUrls?.verifyOtp || `${this.appConfig.environment?.apiConfig?.baseUrl || ''}/api/auth/verify-otp`;
    return this.http.post<any>(url, { email, otp });
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

  setUserProfilePicture(profilePicture: string | null | undefined): void {
    if (isPlatformBrowser(this.platformId)) {
      if (profilePicture && typeof profilePicture === 'string' && profilePicture.trim() !== '') {
        localStorage.setItem('user_profile_picture', profilePicture);
      } else {
        localStorage.removeItem('user_profile_picture');
      }
    }
  }

  getUserProfilePicture(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const pic = localStorage.getItem('user_profile_picture');
      return pic && pic.trim() !== '' ? pic : null;
    }
    return null;
  }

  setUserId(userId: number | string | null | undefined): void {
    if (isPlatformBrowser(this.platformId)) {
      if (userId !== null && userId !== undefined && !isNaN(Number(userId))) {
        localStorage.setItem('user_id', String(userId));
      } else {
        localStorage.removeItem('user_id');
      }
    }
  }

  getUserId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Direct local storage key
      const stored = localStorage.getItem('user_id');
      if (stored && !isNaN(Number(stored))) {
        return Number(stored);
      }

      // 2. JWT token payload
      const payload = this.getTokenPayload();
      const id = payload?.userId ?? payload?.user_id ?? payload?.id ?? payload?.sub;
      if (id !== undefined && id !== null && !isNaN(Number(id))) {
        return Number(id);
      }

      // 3. User data stored JSON
      try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const uId = userData?.id ?? userData?.userId ?? userData?.user_id;
          if (uId !== undefined && uId !== null && !isNaN(Number(uId))) {
            return Number(uId);
          }
        }
      } catch (e) { }
    }
    return null;
  }

  setStudentId(studentId: number | string | null | undefined, email?: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const userId = this.getUserId();
      const currentEmail = (email || this.getUserEmail() || '').trim().toLowerCase();
      if (studentId !== null && studentId !== undefined && !isNaN(Number(studentId))) {
        const numId = Number(studentId);
        if (userId && numId === userId) {
          localStorage.removeItem('student_id');
          localStorage.removeItem('student_id_email');
          return;
        }
        localStorage.setItem('student_id', String(numId));
        if (currentEmail) {
          localStorage.setItem('student_id_email', currentEmail);
        }
      } else {
        localStorage.removeItem('student_id');
        localStorage.removeItem('student_id_email');
      }
    }
  }

  getStudentId(forEmail?: string): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const currentEmail = (forEmail || this.getUserEmail() || '').trim().toLowerCase();
      const savedEmail = (localStorage.getItem('student_id_email') || '').trim().toLowerCase();
      // If student_id has no bound email or belongs to another user, do NOT use it!
      if (currentEmail) {
        if (!savedEmail || currentEmail !== savedEmail) {
          localStorage.removeItem('student_id');
          localStorage.removeItem('student_id_email');
          return null;
        }
      }
      const userId = this.getUserId();
      const stored = localStorage.getItem('student_id');
      if (stored && !isNaN(Number(stored))) {
        const numStored = Number(stored);
        if (userId && numStored === userId) {
          localStorage.removeItem('student_id');
          localStorage.removeItem('student_id_email');
        } else {
          return numStored;
        }
      }
      const payload = this.getTokenPayload();
      const sId = payload?.studentId ?? payload?.student_id;
      if (sId !== undefined && sId !== null && !isNaN(Number(sId))) {
        if (!userId || Number(sId) !== userId) {
          return Number(sId);
        }
      }
      try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const uEmail = (userData?.email || userData?.user_email || '').trim().toLowerCase();
          if (!currentEmail || !uEmail || currentEmail === uEmail) {
            const uid = userData?.student_id ?? userData?.studentId;
            if (uid !== undefined && uid !== null && !isNaN(Number(uid))) {
              if (!userId || Number(uid) !== userId) {
                return Number(uid);
              }
            }
          }
        }
      } catch (e) { }
    }
    return null;
  }

  getUserEmail(): string {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_email');
      if (saved) return saved;
      try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const email = userData?.email || userData?.user_email || userData?.userEmail;
          if (email) return email;
        }
      } catch (e) { }
      const payload = this.getTokenPayload();
      if (payload) {
        if (payload.email) return payload.email;
        if (payload.user?.email) return payload.user.email;
        if (payload.data?.email) return payload.data.email;
        if (payload.username && typeof payload.username === 'string' && payload.username.includes('@')) return payload.username;
        if (payload.sub && typeof payload.sub === 'string' && payload.sub.includes('@')) return payload.sub;
      }
    }
    return '';
  }

  getUsername(): string {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('username');
      if (saved) return saved;
      try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const uName = userData?.username || userData?.user_name || userData?.userName;
          if (uName) return uName;
        }
      } catch (e) { }
      const payload = this.getTokenPayload();
      if (payload?.username) return payload.username;
      if (payload?.userName) return payload.userName;
      if (payload?.user_name) return payload.user_name;
      if (payload?.user?.username) return payload.user.username;
      const email = this.getUserEmail();
      if (email && email.includes('@')) return email.split('@')[0];
    }
    return '';
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

  // ── Auth Provider ──

  setAuthProvider(isSso: boolean | string): void {
    if (isPlatformBrowser(this.platformId) && isSso !== undefined && isSso !== null) {
      localStorage.setItem('auth_provider', String(isSso === true || isSso === 'true'));
    }
  }

  getAuthProvider(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('auth_provider') === 'true';
    }
    return false;
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

  private currentPlanSlug: string = 'free';
  private currentPlanStatus: string = 'active';

  setCurrentPlanSlug(slug: string): void {
    this.currentPlanSlug = slug;
    if (isPlatformBrowser(this.platformId) && slug) {
      localStorage.setItem('current_plan_slug', slug);
      localStorage.setItem('cachedPlanSlug', slug);
    }
  }

  getCurrentPlanSlug(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('current_plan_slug') || localStorage.getItem('cachedPlanSlug') || this.currentPlanSlug;
    }
    return this.currentPlanSlug;
  }

  getCurrentPlanStatus(): string {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('current_plan_status') || localStorage.getItem('cachedPlanStatus') || this.currentPlanStatus;
    }
    return this.currentPlanStatus;
  }

  setCurrentPlanStatus(status: string): void {
    this.currentPlanStatus = status;
    if (isPlatformBrowser(this.platformId) && status) {
      localStorage.setItem('current_plan_status', status);
      localStorage.setItem('cachedPlanStatus', status);
    }
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

  setMemberFeatureAccess(access: string[] | null): void {
    if (isPlatformBrowser(this.platformId)) {
      if (access && Array.isArray(access)) {
        localStorage.setItem('member_feature_access', JSON.stringify(access));
      } else {
        localStorage.removeItem('member_feature_access');
      }
    }
  }

  getMemberFeatureAccess(): string[] | null {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('member_feature_access');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  clearLocalState(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user_profile_picture');
      localStorage.removeItem('organization_id');
      localStorage.removeItem('is_super_admin');

      localStorage.removeItem('org_role');
      localStorage.removeItem('account_type');
      localStorage.removeItem('auth_provider');
      localStorage.removeItem('dbml_code');
      localStorage.removeItem('active_diagram_code');
      localStorage.removeItem('active_diagram_name');
      localStorage.removeItem('active_diagram_id');
      localStorage.removeItem('drag position');
      localStorage.removeItem('ref colors');
      localStorage.removeItem('user_entitlements');
      localStorage.removeItem('member_feature_access');
      localStorage.removeItem('current_plan_slug');
      localStorage.removeItem('cachedHasUsedTrial');
      localStorage.removeItem('student_is_approved');
      localStorage.removeItem('student_id');
      localStorage.removeItem('student_id_email');
    }
    
    this.currentPlanSlug = 'free';
    this.currentPlanStatus = 'active';
    this.studentApprovalStatus = undefined;
    this.inflightStudentApproval$ = undefined;
    this.studentApprovalStatus$.next(null);

    if (isPlatformBrowser(this.platformId)) {
      window.dispatchEvent(new Event('userLogout'));
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
    return this.http.get<any>(url, { withCredentials: true }).pipe(
      tap((res) => {
        const user = res?.data || res;
        const id = user?.id || user?.userId || user?.user_id;
        if (id && !isNaN(Number(id))) {
          this.setUserId(Number(id));
        }
        const email = user?.email || user?.user_email || user?.userEmail;
        if (email) {
          this.setUserEmail(email);
        }
        const username = user?.username || user?.user_name || user?.userName;
        if (username && isPlatformBrowser(this.platformId)) {
          localStorage.setItem('username', username);
        }
      })
    );
  }

  updateProfile(payload: any): Observable<any> {
    const url = this.appConfig.environment?.userApiUrls?.updateProfile ?? '';
    return this.http.put<any>(url, payload, { withCredentials: true });
  }

  getUserFeatures(orgId?: number): Observable<any> {
    let url = (this.appConfig.environment?.userApiUrls as any)?.userFeatures ?? 'http://localhost:4000/api/user-features';
    if (orgId) {
      url += `?orgId=${orgId}&_t=${Date.now()}`;
    } else {
      url += `?_t=${Date.now()}`;
    }
    return this.http.get<any>(url, { withCredentials: true }).pipe(
      tap((res) => {
        const data = res?.data || res;
        const featureList = Array.isArray(data)
          ? data
          : (Array.isArray(res)
            ? res
            : (data?.features || data?.entitlements || res?.features || res?.entitlements || null));
        if (featureList && Array.isArray(featureList) && featureList.length > 0) {
          this.setEntitlements(featureList);
        }
        const email = data?.email || data?.user?.email || data?.userEmail;
        if (email) {
          this.setUserEmail(email);
        }
        const userId = data?.userId || data?.user_id || data?.id || data?.user?.id;
        if (userId && !isNaN(Number(userId))) {
          this.setUserId(Number(userId));
        }
        const studentId = data?.student_id || data?.studentId || data?.purchasedPlan?.student_id || data?.purchasedPlan?.studentId;
        if (studentId && !isNaN(Number(studentId))) {
          this.setStudentId(Number(studentId), email);
        }
      })
    );
  }

  isStudentPlan(): boolean {
    const slug = (this.getCurrentPlanSlug() || '').toLowerCase();
    return slug === 'student' || slug === 'student-plan' || slug.includes('student');
  }

  private studentApprovalStatus: boolean | null | undefined = undefined;
  readonly studentApprovalStatus$ = new BehaviorSubject<boolean | null>(this.getStudentApprovalStatus());

  setStudentApprovalStatus(status: boolean | null, allowResetToNull = false): void {
    // If student was already confirmed rejected (false) or approved (true),
    // do not allow resetting back to pending (null) unless explicitly allowed
    const current = this.studentApprovalStatus !== undefined
      ? this.studentApprovalStatus
      : (isPlatformBrowser(this.platformId)
          ? (localStorage.getItem('student_is_approved') === 'false' ? false : (localStorage.getItem('student_is_approved') === 'true' ? true : null))
          : null);

    if (status === null && !allowResetToNull && (current === false || current === true)) {
      return;
    }
    this.studentApprovalStatus = status;
    if (isPlatformBrowser(this.platformId)) {
      if (status === null) {
        localStorage.setItem('student_is_approved', 'null');
      } else if (status === true) {
        localStorage.setItem('student_is_approved', 'true');
      } else {
        localStorage.setItem('student_is_approved', 'false');
      }
    }
    this.studentApprovalStatus$.next(status);
  }

  setStudentApproved(approved: boolean | null): void {
    this.setStudentApprovalStatus(approved);
  }

  getStudentApprovalStatus(): boolean | null {
    if (this.studentApprovalStatus !== undefined) {
      return this.studentApprovalStatus;
    }
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('student_is_approved');
      if (stored === 'true' || stored === '1' || stored === 'approved') {
        this.studentApprovalStatus = true;
        return true;
      }
      if (stored === 'false' || stored === '0' || stored === 'rejected') {
        this.studentApprovalStatus = false;
        return false;
      }
      if (stored === 'null' || stored === 'pending') {
        this.studentApprovalStatus = null;
        return null;
      }
    }
    this.studentApprovalStatus = null;
    return null;
  }

  isStudentApproved(): boolean {
    return this.isStudentPlan() && this.getStudentApprovalStatus() === true;
  }

  isStudentPending(): boolean {
    return this.isStudentPlan() && this.getStudentApprovalStatus() === null;
  }

  isStudentRejected(): boolean {
    return this.isStudentPlan() && this.getStudentApprovalStatus() === false;
  }

  getStudentCredentialsUrl(id?: number | string): string {
    const adminUrls = this.appConfig.environment?.adminApiUrls;
    if (id !== undefined && id !== null) {
      if (adminUrls?.studentCredentialsById) {
        return adminUrls.studentCredentialsById.replace('{id}', id.toString());
      }
    }
    let baseUrl = adminUrls?.studentCredentials;
    if (!baseUrl) {
      const studentPlanUrls = this.appConfig.environment?.studentPlanApiUrls;
      if (studentPlanUrls?.credentials) {
        baseUrl = studentPlanUrls.credentials;
      }
    }
    if (!baseUrl) {
      const rawBase = this.appConfig.environment?.apiConfig?.baseUrl || '';
      if (rawBase) {
        const cleanBase = rawBase.replace(/\/+$/, '');
        baseUrl = cleanBase.endsWith('/api') ? `${cleanBase}/student/credentials` : `${cleanBase}/api/student/credentials`;
      } else {
        baseUrl = 'http://localhost:4000/api/student/credentials';
      }
    }
    return id !== undefined && id !== null ? `${baseUrl}/${id}` : baseUrl;
  }

  getStudentCredentials(page = 1, limit = 10, sortBy = 'is_approved', sortOrder = 'asc', search?: string): Observable<any> {
    let url = this.getStudentCredentialsUrl();
    if (url.includes('?')) {
      url = url.split('?')[0];
    }
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('sortBy', sortBy)
      .set('sortOrder', sortOrder);

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    const token = this.getToken();
    let headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get(url, { headers, params, withCredentials: true });
  }

  getStudentCredentialById(id: number | string): Observable<any> {
    const url = this.getStudentCredentialsUrl(id);
    const token = this.getToken();
    let headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.http.get<any>(url, { headers, withCredentials: true });
  }

  private inflightStudentApproval$?: Observable<boolean | null>;

  checkStudentApproval(userEmail?: string, studentCredentialId?: number | string, force = false): Observable<boolean | null> {
    if (userEmail) {
      this.setUserEmail(userEmail);
    }

    if (!force && this.inflightStudentApproval$) {
      return this.inflightStudentApproval$;
    }

    const email = (userEmail || this.getUserEmail() || '').trim().toLowerCase();
    const currentUserId = this.getUserId();
    const username = (this.getUsername() || (email.includes('@') ? email.split('@')[0] : '')).trim().toLowerCase();

    // Guard: An ID identical to currentUserId is the user table ID, NOT the student_credentials table ID
    const validExplicitId = (studentCredentialId !== undefined && studentCredentialId !== null && !isNaN(Number(studentCredentialId)) && (!currentUserId || Number(studentCredentialId) !== currentUserId))
      ? Number(studentCredentialId)
      : undefined;

    const storedStudentId = this.getStudentId(email);
    const targetStudentId = validExplicitId || storedStudentId;

    const parseStatus = (item: any): boolean | null => {
      if (!item) return null;
      const target = item.student || item.credential || item;
      const val = target.is_approved !== undefined
        ? target.is_approved
        : (target.isApproved !== undefined
            ? target.isApproved
            : (target.is_accepted !== undefined
                ? target.is_accepted
                : target.isAccepted));

      if (val === true || val === 'true' || val === 1 || val === '1' || target.status === 'approved' || target.status === 'Accepted' || target.status === 'accepted') {
        return true;
      }
      if (val === false || val === 'false' || val === 0 || val === '0' || val === 'rejected' || val === 'Rejected' || target.status === 'rejected' || target.status === 'Rejected') {
        return false;
      }
      return null;
    };

    const fetchById$ = (idToFetch: number | string): Observable<boolean | null> => {
      return this.getStudentCredentialById(idToFetch).pipe(
        switchMap((res: any) => {
          let detail = res?.data?.student || res?.data?.student_credential || res?.data?.credential || res?.data || res?.student || res;
          if (Array.isArray(detail)) {
            detail = detail[0];
          }
          if (detail && typeof detail === 'object') {
            const detailEmail = (detail.email || detail.user_email || detail.student?.email || detail.credential?.email || '').trim().toLowerCase();
            const detailUid = detail.user_id != null ? Number(detail.user_id) : (detail.userId != null ? Number(detail.userId) : null);

            // Strict user match: Do not accept another user's credential details
            const isEmailMismatch = email && detailEmail && detailEmail !== email;
            const isUidMismatch = currentUserId && detailUid != null && detailUid !== currentUserId;

            if (isEmailMismatch || isUidMismatch) {
              console.warn(`Student credential ${idToFetch} does not belong to user ${email}. Discarding and searching...`);
              if (isPlatformBrowser(this.platformId)) {
                localStorage.removeItem('student_id');
                localStorage.removeItem('student_id_email');
              }
              return searchAndFetchById$();
            }

            const status = parseStatus(detail);
            this.setStudentApprovalStatus(status, true);
            const actualId = detail.id ?? detail.student_id;
            if (actualId && !isNaN(Number(actualId)) && (!currentUserId || Number(actualId) !== currentUserId)) {
              this.setStudentId(Number(actualId), email);
            }
            return of(status);
          }
          return searchAndFetchById$();
        }),
        catchError((err: any) => {
          console.warn(`GET /api/student/credentials/${idToFetch} failed (${err?.status}), falling back to search...`);
          if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem('student_id');
            localStorage.removeItem('student_id_email');
          }
          return searchAndFetchById$();
        })
      );
    };

    const searchAndFetchById$ = (): Observable<boolean | null> => {
      return this.getStudentCredentials(1, 100, 'is_approved', 'asc', email).pipe(
        map((res: any) => {
          let list: any[] = [];
          if (Array.isArray(res)) list = res;
          else if (Array.isArray(res?.data)) list = res.data;
          else if (Array.isArray(res?.data?.students)) list = res.data.students;
          else if (Array.isArray(res?.students)) list = res.students;

          // Strict match: Must match current user's email, or user_id (if email matches or not present)
          const match = list.find((s: any) => {
            const sEmail = (s.email || s.user_email || s.student?.email || s.credential?.email || '').trim().toLowerCase();
            if (email && sEmail && sEmail === email) return true;
            const sUid = s.user_id != null ? Number(s.user_id) : (s.userId != null ? Number(s.userId) : null);
            if (currentUserId && sUid != null && sUid === Number(currentUserId) && (!sEmail || sEmail === email)) {
              return true;
            }
            return false;
          });

          if (match) {
            const actualId = match.id ?? match.student_id;
            if (actualId && !isNaN(Number(actualId)) && (!currentUserId || Number(actualId) !== currentUserId)) {
              this.setStudentId(Number(actualId), email);
            }
            const status = parseStatus(match);
            this.setStudentApprovalStatus(status, true);
            return status;
          }

          const current = this.getStudentApprovalStatus();
          if (current === false || current === true) {
            return current;
          }
          this.setStudentApprovalStatus(null, true);
          return null;
        }),
        catchError((err: any) => {
          console.error('Failed to search student credentials:', err);
          const current = this.getStudentApprovalStatus();
          return of(current);
        })
      );
    };

    let request$: Observable<boolean | null>;

    if (targetStudentId) {
      request$ = fetchById$(targetStudentId);
    } else {
      request$ = searchAndFetchById$();
    }

    this.inflightStudentApproval$ = request$.pipe(
      shareReplay(1),
      finalize(() => {
        this.inflightStudentApproval$ = undefined;
      })
    );

    return this.inflightStudentApproval$;
  }

}
