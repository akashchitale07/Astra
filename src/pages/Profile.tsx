import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../api/client.js";
import Layout from "../components/Layout.js";
import {
  User as UserIcon,
  Mail,
  CheckCircle2,
  Calendar,
  Sparkles,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export default function Profile() {
  const { user, updateUserContext } = useAuth();

  // Profile Form state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!displayName.trim() || !email.trim()) {
      setError("Display name and email are required.");
      setLoading(false);
      return;
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      const data = await api.put("/auth/profile", {
        display_name: displayName.trim(),
        email: email.trim().toLowerCase(),
      });

      // Update local storage context with new profile details
      updateUserContext(data.user);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 space-y-8 animate-fade-in">
        {/* Page Header */}
        <div className="border-b border-zinc-100 pb-5 dark:border-zinc-800/50">
          <h1 className="font-sans text-2xl font-extrabold tracking-tight md:text-3xl flex items-center space-x-2.5">
            <UserIcon className="h-6 w-6 text-zinc-400" />
            <span>Profile Management</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your personal profile details and security identities.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Account Card Stats */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-zinc-950 md:col-span-1 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Avatar circle */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-xl font-extrabold text-white shadow-md">
                {user?.display_name?.slice(0, 2).toUpperCase()}
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{user?.display_name}</h3>
                <p className="text-xs text-zinc-400 font-mono truncate">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-3.5 border-t border-zinc-100 pt-4 dark:border-zinc-900/50">
              <div className="flex items-center space-x-2.5 text-xs text-zinc-500">
                <Calendar className="h-4 w-4 text-zinc-400" />
                <span>Registered Member</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-zinc-500">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span className="text-green-500 font-semibold uppercase font-mono tracking-wider text-[10px]">Active Session</span>
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-zinc-950 md:col-span-2 space-y-6">
            <div className="space-y-1.5 border-b border-zinc-100 pb-4 dark:border-zinc-900/50">
              <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase">
                Account Credentials
              </h2>
              <p className="text-xs text-zinc-500">
                Update your visual display name and email address securely.
              </p>
            </div>

            {success && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 flex items-center space-x-2.5 text-xs text-green-500">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Profile details updated successfully!</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-center space-x-2.5 text-xs text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Display Name input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Display Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="E.g., John Doe"
                    className="w-full rounded-lg border border-zinc-200 bg-transparent py-2.5 pl-10 pr-4 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E.g., john@example.com"
                    className="w-full rounded-lg border border-zinc-200 bg-transparent py-2.5 pl-10 pr-4 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 rounded-lg bg-blue-600 py-2.5 px-6 font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
