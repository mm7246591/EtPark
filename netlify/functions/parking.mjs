import { handleNationalParking } from '../../server/national-parking.mjs';

const handler = async (request) => {
  let status = 200;
  let headers = {};
  let body = '';
  const response = {
    writeHead: (code, values = {}) => {
      status = code;
      headers = values;
      return response;
    },
    end: (value = '') => {
      body = value;
    },
  };
  await handleNationalParking(
    { method: request.method, url: request.url },
    response
  );
  return new Response(body, { status, headers });
};

export default handler;
