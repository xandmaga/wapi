const qrImage = require('qr-image');
const express = require('express');

const createApp = (client, logger = console) => { 
    const app = express();
    const START_DATE = new Date();
    
    app.use(express.json({ limit: '100mb' }));


    app.get('/', async function(_req, res) {
        const now = new Date();
        res.json({
            systemTime: now,
            uptimeSec: Math.round((now.getTime() - START_DATE.getTime()) / 1000),
        });
    });

    //create a route to health check
    app.get('/health', async function(_req, res) {
        res.status(200).json({ status: 'ok' });
    });

    app.get('/authenticated', async function(_req, res) {
        res.status(200).json({ authenticated: client.isAuthenticated });
    });

    app.get('/ready', async function(_req, res) {
        res.status(200).json({ ready: client.isReady });
    });

    app.get('/connected', async function(_req, res) {
        try {
            const state = await client.getState();
            if (state == 'CONNECTED') {
                res.status(200).json({ connected: true });
            } else {
                res.status(200).json({ connected: false });
            }
        } catch (err) {
            logger.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/qr', async function(_req, res) {
        const state = await client.getState();
        logger.info(`client state is ${state}`);
        if (state == 'CONNECTED') {
            res.status(200).json(
                {   
                    isConnected: true,
                    message: `Already linked to ${client.info.wid.user}`
                }
            );
        } else if (!client.qr) {
            res.status(404).json({ error: 'No QR found' });
        } else {
            let stream = qrImage.image(client.qr, { type: 'png', ec_level: 'H', size: 5, margin: 0 });
            res.setHeader('Content-type', 'image/png');
            res.status(200);
            stream.pipe(res);
        }
    });

    app.get('/contacts/:id', async function(req, res) {
        try {
            const contactId = req.params.id;
            const contact = await client.getContactById(contactId);
            res.json(contact);
        } catch (err) {
            logger.error(err);
            res.status(400).json({ error: err.message });
        }
    });

    app.post('/send', async function(req, res) {
        try {
            let number;
            let message;

            if (req.body.phoneNumber && req.body.message) {
                number = req.body.phoneNumber;
                message = req.body.message;
            } else {
                return res.status(400).json({ error: 'Phone and message are required' });
            }

            await client.sendMessage(number, message);
            res.json({
                message: `Message to ${number} is successfully queued`,
            });
            logger.info(`Message to ${number} is successfully queued`);
        } catch (err) {
            logger.error('Error in /send route:', err);
            res.status(500).json({ error: err.message, stack: err.stack });
        }
    });

    app.get('/groups', async function(_req, res) {
        try {
            const state = await client.getState();
            if (state != 'CONNECTED') throw `client state is ` + state;
            const chats = await client.getChats();
            const groups = chats
                .filter(chat => chat.isGroup)
                .map(chat => {
                    return {
                        id: chat.id._serialized,
                        name: chat.name
                    }
                });
            res.json(groups);
        } catch (err) {
            logger.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/test', async function(req, res) {
        try {
            logger.info('/test invoked:' + JSON.stringify(req.body));
            res.json(req.body);
        } catch (err) {
            logger.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    return app;
}

module.exports = {
    createApp
}
