export const config = {
  // Only run middleware on the admin path to maximize performance and minimize edge execution costs
  matcher: ['/admin', '/admin.html']
};

export default function middleware(request) {
  // Read allowed IPs from environment variable.
  // Define allowed IPs as a comma-separated list in Vercel environment variables (e.g. ALLOWED_IPS="12.34.56.78, 98.76.54.32")
  const allowedIpsString = process.env.ALLOWED_IPS || "";
  const allowedIps = allowedIpsString.split(',').map(ip => ip.trim()).filter(Boolean);

  // Retrieve client IP from Vercel's secure header or request.ip helper
  const clientIp = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || "";

  // Check if client IP is in whitelist (always allow local loopback for local testing)
  const isAllowed = allowedIps.length === 0 || allowedIps.includes(clientIp) || clientIp === '127.0.0.1' || clientIp === '::1';

  // Secure JSON debug endpoint to diagnose IP mismatch issues
  const url = new URL(request.url);
  if (url.searchParams.get('debug') === '1') {
    return new Response(
      JSON.stringify({
        status: "IP Diagnostic Mode",
        detectedClientIp: clientIp,
        configuredWhitelist: allowedIps,
        accessGranted: isAllowed,
        note: "Ensure your active IP matches one of the values in the whitelist. Turn off browser/system VPNs if the IP does not match your home network."
      }, null, 2),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      }
    );
  }

  // If IP whitelisting is active and client is not allowed, block them
  if (allowedIps.length > 0 && !isAllowed) {
    console.warn(`Unauthorized IP blocked from Admin Panel: ${clientIp}`);

    // Return a generic 404 response simulating "Not Found" to camouflage the admin panel
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Error 404 (Not Found)!!1</title>
  <style>
    body { font-family: sans-serif; color: #222; background: #fff; padding: 30px; margin: 0; }
    h1 { font-size: 1.6em; margin-bottom: 10px; }
    p { color: #555; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>404. That’s an error.</h1>
  <p>The requested URL was not found on this server. That’s all we know.</p>
</body>
</html>`,
      {
        status: 404,
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      }
    );
  }
}
