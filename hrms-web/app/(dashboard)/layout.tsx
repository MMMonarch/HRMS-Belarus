import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { WebhookTestModeProvider } from "@/lib/context/webhook-test-mode";
import { WorkspaceGuard } from "@/components/WorkspaceGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebhookTestModeProvider>
      <WorkspaceGuard>
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </WorkspaceGuard>
    </WebhookTestModeProvider>
  );
}
