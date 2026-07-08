// One-click Pro checkout.
// Every "Upgrade to Pro" / "Subscribe" button across the app should call this
// so it goes straight to Stripe checkout — no bouncing through the /upgrade
// page to find the one button that actually works. Mirrors the invoke used by
// UpgradeModal / ProUpgrade so behaviour is identical everywhere.
import { supabase } from './supabase';

let inFlight = false;

// Kicks off Stripe checkout for the given tier and redirects the browser.
// Guards against double-clicks; alerts (and returns false) on failure so the
// caller doesn't need its own error UI. Returns true once redirecting.
export async function startProCheckout(tier = 'pro') {
  if (inFlight) return false;
  inFlight = true;
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { tier, returnUrl: window.location.origin },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
      return true;
    }
    throw new Error('No checkout URL returned');
  } catch (err) {
    console.error('startProCheckout error:', err?.message ?? err);
    window.alert(
      'Could not start checkout just now. Please try again in a moment, or email support@cadi.cleaning and we’ll sort it.'
    );
    inFlight = false;
    return false;
  }
}
