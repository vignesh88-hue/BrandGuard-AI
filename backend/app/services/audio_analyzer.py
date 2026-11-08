import librosa
import numpy as np
from pathlib import Path


def analyze_audio(audio_path: str) -> dict:
    """
    Analyze extracted audio using Librosa.
    Returns objective audio quality measurements.
    """

    audio_path = Path(audio_path)

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Audio file not found: {audio_path}"
        )

    # Load audio
    y, sr = librosa.load(
        str(audio_path),
        sr=None,
        mono=True
    )

    if len(y) == 0:
        raise ValueError("Audio file is empty.")

    duration = librosa.get_duration(
        y=y,
        sr=sr
    )

    # RMS loudness
    rms = librosa.feature.rms(y=y)[0]

    average_rms = float(np.mean(rms))
    peak_rms = float(np.max(rms))

    # Silence detection
    silence_threshold = 0.01
    silence_percentage = float(
        np.mean(rms < silence_threshold) * 100
    )

    # Clipping detection
    clipping_percentage = float(
        np.mean(np.abs(y) >= 0.99) * 100
    )

    # Frequency characteristics
    spectral_centroid = librosa.feature.spectral_centroid(
        y=y,
        sr=sr
    )[0]

    spectral_bandwidth = librosa.feature.spectral_bandwidth(
        y=y,
        sr=sr
    )[0]

    zero_crossing_rate = librosa.feature.zero_crossing_rate(
        y
    )[0]

    result = {
        "audio_file": audio_path.name,
        "duration_seconds": round(float(duration), 2),
        "sample_rate": sr,

        "loudness": {
            "average_rms": round(average_rms, 5),
            "peak_rms": round(peak_rms, 5)
        },

        "silence_percentage": round(
            silence_percentage, 2
        ),

        "clipping_percentage": round(
            clipping_percentage, 4
        ),

        "frequency_analysis": {
            "average_spectral_centroid": round(
                float(np.mean(spectral_centroid)), 2
            ),
            "average_spectral_bandwidth": round(
                float(np.mean(spectral_bandwidth)), 2
            ),
            "average_zero_crossing_rate": round(
                float(np.mean(zero_crossing_rate)), 5
            )
        },

        "quality_warnings": []
    }

    # Basic quality warnings
    if silence_percentage > 30:
        result["quality_warnings"].append(
            "High proportion of silence detected."
        )

    if clipping_percentage > 0.1:
        result["quality_warnings"].append(
            "Potential audio clipping detected."
        )

    if average_rms < 0.01:
        result["quality_warnings"].append(
            "Audio may be too quiet."
        )

    return result