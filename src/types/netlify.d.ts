declare module '*netlify/functions/parking.mjs' {
  const handler: (request: Request) => Promise<Response>;
  const config: {
    path: string;
    rateLimit: {
      action: 'rate_limit';
      windowLimit: number;
      windowSize: number;
      aggregateBy: ('ip' | 'domain')[];
    };
  };
  export { config };
  export default handler;
}
