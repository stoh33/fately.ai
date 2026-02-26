# CLI Streaming Preview

Minimal CLI preview for OpenAI Responses API streaming.

## Setup

```bash
cd preview_cli
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configure

```bash
export OPENAI_API_KEY="YOUR_API_KEY"
```

## Run

```bash
python preview_stream.py
```

You should see the model output streaming live in your terminal.

## Save Output To File

```bash
export OUTPUT_PATH="output.txt"
python preview_stream.py
```

## Print Final Output Again

The script prints the streamed text live, then prints the full output again at the end
under a `Final output:` header.
