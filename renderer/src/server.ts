// ignore all the 250mb stuff RCC had a 1mb post limit and i thought it was this
import conf from './helpers/Config';
import CommandHandler from './controllers';
let handle = new CommandHandler();
import express = require('express');
import * as models from './models';
import * as HTTPExceptions from 'ts-httpexceptions';
import * as WSLib from 'ws';
import {getUploadCallbacks} from './rendering';

// The only methods the website is allowed to invoke remotely (over WS or the
// /api/public-method bridge). Anything not in this set is rejected, so the
// transport can never reach arbitrary/inherited members of the handler.
const ALLOWED_COMMANDS = new Set<string>([
	'GenerateThumbnail',
	'GenerateThumbnailHeadshot',
	'GenerateThumbnailAsset',
	'GenerateThumbnailHead',
	'GenerateThumbnailMesh',
	'GenerateThumbnailGame',
	'GenerateThumbnailTexture',
	'GenerateThumbnailTeeShirt',
	'ConvertRobloxPlace',
	'ConvertHat',
	'Cancel',
]);

const isAllowedCommand = (name: unknown): name is string =>
	typeof name === 'string' && ALLOWED_COMMANDS.has(name);

// WS - used for rendering
const ws = new WSLib.Server({
	port: conf.thumbnailWebsocketPort || 3040,
});
// Express
const app = express();
app.use(express.text({ limit: '250mb' }));
app.use(express.json());

app.use((req, res, next) => {
	console.log('[AUTH] [' + req.method +']', req.url);
	if (req.url === '/api/upload-thumbnail-v1') {
		console.log('[info] skip auth for thumbnailer');
		return next();
	}
	if (req.headers['roblox-server-authorization'] !== conf.authorization) {
		console.error('bad auth')
		return res.status(500).send('Internal server error').end();
	}
	next();
});

app.get('/api/ping', (req, res) => {
    res.status(200).json(true).end();
});

app.get('/stop', (req, res) => {
    res.status(200).send("Shut down.").end();
    process.exit(0);
});

app.post('/api/public-method', (req, res, next) => {
	const b = req.body;
	if (!b || typeof b !== 'object') {
		return res.status(400).json({ success: false, message: 'BadRequest' }).end();
	}
	console.log('[' + req.method + '] ' + req.url + ' - ' + b.method);
	if (!isAllowedCommand(b.method)) {
		return res.status(404).json({ success: false, message: 'NotFound' }).end();
	}
	const args = Array.isArray(b.arguments) ? b.arguments : [];
	// @ts-ignore
	const f = handle[b.method];
	if (typeof f === 'function') {
		const c = f.apply(handle, args);
		if (typeof c === 'object' && c.then) {
			(c as Promise<any>).then((result) => {
				res.status(200).json(result).end();
			}).catch(e => {
				console.error('[error] error handling method', b.method, e);
				res.status(500).json({ success: false }).end();
			})
		} else {
			res.status(200).json(c).end();
		}
	} else {
		res.status(404).json({ success: false, message: 'NotFound' }).end();
	}
});

const thumbnailupconf = {
    limit: '250mb',
    type: 'text/plain'
};

const thumbnailuplimit = express.text(thumbnailupconf);
app.post('/api/upload-thumbnail-v1',
    express.text({ limit: '250mb' }),
    (req, res) => {
        /* console.log("[thumbnailer] headers:", req.headers); */
        console.log('[thumbnailer] thumb size:', req.headers['content-length']);
        try {
        if (req.body) {
            const js = JSON.parse(req.body);
            if (js['accessKey'] === conf.authorization) {
                const key = js['jobId'];
                const callbacks = getUploadCallbacks()[key];
                handle.removeFromRunningJobs(key);
                if (callbacks) {
                    console.log("notifying", callbacks.length, 'subscribers')
                    for (const item of callbacks) {
                        item(js);
                    }
                    delete getUploadCallbacks()[key];
                    return res.status(200).send({
                        success: true,
                    }).end();
                } else {
                    console.error('[warning] no job id callback for', key);
                }
            } else {
                console.log('bad key', js);
            }
        }
    } catch (e) {
        console.error(e);
    }
    res.status(503).send('Unavailable').end();
});
export default () => {
	// Express
	app.listen(conf.port, () => {
		console.log(`[info] express listening on port`, conf.port)
	});
	// Ws
	console.log('[info] ws server listening on port', (conf.thumbnailWebsocketPort || 3040));
}

const onMessage = async (data: string) => {
	let cmd = JSON.parse(data.toString()) as models.Command;
	console.log('[info] ' + cmd.command)
	if (!isAllowedCommand(cmd.command)) {
		console.log('[err] sending 404 for invalidCommand: ' + cmd.command)
		return {
			status: 404,
			code: 'InvalidCommand',
			id: cmd.id,
		};
	}
	try {
		const cmdArgs = Array.isArray(cmd.args) ? cmd.args : [];
		// @ts-ignore
		let results = await handle[cmd.command](...cmdArgs);
		return {
			status: 200,
			data: results,
			id: cmd.id,
		}
	} catch (err) {
		if (err instanceof HTTPExceptions.Exception && err! instanceof HTTPExceptions.InternalServerError) {
			return {
				status: err.status,
				code: err.message,
				errorDetails: err,
				id: cmd.id,
			}
		}
		console.error('[error] [ws handle try/catch]', err);
		return {
			status: 500,
			code: 'InternalServerError',
			errorDetails: err,
			id: cmd.id,
		};
	}
}

ws.on('connection', (c, req) => {
	console.log('[info] new connection');
	let url = req.url;
	if (!url) {
		console.log('[info] closing bad conn due to no url')
		return c.close();
	}
	let q = url.indexOf('?');
	if (q === -1) {
		console.log('[info] closing bad conn due to no query param');
		return c.close();
	}
	let d = new URLSearchParams(url.slice(q));
	let key = d.get('key');
	if (!key) {
		console.log('[info] closing bad conn due to no key');
		return c.close();
	}
	if (key !== conf.authorization) {
		console.log('[info] closing bad conn due to non-matching key');
		return c.close();
	}
	c.on('message', async (data) => {
		onMessage(data.toString()).then(result => {
			c.send(JSON.stringify(result))
		})
	})
	c.on('close', () => {
		console.log('[info] closed connection');
	});
});