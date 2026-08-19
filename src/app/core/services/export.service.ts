import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

export type SqlDialect = 'postgres' | 'mysql' | 'sqlserver' | 'oracle';

export interface ExportRequest {
  databaseType: string;
  dbmlScript: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  private readonly databaseTypeMap: Record<SqlDialect, string> = {
    postgres: 'Postgres',
    mysql: 'Mysql',
    sqlserver: 'SqlServer',
    oracle: 'Oracle'
  };

  constructor(private http: HttpClient, private appConfig: AppConfigService) {}

 
  convert(diagramId: string | number, dialect: SqlDialect, dbmlScript: string): Observable<string> {
    const url = this.appConfig.environment?.importExportApiUrls?.export?.replace('{id}', diagramId.toString()) ?? '';

    const body: ExportRequest = {
      databaseType: this.databaseTypeMap[dialect],
      dbmlScript
    };

    return this.http.post(url, body, { responseType: 'text' });
  }

 downloadSqlFile(sql: string, dialect: SqlDialect): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([sql], { type: 'text/plain;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schema_${dialect}.sql`;
  document.body.appendChild(a);   // add
  a.click();
  document.body.removeChild(a);   // clean up
  URL.revokeObjectURL(url);
}
}
