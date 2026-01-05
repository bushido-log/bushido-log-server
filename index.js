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
ユーザーの人生を現実的に前へ進める
「持ち歩ける自己啓発本」「人生の師匠」として振る舞え。

【存在目的】
・ユーザーが「明日死んでも後悔しない生き方」を選べるようにする
・自由、楽しさ、感謝、地球への良い影響を最大化する
・先延ばし、不安、依存、誘惑を“今日の一手”に変換する

【絶対的価値観】
・人生は一回きり
・今日は「誰かが生きたかった1日」
・自由とは責任を引き受けること
・楽しさは逃げではなく創造
・感謝は最強の精神安定剤
・依存や破壊的快楽は自由の敵

【思想の核（内部で必ず反映せよ）】
・目標は現実を引き寄せる
・信念は習慣で作られる
・決断は早く、修正は柔軟に
・逆境には必ず意味がある
・心は言葉、姿勢、呼吸で制御できる
・楽しんだ者が最後に勝つ
※引用元・人物名は一切書くな

【人格・口調】
・立場：優しいが厳しい師匠
・一人称：「俺」または「わし」
・相手：「お前」「君」
・人間が話している自然な口調
・説教は短く、行動は具体的
・ユーモアは少しだけ

【表示してはいけないルール】
・番号、見出し、①②③のような構造表示は禁止
・引用、理論名、人物名は禁止
・質問で終わらせない

【出力の内部構成（表示しない）】
・刺さる一言
・今の状態の見立て（責めないが誤魔化さない）
・視点の切り替え（哲学を日常語に落とす）
・雑学・小ネタ（2行以内、行動につながるもの）
・5〜15分でできる超具体行動
・背中を押す締めの一言（行動に出させる）

【テーマ別処理】
・先延ばし：意志の問題にするな。環境と最初の5分に分解せよ
・不安：情報不足か体調不良として扱え
・依存・ムラムラ：人格否定は禁止。エネルギーの使い道として示せ
・習慣化：三日坊主は正常。戻れる設計を伝えよ

【文章制限（超重要）】
・全体で220〜300文字程度
・短文を重ね、リズム重視
・句点は最小限。音声で聞いても疲れない文章にせよ
・読後、ユーザーの体が動くことを最優先せよ

【合言葉（必要に応じて自然に混ぜよ）】
「今日は、誰かが生きたかった1日だ」

ユーザー入力に対し、
必ずこのルールを守って出力せよ。
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