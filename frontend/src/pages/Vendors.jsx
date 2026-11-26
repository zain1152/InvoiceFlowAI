
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  Search,
  RefreshCw,
  Wallet,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

import { getVendors } from "../services/api";
import "./Vendors.css";

function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency || ""} ${Number(amount || 0).toFixed(2)}`;
  }
}

function Vendors() {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getVendors();
      setVendors(data.vendors || []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load vendors. Please check your backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const filteredVendors = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return vendors;

    return vendors.filter((vendor) => {
      return (
        vendor.vendor_name?.toLowerCase().includes(query) ||
        vendor.tax_id?.toLowerCase().includes(query)
      );
    });
  }, [vendors, search]);

  const totalInvoices = vendors.reduce(
    (sum, vendor) => sum + Number(vendor.invoice_count || 0),
    0
  );

  const currencies = [
    ...new Set(
      vendors.flatMap((vendor) =>
        (vendor.spending_by_currency || []).map(
          (item) => item.currency
        )
      )
    ),
  ];

  return (
    <div className="vendors-page">
      <div className="vendors-heading">
        <div>
          <span className="eyebrow">BUSINESS DIRECTORY</span>
          <h1>Vendors</h1>
          <p>Manage suppliers and monitor their invoice activity.</p>
        </div>

        <button
          className="vendor-refresh-button"
          onClick={loadVendors}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="vendor-stats">
        <div className="vendor-stat-card">
          <div className="vendor-stat-icon purple">
            <Building2 size={21} />
          </div>
          <span>Total Vendors</span>
          <h2>{vendors.length}</h2>
        </div>

        <div className="vendor-stat-card">
          <div className="vendor-stat-icon blue">
            <FileText size={21} />
          </div>
          <span>Total Invoices</span>
          <h2>{totalInvoices}</h2>
        </div>

        <div className="vendor-stat-card">
          <div className="vendor-stat-icon green">
            <Wallet size={21} />
          </div>
          <span>Active Currencies</span>
          <h2>{currencies.length}</h2>
        </div>
      </div>

      <section className="vendors-panel">
        <div className="vendors-panel-heading">
          <div>
            <h2>Vendor Directory</h2>
            <p>{filteredVendors.length} vendors found</p>
          </div>

          <div className="vendor-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search vendor or tax ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="vendor-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="vendor-empty">Loading vendors...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="vendor-empty">
            <Building2 size={35} />
            <h3>No vendors found</h3>
            <p>
              Vendors will appear here when their invoices are processed.
            </p>
          </div>
        ) : (
          <div className="vendor-table-wrapper">
            <table className="vendor-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Tax ID</th>
                  <th>Invoices</th>
                  <th>Spending by Currency</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.vendor_id}
                    className="vendor-clickable-row"
                    onClick={() =>
                      navigate(`/vendors/${vendor.vendor_id}`)
                    }
                  >
                    <td>
                      <div className="vendor-name-cell">
                        <div className="vendor-avatar">
                          {vendor.vendor_name
                            ?.charAt(0)
                            ?.toUpperCase() || "V"}
                        </div>
                        <strong>{vendor.vendor_name}</strong>
                      </div>
                    </td>

                    <td>{vendor.tax_id || "Not provided"}</td>

                    <td>
                      <span className="vendor-invoice-count">
                        {vendor.invoice_count}
                      </span>
                    </td>

                    <td>
                      <div className="vendor-spending">
                        {(vendor.spending_by_currency || []).length > 0
                          ? vendor.spending_by_currency.map((item) => (
                              <span key={item.currency}>
                                {formatAmount(
                                  item.total_spend,
                                  item.currency
                                )}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>

                    <td>
                      {vendor.created_at
                        ? new Date(
                            vendor.created_at
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td>
                      <ChevronRight size={18} />
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

export default Vendors;
