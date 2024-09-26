const puppeteer = require('puppeteer-core');
var spinner = require("./step");
const utils = require('./utils');
const { Client, MessageMedia } = require('whatsapp-web.js');
const _cliProgress = require('cli-progress');
const constants = require('./constants');
const { logger } = require('./logger');

const createClient = async (argv, CHROMIUM_PATH, isPackaged) => {
    /*
    spinner.start("Downloading chromium\n");
    const browserFetcher = puppeteer.createBrowserFetcher({ 
        platform: process.platform === 'darwin' ? 'mac' : process.platform, 
        path: process.cwd() 
    });
    const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_grey);
    progressBar.start(100, 0);

    const revisionInfo = await browserFetcher.download("1313161", (download, total) => {
        var percentage = (download * 100) / total;
        progressBar.update(percentage);
    });
    progressBar.update(100);
    spinner.stop("Downloading chromium ... done!");*/

    var pptrArgv = [];
    if (argv.proxyURI) {
        pptrArgv.push('--proxy-server=' + argv.proxyURI);
    }
    pptrArgv.push('--no-sandbox');
    pptrArgv.push('--disable-setuid-sandbox');

    const extraArguments = Object.assign({});
    extraArguments.userDataDir = constants.DEFAULT_DATA_DIR;
    let puppeteerOptions = {};
    
    console.log(CHROMIUM_PATH);
    console.log(isPackaged);

    if (isPackaged) {

        puppeteerOptions = {
            executablePath: CHROMIUM_PATH,
            defaultViewport: null,
            headless: true,
            devtools: false,
            args: [...pptrArgv], 
            ...extraArguments
        };
    } else {
        puppeteerOptions = {
            defaultViewport: null,
            headless: true,
            devtools: false,
            args: [...pptrArgv], 
            ...extraArguments
        };
    }   

    const client = new Client({
        puppeteer: puppeteerOptions
    });

    if (argv.proxyURI) {
        logger.info("Using a Proxy Server");
    }

    client.on('loading_screen', (percent, message) => {
        logger.info('LOADING SCREEN', percent, message);
    });

    client.on('qr', (qr) => {
        client.qr = qr;
    });

    client.on('ready', async () => {
        logger.info('WBOT is spinning up!');
        client.isReady = true;
        await utils.delay(5000);
    });

    client.on('authenticated', () => {
        logger.info('AUTHENTICATED');
        client.isAuthenticated = true;
    });

    client.on('auth_failure', msg => {
        logger.error('AUTHENTICATION FAILURE', msg);
        client.isAuthenticated = false;
    });

    await client.initialize();

    logger.info("Launching browser ... done!");

    return client;
}
module.exports = {
    createClient,
}
