#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.tmp/saju-calc-check"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

cd "$ROOT_DIR"
npx tsc functions/lib/saju-calculator.ts \
  --module ESNext \
  --target ES2022 \
  --moduleResolution bundler \
  --skipLibCheck \
  --types node \
  --outDir "$TMP_DIR" >/dev/null

TMP_DIR="$TMP_DIR" node --input-type=module <<'NODE'
const moduleUrl = `file://${process.env.TMP_DIR}/saju-calculator.js`
const { computeSaju } = await import(moduleUrl)

const cases = [
  { birthDate: '1990-03-15', birthTime: '11:20', timeUnknown: false, calendarType: 'solar', timezone: 'Asia/Seoul' },
  { birthDate: '1988-12-01', birthTime: null, timeUnknown: true, calendarType: 'solar', timezone: 'Asia/Seoul' },
  { birthDate: '2001-07-21', birthTime: '23:40', timeUnknown: false, calendarType: 'lunar', timezone: 'Asia/Seoul' },
]

for (const item of cases) {
  const result = computeSaju(item)
  if (!result.year?.stem || !result.month?.branch || !result.day?.stem) {
    throw new Error(`Invalid pillar result for ${item.birthDate}`)
  }
  if (!result.fiveElements || Object.keys(result.fiveElements).length !== 5) {
    throw new Error(`Invalid five elements result for ${item.birthDate}`)
  }
}

console.log('saju calculator smoke test passed (3 cases).')
NODE
