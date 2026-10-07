
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaBox,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaShoppingBag,
  FaMapMarkerAlt,
  FaCreditCard,
  FaUndo,
  FaBan,
  FaChevronDown,
  FaChevronUp,
  FaReceipt,
  FaHeadset,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaTag,
} from "react-icons/fa";

import { orderService } from "../services/api";
import { getOrderGst } from "../utils/gst";
import "../styles/OrdersPage.css";

const STATUS_STEPS = ["Pending", "Confirmed", "Shipped", "Delivered"];

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [filter, setFilter] = useState("All");

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showAfterDeliveryModal, setShowAfterDeliveryModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reason, setReason] = useState("");

  const [afterDeliveryType, setAfterDeliveryType] = useState("Return");
  const [returnPaymentMethod, setReturnPaymentMethod] = useState("");
  const [returnPaymentDetails, setReturnPaymentDetails] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await orderService.getUserOrders();

      setOrders(
        Array.isArray(data.data)
          ? data.data
          : data.data || []
      );
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (amount) => {
    const value = Number(amount || 0);

    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  };

  const getStatusStep = (status) => {
    return STATUS_STEPS.indexOf(status);
  };

  const getStatusMeta = (status) => {
    const map = {
      Pending: {
        color: "#f59e0b",
        bg: "#fffbeb",
        border: "#fcd34d",
        label: "Order Placed",
      },

      Confirmed: {
        color: "#3b82f6",
        bg: "#eff6ff",
        border: "#93c5fd",
        label: "Confirmed",
      },

      Shipped: {
        color: "#8b5cf6",
        bg: "#f5f3ff",
        border: "#c4b5fd",
        label: "Shipped",
      },

      Delivered: {
        color: "#10b981",
        bg: "#f0fdf4",
        border: "#6ee7b7",
        label: "Delivered",
      },

      Cancelled: {
        color: "#ef4444",
        bg: "#fef2f2",
        border: "#fca5a5",
        label: "Cancelled",
      },
    };

    return (
      map[status] || {
        color: "#6b7280",
        bg: "#f3f4f6",
        border: "#d1d5db",
        label: status,
      }
    );
  };

  const isWithinSevenDays = (date) => {
    if (!date) return false;

    const difference = new Date() - new Date(date);

    return difference >= 0 &&
      difference <= 7 * 24 * 60 * 60 * 1000;
  };

  const getAfterDeliveryBadge = (request) => {
    if (!request || request.status === "None") {
      return null;
    }

    const map = {
      Requested: {
        color: "#f59e0b",
        bg: "#fffbeb",
        label: `${request.type} Requested`,
      },

      Approved: {
        color: "#3b82f6",
        bg: "#eff6ff",
        label: `${request.type} Approved`,
      },

      Processed: {
        color: "#10b981",
        bg: "#f0fdf4",
        label: `${request.type} Processed`,
      },

      Rejected: {
        color: "#ef4444",
        bg: "#fef2f2",
        label: `${request.type} Rejected`,
      },
    };

    return map[request.status] || null;
  };

  const getRefundBadge = (refundInfo) => {
    if (!refundInfo || refundInfo.status === "None") {
      return null;
    }

    const map = {
      Requested: {
        color: "#f59e0b",
        bg: "#fffbeb",
        label: "Refund Requested",
      },

      Approved: {
        color: "#3b82f6",
        bg: "#eff6ff",
        label: "Refund Approved",
      },

      Processed: {
        color: "#10b981",
        bg: "#f0fdf4",
        label: "Refund Processed",
      },

      Rejected: {
        color: "#ef4444",
        bg: "#fef2f2",
        label: "Refund Rejected",
      },
    };

    return map[refundInfo.status] || null;
  };

  /*
   * Calculate the actual product subtotal.
   *
   * IMPORTANT:
   * No GST is added here.
   *
   * item.price is treated as the product price.
   * item.discount is the product-level discount percentage.
   */
  const calculateItemsSubtotal = (order) => {
    if (!order?.items || !Array.isArray(order.items)) {
      return 0;
    }

    return order.items.reduce((total, item) => {
      const price = Number(item.price || 0);
      const quantity = Number(item.quantity || 1);
      const discount = Number(item.discount || 0);

      const discountedPrice =
        price * (1 - discount / 100);

      return total + discountedPrice * quantity;
    }, 0);
  };

  /*
   * Coupon discount.
   *
   * Different backends can store coupon discount with different names,
   * so we support the common possibilities.
   */
  const getCouponDiscount = (order) => {
    if (!order) return 0;

    const possibleValues = [
      order.couponDiscount,
      order.discountAmount,
      order.couponAmount,
      order.coupon?.discountAmount,
      order.coupon?.amount,
      order.appliedCoupon?.discountAmount,
      order.appliedCoupon?.amount,
    ];

    const value = possibleValues.find(
      (item) =>
        item !== undefined &&
        item !== null &&
        !Number.isNaN(Number(item))
    );

    return Number(value || 0);
  };

  const getCouponCode = (order) => {
    if (!order) return "";

    return (
      order.couponCode ||
      order.coupon?.code ||
      order.appliedCoupon?.code ||
      ""
    );
  };

  /*
   * Final amount.
   *
   * Backend's totalPrice is treated as the final paid amount.
   * No GST is added on frontend.
   */
  const getFinalTotal = (order) => {
    return Number(
      order?.totalPrice ??
      order?.totalAmount ??
      0
    );
  };

  /*
   * GST is NOT added to the price. The paid amount (totalPrice) is
   * treated as GST-inclusive and split into Taxable + CGST + SGST
   * for display only.
   */
  const filteredOrders =
    filter === "All"
      ? orders
      : orders.filter((order) => order.status === filter);

  const handleCancelOrder = async () => {
    if (!reason.trim()) {
      showToast(
        "Please provide a cancellation reason",
        "error"
      );
      return;
    }

    setActionLoading(true);

    try {
      await orderService.cancelOrder(
        selectedOrder._id,
        { reason }
      );

      await fetchOrders();

      setShowCancelModal(false);
      setReason("");

      const wasPaid =
        selectedOrder.paymentStatus === "Completed";

      showToast(
        wasPaid
          ? "Order cancelled. You can request a refund from the cancelled order details."
          : "Order cancelled successfully."
      );
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          "Failed to cancel order",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!reason.trim()) {
      showToast(
        "Please provide a refund reason",
        "error"
      );
      return;
    }

    if (!returnPaymentMethod) {
      showToast(
        "Please select a return payment method",
        "error"
      );
      return;
    }

    if (!returnPaymentDetails.trim()) {
      showToast(
        "Please provide return payment details",
        "error"
      );
      return;
    }

    setActionLoading(true);

    try {
      await orderService.requestRefund(
        selectedOrder._id,
        {
          reason,
          returnPaymentMethod,
          returnPaymentDetails,
        }
      );

      await fetchOrders();

      setShowRefundModal(false);
      setReason("");
      setReturnPaymentMethod("");
      setReturnPaymentDetails("");

      showToast(
        "Refund request submitted. Processed within 5-7 business days."
      );
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          "Failed to request refund",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestAfterDelivery = async () => {
    if (!reason.trim()) {
      showToast(
        `Please provide a ${afterDeliveryType.toLowerCase()} reason`,
        "error"
      );
      return;
    }

    if (afterDeliveryType === "Return") {
      if (!returnPaymentMethod) {
        showToast(
          "Please select a return payment method",
          "error"
        );
        return;
      }

      if (!returnPaymentDetails.trim()) {
        showToast(
          "Please provide return payment details",
          "error"
        );
        return;
      }
    }

    setActionLoading(true);

    try {
      await orderService.requestAfterDeliveryAction(
        selectedOrder._id,
        {
          type: afterDeliveryType,
          reason,

          returnPaymentMethod:
            afterDeliveryType === "Return"
              ? returnPaymentMethod
              : undefined,

          returnPaymentDetails:
            afterDeliveryType === "Return"
              ? returnPaymentDetails
              : undefined,
        }
      );

      await fetchOrders();

      setShowAfterDeliveryModal(false);
      setReason("");
      setAfterDeliveryType("Return");
      setReturnPaymentMethod("");
      setReturnPaymentDetails("");

      showToast(
        `${afterDeliveryType} request submitted successfully.`
      );
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          `Failed to submit ${afterDeliveryType.toLowerCase()} request`,
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="op-page">
        <div className="op-loading">
          <div className="op-spinner" />
          <p>Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="op-page">

      {/* Toast */}
      {toast && (
        <div
          className={`op-toast op-toast--${toast.type}`}
        >
          {toast.type === "error" ? (
            <FaExclamationTriangle />
          ) : (
            <FaCheckCircle />
          )}

          <span>{toast.msg}</span>
        </div>
      )}

      <div className="op-container">

        {/* Header */}
        <div className="op-header">
          <div className="op-header-left">
            <FaShoppingBag className="op-header-icon" />

            <div>
              <h1>My Orders</h1>

              <p>
                {orders.length} order
                {orders.length !== 1 ? "s" : ""} placed
              </p>
            </div>
          </div>

          <Link
            to="/products"
            className="op-shop-btn"
          >
            Continue Shopping
          </Link>
        </div>

        {/* Filters */}
        <div className="op-filters">
          {[
            "All",
            "Pending",
            "Confirmed",
            "Shipped",
            "Delivered",
            "Cancelled",
          ].map((status) => (
            <button
              key={status}
              className={`op-filter${
                filter === status
                  ? " op-filter--active"
                  : ""
              }`}
              onClick={() => setFilter(status)}
            >
              {status}

              <span className="op-filter-count">
                {status === "All"
                  ? orders.length
                  : orders.filter(
                      (order) =>
                        order.status === status
                    ).length}
              </span>
            </button>
          ))}
        </div>

        {/* Empty */}
        {filteredOrders.length === 0 ? (
          <div className="op-empty">
            <FaBox
              size={60}
              color="#d1d5db"
            />

            <h2>No orders found</h2>

            <p>
              {filter === "All"
                ? "You haven't placed any orders yet."
                : `No ${filter} orders.`}
            </p>

            <Link
              to="/products"
              className="op-shop-btn"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="op-list">

            {filteredOrders.map((order) => {
              const meta =
                getStatusMeta(order.status);

              const refundBadge =
                getRefundBadge(
                  order.refundInfo
                );

              const afterDeliveryBadge =
                getAfterDeliveryBadge(
                  order.afterDeliveryRequest
                );

              const isExpanded =
                expandedOrderId === order._id;

              const stepIdx =
                getStatusStep(order.status);

              const isCancelled =
                order.status === "Cancelled";

              const canCancel = [
                "Pending",
                "Confirmed",
              ].includes(order.status);

              const canRefund =
                order.status === "Cancelled" &&
                order.paymentStatus === "Completed" &&
                (!order.refundInfo ||
                  order.refundInfo.status === "None");

              const canAfterDeliveryRequest =
                order.status === "Delivered" &&
                isWithinSevenDays(
                  order.deliveredAt
                ) &&
                (!order.afterDeliveryRequest ||
                  order.afterDeliveryRequest.status ===
                    "None");

              const couponDiscount =
                getCouponDiscount(order);

              // Subtotal shown = amount paid + coupon, so that
              // Subtotal - Coupon = Total Paid always holds.
              const itemsSubtotal =
                getFinalTotal(order) + couponDiscount ||
                calculateItemsSubtotal(order);

              const couponCode =
                getCouponCode(order);

              const finalTotal =
                getFinalTotal(order);

              const gstInfo =
                getOrderGst(order);

              return (
                <div
                  key={order._id}
                  className="op-card"
                >

                  {/* Top Bar */}
                  <div
                    className="op-card-topbar"
                    style={{
                      borderTopColor: meta.color,
                    }}
                  >
                    <div className="op-card-topbar-left">

                      <span className="op-order-id">
                        <FaReceipt />

                        Order #
                        {order._id
                          .slice(-8)
                          .toUpperCase()}
                      </span>

                      <span className="op-order-date">
                        {formatDate(
                          order.orderDate ||
                            order.createdAt
                        )}
                      </span>
                    </div>

                    <div className="op-card-topbar-right">

                      {refundBadge && (
                        <span
                          className="op-refund-badge"
                          style={{
                            color:
                              refundBadge.color,
                            background:
                              refundBadge.bg,
                          }}
                        >
                          <FaUndo />

                          {refundBadge.label}
                        </span>
                      )}

                      {afterDeliveryBadge && (
                        <span
                          className="op-refund-badge"
                          style={{
                            color:
                              afterDeliveryBadge.color,
                            background:
                              afterDeliveryBadge.bg,
                          }}
                        >
                          {afterDeliveryBadge.label}
                        </span>
                      )}

                      <span
                        className="op-status-pill"
                        style={{
                          color: meta.color,
                          background: meta.bg,
                          borderColor:
                            meta.border,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="op-items-preview">

                    {order.items
                      .slice(0, 3)
                      .map((item, index) => (
                        <div
                          key={index}
                          className="op-item-row"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={
                                item.productName
                              }
                              className="op-item-img"
                            />
                          ) : (
                            <div className="op-item-img op-item-img--placeholder">
                              <FaBox />
                            </div>
                          )}

                          <div className="op-item-meta">

                            <p className="op-item-name">
                              {item.productName}
                            </p>

                            {item.category && (
                              <span className="op-item-cat">
                                <FaTag />

                                {item.category}
                              </span>
                            )}

                            <span className="op-item-qty">
                              Qty: {item.quantity}
                            </span>
                          </div>

                          <p className="op-item-price">
                            Rs.
                            {formatAmount(
                              Number(
                                item.price || 0
                              ) *
                                Number(
                                  item.quantity ||
                                    1
                                )
                            )}
                          </p>
                        </div>
                      ))}

                    {order.items.length > 3 && (
                      <p className="op-more-items">
                        +
                        {order.items.length -
                          3}{" "}
                        more item(s)
                      </p>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="op-summary-row">

                    <div className="op-summary-info">

                      <span>
                        <FaCreditCard />

                        {order.paymentMethod}
                      </span>

                      <span
                        className={`op-pay-status op-pay-status--${(
                          order.paymentStatus ||
                          ""
                        ).toLowerCase()}`}
                      >
                        {order.paymentStatus ||
                          "Pending"}
                      </span>
                    </div>

                    <div className="op-summary-total">

                      <span>Total</span>

                      <strong>
                        Rs.
                        {formatAmount(
                          finalTotal
                        )}
                      </strong>
                    </div>
                  </div>

                  {/* Timeline */}
                  {!isCancelled && (
                    <div className="op-timeline">

                      {STATUS_STEPS.map(
                        (step, index) => (
                          <React.Fragment
                            key={step}
                          >
                            <div
                              className={`op-step${
                                index <=
                                stepIdx
                                  ? " op-step--done"
                                  : ""
                              }${
                                index ===
                                stepIdx
                                  ? " op-step--current"
                                  : ""
                              }`}
                            >
                              <div className="op-step-dot">

                                {index <=
                                stepIdx ? (
                                  <FaCheckCircle />
                                ) : (
                                  <span>
                                    {index + 1}
                                  </span>
                                )}
                              </div>

                              <span className="op-step-label">
                                {step}
                              </span>
                            </div>

                            {index <
                              STATUS_STEPS.length -
                                1 && (
                              <div
                                className={`op-step-line${
                                  index <
                                  stepIdx
                                    ? " op-step-line--done"
                                    : ""
                                }`}
                              />
                            )}
                          </React.Fragment>
                        )
                      )}
                    </div>
                  )}

                  {/* Cancel Reason */}
                  {isCancelled &&
                    order.cancellationReason && (
                      <div className="op-cancel-reason">
                        <FaBan />

                        Cancelled:{" "}
                        {order.cancellationReason}
                      </div>
                    )}

                  {/* Actions */}
                  <div className="op-actions">

                    <button
                      className="op-btn-ghost"
                      onClick={() =>
                        setExpandedOrderId(
                          isExpanded
                            ? null
                            : order._id
                        )
                      }
                    >
                      {isExpanded ? (
                        <>
                          <FaChevronUp />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <FaChevronDown />
                          View Details
                        </>
                      )}
                    </button>

                    <div className="op-actions-right">

                      {canCancel && (
                        <button
                          className="op-btn-cancel"
                          onClick={() => {
                            setSelectedOrder(
                              order
                            );
                            setShowCancelModal(
                              true
                            );
                            setReason("");
                          }}
                        >
                          <FaBan />

                          Cancel Order
                        </button>
                      )}

                      {canRefund && (
                        <button
                          className="op-btn-refund"
                          onClick={() => {
                            setSelectedOrder(
                              order
                            );

                            setShowRefundModal(
                              true
                            );

                            setReason("");
                            setReturnPaymentMethod(
                              ""
                            );
                            setReturnPaymentDetails(
                              ""
                            );
                          }}
                        >
                          <FaMoneyBillWave />

                          Request Refund
                        </button>
                      )}

                      {canAfterDeliveryRequest && (
                        <button
                          className="op-btn-refund"
                          onClick={() => {
                            setSelectedOrder(
                              order
                            );

                            setShowAfterDeliveryModal(
                              true
                            );

                            setReason("");
                            setAfterDeliveryType(
                              "Return"
                            );

                            setReturnPaymentMethod(
                              ""
                            );

                            setReturnPaymentDetails(
                              ""
                            );
                          }}
                        >
                          <FaUndo />

                          Request Return/Replace
                        </button>
                      )}

                      <Link
                        to="/contact"
                        className="op-btn-help"
                      >
                        <FaHeadset />

                        Help
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="op-details">

                      {/* All Items */}
                      <div className="op-detail-section">

                        <h4>All Items</h4>

                        <div className="op-all-items">

                          {order.items.map(
                            (item, index) => (
                              <div
                                key={index}
                                className="op-detail-item"
                              >
                                {item.image ? (
                                  <img
                                    src={
                                      item.image
                                    }
                                    alt={
                                      item.productName
                                    }
                                    className="op-detail-img"
                                  />
                                ) : (
                                  <div className="op-detail-img op-detail-img--placeholder">
                                    <FaBox />
                                  </div>
                                )}

                                <div className="op-detail-item-meta">

                                  <h5>
                                    {
                                      item.productName
                                    }
                                  </h5>

                                  {item.category && (
                                    <p className="op-detail-cat">
                                      {
                                        item.category
                                      }
                                    </p>
                                  )}

                                  {item.brand && (
                                    <p className="op-detail-brand">
                                      {item.brand}
                                    </p>
                                  )}
                                </div>

                                <div className="op-detail-item-price">

                                  <p>
                                    Qty:{" "}
                                    {
                                      item.quantity
                                    }
                                  </p>

                                  <p>
                                    Rs.
                                    {formatAmount(
                                      item.price
                                    )}{" "}
                                    each
                                  </p>

                                  <strong>
                                    Rs.
                                    {formatAmount(
                                      Number(
                                        item.price ||
                                          0
                                      ) *
                                        Number(
                                          item.quantity ||
                                            1
                                        )
                                    )}
                                  </strong>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <div className="op-detail-cols">

                        {/* Address */}
                        {order.shippingAddress && (
                          <div className="op-detail-section">

                            <h4>
                              <FaMapMarkerAlt />

                              Delivery Address
                            </h4>

                            <div className="op-addr-box">

                              <p>
                                <strong>
                                  {
                                    order
                                      .shippingAddress
                                      .fullName
                                  }
                                </strong>
                              </p>

                              <p>
                                {
                                  order
                                    .shippingAddress
                                    .address
                                }
                              </p>

                              <p>
                                {
                                  order
                                    .shippingAddress
                                    .city
                                }
                                ,{" "}
                                {
                                  order
                                    .shippingAddress
                                    .state
                                }{" "}
                                -{" "}
                                {
                                  order
                                    .shippingAddress
                                    .zipCode
                                }
                              </p>

                              <p>
                                Ph:{" "}
                                {
                                  order
                                    .shippingAddress
                                    .phone
                                }
                              </p>

                              {order
                                .shippingAddress
                                .email && (
                                <p>
                                  Email:{" "}
                                  {
                                    order
                                      .shippingAddress
                                      .email
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Pricing */}
                        <div className="op-detail-section">

                          <h4>
                            <FaCreditCard />

                            Payment & Pricing
                          </h4>

                          <div className="op-price-box">

                            {/* Product Subtotal */}
                            <div className="op-price-row">

                              <span>
                                Subtotal (
                                {
                                  order.totalItems
                                }{" "}
                                items)
                              </span>

                              <span>
                                Rs.
                                {formatAmount(
                                  itemsSubtotal
                                )}
                              </span>
                            </div>

                            {/* Coupon */}
                            {couponDiscount > 0 && (
                              <div
                                className="op-price-row"
                                style={{
                                  color:
                                    "#15803d",
                                  fontWeight: 700,
                                }}
                              >
                                <span>
                                  <FaTag
                                    style={{
                                      marginRight:
                                        "5px",
                                    }}
                                  />

                                  Coupon
                                  {couponCode
                                    ? ` (${couponCode})`
                                    : ""}
                                </span>

                                <span>
                                  − Rs.
                                  {formatAmount(
                                    couponDiscount
                                  )}
                                </span>
                              </div>
                            )}

                            {/* Shipping */}
                            <div className="op-price-row">

                              <span>
                                Shipping
                              </span>

                              <span className="op-free">
                                FREE
                              </span>
                            </div>

                            {/* Final Total */}
                            <div className="op-price-row op-price-row--total">

                              <strong>
                                Total Paid
                              </strong>

                              <strong>
                                Rs.
                                {formatAmount(
                                  finalTotal
                                )}
                              </strong>
                            </div>

                            {/* Tax breakup - already included in Total Paid */}
                            {gstInfo.paid > 0 && (
                              <div
                                className="op-price-row"
                                style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginTop: "6px" }}
                              >
                                <span>Tax breakup (included in price)</span>
                                <span></span>
                              </div>
                            )}
                            {gstInfo.paid > 0 && (
                              <>
                                <div className="op-price-row">
                                  <span>Taxable Value</span>
                                  <span>Rs.{formatAmount(gstInfo.taxable)}</span>
                                </div>
                                <div className="op-price-row">
                                  <span>CGST ({gstInfo.half}%)</span>
                                  <span>Rs.{formatAmount(gstInfo.cgst)}</span>
                                </div>
                                <div className="op-price-row">
                                  <span>SGST ({gstInfo.half}%)</span>
                                  <span>Rs.{formatAmount(gstInfo.sgst)}</span>
                                </div>
                              </>
                            )}


                            {/* Payment Method */}
                            <div className="op-price-row">

                              <span>
                                Payment Method
                              </span>

                              <span>
                                {
                                  order.paymentMethod
                                }
                              </span>
                            </div>

                            {/* Payment Status */}
                            <div className="op-price-row">

                              <span>
                                Payment Status
                              </span>

                              <span
                                className={`op-pay-status op-pay-status--${(
                                  order.paymentStatus ||
                                  ""
                                ).toLowerCase()}`}
                              >
                                {order.paymentStatus ||
                                  "Pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Refund Info */}
                      {order.refundInfo &&
                        order.refundInfo.status !==
                          "None" && (
                          <div className="op-detail-section op-refund-info">

                            <h4>
                              <FaUndo />

                              Refund Information
                            </h4>

                            <div className="op-price-box">

                              <div className="op-price-row">

                                <span>
                                  Refund Status
                                </span>

                                <span
                                  style={{
                                    color:
                                      getRefundBadge(
                                        order.refundInfo
                                      )?.color,
                                    fontWeight: 700,
                                  }}
                                >
                                  {
                                    order
                                      .refundInfo
                                      .status
                                  }
                                </span>
                              </div>

                              <div className="op-price-row">

                                <span>
                                  Refund Amount
                                </span>

                                <span>
                                  Rs.
                                  {formatAmount(
                                    order
                                      .refundInfo
                                      .refundAmount ||
                                      finalTotal
                                  )}
                                </span>
                              </div>

                              {order.refundInfo.reason && (
                                <div className="op-price-row">

                                  <span>
                                    Reason
                                  </span>

                                  <span>
                                    {
                                      order
                                        .refundInfo
                                        .reason
                                    }
                                  </span>
                                </div>
                              )}

                              {order.refundInfo.returnPaymentMethod && (
                                <div className="op-price-row">

                                  <span>
                                    Return Method
                                  </span>

                                  <span>
                                    {
                                      order
                                        .refundInfo
                                        .returnPaymentMethod
                                    }
                                  </span>
                                </div>
                              )}

                              {order.refundInfo.returnPaymentDetails && (
                                <div className="op-price-row">

                                  <span>
                                    Payment Details
                                  </span>

                                  <span>
                                    {
                                      order
                                        .refundInfo
                                        .returnPaymentDetails
                                    }
                                  </span>
                                </div>
                              )}

                              {order.refundInfo.requestedAt && (
                                <div className="op-price-row">

                                  <span>
                                    Requested On
                                  </span>

                                  <span>
                                    {formatDate(
                                      order
                                        .refundInfo
                                        .requestedAt
                                    )}
                                  </span>
                                </div>
                              )}

                              {order.refundInfo.approvedAt && (
                                <div className="op-price-row">

                                  <span>
                                    Approved On
                                  </span>

                                  <span>
                                    {formatDate(
                                      order
                                        .refundInfo
                                        .approvedAt
                                    )}
                                  </span>
                                </div>
                              )}

                              {order.refundInfo.processedAt && (
                                <div className="op-price-row">

                                  <span>
                                    Processed On
                                  </span>

                                  <span>
                                    {formatDate(
                                      order
                                        .refundInfo
                                        .processedAt
                                    )}
                                  </span>
                                </div>
                              )}

                              {order.refundInfo.adminNotes && (
                                <div className="op-price-row">

                                  <span>
                                    Admin Note
                                  </span>

                                  <span>
                                    {
                                      order
                                        .refundInfo
                                        .adminNotes
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* After Delivery Request */}
                      {order.afterDeliveryRequest &&
                        order.afterDeliveryRequest
                          .status !== "None" && (
                          <div className="op-detail-section op-refund-info">

                            <h4>
                              <FaUndo />

                              {
                                order
                                  .afterDeliveryRequest
                                  .type
                              }{" "}
                              Request Information
                            </h4>

                            <div className="op-price-box">

                              <div className="op-price-row">

                                <span>
                                  Request Status
                                </span>

                                <span
                                  style={{
                                    fontWeight: 700,
                                  }}
                                >
                                  {
                                    order
                                      .afterDeliveryRequest
                                      .status
                                  }
                                </span>
                              </div>

                              {order
                                .afterDeliveryRequest
                                .reason && (
                                <div className="op-price-row">

                                  <span>
                                    Reason
                                  </span>

                                  <span>
                                    {
                                      order
                                        .afterDeliveryRequest
                                        .reason
                                    }
                                  </span>
                                </div>
                              )}

                              {order
                                .afterDeliveryRequest
                                .type === "Return" &&
                                order
                                  .afterDeliveryRequest
                                  .returnPaymentMethod && (
                                  <div className="op-price-row">

                                    <span>
                                      Return Method
                                    </span>

                                    <span>
                                      {
                                        order
                                          .afterDeliveryRequest
                                          .returnPaymentMethod
                                      }
                                    </span>
                                  </div>
                                )}

                              {order
                                .afterDeliveryRequest
                                .type === "Return" &&
                                order
                                  .afterDeliveryRequest
                                  .returnPaymentDetails && (
                                  <div className="op-price-row">

                                    <span>
                                      Payment Details
                                    </span>

                                    <span>
                                      {
                                        order
                                          .afterDeliveryRequest
                                          .returnPaymentDetails
                                      }
                                    </span>
                                  </div>
                                )}

                              {order
                                .afterDeliveryRequest
                                .requestedAt && (
                                <div className="op-price-row">

                                  <span>
                                    Requested On
                                  </span>

                                  <span>
                                    {formatDate(
                                      order
                                        .afterDeliveryRequest
                                        .requestedAt
                                    )}
                                  </span>
                                </div>
                              )}

                              {order
                                .afterDeliveryRequest
                                .approvedAt && (
                                <div className="op-price-row">

                                  <span>
                                    Approved On
                                  </span>

                                  <span>
                                    {formatDate(
                                      order
                                        .afterDeliveryRequest
                                        .approvedAt
                                    )}
                                  </span>
                                </div>
                              )}

                              {order
                                .afterDeliveryRequest
                                .processedAt && (
                                <div className="op-price-row">

                                  <span>
                                    Processed On
                                  </span>

                                  <span>
                                    {formatDate(
                                      order
                                        .afterDeliveryRequest
                                        .processedAt
                                    )}
                                  </span>
                                </div>
                              )}

                              {order
                                .afterDeliveryRequest
                                .adminNotes && (
                                <div className="op-price-row">

                                  <span>
                                    Admin Note
                                  </span>

                                  <span>
                                    {
                                      order
                                        .afterDeliveryRequest
                                        .adminNotes
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================
          CANCEL MODAL
      ========================== */}
      {showCancelModal &&
        selectedOrder && (
          <div
            className="op-modal-overlay"
            onClick={() =>
              setShowCancelModal(false)
            }
          >
            <div
              className="op-modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="op-modal-header op-modal-header--danger">

                <FaBan />

                <h3>Cancel Order</h3>

                <button
                  onClick={() =>
                    setShowCancelModal(false)
                  }
                >
                  <FaTimes />
                </button>
              </div>

              <div className="op-modal-body">

                <div className="op-modal-order-info">

                  <p>
                    Order{" "}
                    <strong>
                      #
                      {selectedOrder._id
                        .slice(-8)
                        .toUpperCase()}
                    </strong>
                  </p>

                  <p>
                    Amount:{" "}
                    <strong>
                      Rs.
                      {formatAmount(
                        getFinalTotal(
                          selectedOrder
                        )
                      )}
                    </strong>
                  </p>
                </div>

                {selectedOrder.paymentStatus ===
                  "Completed" && (
                  <div className="op-modal-refund-notice">

                    <FaMoneyBillWave />

                    <p>
                      Since this order is paid,
                      you may request a refund
                      after cancellation from
                      the order details.
                    </p>
                  </div>
                )}

                <label className="op-modal-label">
                  Reason for cancellation{" "}
                  <span>*</span>
                </label>

                <textarea
                  className="op-modal-textarea"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                  placeholder="Please tell us why you want to cancel this order..."
                  rows={4}
                />
              </div>

              <div className="op-modal-footer">

                <button
                  className="op-btn-ghost"
                  onClick={() =>
                    setShowCancelModal(false)
                  }
                  disabled={actionLoading}
                >
                  Keep Order
                </button>

                <button
                  className="op-btn-cancel"
                  onClick={
                    handleCancelOrder
                  }
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Cancelling..."
                    : "Yes, Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* =========================
          REFUND MODAL
      ========================== */}
      {showRefundModal &&
        selectedOrder && (
          <div
            className="op-modal-overlay"
            onClick={() => {
              setShowRefundModal(false);
              setReason("");
              setReturnPaymentMethod("");
              setReturnPaymentDetails("");
            }}
          >
            <div
              className="op-modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="op-modal-header op-modal-header--refund">

                <FaMoneyBillWave />

                <h3>Request Refund</h3>

                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setReason("");
                    setReturnPaymentMethod("");
                    setReturnPaymentDetails("");
                  }}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="op-modal-body">

                <div className="op-modal-order-info">

                  <p>
                    Order{" "}
                    <strong>
                      #
                      {selectedOrder._id
                        .slice(-8)
                        .toUpperCase()}
                    </strong>
                  </p>

                  <p>
                    Refund Amount:{" "}
                    <strong>
                      Rs.
                      {formatAmount(
                        getFinalTotal(
                          selectedOrder
                        )
                      )}
                    </strong>
                  </p>
                </div>

                <div className="op-modal-refund-notice">

                  <FaCheckCircle />

                  <p>
                    Refunds are processed
                    within{" "}
                    <strong>
                      5-7 business days
                    </strong>{" "}
                    to the selected return
                    payment method.
                  </p>
                </div>

                <label className="op-modal-label">
                  Reason for refund{" "}
                  <span>*</span>
                </label>

                <textarea
                  className="op-modal-textarea"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                  placeholder="Please describe why you are requesting a refund..."
                  rows={4}
                />

                <label
                  className="op-modal-label"
                  style={{
                    marginTop: "16px",
                  }}
                >
                  Return Payment Method{" "}
                  <span>*</span>
                </label>

                <select
                  className="op-modal-select"
                  value={returnPaymentMethod}
                  onChange={(e) =>
                    setReturnPaymentMethod(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select method
                  </option>

                  <option value="UPI">
                    UPI
                  </option>

                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>

                  <option value="Net Banking">
                    Net Banking
                  </option>
                </select>

                {returnPaymentMethod && (
                  <>
                    <label
                      className="op-modal-label"
                      style={{
                        marginTop: "12px",
                      }}
                    >
                      {returnPaymentMethod}{" "}
                      details{" "}
                      <span>*</span>
                    </label>

                    <input
                      className="op-modal-input"
                      type="text"
                      value={
                        returnPaymentDetails
                      }
                      onChange={(e) =>
                        setReturnPaymentDetails(
                          e.target.value
                        )
                      }
                      placeholder={
                        returnPaymentMethod ===
                        "UPI"
                          ? "Enter your UPI ID"
                          : returnPaymentMethod ===
                            "Bank Transfer"
                          ? "Enter bank account number, IFSC, and name"
                          : "Enter net banking username or account details"
                      }
                    />
                  </>
                )}
              </div>

              <div className="op-modal-footer">

                <button
                  className="op-btn-ghost"
                  onClick={() => {
                    setShowRefundModal(false);
                    setReason("");
                    setReturnPaymentMethod("");
                    setReturnPaymentDetails("");
                  }}
                  disabled={actionLoading}
                >
                  Close
                </button>

                <button
                  className="op-btn-refund"
                  onClick={
                    handleRequestRefund
                  }
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Submitting..."
                    : "Submit Refund Request"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* =========================
          AFTER DELIVERY MODAL
      ========================== */}
      {showAfterDeliveryModal &&
        selectedOrder && (
          <div
            className="op-modal-overlay"
            onClick={() => {
              setShowAfterDeliveryModal(false);
              setReason("");
              setAfterDeliveryType(
                "Return"
              );
              setReturnPaymentMethod("");
              setReturnPaymentDetails("");
            }}
          >
            <div
              className="op-modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="op-modal-header op-modal-header--refund">

                <FaUndo />

                <h3>
                  Request{" "}
                  {afterDeliveryType}
                </h3>

                <button
                  onClick={() => {
                    setShowAfterDeliveryModal(
                      false
                    );
                    setReason("");
                    setAfterDeliveryType(
                      "Return"
                    );
                    setReturnPaymentMethod("");
                    setReturnPaymentDetails("");
                  }}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="op-modal-body">

                <div className="op-modal-order-info">

                  <p>
                    Order{" "}
                    <strong>
                      #
                      {selectedOrder._id
                        .slice(-8)
                        .toUpperCase()}
                    </strong>
                  </p>

                  <p>
                    Status:{" "}
                    <strong>
                      {
                        selectedOrder.status
                      }
                    </strong>
                  </p>
                </div>

                <label className="op-modal-label">
                  Select request type{" "}
                  <span>*</span>
                </label>

                <select
                  className="op-modal-select"
                  value={
                    afterDeliveryType
                  }
                  onChange={(e) =>
                    setAfterDeliveryType(
                      e.target.value
                    )
                  }
                >
                  <option value="Return">
                    Return
                  </option>

                  <option value="Replace">
                    Replace
                  </option>
                </select>

                <label
                  className="op-modal-label"
                  style={{
                    marginTop: "16px",
                  }}
                >
                  Reason for{" "}
                  {afterDeliveryType.toLowerCase()}{" "}
                  <span>*</span>
                </label>

                <textarea
                  className="op-modal-textarea"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                  placeholder={`Please describe why you are requesting a ${afterDeliveryType.toLowerCase()}...`}
                  rows={4}
                />

                {afterDeliveryType ===
                  "Return" && (
                  <>
                    <label
                      className="op-modal-label"
                      style={{
                        marginTop: "16px",
                      }}
                    >
                      Return Payment Method{" "}
                      <span>*</span>
                    </label>

                    <select
                      className="op-modal-select"
                      value={
                        returnPaymentMethod
                      }
                      onChange={(e) =>
                        setReturnPaymentMethod(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Select method
                      </option>

                      <option value="UPI">
                        UPI
                      </option>

                      <option value="Bank Transfer">
                        Bank Transfer
                      </option>

                      <option value="Net Banking">
                        Net Banking
                      </option>
                    </select>

                    {returnPaymentMethod && (
                      <>
                        <label
                          className="op-modal-label"
                          style={{
                            marginTop: "12px",
                          }}
                        >
                          {
                            returnPaymentMethod
                          }{" "}
                          details{" "}
                          <span>*</span>
                        </label>

                        <input
                          className="op-modal-input"
                          type="text"
                          value={
                            returnPaymentDetails
                          }
                          onChange={(e) =>
                            setReturnPaymentDetails(
                              e.target.value
                            )
                          }
                          placeholder={
                            returnPaymentMethod ===
                            "UPI"
                              ? "Enter your UPI ID"
                              : returnPaymentMethod ===
                                "Bank Transfer"
                              ? "Enter bank account number, IFSC, and name"
                              : "Enter net banking username or account details"
                          }
                        />
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="op-modal-footer">

                <button
                  className="op-btn-ghost"
                  onClick={() => {
                    setShowAfterDeliveryModal(
                      false
                    );
                    setReason("");
                    setAfterDeliveryType(
                      "Return"
                    );
                    setReturnPaymentMethod("");
                    setReturnPaymentDetails("");
                  }}
                  disabled={actionLoading}
                >
                  Close
                </button>

                <button
                  className="op-btn-refund"
                  onClick={
                    handleRequestAfterDelivery
                  }
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Submitting..."
                    : `Submit ${afterDeliveryType} Request`}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
};

export default OrdersPage;
