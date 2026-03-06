import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5179;
const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error("Missing OPENAI_API_KEY. Set it before running the server.");
  process.exit(1);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, "public", urlPath);

  if (!filePath.startsWith(path.join(__dirname, "public"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === ".html"
        ? "text/html"
        : ext === ".js"
          ? "text/javascript"
          : ext === ".css"
            ? "text/css"
            : "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/stream") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) req.destroy();
    });

    req.on("end", async () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }

      const birthInfo = String(payload.birthInfo || "").trim();
      const location = String(payload.location || "").trim();
      const model = String(payload.model || "gpt-5.2").trim();
      const effort = String(payload.effort || "medium").trim();

      if (!birthInfo || !location) {
        sendJson(res, 400, { error: "birthInfo and location are required" });
        return;
      }

      const input = [
        {
          role: "developer",
          content:
            "당신은 사주분석 전문가입니다.\n" +
            "사용자의 사주를 기반으로 아래 보고서를 작성해주세요.\n" +
            "보고서에는 아래 내용을 포함해 주세요.\n" +
            "출력 형식(마크다운):\n" +
            "1) 종합운 요약 (불릿 4~6개)\n" +
            "2) 2026년 운세: 일운/재물운/관운/관계운\n" +
            "3) 2026년 월별 운세: 1월~12월 (각 월 1~2개 불릿)\n" +
            "4) 실천 팁 5개\n" +
            "5) 사주 성향 기반 추정 MBTI 및 간단 설명\n" +
            "6) 사주에 맞는 골프 스타일 해석 + 보완점 3개 (단, 구체적인 훈련법은 제외)",
        },
        { role: "user", content: birthInfo },
        { role: "user", content: location },
      ];

      try {
        const upstream = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            reasoning: { effort },
            input,
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text();
          sendJson(res, upstream.status, { error: text || "Upstream error" });
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }

        res.end();
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    });

    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Preview server running at http://localhost:${PORT}`);
});
