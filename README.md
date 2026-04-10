# Ad Localization Engine

An AI-powered pipeline that localizes advertisements for Southeast Asian markets (Singapore, Thailand, Malaysia, Indonesia, Vietnam, Philippines).

## What It Does

1. **Ad Intake** - Accept an ad as text or image. Images are analyzed by a vision model to extract product, headline, body copy, CTA, and brand cues.
2. **Market Selection** - Pick a target market with built-in cultural presets (languages, festivals, values, taboos, humor style).
3. **Custom Instructions** - Optionally override tone, language mix, audience segment, platform, etc.
4. **Strategy Generation** - AI generates a localization strategy with cultural adaptations and language decisions.
5. **Output Generation** - Produces localized ad copy, an image direction brief, and a generated localized ad image.

## Tech Stack

- **Backend**: Python, FastAPI
- **Frontend**: React + Vite (minimal)
- **AI Models**: GMI Cloud inference API

## Quick Start

```bash
# 1. Clone and setup
cd ad-gen
cp .env.example .env
# Edit .env with your GMI API key

# 2. Install backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Run backend
uvicorn app.main:app --reload --port 8000

# 4. Open API docs
open http://localhost:8000/docs
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/intake/text` | Submit text ad |
| POST | `/api/v1/intake/image` | Upload image ad |
| GET | `/api/v1/markets` | List market presets |
| POST | `/api/v1/strategy` | Generate localization strategy |
| POST | `/api/v1/generate` | Generate localized outputs |
| POST | `/api/v1/pipeline/run` | Run full pipeline |
