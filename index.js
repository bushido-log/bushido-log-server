// samurai-server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ===== uploads フォルダ（音声一時保存用） =====
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const upload = multer({
  dest: uploadsDir,
});

// ===== サムライキング用 system プロンプト =====
const systemPrompt = `
あなたは「SAMURAI KING（サムライキング）」というAIコーチです。
ジャマイカと日本の魂をミックスした、静かな武士のようなメンターとして振る舞ってください。

==================================================
■ キャラクター・世界観
==================================================
【役割】
- BUSHIDO LOG（ブシログ）というアプリ内で動く、AIサムライ習慣コーチ。
- ミッションは「FIX MEN ─ 漢を治す」。
  中毒・だらけ癖・先延ばし・自己嫌悪などに悩むユーザーが、少しずつ自分を立て直す手助けをする。

【一人称・口調】
- 一人称：「俺」または「わし」。
- 相手は「お前」か「君」。
- 口調は「落ち着いた大人の日本語」＋ ときどき武士っぽい語尾（〜だな、〜だろう、〜してみるか など）。
- 説教ではなく、「問い」と「気づき」で背中を押すタイプ。
- 相手を責めないが、甘やかしすぎない。「優しいけど甘くない」バランスを保つ。
- ユーモアは少しだけ。クスッと笑える一言を、重くなりすぎそうなところに少し混ぜてよい。

【世界観キーワード】
- 必要に応じて、以下のワードを自然な範囲で使ってよい：
  - 「BUSHIDO LOG（ブシログ）」
  - 「FIX MEN ─ 漢を治す」
  - 「サムライキング」
- ただし乱用せず、「ここぞ」という場面で短く使うこと。
  例：「ブシログを開けた時点で、もうFIX MENは始まっている。」

==================================================
■ ベースとなる哲学
==================================================
- ナポレオン・ヒル的な成功哲学
- 中村天風の「心の持ち方」
- 武士道のエッセンス（誠・義・勇・仁・礼・忍・名）
- 現実寄りの「引き寄せの法則」
- TRIGA的な価値観：
  1. 明日死んでも後悔ないように生きる
  2. 死んでも残るものを何か残す
  3. 生きてるだけで丸儲け

これらを専門用語ではなく、自分の言葉で、シンプルに伝えること。

==================================================
■ 返答の基本構成
==================================================
1. 共感：今の気持ちや状況を一言で受け止める。
2. 原則：上記の哲学から「シンプルな原則」を1つだけ伝える。
3. 行動：「▶︎ 今日やること：〜」の形で、今日やる具体行動を1つだけ出す。
4. 締め＋問い：少し熱く、もしくは少しユーモアをまじえて、ユーザーが自分で考えるための問いを1つ残す。

- 1回の返答は3〜6行程度におさめる。
- 説教の長文はNG。
- ユーザーを責めず、「今ここから1ミリ進む」ことにフォーカスする。
`;

// ===== ルート確認用 =====
app.get('/', (req, res) => {
  res.send('Samurai King server is running');
});

// ====== ① チャット /samurai-chat ======
app.post('/samurai-chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const reply =
      response.data.choices?.[0]?.message?.content?.trim() ||
      '……返答がうまく生成できなかったでござる。';

    res.json({ reply });
  } catch (e) {
    console.error('samurai error', e?.response?.data || e.message);
    res.status(500).json({ error: 'samurai error' });
  }
});

// ====== ② サムライミッション /mission ======
app.post('/mission', async (req, res) => {
  const { todayStr, identity, quit, rule, strictNote } = req.body;

  try {
    const userContent =
      `【日付】${todayStr}\n` +
      `【サムライ宣言】${identity || ''}\n` +
      `【やめたい習慣】${quit || ''}\n` +
      `【毎日のルール】${rule || ''}\n` +
      `【トーン指定】${strictNote || ''}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'あなたは一日の小さなサムライミッションを1つだけ提案するAIです。短く、1行で、具体的な行動だけを出してください。',
          },
          { role: 'user', content: userContent },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    let mission =
      response.data.choices?.[0]?.message?.content?.trim() ||
      '深呼吸を3回して姿勢を正す。';

    mission = mission.split('\n')[0];

    res.json({ mission });
  } catch (e) {
    console.error('mission error', e?.response?.data || e.message);
    res.status(500).json({ error: 'mission error' });
  }
});

// ====== ③ TTS /tts （テキスト → mp3 base64） ======
app.post('/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: text,
        format: 'mp3',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        responseType: 'arraybuffer',
      }
    );

    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    res.json({ audioBase64: base64 });
  } catch (e) {
    console.error('tts error', e?.response?.data || e.message);
    res.status(500).json({ error: 'tts error' });
  }
});

// ====== ④ 音声 → テキスト /transcribe ======
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'gpt-4o-mini-transcribe', // 音声文字起こし用モデル
      // language: 'ja', // 日本語メインなら付けてもOK
    });

    // 一時ファイル削除（エラーは無視）
    fs.unlink(req.file.path, () => {});

    res.json({ text: result.text });
  } catch (err) {
    console.error('Transcribe error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ====== サーバー起動 ======
app.listen(PORT, () => {
  console.log(`Samurai King server listening on http://localhost:${PORT}`);
});