
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db_models import (
    VendorRecord,
    InvoiceRecord,
    InvoiceItemRecord,
    InvoiceAuditLogRecord,
)
from app.models.invoice import InvoiceData


class DuplicateInvoiceError(Exception):
    """Raised when an invoice already exists for the vendor."""


def normalize_vendor_name(name: str) -> str:
    """Normalize vendor names for consistent matching."""
    return " ".join(name.casefold().split())


def save_invoice(
    db: Session,
    invoice_data: InvoiceData,
    validation_result: dict,
    original_filename: str,
    file_path: str,
    file_size: int,
) -> InvoiceRecord:

    try:
        vendor = None

        # 1. Find or create vendor
        if invoice_data.vendor_name:
            normalized_name = normalize_vendor_name(
                invoice_data.vendor_name
            )

            vendor = db.execute(
                select(VendorRecord).where(
                    VendorRecord.normalized_name == normalized_name
                )
            ).scalar_one_or_none()

            if vendor is None:
                vendor = VendorRecord(
                    vendor_name=invoice_data.vendor_name.strip(),
                    normalized_name=normalized_name,
                    tax_id=invoice_data.vendor_tax_id,
                )

                db.add(vendor)
                db.flush()

            elif not vendor.tax_id and invoice_data.vendor_tax_id:
                vendor.tax_id = invoice_data.vendor_tax_id

        # 2. Normalize invoice number
        invoice_number = (
            invoice_data.invoice_number.strip()
            if invoice_data.invoice_number
            else None
        )

        # 3. Check for duplicate invoice
        if vendor is not None and invoice_number is not None:

            existing_invoice = db.execute(
                select(InvoiceRecord).where(
                    InvoiceRecord.vendor_id == vendor.vendor_id,
                    InvoiceRecord.invoice_number == invoice_number,
                )
            ).scalar_one_or_none()

            if existing_invoice is not None:
                raise DuplicateInvoiceError(
                    f"Invoice {invoice_number} from "
                    f"{vendor.vendor_name} already exists."
                )

        # 4. Create invoice record
        invoice = InvoiceRecord(
            vendor_id=vendor.vendor_id if vendor else None,
            invoice_number=invoice_number,
            invoice_date=invoice_data.invoice_date,
            due_date=invoice_data.due_date,
            currency=invoice_data.currency,
            subtotal=invoice_data.subtotal,
            discount=invoice_data.discount,
            tax=invoice_data.tax,
            shipping=invoice_data.shipping,
            total=invoice_data.total,
            customer_name=invoice_data.customer_name,
            validation_status=validation_result["status"],
            approval_status="pending",
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            validation_errors=validation_result["errors"],
            validation_warnings=validation_result["warnings"],
            extracted_data=invoice_data.model_dump(mode="json"),
        )

        db.add(invoice)
        db.flush()

        # 5. Save individual invoice items
        for item in invoice_data.items:
            db.add(
                InvoiceItemRecord(
                    invoice_id=invoice.invoice_id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    line_total=item.line_total,
                )
            )

        # 6. Create audit log
        db.add(
            InvoiceAuditLogRecord(
                invoice_id=invoice.invoice_id,
                action="invoice_processed",
                old_status=None,
                new_status=validation_result["status"],
                details={
                    "filename": original_filename,
                    "file_size": file_size,
                    "validation_errors": validation_result["errors"],
                    "validation_warnings": validation_result["warnings"],
                },
            )
        )

        # 7. Commit all records together
        db.commit()
        db.refresh(invoice)

        return invoice

    except Exception:
        db.rollback()
        raise
