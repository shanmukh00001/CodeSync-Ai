# 1. Relevant File Paths

- **Backend Entry Point:** `backend/server.js`
- **Authentication/User Routes:** `backend/routes/userRoutes.js`
- **Authentication/User Controller:** *No separate controller exists; logic is inline within `backend/routes/userRoutes.js`.*
- **JWT Authentication Middleware:** `backend/middleware/authMiddleware.js`
- **User Model:** `backend/models/User.js`
- **Cookie Middleware:** *None found.*
- **Backend package.json:** `backend/package.json`
- **Frontend Login Component:** `frontend/src/pages/Login.jsx`
- **Frontend Signup Component:** `frontend/src/pages/Signup.jsx`
- **ProtectedRoute Component:** `frontend/src/ProtectedRoute.jsx`
- **PublicRoute Component:** `frontend/src/PublicRoute.jsx`
- **Frontend App Routing:** `frontend/src/App.jsx`
- **Frontend package.json:** `frontend/package.json`
- **AuthContext/AuthProvider:** *None found.*
- **Centralized API Service:** *None found.*

# 2. Backend Entry Point

The Express server is configured in `backend/server.js`.

- **Middleware:** 
  - `express.json()` is used to parse JSON bodies.
- **CORS:** 
  - `app.use(cors())` is used, which currently allows all origins. It does not have `credentials: true` configured.
- **Routes:** 
  - `/api/users` is mapped to `userRoutes`.
  - `/api/rooms` is mapped to `roomRoutes`.
  - `/` and `/test` are configured for health/debug checks.
- **Database Connection:** 
  - `mongoose.connect()` uses the `MONGO_URI` from the `.env` file.
- **Cookie Support:** 
  - There is NO cookie middleware (`cookie-parser`) imported or used.

# 3. Registration Flow

1. **Frontend Component:** `frontend/src/pages/Signup.jsx` calls `fetch()` on `http://localhost:5000/api/users/register`.
2. **API Endpoint Called:** `POST /api/users/register`
3. **Route & Controller:** Logic is handled inside `backend/routes/userRoutes.js`.
4. **Validation:** Checks if `name`, `email`, and `password` exist in the request body. Checks if `email` already exists in the database.
5. **Password Hashing:** `bcrypt.hash(password, 10)` generates the hash.
6. **User Model/Database Save:** `new User({...})` is instantiated with the hashed password and `await newUser.save()` commits it to MongoDB.
7. **Response Sent Back:** `201 Created` with a JSON payload containing a success message and `{ name, email }`. The frontend then navigates to `/login`.

# 4. Login Flow

1. **Frontend Component:** `frontend/src/pages/Login.jsx` calls `fetch()` on `http://localhost:5000/api/users/login`.
2. **API Endpoint Called:** `POST /api/users/login`
3. **Route & Controller:** Logic is handled inside `backend/routes/userRoutes.js`.
4. **User Lookup:** `User.findOne({ email })` retrieves the user by email.
5. **Password Comparison:** `bcrypt.compare(password, user.password)` compares the provided string with the hash.
6. **JWT Generation:** `jwt.sign()` generates a token using `JWT_SECRET`.
7. **JWT Payload:** `{ userId: user._id }`
8. **JWT Expiration:** Configured to `"7d"` (7 days).
9. **Response Sent Back:** `200 OK` with JSON payload `{ message, token, user: { name, email } }`.
10. **What the Frontend Does:** `localStorage.setItem("token", data.token)` saves the token, and the app navigates to `/dashboard`.

# 5. JWT Implementation

- **Generation:** Handled by `jsonwebtoken` (`jwt.sign`) in the login route.
- **Payload:** `{ userId: user._id }`
- **Expiration:** `"7d"`
- **Verification:** Handled by `jsonwebtoken` (`jwt.verify`) in `backend/middleware/authMiddleware.js`.
- **Token Extraction:** The middleware extracts the token exclusively from the `Authorization` header (`req.headers.authorization`), assuming a `Bearer <token>` format. It splits the string by space and takes the second element.
- **Missing Token:** Returns `401` with JSON message "No token, access denied".
- **Invalid/Expired Token:** `jwt.verify` throws an error, caught by a `try/catch` block, which returns `401` with JSON message "Invalid or expired token".
- **Routes Using Middleware:** `/api/users/profile` and all `/api/rooms/*` endpoints.

# 6. Cookie Support Status

| FEATURE | STATUS | EVIDENCE |
|---------|--------|----------|
| `cookie-parser` installed | NOT IMPLEMENTED | Absent from `backend/package.json` |
| `cookie-parser` configured | NOT IMPLEMENTED | Absent from `backend/server.js` |
| `res.cookie()` usage | NOT IMPLEMENTED | Not used in `backend/routes/userRoutes.js` |
| `req.cookies` usage | NOT IMPLEMENTED | Not used in `backend/middleware/authMiddleware.js` |
| CORS configuration | PARTIAL | `cors()` is used but lacks specific origin |
| `credentials: true` in CORS | NOT IMPLEMENTED | `cors()` is called without options |
| Explicit frontend origin configured | NOT IMPLEMENTED | `cors()` is called without options |

# 7. Current User (/me) Endpoint

**Exists as `/profile`**
- **Exact Endpoint:** `GET /api/users/profile`
- **Route File:** `backend/routes/userRoutes.js`
- **Controller:** Inline handler.
- **Authentication Middleware Used:** `protect` (`authMiddleware.js`)
- **Data Returned:** JSON object containing `name` and `email` of the authenticated user.

*Note: The frontend does NOT currently call this endpoint.*

# 8. Logout Implementation

1. **Backend Logout Endpoint:** Does NOT exist.
2. **Invalidate Token:** NO. The token remains valid on the server until it expires (7 days).
3. **Clear Cookie:** NO. Cookies are not used.
4. **Remove localStorage Data:** YES. `localStorage.removeItem("token")` is called.
5. **Frontend Component:** `frontend/src/pages/Profile.jsx` handles the logout logic.
6. **Confirmation Modal:** YES. `Profile.jsx` contains a modal that confirms the action before running the logout function.

# 9. Frontend Authentication State

- **Where JWT is Stored:** `localStorage`
- **Does Login use localStorage:** YES.
- **Does Signup automatically log in:** NO. It navigates to `/login`.
- **How ProtectedRoute determines auth:** It synchronously checks if `localStorage.getItem("token")` exists.
- **How PublicRoute determines auth:** It synchronously checks if `localStorage.getItem("token")` exists.
- **Does frontend verify token with backend:** NO. An expired or completely fabricated token string in localStorage bypasses the frontend route guards.
- **AuthContext:** NOT IMPLEMENTED.
- **AuthProvider:** NOT IMPLEMENTED.
- **Is state centralized:** NO. Each component/route reads from `localStorage` directly.
- **Loading state during auth check:** NO. Checking `localStorage` is synchronous and instant.

# 10. Route Protection

- **ProtectedRoute:** Wraps components like Dashboard, Room, Profile, Settings. It checks `const token = localStorage.getItem("token");`. If falsey, it returns `<Navigate to="/login" replace />`. Otherwise, it renders `children`.
- **PublicRoute:** Wraps components like Login, Signup. It checks `const token = localStorage.getItem("token");`. If truthy, it returns `<Navigate to="/dashboard" replace />`. Otherwise, it renders `children`.

# 11. Dependency Inventory

### Backend

| Dependency | Status |
|------------|--------|
| `express` | INSTALLED AND USED |
| `mongoose` | INSTALLED AND USED |
| `bcrypt` / `bcryptjs` | `bcryptjs` is INSTALLED AND USED |
| `jsonwebtoken` | INSTALLED AND USED |
| `cookie-parser` | NOT INSTALLED |
| `cors` | INSTALLED AND USED |
| `dotenv` | INSTALLED AND USED |
| `helmet` | NOT INSTALLED |
| `express-rate-limit` | NOT INSTALLED |

### Frontend

| Dependency | Status |
|------------|--------|
| `react` | INSTALLED AND USED |
| `react-router-dom` | INSTALLED AND USED |
| API client library | NOT INSTALLED (uses native `fetch`) |
| State management library | NOT INSTALLED (no Redux, Zustand, etc.) |

# 12. Complete Relevant Code

### 1. Backend Entry Point (`backend/server.js`)
```javascript
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();//Because we need to load the environment variables before we try to use them.

//express app
const app = express();

const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const roomRoutes = require("./routes/roomRoutes");
//middleware
app.use(cors());
app.use(express.json());//allows user to send or read data

//db-connection 
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.log("MongoDB connection error:", error.message);
    });

//routes
app.get("/", (req, res) => {
    res.send("CodeSync AI Backend is running!");
});

app.use("/", testRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);

//start server
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});
```

### 2 & 3. User/Auth Routes and Controller (`backend/routes/userRoutes.js`)
```javascript
const express=require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");

const router=express.Router();

//for register 
router.post("/register", async (req, res) => {

    const { name, email, password } = req.body;
    // Check if all required fields exist
    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }
    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        return res.status(400).json({
            message: "User already exists"
        });
    }
    const hashedPassword = await bcrypt.hash(password, 10);//10//This is the salt rounds (cost factor).
    // Create a new user object
    const newUser = new User({
        name,
        email,
        password: hashedPassword
    });

    // Save the user to MongoDB
    await newUser.save();//This actually sends the data to MongoDB:

    res.status(201).json({
        message: "User registration data received successfully",
        user: {
            name: name,
            email: email
        }
    });

    console.log(name);
    console.log(email);
    console.log(password);
});

//for login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // 1. Check if email and password are provided
    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    // 2. Find the user using email
    const user = await User.findOne({ email });

    // 3. Check whether the user exists
    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
        });
    }

    // 4. Compare entered password with stored hashed password
    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    // 5. Check whether passwords match
    if (!isMatch) {
        return res.status(400).json({
            message: "Invalid email or password"
        });
    }
    //jwt authentication
    const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
    );
    // 6. Login successful
    res.status(200).json({
        message: "Login successful",
        token:token,
        user: {
            name: user.name,
            email: user.email
        }
    });
});

//profile route
router.get("/profile", protect, async (req, res) => {
    const user = await User.findById(req.userId);//verifying the decoded one with the db and sending to postman

    res.status(200).json({
        name: user.name,
        email: user.email
    });
});

module.exports = router;
```

### 4. JWT Authentication Middleware (`backend/middleware/authMiddleware.js`)
```javascript
const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {//Without next(), the request would stop inside the middleware.
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "No token, access denied"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.userId = decoded.userId;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

module.exports = protect;
```

### 5. User Model (`backend/models/User.js`)
```javascript
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    activeRoom: {
    type: String,
    default: null
}
});

const User = mongoose.model("User", userSchema);
module.exports = User;
```

### 6. Login Component (`frontend/src/pages/Login.jsx`)
```jsx
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Login.css"
function Login() {


    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        const response = await fetch(
          "http://localhost:5000/api/users/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem("token", data.token);
          navigate("/dashboard");
        }else {
          setError(data.message);
        }

        console.log(data);
      } catch (error) {
        console.error("Login error:", error);
      }

      finally {
        setLoading(false);
      }
    };
  return (

    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Log in to continue to CodeSync AI</p>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form >

        <p>
          Don't have an account?{" "}
          <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
```

### 7. ProtectedRoute (`frontend/src/ProtectedRoute.jsx`)
```jsx
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
```

### 8. PublicRoute (`frontend/src/PublicRoute.jsx`)
```jsx
import { Navigate } from "react-router-dom";

function PublicRoute({ children }) {
  const token = localStorage.getItem("token");

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PublicRoute;
```

### 9. Existing AuthContext
*None present in the repository.*

### 10. Relevant App.jsx routing code (`frontend/src/App.jsx`)
```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Room from "./pages/Room";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <ProtectedRoute>
              <Room />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

# 13. Current Auth Architecture Diagram

```
[Login Component] 
       │ 
       ├─(1) User enters email & password
       │
       ▼
[fetch POST /api/users/login] ──▶ (Backend)
                                     │
                                     ├─(2) User.findOne()
                                     ├─(3) bcrypt.compare()
                                     ├─(4) jwt.sign()
                                     │
                                  (Response)
                                     │
       ◀─────────────────────────────┘
       │
       ├─(5) Response: { token: "..." }
       │
       ▼
[localStorage.setItem("token")]
       │
       ├─(6) navigate("/dashboard")
       │
       ▼
[ProtectedRoute]
       │
       ├─(7) Checks localStorage.getItem("token") -> Exists!
       │
       ▼
[Dashboard / Profile / Room] 
       │
       ├─(8) User clicks Logout in Profile.jsx
       │
       ▼
[localStorage.removeItem("token")]
       │
       ├─(9) navigate("/login")
```

# 14. Gaps Before Cookie-Based Authentication

- `cookie-parser` is not installed or configured on the backend.
- `cors` is not configured to accept `credentials: true` or a specific origin.
- The `login` endpoint currently returns the JWT in the JSON payload, rather than attaching it via `res.cookie()`.
- The `authMiddleware` currently exclusively checks `req.headers.authorization`, rather than `req.cookies`.
- The frontend `fetch` calls (both login and any future protected requests) do not include `credentials: "include"`.
- The frontend relies on `localStorage.getItem("token")` to render Protected/Public routes, which will not work for HttpOnly cookies.
- No `AuthContext` is set up to store and provide the global authenticated state.
- No backend `/logout` endpoint exists to clear the cookie.
- The `Profile.jsx` component performs a frontend-only logout (`localStorage.removeItem`).

# 15. Verification Summary

| AREA | STATUS | CONFIDENCE | NOTES |
|------|--------|------------|-------|
| Login/Signup Backend Flow | IMPLEMENTED | HIGH | Standard bcrypt + JWT logic inside `userRoutes.js`. |
| JWT Configuration | IMPLEMENTED | HIGH | Expires in 7d, signed with `.env` secret. |
| Cookie Configuration | NOT IMPLEMENTED | HIGH | `cookie-parser` missing, no `res.cookie` calls. |
| Current User Endpoint | IMPLEMENTED | HIGH | `/api/users/profile` exists but is unused by the frontend. |
| Logout Logic | IMPLEMENTED | HIGH | Handled fully in frontend by deleting `localStorage` key. |
| Frontend Auth State | IMPLEMENTED | HIGH | Relies strictly on `localStorage` presence checks (synchronous). |
| AuthContext | NOT IMPLEMENTED | HIGH | Neither Context nor Provider exists in the project. |
