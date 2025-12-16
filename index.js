// index.js （bushido-log-server のルートに置く）

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ===== OpenAI クライアント =====
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// ===== アップロードフォルダ設定 =====
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.get('/', (req, res) => {
  res.send('Samurai King server is running');
});
// ---- サムライキングのシステムプロンプト（ざっくり版）----
const systemPrompt = `
あなたは「SAMURAI KING（サムライキング）」というAIコーチ。
ジャマイカと日本の魂をミックスした、落ち着いた武士のように話す。

・一人称は「俺」か「わし」、相手は「お前」か「君」。
・説教ではなく、問いかけと気づきで背中を押す。
・ナポレオン・ヒル、中村天風、武士道、引き寄せ、TRIGA の哲学をベースに、
  毎回「共感 → 原則 → 今日やる一つの行動 → 最後に問い」を短く返す。
・行動は誰にでもできる小さな一歩（呼吸、姿勢、感謝、ルーティンなど）にする。
・ユーザーを責めず、優しいけど甘やかさないトーンで答える。
`;

// ========== ① サムライチャット /samurai-chat ==========
app.post('/samurai-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const reply =
      response.data.choices?.[0]?.message?.content?.trim() ||
      '……返答がうまく生成できなかった。';

    res.json({ reply });
  } catch (e) {
    console.error('samurai-chat error', e?.response?.data || e.message);
    res.status(500).json({ error: 'samurai-chat error' });
  }
});

// ===== サムライキング /samurai-chat =====
app.post('/samurai-chat', async (req, res) => {
  const { text } = req.body || {};

  console.log('[samurai-chat] request body:', req.body);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: text || '',
        },
      ],
    });

    const reply =
      response.choices?.[0]?.message?.content?.trim() ||
      '返事を生成できなかった。';

    console.log('[samurai-chat] reply:', reply);

    res.json({ reply });
  } catch (err) {
    console.error(
      '[samurai-chat] error:',
      err.response?.data || err.message || err
    );

    res.status(500).json({
      error: 'samurai-chat error',
      detail: err.response?.data || err.message || String(err),
    });
  }
});
    // 一時ファイル削除（エラーは無視）
    fs.unlink(file.path, () => {});

    console.log('[transcribe] success');
    return res.json({ text: result.text });
  } catch (err) {
    console.error('[transcribe] error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Transcription failed' });
  }
});

// ===== サーバー起動 =====
app.listen(PORT, () => {
  console.log(`Samurai King server listening on http://localhost:${PORT}`);
});