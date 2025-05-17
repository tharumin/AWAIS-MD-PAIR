
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import { upload } from './mega.js';

const router = express.Router();

function removeFile(FilePath) {
  try {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
  } catch (e) {
    console.error('Error removing file:', e);
  }
}

async function generateRandomId(length = 6, numberLength = 4) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  const number = Math.floor(Math.random() * Math.pow(10, numberLength));
  return `${result}${number}`;
}

async function startSession(num, res) {
  const dirs = './' + num;
  removeFile(dirs);

  const { state, saveCreds } = await useMultiFileAuthState(dirs);
  const logger = pino({ level: 'info' }).child({ level: 'info' });
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let sessionStarted = false;

  try {
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: process.env.SHOW_QR === 'true',
      logger,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    if (sock.authState.creds.registered) {
      return res.send({ message: 'Already registered. No pairing code needed.' });
    }

    await delay(2000);
    const code = await sock.requestPairingCode(num);
    console.log({ num, code });
    if (!res.headersSent) res.send({ code });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on("connection.update", async (s) => {
      const { connection, lastDisconnect } = s;
      if (connection === "open") {
        console.log("✅ Connection opened successfully");
        sessionStarted = true;

        await delay(10000);

        const megaUrl = await upload(fs.createReadStream(`${dirs}/creds.json`), `${await generateRandomId()}.json`);
        const stringSession = `${megaUrl}`;
        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

        await sock.sendMessage(userJid, { text: stringSession });
        await sock.sendMessage(userJid, {
          text: '*Hey Dear*\n\n*Don’t Share Your Session ID With Anyone*\n\n*This IS AWAIS MD*\n\n*THANKS FOR USING AWAIS MD BOT*\n\n*CONNECT FOR UPDATES*: https://whatsapp.com/channel/0029VashGieHAdNP11OHXH3P\n\n*Follow Dev On Instagram*: https://instagram.com/um4rxd'
        });

        console.log("✅ Session sent via WhatsApp.");
      } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log('❌ Connection closed unexpectedly:', lastDisconnect?.error);
        retryCount++;

        if (!sessionStarted && retryCount < MAX_RETRIES) {
          console.log(`🔁 Retrying connection... Attempt ${retryCount}/${MAX_RETRIES}`);
          await delay(10000);
          await startSession(num, res);
        } else if (!res.headersSent) {
          res.status(500).send({ message: 'Unable to reconnect after multiple attempts.' });
        }
      }
    });

  } catch (err) {
    console.error('❌ Error initializing session:', err);
    if (!res.headersSent) res.status(503).send({ code: 'Service Unavailable' });
  }
}

router.get('/', async (req, res) => {
  let num = req.query.number;
  if (!num) return res.status(400).send({ error: 'Number is required as query parameter (?number=923xxxxxx)' });
  num = num.replace(/[^0-9]/g, '');
  await startSession(num, res);
});

process.on('exit', () => console.log('🧹 Clean exit. Session will remain for reuse.'));
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught exception:', err);
  process.exit(1);
});

export default router;
