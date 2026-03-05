import { computeSaju } from '../lib/saju-calculator'

type PagesContext<Env> = {
  request: Request
  env: Env
}

type PagesFunction<Env = Record<string, unknown>> = (
  context: PagesContext<Env>,
) => Response | Promise<Response>

type AiProvider = 'openai' | 'gemini'

type Env = {
  GEMINI_API_KEY: string
  OPENAI_API_KEY?: string
  GEMINI_MODEL?: string
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

async function callOpenAI(apiKey: string, model: string, systemInstruction: string, userPrompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userPrompt }],
      temperature: 0.7,
    }),
  })
  if (!response.ok) {
    const error = await response.json() as any
    throw new Error(error.error?.message || 'OpenAI API request failed')
  }
  const data = await response.json() as any
  return data.choices[0].message.content.trim()
}

function normalizeGeminiModelPath(model: string) {
  return model.startsWith('models/') ? model : `models/${model}`
}

async function listGeminiModels(apiKey: string) {
  const versions = ['v1', 'v1beta']
  for (const version of versions) {
    const res = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`)
    if (!res.ok) continue
    const data = await res.json() as any
    const models = (data?.models || []) as any[]
    const available = models
      .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m?.name || '').replace(/^models\//, ''))
      .filter(Boolean)
    if (available.length > 0) return available
  }
  return []
}

async function callGemini(apiKey: string, modelName: string, systemInstruction: string, userPrompt: string) {
  const preferredModel = (modelName || '').trim()
  const hardcodedFallbacks = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
  ]
  const discoveredModels = await listGeminiModels(apiKey)
  const preferredDiscovered = discoveredModels.filter((name) => /flash|pro/i.test(name))
  const modelCandidates = [...new Set([preferredModel, ...hardcodedFallbacks, ...preferredDiscovered])]
    .filter(Boolean)

  let lastError = 'Gemini API request failed'
  const versions = ['v1', 'v1beta']

  for (const model of modelCandidates) {
    for (const version of versions) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${version}/${normalizeGeminiModelPath(model)}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [
              { role: 'user', parts: [{ text: userPrompt }] }
            ],
            generationConfig: {
              maxOutputTokens: 4000,
              temperature: 0.7,
            }
          })
        }
      )

      const rawBody = await res.text()
      let data: any = null
      try { data = rawBody ? JSON.parse(rawBody) : null } catch {}

      if (!res.ok) {
        const message = data?.error?.message || rawBody || 'Gemini API request failed'
        const statusCode = data?.error?.code ?? res.status
        const statusText = data?.error?.status || ''
        const detail = `[${statusCode}${statusText ? ` ${statusText}` : ''}] ${message}`
        const isModelNotFound =
          Number(statusCode) === 404 ||
          statusText === 'NOT_FOUND' ||
          /model.*not found|not found.*model/i.test(message)

        if (isModelNotFound) {
          lastError = `Gemini 모델(${model})을 찾을 수 없습니다. ${detail}`
          continue
        }
        throw new Error(detail)
      }

      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim()
      if (text) return text

      const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason
      if (blockReason) {
        throw new Error(`Gemini 응답이 차단되었습니다. (${blockReason})`)
      }

      lastError = `Gemini 응답 본문이 비어 있습니다. (model: ${model}, version: ${version})`
    }
  }

  throw new Error(lastError)
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  return new Response(null, { status: 204, headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS) } })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  let body: any
  try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const aiProvider = (body.aiProvider || 'gemini') as AiProvider
  
  const getEnvValue = (obj: any, target: string) => {
    if (!obj) return null;
    if (obj[target]) return obj[target];
    const foundKey = Object.keys(obj).find(k => k.trim().toUpperCase() === target.toUpperCase());
    return foundKey ? obj[foundKey] : null;
  };

  const targetKeyName = aiProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = getEnvValue(env, targetKeyName);

  if (!apiKey) {
    return new Response(JSON.stringify({ error: `${aiProvider.toUpperCase()} API 키가 설정되지 않았습니다.` }), { 
      status: 500,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' }
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
  } catch (err) { return new Response('Saju computation failed', { status: 400 }) }

  const systemInstruction = '당신은 전문 역술가입니다. 사주를 분석하여 상세 리포트를 작성하세요.'
  const userPrompt = `사주원국: ${JSON.stringify(computed)}. 분석해줘.`

  try {
    let report = ''
    if (aiProvider === 'openai') {
      report = await callOpenAI(apiKey, env.OPENAI_MODEL || 'gpt-4o-mini', systemInstruction, userPrompt)
    } else {
      report = await callGemini(apiKey, env.GEMINI_MODEL || 'gemini-2.5-flash', systemInstruction, userPrompt)
    }
    return new Response(JSON.stringify({ report }), {
      status: 200,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  } catch (err: any) {
    const detail = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: detail }), { 
      status: 502,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' }
    })
  }
}
