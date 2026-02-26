import { useMemo, useState } from 'react'
import './App.css'

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
    title: 'AI기반 사주보기',
    subtitle: '사주는 세상과 처음으로 연결된 순간의 시간 정보입니다.',
    sectionTitle: '기본 정보',
    sectionHelp: '태어난 순간의 기운을 정확히 담아주세요.',
    birthYear: '생년',
    birthMonth: '월',
    birthDay: '일',
    birthHour: '시',
    birthplace: '태어난 지역',
    gender: '성별',
    bloodType: '혈액형',
    selectYear: '연도 선택',
    selectMonth: '월 선택',
    selectDay: '일 선택',
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
    cta: '사주 보기',
    loading: '보고서 생성 중...',
    reset: '다시 입력',
    helper: '입력한 정보는 사주 해석 목적 외에는 사용되지 않습니다.',
    resultTitle: '사주 보고서',
    errorTitle: '요청 실패',
    langKo: '한국어',
    langEn: 'English',
  },
  en: {
    title: 'AI Fortune Reading',
    subtitle:
      'Saju is the time information of the moment you first connected with the world.',
    sectionTitle: 'Basic Details',
    sectionHelp: 'Please enter the exact birth moment.',
    birthYear: 'Year',
    birthMonth: 'Month',
    birthDay: 'Day',
    birthHour: 'Hour',
    birthplace: 'Birthplace',
    gender: 'Gender',
    bloodType: 'Blood Type',
    selectYear: 'Select year',
    selectMonth: 'Select month',
    selectDay: 'Select day',
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
    cta: 'View Saju',
    loading: 'Generating report...',
    reset: 'Reset',
    helper: 'Your information is used only for this reading.',
    resultTitle: 'Saju Report',
    errorTitle: 'Request failed',
    langKo: 'Korean',
    langEn: 'English',
  },
}

type ApiResponse = {
  report?: string
  error?: string
  detail?: string
}

function App() {
  const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const [isLoading, setIsLoading] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const t = useMemo(() => copy[lang], [lang])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setIsLoading(true)
    setError('')
    setReport('')

    try {
      const payload = {
        lang,
        birthYear: String(formData.get('birthYear') || ''),
        birthMonth: String(formData.get('birthMonth') || ''),
        birthDay: String(formData.get('birthDay') || ''),
        birthHour: String(formData.get('birthHour') || ''),
        birthplace: String(formData.get('birthplace') || ''),
        gender: String(formData.get('gender') || ''),
        bloodType: String(formData.get('bloodType') || ''),
      }

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
        </section>

        <section className="card">
          <header className="card-header">
            <h2>{t.sectionTitle}</h2>
            <p>{t.sectionHelp}</p>
          </header>

          <form className="form" onSubmit={handleSubmit}>
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

            <div className="actions">
              <button type="submit" className="primary" disabled={isLoading}>
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
                <pre>{report}</pre>
              </section>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  )
}

export default App
