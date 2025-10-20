const http = require('node:http');
const handleRequest = require('./app');

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = server;
