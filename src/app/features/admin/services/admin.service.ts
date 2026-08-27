import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

  private get urls(): any {
    return this.appConfig.environment?.adminApiUrls || {};
  }

  // ── Dashboard ──
  getDashboard(): Observable<any> {
    return this.http.get(this.urls.dashboard, { withCredentials: true });
  }

  // ── Plans ──
  getPlans(page = 1, limit = 10, search = '', sortColumn = 'display_order', sortAsc = true): Observable<any> {
    let params = new HttpParams().set('page', page).set('limit', limit).set('sortColumn', sortColumn).set('sortAsc', sortAsc);
    if (search) params = params.set('search', search);
    return this.http.get(this.urls.plans, { params, withCredentials: true });
  }

  createPlan(data: any): Observable<any> {
    return this.http.post(this.urls.plans, data, { withCredentials: true });
  }

  updatePlan(id: number, data: any): Observable<any> {
    const url = this.urls.planById.replace('{id}', id);
    return this.http.put(url, data, { withCredentials: true });
  }

  deletePlan(id: number): Observable<any> {
    const url = this.urls.planById.replace('{id}', id);
    return this.http.delete(url, { withCredentials: true });
  }

  getPlanEntitlements(id: number): Observable<any> {
    const url = this.urls.planEntitlements.replace('{id}', id);
    return this.http.get(url, { withCredentials: true });
  }

  updatePlanEntitlements(id: number, entitlements: any[]): Observable<any> {
    const url = this.urls.planEntitlements.replace('{id}', id);
    return this.http.put(url, { entitlements }, { withCredentials: true });
  }

  // ── Features ──
  getFeatures(page = 1, limit = 10, search = '', sortColumn = 'display_order', sortAsc = true): Observable<any> {
    let params = new HttpParams().set('page', page).set('limit', limit).set('sortColumn', sortColumn).set('sortAsc', sortAsc);
    if (search) params = params.set('search', search);
    return this.http.get(this.urls.features, { params, withCredentials: true });
  }

  createFeature(data: any): Observable<any> {
    return this.http.post(this.urls.features, data, { withCredentials: true });
  }

  updateFeature(id: number, data: any): Observable<any> {
    const url = this.urls.featureById.replace('{id}', id);
    return this.http.put(url, data, { withCredentials: true });
  }

  deleteFeature(id: number): Observable<any> {
    const url = this.urls.featureById.replace('{id}', id);
    return this.http.delete(url, { withCredentials: true });
  }

  // ── Organizations ──
  getOrganizations(page = 1, limit = 10, search = '', sortColumn = 'organization_id', sortAsc = false): Observable<any> {
    let params = new HttpParams()
      .set('page', page).set('limit', limit).set('sortColumn', sortColumn).set('sortAsc', sortAsc);
    if (search) params = params.set('search', search);
    return this.http.get(this.urls.organizations, { params, withCredentials: true });
  }

  getOrganization(id: number): Observable<any> {
    const url = this.urls.organizationById.replace('{id}', id);
    return this.http.get(url, { withCredentials: true });
  }

  updateOrganization(id: number, data: any): Observable<any> {
    const url = this.urls.organizationById.replace('{id}', id);
    return this.http.put(url, data, { withCredentials: true });
  }

  overrideSubscription(orgId: number, data: any): Observable<any> {
    const url = this.urls.orgSubscriptionOverride.replace('{id}', orgId);
    return this.http.post(url, data, { withCredentials: true });
  }

  // ── Users ──
  getUsers(page = 1, limit = 10, search = '', sortColumn = 'createddate', sortAsc = false, organization = ''): Observable<any> {
    let params = new HttpParams()
      .set('page', page).set('limit', limit).set('sortColumn', sortColumn).set('sortAsc', sortAsc);
    if (search) params = params.set('search', search);
    if (organization) params = params.set('organization', organization);
    return this.http.get(this.urls.users, { params, withCredentials: true });
  }

  updateUser(id: number, data: any): Observable<any> {
    const url = this.urls.userById.replace('{id}', id);
    return this.http.put(url, data, { withCredentials: true });
  }

  // ── Subscriptions ──
  getSubscriptions(page = 1, limit = 10, status?: string, search = '', sortColumn = 'created_at', sortAsc = false): Observable<any> {
    let params = new HttpParams()
      .set('page', page).set('limit', limit).set('sortColumn', sortColumn).set('sortAsc', sortAsc);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get(this.urls.subscriptions, { params, withCredentials: true });
  }

  // ── Audit Logs ──
  getAuditLogs(page = 1, limit = 20, filters: any = {}, sortColumn = 'created_at', sortAsc = false): Observable<any> {
    let params = new HttpParams()
      .set('page', page).set('limit', limit).set('sortColumn', sortColumn).set('sortAsc', sortAsc);
    Object.keys(filters).forEach(key => {
      if (filters[key]) params = params.set(key, filters[key]);
    });
    return this.http.get(this.urls.auditLogs, { params, withCredentials: true });
  }
}
