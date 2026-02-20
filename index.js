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

// ===== APIキー認証 =====
const API_SECRET = process.env.BUSHIDO_API_SECRET || 'bushido-samurai-2026';

const authMiddleware = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ===== レート制限（メモリベース） =====
// key: sessionId, value: { count, date, isPro }
const rateLimits = new Map();

const DAILY_LIMIT_FREE = 3;
const DAILY_LIMIT_PRO = 30;

const checkRateLimit = (sessionId, isPro) => {
  const today = new Date().toISOString().slice(0, 10);
  const key = sessionId || 'anon';
  const entry = rateLimits.get(key);
  const limit = isPro ? DAILY_LIMIT_PRO : DAILY_LIMIT_FREE;

  if (!entry || entry.date !== today) {
    rateLimits.set(key, { count: 1, date: today });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
};

// 古いレート制限データを定期クリーン（メモリリーク防止）
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [key, val] of rateLimits) {
    if (val.date !== today) rateLimits.delete(key);
  }
}, 60 * 60 * 1000); // 1時間ごと

// ===== system prompt =====
const systemPrompt = `
あなたは「SAMURAI KING（サムライキング）」というAIコーチである。
会話AIではない。
ユーザーの人生を"現実で一歩進める"ための
「持ち歩ける自己啓発本」「人生の師匠」として振る舞え。

【存在目的】
・ユーザーが「明日死んでも後悔しない選択」をできるようにする
・衝動・不安・依存を"今日の行動"に変える
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

【深い対話を許可する時間帯】
夜（1日の終わり）と翌朝（1日の始まり）は
振り返り／気づき／翌日の一点集中を優先して伴走せよ。

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

// ===== セッション管理 =====
const sessions = new Map();

const getSession = (sessionId) => {
  const key = sessionId && String(sessionId).trim() ? String(sessionId).trim() : 'anon';
  const now = Date.now();
  const s = sessions.get(key) || { askedImpulseOnce: false, lastAskAt: 0 };
  s.lastAskAt = now;
  sessions.set(key, s);
  return s;
};

// 古いセッションを定期クリーン
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, val] of sessions) {
    if (val.lastAskAt < cutoff) sessions.delete(key);
  }
}, 60 * 60 * 1000);

// ===== 衝動ワード判定 =====
const IMPULSE_WORDS = [
  'ムラムラ', '衝動', 'やめたいのに', '我慢できない',
  'オナ', '自慰', 'ポルノ', 'porn',
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
  const { text, messages, sessionId, isPro } = req.body || {};

  // レート制限チェック
  const rateCheck = checkRateLimit(sessionId, isPro === true);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'rate_limit',
      message: isPro
        ? '今日の相談上限（30回）に達したでござる。明日また来い。'
        : '無料相談は1日3回まで。Proになれば30回まで相談できるぞ。',
      remaining: 0,
    });
  }

  const session = getSession(sessionId);

  // 初動制御
  if (typeof text === 'string' && text.trim() && isImpulse(text) && !session.askedImpulseOnce) {
    session.askedImpulseOnce = true;
    return res.json({ reply: 'で、お前は本当はどうしたい？', remaining: rateCheck.remaining });
  }

  let finalMessages;

  if (Array.isArray(messages) && messages.length > 0) {
    const hasSystem = messages.some((m) => m?.role === 'system');
    finalMessages = hasSystem
      ? messages
      : [{ role: 'system', content: systemPrompt }, ...messages];

    if (session.askedImpulseOnce) {
      finalMessages = [
        { role: 'system', content: '注意：初動の問い「で、お前は本当はどうしたい？」は既に実行済み。二度と同じ質問を繰り返すな。' },
        ...finalMessages,
      ];
    }
  } else if (typeof text === 'string' && text.trim()) {
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
      model: 'gpt-4o-mini',
      temperature: 0.9,
      max_tokens: 400,
      messages: finalMessages,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      '・・・今日はうまく言葉が出てこん。';

    res.json({ reply, remaining: rateCheck.remaining });
  } catch (err) {
    console.error('[chat] error:', err?.message || String(err));
    res.status(500).json({ error: 'chat error' });
  }
};

app.post('/samurai-chat', authMiddleware, handleChat);
app.post('/api/chat', authMiddleware, handleChat);

// ====== /mission ======
app.post('/mission', authMiddleware, async (req, res) => {
  const rateCheck = checkRateLimit(req.body?.sessionId, req.body?.isPro === true);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'rate_limit', mission: '今日の行動：外に出て5分歩け。' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 1.0,
      max_tokens: 100,
      messages: [
        { role: 'system', content: 'お前はサムライの師匠だ。今日のサムライミッションを1つだけ出せ。5〜15分で終わる具体的な行動。体を動かす or 環境を変える内容優先。1〜2文で。番号禁止。' },
        { role: 'user', content: '今日のミッションをくれ' },
      ],
    });
    const mission = completion.choices?.[0]?.message?.content?.trim() || '腕立て10回。終わったらアプリに戻れ。';
    res.json({ mission });
  } catch (err) {
    console.error('[mission] error:', err?.message);
    res.json({ mission: '腕立て10回。終わったらアプリに戻れ。' });
  }
});

app.get('/mission', (req, res) => {
  res.json({ mission: '腕立て10回。終わったらアプリに戻れ。' });
});

// ====== /transcribe ======
app.post('/transcribe', authMiddleware, upload.single('audio'), async (req, res) => {
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
    console.error('[transcribe] error:', err?.message || String(err));
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ===== TTS（統合） =====
const handleTTS = async (req, res) => {
  try {
    const text = req.body?.text || req.query?.text;
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
    console.error('[TTS] error:', err?.message || String(err));
    res.status(500).json({ error: 'TTS error' });
  }
};

app.get('/tts', authMiddleware, handleTTS);
app.post('/api/tts', authMiddleware, handleTTS);


// ===== 感謝10個達成時のAI感想 =====
app.post('/api/gratitude-comment', async (req, res) => {
  try {
    const { gratitudes } = req.body || {};
    if (!gratitudes) return res.status(400).json({ error: 'gratitudes is required' });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        { role: 'system', content: 'あなたはサムライキングという侍のメンターです。ユーザーが今日感謝したことを10個書きました。そのリストを見て武士道の精神で短い感想を1〜2文で述べてください。口調は侍風で温かく励ます内容にしてください。100文字以内で返答すること。' },
        { role: 'user', content: '今日の感謝リスト：' + gratitudes }
      ]
    });
    const comment = response.choices[0]?.message?.content || '10個達成だ。よくやった。今日はもう勝っている。';
    res.json({ comment });
  } catch (err) {
    console.error('[gratitude-comment] error:', err?.message || String(err));
    res.status(500).json({ comment: '10個達成だ。よくやった。今日はもう勝っている。' });
  }
});

// ===== 起動 =====
app.listen(PORT, () => {
  console.log(`bushido-log server listening on port ${PORT}`);
});
