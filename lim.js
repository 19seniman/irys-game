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

const logger = {
    info: (msg) => console.log(`${colors.cyan}[и] ${msg}${colors.reset}`), // [и] - Информация
    warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`), // [!] - Предупреждение
    error: (msg) => console.log(`${colors.red}[х] ${msg}${colors.reset}`), // [х] - Ошибка
    success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`), // [+] - Успех
    loading: (msg) => console.log(`${colors.magenta}[*] ${msg}${colors.reset}`), // [*] - Загрузка
    step: (msg) => console.log(`${colors.blue}[>] ${colors.bold}${msg}${colors.reset}`), // [>] - Шаг
    critical: (msg) => console.log(`${colors.red}${colors.bold}[ФАТАЛЬНО] ${msg}${colors.reset}`),
    summary: (msg) => console.log(`${colors.green}${colors.bold}[СВОДКА] ${msg}${colors.reset}`),
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

// Konstan untuk otomatisasi
const DAILY_DELAY_MS = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik

const generateRandomScore = (minScore, maxScore) => Math.floor(Math.random() * (maxScore - minScore + 1)) + minScore;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const playGame = async (privateKey, proxy, accountIndex, gameConfig, playCount) => {
    let wallet;
    try {
        wallet = new Wallet(privateKey);
        const playerAddress = wallet.address;
        const agent = proxy ? new HttpsProxyAgent(proxy) : null;
        
        logger.step(`--- [Аккаунт ${accountIndex + 1}] Начало сессии для: ${playerAddress} ---`);
        if (proxy) logger.info(`[Аккаунт ${accountIndex + 1}] Использование прокси: ${proxy.split('@').pop()}`);

        for (let gameNum = 1; gameNum <= playCount; gameNum++) {
            const sessionLogPrefix = `[Аккаунт ${accountIndex + 1}][Игра ${gameNum}/${playCount}]`;
            
            const userAgent = randomUseragent.getRandom();
            const headers = { 'Content-Type': 'application/json', 'Referer': gameConfig.referer, 'User-Agent': userAgent };

            const startTimestamp = Date.now();
            const sessionId = `game_${startTimestamp}_${Math.random().toString(36).substring(2, 12)}`;
            const startMessage = `I authorize payment of ${GAME_COST} IRYS to play a game on Irys Arcade.\n \nPlayer: ${playerAddress}\nAmount: ${GAME_COST} IRYS\nTimestamp: ${startTimestamp}\n\nThis signature confirms I own this wallet and authorize the payment.`;
            const startSignature = await wallet.signMessage(startMessage);
            const startPayload = { playerAddress, gameCost: GAME_COST, signature: startSignature, message: startMessage, timestamp: startTimestamp, sessionId, gameType: gameConfig.gameType };

            logger.loading(`${sessionLogPrefix} Отправка запроса 'start'...`);
            const startResponse = await axios.post(`${API_BASE_URL}/start`, startPayload, { httpsAgent: agent, headers });

            if (!startResponse.data.success) throw new Error(startResponse.data.message || 'Не удалось начать игру.');
            
            const returnedSessionId = startResponse.data.data.sessionId;
            logger.success(`${sessionLogPrefix} Игра успешно начата! ID сессии: ${returnedSessionId}`);

            logger.info(`${sessionLogPrefix} Симуляция игрового процесса в течение ${GAMEPLAY_DELAY_MS / 1000} секунд...`);
            await sleep(GAMEPLAY_DELAY_MS);

            const score = generateRandomScore(gameConfig.minScore, gameConfig.maxScore);
            const completeTimestamp = Date.now();
            const completeMessage = `I completed a ${gameConfig.gameType} game on Irys Arcade.\n \nPlayer: ${playerAddress}\nGame: ${gameConfig.gameType}\nScore: ${score}\nSession: ${returnedSessionId}\nTimestamp: ${completeTimestamp}\n\nThis signature confirms I own this wallet and completed this game.`;
            const completeSignature = await wallet.signMessage(completeMessage);
            const completePayload = { playerAddress, gameType: gameConfig.gameType, score, signature: completeSignature, message: completeMessage, timestamp: completeTimestamp, sessionId: returnedSessionId };

            logger.loading(`${sessionLogPrefix} Отправка запроса 'complete' со счетом: ${score}...`);
            const completeResponse = await axios.post(`${API_BASE_URL}/complete`, completePayload, { httpsAgent: agent, headers });

            if (completeResponse.data.success) {
                logger.success(`${sessionLogPrefix} Игра завершена! ${completeResponse.data.message}`);
            } else {
                throw new Error(completeResponse.data.message || 'Не удалось завершить игру.');
            }

            if (gameNum < playCount) {
                logger.info(`${sessionLogPrefix} Ожидание 3 секунд перед следующей игрой...`);
                await sleep(3000);
            }
        }

    } catch (error) {
        const address = wallet ? wallet.address : 'Неизвестный адрес';
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`[Аккаунт ${accountIndex + 1}] (${address}) Произошла ошибка: ${errorMessage}`);
    }
};

// Fungsi getPlayCount dikembalikan (dipertahankan)
const getPlayCount = (rl) => new Promise((resolve, reject) => {
    logger.step('Укажите, сколько игр нужно сыграть на каждом аккаунте.');
    rl.question(`${colors.yellow}[?] Введите количество игр (по умолчанию: 1): ${colors.reset}`, (input) => {
        const count = input.trim() === '' ? 1 : parseInt(input, 10);
        if (isNaN(count) || count <= 0) return reject(new Error('Неверное число. Пожалуйста, введите положительное число.'));
        resolve(count);
    });
});

const main = async () => {
    logger.banner();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let playCount; // Variabel untuk menyimpan hasil input

    try {
        // --- Interaksi Awal: Bertanya Play Count Sekali ---
        playCount = await getPlayCount(rl);
        rl.close();

        // Daftar kunci game dalam urutan yang diinginkan: '1', '2', '3', '4'
        const gameKeys = Object.keys(GAMES).sort(); 
        
        logger.summary(`РЕЖИМ АВТОМАТИЗАЦИИ (24 ЧАСА): Играет в ${gameKeys.length} игр (${GAMES['1'].name}, ${GAMES['2'].name}, ...) ${playCount} раз для каждого аккаунта.`);
        logger.summary(`Siklus akan diulang setiap ${DAILY_DELAY_MS / (1000 * 60 * 60)} jam.\n`);
        
        // Memuat Proksi dan Kunci secara statis sebelum loop harian
        let proxies = [];
        try {
            proxies = fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(p => p.trim() !== '');
            if (proxies.length > 0) logger.info(`Успешно загружено ${proxies.length} прокси.`);
        } catch {
            logger.warn('Файл proxies.txt не найден или пуст. Работа без прокси.');
        }

        const privateKeys = Object.keys(process.env).filter(key => key.startsWith('PRIVATE_KEY_')).map(key => process.env[key]);
        if (privateKeys.length === 0) return logger.critical("Приватные ключи в файле .env не найдены. Пожалуйста, добавьте PRIVATE_KEY_1, PRIVATE_KEY_2 и т.д. Бот dihentikan.");

        logger.info(`Найдено ${privateKeys.length} кошельков для обработки.`);
        
        // --- Loop Utama 24 Jam ---
        while (true) {
            const startTime = Date.now();
            logger.step('==================================================');
            logger.step(`НАЧАЛО ЕЖЕДНЕВНОГО ЦИКЛА: ${new Date().toISOString()}`);
            logger.step('==================================================');
            
            // Logika Bot di dalam Loop
            for (let i = 0; i < privateKeys.length; i++) {
                const privateKey = privateKeys[i];
                if (!privateKey) continue;
                
                const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;

                for (const key of gameKeys) {
                    const gameConfig = GAMES[key];
                    
                    logger.section(`[АККАУНТ ${i + 1}] Начало игры: ${gameConfig.name} (Счет: ${gameConfig.minScore}-${gameConfig.maxScore})`);
                    
                    await playGame(privateKey, proxy, i, gameConfig, playCount);
                    
                    logger.info(`[АККАУНТ ${i + 1}] Игра ${gameConfig.name} завершена. Ожидание 10 секунд перед следующей игрой...`);
                    await sleep(10000);
                }

                if (i < privateKeys.length - 1) {
                    logger.step('--------------------------------------------------');
                    logger.step(`АККАУНТ ${i + 1} ЗАВЕРШЕН. Ожидание 30 секунд перед запуском АККАУНТА ${i + 2}...`);
                    logger.step('--------------------------------------------------');
                    await sleep(30000);
                }
            }

            logger.summary("--- Все кошельки обработаны для ВСЕХ игр. Siklus ini selesai. ---");

            // --- Logika Penundaan 24 Jam ---
            const endTime = Date.now();
            const duration = endTime - startTime;
            let remainingDelay = DAILY_DELAY_MS - duration;

            if (remainingDelay < 0) {
                remainingDelay = 10000;
                logger.warn(`Продолжительность цикла (${(duration / 3600000).toFixed(2)} ч) превысила 24 часа. Начинаем следующий цикл через ${remainingDelay / 1000} секунд.`);
            } else {
                const minutesLeft = Math.ceil(remainingDelay / 1000 / 60);
                logger.step(`Ожидание ${minutesLeft} минут до следующего цикла (24 часа)...`);
            }

            await sleep(remainingDelay);
        }
        
    } catch (error) {
        logger.critical(error.message);
        // Pastikan rl.close dipanggil jika terjadi kesalahan sebelum loop dimulai
        if (typeof playCount === 'undefined') rl.close(); 
    }
};

main();
