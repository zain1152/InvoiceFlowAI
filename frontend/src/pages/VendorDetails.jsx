
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  FileText,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  CalendarDays,
  RefreshCw,
} from "lucide-react";

import { getVendorDetails } from "../services/api";
import "./VendorDetails.css";

function formatAmount(amount, currency) {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || ""} ${value.toFixed(2)}`;
  }
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function VendorDetails() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVendor = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getVendorDetails(vendorId);
      setVendor(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load vendor information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendor();
  }, [vendorId]);

  const invoices = vendor?.invoices || [];

  const summary = useMemo(() => {
    const result = {
      approved: 0,
      pending: 0,
      rejected: 0,
      spending: {},
      monthly: {},
    };

    invoices.forEach((invoice) => {
      const approval = String(
        invoice.approval_status || "pending"
      ).toLowerCase();

      if (approval === "approved") {
        result.approved += 1;
      } else if (approval === "rejected") {
        result.rejected += 1;
      } else {
        result.pending += 1;
      }

      const currency = invoice.currency || "Unknown";
      const total = Number(invoice.total || 0);

      result.spending[currency] =
        (result.spending[currency] || 0) + total;

      const dateValue = invoice.invoice_date || invoice.created_at;

      if (dateValue) {
        const date = new Date(dateValue);

        if (!Number.isNaN(date.getTime())) {
          const month = date.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          const key = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

          if (!result.monthly[key]) {
            result.monthly[key] = {
              label: month,
              currencies: {},
            };
          }

          result.monthly[key].currencies[currency] =
            (result.monthly[key].currencies[currency] || 0) + total;
        }
      }
    });

    return result;
  }, [invoices]);

  const monthlyData = Object.entries(summary.monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, value]) => ({
      key,
      ...value,
    }));

  const currencies = Object.entries(summary.spending);

  const maxMonthlySpend = Math.max(
    1,
    ...monthlyData.flatMap((month) =>
      Object.values(month.currencies)
    )
  );

  if (loading) {
    return (
      <div className="vendor-detail-loading">
        <RefreshCw size={25} className="loading-icon" />
        <p>Loading vendor profile...</p>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="vendor-detail-page">
        <button
          className="vendor-back-button"
          onClick={() => navigate("/vendors")}
        >
          <ArrowLeft size={17} />
          Back to Vendors
        </button>

        <div className="vendor-detail-error">
          <AlertCircle size={25} />
          <h2>Unable to load vendor</h2>
          <p>{error || "Vendor not found."}</p>
          <button onClick={loadVendor}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-detail-page">
      <button
        className="vendor-back-button"
        onClick={() => navigate("/vendors")}
      >
        <ArrowLeft size={17} />
        Back to Vendors
      </button>

      {/* Vendor header */}

      <section className="vendor-profile-header">
        <div className="vendor-profile-identity">
          <div className="vendor-profile-avatar">
            <Building2 size={30} />
          </div>

          <div>
            <span className="eyebrow">VENDOR PROFILE</span>
            <h1>{vendor.vendor_name}</h1>
            <p>
              Tax ID: {vendor.tax_id || "Not provided"}
            </p>
          </div>
        </div>

        <div className="vendor-profile-date">
          <CalendarDays size={17} />
          <span>
            Added {formatDate(vendor.created_at)}
          </span>
        </div>
      </section>

      {/* KPI cards */}

      <section className="vendor-detail-stats">
        <div className="vendor-detail-stat">
          <div className="vendor-detail-stat-icon purple">
            <FileText size={21} />
          </div>
          <span>Total Invoices</span>
          <h2>{invoices.length}</h2>
        </div>

        <div className="vendor-detail-stat">
          <div className="vendor-detail-stat-icon green">
            <CheckCircle2 size={21} />
          </div>
          <span>Approved</span>
          <h2>{summary.approved}</h2>
        </div>

        <div className="vendor-detail-stat">
          <div className="vendor-detail-stat-icon orange">
            <Clock size={21} />
          </div>
          <span>Pending</span>
          <h2>{summary.pending}</h2>
        </div>

        <div className="vendor-detail-stat">
          <div className="vendor-detail-stat-icon red">
            <XCircle size={21} />
          </div>
          <span>Rejected</span>
          <h2>{summary.rejected}</h2>
        </div>
      </section>

      {/* Financial overview */}

      <section className="vendor-analytics-grid">
        <div className="vendor-detail-panel">
          <div className="vendor-detail-panel-heading">
            <div>
              <h2>Financial Overview</h2>
              <p>Total invoice value grouped by currency</p>
            </div>
            <Wallet size={20} />
          </div>

          {currencies.length === 0 ? (
            <div className="vendor-chart-empty">
              No financial data available.
            </div>
          ) : (
            <div className="vendor-currency-list">
              {currencies.map(([currency, total]) => (
                <div
                  className="vendor-currency-item"
                  key={currency}
                >
                  <div>
                    <span>{currency}</span>
                    <strong>
                      {formatAmount(total, currency)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="vendor-detail-panel">
          <div className="vendor-detail-panel-heading">
            <div>
              <h2>Monthly Spending</h2>
              <p>Based on the latest six invoice months</p>
            </div>
            <CalendarDays size={20} />
          </div>

          {monthlyData.length === 0 ? (
            <div className="vendor-chart-empty">
              No dated invoices available for the chart.
            </div>
          ) : (
            <div className="vendor-monthly-chart">
              {monthlyData.map((month) => (
                <div
                  className="vendor-month-row"
                  key={month.key}
                >
                  <span className="vendor-month-label">
                    {month.label}
                  </span>

                  <div className="vendor-month-bars">
                    {Object.entries(month.currencies).map(
                      ([currency, amount]) => (
                        <div
                          className="vendor-month-bar-line"
                          key={currency}
                        >
                          <div className="vendor-month-track">
                            <div
                              className="vendor-month-fill"
                              style={{
                                width: `${Math.max(
                                  2,
                                  (amount / maxMonthlySpend) * 100
                                )}%`,
                              }}
                            />
                          </div>

                          <span>
                            {formatAmount(amount, currency)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Invoice history */}

      <section className="vendor-detail-panel vendor-history-panel">
        <div className="vendor-detail-panel-heading">
          <div>
            <h2>Invoice History</h2>
            <p>
              All invoices received from {vendor.vendor_name}
            </p>
          </div>

          <span className="vendor-history-count">
            {invoices.length} invoices
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="vendor-chart-empty">
            No invoices have been recorded for this vendor.
          </div>
        ) : (
          <div className="vendor-history-table-wrapper">
            <table className="vendor-history-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Validation</th>
                  <th>Approval</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoice_id}>
                    <td>
                      <strong>
                        {invoice.invoice_number || "N/A"}
                      </strong>
                    </td>

                    <td>{formatDate(invoice.invoice_date)}</td>
                    <td>{formatDate(invoice.due_date)}</td>

                    <td className="vendor-invoice-amount">
                      {formatAmount(
                        invoice.total,
                        invoice.currency
                      )}
                    </td>

                    <td>
                      <span
                        className={`vendor-status ${
                          invoice.validation_status || "unknown"
                        }`}
                      >
                        {invoice.validation_status || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`vendor-status ${
                          invoice.approval_status || "pending"
                        }`}
                      >
                        {invoice.approval_status || "pending"}
                      </span>
                    </td>

                    <td>
                      <button
                        className="vendor-view-invoice"
                        onClick={() =>
                          navigate(
                            `/invoices/${invoice.invoice_id}`
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default VendorDetails;
