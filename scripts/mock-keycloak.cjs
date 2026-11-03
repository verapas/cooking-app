// Mock-Keycloak für den lokalen Admin-E2E-Test: emuliert die beiden
// Endpunkte, die keycloakAdmin.ts benutzt (Token + User-Create).
const http = require('http');

const created = new Map(); // username -> sub
let counter = 0;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/realms/test/protocol/openid-connect/token') {
      if (!body.includes('client_id=mock-admin') || !body.includes('grant_type=client_credentials')) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end('{"error":"invalid_request"}');
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ access_token: 'mock-token-abc', expires_in: 300, token_type: 'Bearer' }));
    }
    if (req.method === 'POST' && req.url === '/admin/realms/test/users') {
      if (req.headers.authorization !== 'Bearer mock-token-abc') {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end('{"error":"unauthorized"}');
      }
      const user = JSON.parse(body || '{}');
      if (!user.username) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end('{"errorMessage":"User name is missing"}');
      }
      if (created.has(user.username)) {
        res.writeHead(409, { 'content-type': 'application/json' });
        return res.end('{"errorMessage":"User exists with same username"}');
      }
      const sub = `mock-sub-${++counter}-${user.username}`;
      created.set(user.username, sub);
      res.writeHead(201, { location: `http://localhost:9999/admin/realms/test/users/${sub}` });
      return res.end();
    }
    res.writeHead(404);
    res.end('not found');
  });
});

server.listen(9999, () => console.log('Mock-Keycloak auf :9999'));
