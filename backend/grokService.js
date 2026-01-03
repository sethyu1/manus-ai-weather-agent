// Dynamic import for node-fetch v3 (ESM only)
const getFetch = async () => {
  const { default: fetch } = await import('node-fetch');
  return fetch;
};

// You'll need to get an API key from xAI
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

async function queryGrok(prompt, context = '') {
  try {
    console.log('🔍 GROK PROMPT DETAILS:');
    console.log('📝 Original Prompt:', prompt);
    console.log('📄 Context Length:', context.length, 'characters');

    const fetch = await getFetch();
    const messages = [
      {
        role: 'system',
        content: 'You are a weather assistant. Provide simple, clear weather summaries in one sentence.'
      },
      {
        role: 'user',
        content: context ? `${context}\n\nBased on the above weather data, ${prompt}` : prompt
      }
    ];

    console.log('🤖 Full Prompt Sent to Grok:');
    console.log('--- SYSTEM MESSAGE ---');
    console.log(messages[0].content);
    console.log('--- USER MESSAGE ---');
    console.log(messages[1].content);
    console.log('--- END PROMPT ---');

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        messages: messages,
        model: 'grok-4-1-fast-non-reasoning',
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error querying Grok:', error);
    // Fallback response if Grok API fails
    return 'I apologize, but I\'m unable to access the AI service right now. However, I can tell you that Vancouver typically has mild, rainy weather with temperatures ranging from 5-15°C (41-59°F) in winter and 15-25°C (59-77°F) in summer.';
  }
}

module.exports = { queryGrok };
