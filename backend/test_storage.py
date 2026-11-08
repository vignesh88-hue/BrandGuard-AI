from app.database.connection import SessionLocal

from app.models.database_models import Organisation

from app.services.guideline_storage import store_guidelines


db = SessionLocal()

try:

    # Find or create demo organisation
    organisation = db.query(Organisation).filter_by(
        name="NeuralForge Demo Organisation"
    ).first()

    if not organisation:

        organisation = Organisation(
            name="NeuralForge Demo Organisation"
        )

        db.add(organisation)
        db.commit()
        db.refresh(organisation)

    print("Organisation ready:", organisation.name)

    # Sample extracted rules
    sample_rules = [
        {
            "category": "Brand Voice",
            "rule": "Use professional and approachable language.",
            "severity": "medium",
            "check_type": "semantic",
            "enabled": True
        },
        {
            "category": "Call to Action",
            "rule": "Every post must include a clear CTA.",
            "severity": "medium",
            "check_type": "semantic",
            "enabled": True
        }
    ]

    # Store guideline and rules
    guideline = store_guidelines(
        db=db,
        filename="test_brand_guidelines.pdf",
        extracted_text="Sample brand guidelines for testing.",
        structured_rules=sample_rules,
        organisation_id=organisation.id
    )

    print("\nGuideline saved successfully!")
    print("Guideline ID:", guideline.id)
    print("Rules saved:", len(sample_rules))


except Exception as error:

    print("Database operation failed:", error)

finally:

    db.close()