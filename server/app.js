const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ✅ CORS configurado para seu front-end
app.use(cors({
  origin: 'https://ygos-96.github.io'
}));

app.use(bodyParser.json());

// ✅ Carregar credenciais do arquivo local
let credentials;
try {
  const credPath = path.join(__dirname, 'service-account.json');
  const raw = fs.readFileSync(credPath);
  credentials = JSON.parse(raw);
} catch (err) {
  console.error("❌ Erro ao carregar arquivo de credenciais:", err.message);
  process.exit(1);
}

// ✅ Autenticação com o Google Calendar
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/calendar']
});

const calendar = google.calendar({ version: 'v3', auth });
const CALENDAR_ID = '826eba34b6354dece11e4348d148ae5990d1dbb5530ec1388f424a326030e338@group.calendar.google.com';

// ✅ Rota para agendamento
app.post('/agendar', async (req, res) => {
  console.log("📩 POST /agendar recebido:", req.body);
  const { nome, email, telefone, data, horario, tipo } = req.body;

  try {
    const start = new Date(`${data}T${horario}:00-03:00`);
    const end = new Date(start.getTime() + 50 * 60000);

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Consulta com ${nome}`,
        description: `Tipo: ${tipo}\nE-mail: ${email}\nTelefone: ${telefone}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      }
    });

    res.status(200).json({ message: 'Evento criado com sucesso!', event: response.data });
  } catch (error) {
    console.error("❌ Erro ao criar evento:", error.response?.data || error.message || error);
    res.status(500).json({
      message: 'Erro ao criar evento',
      error: error.response?.data || error.message || 'Erro desconhecido'
    });
  }
});

// ✅ Rota para listar horários ocupados
app.get('/eventos', async (req, res) => {
  console.log("📆 GET /eventos recebido:", req.query);
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({ message: 'Data é obrigatória' });
  }

  try {
    const start = new Date(`${data}T00:00:00-03:00`);
    const end = new Date(`${data}T23:59:59-03:00`);

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const horariosBloqueados = [];

    response.data.items.forEach(ev => {
      if (!ev.start.dateTime || !ev.end.dateTime) return;

      const inicio = new Date(ev.start.dateTime);
      const fim = new Date(ev.end.dateTime);

      const horaAtual = new Date(inicio);
      while (horaAtual < fim) {
        const horaStr = horaAtual.toTimeString().slice(0, 5);
        if (!horariosBloqueados.includes(horaStr)) {
          horariosBloqueados.push(horaStr);
        }
        horaAtual.setMinutes(horaAtual.getMinutes() + 60);
      }
    });

    res.json({ horariosBloqueados });
  } catch (error) {
    console.error("❌ Erro ao buscar eventos:", error.message);
    res.status(500).json({ message: 'Erro ao buscar eventos', error: error.message });
  }
});

// ✅ Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
