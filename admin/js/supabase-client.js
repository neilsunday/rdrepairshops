(() => {
  const config = window.RDSupabaseConfig;
  let clientPromise;

  const isConfigured = () =>
    Boolean(config?.projectUrl?.trim() && config?.publishableKey?.trim());

  const loadSdk = () => {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        "script[data-supabase-sdk]",
      );
      const script = existingScript || document.createElement("script");
      const onLoad = () => {
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error("Supabase SDK did not initialize."));
      };
      const onError = () => reject(new Error("Supabase SDK failed to load."));

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (!existingScript) {
        script.src = config.sdkUrl;
        script.dataset.supabaseSdk = "true";
        script.async = true;
        document.head.append(script);
      }
    });
  };

  const getClient = async () => {
    if (!isConfigured()) {
      throw new Error(
        "Supabase is not configured. Add the project URL and publishable key in admin/js/supabase-config.js.",
      );
    }
    if (!clientPromise) {
      clientPromise = loadSdk()
        .then((sdk) =>
          sdk.createClient(
            config.projectUrl.trim(),
            config.publishableKey.trim(),
            {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
              },
            },
          ),
        )
        .catch((error) => {
          clientPromise = null;
          throw error;
        });
    }
    return clientPromise;
  };

  window.AdminSupabaseClient = Object.freeze({
    isConfigured,
    get: getClient,
    isPreview: () => config?.previewMode === true,
  });
})();
