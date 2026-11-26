
import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Eye, FileText } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getInvoices } from "../services/api";

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const statusFilter = searchParams.get("status") || "all";

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getInvoices();

      const list = Array.isArray(response)
        ? response
        : response.invoices ||
          response.items ||
          response.results ||
          [];

      setInvoices(list);
    } catch (err) {
      console.error("Invoice loading error:", err);
      setError("Unable to load invoices. Check your backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const vendor =
        invoice.vendor_name ||
        invoice.vendor?.vendor_name ||
        invoice.vendor?.name ||
        "";

      const matchesSearch = [
        vendor,
        invoice.invoice_number,
        invoice.currency,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(search.toLowerCase())
        );

      const matchesStatus =
        statusFilter === "all" ||
        invoice.approval_status === statusFilter ||
        invoice.validation_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const changeFilter = (value) => {
    if (value === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ status: value });
    }
  };

  return (
    <section className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Invoices</h1>
          <p className="subtitle">
            View, search and manage all processed invoices.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={fetchInvoices}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className="panel invoice-management">
        <div className="invoice-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search vendor or invoice number..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value="all">All invoices</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="valid">Valid</option>
            <option value="needs_review">Needs review</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <p className="empty-state">Loading invoices...</p>
        ) : filteredInvoices.length === 0 ? (
          <div className="invoice-empty">
            <FileText size={35} />
            <h3>No invoices found</h3>
            <p>Try changing your search or status filter.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice number</th>
                  <th>Vendor</th>
                  <th>Invoice date</th>
                  <th>Amount</th>
                  <th>Validation</th>
                  <th>Approval</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((invoice) => {
                  const vendor =
                    invoice.vendor_name ||
                    invoice.vendor?.vendor_name ||
                    invoice.vendor?.name ||
                    "Unknown vendor";

                  return (
                    <tr key={invoice.invoice_id}>
                      <td>{invoice.invoice_number || "N/A"}</td>
                      <td>{vendor}</td>
                      <td>{invoice.invoice_date || "—"}</td>
                      <td>
                        {invoice.currency || "USD"}{" "}
                        {invoice.total ?? "—"}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${invoice.validation_status}`}
                        >
                          {invoice.validation_status || "Unknown"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${invoice.approval_status}`}
                        >
                          {invoice.approval_status || "Unknown"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="view-button"
                          onClick={() =>
                            navigate(`/invoices/${invoice.invoice_id}`)
                          }
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </div>
      </section>
    </section>
  );
};

export default Invoices;
