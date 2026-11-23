/* =========================================================
   Feek El Hayah Choir website — settings
   ---------------------------------------------------------
   1) Leave SUPABASE_URL empty to run in DEMO MODE
      (data is saved only in this browser — good for testing).
   2) After creating your Supabase project, paste the
      Project URL and the "anon public" key below.
      Never put the service_role key here.
   ========================================================= */
window.SITE_CONFIG = {
  SUPABASE_URL: "https://ahltvvufcczbobynqnyz.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_0OCRda6OjhKyGkVOg4k8qA_GtUGlLxF",

  // Demo mode only: password for the admin page.
  // (With Supabase, the admin logs in with the email + password
  //  you create in Supabase → Authentication → Users.)
  DEMO_ADMIN_PASSWORD: "admin123",

  DEFAULT_LANG: "ar",        // "ar" or "en"
  MAX_SEATS_PER_BOOKING: 10,
  CURRENCY: { ar: "ج.م", en: "EGP" }
};
