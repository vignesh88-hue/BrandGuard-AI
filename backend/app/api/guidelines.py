import os
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.services.document_processor import extract_text_from_pdf
from app.services.guideline_parser import parse_guidelines
from app.services.guideline_storage import store_guidelines

from app.database.connection import get_db
from app.models.database_models import Organisation, BrandRule


router = APIRouter(
    prefix="/guidelines",
    tags=["Brand Guidelines"]
)


@router.post("/upload")
async def upload_guidelines(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    temp_path = None

    try:

        # 1. Read uploaded PDF
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF is empty."
            )

        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="PDF must be smaller than 10 MB."
            )

        # 2. Create temporary PDF
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".pdf"
        ) as temp_file:

            temp_file.write(content)
            temp_path = temp_file.name

        # 3. Extract PDF text
        extracted_text = extract_text_from_pdf(temp_path)

        if not extracted_text:
            raise HTTPException(
                status_code=422,
                detail="No readable text found. The PDF may require OCR."
            )

        # 4. Parse brand guidelines
        structured_rules = parse_guidelines(extracted_text)

        if not structured_rules:
            raise HTTPException(
                status_code=422,
                detail="No recognizable brand rules were found."
            )

        # 5. Find organisation
        organisation = db.query(Organisation).filter(
            Organisation.name == "NeuralForge Demo Organisation"
        ).first()

        if not organisation:

            organisation = Organisation(
                name="NeuralForge Demo Organisation"
            )

            db.add(organisation)
            db.commit()
            db.refresh(organisation)

        # 6. Save guideline and extracted rules
        guideline = store_guidelines(
            db=db,
            filename=file.filename,
            extracted_text=extracted_text,
            structured_rules=structured_rules,
            organisation_id=organisation.id
        )

        # 7. Retrieve saved rules
        saved_rules = db.query(BrandRule).filter(
            BrandRule.guideline_id == guideline.id
        ).all()

        return {
            "status": "success",
            "message": "Brand guidelines uploaded and saved successfully.",

            "organisation": organisation.name,

            "guideline": {
                "id": str(guideline.id),
                "filename": guideline.filename
            },

            "total_rules_extracted": len(structured_rules),
            "total_rules_saved": len(saved_rules),

            "rules": [
                {
                    "id": str(rule.id),
                    "rule_number": rule.rule_number,
                    "category": rule.category,
                    "rule": rule.rule,
                    "severity": rule.severity,
                    "check_type": rule.check_type,
                    "enabled": rule.enabled
                }
                for rule in saved_rules
            ]
        }

    except HTTPException:
        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Guideline processing failed: {str(e)}"
        )

    finally:

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

        await file.close()