"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip check on login page and API routes
    if (pathname === "/login") {
      setChecked(true);
      return;
    }

    const hasAuth = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("auth_token="));

    if (!hasAuth) {
      window.location.href = "/login";
    } else {
      setChecked(true);
    }
  }, [pathname]);

  if (!checked && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
