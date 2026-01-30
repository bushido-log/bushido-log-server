with open("index.js", "r") as f:
    content = f.read()

# /api/tts の後に新しいエンドポイントを追加
old1 = """// ===== 起動 =====
app.listen(PORT, () => {
  console.log`bushido-log server listening on port ${PORT}`);
});"""

new1 = """// ===== 感謝10個達成時のAI感想 =====
app.post('/api/gratitude-comment', async (req, res) => {
  try {
    const { gratitudes } = req.body || {};
    if (!gratitudes) return res.status(400).json({ error: 'gratitudes is required' });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `あなたは「サムライキング」という侍のメンターです。
ユーザーが今日感謝したことを10個書きました。
そのリストを見て、武士道の精神で短い感想を1〜2文で述べてください。
口調は「〜だ。」「〜せよ。」など侍風で、温かく励ます内容にしてください。
絶対に100文字以内で返答すること。`
        },
        {
          role: 'user',
          content: `今日の感謝リスト：${gratitudes}`
        }
      ]
    });
    
    const comment = response.choices[0]?.message?.content || '10個達成だ。よくやった。今日はもう勝っている。';
    res.json({ comment });
  } catch (err) {
    console.error('[gratitude-comment] error:', err?.message || String(err));
    res.status(500).json({ error: 'AI error', comment: '10個達成だ。よくやった。今日はもう勝っている。' });
  }
});

// ===== 起動 =====
app.listen(PORT, () => {
  console.log`bushido-log server listening on port ${PORT}`);
});"""

content = content.replace(old1, new1)

with open("index.js", "w") as f:
    f.write(content)

print("Done!")