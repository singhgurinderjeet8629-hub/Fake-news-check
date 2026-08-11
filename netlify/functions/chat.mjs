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

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured in Netlify." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const message = body?.message?.trim();

    if (!message) {
      return Response.json(
        { error: "Please provide a news claim." },
        { status: 400 }
      );
    }

    const prompt = `
You are a fake-news verification assistant.

Analyze this news claim:

"${message}"

Give your answer in this format:

VERDICT: LIKELY TRUE / LIKELY FALSE / MISLEADING / UNVERIFIABLE
CONFIDENCE: LOW / MEDIUM / HIGH

WHY:
Give a short, clear explanation.

IMPORTANT:
Do not invent sources or facts.
If you cannot reliably verify something, say UNVERIFIABLE.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error:
            data?.error?.message ||
            "Gemini API request failed."
        },
        { status: response.status }
      );
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    if (!reply) {
      return Response.json(
        { error: "Gemini returned no answer." },
        { status: 502 }
      );
    }

    return Response.json({ reply });

  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Could not connect to Gemini." },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/chat"
};
