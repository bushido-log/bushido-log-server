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

// ===== アップロードフォルダ設定（なければ作る）=====
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });


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

// ========== ② サムライミッション /mission ==========
app.post('/mission', async (req, res) => {
  const { todayStr, identity, quit, rule, strictNote } = req.body;

  try {
    const userContent =
      `【日付】${todayStr}\n` +
      `【サムライ宣言】${identity || ''}\n` +
      `【やめたい習慣】${quit || ''}\n` +
      `【毎日のルール】${rule || ''}\n` +
      `【トーン指定】${strictNote || ''}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'あなたは一日の小さなサムライミッションを1つだけ提案するAIです。短く、1行で、具体的な行動だけを出してください。',
          },
          { role: 'user', content: userContent },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    let mission =
      response.data.choices?.[0]?.message?.content?.trim() ||
      '深呼吸を3回して姿勢を正す。';

    mission = mission.split('\n')[0];
    res.json({ mission });
  } catch (e) {
    console.error('mission error', e?.response?.data || e.message);
    res.status(500).json({ error: 'mission error' });
  }
});

// ========== ③ テキスト → 音声 /tts ==========
// ===== 音声 -> テキスト /transcribe =====
app.post('/transcribe', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  try {
    console.log('Transcribe start: file =', req.file.path);

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'gpt-4o-mini-transcribe',
      language: 'ja',
    });

    // 一時ファイル削除（失敗してもアプリは落とさない）
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn('Failed to delete temp file:', err.message);
    });

    console.log('Transcribe success:', result.text);
    res.json({ text: result.text || '' });
  } catch (err) {
    console.error(
      'Transcribe error:',
      err.response?.data || err.message || err
    );

    // 念のためここでも削除を試す
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ===== サーバー起動 =====
app.listen(PORT, () => {
  console.log(`Samurai King server listening on http://localhost:${PORT}`);
});