export function methodNotAllowed(res, methods = ["GET"]) {
  res.setHeader("Allow", methods.join(", "));
  return res.status(405).json({ error: "Method not allowed" });
}

export function sendBuffer(res, buffer, { contentType, filename }) {
  res.setHeader("Content-Type", contentType);
  if (filename) {
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  }
  return res.status(200).send(buffer);
}

export function handleApiError(res, error) {
  const status = error.statusCode || error.status || 500;
  return res.status(status).json({ error: error.message || "Request failed." });
}

export class ApiError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
