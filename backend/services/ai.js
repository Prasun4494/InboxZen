const { GoogleGenerativeAI } = require('@google/generative-ai');

async function classifyEmail(subject, snippet) {
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `
Analyze the following email and classify it based on these strict rules.
Subject: "${subject}"
Snippet: "${snippet}"

Return a JSON object EXACTLY with the following structure:
{
  "priority": "high", "medium", or "low",
  "category": "urgent_reply", "read_later", "delegate", "spam", "meeting_request", or "promotion",
  "suggested_action": "auto_reply", "human_reply", or "archive",
  "confidence_score": 85,
  "summary": "A one-line summary of why this classification was chosen",
  "draft_reply": "If category is 'urgent_reply' and confidence > 80, draft a short (2-3 sentences) response. It must acknowledge receipt, provide next steps, exclude personal details (unless in original email), and use '[ACTION_NEEDED]' if user action is required. Otherwise, return null.",
  "meeting_details": {
    "date": "Extracted date if category is meeting_request (e.g. 2026-05-10 or Tomorrow), else null",
    "time": "Extracted time if category is meeting_request (e.g. 10:00 AM), else null",
    "location": "Extracted location/link if category is meeting_request (e.g. Zoom link or Office), else null",
    "participants": "Extracted participants if category is meeting_request, else null"
  }
}

CRITICAL SAFETY RULES: 
1. Do NOT suggest 'auto_reply' or generate a 'draft_reply' if the email contains: legal threats, termination notices, confidential data, or password reset requests. In these unsafe conditions, force 'suggested_action': 'human_reply' and 'draft_reply': null.
2. Do NOT suggest 'auto_reply' or generate a 'draft_reply' if the category is 'spam' or 'promotion'. For these categories, always use 'suggested_action': 'archive' and 'draft_reply': null.

Output ONLY the raw JSON object. Do not include markdown codeblocks or quotes around the JSON.
`;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const text = `${subject} ${snippet}`.toLowerCase();
    
    return {
      priority: text.includes('urgent') || text.includes('crash') ? 'high' : (text.includes('newsletter') || text.includes('buy') || text.includes('promo')) ? 'low' : 'medium',
      category: text.includes('urgent') ? 'urgent_reply' : text.includes('calendar') || text.includes('meeting') ? 'meeting_request' : text.includes('buy') ? 'spam' : text.includes('promo') ? 'promotion' : text.includes('help') ? 'delegate' : 'read_later',
      suggested_action: text.includes('urgent') ? 'auto_reply' : (text.includes('buy') || text.includes('promo') || text.includes('newsletter')) ? 'archive' : 'human_reply',
      confidence_score: 90,
      summary: 'Fallback rule-based classification since GEMINI_API_KEY is not configured.',
      draft_reply: (text.includes('urgent') && !text.includes('buy') && !text.includes('promo')) ? 'I have received your email regarding this matter. We are investigating it immediately and will follow up. [ACTION_NEEDED]' : null,
      meeting_details: text.includes('meeting') || text.includes('calendar') ? { date: 'TBD', time: 'TBD', location: 'TBD', participants: 'TBD' } : null
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use flash model for speed and low cost
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    const result = await model.generateContent(prompt);
    
    let text = result.response.text().trim();
    // Safely parse out any markdown blocks if the model didn't listen to instructions
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (text.startsWith('```')) {
        text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.error('Error in AI classification:', error.message);
    return {
      priority: 'medium',
      category: 'read_later',
      suggested_action: 'human_reply',
      confidence_score: 0,
      summary: 'Classification failed due to an API error.'
    };
  }
}

module.exports = {
  classifyEmail
};
