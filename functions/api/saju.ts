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
const allowedBirthCalendars = new Set(['solar', 'lunar'])

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

function buildPrompt(payload: Required<SajuPayload>, computed: ReturnType<typeof computeSaju>) {
  const sajuContextKo = `
사주 계산 결과:
- 년주: ${computed.year.stem}${computed.year.branch} (${computed.year.stemHanja}${computed.year.branchHanja}) / ${computed.year.element}
- 월주: ${computed.month.stem}${computed.month.branch} (${computed.month.stemHanja}${computed.month.branchHanja}) / ${computed.month.element}
- 일주: ${computed.day.stem}${computed.day.branch} (${computed.day.stemHanja}${computed.day.branchHanja}) / ${computed.day.element}
- 시주: ${
    'unknown' in computed.hour
      ? '미상'
      : `${computed.hour.stem}${computed.hour.branch} (${computed.hour.stemHanja}${computed.hour.branchHanja}) / ${computed.hour.element}`
  }
- 오행 분포: 목 ${computed.fiveElements.목.count}, 화 ${computed.fiveElements.화.count}, 토 ${computed.fiveElements.토.count}, 금 ${computed.fiveElements.금.count}, 수 ${computed.fiveElements.수.count}
- 용신: ${computed.yongsinSuggestion}
- 기신: ${computed.gisinSuggestion}
`.trim()

  if (payload.lang === 'en') {
    const systemInstruction =
      'You are a professional Korean Four Pillars (Saju) consultant. ' +
      'Based on the given birth date/time branch, gender, and blood type, write a detailed entertainment-only report in Markdown. ' +
      'Rules: ' +
      '- Avoid definitive claims; focus on possibilities and tendencies. ' +
      '- When a traditional term appears the first time, include its Hanja in parentheses. ' +
      '- Soften negative statements; no fear-mongering. ' +
      'Add the following JSON block at the very top of your response (before Markdown), and then continue with the report. ' +
      'The JSON must be valid and fully filled. ' +
      'JSON format:\n' +
      '```json\n' +
      '{\n' +
      '  "pillars": {\n' +
      '    "year":  { "gan": "Heavenly Stem", "ji": "Earthly Branch", "hidden": ["Hidden Stem"], "element": "Wood|Fire|Earth|Metal|Water" },\n' +
      '    "month": { "gan": "Heavenly Stem", "ji": "Earthly Branch", "hidden": ["Hidden Stem"], "element": "Wood|Fire|Earth|Metal|Water" },\n' +
      '    "day":   { "gan": "Heavenly Stem", "ji": "Earthly Branch", "hidden": ["Hidden Stem"], "element": "Wood|Fire|Earth|Metal|Water" },\n' +
      '    "hour":  { "gan": "Heavenly Stem", "ji": "Earthly Branch", "hidden": ["Hidden Stem"], "element": "Wood|Fire|Earth|Metal|Water" }\n' +
      '  },\n' +
      '  "fiveElements": { "Wood": 0, "Fire": 0, "Earth": 0, "Metal": 0, "Water": 0 },\n' +
      '  "yongsin": "Wood|Fire|Earth|Metal|Water",\n' +
      '  "gisin": "Wood|Fire|Earth|Metal|Water",\n' +
      '  "daewoon": [\n' +
      '    { "age": 0, "gan": "Stem", "ji": "Branch", "current": true },\n' +
      '    { "age": 0, "gan": "Stem", "ji": "Branch", "current": false }\n' +
      '  ],\n' +
      '  "lifeSeason": "Spring|Summer|Autumn|Winter",\n' +
      '  "lifeSeasonAge": { "spring": [0,0], "summer": [0,0], "autumn": [0,0], "winter": [0,0] }\n' +
      '}\n' +
      '```'

    const userPrompt =
      `Input:\n` +
      `- Birth date (${payload.birthCalendar}): ${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}\n` +
      `- Birth hour branch: ${payload.birthHour}\n` +
      `- Birthplace: ${payload.birthplace}\n` +
      `- Gender: ${payload.gender}\n` +
      `- Blood type: ${payload.bloodType}\n\n` +
      `Saju Computation Data:\n${sajuContextKo}\n\n` +
      `Write the following 10 sections in Markdown:\n\n` +
      `## 1. Four Pillars (四柱八字) Analysis\n` +
      `- Derive and interpret the Heavenly Stem (天干) and Earthly Branch (地支) for year/month/day/hour pillars\n` +
      `- Five Elements (五행) distribution: strength of Wood/Fire/Earth/Metal/Water\n` +
      `- Determine Yongsin (用神) and Gisin (忌神) with reasons\n` +
      `- Judge the Day Master (日干) strength (strong/weak)\n\n` +
      `## 2. Ten Gods & Personality Analysis\n` +
      `- Distribution and traits of Bijie (比劫)/Siksang (食傷)/Jaeseong (財星)/Gwanseong (官星)/Inseong (印星)\n` +
      `- Core personality/temperament centered on the Day Master (5-7 lines)\n` +
      `- Strengths and areas to balance\n\n` +
      `## 3. Major Cycle (大運) Flow\n` +
      `- Current 10-year cycle stem/branch and meaning\n` +
      `- Next 20 years direction and key keywords for each cycle\n\n` +
      `## 4. Western Astrology Cross-Analysis\n` +
      `- Determine Sun Sign and key traits\n` +
      `- Commonalities between Day Master traits and Sun Sign (at least 3)\n` +
      `- Differences or tensions (at least 2)\n` +
      `- 2026 outlook cross-analysis from both views\n\n` +
      `## 5. Blood Type Integrated Insights\n` +
      `- ${payload.bloodType} type trait summary\n` +
      `- Synergy points between Saju traits and blood type (3)\n` +
      `- Additional insights from blood type not visible in Saju alone (3)\n` +
      `- 2026 interpersonal & decision-style advice from blood type view\n\n` +
      `## 6. Overall Fortune Summary\n` +
      `- 6-8 bullet points\n\n` +
      `## 7. 2026 Fortune in Detail\n` +
      `Write 3-4 lines each:\n` +
      `- Daily Luck (日운): daily life & health\n` +
      `- Wealth Luck (財物運): income, investment, spending\n` +
      `- Authority/Status Luck (官運): work, status, reputation\n` +
      `- Relationship Luck (關係運): social, love, family\n` +
      `(Integrate Saju + Sun Sign + blood type)\n\n` +
      `## 8. 2026 Monthly Fortune\n` +
      `January to December, 2-3 bullets each with key energy, caution, and action tips\n\n` +
      `## 9. Practical Tips & Cautions\n` +
      `- 3 actions aligned with Yongsin\n` +
      `- 2 avoidances for Gisin\n` +
      `- 2 blood type-tailored tips\n` +
      `- 2 Sun Sign tips\n\n` +
      `## 10. Saju-Based Golf Style & Improvement Points\n` +
      `- Interpret a golf style aligned with this Saju tendency (tempo, risk-taking, course management, and mental routine)\n` +
      `- Include 3 concrete improvement points for weaknesses`

    return { systemInstruction, userPrompt }
  }

  const systemInstruction =
    '당신은 한국 전통 명리학(사주팔자) 전문 상담가입니다. ' +
    '입력된 생년월일·시지·성별·혈액형을 바탕으로 아래 형식에 따라 상세한 오락용 분석 보고서를 마크다운으로 작성하세요. ' +
    '규칙: ' +
    '- 단정 표현 금지, 가능성·경향 중심으로 서술 ' +
    '- 전통 명리 용어는 처음 등장 시 한자를 병기 (예: 용신(用神)) ' +
    '- 부정적 내용은 완화된 표현 사용, 공포 조장 금지 ' +
    '응답 맨 앞에 다음 JSON 블록을 반드시 포함해줘 (마크다운 앞에 위치). ' +
    'JSON은 유효해야 하며 모든 값을 채워야 합니다. ' +
    'JSON 형식:\n' +
    '```json\n' +
    '{\n' +
    '  "pillars": {\n' +
    '    "year":  { "gan": "천간글자", "ji": "지지글자", "hidden": ["지장간"], "element": "목|화|토|금|수" },\n' +
    '    "month": { "gan": "천간글자", "ji": "지지글자", "hidden": ["지장간"], "element": "목|화|토|금|수" },\n' +
    '    "day":   { "gan": "천간글자", "ji": "지지글자", "hidden": ["지장간"], "element": "목|화|토|금|수" },\n' +
    '    "hour":  { "gan": "천간글자", "ji": "지지글자", "hidden": ["지장간"], "element": "목|화|토|금|수" }\n' +
    '  },\n' +
    '  "fiveElements": { "목": 0, "화": 0, "토": 0, "금": 0, "수": 0 },\n' +
    '  "yongsin": "용신 오행",\n' +
    '  "gisin": "기신 오행",\n' +
    '  "daewoon": [\n' +
    '    { "age": 0, "gan": "천간", "ji": "지지", "current": true },\n' +
    '    { "age": 0, "gan": "천간", "ji": "지지", "current": false }\n' +
    '  ],\n' +
    '  "lifeSeason": "봄|여름|가을|겨울",\n' +
    '  "lifeSeasonAge": { "spring": [0,0], "summer": [0,0], "autumn": [0,0], "winter": [0,0] }\n' +
    '}\n' +
    '```\n' +
    '마지막 줄: "본 내용은 오락적 참고용이며 전문 상담을 대체하지 않습니다."'

  const userPrompt =
    `입력값:\n` +
    `- 생년월일(${payload.birthCalendar === 'lunar' ? '음력' : '양력'}): ${payload.birthYear}-${payload.birthMonth}-${payload.birthDay}\n` +
    `- 출생 시지: ${payload.birthHour}\n` +
    `- 출생지: ${payload.birthplace}\n` +
    `- 성별: ${payload.gender}\n` +
    `- 혈액형: ${payload.bloodType}\n\n` +
    `사주 계산 데이터:\n${sajuContextKo}\n\n` +
    `다음 10개 섹션을 마크다운으로 작성해줘:\n\n` +
    `## 1. 사주원국(四柱八字) 분석\n` +
    `- 년주(年柱)/월주(月柱)/일주(日柱)/시주(時柱) 각각의 천간(天干)·지지(地支) 도출 및 의미 해석\n` +
    `- 오행(五行) 분포: 목(木)/화(火)/토(土)/금(金)/수(水) 각 강약 분석\n` +
    `- 용신(用神)과 기신(忌神) 도출 및 그 이유 설명\n` +
    `- 일간(日干)의 강약(신강/신약) 판단\n\n` +
    `## 2. 십신(十神) 및 성격 분석\n` +
    `- 비겁(比劫)/식상(食傷)/재성(財星)/관성(官星)/인성(印星) 분포와 특징\n` +
    `- 일간 중심 핵심 성격·기질 서술 (5~7줄)\n` +
    `- 강점과 보완할 점\n\n` +
    `## 3. 대운(大運) 흐름\n` +
    `- 현재 대운 천간·지지 및 의미\n` +
    `- 향후 20년 대운 방향과 각 대운별 핵심 키워드\n\n` +
    `## 4. 서양 별자리 분석 및 사주 교차 해석\n` +
    `- 태양별자리(Sun Sign) 도출 및 핵심 성격 특징\n` +
    `- 사주 일간 성격과 별자리 성격의 공통점 (3가지 이상)\n` +
    `- 사주와 별자리가 서로 다르게 말하는 점 (2가지 이상)\n` +
    `- 두 관점의 2026년 운세 교차 분석\n\n` +
    `## 5. 혈액형 통합 인사이트\n` +
    `- ${payload.bloodType}형 성격 특성 요약\n` +
    `- 사주 성격 + 혈액형 성격의 시너지 포인트 (3가지)\n` +
    `- 사주만으로는 보이지 않으나 혈액형 관점에서 추가되는 인사이트 (3가지)\n` +
    `- 혈액형 관점 2026년 대인관계·의사결정 스타일 조언\n\n` +
    `## 6. 종합운 요약\n` +
    `- 핵심 특성 불릿 6~8개로 요약\n\n` +
    `## 7. 2026년 운세 상세\n` +
    `각 항목을 3~4줄로 서술:\n` +
    `- 일운(日運): 일상·건강\n` +
    `- 재물운(財物運): 수입·투자·지출\n` +
    `- 관운(官運): 직장·사회적 지위·명예\n` +
    `- 관계운(關係運): 대인·연애·가족\n` +
    `(사주 + 별자리 + 혈액형 세 관점을 통합해서 서술)\n\n` +
    `## 8. 2026년 월별 운세\n` +
    `1월~12월 각 월마다 2~3개 불릿, 주요 기운·주의사항·행동 팁 포함\n\n` +
    `## 9. 실천 팁 및 주의사항\n` +
    `- 용신 관련 행동 팁 3가지\n` +
    `- 기신 회피 팁 2가지\n` +
    `- 혈액형 맞춤 조언 2가지\n` +
    `- 별자리 관점 조언 2가지\n\n` +
    `## 10. 사주 맞춤 골프 스타일 및 보완점\n` +
    `- 사주 성향에 맞는 골프 스타일 해석 (템포, 리스크 성향, 코스 매니지먼트, 멘탈 루틴)\n` +
    `- 약점을 보완할 수 있는 구체적 보완점 3가지`

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
    const availableKeys = Object.keys(env || {}).join(', ')
    console.error(`GEMINI_API_KEY is missing. Available keys: ${availableKeys || 'none'}`)
    return new Response(JSON.stringify({ 
      error: 'GEMINI_API_KEY is not configured.',
      debug_keys: availableKeys
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  let body: SajuPayload
  try {
    body = (await request.json()) as SajuPayload
  } catch {
    return badRequest('Invalid JSON body.', origin, env.ALLOWED_ORIGINS)
  }

  const requiredFields: Array<keyof SajuPayload> = [
    'birthCalendar',
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
    birthCalendar: body.birthCalendar === 'lunar' ? 'lunar' : 'solar',
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
  if (!allowedBirthCalendars.has(payload.birthCalendar)) {
    return badRequest('Invalid birth calendar.', origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedGenders.has(payload.gender)) {
    return badRequest('Invalid gender.', origin, env.ALLOWED_ORIGINS)
  }
  if (!allowedBloodTypes.has(payload.bloodType)) {
    return badRequest('Invalid blood type.', origin, env.ALLOWED_ORIGINS)
  }

  let computed: ReturnType<typeof computeSaju>
  try {
    computed = computeSaju({
      birthDate: `${payload.birthYear}-${payload.birthMonth.padStart(2, '0')}-${payload.birthDay.padStart(2, '0')}`,
      birthHourBranch: payload.birthHour,
      timeUnknown: false,
      calendarType: payload.birthCalendar,
      timezone: 'Asia/Seoul',
    })
  } catch (err) {
    return badRequest(
      err instanceof Error ? err.message : 'Saju computation failed.',
      origin,
      env.ALLOWED_ORIGINS,
    )
  }

  const { systemInstruction, userPrompt } = buildPrompt(payload, computed)
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  const modelName = env.GEMINI_MODEL || 'gemini-flash-latest'
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  })

  try {
    const result = await model.generateContent(userPrompt)
    const response = await result.response
    const report = response.text().trim() || null

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

    return new Response(JSON.stringify({ report, model: modelName }), {
      status: 200,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json; charset=utf-8',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Gemini API request failed.',
        detail: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
          'content-type': 'application/json; charset=utf-8',
        },
      },
    )
  }
}
