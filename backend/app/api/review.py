from uuid import UUID
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.database_models import (
    Guideline,
    BrandRule,
    ContentReview
)
from app.services.ai_analyzer import analyze_brand_content


router = APIRouter(
    prefix="/review",
    tags=["AI Brand Review"]
)


# =====================================
# REQUEST SCHEMAS
# =====================================

class ReviewRequest(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=20000
    )


class DecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]


# =====================================
# 1. ANALYSE CONTENT
# =====================================

@router.post("/{guideline_id}")
def review_content(
    guideline_id: UUID,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    guideline = db.query(Guideline).filter(
        Guideline.id == guideline_id
    ).first()

    if not guideline:
        raise HTTPException(
            status_code=404,
            detail="Guideline not found."
        )

    rules = db.query(BrandRule).filter(
        BrandRule.guideline_id == guideline_id,
        BrandRule.enabled.is_(True)
    ).all()

    if not rules:
        raise HTTPException(
            status_code=422,
            detail="No active brand rules found."
        )

    rules_data = [
        {
            "category": rule.category,
            "rule": rule.rule,
            "severity": rule.severity,
            "check_type": rule.check_type
        }
        for rule in rules
    ]

    try:
        result = analyze_brand_content(
            content=request.content,
            rules=rules_data
        )

        ai_provider = result.pop("_provider", "unknown")

        review_record = ContentReview(
        guideline_id=guideline.id,
        submitted_content=request.content,
        compliance_score=result["compliance_score"],
        overall_status=result["overall_status"],
        summary=result["summary"],
        violations=result["violations"],
        corrected_content=result["corrected_content"],
        ai_provider=ai_provider,
        approval_status="pending"
)

        db.add(review_record)
        db.commit()
        db.refresh(review_record)

        return {
            "status": "success",
            "review_id": str(review_record.id),
            "approval_status": review_record.approval_status,
            "ai_provider": review_record.ai_provider,
            "guideline": {
                "id": str(guideline.id),
                "filename": guideline.filename
            },
            "review": result
        }

    except RuntimeError as e:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=str(e)
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save content review: {str(e)}"
        )


# =====================================
# 2. GET REVIEW HISTORY
# =====================================

@router.get("/history")
def get_review_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    reviews = (
        db.query(ContentReview, Guideline.filename)
        .join(
            Guideline,
            ContentReview.guideline_id == Guideline.id
        )
        .order_by(ContentReview.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total = db.query(ContentReview).count()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "reviews": [
            {
                "review_id": str(review.id),
                "guideline_id": str(review.guideline_id),
                "guideline_filename": filename,
                "compliance_score": review.compliance_score,
                "overall_status": review.overall_status,
                "approval_status": review.approval_status,
                "ai_provider": review.ai_provider,
                "summary": review.summary,
                "created_at": review.created_at.isoformat(),
                "submitted_content": review.submitted_content
            }
            for review, filename in reviews
        ]
    }


# =====================================
# 3. GET COMPLETE REVIEW DETAILS
# =====================================

@router.get("/history/{review_id}")
def get_review_details(
    review_id: UUID,
    db: Session = Depends(get_db)
):
    record = (
        db.query(ContentReview, Guideline.filename)
        .join(
            Guideline,
            ContentReview.guideline_id == Guideline.id
        )
        .filter(ContentReview.id == review_id)
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Review not found."
        )

    review, filename = record

    return {
        "review_id": str(review.id),
        "guideline_id": str(review.guideline_id),
        "guideline_filename": filename,
        "submitted_content": review.submitted_content,
        "ai_provider": review.ai_provider,
        "compliance_score": review.compliance_score,
        "overall_status": review.overall_status,
        "approval_status": review.approval_status,
        "summary": review.summary,
        "violations": review.violations,
        "corrected_content": review.corrected_content,
        "created_at": review.created_at.isoformat()
    }


# =====================================
# 4. HUMAN APPROVAL / REJECTION
# =====================================

@router.patch("/history/{review_id}/decision")
def update_review_decision(
    review_id: UUID,
    request: DecisionRequest,
    db: Session = Depends(get_db)
):
    review = db.query(ContentReview).filter(
        ContentReview.id == review_id
    ).first()

    if not review:
        raise HTTPException(
            status_code=404,
            detail="Review not found."
        )

    if review.approval_status != "pending":
        raise HTTPException(
            status_code=409,
            detail="This review has already received a decision."
        )

    review.approval_status = request.decision

    db.commit()
    db.refresh(review)

    return {
        "status": "success",
        "message": f"Review {request.decision} successfully.",
        "review_id": str(review.id),
        "approval_status": review.approval_status
    }