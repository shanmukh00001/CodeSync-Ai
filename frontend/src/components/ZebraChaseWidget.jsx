import { useState, useEffect, useRef, useCallback } from "react";
import "./ZebraChaseWidget.css";

export default function ZebraChaseWidget({
  solvedCount = 0,
  currentStreak = 0,
  todaySubmissions = 0,
  onPracticeClick,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Per-day submission logic:
  // 0 submissions today: Lion is close (distance ~28px, active chase)
  // 1+ submissions today: Zebra escaped the canvas, lion & zebra rest in peace!
  const isEscapedState = todaySubmissions >= 1;

  const baseDistance = isEscapedState
    ? 280
    : Math.max(24, 28 + solvedCount * 2 + Math.min(30, currentStreak * 3));

  const [boostEnergy, setBoostEnergy] = useState(100);
  const [isBoosting, setIsBoosting] = useState(false);
  const [bonusSaves, setBonusSaves] = useState(() => {
    return parseInt(localStorage.getItem("codesync_zebra_bonus_saves") || "0", 10);
  });
  const [showCheer, setShowCheer] = useState(false);

  // Total saved counts daily completed escapes + solved problems
  const totalSaved = Math.max(solvedCount, solvedCount + bonusSaves);

  // Runtime animation state ref
  const simStateRef = useRef({
    zebraX: isEscapedState ? 380 : 180,
    lionX: 45,
    targetDistance: baseDistance,
    actualDistance: baseDistance,
    speed: isEscapedState ? 0.8 : 3.5,
    trackOffset: 0,
    tick: 0,
    particles: [],
    boostTimer: 0,
  });

  // Update target distance when baseDistance changes
  useEffect(() => {
    simStateRef.current.targetDistance = baseDistance;
    if (isEscapedState) {
      simStateRef.current.speed = 0.5;
    } else {
      simStateRef.current.speed = 3.5;
    }
  }, [baseDistance, isEscapedState]);

  // Handle manual sprint boost
  const handleBoost = useCallback(() => {
    if (boostEnergy < 25 || isBoosting) return;

    setBoostEnergy((prev) => Math.max(0, prev - 35));
    setIsBoosting(true);
    setShowCheer(true);
    simStateRef.current.boostTimer = 75; // frames of boost

    setTimeout(() => {
      setShowCheer(false);
      setIsBoosting(false);
    }, 1400);
  }, [boostEnergy, isBoosting]);

  // Recharge boost energy over time
  useEffect(() => {
    const timer = setInterval(() => {
      setBoostEnergy((prev) => {
        if (prev >= 100) return 100;
        return Math.min(100, prev + 5);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Main Canvas 60fps Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min(32, time - lastTime) / 16.67;
      lastTime = time;

      const sim = simStateRef.current;
      sim.tick += 1 * dt;

      const width = canvas.width;
      const height = canvas.height;

      // Handle Boost
      let currentZebraSpeed = sim.speed;
      if (sim.boostTimer > 0) {
        sim.boostTimer -= 1 * dt;
        currentZebraSpeed = sim.speed * 1.8;
      }

      // Parallax track scroll (slows down when lion rests)
      if (!isEscapedState) {
        sim.trackOffset = (sim.trackOffset + currentZebraSpeed * 1.2 * dt) % 40;
      }

      // Distance calculation with smooth easing
      if (isEscapedState) {
        sim.actualDistance += (280 - sim.actualDistance) * 0.04 * dt;
      } else if (sim.boostTimer > 0) {
        sim.actualDistance = Math.min(width - 90, sim.actualDistance + 0.6 * dt);
      } else {
        sim.actualDistance += (sim.targetDistance - sim.actualDistance) * 0.05 * dt;
      }

      sim.lionX = 40;
      sim.zebraX = isEscapedState ? width + 40 : Math.min(width - 55, sim.lionX + sim.actualDistance);

      // Check if zebra safely escaped the screen
      if (!isEscapedState && sim.actualDistance > width - 110) {
        setBonusSaves((prev) => {
          const next = prev + 1;
          localStorage.setItem("codesync_zebra_bonus_saves", String(next));
          return next;
        });
        sim.actualDistance = sim.targetDistance * 0.8;
      }

      // Spawn dust particles only when running
      if (!isEscapedState) {
        if (Math.random() < (sim.boostTimer > 0 ? 0.7 : 0.3)) {
          sim.particles.push({
            x: sim.zebraX + 10,
            y: height - 26 + (Math.random() * 6 - 3),
            vx: -(Math.random() * 2 + (sim.boostTimer > 0 ? 3 : 1)),
            vy: -(Math.random() * 1.5),
            radius: Math.random() * (sim.boostTimer > 0 ? 3.5 : 2) + 1,
            alpha: 1,
            color: sim.boostTimer > 0 ? "#ff7e35" : "#64748b",
          });
        }

        // Lion dust
        if (Math.random() < 0.25) {
          sim.particles.push({
            x: sim.lionX + 10,
            y: height - 26 + (Math.random() * 6 - 3),
            vx: -(Math.random() * 1.5 + 1),
            vy: -(Math.random() * 1),
            radius: Math.random() * 2 + 1,
            alpha: 0.8,
            color: "#d97706",
          });
        }
      }

      // ----------------- DRAW BACKGROUND -----------------
      ctx.clearRect(0, 0, width, height);

      // Gradient Night Savannah Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#080c10");
      skyGrad.addColorStop(1, "#111822");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant mountains / dunes silhouette
      ctx.fillStyle = "#151e2b";
      ctx.beginPath();
      ctx.moveTo(0, height - 35);
      for (let i = 0; i <= width; i += 30) {
        const h = Math.sin((i + sim.trackOffset * 0.3) * 0.02) * 8 + Math.cos(i * 0.05) * 4;
        ctx.lineTo(i, height - 42 + h);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Ground / Running Track
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, height - 28, width, 28);

      // Track grid dashes
      ctx.strokeStyle = "rgba(255, 126, 53, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -sim.trackOffset; x < width; x += 24) {
        ctx.moveTo(x, height - 28);
        ctx.lineTo(x + 12, height - 28);
      }
      ctx.stroke();

      // Secondary track line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      for (let x = -sim.trackOffset * 1.5; x < width; x += 16) {
        ctx.moveTo(x, height - 12);
        ctx.lineTo(x + 8, height - 12);
      }
      ctx.stroke();

      // ----------------- PARTICLES -----------------
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const p = sim.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= 0.03 * dt;
        if (p.alpha <= 0) {
          sim.particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ----------------- DRAW DISTANCE TETHER / STATUS -----------------
      if (!isEscapedState) {
        ctx.strokeStyle = sim.actualDistance > 70 ? "rgba(52, 211, 153, 0.25)" : "rgba(248, 113, 113, 0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sim.lionX + 24, height - 42);
        ctx.lineTo(sim.zebraX + 8, height - 42);
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance tag in middle
        const midX = (sim.lionX + sim.zebraX) / 2 + 12;
        const meterDist = Math.round(sim.actualDistance / 3);
        ctx.fillStyle = sim.actualDistance > 70 ? "#34d399" : "#f87171";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${meterDist}m`, midX, height - 46);
      } else {
        // Escaped Success Banner inside canvas
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 10.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("🎉 Daily Goal Met: Zebra Escaped & Lion Resting!", width / 2, height - 48);
        ctx.fillStyle = "rgba(52, 211, 153, 0.75)";
        ctx.font = "9px 'IBM Plex Sans', sans-serif";
        ctx.fillText("Daily Solve Recorded • Both taking a well-deserved nap 💤", width / 2, height - 34);
      }

      // ----------------- DRAW LION 🦁 -----------------
      if (isEscapedState) {
        // RESTING / SLEEPING LION 😴
        const lx = 55;
        const ly = height - 36;

        // Lion Body (Resting flat)
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.ellipse(lx + 16, ly + 14, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lion Mane & Head (Resting on paws)
        ctx.fillStyle = "#b45309";
        ctx.beginPath();
        ctx.arc(lx + 28, ly + 12, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f59e0b"; // Snout
        ctx.beginPath();
        ctx.arc(lx + 32, ly + 14, 5, 0, Math.PI * 2);
        ctx.fill();

        // Closed sleeping eye curve (U shape)
        ctx.strokeStyle = "#451a03";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(lx + 31, ly + 12, 2, 0, Math.PI);
        ctx.stroke();

        // Paws tucked in
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.arc(lx + 34, ly + 18, 3.5, 0, Math.PI * 2);
        ctx.arc(lx + 10, ly + 18, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Floating 'Z z z' sleep particles for Lion
        const zTick = (sim.tick * 0.05) % 3;
        ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("z", lx + 36, ly - 2 - zTick * 4);
        ctx.fillText("Z", lx + 42, ly - 8 - zTick * 5);
      } else {
        // RUNNING LION 🦁
        const lionBob = Math.sin(sim.tick * 0.4) * 2.5;
        const lionLegCycle = Math.sin(sim.tick * 0.5);
        const lx = sim.lionX;
        const ly = height - 48 + lionBob;

        // Lion Body
        ctx.fillStyle = "#d97706"; // Amber body
        ctx.beginPath();
        ctx.ellipse(lx + 16, ly + 14, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lion Mane & Head
        ctx.fillStyle = "#b45309"; // Darker mane
        ctx.beginPath();
        ctx.arc(lx + 28, ly + 8, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f59e0b"; // Snout
        ctx.beginPath();
        ctx.arc(lx + 32, ly + 9, 5, 0, Math.PI * 2);
        ctx.fill();

        // Lion Eye
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(lx + 31, ly + 7, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Lion Ears
        ctx.fillStyle = "#b45309";
        ctx.beginPath();
        ctx.arc(lx + 24, ly + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Lion Legs (animated)
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Back legs
        ctx.moveTo(lx + 6, ly + 18);
        ctx.lineTo(lx + 3 + lionLegCycle * 5, ly + 28);
        // Front legs
        ctx.moveTo(lx + 24, ly + 18);
        ctx.lineTo(lx + 27 - lionLegCycle * 6, ly + 28);
        ctx.stroke();

        // Lion Tail
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx + 2, ly + 12);
        ctx.quadraticCurveTo(lx - 8, ly + 6 + Math.sin(sim.tick * 0.3) * 4, lx - 4, ly + 2);
        ctx.stroke();
      }

      // ----------------- DRAW ZEBRA 🦓 -----------------
      if (isEscapedState) {
        // RESTING / SLEEPING ZEBRA 😴
        const zx = width - 100;
        const zy = height - 36;

        // Zebra Body (Resting flat)
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.ellipse(zx + 16, zy + 14, 16, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Zebra Stripes
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(zx + 10, zy + 7);
        ctx.lineTo(zx + 10, zy + 20);
        ctx.moveTo(zx + 16, zy + 6.5);
        ctx.lineTo(zx + 16, zy + 21);
        ctx.moveTo(zx + 22, zy + 7);
        ctx.lineTo(zx + 22, zy + 20);
        ctx.stroke();

        // Zebra Neck & Head (Resting on ground)
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.moveTo(zx + 24, zy + 14);
        ctx.lineTo(zx + 32, zy + 8);
        ctx.lineTo(zx + 38, zy + 12);
        ctx.lineTo(zx + 30, zy + 19);
        ctx.closePath();
        ctx.fill();

        // Zebra Head Stripes
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(zx + 29, zy + 9);
        ctx.lineTo(zx + 32, zy + 15);
        ctx.stroke();

        // Zebra Muzzle
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(zx + 38, zy + 13, 3, 0, Math.PI * 2);
        ctx.fill();

        // Closed sleeping eye
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(zx + 33, zy + 10, 1.8, 0, Math.PI);
        ctx.stroke();

        // Tucked hooves
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(zx + 33, zy + 19, 4, 3);
        ctx.fillRect(zx + 8, zy + 19, 4, 3);

        // Floating 'Z z z' sleep particles for Zebra
        const zTickZebra = ((sim.tick + 30) * 0.05) % 3;
        ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("z", zx + 36, zy - 2 - zTickZebra * 4);
        ctx.fillText("Z", zx + 42, zy - 8 - zTickZebra * 5);
      } else {
        // RUNNING ZEBRA 🦓
        const zebraBob = Math.sin(sim.tick * 0.45) * 3;
        const zebraLegCycle = Math.sin(sim.tick * 0.55);
        const zx = sim.zebraX;
        const zy = height - 50 + zebraBob;

        // Speed boost aura
        if (sim.boostTimer > 0) {
          ctx.fillStyle = "rgba(255, 126, 53, 0.25)";
          ctx.beginPath();
          ctx.arc(zx + 18, zy + 12, 20, 0, Math.PI * 2);
          ctx.fill();
        }

        // Zebra Body (White base)
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.ellipse(zx + 16, zy + 14, 15, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Zebra Black Stripes
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(zx + 10, zy + 7);
        ctx.lineTo(zx + 10, zy + 21);
        ctx.moveTo(zx + 16, zy + 6);
        ctx.lineTo(zx + 16, zy + 22);
        ctx.moveTo(zx + 22, zy + 7);
        ctx.lineTo(zx + 22, zy + 21);
        ctx.stroke();

        // Zebra Neck & Head
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.moveTo(zx + 24, zy + 14);
        ctx.lineTo(zx + 32, zy + 4);
        ctx.lineTo(zx + 38, zy + 7);
        ctx.lineTo(zx + 30, zy + 18);
        ctx.closePath();
        ctx.fill();

        // Zebra Head Stripes
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(zx + 28, zy + 7);
        ctx.lineTo(zx + 32, zy + 13);
        ctx.moveTo(zx + 33, zy + 5);
        ctx.lineTo(zx + 36, zy + 10);
        ctx.stroke();

        // Zebra Black Mane
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(zx + 22, zy + 10);
        ctx.lineTo(zx + 29, zy + 1);
        ctx.lineTo(zx + 32, zy + 3);
        ctx.closePath();
        ctx.fill();

        // Zebra Muzzle
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(zx + 38, zy + 8, 3, 0, Math.PI * 2);
        ctx.fill();

        // Zebra Eye
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(zx + 33, zy + 5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Zebra Legs (Animated running gallop)
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Back leg
        ctx.moveTo(zx + 6, zy + 18);
        ctx.lineTo(zx + 2 + zebraLegCycle * 7, zy + 30);
        // Front leg
        ctx.moveTo(zx + 26, zy + 18);
        ctx.lineTo(zx + 30 - zebraLegCycle * 7, zy + 30);
        ctx.stroke();

        // Zebra Hooves
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(zx + 1 + zebraLegCycle * 7, zy + 28, 3, 3);
        ctx.fillRect(zx + 29 - zebraLegCycle * 7, zy + 28, 3, 3);

        // Zebra Tail
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(zx + 2, zy + 12);
        ctx.lineTo(zx - 4, zy + 18 + Math.sin(sim.tick * 0.4) * 3);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isEscapedState]);

  const isSafe = baseDistance >= 60;

  return (
    <div className="zebra-chase-widget">
      <div className="zebra-chase-header">
        <div className="zebra-chase-title-group">
          <span className="zebra-icon-pill">🦓 VS 🦁</span>
          <div>
            <h4 className="zebra-widget-title">Save The Zebra</h4>
            <span className="zebra-widget-sub">
              {isEscapedState
                ? "Zebra escaped! Lion is taking a nap 💤"
                : "No solves today: Lion is closing in! ⚠️"}
            </span>
          </div>
        </div>

        <div className="zebra-stats-pill">
          {todaySubmissions >= 1 ? (
            <span className="zebra-potd-badge potd-done" title="Problem of the Day / Daily Goal completed!">
              ✓ POTD Done
            </span>
          ) : (
            <span className="zebra-potd-badge potd-pending" title="Solve a problem today to save the zebra!">
              ⏳ POTD Pending
            </span>
          )}
        </div>
      </div>

      <div className="zebra-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={340}
          height={110}
          className="zebra-canvas"
        />

        {showCheer && (
          <div className="zebra-speed-burst-toast">
            ⚡ SPEED BURST! +15m
          </div>
        )}
      </div>

      <div className="zebra-chase-footer">
        <div className="zebra-boost-bar-wrap" title={`Sprint Energy: ${boostEnergy}%`}>
          <div className="zebra-boost-label">
            <span>SPRINT ENERGY</span>
            <span>{boostEnergy}%</span>
          </div>
          <div className="zebra-boost-track">
            <div
              className={`zebra-boost-fill ${boostEnergy < 25 ? "is-low" : ""}`}
              style={{ width: `${boostEnergy}%` }}
            />
          </div>
        </div>

        <div className="zebra-actions-row">
          <button
            type="button"
            className={`zebra-boost-btn ${isBoosting ? "is-active" : ""}`}
            onClick={handleBoost}
            disabled={boostEnergy < 25 || isBoosting}
            title="Use sprint energy to give the zebra an instant speed boost!"
          >
            {isBoosting ? "Sprinting! 💨" : "Boost ⚡"}
          </button>

          {onPracticeClick && (
            <button
              type="button"
              className="zebra-practice-btn"
              onClick={onPracticeClick}
              title="Solving coding problems permanently increases the Zebra's safe distance!"
            >
              Solve to Save 🎯
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
