
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import InvoiceDetails from "./pages/InvoiceDetails";
import UploadInvoice from "./pages/UploadInvoice";
import Vendors from "./pages/Vendors";
import VendorDetails from "./pages/VendorDetails";
import Payments from "./pages/Payments.jsx";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />

        <main className="main-content">
          <Topbar />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route
              path="/invoices/:invoiceId"
              element={<InvoiceDetails />}
            />
            <Route path="/upload" element={<UploadInvoice />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route
              path="/vendors/:vendorId"
              element={<VendorDetails />}
            />
            <Route path="/payments" element={<Payments />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
