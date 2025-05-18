const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;
const EMISORES_FILE = 'emisores.json';
const TOKEN_VALIDO = 'GA250422160627';

app.use(cors());
app.use(bodyParser.json());

let client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

client.on('qr', async (qr) => {
  const qrImage = await qrcode.toDataURL(qr);
  fs.writeFileSync('last-qr.txt', qrImage);

  console.log('📲 Escanea este QR con WhatsApp Web:');
  qrcodeTerminal.generate(qr, { small: true }); // Muestra QR en terminal
});

client.on('ready', async () => {
  const number = client.info.wid.user;
  console.log(`✅ Emisor registrado: ${number}`);

  const emisores = {
    numero: number,
    token: TOKEN_VALIDO,
    registrado: true
  };
  fs.writeFileSync(EMISORES_FILE, JSON.stringify(emisores, null, 2));
});

client.initialize();

app.get('/whatsapp-qr', (req, res) => {
  const qrPath = 'last-qr.txt';
  if (!fs.existsSync(qrPath)) {
    return res.status(400).json({ error: 'QR aún no generado' });
  }

  const qrImage = fs.readFileSync(qrPath, 'utf-8');
  res.json({ qr: qrImage });
});

app.post('/enviar', async (req, res) => {
  const { token, numero, mensaje } = req.body;

  if (token !== TOKEN_VALIDO) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const emisores = JSON.parse(fs.readFileSync(EMISORES_FILE));
  if (!emisores.registrado || !emisores.numero) {
    return res.status(400).json({ error: 'Emisor no registrado' });
  }

  if (!numero || !mensaje) {
    return res.status(422).json({ error: 'Faltan número o mensaje' });
  }

  try {
    const chatId = numero.includes('@c.us') ? numero : `${numero}@c.us`;
    await client.sendMessage(chatId, mensaje);
    res.json({ enviado: true, a: numero });
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.message);
    res.status(500).json({ error: 'Fallo al enviar' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Microservicio en http://localhost:${PORT}`);
});
