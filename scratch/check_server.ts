import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/',
  method: 'GET'
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  process.exit(0);
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
  process.exit(1);
});

req.end();
