import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Repair cleanup is missing its Supabase server credentials.");
    return Response.json(
      { error: "Repair cleanup is not configured." },
      { status: 500, headers: corsHeaders },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: requests, error: claimError } = await supabase.rpc(
    "claim_completed_repairs_for_cleanup",
    { p_limit: 50 },
  );
  if (claimError) {
    console.error("Could not claim completed repair requests:", claimError);
    return Response.json(
      { error: "Could not claim repair requests for cleanup." },
      { status: 500, headers: corsHeaders },
    );
  }

  let deleted = 0;
  let failed = 0;
  for (const repair of requests || []) {
    const { data: attachments, error: attachmentError } = await supabase
      .from("repair_attachments")
      .select("object_path")
      .eq("repair_request_id", repair.id);
    if (attachmentError) {
      console.error(
        `Could not list photos for completed repair ${repair.reference_number}:`,
        attachmentError,
      );
      failed += 1;
      continue;
    }

    const paths = (attachments || []).map((attachment) => attachment.object_path);
    if (paths.length) {
      const { error: storageError } = await supabase
        .storage
        .from("repair-attachments")
        .remove(paths);
      if (storageError) {
        console.error(
          `Could not remove photos for completed repair ${repair.reference_number}:`,
          storageError,
        );
        failed += 1;
        continue;
      }
    }

    const { data: removed, error: deleteError } = await supabase
      .from("repair_requests")
      .delete()
      .eq("id", repair.id)
      .eq("status", "completed")
      .not("retention_cleanup_started_at", "is", null)
      .select("id");
    if (deleteError || !removed?.length) {
      console.error(
        `Could not delete completed repair ${repair.reference_number}:`,
        deleteError || "The request no longer matched the cleanup criteria.",
      );
      failed += 1;
      continue;
    }
    deleted += 1;
  }

  return Response.json(
    { claimed: requests?.length || 0, deleted, failed },
    { headers: corsHeaders },
  );
});
