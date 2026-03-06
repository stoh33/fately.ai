import { Solar, Lunar } from 'lunar-typescript'

export type CalendarType = 'solar' | 'lunar'

export type SajuInput = {
  birthDate: string
  birthTime?: string | null
  birthHourBranch?: string | null
  timeUnknown: boolean
  calendarType: CalendarType
  timezone: string
}

type ElementKey = '목' | '화' | '토' | '금' | '수'

export type PillarValue = {
  stem: string
  stemHanja: string
  stemElement: ElementKey
  branch: string
  branchHanja: string
  branchElement: ElementKey
  symbol: string
  hideGan: Array<{ hanja: string; hangul: string; element: ElementKey }>
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

const ELEMENT_SYMBOL: Record<ElementKey, string> = {
  목: '성장·확장',
  화: '표현·열정',
  토: '안정·중재',
  금: '원칙·결단',
  수: '지혜·유연',
}

const STEM_HANJA_TO_HANGUL: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', 
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'
}

const BRANCH_HANJA_TO_HANGUL: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
  '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
}

const STEM_ELEMENT: Record<string, ElementKey> = {
  갑: '목', 을: '목', 병: '화', 정: '화', 무: '토', 기: '토', 경: '금', 신: '금', 임: '수', 계: '수',
}

const BRANCH_ELEMENT: Record<string, ElementKey> = {
  '子': '수', '丑': '토', '寅': '목', '卯': '목', '辰': '토', '巳': '화',
  '午': '화', '未': '토', '申': '금', '酉': '금', '戌': '토', '亥': '수'
}

// 간지 시간을 숫자로 매핑 (대표 시간값)
const BRANCH_TO_TIME: Record<string, string> = {
  '자': '00:00', '축': '02:00', '인': '04:00', '묘': '06:00', '진': '08:00', '사': '10:00',
  '오': '12:00', '미': '14:00', '신': '16:00', '유': '18:00', '술': '20:00', '해': '22:00'
}

export const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function parseBirthDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function parseBirthTime(value: string | null) {
  if (!value) return { hour: 12, minute: 0 }
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) return { hour: 12, minute: 0 }
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  }
}

function getPillarValue(gan: string, zhi: string, hideGanList: string[]): PillarValue {
  const stem = STEM_HANJA_TO_HANGUL[gan]
  const branch = BRANCH_HANJA_TO_HANGUL[zhi]
  const stemElement = STEM_ELEMENT[stem]
  const branchElement = BRANCH_ELEMENT[zhi]
  
  const hideGan = hideGanList.map(hGan => {
    const hHangul = STEM_HANJA_TO_HANGUL[hGan]
    return {
      hanja: hGan,
      hangul: hHangul,
      element: STEM_ELEMENT[hHangul]
    }
  })

  return {
    stem,
    stemHanja: gan,
    stemElement,
    branch,
    branchHanja: zhi,
    branchElement,
    symbol: ELEMENT_SYMBOL[stemElement],
    hideGan
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

  // birthTime이 없고 birthHourBranch(자,축,인..)만 있는 경우 시간 숫자로 변환
  let timeStr = input.birthTime
  if (!timeStr && input.birthHourBranch && BRANCH_TO_TIME[input.birthHourBranch]) {
    timeStr = BRANCH_TO_TIME[input.birthHourBranch]
  }

  let solar: Solar
  if (input.calendarType === 'lunar') {
    const lunar = Lunar.fromYmd(dateParts.year, dateParts.month, dateParts.day)
    solar = lunar.getSolar()
  } else {
    const time = parseBirthTime(timeStr || null)
    // Apply 30 minute offset for Korea (UTC+9 is 30 mins ahead of solar time at 127.5 longitude)
    let hour = time.hour
    let minute = time.minute - 30
    if (minute < 0) {
      minute += 60
      hour -= 1
    }
    solar = Solar.fromYmdHms(dateParts.year, dateParts.month, dateParts.day, hour, minute, 0)
  }

  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  const yearPillar = getPillarValue(eightChar.getYearGan(), eightChar.getYearZhi(), eightChar.getYearHideGan())
  const monthPillar = getPillarValue(eightChar.getMonthGan(), eightChar.getMonthZhi(), eightChar.getMonthHideGan())
  const dayPillar = getPillarValue(eightChar.getDayGan(), eightChar.getDayZhi(), eightChar.getDayHideGan())
  
  let hourPillar: SajuComputation['hour']
  if (input.timeUnknown) {
    hourPillar = { unknown: true, label: '미상' }
  } else {
    const hGan = eightChar.getTimeGan()
    const hZhi = eightChar.getTimeZhi()
    const p = getPillarValue(hGan, hZhi, eightChar.getTimeHideGan())
    hourPillar = {
      ...p,
      timeBranchLabel: `${p.branch}시`,
    }
  }

  const elementCount: Record<ElementKey, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }
  
  const addPillarElements = (gan: string, zhi: string) => {
    const stem = STEM_HANJA_TO_HANGUL[gan]
    const branch = BRANCH_HANJA_TO_HANGUL[zhi]
    elementCount[STEM_ELEMENT[stem]] += 1
    elementCount[BRANCH_ELEMENT[zhi]] += 1
  }

  addPillarElements(eightChar.getYearGan(), eightChar.getYearZhi())
  addPillarElements(eightChar.getMonthGan(), eightChar.getMonthZhi())
  addPillarElements(eightChar.getDayGan(), eightChar.getDayZhi())
  if (!('unknown' in hourPillar)) {
    addPillarElements(eightChar.getTimeGan(), eightChar.getTimeZhi())
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
    adjustedBirthDate: `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}`,
    calendarAssumptionNote: input.calendarType === 'lunar' ? '음력은 양력으로 변환 후 계산되었습니다.' : undefined,
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
  const lunar = Lunar.fromYmd(year, 1, 1)
  return lunar.getYearInGanZhi()
}
