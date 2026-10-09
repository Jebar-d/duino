"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useSession } from "../../components/SessionProvider";
import { Card } from "../../components/ui/8bit/card";
import { Button } from "../../components/ui/8bit/button";
import { Input } from "../../components/ui/8bit/input";
import { Label } from "../../components/ui/8bit/label";
import { Alert, AlertDescription } from "../../components/ui/8bit/alert";
import { toast } from "../../components/ui/8bit/toast";

type LoginResponse = {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    username: string | null;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    suffix: string | null;
    contact_number: string | null;
    address: string | null;
    terms_accepted: boolean;
    rules_accepted: boolean;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");

      await apiFetch<LoginResponse>("/auth/login.php", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      // Reload who is logged in, then send admins to the admin panel
      // and everyone else to the store.
      const account = await refresh();
      router.push(account?.role === "admin" ? "/admin" : "/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to log in.");
      toast(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <h1>Welcome Back</h1>
            <p>Log in to your Arduino Store account.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}

            <Button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log In"}
            </Button>
          </form>

          <div className="auth-footer">
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/signup">Create an account</Link>
            </p>
          </div>
        </Card>
      </section>
    </main>
  );
}
