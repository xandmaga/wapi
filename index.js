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
const CHROMIUM_PATH = getAssetPath(path.join('chromium', process.platform === 'win32' ? 'chrome.exe' : process.platform === 'darwin' ? CHROMIUM_PATH_MACOS : 'Chromium'));
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
        console.log('Porta 3000 já está sendo utilizada. Saindo...');
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
            logger.info('Nova conexão WebSocket');

            // Enviar o QR atual se disponível
            if (client.qr) {
                ws.send(JSON.stringify({ type: 'qr', data: client.qr }));
            }

            // Handle WebSocket connection close
            ws.on('close', () => {
                logger.info('Conexão WebSocket fechada');
            });
        });

        // Modificar o evento QR do cliente para enviar para todos os clientes conectados WebSocket
        client.on('qr', (qr) => {
            client.qr = qr;
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'qr', data: qr }));
                }
            });
        });



        client.on('message', async msg => {
          let chat = await client.getChatById(msg.from)
          console.log(`Mensagem ${msg.body} recebida no chat ${chat.name}`)

     });

        // Start the server
        server.listen(port, () => {
            logger.info(`Servidor escutando na porta ${port}`);
        });

        // Error handling for server
        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.log('Porta já em uso, tentando novamente...');
            setTimeout(() => {
              server.close();
              server.listen(port);
            }, 1000);
          } else {
            console.error('Erro do servidor:', error);
          }
        });
    } catch (error) {
        logger.error(`Falha ao iniciar o servidor: ${error}`);
    }
}

Main();