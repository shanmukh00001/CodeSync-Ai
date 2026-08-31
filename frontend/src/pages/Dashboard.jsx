import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {
  // Temporary problem data.
  // Later, this can come from your backend/database.

  const navigate = useNavigate();
  const problems = [
    {
      id: 1,
      title: "Two Sum",
      difficulty: "Easy",
      solved: true,
    },
    {
      id: 2,
      title: "Reverse String",
      difficulty: "Easy",
      solved: false,
    },
    {
      id: 3,
      title: "Valid Parentheses",
      difficulty: "Easy",
      solved: true,
    },
    {
      id: 4,
      title: "Longest Substring Without Repeating Characters",
      difficulty: "Medium",
      solved: false,
    },
    {
      id: 5,
      title: "Trapping Rain Water",
      difficulty: "Hard",
      solved: false,
    },
  ];

  // State for search input
  const [search, setSearch] = useState("");

  // State for difficulty filter
  const [difficulty, setDifficulty] = useState("All");

  // Filter problems
  const filteredProblems = problems.filter((problem) => {
    const matchesSearch = problem.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesDifficulty =
      difficulty === "All" ||
      problem.difficulty === difficulty;

    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="dashboard">

      {/* ================= HEADER ================= */}
      <header className="dashboard-header">
        <div className="logo">
          <h2>CodeSync AI</h2>
        </div>

        <div
              className="profile"
              onClick={() => navigate("/profile")}
            >
          <span>Profile</span>

          <div className="profile-avatar">
            👤
          </div>
        </div>
      </header>


      {/* ================= MAIN CONTENT ================= */}
      <main className="dashboard-content">

        {/* ================= PROBLEMS SECTION ================= */}
        <section className="problems-section">

          <div className="problems-header">
            <div>
              <h2>Problems</h2>
              <p className="problems-subtitle">
                Practice and solve coding challenges
              </p>
            </div>

            <div className="problem-filters">

              {/* Search */}
              <input
                type="text"
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* Difficulty filter */}
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="All">
                  All Difficulties
                </option>

                <option value="Easy">
                  Easy
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="Hard">
                  Hard
                </option>
              </select>

            </div>
          </div>


          {/* ================= PROBLEMS TABLE ================= */}
          <div className="problems-table-container">

            <table className="problems-table">

              <thead>
                <tr>
                  <th>Status</th>
                  <th>#</th>
                  <th>Problem</th>
                  <th>Difficulty</th>
                </tr>
              </thead>


              <tbody>

                {filteredProblems.length > 0 ? (

                  filteredProblems.map((problem) => (

                    <tr key={problem.id}>

                      {/* Status */}
                      <td>
                        {problem.solved ? (
                          <span
                            className="solved-icon"
                            title="Solved"
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            className="unsolved-icon"
                            title="Not solved"
                          >
                            ○
                          </span>
                        )}
                      </td>


                      {/* Problem number */}
                      <td>
                        {problem.id}
                      </td>


                      {/* Problem title */}
                      <td className="problem-title">
                        {problem.title}
                      </td>


                      {/* Difficulty */}
                      <td>

                        <span
                          className={
                            problem.difficulty === "Easy"
                              ? "easy"
                              : problem.difficulty === "Medium"
                              ? "medium"
                              : "hard"
                          }
                        >
                          {problem.difficulty}
                        </span>

                      </td>

                    </tr>

                  ))

                ) : (

                  <tr>
                    <td
                      colSpan="4"
                      className="no-problems"
                    >
                      No problems found
                    </td>
                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* ================= ROOMS SECTION ================= */}
        <aside className="rooms-section">

          {/* Active room */}
          <div className="active-room">

            <div className="section-title">
              <h2>Active Room</h2>
              <span className="status-dot"></span>
            </div>

            <div className="empty-room">
              <p>You are not currently in a room.</p>
            </div>

          </div>


          {/* Recently joined rooms */}
          <div className="recent-rooms">

            <h2>Recently Joined</h2>

            <div className="empty-room">
              <p>No recently joined rooms.</p>
            </div>

          </div>


          {/* Room actions */}
          <div className="room-actions">

            <button
              className="create-room-btn"
              type="button"
            >
              + Create Room
            </button>

            <button
              className="join-room-btn"
              type="button"
            >
              Join Room
            </button>

          </div>

        </aside>

      </main>

    </div>
  );
}

export default Dashboard;