import Contact from "@/components/sections/Contact";
import Footer from "@/components/layout/Footer";
import Narrative from "@/components/sections/Narrative";
import Navbar from "@/components/layout/Navbar";
import Process from "@/components/sections/Process";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="conteudo" className="relative">
        <div id="topo" />
        <div id="solucoes">
          <Narrative />
        </div>
        <Process />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
