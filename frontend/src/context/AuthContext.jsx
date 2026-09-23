import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/users/me",
          {
            credentials: "include",
          }
        );

        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []); 

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isEmailVerified = !!user?.isEmailVerified;

  const refreshAuth = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/users/me", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        return data;
      }
    } catch (err) {
      console.error("Refresh auth failed:", err);
    }
    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        isAdmin,
        isEmailVerified,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

