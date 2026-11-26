
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.invoices import router as invoice_router
from app.api.vendors import router as vendor_router
from app.api.payments import router as payment_router
from app.api.notifications import router as notification_router


app = FastAPI(
    title="InvoiceFlow AI",
    description="AI-powered invoice processing and automation API",
    version="1.0.0",
)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(invoice_router)
app.include_router(vendor_router)
app.include_router(payment_router)
app.include_router(notification_router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "InvoiceFlow AI",
    }
