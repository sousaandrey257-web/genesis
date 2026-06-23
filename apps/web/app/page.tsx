import Hero from '@/components/Hero';
import LiveDemo from '@/components/LiveDemo';
import Features from '@/components/Features';
import ROICalculator from '@/components/ROICalculator';
import PricingCards from '@/components/PricingCards';
import Testimonials from '@/components/Testimonials';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden bg-ink">
      <Hero />
      <LiveDemo />
      <Features />
      <ROICalculator />
      <PricingCards />
      <Testimonials />
      <Footer />
    </main>
  );
}
