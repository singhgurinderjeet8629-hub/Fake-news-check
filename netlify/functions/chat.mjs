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

    const mode = String(body?.mode || "claim").trim();
    const text = String(body?.text || body?.message || "").trim();
    const url = String(body?.url || "").trim();

    if (!text) {
      return Response.json(
        { error: "Please provide a news claim." },
        { status: 400 }
      );
    }

    let task = "";

    if (mode === "article") {
      task = `
Analyze the supplied article text.

Identify the main factual claims and assess them.

Give one overall verdict:
LIKELY TRUE / LIKELY FALSE / MISLEADING / UNVERIFIABLE.

Give CONFIDENCE:
LOW / MEDIUM / HIGH.

Explain which claims are supported, unsupported, misleading,
or impossible to verify from the available information.

Do not treat writing quality, popularity, or website appearance
as evidence of truth.
`;
    }

    else if (mode === "url") {
      task = `
A user supplied a news URL.

Assess what can actually be established from the URL and any
article information available to this backend.

IMPORTANT:
If the backend has not retrieved the article contents, do NOT
pretend that you read the article.

If the article cannot actually be retrieved, use UNVERIFIABLE
when appropriate.

Give one overall verdict:
LIKELY TRUE / LIKELY FALSE / MISLEADING / UNVERIFIABLE.

Give CONFIDENCE:
LOW / MEDIUM / HIGH.
`;
    }

    else if (mode === "source") {
      task = `
Assess the named news source or outlet as a source.

Do not claim that every article from the source is true or false.

Discuss only information that can reasonably be established.

Do not invent ownership details, scandals, ratings, citations,
or other facts.
`;
    }

    else if (mode === "otto") {
      task = `
Answer the user's question helpfully about fake-news checking,
claims, sources, or using this website.

Do not fabricate evidence.

If the user asks you to verify a specific claim, give a cautious
assessment and explain what evidence would be needed.
`;
    }

    else {
      task = `
Analyze the supplied news claim.

Give one overall verdict:
LIKELY TRUE / LIKELY FALSE / MISLEADING / UNVERIFIABLE.

Give CONFIDENCE:
LOW / MEDIUM / HIGH.

Explain your reasoning clearly and briefly.
`;
    }

    const prompt = `
You are a careful fake-news verification assistant.

${task}

IMPORTANT:
- Do not invent sources.
- Do not invent URLs.
- Do not invent quotes.
- Do not invent statistics.
- Do not invent dates.
- Do not claim that you browsed a webpage unless the backend
  actually retrieved its contents.
- Distinguish evidence from inference.
- If reliable evidence is insufficient, use UNVERIFIABLE.
- AI verification is not guaranteed to be correct.

${mode === "url" && url ? `URL SUPPLIED: ${url}` : ""}

USER INPUT:
"${text}"

Return your answer in this format:

VERDICT: LIKELY TRUE / LIKELY FALSE / MISLEADING / UNVERIFIABLE

CONFIDENCE: LOW / MEDIUM / HIGH

WHY:
Short, clear explanation.

EVIDENCE:
List only evidence that you can actually support.

If reliable evidence is unavailable, say:
No reliable evidence was available to establish this claim.
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
        {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    if (!reply) {
      return Response.json(
        {
          error: "Gemini returned no answer."
        },
        {
          status: 502,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    return Response.json(
      {
        answer: reply,
        reply: reply
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (error) {

    console.error(error);

    return Response.json(
      {
        error: "Could not connect to Gemini."
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
};

export const config = {
  path: "/api/chat"
};
