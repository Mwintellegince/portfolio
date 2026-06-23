export const config = {
  // Only run middleware on the admin path to maximize performance and minimize edge execution costs
  matcher: ['/admin', '/admin.html']
};

export default function middleware(request) {
  // Read allowed IPs from environment variable.
  // Define allowed IPs as a comma-separated list in Vercel environment variables (e.g. ALLOWED_IPS="12.34.56.78, 98.76.54.32")
  const allowedIpsString = process.env.ALLOWED_IPS || "";
  const allowedIps = allowedIpsString.split(',').map(ip => ip.trim()).filter(Boolean);

  // Retrieve client IP from Vercel's secure header
  const clientIp = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim();

  // If no allowed IPs are configured, we pass through (IP whitelisting is disabled).
  if (allowedIps.length === 0) {
    return;
  }

  // Check if client IP is in whitelist (always allow local loopback for local testing)
  const isAllowed = allowedIps.includes(clientIp) || clientIp === '127.0.0.1' || clientIp === '::1';

  if (!isAllowed) {
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
