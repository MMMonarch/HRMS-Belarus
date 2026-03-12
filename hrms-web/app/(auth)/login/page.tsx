import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6 px-4">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">HRMS Belarus</h1>
        <p className="text-muted-foreground text-sm">
          Войдите в систему
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
