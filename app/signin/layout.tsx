import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dr.Sarha AI Studio",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
