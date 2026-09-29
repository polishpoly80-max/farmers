import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaClock, FaPaperPlane, FaWhatsapp, FaHeadset, FaTruck, FaStore } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { createCareSession } from '../services/api'

const contactInfo = [
  { icon: FaMapMarkerAlt, title: 'Visit Us', details: ['123 Farm Road', 'Countryside, CA 95123', 'Open farm Saturdays 9AM-1PM'] },
  { icon: FaPhone, title: 'Call Us', details: ['+1 (555) 123-4567', '+1 (555) 987-6543', 'Mon-Sat 8AM-6PM'] },
  { icon: FaEnvelope, title: 'Email Us', details: ['info@premiumpoultry.com', 'orders@premiumpoultry.com', 'Support replies < 4h'] },
  { icon: FaClock, title: 'Working Hours', details: ['Mon - Fri: 8:00 AM - 6:00 PM', 'Sat: 9:00 AM - 4:00 PM', 'Sun: Closed'] }
]

const departments = [
  { icon: FaStore, title: 'Sales & Orders', email: 'orders@premiumpoultry.com', phone: '+1 (555) 123-4567', desc: 'New orders, bulk pricing, availability' },
  { icon: FaHeadset, title: 'Customer Support', email: 'info@premiumpoultry.com', phone: '+1 (555) 987-6543', desc: 'Delivery, refunds, feedback' },
  { icon: FaTruck, title: 'Logistics', email: 'delivery@premiumpoultry.com', phone: '+1 (555) 234-5678', desc: 'Tracking, scheduling, delivery windows' },
]

function Contact() {
  const { user } = useAuth()
  const { currentBranch } = useBranch()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    subject: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.message.length < 10) {
      toast.error('Please write a more detailed message (at least 10 characters)')
      return
    }
    // Messages become real support tickets, so staff can actually answer them.
    // Guests are asked to sign in first, which keeps every reply traceable.
    if (!user) {
      toast.info('Please sign in so the farm team can reply to you')
      navigate('/login')
      return
    }
    setLoading(true)
    try {
      await createCareSession({
        branch_id: currentBranch?.branch_id || user.tenant_id || undefined,
        topic: formData.subject || 'General support',
        message: `[${formData.name}${formData.phone ? ` • ${formData.phone}` : ''}] ${formData.message}`,
      })
      toast.success('Message sent! The branch team will reply in your care chat.')
      setFormData({ name: user?.full_name || '', email: user?.email || '', phone: user?.phone || '', subject: '', message: '' })
      navigate('/care-chat')
    } catch (err) {
      toast.error(err.message || 'Could not send your message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="contact-page">
      {/* Hero */}
      <div className="contact-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p className="contact-hero-subtitle">Have questions about orders, bulk pricing, or visiting the farm? We'd love to hear from you — replies within 4 hours during business hours.</p>
          <div className="contact-hero-actions">
            <span><FaPhone /> +1 (555) 123-4567</span>
            <a href="https://wa.me/15551234567" target="_blank" rel="noopener noreferrer" className="contact-whatsapp-link">
              <FaWhatsapp /> WhatsApp Us
            </a>
          </div>
        </div>
      </div>

      {/* Contact Info Cards */}
      <section className="contact-info-section">
        <div className="container">
          <div className="contact-info-grid">
            {contactInfo.map((info, index) => (
              <div className="contact-info-card" key={index}>
                <div className="contact-info-icon">
                  <info.icon />
                </div>
                <h3>{info.title}</h3>
                {info.details.map((detail, i) => (
                  <p key={i}>{detail}</p>
                ))}
              </div>
            ))}
          </div>

          {/* Departments */}
          <div className="departments-grid">
            {departments.map(d=> (
              <div key={d.title} className="department-card">
                <div className="department-icon">
                  <d.icon />
                </div>
                <h4>{d.title}</h4>
                <p>{d.desc}</p>
                <div className="department-contact">
                  <div>{d.email}</div>
                  <div>{d.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="contact-form-section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-form-wrapper">
              <h2>Send Us a Message</h2>
              <p>Fill out the form below and we'll get back to you as soon as possible.</p>

              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Subject *</label>
                    <select name="subject" value={formData.subject} onChange={handleChange} required style={{width:'100%', padding:'12px 14px', border:'1px solid #e8e5df', borderRadius:8, fontSize:14, background:'#f9f8f6'}}>
                      <option value="">Select a topic</option>
                      <option value="Order inquiry">Order inquiry</option>
                      <option value="Bulk pricing">Bulk / Restaurant pricing</option>
                      <option value="Delivery">Delivery & Tracking</option>
                      <option value="Visit farm">Visit the farm</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Message *</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us about your order, preferred delivery date, or how we can help..."
                    rows="5"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
                  <FaPaperPlane /> {loading ? 'Sending...' : 'Send Message'}
                </button>
                <p style={{fontSize:12, color:'#777', marginTop:10}}>Messages open a support conversation so you can chat live and follow replies. Prefer video? Open <Link to="/care-chat" style={{color:'#2d5016', textDecoration:'underline'}}>Live Care</Link> after signing in.</p>
                <p style={{fontSize:12, color:'#777', marginTop:10}}>We respect your privacy. See <a href="/privacy" style={{color:'#2d5016', textDecoration:'underline'}}>Privacy Policy</a>.</p>
              </form>
            </div>

            <div className="contact-map-wrapper">
              <div className="map-placeholder" style={{textAlign:'center', padding:'40px 20px'}}>
                <FaMapMarkerAlt size={36} color="#2d5016" style={{marginBottom:12}} />
                <h3>Our Farm Location</h3>
                <p>123 Farm Road, Countryside, CA 95123</p>
                <p style={{fontSize:12, color:'#777', marginBottom:14}}>50-acre free-range farm • Farm shop open Sat 9AM-1PM<br/>Delivery within 50-mile radius • Free over $50</p>
                <a
                  href="https://maps.google.com/?q=123+Farm+Road+Countryside+CA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  Open in Google Maps
                </a>
                <div style={{marginTop:24, background:'white', borderRadius:8, padding:16, textAlign:'left', fontSize:13, lineHeight:1.6, border:'1px solid #e8e5df'}}>
                  <strong>Getting here:</strong><br/>
                  From downtown: Take Highway 101 North, exit Countryside, follow Farm Road 2 miles. Signposted "Premium Poultry Farm".<br/><br/>
                  <strong>Pickup available:</strong> Select "Farm Pickup" at checkout to collect and save delivery fees.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="contact-faq">
        <div className="container">
          <div className="section-header">
            <span className="section-label">FAQ</span>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>What are your delivery hours?</h4>
              <p>We deliver Monday through Saturday, 8AM-6PM. Orders placed before 2PM are dispatched same day via cold-chain. Sunday closed.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a minimum order amount?</h4>
              <p>No minimum, but free delivery on $50+. Under $50 is $9.99 delivery fee. Farm pickup is always free.</p>
            </div>
            <div className="faq-item">
              <h4>Do you offer bulk discounts?</h4>
              <p>Yes! Restaurants, caterers, and events: 10% off 20+ items, 15% off 50+. <a href="mailto:orders@premiumpoultry.com" style={{color:'#2d5016', textDecoration:'underline'}}>Email orders@</a> for a quote.</p>
            </div>
            <div className="faq-item">
              <h4>Are your products organic? Halal?</h4>
              <p>Antibiotic & hormone-free, natural feed. Not certified organic, but pasture-raised to free-range standards. Halal processing available on request — note in checkout.</p>
            </div>
            <div className="faq-item">
              <h4>How should I store poultry?</h4>
              <p>Refrigerate at 0-4°C and use within 2-3 days, or freeze at -18°C for months. See each product's Storage tab for details. Cook to 74°C internal.</p>
            </div>
            <div className="faq-item">
              <h4>What's your return policy?</h4>
              <p>Perishable goods: returns only if damaged/spoiled on arrival. Contact us within 24 hours with photos for a full refund or replacement. See <a href="/terms" style={{color:'#2d5016', textDecoration:'underline'}}>Terms</a>.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
