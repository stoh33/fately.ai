import { useEffect, useMemo, useState } from 'react'
import '../styles/saju-page.css'

type FocusType = 'career' | 'wealth' | 'relationship' | 'health' | 'general'
type BloodType = 'A' | 'B' | 'O' | 'AB' | 'unknown'
type AiProvider = 'openai' | 'gemini'
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

type ReportResponse = {
  reportMarkdown?: string
  meta?: {
    fourPillars?: Record<string, unknown>
    fiveElements?: Record<string, { count?: number; strength?: string }>
    generatedAt?: string
  }
  error?: string
  detail?: string
}

const STORAGE_KEY = 'sajuReport:last'
type ElementKey = '목' | '화' | '토' | '금' | '수'
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

export default function SajuPage() {
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
  const [copied, setCopied] = useState(false)
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini')

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (!cached) return
    try {
      const parsed = JSON.parse(cached) as {
        reportMarkdown?: string
        fiveElements?: Record<string, { count?: number; strength?: string }>
      }
      if (parsed.reportMarkdown) {
        setReportMarkdown(parsed.reportMarkdown)
      }
      setFiveElements(normalizeFiveElements(parsed.fiveElements))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const birthTimeValue = useMemo(() => (timeUnknown ? null : birthTime), [timeUnknown, birthTime])

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
          aiProvider,
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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          reportMarkdown: data.reportMarkdown,
          fiveElements: normalizedFiveElements,
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
          <h1>사주 리포트 생성</h1>
          <p>사주팔자(四柱八字) 종합 분석 보고서를 생성합니다.</p>
        </section>

        <section className="saju-card">
          <form className="saju-form" onSubmit={handleSubmit}>
            <label>
              <span>이름</span>
              <input
                type="text"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="예: 김민준"
                required
              />
            </label>

            <label className="ai-provider-label">
              <span>AI 엔진 선택 (추천: Gemini)</span>
              <select
                value={aiProvider}
                onChange={(event) => setAiProvider(event.target.value as AiProvider)}
                style={{ border: '2px solid #95693e', fontWeight: 'bold' }}
              >
                <option value="gemini">Google Gemini (속도·최신)</option>
                <option value="openai">OpenAI ChatGPT (안정성)</option>
              </select>
            </label>

            <label>
              <span>생년월일</span>
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                required
              />
            </label>

            <label>
              <span>출생시간</span>
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
              <span>시간 모름 (시주 미상 처리)</span>
            </label>

            <label>
              <span>달력 종류</span>
              <select
                value={calendarType}
                onChange={(event) => setCalendarType(event.target.value as 'solar' | 'lunar')}
              >
                <option value="solar">양력</option>
                <option value="lunar">음력</option>
              </select>
            </label>

            <label>
              <span>성별</span>
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value as 'male' | 'female' | 'other')}
              >
                <option value="male">남성</option>
                <option value="female">여성</option>
                <option value="other">기타</option>
              </select>
            </label>

            <label>
              <span>시간대</span>
              <input
                type="text"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                required
              />
            </label>

            <label>
              <span>중점 분석</span>
              <select
                value={focus}
                onChange={(event) => setFocus(event.target.value as FocusType)}
              >
                <option value="general">종합</option>
                <option value="career">커리어</option>
                <option value="wealth">재물</option>
                <option value="relationship">대인관계</option>
                <option value="health">건강</option>
              </select>
            </label>

            <label>
              <span>혈액형</span>
              <select
                value={bloodType}
                onChange={(event) => setBloodType(event.target.value as BloodType)}
              >
                <option value="unknown">모름</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="O">O</option>
                <option value="AB">AB</option>
              </select>
            </label>

            <label>
              <span>별자리(서양)</span>
              <select
                value={zodiacSign}
                onChange={(event) => setZodiacSign(event.target.value as ZodiacSign)}
              >
                <option value="auto">자동 산출</option>
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
              <span>골프 숙련도</span>
              <select
                value={golfExperienceLevel}
                onChange={(event) =>
                  setGolfExperienceLevel(event.target.value as GolfExperienceLevel)
                }
              >
                <option value="unknown">모름</option>
                <option value="beginner">초급</option>
                <option value="intermediate">중급</option>
                <option value="advanced">상급</option>
              </select>
            </label>

            <label>
              <span>골프 목표</span>
              <select
                value={golfGoal}
                onChange={(event) => setGolfGoal(event.target.value as GolfGoal)}
              >
                <option value="score">스코어</option>
                <option value="distance">비거리</option>
                <option value="accuracy">정확도</option>
                <option value="consistency">일관성</option>
                <option value="mental">멘탈</option>
                <option value="unknown">모름</option>
              </select>
            </label>

            <label className="full">
              <span>추가 메모 / 질문</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="예: 2026년 커리어 전환 시기와 주의점"
                rows={4}
              />
            </label>

            <label className="full">
              <span>골프 통증/제한(선택)</span>
              <input
                type="text"
                value={golfPainOrLimits}
                onChange={(event) => setGolfPainOrLimits(event.target.value)}
                placeholder="예: 허리 피로, 손목 뻐근함"
              />
            </label>

            <label className="full">
              <span>골프 메모(선택)</span>
              <textarea
                value={golfNotes}
                onChange={(event) => setGolfNotes(event.target.value)}
                placeholder="예: 미스 패턴 slice, 선호 클럽 7I, 평균 95타"
                rows={3}
              />
            </label>

            <div className="actions">
              <button type="submit" disabled={isLoading}>
                {isLoading ? '생성 중...' : '사주 리포트 생성'}
              </button>
              <button type="button" className="ghost" onClick={handleCopy} disabled={!reportMarkdown}>
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
          </form>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="report-panel">
          <h2>리포트 미리보기</h2>
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
          <pre>{reportMarkdown || '아직 생성된 리포트가 없습니다.'}</pre>
        </section>
      </main>
    </div>
  )
}
