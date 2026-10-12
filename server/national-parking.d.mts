import type { IncomingMessage, ServerResponse } from 'node:http';
declare const handleNationalParking: (request: IncomingMessage, response: ServerResponse, env?: Record<string, string | undefined>) => Promise<void>;
export { handleNationalParking };
