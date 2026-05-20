import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import About from "./components/About.jsx";
import Gallery from "./components/Gallery.jsx";
import HousesSection from "./components/HousesSection.jsx";
import Location from "./components/Location.jsx";
import Contact from "./components/Contact.jsx";
import Footer from "./components/Footer.jsx";
import FloatingWhatsApp from "./components/FloatingWhatsApp.jsx";
import ChatBot from "./components/ChatBot.jsx";

export default function App() {
  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Gallery />
        <HousesSection />
        <Location />
        <Contact />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <ChatBot />
    </div>
  );
}
