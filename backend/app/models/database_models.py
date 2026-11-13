import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    func
)

from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database.connection import Base


# =====================================
# 1. ORGANISATION MODEL
# =====================================

class Organisation(Base):

    __tablename__ = "organisations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    name = Column(
        String(255),
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# =====================================
# 2. GUIDELINE MODEL
# =====================================

class Guideline(Base):

    __tablename__ = "guidelines"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    organisation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE")
    )

    filename = Column(
        String(255),
        nullable=False
    )

    extracted_text = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# =====================================
# 3. BRAND RULE MODEL
# =====================================

class BrandRule(Base):

    __tablename__ = "brand_rules"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    guideline_id = Column(
        UUID(as_uuid=True),
        ForeignKey("guidelines.id", ondelete="CASCADE"),
        nullable=False
    )

    # Original rule number from the uploaded PDF
    rule_number = Column(
        Integer,
        nullable=True
    )

    category = Column(
        String(100),
        nullable=False
    )

    rule = Column(
        Text,
        nullable=False
    )

    severity = Column(
        String(20),
        default="medium"
    )

    check_type = Column(
        String(50)
    )

    enabled = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
# =====================================
# 4. CONTENT REVIEW MODEL
# =====================================

class ContentReview(Base):

    __tablename__ = "content_reviews"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    guideline_id = Column(
        UUID(as_uuid=True),
        ForeignKey("guidelines.id", ondelete="CASCADE"),
        nullable=False
    )

    submitted_content = Column(
        Text,
        nullable=False
    )

    compliance_score = Column(
        Integer,
        nullable=False
    )

    overall_status = Column(
        String(30),
        nullable=False
    )

    summary = Column(
        Text
    )

    violations = Column(
        JSONB,
        nullable=False,
        default=list
    )

    media_analysis = Column(
    JSONB,
    nullable=True
)

    corrected_content = Column(
        Text
    )

    ai_provider = Column(
        String(20),
        nullable=True
    )

    approval_status = Column(
        String(30),
        nullable=False,
        default="pending"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )


