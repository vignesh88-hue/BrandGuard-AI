from faster_whisper import WhisperModel
from pathlib import Path


# Load the model once instead of loading it for every request.
model = WhisperModel(
    "tiny",
    device="cpu",
    compute_type="int8"
)


def analyze_speech(audio_path: str) -> dict:
    """
    Transcribe speech using Faster Whisper.

    Preserve the original transcript and identify
    potentially uncertain transcription segments.
    """

    audio_path = Path(audio_path)

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Audio file not found: {audio_path}"
        )

    segments, info = model.transcribe(
        str(audio_path),
        beam_size=5,
        vad_filter=True,
        word_timestamps=True
    )

    transcription = []
    full_text = []
    uncertain_segments = []

    for segment in segments:

        text = segment.text.strip()

        if not text:
            continue

        # Extract confidence-related measurements.
        avg_logprob = float(segment.avg_logprob)
        no_speech_prob = float(segment.no_speech_prob)
        compression_ratio = float(segment.compression_ratio)

        # Identify potentially unreliable segments.
        uncertainty_reasons = []

        if avg_logprob < -0.8:
            uncertainty_reasons.append(
                "Low transcription confidence"
            )

        if no_speech_prob > 0.60:
            uncertainty_reasons.append(
                "High probability of non-speech audio"
            )

        if compression_ratio > 2.4:
            uncertainty_reasons.append(
                "Unusual transcription pattern"
            )

        # Preserve word-level timing and confidence.
        words = []

        for word in segment.words or []:

            word_probability = float(word.probability)

            words.append({
                "word": word.word,
                "start": round(word.start, 2),
                "end": round(word.end, 2),
                "confidence": round(word_probability, 4)
            })

            if word_probability < 0.55:
                uncertainty_reasons.append(
                    f"Uncertain word detected: {word.word.strip()}"
                )

        segment_data = {
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": text,
            "confidence": round(avg_logprob, 4),
            "no_speech_probability": round(no_speech_prob, 4),
            "compression_ratio": round(compression_ratio, 4),
            "words": words,
            "requires_review": bool(uncertainty_reasons),
            "uncertainty_reasons": list(set(uncertainty_reasons))
        }

        transcription.append(segment_data)
        full_text.append(text)

        if uncertainty_reasons:
            uncertain_segments.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": text,
                "reasons": list(set(uncertainty_reasons))
            })

    return {
        "audio_file": audio_path.name,
        "language": info.language,
        "language_probability": round(
            info.language_probability, 4
        ),
        "transcription": " ".join(full_text),
        "segments": transcription,
        "total_segments": len(transcription),

        # New uncertainty detection fields.
        "uncertain_segments": uncertain_segments,
        "uncertain_segment_count": len(uncertain_segments),
        "requires_human_review": bool(uncertain_segments)
    }