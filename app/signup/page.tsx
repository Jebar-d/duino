"use client";

import Link from "next/link";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";

type RegisterResponse = {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    suffix: string | null;
    contact_number: string | null;
    address: string | null;
  };
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [terms, setTerms] = useState(false);
  const [rules, setRules] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeDialog = showTerms ? "terms" : showRules ? "rules" : null;

  useEffect(() => {
    if (!activeDialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowTerms(false);
        setShowRules(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeDialog]);

  const passwordLength = password.length >= 8;
  const passwordUpper = /[A-Z]/.test(password);
  const passwordNumber = /[0-9]/.test(password);

  function cleanName(value: string) {
    return value.replace(/[^\p{L} '\-]/gu, "");
  }

  function handleContactChange(value: string) {
    setContact(value.replace(/[^0-9]/g, "").substring(0, 13));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (
      !email ||
      !password ||
      !username ||
      !firstName ||
      !lastName ||
      !contact ||
      !address || !city || !province || !postalCode
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!passwordLength) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!passwordUpper) {
      setError("Password must contain at least 1 uppercase letter.");
      return;
    }

    if (!passwordNumber) {
      setError("Password must contain at least 1 number.");
      return;
    }

    if (!/^[0-9]{11,13}$/.test(contact)) {
      setError("Please enter a valid contact number with 11 to 13 digits.");
      return;
    }

    if (!terms || !rules) {
      setError(
        "Please accept the Terms and Conditions and Rules and Regulations.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<RegisterResponse>("/auth/register.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          username,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          suffix: suffix || null,
          contact_number: contact,
          address,
          address_line: address,
          city,
          province,
          postal_code: postalCode,
          terms_accepted: true,
          rules_accepted: true,
        }),
      });

      if (!response.success) {
        throw new Error(response.message || "Unable to create account.");
      }

      setShowSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <main className="auth-container">
        <div className="auth-card" style={{ maxWidth: "600px" }}>
          <h1>Create Account</h1>

          <p className="auth-subtitle">Join Arduino Store today</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <h3
              style={{
                margin: "1.5rem 0 0.5rem",
                color: "#fff",
              }}
            >
              Account Information
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email *</label>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password *</label>

                <div className="password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />

                  <button
                    type="button"
                    className="show-pass-btn"
                    onClick={() => setShowPassword((current) => !current)}
                    title="Show/hide password"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="pw-requirements">
                    <div
                      className={`pw-req ${passwordLength ? "met" : "unmet"}`}
                    >
                      <span className="pw-req-icon">
                        {passwordLength ? (
                          <Check size={14} aria-hidden="true" />
                        ) : (
                          <Circle size={12} aria-hidden="true" />
                        )}
                      </span>
                      At least 8 characters
                    </div>

                    <div
                      className={`pw-req ${passwordUpper ? "met" : "unmet"}`}
                    >
                      <span className="pw-req-icon">
                        {passwordUpper ? (
                          <Check size={14} aria-hidden="true" />
                        ) : (
                          <Circle size={12} aria-hidden="true" />
                        )}
                      </span>
                      At least 1 uppercase letter
                    </div>

                    <div
                      className={`pw-req ${passwordNumber ? "met" : "unmet"}`}
                    >
                      <span className="pw-req-icon">
                        {passwordNumber ? (
                          <Check size={14} aria-hidden="true" />
                        ) : (
                          <Circle size={12} aria-hidden="true" />
                        )}
                      </span>
                      At least 1 number
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="username">Username *</label>

              <input
                id="username"
                placeholder="johndoe123"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <h3
              style={{
                margin: "1.5rem 0 0.5rem",
                color: "#fff",
              }}
            >
              Personal Information
            </h3>

            <div className="form-row three-col">
              <div className="form-group">
                <label htmlFor="first_name">First Name *</label>

                <input
                  id="first_name"
                  placeholder="John"
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(cleanName(event.target.value))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="middle_name">Middle Name</label>

                <input
                  id="middle_name"
                  placeholder="M"
                  value={middleName}
                  onChange={(event) =>
                    setMiddleName(cleanName(event.target.value))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="last_name">Last Name *</label>

                <input
                  id="last_name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(event) =>
                    setLastName(cleanName(event.target.value))
                  }
                  required
                />
              </div>
            </div>

            <div className="form-row two-col">
              <div className="form-group">
                <label htmlFor="suffix">Suffix (Optional)</label>

                <select
                  id="suffix"
                  value={suffix}
                  onChange={(event) => setSuffix(event.target.value)}
                >
                  <option value="">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                  <option value="PhD">PhD</option>
                  <option value="MD">MD</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="contact">
                  Contact Number *
                  <small
                    style={{
                      color: "var(--text2)",
                      fontWeight: 400,
                    }}
                  >
                    {" "}
                    (11 to 13 digits)
                  </small>
                </label>

                <input
                  id="contact"
                  type="tel"
                  placeholder="09123456789"
                  value={contact}
                  onChange={(event) => handleContactChange(event.target.value)}
                  maxLength={13}
                  required
                />

                <small
                  style={{
                    color: "var(--text2)",
                    fontSize: "0.75rem",
                    marginTop: "3px",
                    display: "block",
                  }}
                >
                  e.g. 09123456789
                </small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address">Street / house no. / barangay *</label>

              <textarea
                id="address"
                rows={3}
                placeholder="Street, house number, barangay"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
              />
            </div>

            <div className="form-row three-col">
              <div className="form-group"><label htmlFor="city">City / municipality *</label><input id="city" value={city} onChange={(event) => setCity(event.target.value)} required /></div>
              <div className="form-group"><label htmlFor="province">Province *</label><input id="province" value={province} onChange={(event) => setProvince(event.target.value)} required /></div>
              <div className="form-group"><label htmlFor="postalCode">Postal code (4 digits) *</label><input id="postalCode" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 4))} required /></div>
            </div>

            <h3
              style={{
                margin: "1.5rem 0 0.5rem",
                color: "#fff",
              }}
            >
              Agreements
            </h3>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                />

                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#fff",
                      textDecoration: "underline",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    Terms and Conditions
                  </button>{" "}
                  *
                </span>
              </label>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rules}
                  onChange={(event) => setRules(event.target.checked)}
                />

                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowRules(true)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#fff",
                      textDecoration: "underline",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    Rules and Regulations
                  </button>{" "}
                  *
                </span>
              </label>
            </div>

            {error && <p className="auth-status error">{error}</p>}

            <button
              type="submit"
              className="auth-button"
              style={{ marginTop: "1.5rem" }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>

            <p className="auth-footer">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </form>
        </div>
      </main>

      {activeDialog && (
        <div
          className="store-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowTerms(false);
              setShowRules(false);
            }
          }}
        >
          <div className="store-modal" role="dialog" aria-modal="true" aria-labelledby="signup-dialog-title" tabIndex={-1} ref={dialogRef}>
            <button type="button" className="store-modal-close" aria-label="Close dialog" onClick={() => { setShowTerms(false); setShowRules(false); }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
            <h2 id="signup-dialog-title">{activeDialog === "terms" ? "Terms and Conditions" : "Rules and Regulations"}</h2>
            <div className="store-modal-content">
              {activeDialog === "terms" ? <><p>1. You must provide accurate information.</p><p>2. You are responsible for maintaining your account security.</p><p>3. All sales are final unless product is defective.</p><p>4. We reserve the right to terminate accounts for violations.</p></> : <><p>1. No reselling of products without permission.</p><p>2. Respect other users and staff.</p><p>3. No fraudulent transactions.</p><p>4. Follow all local laws regarding electronics.</p></>}
            </div>
            <div className="store-modal-actions">
              <button type="button" className="auth-submit" onClick={() => { if (activeDialog === "terms") setTerms(true); else setRules(true); setShowTerms(false); setShowRules(false); }}>I agree</button>
              <button type="button" className="auth-submit store-modal-secondary" onClick={() => { setShowTerms(false); setShowRules(false); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "2px solid #fff",
              borderRadius: 0,
              padding: "3rem 2.5rem",
              textAlign: "center",
              maxWidth: "420px",
              width: "100%",
            }}
          >
            <div
              style={{
                fontSize: "3.5rem",
                marginBottom: "1rem",
              }}
            >
              <Check size={52} strokeWidth={2.5} aria-hidden="true" />
            </div>

            <h2
              style={{
                color: "#fff",
                fontSize: "1.75rem",
                marginBottom: "0.5rem",
              }}
            >
              Account Created!
            </h2>

            <p
              style={{
                color: "var(--text2)",
                marginBottom: "1.5rem",
              }}
            >
              Welcome to Arduino Store.
            </p>

            <Link
              href="/login"
              className="btn-primary"
              style={{
                display: "inline-block",
              }}
            >
              Go to Login
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

