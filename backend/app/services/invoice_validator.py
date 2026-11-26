
from decimal import Decimal

from app.models.invoice import InvoiceData


def validate_invoice(invoice: InvoiceData) -> dict:

    errors = []
    warnings = []

    # 1. Critical required fields
    critical_fields = {
        "vendor_name": invoice.vendor_name,
        "invoice_number": invoice.invoice_number,
        "total": invoice.total
    }

    for field, value in critical_fields.items():
        if value is None or value == "":
            errors.append(f"Missing required field: {field}")

    # 2. Fields requiring human review
    review_fields = {
        "invoice_date": invoice.invoice_date
    }

    for field, value in review_fields.items():
        if value is None:
            warnings.append(
                f"Missing information requiring review: {field}"
            )

    # 3. Financial amount checks
    amount_fields = {
        "subtotal": invoice.subtotal,
        "discount": invoice.discount,
        "tax": invoice.tax,
        "shipping": invoice.shipping,
        "total": invoice.total
    }

    for field, value in amount_fields.items():
        if value is not None and value < Decimal("0"):
            errors.append(f"{field} cannot be negative")

    # 4. Date checks
    if invoice.invoice_date and invoice.due_date:
        if invoice.due_date < invoice.invoice_date:
            errors.append(
                "Due date cannot be earlier than invoice date"
            )

    # 5. Financial reconciliation
    if (
        invoice.subtotal is not None
        and invoice.total is not None
    ):

        discount = invoice.discount or Decimal("0")
        tax = invoice.tax or Decimal("0")
        shipping = invoice.shipping or Decimal("0")

        expected_total = (
            invoice.subtotal - discount + tax + shipping
        )

        difference = abs(expected_total - invoice.total)

        if difference > Decimal("0.02"):
            warnings.append(
                "Invoice total does not match "
                "subtotal - discount + tax + shipping"
            )

    # 6. Product and line-item checks
    if not invoice.items:

        warnings.append(
            "No individual invoice items were extracted"
        )

    for index, item in enumerate(invoice.items, start=1):

        if (
            item.quantity is None
            and item.unit_price is None
            and item.line_total is None
        ):
            warnings.append(
                f"Item {index}: product description extracted, "
                "but quantity and pricing information are missing"
            )

        if item.quantity is not None and item.quantity < 0:
            errors.append(
                f"Item {index}: quantity cannot be negative"
            )

        if item.unit_price is not None and item.unit_price < 0:
            errors.append(
                f"Item {index}: unit price cannot be negative"
            )

        if item.line_total is not None and item.line_total < 0:
            errors.append(
                f"Item {index}: line total cannot be negative"
            )

        if (
            item.quantity is not None
            and item.unit_price is not None
            and item.line_total is not None
        ):

            expected = item.quantity * item.unit_price

            if abs(expected - item.line_total) > Decimal("0.02"):
                warnings.append(
                    f"Item {index}: quantity multiplied by "
                    "unit price does not match line total"
                )

    # 7. Determine invoice status
    if errors:
        status = "invalid"

    elif warnings:
        status = "needs_review"

    else:
        status = "valid"

    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "is_valid": status == "valid"
    }
