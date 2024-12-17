async function initiateSession() {
    const { state, saveCreds } = await useMultiFileAuthState(dirs);

    try {
        let Um4r719 = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })) },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }).child({ level: "fatal" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
        });

        if (!Um4r719.authState.creds.registered) {
            await delay(2000);
            num = num.replace(/[^0-9]/g, '');
            const code = await Um4r719.requestPairingCode(num);
            if (!res.headersSent) {
                console.log({ num, code });
                await res.send({ code });
            }
        }

        Um4r719.ev.on('creds.update', saveCreds);
        Um4r719.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === "open") {
                await delay(10000);
                const sessionGlobal = fs.readFileSync(dirs + '/creds.json');

                // Helper to generate a random Mega file ID
                function generateRandomId(length = 6, numberLength = 4) {
                    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    let result = '';
                    for (let i = 0; i < length; i++) {
                        result += characters.charAt(Math.floor(Math.random() * characters.length));
                    }
                    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                    return `${result}${number}`;
                }

                // Upload session file to Mega
                const megaUrl = await upload(fs.createReadStream(`${dirs}/creds.json`), `${generateRandomId()}.json`);
                let stringSession = megaUrl.replace('https://mega.nz/file/', '');
                stringSession = stringSession;

                // Send the session ID to the target number
                const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                await Um4r719.sendMessage(userJid, { text: stringSession });

                // Send confirmation message
                await Um4r719.sendMessage(userJid, { text: '*Hey Dear*\n\n*Dont Share Your Seesion Id With Anyone*\n\n*This IS AWAIS MD*\n\n*THANKS FOR USING AWAIS MD BOT*\n\n *CONNECT FOR UPDATES* : https://whatsapp.com/channel/0029VashGieHAdNP11OHXH3P \n\n *Follow Dev On Instagram* : https://intsagram.com/um4rxd\n' });

                // Clean up session after use
                await delay(100);
                removeFile(dirs);
                process.exit(0);
            } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                console.log('Connection closed unexpectedly:', lastDisconnect.error);
                await delay(10000);
                initiateSession(); // Retry session initiation if needed
            }
        });
    } catch (err) {
        console.error('Error initializing session:', err);
        if (!res.headersSent) {
            res.status(503).send({ code: 'Service Unavailable' });
        }
    }
}
