export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "application/json");
  res.write(JSON.stringify({ ok: true }));
  res.end();
  return { props: {} };
}

export default function Healthz() {
  return null;
}
