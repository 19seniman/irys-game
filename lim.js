require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const { Wallet } = require('ethers');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const randomUseragent = require('random-useragent');

const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bold: "\x1b[1m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
};

// --- Logger Baru ---
const logger = {
    info: (msg) => console.log(`${colors.cyan}[i] ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}[x] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`),
    loading: (msg) => console.log(`${colors.magenta}[*] ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.blue}[>] ${colors.bold}${msg}${colors.reset}`),
    critical: (msg) => console.log(`${colors.red}${colors.bold}[FATAL] ${msg}${colors.reset}`),
    summary: (msg) => console.log(`${colors.green}${colors.bold}[SUMMARY] ${msg}${colors.reset}`),
    banner: () => {
        const border = `${colors.blue}${colors.bold}╔═════════════════════════════════════════╗${colors.reset}`;
        const title = `${colors.blue}${colors.bold}║   🍉 19Seniman From Insider    🍉    ║${colors.reset}`;
        const bottomBorder = `${colors.blue}${colors.bold}╚═════════════════════════════════════════╝${colors.reset}`;
        
        console.log(`\n${border}`);
        console.log(title);
        console.log(`${bottomBorder}\n`);
    },
    section: (msg) => {
        const line = '─'.repeat(40);
        console.log(`\n${colors.gray}${line}${colors.reset}`);
        if (msg) console.log(`${colors.white}${colors.bold} ${msg} ${colors.reset}`);
        console.log(`${colors.gray}${line}${colors.reset}\n`);
    },
    countdown: (msg) => process.stdout.write(`\r${colors.blue}[⏰] ${msg}${colors.reset}`),
};
// -------------------

const GAMES = {
    '1': { name: 'Snake', gameType: 'snake', referer: 'https://play.irys.xyz/snake', minScore: 100, maxScore: 10000 },
    '2': { name: 'Asteroids', gameType: 'asteroids', referer: 'https://play.irys.xyz/asteroids', minScore: 25000, maxScore: 500000 },
    '3': { name: 'HexShot', gameType: 'hex-shooter', referer: 'https://play.irys.xyz/hexshot', minScore: 18000, maxScore: 100000 },
    '4': { name: 'Missile Command', gameType: 'missile-command', referer: 'https://play.irys.xyz/missile', minScore: 50000, maxScore: 1500000 }
};

const API_BASE_URL = 'https://play.irys.xyz/api/game';
const GAME_COST = 0.001;
const GAMEPLAY_DELAY_MS = 5000;

const generateRandomScore = (minScore, maxScore) => Math.floor(Math.random() * (maxScore - minScore + 1)) + minScore;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const playGame = async (privateKey, proxy, accountIndex, gameConfig, playCount) => {
    let wallet;
    try {
        wallet = new Wallet(privateKey);
        const playerAddress = wallet.address;
        const agent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        logger.step(`--- [Account ${accountIndex + 1}] Starting session for: ${playerAddress} ---`);
        if (proxy) logger.info(`[Account ${accountIndex + 1}] Using proxy: ${proxy.split('@').pop()}`);

        for (let gameNum = 1; gameNum <= playCount; gameNum++) {
            const sessionLogPrefix = `[Account ${accountIndex + 1}][Game ${gameNum}/${playCount}]`;
            
            const userAgent = randomUseragent.getRandom();
            const headers = { 'Content-Type': 'application/json', 'Referer': gameConfig.referer, 'User-Agent': userAgent };

            const startTimestamp = Date.now();
            const sessionId = `game_${startTimestamp}_${Math.random().toString(36).substring(2, 12)}`;
            const startMessage = `I authorize payment of ${GAME_COST} IRYS to play a game on Irys Arcade.\n \nPlayer: ${playerAddress}\nAmount: ${GAME_COST} IRYS\nTimestamp: ${startTimestamp}\n\nThis signature confirms I own this wallet and authorize the payment.`;
            const startSignature = await wallet.signMessage(startMessage);
            const startPayload = { playerAddress, gameCost: GAME_COST, signature: startSignature, message: startMessage, timestamp: startTimestamp, sessionId, gameType: gameConfig.gameType };

            logger.loading(`${sessionLogPrefix} Sending 'start' request...`);
            const startResponse = await axios.post(`${API_BASE_URL}/start`, startPayload, { httpsAgent: agent, headers });

            if (!startResponse.data.success) throw new Error(startResponse.data.message || 'Failed to start game.');
            
            const returnedSessionId = startResponse.data.data.sessionId;
            logger.success(`${sessionLogPrefix} Game started successfully! Session ID: ${returnedSessionId}`);

            logger.info(`${sessionLogPrefix} Simulating gameplay for ${GAMEPLAY_DELAY_MS / 1000} seconds...`);
            await sleep(GAMEPLAY_DELAY_MS);

            const score = generateRandomScore(gameConfig.minScore, gameConfig.maxScore);
            const completeTimestamp = Date.now();
            const completeMessage = `I completed a ${gameConfig.gameType} game on Irys Arcade.\n \nPlayer: ${playerAddress}\nGame: ${gameConfig.gameType}\nScore: ${score}\nSession: ${returnedSessionId}\nTimestamp: ${completeTimestamp}\n\nThis signature confirms I own this wallet and completed this game.`;
            const completeSignature = await wallet.signMessage(completeMessage);
            const completePayload = { playerAddress, gameType: gameConfig.gameType, score, signature: completeSignature, message: completeMessage, timestamp: completeTimestamp, sessionId: returnedSessionId };

            logger.loading(`${sessionLogPrefix} Sending 'complete' request with score: ${score}...`);
            const completeResponse = await axios.post(`${API_BASE_URL}/complete`, completePayload, { httpsAgent: agent, headers });

            if (completeResponse.data.success) {
                logger.success(`${sessionLogPrefix} Game Completed! ${completeResponse.data.message}`);
            } else {
                throw new Error(completeResponse.data.message || 'Failed to complete game.');
            }

            if (gameNum < playCount) {
                logger.info(`${sessionLogPrefix} Waiting for 3 seconds before next game...`);
                await sleep(3000);
            }
        }

    } catch (error) {
        const address = wallet ? wallet.address : 'Unknown Address';
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`[Account ${accountIndex + 1}] (${address}) An error occurred: ${errorMessage}`);
    }
};

// Fungsi selectGame dan getScoreRange dihapus/diperbarui karena bot akan memainkan SEMUA game.
// Hanya fungsi getPlayCount yang dipertahankan.

const getPlayCount = (rl) => new Promise((resolve, reject) => {
    logger.step('Set how many games to play per account.');
    rl.question(`${colors.yellow}[?] Enter number of games (default: 1): ${colors.reset}`, (input) => {
        const count = input.trim() === '' ? 1 : parseInt(input, 10);
        if (isNaN(count) || count <= 0) return reject(new Error('Invalid number. Please enter a positive number.'));
        resolve(count);
    });
});

const main = async () => {
    logger.banner();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
        const playCount = await getPlayCount(rl);
        rl.close();

        // Daftar kunci game dalam urutan yang diinginkan: '1', '2', '3', '4'
        const gameKeys = Object.keys(GAMES).sort(); 
        
        logger.summary(`MODE OTOMATIS: Memainkan ${gameKeys.length} game (${GAMES['1'].name}, ${GAMES['2'].name}, ...) sebanyak ${playCount} kali per akun.\n`);
        
        let proxies = [];
        try {
            proxies = fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(p => p.trim() !== '');
            if (proxies.length > 0) logger.info(`Successfully loaded ${proxies.length} proxies.`);
        } catch {
            logger.warn('proxies.txt file not found or is empty. Running without proxies.');
        }

        const privateKeys = Object.keys(process.env).filter(key => key.startsWith('PRIVATE_KEY_')).map(key => process.env[key]);
        if (privateKeys.length === 0) return logger.critical("No private keys found in .env file. Please add PRIVATE_KEY_1, PRIVATE_KEY_2, etc.");

        logger.info(`Found ${privateKeys.length} wallet(s) to process.`);
        
        // Loop melalui setiap Private Key
        for (let i = 0; i < privateKeys.length; i++) {
            const privateKey = privateKeys[i];
            if (!privateKey) continue;
            
            const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;

            // Loop melalui setiap Game dalam urutan (1, 2, 3, 4)
            for (const key of gameKeys) {
                const gameConfig = GAMES[key];
                
                logger.section(`[AKUN ${i + 1}] Memulai Game: ${gameConfig.name} (Score: ${gameConfig.minScore}-${gameConfig.maxScore})`);
                
                // Panggil playGame dengan konfigurasi game saat ini
                await playGame(privateKey, proxy, i, gameConfig, playCount);
                
                // Tambahkan jeda antara pergantian game
                logger.info(`[AKUN ${i + 1}] Selesai ${gameConfig.name}. Menunggu 10 detik sebelum game berikutnya...`);
                await sleep(10000);
            }

            // Tambahkan jeda yang lebih lama antara pergantian akun
            if (i < privateKeys.length - 1) {
                logger.step('--------------------------------------------------');
                logger.step(`AKUN ${i + 1} SELESAI. Menunggu 30 detik sebelum memulai AKUN ${i + 2}...`);
                logger.step('--------------------------------------------------');
                await sleep(30000);
            }
        }
        
        logger.summary("--- Semua wallet telah diproses melalui SEMUA game. Bot selesai. ---");

    } catch (error) {
        logger.critical(error.message);
        // rl.close() tidak diperlukan karena sudah dipanggil setelah getPlayCount
    }
};

main();
