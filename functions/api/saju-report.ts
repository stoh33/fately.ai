import { computeSaju, getSexagenaryYear } from '../lib/saju-calculator'

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

function jsonResponse(status: number, body: Record<string, unknown>, origin: string | null, allowedOrigins?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...buildCorsHeaders(origin, allowedOrigins),
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function getEnvValue(obj: unknown, target: string) {
  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, string | undefined>
  if (record[target]) return record[target] as string
  const foundKey = Object.keys(record).find((k) => k.trim().toUpperCase() === target.toUpperCase())
  return foundKey ? (record[foundKey] as string) : null
}

function getWesternZodiac(month: number, day: number) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return 'Gemini'
  if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return 'Cancer'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra'
  if ((month === 10 && day >= 23) || (month === 11 && day <= 22)) return 'Scorpio'
  if ((month === 11 && day >= 23) || (month === 12 && day <= 24)) return 'Sagittarius'
  if ((month === 12 && day >= 25) || (month === 1 && day <= 19)) return 'Capricorn'
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius'
  return 'Pisces'
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
    return jsonResponse(400, { error: 'Invalid body' }, origin, env.ALLOWED_ORIGINS)
  }

  const apiKey = getEnvValue(env, 'OPENAI_API_KEY')
  if (!apiKey) {
    return jsonResponse(500, { error: 'OPENAI API 키가 설정되지 않았습니다.' }, origin, env.ALLOWED_ORIGINS)
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
  } catch {
    return jsonResponse(400, { error: '사주 계산 실패' }, origin, env.ALLOWED_ORIGINS)
  }

  const currentYear = new Date().getFullYear()
  const currentYearGanji = getSexagenaryYear(currentYear)
  const [_yearStr, monthStr, dayStr] = String(body.birthDate || '').split('-')
  const birthMonth = Number(monthStr)
  const birthDay = Number(dayStr)
  const inferredZodiac =
    Number.isFinite(birthMonth) && Number.isFinite(birthDay)
      ? getWesternZodiac(birthMonth, birthDay)
      : 'unknown'
  const selectedZodiac =
    body.zodiacSign && body.zodiacSign !== 'auto' ? String(body.zodiacSign) : inferredZodiac

  const systemInstruction = `
당신은 전문 사주 분석가이자 점성술 상담사입니다.
아래 출력 형식을 반드시 지키세요.
- 마크다운 형식
- 각 섹션은 H2(##) 제목 사용
- 단정적 확정 표현 대신 경향/가능성 중심 표현
- 마지막에는 실행 가능한 보완 행동을 구체적으로 제시
`.trim()
  const userPrompt = `
사주 분석 보고서를 작성해줘.
의뢰인: ${body.clientName || '의뢰인'}, 생년월일: ${body.birthDate}, 성별: ${body.gender || '미상'}, 혈액형: ${body.bloodType || '미상'}
별자리: ${selectedZodiac} (입력값: ${body.zodiacSign || 'auto'}, 기준: ${body.calendarType === 'lunar' ? '양력 환산 필요 가능성' : '양력 기준'})
사주원국: 년(${computed.year.stem}${computed.year.branch}), 월(${computed.month.stem}${computed.month.branch}), 일(${computed.day.stem}${computed.day.branch}), 시(${computed.hour.stem || '미상'}${computed.hour.branch || ''})
오행 분포: 목(${computed.fiveElements.목.count}), 화(${computed.fiveElements.화.count}), 토(${computed.fiveElements.토.count}), 금(${computed.fiveElements.금.count}), 수(${computed.fiveElements.수.count})

다음 내용을 상세히 포함해줘:
1. 사주원국 분석 및 오행 특징
2. 성격 및 기질 분석
3. 대운 및 2026년(${currentYearGanji}) 운세 상세
4. 올해 종합사주 (${currentYear}년 전체 흐름: 커리어/재물/관계/건강)
5. 올해 월별 사주 (${currentYear}년 1~12월)
   - 각 월마다 핵심 키워드, 기회, 주의점, 추천 행동을 2~3문장으로 작성
6. 건강, 재물, 관계 조언
7. 사주 맞춤 골프 스타일 및 보완점 (조언 포함)
8. 별자리(서양점성술) 핵심 성향 분석
9. 사주 결과와 별자리 교차분석
  - 공통점(최소 3개)
  - 차이점(최소 3개)
  - 보완점(행동 중심, 최소 5개)
10. 혈액형 성향 분석(일반적 경향)
11. 사주 결과와 혈액형 교차분석
  - 공통점(최소 2개)
  - 차이점(최소 2개)
  - 보완점(최소 3개)

마지막에 "종합 요약" 섹션으로 핵심 5줄 요약을 추가해줘.
그리고 보고서의 최종 섹션(H2)으로 반드시 "사주 맞춤 골프 스타일 & 보완점"을 추가해:
- 추천 골프 스타일 1가지(예: 전략형/공격형/리듬형/정교형)
- 강점 활용 포인트 3가지
- 약점 보완 및 플레이 조언 5가지 (스윙, 멘탈, 루틴, 코스매니지먼트 관련 조언. 단, 구체적인 훈련법이나 주차별 훈련 플랜은 제외할 것)
`

  try {
    const reportMarkdown = await callOpenAI(
      apiKey,
      env.OPENAI_MODEL || 'gpt-4o-mini',
      systemInstruction,
      userPrompt,
    )
    if (!reportMarkdown) throw new Error('Empty response')

    return jsonResponse(
      200,
      {
        reportMarkdown,
        meta: {
          fourPillars: { year: computed.year, month: computed.month, day: computed.day, hour: computed.hour },
          fiveElements: computed.fiveElements,
          generatedAt: new Date().toISOString(),
          provider: 'openai',
        },
      },
      origin,
      env.ALLOWED_ORIGINS,
    )
  } catch (err: any) {
    const detail = err instanceof Error ? err.message : String(err)
    let msg = detail || 'OPENAI API 호출 중 오류가 발생했습니다.'
    if (detail.includes('429')) msg = 'API 할당량 초과되었습니다. 잠시 후 다시 시도하세요.'
    return jsonResponse(502, { error: msg, detail }, origin, env.ALLOWED_ORIGINS)
  }
}
