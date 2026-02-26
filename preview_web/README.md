# Web Streaming Preview

Minimal web preview (browser UI + local Node server) for OpenAI Responses API streaming.

## Setup

```bash
cd preview_web
```

Set your API key:

```bash
export OPENAI_API_KEY="YOUR_API_KEY"
```

Run the server:

```bash
node server.js
```

Open:

```
http://localhost:5179
```

## Notes

- The browser never sees your API key. Requests are proxied by the local server.
- The UI sends `birthInfo` and `location` to `/api/stream` and renders `response.output_text.delta` events.
- You can edit `model` and `reasoning.effort` in the UI before starting.
