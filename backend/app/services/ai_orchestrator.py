import os
import json
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.services.groq_client import generate_groq_response

load_dotenv()


# -------------------------------
# Gemini Configuration
# -------------------------------

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.5-flash-lite"
)

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing.")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)


# -------------------------------
# Provider Error Detection
# -------------------------------

def is_temporary_error(error: Exception) -> bool:

    error_message = str(error).lower()

    temporary_errors = (
        "429",
        "500",
        "502",
        "503",
        "504",
        "unavailable",
        "resource_exhausted",
        "timeout",
        "deadline exceeded",
        "service unavailable",
    )

    return any(
        code in error_message
        for code in temporary_errors
    )


# -------------------------------
# Gemini Request
# -------------------------------

def generate_gemini_response(prompt: str) -> dict:

    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
        )
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    return json.loads(response.text)


# -------------------------------
# AI Orchestrator
# -------------------------------

def generate_ai_response(prompt: str) -> dict:
    """
    Gemini primary provider.
    Groq fallback provider.
    """

    max_attempts = 3
    gemini_error = None

    # 1. Try Gemini
    for attempt in range(max_attempts):

        try:
            print("AI Provider: Trying Gemini...")

            result = generate_gemini_response(prompt)

            print("AI Provider: Gemini successful.")

            result["_provider"] = "gemini"
            return result

        except Exception as error:

            gemini_error = error

            print(
                f"Gemini attempt {attempt + 1} failed: {error}"
            )

            if not is_temporary_error(error):
                break

            if attempt < max_attempts - 1:
                wait_seconds = 2 ** (attempt + 1)

                print(
                    f"Gemini unavailable. "
                    f"Retrying in {wait_seconds} seconds..."
                )

                time.sleep(wait_seconds)

    # 2. Switch to Groq
    try:
        print("AI Provider: Switching to Groq...")

        result = generate_groq_response(prompt)

        print("AI Provider: Groq successful.")

        result["_provider"] = "groq"
        return result

    except Exception as groq_error:

        print(f"Groq failed: {groq_error}")

        raise RuntimeError(
            "All AI providers failed. "
            f"Gemini: {gemini_error}. "
            f"Groq: {groq_error}"
        ) from groq_error