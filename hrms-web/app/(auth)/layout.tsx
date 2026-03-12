import { WebhookTestCheckbox } from "@/components/WebhookTestCheckbox";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="border-border bg-card text-card-foreground w-full max-w-sm rounded-xl border shadow-sm p-6">
        {children}
      </div>
      <div className="mt-4">
        <WebhookTestCheckbox />
      </div>
    </div>
  );
}
