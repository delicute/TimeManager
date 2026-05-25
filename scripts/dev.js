/**
 * Dev script: starts Vite dev server and Electron concurrently.
 * Based on https://vitejs.dev/guide/backend-integration.html
 */
const { spawn } = require('child_process');
const { createServer } = require('vite');

async function start() {
  // Start Vite dev server
  const server = await createServer({
    server: { port: 5173 },
  });
  await server.listen();

  const address = server.httpServer.address();
  const url = typeof address === 'object' ? `http://localhost:${address.port}` : 'http://localhost:5173';

  console.log(`\n  Vite dev server running at: ${url}\n`);

  // Build electron main process
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.node.json'], {
    stdio: 'inherit',
    shell: true,
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error('TypeScript compilation failed');
      server.close();
      process.exit(1);
    }

    // Start Electron
    const electron = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: url,
      },
    });

    electron.on('close', () => {
      server.close();
      process.exit(0);
    });
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
