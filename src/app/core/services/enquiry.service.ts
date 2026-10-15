import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface EnquiryData {
  contact_type?: string;
  project_details?: string;
  first_name: string;
  last_name: string;
  company_email: string;
  phone_number?: string;
  country?: string;
  enquiry_type?: string;
  image_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EnquiryService {
  constructor(private http: HttpClient, private configService: AppConfigService) {}

  private get urls(): any {
    return this.configService.environment?.enquiryApiUrls || {};
  }

  private get baseUrl(): string {
    return this.configService.environment?.apiConfig?.baseUrl || '';
  }

  submitEnquiry(data: EnquiryData): Observable<any> {
    const url = this.urls.submitEnquiry || `${this.baseUrl}/api/enquiry`;
    return this.http.post<any>(url, data, { withCredentials: true });
  }

  getMyEnquiries(): Observable<any> {
    const url = this.urls.myEnquiries || `${this.baseUrl}/api/enquiry/my-enquiries`;
    return this.http.get<any>(url, { withCredentials: true });
  }

  updateEnquiryStatus(id: number | string, status: string): Observable<any> {
    const template = this.urls.updateEnquiry || `${this.baseUrl}/api/enquiry/{id}`;
    const url = template.replace('{id}', id.toString()).replace(':id', id.toString());
    return this.http.put<any>(url, { status }, { withCredentials: true }).pipe(
      catchError(() => this.http.patch<any>(url, { status }, { withCredentials: true }))
    );
  }
}
