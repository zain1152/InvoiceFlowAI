
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
} from "lucide-react";

import {
  getInvoiceDetails,
  updateInvoiceApproval,
} from "../services/api";

const InvoiceDetails = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getInvoiceDetails(invoiceId);
      setInvoice(response);
    } catch (err) {
      console.error("Invoice detail error:", err);
      setError("Unable to load invoice details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [invoiceId]);

  const handleApproval = async (status) => {
    const action = status === "approved" ? "approve" : "reject";

    if (!window.confirm(`Are you sure you want to ${action} this invoice?`)) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await updateInvoiceApproval(invoiceId, status, comments);

      await fetchDetails();
      setComments("");
    } catch (err) {
      console.error("Approval update error:", err);
      setError(
        err.response?.data?.detail ||
          "Unable to update invoice approval status."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="dashboard-content">
        <p className="empty-state">Loading invoice details...</p>
      </section>
    );
  }

  if (error && !invoice) {
    return (
      <section className="dashboard-content">
        <div className="error-banner">{error}</div>
        <button className="secondary-button" onClick={fetchDetails}>
          <RefreshCw size={16} /> Retry
        </button>
      </section>
    );
  }

  if (!invoice) return null;

  const vendor =
    invoice.vendor_name ||
    invoice.vendor?.vendor_name ||
    invoice.vendor?.name ||
    "Unknown vendor";

  const items = invoice.items || [];

  return (
    <section className="dashboard-content">
      <button
        className="back-button"
        onClick={() => navigate("/invoices")}
      >
        <ArrowLeft size={17} />
        Back to invoices
      </button>

      <div className="page-heading detail-heading">
        <div>
          <p className="eyebrow">INVOICE DETAILS</p>
          <h1>{invoice.invoice_number || "Invoice"}</h1>
          <p className="subtitle">{vendor}</p>
        </div>

        <div className="detail-statuses">
          <span className={`status-badge ${invoice.validation_status}`}>
            {invoice.validation_status}
          </span>
          <span className={`status-badge ${invoice.approval_status}`}>
            {invoice.approval_status}
          </span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Invoice information</h3>
              <p>Extracted invoice details</p>
            </div>
            <FileText size={21} />
          </div>

          <div className="detail-fields">
            <div>
              <span>Vendor</span>
              <strong>{vendor}</strong>
            </div>

            <div>
              <span>Invoice number</span>
              <strong>{invoice.invoice_number || "—"}</strong>
            </div>

            <div>
              <span>Invoice date</span>
              <strong>{invoice.invoice_date || "—"}</strong>
            </div>

            <div>
              <span>Due date</span>
              <strong>{invoice.due_date || "—"}</strong>
            </div>

            <div>
              <span>Currency</span>
              <strong>{invoice.currency || "—"}</strong>
            </div>

            <div>
              <span>Customer</span>
              <strong>{invoice.customer_name || "—"}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Financial summary</h3>
              <p>Invoice totals</p>
            </div>
          </div>

          <div className="detail-fields">
            {[
              ["Subtotal", invoice.subtotal],
              ["Discount", invoice.discount],
              ["Tax", invoice.tax],
              ["Shipping", invoice.shipping],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value ?? "—"}</strong>
              </div>
            ))}

            <div className="total-row">
              <span>Total amount</span>
              <strong>
                {invoice.currency || ""} {invoice.total ?? "—"}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel detail-items">
        <div className="panel-heading">
          <div>
            <h3>Invoice line items</h3>
            <p>Products and services extracted from the document</p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="empty-state">No line items available.</p>
        ) : (
          <div className="table-wrapper">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Line total</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={item.item_id || index}>
                    <td>{item.description || "—"}</td>
                    <td>{item.quantity ?? "—"}</td>
                    <td>{item.unit_price ?? "—"}</td>
                    <td>{item.line_total ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel approval-panel">
        <div className="panel-heading">
          <div>
            <h3>Human approval</h3>
            <p>Review this invoice before making a decision.</p>
          </div>
        </div>

        {invoice.approval_status === "pending" ? (
          <>
            <label className="comments-label" htmlFor="review-comments">
              Reviewer comments
            </label>

            <textarea
              id="review-comments"
              className="comments-input"
              placeholder="Add a reason or review note..."
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              rows={3}
            />

            <div className="approval-actions">
              <button
                className="approve-button"
                onClick={() => handleApproval("approved")}
                disabled={saving}
              >
                <CheckCircle2 size={17} />
                {saving ? "Processing..." : "Approve invoice"}
              </button>

              <button
                className="reject-button"
                onClick={() => handleApproval("rejected")}
                disabled={saving}
              >
                <XCircle size={17} />
                Reject invoice
              </button>
            </div>
          </>
        ) : (
          <p className="empty-state">
            This invoice has already been {invoice.approval_status}.
          </p>
        )}
      </section>

      <section className="panel detail-items">
        <div className="panel-heading">
          <div>
            <h3>Audit history</h3>
            <p>Recorded invoice processing and approval activity</p>
          </div>
        </div>

        {(invoice.audit_history || invoice.audit_logs || []).length === 0 ? (
          <p className="empty-state">No audit history available.</p>
        ) : (
          <div className="audit-list">
            {(invoice.audit_history || invoice.audit_logs || []).map(
              (log, index) => (
                <div className="audit-entry" key={log.audit_id || index}>
                  <strong>{(log.action || "Activity").replaceAll("_", " ")}</strong>
                  <span>
                    {log.old_status || "—"} → {log.new_status || "—"}
                  </span>
                  <small>
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : "Date unavailable"}
                  </small>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </section>
  );
};

export default InvoiceDetails;
