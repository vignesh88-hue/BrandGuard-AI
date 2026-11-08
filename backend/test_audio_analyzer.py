import json

from app.services.audio_analyzer import analyze_audio

audio_path = "test_media/processed/audio.wav"

result = analyze_audio(audio_path)

print("\n========== AUDIO ANALYSIS RESULT ==========\n")
print(json.dumps(result, indent=4))