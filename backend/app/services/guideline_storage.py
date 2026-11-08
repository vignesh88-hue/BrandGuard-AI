from sqlalchemy.orm import Session

from app.models.database_models import (
    Organisation,
    Guideline,
    BrandRule
)


def store_guidelines(
    db,
    filename,
    extracted_text,
    structured_rules,
    organisation_id
):

    try:
        # 1. Save guideline document
        guideline = Guideline(
            organisation_id=organisation_id,
            filename=filename,
            extracted_text=extracted_text
        )

        db.add(guideline)
        db.flush()

        # 2. Save individual brand rules
        for item in structured_rules:

            rule = BrandRule(
                guideline_id=guideline.id,
                rule_number=item.get("rule_number"),
                category=item["category"],
                rule=item["rule"],
                severity=item["severity"],
                check_type=item["check_type"],
                enabled=item["enabled"]
            )

            db.add(rule)

        db.commit()
        db.refresh(guideline)

        return guideline

    except Exception:
        db.rollback()
        raise