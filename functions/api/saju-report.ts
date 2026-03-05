import { GoogleGenerativeAI } from '@google/generative-ai'
import { computeSaju, getSexagenaryYear } from '../lib/saju-calculator'

type PagesContext<Env> = {
  request: Request
  env: Env
}

type PagesFunction<Env = Record<string, unknown>> = (
  context: PagesContext<Env>,
) => Response | Promise<Response>

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
    headers: { ...corsHeaders, ...buildCorsHeaders(origin, allowedOrigins), 'content-type': 'application/json' },
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  
  // 1. 키 찾기
  const apiKey = env.GEMINI_API_KEY || (Object.entries(env).find(([k]) => k.toUpperCase() === 'GEMINI_API_KEY')?.[1] as string);

  if (!apiKey) {
    return jsonResponse(500, { error: 'Gemini API 키가 설정되지 않았습니다.' }, origin, env.ALLOWED_ORIGINS)
  }

  // 2. 바디 파싱
  let body: any
  try { body = await request.json() } catch { return jsonResponse(400, { error: 'Invalid JSON' }, origin, env.ALLOWED_ORIGINS) }

  // 3. 사주 계산
  let computed: any
  try {
    computed = computeSaju({
      birthDate: body.birthDate,
      birthTime: body.timeUnknown ? null : body.birthTime,
      timeUnknown: !!body.timeUnknown,
      calendarType: body.calendarType || 'solar',
      timezone: body.timezone || 'Asia/Seoul',
    })
  } catch (err) {
    return jsonResponse(400, { error: '사주 계산 실패' }, origin, env.ALLOWED_ORIGINS)
  }

  // 4. 프롬프트 생성 (간략화된 버전으로 테스트)
  const currentYear = new Date().getFullYear()
  const currentYearGanji = getSexagenaryYear(currentYear)
  const systemInstruction = '당신은 전문 역술가입니다. 사주를 분석하여 상세한 보고서를 작성하세요.'
  const userPrompt = `성함: ${body.clientName}, 사주원국: ${JSON.stringify(computed.year)}, ${JSON.stringify(computed.month)}, ${JSON.stringify(computed.day)}. ${currentYear}년(${currentYearGanji}) 운세를 포함한 상세 리포트를 작성해줘.`

  // 5. API 호출
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL || 'gemini-2.0-flash', systemInstruction })
    
    const result = await model.generateContent(userPrompt)
    const response = await result.response
    const reportMarkdown = response.text().trim()

    return jsonResponse(200, {
      reportMarkdown,
      meta: {
        fourPillars: { year: computed.year, month: computed.month, day: computed.day, hour: computed.hour },
        fiveElements: computed.fiveElements,
        generatedAt: new Date().toISOString()
      }
    }, origin, env.ALLOWED_ORIGINS)

  } catch (err: any) {
    let msg = 'Gemini API 호출 중 오류가 발생했습니다.';
    if (String(err).includes('429')) msg = 'Google API 할당량 초과 (분당 요청 제한). 잠시 후 다시 시도하세요.';
    if (String(err).includes('403')) msg = 'API 키 권한 오류 또는 지역 제한입니다.';
    
    return jsonResponse(502, { error: msg, detail: String(err) }, origin, env.ALLOWED_ORIGINS)
  }
}
