import fitz

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from an uploaded PDF."""
    try:
        document = fitz.open(file_path)
        extracted_text = ""
        
        for page_number, page in enumerate(document):
            text = page.get_text()
            extracted_text += f"\n--- Page {page_number + 1} ---\n{text}"
            
        document.close()
        return extracted_text.strip()
        
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {str(e)}")