const qrImage = require('qr-image');
const express = require('express');
const { sendMessageAsync } = require('./client');

const createApp = (client, outgoingMessageQueue, config, db, logger = console) => { 
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
            res.status(403).json({ error: `Already linked to ${client.info.wid.user}` });
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

    // Function to validate and format Brazilian phone numbers
    function formatBrazilianPhoneNumber(phoneNumber) {
        // Remove any non-digit characters
        const digitsOnly = phoneNumber.replace(/\D/g, '');

        // Check if it's a valid Brazilian number
        if (digitsOnly.length === 13 && digitsOnly.startsWith('55')) {
            // It's already in the correct format
            return `${digitsOnly}@c.us`;
        } else {        
            // It's not a valid Brazilian number
            logger.error('Formato de número de telefone brasileiro inválido');
            return phoneNumber
        }
    }
    app.post('/send', async function(req, res) {
        try {
            const { number, message } = req.body;
            if (!number || !message) {
                return res.status(400).json({ error: 'Phone and message are required' });
            }
            
            let formattedNumber = number
            
            // Check if it's a Brazilian number and format accordingly
            if (number.startsWith('55') || number.startsWith('+55')) {
                formattedNumber = formatBrazilianPhoneNumber(number);
            } else {
                // For non-Brazilian numbers, use the previous formatting
                formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
            }
            
            await client.sendMessage(formattedNumber, message);
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

    app.get('/webhooks', async function(_req, res) {
        try {
            res.json(await db.webhooks.all());
        } catch (err) {
            logger.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/webhooks', async function(req, res) {
        try {
            await db.webhooks.create({
                postUrl: req.body.postUrl,
                authHeader: req.body.authHeader,
                eventCode: req.body.eventCode,
            });
            res.status(201).json({
                message: 'Webhook created: ' + req.body.postUrl,
            });
        } catch (err) {
            logger.error(err);
            res.status(500).json({ error: err.message });
        }
    });


    app.delete('/webhooks/:id', async function(req, res) {
        try {
            await db.webhooks.delete(req.params.id);
            res.status(200).json({
                message: 'Webhook deleted: ' + req.params.id,
            });
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
