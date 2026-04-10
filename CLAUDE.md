# Ad Localization Engine - Coding Guidelines

## Project Overview
A pipeline that takes ads (text or image), localizes them for Southeast Asian markets using GMI Cloud AI models, and produces localized copy + visuals.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, httpx (async HTTP), Pydantic
- **Frontend**: React + Vite (minimal, not the focus)
- **AI Provider**: GMI Cloud (OpenAI-compatible API at api.gmi-serving.com)

## Project Structure
```
ad-gen/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── config.py        # Settings from .env
│   │   ├── models.py        # Pydantic schemas
│   │   ├── routers/         # API route modules
│   │   ├── services/        # Business logic (GMI client, pipeline steps)
│   │   └── data/            # Market presets JSON
│   └── requirements.txt
├── frontend/                # React + Vite app
├── output/                  # Generated outputs (gitignored)
├── .env                     # API keys (gitignored)
└── PLAN.md                  # Implementation plan
```

## Coding Practices
- Use async/await for all HTTP calls to GMI Cloud
- Type all function signatures with Python type hints
- Use Pydantic models for all request/response schemas
- Keep each pipeline step as its own service function
- Store model names in config so they can be swapped easily
- Return structured JSON from all endpoints
- Handle GMI API errors gracefully with clear error messages
- No unnecessary abstractions; keep it straightforward

## API Design
- All endpoints under `/api/v1/`
- Use POST for pipeline operations
- Accept multipart/form-data for image uploads
- Return JSON with consistent structure: `{"status": "ok", "data": {...}}`

## Testing
- Test each pipeline step independently via its endpoint
- Use `curl` or the Swagger UI at `/docs` for quick testing
