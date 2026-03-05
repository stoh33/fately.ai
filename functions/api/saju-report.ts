import { computeSaju, getSexagenaryYear } from '../lib/saju-calculator'

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

function jsonResponse(status: number, body: Record<string, unknown>, origin: string | null, allowedOrigins?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...buildCorsHeaders(origin, allowedOrigins), 'content-type': 'application/json; charset=utf-8' },
  })
}

// OpenAI API 호출 함수
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

// Gemini API 호출 함수 (Edge Runtime 호환 fetch 방식)
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
            contents: [
              {
                role: 'user',
                parts: [{ text: `# 시스템 지시\n${systemInstruction}\n\n# 사용자 요청\n${userPrompt}` }]
              }
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
  try { body = await request.json() } catch { return jsonResponse(400, { error: 'Invalid body' }, origin, env.ALLOWED_ORIGINS) }

  const aiProvider = (body.aiProvider || 'gemini') as AiProvider
  
  const getEnvValue = (obj: any, target: string) => {
    if (!obj) return null;
    if (obj[target]) return obj[target];
    const foundKey = Object.keys(obj).find(k => k.trim().toUpperCase() === target.toUpperCase());
    return foundKey ? obj[foundKey] : null;
  };

  const apiKey = aiProvider === 'gemini' 
    ? getEnvValue(env, 'GEMINI_API_KEY') 
    : getEnvValue(env, 'OPENAI_API_KEY');

  if (!apiKey) {
    return jsonResponse(500, { error: `${aiProvider.toUpperCase()} API 키가 설정되지 않았습니다.` }, origin, env.ALLOWED_ORIGINS)
  }

  let computed: any
  try {
    computed = computeSaju({
      birthDate: body.birthDate,
      birthTime: body.timeUnknown ? null : body.birthTime,
      timeUnknown: !!body.timeUnknown,
      calendarType: body.calendarType || 'solar',
      timezone: body.timezone || 'Asia/Seoul',
    })
  } catch (err) { return jsonResponse(400, { error: '사주 계산 실패' }, origin, env.ALLOWED_ORIGINS) }

  const currentYear = new Date().getFullYear()
  const currentYearGanji = getSexagenaryYear(currentYear)
  const systemInstruction = '당신은 전문 역술가입니다. 사주를 분석하여 상세한 보고서를 작성하세요. 결과는 마크다운 형식을 사용하세요.'
  const userPrompt = `
사주 분석 보고서를 작성해줘.
의뢰인: ${body.clientName || '의뢰인'}, 생년월일: ${body.birthDate}, 성별: ${body.gender || '미상'}, 혈액형: ${body.bloodType || '미상'}
사주원국: 년(${computed.year.stem}${computed.year.branch}), 월(${computed.month.stem}${computed.month.branch}), 일(${computed.day.stem}${computed.day.branch}), 시(${computed.hour.stem || '미상'}${computed.hour.branch || ''})
오행 분포: 목(${computed.fiveElements.목.count}), 화(${computed.fiveElements.화.count}), 토(${computed.fiveElements.토.count}), 금(${computed.fiveElements.금.count}), 수(${computed.fiveElements.수.count})

다음 내용을 상세히 포함해줘:
1. 사주원국 분석 및 오행 특징
2. 성격 및 기질 분석
3. 대운 및 2026년(${currentYearGanji}) 운세 상세
4. 건강, 재물, 관계 조언
5. 사주 맞춤 골프 스타일 및 훈련 조언 (2주 플랜 포함)
`

  try {
    let reportMarkdown = ''
    if (aiProvider === 'openai') {
      reportMarkdown = await callOpenAI(apiKey, env.OPENAI_MODEL || 'gpt-4o-mini', systemInstruction, userPrompt)
    } else {
      reportMarkdown = await callGemini(apiKey, env.GEMINI_MODEL || 'gemini-2.5-flash', systemInstruction, userPrompt)
    }

    if (!reportMarkdown) throw new Error('Empty response')

    return jsonResponse(200, {
      reportMarkdown,
      meta: {
        fourPillars: { year: computed.year, month: computed.month, day: computed.day, hour: computed.hour },
        fiveElements: computed.fiveElements,
        generatedAt: new Date().toISOString(),
        provider: aiProvider
      }
    }, origin, env.ALLOWED_ORIGINS)

  } catch (err: any) {
    const detail = err instanceof Error ? err.message : String(err)
    let msg = detail || `${aiProvider.toUpperCase()} API 호출 중 오류가 발생했습니다.`
    if (detail.includes('429')) msg = 'API 할당량 초과되었습니다. 잠시 후 다시 시도하세요.'
    return jsonResponse(502, { error: msg, detail }, origin, env.ALLOWED_ORIGINS)
  }
}
