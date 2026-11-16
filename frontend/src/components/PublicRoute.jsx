import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import LoadingScreen from "./common/LoadingScreen";

function PublicRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <LoadingScreen
        title="CodeSync AI"
        subtitle="Checking authentication state..."
      />
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PublicRoute;
