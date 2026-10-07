export interface ConnectionDetails {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema: string;
}

const SQL_SERVER_KEY_PATTERN = /(?:^|;)(?:Server|Data Source|ServerName|DataSource)\s*=\s*([^;]+)(?=;|$)/i;
const SQL_SERVER_PORT_PATTERN = /(?:^|,)\s*(\d{1,5})(?=\s*(?:;|$))/;

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

function parseSqlServerConnectionString(value: string): ConnectionDetails | null {
  const serverValue = value.match(SQL_SERVER_KEY_PATTERN)?.[1]?.trim();
  if (!serverValue) return null;

  const [hostPart, portPart] = serverValue.split(',');
  const host = hostPart?.trim() || '';
  const port = portPart ? Number(portPart.trim()) : 1433;
  const database = (value.match(/(?:^|;)Database\s*=\s*([^;]+)/i)?.[1] ?? value.match(/(?:^|;)Initial Catalog\s*=\s*([^;]+)/i)?.[1] ?? '').trim();
  const username = (value.match(/(?:^|;)User Id\s*=\s*([^;]+)/i)?.[1] ?? value.match(/(?:^|;)User\s*=\s*([^;]+)/i)?.[1] ?? '').trim();
  const password = (value.match(/(?:^|;)Password\s*=\s*([^;]+)/i)?.[1] ?? '').trim();

  if (!host) return null;

  return {
    host,
    port: Number.isFinite(port) ? port : 1433,
    database,
    username,
    password,
    schema: 'public'
  };
}

function parseUriConnectionString(value: string): ConnectionDetails | null {
  const urlValue = value.replace(/^jdbc:/i, '');
  const schemeMatch = urlValue.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (!schemeMatch) return null;

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }

  const host = url.hostname;
  const port = url.port ? Number(url.port) : (url.protocol === 'mysql:' ? 3306 : 5432);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const database = pathParts[0] ? decodeValue(pathParts[0]) : '';
  if (!host) return null;

  const username = url.username ? decodeValue(url.username) : '';
  const password = url.password ? decodeValue(url.password) : '';
  const schema = url.searchParams.get('schemas') || url.searchParams.get('schema') || 'public';

  return {
    host,
    port,
    database,
    username,
    password,
    schema
  };
}

export function parseConnectionDetails(value: string, databaseType: 'postgres' | 'mysql' | 'mssql' | 'sqlite'): ConnectionDetails | null {
  const raw = value.trim();
  if (!raw || databaseType === 'sqlite') return null;

  if (databaseType === 'mssql' || raw.toLowerCase().startsWith('server=') || raw.toLowerCase().startsWith('data source=')) {
    return parseSqlServerConnectionString(raw);
  }

  const uriValue = raw.replace(/^jdbc:/i, '');
  if (databaseType === 'postgres') {
    if (!uriValue.toLowerCase().startsWith('postgresql://') && !uriValue.toLowerCase().startsWith('postgres://')) {
      return null;
    }
  } else if (databaseType === 'mysql') {
    if (!uriValue.toLowerCase().startsWith('mysql://')) {
      return null;
    }
  }

  return parseUriConnectionString(raw);
}
