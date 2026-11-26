from app.services.notification_service import (
    generate_invoice_notifications
)
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)
@router.post("/generate")
def generate_notifications(
    db: Session = Depends(get_db)
):
    return generate_invoice_notifications(db)

@router.get("/")
def get_notifications(
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = """
        SELECT
            n.notification_id,
            n.invoice_id,
            n.notification_type,
            n.title,
            n.message,
            n.severity,
            n.is_read,
            n.metadata,
            n.created_at,
            i.invoice_number,
            v.vendor_name
        FROM notifications n
        LEFT JOIN invoices i
            ON i.invoice_id = n.invoice_id
        LEFT JOIN vendors v
            ON v.vendor_id = i.vendor_id
    """

    if unread_only:
        query += " WHERE n.is_read = FALSE"

    query += " ORDER BY n.created_at DESC LIMIT :limit"

    rows = db.execute(
        text(query),
        {"limit": limit}
    ).mappings().all()

    return {
        "total": len(rows),
        "notifications": [
            {
                **dict(row),
                "notification_id": str(row["notification_id"]),
                "invoice_id": (
                    str(row["invoice_id"])
                    if row["invoice_id"] else None
                )
            }
            for row in rows
        ]
    }


@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db)):
    count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM notifications
            WHERE is_read = FALSE
        """)
    ).scalar_one()

    return {"unread_count": count}


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE,
                read_at = NOW()
            WHERE notification_id = :notification_id
            RETURNING notification_id
        """),
        {"notification_id": notification_id}
    ).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    db.commit()

    return {"message": "Notification marked as read"}


@router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE,
                read_at = NOW()
            WHERE is_read = FALSE
        """)
    )

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated": result.rowcount
    }
