from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.models.database_models import (
    Organisation,
    Guideline,
    BrandRule
)


router = APIRouter(tags=["Brand Knowledge Retrieval"])


# ==========================================
# 1. GET ALL GUIDELINES
# ==========================================

@router.get("/guidelines")
def get_guidelines(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):

    guidelines = (
        db.query(Guideline)
        .order_by(Guideline.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total_returned": len(guidelines),
        "guidelines": [
            {
                "id": str(item.id),
                "organisation_id": str(item.organisation_id),
                "filename": item.filename,
                "created_at": item.created_at
            }
            for item in guidelines
        ]
    }


# ==========================================
# 2. GET PARTICULAR GUIDELINE
# ==========================================

@router.get("/guidelines/{guideline_id}")
def get_guideline(
    guideline_id: UUID,
    db: Session = Depends(get_db)
):

    guideline = (
        db.query(Guideline)
        .filter(Guideline.id == guideline_id)
        .first()
    )

    if not guideline:
        raise HTTPException(
            status_code=404,
            detail="Guideline not found."
        )

    return {
        "id": str(guideline.id),
        "organisation_id": str(guideline.organisation_id),
        "filename": guideline.filename,
        "extracted_text": guideline.extracted_text,
        "created_at": guideline.created_at
    }


# ==========================================
# 3. GET RULES FOR A GUIDELINE
# ==========================================

@router.get("/guidelines/{guideline_id}/rules")
def get_guideline_rules(
    guideline_id: UUID,
    db: Session = Depends(get_db)
):

    guideline = (
        db.query(Guideline)
        .filter(Guideline.id == guideline_id)
        .first()
    )

    if not guideline:
        raise HTTPException(
            status_code=404,
            detail="Guideline not found."
        )

    rules = (
        db.query(BrandRule)
        .filter(BrandRule.guideline_id == guideline_id)
        .order_by(BrandRule.created_at.asc())
        .all()
    )

    return {
        "guideline_id": str(guideline_id),
        "filename": guideline.filename,
        "total_rules": len(rules),

        "rules": [
            {
                "id": str(rule.id),
                "category": rule.category,
                "rule": rule.rule,
                "severity": rule.severity,
                "check_type": rule.check_type,
                "enabled": rule.enabled
            }
            for rule in rules
        ]
    }


# ==========================================
# 4. GET ALL ORGANISATIONS
# ==========================================

@router.get("/organisations")
def get_organisations(
    db: Session = Depends(get_db)
):

    organisations = (
        db.query(Organisation)
        .order_by(Organisation.created_at.desc())
        .all()
    )

    return {
        "total_organisations": len(organisations),

        "organisations": [
            {
                "id": str(org.id),
                "name": org.name,
                "created_at": org.created_at
            }
            for org in organisations
        ]
    }