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
        '사주와 서양 점성술/혈액형 분석은 참고적 관점으로 균형 있게 제시하세요. ' +
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
        `출력 형식(마크다운, 한국어):\n` +
        `1) 종합운 요약 (불릿 4~6개)\n` +
        `2) 전통 명리학 사주 분석\n` +
        `- 사주팔자(四柱八字) 원국 분석: 년주/월주/일주/시주 각각의 천간·지지 해석\n` +
        `- 오행(五行) 균형 분석: 목/화/토/금/수 강약과 균형 상태\n` +
        `- 용신(用神) 및 기신(忌神) 도출: 필요한 오행 vs 피해야 할 오행\n` +
        `- 일간(日干) 중심 성격 분석: 신강/신약에 따른 성격과 기질\n` +
        `- 십신(十神) 분석: 비겁/식상/재성/관성/인성 분포와 삶의 패턴\n` +
        `- 대운(大運) 흐름: 현재 대운과 앞으로 10년 대운 방향\n` +
        `3) 서양 점성술 태양별자리 분석 (생년월일 기준으로 태양별자리 계산)\n` +
        `- 태양별자리(Sun Sign) 기본 성격과 특징\n` +
        `- 사주 일간 성격과 별자리 성격의 공통점\n` +
        `- 사주와 별자리 해석의 차이점 및 보완 관계\n` +
        `- 2026년 해당 별자리 운세 흐름과 사주 운세의 교차 분석\n` +
        `4) 혈액형 성격 분석 통합\n` +
        `- 혈액형별 성격 특징 (A/B/O/AB형 각각의 특성)\n` +
        `- 사주 성격과 혈액형 성격의 시너지 포인트\n` +
        `- 혈액형을 감안했을 때 추가로 얻는 인사이트\n` +
        `- 혈액형 관점에서의 2026년 대인관계 및 의사결정 스타일 조언\n` +
        `5) 2026년 운세 종합: 일운/재물운/관운/관계운 (사주+별자리 교차 관점 반영)\n` +
        `6) 2026년 월별 운세: 1월~12월 (각 월 1~2개 불릿)\n` +
        `7) 실천 팁 5개`,
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
