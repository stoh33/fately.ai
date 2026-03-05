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

const allowedHours = new Set(['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'])
const allowedGenders = new Set(['female', 'male', 'other'])
const allowedBloodTypes = new Set(['A', 'B', 'O', 'AB'])
const allowedBirthCalendars = new Set(['solar', 'lunar'])

function buildCorsHeaders(origin: string | null, allowedOrigins?: string) {
  if (!allowedOrigins) return { 'Access-Control-Allow-Origin': '*' }
  const allowlist = new Set(allowedOrigins.split(',').map((item) => item.trim()).filter(Boolean))
  if (origin && allowlist.has(origin)) return { 'Access-Control-Allow-Origin': origin }
  return { 'Access-Control-Allow-Origin': 'null' }
}

function badRequest(message: string, origin: string | null, allowedOrigins?: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, ...buildCorsHeaders(origin, allowedOrigins), 'content-type': 'application/json; charset=utf-8' },
  })
}

function isValidDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function buildPrompt(payload: Required<SajuPayload>, computed: ReturnType<typeof computeSaju>) {
  const sajuContextKo = `
사주 계산 결과:
- 년주: ${computed.year.stem}${computed.year.branch} (${computed.year.stemHanja}${computed.year.branchHanja}) / ${computed.year.element}
- 월주: ${computed.month.stem}${computed.month.branch} (${computed.month.stemHanja}${computed.month.branchHanja}) / ${computed.month.element}
- 일주: ${computed.day.stem}${computed.day.branch} (${computed.day.stemHanja}${computed.day.branchHanja}) / ${computed.day.element}
- 시주: ${'unknown' in computed.hour ? '미상' : `${computed.hour.stem}${computed.hour.branch} (${computed.hour.stemHanja}${computed.hour.branchHanja}) / ${computed.hour.element}`}
- 오행 분포: 목 ${computed.fiveElements.목.count}, 화 ${computed.fiveElements.화.count}, 토 ${computed.fiveElements.토.count}, 금 ${computed.fiveElements.금.count}, 수 ${computed.fiveElements.수.count}
- 용신: ${computed.yongsinSuggestion}
- 기신: ${computed.gisinSuggestion}
`.trim()

  if (payload.lang === 'en') {
    const systemInstruction = 'You are a professional Korean Saju consultant. Write a detailed report in Markdown.'
    const userPrompt = `Input: ${JSON.stringify(payload)}\nSaju Data: ${sajuContextKo}\nWrite a 10-section analysis report.`
    return { systemInstruction, userPrompt }
  }

  const systemInstruction = '당신은 한국 전통 명리학 전문 상담가입니다. 입력된 데이터를 바탕으로 상세한 분석 보고서를 마크다운으로 작성하세요.'
  const userPrompt = `입력값: ${JSON.stringify(payload)}\n사주 데이터: ${sajuContextKo}\n다음 10개 섹션을 마크다운으로 작성해줘: 1. 사주원국 분석, 2. 십신 및 성격, 3. 대운 흐름, 4. 별자리 교차 분석, 5. 혈액형 인사이트, 6. 종합운 요약, 7. 2026년 운세 상세, 8. 월별 운세, 9. 실천 팁, 10. 사주 맞춤 골프 스타일.`
  
  return { systemInstruction, userPrompt }
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  return new Response(null, { status: 204, headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS) } })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  
  // 1. 환경 변수 확인 (유연한 검색)
  const findEnvKey = (envObj: any, target: string) => {
    if (!envObj) return null;
    if (envObj[target]) return envObj[target];
    const keys = Object.keys(envObj);
    const found = keys.find(k => k.trim().toUpperCase() === target.toUpperCase());
    return found ? envObj[found] : null;
  };

  const apiKey = findEnvKey(env, 'GEMINI_API_KEY');
  if (!apiKey) {
    const availableKeys = Object.keys(env || {}).join(', ');
    return new Response(JSON.stringify({ error: `API 키 설정이 필요합니다. (Available keys: [${availableKeys || 'NONE'}])` }), {
      status: 500,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  }

  // 2. 바디 파싱 및 검증
  let body: SajuPayload
  try { body = await request.json() } catch { return badRequest('Invalid JSON body.', origin, env.ALLOWED_ORIGINS) }

  const lang: Lang = body.lang === 'en' ? 'en' : 'ko'
  const payload: Required<SajuPayload> = {
    lang,
    birthCalendar: body.birthCalendar === 'lunar' ? 'lunar' : 'solar',
    birthYear: String(body.birthYear || '').trim(),
    birthMonth: String(body.birthMonth || '').trim(),
    birthDay: String(body.birthDay || '').trim(),
    birthHour: String(body.birthHour || '').trim(),
    birthplace: String(body.birthplace || '').trim(),
    gender: String(body.gender || 'other').trim(),
    bloodType: String(body.bloodType || 'A').trim(),
  }

  const year = Number(payload.birthYear), month = Number(payload.birthMonth), day = Number(payload.birthDay)
  if (!isValidDate(year, month, day)) return badRequest('Invalid birth date.', origin, env.ALLOWED_ORIGINS)

  // 3. 사주 계산
  let computed: ReturnType<typeof computeSaju>
  try {
    computed = computeSaju({
      birthDate: `${payload.birthYear}-${payload.birthMonth.padStart(2, '0')}-${payload.birthDay.padStart(2, '0')}`,
      birthHourBranch: payload.birthHour,
      timeUnknown: false,
      calendarType: payload.birthCalendar,
      timezone: 'Asia/Seoul',
    })
  } catch (err) { return badRequest('Saju computation failed.', origin, env.ALLOWED_ORIGINS) }

  const { systemInstruction, userPrompt } = buildPrompt(payload, computed)

  // 4. API 호출
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = env.GEMINI_MODEL || 'gemini-2.0-flash'
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction })
    
    const result = await model.generateContent(userPrompt)
    const response = await result.response
    const report = response.text().trim()

    if (!report) throw new Error('Empty response from Gemini')

    return new Response(JSON.stringify({ report, model: modelName }), {
      status: 200,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  } catch (err: any) {
    let msg = String(err);
    if (msg.includes('429')) msg = 'Google API 사용량이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
    if (msg.includes('403')) msg = 'API 키 권한 오류 혹은 지역 제한입니다.';
    return new Response(JSON.stringify({ error: `Gemini API 호출 실패: ${msg}`, detail: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS), 'content-type': 'application/json' },
    })
  }
}
