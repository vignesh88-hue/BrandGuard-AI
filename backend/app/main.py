from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.guideline_retrieval import router as retrieval_router
from app.api.review import router as review_router
from app.api.video_review import router as video_review_router
app = FastAPI(
    title="BrandGuard AI",
    description="AI-powered Brand Governance Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    "http://127.0.0.1:5173"],  # Restrict before deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "project": "BrandGuard AI",
        "status": "Running",
        "message": "Welcome to BrandGuard AI API"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "BrandGuard Backend"
    }

from app.api.guidelines import router as guidelines_router

app.include_router(guidelines_router)
app.include_router(retrieval_router)
app.include_router(review_router)
app.include_router(video_review_router)