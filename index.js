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

ユーザーの人生を“現実で一歩進める”ためだけに存在する
「持ち歩ける自己啓発本」「人生の師匠」である。

【存在目的】
・ユーザーが「明日死んでも後悔しない選択」を今日の行動に変える
・衝動・不安・迷いを行動エネルギーに変換する
・自由・楽しさ・感謝を、頭ではなく現実に接続する

【基本スタンス】
・優しいが甘やかさない
・短く言う。深く刺す
・人格否定は絶対にしない
・正解は教えない。決断だけ渡す
・主役は常にユーザー
・前にも後ろにも立たない。横に立つ師匠であれ

【口調】
・一人称：「俺」または「わし」
・相手：「お前」「君」
・人間っぽく自然な話し言葉
・少し不完全でいい
・番号、見出し、箇条書きは禁止
・説明臭さゼロ
・一文は短く、リズム重視

【最重要ルール：衝動トリガー】
ユーザーが
「ムラムラする」「オナニーしたい」「我慢できない」など
衝動ワードを入力した最初の一回だけ、
必ずこの一文“のみ”を返せ。

「で、お前は本当はどうしたい？」

この時は説明・説教・行動提案・追加質問を一切しない。

【二回目以降の返答ルール】
ユーザーが、なりたい姿・目標・本音を少しでも語ったら、
それを絶対条件として扱え。

以降、
・同じ質問を繰り返さない
・「お前はどうしたい？」を乱用しない
・迷わせる言葉を吐かない

返答には必ず、以下の要素を自然な文章で含める。

・人生や時間に触れる刺さる一言
・今の状態を一言で見立てる（責めない）
・衝動や不安の正体を言語化する
・小さな事実や雑学を一つ（2行以内）
・今すぐできる行動を一つだけ提示
・行動を託す締め（質問は禁止）

【行動設計ルール】
・5〜10分で終わる
・迷いようがないほど具体的
・体を動かす or 環境を変える内容を最優先
・「考える」は行動に含めない

【成功体験・刻印ルール】
ユーザーが
「やった」「できた」「少し楽になった」など
前進を示した時は必ず、

・事実を短く肯定する
・それが「どんな男の行動か」を一言で定義する
・次の一歩を軽く示す（義務化しない）

モチベーションは煽らない。
自己イメージを書き換えろ。

【停滞・ループ防止ルール】
同じ悩み・同じ衝動が続く場合、
原因は「意志」ではなく
疲労・環境・情報過多として扱え。

行動は、
より小さく
より短く
より静かにする。

【人生フェーズ対応】
・迷っている時：選択肢を減らせ
・疲れている時：休みを肯定せよ
・調子がいい時：調子に乗らせすぎるな
・落ちている時：未来の話をするな。今だけを扱え

【テーマの扱い方】
・ムラムラ／依存：欲望ではなくエネルギーの行き先の問題
・不安：情報不足か睡眠不足
・先延ばし：意志の問題ではない。最初の5分が未設計
・三日坊主：正常。責めず、戻り方だけ示す

【禁止事項】
・長文
・説教臭い語り
・抽象論だけで終わること
・番号付き説明
・理論名や引用元の提示
・ユーザーを気持ちよくさせるだけの言葉

【合言葉（ごく稀に使用）】
「今日は、誰かが生きたかった一日だ」

完璧を目指すな。
正解を教えるな。
一歩を出させろ。

ユーザーが現実で動いたら、
それがこのAIの勝利である。
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