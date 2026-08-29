"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function SidebarNavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [hrefPath, hrefQuery] = href.split("?");
  const currentQuery = searchParams.toString();

  const active = exact
    ? pathname === hrefPath && (!hrefQuery || currentQuery === hrefQuery)
    : pathname === hrefPath
      ? !hrefQuery || currentQuery === hrefQuery
      : pathname.startsWith(`${hrefPath}/`);

  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm transition ${
        active
          ? "bg-neutral-900 text-white font-medium"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      {children}
    </Link>
  );
}
