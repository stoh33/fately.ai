# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment Variables (Cloudflare Pages)

For production, set these in Cloudflare Pages:

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default: `gpt-5.2`)
- `OPENAI_REASONING_EFFORT` (optional: `none|low|medium|high|xhigh`)
- `ALLOWED_ORIGINS` (optional, comma-separated)

Never commit real API keys. A sample file is provided at `.env.example`.

## Saju Report Feature

This project includes a dedicated `/saju` page and Cloudflare Functions endpoint for generating a Korean Four Pillars report.

- Frontend page: `/saju`
- API endpoint: `POST /api/saju-report`
- Local calculator module: `functions/lib/saju-calculator.ts`

### Required Request Shape (`/api/saju-report`)

```json
{
  "clientName": "김민준",
  "birthDate": "1990-03-15",
  "birthTime": "11:20",
  "timeUnknown": false,
  "calendarType": "solar",
  "gender": "male",
  "timezone": "Asia/Seoul",
  "focus": "general",
  "notes": "직업 흐름 중심으로 보고 싶습니다."
}
```

### Response Shape

```json
{
  "reportMarkdown": "....full markdown report....",
  "meta": {
    "fourPillars": {
      "year": { "stem": "경", "branch": "오" },
      "month": { "stem": "기", "branch": "묘" },
      "day": { "stem": "을", "branch": "묘" },
      "hour": { "stem": "임", "branch": "오" }
    },
    "fiveElements": {
      "목": { "count": 2, "strength": "중간" },
      "화": { "count": 2, "strength": "중간" },
      "토": { "count": 2, "strength": "중간" },
      "금": { "count": 1, "strength": "약함" },
      "수": { "count": 1, "strength": "약함" }
    },
    "generatedAt": "2026-03-02T12:34:56.000Z"
  }
}
```

### Truncated Sample Report Output

```md
사주팔자 종합 분석 보고서 / 四柱八字 綜合 分析 報告書
의뢰인: 김민준
생년월일시: 1990-03-15 11:20 (양력)
담당 역술가: AI 명리 리포트

✦ ✦ ✦
✦ 제 1장  기본 사주 정보  ✦
✦ ✦ ✦

◆ 생년월일시 및 사주팔자
...
◆ 오행(五行) 분포 분석
▼ 오행 강약 분포
...
✦ 제 2장  성격 · 기질 · 적성 분석  ✦
...
✦ 제 3장  대운(大運) 및 세운(歲運) 분석  ✦
...
✦ 제 4장  건강 · 재물 · 대인관계  ✦
...
✦ 제 5장  종합 조언 및 개운법  ✦
...
사주는 운명 확정이 아닌 성향과 흐름 참고용입니다.
본 보고서는 의뢰인에게만 제공되며 외부 배포 없이 참고용으로 활용됩니다.
```

### Local Run

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open:
   - `http://localhost:5173/saju`

### Local Validation

- Build check: `npm run build`
- Saju calculator smoke test (3 dates): `bash scripts/verify-saju-calc.sh`

### Deploy Notes (Cloudflare Pages)

- Set `OPENAI_API_KEY` in Pages environment variables.
- Optional:
  - `OPENAI_MODEL` (default: `gpt-4.1-mini`)
  - `OPENAI_REASONING_EFFORT` (`low|medium|high`)
  - `ALLOWED_ORIGINS` (comma-separated)
- Cloudflare Pages auto-deploy will pick up:
  - `functions/api/saju-report.ts`
  - frontend route handling in `src/main.tsx` for `/saju`.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
