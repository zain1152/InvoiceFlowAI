
from pathlib import Path
from pprint import pprint

from app.services.pdf_extractor import extract_text_from_pdf
from app.services.ai_extractor import extract_invoice_data
from app.services.invoice_validator import validate_invoice


# --------------------------------------------------
# 1. Project paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
INVOICE_DIR = BASE_DIR / "storage" / "invoices"


# --------------------------------------------------
# 2. Find the latest uploaded PDF
# --------------------------------------------------

pdf_files = sorted(
    INVOICE_DIR.glob("*.pdf"),
    key=lambda file: file.stat().st_mtime,
    reverse=True
)

if not pdf_files:
    raise SystemExit(
        "\nERROR: No PDF invoices found in storage/invoices."
    )

latest_pdf = pdf_files[0]

print("\n" + "=" * 60)
print("INVOICEFLOW AI - COMPLETE EXTRACTION TEST")
print("=" * 60)

print(f"\nSelected invoice: {latest_pdf.name}")


# --------------------------------------------------
# 3. Extract text from PDF
# --------------------------------------------------

print("\n[1/4] EXTRACTING PDF TEXT...")

try:
    extracted_text = extract_text_from_pdf(str(latest_pdf))

    if not extracted_text.strip():
        raise ValueError("No text found in the PDF.")

    print("SUCCESS: PDF text extracted.")
    print(f"Extracted characters: {len(extracted_text)}")

except Exception as error:
    raise SystemExit(f"PDF EXTRACTION FAILED: {error}")


# --------------------------------------------------
# 4. Extract structured data using Gemini
# --------------------------------------------------

print("\n[2/4] EXTRACTING INVOICE DATA WITH GEMINI...")

try:
    invoice = extract_invoice_data(extracted_text)

    print("SUCCESS: Gemini extraction completed.")

except Exception as error:
    raise SystemExit(f"AI EXTRACTION FAILED: {error}")


print("\nSTRUCTURED INVOICE DATA")
print("-" * 60)

pprint(invoice.model_dump(mode="json"), sort_dicts=False)


# --------------------------------------------------
# 5. Validate invoice data
# --------------------------------------------------

print("\n[3/4] VALIDATING INVOICE DATA...")

try:
    validation = validate_invoice(invoice)

    print("SUCCESS: Invoice validation completed.")

except Exception as error:
    raise SystemExit(f"INVOICE VALIDATION FAILED: {error}")


print("\nVALIDATION SUMMARY")
print("-" * 60)

print(f"Overall status : {validation['status']}")
print(f"Is valid       : {validation['is_valid']}")

print("\nVALIDATION CHECKS")

for check in validation["checks"]:
    status = "PASS" if check["passed"] else "FAIL"

    print(f"[{status}] {check['check']}")
    print(f"       {check['message']}")

print("\nERRORS")

if validation["errors"]:
    for error in validation["errors"]:
        print(f"- {error}")
else:
    print("No errors found.")

print("\nWARNINGS")

if validation["warnings"]:
    for warning in validation["warnings"]:
        print(f"- {warning}")
else:
    print("No warnings found.")


# --------------------------------------------------
# 6. Final report
# --------------------------------------------------

print("\n[4/4] GENERATING FINAL REPORT...")

print("\n" + "=" * 60)
print("INVOICEFLOW AI - FINAL REPORT")
print("=" * 60)

print(f"Invoice file   : {latest_pdf.name}")
print(f"Vendor         : {invoice.vendor_name}")
print(f"Invoice number : {invoice.invoice_number}")
print(f"Currency       : {invoice.currency}")
print(f"Subtotal       : {invoice.subtotal}")
print(f"Tax            : {invoice.tax}")
print(f"Discount       : {invoice.discount}")
print(f"Shipping       : {invoice.shipping}")
print(f"Total           : {invoice.total}")
print(f"Items extracted: {len(invoice.items)}")
print(f"Validation     : {validation['status'].upper()}")

print("\n" + "=" * 60)
print("PIPELINE EXECUTION COMPLETED")
print("=" * 60)
