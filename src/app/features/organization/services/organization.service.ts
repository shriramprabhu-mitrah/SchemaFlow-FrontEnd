import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

  private get urls(): any { return this.appConfig.environment?.organizationApiUrls || {}; }
  private get roleUrls(): any { return this.appConfig.environment?.roleApiUrls || {}; }

  // ── Organization ──
  getOrganizations(): Observable<any> {
    return this.http.get(this.urls.organizations, { withCredentials: true });
  }

  getOrganization(id: number): Observable<any> {
    return this.http.get(this.urls.organizationById.replace('{id}', id), { withCredentials: true });
  }

  updateOrganization(id: number, data: any): Observable<any> {
    return this.http.put(this.urls.organizationById.replace('{id}', id), data, { withCredentials: true });
  }

  // ── Members ──
  getMembers(orgId: number, page = 1, limit = 10, search = ''): Observable<any> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (search) params = params.set('search', search);
    return this.http.get(this.urls.orgMembers.replace('{id}', orgId), { params, withCredentials: true });
  }

  inviteMember(orgId: number, email: string, role = 'member', orgName?: string): Observable<any> {
    const payload: any = { email, role };
    if (orgName) payload.orgName = orgName;
    return this.http.post(this.urls.orgMembers.replace('{id}', orgId).replace('/members', '/invite'), payload, { withCredentials: true });
  }

  addMember(orgId: number, userId: number, role = 'member'): Observable<any> {
    return this.http.post(this.urls.orgMembers.replace('{id}', orgId), { userId, role }, { withCredentials: true });
  }

  removeMember(orgId: number, userId: any): Observable<any> {
    return this.http.delete(this.urls.orgMembers.replace('{id}', String(orgId)) + `/${encodeURIComponent(userId)}`, { withCredentials: true });
  }

  updateMemberRole(orgId: number, userId: any, role: string): Observable<any> {
    const url = this.urls.orgMemberRole.replace('{id}', String(orgId)).replace('{userId}', String(userId));
    return this.http.put(url, { role }, { withCredentials: true });
  }

  // ── Subscription ──
  getSubscription(orgId: number): Observable<any> {
    return this.http.get(this.urls.orgSubscription.replace('{id}', orgId), { withCredentials: true });
  }

  upgrade(orgId: number, planSlug: string): Observable<any> {
    return this.http.post(this.urls.orgUpgrade.replace('{id}', orgId), { planSlug }, { withCredentials: true });
  }

  downgrade(orgId: number, planSlug: string): Observable<any> {
    return this.http.post(this.urls.orgDowngrade.replace('{id}', orgId), { planSlug }, { withCredentials: true });
  }

  addSeats(orgId: number, quantity: number): Observable<any> {
    return this.http.post(this.urls.orgAddSeats.replace('{id}', orgId), { quantity }, { withCredentials: true });
  }

  // ── Entitlements ──
  getEntitlements(orgId: number): Observable<any> {
    return this.http.get(this.urls.orgEntitlements.replace('{id}', orgId), { withCredentials: true });
  }

  getUsage(orgId: number): Observable<any> {
    return this.http.get(this.urls.orgUsage.replace('{id}', orgId), { withCredentials: true });
  }

  // ── Roles ──
  getRoles(): Observable<any> {
    return this.http.get(this.roleUrls.roles, { withCredentials: true });
  }

  getRoleAssignments(scopeType: string, scopeId: number): Observable<any> {
    const params = new HttpParams().set('scope_type', scopeType).set('scope_id', scopeId);
    return this.http.get(this.roleUrls.roleAssignments, { params, withCredentials: true });
  }

  assignRole(data: any): Observable<any> {
    return this.http.post(this.roleUrls.roleAssignments, data, { withCredentials: true });
  }
}
