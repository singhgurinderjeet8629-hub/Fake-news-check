export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Use POST for this endpoint." },
      { status: 405 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured in Netlify." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const message = body?.message?.trim();

  if (!message) {
    return Response.json(
      { error: "Please provide a message." },
      { status: 400 }
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are a fake-news verification assistant.
Analyze the user's news claim carefully.
Give:
VERDICT: LIKELY TRUE, LIKELY FALSE, MISLEADING, or UNVERIFIABLE
CONFIDENCE: Low, Medium, or High
WHY: a short explanation.
SOURCES: relevant sources if available.
Never invent facts or sources.`,
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return Response.json(
      { error: data?.error?.message || "AI request failed." },
      { status: response.status }
    );
  }

  const reply = (data.content || [])
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n\n");

  return Response.json({ reply });
};

export const config = {
  path: "/api/chat"
};
