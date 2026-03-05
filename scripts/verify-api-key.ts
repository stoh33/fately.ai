import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

// .dev.vars 파일에서 키 읽기
const devVars = fs.readFileSync('.dev.vars', 'utf8');
const apiKeyMatch = devVars.match(/GEMINI_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

if (!apiKey) {
  console.error('.dev.vars 파일에서 GEMINI_API_KEY를 찾을 수 없습니다.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testGeminiSDK() {
  try {
    const modelName = 'gemini-2.0-flash';
    console.log(`SDK를 사용하여 ${modelName} 모델 호출 테스트 시작...`);
    
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = '안녕? 너는 누구니? 한 문장으로 대답해줘.';
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('--- SDK 응답 성공 ---');
    console.log('내용:', text);
  } catch (error) {
    console.error('--- SDK 호출 실패 ---');
    console.error(error);
  }
}

testGeminiSDK();
