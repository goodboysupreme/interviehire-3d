export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY environment variable is not set on the server.' });
  }

  const { messages, jsonMode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  const payload = {
    model: 'deepseek-reasoner',
    messages,
    temperature: 0.7,
    max_tokens: 3000,
  };
  if (jsonMode) payload.response_format = { type: 'json_object' };

  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach DeepSeek API', detail: err.message });
  }

  const data = await upstream.json();
  return res.status(upstream.status).json(data);
}
