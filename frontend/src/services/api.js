
import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

export const getInvoices = async (params = {}) => {
  const response = await api.get("/", { params });
  return response.data;
};

export const getInvoiceStats = async () => {
  const response = await api.get("/stats");
  return response.data;
};

export const getInvoiceDetails = async (invoiceId) => {
  const response = await api.get(`/${invoiceId}`);
  return response.data;
};

export const updateInvoiceApproval = async (
  invoiceId,
  status,
  comments = ""
) => {
  const response = await api.patch(`/${invoiceId}/approval`, {
    status,
    comments,
  });

  return response.data;
};

export const uploadInvoice = async (file, onProgress) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(
          Math.round((event.loaded * 100) / event.total)
        );
      }
    },
  });

  return response.data;
};

// Vendor APIs

export const getVendors = async () => {
  const response = await api.get("/vendors/");
  return response.data;
};

export const getVendorDetails = async (vendorId) => {
  const response = await api.get(`/vendors/${vendorId}`);
  return response.data;
};

// Payment APIs

export const getPaymentInvoices = async () => {
  const response = await api.get("/payments/");
  return response.data;
};

export const getPaymentSummary = async () => {
  const response = await api.get("/payments/summary");
  return response.data;
};

export const getOverdueInvoices = async () => {
  const response = await api.get("/payments/overdue");
  return response.data;
};

export const getInvoicePayment = async (invoiceId) => {
  const response = await api.get(`/payments/${invoiceId}`);
  return response.data;
};

export const recordPayment = async (invoiceId, paymentData) => {
  const response = await api.post(
    `/payments/${invoiceId}/record`,
    paymentData
  );

  return response.data;
};

export default api;
export const getPaymentHistory = async () => {
  const response = await api.get("/payments/history");
  return response.data;
};

export const getNotifications = async (unreadOnly = false) => {
  const response = await api.get("/notifications/", {
    params: { unread_only: unreadOnly },
  });

  return response.data;
};

export const getUnreadNotificationCount = async () => {
  const response = await api.get("/notifications/unread-count");
  return response.data;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.patch(
    `/notifications/${notificationId}/read`
  );

  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};

export const generateNotifications = async () => {
  const response = await api.post("/notifications/generate");
  return response.data;
};
