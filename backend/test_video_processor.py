import json

from app.services.video_processor import process_video

result = process_video(
    video_path="test_media/sample.mp4",
    output_dir="test_media/processed",
    max_frames=12
)

print("\n========== VIDEO PROCESSING RESULT ==========\n")
print(json.dumps(result, indent=4))

print("\n========== PROCESSING SUMMARY ==========")
print("Duration:", result["metadata"]["duration"], "seconds")
print("Resolution:", result["metadata"]["width"], "x",
      result["metadata"]["height"])
print("Frames extracted:", result["total_frames_extracted"])
print("Audio extracted:", result["audio_extracted"])