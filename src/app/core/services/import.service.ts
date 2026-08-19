import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';

export type SqlDialect = 'postgres' | 'mysql' | 'sqlserver' | 'oracle';

export interface ImportRequest {
  databaseType: string;
  sqlQuery: string;   // API expects "sqlQuery" (same as validate endpoint)
}

export interface ValidateRequest {
  databaseType: string;
  sqlQuery: string;   // API expects "sqlQuery", not "sqlScript"
}

@Injectable({
  providedIn: 'root'
})
export class ImportService {

  private readonly databaseTypeMap: Record<SqlDialect, string> = {
    postgres: 'Postgres',
    mysql: 'Mysql',
    sqlserver: 'SqlServer',
    oracle: 'Oracle'
  };

  constructor(private http: HttpClient, private appConfig: AppConfigService) {}

  /**
   * Calls POST {{baseUrl}}/validate/sql
   * Sends databaseType + sqlQuery, returns validation result as raw text.
   * header.ts JSON.parse()s this text itself to read data.isValid / data.errors.
   */
  validate(dialect: SqlDialect, sqlScript: string): Observable<string> {
    const url = this.appConfig.environment?.importExportApiUrls?.validateSql ?? '';

    const body: ValidateRequest = {
      databaseType: this.databaseTypeMap[dialect],
      sqlQuery: sqlScript
    };

    return this.http.post(url, body, { responseType: 'text' });
  }

  /**
   * Calls POST {{baseUrl}}/import/:diagramId
   * Sends databaseType + sqlQuery, returns raw text (may be plain DBML
   * or a JSON envelope containing DBML — header.ts handles both cases
   * via JSON.parse() + fallback deep-search).
   *
   * responseType stays 'text' (not 'json') so that:
   *  - a non-JSON raw DBML response doesn't throw a parse error at the
   *    HttpClient level (the earlier bug we fixed), and
   *  - header.ts's existing try/catch JSON.parse logic keeps working
   *    unchanged for JSON-envelope responses.
   */
  convert(diagramId: string | number, dialect: SqlDialect, sqlScript: string): Observable<string> {
    const url = this.appConfig.environment?.importExportApiUrls?.import ?? '';

    const body: ImportRequest = {
      databaseType: this.databaseTypeMap[dialect],
      sqlQuery: sqlScript
    };

    return this.http.post(url, body, { responseType: 'text' });
  }
}