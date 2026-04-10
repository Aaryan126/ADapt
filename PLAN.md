# ADapt - Implementation Plan

## Status: All Phases Complete

## Phases

### Phase 1: Project Setup [DONE]
- [x] Project structure, .env, .gitignore, CLAUDE.md, README, requirements.txt
- [x] FastAPI skeleton with health check
- [x] GMI Cloud client service with retry logic
- [x] Config module with model assignments
- [x] Verified GMI API connectivity

### Phase 2: Ad Intake (Step 1) [DONE]
- [x] POST /api/v1/intake/text - text ad passthrough
- [x] POST /api/v1/intake/image - image upload with GPT-5.4 vision analysis
- [x] Pydantic models for AdInfo

### Phase 3: Market Selection + Custom Instructions (Steps 2-3) [DONE]
- [x] 6 market presets (SG, TH, MY, ID, CN, PH) with cultural context
- [x] GET /api/v1/markets - list and get market presets
- [x] CustomInstructions model (tone, language mix, audience, platform, notes)

### Phase 4: Strategy Generation (Step 4) [DONE]
- [x] POST /api/v1/strategy - localization strategy via GLM-5.1
- [x] Structured output: keep/change/cultural adaptations/language decisions

### Phase 5: Output Generation (Step 5) [DONE]
- [x] POST /api/v1/generate - localized copies + image brief + image
- [x] Localized ad copy in primary + secondary languages (native script enforced)
- [x] Image direction brief with composition preservation
- [x] Image generation via Gemini 3.1 Flash (queue-based API)
- [x] Download and save images locally to /output

### Phase 6: Frontend + Full Pipeline [DONE]
- [x] POST /api/v1/pipeline/run - orchestrates all steps
- [x] React + Vite frontend with dark theme
- [x] Two modes: Creative Localization and Direct Edit
- [x] Input vs Output comparison view
- [x] Results display (strategy, copies, image brief, generated image)

### Phase 7: Direct Edit [DONE]
- [x] POST /api/v1/direct-edit/run - image-to-image editing
- [x] Gemini 3.1 Flash with contents multi-turn format for image input
- [x] Simplified UI: image upload + edit instructions

### Phase 8: TikTok Publishing [DONE]
- [x] POST /api/v1/publish/tiktok - publish via Publer API
- [x] Media upload (PNG to JPEG conversion for TikTok compatibility)
- [x] Privacy/disclosure settings for TikTok compliance
- [x] Post link returned in UI after publishing

## Model Configuration
- Image Analysis (Step 1): `openai/gpt-5.4` (via chat completions API)
- Strategy + Copywriting (Steps 4-5): `zai-org/GLM-5.1-FP8` (via chat completions API)
- Image Generation + Direct Edit (Step 5): `gemini-3.1-flash-image-preview` (via queue API)

## Architecture
- Backend: Python 3.11+ / FastAPI at localhost:8000
- Frontend: React + Vite at localhost:5173
- GMI Cloud LLM API: api.gmi-serving.com/v1 (OpenAI-compatible)
- GMI Cloud Queue API: console.gmicloud.ai/api/v1/ie/requestqueue/apikey (async image gen)
- Publer API: app.publer.com/api/v1 (TikTok publishing)
