from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class VendorRecord(Base):
    __tablename__ = "vendors"

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    vendor_name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    normalized_name: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )

    tax_id: Mapped[str | None] = mapped_column(
        String(100)
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    invoices: Mapped[list[InvoiceRecord]] = relationship(
        back_populates="vendor"
    )


class InvoiceRecord(Base):
    __tablename__ = "invoices"

    __table_args__ = (
        Index(
            "uq_invoices_vendor_invoice_number",
            "vendor_id",
            "invoice_number",
            unique=True,
            postgresql_where=text(
                "vendor_id IS NOT NULL AND invoice_number IS NOT NULL"
            )
        ),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.vendor_id")
    )

    invoice_number: Mapped[str | None] = mapped_column(
        String(150)
    )

    invoice_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str | None] = mapped_column(String(10))

    subtotal: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    discount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    tax: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    shipping: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    total: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    customer_name: Mapped[str | None] = mapped_column(String(255))

    validation_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'needs_review'")
    )

    approval_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'pending'")
    )

    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    file_path: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    file_size: Mapped[int] = mapped_column(
        BigInteger, nullable=False
    )

    validation_errors: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    validation_warnings: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    extracted_data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    vendor: Mapped[VendorRecord | None] = relationship(
        back_populates="invoices"
    )

    items: Mapped[list[InvoiceItemRecord]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan"
    )

    audit_logs: Mapped[list[InvoiceAuditLogRecord]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan"
    )


class InvoiceItemRecord(Base):
    __tablename__ = "invoice_items"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.invoice_id", ondelete="CASCADE"),
        nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 4)
    )

    unit_price: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 4)
    )

    line_total: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 2)
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    invoice: Mapped[InvoiceRecord] = relationship(
        back_populates="items"
    )


class InvoiceAuditLogRecord(Base):
    __tablename__ = "invoice_audit_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.invoice_id", ondelete="CASCADE"),
        nullable=False
    )

    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    old_status: Mapped[str | None] = mapped_column(String(50))
    new_status: Mapped[str | None] = mapped_column(String(50))

    details: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    invoice: Mapped[InvoiceRecord] = relationship(
        back_populates="audit_logs"
    )