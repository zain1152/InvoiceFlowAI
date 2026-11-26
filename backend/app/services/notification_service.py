
from sqlalchemy import text
from sqlalchemy.orm import Session


def create_notification(
    db: Session,
    invoice_id,
    notification_type: str,
    title: str,
    message: str,
    severity: str = "info",
    dedupe_key: str | None = None,
):
    db.execute(
        text("""
            INSERT INTO notifications (
                invoice_id,
                notification_type,
                title,
                message,
                severity,
                dedupe_key
            )
            VALUES (
                :invoice_id,
                :notification_type,
                :title,
                :message,
                :severity,
                :dedupe_key
            )
            ON CONFLICT (dedupe_key) DO NOTHING
        """),
        {
            "invoice_id": invoice_id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "severity": severity,
            "dedupe_key": dedupe_key,
        }
    )


def generate_invoice_notifications(db: Session):
    created = {
        "approval_required": 0,
        "due_soon": 0,
        "overdue": 0,
    }

    # 1. Pending approval notifications
    pending_invoices = db.execute(
        text("""
            SELECT invoice_id, invoice_number
            FROM invoices
            WHERE approval_status = 'pending'
        """)
    ).mappings().all()

    for invoice in pending_invoices:
        create_notification(
            db=db,
            invoice_id=invoice["invoice_id"],
            notification_type="approval_required",
            title="Invoice requires approval",
            message=(
                f"Invoice {invoice['invoice_number']} "
                "is waiting for approval."
            ),
            severity="warning",
            dedupe_key=(
                f"approval_required:{invoice['invoice_id']}"
            ),
        )

        created["approval_required"] += 1

    # 2. Invoices due within the next 3 days
    due_soon_invoices = db.execute(
        text("""
            SELECT invoice_id, invoice_number, due_date,
                   currency, total, amount_paid
            FROM invoices
            WHERE approval_status = 'approved'
              AND due_date BETWEEN CURRENT_DATE
                               AND CURRENT_DATE + 3
              AND total > amount_paid
        """)
    ).mappings().all()

    for invoice in due_soon_invoices:
        days_left = (
            invoice["due_date"] -
            db.execute(text("SELECT CURRENT_DATE")).scalar_one()
        ).days

        create_notification(
            db=db,
            invoice_id=invoice["invoice_id"],
            notification_type="due_soon",
            title="Invoice due soon",
            message=(
                f"Invoice {invoice['invoice_number']} "
                f"is due in {days_left} day(s). "
                f"Outstanding balance: "
                f"{invoice['currency']} "
                f"{invoice['total'] - invoice['amount_paid']}."
            ),
            severity="warning",
            dedupe_key=(
                f"due_soon:{invoice['invoice_id']}"
            ),
        )

        created["due_soon"] += 1

    # 3. Overdue invoices
    overdue_invoices = db.execute(
        text("""
            SELECT invoice_id, invoice_number,
                   currency, total, amount_paid
            FROM invoices
            WHERE approval_status = 'approved'
              AND due_date < CURRENT_DATE
              AND total > amount_paid
        """)
    ).mappings().all()

    for invoice in overdue_invoices:
        outstanding = (
            invoice["total"] - invoice["amount_paid"]
        )

        create_notification(
            db=db,
            invoice_id=invoice["invoice_id"],
            notification_type="overdue",
            title="Invoice payment overdue",
            message=(
                f"Invoice {invoice['invoice_number']} "
                f"is overdue. Outstanding balance: "
                f"{invoice['currency']} {outstanding}."
            ),
            severity="danger",
            dedupe_key=(
                f"overdue:{invoice['invoice_id']}"
            ),
        )

        created["overdue"] += 1

    db.commit()

    return {
        "message": "Invoice notification generation completed",
        "checked": {
            "approval_required": len(pending_invoices),
            "due_soon": len(due_soon_invoices),
            "overdue": len(overdue_invoices),
        },
        "processed": created,
    }
