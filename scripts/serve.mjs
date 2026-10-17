import { createPreviewServer } from './server.mjs';

const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
const server = createPreviewServer();
server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Stop the other preview or choose another PORT.` : error.message);
    process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`JobLink is running at http://localhost:${port}`));
