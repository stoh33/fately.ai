type PagesContext<Env> = {
  request: Request
  env: Env
}

type PagesFunction<Env = Record<string, unknown>> = (
  context: PagesContext<Env>,
) => Response | Promise<Response>

type Lang = 'ko' | 'en'

type SajuPayload = {
  lang?: Lang
  birthYear?: string
  birthMonth?: string
  birthDay?: string
  birthHour?: string
  birthplace?: string
  gender?: string
  bloodType?: string
}

type Env = {
  OPENAI_API_KEY: string
  OPENAI_MODEL?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function makePrompt(payload: Required<SajuPayload>) {
  if (payload.lang === 'en') {
    return `You are a Korean saju (four pillars) consultant. Create an entertainment-only report in clear English.

Input:
- Birth date (solar): ${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}
- Birth hour branch: ${payload.birthHour}
- Birthplace: ${payload.birthplace}
- Gender: ${payload.gender}
- Blood type: ${payload.bloodType}

Output format (Markdown):
1) Overall summary (4-6 bullet points)
2) 2026 outlook by section: Work, Wealth, Career status/authority, Relationships
3) Monthly 2026 outlook (January to December, 1-2 bullets per month)
4) Practical action tips (5 bullet points)

Constraints:
- Keep it concise and practical.
- Do not claim certainty; include uncertainty language.
- Include one short disclaimer: "For entertainment purposes only."`
  }

  return `당신은 한국 전통 명리(사주) 상담가입니다. 오락용 참고 보고서를 한국어로 작성하세요.

입력값:
- 생년월일(양력): ${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}
- 출생 시지: ${payload.birthHour}
- 출생지: ${payload.birthplace}
- 성별: ${payload.gender}
- 혈액형: ${payload.bloodType}

출력 형식(마크다운):
1) 종합운 요약 (불릿 4~6개)
2) 2026년 운세: 일운/재물운/관운/관계운
3) 2026년 월별 운세: 1월~12월 (각 월 1~2개 불릿)
4) 실천 팁 5개

제약:
- 단정 표현을 피하고 가능성 중심으로 작성.
- 과도한 공포/단정 금지.
- 마지막에 짧은 문구 포함: "본 내용은 오락적 참고용입니다."`
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  let body: SajuPayload
  try {
    body = await request.json<SajuPayload>()
  } catch {
    return badRequest('Invalid JSON body.')
  }

  const requiredFields: Array<keyof SajuPayload> = [
    'birthYear',
    'birthMonth',
    'birthDay',
    'birthHour',
    'birthplace',
    'gender',
    'bloodType',
  ]

  for (const field of requiredFields) {
    if (!body[field] || String(body[field]).trim() === '') {
      return badRequest(`Missing field: ${field}`)
    }
  }

  const lang: Lang = body.lang === 'en' ? 'en' : 'ko'
  const payload: Required<SajuPayload> = {
    lang,
    birthYear: String(body.birthYear).trim(),
    birthMonth: String(body.birthMonth).trim(),
    birthDay: String(body.birthDay).trim(),
    birthHour: String(body.birthHour).trim(),
    birthplace: String(body.birthplace).trim(),
    gender: String(body.gender).trim(),
    bloodType: String(body.bloodType).trim(),
  }

  const model = env.OPENAI_MODEL || 'gpt-4.1-mini'
  const prompt = makePrompt(payload)

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: lang === 'en' ? 'Be clear, practical, and grounded.' : '명확하고 실용적으로 답하세요.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      max_output_tokens: 1200,
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text()
    return new Response(JSON.stringify({ error: 'OpenAI request failed.', detail }), {
      status: 502,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  const data = (await upstream.json()) as { output_text?: string }
  const report = data.output_text?.trim()

  if (!report) {
    return new Response(JSON.stringify({ error: 'No report generated.' }), {
      status: 502,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  return new Response(JSON.stringify({ report, model }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  })
}
