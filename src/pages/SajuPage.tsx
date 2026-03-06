import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import '../styles/saju-page.css'

type FocusType = 'career' | 'wealth' | 'relationship' | 'health' | 'general'
type BloodType = 'A' | 'B' | 'O' | 'AB' | 'unknown'
type ZodiacSign =
  | 'auto'
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
type GolfExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'unknown'
type GolfGoal = 'distance' | 'accuracy' | 'consistency' | 'mental' | 'score' | 'unknown'

type ElementKey = '목' | '화' | '토' | '금' | '수'

type HideGanItem = { hanja: string; hangul: string; element: ElementKey }

type PillarValue = {
  stem: string
  stemHanja: string
  stemElement: ElementKey
  branch: string
  branchHanja: string
  branchElement: ElementKey
  symbol: string
  hideGan: HideGanItem[]
}

type FourPillars = {
  year: PillarValue
  month: PillarValue
  day: PillarValue
  hour: PillarValue | { unknown: true; label: string }
}

type ReportResponse = {
  reportMarkdown?: string
  meta?: {
    fourPillars?: FourPillars
    fiveElements?: Record<string, { count?: number; strength?: string }>
    generatedAt?: string
  }
  error?: string
  detail?: string
}

const STORAGE_KEY = 'sajuReport:last'
type FiveElementsMeta = Record<ElementKey, { count: number; strength: string }>

function normalizeFiveElements(
  raw: Record<string, { count?: number; strength?: string }> | undefined,
): FiveElementsMeta | null {
  if (!raw) return null
  const keys: ElementKey[] = ['목', '화', '토', '금', '수']
  const result = {} as FiveElementsMeta
  for (const key of keys) {
    const item = raw[key]
    if (!item || typeof item.count !== 'number' || typeof item.strength !== 'string') {
      return null
    }
    result[key] = { count: item.count, strength: item.strength }
  }
  return result
}

const getElementClass = (element: string) => {
  switch (element) {
    case '목': return 'wood'
    case '화': return 'fire'
    case '토': return 'earth'
    case '금': return 'metal'
    case '수': return 'water'
    default: return ''
  }
}

function HanjaSpan({ hanja, element }: { hanja: string; element: string }) {
  const colorClass = getElementClass(element)
  return <span className={`hanja-styled ${colorClass}`}>{hanja}</span>
}

function SajuWongukTable({ fourPillars, lang }: { fourPillars: FourPillars; lang: 'ko' | 'en' }) {
  const pillars = [
    { label: lang === 'ko' ? '시주' : 'Hour', value: fourPillars.hour },
    { label: lang === 'ko' ? '일주' : 'Day', value: fourPillars.day },
    { label: lang === 'ko' ? '월주' : 'Month', value: fourPillars.month },
    { label: lang === 'ko' ? '년주' : 'Year', value: fourPillars.year },
  ]

  return (
    <div className="saju-wonguk-container">
      <h3>{lang === 'ko' ? '1. 사주원국 (四柱元局)' : '1. Four Pillars Grid'}</h3>
      <table className="saju-wonguk-table">
        <thead>
          <tr>
            {pillars.map((p) => (
              <th key={p.label}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {pillars.map((p, i) => {
              if ('unknown' in p.value) {
                return <td key={i} rowSpan={2} className="unknown-cell">{p.value.label}</td>
              }
              return (
                <td key={i} className={`bg-${getElementClass(p.value.stemElement)}`}>
                  <div className="saju-wonguk-cell">
                    <span className="saju-hanja">{p.value.stemHanja}</span>
                    <span className="saju-hangul">{p.value.stem}</span>
                  </div>
                </td>
              )
            })}
          </tr>
          <tr>
            {pillars.map((p, i) => {
              if ('unknown' in p.value) return null
              return (
                <td key={i} className={`bg-${getElementClass(p.value.branchElement)}`}>
                  <div className="saju-wonguk-cell">
                    <span className="saju-hanja">{p.value.branchHanja}</span>
                    <span className="saju-hangul">{p.value.branch}</span>
                  </div>
                </td>
              )
            })}
          </tr>
          <tr>
            {pillars.map((p, i) => {
              if ('unknown' in p.value) return <td key={i} className="unknown-cell">-</td>
              return (
                <td key={i}>
                  <div className="saju-hide-gan-list">
                    {p.value.hideGan.map((hg, idx) => (
                      <HanjaSpan key={idx} hanja={hg.hanja} element={hg.element} />
                    ))}
                  </div>
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function SajuPage() {
  const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const [clientName, setClientName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('11:20')
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [timezone, setTimezone] = useState('Asia/Seoul')
  const [focus, setFocus] = useState<FocusType>('general')
  const [notes, setNotes] = useState('')
  const [bloodType, setBloodType] = useState<BloodType>('unknown')
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign>('auto')
  const [golfExperienceLevel, setGolfExperienceLevel] =
    useState<GolfExperienceLevel>('unknown')
  const [golfGoal, setGolfGoal] = useState<GolfGoal>('score')
  const [golfPainOrLimits, setGolfPainOrLimits] = useState('')
  const [golfNotes, setGolfNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportMarkdown, setReportMarkdown] = useState('')
  const [fiveElements, setFiveElements] = useState<FiveElementsMeta | null>(null)
  const [fourPillars, setFourPillars] = useState<FourPillars | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (!cached) return
    try {
      const parsed = JSON.parse(cached) as {
        reportMarkdown?: string
        fiveElements?: Record<string, { count?: number; strength?: string }>
        fourPillars?: FourPillars
      }
      if (parsed.reportMarkdown) {
        setReportMarkdown(parsed.reportMarkdown)
      }
      setFiveElements(normalizeFiveElements(parsed.fiveElements))
      if (parsed.fourPillars) {
        setFourPillars(parsed.fourPillars)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const birthTimeValue = useMemo(() => (timeUnknown ? null : birthTime), [timeUnknown, birthTime])

  const renderedMarkdown = useMemo(() => {
    if (!reportMarkdown) return ''
    const html = marked.parse(reportMarkdown) as string
    return DOMPurify.sanitize(html)
  }, [reportMarkdown])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setCopied(false)

    try {
      const response = await fetch('/api/saju-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lang,
          clientName,
          birthDate,
          birthTime: birthTimeValue,
          timeUnknown,
          calendarType,
          gender,
          timezone,
          focus,
          notes,
          bloodType,
          zodiacSign,
          golfExperienceLevel,
          golfGoal,
          golfPainOrLimits,
          golfNotes,
        }),
      })

      const raw = await response.text()
      let data: ReportResponse = {}
      if (raw) {
        try {
          data = JSON.parse(raw) as ReportResponse
        } catch {
          data = { error: raw.slice(0, 400) }
        }
      }

      if (!response.ok || !data.reportMarkdown) {
        throw new Error(
          data.error ||
            data.detail ||
            `리포트 생성에 실패했습니다. (status: ${response.status})`,
        )
      }

      setReportMarkdown(data.reportMarkdown)
      const normalizedFiveElements = normalizeFiveElements(data.meta?.fiveElements)
      setFiveElements(normalizedFiveElements)
      if (data.meta?.fourPillars) {
        setFourPillars(data.meta.fourPillars)
      }
      
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          reportMarkdown: data.reportMarkdown,
          fiveElements: normalizedFiveElements,
          fourPillars: data.meta?.fourPillars,
          savedAt: new Date().toISOString(),
        }),
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '요청 실패')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!reportMarkdown) return
    await navigator.clipboard.writeText(reportMarkdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="saju-page">
      <main className="saju-wrap">
        <section className="saju-header">
          <div className="lang-toggle" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={lang === 'ko' ? 'active' : ''}
              onClick={() => setLang('ko')}
            >
              한국어
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              English
            </button>
          </div>
          <h1>{lang === 'ko' ? '사주 리포트 생성' : 'Generate Saju Report'}</h1>
          <p>{lang === 'ko' ? '사주팔자(四柱八字) 종합 분석 보고서를 생성합니다.' : 'Comprehensive analysis based on Four Pillars of Destiny.'}</p>
        </section>

        <section className="saju-card">
          <form className="saju-form" onSubmit={handleSubmit}>
            <label>
              <span>{lang === 'ko' ? '이름' : 'Name'}</span>
              <input
                type="text"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder={lang === 'ko' ? "예: 김민준" : "e.g. John Doe"}
                required
              />
            </label>

            <label>
              <span>{lang === 'ko' ? '생년월일' : 'Birth Date'}</span>
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                required
              />
            </label>

            <label>
              <span>{lang === 'ko' ? '출생시간' : 'Birth Time'}</span>
              <input
                type="time"
                value={birthTime}
                onChange={(event) => setBirthTime(event.target.value)}
                disabled={timeUnknown}
                required={!timeUnknown}
              />
            </label>

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(event) => setTimeUnknown(event.target.checked)}
              />
              <span>{lang === 'ko' ? '시간 모름 (시주 미상 처리)' : 'Unknown Time'}</span>
            </label>

            <label>
              <span>{lang === 'ko' ? '달력 종류' : 'Calendar'}</span>
              <select
                value={calendarType}
                onChange={(event) => setCalendarType(event.target.value as 'solar' | 'lunar')}
              >
                <option value="solar">{lang === 'ko' ? '양력' : 'Solar'}</option>
                <option value="lunar">{lang === 'ko' ? '음력' : 'Lunar'}</option>
              </select>
            </label>

            <label>
              <span>{lang === 'ko' ? '성별' : 'Gender'}</span>
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value as 'male' | 'female' | 'other')}
              >
                <option value="male">{lang === 'ko' ? '남성' : 'Male'}</option>
                <option value="female">{lang === 'ko' ? '여성' : 'Female'}</option>
                <option value="other">{lang === 'ko' ? '기타' : 'Other'}</option>
              </select>
            </label>

            <label>
              <span>{lang === 'ko' ? '시간대' : 'Timezone'}</span>
              <input
                type="text"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                required
              />
            </label>

            <label>
              <span>{lang === 'ko' ? '중점 분석' : 'Focus'}</span>
              <select
                value={focus}
                onChange={(event) => setFocus(event.target.value as FocusType)}
              >
                <option value="general">{lang === 'ko' ? '종합' : 'General'}</option>
                <option value="career">{lang === 'ko' ? '커리어' : 'Career'}</option>
                <option value="wealth">{lang === 'ko' ? '재물' : 'Wealth'}</option>
                <option value="relationship">{lang === 'ko' ? '대인관계' : 'Relationship'}</option>
                <option value="health">{lang === 'ko' ? '건강' : 'Health'}</option>
              </select>
            </label>

            <label>
              <span>{lang === 'ko' ? '혈액형' : 'Blood Type'}</span>
              <select
                value={bloodType}
                onChange={(event) => setBloodType(event.target.value as BloodType)}
              >
                <option value="unknown">{lang === 'ko' ? '모름' : 'Unknown'}</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="O">O</option>
                <option value="AB">AB</option>
              </select>
            </label>

            <label>
              <span>{lang === 'ko' ? '별자리(서양)' : 'Zodiac Sign'}</span>
              <select
                value={zodiacSign}
                onChange={(event) => setZodiacSign(event.target.value as ZodiacSign)}
              >
                <option value="auto">{lang === 'ko' ? '자동 산출' : 'Auto'}</option>
                <option value="Aries">Aries</option>
                <option value="Taurus">Taurus</option>
                <option value="Gemini">Gemini</option>
                <option value="Cancer">Cancer</option>
                <option value="Leo">Leo</option>
                <option value="Virgo">Virgo</option>
                <option value="Libra">Libra</option>
                <option value="Scorpio">Scorpio</option>
                <option value="Sagittarius">Sagittarius</option>
                <option value="Capricorn">Capricorn</option>
                <option value="Aquarius">Aquarius</option>
                <option value="Pisces">Pisces</option>
              </select>
            </label>

            <label>
              <span>{lang === 'ko' ? '골프 숙련도' : 'Golf Level'}</span>
              <select
                value={golfExperienceLevel}
                onChange={(event) =>
                  setGolfExperienceLevel(event.target.value as GolfExperienceLevel)
                }
              >
                <option value="unknown">{lang === 'ko' ? '모름' : 'Unknown'}</option>
                <option value="beginner">{lang === 'ko' ? '초급' : 'Beginner'}</option>
                <option value="intermediate">{lang === 'ko' ? '중급' : 'Intermediate'}</option>
                <option value="advanced">{lang === 'ko' ? '상급' : 'Advanced'}</option>
              </select>
            </label>

            <label>
              <span>{lang === 'ko' ? '골프 목표' : 'Golf Goal'}</span>
              <select
                value={golfGoal}
                onChange={(event) => setGolfGoal(event.target.value as GolfGoal)}
              >
                <option value="score">{lang === 'ko' ? '스코어' : 'Score'}</option>
                <option value="distance">{lang === 'ko' ? '비거리' : 'Distance'}</option>
                <option value="accuracy">{lang === 'ko' ? '정확도' : 'Accuracy'}</option>
                <option value="consistency">{lang === 'ko' ? '일관성' : 'Consistency'}</option>
                <option value="mental">{lang === 'ko' ? '멘탈' : 'Mental'}</option>
                <option value="unknown">{lang === 'ko' ? '모름' : 'Unknown'}</option>
              </select>
            </label>

            <label className="full">
              <span>{lang === 'ko' ? '추가 메모 / 질문' : 'Notes / Questions'}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={lang === 'ko' ? "예: 2026년 커리어 전환 시기와 주의점" : "e.g. Career changes in 2026"}
                rows={4}
              />
            </label>

            <label className="full">
              <span>{lang === 'ko' ? '골프 통증/제한(선택)' : 'Golf Pain/Limits (Optional)'}</span>
              <input
                type="text"
                value={golfPainOrLimits}
                onChange={(event) => setGolfPainOrLimits(event.target.value)}
                placeholder={lang === 'ko' ? "예: 허리 피로, 손목 뻐근함" : "e.g. Back pain"}
              />
            </label>

            <label className="full">
              <span>{lang === 'ko' ? '골프 메모(선택)' : 'Golf Notes (Optional)'}</span>
              <textarea
                value={golfNotes}
                onChange={(event) => setGolfNotes(event.target.value)}
                placeholder={lang === 'ko' ? "예: 미스 패턴 slice, 선호 클럽 7I, 평균 95타" : "e.g. slice miss, average score 95"}
                rows={3}
              />
            </label>

            <div className="actions">
              <button type="submit" disabled={isLoading}>
                {isLoading ? (lang === 'ko' ? '생성 중...' : 'Generating...') : (lang === 'ko' ? '사주 리포트 생성' : 'Generate Report')}
              </button>
              <button type="button" className="ghost" onClick={handleCopy} disabled={!reportMarkdown}>
                {copied ? (lang === 'ko' ? '복사됨' : 'Copied') : (lang === 'ko' ? '복사' : 'Copy')}
              </button>
            </div>
          </form>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="report-panel">
          <h2>{lang === 'ko' ? '사주 분석 리포트' : 'Analysis Report'}</h2>
          
          <div className="report-content">
            {fourPillars ? <SajuWongukTable fourPillars={fourPillars} lang={lang} /> : null}

            {fiveElements ? (
              <div className="elements-bar" aria-label="오행 분포 색상 요약">
                {(
                  [
                    ['목', 'wood'],
                    ['화', 'fire'],
                    ['토', 'earth'],
                    ['금', 'metal'],
                    ['수', 'water'],
                  ] as Array<[ElementKey, string]>
                ).map(([key, klass]) => (
                  <div key={key} className={`element-chip ${klass}`}>
                    <strong>{key}</strong>
                    <span>
                      {fiveElements[key].count} / {fiveElements[key].strength}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {renderedMarkdown ? (
              <div 
                className="markdown-body" 
                dangerouslySetInnerHTML={{ __html: renderedMarkdown }} 
              />
            ) : (
              <p className="no-report">{lang === 'ko' ? '아직 생성된 리포트가 없습니다.' : 'No report generated yet.'}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
