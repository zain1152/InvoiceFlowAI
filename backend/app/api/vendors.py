
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.db_models import VendorRecord, InvoiceRecord


router = APIRouter(
    prefix="/vendors",
    tags=["Vendors"]
)


@router.get("/")
def get_vendors(db: Session = Depends(get_db)):

    vendors = (
        db.query(VendorRecord)
        .order_by(VendorRecord.vendor_name.asc())
        .all()
    )

    results = []

    for vendor in vendors:

        invoice_count = (
            db.query(func.count(InvoiceRecord.invoice_id))
            .filter(
                InvoiceRecord.vendor_id == vendor.vendor_id
            )
            .scalar()
        )

        currency_totals = (
            db.query(
                InvoiceRecord.currency,
                func.coalesce(
                    func.sum(InvoiceRecord.total), 0
                )
            )
            .filter(
                InvoiceRecord.vendor_id == vendor.vendor_id
            )
            .group_by(InvoiceRecord.currency)
            .all()
        )

        spending = [
            {
                "currency": currency or "Unknown",
                "total_spend": float(total_spend or 0)
            }
            for currency, total_spend in currency_totals
        ]

        results.append({
            "vendor_id": str(vendor.vendor_id),
            "vendor_name": vendor.vendor_name,
            "tax_id": vendor.tax_id,
            "created_at": vendor.created_at,
            "invoice_count": invoice_count or 0,
            "spending_by_currency": spending
        })

    return {
        "total_vendors": len(results),
        "vendors": results
    }


@router.get("/{vendor_id}")
def get_vendor_details(
    vendor_id: UUID,
    db: Session = Depends(get_db)
):

    vendor = (
        db.query(VendorRecord)
        .filter(
            VendorRecord.vendor_id == vendor_id
        )
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    invoices = (
        db.query(InvoiceRecord)
        .filter(
            InvoiceRecord.vendor_id == vendor_id
        )
        .order_by(
            InvoiceRecord.created_at.desc()
        )
        .all()
    )

    invoice_history = []

    for invoice in invoices:

        invoice_history.append({
            "invoice_id": str(invoice.invoice_id),
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date,
            "due_date": invoice.due_date,
            "currency": invoice.currency,
            "total": (
                float(invoice.total)
                if invoice.total is not None
                else None
            ),
            "validation_status": invoice.validation_status,
            "approval_status": invoice.approval_status,
            "created_at": invoice.created_at
        })

    return {
        "vendor_id": str(vendor.vendor_id),
        "vendor_name": vendor.vendor_name,
        "tax_id": vendor.tax_id,
        "created_at": vendor.created_at,
        "total_invoices": len(invoice_history),
        "invoices": invoice_history
    }
