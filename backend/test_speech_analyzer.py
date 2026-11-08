import json

from app.services.speech_analyzer import analyze_speech


audio_path = "test_media/processed/audio.wav"

result = analyze_speech(audio_path)

print("\n========== SPEECH ANALYSIS RESULT ==========\n")

print(json.dumps(result, indent=4, ensure_ascii=False))