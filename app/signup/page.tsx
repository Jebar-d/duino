"use client";

import Link from "next/link";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/8bit/button";
import { Card } from "../../components/ui/8bit/card";
import { Input } from "../../components/ui/8bit/input";
import { Textarea } from "../../components/ui/8bit/textarea";
import { Label } from "../../components/ui/8bit/label";
import { Checkbox } from "../../components/ui/8bit/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/8bit/select";
import { Alert, AlertDescription } from "../../components/ui/8bit/alert";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/8bit/dialog";

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
        <Card className="auth-card" style={{ maxWidth: "600px" }}>
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
                <Label htmlFor="email">Email *</Label>

                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <Label htmlFor="password">Password *</Label>

                <div className="password-wrap">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />

                  <Button
                    type="button"
                    className="show-pass-btn"
                    onClick={() => setShowPassword((current) => !current)}
                    title="Show/hide password"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </Button>
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
              <Label htmlFor="username">Username *</Label>

              <Input
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
                <Label htmlFor="first_name">First Name *</Label>

                <Input
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
                <Label htmlFor="middle_name">Middle Name</Label>

                <Input
                  id="middle_name"
                  placeholder="M"
                  value={middleName}
                  onChange={(event) =>
                    setMiddleName(cleanName(event.target.value))
                  }
                />
              </div>

              <div className="form-group">
                <Label htmlFor="last_name">Last Name *</Label>

                <Input
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
                <Label htmlFor="suffix">Suffix (Optional)</Label>

                <Select value={suffix || "none"} onValueChange={(value) => setSuffix(value === "none" ? "" : value)}>
                  <SelectTrigger id="suffix"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {["Jr.", "Sr.", "II", "III", "IV", "PhD", "MD"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="form-group">
                <Label htmlFor="contact">
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
                </Label>

                <Input
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
              <Label htmlFor="address">Street / house no. / barangay *</Label>

              <Textarea
                id="address"
                rows={3}
                placeholder="Street, house number, barangay"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
              />
            </div>

            <div className="form-row three-col">
              <div className="form-group"><Label htmlFor="city">City / municipality *</Label><Input id="city" value={city} onChange={(event) => setCity(event.target.value)} required /></div>
              <div className="form-group"><Label htmlFor="province">Province *</Label><Input id="province" value={province} onChange={(event) => setProvince(event.target.value)} required /></div>
              <div className="form-group"><Label htmlFor="postalCode">Postal code (4 digits) *</Label><Input id="postalCode" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 4))} required /></div>
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
              <Label className="checkbox-label">
                <Checkbox
                  checked={terms}
                  onCheckedChange={(checked) => setTerms(checked === true)}
                />

                <span>
                  I agree to the{" "}
                  <Button
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
                  </Button>{" "}
                  *
                </span>
              </Label>
            </div>

            <div className="checkbox-group">
              <Label className="checkbox-label">
                <Checkbox
                  checked={rules}
                  onCheckedChange={(checked) => setRules(checked === true)}
                />

                <span>
                  I agree to the{" "}
                  <Button
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
                  </Button>{" "}
                  *
                </span>
              </Label>
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <Button
              type="submit"
              className="auth-button"
              style={{ marginTop: "1.5rem" }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>

            <p className="auth-footer">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </form>
        </Card>
      </main>

      <Dialog open={Boolean(activeDialog)} onOpenChange={(open) => { if (!open) { setShowTerms(false); setShowRules(false); } }}>
          <DialogContent ref={dialogRef} className="store-modal">
            <DialogHeader><DialogTitle id="signup-dialog-title">{activeDialog === "terms" ? "Terms and Conditions" : "Rules and Regulations"}</DialogTitle></DialogHeader>
            <div className="store-modal-content">
              {activeDialog === "terms" ? <><p>1. You must provide accurate information.</p><p>2. You are responsible for maintaining your account security.</p><p>3. All sales are final unless product is defective.</p><p>4. We reserve the right to terminate accounts for violations.</p></> : <><p>1. No reselling of products without permission.</p><p>2. Respect other users and staff.</p><p>3. No fraudulent transactions.</p><p>4. Follow all local laws regarding electronics.</p></>}
            </div>
            <div className="store-modal-actions">
              <Button type="button" className="auth-submit" onClick={() => { if (activeDialog === "terms") setTerms(true); else setRules(true); setShowTerms(false); setShowRules(false); }}>I agree</Button>
              <DialogClose asChild><Button type="button" className="auth-submit store-modal-secondary">Close</Button></DialogClose>
            </div>
          </DialogContent>
      </Dialog>

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

