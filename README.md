# ADapt

An AI-powered pipeline that localizes advertisements for Southeast Asian and Chinese markets (Singapore, Thailand, Malaysia, Indonesia, China, Philippines).

## What It Does

### Creative Localization (Full Pipeline)
1. **Ad Intake** - Accept an ad as text or image. Images are analyzed by a vision model to extract product, headline, body copy, CTA, and brand cues.
2. **Market Selection** - Pick a target market with built-in cultural presets (languages, festivals, values, taboos, humor style).
3. **Custom Instructions** - Optionally override tone, language mix, audience segment, platform, or give specific directives.
4. **Strategy Generation** - AI generates a localization strategy with cultural adaptations and language decisions.
5. **Output Generation** - Produces localized ad copy (in native languages), an image direction brief, and a generated localized ad image.

### Direct Edit
Upload an ad image and describe specific changes (e.g. "replace Coca-Cola with Pokka Green Tea"). The AI edits the image while preserving the original composition.

### TikTok Publishing
After generating or editing an ad, publish it directly to TikTok via the Publer integration.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI
- **Frontend**: React + Vite
- **AI Models**: GMI Cloud inference API
  - `openai/gpt-5.4` - image analysis (Step 1)
  - `zai-org/GLM-5.1-FP8` - strategy and copywriting (Steps 4-5)
  - `gemini-3.1-flash-image-preview` - image generation and direct editing (Step 5)
- **Publishing**: Publer API (TikTok)

## Quick Start

```bash
# 1. Clone and setup
cd ad-gen
cp .env.example .env
# Edit .env with your API keys (see below)

# 2. Install backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Run backend
uvicorn app.main:app --reload --port 8000

# 4. Install and run frontend (separate terminal)
cd frontend
npm install
npm run dev

# 5. Open the app
open http://localhost:5173
```

## Environment Variables

```
GMI_API_KEY=           # GMI Cloud API key (required)
GMI_BASE_URL=          # Default: https://api.gmi-serving.com/v1

PUBLER_API_KEY=        # Publer API key (for TikTok posting)
PUBLER_WORKSPACE_ID=   # Publer workspace ID
PUBLER_TIKTOK_ACCOUNT_ID=  # Publer TikTok account ID
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/models` | List available GMI models |
| POST | `/api/v1/intake/text` | Submit text ad |
| POST | `/api/v1/intake/image` | Upload image ad |
| GET | `/api/v1/markets` | List market presets |
| GET | `/api/v1/markets/{code}` | Get specific market preset |
| POST | `/api/v1/strategy` | Generate localization strategy |
| POST | `/api/v1/generate` | Generate localized outputs |
| POST | `/api/v1/pipeline/run` | Run full creative pipeline |
| POST | `/api/v1/direct-edit/run` | Direct image edit |
| POST | `/api/v1/publish/tiktok` | Publish to TikTok |

## Supported Markets

| Code | Market | Primary Language |
|------|--------|-----------------|
| SG | Singapore | English |
| TH | Thailand | Thai |
| MY | Malaysia | Bahasa Malaysia |
| ID | Indonesia | Bahasa Indonesia |
| CN | China | Mandarin Chinese |
| PH | Philippines | Filipino (Tagalog) |
