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
    ? 260
    : Math.max(36, 42 + solvedCount * 3 + Math.min(40, currentStreak * 4));

  const [boostEnergy, setBoostEnergy] = useState(100);
  const [isBoosting, setIsBoosting] = useState(false);
  const [bonusSaves, setBonusSaves] = useState(() => {
    return parseInt(localStorage.getItem("codesync_zebra_bonus_saves") || "0", 10);
  });
  const [showCheer, setShowCheer] = useState(false);

  // Runtime animation state ref
  const simStateRef = useRef({
    zebraX: isEscapedState ? 340 : 180,
    lionX: 45,
    targetDistance: baseDistance,
    actualDistance: baseDistance,
    speed: isEscapedState ? 0.8 : 3.8,
    trackOffset: 0,
    tick: 0,
    particles: [],
    speedLines: [],
    stars: Array.from({ length: 28 }, () => ({
      x: Math.random() * 400,
      y: Math.random() * 45,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.03 + 0.01,
    })),
    boostTimer: 0,
  });

  // Update target distance when baseDistance changes
  useEffect(() => {
    simStateRef.current.targetDistance = baseDistance;
    simStateRef.current.speed = isEscapedState ? 0.6 : 3.8;
  }, [baseDistance, isEscapedState]);

  // Handle manual sprint boost
  const handleBoost = useCallback(() => {
    if (boostEnergy < 25 || isBoosting) return;

    setBoostEnergy((prev) => Math.max(0, prev - 35));
    setIsBoosting(true);
    setShowCheer(true);
    simStateRef.current.boostTimer = 85;

    setTimeout(() => {
      setShowCheer(false);
      setIsBoosting(false);
    }, 1500);
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

    // Setup HiDPI canvas backing
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 360;
    const displayHeight = 124;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = "100%";
    canvas.style.height = `${displayHeight}px`;

    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min(32, time - lastTime) / 16.67;
      lastTime = time;

      const sim = simStateRef.current;
      sim.tick += 1 * dt;

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = displayWidth;
      const height = displayHeight;

      // Handle Boost
      let currentZebraSpeed = sim.speed;
      if (sim.boostTimer > 0) {
        sim.boostTimer -= 1 * dt;
        currentZebraSpeed = sim.speed * 1.9;
      }

      // Parallax track scroll
      if (!isEscapedState) {
        sim.trackOffset = (sim.trackOffset + currentZebraSpeed * 1.4 * dt) % 80;
      }

      // Distance calculation with smooth easing
      if (isEscapedState) {
        sim.actualDistance += (280 - sim.actualDistance) * 0.04 * dt;
      } else if (sim.boostTimer > 0) {
        sim.actualDistance = Math.min(width - 100, sim.actualDistance + 0.8 * dt);
      } else {
        sim.actualDistance += (sim.targetDistance - sim.actualDistance) * 0.06 * dt;
      }

      sim.lionX = 42;
      sim.zebraX = isEscapedState ? width + 50 : Math.min(width - 60, sim.lionX + sim.actualDistance);

      // Check if zebra safely escaped the screen
      if (!isEscapedState && sim.actualDistance > width - 110) {
        setBonusSaves((prev) => {
          const next = prev + 1;
          localStorage.setItem("codesync_zebra_bonus_saves", String(next));
          return next;
        });
        sim.actualDistance = sim.targetDistance * 0.8;
      }

      // Spawn dust particles
      if (!isEscapedState) {
        if (Math.random() < (sim.boostTimer > 0 ? 0.75 : 0.35)) {
          sim.particles.push({
            x: sim.zebraX + 8 + (Math.random() * 6 - 3),
            y: height - 23 + Math.random() * 3,
            vx: -(Math.random() * 2.5 + (sim.boostTimer > 0 ? 3.5 : 1.5)),
            vy: -(Math.random() * 1.2 + 0.3),
            radius: Math.random() * (sim.boostTimer > 0 ? 3.5 : 2.2) + 1,
            alpha: 0.8,
            color: sim.boostTimer > 0 ? "#f97316" : "#cbd5e1",
          });
        }
        if (Math.random() < 0.3) {
          sim.particles.push({
            x: sim.lionX + 8,
            y: height - 23 + Math.random() * 3,
            vx: -(Math.random() * 2.8 + 1.8),
            vy: -(Math.random() * 1.0 + 0.2),
            radius: Math.random() * 2.6 + 1.2,
            alpha: 0.75,
            color: "#d97706",
          });
        }

        if (sim.boostTimer > 0 && Math.random() < 0.6) {
          sim.speedLines.push({
            x: width + 10,
            y: height - 60 + Math.random() * 40,
            length: Math.random() * 25 + 15,
            speed: Math.random() * 6 + 12,
            alpha: 0.6,
          });
        }
      }

      // ----------------- DRAW SAVANNAH NIGHT ENVIRONMENT -----------------
      ctx.clearRect(0, 0, width, height);

      // Deep Atmospheric Night Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#05080d");
      skyGrad.addColorStop(0.5, "#0b111a");
      skyGrad.addColorStop(1, "#121b28");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Twinkling Stars
      sim.stars.forEach((star) => {
        const starAlpha = 0.3 + 0.4 * Math.sin(sim.tick * star.twinkleSpeed + star.x);
        ctx.fillStyle = `rgba(226, 232, 240, ${Math.max(0.1, starAlpha)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Glowing Crescent Savannah Moon
      const moonX = width - 42;
      const moonY = 24;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 22);
      moonGlow.addColorStop(0, "rgba(254, 243, 199, 0.22)");
      moonGlow.addColorStop(1, "rgba(254, 243, 199, 0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#090e15";
      ctx.beginPath();
      ctx.arc(moonX - 2.8, moonY - 1.5, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Distant Parallax Mountain Range
      ctx.fillStyle = "#0c131d";
      ctx.beginPath();
      ctx.moveTo(0, height - 38);
      for (let i = 0; i <= width; i += 20) {
        const h = Math.sin((i + sim.trackOffset * 0.12) * 0.018) * 11 + Math.cos(i * 0.035) * 5;
        ctx.lineTo(i, height - 48 + h);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Acacia Tree Silhouettes
      const drawAcacia = (treeX, treeBaseY, treeScale) => {
        ctx.fillStyle = "#091018";
        ctx.beginPath();
        ctx.moveTo(treeX, treeBaseY);
        ctx.lineTo(treeX + 1.5 * treeScale, treeBaseY - 18 * treeScale);
        ctx.lineTo(treeX - 10 * treeScale, treeBaseY - 22 * treeScale);
        ctx.lineTo(treeX + 10 * treeScale, treeBaseY - 24 * treeScale);
        ctx.lineTo(treeX + 2 * treeScale, treeBaseY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(treeX - 4 * treeScale, treeBaseY - 23 * treeScale, 14 * treeScale, 4.5 * treeScale, -0.05, 0, Math.PI * 2);
        ctx.ellipse(treeX + 6 * treeScale, treeBaseY - 24 * treeScale, 11 * treeScale, 3.8 * treeScale, 0.08, 0, Math.PI * 2);
        ctx.fill();
      };

      const tree1X = (width * 0.25 - sim.trackOffset * 0.25) % (width + 60);
      const tree2X = (width * 0.78 - sim.trackOffset * 0.25) % (width + 60);
      drawAcacia(tree1X < -30 ? tree1X + width + 60 : tree1X, height - 36, 0.75);
      drawAcacia(tree2X < -30 ? tree2X + width + 60 : tree2X, height - 36, 0.9);

      // Midground Dunes
      ctx.fillStyle = "#141c28";
      ctx.beginPath();
      ctx.moveTo(0, height - 30);
      for (let i = 0; i <= width; i += 25) {
        const h = Math.sin((i + sim.trackOffset * 0.35) * 0.028) * 6;
        ctx.lineTo(i, height - 36 + h);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Ground Surface / Sprint Track
      const groundGrad = ctx.createLinearGradient(0, height - 24, 0, height);
      groundGrad.addColorStop(0, "#192230");
      groundGrad.addColorStop(1, "#0d131d");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, height - 24, width, 24);

      // Top Ground Border Rim (Safety Orange Glow Line)
      ctx.strokeStyle = "rgba(249, 115, 22, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height - 24);
      ctx.lineTo(width, height - 24);
      ctx.stroke();

      // Moving Ground Grid Dashes
      ctx.strokeStyle = "rgba(249, 115, 22, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -(sim.trackOffset * 1.6) % 36; x < width; x += 36) {
        ctx.moveTo(x, height - 24);
        ctx.lineTo(x + 18, height - 24);
      }
      ctx.stroke();

      // Lower Speed Marker Dashes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -(sim.trackOffset * 2.2) % 24; x < width; x += 24) {
        ctx.moveTo(x, height - 12);
        ctx.lineTo(x + 10, height - 12);
      }
      ctx.stroke();

      // Speed lines rendering
      for (let i = sim.speedLines.length - 1; i >= 0; i--) {
        const sl = sim.speedLines[i];
        sl.x -= sl.speed * dt;
        sl.alpha -= 0.02 * dt;
        if (sl.x < -40 || sl.alpha <= 0) {
          sim.speedLines.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(249, 115, 22, ${sl.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x + sl.length, sl.y);
        ctx.stroke();
      }

      // Dust Particles rendering
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const p = sim.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= 0.025 * dt;
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

      // ----------------- DISTANCE TETHER & STATUS -----------------
      if (!isEscapedState) {
        const meterDist = Math.max(1, Math.round(sim.actualDistance / 3));
        const isCritical = meterDist <= 15;
        const tetherColor = isCritical ? "#ef4444" : meterDist <= 30 ? "#f59e0b" : "#10b981";

        // Animated Connecting Arc
        ctx.strokeStyle = isCritical ? "rgba(239, 68, 68, 0.4)" : "rgba(249, 115, 22, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const startX = sim.lionX + 34;
        const endX = sim.zebraX + 4;
        const midX = (startX + endX) / 2;
        const arcHeight = height - 58 - Math.sin((sim.tick * 0.08) % Math.PI) * 4;
        ctx.moveTo(startX, height - 38);
        ctx.quadraticCurveTo(midX, arcHeight, endX, height - 38);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sleek Distance Pill
        ctx.fillStyle = "rgba(8, 12, 18, 0.88)";
        ctx.strokeStyle = tetherColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(midX - 22, height - 74, 44, 18, 9);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = tetherColor;
        ctx.font = "bold 10px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${meterDist}m`, midX, height - 64.5);
      } else {
        // Escaped Celebration Badge
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 11px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎉 Daily Goal Met: Zebra Escaped to Safety!", width / 2, height - 54);
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "10px 'IBM Plex Sans', sans-serif";
        ctx.fillText("POTD Solved • Both enjoying a peaceful savannah nap 💤", width / 2, height - 38);
      }

      // ==========================================
      // 🦁 HIGH-FIDELITY ORGANIC LION (Predator Gallop)
      // ==========================================
      if (isEscapedState) {
        // Peaceful Resting Lion
        const lx = 48;
        const ly = height - 34;

        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(lx + 20, ly + 14, 24, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.ellipse(lx + 18, ly + 8, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#78350f";
        ctx.beginPath();
        ctx.arc(lx + 28, ly + 5, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#92400e";
        ctx.beginPath();
        ctx.arc(lx + 29, ly + 6, 8.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(lx + 32, ly + 7, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.arc(lx + 36, ly + 8.5, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#451a03";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(lx + 33, ly + 6.5, 2.2, 0, Math.PI);
        ctx.stroke();

        ctx.fillStyle = "#b45309";
        ctx.beginPath();
        ctx.arc(lx + 35, ly + 13, 4, 0, Math.PI * 2);
        ctx.arc(lx + 8, ly + 13, 4, 0, Math.PI * 2);
        ctx.fill();

        const zTick = (sim.tick * 0.04) % 3;
        ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
        ctx.font = "bold 9.5px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("z", lx + 40, ly - zTick * 4);
        ctx.fillText("Z", lx + 47, ly - 6 - zTick * 5);
      } else {
        const lCycle = sim.tick * 0.35;
        const lBob = Math.sin(lCycle * 2) * 2.5;
        const lx = sim.lionX;
        const ly = height - 44 + lBob;

        // Dynamic Cast Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(lx + 18, height - 22, 22 + Math.abs(Math.sin(lCycle)) * 4, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Helper function for organic volumetric feline limb
        const drawFelineLimb = (hipX, hipY, cycle, isBack, isFar) => {
          const mainColor = isFar ? "#92400e" : "#d97706";
          const pawColor = isFar ? "#78350f" : "#b45309";

          const swing = Math.sin(cycle);
          const bend = Math.cos(cycle);

          let jointX, jointY, pawX, pawY;

          if (isBack) {
            // Hind leg: Hip -> Hock (bends backward) -> Paw
            jointX = hipX - 4 - swing * 8;
            jointY = hipY + 8 + bend * 2;
            pawX = jointX + (isFar ? 3 : 5) - swing * 6;
            pawY = ly + 21 + Math.max(0, bend * 3);

            // Volumetric Thigh
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.moveTo(hipX - 3, hipY - 2);
            ctx.quadraticCurveTo(hipX - 6, hipY + 6, jointX - 2, jointY);
            ctx.lineTo(jointX + 3, jointY);
            ctx.quadraticCurveTo(hipX + 5, hipY + 5, hipX + 4, hipY - 2);
            ctx.closePath();
            ctx.fill();

            // Lower Hock & Paw
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 3.2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(jointX, jointY);
            ctx.lineTo(pawX, pawY);
            ctx.stroke();

            // Padded Paw
            ctx.fillStyle = pawColor;
            ctx.beginPath();
            ctx.ellipse(pawX + 1, pawY, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Front leg: Shoulder -> Elbow (bends forward) -> Paw
            jointX = hipX + 3 + swing * 8;
            jointY = hipY + 7 - bend * 2;
            pawX = jointX + (isFar ? 2 : 4) + swing * 7;
            pawY = ly + 21 + Math.max(0, -bend * 3);

            // Muscular Shoulder & Forearm
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.moveTo(hipX - 3, hipY - 2);
            ctx.quadraticCurveTo(hipX - 4, hipY + 6, jointX - 2, jointY);
            ctx.lineTo(jointX + 3, jointY);
            ctx.quadraticCurveTo(hipX + 6, hipY + 5, hipX + 4, hipY - 2);
            ctx.closePath();
            ctx.fill();

            // Foreleg & Padded Paw
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 3.2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(jointX, jointY);
            ctx.lineTo(pawX, pawY);
            ctx.stroke();

            ctx.fillStyle = pawColor;
            ctx.beginPath();
            ctx.ellipse(pawX + 1, pawY, 3.2, 2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        };

        // 1. Draw Far Hind & Front Limbs
        drawFelineLimb(lx + 6, ly + 6, lCycle, true, true);
        drawFelineLimb(lx + 23, ly + 7, lCycle + Math.PI * 1.1, false, true);

        // 2. Muscular Lion Torso
        const lSpine = Math.sin(lCycle * 2) * 0.1;
        const lionBodyGrad = ctx.createLinearGradient(lx, ly, lx + 30, ly + 14);
        lionBodyGrad.addColorStop(0, "#d97706");
        lionBodyGrad.addColorStop(0.5, "#f59e0b");
        lionBodyGrad.addColorStop(1, "#d97706");
        ctx.fillStyle = lionBodyGrad;
        ctx.beginPath();
        ctx.ellipse(lx + 15, ly + 7, 15, 8, lSpine, 0, Math.PI * 2);
        ctx.fill();

        // 3. Draw Near Hind & Front Limbs
        drawFelineLimb(lx + 9, ly + 6, lCycle + Math.PI * 0.4, true, false);
        drawFelineLimb(lx + 26, ly + 7, lCycle + Math.PI * 1.5, false, false);

        // 4. Voluminous Layered Mane
        ctx.fillStyle = "#451a03";
        ctx.beginPath();
        ctx.arc(lx + 24, ly + 4, 11.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#78350f";
        ctx.beginPath();
        ctx.arc(lx + 26, ly + 3.5, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#92400e";
        ctx.beginPath();
        ctx.arc(lx + 28, ly + 3, 8, 0, Math.PI * 2);
        ctx.fill();

        // 5. Head, Ear, Muzzle & Fierce Amber Eye
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(lx + 32, ly + 4, 6.5, 0, Math.PI * 2);
        ctx.fill();

        // Feline Ear
        ctx.fillStyle = "#78350f";
        ctx.beginPath();
        ctx.arc(lx + 28, ly - 2, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.arc(lx + 28.5, ly - 1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Snout & Nose
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.arc(lx + 36, ly + 5.5, 3.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#18181b";
        ctx.beginPath();
        ctx.arc(lx + 38.5, ly + 4.2, 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Amber Eye with Slit Pupil
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(lx + 32.5, ly + 2.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(lx + 33.2, ly + 2.5, 0.9, 1.8, 0.12, 0, Math.PI * 2);
        ctx.fill();

        // 6. Realistic Whipping Tail with Black Tuft
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(lx + 2, ly + 5);
        const tailWhip = Math.sin(lCycle * 1.5) * 6;
        const tailTipX = lx - 10;
        const tailTipY = ly + 2 + tailWhip;
        ctx.quadraticCurveTo(lx - 5, ly - 3 + tailWhip * 0.5, tailTipX, tailTipY);
        ctx.stroke();

        ctx.fillStyle = "#1c1917";
        ctx.beginPath();
        ctx.ellipse(tailTipX - 1.5, tailTipY, 3.5, 2.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ==========================================
      // 🦓 HIGH-FIDELITY ORGANIC ZEBRA (Equine Gallop)
      // ==========================================
      if (isEscapedState) {
        // Peaceful Resting Zebra
        const zx = width - 85;
        const zy = height - 34;

        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(zx + 18, zy + 14, 24, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(zx + 18, zy + 8, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Curved Stripes
        ctx.fillStyle = "#090d14";
        const drawRestStripe = (sx, sy, w, h, slant) => {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + slant, sy + h / 2, sx, sy + h);
          ctx.lineTo(sx + w, sy + h);
          ctx.quadraticCurveTo(sx + w + slant, sy + h / 2, sx + w, sy);
          ctx.closePath();
          ctx.fill();
        };
        drawRestStripe(zx + 8, zy + 2, 2.5, 12, 1.5);
        drawRestStripe(zx + 15, zy + 1, 2.8, 14, 2);
        drawRestStripe(zx + 22, zy + 2, 2.5, 12, -1.5);

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(zx + 25, zy + 8);
        ctx.lineTo(zx + 34, zy + 2);
        ctx.lineTo(zx + 40, zy + 6);
        ctx.lineTo(zx + 32, zy + 14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(zx + 40, zy + 7, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#090d14";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(zx + 34, zy + 4.5, 2, 0, Math.PI);
        ctx.stroke();

        ctx.fillStyle = "#090d14";
        ctx.fillRect(zx + 33, zy + 13, 4, 3);
        ctx.fillRect(zx + 9, zy + 13, 4, 3);

        const zTickZebra = ((sim.tick + 25) * 0.04) % 3;
        ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
        ctx.font = "bold 9.5px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("z", zx + 42, zy - zTickZebra * 4);
        ctx.fillText("Z", zx + 49, zy - 6 - zTickZebra * 5);
      } else {
        const zCycle = sim.tick * 0.38;
        const zBob = Math.sin(zCycle * 2) * 2.8;
        const zx = sim.zebraX;
        const zy = height - 46 + zBob;

        // Speed Boost Glow Aura
        if (sim.boostTimer > 0) {
          const auraGrad = ctx.createRadialGradient(zx + 18, zy + 10, 6, zx + 18, zy + 10, 32);
          auraGrad.addColorStop(0, "rgba(249, 115, 22, 0.45)");
          auraGrad.addColorStop(0.7, "rgba(249, 115, 22, 0.12)");
          auraGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(zx + 18, zy + 10, 32, 0, Math.PI * 2);
          ctx.fill();
        }

        // Cast Ground Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(zx + 18, height - 22, 22 + Math.abs(Math.sin(zCycle)) * 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Helper function for organic volumetric equine limb
        const drawEquineLimb = (hipX, hipY, cycle, isBack, isFar) => {
          const limbColor = isFar ? "#94a3b8" : "#ffffff";
          const hoofColor = "#090d14";

          const swing = Math.sin(cycle);
          const bend = Math.cos(cycle);

          let jointX, jointY, hoofX, hoofY;

          if (isBack) {
            // Hind leg: Hip -> Muscular Haunch -> Hock -> Fetlock -> Hoof
            jointX = hipX - 2 - swing * 10;
            jointY = hipY + 8 + bend * 2.5;
            hoofX = jointX + (isFar ? 3 : 5) - swing * 8;
            hoofY = zy + 22 + Math.max(0, bend * 3.5);

            // Volumetric Muscular Haunch / Thigh
            ctx.fillStyle = limbColor;
            ctx.beginPath();
            ctx.moveTo(hipX - 3, hipY - 2);
            ctx.quadraticCurveTo(hipX - 7, hipY + 6, jointX - 2, jointY);
            ctx.lineTo(jointX + 3.5, jointY);
            ctx.quadraticCurveTo(hipX + 6, hipY + 5, hipX + 4, hipY - 2);
            ctx.closePath();
            ctx.fill();

            // Lower Cannon bone
            ctx.strokeStyle = limbColor;
            ctx.lineWidth = 3.2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(jointX, jointY);
            ctx.lineTo(hoofX, hoofY);
            ctx.stroke();

            // Black Angled Hoof
            ctx.fillStyle = hoofColor;
            ctx.beginPath();
            ctx.moveTo(hoofX - 2, hoofY - 1);
            ctx.lineTo(hoofX + 3, hoofY - 1);
            ctx.lineTo(hoofX + 2, hoofY + 2.5);
            ctx.lineTo(hoofX - 3, hoofY + 2.5);
            ctx.closePath();
            ctx.fill();
          } else {
            // Foreleg: Shoulder -> Elbow -> Knee -> Fetlock -> Hoof
            jointX = hipX + 3 + swing * 10;
            jointY = hipY + 8 - bend * 2.5;
            hoofX = jointX + (isFar ? 2 : 4) + swing * 9;
            hoofY = zy + 22 + Math.max(0, -bend * 3.5);

            // Volumetric Shoulder Blade
            ctx.fillStyle = limbColor;
            ctx.beginPath();
            ctx.moveTo(hipX - 3, hipY - 2);
            ctx.quadraticCurveTo(hipX - 5, hipY + 6, jointX - 2, jointY);
            ctx.lineTo(jointX + 3.5, jointY);
            ctx.quadraticCurveTo(hipX + 6, hipY + 5, hipX + 4, hipY - 2);
            ctx.closePath();
            ctx.fill();

            // Lower Forearm
            ctx.strokeStyle = limbColor;
            ctx.lineWidth = 3.2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(jointX, jointY);
            ctx.lineTo(hoofX, hoofY);
            ctx.stroke();

            // Black Angled Hoof
            ctx.fillStyle = hoofColor;
            ctx.beginPath();
            ctx.moveTo(hoofX - 2, hoofY - 1);
            ctx.lineTo(hoofX + 3, hoofY - 1);
            ctx.lineTo(hoofX + 2, hoofY + 2.5);
            ctx.lineTo(hoofX - 3, hoofY + 2.5);
            ctx.closePath();
            ctx.fill();
          }
        };

        // 1. Draw Far Hind & Front Limbs
        drawEquineLimb(zx + 7, zy + 6, zCycle, true, true);
        drawEquineLimb(zx + 25, zy + 7, zCycle + Math.PI * 1.15, false, true);

        // 2. Sculpted Muscular White Equine Body
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(zx + 16, zy + 7, 16, 8.5, -0.04, 0, Math.PI * 2);
        ctx.fill();

        // 3. Realistic Curved Volumetric Zebra Stripes
        ctx.fillStyle = "#090d14";
        const drawBodyStripe = (sx, sy, w, h, slant) => {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + slant, sy + h / 2, sx + slant * 0.5, sy + h);
          ctx.lineTo(sx + w + slant * 0.5, sy + h);
          ctx.quadraticCurveTo(sx + w + slant, sy + h / 2, sx + w, sy);
          ctx.closePath();
          ctx.fill();
        };

        // Rump stripes (contouring around rounded hindquarters)
        drawBodyStripe(zx + 5, zy + 2, 2.4, 11, 2.5);
        drawBodyStripe(zx + 9, zy + 1, 2.6, 13, 3);
        // Flank stripes (sweeping diagonally)
        drawBodyStripe(zx + 14, zy, 2.6, 14, 2);
        drawBodyStripe(zx + 19, zy + 1, 2.6, 13, 0);
        // Shoulder stripes
        drawBodyStripe(zx + 24, zy + 2, 2.4, 11, -2);

        // 4. Draw Near Hind & Front Limbs
        drawEquineLimb(zx + 10, zy + 6, zCycle + Math.PI * 0.35, true, false);
        drawEquineLimb(zx + 28, zy + 7, zCycle + Math.PI * 1.55, false, false);

        // 5. Arched Neck & Equine Head
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(zx + 23, zy + 7);
        ctx.lineTo(zx + 31, zy - 2);
        ctx.lineTo(zx + 40, zy + 2);
        ctx.lineTo(zx + 28, zy + 14);
        ctx.closePath();
        ctx.fill();

        // Signature Upright Black Mohawk Mane along Crest
        ctx.fillStyle = "#090d14";
        ctx.beginPath();
        ctx.moveTo(zx + 21, zy + 5);
        ctx.lineTo(zx + 29, zy - 5);
        ctx.lineTo(zx + 33, zy - 3);
        ctx.lineTo(zx + 25, zy + 5);
        ctx.closePath();
        ctx.fill();

        // Pointed Equine Ear with Inner Pink/Cream Lining
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(zx + 30, zy - 3);
        ctx.lineTo(zx + 32, zy - 9);
        ctx.lineTo(zx + 35, zy - 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#090d14";
        ctx.beginPath();
        ctx.moveTo(zx + 31.5, zy - 3);
        ctx.lineTo(zx + 32.5, zy - 7.5);
        ctx.lineTo(zx + 34, zy - 3);
        ctx.closePath();
        ctx.fill();

        // Head Stripes
        drawBodyStripe(zx + 28, zy + 1, 2, 7, 2);
        drawBodyStripe(zx + 32, zy, 2, 6, 1.5);

        // Dark Muzzle & Nostril
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(zx + 40, zy + 3.5, 3.4, 0, Math.PI * 2);
        ctx.fill();

        // Alert Running Eye
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(zx + 34.5, zy + 1.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#090d14";
        ctx.beginPath();
        ctx.arc(zx + 35.2, zy + 1.5, 1.3, 0, Math.PI * 2);
        ctx.fill();

        // 6. Flowing Zebra Tail
        ctx.strokeStyle = "#090d14";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(zx + 2, zy + 5);
        const zTailWhip = Math.sin(zCycle * 1.5) * 5;
        ctx.quadraticCurveTo(zx - 6, zy + 1 + zTailWhip, zx - 10, zy + 9 + zTailWhip);
        ctx.stroke();
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isEscapedState]);

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
            <span className="zebra-potd-badge potd-done" title="Daily problem completed!">
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
