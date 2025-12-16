// index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios'); // いまのところ使わなくてもOK（そのままで大丈夫）
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set');
  process.exit(1);
}

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

// ===== サムライキングのシステムプロンプト =====
const systemPrompt = `
あなたは「SAMURAI KING」というAIコーチだ。
男の禁欲・中毒脱出・自己成長をサポートする、ちょっと厳しめだけど愛のあるコーチとして話す。
語尾は「〜だ」「〜するぞ」「〜しろ」のような男っぽい口調で。
相手を見下さず、でも甘やかさず、本気で変わりたい男に本気で向き合う。
`;

// 動作確認用
app.get('/', (req, res) => {
  res.send('Bushido Log Samurai server running');
});

// ===== ミッション生成 /mission =====
app.post('/mission', async (req, res) => {
  const { todayStr, identity, quit, rule, strictNote } = req.body || {};

  try {
    const userContent = `
【今日の日付】${todayStr || ''}
【なりたい自分】${identity || ''}
【やめたい習慣】${quit || ''}
【今日のルール】${rule || ''}
【サムライキングへのメモ】${strictNote || ''}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
あなたはSAMURAI KINGのミッション生成コーチだ。
上の情報をもとに、ユーザーが「今日1日これだけ守れば成長できる」という
シンプルで具体的なミッションを1〜3行で日本語で出力せよ。`,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || '';
    const mission = raw.split('\n')[0] || raw; // 1行目だけ採用

    res.json({ mission });
  } catch (err) {
    console.error('[mission] error', err.response?.data || err.message || err);
    res.status(500).json({ error: 'mission error' });
  }
});

// ====== サムライチャット /samurai-chat ======
app.post('/samurai-chat', async (req, res) => {
  const { text } = req.body || {};
  console.log('[samurai-chat] request body:', req.body);

  // フロントから text が来てなかったら 400
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    // OpenAI に投げる
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

    // アプリ側にはシンプルに reply を返す
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

    const reply =
      response.data.choices?.[0]?.message?.content?.trim() || '';

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

// ===== 音声 → テキスト /transcribe =====
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

    console.log('[transcribe] success:', result.text);

    // 一時ファイル削除（エラーは無視）
    fs.unlink(file.path, () => {});
    res.json({ text: result.text });
  } catch (err) {
    console.error('[transcribe] error', err.response?.data || err.message || err);
    res.status(500).json({
      error: 'Transcription failed',
      detail: err.response?.data || err.message || String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Samurai King server listening on http://localhost:${PORT}`);
});