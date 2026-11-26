
from datetime import date
from decimal import Decimal
from typing import Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


class InvoiceItem(BaseModel):
    description: str
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    line_total: Optional[Decimal] = None


class InvoiceData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    vendor_name: Optional[str] = None
    vendor_tax_id: Optional[str] = None
    invoice_number: Optional[str] = None

    invoice_date: Optional[date] = None
    due_date: Optional[date] = None

    currency: Optional[str] = None

    subtotal: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    shipping: Optional[Decimal] = None
    total: Optional[Decimal] = None

    customer_name: Optional[str] = None

    items: list[InvoiceItem] = Field(default_factory=list)


class ApprovalUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    comments: Optional[str] = None
