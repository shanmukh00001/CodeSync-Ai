import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import LoadingScreen from "./common/LoadingScreen";

export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <LoadingScreen
        title="Admin Portal"
        subtitle="Verifying administrative credentials..."
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/unauthorized" state={{ from: location.pathname }} replace />;
  }

  return children;
}
