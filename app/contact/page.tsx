import Link from 'next/link';
import ContactForm from './contact-form';
import './contact.css';

export const metadata = { title: 'Contact LTG | Request a Demo', description: 'Explore LTG for your school. Request a demonstration, discuss a founding partnership, or ask a question.' };
export default function ContactPage() {
  return <main className="contact-shell">
    <header className="contact-header"><Link href="/" className="contact-brand">LTG <span>Living Teacher Guide</span></Link><Link href="/login">Platform Login</Link></header>
    <div className="contact-layout"><section className="contact-intro"><p className="contact-eyebrow">LET’S TALK ABOUT YOUR PROGRAM</p><h1>See what LTG could look like at your school.</h1><p>Tell us about your institution and what you need. We’ll follow up to answer your questions or arrange a demonstration.</p><ul><li>Workflows built around your curriculum</li><li>Connected instruction, attendance, and reporting</li><li>Guided configuration and onboarding</li></ul><p>Interested in becoming a founding school? Choose “Founding/Beta partnership” below.</p><Link href="/">Explore the platform →</Link></section><ContactForm /></div>
    <footer className="contact-footer">LTG · Education Operating System <Link href="/">Home</Link> <Link href="/contact">Contact LTG</Link></footer>
  </main>;
}
