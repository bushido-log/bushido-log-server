// index.js （bushido-log-server 用）

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// アップロード用（音声ファイル）
const upload = multer({ dest: 'uploads/' });

// ===== サムライキングの設定 =====
const systemPrompt = `
あなたは「SAMURAI KING」というAIコーチです。
ユーザーの欲望・サボりをぶった斬りつつ、愛を持って背中を押します。
口調は厳しめだけど温かい、ジャマイカと日本の武士道をミックスした感じで話してください。
`;

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Bushido-log server running' });
});

// ====== /samurai-chat : テキスト相談 ======
app.post('/samurai-chat', async (req, res) => {
  const { text } = req.body || {};
  console.log('[samurai-chat] request body:', req.body);

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.9,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      '・・・今日はうまく言葉が出てこん。';

    console.log('[samurai-chat] reply:', reply);

    res.json({ reply });
  } catch (err) {
    console.error(
      '[samurai-chat] error:',
      err.response?.data || err.message || String(err)
    );

    res.status(500).json({
      error: 'samurai-chat error',
      detail: err.response?.data || err.message || String(err),
    });
  }
});

// ====== /mission : とりあえずダミー ======
app.post('/mission', async (req, res) => {
  // 今はサーバーを安定させるための仮実装
  res.json({
    mission:
      '今日は「筋トレ10分」と「日記3行」。終わったらサムライキングに報告だ。',
  });
});

// ====== /transcribe : 音声 → テキスト ======
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('[transcribe] headers:', req.headers['content-type']);
    console.log('[transcribe] file:', req.file);

    const file = req.file;
    if (!file) {
      console.log('[transcribe] no file received');
      return res.status(400).json({ error: 'audio file is required' });
    }

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.path),
      model: 'gpt-4o-mini-transcribe',
      language: 'ja',
    });

    // 一応ファイル削除（失敗しても無視）
    fs.unlink(file.path, () => {});

    console.log('[transcribe] success:', result.text);
    res.json({ text: result.text });
  } catch (err) {
    console.error(
      '[transcribe] error:',
      err.response?.data || err.message || String(err)
    );

    res.status(500).json({
      error: 'Transcription failed',
      detail: err.response?.data || err.message || String(err),
    });
  }
});

// ====== サーバー起動 ======
app.listen(PORT, () => {
  console.log(`Bushido-log server listening on port ${PORT}`);
});