import { GoogleGenerativeAI } from '@google/generative-ai'
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

// OpenAI API 호출 함수 (fetch 사용)
async function callOpenAI(apiKey: string, model: string, systemInstruction: string, userPrompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
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

// Gemini API 호출 함수
async function callGemini(apiKey: string, modelName: string, systemInstruction: string, userPrompt: string) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: modelName || 'gemini-2.0-flash', systemInstruction })
  const result = await model.generateContent(userPrompt)
  const response = await result.response
  return response.text().trim()
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
  
  // 1. API 키 확인
  let apiKey = ''
  if (aiProvider === 'gemini') {
    apiKey = env.GEMINI_API_KEY || (Object.entries(env).find(([k]) => k.toUpperCase() === 'GEMINI_API_KEY')?.[1] as string)
  } else {
    apiKey = env.OPENAI_API_KEY || (Object.entries(env).find(([k]) => k.toUpperCase() === 'OPENAI_API_KEY')?.[1] as string)
  }

  if (!apiKey) {
    return jsonResponse(500, { error: `${aiProvider.toUpperCase()} API 키가 설정되지 않았습니다.` }, origin, env.ALLOWED_ORIGINS)
  }

  // 2. 사주 계산
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

  // 3. 프롬프트 생성
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

  // 4. 선택된 엔진 호출
  try {
    let reportMarkdown = ''
    if (aiProvider === 'openai') {
      reportMarkdown = await callOpenAI(apiKey, env.OPENAI_MODEL || 'gpt-4o-mini', systemInstruction, userPrompt)
    } else {
      reportMarkdown = await callGemini(apiKey, env.GEMINI_MODEL || 'gemini-2.0-flash', systemInstruction, userPrompt)
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
    let msg = `${aiProvider.toUpperCase()} API 호출 중 오류가 발생했습니다.`;
    if (String(err).includes('429')) msg = 'API 할당량 초과되었습니다. 잠시 후 다시 시도하세요.';
    return jsonResponse(502, { error: msg, detail: String(err) }, origin, env.ALLOWED_ORIGINS)
  }
}
