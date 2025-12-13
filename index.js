// server/bushido-server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 動作チェック用
app.get('/', (req, res) => {
  res.send('BUSHIDO LOG Samurai King server is running.');
});

// Samurai King に投げるエンドポイント
app.post('/samurai-chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are "Samurai King", a strict but warm coach for the BUSHIDO LOG app. ' +
              'Speak mainly in Japanese, sometimes mixing a little Jamaican Patois. ' +
              'Encourage the user to grow, never be vulgar, and keep it safe for teens.'
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const replyText =
      openaiRes.data.choices?.[0]?.message?.content ??
      'すまん…うまく返事が作れなかった。もう一回だけ送ってみてくれ。';

    res.json({ reply: replyText });
  } catch (err) {
    console.error('OpenAI error:', err.response?.data || err.message);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`BUSHIDO LOG server listening on port ${PORT}`);
});