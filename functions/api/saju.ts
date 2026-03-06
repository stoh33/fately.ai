import { computeSaju } from '../lib/saju-calculator'

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
    return new Response('Invalid JSON', { status: 400 })
  }

  const apiKey = getEnvValue(env, 'OPENAI_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI API 키가 설정되지 않았습니다.' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json',
      },
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
  } catch {
    return new Response('Saju computation failed', { status: 400 })
  }

  const birthMonth = Number(body.birthMonth)
  const birthDay = Number(body.birthDay)
  const zodiac =
    Number.isFinite(birthMonth) && Number.isFinite(birthDay)
      ? getWesternZodiac(birthMonth, birthDay)
      : 'unknown'
  const currentYear = new Date().getFullYear()

  const systemInstruction = `
당신은 전문 사주 분석가이자 점성술 상담사입니다.
결과는 마크다운으로 작성하고, 각 섹션을 H2(##)로 분리하세요.
`.trim()
  const userPrompt = `
다음 정보를 바탕으로 사주 리포트를 작성해줘.
- 생년월일: ${body.birthYear}-${String(body.birthMonth).padStart(2, '0')}-${String(body.birthDay).padStart(2, '0')} (${body.birthCalendar || 'solar'})
- 성별: ${body.gender || '미상'}
- 혈액형: ${body.bloodType || '미상'}
- 별자리(양력 기준): ${zodiac}
- 사주원국 데이터: ${JSON.stringify(computed)}

반드시 아래 순서로 작성:
1) 사주 핵심 해석
   - 주의: 시각적 표는 UI에서 별도로 제공되므로, 텍스트로 년/월/일/시주를 나열하지 마세요. 바로 분석 내용으로 시작하세요.
2) 오행 균형/불균형 및 성향
3) 올해 종합사주 (${currentYear}년 전체 흐름: 커리어/재물/관계/건강)
4) 올해 월별 사주 (${currentYear}년 1~12월)
   - 각 월마다 핵심 키워드, 기회, 주의점, 추천 행동을 2~3문장으로 작성
5) 별자리 분석
6) 사주와 별자리 교차분석
   - 공통점 3개
   - 차이점 3개
   - 보완점 5개(실행 행동 중심)
7) 혈액형 분석(일반적 경향)
8) 사주와 혈액형 교차분석
   - 공통점 2개
   - 차이점 2개
   - 보완점 3개
9) 종합 분석 기반 추정 MBTI (사주+별자리+혈액형 통합 결과)
10) 종합 결론(5줄)
11) 사주 맞춤 골프 스타일 & 보완점 (이 섹션은 마지막에 배치)
   - 추천 플레이 스타일 1가지
   - 강점 활용 포인트 3가지
   - 보완 및 플레이 조언 5가지(스윙/멘탈/루틴/코스 운영 포함. 단, 구체적인 훈련법이나 실천 플랜은 제외할 것)
`

  try {
    const report = await callOpenAI(apiKey, env.OPENAI_MODEL || 'gpt-4o-mini', systemInstruction, userPrompt)
    return new Response(
      JSON.stringify({
        report,
        meta: {
          fourPillars: {
            year: computed.year,
            month: computed.month,
            day: computed.day,
            hour: computed.hour,
          },
          fiveElements: computed.fiveElements,
          generatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
          'content-type': 'application/json',
        },
      },
    )
  } catch (err: any) {
    const detail = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: detail }), {
      status: 502,
      headers: {
        ...corsHeaders,
        ...buildCorsHeaders(origin, env.ALLOWED_ORIGINS),
        'content-type': 'application/json',
      },
    })
  }
}
