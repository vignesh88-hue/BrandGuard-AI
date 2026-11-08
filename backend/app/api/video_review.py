import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.models.database_models import (
    Guideline,
    BrandRule,
    ContentReview
)

from app.services.video_processor import (
    process_video,
    get_video_metadata
)

from app.services.audio_analyzer import analyze_audio
from app.services.speech_analyzer import analyze_speech
from app.services.video_analyzer import analyze_video_content


router = APIRouter(
    prefix="/review",
    tags=["Video Brand Review"]
)

MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_VIDEO_DURATION = 60             # 60 seconds


@router.post("/video/{guideline_id}")
def review_video(
    guideline_id: UUID,
    file: UploadFile = File(...),
    caption: str = Form(default="", max_length=20000),
    db: Session = Depends(get_db)
):

    # 1. Validate guideline
    guideline = db.query(Guideline).filter(
        Guideline.id == guideline_id
    ).first()

    if not guideline:
        raise HTTPException(
            status_code=404,
            detail="Guideline not found."
        )

    # 2. Retrieve enabled rules in original PDF order
    rules = db.query(BrandRule).filter(
        BrandRule.guideline_id == guideline_id,
        BrandRule.enabled.is_(True)
    ).order_by(
        BrandRule.rule_number.asc()
    ).all()

    if not rules:
        raise HTTPException(
            status_code=422,
            detail="No active brand rules found."
        )

    rules_data = [
        {
            "rule_number": rule.rule_number,
            "category": rule.category,
            "rule": rule.rule,
            "severity": rule.severity,
            "check_type": rule.check_type
        }
        for rule in rules
    ]

    # 3. Validate file type
    original_filename = Path(
        file.filename or "uploaded_video.mp4"
    ).name

    if Path(original_filename).suffix.lower() != ".mp4":
        raise HTTPException(
            status_code=415,
            detail="Only MP4 videos are supported."
        )

    try:

        with tempfile.TemporaryDirectory(
            prefix="brandguard_video_"
        ) as temp_directory:

            temp_path = Path(temp_directory)

            video_path = temp_path / "upload.mp4"
            output_dir = temp_path / "processed"

            # 4. Save upload with size validation
            total_size = 0

            with video_path.open("wb") as destination:

                while True:

                    chunk = file.file.read(1024 * 1024)

                    if not chunk:
                        break

                    total_size += len(chunk)

                    if total_size > MAX_VIDEO_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail="Video exceeds the 100 MB limit."
                        )

                    destination.write(chunk)

            if total_size == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded video is empty."
                )

            # 5. Validate video metadata and duration
            metadata = get_video_metadata(str(video_path))

            if metadata["duration"] > MAX_VIDEO_DURATION:
                raise HTTPException(
                    status_code=413,
                    detail="Maximum video duration is 60 seconds."
                )

            # 6. Extract video frames and audio
            video_data = process_video(
                video_path=str(video_path),
                output_dir=str(output_dir),
                max_frames=12
            )

            # 7. Analyse audio and speech
            audio_report = None
            speech_report = None

            if video_data["audio_path"]:

                audio_report = analyze_audio(
                    video_data["audio_path"]
                )

                speech_report = analyze_speech(
                    video_data["audio_path"]
                )

            transcript = (
                speech_report["transcription"]
                if speech_report
                else ""
            )

            if len(transcript) > 20000:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Extracted transcript exceeds "
                        "the 20,000 character limit."
                    )
                )

            # 8. Gemini multimodal video analysis
            analysis = analyze_video_content(
                transcript=transcript,
                frame_paths=video_data["frames"],
                rules=rules_data,
                caption=caption
            )

            result = analysis["review"]

            # 9. Incorporate speech transcription uncertainty
            speech_requires_review = (
                speech_report is not None
                and speech_report.get(
                    "requires_human_review", False
                )
            )

            if speech_requires_review:

                # Mark Rule 12 for human verification.
                # The speech recognizer has identified uncertain words.
                for rule_result in result["rule_results"]:

                    if rule_result["rule_number"] == 12:

                        rule_result["status"] = "not_verifiable"

                        rule_result["evidence"] += (
                            " Speech recognition contains uncertain "
                            "segments. Names and facts require human "
                            "verification before a final decision."
                        )

                # Remove Rule 12 violations because uncertain
                # transcription alone is not sufficient proof.
                result["violations"] = [
                    violation
                    for violation in result["violations"]
                    if violation.get("rule_number") != 12
                ]

                # Recalculate compliance score using remaining
                # confirmed violations.
                severity_penalties = {
                    "critical": 40,
                    "high": 30,
                    "medium": 20,
                    "low": 10
                }

                deducted_rules = set()
                total_deduction = 0

                for violation in result["violations"]:

                    rule_number = violation["rule_number"]

                    if rule_number in deducted_rules:
                        continue

                    deducted_rules.add(rule_number)

                    severity = violation.get(
                        "severity", "medium"
                    ).lower()

                    total_deduction += severity_penalties.get(
                        severity, 20
                    )

                result["compliance_score"] = max(
                    0, 100 - total_deduction
                )

                result["overall_status"] = "needs_review"

                result["summary"] += (
                    " Speech transcription contains uncertain "
                    "segments. Human verification of names and "
                    "transcript accuracy is required."
                )

            # 10. Prepare media report for database
            media_report = {
                "media_type": "video",
                "filename": original_filename,
                "caption": caption,
                "metadata": metadata,
                "frames_analyzed": analysis["frames_analyzed"],
                "analysis_type": analysis["analysis_type"],
                "audio": audio_report,
                "speech": speech_report,
                "warnings": []
            }

            if not video_data["audio_extracted"]:
                media_report["warnings"].append(
                    "No audio track was extracted."
                )

            if not transcript:
                media_report["warnings"].append(
                    "No speech transcription was detected."
                )

            # 11. Save review in Supabase
            submitted_content = (
                f"[Video: {original_filename}]\n\n"
                f"Transcript:\n"
                f"{transcript or '[No speech detected]'}"
            )

            review_record = ContentReview(
                guideline_id=guideline.id,
                submitted_content=submitted_content,
                compliance_score=result["compliance_score"],
                overall_status=result["overall_status"],
                summary=result["summary"],
                violations=result["violations"],
                corrected_content=result["corrected_content"],
                media_analysis=media_report,
                approval_status="pending"
            )

            db.add(review_record)
            db.commit()
            db.refresh(review_record)

            # 12. Return API response
            return {
                "status": "success",
                "review_id": str(review_record.id),
                "approval_status": review_record.approval_status,
                "guideline": {
                    "id": str(guideline.id),
                    "filename": guideline.filename
                },
                "review": result,
                "media_analysis": media_report
            }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Video review failed: {str(e)}"
        )

    finally:
        file.file.close()