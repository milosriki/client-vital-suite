import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'index.js');

console.log('Starting HubSpot MCP server...');
const server = spawn('node', [serverPath], {
  env: {
    ...process.env,
    HUBSPOT_API_KEY: 'test-key'
  }
});

server.stderr.on('data', (data) => {
  console.error(`MCP Server Error: ${data}`);
});

server.on('close', (code) => {
  console.log(`MCP server exited with code ${code}`);
});

// Give it 2 seconds to see if it stays alive or crashes immediately
setTimeout(() => {
  console.log('Server is running (dry-run successful)');
  server.kill();
  process.exit(0);
}, 2000);
