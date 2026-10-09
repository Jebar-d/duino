"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { Button } from "../../../components/ui/8bit/button";
import { Input } from "../../../components/ui/8bit/input";
import { Textarea } from "../../../components/ui/8bit/textarea";
import { Label } from "../../../components/ui/8bit/label";
import { Card } from "../../../components/ui/8bit/card";
import { Alert, AlertDescription } from "../../../components/ui/8bit/alert";

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
            <Button asChild><Link href="/login">Log In</Link></Button>
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

          <Button asChild className="text-background"><Link href="/account/orders">My Orders</Link></Button>
        </div>

        <Card className="account-profile-card">
          <form onSubmit={handleProfileSubmit}>
            <div className="account-profile-section">
              <h2>Account Information</h2>

              <div className="account-profile-grid">
                <div className="account-profile-field">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email || ""}
                    disabled
                  />
                </div>

                <div className="account-profile-field">
                  <Label htmlFor="username">Username</Label>
                  <Input
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
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    type="text"
                    value={middleName}
                    onChange={(event) => setMiddleName(event.target.value)}
                  />
                </div>

                <div className="account-profile-field">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    type="text"
                    value={suffix}
                    onChange={(event) => setSuffix(event.target.value)}
                  />
                </div>

                <div className="account-profile-field">
                  <Label htmlFor="contact_number">Contact Number</Label>
                  <Input
                    id="contact_number"
                    type="tel"
                    value={contactNumber}
                    onChange={(event) => setContactNumber(event.target.value)}
                  />
                </div>

                <div className="account-profile-field account-profile-field-full">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {profileError && (
              <Alert variant="destructive"><AlertDescription>{profileError}</AlertDescription></Alert>
            )}

            {profileSuccess && (
              <Alert><AlertDescription>{profileSuccess}</AlertDescription></Alert>
            )}

            <div className="account-profile-actions">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Changes"}
              </Button>

              <Button asChild variant="outline" className="text-foreground"><Link href="/account/orders">View My Orders</Link></Button>
            </div>
          </form>
        </Card>

        <Card className="account-profile-card">
          <form onSubmit={handlePasswordSubmit}>
            <div className="account-profile-section">
              <h2>Change Password</h2>
              <p>Use a strong password with at least 8 characters.</p>

              <div className="account-profile-grid">
                <div className="account-profile-field account-profile-field-full">
                  <Label htmlFor="current_password">Current Password</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="account-profile-field">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
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
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
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
              <Alert variant="destructive"><AlertDescription>{passwordError}</AlertDescription></Alert>
            )}

            {passwordSuccess && (
              <Alert><AlertDescription>{passwordSuccess}</AlertDescription></Alert>
            )}

            <div className="account-profile-actions">
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
    