"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useSession } from "../../../components/SessionProvider";

export default function SecurityPage() {
  const { user, loading } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changing, setChanging] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setChanging(true);
    try {
      const data = await apiFetch<{ message: string }>("/auth/user/password.php", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
      });
      setPasswordMessage(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unable to change password.");
    } finally {
      setChanging(false);
    }
  }

  if (loading) return <main className="account-profile-page"><div className="account-profile-container"><p className="acct-muted">Loading…</p></div></main>;
  if (!user) return <main className="account-profile-page"><div className="account-profile-container"><div className="acct-empty"><h2>Please log in</h2><p>Log in to manage your account security.</p><Link href="/login" className="acct-btn primary">Log In</Link></div></div></main>;

  return <main className="account-profile-page"><div className="account-profile-container">
    <div className="account-profile-header"><div><h1>Security</h1><p>Change your password.</p></div></div>
    <form className="account-profile-card" onSubmit={changePassword}>
      <h2>Change password</h2>
      <div className="account-profile-grid">
        <div className="account-profile-field"><label htmlFor="sec-current">Current password</label><input id="sec-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div>
        <div className="account-profile-field"><label htmlFor="sec-new">New password</label><input id="sec-new" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div>
        <div className="account-profile-field"><label htmlFor="sec-confirm">Confirm new password</label><input id="sec-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
      </div>
      {passwordError && <div className="acct-message error">{passwordError}</div>}
      {passwordMessage && <div className="acct-message success">{passwordMessage}</div>}
      <div className="acct-actions"><button type="submit" className="acct-btn primary" disabled={changing}>{changing ? "Updating…" : "Update password"}</button></div>
    </form>
  </div></main>;
}
