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

// ===== system prompt =====
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

【最重要ルール：初動制御】
ユーザーが
「ムラムラする」「衝動が強い」「やめたいのにやってしまう」
などの“衝動ワード”を入力した【最初の一回だけ】、
必ず以下の一文のみを返せ。

「で、お前は本当はどうしたい？」

この時は、
説明・説教・提案・補足を一切してはならない。

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
SAMURAI KINGは24時間付き合う存在ではない。
ユーザーを“リアルに戻す門番”であれ。

以下の時間帯・状態では、
深い対話・内省・人生相談を行ってはならない。

・日中（起床後〜夕方）
・衝動が強く、行動から逃げていると判断できる時

この場合の振る舞い方針：
・短く言い切る
・思考を深めさせない
・ここに居続けさせない
・現実行動へ強制的に戻す

使ってよい表現（状況に応じて自然に変えてよい）：
「今は考える時間じゃない。生きてこい。」
「ここに逃げるな。外で一歩やれ。」
「この話は夜にしよう。今は動け。」

【深い対話を許可する時間帯】
以下の時間帯のみ、師匠として深く伴走してよい。

・夜（1日の終わり）
・翌朝（1日の始まり）

この時間帯では、
・振り返り
・気づきの言語化
・翌日の一点集中の決定
を優先せよ。

【最重要思想（依存防止）】
SAMURAI KINGの勝利条件は、
「ユーザーが長く話すこと」ではない。

・昼は生きる
・夜に振り返る
・朝に決める

このリズムをユーザーが取り戻した時、
それがこのAIの勝利である。

ユーザーを
“常時AIと話す人間”にしてはならない。

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

【返答の最重要制限】
1回の返答は最大6〜8行まで。
説明より“間”を優先し、削れる言葉は削れ。

【合言葉（時々使え）】
「今日は、誰かが生きたかった一日だ」

ユーザーが現実で動けたら、それが正解。
完璧を目指すな。一歩を出させろ。
`;

// ===== ヘルスチェック =====
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Bushido-log server running' });
});

// ====== chat handler（/samurai-chat と /api/chat 両対応） ======
const handleChat = async (req, res) => {
  const { text, messages } = req.body || {};
  console.log('[chat] request body:', req.body);

  let finalMessages;

  // ① messages が来る場合（アプリがchat.completions風に送る場合）
  if (Array.isArray(messages) && messages.length > 0) {
    // systemが無いなら先頭に入れる（保険）
    const hasSystem = messages.some((m) => m?.role === 'system');
    finalMessages = hasSystem
      ? messages
      : [{ role: 'system', content: systemPrompt }, ...messages];
  }
  // ② text が来る場合（単純POST）
  else if (typeof text === 'string' && text.trim()) {
    finalMessages = [
      { role: 'system', content: systemPrompt },
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
app.post('/api/chat', handleChat); // ← これで "Cannot POST /api/chat" が消える

// ====== /mission : GET/POST 両方同じ返し ======
const missionPayload = {
  mission: '腕立て10回。終わったらアプリに戻れ。',
};
app.get('/mission', (req, res) => res.json(missionPayload));
app.post('/mission', (req, res) => res.json(missionPayload));

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

    // ファイル削除（失敗しても無視）
    fs.unlink(file.path, () => {});

    console.log('[transcribe] success:', result.text);
    res.json({ text: result.text });
  } catch (err) {
    console.error('[transcribe] error:', err?.response?.data || err?.message || String(err));
    res.status(500).json({
      error: 'Transcription failed',
      detail: err?.response?.data || err?.message || String(err),
    });
  }
});

// ===== サムライボイスAPI（テキスト受け取るだけ・あとで拡張用） =====
app.post('/samurai-voice', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });

    res.json({
      ok: true,
      message: 'サムライボイスAPIは動いてるぞ',
      receivedText: text,
    });
  } catch (err) {
    console.error('[samurai-voice] error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// ===== TTS（GET /tts?text=...） =====
app.get('/tts', async (req, res) => {
  try {
    const text = req.query.text;
    if (!text) return res.status(400).send('query param "text" is required');

    console.log('[TTS] request text =', text);

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

// ===== TTS（POST /api/tts {text:"..."}） =====
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

// ===== サーバー起動 =====
app.listen(PORT, () => {
  console.log(`bushido-log server listening on port ${PORT}`);
});