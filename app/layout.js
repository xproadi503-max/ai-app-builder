import Providers from "./providers";

export const metadata = {
  title: "AI App Builder",
  description: "GitHub login + AI code analysis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", background: "#0f172a", color: "#fff", margin: 0 }}>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
