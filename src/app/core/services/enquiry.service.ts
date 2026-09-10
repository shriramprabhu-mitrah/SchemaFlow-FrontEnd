import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface EnquiryData {
  contact_type: 'email_me' | 'book_call';
  project_details?: string;
  first_name: string;
  last_name: string;
  company_email: string;
  phone_number?: string;
  country: string;
}

@Injectable({
  providedIn: 'root'
})
export class EnquiryService {
  private apiUrl: string;

  constructor(private http: HttpClient, private configService: AppConfigService) {
    this.apiUrl = `${this.configService.environment?.apiConfig?.baseUrl || ''}/api/enquiry`;
  }

  submitEnquiry(data: EnquiryData): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, { withCredentials: true });
  }
}
