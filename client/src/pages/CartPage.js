
import CouponBox from "../components/CouponBox";
import useAppliedCoupon from "../hooks/useAppliedCoupon";
import React from "react";

import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { FaTrash, FaMinus, FaPlus } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import "../styles/CartPage.css";

const CartPage = () => {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    getTotalPrice,
    clearCart,
  } = useCart();

  const { user } = useAuth();
  const navigate = useNavigate();

  /*
   * =========================================================
   * PRICING
   * =========================================================
   *
   * GST is completely removed.
   *
   * Final Total =
   * Subtotal - Coupon Discount
   */

  const subtotalValue = Number(getTotalPrice() || 0);

  const couponState = useAppliedCoupon(subtotalValue);

  const couponDiscount = Math.min(
    Math.max(0, Number(couponState.discount || 0)),
    subtotalValue
  );

  const totalAmount = Math.max(
    0,
    subtotalValue - couponDiscount
  );

  /*
   * =========================================================
   * EMPTY CART
   * =========================================================
   */

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="empty-cart">
          <h2>Your Cart is Empty</h2>
          <p>Add some products to get started!</p>

          <Link
            to="/products"
            className="btn-continue-shopping"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * STOCK SAFE UPDATE
   * =========================================================
   */

  const handleIncrease = (item) => {
    const stock = Number(item.stock || 0);
    const quantity = Number(item.quantity || 1);

    if (stock <= 0) {
      alert("⚠️ This product is out of stock");
      return;
    }

    if (quantity >= stock) {
      alert(`⚠️ Only ${stock} items available in stock`);
      return;
    }

    updateQuantity(item._id, quantity + 1);
  };

  const handleDecrease = (item) => {
    const quantity = Number(item.quantity || 1);

    if (quantity <= 1) {
      return;
    }

    updateQuantity(item._id, quantity - 1);
  };

  console.log("Cart Items =>", cartItems);

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h1>Shopping Cart</h1>

        <div className="cart-content">
          {/* =========================
              CART ITEMS
          ========================= */}

          <div className="cart-items">
            <div className="cart-header">
              <span className="col-product">Product</span>
              <span className="col-price">Price</span>
              <span className="col-stock">Stock</span>
              <span className="col-quantity">Quantity</span>
              <span className="col-subtotal">Subtotal</span>
              <span className="col-action">Action</span>
            </div>

            {cartItems.map((item) => {
              const stock = Number(item.stock || 0);
              const quantity = Number(item.quantity || 1);
              const price = Number(item.price || 0);

              const discount = Math.min(
                Math.max(Number(item.discount || 0), 0),
                100
              );

              const isOutOfStock = stock <= 0;
              const isMaxReached = quantity >= stock;

              /*
               * Product-level discount
               *
               * Example:
               * Price = ₹1000
               * Discount = 10%
               * Final product price = ₹900
               */
              const discountedPrice =
                price * (1 - discount / 100);

              const itemSubtotal =
                discountedPrice * quantity;

              return (
                <div
                  key={item._id}
                  className="cart-row"
                >
                  {/* PRODUCT */}

                  <div className="item-product">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={
                          item.productName ||
                          item.name ||
                          "Product"
                        }
                        className="item-image"
                      />
                    )}

                    <div className="item-details">
                      <h3>
                        {item.productName || item.name}
                      </h3>

                      <p className="item-category">
                        {typeof item.category === "object"
                          ? item.category?.name
                          : item.category}
                      </p>
                    </div>
                  </div>

                  {/* PRICE */}

                  <div className="item-price">
                    ₹
                    {price.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </div>

                  {/* STOCK */}

                  <div className="item-stock">
                    <span
                      className={`stock-status ${
                        stock > 0
                          ? "in-stock"
                          : "out-of-stock"
                      }`}
                    >
                      {stock > 0
                        ? `${stock} Available`
                        : "Out of Stock"}
                    </span>
                  </div>

                  {/* QUANTITY */}

                  <div className="item-quantity">
                    <button
                      className="qty-btn"
                      onClick={() => handleDecrease(item)}
                      disabled={quantity <= 1}
                    >
                      <FaMinus />
                    </button>

                    <span className="qty-value">
                      {quantity}
                    </span>

                    <button
                      className="qty-btn"
                      onClick={() =>
                        handleIncrease(item)
                      }
                      disabled={
                        isOutOfStock || isMaxReached
                      }
                      title={
                        isOutOfStock
                          ? "Out of Stock"
                          : isMaxReached
                          ? "Max stock reached"
                          : ""
                      }
                    >
                      <FaPlus />
                    </button>
                  </div>

                  {/* SUBTOTAL */}

                  <div className="item-subtotal">
                    ₹
                    {itemSubtotal.toLocaleString(
                      "en-IN",
                      {
                        maximumFractionDigits: 2,
                      }
                    )}
                  </div>

                  {/* ACTION */}

                  <div className="item-action">
                    <button
                      className="btn-delete"
                      onClick={() =>
                        removeFromCart(item._id)
                      }
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* =========================
              ORDER SUMMARY
          ========================= */}

          <div className="cart-summary">
            <div className="summary-card">
              <h2>Order Summary</h2>

              {/* SUBTOTAL */}

              <div className="summary-row">
                <span>Subtotal</span>

                <span>
                  ₹
                  {subtotalValue.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* COUPON DISCOUNT */}

              {couponDiscount > 0 && (
                <div
                  className="summary-row"
                  style={{
                    color: "#15803d",
                    fontWeight: 700,
                  }}
                >
                  <span>
                    Coupon (
                    {couponState.applied?.code})
                  </span>

                  <span>
                    − ₹
                    {couponDiscount.toLocaleString(
                      "en-IN",
                      {
                        maximumFractionDigits: 2,
                      }
                    )}
                  </span>
                </div>
              )}

              {/* SHIPPING */}

              <div className="summary-row">
                <span>Shipping</span>
                <span>₹0 (Free)</span>
              </div>

              {/* 
                GST INTENTIONALLY REMOVED
                No GST / Tax row here.
              */}

              {/* TOTAL */}

              <div className="summary-row total">
                <span>Total</span>

                <span>
                  ₹
                  {totalAmount.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* COUPON NOTICE */}

              {couponState.notice && (
                <p
                  style={{
                    color: "#b45309",
                    fontSize: 13,
                    margin: "8px 0",
                  }}
                >
                  {couponState.notice}
                </p>
              )}

              {/* COUPON BOX */}

              {user && (
                <div style={{ margin: "14px 0" }}>
                  <CouponBox
                    subtotal={subtotalValue}
                    applied={couponState.applied}
                    onApply={couponState.apply}
                    onRemove={couponState.remove}
                  />
                </div>
              )}

              {/* CHECKOUT */}

              {user ? (
                <button
                  className="btn-checkout"
                  onClick={() =>
                    navigate("/checkout", {
                      state: {
                        cartItems,
                        subtotalValue,
                        couponDiscount,
                        totalAmount,
                        couponCode:
                          couponState.applied?.code ||
                          undefined,
                        userId:
                          user._id || user.id,
                        userName: user.name,
                        userEmail: user.email,
                      },
                    })
                  }
                >
                  Proceed to Checkout
                </button>
              ) : (
                <Link
                  to="/signin"
                  className="btn-checkout"
                >
                  Login to Checkout
                </Link>
              )}

              {/* CONTINUE SHOPPING */}

              <button
                className="btn-continue-shopping-secondary"
                onClick={() =>
                  (window.location.href = "/products")
                }
              >
                Continue Shopping
              </button>

              {/* CLEAR CART */}

              <button
                className="btn-clear-cart"
                onClick={clearCart}
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
