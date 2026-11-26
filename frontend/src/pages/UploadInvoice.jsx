
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  LoaderCircle,
  ArrowRight,
  RefreshCw,
  FileCheck,
} from "lucide-react";

import {
  uploadInvoice,
  getInvoiceDetails,
} from "../services/api";

import "./UploadInvoice.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const UploadInvoice = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Select and validate PDF
  const selectFile = (selectedFile) => {
    setError("");
    setResult(null);

    if (!selectedFile) return;

    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFile(null);
      setError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The maximum allowed file size is 10 MB.");
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setError("The selected file is empty.");
      return;
    }

    setFile(selectedFile);
  };

  // Drag and drop
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    if (isUploading) return;

    selectFile(event.dataTransfer.files?.[0]);
  };

  // Upload invoice to FastAPI
  const handleUpload = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setProgress(0);
    setError("");
    setResult(null);

    try {
      const response = await uploadInvoice(
        file,
        setProgress
      );

      let finalResult = response;

      // Locate invoice ID in common response formats
      const invoiceId =
        response?.invoice_id ||
        response?.invoice?.invoice_id ||
        response?.data?.invoice_id ||
        response?.data?.invoice?.invoice_id ||
        response?.id;

      // Fetch the saved invoice details if an ID was returned
      if (invoiceId) {
        try {
          const details = await getInvoiceDetails(invoiceId);

          finalResult = {
            ...response,
            invoice: details,
          };
        } catch {
          // Keep the original upload response if detail retrieval fails
        }
      }

      setProgress(100);
      setResult(finalResult);
    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : detail
            ? JSON.stringify(detail)
            : err.response?.data?.message ||
              err.message ||
              "Invoice processing failed. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const resetUpload = () => {
    setFile(null);
    setResult(null);
    setError("");
    setProgress(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Extract invoice information from API response
  const invoice =
    result?.invoice ||
    result?.data?.invoice ||
    result?.data ||
    result ||
    {};

  const extracted =
    invoice?.extracted_data ||
    invoice?.invoice_data ||
    invoice?.extracted_invoice ||
    result?.extracted_data ||
    result?.invoice_data ||
    {};

  const validation =
    invoice?.validation ||
    invoice?.validation_result ||
    result?.validation ||
    result?.validation_result ||
    {};

  const errors =
    invoice?.validation_errors ||
    validation?.errors ||
    result?.validation_errors ||
    [];

  const warnings =
    invoice?.validation_warnings ||
    validation?.warnings ||
    result?.validation_warnings ||
    [];

  const invoiceId =
    invoice?.invoice_id ||
    invoice?.id ||
    result?.invoice_id ||
    result?.id;

  const vendorName =
    invoice?.vendor?.name ||
    invoice?.vendor?.vendor_name ||
    invoice?.vendor_name ||
    extracted?.vendor_name;

  const invoiceNumber =
    invoice?.invoice_number ||
    extracted?.invoice_number;

  const invoiceDate =
    invoice?.invoice_date ||
    extracted?.invoice_date;

  const dueDate =
    invoice?.due_date ||
    extracted?.due_date;

  const currency =
    invoice?.currency ||
    extracted?.currency ||
    "";

  const total =
    invoice?.total ??
    extracted?.total;

  const validationStatus =
    invoice?.validation_status ||
    validation?.status ||
    result?.validation_status ||
    "processed";

  const items =
    invoice?.items ||
    extracted?.items ||
    [];

  const formatAmount = (value) => {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }

    const amount = Number(value);

    if (Number.isNaN(amount)) {
      return String(value);
    }

    return `${currency} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`.trim();
  };

  const formatIssue = (item) => {
    if (typeof item === "string") return item;

    return (
      item?.message ||
      item?.description ||
      JSON.stringify(item)
    );
  };

  return (
    <div className="upload-page">

      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">INVOICE PROCESSING</p>
          <h1>Upload Invoice</h1>
          <p className="subtitle">
            Upload a PDF invoice and let AI extract and validate its data.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => navigate("/invoices")}
        >
          <FileText size={16} />
          View invoices
        </button>
      </div>

      {/* UPLOAD LAYOUT */}
      <div className="upload-layout">

        {/* MAIN UPLOAD PANEL */}
        <section className="panel upload-main-panel">

          <div className="panel-heading">
            <h3>Upload your document</h3>
            <span>PDF only · Maximum 10 MB</span>
          </div>

          {!result && (
            <>
              {/* DROP ZONE */}
              <div
                className={`drop-zone ${
                  isDragging ? "dragging" : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isUploading) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isUploading) {
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();

                    if (!isUploading) {
                      fileInputRef.current?.click();
                    }
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />

                <div className="upload-icon">
                  <UploadCloud size={34} />
                </div>

                <h3>Drag and drop your invoice here</h3>

                <p>
                  Or click to browse files from your computer
                </p>

                <span className="browse-button">
                  Browse PDF files
                </span>
              </div>

              {/* SELECTED FILE */}
              {file && (
                <div className="selected-file">
                  <div className="selected-file-icon">
                    <FileText size={22} />
                  </div>

                  <div className="selected-file-info">
                    <strong>{file.name}</strong>
                    <span>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  <button
                    className="remove-file-button"
                    onClick={resetUpload}
                    disabled={isUploading}
                    aria-label="Remove selected file"
                  >
                    <XCircle size={19} />
                  </button>
                </div>
              )}

              {/* PROGRESS */}
              {isUploading && (
                <div className="upload-progress">
                  <div className="progress-heading">
                    <span>
                      {progress >= 100
                        ? "Processing invoice..."
                        : "Uploading document..."}
                    </span>

                    <strong>{progress}%</strong>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill green-bar"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p>
                    Please wait while the server processes your invoice.
                  </p>
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div className="upload-error">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {/* UPLOAD BUTTON */}
              <button
                className="primary-button upload-submit"
                onClick={handleUpload}
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <>
                    <LoaderCircle
                      className="spin-icon"
                      size={17}
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadCloud size={17} />
                    Upload and process invoice
                  </>
                )}
              </button>
            </>
          )}

          {/* SUCCESS RESULT */}
          {result && (
            <div className="upload-result">

              <div className="result-success-icon">
                <CheckCircle2 size={34} />
              </div>

              <h2>Invoice processed</h2>

              <p>
                Your document was successfully submitted for processing.
              </p>

              <div className="result-summary">

                <div>
                  <span>File</span>
                  <strong>{file?.name || "Uploaded invoice"}</strong>
                </div>

                <div>
                  <span>Vendor</span>
                  <strong>{vendorName || "Not available"}</strong>
                </div>

                <div>
                  <span>Invoice number</span>
                  <strong>{invoiceNumber || "Not available"}</strong>
                </div>

                <div>
                  <span>Validation status</span>
                  <strong className="capitalize">
                    {String(validationStatus).replaceAll("_", " ")}
                  </strong>
                </div>

                <div>
                  <span>Invoice total</span>
                  <strong>{formatAmount(total)}</strong>
                </div>

              </div>

              <div className="result-actions">

                {invoiceId && (
                  <button
                    className="primary-button"
                    onClick={() =>
                      navigate(`/invoices/${invoiceId}`)
                    }
                  >
                    View invoice details
                    <ArrowRight size={16} />
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={resetUpload}
                >
                  <RefreshCw size={15} />
                  Upload another
                </button>

              </div>
            </div>
          )}
        </section>

        {/* INFORMATION SIDEBAR */}
        <aside className="upload-side-panel">

          <div className="panel">
            <h3>How it works</h3>

            <div className="upload-step">
              <div className="step-number">01</div>
              <div>
                <strong>Upload document</strong>
                <p>Select a PDF invoice from your computer.</p>
              </div>
            </div>

            <div className="upload-step">
              <div className="step-number">02</div>
              <div>
                <strong>AI extraction</strong>
                <p>Gemini identifies invoice details and line items.</p>
              </div>
            </div>

            <div className="upload-step">
              <div className="step-number">03</div>
              <div>
                <strong>Validation</strong>
                <p>Check totals, required fields and possible issues.</p>
              </div>
            </div>

            <div className="upload-step">
              <div className="step-number">04</div>
              <div>
                <strong>Review and approve</strong>
                <p>Review the extracted invoice before approval.</p>
              </div>
            </div>
          </div>

          <div className="panel upload-security-panel">
            <div className="security-icon">
              <CheckCircle2 size={20} />
            </div>

            <h3>Human approval required</h3>

            <p>
              AI assists with extraction and validation.
              Payment approval remains a human decision.
            </p>
          </div>

        </aside>
      </div>

      {/* EXTRACTION DETAILS */}
      {result && (
        <section className="panel extraction-panel">

          <div className="panel-heading">
            <h3>Extracted invoice information</h3>
            <span>AI extraction output</span>
          </div>

          <div className="extraction-grid">

            <div className="extraction-field">
              <span>Vendor</span>
              <strong>{vendorName || "Not found"}</strong>
            </div>

            <div className="extraction-field">
              <span>Invoice number</span>
              <strong>{invoiceNumber || "Not found"}</strong>
            </div>

            <div className="extraction-field">
              <span>Invoice date</span>
              <strong>{invoiceDate || "Not found"}</strong>
            </div>

            <div className="extraction-field">
              <span>Due date</span>
              <strong>{dueDate || "Not found"}</strong>
            </div>

            <div className="extraction-field">
              <span>Subtotal</span>
              <strong>
                {formatAmount(
                  invoice?.subtotal ?? extracted?.subtotal
                )}
              </strong>
            </div>

            <div className="extraction-field">
              <span>Tax</span>
              <strong>
                {formatAmount(
                  invoice?.tax ?? extracted?.tax
                )}
              </strong>
            </div>

            <div className="extraction-field">
              <span>Total</span>
              <strong>{formatAmount(total)}</strong>
            </div>

            <div className="extraction-field">
              <span>Customer</span>
              <strong>
                {invoice?.customer_name ||
                  extracted?.customer_name ||
                  "Not found"}
              </strong>
            </div>

          </div>

          {/* VALIDATION ERRORS */}
          {Array.isArray(errors) && errors.length > 0 && (
            <div className="validation-message validation-error">
              <h4>
                <XCircle size={17} />
                Validation errors
              </h4>

              {errors.map((item, index) => (
                <p key={index}>{formatIssue(item)}</p>
              ))}
            </div>
          )}

          {/* VALIDATION WARNINGS */}
          {Array.isArray(warnings) && warnings.length > 0 && (
            <div className="validation-message validation-warning">
              <h4>
                <AlertTriangle size={17} />
                Validation warnings
              </h4>

              {warnings.map((item, index) => (
                <p key={index}>{formatIssue(item)}</p>
              ))}
            </div>
          )}

          {/* LINE ITEMS */}
          {Array.isArray(items) && items.length > 0 && (
            <div className="extracted-items">

              <h4>Extracted line items</h4>

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
                      <tr key={index}>
                        <td>{item.description || "—"}</td>
                        <td>{item.quantity ?? "—"}</td>
                        <td>{item.unit_price ?? "—"}</td>
                        <td>{item.line_total ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {invoiceId && (
            <button
              className="secondary-button extraction-view-button"
              onClick={() =>
                navigate(`/invoices/${invoiceId}`)
              }
            >
              <FileCheck size={16} />
              Open saved invoice
            </button>
          )}

        </section>
      )}
    </div>
  );
};

export default UploadInvoice;
