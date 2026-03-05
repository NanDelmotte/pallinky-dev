/** * Path: apps/web/app/layout.tsx 
 * Description: Root layout for the Web workspace. 
 * Provides the required HTML and Body tags for Next.js.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pallinky",
  description: "Plan your next vibe.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#ffffff' }}>
        {children}
      </body>
    </html>
  );
}