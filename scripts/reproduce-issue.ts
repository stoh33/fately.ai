import { Solar, Lunar } from 'lunar-typescript'

function testSaju(dateStr: string, timeStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)

  // 현재 로직 재현 (30분 차감)
  let h = hour
  let m = minute - 30
  if (m < 0) {
    m += 60
    h -= 1
  }

  const solar = Solar.fromYmdHms(year, month, day, h, m, 0)
  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  console.log(`Input: ${dateStr} ${timeStr}`)
  console.log(`Adjusted Solar: ${solar.toFullString()}`)
  console.log(`Lunar: ${lunar.toFullString()}`)
  console.log(`Year: ${eightChar.getYearGan()}${eightChar.getYearZhi()}`)
  console.log(`Month: ${eightChar.getMonthGan()}${eightChar.getMonthZhi()}`)
  console.log(`Day: ${eightChar.getDayGan()}${eightChar.getDayZhi()}`)
  console.log(`Time: ${eightChar.getTimeGan()}${eightChar.getTimeZhi()}`)
}

console.log('--- 1976-06-22 12:00 Test ---')
testSaju('1976-06-22', '12:00')
