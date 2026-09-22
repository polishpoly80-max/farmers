import { Link } from 'react-router-dom'

function Terms() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last updated: September 1, 2026 • Premium Poultry Farm</p>

        <div className="legal-content">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>By accessing, browsing, or purchasing from Premium Poultry Farm's website and services, you accept and agree to be bound by these Terms of Service and our <Link to="/privacy">Privacy Policy</Link>. If you do not agree, please do not use our services. We may update these terms from time to time; continued use after changes constitutes acceptance. We will post updates here and indicate the new "Last updated" date.</p>
          </section>

          <section>
            <h2>2. Products & Pricing</h2>
            <p>We sell fresh poultry products including chicken, broiler, duck, turkey, quail, and eggs. All products are sourced directly from our farm and veterinary inspected. Product images are for illustration; appearance may vary slightly due to natural variation. Prices are in USD, include applicable taxes where stated, and are subject to change without notice. We reserve the right to limit quantities and correct pricing errors (if a price is misstated, we will notify you and give you the option to reconfirm or cancel).</p>
          </section>

          <section>
            <h2>3. Orders & Payment</h2>
            <p>Orders can be placed through our website when you are logged in. By placing an order, you authorize us to charge the payment method provided. We accept major credit/debit cards, bank transfer, and cash on delivery (where available). All cards are processed securely via a third-party gateway — we do not store full card numbers. We reserve the right to refuse or cancel any order for reasons including suspected fraud, stock error, or violation of these terms. You will be notified and refunded if an order is cancelled after payment.</p>
          </section>

          <section>
            <h2>4. Delivery & Pickup</h2>
            <p>We deliver within a 50-mile radius of our farm at 123 Farm Road, Countryside, CA 95123. Delivery is free for orders over $50; under $50 is $9.99. Standard delivery is 1-3 business days via cold-chain. Same-day dispatch is available for orders placed before 2:00 PM, Monday-Saturday. You must provide an accurate address and be available or authorize a safe drop. Farm pickup is available — select "Farm Pickup" at checkout. Delivery times are estimates, not guarantees; we are not liable for delays due to weather, traffic, or courier issues.</p>
          </section>

          <section>
            <h2>5. Returns, Refunds & Quality Guarantee</h2>
            <p>Due to the perishable nature of our products, returns are accepted only if products arrive damaged, spoiled, or incorrect. Contact us within 24 hours of delivery at info@premiumpoultry.com or +1 (555) 123-4567 with photo evidence. We will offer a full refund or replacement at our discretion. We do not accept returns for taste preference or improper storage after delivery. For the best quality, refrigerate at 0-4°C on arrival and follow storage instructions on each product page. Cook poultry to an internal temperature of 74°C.</p>
          </section>

          <section>
            <h2>6. Account Responsibility</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of unauthorized use. You must provide accurate information and be at least 18 years old (or have parental consent) to place orders. We may suspend accounts that violate these terms, attempt fraud, or abuse our services.</p>
          </section>

          <section>
            <h2>7. Acceptable Use</h2>
            <p>You agree not to misuse our site: no hacking, scraping without permission, spamming, posting unlawful content, or interfering with security. Attempted password brute-force is rate-limited (20 attempts/15 minutes) and may be temporarily blocked.</p>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>All content on this site — including text, images, logos, and design — is owned by Premium Poultry Farm or its licensors and is protected by copyright and trademark laws. You may not copy, reproduce, or distribute content without written permission, except for personal, non-commercial use.</p>
          </section>

          <section>
            <h2>9. Privacy</h2>
            <p>We respect your privacy and protect your personal information. We do not sell your data. Payment data is encrypted and processed via secure gateways. Please review our <Link to="/privacy">Privacy Policy</Link> for details on what we collect, how we use it, and your rights.</p>
          </section>

          <section>
            <h2>10. Limitation of Liability & Disclaimer</h2>
            <p>Products are provided "as is" without warranties beyond our quality guarantee. To the fullest extent permitted by law, Premium Poultry Farm shall not be liable for indirect, incidental, consequential, or punitive damages arising from the use of our products or services, including improper storage or cooking by the buyer. Our total liability is limited to the amount you paid for the product in question. Some jurisdictions do not allow the exclusion of certain warranties or limitations, so some of the above may not apply to you.</p>
          </section>

          <section>
            <h2>11. Governing Law & Disputes</h2>
            <p>These terms are governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising under these terms shall first be addressed through informal negotiation by contacting us at info@premiumpoultry.com. If unresolved, it will be subject to the exclusive jurisdiction of the courts in Countryside, CA.</p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>For questions about these Terms of Service, please <Link to="/contact">contact us</Link>:</p>
            <ul>
              <li>Email: info@premiumpoultry.com</li>
              <li>Phone: +1 (555) 123-4567</li>
              <li>Address: 123 Farm Road, Countryside, CA 95123</li>
            </ul>
            <p>Need help with an order? See our <Link to="/contact">Contact & FAQ page</Link> for delivery, returns, and bulk pricing.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Terms
