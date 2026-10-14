import { createServer } from 'node:http';
import { handleNationalParking } from './national-parking.mjs';

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path !== '/api/parking/city') {
    response.writeHead(404).end();
    return;
  }
  await handleNationalParking(request, response);
}).listen(Number(process.env.PORT || 3001), '127.0.0.1');
