import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client for backend use dynamically to avoid crashing if env variables are not set during server start
let supabaseClient: any = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase: VITE_SUPABASE_URL or keys are missing on the backend.');
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Temporary storage for debug logs (cleared on restart)
  let lastWebhooks: any[] = [];

  console.log('Server: Starting initialization...');

  // Logging middleware
  app.use(express.json());
  app.use((req, res, next) => {
    console.log(`Server: ${req.method} ${req.url} - User-Agent: ${req.headers['user-agent']}`);
    next();
  });

  // Client-side logging endpoint
  app.post("/api/log", (req, res) => {
    const { level, message, data } = req.body;
    const logEntry = `[${new Date().toISOString()}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    console.log(`Client Log: ${logEntry.trim()}`);
    // We'll just log to console for now, as we can see it in the platform logs
    res.sendStatus(200);
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Kiwify Webhook Endpoint
  app.get("/api/webhooks/kiwify", (req, res) => {
    res.send("Webhook endpoint is active! Use POST for Kiwify signals.");
  });

  app.post("/api/webhooks/kiwify", express.json(), async (req, res) => {
    console.log('--- KIWIFY WEBHOOK RECEIVED ---');
    const payload = req.body;
    
    if (!payload || Object.keys(payload).length === 0) {
      console.error('Kiwify Webhook: Empty payload received');
      return res.status(400).json({ error: 'Empty payload' });
    }

    const signature = req.headers['x-kiwify-signature'];
    console.log('Signature:', signature);
    console.log('Payload Keys:', Object.keys(payload));

    console.log('--- KIWIFY WEBHOOK START ---');
    console.log('Event Type:', payload.order_status);
    console.log('Customer Email:', payload.customer?.email);
    console.log('Full Payload:', JSON.stringify(payload, null, 2));

    // Basic validation of the event
    if (!payload.order_status) {
      console.error('Kiwify Webhook: Missing order_status');
      return res.status(400).json({ error: 'Missing order_status' });
    }

    const userEmail = (payload.customer?.email || "test@kiwify.com").toLowerCase();
    const developerEmail = "josueufceconomia@gmail.com";
    // Improved test detection: Kiwify test emails usually contain 'kiwify.com' or it's a test flag
    const isTestWebhook = userEmail.includes('kiwify.com') || payload.test === true || userEmail.includes('test');

    // Store in debug logs
    lastWebhooks.unshift({
      time: new Date().toLocaleTimeString(),
      email: userEmail,
      status: payload.order_status,
      isTest: isTestWebhook
    });
    if (lastWebhooks.length > 10) lastWebhooks.pop();

    // Kiwify Statuses: paid, approved, renewed, canceled, refused, refunded, chargedback
    const isPositiveStatus = ['paid', 'approved', 'renewed'].includes(payload.order_status);
    const isNegativeStatus = ['canceled', 'refused', 'refunded', 'chargedback'].includes(payload.order_status);

    const client = getSupabase();
    if (!client) {
      console.error('Kiwify Webhook: Supabase client is not initialized due to missing keys.');
      return res.status(500).json({ error: 'Database service unavailable' });
    }

    let isPro = false;
    if (isPositiveStatus) {
      isPro = true;
      console.log(`Kiwify Webhook: Action -> UPGRADE ${userEmail} to PRO`);
      
      // CRITICAL: If it's a test, also upgrade the developer's account regardless of the random email sent
      if (isTestWebhook) {
        console.log(`Kiwify Webhook: TEST DETECTED -> Upgrading developer ${developerEmail} to PRO`);
        await client.from('profiles').update({ is_pro: true }).eq('email', developerEmail);
      }
    } else if (isNegativeStatus) {
      isPro = false;
      console.log(`Kiwify Webhook: Action -> DOWNGRADE ${userEmail} to FREE`);
    } else {
      console.log(`Kiwify Webhook: Status "${payload.order_status}" ignored for ${userEmail}`);
      return res.status(200).send('Status ignored');
    }

    try {
      const { data: profile, error: fetchError } = await client
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();

      if (fetchError) {
        console.error('Kiwify Webhook: Error fetching profile:', fetchError);
        return res.status(500).json({ error: 'Database fetch failed' });
      }

      if (!profile) {
        console.warn(`Kiwify Webhook: No profile found for email ${userEmail}. Make sure the user is registered in the app first.`);
        // We return 200 so Kiwify doesn't keep retrying, but we log the warning
        return res.status(200).send('User not found, but webhook received');
      }

      const { error: updateError } = await client
        .from('profiles')
        .update({ is_pro: isPro })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Kiwify Webhook: Error updating profile:', updateError);
        return res.status(500).json({ error: 'Database update failed' });
      }

      console.log(`Kiwify Webhook: SUCCESS! Profile ${userEmail} is now ${isPro ? 'PRO' : 'FREE'}`);

      console.log('--- KIWIFY WEBHOOK END ---');
      return res.status(200).send('OK');
    } catch (err) {
      console.error('Kiwify Webhook: Fatal error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Debug endpoint to see last webhooks from the app
  app.get("/api/debug/webhooks", (req, res) => {
    res.json(lastWebhooks);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log('Server: Running in development mode with Vite middleware');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, // Disable HMR for better stability on mobile
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log('Server: Running in production mode');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server: Running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Server: Failed to start:', err);
});
