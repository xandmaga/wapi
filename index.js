const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { logger } = require('./logger');
const { createClient } = require('./client');
const { createApp } = require('./app');
const net = require('net');

// Use process.pkg to determine if we're running from packaged exe
const isPackaged = typeof process.pkg !== 'undefined';

// Helper function to get the correct path
function getAssetPath(filename) {
  return isPackaged
    ? path.join(process.cwd(), filename)
    : path.join(__dirname, filename);
}

const CHROMIUM_PATH_MACOS = path.join('Chromium.app/Contents/MacOS/Chromium');
const CONFIG_PATH = getAssetPath('config.json');
const CHROMIUM_PATH = getAssetPath(path.join('chromium', process.platform === 'win32' ? 'Chromium.exe' : process.platform === 'darwin' ? CHROMIUM_PATH_MACOS : 'Chromium'));
const USER_DATA_PATH = path.join(__dirname, '.wwebjs_auth');

let config;
try {
    const configContent = fs.readFileSync(CONFIG_PATH);
    config = JSON.parse(configContent);
} catch (error) {
    logger.error(`Failed to read config file: ${error}`);
    config = { port: 3000, user: 'user', password: 'secret' }; // Default configuration
}

const port = config.port || 3000;
const dockerized = false;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

async function Main() {
    if (await isPortInUse(3000)) {
        console.log('Port 3000 is already in use. Exiting...');
        process.exit(1);
    }

    try {
        const client = await createClient(dockerized, CHROMIUM_PATH, isPackaged);
        const app = createApp(client, logger);
        
        // Create HTTP server
        const server = http.createServer(app);

        // Create WebSocket server
        const wss = new WebSocket.Server({ server });

        // WebSocket connection handler
        wss.on('connection', (ws) => {
            logger.info('New WebSocket connection');

            // Send current QR code if available
            if (client.qr) {
                ws.send(JSON.stringify({ type: 'qr', data: client.qr }));
            }

            // Handle WebSocket connection close
            ws.on('close', () => {
                logger.info('WebSocket connection closed');
            });
        });

        // Modify the client's QR event to broadcast to all connected WebSocket clients
        client.on('qr', (qr) => {
            client.qr = qr;
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'qr', data: qr }));
                }
            });
        });

        // Start the server
        server.listen(port, () => {
            logger.info(`Server listening on port ${port}`);
        });

        // Error handling for server
        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.log('Address already in use, retrying...');
            setTimeout(() => {
              server.close();
              server.listen(port);
            }, 1000);
          } else {
            console.error('Server error:', error);
          }
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error}`);
    }
}

Main();