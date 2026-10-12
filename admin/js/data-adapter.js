(() => {
  let previewData = window.AdminPreviewData;
  let previewDataPromise;
  const previewMode = window.AdminSupabaseClient?.isPreview() === true;
  const previewScriptUrl = new URL(
    "./preview-data.js",
    document.currentScript?.src || document.baseURI,
  ).href;
  const pageSizeDefault = 25;
  const searchFields = {
    repairs: [
      "reference",
      "customerName",
      "customerEmail",
      "customerPhone",
      "brand",
      "model",
      "reportedIssue",
      "serviceName",
    ],
    customers: ["displayName", "email", "phone"],
    services: ["name", "category"],
    notifications: ["title", "detail"],
    activity: ["actor", "action", "target"],
    notebook: ["clientName", "clientPhone", "clientEmail", "entryType", "title", "details"],
  };

  const normalizeText = (value) => String(value ?? "");
  const databaseError = (message, error) =>
    new Error(`${message}: ${error?.message || "Unknown Supabase error."}`);
  const ensurePreviewData = async () => {
    if (previewData) return previewData;
    if (!previewMode)
      throw new Error("Preview fixtures are disabled in production mode.");
    if (!previewDataPromise) {
      previewDataPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = previewScriptUrl;
        script.onload = () => {
          previewData = window.AdminPreviewData;
          if (previewData) resolve(previewData);
          else reject(new Error("Preview data did not initialize."));
        };
        script.onerror = () =>
          reject(new Error("Preview data could not be loaded."));
        document.head.append(script);
      });
    }
    return previewDataPromise;
  };
  const safeSearch = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}@.+\-\s]/gu, "")
      .trim()
      .slice(0, 120);

  const previewList = (collection, options) => {
    if (!Object.prototype.hasOwnProperty.call(previewData, collection)) {
      throw new Error(`Unknown preview collection: ${collection}`);
    }
    const {
      page = 0,
      pageSize = pageSizeDefault,
      search = "",
      filters = {},
    } = options;
    const query = safeSearch(search).toLowerCase();
    const fields = searchFields[collection] || [];
    const records = previewData[collection].filter((record) => {
      const matchesSearch =
        !query ||
        fields.some((field) =>
          normalizeText(record[field]).toLowerCase().includes(query),
        );
      const matchesFilters = Object.entries(filters).every(
        ([field, value]) =>
          !value || value === "all" || String(record[field]) === String(value),
      );
      return matchesSearch && matchesFilters;
    });
    const offset = Math.max(0, page) * pageSize;
    return {
      mode: "preview",
      records: JSON.parse(
        JSON.stringify(records.slice(offset, offset + pageSize)),
      ),
      total: records.length,
      page,
      pageSize,
    };
  };

  const mapRepair = (request, technician, histories, notes, profileNames) => ({
    id: request.id,
    reference: request.reference_number,
    customerId: request.customer_id,
    customerName: request.customer_name,
    customerEmail: request.customer_email,
    customerPhone: request.customer_phone,
    deviceType: request.device_type,
    brand: request.brand,
    model: request.model,
    reportedIssue: request.reported_issue,
    serviceId: request.service_id,
    serviceName: request.service_name_snapshot || "Other / not listed",
    status: request.status,
    priority: request.priority,
    submittedAt: request.submitted_at,
    updatedAt: request.updated_at,
    assignedTechnicianId: request.assigned_technician_id,
    assignedTechnician: technician?.display_name || null,
    customerVisibleNotes: request.customer_visible_note || "",
    customerStatusHistory: histories.map((entry) => ({
      status: entry.to_status,
      message: entry.customer_message || "",
      occurredAt: entry.created_at,
    })),
    internalNotes: notes.map((entry) => entry.note).join("\n"),
    workNotes: notes.map((entry) => ({
      note: entry.note,
      createdAt: entry.created_at,
      author: profileNames.get(entry.created_by) || "Owner",
    })),
  });

  const mapRecord = (collection, record) => {
    if (collection === "customers") {
      return {
        id: record.customer_key,
        profileId: record.profile_id,
        displayName: record.display_name,
        email: record.email,
        phone: record.phone,
        createdAt: record.created_at,
        repairCount: Number(record.repair_count),
        accountStatus: record.account_status,
      };
    }
    if (collection === "services") {
      return {
        id: record.id,
        slug: record.slug,
        name: record.name,
        category: record.category,
        description: record.description,
        status: record.status,
        isActive: record.status === "active",
        sortOrder: record.sort_order,
        updatedAt: record.updated_at,
      };
    }
    if (collection === "notifications") {
      return {
        id: record.id,
        title: record.title,
        detail: record.body,
        type: record.notification_type,
        status: record.read_at ? "read" : "unread",
        readAt: record.read_at,
        createdAt: record.created_at,
      };
    }
    if (collection === "notebook") {
      return {
        id: record.id,
        clientName: record.client_name,
        clientPhone: record.client_phone,
        clientEmail: record.client_email,
        entryType: record.entry_type,
        title: record.title,
        details: record.details || "",
        detailsPreview:
          record.details && record.details.length > 120
            ? `${record.details.slice(0, 117)}…`
            : record.details || "—",
        amount: record.amount === null ? null : Number(record.amount),
        entryDate: record.entry_date,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      };
    }
    if (collection === "activity") {
      const target = record.entity_id
        ? `${record.entity_type}:${record.entity_id}`
        : record.entity_type;
      return {
        id: record.id,
        actor:
          record.actor_name ||
          (record.actor_user_id ? "Staff member" : "System"),
        action: record.action,
        target,
        entityType: record.entity_type,
        entityId: record.entity_id,
        createdAt: record.created_at,
      };
    }
    return record;
  };

  const previewAdapter = {
    mode: "preview",
    async isOwner() {
      return false;
    },
    async list(collection, options = {}) {
      await ensurePreviewData();
      if (collection === "notebook") {
        const { page = 0, pageSize = pageSizeDefault } = options;
        return { mode: "preview", records: [], total: 0, page, pageSize };
      }
      return previewList(collection, options);
    },
    async overview() {
      await ensurePreviewData();
      const repairs = previewData.repairs;
      return {
        mode: "preview",
        metrics: {
          open: repairs.filter(
            (row) => !["completed", "cancelled"].includes(row.status),
          ).length,
          awaitingApproval: repairs.filter(
            (row) => row.status === "awaiting_approval",
          ).length,
          inProgress: repairs.filter((row) => row.status === "in_progress")
            .length,
          readyForPickup: repairs.filter(
            (row) => row.status === "ready_for_pickup",
          ).length,
        },
        async getSettings() {
          throw new Error("Preview mode is read-only.");
        },
        repairs: previewList("repairs", { pageSize: 4 }).records,
        activity: previewList("activity", { pageSize: 5 }).records,
      };
    },
    async createRepair() {
      throw new Error("Preview mode is read-only.");
    },
    async updateRepair() {
      throw new Error("Preview mode is read-only.");
    },
    async addInternalNote() {
      throw new Error("Preview mode is read-only.");
    },
    async createNotebookEntry() {
      throw new Error("Preview mode is read-only.");
    },
    async updateNotebookEntry() {
      throw new Error("Preview mode is read-only.");
    },
    async deleteNotebookEntry() {
      throw new Error("Preview mode is read-only.");
    },
    async createService() {
      throw new Error("Preview mode is read-only.");
    },
    async updateService() {
      throw new Error("Preview mode is read-only.");
    },
    async markNotificationRead() {
      throw new Error("Preview mode is read-only.");
    },
    async listCompletionProofs() {
      return {
        mode: "preview",
        records: [],
        total: 0,
        readyCount: 0,
        waitingCount: 0,
        batchIds: [],
        approvedProofCount: 0,
        approvedBatchCount: 0,
      };
    },
    async getCompletionProofCount() {
      return 0;
    },
    async authorizeCompletionProofCleanup() {
      throw new Error("Preview mode is read-only.");
    },
    async saveSettings() {
      throw new Error("Preview mode is read-only.");
    },
  };

  const productionAdapter = {
    mode: "production",
    async isOwner(userId) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "owner")
        .maybeSingle();
      if (error)
        throw databaseError("Owner authorization check failed", error);
      return Boolean(data);
    },
    async list(collection, options = {}) {
      const client = await window.AdminSupabaseClient.get();
      const {
        page = 0,
        pageSize = pageSizeDefault,
        search = "",
        filters = {},
      } = options;
      const offset = Math.max(0, page) * pageSize;
      const term = safeSearch(search);
      let query;

      if (collection === "repairs") {
        query = client
          .from("repair_requests")
          .select("*", { count: "exact" })
          .order("updated_at", { ascending: false });
        if (filters.status && filters.status !== "all")
          query = query.eq("status", filters.status);
        if (filters.priority && filters.priority !== "all")
          query = query.eq("priority", filters.priority);
        if (term)
          query = query.or(
            [
              "reference_number",
              "customer_name",
              "customer_email",
              "customer_phone",
              "brand",
              "model",
              "reported_issue",
              "service_name_snapshot",
            ]
              .map((field) => `${field}.ilike.%${term}%`)
              .join(","),
          );
      } else if (collection === "notebook") {
        query = client
          .from("client_notebook_entries")
          .select("*", { count: "exact" })
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (filters.entryType && filters.entryType !== "all")
          query = query.eq("entry_type", filters.entryType);
        if (term)
          query = query.or(
            [
              "client_name",
              "client_phone",
              "client_email",
              "title",
              "details",
            ]
              .map((field) => `${field}.ilike.%${term}%`)
              .join(","),
          );
      } else {
        const source = {
          customers: ["owner_customer_directory", "created_at"],
          services: ["repair_services", "sort_order"],
          notifications: ["notifications", "created_at"],
          activity: ["admin_activity_logs", "created_at"],
        }[collection];
        if (!source) throw new Error(`Unknown collection: ${collection}`);
        query = client
          .from(source[0])
          .select("*", { count: "exact" })
          .order(source[1], {
            ascending: collection === "services",
          });
        const filterColumns =
          {
            customers: { accountStatus: "account_status" },
            services: { status: "status" },
            notifications: {},
          }[collection] || {};
        for (const [key, column] of Object.entries(filterColumns)) {
          if (column && filters[key] && filters[key] !== "all")
            query = query.eq(column, filters[key]);
        }
        const fields =
          {
            customers: ["display_name", "email", "phone"],
            services: ["name", "category"],
            notifications: ["title", "body", "notification_type"],
            activity: ["action", "entity_type", "entity_id"],
          }[collection] || [];
        if (term && fields.length)
          query = query.or(
            fields.map((field) => `${field}.ilike.%${term}%`).join(","),
          );
        if (
          collection === "notifications" &&
          filters.status &&
          filters.status !== "all"
        ) {
          query =
            filters.status === "read"
              ? query.not("read_at", "is", null)
              : query.is("read_at", null);
        }
      }

      const { data, error, count } = await query.range(
        offset,
        offset + pageSize - 1,
      );
      if (error) throw databaseError(`Could not load ${collection}`, error);
      const records = data || [];

      if (collection === "repairs" && records.length) {
        const ids = records.map((record) => record.id);
        const technicianIds = [
          ...new Set(
            records
              .map((record) => record.assigned_technician_id)
              .filter(Boolean),
          ),
        ];
        const [historyResult, noteResult] = await Promise.all([
          client
            .from("repair_status_history")
            .select("repair_request_id,to_status,customer_message,created_at")
            .in("repair_request_id", ids)
            .order("created_at", { ascending: true }),
          client
            .from("repair_internal_notes")
            .select("repair_request_id,note,created_at,created_by")
            .in("repair_request_id", ids)
            .order("created_at", { ascending: true }),
        ]);
        if (historyResult.error || noteResult.error)
          throw databaseError(
            "Could not load repair details",
            historyResult.error || noteResult.error,
          );
        const profileIds = [
          ...new Set([
            ...technicianIds,
            ...(noteResult.data || [])
              .map((row) => row.created_by)
              .filter(Boolean),
          ]),
        ];
        const profileResult = profileIds.length
          ? await client
              .from("profiles")
              .select("id,display_name")
              .in("id", profileIds)
          : { data: [], error: null };
        if (profileResult.error)
          throw databaseError(
            "Could not load repair work-note authors",
            profileResult.error,
          );
        const profiles = new Map(
          (profileResult.data || []).map((row) => [row.id, row]),
        );
        const profileNames = new Map(
          [...profiles].map(([id, profile]) => [id, profile.display_name]),
        );
        const histories = new Map();
        for (const row of historyResult.data || [])
          histories.set(row.repair_request_id, [
            ...(histories.get(row.repair_request_id) || []),
            row,
          ]);
        const notes = new Map();
        for (const row of noteResult.data || [])
          notes.set(row.repair_request_id, [
            ...(notes.get(row.repair_request_id) || []),
            row,
          ]);
        return {
          mode: "production",
          records: records.map((row) =>
            mapRepair(
              row,
              profiles.get(row.assigned_technician_id),
              histories.get(row.id) || [],
              notes.get(row.id) || [],
              profileNames,
            ),
          ),
          total: count || 0,
          page,
          pageSize,
        };
      }

      if (collection === "activity" && records.length) {
        const actorIds = [
          ...new Set(records.map((row) => row.actor_user_id).filter(Boolean)),
        ];
        const { data: profiles, error: profileError } = actorIds.length
          ? await client
              .from("profiles")
              .select("id,display_name")
              .in("id", actorIds)
          : { data: [], error: null };
        if (profileError)
          throw databaseError("Could not load activity actors", profileError);
        const actorNames = new Map(
          (profiles || []).map((row) => [row.id, row.display_name]),
        );
        return {
          mode: "production",
          records: records.map((row) =>
            mapRecord(collection, {
              ...row,
              actor_name: actorNames.get(row.actor_user_id),
            }),
          ),
          total: count || 0,
          page,
          pageSize,
        };
      }

      return {
        mode: "production",
        records: records.map((row) => mapRecord(collection, row)),
        total: count || 0,
        page,
        pageSize,
      };
    },
    async overview() {
      const client = await window.AdminSupabaseClient.get();
      const counts = await Promise.all([
        client
          .from("repair_requests")
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(completed,cancelled)"),
        client
          .from("repair_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "awaiting_approval"),
        client
          .from("repair_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress"),
        client
          .from("repair_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "ready_for_pickup"),
      ]);
      const countError = counts.find((result) => result.error)?.error;
      if (countError)
        throw databaseError("Could not load overview metrics", countError);
      const [repairs, activity] = await Promise.all([
        this.list("repairs", { pageSize: 4 }),
        this.list("activity", { pageSize: 5 }),
      ]);
      return {
        mode: "production",
        metrics: {
          open: counts[0].count || 0,
          awaitingApproval: counts[1].count || 0,
          inProgress: counts[2].count || 0,
          readyForPickup: counts[3].count || 0,
        },
        repairs: repairs.records,
        activity: activity.records,
      };
    },
    async getSettings() {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("business_settings")
        .select(
          "business_name,public_phone,public_email,public_address,business_hours,notification_preferences,updated_at",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error)
        throw databaseError("Business settings could not be loaded", error);
      return data;
    },
    async createRepair(payload) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_requests")
        .insert(payload)
        .select("id,reference_number")
        .single();
      if (error)
        throw databaseError("Repair request could not be created", error);
      return data;
    },
    async getRepairAttachments(repairId) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_attachments")
        .select("object_path,original_filename,content_type,byte_size")
        .eq("repair_request_id", repairId)
        .order("created_at", { ascending: true });
      if (error)
        throw databaseError("Repair photos could not be loaded", error);
      return Promise.all(
        (data || []).map(async (attachment) => {
          const { data: signed, error: signedError } = await client.storage
            .from("repair-attachments")
            .createSignedUrl(attachment.object_path, 300);
          if (signedError)
            throw databaseError("A repair photo could not be opened", signedError);
          return { ...attachment, signedUrl: signed.signedUrl };
        }),
      );
    },
    async updateRepair(id, payload) {
      const allowed = [
        "customer_name",
        "customer_email",
        "customer_phone",
        "device_type",
        "brand",
        "model",
        "reported_issue",
        "service_id",
        "service_name_snapshot",
        "status",
        "priority",
        "assigned_technician_id",
        "customer_visible_note",
      ];
      const safePayload = Object.fromEntries(
        Object.entries(payload).filter(([key]) => allowed.includes(key)),
      );
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_requests")
        .update(safePayload)
        .eq("id", id)
        .select("id,reference_number,status,priority,updated_at")
        .single();
      if (error) throw databaseError("Repair update was rejected", error);
      return data;
    },
    async addInternalNote(repairId, note, userId) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_internal_notes")
        .insert({ repair_request_id: repairId, note, created_by: userId })
        .select("id,created_at,created_by")
        .single();
      if (error) throw databaseError("Internal note could not be saved", error);
      return data;
    },
    async listCompletionProofs() {
      const client = await window.AdminSupabaseClient.get();
      const { error: stageError } = await client.rpc(
        "stage_ready_completion_proof_batches",
      );
      if (stageError)
        throw databaseError("Ready completion batches could not be prepared", stageError);

      const [
        { data: batches, error: batchError },
        { count: waitingCount, error: waitingError },
        { data: approvedBatches, error: approvedBatchError },
      ] =
        await Promise.all([
          client
            .from("repair_completion_batches")
            .select("id,batch_number")
            .is("cleanup_authorized_at", null)
            .order("batch_number", { ascending: true }),
          client
            .from("repair_completion_proofs")
            .select("id", { count: "exact", head: true })
            .is("batch_id", null),
          client
            .from("repair_completion_batches")
            .select("id")
            .not("cleanup_authorized_at", "is", null),
        ]);
      if (batchError || waitingError || approvedBatchError)
        throw databaseError(
          "Completion batch status could not be loaded",
          batchError || waitingError || approvedBatchError,
        );

      const batchIds = (batches || []).map((batch) => batch.id);
      const approvedBatchIds = (approvedBatches || []).map((batch) => batch.id);
      const { count: approvedProofCount, error: approvedProofError } =
        approvedBatchIds.length
          ? await client
              .from("repair_completion_proofs")
              .select("id", { count: "exact", head: true })
              .in("batch_id", approvedBatchIds)
          : { count: 0, error: null };
      if (approvedProofError)
        throw databaseError(
          "Approved cleanup progress could not be loaded",
          approvedProofError,
        );

      const { data: proofs, error: proofError } = batchIds.length
        ? await client
            .from("repair_completion_proofs")
            .select(
              "id,repair_request_id,reference_number,customer_name,customer_email,customer_phone,device_type,brand,model,reported_issue,service_name,submitted_at,completed_at,batch_id",
            )
            .in("batch_id", batchIds)
            .order("completed_at", { ascending: true })
        : { data: [], error: null };
      if (proofError)
        throw databaseError("Completion proof records could not be loaded", proofError);
      const proofsById = new Map((batches || []).map((batch) => [batch.id, batch]));
      const readyProofs = (proofs || []).map((proof) => ({
        ...proof,
        batchNumber: proofsById.get(proof.batch_id)?.batch_number,
      }));

      const references = readyProofs.map((proof) => proof.reference_number);
      const repairIds = readyProofs
        .map((proof) => proof.repair_request_id)
        .filter(Boolean);
      const noteRows = [];
      const loadNotes = async (column, values) => {
        for (let offset = 0; offset < values.length; offset += 100) {
          const { data, error } = await client
            .from("repair_internal_notes")
            .select(
              "id,repair_request_id,repair_reference_snapshot,note,created_at,created_by",
            )
            .in(column, values.slice(offset, offset + 100));
          if (error)
            throw databaseError("Completion proof work notes could not be loaded", error);
          noteRows.push(...(data || []));
        }
      };
      await Promise.all([
        loadNotes("repair_request_id", repairIds),
        loadNotes("repair_reference_snapshot", references),
      ]);
      const notesByReference = new Map();
      const proofByRepairId = new Map(
        readyProofs
          .filter((proof) => proof.repair_request_id)
          .map((proof) => [proof.repair_request_id, proof]),
      );
      const seenNotes = new Set();
      for (const note of noteRows) {
        if (seenNotes.has(note.id)) continue;
        seenNotes.add(note.id);
        const proof = proofByRepairId.get(note.repair_request_id);
        const reference =
          proof?.reference_number || note.repair_reference_snapshot;
        if (!reference) continue;
        notesByReference.set(reference, [
          ...(notesByReference.get(reference) || []),
          note,
        ]);
      }

      const authorIds = [
        ...new Set(noteRows.map((note) => note.created_by).filter(Boolean)),
      ];
      const { data: authors, error: authorError } = authorIds.length
        ? await client
            .from("profiles")
            .select("id,display_name")
            .in("id", authorIds)
        : { data: [], error: null };
      if (authorError)
        throw databaseError("Completion proof note authors could not be loaded", authorError);
      const authorNames = new Map(
        (authors || []).map((author) => [author.id, author.display_name]),
      );

      return {
        mode: "production",
        records: readyProofs.map((proof) => ({
          ...proof,
          workNotes: (notesByReference.get(proof.reference_number) || [])
            .sort(
              (left, right) =>
                Date.parse(left.created_at) - Date.parse(right.created_at),
            )
            .map((note) => ({
              note: note.note,
              createdAt: note.created_at,
              author: authorNames.get(note.created_by) || "Owner",
            })),
        })),
        readyCount: readyProofs.length,
        waitingCount: waitingCount || 0,
        batchIds,
        approvedProofCount: approvedProofCount || 0,
        approvedBatchCount: approvedBatchIds.length,
      };
    },
    async getCompletionProofCount() {
      const client = await window.AdminSupabaseClient.get();
      const [
        { count: batchCount, error: batchError },
        { count: unbatchedCount, error: unbatchedError },
      ] = await Promise.all([
        client
          .from("repair_completion_batches")
          .select("id", { count: "exact", head: true }),
        client
          .from("repair_completion_proofs")
          .select("id", { count: "exact", head: true })
          .is("batch_id", null),
      ]);
      if (batchError || unbatchedError)
        throw databaseError(
          "Completion proof count could not be loaded",
          batchError || unbatchedError,
        );
      return (batchCount || 0) * 10 + (unbatchedCount || 0);
    },
    async authorizeCompletionProofCleanup(batchIds) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client.rpc(
        "authorize_completion_proof_cleanup",
        { p_batch_ids: batchIds },
      );
      if (error)
        throw databaseError(
          "Completion proof cleanup could not be authorized",
          error,
        );
      return data;
    },
    async createService(payload) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_services")
        .insert(payload)
        .select("id,slug,name")
        .single();
      if (error) throw databaseError("Service could not be created", error);
      return data;
    },
    async updateService(id, payload) {
      const allowed = [
        "slug",
        "name",
        "category",
        "description",
        "status",
        "sort_order",
      ];
      const safePayload = Object.fromEntries(
        Object.entries(payload).filter(([key]) => allowed.includes(key)),
      );
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_services")
        .update(safePayload)
        .eq("id", id)
        .select("id,name,status,updated_at")
        .single();
      if (error) throw databaseError("Service update was rejected", error);
      return data;
    },
    async markNotificationRead(id) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .select("id,read_at")
        .single();
      if (error)
        throw databaseError("Notification state could not be updated", error);
      return data;
    },
    async saveSettings(payload) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("business_settings")
        .upsert({ id: 1, ...payload }, { onConflict: "id" })
        .select("id,updated_at")
        .single();
      if (error) throw databaseError("Settings could not be saved", error);
      return data;
    },
    async createNotebookEntry(payload) {
      const allowed = [
        "client_name",
        "client_phone",
        "client_email",
        "entry_type",
        "title",
        "details",
        "amount",
        "entry_date",
      ];
      const safePayload = Object.fromEntries(
        Object.entries(payload).filter(([key]) => allowed.includes(key)),
      );
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("client_notebook_entries")
        .insert(safePayload)
        .select("id")
        .single();
      if (error) throw databaseError("Notebook entry could not be created", error);
      return data;
    },
    async updateNotebookEntry(id, payload) {
      const allowed = [
        "client_name",
        "client_phone",
        "client_email",
        "entry_type",
        "title",
        "details",
        "amount",
        "entry_date",
      ];
      const safePayload = Object.fromEntries(
        Object.entries(payload).filter(([key]) => allowed.includes(key)),
      );
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("client_notebook_entries")
        .update(safePayload)
        .eq("id", id)
        .select("id,updated_at")
        .single();
      if (error) throw databaseError("Notebook entry could not be updated", error);
      return data;
    },
    async deleteNotebookEntry(id) {
      const client = await window.AdminSupabaseClient.get();
      const { error } = await client
        .from("client_notebook_entries")
        .delete()
        .eq("id", id);
      if (error) throw databaseError("Notebook entry could not be deleted", error);
    },
  };

  window.AdminDataAdapter = previewMode ? previewAdapter : productionAdapter;
})();
