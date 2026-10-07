import Link from "next/link";
import Image from "next/image";

const team = [
  { name: "Aboy, Den Gebhard S.", role: "Leader · JS & Git", description: "Project lead & full-stack developer. Manages the codebase, git workflow, and all JavaScript logic.", image: "/den.jpg" },
  { name: "Asuncion, Justine Aaron", role: "HTML / CSS", description: "Front-end developer responsible for structure and layout of core pages.", image: "/justine.jpg" },
  { name: "Bonifacio, Angel Ann", role: "SQL / Database", description: "Database architect. Designs and maintains the Supabase schema and RLS policies.", image: "/angel.jpg" },
  { name: "Cabrillos, John Jasseim", role: "SQL / Database", description: "Co-database developer. Handles queries, data integrity, and backend logic.", image: "/jass.jpg" },
  { name: "Cruz, John Raymond B.", role: "HTML / CSS", description: "UI/UX developer. Crafts beautiful, responsive interfaces and styles.", image: "/cruz.jpg" },
];

export default function AboutPage() {
  return (
    <main className="container">
      <section style={{ textAlign: "center", marginBottom: "3rem" }}>
        <Image src="/logo2.png" alt="" width={80} height={80} style={{ height: 80, marginBottom: "1.5rem", objectFit: "contain" }} />
        <h1>About Arduino Store</h1>
        <p style={{ maxWidth: 760, margin: "1rem auto", color: "var(--muted)", lineHeight: 1.8 }}>We are a passionate team of makers, engineers, and tech enthusiasts dedicated to making Arduino components accessible to everyone in the Philippines.</p>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "2rem", marginBottom: "3rem" }}>
        <article className="account-card" style={{ borderLeft: "3px solid var(--primary)" }}>
          <h2 style={{ color: "var(--primary)", marginBottom: ".75rem" }}>Our Mission</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>To empower every Filipino maker, student, and engineer with affordable, authentic, and high-quality Arduino components — delivered fast and backed by real technical support.</p>
        </article>
        <article className="account-card" style={{ borderLeft: "3px solid var(--primary)" }}>
          <h2 style={{ color: "var(--primary)", marginBottom: ".75rem" }}>Our Vision</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>To become the most trusted electronics component store in Southeast Asia, fostering a community of innovative makers who build the future with open-source hardware.</p>
        </article>
      </section>
      <h2 className="section-title">Meet the Team</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "1rem", margin: "1.5rem 0 3rem" }}>
        {team.map((member, index) => (
          <article className="account-card" key={member.name} style={{ textAlign: "center" }}>
            {index === 0 && <div aria-label="Team leader">👑</div>}
            <Image src={member.image} alt={member.name} width={96} height={96} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: "50%", margin: "0 auto 1rem" }} />
            <h3>{member.name}</h3>
            <p style={{ color: "var(--primary)", margin: ".5rem 0" }}>{member.role}</p>
            <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>{member.description}</p>
          </article>
        ))}
      </div>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}><Link href="/contact" className="btn-primary">📬 Get in Touch</Link></div>
    </main>
  );
}
