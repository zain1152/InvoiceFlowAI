
import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  CreditCard,
  CalendarDays,
} from "lucide-react";

import {
  getPaymentInvoices,
  getPaymentSummary,
  getOverdueInvoices,
  getPaymentHistory,
  recordPayment,
} from "../services/api";

import "./Payments.css";


function money(amount, currency) {
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


function dateText(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}


function Payments() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [history, setHistory] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);


  // Load all payment information

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        invoiceData,
        summaryData,
        overdueData,
        historyData,
      ] = await Promise.all([
        getPaymentInvoices(),
        getPaymentSummary(),
        getOverdueInvoices(),
        getPaymentHistory(),
      ]);

      setInvoices(invoiceData.invoices || []);
      setSummary(summaryData);
      setOverdue(overdueData.invoices || []);
      setHistory(historyData.transactions || []);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Unable to load payment information."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, []);


  // Filter invoice records

  const filteredInvoices = useMemo(() => {
    const query = search.toLowerCase().trim();

    return invoices.filter((invoice) => {
      const matchesSearch =
        !query ||
        invoice.invoice_number?.toLowerCase().includes(query) ||
        invoice.vendor_name?.toLowerCase().includes(query);

      const matchesFilter =
        filter === "all" ||
        invoice.payment_status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [invoices, search, filter]);


  // Filter transaction history

  const filteredHistory = useMemo(() => {
    const query = historySearch.toLowerCase().trim();

    return history.filter((payment) => {
      return (
        !query ||
        payment.invoice_number?.toLowerCase().includes(query) ||
        payment.vendor_name?.toLowerCase().includes(query) ||
        payment.reference?.toLowerCase().includes(query) ||
        payment.payment_method?.toLowerCase().includes(query)
      );
    });
  }, [history, historySearch]);


  // Open payment modal

  const openPaymentForm = (invoice) => {
    setSelectedInvoice(invoice);

    setAmount(
      Number(invoice.outstanding_balance || 0).toFixed(2)
    );

    setMethod("Bank Transfer");

    setPaymentDate(
      new Date().toISOString().slice(0, 10)
    );

    setReference("");
    setNotes("");
    setError("");
    setSuccess("");
  };


  // Close payment modal

  const closePaymentForm = () => {
    if (saving) return;

    setSelectedInvoice(null);
    setError("");
  };


  // Record payment

  const submitPayment = async (event) => {
    event.preventDefault();

    if (!selectedInvoice) return;

    const paymentAmount = Number(amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (
      paymentAmount >
      Number(selectedInvoice.outstanding_balance)
    ) {
      setError(
        "Payment cannot exceed the outstanding balance."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await recordPayment(
        selectedInvoice.invoice_id,
        {
          amount: paymentAmount,
          payment_method: method,
          payment_date: paymentDate || null,
          reference: reference || null,
          notes: notes || null,
        }
      );

      setSuccess("Payment recorded successfully.");

      setSelectedInvoice(null);

      await loadData();

    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  };


  const currencyTotals =
    summary?.outstanding_by_currency || {};


  return (
    <div className="payments-page">

      {/* PAGE HEADER */}

      <div className="payments-heading">
        <div>
          <span className="eyebrow">
            ACCOUNTS PAYABLE
          </span>

          <h1>Payment Tracking</h1>

          <p>
            Monitor invoice payments, outstanding balances,
            and overdue obligations.
          </p>
        </div>

        <button
          className="payment-refresh"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>


      {error && !selectedInvoice && (
        <div className="payment-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="payment-alert success">
          {success}
        </div>
      )}


      {/* PAYMENT STATISTICS */}

      <section className="payment-kpis">

        <div className="payment-kpi">
          <div className="payment-kpi-icon purple">
            <CalendarDays size={21} />
          </div>

          <span>Total Invoices</span>

          <h2>
            {summary?.total_invoices ?? "—"}
          </h2>
        </div>


        <div className="payment-kpi">
          <div className="payment-kpi-icon green">
            <CheckCircle2 size={21} />
          </div>

          <span>Paid</span>

          <h2>
            {summary?.paid ?? "—"}
          </h2>
        </div>


        <div className="payment-kpi">
          <div className="payment-kpi-icon orange">
            <Clock size={21} />
          </div>

          <span>Unpaid / Partial</span>

          <h2>
            {summary
              ? summary.unpaid + summary.partially_paid
              : "—"}
          </h2>
        </div>


        <div className="payment-kpi">
          <div className="payment-kpi-icon red">
            <AlertTriangle size={21} />
          </div>

          <span>Overdue</span>

          <h2>
            {summary?.overdue ?? "—"}
          </h2>
        </div>

      </section>


      {/* OUTSTANDING BALANCE */}

      <section className="payment-outstanding-panel">

        <div className="payment-outstanding-title">
          <Wallet size={21} />

          <div>
            <h2>Outstanding Balance</h2>

            <p>
              Approved invoices with remaining balances
            </p>
          </div>
        </div>


        <div className="payment-currency-totals">

          {Object.keys(currencyTotals).length === 0 ? (

            <strong>
              No outstanding approved balances
            </strong>

          ) : (

            Object.entries(currencyTotals).map(
              ([currency, value]) => (
                <div key={currency}>
                  <span>{currency}</span>

                  <strong>
                    {money(value, currency)}
                  </strong>
                </div>
              )
            )

          )}

        </div>

      </section>


      {/* OVERDUE INVOICES */}

      <section className="payment-overdue-panel">

        <div className="payment-section-heading">

          <div>
            <h2>
              <AlertTriangle size={18} />
              Overdue Invoices
            </h2>

            <p>
              Approved invoices past their due date
              with a balance remaining
            </p>
          </div>

          <span className="overdue-count">
            {overdue.length} overdue
          </span>

        </div>


        {overdue.length === 0 ? (

          <div className="payment-empty compact">
            No overdue invoices.
          </div>

        ) : (

          <div className="payment-overdue-list">

            {overdue.map((invoice) => (

              <div
                className="payment-overdue-row"
                key={invoice.invoice_id}
              >

                <div>
                  <strong>
                    {invoice.invoice_number || "Invoice"}
                  </strong>

                  <span>
                    {invoice.vendor_name || "Unknown vendor"}
                  </span>
                </div>


                <div>
                  <strong>
                    {money(
                      invoice.outstanding_balance,
                      invoice.currency
                    )}
                  </strong>

                  <span>
                    Due {dateText(invoice.due_date)}
                  </span>
                </div>


                <button
                  onClick={() => openPaymentForm(invoice)}
                  disabled={
                    invoice.approval_status !== "approved"
                  }
                >
                  Record Payment
                </button>

              </div>

            ))}

          </div>

        )}

      </section>


      {/* INVOICE PAYMENT TABLE */}

      <section className="payment-table-panel">

        <div className="payment-section-heading">

          <div>
            <h2>Invoice Payments</h2>

            <p>
              View and manage invoice payment status
            </p>
          </div>

        </div>


        <div className="payment-toolbar">

          <div className="payment-search">
            <Search size={18} />

            <input
              placeholder="Search invoice or vendor..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>


          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">
              Partially paid
            </option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

        </div>


        {loading ? (

          <div className="payment-empty">
            Loading payment records...
          </div>

        ) : filteredInvoices.length === 0 ? (

          <div className="payment-empty">
            No matching invoices found.
          </div>

        ) : (

          <div className="payment-table-wrapper">

            <table className="payment-table">

              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Due Date</th>
                  <th>Invoice Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Payment Status</th>
                  <th>Action</th>
                </tr>
              </thead>


              <tbody>

                {filteredInvoices.map((invoice) => (

                  <tr key={invoice.invoice_id}>

                    <td>
                      <strong>
                        {invoice.invoice_number || "N/A"}
                      </strong>
                    </td>

                    <td>
                      {invoice.vendor_name || "Unknown"}
                    </td>

                    <td>
                      {dateText(invoice.due_date)}
                    </td>

                    <td>
                      {money(
                        invoice.total,
                        invoice.currency
                      )}
                    </td>

                    <td>
                      {money(
                        invoice.amount_paid,
                        invoice.currency
                      )}
                    </td>

                    <td className="payment-balance">
                      {money(
                        invoice.outstanding_balance,
                        invoice.currency
                      )}
                    </td>

                    <td>
                      <span
                        className={`payment-status ${invoice.payment_status}`}
                      >
                        {invoice.payment_status.replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                    </td>

                    <td>
                      <button
                        className="payment-record-button"
                        disabled={
                          invoice.approval_status !== "approved" ||
                          Number(invoice.outstanding_balance) <= 0
                        }
                        onClick={() =>
                          openPaymentForm(invoice)
                        }
                      >
                        {Number(invoice.outstanding_balance) <= 0
                          ? "Paid"
                          : "Record"}
                      </button>
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* TRANSACTION HISTORY */}

      <section className="payment-table-panel">

        <div className="payment-section-heading">

          <div>
            <h2>Transaction History</h2>

            <p>
              Individual payments recorded across all invoices
            </p>
          </div>

          <span className="overdue-count">
            {history.length} transactions
          </span>

        </div>


        <div className="payment-toolbar">

          <div className="payment-search">
            <Search size={18} />

            <input
              placeholder="Search invoice, vendor, reference or method..."
              value={historySearch}
              onChange={(event) =>
                setHistorySearch(event.target.value)
              }
            />
          </div>

        </div>


        {loading ? (

          <div className="payment-empty">
            Loading transaction history...
          </div>

        ) : filteredHistory.length === 0 ? (

          <div className="payment-empty">
            No payment transactions found.
          </div>

        ) : (

          <div className="payment-table-wrapper">

            <table className="payment-table">

              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Balance After Payment</th>
                </tr>
              </thead>


              <tbody>

                {filteredHistory.map((payment) => (

                  <tr key={payment.transaction_id}>

                    <td>
                      {dateText(
                        payment.payment_date ||
                        payment.created_at
                      )}
                    </td>

                    <td>
                      <strong>
                        {payment.invoice_number || "N/A"}
                      </strong>
                    </td>

                    <td>
                      {payment.vendor_name || "Unknown"}
                    </td>

                    <td className="payment-balance">
                      {money(
                        payment.amount,
                        payment.currency
                      )}
                    </td>

                    <td>
                      {payment.payment_method || "—"}
                    </td>

                    <td>
                      {payment.reference || "—"}
                    </td>

                    <td>
                      {money(
                        payment.outstanding_balance,
                        payment.currency
                      )}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* RECORD PAYMENT MODAL */}

      {selectedInvoice && (

        <div
          className="payment-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePaymentForm();
            }
          }}
        >

          <div className="payment-modal">

            <div className="payment-modal-heading">

              <div>
                <span className="eyebrow">
                  PAYMENT ENTRY
                </span>

                <h2>Record Payment</h2>

                <p>
                  {selectedInvoice.invoice_number || "Invoice"}
                  {" · "}
                  {selectedInvoice.vendor_name || "Vendor"}
                </p>
              </div>


              <button
                type="button"
                className="payment-close"
                onClick={closePaymentForm}
                disabled={saving}
              >
                <X size={20} />
              </button>

            </div>


            <div className="payment-modal-balance">

              <span>Outstanding balance</span>

              <strong>
                {money(
                  selectedInvoice.outstanding_balance,
                  selectedInvoice.currency
                )}
              </strong>

            </div>


            <form onSubmit={submitPayment}>

              <label>
                Payment Amount ({selectedInvoice.currency || "USD"})

                <input
                  type="number"
                  min="0.01"
                  max={selectedInvoice.outstanding_balance}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                />
              </label>


              <label>
                Payment Method

                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value)
                  }
                >
                  <option>Bank Transfer</option>
                  <option>Credit Card</option>
                  <option>Debit Card</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Other</option>
                </select>
              </label>


              <label>
                Payment Date

                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(event.target.value)
                  }
                />
              </label>


              <label>
                Transaction Reference

                <input
                  type="text"
                  value={reference}
                  onChange={(event) =>
                    setReference(event.target.value)
                  }
                  placeholder="Optional transaction ID"
                />
              </label>


              <label>
                Notes

                <textarea
                  rows="3"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Optional payment notes"
                />
              </label>


              {error && (
                <div className="payment-alert error">
                  {error}
                </div>
              )}


              <div className="payment-modal-actions">

                <button
                  type="button"
                  className="payment-cancel"
                  onClick={closePaymentForm}
                  disabled={saving}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="payment-submit"
                  disabled={saving}
                >
                  <CreditCard size={17} />

                  {saving
                    ? "Saving..."
                    : "Save Payment"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}


export default Payments;
