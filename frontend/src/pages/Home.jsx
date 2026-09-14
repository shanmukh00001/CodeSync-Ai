import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <div className="home-page">
      <nav className="home-nav">
        <div className="home-brand">
          <span className="home-brand-mark">CS</span>
          <span className="home-brand-text">CodeSync AI</span>
        </div>

        <div className="home-nav-actions">
          <Link to="/login" className="home-nav-link">
            Log In
          </Link>
          <Link to="/signup" className="home-btn home-btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      <main className="home-main">
        {/* Editorial Hero */}
        <section className="home-hero">
          <div className="home-hero-content">
            <h1 className="home-hero-title">
              Real-time collaborative code editor and evaluation platform.
            </h1>
            <p className="home-hero-description">
              CodeSync AI pairs synchronized code editing with multi-language
              sandboxed execution, room-based discussion, and structured
              problem solving.
            </p>
            <div className="home-hero-actions">
              <Link to="/signup" className="home-btn home-btn-primary home-btn-lg">
                Create Account
              </Link>
              <Link to="/login" className="home-btn home-btn-secondary home-btn-lg">
                Sign In
              </Link>
            </div>
          </div>

          {/* Interactive Editorial Preview Terminal */}
          <div className="home-preview-terminal">
            <div className="terminal-topbar">
              <div className="terminal-status-indicators">
                <span className="terminal-dot" />
                <span className="terminal-lang">C++ 20</span>
              </div>
              <div className="terminal-title">workspace/two-sum.cpp</div>
              <div className="terminal-tag">SYNC ACTIVE</div>
            </div>
            <pre className="terminal-body">
              <code>
{`#include <vector>
#include <unordered_map>

class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        std::unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (seen.count(complement)) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};`}
              </code>
            </pre>
            <div className="terminal-footer">
              <div className="terminal-eval-badge">
                <span className="eval-status-indicator" />
                <span>EVALUATION: ACCEPTED (12 ms • 10.4 MB)</span>
              </div>
              <div className="terminal-meta">2 PARTICIPANTS ONLINE</div>
            </div>
          </div>
        </section>

        {/* Structured Spec Table / Capability Matrix */}
        <section className="home-specs-section">
          <div className="specs-header">
            <h2>Core Platform Architecture</h2>
            <p>Engineered for deterministic evaluation and concurrent collaboration.</p>
          </div>

          <div className="specs-matrix">
            <div className="spec-row">
              <div className="spec-col-label">01 / Real-Time Sync</div>
              <div className="spec-col-title">Bidirectional State Synchronization</div>
              <div className="spec-col-desc">
                Socket.IO powered collaborative channels with timestamp validation,
                active participant presence, and automatic reconnect recovery.
              </div>
            </div>

            <div className="spec-row">
              <div className="spec-col-label">02 / Execution</div>
              <div className="spec-col-title">Isolated Polyglot Runtime</div>
              <div className="spec-col-desc">
                Evaluate solutions across C++, Python, JavaScript, and Java with
                strict memory and execution timeouts, visible cases, and hidden benchmark suites.
              </div>
            </div>

            <div className="spec-row">
              <div className="spec-col-label">03 / Workspaces</div>
              <div className="spec-col-title">Team Problem Rooms</div>
              <div className="spec-col-desc">
                Ephemeral 3-participant coding rooms with dynamic problem selection,
                integrated technical discussion, and live execution history.
              </div>
            </div>

            <div className="spec-row">
              <div className="spec-col-label">04 / Submissions</div>
              <div className="spec-col-title">Granular Test Breakdown</div>
              <div className="spec-col-desc">
                Inspection panels for failed test inputs, expected versus actual
                outputs, memory footprint, and chronological submission tracking.
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-inner">
          <div className="footer-brand">CodeSync AI</div>
          <div className="footer-copy">
            Built for developers. High-performance collaborative code evaluation.
          </div>
          <div className="footer-year">2026</div>
        </div>
      </footer>
    </div>
  );
}

export default Home;