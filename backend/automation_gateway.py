
import secrets

from fastapi import FastAPI, Header, HTTPException

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.notification_service import (
    generate_invoice_notifications,
)

app = FastAPI(
    title="InvoiceFlow Automation Gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.post("/notifications/generate")
def generate_notifications(
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    expected_key = settings.NOTIFICATION_API_KEY

    if not expected_key:
        raise HTTPException(
            status_code=500,
            detail="Automation API key is not configured",
        )

    if not secrets.compare_digest(x_api_key, expected_key):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )

    db = SessionLocal()

    try:
        return generate_invoice_notifications(db)
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "healthy"}
