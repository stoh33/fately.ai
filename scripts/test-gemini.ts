import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

// .dev.vars 또는 환경 변수에서 API 키 가져오기
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync('.dev.vars')) {
  const devVars = fs.readFileSync('.dev.vars', 'utf8');
  const apiKeyMatch = devVars.match(/GEMINI_API_KEY=(.*)/);
  apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;
}

if (!apiKey) {
  console.error('API 키를 찾을 수 없습니다. GEMINI_API_KEY 환경 변수 또는 .dev.vars 파일을 확인하세요.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  try {
    const modelName = 'gemini-2.0-flash'; 
    console.log(`${modelName} 모델로 테스트 호출 중...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = '사주 리포트 테스트를 위한 간단한 인사말을 한 문장으로 해줘.';
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('응답 성공!');
    console.log('내용:', text);
  } catch (error) {
    console.error('API 호출 실패 상세:');
    console.error(error);
  }
}

test();
