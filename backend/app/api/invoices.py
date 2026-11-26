
from pathlib import Path
from uuid import UUID, uuid4
from typing import Optional

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
    Query,
)
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db

from app.models.db_models import (
    InvoiceRecord,
    VendorRecord,
    InvoiceAuditLogRecord,
)

from app.models.invoice import ApprovalUpdate

from app.services.pdf_extractor import extract_text_from_pdf
from app.services.ai_extractor import extract_invoice_data
from app.services.invoice_validator import validate_invoice

from app.services.invoice_repository import (
    save_invoice,
    DuplicateInvoiceError,
)


router = APIRouter()


# --------------------------------------------------
# STORAGE CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]

STORAGE_DIR = BASE_DIR / "storage" / "invoices"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# --------------------------------------------------
# 1. UPLOAD AND PROCESS INVOICE
# --------------------------------------------------

@router.post("/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is missing",
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 10 MB limit",
        )

    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid PDF",
        )

    # Generate a unique filename
    stored_filename = f"{uuid4()}.pdf"

    file_path = STORAGE_DIR / stored_filename

    try:
        # Save original PDF
        file_path.write_bytes(content)

        # Extract text from PDF
        invoice_text = extract_text_from_pdf(str(file_path))

        if not invoice_text.strip():
            raise HTTPException(
                status_code=422,
                detail=(
                    "No readable text found in this PDF. "
                    "OCR support is required for scanned invoices."
                ),
            )

        # Extract structured data using Gemini
        invoice_data = extract_invoice_data(invoice_text)

        # Validate extracted invoice data
        validation_result = validate_invoice(invoice_data)

        # Save invoice and related records in PostgreSQL
        saved_invoice = save_invoice(
            db=db,
            invoice_data=invoice_data,
            validation_result=validation_result,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=len(content),
        )

        return {
            "message": "Invoice uploaded and processed successfully",
            "invoice_id": str(saved_invoice.invoice_id),
            "filename": file.filename,
            "invoice_data": invoice_data.model_dump(mode="json"),
            "validation": validation_result,
            "approval_status": saved_invoice.approval_status,
            "database_status": "saved",
        }

    except DuplicateInvoiceError as error:
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=409,
            detail=str(error),
        )

    except IntegrityError as error:
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=409,
            detail="Invoice conflicts with an existing database record",
        ) from error

    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise

    except ValueError as error:
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    except RuntimeError as error:
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error

    except Exception as error:
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while processing the invoice",
        ) from error


# --------------------------------------------------
# 2. LIST, FILTER AND SEARCH INVOICES
# --------------------------------------------------

@router.get("/")
def get_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),

    validation_status: Optional[str] = None,
    approval_status: Optional[str] = None,
    search: Optional[str] = None,

    db: Session = Depends(get_db),
):

    query = (
        select(InvoiceRecord)
        .options(
            selectinload(InvoiceRecord.vendor),
            selectinload(InvoiceRecord.items),
        )
    )

    # Validation status filter
    if validation_status:
        allowed_validation = [
            "valid",
            "needs_review",
            "invalid",
        ]

        if validation_status not in allowed_validation:
            raise HTTPException(
                status_code=400,
                detail="Invalid validation status",
            )

        query = query.where(
            InvoiceRecord.validation_status == validation_status
        )

    # Approval status filter
    if approval_status:
        allowed_approval = [
            "pending",
            "approved",
            "rejected",
        ]

        if approval_status not in allowed_approval:
            raise HTTPException(
                status_code=400,
                detail="Invalid approval status",
            )

        query = query.where(
            InvoiceRecord.approval_status == approval_status
        )

    # Search by invoice number, filename or vendor
    if search and search.strip():

        search_term = f"%{search.strip()}%"

        query = query.where(
            (
                InvoiceRecord.invoice_number.ilike(search_term)
            )
            |
            (
                InvoiceRecord.original_filename.ilike(search_term)
            )
            |
            (
                InvoiceRecord.vendor.has(
                    VendorRecord.vendor_name.ilike(search_term)
                )
            )
        )

    # Calculate total matching invoices
    count_query = select(func.count()).select_from(
        query.order_by(None).subquery()
    )

    total = db.execute(count_query).scalar_one()

    # Apply pagination
    invoices = db.execute(
        query
        .order_by(InvoiceRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    results = []

    for invoice in invoices:

        results.append({
            "invoice_id": str(invoice.invoice_id),

            "vendor_name": (
                invoice.vendor.vendor_name
                if invoice.vendor
                else None
            ),

            "invoice_number": invoice.invoice_number,

            "invoice_date": invoice.invoice_date,
            "due_date": invoice.due_date,

            "currency": invoice.currency,
            "total": invoice.total,

            "validation_status": invoice.validation_status,
            "approval_status": invoice.approval_status,

            "filename": invoice.original_filename,

            "created_at": invoice.created_at,

            "item_count": len(invoice.items),
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "invoices": results,
    }


# --------------------------------------------------
# 3. INVOICE STATISTICS
# IMPORTANT: KEEP BEFORE /{invoice_id}
# --------------------------------------------------

@router.get("/stats")
def get_invoice_stats(
    db: Session = Depends(get_db),
):

    # Total invoices
    total_invoices = db.execute(
        select(func.count(InvoiceRecord.invoice_id))
    ).scalar_one()

    # Validation statistics
    validation_counts = {}

    for status in ["valid", "needs_review", "invalid"]:

        count = db.execute(
            select(func.count(InvoiceRecord.invoice_id))
            .where(InvoiceRecord.validation_status == status)
        ).scalar_one()

        validation_counts[status] = count

    # Approval statistics
    approval_counts = {}

    for status in ["pending", "approved", "rejected"]:

        count = db.execute(
            select(func.count(InvoiceRecord.invoice_id))
            .where(InvoiceRecord.approval_status == status)
        ).scalar_one()

        approval_counts[status] = count

    # Total invoice value
    total_invoice_value = db.execute(
        select(
            func.coalesce(
                func.sum(InvoiceRecord.total),
                0
            )
        )
    ).scalar_one()

    # Group invoice value by currency
    currency_rows = db.execute(
        select(
            InvoiceRecord.currency,
            func.sum(InvoiceRecord.total),
            func.count(InvoiceRecord.invoice_id),
        )
        .group_by(InvoiceRecord.currency)
    ).all()

    currency_breakdown = []

    for currency, total_value, invoice_count in currency_rows:

        currency_breakdown.append({
            "currency": currency or "UNKNOWN",
            "total_value": str(total_value or 0),
            "invoice_count": invoice_count,
        })

    return {
        "total_invoices": total_invoices,

        "validation": validation_counts,

        "approval": approval_counts,

        "total_invoice_value": str(total_invoice_value),

        "currency_breakdown": currency_breakdown,
    }


# --------------------------------------------------
# 4. GET INDIVIDUAL INVOICE DETAILS
# --------------------------------------------------

@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
):

    invoice = db.execute(
        select(InvoiceRecord)
        .options(
            selectinload(InvoiceRecord.vendor),
            selectinload(InvoiceRecord.items),
            selectinload(InvoiceRecord.audit_logs),
        )
        .where(InvoiceRecord.invoice_id == invoice_id)
    ).scalar_one_or_none()

    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return {
        "invoice_id": str(invoice.invoice_id),

        "vendor": (
            {
                "vendor_id": str(invoice.vendor.vendor_id),
                "vendor_name": invoice.vendor.vendor_name,
                "tax_id": invoice.vendor.tax_id,
            }
            if invoice.vendor
            else None
        ),

        "invoice_number": invoice.invoice_number,

        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,

        "currency": invoice.currency,

        "financials": {
            "subtotal": invoice.subtotal,
            "discount": invoice.discount,
            "tax": invoice.tax,
            "shipping": invoice.shipping,
            "total": invoice.total,
        },

        "customer_name": invoice.customer_name,

        "validation": {
            "status": invoice.validation_status,
            "errors": invoice.validation_errors,
            "warnings": invoice.validation_warnings,
        },

        "approval_status": invoice.approval_status,

        "document": {
            "filename": invoice.original_filename,
            "file_size": invoice.file_size,
        },

        "items": [
            {
                "item_id": str(item.item_id),
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
            }
            for item in invoice.items
        ],

        "audit_history": [
            {
                "action": log.action,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "details": log.details,
                "created_at": log.created_at,
            }
            for log in invoice.audit_logs
        ],

        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }


# --------------------------------------------------
# 5. APPROVE OR REJECT INVOICE
# --------------------------------------------------

@router.patch("/{invoice_id}/approval")
def update_invoice_approval(
    invoice_id: UUID,
    approval_data: ApprovalUpdate,
    db: Session = Depends(get_db),
):

    try:

        # Lock invoice row during approval transaction
        invoice = db.execute(
            select(InvoiceRecord)
            .where(InvoiceRecord.invoice_id == invoice_id)
            .with_for_update()
        ).scalar_one_or_none()

        if invoice is None:
            raise HTTPException(
                status_code=404,
                detail="Invoice not found",
            )

        # Only pending invoices can be decided
        if invoice.approval_status != "pending":
            raise HTTPException(
                status_code=409,
                detail=(
                    "This invoice has already been "
                    f"{invoice.approval_status}"
                ),
            )

        old_status = invoice.approval_status
        new_status = approval_data.status

        # Update approval status
        invoice.approval_status = new_status

        # Save audit history
        audit_log = InvoiceAuditLogRecord(
            invoice_id=invoice.invoice_id,
            action="approval_status_changed",
            old_status=old_status,
            new_status=new_status,
            details={
                "decision": new_status,
                "comments": approval_data.comments,
            },
        )

        db.add(audit_log)

        db.commit()

        db.refresh(invoice)

        return {
            "message": f"Invoice {new_status} successfully",

            "invoice_id": str(invoice.invoice_id),

            "approval_status": invoice.approval_status,

            "validation_status": invoice.validation_status,

            "comments": approval_data.comments,
        }

    except HTTPException:
        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update invoice approval status",
        ) from error
