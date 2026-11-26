
import json
from datetime import date, datetime, time, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


class RecordPaymentRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_method: str = Field(min_length=2, max_length=100)
    payment_date: date | None = None
    reference: str | None = Field(default=None, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)


def get_effective_status(invoice):
    total = Decimal(str(invoice["total"] or 0))
    paid = Decimal(str(invoice["amount_paid"] or 0))
    due_date = invoice["due_date"]

    if total > 0 and paid >= total:
        return "paid"

    if due_date and due_date < date.today() and paid < total:
        return "overdue"

    if paid > 0:
        return "partially_paid"

    return "unpaid"


def invoice_response(invoice):
    total = Decimal(str(invoice["total"] or 0))
    paid = Decimal(str(invoice["amount_paid"] or 0))
    outstanding = max(total - paid, Decimal("0"))

    return {
        "invoice_id": str(invoice["invoice_id"]),
        "invoice_number": invoice["invoice_number"],
        "vendor_name": invoice["vendor_name"],
        "invoice_date": invoice["invoice_date"],
        "due_date": invoice["due_date"],
        "currency": invoice["currency"],
        "total": total,
        "amount_paid": paid,
        "outstanding_balance": outstanding,
        "payment_status": get_effective_status(invoice),
        "approval_status": invoice["approval_status"],
        "paid_at": invoice["paid_at"],
        "payment_method": invoice["payment_method"],
    }


@router.get("/")
def get_payment_invoices(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                i.invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.currency,
                i.total,
                i.amount_paid,
                i.payment_status,
                i.approval_status,
                i.paid_at,
                i.payment_method,
                v.vendor_name
            FROM invoices i
            LEFT JOIN vendors v
                ON v.vendor_id = i.vendor_id
            ORDER BY
                i.due_date ASC NULLS LAST,
                i.created_at DESC
        """)
    ).mappings().all()

    return {
        "total": len(rows),
        "invoices": [invoice_response(row) for row in rows],
    }

@router.get("/summary")
def get_payment_summary(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                i.invoice_id,
                i.total,
                i.amount_paid,
                i.due_date,
                i.payment_status,
                i.approval_status,
                i.currency
            FROM invoices i
        """)
    ).mappings().all()

    summary = {
        "total_invoices": 0,
        "paid": 0,
        "unpaid": 0,
        "partially_paid": 0,
        "overdue": 0,
        "outstanding_by_currency": {},
    }

    for row in rows:
        summary["total_invoices"] += 1

        total = Decimal(str(row["total"] or 0))
        paid = Decimal(str(row["amount_paid"] or 0))
        outstanding = max(total - paid, Decimal("0"))

        invoice = {
            "total": total,
            "amount_paid": paid,
            "due_date": row["due_date"],
        }

        status = get_effective_status(invoice)
        summary[status] += 1

        currency = row["currency"] or "Unknown"

        if row["approval_status"] == "approved" and outstanding > 0:
            current = summary["outstanding_by_currency"].get(
                currency, Decimal("0")
            )
            summary["outstanding_by_currency"][currency] = (
                current + outstanding
            )

    summary["outstanding_by_currency"] = {
        currency: amount
        for currency, amount in summary["outstanding_by_currency"].items()
    }

    return summary


@router.get("/overdue")
def get_overdue_invoices(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                i.invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.currency,
                i.total,
                i.amount_paid,
                i.payment_status,
                i.approval_status,
                i.paid_at,
                i.payment_method,
                v.vendor_name
            FROM invoices i
            LEFT JOIN vendors v
                ON v.vendor_id = i.vendor_id
            WHERE
                i.approval_status = 'approved'
                AND i.due_date < CURRENT_DATE
                AND i.total > i.amount_paid
            ORDER BY i.due_date ASC
        """)
    ).mappings().all()

    return {
        "total_overdue": len(rows),
        "invoices": [invoice_response(row) for row in rows],
    }


@router.get("/history")
def get_payment_history(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                l.log_id,
                l.invoice_id,
                l.details,
                l.created_at,
                i.invoice_number,
                i.currency,
                v.vendor_name
            FROM invoice_audit_logs l
            JOIN invoices i
                ON i.invoice_id = l.invoice_id
            LEFT JOIN vendors v
                ON v.vendor_id = i.vendor_id
            WHERE l.action = 'payment_recorded'
            ORDER BY l.created_at DESC
        """)
    ).mappings().all()

    transactions = []

    for row in rows:
        details = row["details"] or {}

        transactions.append({
            "transaction_id": str(row["log_id"]),
            "invoice_id": str(row["invoice_id"]),
            "invoice_number": row["invoice_number"],
            "vendor_name": row["vendor_name"],
            "currency": row["currency"],
            "amount": details.get("payment_amount"),
            "payment_method": details.get("payment_method"),
            "payment_date": details.get("payment_date"),
            "reference": details.get("reference"),
            "notes": details.get("notes"),
            "previous_amount_paid": details.get("previous_amount_paid"),
            "new_amount_paid": details.get("new_amount_paid"),
            "outstanding_balance": details.get("outstanding_balance"),
            "created_at": row["created_at"],
        })

    return {
        "total_transactions": len(transactions),
        "transactions": transactions,
    }

@router.get("/{invoice_id}")
def get_invoice_payment(
    invoice_id: UUID,
    db: Session = Depends(get_db),
):
    invoice = db.execute(
        text("""
            SELECT
                i.invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.currency,
                i.total,
                i.amount_paid,
                i.payment_status,
                i.approval_status,
                i.paid_at,
                i.payment_method,
                v.vendor_name
            FROM invoices i
            LEFT JOIN vendors v
                ON v.vendor_id = i.vendor_id
            WHERE i.invoice_id = CAST(:invoice_id AS UUID)
        """),
        {"invoice_id": str(invoice_id)},
    ).mappings().first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    history = db.execute(
        text("""
            SELECT
                log_id,
                action,
                details,
                created_at
            FROM invoice_audit_logs
            WHERE
                invoice_id = CAST(:invoice_id AS UUID)
                AND action = 'payment_recorded'
            ORDER BY created_at DESC
        """),
        {"invoice_id": str(invoice_id)},
    ).mappings().all()

    return {
        **invoice_response(invoice),
        "payment_history": [
            {
                "log_id": str(item["log_id"]),
                "details": item["details"],
                "created_at": item["created_at"],
            }
            for item in history
        ],
    }


@router.post("/{invoice_id}/record")
def record_payment(
    invoice_id: UUID,
    payload: RecordPaymentRequest,
    db: Session = Depends(get_db),
):
    try:
        invoice = db.execute(
            text("""
                SELECT
                    invoice_id,
                    invoice_number,
                    total,
                    amount_paid,
                    due_date,
                    currency,
                    approval_status,
                    payment_status
                FROM invoices
                WHERE invoice_id = CAST(:invoice_id AS UUID)
                FOR UPDATE
            """),
            {"invoice_id": str(invoice_id)},
        ).mappings().first()

        if not invoice:
            raise HTTPException(
                status_code=404,
                detail="Invoice not found",
            )

        if invoice["approval_status"] != "approved":
            raise HTTPException(
                status_code=409,
                detail="Only approved invoices can receive payments.",
            )

        total = Decimal(str(invoice["total"] or 0))
        previous_paid = Decimal(str(invoice["amount_paid"] or 0))
        payment_amount = payload.amount
        new_paid = previous_paid + payment_amount

        if total <= 0:
            raise HTTPException(
                status_code=400,
                detail="Invoice total must be greater than zero.",
            )

        if new_paid > total:
            raise HTTPException(
                status_code=400,
                detail="Payment exceeds the outstanding balance.",
            )

        if payload.payment_date:
            payment_datetime = datetime.combine(
                payload.payment_date,
                time.min,
                tzinfo=timezone.utc,
            )
        else:
            payment_datetime = datetime.now(timezone.utc)

        if new_paid == total:
            stored_status = "paid"
            paid_at = payment_datetime
        else:
            stored_status = "partially_paid"
            paid_at = None

        db.execute(
            text("""
                UPDATE invoices
                SET
                    amount_paid = :amount_paid,
                    payment_status = :payment_status,
                    paid_at = :paid_at,
                    payment_method = :payment_method
                WHERE invoice_id = CAST(:invoice_id AS UUID)
            """),
            {
                "amount_paid": new_paid,
                "payment_status": stored_status,
                "paid_at": paid_at,
                "payment_method": payload.payment_method,
                "invoice_id": str(invoice_id),
            },
        )

        payment_details = {
            "invoice_number": invoice["invoice_number"],
            "payment_amount": str(payment_amount),
            "previous_amount_paid": str(previous_paid),
            "new_amount_paid": str(new_paid),
            "outstanding_balance": str(total - new_paid),
            "currency": invoice["currency"],
            "payment_method": payload.payment_method,
            "payment_date": payment_datetime.isoformat(),
            "reference": payload.reference,
            "notes": payload.notes,
        }

        db.execute(
            text("""
                INSERT INTO invoice_audit_logs (
                    log_id,
                    invoice_id,
                    action,
                    old_status,
                    new_status,
                    details,
                    created_at
                )
                VALUES (
                    gen_random_uuid(),
                    CAST(:invoice_id AS UUID),
                    'payment_recorded',
                    :old_status,
                    :new_status,
                    CAST(:details AS JSONB),
                    NOW()
                )
            """),
            {
                "invoice_id": str(invoice_id),
                "old_status": invoice["payment_status"],
                "new_status": stored_status,
                "details": json.dumps(payment_details),
            },
        )

        db.commit()

        return {
            "message": "Payment recorded successfully",
            "invoice_id": str(invoice_id),
            "payment_status": stored_status,
            "total": total,
            "amount_paid": new_paid,
            "outstanding_balance": total - new_paid,
            "currency": invoice["currency"],
            "payment_method": payload.payment_method,
            "payment_date": payment_datetime,
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise
