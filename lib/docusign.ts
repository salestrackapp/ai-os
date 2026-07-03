import "server-only";
import crypto from "node:crypto";

const BASE = process.env.DOCUSIGN_BASE_URL;               // ex.: https://demo.docusign.net/restapi
const ACCOUNT = process.env.DOCUSIGN_ACCOUNT_ID;
const IKEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const USER = process.env.DOCUSIGN_USER_ID;
const PRIV_B64 = process.env.DOCUSIGN_PRIVATE_KEY;        // RSA privada em base64

export function docusignConfigured() { return !!(BASE && ACCOUNT && IKEY && USER && PRIV_B64); }

function oauthHost() { return (BASE ?? "").includes("demo") ? "account-d.docusign.com" : "account.docusign.com"; }

async function accessToken(): Promise<string> {
  const pem = Buffer.from(PRIV_B64!, "base64").toString("utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: IKEY, sub: USER, aud: oauthHost(), iat: now, exp: now + 3600, scope: "signature impersonation" };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(pem).toString("base64url");
  const assertion = `${unsigned}.${sig}`;
  const res = await fetch(`https://${oauthHost()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `Docusign OAuth ${res.status}`);
  return json.access_token;
}

/** Cria e envia um envelope a partir do HTML do contrato (assinatura via âncora /assinatura_contratante/). */
export async function sendEnvelope(opts: { html: string; signerName: string; signerEmail: string; subject: string }): Promise<{ envelopeId: string }> {
  const token = await accessToken();
  const body = {
    emailSubject: opts.subject,
    documents: [{ documentBase64: Buffer.from(opts.html, "utf8").toString("base64"), name: "Contrato", fileExtension: "html", documentId: "1" }],
    recipients: {
      signers: [{
        email: opts.signerEmail, name: opts.signerName, recipientId: "1", routingOrder: "1",
        tabs: { signHereTabs: [{ anchorString: "/assinatura_contratante/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-6" }] },
      }],
    },
    status: "sent",
  };
  const res = await fetch(`${BASE}/v2.1/accounts/${ACCOUNT}/envelopes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `Docusign envelope ${res.status}`);
  return { envelopeId: json.envelopeId };
}

/** Baixa o PDF combinado assinado de um envelope. */
export async function downloadSignedPdf(envelopeId: string): Promise<Uint8Array> {
  const token = await accessToken();
  const res = await fetch(`${BASE}/v2.1/accounts/${ACCOUNT}/envelopes/${envelopeId}/documents/combined`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Docusign download ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
