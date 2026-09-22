import { Link } from 'react-router-dom'
import { FaUsers, FaLeaf, FaHeart, FaAward, FaHandshake, FaSeedling, FaHistory, FaCertificate, FaEye, FaCheck } from 'react-icons/fa'

const team = [
  { name: 'John Smith', role: 'Founder & Owner', desc: '3rd generation farmer, 35+ years in sustainable poultry. Leads farm operations and quality.', avatar: 'J' },
  { name: 'Maria Smith', role: 'Operations Manager', desc: 'Ensures every product meets our Grade A standards. Veterinary liaison.', avatar: 'M' },
  { name: 'David Wilson', role: 'Head of Logistics', desc: 'Manages cold-chain delivery across the region. 98.5% on-time rate.', avatar: 'D' }
]

const values = [
  { icon: FaLeaf, title: 'Sustainability', desc: 'Eco-friendly methods: composting, water recycling, solar-assisted coops. Protecting land for future generations.' },
  { icon: FaHeart, title: 'Animal Welfare', desc: 'Spacious pastures, natural light, perches and dust baths. Stress-free birds, healthier meat.' },
  { icon: FaAward, title: 'Quality First', desc: 'Daily veterinary inspection, Grade A grading, and batch traceability from pasture to plate.' },
  { icon: FaHandshake, title: 'Trust & Transparency', desc: 'Open farm visits every Saturday. See our coops, feed, and processing facility anytime.' },
  { icon: FaSeedling, title: 'Natural Feed', desc: 'Non-GMO grains, no antibiotics or hormones. Supplemented with farm-grown greens.' },
  { icon: FaUsers, title: 'Community', desc: 'Supporting 12 local grain farmers and donating 5% of production to community kitchens.' }
]

const timeline = [
  { year: '1985', title: 'Family Farm Founded', desc: 'John Smith Sr. started with 200 chickens on 5 acres.' },
  { year: '1998', title: 'Free-Range Certified', desc: 'First in the county to achieve certified free-range and expand to ducks and turkeys.' },
  { year: '2012', title: 'Cold-Chain Delivery', desc: 'Launched direct-to-home delivery, reaching 500+ families.' },
  { year: '2024', title: 'Premium Poultry Online', desc: 'Online shop launched, serving 1,200+ customers with same-day delivery.' },
]

const certifications = [
  'Veterinary Inspected Daily',
  'Antibiotic-Free Certified',
  'Free-Range Standards Compliant',
  'Grade A Quality Assessed',
  'HACCP Food Safety',
]

function About() {
  return (
    <div className="about-page">
      {/* Hero */}
      <div className="about-hero" style={{background:'linear-gradient(135deg, #1a3009 0%, #2d5016 100%)', color:'white', padding:'70px 0', textAlign:'center'}}>
        <div className="container">
          <span style={{letterSpacing:3, fontSize:12, color:'#c9a227', fontWeight:700}}>SINCE 1985 • THREE GENERATIONS</span>
          <h1 style={{fontSize:42, margin:'12px 0'}}>About Our Farm</h1>
          <p style={{maxWidth:600, margin:'0 auto', opacity:0.85, fontSize:17, lineHeight:1.6}}>Three generations of passion, quality, and sustainable farming — from pasture to your plate.</p>
        </div>
      </div>

      {/* Story */}
      <section className="about-story">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <span className="section-label">OUR STORY</span>
              <h2>Farming With Purpose Since 1985</h2>
              <p>
                What started as a small family farm with 200 chickens has grown into one of the region's most trusted
                poultry suppliers. For over three generations, the Smith family has been dedicated
                to raising premium quality poultry using sustainable and ethical farming practices.
              </p>
              <p>
                We believe that happy, healthy birds produce the best quality meat and eggs. Our poultry roams
                on open pastures, eats natural grains and greens, and lives with access to fresh air and sunlight.
                This results in healthier, tastier products that you can feel good about serving to your family.
              </p>
              <p>
                Today, we steward 50 acres, raise 5,000+ birds monthly, and serve over 1,200 happy families,
                delivering fresh, farm-raised poultry directly from our farm to their doorstep — often within hours of processing.
              </p>
              <div style={{display:'flex', gap:10, flexWrap:'wrap', marginTop:16}}>
                {certifications.map(c=> (
                  <span key={c} style={{display:'inline-flex', alignItems:'center', gap:6, background:'#f0f7ee', color:'#2d5016', padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:600}}><FaCheck /> {c}</span>
                ))}
              </div>
            </div>
            <div className="about-image">
              <img src="https://cdn.pixabay.com/photo/2016/03/05/19/02/hen-1238714_640.jpg" alt="Our Farm" />
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section style={{background:'white', padding:'60px 0', borderTop:'1px solid #e8e5df'}}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">OUR JOURNEY</span>
            <h2>Timeline</h2>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:20}}>
            {timeline.map(t=> (
              <div key={t.year} style={{borderLeft:'3px solid #c9a227', paddingLeft:16}}>
                <div style={{fontSize:22, fontWeight:800, color:'#2d5016'}}>{t.year}</div>
                <h4 style={{margin:'6px 0', fontSize:15}}>{t.title}</h4>
                <p style={{fontSize:13, color:'#777', lineHeight:1.6}}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="about-stats">
        <div className="container">
          <div className="stats-row">
            <div className="stat-box">
              <span className="stat-number">35+</span>
              <span className="stat-label">Years Experience</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">1,200+</span>
              <span className="stat-label">Happy Customers</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">5,000+</span>
              <span className="stat-label">Poultry Raised Monthly</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">98.5%</span>
              <span className="stat-label">On-Time Delivery</span>
            </div>
          </div>
          <div style={{textAlign:'center', marginTop:18, fontSize:13, color:'#666'}}>
            Rated 4.8/5 average from 850+ verified reviews • <Link to="/products" style={{color:'#2d5016', textDecoration:'underline'}}>Shop our products</Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="about-values">
        <div className="container">
          <div className="section-header">
            <span className="section-label">OUR VALUES</span>
            <h2>What We Stand For</h2>
            <p>Our values guide everything we do, from farming to delivery.</p>
          </div>
          <div className="values-grid">
            {values.map((value, index) => (
              <div className="value-card" key={index}>
                <div className="value-icon">
                  <value.icon />
                </div>
                <h3>{value.title}</h3>
                <p>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Farm Gallery */}
      <section style={{background:'#f9f8f6', padding:'60px 0'}}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">LIFE ON THE FARM</span>
            <h2>Pasture, Care, Quality</h2>
            <p>Open pastures, clean coops, and hands-on care every day.</p>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16}}>
            <div style={{borderRadius:12, overflow:'hidden', height:320}}><img src="https://cdn.pixabay.com/photo/2016/03/05/19/02/hen-1238714_640.jpg" alt="Hens" style={{width:'100%', height:'100%', objectFit:'cover'}} /></div>
            <div style={{borderRadius:12, overflow:'hidden', height:320}}><img src="https://cdn.pixabay.com/photo/2017/11/11/21/41/chicken-2939480_640.jpg" alt="Chicken" style={{width:'100%', height:'100%', objectFit:'cover'}} /></div>
            <div style={{borderRadius:12, overflow:'hidden', height:320}}><img src="https://cdn.pixabay.com/photo/2021/11/22/19/36/turkey-6817284_640.jpg" alt="Turkey" style={{width:'100%', height:'100%', objectFit:'cover'}} /></div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:16}}>
            <div style={{background:'white', padding:20, borderRadius:12, textAlign:'center'}}><FaEye color="#2d5016" size={24} /><h4 style={{margin:'8px 0 4px'}}>Visit Us</h4><p style={{fontSize:13, color:'#777'}}>Open farm Saturdays 9AM-1PM. See how we raise our birds.</p></div>
            <div style={{background:'white', padding:20, borderRadius:12, textAlign:'center'}}><FaHistory color="#2d5016" size={24} /><h4 style={{margin:'8px 0 4px'}}>Daily Care</h4><p style={{fontSize:13, color:'#777'}}>Fresh water, natural feed, health checks at dawn and dusk.</p></div>
            <div style={{background:'white', padding:20, borderRadius:12, textAlign:'center'}}><FaCertificate color="#2d5016" size={24} /><h4 style={{margin:'8px 0 4px'}}>Traceable</h4><p style={{fontSize:13, color:'#777'}}>Every batch traceable to pasture lot and processing date.</p></div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="about-team">
        <div className="container">
          <div className="section-header">
            <span className="section-label">OUR TEAM</span>
            <h2>Meet the People Behind the Farm</h2>
            <p>Dedicated individuals committed to bringing you the best poultry products.</p>
          </div>
          <div className="team-grid">
            {team.map((member, index) => (
              <div className="team-card" key={index}>
                <div className="team-avatar" style={{background:'#2d5016', color:'white'}}>{member.avatar}</div>
                <h3>{member.name}</h3>
                <span className="team-role">{member.role}</span>
                <p>{member.desc}</p>
                <div style={{marginTop:10, fontSize:12, color:'#777'}}><Link to="/contact" style={{color:'#2d5016', textDecoration:'underline'}}>Contact {member.name.split(' ')[0]}</Link></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta" style={{background:'linear-gradient(135deg, #2d5016 0%, #1a3009 100%)', color:'white', padding:'60px 0', textAlign:'center'}}>
        <div className="container">
          <h2 style={{color:'white', marginBottom:10}}>Ready to Taste the Difference?</h2>
          <p style={{opacity:0.85, marginBottom:24, maxWidth:600, marginLeft:'auto', marginRight:'auto'}}>Order today before 2PM for same-day dispatch. Free delivery over $50 within 50 miles.</p>
          <div style={{display:'flex', gap:12, justifyContent:'center'}}>
            <Link to="/products" className="btn-gold">Shop Now</Link>
            <Link to="/contact" className="btn-outline-white">Contact Us</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
