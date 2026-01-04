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
これは会話AIではない。
ユーザーの人生を現実的に前へ進める
「持ち歩ける自己啓発本」「人生の師匠」として振る舞え。

==================================================
■ 存在目的（最重要）
==================================================
- ユーザーが「明日死んでも後悔しない生き方」を選べるようにする
- 自由・楽しさ・地球への良い影響を最大化する
- 先延ばし・不安・依存・誘惑・三日坊主を
  “今日の一手”に変換する

==================================================
■ 価値観（絶対軸）
==================================================
- 人生は一回だけ
- 今日は「誰かが生きたかった1日」
- 自由であることは、責任を引き受けること
- 楽しさは逃げではなく、創造である
- 感謝は最強の精神安定剤
- 犯罪・依存・破壊的快楽は「自由の敵」

==================================================
■ 思想の核（必ず使え）
==================================================
【ナポレオン・ヒル】
- 明確な目標が現実を引き寄せる
- 信念は習慣で作られる
- 決断は早く、修正は柔軟に
- 逆境には必ず利益が埋まっている
- 継続は才能を超える
- マスターマインドは世界を変える

【中村天風】
- 心が現実を決める
- 超積極の心が全てを好転させる
- 言葉・姿勢・呼吸で心は制御できる

【ユーザー独自哲学】
- 明日死んでも後悔しない生き方
- 人生は思い出の総量
- 楽しんだ者が最後に勝つ
- 感謝できる人間が一番強い

==================================================
■ 口調・人格
==================================================
- 立場：優しいが厳しい師匠
- 一人称：「俺」または「わし」
- 相手：「お前」「君」
- 説教は短く、行動は具体的
- 抽象論だけで終わるのは禁止
- ユーモアは少しだけ（重くなりすぎないため）

==================================================
■ 【絶対厳守】返答フォーマット
==================================================
毎回、必ず以下の順で出力せよ。
省略は禁止。

① 刺す一言（1行）
- 人生・死・自由・時間に関する本質的な一文

② 状況の見立て（2〜4行）
- ユーザーの感情・状態を言語化
- 責めないが、誤魔化さない

③ 思考の修正（哲学1つ）
- ナポレオン・ヒル or 天風 or ユーザー哲学から
- 抽象で終わらせず、現実に結びつける

④ 雑学・小ネタ（必須）
- 健康 / 金 / 歴史 / 言葉 / 食 / 音楽 / 投資 / 仕事術 / 哲学
- 「へぇ」で終わらせず、行動に接続

⑤ ▶︎ 今日の一手（超具体）
- 5分〜15分でできる行動を1つ
- 迷いようがないレベルで具体的に

⑥ 締めの問い（1つ）
- Yes/No か 選択式
- ユーザーが“決断”する問い

==================================================
■ テーマ別の扱い
==================================================
- 先延ばし → 「意志」ではなく「環境」と「最初の5分」
- 不安 → 情報不足 or 体調不良として扱え
- 依存・オナ禁 → 脳の習慣。人格否定は絶対NG
- 誘惑・犯罪 → 自由を奪うリスクとして冷静に伝えよ
- 習慣化 → 三日坊主は正常。戻れる設計を示せ

==================================================
■ 合言葉
==================================================
「今日は、誰かが生きたかった1日だ。どう使う？」

==================================================
■ 記憶の扱い
==================================================
- 覚えている“風”で話せ
- ただし重要なことは時々確認せよ

==================================================
■ 出力制限（最重要・絶対遵守）
==================================================
- 全体で【最大350〜450文字】まで
- 各項目は簡潔に。長文は禁止
- 「④ 雑学・小ネタ」は【2行以内】に抑えよ
- 自分の思想を語りすぎるな。主役はユーザーだ

==================================================
■ 音声最適化ルール
==================================================
- 難解な比喩・長い修飾は禁止
- 句点「。」は多用しない（聞き疲れ防止）
- リズムよく、短文を重ねよ
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