import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <div className="home">
      <nav className="navbar">
        <h2>CodeSync AI</h2>

        <div className="nav-links">
          <Link to="/login">Login</Link>
          <Link to="/signup">Get Started</Link>
        </div>
      </nav>

      <main className="hero">
        <h1>Code together. Build together.</h1>

        <p>
          A collaborative coding platform where developers can write,
          share, and solve problems together in real time.
        </p>

        <Link to="/signup">Get Started</Link>




{/* features */}
        <section className="features">
        <h2>Everything you need to code together</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>Real-time Collaboration</h3>
            <p>
              Write and edit code together with your team in real time.
            </p>
          </div>

          <div className="feature-card">
            <h3>Collaborative Rooms</h3>
            <p>
              Create or join coding rooms and work with other developers.
            </p>
          </div>

          <div className="feature-card">
            <h3>AI Assistance</h3>
            <p>
              Get intelligent assistance while solving coding problems.
            </p>
          </div>
        </div>
      </section>
      
{/* footer */}
      <footer className="footer">
        <p>© 2026 CodeSync AI. Collaborative coding made simple.</p>
      </footer>



      </main>
    </div>
  );
}

export default Home;