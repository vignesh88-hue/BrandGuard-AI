from app.services.groq_client import generate_groq_response

prompt = """
Return a JSON object with these fields:
{
    "status": "success",
    "provider": "Groq",
    "message": "BrandGuard AI connection successful"
}
"""

try:
    result = generate_groq_response(prompt)

    print("\n========== GROQ TEST ==========")
    print(result)
    print("\nGroq connection successful!")

except Exception as error:
    print("\nGroq connection failed:")
    print(error)