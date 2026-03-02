import KoreanLunarCalendar from 'korean-lunar-calendar'

export type CalendarType = 'solar' | 'lunar'

export type SajuInput = {
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  calendarType: CalendarType
  timezone: string
}

type ElementKey = '목' | '화' | '토' | '금' | '수'

export type PillarValue = {
  stem: string
  stemHanja: string
  branch: string
  branchHanja: string
  element: ElementKey
  symbol: string
}

export type SajuComputation = {
  adjustedBirthDate: string
  calendarAssumptionNote?: string
  year: PillarValue
  month: PillarValue
  day: PillarValue
  hour:
    | (PillarValue & {
        timeBranchLabel: string
      })
    | {
        unknown: true
        label: '미상'
      }
  fiveElements: Record<ElementKey, { count: number; strength: '강함' | '중간' | '약함' | '부족' }>
  yongsinSuggestion: ElementKey
  gisinSuggestion: ElementKey
}

const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const
const STEMS_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const
const BRANCHES_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

const STEM_ELEMENT: Record<string, ElementKey> = {
  갑: '목',
  을: '목',
  병: '화',
  정: '화',
  무: '토',
  기: '토',
  경: '금',
  신: '금',
  임: '수',
  계: '수',
}

const BRANCH_ELEMENT: Record<string, ElementKey> = {
  자: '수',
  축: '토',
  인: '목',
  묘: '목',
  진: '토',
  사: '화',
  오: '화',
  미: '토',
  신: '금',
  유: '금',
  술: '토',
  해: '수',
}

const ELEMENT_SYMBOL: Record<ElementKey, string> = {
  목: '성장·확장',
  화: '표현·열정',
  토: '안정·중재',
  금: '원칙·결단',
  수: '지혜·유연',
}

const MONTH_BRANCH_BY_GREGORIAN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]

function pad(value: number) {
  return String(value).padStart(2, '0')
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

function parseBirthTime(value: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function mod(num: number, m: number) {
  return ((num % m) + m) % m
}

function asPillar(stemIndex: number, branchIndex: number): PillarValue {
  const stem = STEMS[mod(stemIndex, 10)]
  const branch = BRANCHES[mod(branchIndex, 12)]
  const element = STEM_ELEMENT[stem]
  return {
    stem,
    stemHanja: STEMS_HANJA[mod(stemIndex, 10)],
    branch,
    branchHanja: BRANCHES_HANJA[mod(branchIndex, 12)],
    element,
    symbol: ELEMENT_SYMBOL[element],
  }
}

function getYearPillar(year: number, month: number, day: number) {
  const adjustedYear = month < 2 || (month === 2 && day < 4) ? year - 1 : year
  return asPillar(adjustedYear - 4, adjustedYear - 4)
}

function getMonthPillar(yearStemIndex: number, month: number) {
  const monthBranchIndex = MONTH_BRANCH_BY_GREGORIAN[month - 1]
  const firstMonthStem = mod((yearStemIndex % 5) * 2 + 2, 10) // 寅월 기준
  const offsetFromYin = mod(monthBranchIndex - 2, 12)
  return asPillar(firstMonthStem + offsetFromYin, monthBranchIndex)
}

function getDayPillar(year: number, month: number, day: number) {
  // 기준일: 1984-02-02를 갑자일로 두는 근사 계산
  const base = Date.UTC(1984, 1, 2)
  const target = Date.UTC(year, month - 1, day)
  const diffDays = Math.floor((target - base) / 86400000)
  return asPillar(diffDays, diffDays)
}

function getHourBranchIndex(hour: number) {
  return Math.floor(((hour + 1) % 24) / 2)
}

function getHourPillar(dayStemIndex: number, hour: number) {
  const hourBranchIndex = getHourBranchIndex(hour)
  const firstHourStem = mod((dayStemIndex % 5) * 2, 10)
  const stemIndex = mod(firstHourStem + hourBranchIndex, 10)
  return {
    ...asPillar(stemIndex, hourBranchIndex),
    timeBranchLabel: `${BRANCHES[hourBranchIndex]}시`,
  }
}

function classifyStrength(count: number, total: number): '강함' | '중간' | '약함' | '부족' {
  const ratio = total > 0 ? count / total : 0
  if (ratio >= 0.3) return '강함'
  if (ratio >= 0.22) return '중간'
  if (ratio >= 0.14) return '약함'
  return '부족'
}

export function computeSaju(input: SajuInput): SajuComputation {
  const dateParts = parseBirthDate(input.birthDate)
  if (!dateParts) {
    throw new Error('Invalid birthDate format. Use YYYY-MM-DD.')
  }

  const timeParts = parseBirthTime(input.birthTime)
  if (!input.timeUnknown && !timeParts) {
    throw new Error('Invalid birthTime format. Use HH:mm or set timeUnknown=true.')
  }

  let calendarAssumptionNote: string | undefined
  let workingDate = {
    year: dateParts.year,
    month: dateParts.month,
    day: dateParts.day,
  }

  if (input.calendarType === 'lunar') {
    const calendar = new KoreanLunarCalendar()
    const conversionOk = calendar.setLunarDate(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      false,
    )
    if (!conversionOk) {
      throw new Error('음력 날짜를 양력으로 변환하지 못했습니다. 입력값을 확인해주세요.')
    }
    const solar = calendar.getSolarCalendar()
    workingDate = {
      year: solar.year,
      month: solar.month,
      day: solar.day,
    }
    calendarAssumptionNote =
      '음력은 양력으로 변환 후 계산되었습니다. 윤달 여부 입력은 지원하지 않아 일반월(false) 기준으로 처리합니다.'
  }

  const yearPillar = getYearPillar(workingDate.year, workingDate.month, workingDate.day)
  const yearStemIndex = STEMS.indexOf(yearPillar.stem as (typeof STEMS)[number])
  const monthPillar = getMonthPillar(yearStemIndex, workingDate.month)
  const dayPillar = getDayPillar(workingDate.year, workingDate.month, workingDate.day)
  const dayStemIndex = STEMS.indexOf(dayPillar.stem as (typeof STEMS)[number])

  const hourPillar = input.timeUnknown
    ? { unknown: true as const, label: '미상' as const }
    : getHourPillar(dayStemIndex, timeParts!.hour)

  const elementCount: Record<ElementKey, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }
  const addPillarElement = (pillar: PillarValue) => {
    elementCount[STEM_ELEMENT[pillar.stem]] += 1
    elementCount[BRANCH_ELEMENT[pillar.branch]] += 1
  }
  addPillarElement(yearPillar)
  addPillarElement(monthPillar)
  addPillarElement(dayPillar)
  if (!('unknown' in hourPillar)) {
    addPillarElement(hourPillar)
  }

  const totalElementTokens = Object.values(elementCount).reduce((sum, value) => sum + value, 0)
  const fiveElements = {
    목: { count: elementCount.목, strength: classifyStrength(elementCount.목, totalElementTokens) },
    화: { count: elementCount.화, strength: classifyStrength(elementCount.화, totalElementTokens) },
    토: { count: elementCount.토, strength: classifyStrength(elementCount.토, totalElementTokens) },
    금: { count: elementCount.금, strength: classifyStrength(elementCount.금, totalElementTokens) },
    수: { count: elementCount.수, strength: classifyStrength(elementCount.수, totalElementTokens) },
  }

  const sortedElements = (Object.keys(elementCount) as ElementKey[]).sort(
    (a, b) => elementCount[a] - elementCount[b],
  )

  return {
    adjustedBirthDate: `${workingDate.year}-${pad(workingDate.month)}-${pad(workingDate.day)}`,
    calendarAssumptionNote,
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    fiveElements,
    yongsinSuggestion: sortedElements[0],
    gisinSuggestion: sortedElements[sortedElements.length - 1],
  }
}

export function getSexagenaryYear(year: number) {
  const pillar = asPillar(year - 4, year - 4)
  return `${pillar.stem}${pillar.branch}`
}
