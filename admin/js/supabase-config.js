(() => {
  const params = new URLSearchParams(window.location.search);

  window.RDSupabaseConfig = Object.freeze({
    projectUrl: "https://blvzhboywahgfyjsmafy.supabase.co",
    publishableKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdnpoYm95d2FoZ2Z5anNtYWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MjAyNjEsImV4cCI6MjEwNzI5NjI2MX0.TB2xGEDSNgm5qL6F2hxXDYSeGL7fofqlb9L0CO55Kbg",
    sdkUrl: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    previewMode: params.get("preview") === "1",
  });
})();
