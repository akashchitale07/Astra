import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import { KeyRound, Mail, ArrowRight, Eye, EyeOff, Sparkles, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"login" | "forgot">("login");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    // Check if session expired
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "true") {
      setError("Your login session has expired. Please log in again.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      // Redirect to dashboard on login success
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    
    // Simulate mock password reset
    setTimeout(() => {
      console.log(`[MOCK EMAIL SERVICE] Password reset link sent to: ${email}`);
      console.log(`[MOCK EMAIL SERVICE] Reset URL: http://localhost:3000/reset-password?email=${encodeURIComponent(email)}`);
      setLoading(false);
      setForgotSuccess(true);
    }, 1000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 font-sans text-white relative overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="w-full max-w-md space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold tracking-widest text-lg shadow-lg">
            A
          </div>
          <h1 className="font-sans text-3xl font-extrabold tracking-tight">ASTRA</h1>
          <p className="font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
            Advanced Smart Task & Research Assistant
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {view === "login" ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
                <p className="text-xs text-zinc-400">Enter your credentials to access your assistant</p>
              </div>

              <div className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-400">Password</label>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs font-semibold text-blue-500 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 py-3 pl-11 pr-11 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-3 px-4 font-semibold text-white shadow-lg transition-all hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            // Forgot Password Mock View
            <form onSubmit={handleForgotSubmit} className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">Reset Password</h2>
                <p className="text-xs text-zinc-400">Enter your email and we'll log a mock reset link to the console</p>
              </div>

              {forgotSuccess ? (
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-green-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Mock reset link sent successfully!</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Because this is Astra Phase 1, we log the password reset URL directly to the server terminal. Check your backend console logs for the activation link!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(false);
                      setView("login");
                    }}
                    className="text-xs font-bold text-blue-500 hover:underline block"
                  >
                    Back to Log In
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-3 px-4 font-semibold text-white shadow-lg transition-all hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <span>Send Recovery Link</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 block text-center w-full hover:underline"
                  >
                    Back to Log In
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Redirect to Signup */}
          <div className="mt-6 text-center text-xs text-zinc-500 border-t border-zinc-800/60 pt-6">
            <span>Don't have an account? </span>
            <button
              onClick={() => (window.location.href = "/signup")}
              className="font-bold text-blue-500 hover:underline"
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Elegant Footer Details */}
        <div className="flex items-center justify-center space-x-2.5 text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
          <Sparkles className="h-3.5 w-3.5 opacity-40 text-blue-500 animate-pulse" />
          <span>OFFLINE PERSISTENCE SYSTEM SECURED</span>
        </div>
      </div>
    </div>
  );
}
