import { GoogleGenerativeAI } from '@google/generative-ai'
import { computeSaju } from '../lib/saju-calculator'

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
  birthCalendar?: 'solar' | 'lunar'
  birthYear?: string
  birthMonth?: string
  birthDay?: string
  birthHour?: string
  birthplace?: string
  gender?: string
  bloodType?: string
}

type Env = {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
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
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function buildPrompt(payload: Required<SajuPayload>, computed: any) {
  const sajuContextKo = `년주: ${computed.year.stem}${computed.year.branch}, 월주: ${computed.month.stem}${computed.month.branch}, 일주: ${computed.day.stem}${computed.day.branch}, 시주: ${computed.hour.stem || '미상'}${computed.hour.branch || ''}`
  
  const systemInstruction = '당신은 한국 전통 명리학 전문 상담가입니다. 친절하고 상세하게 사주 리포트를 작성하세요.'
  const userPrompt = `입력 데이터: ${JSON.stringify(payload)}\n사주 원국: ${sajuContextKo}\n위 데이터를 바탕으로 상세 분석 리포트를 작성해줘.`
  
  return { systemInstruction, userPrompt }
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
  
  // 1. 키 찾기 (유연하게)
  const apiKey = env.GEMINI_API_KEY || (Object.entries(env).find(([k]) => k.toUpperCase() === 'GEMINI_API_KEY')?.[1] as string);

  if (!apiKey) {
    const keys = Object.keys(env || {}).join(', ');
    return new Response(JSON.stringify({ error: `API 키 설정이 필요합니다. (인식된 키: [${keys || '없음'}])` }), {
      status: 500,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  }

  // 2. 바디 파싱 및 검증
  let body: any
  try { body = await request.json() } catch { return badRequest('Invalid JSON body.', origin, env.ALLOWED_ORIGINS) }

  // 3. 사주 계산
  let computed: any
  try {
    computed = computeSaju({
      birthDate: `${body.birthYear}-${String(body.birthMonth).padStart(2, '0')}-${String(body.birthDay).padStart(2, '0')}`,
      birthHourBranch: body.birthHour,
      timeUnknown: !body.birthHour,
      calendarType: body.birthCalendar || 'solar',
      timezone: 'Asia/Seoul',
    })
  } catch (err) {
    return badRequest('사주 계산 중 오류가 발생했습니다.', origin, env.ALLOWED_ORIGINS)
  }

  const { systemInstruction, userPrompt } = buildPrompt(body, computed)

  // 4. Gemini API 호출
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL || 'gemini-2.0-flash', systemInstruction })
    
    const result = await model.generateContent(userPrompt)
    const response = await result.response
    const report = response.text().trim()

    return new Response(JSON.stringify({ report }), {
      status: 200,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  } catch (err: any) {
    // 상세한 에러 메시지 구성
    let detail = String(err);
    if (detail.includes('429')) detail = 'Google API 사용량이 초과되었거나 제한되었습니다 (429 Quota Exceeded).';
    if (detail.includes('403')) detail = 'API 키 권한이 없거나 지역 제한이 있습니다 (403 Forbidden).';
    if (detail.includes('400')) detail = '잘못된 요청입니다. 프롬프트나 설정을 확인하세요 (400 Bad Request).';

    return new Response(JSON.stringify({ 
      error: `Gemini API 호출 실패: ${detail}`,
      raw_error: String(err)
    }), {
      status: 502,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  }
}
