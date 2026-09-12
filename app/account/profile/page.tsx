"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  contact_number: string | null;
  address: string | null;
  terms_accepted: boolean;
  rules_accepted: boolean;
  created_at: string;
};

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiFetch<{ success: boolean; user: UserProfile }>("/auth/user/me.php")
        .then((data) => {
          const user = data.user;

          setProfile(user);
          setUsername(user.username || "");
          setFirstName(user.first_name || "");
          setMiddleName(user.middle_name || "");
          setLastName(user.last_name || "");
          setSuffix(user.suffix || "");
          setContactNumber(user.contact_number || "");
          setAddress(user.address || "");
        })
        .catch((err) => {
          setProfileError(
            err instanceof Error ? err.message : "Unable to load your profile.",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleProfileSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const data = await apiFetch<{
        success: boolean;
        message: string;
        user: UserProfile;
      }>("/auth/user/update.php", {
        method: "POST",
        body: JSON.stringify({
          username,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          suffix,
          contact_number: contactNumber,
          address,
        }),
      });

      setProfile(data.user);
      setSuccessMessage(data.message);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Unable to update your profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      const data = await apiFetch<{
        success: boolean;
        message: string;
      }>("/auth/user/password.php", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(data.message);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Unable to change your password.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const setSuccessMessage = (message: string) => {
    setProfileSuccess(message);
  };

  if (loading) {
    return (
      <main className="account-profile-page">
        <div className="account-profile-container">
          <h1>My Profile</h1>
          <p>Loading your profile...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="account-profile-page">
        <div className="account-profile-container">
          <div className="account-profile-error">
            <h1>My Profile</h1>
            <p>{profileError || "Unable to load your profile."}</p>
            <Link href="/login">Log In</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="account-profile-page">
      <div className="account-profile-container">
        <div className="account-profile-header">
          <div>
            <h1>My Profile</h1>
            <p>Manage your account and personal information.</p>
          </div>

          <Link href="/account/orders">My Orders</Link>
        </div>

        <div className="account-profile-card">
          <form onSubmit={handleProfileSubmit}>
            <div className="account-profile-section">
              <h2>Account Information</h2>

              <div className="account-profile-grid">
                <div className="account-profile-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={profile.email || ""}
                    disabled
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="account-profile-section">
              <h2>Personal Information</h2>

              <div className="account-profile-grid">
                <div className="account-profile-field">
                  <label htmlFor="first_name">First Name</label>
                  <input
                    id="first_name"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="middle_name">Middle Name</label>
                  <input
                    id="middle_name"
                    type="text"
                    value={middleName}
                    onChange={(event) => setMiddleName(event.target.value)}
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="last_name">Last Name</label>
                  <input
                    id="last_name"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="suffix">Suffix</label>
                  <input
                    id="suffix"
                    type="text"
                    value={suffix}
                    onChange={(event) => setSuffix(event.target.value)}
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="contact_number">Contact Number</label>
                  <input
                    id="contact_number"
                    type="tel"
                    value={contactNumber}
                    onChange={(event) => setContactNumber(event.target.value)}
                  />
                </div>

                <div className="account-profile-field account-profile-field-full">
                  <label htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {profileError && (
              <div className="account-profile-message account-profile-message-error">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="account-profile-message account-profile-message-success">
                {profileSuccess}
              </div>
            )}

            <div className="account-profile-actions">
              <button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>

              <Link href="/account/orders">View My Orders</Link>
            </div>
          </form>
        </div>

        <div className="account-profile-card">
          <form onSubmit={handlePasswordSubmit}>
            <div className="account-profile-section">
              <h2>Change Password</h2>
              <p>Use a strong password with at least 8 characters.</p>

              <div className="account-profile-grid">
                <div className="account-profile-field account-profile-field-full">
                  <label htmlFor="current_password">Current Password</label>
                  <input
                    id="current_password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="new_password">New Password</label>
                  <input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <label htmlFor="confirm_password">Confirm New Password</label>
                  <input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="account-profile-message account-profile-message-error">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="account-profile-message account-profile-message-success">
                {passwordSuccess}
              </div>
            )}

            <div className="account-profile-actions">
              <button type="submit" disabled={changingPassword}>
                {changingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
    