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
    schema: ''
  };
}

function parseOracleConnectionString(value: string): ConnectionDetails | null {
  const jdbcUrl = value.match(/^jdbc:oracle:thin:(?:(?<username>[^/]+)\/(?<password>[^@]*)@)?@?\/\/(?<host>[^:/?#]+)(?::(?<port>\d+))?\/(?<database>[^?;]+)/i);
  const sidUrl = value.match(/^jdbc:oracle:thin:@?(?<host>[^:/?#]+)(?::(?<port>\d+))?:(?<database>[^?;]+)/i);

  if (jdbcUrl?.groups || sidUrl?.groups) {
    const groups = jdbcUrl?.groups ?? sidUrl!.groups!;
    const username = decodeValue(groups['username'] ?? '');
    return {
      host: groups['host'],
      port: Number(groups['port'] || 1521),
      database: decodeValue(groups['database']),
      username,
      password: decodeValue(groups['password'] ?? ''),
      schema: username || ''
    };
  }

  if (value.toLowerCase().startsWith('oracle://')) {
    const details = parseUriConnectionString(value);
    if (details) {
      details.port = details.port || 1521;
      details.schema = details.username || '';
    }
    return details;
  }

  return null;
}

function parseUriConnectionString(value: string, defaultSchema = ''): ConnectionDetails | null {
  const urlValue = value.replace(/^jdbc:/i, '').trim();
  const schemeMatch = urlValue.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (!schemeMatch) return null;

  const scheme = schemeMatch[1].toLowerCase();
  const authorityAndPath = schemeMatch[2];

  const pathStart = authorityAndPath.search(/[/?#]/);
  const authority = pathStart === -1 ? authorityAndPath : authorityAndPath.slice(0, pathStart);
  const restPath = pathStart === -1 ? '' : authorityAndPath.slice(pathStart);

  let username = '';
  let password = '';
  let hostPort = authority;

  const lastAtIndex = authority.lastIndexOf('@');
  if (lastAtIndex !== -1) {
    const userInfo = authority.slice(0, lastAtIndex);
    hostPort = authority.slice(lastAtIndex + 1);
    const colonIndex = userInfo.indexOf(':');
    if (colonIndex !== -1) {
      username = decodeValue(userInfo.slice(0, colonIndex));
      password = decodeValue(userInfo.slice(colonIndex + 1));
    } else {
      username = decodeValue(userInfo);
    }
  }

  const [host, portStr] = hostPort.split(':');
  if (!host) return null;

  const defaultPort = (scheme === 'mysql' || scheme === 'mariadb') ? 3306 : (scheme === 'oracle' ? 1521 : 5432);
  const port = portStr ? parseInt(portStr, 10) : defaultPort;

  const queryIndex = restPath.indexOf('?');
  const pathPart = queryIndex === -1 ? restPath : restPath.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? '' : restPath.slice(queryIndex + 1);

  const pathSegments = pathPart.split('/').filter(Boolean);
  const database = pathSegments[0] ? decodeValue(pathSegments[0]) : '';

  const searchParams = new URLSearchParams(queryString);
  const schema = searchParams.get('schemas') || searchParams.get('schema') || defaultSchema;

  return {
    host,
    port: Number.isFinite(port) ? port : defaultPort,
    database,
    username,
    password,
    schema
  };
}

export const DB_TYPE_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  mssql: 'SQL Server (MSSQL)',
  oracle: 'Oracle',
  sqlite: 'SQLite'
};

export function detectUrlSchemeInfo(value: string): {
  detectedType: 'postgres' | 'mysql' | 'mariadb' | 'mssql' | 'oracle' | 'other' | null;
  displayScheme: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { detectedType: null, displayScheme: null };
  }

  // Check SQL Server ADO.NET / key-value format (Server=... or Data Source=...)
  if (/(?:^|;)\s*(?:Server|Data Source|ServerName|DataSource)\s*=/i.test(trimmed)) {
    return { detectedType: 'mssql', displayScheme: 'SQL Server' };
  }

  // Check Oracle JDBC thin URL (jdbc:oracle:thin:...)
  if (/^jdbc:oracle:/i.test(trimmed)) {
    return { detectedType: 'oracle', displayScheme: 'Oracle' };
  }

  // Check generic URI scheme: scheme://... (with optional jdbc: prefix)
  const normalized = trimmed.replace(/^jdbc:/i, '');
  const match = normalized.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (!match) {
    return { detectedType: null, displayScheme: null };
  }

  const scheme = match[1].toLowerCase();

  if (scheme === 'databasetype') {
    return { detectedType: null, displayScheme: null };
  }

  if (scheme === 'postgresql' || scheme === 'postgres') {
    return { detectedType: 'postgres', displayScheme: 'PostgreSQL' };
  }

  if (scheme === 'mysql') {
    return { detectedType: 'mysql', displayScheme: 'MySQL' };
  }

  if (scheme === 'mariadb') {
    return { detectedType: 'mariadb', displayScheme: 'MariaDB' };
  }

  if (scheme === 'mssql' || scheme === 'sqlserver') {
    return { detectedType: 'mssql', displayScheme: 'SQL Server' };
  }

  if (scheme === 'oracle') {
    return { detectedType: 'oracle', displayScheme: 'Oracle' };
  }

  return { detectedType: 'other', displayScheme: scheme.toUpperCase() };
}

export function isSchemeCompatibleWithDatabaseType(
  detectedType: 'postgres' | 'mysql' | 'mariadb' | 'mssql' | 'oracle' | 'other' | null,
  selectedType: string
): boolean {
  if (!detectedType) {
    return true;
  }

  if (selectedType === 'postgres') {
    return detectedType === 'postgres';
  }

  if (selectedType === 'mysql') {
    return detectedType === 'mysql';
  }

  if (selectedType === 'mariadb') {
    return detectedType === 'mariadb' || detectedType === 'mysql';
  }

  if (selectedType === 'mssql') {
    return detectedType === 'mssql';
  }

  if (selectedType === 'oracle') {
    return detectedType === 'oracle';
  }

  return false;
}

export function getConnectionUrlMismatchError(
  value: string,
  selectedType: string
): string | null {
  const { detectedType, displayScheme } = detectUrlSchemeInfo(value);
  if (!detectedType) return null;

  if (!isSchemeCompatibleWithDatabaseType(detectedType, selectedType)) {
    const selectedLabel = DB_TYPE_LABELS[selectedType] || selectedType;
    if (displayScheme) {
      return `The connection URL scheme (${displayScheme}) does not match the selected database type (${selectedLabel}).`;
    }
    return `The connection URL does not match the selected database type (${selectedLabel}).`;
  }

  return null;
}

export function parseConnectionDetails(value: string, databaseType: 'postgres' | 'mysql' | 'mariadb' | 'mssql' | 'sqlite' | 'oracle'): ConnectionDetails | null {
  const raw = value.trim();
  if (!raw || databaseType === 'sqlite') return null;

  if (databaseType === 'mssql' || raw.toLowerCase().startsWith('server=') || raw.toLowerCase().startsWith('data source=')) {
    if (raw.toLowerCase().startsWith('server=') || raw.toLowerCase().startsWith('data source=')) {
      return parseSqlServerConnectionString(raw);
    }
    const uriMatch = raw.replace(/^jdbc:/i, '').toLowerCase();
    if (uriMatch.startsWith('mssql://') || uriMatch.startsWith('sqlserver://') || uriMatch.startsWith('databasetype://')) {
      const details = parseUriConnectionString(raw, '');
      if (details) {
        details.port = details.port || 1433;
      }
      return details;
    }
    return parseSqlServerConnectionString(raw);
  }

  if (databaseType === 'oracle') {
    return parseOracleConnectionString(raw);
  }

  const uriValue = raw.replace(/^jdbc:/i, '');
  if (databaseType === 'postgres') {
    if (!uriValue.toLowerCase().startsWith('postgresql://') && !uriValue.toLowerCase().startsWith('postgres://') && !uriValue.toLowerCase().startsWith('databasetype://')) {
      return null;
    }
  } else if (databaseType === 'mysql') {
    if (!uriValue.toLowerCase().startsWith('mysql://') && !uriValue.toLowerCase().startsWith('databasetype://')) {
      return null;
    }
  } else if (databaseType === 'mariadb') {
    if (!uriValue.toLowerCase().startsWith('mariadb://') && !uriValue.toLowerCase().startsWith('mysql://') && !uriValue.toLowerCase().startsWith('databasetype://')) {
      return null;
    }
  }

  return parseUriConnectionString(raw, '');
}
