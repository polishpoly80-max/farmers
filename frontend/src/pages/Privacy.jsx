import { Link } from 'react-router-dom'

function Privacy() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: September 1, 2026 • Effective: September 1, 2026</p>

        <div className="legal-content">
          <section>
            <h2>1. Information We Collect</h2>
            <p>When you use Premium Poultry Farm's website and services, we may collect:</p>
            <ul>
              <li><strong>Account info:</strong> Name, email, phone, address, password (hashed with Argon2)</li>
              <li><strong>Order info:</strong> Products, quantities, delivery address, order history and preferences</li>
              <li><strong>Payment info:</strong> Processed securely via our payment gateway — we never store full card numbers on our servers</li>
              <li><strong>Device & usage:</strong> Browser, device type, IP address, pages viewed, and interactions (via cookies/analytics)</li>
              <li><strong>Communications:</strong> Messages you send via contact forms, email, or WhatsApp support</li>
              <li><strong>Newsletter:</strong> Email address if you subscribe</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Process, pack, and deliver your orders and send confirmations, tracking, and delivery updates</li>
              <li>Create and manage your account and authenticate logins securely</li>
              <li>Improve our products, website, and customer experience</li>
              <li>Send promotional emails and recipes (only with your consent — unsubscribe anytime via the email footer)</li>
              <li>Respond to your inquiries and provide support via email, phone, or WhatsApp</li>
              <li>Detect, prevent, and address fraud, abuse, and security issues</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2>3. Legal Basis (Where Applicable)</h2>
            <p>Where required by law, we process personal data under: contract performance (to fulfill your order), legitimate interest (to improve services and secure our site), consent (for newsletters), and legal compliance.</p>
          </section>

          <section>
            <h2>4. Data Protection & Security</h2>
            <p>We implement appropriate technical and organizational measures: HTTPS/TLS encryption in transit, Argon2 password hashing, encrypted payment processing, access controls, and regular security reviews. All payment data is handled through PCI-DSS compliant gateways. No payment method is stored without your explicit choice and tokenization.</p>
          </section>

          <section>
            <h2>5. Third-Party Sharing</h2>
            <p>We do not sell your personal information. We may share data only with:</p>
            <ul>
              <li><strong>Delivery partners:</strong> Name, phone, address to fulfill and track orders</li>
              <li><strong>Payment processors:</strong> To securely handle transactions</li>
              <li><strong>Service providers:</strong> Hosting (AstraDB/DataStax), analytics, email delivery — under contractual confidentiality</li>
              <li><strong>Legal/Compliance:</strong> When required by law, subpoena, or to protect rights and safety</li>
            </ul>
            <p>We do not allow third parties to use your data for their own marketing without your consent.</p>
          </section>

          <section>
            <h2>6. Cookies & Analytics</h2>
            <p>Our website uses cookies and similar technologies to remember preferences (e.g., cart, login), measure traffic, and enhance browsing. You can disable cookies in your browser settings, but some features (like cart persistence and login) may not function. We use aggregated, anonymized analytics to understand how visitors use our site.</p>
          </section>

          <section>
            <h2>7. Data Retention</h2>
            <p>We keep account and order data while your account is active and for up to 7 years thereafter for accounting, warranty, and legal purposes. Newsletter data is kept until you unsubscribe. You may request deletion at any time (see Your Rights below), subject to legal retention requirements.</p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access a copy of your personal data</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict certain processing</li>
              <li>Opt-out of marketing communications at any time</li>
              <li>Request a portable copy of your data</li>
            </ul>
            <p>To exercise these rights, <Link to="/contact">contact us</Link> or email privacy@premiumpoultry.com. We will respond within 30 days.</p>
          </section>

          <section>
            <h2>9. International Transfers</h2>
            <p>Your data may be processed in the United States (where our database is hosted) and other countries where our service providers operate. We ensure appropriate safeguards for such transfers.</p>
          </section>

          <section>
            <h2>10. Children's Privacy</h2>
            <p>Our services are not directed to children under 13, and we do not knowingly collect information from children. If you believe a child has provided data, please contact us to remove it.</p>
          </section>

          <section>
            <h2>11. Do Not Track</h2>
            <p>Our site does not currently respond to Do Not Track signals. You can still opt out of analytics cookies via your browser.</p>
          </section>

          <section>
            <h2>12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Material changes will be posted on this page with an updated "Last updated" date and, where required, notified via email or a site notice. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2>13. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, please <Link to="/contact">contact us</Link>:</p>
            <ul>
              <li>Email: privacy@premiumpoultry.com</li>
              <li>Address: 123 Farm Road, Countryside, CA 95123</li>
              <li>Phone: +1 (555) 123-4567</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Privacy
