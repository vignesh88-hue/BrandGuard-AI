import json
import subprocess
from pathlib import Path

import cv2


def get_video_metadata(video_path: str) -> dict:
    """
    Extract video metadata using FFprobe.
    """

    command = [
        "ffprobe",
        "-v", "error",
        "-show_entries",
        "format=duration:stream=codec_type,width,height,r_frame_rate",
        "-of", "json",
        video_path
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=30
    )

    if result.returncode != 0:
        raise RuntimeError("Unable to read video metadata.")

    data = json.loads(result.stdout)

    video_stream = next(
        (
            stream for stream in data.get("streams", [])
            if stream.get("codec_type") == "video"
        ),
        None
    )

    if not video_stream:
        raise RuntimeError("No video stream found.")

    duration = float(data.get("format", {}).get("duration", 0))

    return {
        "duration": duration,
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "frame_rate": video_stream.get("r_frame_rate")
    }


def extract_video_frames(
    video_path: str,
    output_dir: str,
    max_frames: int = 12
) -> list:

    """
    Extract representative frames using OpenCV.
    """

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    metadata = get_video_metadata(video_path)

    duration = metadata["duration"]

    if duration <= 0:
        raise RuntimeError("Invalid video duration.")

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise RuntimeError("Unable to open video.")

    frame_paths = []

    try:
        for index in range(max_frames):

            timestamp = (
                duration * (index + 1) / (max_frames + 1)
            )

            cap.set(
                cv2.CAP_PROP_POS_MSEC,
                timestamp * 1000
            )

            success, frame = cap.read()

            if not success:
                continue

            frame_file = output_path / f"frame_{index + 1}.jpg"

            cv2.imwrite(
                str(frame_file),
                frame,
                [cv2.IMWRITE_JPEG_QUALITY, 85]
            )

            frame_paths.append(str(frame_file))

    finally:
        cap.release()

    if not frame_paths:
        raise RuntimeError("Unable to extract video frames.")

    return frame_paths


def extract_audio(
    video_path: str,
    output_dir: str
) -> str | None:

    """
    Extract audio from video using FFmpeg.
    """

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    audio_file = output_path / "audio.wav"

    command = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(audio_file)
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=180
    )

    if result.returncode != 0:
        return None

    if not audio_file.exists() or audio_file.stat().st_size == 0:
        return None

    return str(audio_file)


def process_video(
    video_path: str,
    output_dir: str,
    max_frames: int = 12
) -> dict:

    """
    Complete video preprocessing pipeline.
    """

    metadata = get_video_metadata(video_path)

    frames = extract_video_frames(
        video_path,
        output_dir,
        max_frames
    )

    audio = extract_audio(
        video_path,
        output_dir
    )

    return {
        "metadata": metadata,
        "frames": frames,
        "total_frames_extracted": len(frames),
        "audio_path": audio,
        "audio_extracted": audio is not None
    }