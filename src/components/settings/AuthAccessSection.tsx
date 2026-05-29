import { FormEvent, useState } from "react";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { ENABLE_AUTH } from "@/config/features";
import { authService } from "@/services/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSectionCard } from "./SettingsSectionCard";

export function AuthAccessSection() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ENABLE_AUTH) {
    return null;
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await authService.login({ email, password });
      setIsAuthenticated(true);
      setPassword("");
    } catch {
      setError("Sign in failed. Check your credentials and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await authService.logout();
      setIsAuthenticated(false);
    } catch {
      setError("Sign out failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SettingsSectionCard
      title="Account Access"
      description="Sign in when authenticated backend sessions are enabled"
    >
      <div className="space-y-4" data-testid="settings-auth-access">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Auth flag enabled</span>
          </div>
          <Badge variant={isAuthenticated ? "default" : "secondary"}>
            {isAuthenticated ? "Signed in" : "Signed out"}
          </Badge>
        </div>

        {isAuthenticated ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={isSubmitting}
            data-testid="btn-auth-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        ) : (
          <form className="space-y-3" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !email || !password}
              data-testid="btn-auth-login"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Button>
          </form>
        )}
      </div>
    </SettingsSectionCard>
  );
}
