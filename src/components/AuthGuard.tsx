"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
