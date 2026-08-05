import * as fs from 'fs';
import * as path from 'path';

interface IWebsiteConfiguration {
    authorization: string;
    baseUrl: string;
    rccPort: number;
    port: number;
    thumbnailWebsocketPort: number;
    rcc?: string;
    rccexe?: string;
    content?: string;
    websiteBotAuth: string;
    webhook?: string;
}

const configPath = path.join(__dirname, '../../config.json');

// Fail loudly with an actionable message instead of an opaque JSON/ENOENT stack.
const fatal = (message: string): never => {
    console.error('\n[config] FATAL: ' + message);
    console.error('[config] file: ' + configPath);
    console.error('[config] copy config.example.json to config.json and fill it in.\n');
    process.exit(1);
};

if (!fs.existsSync(configPath)) {
    fatal('config.json not found');
}

let parsed: Partial<IWebsiteConfiguration>;
try {
    parsed = JSON.parse(fs.readFileSync(configPath).toString());
} catch (e) {
    parsed = fatal('config.json is not valid JSON (' + (e as Error).message + ')');
}

const requireString = (key: keyof IWebsiteConfiguration): void => {
    const v = parsed[key];
    if (typeof v !== 'string' || v.trim() === '') {
        fatal(`"${key}" must be a non-empty string`);
    }
};
const requireNumber = (key: keyof IWebsiteConfiguration): void => {
    const v = parsed[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        fatal(`"${key}" must be a number`);
    }
};

// These must be set correctly or renders silently never happen (the WS handshake
// with the website is rejected when authorization does not match).
requireString('authorization');
requireString('baseUrl');
requireString('websiteBotAuth');
requireNumber('port');
requireNumber('rccPort');
requireNumber('thumbnailWebsocketPort');

if (parsed.rcc !== undefined && typeof parsed.rcc !== 'string') {
    fatal('"rcc" must be a string path when provided');
}
if (!parsed.rcc) {
    console.warn('[config] warning: "rcc" path is not set - R6 renders will fail until it points at your RCC folder.');
}
if (!parsed.webhook) {
    console.warn('[config] note: "webhook" is empty - Discord logging is disabled.');
}

const conf: Readonly<IWebsiteConfiguration> = parsed as IWebsiteConfiguration;
export default conf;
