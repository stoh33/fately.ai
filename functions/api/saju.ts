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
  OPENAI_REASONING_EFFORT?: string
  ALLOWED_ORIGINS?: string
}

type ResponseChoice = {
  message: {
    content: string
  }
}

type ChatCompletionResponse = {
  choices?: ResponseChoice[]
}

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const allowedHours = new Set([
  '자',
  '축',
  '인',
  '묘',
  '진',
  '사',
  '오',
  '미',
  '신',
  '유',
  '술',
  '해',
])
const allowedGenders = new Set(['female', 'male', 'other'])
const allowedBloodTypes = new Set(['A', 'B', 'O', 'AB'])

function buildCorsHeaders(origin: string | null, allowedOrigins?: string) {
  if (!allowedOrigins) {
    return { 'Access-Control-Allow-Origin': '*' }
  }

  const allowlist = new Set(
    allowedOrigins
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )

  if (origin && allowlist.has(origin)) {
    return { 'Access-Control-Allow-Origin': origin }
  }

  return { 'Access-Control-Allow-Origin': 'null' }
}

function badRequest(message: string, origin: string | null, allowedOrigins?: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: {
      ...corsHeaders,
      ...buildCorsHeaders(origin, allowedOrigins),
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function isValidDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function assertMaxLen(value: string, maxLen: number, field: string) {
  if (value.length > maxLen) {
    throw new Error(`Field too long: ${field}`)
  }
}

function buildMessages(payload: Required<SajuPayload>) {
  if (payload.lang === 'en') {
    return [
      {
        role: 'system',
        content:
          'You are a Korean saju (four pillars) consultant. Create an entertainment-only report in clear English. ' +
          'Keep it concise and practical. Do not claim certainty; include uncertainty language. ' +
          'Include one short disclaimer: "For entertainment purposes only."',
      },
      {
        role: 'user',
        content:
          `Input:\n` +
          `- Birth date (solar): ${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}\n` +
          `- Birth hour branch: ${payload.birthHour}\n` +
          `- Birthplace: ${payload.birthplace}\n` +
          `- Gender: ${payload.gender}\n` +
          `- Blood type: ${payload.bloodType}\n\n` +
          `Output format (Markdown):\n` +
          `1) Overall summary (4-6 bullet points)\n` +
          `2) 2026 outlook by section: Work, Wealth, Career status/authority, Relationships\n` +
          `3) Monthly 2026 outlook (January to December, 1-2 bullets per month)\n` +
          `4) Practical action tips (5 bullet points)`,
      },
    ]
  }

  return [
    {
      role: 'system',
      content:
        '당신은 한국 전통 명리(사주) 상담가입니다. 오락용 참고 보고서를 한국어로 작성하세요. ' +
        '단정 표현을 피하고 가능성 중심으로 작성하세요. 과도한 공포/단정 금지. ' +
        '마지막에 짧은 문구 포함: "본 내용은 오락적 참고용입니다."',
    },
    {
      role: 'user',
      content:
        `입력값:\n` +
        `- 생년월일(양력): ${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}\n` +
        `- 출생 시지: ${payload.birthHour}\n` +
        `- 출생지: ${payload.birthplace}\n` +
        `- 성별: ${payload.gender}\n` +
        `- 혈액형: ${payload.bloodType}\n\n` +
        `출력 형식(마크다운):\n` +
        `1) 종합운 요약 (불릿 4~6개)\n` +
        `2) 2026년 운세: 일운/재물운/관운/관계운\n` +
        `3) 2026년 월별 운세: 1월~12월 (각 월 1~2개 불릿)\n` +
        `4) 실천 팁 5개`,
    },
  ]
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
    },
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

  const origin = request.headers.get('Origin')

  let body: SajuPayload
  try {
    body = (await request.json()) as SajuPayload
  } catch {
    return badRequest('Invalid JSON body.', origin, env.ALLOWED_ORIGINS)
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
      return badRequest(`Missing field: ${field}`, origin, env.ALLOWED_ORIGINS)
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

  try {
    assertMaxLen(payload.birthplace, 100, 'birthplace')
    assertMaxLen(payload.gender, 20, 'gender')
    assertMaxLen(payload.bloodType, 4, 'bloodType')
  } catch (err) {
    return badRequest(
      err instanceof Error ? err.message : 'Invalid input.',
      origin,
      env.ALLOWED_ORIGINS,
    )
  }

  const year = Number(payload.birthYear)
  const month = Number(payload.birthMonth)
  const day = Number(payload.birthDay)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return badRequest('Invalid date fields.', origin, env.ALLOWED_ORIGINS)
  }
  if (!isValidDate(year, month, day)) {
    return badRequest('Invalid birth date.', origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedHours.has(payload.birthHour)) {
    return badRequest('Invalid birth hour.', origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedGenders.has(payload.gender)) {
    return badRequest('Invalid gender.', origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedBloodTypes.has(payload.bloodType)) {
    return badRequest('Invalid blood type.', origin, env.ALLOWED_ORIGINS)
  }

  const model = env.OPENAI_MODEL || 'gpt-4o'
  const effort = (env.OPENAI_REASONING_EFFORT || 'medium').toLowerCase()
  const reasoningEffort =
    effort === 'low' || effort === 'medium' || effort === 'high'
      ? effort
      : 'medium'
  const messages = buildMessages(payload)

  const apiBody: any = {
    model,
    messages,
  }

  if (model.startsWith('o1') || model.startsWith('o3')) {
    apiBody.max_completion_tokens = 2000
    apiBody.reasoning_effort = reasoningEffort
  } else {
    apiBody.max_tokens = 2000
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiBody),
  })

  if (!upstream.ok) {
    const detail = await upstream.text()
    return new Response(JSON.stringify({ error: 'OpenAI request failed.', detail }), {
      status: 502,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  const data = (await upstream.json()) as ChatCompletionResponse
  const report = data.choices?.[0]?.message?.content?.trim() || null

  if (!report) {
    return new Response(JSON.stringify({ error: 'No report generated.' }), {
      status: 502,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  return new Response(JSON.stringify({ report, model }), {
    status: 200,
    headers: {
      ...corsHeaders,
      ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
      'content-type': 'application/json; charset=utf-8',
    },
  })
}
