import { computeSaju } from '../lib/saju-calculator'

type PagesContext<Env> = {
  request: Request
  env: Env
}

type PagesFunction<Env = Record<string, unknown>> = (
  context: PagesContext<Env>,
) => Response | Promise<Response>

type Env = {
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
  ALLOWED_ORIGINS?: string
}

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function buildCorsHeaders(origin: string | null, allowedOrigins?: string) {
  if (!allowedOrigins) return { 'Access-Control-Allow-Origin': '*' }
  const allowlist = new Set(allowedOrigins.split(',').map((item) => item.trim()).filter(Boolean))
  if (origin && allowlist.has(origin)) return { 'Access-Control-Allow-Origin': origin }
  return { 'Access-Control-Allow-Origin': 'null' }
}

function getEnvValue(obj: unknown, target: string) {
  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, string | undefined>
  if (record[target]) return record[target] as string
  const foundKey = Object.keys(record).find((k) => k.trim().toUpperCase() === target.toUpperCase())
  return foundKey ? (record[foundKey] as string) : null
}

async function callOpenAI(apiKey: string, model: string, systemInstruction: string, userPrompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  })
  if (!response.ok) {
    const error = (await response.json()) as any
    throw new Error(error?.error?.message || 'OpenAI API request failed')
  }
  const data = (await response.json()) as any
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS) },
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const apiKey = getEnvValue(env, 'OPENAI_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI API 키가 설정되지 않았습니다.' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json',
      },
    })
  }

  let computed: any
  try {
    computed = computeSaju({
      birthDate: `${body.birthYear}-${String(body.birthMonth).padStart(2, '0')}-${String(body.birthDay).padStart(2, '0')}`,
      birthHourBranch: body.birthHour,
      timeUnknown: !body.birthHour,
      calendarType: body.birthCalendar || 'solar',
      timezone: 'Asia/Seoul',
    })
  } catch {
    return new Response('Saju computation failed', { status: 400 })
  }

  const systemInstruction = '당신은 전문 역술가입니다. 사주를 분석하여 상세 리포트를 작성하세요.'
  const userPrompt = `사주원국: ${JSON.stringify(computed)}. 분석해줘.`

  try {
    const report = await callOpenAI(apiKey, env.OPENAI_MODEL || 'gpt-4o-mini', systemInstruction, userPrompt)
    return new Response(JSON.stringify({ report }), {
      status: 200,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json',
      },
    })
  } catch (err: any) {
    const detail = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: detail }), {
      status: 502,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json',
      },
    })
  }
}
