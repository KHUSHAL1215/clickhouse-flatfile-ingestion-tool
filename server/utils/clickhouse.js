import { createClient } from '@clickhouse/client';



export function getClickHouseClient({ host, port, username, password }) {
  // Trimed inputs 
  host = host.trim();
  port = port.trim?.() || port; // In case port is passed as string
  username = username?.trim() || 'default';
  password = password?.trim();

  const isSecurePort = [8443, 9440].includes(Number(port));
  const protocol = isSecurePort ? 'https' : 'http';

  // Construct the URL
  let url;
  if (host.startsWith('http://') || host.startsWith('https://')) {
    url = `${host}:${port}`;
  } else {
    url = `${protocol}://${host}:${port}`;
  }

  return createClient({
    url,
    username,
    password,
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
    tls: {
      reject_unauthorized: false,
    },
    application: 'data-ingestion-tool',
    compression: {
      response: true,
      request: true
    }
  });
}


