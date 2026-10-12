import { createServer } from 'node:http';
import { handleNationalParking } from './national-parking.mjs';

const endpoints = {
  '/api/parking/description': 'TCMSV_alldesc.json',
  '/api/parking/availability': 'TCMSV_allavailable.json',
};
const cache = new Map();
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/api/parking/city') {
    await handleNationalParking(request, response);
    return;
  }
  const file = endpoints[path];
  if (request.method !== 'GET' || !file) {
    response.writeHead(404).end();
    return;
  }
  try {
    let entry = cache.get(path);
    if (!entry || entry.expires < Date.now()) {
      const upstream = await fetch(
        `https://tcgbusfs.blob.core.windows.net/blobtcmsv/${file}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
      entry = {
        body: await upstream.text(),
        expires: Date.now() + (path.endsWith('description') ? 300000 : 60000),
      };
      cache.set(path, entry);
    }
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(entry.body);
  } catch {
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'Parking upstream unavailable' }));
  }
}).listen(Number(process.env.PORT || 3001), '127.0.0.1');
