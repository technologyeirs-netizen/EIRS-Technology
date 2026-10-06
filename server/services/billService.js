const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const downloadImage = async (url, filepath) => {
  const response = await axios({ url, method: "GET", responseType: "stream" });

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filepath);
    response.data.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
};

const money = (n) => `${Number(n || 0).toFixed(2)}`;

const generateBill = async (order) => {
  return new Promise(async (resolve, reject) => {
    const tempImages = [];

    try {
      const invoicesDir = path.resolve(process.cwd(), "invoices");
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const fileName = `invoice_${order._id}.pdf`;
      const filePath = path.join(invoicesDir, fileName);

      // Orders placed before GST was removed were really charged GST (stored in gstAmount).
      // For those we keep showing it so the invoice matches what the customer paid.
      const legacyGst = Math.max(0, Number(order.gstAmount || 0));
      const hasLegacyGst = legacyGst > 0;

      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const colors = {
        primary: "#0f172a",
        secondary: "#0f766e",
        border: "#e2e8f0",
        text: "#334155",
        muted: "#64748b",
        light: "#f8fafc",
      };

      // ================= HEADER =================

      const logoPath = path.join(process.cwd(), "public", "EIRSLogo.png");

      // LOGO
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 30, {
          width: 55,
          height: 55,
        });
      }

      // COMPANY NAME
      doc
        .fillColor(colors.primary)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("EIRS TECHNOLOGY", 110, 40);

      // EMAIL
      doc
        .fontSize(9)
        .fillColor(colors.muted)
        .text("info@eirstechnology.com", 110, 65);

      // TITLE
      doc
        .fontSize(18)
        .fillColor(colors.secondary)
        .text(hasLegacyGst ? "TAX INVOICE" : "INVOICE", 400, 40, { align: "right" });

      // LINE
      doc
        .moveTo(40, 100)
        .lineTo(555, 100)
        .strokeColor(colors.border)
        .stroke();

      // ================= INVOICE INFO =================

      const invoiceNumber =
        order.invoice?.invoiceNumber || `INV-${Date.now()}`;
      // Use the order's own date so re-generating the PDF never changes it
      const date = new Date(
        order.invoice?.invoiceDate || order.orderDate || order.createdAt || Date.now()
      ).toLocaleDateString("en-IN");

      doc
        .fontSize(10)
        .fillColor(colors.text)
        .font("Helvetica-Bold")
        .text("Invoice No:", 40, 120)
        .font("Helvetica")
        .text(invoiceNumber, 120, 120);

      doc
        .font("Helvetica-Bold")
        .text("Order ID:", 40, 140)
        .font("Helvetica")
        .text(String(order._id), 120, 140);

      doc
        .font("Helvetica-Bold")
        .text("Date:", 40, 160)
        .font("Helvetica")
        .text(date, 120, 160);

      // ================= CUSTOMER DETAILS =================

      const customer = order.shippingAddress || {};

      doc
        .roundedRect(40, 185, 515, 90, 5)
        .fillAndStroke("#f8fafc", colors.border);

      doc
        .fillColor(colors.primary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("CUSTOMER DETAILS", 50, 195);

      doc.fillColor(colors.text).fontSize(9).font("Helvetica");

      doc.text(`Name: ${customer.fullName || "-"}`, 50, 215);
      doc.text(`Phone: ${customer.phone || "-"}`, 50, 230);
      doc.text(`Email: ${customer.email || "-"}`, 50, 245);

      doc.text(`Address: ${customer.address || "-"}`, 300, 215, {
        width: 240,
      });

      doc.text(
        `${customer.city || ""}, ${customer.state || ""} - ${
          customer.zipCode || ""
        }`,
        300,
        240,
        { width: 240 }
      );

      // ================= TABLE HEADER =================

      let y = 290;

      doc
        .rect(40, y, 515, 25)
        .fill(colors.primary)
        .fillColor("white")
        .fontSize(9)
        .font("Helvetica-Bold");

      doc.text("Product", 50, y + 8);
      doc.text("HSN", 220, y + 8);
      doc.text("Qty", 290, y + 8);
      doc.text("Rate", 350, y + 8);
      doc.text("Discount", 410, y + 8);
      doc.text("Total", 480, y + 8);

      y += 35;

      // ================= PRODUCTS =================

      for (const item of order.items) {
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const discount = Number(item.discount || 0);

        const discountedPrice = price - (price * discount) / 100;
        const total = discountedPrice * qty;

        doc.fillColor(colors.text).font("Helvetica").fontSize(9);

        doc.text(item.productName || "-", 50, y, { width: 160 });
        doc.text(item.hsn || "N/A", 220, y);
        doc.text(String(qty), 290, y);
        doc.text(price.toFixed(2), 350, y);
        doc.text(`${discount}%`, 410, y);
        doc.text(total.toFixed(2), 480, y);

        doc
          .moveTo(40, y + 18)
          .lineTo(555, y + 18)
          .strokeColor(colors.border)
          .stroke();

        y += 28;
      }

      // ================= TOTAL =================

      // totalPrice is exactly what the customer paid at checkout
      // (cart subtotal - coupon discount, no GST).
      const grandTotal = Number(order.totalPrice || 0);
      const couponDiscount = Math.max(0, Number(order.couponDiscount || 0));
      const hasCoupon = couponDiscount > 0;
      const itemsTotal = grandTotal - legacyGst + couponDiscount;

      y += 20;

      // Keep the totals box on the page
      if (y > 650) {
        doc.addPage();
        y = 60;
      }

      const rows = [];
      rows.push(["Items Total:", money(itemsTotal), null]);
      if (hasCoupon) {
        rows.push([`Coupon (${order.couponCode || "DISCOUNT"}):`, `- ${money(couponDiscount)}`, "#15803d"]);
      }
      if (hasLegacyGst) {
        rows.push(["GST (18%):", money(legacyGst), null]);
      }

      const boxHeight = rows.length * 20 + 55;
      doc.rect(300, y, 255, boxHeight).fill(colors.light);

      let ry = y + 12;
      rows.forEach(([label, value, color]) => {
        doc.font("Helvetica").fontSize(10).fillColor(color || colors.text);
        doc.text(label, 320, ry);
        doc.text(value, 470, ry);
        ry += 20;
      });

      doc
        .moveTo(310, ry + 2)
        .lineTo(540, ry + 2)
        .strokeColor(colors.border)
        .stroke();

      doc
        .fontSize(12)
        .fillColor(colors.secondary)
        .font("Helvetica-Bold")
        .text("Total Paid:", 320, ry + 12);

      doc.text(money(grandTotal), 470, ry + 12);

      doc.end();

      stream.on("finish", () => {
        tempImages.forEach((img) => {
          if (fs.existsSync(img)) fs.unlinkSync(img);
        });

        resolve(`/invoices/${fileName}`);
      });

      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateBill };