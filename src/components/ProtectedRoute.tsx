import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, loading } = useAuth();

  useEffect(() => {
    // If not loading and no token, redirect to login
    if (!loading && !token) {
      const isExpired = window.location.search.includes("expired=true");
      window.location.href = isExpired ? "/login?expired=true" : "/login";
    }
  }, [token, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500"></div>
          <p className="font-mono text-xs tracking-wider text-zinc-400">LOADING ASTRA...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
