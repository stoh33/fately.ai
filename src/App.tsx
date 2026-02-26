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

function App() {
  return (
    <div className="app">
      <main className="layout">
        <section className="hero">
          <h1>AI기반 사주보기</h1>
        </section>

        <section className="card">
          <header className="card-header">
            <h2>기본 정보</h2>
            <p>태어난 순간의 기운을 정확히 담아주세요.</p>
          </header>

          <form className="form">
            <div className="form-grid date-grid">
              <label className="field">
                <span>생년</span>
                <select name="birthYear" defaultValue="">
                  <option value="" disabled>
                    연도 선택
                  </option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>월</span>
                <select name="birthMonth" defaultValue="">
                  <option value="" disabled>
                    월 선택
                  </option>
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {month}월
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>일</span>
                <select name="birthDay" defaultValue="">
                  <option value="" disabled>
                    일 선택
                  </option>
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}일
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid time-place-grid">
              <label className="field">
                <span>시</span>
                <select name="birthHour" defaultValue="">
                  <option value="" disabled>
                    시간 선택
                  </option>
                  {hours.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>태어난 지역</span>
                <input
                  type="text"
                  name="birthplace"
                  placeholder="예: 부산, 대한민국"
                />
              </label>
            </div>

            <div className="inline-group">
              <label className="field">
                <span>성별</span>
                <select name="gender" defaultValue="">
                  <option value="" disabled>
                    성별 선택
                  </option>
                  <option value="female">여성</option>
                  <option value="male">남성</option>
                  <option value="other">기타</option>
                </select>
              </label>

              <label className="field">
                <span>혈액형</span>
                <select name="bloodType" defaultValue="">
                  <option value="" disabled>
                    혈액형 선택
                  </option>
                  <option value="A">A형</option>
                  <option value="B">B형</option>
                  <option value="O">O형</option>
                  <option value="AB">AB형</option>
                </select>
              </label>
            </div>

            <div className="actions">
              <button type="submit" className="primary">
                사주 보기
              </button>
              <button type="button" className="ghost">
                다시 입력
              </button>
            </div>

            <p className="helper">
              입력한 정보는 사주 해석 목적 외에는 사용되지 않습니다.
            </p>
          </form>
        </section>
      </main>
    </div>
  )
}

export default App
