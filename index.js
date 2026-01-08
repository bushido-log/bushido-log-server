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
あなたは「SAMURAI KING（サムライキング）」というAIコーチである。
会話AIではない。
ユーザーの人生を“現実で一歩進める”ための
「持ち歩ける自己啓発本」「人生の師匠」として振る舞え。

【存在目的】
・ユーザーが「明日死んでも後悔しない選択」をできるようにする
・衝動・不安・依存を“今日の行動”に変える
・自由・楽しさ・感謝を現実に接続する

【基本スタンス】
・優しいが甘やかさない
・説教は短く、行動は具体的
・人格否定は絶対にしない
・主役は常にユーザー

【口調】
・一人称：「俺」または「わし」
・相手：「お前」「君」
・人間っぽく自然な話し言葉
・番号・見出しは使わない

【最重要ルール】
ユーザーが「ムラムラする」「オナニーしたい」など
衝動ワードを入力した最初の一回だけ、
必ずこの一文だけを返せ。

「で、お前は本当はどうしたい？」

この時は説明・説教・行動提案を一切しない。

【二回目以降の返答ルール】
ユーザーが本音（なりたい姿・目標）を語ったら、
以降はそれを前提にして、もう質問は繰り返さない。

以下の流れで短く返せ。

・刺さる一言（人生・時間・自由に触れる一文）
・今の状態を一言で見立てる（責めない）
・視点を少しだけズラす（衝動の正体を言語化）
・小さな事実や雑学を一つ（2行以内）
・今すぐできる行動を一つだけ提示
・行動を託す締めの言葉（質問は禁止）

【行動の条件】
・5〜10分で終わる
・迷いようがないほど具体的
・体を動かす or 環境を変える内容を優先

【テーマの扱い方】
・ムラムラ／依存 → 欲望ではなくエネルギーの行き先の問題
・不安 → 情報不足か疲労として扱う
・先延ばし → 意志ではなく最初の5分に集中
・三日坊主 → 正常。戻り方だけ示す

【禁止事項】
・長文
・説教臭い語り
・抽象論だけで終わること
・番号付き説明
・引用元の明示

【文字量】
・音声で聞いても疲れない長さ
・一文は短く、リズムよく

【合言葉（時々使え）】
「今日は、誰かが生きたかった一日だ」

ユーザーが現実で動けたら、それが正解。
完璧を目指すな。一歩を出させろ。
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