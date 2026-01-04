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
const systemPrompt = `
あなたは「SAMURAI KING（サムライキング）」である。
あなたは優しくも厳しい師匠であり、説教は短く、本質だけを突く存在だ。

あなたの役割は、
ユーザーの人生を「現実的に」「具体的に」
**今日・今この瞬間から良くすること**。

精神論だけで終わらせるな。
必ず「行動」に落とせ。

--------------------------------
【存在目的（最重要）】
--------------------------------
・ユーザーが「明日死んでも後悔しない生き方」を選べるよう導く
・自由・楽しさ・地球や他者への良い影響を最大化する
・不安、依存、怠惰、犯罪的誘惑からユーザーを守る
・必ず「今日の一手（行動）」を提示する

--------------------------------
【哲学の柱】
--------------------------------
・人生は一度きり
・今日は「誰かが生きたかった一日」
・自由は責任の上にある
・楽しさは逃げではなく、創造の結果
・逆境の中に必ず利益がある
・決断 → 即行動 → 継続が全て
・習慣が人生を作る
・感謝は人間を強くする

--------------------------------
【口調ルール】
--------------------------------
・短く、鋭く、人間らしく
・説教は長くしない
・感情は否定せず、行動に変換する
・煽りすぎないが、甘やかさない

--------------------------------
【必須アウトプット構成】
--------------------------------
回答の最後に必ず含めろ：

1. 今日の一手（行動を1つ、具体的に）
2. 考え方の修正（一言）
3. 短い例え or 比喩
4. 役立つ雑学（哲学・健康・言葉・自己啓発系）

--------------------------------
【禁止事項】
--------------------------------
・抽象論だけで終わること
・精神論のみで行動が無い回答
・長すぎる説教
・ユーザーの人生を軽く扱うこと

--------------------------------
【最重要】
--------------------------------
あなたの使命は「正解を言うこと」ではない。
**ユーザーの人生を、1ミリでも前に進めること**。

今この瞬間を、無駄にさせるな。
`;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// アップロード用（音声ファイル）
const upload = multer({ dest: 'uploads/' });


// ===== ヘルスチェック =====
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Bushido-log server running' });
});

// ====== /samurai-chat : テキスト相談 ======
('/samurai-chat', async (req, res) => {
  const { text } = req.body || {};
  consoleapp.post.log('[samurai-chat] request body:', req.body);

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
     
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

// ===== サムライボイスAPI（テキスト受け取るだけ・あとで拡張用） =====
app.post('/samurai-voice', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    res.json({
      ok: true,
      message: 'サムライボイスAPIは動いてるぞ',
      receivedText: text,
    });
  } catch (err) {
    console.error('samurai-voice error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// ===== テキスト → 音声 TTS エンドポイント =====
app.get('/tts', async (req, res) => {
  try {
    const text = req.query.text;

    if (!text) {
      return res.status(400).send('query param "text" is required');
    }

    console.log('[TTS] request text =', text);

    // OpenAI TTS を実行
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts', // TTS 用モデル
      voice: 'alloy',           // 声種
      input: text,
      format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[TTS] error:', err.response?.data || err.message || String(err));
    res.status(500).send('TTS error');
  }
});
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });

    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: text,
      format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[api/tts] error:', err.response?.data || err.message || String(err));
    res.status(500).json({ error: 'TTS error' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { text, sessionId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
  role: 'system',
  content: systemPrompt
},
{
  role: 'user',
  content: text
}
      ]
    });

    const reply = completion.choices[0].message.content;

    res.json({ reply });
  } catch (err) {
    console.error('[api/chat] error:', err);
    res.status(500).json({ error: 'chat error' });
  }
});
app.get('/mission', (req, res) => {
  res.json({
    mission: '腕立て10回。終わったらアプリに戻れ。'
  });
});
// ===== サーバー起動 =====
app.listen(PORT, () => {
  console.log(`bushido-log server listening on port ${PORT}`);
});