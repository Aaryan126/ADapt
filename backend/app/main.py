import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, intake, markets_router, strategy, generate, pipeline, direct_edit, publish

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ad-gen")
logger.setLevel(logging.INFO)

app = FastAPI(
    title="Ad Localization Engine",
    description="Localize ads for Southeast Asian markets using AI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(intake.router, prefix="/api/v1", tags=["Intake"])
app.include_router(markets_router.router, prefix="/api/v1", tags=["Markets"])
app.include_router(strategy.router, prefix="/api/v1", tags=["Strategy"])
app.include_router(generate.router, prefix="/api/v1", tags=["Generate"])
app.include_router(pipeline.router, prefix="/api/v1", tags=["Pipeline"])
app.include_router(direct_edit.router, prefix="/api/v1", tags=["Direct Edit"])
app.include_router(publish.router, prefix="/api/v1", tags=["Publish"])
