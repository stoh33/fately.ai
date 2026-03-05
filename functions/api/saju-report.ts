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
type ZodiacSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces'
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

const allowedCalendarTypes = new Set(['solar', 'lunar'])
const allowedGender = new Set(['male', 'female', 'other'])
const allowedFocus = new Set(['career', 'wealth', 'relationship', 'health', 'general'])
const allowedBloodType = new Set(['A', 'B', 'O', 'AB', 'unknown'])
const allowedZodiacSignInput = new Set([
  'auto',
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
])
const allowedGolfExperienceLevel = new Set(['beginner', 'intermediate', 'advanced', 'unknown'])
const allowedGolfGoal = new Set([
  'distance',
  'accuracy',
  'consistency',
  'mental',
  'score',
  'unknown',
])
const requestsByIp = new Map<string, { count: number; resetAt: number }>()

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

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  allowedOrigins?: string,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...buildCorsHeaders(origin, allowedOrigins),
      'content-type': 'application/json; charset=utf-8',
    },
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
  if (bucket.count >= 8) {
    return false
  }
  bucket.count += 1
  requestsByIp.set(ip, bucket)
  return true
}

function assertTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('ko-KR', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

function parseBirthDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

function computeWesternZodiac(birthDate: string): ZodiacSign {
  const parsed = parseBirthDate(birthDate)
  if (!parsed) return 'Aries'
  const mmdd = parsed.month * 100 + parsed.day
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

function getMissingFormatRules(reportMarkdown: string) {
  const requiredHeaders = [
    '✦ 부록 1  혈액형 관점의 시사점  ✦',
    '✦ 부록 2  별자리 관점의 시사점  ✦',
    '✦ 부록 3  사주 기반 골프 스타일 분석  ✦',
    '◆ 1) 플레이 성향(코스 매니지먼트)',
    '◆ 2) 스윙/샷 성향(장점)',
    '◆ 3) 흔한 실수 패턴(주의점)',
    '◆ 4) 보완 훈련 루틴(2주 플랜)',
    '◆ 5) 멘탈/루틴 개운법(골프 버전)',
  ]
  const missing: string[] = []
  for (const header of requiredHeaders) {
    if (!reportMarkdown.includes(header)) {
      missing.push(`필수 헤더 누락: ${header}`)
    }
  }
  if (!reportMarkdown.includes('14일') && !reportMarkdown.includes('2주')) {
    missing.push('골프 루틴에서 14일 또는 2주 플랜 표현 누락')
  }
  const appendix3Match = reportMarkdown.match(
    /✦ 부록 3  사주 기반 골프 스타일 분석  ✦([\s\S]*)$/,
  )
  const appendix3 = appendix3Match ? appendix3Match[1] : ''
  const golfBulletCount = (appendix3.match(/^\s*[-•]\s+/gm) || []).length
  if (golfBulletCount < 20) {
    missing.push('부록3 전체 bullet 수가 20개 미만')
  }
  return missing
}

function hasRequiredCoreHeaders(reportMarkdown: string) {
  return (
    reportMarkdown.includes('✦ 부록 1  혈액형 관점의 시사점  ✦') &&
    reportMarkdown.includes('✦ 부록 2  별자리 관점의 시사점  ✦') &&
    reportMarkdown.includes('✦ 부록 3  사주 기반 골프 스타일 분석  ✦')
  )
}

function buildPrompt(params: {
  payload: Required<SajuReportPayload>
  computed: ReturnType<typeof computeSaju>
  zodiacResolved: ZodiacSign
  zodiacWasAuto: boolean
  generatedAtIso: string
  currentYear: number
  currentYearGanji: string
}) {
  const {
    payload,
    computed,
    zodiacResolved,
    zodiacWasAuto,
    generatedAtIso,
    currentYear,
    currentYearGanji,
  } = params
  const focusLabel: Record<FocusType, string> = {
    career: '직업/커리어',
    wealth: '재물/투자',
    relationship: '대인관계/연애',
    health: '건강',
    general: '종합',
  }
  const golfGoalLabel: Record<GolfGoal, string> = {
    distance: '비거리',
    accuracy: '정확도',
    consistency: '일관성',
    mental: '멘탈',
    score: '스코어',
    unknown: '미정',
  }
  const golfExpLabel: Record<GolfExperienceLevel, string> = {
    beginner: '초급',
    intermediate: '중급',
    advanced: '상급',
    unknown: '미상',
  }

  const systemInstruction =
    'You are a professional Korean Saju analyst writing a structured report. ' +
    'Output language: Korean. Output format: pure Markdown text only (no HTML). ' +
    'You must strictly mirror the required chapter titles, decorative separators, table sections, and advisory style. ' +
    'Use mixed Korean + Hanja for key terms: 四柱八字, 天干, 地支, 五行, 大運, 歲運, 用神, 忌神, 開運法.'

  const userPrompt =
    `다음 계산 데이터로 "사주팔자 종합 분석 보고서 / 四柱八字 綜合 分析 報告書"를 작성해줘.\n` +
    `문체: 전문 역술가 보고서 톤. 단정 대신 경향/가능성 중심.\n\n` +
    `입력 정보\n` +
    `- 의뢰인: ${payload.clientName}\n` +
    `- 생년월일: ${payload.birthDate} (${payload.calendarType === 'lunar' ? '음력' : '양력'})\n` +
    `- 출생시간: ${payload.timeUnknown ? '미상' : payload.birthTime}\n` +
    `- 성별: ${payload.gender}\n` +
    `- 시간대: ${payload.timezone}\n` +
    `- 중점 주제: ${focusLabel[payload.focus]}\n` +
    `- 추가 메모: ${payload.notes || '없음'}\n` +
    `- 혈액형: ${payload.bloodType}\n` +
    `- 별자리(서양): ${zodiacResolved}${zodiacWasAuto ? '(자동 산출)' : '(입력값 사용)'}\n` +
    `- 골프 숙련도: ${golfExpLabel[payload.golfExperienceLevel]}\n` +
    `- 골프 목표: ${golfGoalLabel[payload.golfGoal]}\n` +
    `- 골프 통증/제한: ${payload.golfPainOrLimits || '없음'}\n` +
    `- 골프 메모: ${payload.golfNotes || '없음'}\n` +
    `- 작성일: ${generatedAtIso}\n\n` +
    `사주 계산 결과 (근사 계산)\n` +
    `- 년주: ${computed.year.stem}${computed.year.branch} (${computed.year.stemHanja}${computed.year.branchHanja}) / ${computed.year.element}\n` +
    `- 월주: ${computed.month.stem}${computed.month.branch} (${computed.month.stemHanja}${computed.month.branchHanja}) / ${computed.month.element}\n` +
    `- 일주: ${computed.day.stem}${computed.day.branch} (${computed.day.stemHanja}${computed.day.branchHanja}) / ${computed.day.element}\n` +
    `- 시주: ${
      'unknown' in computed.hour
        ? '미상 (시주 없음)'
        : `${computed.hour.stem}${computed.hour.branch} (${computed.hour.stemHanja}${computed.hour.branchHanja}) / ${computed.hour.element}`
    }\n` +
    `- 오행 분포: 목 ${computed.fiveElements.목.count}(${computed.fiveElements.목.strength}), ` +
    `화 ${computed.fiveElements.화.count}(${computed.fiveElements.화.strength}), ` +
    `토 ${computed.fiveElements.토.count}(${computed.fiveElements.토.strength}), ` +
    `금 ${computed.fiveElements.금.count}(${computed.fiveElements.금.strength}), ` +
    `수 ${computed.fiveElements.수.count}(${computed.fiveElements.수.strength})\n` +
    `- 용신(用神) 제안: ${computed.yongsinSuggestion}\n` +
    `- 기신(忌神) 제안: ${computed.gisinSuggestion}\n` +
    `- ${computed.calendarAssumptionNote || '달력 변환 이슈 없음'}\n\n` +
    `추가 반영 지침\n` +
    `- 혈액형이 unknown이면, 부록1에서 "일반형 해석(참고용)"으로 명시하고 추후 입력 권장 문장을 포함.\n` +
    `- 시주 미상이면 골프 부록에서 "시주 미상으로 세부 성향은 참고 수준" 문장을 명시.\n` +
    `- golfNotes에 미스패턴(slice/hook/fat/thin 등)이 있으면 부록3에 반영하고, 없으면 "~일 가능성"으로 추정 표현 사용.\n` +
    `- 통증/제한 정보가 있으면 무리한 강도 제안 금지, 안전 주의 문장("통증 시 중단/전문가 상담") 포함.\n\n` +
    `출력 형식 규칙(엄수)\n` +
    `1) 표지 섹션 포함:\n` +
    `   - 제목: 사주팔자 종합 분석 보고서 / 四柱八字 綜合 分析 報告書\n` +
    `   - 의뢰인, 생년월일시, 작성일, 담당 역술가: AI 명리 리포트\n` +
    `2) 아래 장 제목을 정확히 사용:\n` +
    `   - ✦ 제 1장  기본 사주 정보  ✦\n` +
    `   - ✦ 제 2장  성격 · 기질 · 적성 분석  ✦\n` +
    `   - ✦ 제 3장  대운(大運) 및 세운(歲運) 분석  ✦\n` +
    `   - ✦ 제 4장  건강 · 재물 · 대인관계  ✦\n` +
    `   - ✦ 제 5장  종합 조언 및 개운법  ✦\n` +
    `3) 제5장 뒤에 아래 부록을 반드시 순서대로 추가:\n` +
    `   - ✦ 부록 1  혈액형 관점의 시사점  ✦\n` +
    `   - ✦ 부록 2  별자리 관점의 시사점  ✦\n` +
    `   - ✦ 부록 3  사주 기반 골프 스타일 분석  ✦\n` +
    `4) 장/절 구분에 "✦ ✦ ✦" 장식 구분선을 반복 사용.\n` +
    `5) 부록 1 필수 소제목:\n` +
    `   - ◆ 혈액형 요약(일반 성향)\n` +
    `   - ◆ 사주(오행/격국/용신·기신)와의 ‘궁합 포인트’\n` +
    `   - ◆ 주의할 편향\n` +
    `6) 부록 2 필수 소제목:\n` +
    `   - ◆ 별자리 성향 키워드 5개\n` +
    `   - ◆ 사주와의 교차 해석 포인트\n` +
    `   - ◆ 월간/계절 루틴 제안 3개\n` +
    `7) 부록 3 필수 소제목(정확히 동일):\n` +
    `   - ◆ 1) 플레이 성향(코스 매니지먼트)\n` +
    `   - ◆ 2) 스윙/샷 성향(장점)\n` +
    `   - ◆ 3) 흔한 실수 패턴(주의점)\n` +
    `   - ◆ 4) 보완 훈련 루틴(2주 플랜)\n` +
    `   - ◆ 5) 멘탈/루틴 개운법(골프 버전)\n` +
    `8) 부록 3 규칙:\n` +
    `   - 총 bullet 최소 20개\n` +
    `   - 2주(14일) 플랜: 일일 마이크로 드릴(10~20분) + 연습세션 2회 + 온코스 전략일 1회\n` +
    `   - 루틴 요소 포함: 멘탈 루틴, 프리샷 루틴, 템포 드릴, 웨지 거리감, 퍼팅 스타트라인\n` +
    `   - golfGoal=distance면 스피드+시퀀싱 비중, accuracy/consistency면 페이스/컨택/분산 비중\n` +
    `9) 절대 금지:\n` +
    `   - 의료 진단/치료 단정, 투자 수익 보장, 미래 사건 단정\n` +
    `10) 제1장에는 반드시 다음 소제목 포함:\n` +
    `   - ◆ 생년월일시 및 사주팔자\n` +
    `   - ▼ 사주원국(四柱原局)\n` +
    `   - ◆ 오행(五行) 분포 분석\n` +
    `   - ▼ 오행 강약 분포\n` +
    `   그리고 표 형식(마크다운 테이블)으로 사주원국/오행표를 제시.\n` +
    `   사주원국 표의 천간/지지/주(柱) 표기는 반드시 한글+한자 병기 형식으로 작성 (예: 갑(甲), 자(子), 갑자(甲子)).\n` +
    `11) 제2장에는 성격 bullets, "직업 적성 및 추천 분야", "직업 운용 조언" 포함.\n` +
    `12) 제3장에는 대운 10년 주기 표(최소 4행), 현재 연령대 문장, ` +
    `${currentYear} 세운 분석 — ${currentYearGanji}年 총평 및 bullets(사업·투자/대인관계/건강/가정·연애).\n` +
    `13) 제5장에는 반드시:\n` +
    `   - ◆ 삶의 방향성 — 핵심 메시지\n` +
    `   - ◆ 개운법(開運法) — 운을 여는 방법\n` +
    `   - bullets: 색상/방위/음식/활동/수호석/기도·기원\n` +
    `14) 리포트는 3000자 이상으로 충분히 상세하게 작성.\n` +
    `15) 마지막에 아래 세 문장을 반드시 포함:\n` +
    `   - 사주는 운명 확정이 아닌 성향과 흐름 참고용입니다.\n` +
    `   - 사주·혈액형·별자리 해석은 참고이며, 최종 선택과 실천은 개인의 몫입니다.\n` +
    `   - 본 보고서는 의뢰인에게만 제공되며 외부 배포 없이 참고용으로 활용됩니다.`,
    }

  return { systemInstruction, userPrompt }
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
  const origin = request.headers.get('Origin')
  if (!env.GEMINI_API_KEY) {
    return jsonResponse(
      500,
      { error: 'GEMINI_API_KEY is not configured.' },
      origin,
      env.ALLOWED_ORIGINS,
    )
  }

  const ip = inferIp(request)
  if (!enforceRateLimit(ip)) {
    return jsonResponse(
      429,
      { error: 'Too many requests. Please retry in about a minute.' },
      origin,
      env.ALLOWED_ORIGINS,
    )
  }

  let body: SajuReportPayload
  try {
    body = (await request.json()) as SajuReportPayload
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' }, origin, env.ALLOWED_ORIGINS)
  }

  const clientName = sanitizeText(String(body.clientName || ''), 40)
  const birthDate = sanitizeText(String(body.birthDate || ''), 10)
  const birthTimeRaw = body.birthTime === null ? null : sanitizeText(String(body.birthTime || ''), 5)
  const timeUnknown = Boolean(body.timeUnknown)
  const calendarType = body.calendarType === 'lunar' ? 'lunar' : 'solar'
  const gender = body.gender || 'other'
  const timezone = sanitizeText(String(body.timezone || 'Asia/Seoul'), 64)
  const focus = (body.focus || 'general') as FocusType
  const notes = sanitizeText(String(body.notes || ''), 600)
  const bloodType = (body.bloodType || 'unknown') as BloodType
  const zodiacSignInput = (body.zodiacSign || 'auto') as ZodiacSignInput
  const golfExperienceLevel = (body.golfExperienceLevel || 'unknown') as GolfExperienceLevel
  const golfGoal = (body.golfGoal || 'score') as GolfGoal
  const golfPainOrLimits = sanitizeText(String(body.golfPainOrLimits || ''), 160)
  const golfNotes = sanitizeText(String(body.golfNotes || ''), 300)

  if (!clientName) {
    return jsonResponse(400, { error: 'Missing field: clientName' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!birthDate) {
    return jsonResponse(400, { error: 'Missing field: birthDate' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!timeUnknown && !birthTimeRaw) {
    return jsonResponse(
      400,
      { error: 'birthTime is required when timeUnknown is false.' },
      origin,
      env.ALLOWED_ORIGINS,
    )
  }
  if (!allowedCalendarTypes.has(calendarType)) {
    return jsonResponse(400, { error: 'Invalid calendarType.' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedGender.has(gender)) {
    return jsonResponse(400, { error: 'Invalid gender.' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedFocus.has(focus)) {
    return jsonResponse(400, { error: 'Invalid focus.' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedBloodType.has(bloodType)) {
    return jsonResponse(400, { error: 'Invalid bloodType.' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedZodiacSignInput.has(zodiacSignInput)) {
    return jsonResponse(400, { error: 'Invalid zodiacSign.' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedGolfExperienceLevel.has(golfExperienceLevel)) {
    return jsonResponse(
      400,
      { error: 'Invalid golfExperienceLevel.' },
      origin,
      env.ALLOWED_ORIGINS,
    )
  }
  if (!allowedGolfGoal.has(golfGoal)) {
    return jsonResponse(400, { error: 'Invalid golfGoal.' }, origin, env.ALLOWED_ORIGINS)
  }
  if (!assertTimezone(timezone)) {
    return jsonResponse(400, { error: 'Invalid timezone.' }, origin, env.ALLOWED_ORIGINS)
  }

  const zodiacResolved =
    zodiacSignInput === 'auto' ? computeWesternZodiac(birthDate) : zodiacSignInput
  const zodiacWasAuto = zodiacSignInput === 'auto'

  let computed: ReturnType<typeof computeSaju>
  try {
    computed = computeSaju({
      birthDate,
      birthTime: timeUnknown ? null : birthTimeRaw,
      timeUnknown,
      calendarType,
      timezone,
    })
  } catch (err) {
    return jsonResponse(
      400,
      { error: err instanceof Error ? err.message : 'Failed to compute saju.' },
      origin,
      env.ALLOWED_ORIGINS,
    )
  }

  const payload: Required<SajuReportPayload> = {
    clientName,
    birthDate,
    birthTime: timeUnknown ? null : birthTimeRaw,
    timeUnknown,
    calendarType,
    gender,
    timezone,
    focus,
    notes,
    bloodType,
    zodiacSign: zodiacSignInput,
    golfExperienceLevel,
    golfGoal,
    golfPainOrLimits,
    golfNotes,
  }

  const generatedAtIso = new Date().toISOString()
  const currentYear = new Date().getFullYear()
  const currentYearGanji = getSexagenaryYear(currentYear)

  const { systemInstruction, userPrompt } = buildPrompt({
    payload,
    computed,
    zodiacResolved,
    zodiacWasAuto,
    generatedAtIso,
    currentYear,
    currentYearGanji,
  })

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  const modelName = env.GEMINI_MODEL || 'gemini-1.5-flash'
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  })

  const callGemini = async (prompt: string) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    try {
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text().trim() || ''
    } finally {
      clearTimeout(timeoutId)
    }
  }

  let reportMarkdown = ''
  try {
    reportMarkdown = await callGemini(userPrompt)
    if (!hasRequiredCoreHeaders(reportMarkdown)) {
      const retryPrompt =
        userPrompt +
        '\n\n부록 헤더가 누락되었습니다. 아래 3개 헤더를 정확히 포함해 전체 보고서를 다시 작성하세요.\n' +
        '- ✦ 부록 1  혈액형 관점의 시사점  ✦\n' +
        '- ✦ 부록 2  별자리 관점의 시사점  ✦\n' +
        '- ✦ 부록 3  사주 기반 골프 스타일 분석  ✦'
      reportMarkdown = await callGemini(retryPrompt)
    }
  } catch (err) {
    return jsonResponse(
      502,
      { error: err instanceof Error ? err.message : 'Gemini API request failed.' },
      origin,
      env.ALLOWED_ORIGINS,
    )
  }

  if (!reportMarkdown) {
    return jsonResponse(502, { error: 'No report generated.' }, origin, env.ALLOWED_ORIGINS)
  }

  const formatWarnings = getMissingFormatRules(reportMarkdown)

  const fourPillars = {
    year: computed.year,
    month: computed.month,
    day: computed.day,
    hour: computed.hour,
  }

  return jsonResponse(
    200,
    {
      reportMarkdown,
      meta: {
        fourPillars,
        fiveElements: computed.fiveElements,
        bloodType,
        zodiacSign: zodiacResolved,
        zodiacAutoComputed: zodiacWasAuto,
        formatWarnings,
        yongsinSuggestion: computed.yongsinSuggestion,
        gisinSuggestion: computed.gisinSuggestion,
        calendarAssumptionNote: computed.calendarAssumptionNote || null,
        generatedAt: generatedAtIso,
      },
    },
    origin,
    env.ALLOWED_ORIGINS,
  )
}
