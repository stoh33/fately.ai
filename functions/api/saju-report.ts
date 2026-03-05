import { GoogleGenerativeAI } from '@google/generative-ai'
import { computeSaju, getSexagenaryYear } from '../lib/saju-calculator'

type PagesContext<Env> = {
  request: Request
  env: Env
}

type PagesFunction<Env = Record<string, unknown>> = (
  context: PagesContext<Env>,
) => Response | Promise<Response>

type FocusType = 'career' | 'wealth' | 'relationship' | 'health' | 'general'
type BloodType = 'A' | 'B' | 'O' | 'AB' | 'unknown'
type ZodiacSign = 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo' | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces'
type ZodiacSignInput = ZodiacSign | 'auto'
type GolfExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'unknown'
type GolfGoal = 'distance' | 'accuracy' | 'consistency' | 'mental' | 'score' | 'unknown'

type SajuReportPayload = {
  clientName?: string
  birthDate?: string
  birthTime?: string | null
  timeUnknown?: boolean
  calendarType?: 'solar' | 'lunar'
  gender?: 'male' | 'female' | 'other'
  timezone?: string
  focus?: FocusType
  notes?: string
  bloodType?: BloodType
  zodiacSign?: ZodiacSignInput
  golfExperienceLevel?: GolfExperienceLevel
  golfGoal?: GolfGoal
  golfPainOrLimits?: string
  golfNotes?: string
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

const requestsByIp = new Map<string, { count: number; resetAt: number }>()

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

function sanitizeText(value: string, maxLen: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen)
}

function inferIp(request: Request) {
  const cfIp = request.headers.get('CF-Connecting-IP')
  const forwarded = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
  return cfIp || forwarded || 'unknown'
}

function enforceRateLimit(ip: string) {
  const now = Date.now()
  const bucket = requestsByIp.get(ip)
  if (!bucket || bucket.resetAt < now) {
    requestsByIp.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (bucket.count >= 15) return false
  bucket.count += 1
  requestsByIp.set(ip, bucket)
  return true
}

function computeWesternZodiac(birthDate: string): ZodiacSign {
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return 'Aries'
  const month = Number(match[2]), day = Number(match[3])
  const mmdd = month * 100 + day
  if (mmdd >= 321 && mmdd <= 419) return 'Aries'
  if (mmdd >= 420 && mmdd <= 520) return 'Taurus'
  if (mmdd >= 521 && mmdd <= 620) return 'Gemini'
  if (mmdd >= 621 && mmdd <= 722) return 'Cancer'
  if (mmdd >= 723 && mmdd <= 822) return 'Leo'
  if (mmdd >= 823 && mmdd <= 922) return 'Virgo'
  if (mmdd >= 923 && mmdd <= 1022) return 'Libra'
  if (mmdd >= 1023 && mmdd <= 1121) return 'Scorpio'
  if (mmdd >= 1122 && mmdd <= 1221) return 'Sagittarius'
  if (mmdd >= 1222 || mmdd <= 119) return 'Capricorn'
  if (mmdd >= 120 && mmdd <= 218) return 'Aquarius'
  return 'Pisces'
}

function hasRequiredCoreHeaders(reportMarkdown: string) {
  return reportMarkdown.includes('부록 1') && reportMarkdown.includes('부록 2') && reportMarkdown.includes('부록 3')
}

function buildPrompt(params: any) {
  const { payload, computed, zodiacResolved, generatedAtIso, currentYear, currentYearGanji } = params
  const systemInstruction = 'You are a professional Korean Saju analyst. Output language: Korean. format: Markdown. ' +
    'Strictly mirror the required chapter titles and advisory style. Use mixed Korean + Hanja for key terms.'

  const userPrompt = `
사주팔자 종합 분석 보고서를 작성해줘.
의뢰인: ${payload.clientName}, 생년월일: ${payload.birthDate}, 성별: ${payload.gender}, 혈액형: ${payload.bloodType}, 별자리: ${zodiacResolved}
사주 계산 결과: 년(${computed.year.stem}${computed.year.branch}), 월(${computed.month.stem}${computed.month.branch}), 일(${computed.day.stem}${computed.day.branch})
오행 분포: 목(${computed.fiveElements.목.count}), 화(${computed.fiveElements.화.count}), 토(${computed.fiveElements.토.count}), 금(${computed.fiveElements.금.count}), 수(${computed.fiveElements.수.count})

다음 10개 섹션을 포함해줘:
1. 사주원국 분석 (표 포함)
2. 성격/기질 (5-7줄)
3. 대운 흐름 (표 포함)
4. 별자리 교차 해석
5. 혈액형 인사이트
6. 종합운 요약
7. 2026년 운세 (재물, 건강, 관계 등)
8. 2026년 월별 운세
9. 개운법 (색상, 활동 등)
10. 사주 기반 골프 스타일 및 2주 훈련 플랜

마지막에 "사주는 참고용이며 최종 실천은 본인의 몫입니다"라는 문구를 넣어줘.
`
  return { systemInstruction, userPrompt }
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  return new Response(null, { status: 204, headers: { ...corsHeaders, ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS) } })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  
  // 1. 환경 변수 확인
  const findEnvKey = (envObj: any, target: string) => {
    if (!envObj) return null;
    if (envObj[target]) return envObj[target];
    const keys = Object.keys(envObj);
    const found = keys.find(k => k.trim().toUpperCase() === target.toUpperCase());
    return found ? envObj[found] : null;
  };

  const apiKey = findEnvKey(env, 'GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse(500, { error: 'Gemini API 키가 설정되지 않았습니다.' }, origin, env.ALLOWED_ORIGINS)
  }

  // 2. Rate Limit
  const ip = inferIp(request)
  if (!enforceRateLimit(ip)) return jsonResponse(429, { error: 'Too many requests.' }, origin, env.ALLOWED_ORIGINS)

  // 3. 데이터 파싱 및 검증
  let body: SajuReportPayload
  try { body = await request.json() } catch { return jsonResponse(400, { error: 'Invalid body' }, origin, env.ALLOWED_ORIGINS) }

  const clientName = sanitizeText(body.clientName || '의뢰인', 40)
  const birthDate = body.birthDate || '1990-01-01'

  // 4. 사주 계산
  const zodiacResolved = computeWesternZodiac(birthDate)
  let computed: any
  try {
    computed = computeSaju({
      birthDate,
      birthTime: body.timeUnknown ? null : body.birthTime,
      timeUnknown: !!body.timeUnknown,
      calendarType: body.calendarType || 'solar',
      timezone: body.timezone || 'Asia/Seoul',
    })
  } catch (err) { return jsonResponse(400, { error: 'Saju computation failed.' }, origin, env.ALLOWED_ORIGINS) }

  const generatedAtIso = new Date().toISOString()
  const currentYear = new Date().getFullYear()
  const currentYearGanji = getSexagenaryYear(currentYear)

  const { systemInstruction, userPrompt } = buildPrompt({
    payload: { ...body, clientName, birthDate },
    computed, zodiacResolved, generatedAtIso, currentYear, currentYearGanji
  })

  // 5. API 호출
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = env.GEMINI_MODEL || 'gemini-2.0-flash'
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction })
    
    const result = await model.generateContent(userPrompt)
    const response = await result.response
    let reportMarkdown = response.text().trim()

    if (!reportMarkdown) throw new Error('Empty report')

    return jsonResponse(200, {
      reportMarkdown,
      meta: {
        fourPillars: { year: computed.year, month: computed.month, day: computed.day, hour: computed.hour },
        fiveElements: computed.fiveElements,
        bloodType: body.bloodType || 'unknown',
        zodiacSign: zodiacResolved,
        generatedAt: generatedAtIso
      }
    }, origin, env.ALLOWED_ORIGINS)

  } catch (err: any) {
    let msg = 'Gemini API 호출 중 오류가 발생했습니다.';
    if (String(err).includes('429')) msg = 'Google API 할당량 초과되었습니다.';
    return jsonResponse(502, { error: msg, detail: String(err) }, origin, env.ALLOWED_ORIGINS)
  }
}
