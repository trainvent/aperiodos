import { Head, Html, Main, NextScript } from "next/document";

const themeInitializer = `
(function () {
  try {
    var preference = localStorage.getItem("aperiodos-theme");
    if (preference !== "light" && preference !== "dark" && preference !== "auto") preference = "auto";
    var resolved = preference === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch (error) {
    document.documentElement.dataset.themePreference = "auto";
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default function Document() {
  return (
    <Html lang="de" suppressHydrationWarning>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
