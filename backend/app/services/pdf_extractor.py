
import pymupdf
from pathlib import Path


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a digitally generated PDF invoice.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError("Invoice PDF not found")

    extracted_text = []

    with pymupdf.open(path) as pdf:
        for page_number, page in enumerate(pdf, start=1):

            page_text = page.get_text("text")

            extracted_text.append(
                f"\n--- Page {page_number} ---\n{page_text}"
            )

    return "\n".join(extracted_text)
