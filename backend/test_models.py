from app.models.database_models import (
    Organisation,
    Guideline,
    BrandRule
)

print("Database models loaded successfully!")

print("Organisation:", Organisation.__tablename__)
print("Guideline:", Guideline.__tablename__)
print("BrandRule:", BrandRule.__tablename__)