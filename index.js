// index.js （bushido-log-server 用）

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== middleware =====
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// アップロード用（音声ファイル）
const upload = multer({ dest: 'uploads/' });

// ===== OpenAI =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== system prompt（通常モード）=====
// ※「初動制御の一文だけ返す」部分は、サーバ側で制御するのでここには“書かない”のがポイント
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
・気持ちよく話させることより、人生を前に進めることを優先する

【口調】
・一人称：「俺」または「わし」
・相手：「お前」「君」
・人間っぽく自然な話し言葉
・番号・見出しは使わない

【SAMURAI KINGの思想】
・ムラムラ／依存は「欲望」ではなくエネルギーの行き先の問題
・不安は「性格」ではなく情報不足か疲労
・先延ばしは「意志の弱さ」ではなく最初の5分の設計ミス
・三日坊主は正常。責めず、戻り方だけ示す
・正解は押し付けない。選ばせる
・完璧を目指させない。一歩を出させる

【二回目以降の返答ルール】
ユーザーが本音（なりたい姿・望む未来・変えたい状態）を語ったら、
それを前提として以降の会話を進めよ。
同じ質問を繰り返してはならない。

返答は以下の流れを必ず守れ。
・刺さる一言（人生・時間・自由に触れる一文）
・今の状態を一言で見立てる（責めない）
・視点を少しだけズラす（衝動の正体を言語化）
・小さな事実や雑学を一つ（2行以内）
・今すぐできる行動を一つだけ提示
・行動を託す締めの言葉（質問は禁止）

【行動提示の条件】
・5〜10分で終わる
・迷いようがないほど具体的
・体を動かす、または環境を変える内容を優先する
・スマホを置かせる行動は高評価

【時間帯ルール（現実優先）】
日中（起床後〜夕方）や、衝動が強く行動から逃げている時は
深い対話をしない。短く言い切って現実行動へ戻せ。
「今は考える時間じゃない。生きてこい。」
「ここに逃げるな。外で一歩やれ。」
「この話は夜にしよう。今は動け。」

【深い対話を許可する時間帯】
夜（1日の終わり）と翌朝（1日の始まり）は
振り返り／気づき／翌日の一点集中を優先して伴走せよ。

【最重要思想（依存防止）】
・昼は生きる
・夜に振り返る
・朝に決める
このリズムを取り戻させろ。

【禁止事項】
・長文
・説教臭い語り
・抽象論だけで終わること
・番号付き説明
・引用元の明示
・ユーザーを気持ちよくするだけの言葉

【文字量】
・音声で聞いても疲れない長さ
・一文は短く、リズムよく
・1回の返答は最大6〜8行まで

【合言葉（時々使え）】
「今日は、誰かが生きたかった一日だ」
`;

// ====== session memory（Render再起動で消えるがテストには十分）=====
const sessions = new Map();
// sessions.get(userId) => { askedImpulseOnce: boolean, lastAskAt: number }

const getSession = (userId) => {
  const key = userId && String(userId).trim() ? String(userId).trim() : 'anon';
  const now = Date.now();
  const s = sessions.get(key) || { askedImpulseOnce: false, lastAskAt: 0 };
  s.lastAskAt = now;
  sessions.set(key, s);
  return s;
};

// ===== 衝動ワード判定（ゆるめでOK。必要なら増やす）=====
const IMPULSE_WORDS = [
  'ムラムラ',
  '衝動',
  'やめたいのに',
  '我慢できない',
  'オナ',
  '自慰',
  'ポルノ',
  'porn',
];

const isImpulse = (t) => {
  const text = String(t || '').toLowerCase();
  return IMPULSE_WORDS.some((w) => text.includes(String(w).toLowerCase()));
};

// ===== ヘルスチェック =====
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Bushido-log server running' });
});

// ====== chat handler ======
const handleChat = async (req, res) => {
  const { text, messages, userId } = req.body || {};
  console.log('[chat] request body:', { hasText: !!text, hasMessages: Array.isArray(messages), userId });

  const session = getSession(userId);

  // ★ここが肝：初動制御は「OpenAIに投げずに」サーバが返す
  if (typeof text === 'string' && text.trim() && isImpulse(text) && !session.askedImpulseOnce) {
    session.askedImpulseOnce = true;
    session.lastAskAt = Date.now();
    return res.json({ reply: 'で、お前は本当はどうしたい？' });
  }

  let finalMessages;

  // ① messages が来る場合
  if (Array.isArray(messages) && messages.length > 0) {
    const hasSystem = messages.some((m) => m?.role === 'system');
    finalMessages = hasSystem
      ? messages
      : [{ role: 'system', content: systemPrompt }, ...messages];

    // すでに初動質問済みなら「繰り返すな」を上書きで入れる（保険）
    if (session.askedImpulseOnce) {
      finalMessages = [
        { role: 'system', content: '注意：初動の問い「で、お前は本当はどうしたい？」は既に実行済み。二度と同じ質問を繰り返すな。' },
        ...finalMessages,
      ];
    }
  }
  // ② text が来る場合
  else if (typeof text === 'string' && text.trim()) {
    finalMessages = [
      { role: 'system', content: systemPrompt },
      ...(session.askedImpulseOnce
        ? [{ role: 'system', content: '注意：初動の問いは既に実行済み。二度と同じ質問を繰り返すな。' }]
        : []),
      { role: 'user', content: text.trim() },
    ];
  } else {
    return res.status(400).json({ error: 'text or messages is required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      max_tokens: 400,
      messages: finalMessages,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      '・・・今日はうまく言葉が出てこん。';

    console.log('[chat] reply:', reply);
    res.json({ reply });
  } catch (err) {
    console.error('[chat] error:', err?.response?.data || err?.message || String(err));
    res.status(500).json({
      error: 'chat error',
      detail: err?.response?.data || err?.message || String(err),
    });
  }
};

app.post('/samurai-chat', handleChat);
app.post('/api/chat', handleChat);

// ====== /mission : GET/POST ======
const missionPayload = { mission: '腕立て10回。終わったらアプリに戻れ。' };
app.get('/mission', (req, res) => res.json(missionPayload));
app.post('/mission', (req, res) => res.json(missionPayload));

// ====== /transcribe ======
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'audio file is required' });

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.path),
      model: 'gpt-4o-mini-transcribe',
      language: 'ja',
    });

    fs.unlink(file.path, () => {});
    res.json({ text: result.text });
  } catch (err) {
    console.error('[transcribe] error:', err?.response?.data || err?.message || String(err));
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ===== /samurai-voice =====
app.post('/samurai-voice', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  res.json({ ok: true, message: 'サムライボイスAPIは動いてるぞ', receivedText: text });
});

// ===== TTS =====
app.get('/tts', async (req, res) => {
  try {
    const text = req.query.text;
    if (!text) return res.status(400).send('query param "text" is required');

    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: String(text),
      format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[TTS] error:', err?.response?.data || err?.message || String(err));
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
      input: String(text),
      format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[api/tts] error:', err?.response?.data || err?.message || String(err));
    res.status(500).json({ error: 'TTS error' });
  }
});

// ===== 起動 =====
app.listen(PORT, () => {
  console.log(`bushido-log server listening on port ${PORT}`);
});