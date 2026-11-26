
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Bell,
  Search,
  Menu,
  CheckCheck,
  Clock,
  AlertTriangle,
  FileText,
  CreditCard,
  X,
} from "lucide-react";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/api";

const formatTime = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getNotificationIcon = (type) => {
  if (type === "overdue") return AlertTriangle;
  if (type === "due_soon") return Clock;
  if (type === "payment_completed") return CreditCard;
  return FileText;
};

const Topbar = () => {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotificationData = async () => {
    try {
      const [notificationData, countData] = await Promise.all([
        getNotifications(false),
        getUnreadNotificationCount(),
      ]);

      setNotifications(notificationData.notifications || []);
      setUnreadCount(countData.unread_count || 0);
      setError("");
    } catch (err) {
      console.error("Notification loading failed:", err);
      setError("Unable to load notifications.");
    }
  };

  useEffect(() => {
    loadNotificationData();

    const interval = setInterval(() => {
      loadNotificationData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const toggleNotifications = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      setLoading(true);
      await loadNotificationData();
      setLoading(false);
    }
  };

  const handleMarkRead = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.notification_id);
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.notification_id === notification.notification_id
            ? { ...item, is_read: true }
            : item
        )
      );

      if (!notification.is_read) {
        setUnreadCount((previous) => Math.max(0, previous - 1));
      }

      setIsOpen(false);

      if (notification.invoice_id) {
        navigate(`/invoices/${notification.invoice_id}`);
      }
    } catch (err) {
      console.error("Unable to mark notification as read:", err);
      setError("Unable to update notification.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          is_read: true,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error("Unable to mark all notifications as read:", err);
      setError("Unable to update notifications.");
    }
  };

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <Menu size={21} />
        <strong>InvoiceFlow</strong>
      </div>

      <div className="topbar-breadcrumb">
        <span>Workspace</span>
        <span className="breadcrumb-divider">/</span>
        <strong>InvoiceFlow</strong>
      </div>

      <div className="topbar-actions">
        <button className="icon-button" aria-label="Search">
          <Search size={19} />
        </button>

        <div className="notification-wrapper">
          <button
            className={`icon-button notification-bell ${
              isOpen ? "notification-active" : ""
            }`}
            aria-label="Notifications"
            aria-expanded={isOpen}
            onClick={toggleNotifications}
          >
            <Bell size={20} />

            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="notification-dropdown">
              <div className="notification-dropdown-header">
                <div>
                  <h3>Notifications</h3>
                  <p>
                    {unreadCount} unread notification
                    {unreadCount === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="notification-header-actions">
                  {unreadCount > 0 && (
                    <button
                      className="mark-all-button"
                      onClick={handleMarkAllRead}
                      title="Mark all as read"
                    >
                      <CheckCheck size={16} />
                      <span>Mark all read</span>
                    </button>
                  )}

                  <button
                    className="notification-close"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close notifications"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="notification-error">{error}</div>
              )}

              <div className="notification-list">
                {loading ? (
                  <div className="notification-empty">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={28} />
                    <strong>You're all caught up!</strong>
                    <span>No notifications available.</span>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = getNotificationIcon(
                      notification.notification_type
                    );

                    return (
                      <button
                        key={notification.notification_id}
                        className={`notification-item ${
                          notification.is_read ? "is-read" : "is-unread"
                        }`}
                        onClick={() => handleMarkRead(notification)}
                      >
                        <div
                          className={`notification-item-icon ${
                            notification.severity || "info"
                          }`}
                        >
                          <Icon size={18} />
                        </div>

                        <div className="notification-item-content">
                          <div className="notification-item-heading">
                            <strong>{notification.title}</strong>
                            {!notification.is_read && (
                              <span className="unread-dot" />
                            )}
                          </div>

                          <p>{notification.message}</p>

                          {notification.invoice_number && (
                            <span className="notification-invoice">
                              Invoice: {notification.invoice_number}
                            </span>
                          )}

                          <span className="notification-time">
                            {formatTime(notification.created_at)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="notification-dropdown-footer">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/invoices");
                  }}
                >
                  View invoices
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="top-avatar">IF</div>
      </div>
    </header>
  );
};

export default Topbar;
