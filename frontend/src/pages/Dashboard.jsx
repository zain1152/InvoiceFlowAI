
import { useEffect, useState } from "react";
import {
  FileText,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Upload,
  CircleDollarSign,
  ArrowUpRight,
} from "lucide-react";

import { getInvoiceStats, getInvoices } from "../services/api";
import StatCard from "../components/StatCard";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [statsData, invoiceData] = await Promise.all([
        getInvoiceStats(),
        getInvoices({ page: 1, page_size: 5 }),
      ]);

      setStats(statsData);

      const invoiceList = Array.isArray(invoiceData)
        ? invoiceData
        : invoiceData.invoices || invoiceData.items || invoiceData.results || [];

      setInvoices(invoiceList.slice(0, 5));
    } catch (err) {
      console.error("Dashboard error:", err);
      setError(
        "Unable to load dashboard data. Check your backend connection."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const cards = [
    {
      title: "Total Invoices",
      value: stats?.total_invoices ?? 0,
      icon: FileText,
      color: "blue",
      caption: "Invoices processed",
    },
    {
      title: "Pending Approval",
      value: stats?.approval?.pending ?? 0,
      icon: Clock3,
      color: "orange",
      caption: "Awaiting human review",
    },
    {
      title: "Approved",
      value: stats?.approval?.approved ?? 0,
      icon: CheckCircle2,
      color: "green",
      caption: "Approved invoices",
    },
    {
      title: "Needs Review",
      value: stats?.validation?.needs_review ?? 0,
      icon: AlertTriangle,
      color: "purple",
      caption: "Require attention",
    },
  ];

  const money = Number(stats?.total_invoice_value ?? 0);

  return (
    <section className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="subtitle">
            Monitor invoice processing and approval activity.
          </p>
        </div>

        <div className="heading-actions">
          <button
            className="secondary-button"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            className="primary-button"
            onClick={() => (window.location.href = "/invoices")}
          >
            <Upload size={17} />
            Manage Invoices
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="section-heading">
        <h3>Performance overview</h3>
        <span>Live data from PostgreSQL</span>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={
              loading
                ? "..."
                : Number(card.value).toLocaleString()
            }
            icon={card.icon}
            color={card.color}
            caption={card.caption}
          />
        ))}
      </div>

      <div className="lower-grid">
        <section className="panel financial-panel">
          <div className="panel-heading">
            <div>
              <h3>Total invoice value</h3>
              <p>Combined value of processed invoices</p>
            </div>
            <CircleDollarSign size={21} />
          </div>

          <div className="financial-value">
            {loading
              ? "Loading..."
              : money.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>

          <div className="currency-list">
            {stats?.currency_breakdown?.map((item) => (
              <div className="currency-row" key={item.currency}>
                <span>{item.currency}</span>
                <strong>{item.total_value}</strong>
                <small>{item.invoice_count} invoices</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel status-panel">
          <div className="panel-heading">
            <div>
              <h3>Validation status</h3>
              <p>Invoice quality overview</p>
            </div>
            <AlertTriangle size={21} />
          </div>

          {[
            {
              label: "Valid",
              value: stats?.validation?.valid ?? 0,
              color: "green-bar",
            },
            {
              label: "Needs review",
              value: stats?.validation?.needs_review ?? 0,
              color: "orange-bar",
            },
            {
              label: "Invalid",
              value: stats?.validation?.invalid ?? 0,
              color: "red-bar",
            },
          ].map((item) => {
            const total = stats?.total_invoices || 0;
            const percentage =
              total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div className="progress-item" key={item.label}>
                <div className="progress-label">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>

                <div className="progress-track">
                  <div
                    className={`progress-fill ${item.color}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <section className="panel recent-invoices">
        <div className="panel-heading">
          <div>
            <h3>Recent invoices</h3>
            <p>Your latest processed invoices</p>
          </div>

          <button
            className="text-button"
            onClick={() => (window.location.href = "/invoices")}
          >
            View all <ArrowUpRight size={15} />
          </button>
        </div>

        {loading ? (
          <p className="empty-state">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="empty-state">No invoices found.</p>
        ) : (
          <div className="table-wrapper">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Validation</th>
                  <th>Approval</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoice_id}>
                    <td>{invoice.invoice_number || "N/A"}</td>
                    <td>
                      {invoice.vendor_name ||
                        invoice.vendor?.vendor_name ||
                        invoice.vendor?.name ||
                        "Unknown"}
                    </td>
                    <td>
                      {invoice.currency || "USD"}{" "}
                      {invoice.total ?? "—"}
                    </td>
                    <td>
                      <span className={`status-badge ${invoice.validation_status}`}>
                        {invoice.validation_status || "Unknown"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${invoice.approval_status}`}>
                        {invoice.approval_status || "Unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="footer-note">
        <span className="online-dot" />
        Connected to InvoiceFlow AI backend
        <span className="footer-version">Version 1.0.0</span>
      </div>
    </section>
  );
};

export default Dashboard;
