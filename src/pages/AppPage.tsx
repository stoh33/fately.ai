import { useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import '../styles/app.css'

const heroPhotoUrl =
  'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&fm=jpg&q=80&w=1600'

const years = Array.from({ length: 127 }, (_, idx) => 1900 + idx)
const months = Array.from({ length: 12 }, (_, idx) => idx + 1)
const days = Array.from({ length: 31 }, (_, idx) => idx + 1)
const hours = [
  { value: '자', label: '자시 (23:00-01:00)' },
  { value: '축', label: '축시 (01:00-03:00)' },
  { value: '인', label: '인시 (03:00-05:00)' },
  { value: '묘', label: '묘시 (05:00-07:00)' },
  { value: '진', label: '진시 (07:00-09:00)' },
  { value: '사', label: '사시 (09:00-11:00)' },
  { value: '오', label: '오시 (11:00-13:00)' },
  { value: '미', label: '미시 (13:00-15:00)' },
  { value: '신', label: '신시 (15:00-17:00)' },
  { value: '유', label: '유시 (17:00-19:00)' },
  { value: '술', label: '술시 (19:00-21:00)' },
  { value: '해', label: '해시 (21:00-23:00)' },
]

const copy = {
  ko: {
    title: '오선생님의 사주보기',
    subtitle: '',
    subtitleExtra: '',
    sectionTitle: '기본 정보',
    sectionHelp: '태어난 순간의 기운을 정확히 담아주세요.',
    birthYear: '생년',
    birthMonth: '월',
    birthDay: '일',
    birthCalendar: '달력',
    birthHour: '시',
    birthplace: '태어난 지역',
    gender: '성별',
    bloodType: '혈액형',
    selectYear: '연도 선택',
    selectMonth: '월 선택',
    selectDay: '일 선택',
    selectCalendar: '음력/양력 선택',
    selectHour: '시간 선택',
    selectGender: '성별 선택',
    selectBlood: '혈액형 선택',
    placePlaceholder: '예: 부산, 대한민국',
    genderFemale: '여성',
    genderMale: '남성',
    genderOther: '기타',
    bloodA: 'A형',
    bloodB: 'B형',
    bloodO: 'O형',
    bloodAB: 'AB형',
    calendarSolar: '양력',
    calendarLunar: '음력',
    cta: '사주 보기',
    loading: '보고서 생성 중...',
    reset: '다시 입력',
    helper: '입력한 정보는 사주 해석 목적 외에는 사용되지 않습니다.',
    resultTitle: '사주 보고서',
    errorTitle: '요청 실패',
    saveImage: '이미지로 저장',
    langKo: '한국어',
    langEn: 'English',
  },
  en: {
    title: "Master Oh's Saju Reading",
    subtitle: '',
    subtitleExtra: '',
    sectionTitle: 'Basic Details',
    sectionHelp: 'Please enter the exact birth moment.',
    birthYear: 'Year',
    birthMonth: 'Month',
    birthDay: 'Day',
    birthCalendar: 'Calendar',
    birthHour: 'Hour',
    birthplace: 'Birthplace',
    gender: 'Gender',
    bloodType: 'Blood Type',
    selectYear: 'Select year',
    selectMonth: 'Select month',
    selectDay: 'Select day',
    selectCalendar: 'Select calendar',
    selectHour: 'Select hour',
    selectGender: 'Select gender',
    selectBlood: 'Select blood type',
    placePlaceholder: 'e.g., Busan, South Korea',
    genderFemale: 'Female',
    genderMale: 'Male',
    genderOther: 'Other',
    bloodA: 'Type A',
    bloodB: 'Type B',
    bloodO: 'Type O',
    bloodAB: 'Type AB',
    calendarSolar: 'Solar',
    calendarLunar: 'Lunar',
    cta: 'View Saju',
    loading: 'Generating report...',
    reset: 'Reset',
    helper: 'Your information is used only for this reading.',
    resultTitle: 'Saju Report',
    errorTitle: 'Request failed',
    saveImage: 'Save as image',
    langKo: 'Korean',
    langEn: 'English',
  },
}

type ApiResponse = {
  report?: string
  error?: string
  detail?: string
}

type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water'
type ElementKeyKo = '목' | '화' | '토' | '금' | '수'

type Pillar = {
  gan: string
  ji: string
  hidden?: string[]
  element: string
}

type SajuChartData = {
  pillars: {
    year: Pillar
    month: Pillar
    day: Pillar
    hour: Pillar
  }
  fiveElements: Record<string, number>
  yongsin: string
  gisin: string
  daewoon: Array<{ age: number; gan: string; ji: string; current?: boolean }>
  lifeSeason: string
  lifeSeasonAge: {
    spring: [number, number]
    summer: [number, number]
    autumn: [number, number]
    winter: [number, number]
  }
}

const elementOrder: ElementKey[] = ['Wood', 'Fire', 'Earth', 'Metal', 'Water']
const elementOrderKo: ElementKeyKo[] = ['목', '화', '토', '금', '수']

const elementLabels: Record<ElementKey, string> = {
  Wood: '목',
  Fire: '화',
  Earth: '토',
  Metal: '금',
  Water: '수',
}

const elementLabelsEn: Record<ElementKey, string> = {
  Wood: 'Wood',
  Fire: 'Fire',
  Earth: 'Earth',
  Metal: 'Metal',
  Water: 'Water',
}

const elementClassMap: Record<string, string> = {
  Wood: 'wood',
  Fire: 'fire',
  Earth: 'earth',
  Metal: 'metal',
  Water: 'water',
  목: 'wood',
  화: 'fire',
  토: 'earth',
  금: 'metal',
  수: 'water',
}

const ganKoToHanja: Record<string, string> = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸',
}

const jiKoToHanja: Record<string, string> = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥',
}

const ganHanjaToKo = Object.fromEntries(
  Object.entries(ganKoToHanja).map(([ko, hanja]) => [hanja, ko]),
) as Record<string, string>
const jiHanjaToKo = Object.fromEntries(
  Object.entries(jiKoToHanja).map(([ko, hanja]) => [hanja, ko]),
) as Record<string, string>

const formatGan = (value: string) => {
  if (!value || value === '-') return '-'
  if (value.includes('(')) return value
  if (ganKoToHanja[value]) return `${value}(${ganKoToHanja[value]})`
  if (ganHanjaToKo[value]) return `${ganHanjaToKo[value]}(${value})`
  return value
}

const formatJi = (value: string) => {
  if (!value || value === '-') return '-'
  if (value.includes('(')) return value
  if (jiKoToHanja[value]) return `${value}(${jiKoToHanja[value]})`
  if (jiHanjaToKo[value]) return `${jiHanjaToKo[value]}(${value})`
  return value
}

const inferElementFromGanJi = (gan: string, ji: string): ElementKey => {
  const koGan = gan.replace(/\(.*\)/, '')
  const koJi = ji.replace(/\(.*\)/, '')
  const ganElementMap: Record<string, ElementKey> = {
    갑: 'Wood',
    을: 'Wood',
    병: 'Fire',
    정: 'Fire',
    무: 'Earth',
    기: 'Earth',
    경: 'Metal',
    신: 'Metal',
    임: 'Water',
    계: 'Water',
  }
  const jiElementMap: Record<string, ElementKey> = {
    자: 'Water',
    축: 'Earth',
    인: 'Wood',
    묘: 'Wood',
    진: 'Earth',
    사: 'Fire',
    오: 'Fire',
    미: 'Earth',
    신: 'Metal',
    유: 'Metal',
    술: 'Earth',
    해: 'Water',
  }
  return ganElementMap[koGan] || jiElementMap[koJi] || 'Earth'
}

const dayGanOrder = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']
const dayJiOrder = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해']

const parseReport = (rawReport: string) => {
  if (!rawReport) {
    return { markdown: '', data: null as SajuChartData | null, jsonError: '' }
  }

  const jsonMatch = rawReport.match(/^```json\s*([\s\S]*?)\s*```/i)
  if (!jsonMatch) {
    return { markdown: rawReport.trim(), data: null as SajuChartData | null, jsonError: '' }
  }

  const jsonText = jsonMatch[1]
  let data: SajuChartData | null = null
  let jsonError = ''
  try {
    data = JSON.parse(jsonText) as SajuChartData
  } catch (err) {
    jsonError = err instanceof Error ? err.message : 'Invalid JSON block.'
  }

  const markdown = rawReport.slice(jsonMatch[0].length).trim()
  return { markdown, data, jsonError }
}

const normalizeElements = (fiveElements: Record<string, number>) => {
  const normalized: Record<ElementKey, number> = {
    Wood: 0,
    Fire: 0,
    Earth: 0,
    Metal: 0,
    Water: 0,
  }

  elementOrder.forEach((key) => {
    if (typeof fiveElements[key] === 'number') {
      normalized[key] = fiveElements[key]
    }
  })

  elementOrderKo.forEach((key, idx) => {
    const value = fiveElements[key]
    if (typeof value === 'number') {
      normalized[elementOrder[idx]] = value
    }
  })

  return normalized
}

const normalizeElementKey = (value: string): ElementKey | null => {
  if (!value) return null
  if (elementOrder.includes(value as ElementKey)) return value as ElementKey
  const koIndex = elementOrderKo.indexOf(value as ElementKeyKo)
  if (koIndex >= 0) {
    return elementOrder[koIndex]
  }
  return null
}

function App() {
  const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const [isLoading, setIsLoading] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const [lastPayload, setLastPayload] = useState<{
    birthCalendar: string
    birthYear: string
    birthMonth: string
    birthDay: string
  } | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const t = useMemo(() => copy[lang], [lang])
  const parsed = useMemo(() => parseReport(report), [report])
  const chartData = parsed.data
  const markdown = parsed.markdown
  const renderedMarkdown = useMemo(() => {
    if (!markdown) return ''
    const html = marked.parse(markdown, { async: false })
    const resolved = typeof html === 'string' ? html : ''
    return DOMPurify.sanitize(resolved)
  }, [markdown])
  const safePillars = chartData?.pillars || {
    year: { gan: '-', ji: '-', hidden: [], element: '' },
    month: { gan: '-', ji: '-', hidden: [], element: '' },
    day: { gan: '-', ji: '-', hidden: [], element: '' },
    hour: { gan: '-', ji: '-', hidden: [], element: '' },
  }

  const currentAge = useMemo(() => {
    if (!lastPayload) return null
    if (lastPayload.birthCalendar === 'lunar') return null
    const year = Number(lastPayload.birthYear)
    const month = Number(lastPayload.birthMonth)
    const day = Number(lastPayload.birthDay)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null
    }
    const today = new Date()
    let age = today.getFullYear() - year
    const hasHadBirthday =
      today.getMonth() + 1 > month ||
      (today.getMonth() + 1 === month && today.getDate() >= day)
    if (!hasHadBirthday) {
      age -= 1
    }
    return age
  }, [lastPayload])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setIsLoading(true)
    setError('')
    setReport('')

    try {
      const payload = {
        lang,
        birthCalendar: String(formData.get('birthCalendar') || ''),
        birthYear: String(formData.get('birthYear') || ''),
        birthMonth: String(formData.get('birthMonth') || ''),
        birthDay: String(formData.get('birthDay') || ''),
        birthHour: String(formData.get('birthHour') || ''),
        birthplace: String(formData.get('birthplace') || ''),
        gender: String(formData.get('gender') || ''),
        bloodType: String(formData.get('bloodType') || ''),
      }
      setLastPayload({
        birthCalendar: payload.birthCalendar,
        birthYear: payload.birthYear,
        birthMonth: payload.birthMonth,
        birthDay: payload.birthDay,
      })

      const response = await fetch('/api/saju', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const rawText = await response.text()
      let data: ApiResponse = {}
      if (rawText) {
        try {
          data = JSON.parse(rawText) as ApiResponse
        } catch {
          throw new Error(rawText)
        }
      }

      if (!response.ok || !data.report) {
        throw new Error(data.error || data.detail || rawText || 'Unknown error')
      }

      setReport(data.report)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to generate report.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = (event: React.MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.form
    if (form) {
      form.reset()
    }
    setError('')
    setReport('')
  }

  const handleSaveImage = async () => {
    if (!chartRef.current) return
    const canvas = await html2canvas(chartRef.current, {
      backgroundColor: null,
      scale: 2,
    })
    const link = document.createElement('a')
    link.download = 'saju-chart.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const elementValues = chartData ? normalizeElements(chartData.fiveElements || {}) : null
  const displayLabels = lang === 'ko' ? elementLabels : elementLabelsEn

  const seasonRanges = useMemo(() => {
    if (chartData?.lifeSeasonAge) {
      return chartData.lifeSeasonAge
    }
    return {
      spring: [0, 20],
      summer: [21, 40],
      autumn: [41, 60],
      winter: [61, 80],
    }
  }, [chartData])

  const seasonScale = useMemo(() => {
    const ages = [
      seasonRanges.spring,
      seasonRanges.summer,
      seasonRanges.autumn,
      seasonRanges.winter,
    ].flat()
    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)
    const safeMin = Number.isFinite(minAge) ? minAge : 0
    const safeMax = Number.isFinite(maxAge) && maxAge > safeMin ? maxAge : safeMin + 1
    const left = 20
    const right = 340
    const scale = (age: number) =>
      left + ((age - safeMin) / (safeMax - safeMin)) * (right - left)
    return { scale, left, right }
  }, [seasonRanges])

  const currentAgeX =
    typeof currentAge === 'number' ? seasonScale.scale(currentAge) : null

  const seasonLabelText =
    lang === 'ko'
      ? { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }
      : { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }

  const pillarHeader =
    lang === 'ko'
      ? { year: '년주', month: '월주', day: '일주', hour: '시주' }
      : { year: 'Year', month: 'Month', day: 'Day', hour: 'Hour' }

  const pillarRowLabel =
    lang === 'ko'
      ? { gan: '천간', ji: '지지', hidden: '지장간' }
      : { gan: 'Heavenly', ji: 'Earthly', hidden: 'Hidden' }

  const chartCopy =
    lang === 'ko'
      ? {
          title: '사주 분석표',
          pillars: '사주팔자 원국표',
          elements: '오행 수치',
          timeline: '대운 타임라인',
          season: '인생 사계절 그래프',
          seasonNow: '현재 국면',
          ageNow: '현재 나이',
          seasonMeaning:
            '사계절 그래프는 연령대별 기운 흐름(성장-확장-수확-정리)을 보여주는 참고 지표입니다.',
          tenGods: '십신(十神) 다섯 분류 의미',
        }
      : {
          title: 'Saju Chart',
          pillars: 'Four Pillars Grid',
          elements: 'Five Elements Scores',
          timeline: 'Major Cycle Timeline',
          season: 'Life Seasons Curve',
          seasonNow: 'Current phase',
          ageNow: 'Current age',
          seasonMeaning:
            'This seasonal curve is a reference map of life-energy phases by age bands.',
          tenGods: 'Ten-Gods Groups Meaning',
        }

  const seasonLabelX = {
    spring:
      (seasonScale.scale(seasonRanges.spring[0]) +
        seasonScale.scale(seasonRanges.spring[1])) /
      2,
    summer:
      (seasonScale.scale(seasonRanges.summer[0]) +
        seasonScale.scale(seasonRanges.summer[1])) /
      2,
    autumn:
      (seasonScale.scale(seasonRanges.autumn[0]) +
        seasonScale.scale(seasonRanges.autumn[1])) /
      2,
    winter:
      (seasonScale.scale(seasonRanges.winter[0]) +
        seasonScale.scale(seasonRanges.winter[1])) /
      2,
  }

  const stableDaewoon = useMemo(() => {
    const birthYear = Number(lastPayload?.birthYear)
    if (!Number.isFinite(birthYear)) {
      return chartData?.daewoon || []
    }
    const startAge = 7
    const baseCycleIndex = ((birthYear - 4) % 60 + 60) % 60
    return Array.from({ length: 8 }, (_, idx) => {
      const cycle = baseCycleIndex + idx + 1
      const gan = dayGanOrder[cycle % 10]
      const ji = dayJiOrder[cycle % 12]
      const age = startAge + idx * 10
      const isCurrent =
        typeof currentAge === 'number' && currentAge >= age && currentAge < age + 10
      return { age, gan: formatGan(gan), ji: formatJi(ji), current: isCurrent }
    })
  }, [chartData?.daewoon, currentAge, lastPayload?.birthYear])

  const daewoonMeaningText = (gan: string, ji: string) => {
    const element = inferElementFromGanJi(gan, ji)
    if (lang === 'en') {
      if (element === 'Wood') return 'Growth and expansion phase; learning and networking tend to matter most.'
      if (element === 'Fire') return 'Visibility and execution phase; momentum rises but overheat should be managed.'
      if (element === 'Earth') return 'Stability and adjustment phase; foundations, routine, and risk control are key.'
      if (element === 'Metal') return 'Decision and discipline phase; structure, standards, and pruning improve outcomes.'
      return 'Flow and strategy phase; timing, information, and flexibility become major levers.'
    }
    if (element === 'Wood')
      return '성장·확장 운으로 학습, 인맥 확장, 새로운 시도가 중요한 흐름입니다.'
    if (element === 'Fire')
      return '표현·실행 운으로 성과 가시화가 유리하나 과열·성급함 관리는 필요합니다.'
    if (element === 'Earth')
      return '안정·정비 운으로 기반 점검, 루틴 강화, 리스크 관리가 핵심입니다.'
    if (element === 'Metal')
      return '결단·정리 운으로 원칙 수립, 기준 강화, 선택과 집중이 유리합니다.'
    return '전략·유연 운으로 타이밍 판단, 정보 활용, 유연한 대응이 성패를 좌우합니다.'
  }

  return (
    <div className="app">
      <main className="layout">
        <section className="hero">
          <div className="lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={lang === 'ko' ? 'active' : ''}
              onClick={() => setLang('ko')}
            >
              {t.langKo}
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              {t.langEn}
            </button>
          </div>
          <h1>{t.title}</h1>
          <p className="subhead">{t.subtitle}</p>
          <p className="subhead">{t.subtitleExtra}</p>
          <figure className="hero-visual">
            <img
              src={heroPhotoUrl}
              alt={
                lang === 'ko'
                  ? '사주, 별자리, 혈액형, 골프 스타일을 통합한 상징 이미지'
                  : 'Integrated visual of Saju, zodiac, blood type, and golf style'
              }
              loading="eager"
            />
          </figure>
        </section>

        <section className="card">
          <header className="card-header">
            <h2>{t.sectionTitle}</h2>
            <p>{t.sectionHelp}</p>
          </header>

          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>{t.birthCalendar}</span>
              <select name="birthCalendar" defaultValue="solar" required>
                <option value="solar">{t.calendarSolar}</option>
                <option value="lunar">{t.calendarLunar}</option>
              </select>
            </label>

            <div className="form-grid date-grid">
              <label className="field">
                <span>{t.birthYear}</span>
                <select name="birthYear" defaultValue="" required>
                  <option value="" disabled>
                    {t.selectYear}
                  </option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {lang === 'ko' ? `${year}년` : year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t.birthMonth}</span>
                <select name="birthMonth" defaultValue="" required>
                  <option value="" disabled>
                    {t.selectMonth}
                  </option>
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {lang === 'ko' ? `${month}월` : month}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t.birthDay}</span>
                <select name="birthDay" defaultValue="" required>
                  <option value="" disabled>
                    {t.selectDay}
                  </option>
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {lang === 'ko' ? `${day}일` : day}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid time-place-grid">
              <label className="field">
                <span>{t.birthHour}</span>
                <select name="birthHour" defaultValue="" required>
                  <option value="" disabled>
                    {t.selectHour}
                  </option>
                  {hours.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t.birthplace}</span>
                <input
                  type="text"
                  name="birthplace"
                  placeholder={t.placePlaceholder}
                  required
                />
              </label>
            </div>

            <div className="inline-group">
              <label className="field">
                <span>{t.gender}</span>
                <select name="gender" defaultValue="" required>
                  <option value="" disabled>
                    {t.selectGender}
                  </option>
                  <option value="female">{t.genderFemale}</option>
                  <option value="male">{t.genderMale}</option>
                  <option value="other">{t.genderOther}</option>
                </select>
              </label>

              <label className="field">
                <span>{t.bloodType}</span>
                <select name="bloodType" defaultValue="" required>
                  <option value="" disabled>
                    {t.selectBlood}
                  </option>
                  <option value="A">{t.bloodA}</option>
                  <option value="B">{t.bloodB}</option>
                  <option value="O">{t.bloodO}</option>
                  <option value="AB">{t.bloodAB}</option>
                </select>
              </label>
            </div>

            <div className="actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
              <button type="submit" className="primary" disabled={isLoading} style={{ flex: 1 }}>
                {isLoading ? t.loading : t.cta}
              </button>
              <button type="button" className="ghost" onClick={handleReset}>
                {t.reset}
              </button>
            </div>

            <p className="helper">{t.helper}</p>

            {error ? (
              <section className="result error-box" aria-live="polite">
                <h3>{t.errorTitle}</h3>
                <p>{error}</p>
              </section>
            ) : null}

            {report ? (
              <section className="result" aria-live="polite">
                <h3>{t.resultTitle}</h3>
                {parsed.jsonError ? (
                  <p className="json-error">
                    JSON parse failed. Showing text only. ({parsed.jsonError})
                  </p>
                ) : null}

                {chartData ? (
                  <div className="chart-wrap">
                    <div className="chart-head">
                      <h4>{chartCopy.title}</h4>
                      <button type="button" className="ghost" onClick={handleSaveImage}>
                        {t.saveImage}
                      </button>
                    </div>

                    <div className="chart-grid" ref={chartRef}>
                      <article className="chart-card">
                        <h5>{chartCopy.pillars}</h5>
                        <p className="chart-hint">
                          {lang === 'ko'
                            ? '지장간은 제공된 JSON 기준으로 표시됩니다.'
                            : 'Hidden stems are shown based on the JSON data.'}
                        </p>
                        <div className="pillars-table">
                          <div className="pillars-row head">
                            <span />
                            <span>{pillarHeader.year}</span>
                            <span>{pillarHeader.month}</span>
                            <span>{pillarHeader.day}</span>
                            <span>{pillarHeader.hour}</span>
                          </div>
                          <div className="pillars-row">
                            <span className="label">{pillarRowLabel.gan}</span>
                            {(['year', 'month', 'day', 'hour'] as const).map((key) => (
                              <span
                                key={`gan-${key}`}
                                className={`cell ${
                                  elementClassMap[safePillars[key]?.element] || ''
                                }`}
                              >
                                {formatGan(safePillars[key]?.gan || '-')}
                              </span>
                            ))}
                          </div>
                          <div className="pillars-row">
                            <span className="label">{pillarRowLabel.ji}</span>
                            {(['year', 'month', 'day', 'hour'] as const).map((key) => (
                              <span
                                key={`ji-${key}`}
                                className={`cell ${
                                  elementClassMap[safePillars[key]?.element] || ''
                                }`}
                              >
                                {formatJi(safePillars[key]?.ji || '-')}
                              </span>
                            ))}
                          </div>
                          <div className="pillars-row">
                            <span className="label">{pillarRowLabel.hidden}</span>
                            {(['year', 'month', 'day', 'hour'] as const).map((key) => (
                              <span
                                key={`hidden-${key}`}
                                className={`cell subtle ${
                                  elementClassMap[safePillars[key]?.element] || ''
                                }`}
                              >
                                {safePillars[key]?.hidden?.length
                                  ? safePillars[key].hidden.map((item) => formatGan(item)).join(', ')
                                  : displayLabels[normalizeElementKey(safePillars[key]?.element) || 'Wood']}
                              </span>
                            ))}
                          </div>
                        </div>
                      </article>

                      <article className="chart-card">
                        <h5>{chartCopy.elements}</h5>
                        <div className="element-counts">
                          {elementOrder.map((key) => (
                            <div key={`count-${key}`} className={`element-count-item ${elementClassMap[key]}`}>
                              <span>{displayLabels[key]}</span>
                              <strong>{elementValues?.[key] ?? 0}</strong>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="chart-card">
                        <h5>{chartCopy.timeline}</h5>
                        <p className="chart-hint">
                          {lang === 'ko'
                            ? '대운은 출생연 기준 간지 순환 규칙으로 고정 계산되어 동일 입력에서 동일하게 표시됩니다.'
                            : 'Major cycles are fixed by a deterministic stem-branch cycle rule from birth year.'}
                        </p>
                        <div className="timeline">
                          {stableDaewoon.map((item, idx) => (
                            <div
                              key={`daewoon-${idx}`}
                              className={`timeline-item ${item.current ? 'current' : ''}`}
                            >
                              <span className="age">{item.age}세</span>
                              <span className="ganji">
                                {item.gan} {item.ji}
                              </span>
                              <p className="meaning">{daewoonMeaningText(item.gan, item.ji)}</p>
                              {item.current ? <span className="badge">현재</span> : null}
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="chart-card">
                        <h5>{chartCopy.season}</h5>
                        <div className="season-graph">
                          <svg viewBox="0 0 360 160">
                            <defs>
                              <linearGradient id="lifeCurve" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#5fb8a5" />
                                <stop offset="45%" stopColor="#c9a84c" />
                                <stop offset="75%" stopColor="#8fa6b3" />
                                <stop offset="100%" stopColor="#44556e" />
                              </linearGradient>
                            </defs>
                            <rect
                              x={seasonScale.scale(seasonRanges.spring[0])}
                              y="20"
                              width={
                                seasonScale.scale(seasonRanges.spring[1]) -
                                seasonScale.scale(seasonRanges.spring[0])
                              }
                              height="120"
                              className="season-block spring"
                            />
                            <rect
                              x={seasonScale.scale(seasonRanges.summer[0])}
                              y="20"
                              width={
                                seasonScale.scale(seasonRanges.summer[1]) -
                                seasonScale.scale(seasonRanges.summer[0])
                              }
                              height="120"
                              className="season-block summer"
                            />
                            <rect
                              x={seasonScale.scale(seasonRanges.autumn[0])}
                              y="20"
                              width={
                                seasonScale.scale(seasonRanges.autumn[1]) -
                                seasonScale.scale(seasonRanges.autumn[0])
                              }
                              height="120"
                              className="season-block autumn"
                            />
                            <rect
                              x={seasonScale.scale(seasonRanges.winter[0])}
                              y="20"
                              width={
                                seasonScale.scale(seasonRanges.winter[1]) -
                                seasonScale.scale(seasonRanges.winter[0])
                              }
                              height="120"
                              className="season-block winter"
                            />
                            <path
                              d="M20,120 C80,40 140,40 180,70 C220,100 260,120 340,130"
                              fill="none"
                              stroke="url(#lifeCurve)"
                              strokeWidth="4"
                            />
                            {typeof currentAgeX === 'number' ? (
                              <line
                                x1={currentAgeX}
                                y1="20"
                                x2={currentAgeX}
                                y2="140"
                                className="age-line"
                              />
                            ) : null}
                            <text x={seasonLabelX.spring} y="145" className="season-label">
                              {seasonLabelText.spring}
                            </text>
                            <text x={seasonLabelX.summer} y="145" className="season-label">
                              {seasonLabelText.summer}
                            </text>
                            <text x={seasonLabelX.autumn} y="145" className="season-label">
                              {seasonLabelText.autumn}
                            </text>
                            <text x={seasonLabelX.winter} y="145" className="season-label">
                              {seasonLabelText.winter}
                            </text>
                          </svg>
                        </div>
                        <p className="season-note">
                          {chartCopy.seasonNow}: {chartData.lifeSeason || '-'} / {chartCopy.ageNow}:{' '}
                          {currentAge ?? '-'}
                        </p>
                        <p className="season-note">{chartCopy.seasonMeaning}</p>
                      </article>

                      <article className="chart-card">
                        <h5>{chartCopy.tenGods}</h5>
                        <div className="ten-gods-grid">
                          <p>
                            <strong>비겁(比劫)</strong>: 자아, 주도성, 경쟁/협력 방식
                          </p>
                          <p>
                            <strong>식상(食傷)</strong>: 표현력, 실행력, 결과물 생산 방식
                          </p>
                          <p>
                            <strong>재성(財星)</strong>: 자원 운영, 실리 판단, 재무 태도
                          </p>
                          <p>
                            <strong>관성(官星)</strong>: 책임감, 규범 수용, 조직 적응력
                          </p>
                          <p>
                            <strong>인성(印星)</strong>: 학습력, 보호 본능, 회복/내면 안정
                          </p>
                        </div>
                      </article>
                    </div>
                  </div>
                ) : null}

                {renderedMarkdown ? (
                  <div
                    className="report-markdown markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                  />
                ) : (
                  <pre className="report-markdown">{markdown || report}</pre>
                )}
              </section>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  )
}

export default App
