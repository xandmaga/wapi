const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrTerminal = require('qrcode-terminal');
const axios = require('axios');
const { logger } = require('./logger');

const IMAGE_MIMES = ['image/png', 'image/jpg', 'image/jpeg', 'image/bmp', 'image/webp'];
const EMOJIS = ['👍', '✅', '💡', '🙂', '🐬', '🚀', '⭐', '🙏🏻'];
const USER_DATA_PATH = process.env.USER_DATA_PATH;

const createClient = (db, isDockerized = false) => {

    const postOptions = {}

    // use custom path to user data directory if provided
    logger.info(`USER_DATA_PATH = ${USER_DATA_PATH}`);
    if (USER_DATA_PATH) {
        postOptions.authStrategy = new LocalAuth({
            dataPath: USER_DATA_PATH,
        });
    } else {
        postOptions.authStrategy = new LocalAuth();
    }

    // add postOptions when running inside docker
    logger.info(`dockerized = ${isDockerized}`);
    if (isDockerized) {
        postOptions['puppeteer'] = {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
    }

    const client = new Client(postOptions);

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        client.qr = qr;

    });

    client.on('ready', async () => {
        const state = await client.getState();
        logger.info('Client is ' + state);
    });



    client.initialize();

    return client;
}

const sendMessageAsync = async (client, input) => {
    try {
        if (!input.message) throw `missing message`;
        logger.info(input);

        // adjust destination number's format
        let chatId = input.number;
        logger.info(chatId);
        if (!chatId.endsWith('.us')) {
            chatId += isNaN(chatId) ? '@g.us' : '@c.us';
        }

        // prepare and send message
        const message = input.message;
        const attachments = input.attachments;
            // otherwise, send message normally
        await client.sendMessage(chatId, message);
        
    } catch (err) { 
        logger.error(err);
        throw err;
    }
}

module.exports = {
    createClient,
    sendMessageAsync,
}