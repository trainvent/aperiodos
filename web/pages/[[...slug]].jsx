import dynamic from "next/dynamic";

const ClientApp = dynamic(() => import("../src/ClientApp.jsx"), {
  ssr: false,
});

export default function Page() {
  return <ClientApp />;
}
