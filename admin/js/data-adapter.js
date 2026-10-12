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
    posts: ["title", "serviceName"],
    comments: ["postTitle", "authorName", "body"],
    services: ["name", "category"],
    notifications: ["title", "detail"],
    activity: ["actor", "action", "target"],
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

  const mapRepair = (request, technician, histories, notes) => ({
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
    if (collection === "posts") {
      return {
        id: record.id,
        title: record.title,
        caption: record.caption,
        serviceId: record.service_id,
        serviceName: record.service_name || "Not linked",
        status: record.status,
        mediaCount: Number(record.media_count || 0),
        updatedAt: record.updated_at,
      };
    }
    if (collection === "comments") {
      return {
        id: record.id,
        postId: record.post_id,
        postTitle: record.post_title || "Post unavailable",
        authorName: record.author_name_snapshot,
        body: record.body,
        status: record.status,
        submittedAt: record.created_at,
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
    async moderateComment() {
      throw new Error("Preview mode is read-only.");
    },
    async createService() {
      throw new Error("Preview mode is read-only.");
    },
    async updateService() {
      throw new Error("Preview mode is read-only.");
    },
    async createPost() {
      throw new Error("Preview mode is read-only.");
    },
    async updatePost() {
      throw new Error("Preview mode is read-only.");
    },
    async markNotificationRead() {
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
      } else {
        const source = {
          customers: ["owner_customer_directory", "created_at"],
          posts: ["owner_showcase_posts", "updated_at"],
          comments: ["owner_comments", "created_at"],
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
            posts: { status: "status" },
            comments: { status: "status" },
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
            posts: ["title", "caption"],
            comments: ["body", "author_name_snapshot"],
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
        const [historyResult, noteResult, technicianResult] = await Promise.all(
          [
            client
              .from("repair_status_history")
              .select("repair_request_id,to_status,customer_message,created_at")
              .in("repair_request_id", ids)
              .order("created_at", { ascending: true }),
            client
              .from("repair_internal_notes")
              .select("repair_request_id,note,created_at")
              .in("repair_request_id", ids)
              .order("created_at", { ascending: true }),
            technicianIds.length
              ? client
                  .from("profiles")
                  .select("id,display_name")
                  .in("id", technicianIds)
              : Promise.resolve({ data: [], error: null }),
          ],
        );
        if (historyResult.error || noteResult.error || technicianResult.error)
          throw databaseError(
            "Could not load repair details",
            historyResult.error || noteResult.error || technicianResult.error,
          );
        const technicians = new Map(
          (technicianResult.data || []).map((row) => [row.id, row]),
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
              technicians.get(row.assigned_technician_id),
              histories.get(row.id) || [],
              notes.get(row.id) || [],
            ),
          ),
          total: count || 0,
          page,
          pageSize,
        };
      }

      if (collection === "posts" && records.length) {
        const postIds = records.map((row) => row.id);
        const serviceIds = [
          ...new Set(records.map((row) => row.service_id).filter(Boolean)),
        ];
        const [mediaResult, serviceResult] = await Promise.all([
          client
            .from("owner_showcase_media")
            .select("post_id")
            .in("post_id", postIds),
          serviceIds.length
            ? client
                .from("repair_services")
                .select("id,name")
                .in("id", serviceIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (mediaResult.error || serviceResult.error)
          throw databaseError(
            "Could not load showcase relations",
            mediaResult.error || serviceResult.error,
          );
        const mediaCounts = new Map();
        for (const row of mediaResult.data || [])
          mediaCounts.set(row.post_id, (mediaCounts.get(row.post_id) || 0) + 1);
        const services = new Map(
          (serviceResult.data || []).map((row) => [row.id, row.name]),
        );
        return {
          mode: "production",
          records: records.map((row) =>
            mapRecord(collection, {
              ...row,
              media_count: mediaCounts.get(row.id) || 0,
              service_name: services.get(row.service_id),
            }),
          ),
          total: count || 0,
          page,
          pageSize,
        };
      }

      if (collection === "comments" && records.length) {
        const postIds = [...new Set(records.map((row) => row.post_id))];
        const { data: posts, error: postError } = await client
          .from("owner_showcase_posts")
          .select("id,title")
          .in("id", postIds);
        if (postError)
          throw databaseError("Could not load comment post titles", postError);
        const titleById = new Map(
          (posts || []).map((row) => [row.id, row.title]),
        );
        return {
          mode: "production",
          records: records.map((row) =>
            mapRecord(collection, {
              ...row,
              post_title: titleById.get(row.post_id),
            }),
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
        .select("id")
        .single();
      if (error) throw databaseError("Internal note could not be saved", error);
      return data;
    },
    async moderateComment(id, status, userId) {
      if (!["approved", "rejected", "hidden"].includes(status))
        throw new Error("Invalid moderation state.");
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("comments")
        .update({
          status,
          moderated_by: userId,
          moderated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id,status")
        .single();
      if (error) throw databaseError("Comment moderation was rejected", error);
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
    async createPost(payload) {
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_posts")
        .insert(payload)
        .select("id,title,status")
        .single();
      if (error)
        throw databaseError("Repair post could not be created", error);
      return data;
    },
    async updatePost(id, payload) {
      const allowed = [
        "title",
        "caption",
        "service_id",
        "status",
        "published_at",
      ];
      const safePayload = Object.fromEntries(
        Object.entries(payload).filter(([key]) => allowed.includes(key)),
      );
      const client = await window.AdminSupabaseClient.get();
      const { data, error } = await client
        .from("repair_posts")
        .update(safePayload)
        .eq("id", id)
        .select("id,title,status,updated_at")
        .single();
      if (error) throw databaseError("Repair post update was rejected", error);
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
  };

  window.AdminDataAdapter = previewMode ? previewAdapter : productionAdapter;
})();
