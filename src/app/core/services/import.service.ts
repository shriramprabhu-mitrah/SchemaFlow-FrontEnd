import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';
import { AppConfigService } from './app-config.service';

export type SqlDialect = 'postgres' | 'mysql' | 'sqlserver' | 'oracle' | 'sqlite' | 'mongodb';

export interface ImportRequest {
  databaseType: string;
  sqlQuery: string;
}

export interface ValidateRequest {
  databaseType: string;
  sqlQuery: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImportService {

  private readonly databaseTypeMap: Record<SqlDialect, string> = {
    postgres: 'Postgres',
    mysql: 'Mysql',
    sqlserver: 'SqlServer',
    sqlite: 'Sqlite',
    oracle: 'Oracle',
    mongodb: 'MongoDB'
  };

  constructor(
    private http: HttpClient,
    private appConfig: AppConfigService
  ) {}

  /**
   * Validates schema script (SQL or NoSQL/MongoDB)
   */
  validate(dialect: SqlDialect, sqlScript: string): Observable<string> {
    const url = this.appConfig.environment?.importExportApiUrls?.validateSql ?? '';

    const body: ValidateRequest = {
      databaseType: this.databaseTypeMap[dialect] || 'Postgres',
      sqlQuery: sqlScript
    };

    if (dialect === 'mongodb') {
      return this.http.post(url, body, { responseType: 'text' }).pipe(
        catchError(() => of(this.validateMongoLocal(sqlScript)))
      );
    }

    return this.http.post(url, body, { responseType: 'text' });
  }

  /**
   * Converts schema script (SQL or NoSQL/MongoDB) to DBML
   */
  convert(diagramId: string | number, dialect: SqlDialect, sqlScript: string): Observable<string> {
    const url = this.appConfig.environment?.importExportApiUrls?.import ?? '';

    const body: ImportRequest = {
      databaseType: this.databaseTypeMap[dialect] || 'Postgres',
      sqlQuery: sqlScript
    };

    if (dialect === 'mongodb') {
      return this.http.post(url, body, { responseType: 'text' }).pipe(
        catchError(() => of(this.convertMongoToDbmlLocal(sqlScript)))
      );
    }

    return this.http.post(url, body, { responseType: 'text' });
  }

  /**
   * Internal validator for NoSQL/MongoDB inputs
   */
  private validateMongoLocal(script: string): string {
    const trimmed = script.trim();
    if (!trimmed) {
      return JSON.stringify({ data: { dbml: { isValid: false, errors: ['Input cannot be empty.'] } } });
    }
    try {
      this.parseMongoToDbml(trimmed);
      return JSON.stringify({ data: { dbml: { isValid: true } } });
    } catch (e: any) {
      return JSON.stringify({
        data: {
          dbml: {
            isValid: false,
            errors: [e.message || 'Invalid MongoDB, Mongoose, or JSON format.']
          }
        }
      });
    }
  }

  /**
   * Internal converter fallback for NoSQL/MongoDB inputs
   */
  private convertMongoToDbmlLocal(script: string): string {
    const dbml = this.parseMongoToDbml(script.trim());
    return JSON.stringify({ data: { diagramdbml: dbml } });
  }

  /**
   * Parses Mongoose code, MongoDB validator, or JSON into DBML
   */
  private parseMongoToDbml(input: string): string {
    // 1. Mongoose Schema code
    if (input.includes('new Schema') || input.includes('mongoose.Schema') || input.includes('Schema({')) {
      const tables: string[] = [];
      const refs: string[] = [];
      const schemaRegex = /(?:(?:const|let|var)\s+([A-Za-z0-9_]+)Schema\s*=\s*(?:new\s+)?(?:mongoose\.)?Schema\s*\(\s*\{([\s\S]*?)\}\s*(?:,\s*\{[\s\S]*?\})?\s*\)|mongoose\.model\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*(?:new\s+)?(?:mongoose\.)?Schema\s*\(\s*\{([\s\S]*?)\}\s*\))/gi;

      let match: RegExpExecArray | null;
      while ((match = schemaRegex.exec(input)) !== null) {
        const rawName = match[1] || match[3] || 'Model';
        const tableName = rawName.toLowerCase().endsWith('s') ? rawName.toLowerCase() : `${rawName.toLowerCase()}s`;
        const body = match[2] || match[4] || '';

        const cols: string[] = ['  _id objectId [pk]'];
        const fieldRegex = /([A-Za-z0-9_]+)\s*:\s*(?:\{([^}]*)\}|([A-Za-z0-9_.\[\]]+))/g;
        let fm: RegExpExecArray | null;

        while ((fm = fieldRegex.exec(body)) !== null) {
          const colName = fm[1];
          if (colName === '_id') continue;
          const fullObj = fm[2];
          const simpleType = fm[3];

          let typeStr = 'varchar';
          let req = false;
          let uniq = false;
          let refTarget: string | undefined;

          if (fullObj) {
            const tm = fullObj.match(/type\s*:\s*([A-Za-z0-9_.\[\]]+)/i);
            const rm = fullObj.match(/ref\s*:\s*['"]([A-Za-z0-9_]+)['"]/i);
            req = /required\s*:\s*(true|\[true)/i.test(fullObj);
            uniq = /unique\s*:\s*true/i.test(fullObj);
            if (rm) refTarget = rm[1];
            const rawType = tm ? tm[1] : 'String';
            if (rawType.includes('ObjectId')) typeStr = 'objectId';
            else if (rawType.includes('Number')) typeStr = 'decimal';
            else if (rawType.includes('Boolean')) typeStr = 'boolean';
            else if (rawType.includes('Date')) typeStr = 'timestamp';
            else if (rawType.includes('Mixed') || rawType === 'Object') typeStr = 'json';
          } else if (simpleType) {
            if (simpleType.includes('ObjectId')) typeStr = 'objectId';
            else if (simpleType.includes('Number')) typeStr = 'decimal';
            else if (simpleType.includes('Boolean')) typeStr = 'boolean';
            else if (simpleType.includes('Date')) typeStr = 'timestamp';
          }

          const attrs: string[] = [];
          if (req) attrs.push('not null');
          if (uniq) attrs.push('unique');
          cols.push(`  ${colName} ${typeStr}${attrs.length ? ` [${attrs.join(', ')}]` : ''}`);

          if (refTarget) {
            const targetTable = refTarget.toLowerCase().endsWith('s') ? refTarget.toLowerCase() : `${refTarget.toLowerCase()}s`;
            refs.push(`Ref: ${tableName}.${colName} > ${targetTable}._id`);
          }
        }
        tables.push(`Table ${tableName} {\n${cols.join('\n')}\n}`);
      }

      if (tables.length > 0) {
        return tables.join('\n\n') + (refs.length ? '\n\n' + refs.join('\n') : '');
      }
    }

    // 2. JSON or MongoDB $jsonSchema
    let parsed: any;
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = new Function(`return (${input});`)();
    }

    // 2. SchemaFlow/MongoDB Export format: { database?: string, collections: [...] }
    if (parsed?.collections && Array.isArray(parsed.collections)) {
      const tables: string[] = [];
      for (const col of parsed.collections) {
        const colName = col.name || 'collection';
        const cols: string[] = [];
        if (Array.isArray(col.fields)) {
          for (const field of col.fields) {
            const isPk = field.primary || field.name === '_id' || field.name === 'id';
            let typeStr = (field.type || 'varchar').toLowerCase();
            if (typeStr === 'string') typeStr = 'varchar';
            else if (typeStr === 'number') typeStr = 'decimal';
            const attrs: string[] = [];
            if (isPk) attrs.push('pk');
            if (field.required && !isPk) attrs.push('not null');
            if (field.unique && !isPk) attrs.push('unique');
            cols.push(`  ${field.name} ${typeStr}${attrs.length ? ` [${attrs.join(', ')}]` : ''}`);
          }
        }
        tables.push(`Table ${colName} {\n${cols.join('\n')}\n}`);
      }
      if (tables.length > 0) {
        return tables.join('\n\n');
      }
    }

    // 3. MongoDB $jsonSchema
    const schemaObj = parsed?.$jsonSchema || parsed?.validator?.$jsonSchema;
    if (schemaObj?.properties) {
      const colName = schemaObj.title || 'collection';
      const cols: string[] = [];
      const reqSet = new Set(schemaObj.required || []);
      for (const [key, prop] of Object.entries<any>(schemaObj.properties)) {
        const isPk = key === '_id' || key === 'id';
        const typeStr = prop.bsonType || prop.type || 'varchar';
        const attrs: string[] = [];
        if (isPk) attrs.push('pk');
        if (reqSet.has(key) && !isPk) attrs.push('not null');
        cols.push(`  ${key} ${typeStr}${attrs.length ? ` [${attrs.join(', ')}]` : ''}`);
      }
      return `Table ${colName} {\n${cols.join('\n')}\n}`;
    }

    // 3. Raw JSON Sample Data
    const docs = Array.isArray(parsed) ? parsed : (typeof parsed === 'object' ? [parsed] : []);
    if (docs.length > 0) {
      const cols: string[] = [];
      const sample = docs[0];
      for (const [k, v] of Object.entries(sample)) {
        let t = 'varchar';
        if (typeof v === 'number') t = Number.isInteger(v) ? 'int' : 'decimal';
        else if (typeof v === 'boolean') t = 'boolean';
        else if (Array.isArray(v)) t = 'array';
        else if (typeof v === 'object' && v !== null) t = 'json';
        else if (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) t = 'objectId';

        const isPk = k === '_id' || k === 'id';
        cols.push(`  ${k} ${t}${isPk ? ' [pk]' : ''}`);
      }
      return `Table documents {\n${cols.join('\n')}\n}`;
    }

    throw new Error('Unable to parse NoSQL input. Provide valid Mongoose, MongoDB validator, or JSON document.');
  }
}