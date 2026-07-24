# DOT-BREW-HUB Admin Training Guide

**For DOT COFFEE Operations Staff**

| | |
|---|---|
| **Version** | July 2026 |
| **Shopify store** | dot-10056 |
| **Ordering portal** | https://franchise.dotcoffee.ph |
| **Shopify Admin** | https://admin.shopify.com/store/dot-10056 |

---

## Table of Contents

1. Before You Start
2. Company and Location Management
3. Order Management
4. Customer Accounts and Access
5. Email Notifications
6. Report an Issue Tool
7. Common Troubleshooting
8. Frequently Asked Questions (FAQ)

---

## 1. Before You Start

### What this is

DOT-BREW-HUB is DOT COFFEE's custom B2B ordering website where franchise partners browse products, place orders, and track deliveries. Behind the scenes, it connects to **Shopify** for products, pricing, orders, and customer accounts.

As an admin, you will spend most of your time in **Shopify Admin**, not on the ordering portal itself.

### Two systems you need to know

| System | Who uses it | Where to go |
|--------|-------------|-------------|
| **DOT-BREW-HUB** (ordering portal) | Franchisees and partners | https://franchise.dotcoffee.ph |
| **Shopify Admin** | DOT COFFEE operations team | https://admin.shopify.com/store/dot-10056 |

Franchisees order on the portal. You manage companies, pricing, orders, and customer accounts in Shopify Admin.

[Insert screenshot: Shopify Admin home page]

### How to log in to Shopify Admin

1. Open your web browser.
2. Go to **https://admin.shopify.com/store/dot-10056**
3. Sign in with your DOT COFFEE staff account.
4. You should see the Shopify Admin dashboard with Orders, Products, Customers, and Settings in the left menu.

If you cannot log in, contact your store owner or IT administrator to request access.

### Glossary

Use this list when you see unfamiliar terms in Shopify or in this guide.

| Term | Plain-English meaning |
|------|----------------------|
| **B2B Company** | A business account in Shopify for a franchise partner (e.g., "DOT Coffee – Greenbelt"). |
| **Company location** | A specific store or site under that company (address, tax settings, and catalog assignment). |
| **Catalog** | A Shopify B2B price list assigned to a company location. This controls what discount or price tier the partner sees. |
| **Price list** | The list of product prices inside a catalog (e.g., franchisee pricing at ~10% off retail). |
| **Customer tag** | A label on a customer record (e.g., `franchisee`, `pending`) that controls access and pricing tier. |
| **Draft order** | A temporary order created before it becomes a real order in Shopify. |
| **Fulfillment** | The process of packing and shipping an order, including tracking numbers. |
| **Metafield** | Extra structured data stored on an order or customer (e.g., delivery ETA, issue reports). |

### Important: where admin work actually happens

- **B2B company setup** (creating companies, assigning locations, linking catalogs) is done in **Shopify Admin → Customers → Companies**.
- The portal has an `/admin` area, but it only manages **customer tags** (pricing tier labels). It does **not** create B2B companies or assign catalogs.
- The **Pricing** page inside the portal admin is for display only. Real prices are controlled by **Shopify catalogs** and **customer tags**.

---

## 2. Company and Location Management

### What this is

Each franchise partner needs a **B2B Company** in Shopify with at least one **location** and the correct **catalog** assigned. This is how the portal knows which prices to show (Retail, Franchisee, or Company Store).

### When you need it

- Onboarding a new franchise partner
- A partner reports wrong prices
- Opening a new store location for an existing partner
- Changing a partner from one pricing tier to another

### Pricing tiers at a glance

The portal supports three pricing tiers. The tier is set using **customer tags** and reinforced by the **catalog** assigned to the company location.

| Tier (shown on portal) | Shopify customer tag | Typical use |
|------------------------|----------------------|-------------|
| **Retail** | *(no tier tag / default)* | Standard wholesale pricing |
| **Franchisee** | `franchisee` | Partner pricing (~10% off retail, set in catalog) |
| **Company Store** | `coo_cost` | Internal at-cost pricing |

**Note:** The exact discount percentage (e.g., ~10% for franchisees) is configured in the **catalog's price list** in Shopify Admin—not as a fixed number in the portal. Always verify the catalog adjustment when onboarding or troubleshooting.

### Other customer tags you will see

| Tag | Meaning | What to do |
|-----|---------|------------|
| `pending` | New registration awaiting your approval | Remove after onboarding is complete |
| `suspended` | Account blocked | Remove when the issue is resolved |
| `store:{StoreName}` | Store name entered at registration | Informational—helps identify the partner |
| `admin` | Portal administrator | Only for DOT COFFEE staff accounts |

[Insert screenshot: Customer tags on a customer record]

### Step-by-step: Create or edit a B2B Company

#### Step 1 — Open Companies in Shopify Admin

1. In Shopify Admin, click **Customers** in the left menu.
2. Click **Companies** at the top.
3. You will see a list of existing B2B companies.

[Insert screenshot: Companies list]

#### Step 2 — Create a new company (new partner)

1. Click **Add company**.
2. Enter the **company name** (e.g., the franchise store name or legal entity).
3. Save the company.

#### Step 3 — Add a company location

1. Open the company you just created (or an existing one).
2. Click **Add location** (or edit an existing location).
3. Enter the **store address**, contact details, and tax settings as required.
4. Save the location.

[Insert screenshot: Company location details page]

#### Step 4 — Assign a B2B catalog to the location

This step controls which prices the partner sees on the portal.

1. On the company location page, find the **Catalogs** section.
2. Click **Assign catalog** (or **Manage catalogs**).
3. Select the correct catalog for this partner's tier:
   - Franchisee partners → assign the **Franchisee** catalog (or your store's equivalent name)
   - Company Store partners → assign the **Company Store / at-cost** catalog
   - Retail / wholesale → assign the **Retail** catalog
4. Save your changes.

[Insert screenshot: Company location with catalog assigned]

If no catalog is assigned, the partner will see **retail prices** even if their customer tag says `franchisee`. Always confirm the catalog is linked.

#### Step 5 — Link the customer as a company contact

The partner's login email must be connected to the B2B company so the portal can load their pricing.

1. Go to **Customers** and find the partner's customer record (search by email).
2. Open the customer profile.
3. In the **Company** section, click **Add to company** (or **Manage company access**).
4. Select the correct **company** and **location**.
5. Save.

[Insert screenshot: Customer linked to company and location]

#### Step 6 — Set the correct pricing tier tag

1. On the same customer record, scroll to **Tags**.
2. Ensure the correct tier tag is present:
   - Franchisee → add tag `franchisee`
   - Company Store → add tag `coo_cost`
   - Retail → remove tier tags (or ensure no `franchisee` / `coo_cost` tag)
3. Remove the `pending` tag once onboarding is complete.
4. Click **Save**.

### New franchisee onboarding checklist

Use this checklist every time a new partner signs up on the portal.

| Step | Action | Done? |
|------|--------|-------|
| 1 | Partner registers at **franchise.dotcoffee.ph/register** (account gets `pending` + tier tag) | ☐ |
| 2 | Create **B2B Company** + **Location** in Shopify Admin | ☐ |
| 3 | **Link customer** as company contact to that location | ☐ |
| 4 | **Assign correct catalog** to the company location | ☐ |
| 5 | **Remove `pending` tag** from customer | ☐ |
| 6 | Send **account activation** if needed: Customer profile → **Send account invite** | ☐ |
| 7 | **Verify pricing**: ask partner to log in and check prices, or ask developer to check `/debug-pricing` | ☐ |

### Editing an existing company or location

1. Go to **Customers → Companies**.
2. Click the company name.
3. To edit a location: click the location → update address, catalog, or contacts → **Save**.
4. To change pricing tier: update the **catalog assignment** on the location **and** the **customer tags** on the partner's profile.

### Important caveat: one primary location

The portal uses the **first company** and **first location** linked to the customer's account. If a partner has multiple locations, make sure the **primary** location (the one they order from) is listed first, or confirm with your developer which location is active.

---

## 3. Order Management

### What this is

When a franchisee places an order on DOT-BREW-HUB, it becomes a real order in Shopify. You find, review, fulfill, and track these orders in **Shopify Admin → Orders**.

### When you need it

- A new order comes in and needs processing
- Checking payment status (Net 7 terms)
- Packing and shipping with tracking
- Investigating a partner question about their order
- Reviewing internal stock flags (not visible to franchisees)

### Where to find orders

1. Log in to Shopify Admin.
2. Click **Orders** in the left menu.
3. Use filters to narrow results:
   - **Date range** — orders from today, this week, etc.
   - **Customer** — search by partner name or email
   - **Tagged with** — e.g., `issue-reported`, `fulfilled-from-zero-stock`

[Insert screenshot: Orders list]

### Understanding order details

When you open an order, review these areas:

#### Order header

- **Order number** (e.g., #1042)
- **Customer name and email**
- **B2B block** — shows the **purchasing company** and **location** (confirms B2B pricing was applied)
- **Payment status** — Pending, Paid, etc.
- **Fulfillment status** — Unfulfilled, Fulfilled, Partially fulfilled

#### Line items

- Product names, SKUs, quantities, and prices
- Prices should match the partner's assigned tier (franchisee, company, or retail)

#### Tags (internal signals)

These tags are added automatically by the portal. Franchisees **do not** see them.

| Tag | Meaning |
|-----|---------|
| `fulfilled-from-zero-stock` | One or more items were at **zero or below stock** when the order was placed. Process normally—this is for internal tracking only. |
| `dot-draft:{number}` | Links this order to the original draft order (used for invoice lookup). |
| `franchisee`, `company`, or `retail` | Pricing tier at the time of checkout. |
| `issue-reported` | Partner submitted a delivery issue (see Section 6). |
| `dot-received` | Partner confirmed receipt—order is complete. |
| `dot-cancelled` | Order was cancelled by the franchisee. |
| `dot-cancel-mistake`, `dot-cancel-wrong`, `dot-cancel-duplicate`, `dot-cancel-reorder`, `dot-cancel-other` | Cancellation reason codes. |

[Insert screenshot: Order with fulfilled-from-zero-stock tag]

#### Metafields (extra order data)

On the order page, scroll to **Metafields** (you may need to click **Show all**):

| Metafield | What it contains |
|-----------|------------------|
| `custom.delivery_eta` | Estimated delivery dates (JSON) |
| `custom.cancellation` | Cancellation details if the order was cancelled |
| `custom.issue_reports` | Structured issue reports from the partner (see Section 6) |

#### Order notes and timeline

- The **Timeline** shows status changes, fulfillments, and payments.
- **Notes** may include blocks starting with `[ISSUE REPORTED` when a partner reports a problem.

### Portal order status → what you should do

Franchisees see simplified statuses on the portal. Here is what they mean for you in Shopify Admin:

| Portal status | What it means in Shopify | Your action |
|---------------|--------------------------|-------------|
| **Pending** | Order placed, not yet fulfilled | Review order; confirm payment per Net 7 terms |
| **Preparing** | Paid and being processed | Pick and pack items |
| **Shipped** | Fulfillment created with tracking | Verify tracking number is correct |
| **Delivered** | Carrier marked as delivered | Wait for partner to confirm receipt |
| **Completed** | Partner confirmed receipt (`dot-received` tag) | No action needed—archive |
| **Cancelled** | Partner cancelled (`dot-cancelled` tag) | Process refund if payment was collected |

### Zero-stock orders (internal only)

**Franchisees never see stock levels** on the portal. They can always add items and place orders regardless of inventory.

For your team, orders placed when stock was at or below zero are automatically tagged **`fulfilled-from-zero-stock`**. This helps operations plan backorders or production—you do not need to tell the franchisee about this tag.

[Insert screenshot: Order tags showing fulfilled-from-zero-stock]

### How to process fulfillment

Follow these steps when an order is ready to ship:

1. Open the order in **Shopify Admin → Orders**.
2. Review line items and shipping address.
3. Click **Create fulfillment** (or **Fulfill items**).
4. Enter the **tracking number** and **shipping carrier** (e.g., LBC, J&T, internal delivery).
5. Click **Mark as fulfilled**.
6. Shopify sends a **shipping confirmation email** to the partner automatically.

[Insert screenshot: Create fulfillment dialog]

### Payment reminder (Net 7)

Partners order on **Net 7 Days** payment terms. Orders with outstanding balances may be placed on hold per DOT COFFEE policy. Proof of payment should be sent to **billings@dotcoffee.ph**.

---

## 4. Customer Accounts and Access

### What this is

Franchisees log in to DOT-BREW-HUB using **Shopify Customer Accounts**. They do not have a separate username/password managed by the portal—the login page sends them to Shopify's secure sign-in page.

### When you need it

- A new partner needs access after registration
- A partner cannot log in
- A partner sees wrong prices after logging in
- Resetting or suspending an account

### How franchisees log in

1. Partner goes to **https://franchise.dotcoffee.ph**
2. Clicks **Sign in** (or is prompted to log in when browsing).
3. They are redirected to **Shopify's hosted sign-in page**.
4. They can sign in using either:
   - **Google** (if they choose "Continue with Google"), or
   - **Email one-time code (OTP)** — Shopify emails them a code to enter.
5. After successful sign-in, they return to the portal catalog with their pricing tier applied.

[Insert screenshot: Portal login page]

[Insert screenshot: Shopify hosted sign-in page with Google and email options]

**Note:** Google and email OTP are both handled by Shopify—not separate logins managed by DOT COFFEE. You do not create passwords for partners in the portal.

### How new franchisee accounts are created

1. Partner visits **franchise.dotcoffee.ph/register**.
2. They fill in their details and choose an account type:
   - **Franchisee** → gets `franchisee` tag
   - **Company Store** → gets `coo_cost` tag
   - **Wholesale** → default retail tier
3. Their account is created with the **`pending`** tag—they cannot fully use the portal until you complete onboarding (Section 2).
4. You receive notification (check Shopify **Customers** for new records with `pending` tag).
5. Complete the **onboarding checklist** in Section 2, then remove `pending`.

**Important:** The "Approve" button on the portal admin dashboard is **not connected** to Shopify. Approval is done manually in Shopify Admin by removing the `pending` tag and completing company setup.

### Troubleshooting login and company mapping

Use this table for common problems. Try the admin fix first before contacting a developer.

| Problem | Likely cause | Admin fix |
|---------|--------------|-----------|
| Partner sees "pending approval" or cannot order | `pending` tag still on account | Complete onboarding; remove `pending` tag |
| Wrong prices on catalog | Catalog not assigned to location, or wrong tier tag | Assign correct catalog; fix customer tags |
| Retail prices despite being a franchisee | Customer not linked as company contact | Add customer to company in Admin |
| Partner can log in but pricing seems off | Missing company link | Link customer to company + location |
| Account blocked | `suspended` tag on customer | Remove `suspended` when resolved |
| Partner forgot how to log in | — | Direct them to franchise.dotcoffee.ph → Sign in → use email OTP |

### When to contact a developer

Contact your developer (see contact block at end of Section 7) if:

- The login page shows an error or redirect loop
- The portal website will not load at all
- Partner is correctly set up in Shopify but `/debug-pricing` still shows no catalogs
- Registration form fails to create a customer
- Webhook or pricing API errors appear in order processing

[Insert screenshot: Shopify Customer accounts settings]

---

## 5. Email Notifications

### What this is

Franchisees receive branded **order confirmation** and **shipping confirmation** emails from **Shopify**—not from the portal app directly. These emails use an invoice-style layout with DOT COFFEE branding, line items, and payment instructions.

### When you need it

- Updating bank account or payee details
- Changing payment terms wording
- Reviewing what partners receive after ordering or shipping

### What emails partners receive

| Email | When it is sent | Who sends it |
|-------|-----------------|--------------|
| **Order confirmation** | Right after an order is placed | Shopify |
| **Shipping confirmation** | When you mark an order as fulfilled (with tracking) | Shopify |
| **Invoice / Payment due** | B2B invoice emails (if enabled for your store) | Shopify |

The portal also shows an **order success page** on screen after checkout with payment terms—but the email comes from Shopify.

### Where to edit email templates

1. In Shopify Admin, go to **Settings** (gear icon, bottom left).
2. Click **Notifications**.
3. Find the template you need:
   - **Order confirmation**
   - **Shipping confirmation**
   - **Invoice** or **Payment due** (for B2B)
4. Click the template name to open the editor.
5. Edit the text, branding, or payment instructions.
6. Click **Save**.

[Insert screenshot: Notifications settings page]

[Insert screenshot: Order confirmation email template editor]

### Current payment details in the system

These details appear in order emails, the checkout success page, and invoice PDFs:

| Field | Current value |
|-------|---------------|
| **Payment terms** | Net 7 Days |
| **Bank** | UnionBank account |
| **Bank account number** | [INSERT BANK ACCOUNT NUMBER — obtain from Finance] |
| **Proof of payment email** | billings@dotcoffee.ph |

### If payee or bank details change

1. Update the relevant templates in **Shopify Admin → Settings → Notifications**.
2. **Notify your developer** so they can also update:
   - The on-demand **PDF invoice** template (used when partners download invoices from the portal)
   - The **checkout success page** payment instructions on the portal
3. Send a test order or use Shopify's **Send test notification** to verify the new details appear correctly.

Do not change only the portal—the Shopify email templates are what partners receive in their inbox.

---

## 6. Report an Issue Tool

### What this is

After receiving a delivery, franchisees can report problems (missing items, damage, wrong items) directly from the portal. Reports are saved to the **Shopify order** so your team can investigate in Admin.

### When you need it

- A partner reports a problem with a delivered order
- You need to find all orders with open issues
- Resolving and closing an issue

### How franchisees submit an issue

1. Partner logs in and goes to **My Orders** on the portal.
2. They open an order with status **Delivered** or **Completed**.
3. They click **Report an Issue**.
4. They choose an issue type:
   - **Missing item(s)**
   - **Damaged item(s)**
   - **Wrong item(s)**
   - **Other**
5. They select which line items are affected and enter an optional description.
6. They click **Submit**.

The partner sees a confirmation message. They cannot submit another issue on the same order.

### What appears in Shopify Admin

When a partner submits an issue, three things are added to the order automatically:

#### 1. Order tag: `issue-reported`

- Visible in the order's **Tags** field.
- Use this to filter orders: **Orders → Filter → Tagged with → issue-reported**.

[Insert screenshot: Order with issue-reported tag]

#### 2. Order note (human-readable)

A note block is appended to the order, for example:

```
[ISSUE REPORTED - 2026-07-02 14:30]
Type: Missing item(s)
Items: Arabica Blend 1kg (qty 2 of 2)
Description: Received only 1 bag.
```

Find this in the order **Timeline** or **Notes** section.

#### 3. Metafield: `custom.issue_reports`

Structured data stored on the order. Contains:

- Date and time reported
- Issue type
- Affected items (SKU, name, quantity)
- Description
- Status: `open`

[Insert screenshot: Order metafield issue_reports]

### Admin workflow for handling issues

1. **Find the order** — Filter orders by tag `issue-reported`, or search by order number.
2. **Read the details** — Check the order note and metafield for issue type, items, and description.
3. **Contact the partner** — Call or email to clarify if needed. Support email: **billings@dotcoffee.ph**.
4. **Resolve the issue** — Arrange replacement, credit, or refund per DOT COFFEE policy.
5. **Document resolution** — Add a note to the order timeline describing what was done (e.g., "Replacement shipped 7/5").
6. **Close the issue** — If you need to mark the metafield status as `resolved`, ask your developer (this requires a metafield update).

**Note:** Issue reports are monitored in **Shopify Admin only**. There is no separate Slack or external alert—check tagged orders regularly or add `issue-reported` to your daily order review routine.

---

## 7. Common Troubleshooting

### What this is

A quick reference for problems you may encounter. The first column is what **you can fix in Shopify Admin**. The second column is when to **contact your developer**.

### Troubleshooting matrix

| Issue | You can fix (Admin) | Contact developer |
|-------|---------------------|-------------------|
| Wrong tier prices showing | Reassign catalog to company location; fix customer tags (`franchisee` / `coo_cost`) | Pricing API errors; `/debug-pricing` shows errors |
| Customer sees retail instead of franchisee | Link customer to company; assign franchisee catalog; add `franchisee` tag | Session not loading company location |
| Currency displays incorrectly | Check **Settings → Markets**; verify price list currency on catalog | App formatting bugs |
| Order missing `fulfilled-from-zero-stock` tag | Verify webhook is active: **Settings → Notifications → Webhooks** → Order creation → URL should be `https://franchise.dotcoffee.ph/api/shopify/orders-create` | Webhook secret mismatch or endpoint down |
| Invoice PDF does not match email | — | Developer syncs PDF template with Shopify email |
| Portal website will not load | — | Vercel deployment, DNS, or hosting issue |
| New registration stuck on `pending` | Complete onboarding; remove `pending` tag | Registration API failure |
| Partner cannot log in (Shopify error) | Verify customer exists; send account invite | OAuth configuration error |
| Issue report not appearing on order | — | Check if order status was Delivered/Completed when submitted |
| Approve button on portal admin does nothing | Use Shopify Admin instead (expected behavior) | — |

### Pricing troubleshooting steps (detailed)

If a partner reports wrong prices, work through this list in order:

1. **Customer tags** — Does the customer have `franchisee` or `coo_cost`? Remove wrong tags.
2. **Company link** — Is the customer a **contact** on the correct B2B company?
3. **Catalog assignment** — Does the company **location** have the correct catalog assigned?
4. **Catalog price list** — Open the catalog in Admin and verify the percentage adjustment or fixed prices.
5. **Test login** — Have the partner log out and log back in, or check `/debug-pricing` with developer help.

### Currency display issues

- DOT COFFEE orders use **PHP (Philippine Peso)**.
- If a price shows a wrong currency code, check **Settings → Markets** and the **price list currency** on the assigned catalog.
- Invoice PDFs display amounts as `PHP 1,234.00` (not the ₱ symbol).

### Developer contact

For issues in the "Contact developer" column, reach out to:

**[INSERT DEVELOPER NAME / EMAIL / PHONE]**

Include: partner email, order number (if applicable), screenshots, and what you already tried from this guide.

---

## 8. Frequently Asked Questions (FAQ)

**Q1. What is the difference between a customer tag and a B2B catalog?**

A **customer tag** (like `franchisee`) tells the portal which pricing tier label to use. A **B2B catalog** tells Shopify what actual prices to charge. You need **both** set correctly: the tag on the customer and the catalog on the company location.

---

**Q2. Why don't franchisees see stock levels on the website?**

This is intentional. Stock levels are hidden so partners can always place orders. Your team tracks inventory internally. Orders placed when stock was zero are tagged `fulfilled-from-zero-stock` in Shopify Admin for your reference only.

---

**Q3. What does the `fulfilled-from-zero-stock` tag mean?**

It means at least one item in the order was at or below zero inventory when the partner placed the order. Process the order normally. The partner is not notified about this tag.

---

**Q4. Can I change product prices from the portal admin page?**

No. The portal **Pricing** admin page is display-only. Change prices in **Shopify Admin** by editing the **B2B catalog price list** or product **metafields** (`retail_price`, `franchisee_price`, `company_price`). Ask your developer if you are unsure which method your store uses.

---

**Q5. How long until a partner receives their order?**

Default policy shown to partners:

- Orders placed **before 1:00 PM** (Manila time) are processed the **same day**.
- Orders placed **at or after 1:00 PM** are processed the **next day**.
- Estimated delivery is **2 calendar days** after the processing date.

Exact dates are stored on each order in the `custom.delivery_eta` metafield.

---

**Q6. Can a franchisee cancel an order?**

Yes, but only while the order is still **unfulfilled** and payment is still **pending**. Once you start fulfillment or payment is collected, they must contact DOT COFFEE support to request changes.

---

**Q7. Where do I approve new partner signups?**

In **Shopify Admin**, not on the portal. Complete the onboarding checklist (Section 2), remove the `pending` tag, and send an account invite if needed. The "Approve" button on the portal admin dashboard does not perform approval.

---

**Q8. What email do partners use for payment proof?**

**billings@dotcoffee.ph** — partners email proof of payment here for Net 7 orders.

---

**Q9. How do I find all orders with reported issues?**

In Shopify Admin → **Orders** → add filter **Tagged with** → enter `issue-reported`.

---

**Q10. A partner logged in with Google but sees wrong prices. What should I check?**

Google login is fine—the issue is almost always **company linkage** or **catalog assignment**, not the login method. Follow the pricing troubleshooting steps in Section 7.

---

**Q11. What is the difference between "Delivered" and "Completed" on the portal?**

**Delivered** means the carrier marked the shipment as delivered. **Completed** means the partner clicked **Confirm Receipt** on the portal (adds the `dot-received` tag in Shopify). Partners can report issues on either status.

---

**Q12. Do I need to do anything when an order has the `dot-draft:` tag?**

No action required. This tag links the final order to its draft record and helps the system find the invoice URL. It is for internal reference.

---

## Document revision history

| Date | Change |
|------|--------|
| July 2026 | Initial release for DOT COFFEE admin team |

---

*End of guide*
