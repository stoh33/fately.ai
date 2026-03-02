import os

from openai import OpenAI

client = OpenAI()

output_path = os.getenv("OUTPUT_PATH", "").strip()
output_file = open(output_path, "w", encoding="utf-8") if output_path else None
buffer = []

stream = client.responses.create(
    model="gpt-5.2",
    reasoning={"effort": "medium"},
    input=[
        {
            "role": "developer",
            "content": (
                "당신은 사주분석 전문가입니다.\n"
                "사용자의 사주를 기반으로 아래 보고서를 작성해주세요.\n"
                "보고서에는 아래 내용을 포함해 주세요.\n"
                "출력 형식(마크다운):\n"
                "1) 종합운 요약 (불릿 4~6개)\n"
                "2) 2026년 운세: 일운/재물운/관운/관계운\n"
                "3) 2026년 월별 운세: 1월~12월 (각 월 1~2개 불릿)\n"
                "4) 실천 팁 5개\n"
                "5) 사주에 맞는 골프 스타일 해석 + 보완점 3개"
            ),
        },
        {"role": "user", "content": "1976년 5월 25일 17:00~19:00에 태어난 남자야."},
        {"role": "user", "content": "경상북도 포항이야."},
    ],
    stream=True,
)

for event in stream:
    if event.type == "response.output_text.delta":
        chunk = event.delta
        print(chunk, end="", flush=True)
        if output_file:
            output_file.write(chunk)
        buffer.append(chunk)

if output_file:
    output_file.close()

if buffer:
    full_text = "".join(buffer).strip()
    if full_text:
        print("\n\n---\nFinal output:\n")
        print(full_text)
