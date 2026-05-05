import { RequireAuth } from "@/components/RequireAuth";
import { DispatchNavClient } from "@/components/DispatchNavClient";

export const metadata = {
  title: "Cruzar Dispatch — operator console",
  description:
    "Live wait + forecast + anomaly across your watched ports. Built for dispatchers who keep one screen open all shift.",
};

export const dynamic = "force-dynamic";

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth redirectFrom="/dispatch">
      <DispatchNavClient>{children}</DispatchNavClient>
    </RequireAuth>
  );
}
