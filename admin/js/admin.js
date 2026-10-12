(() => {
  const themeKey = "rd-cellphone-repair-theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const moduleDefinitions = {
    overview: {
      title: "Overview",
      description:
        "A live snapshot of the repair workflow.",
    },
    repairs: {
      title: "Repair Management",
      description:
        "Review repair intake, device details, priority, and customer-visible progress.",
      collection: "repairs",
      search: [
        "reference",
        "customerName",
        "customerEmail",
        "customerPhone",
        "brand",
        "model",
        "reportedIssue",
        "serviceName",
      ],
      filters: [
        {
          key: "status",
          label: "Repair status",
          options: [
            "submitted",
            "inspecting",
            "awaiting_approval",
            "approved",
            "in_progress",
            "ready_for_pickup",
            "completed",
            "cancelled",
          ],
        },
        {
          key: "priority",
          label: "Priority",
          options: ["low", "normal", "high", "urgent"],
        },
      ],
      columns: [
        ["reference", "Reference"],
        ["customerName", "Customer"],
        ["brandModel", "Device"],
        ["reportedIssue", "Reported issue"],
        ["serviceName", "Selected service"],
        ["status", "Status"],
        ["priority", "Priority"],
        ["updatedAt", "Updated"],
      ],
      action: "details",
      cta: "New repair request",
    },
    notes: {
      title: "Completed Service Notes",
      description:
        "Review completed repairs and the owner-only work notes recorded as service proof.",
      collection: "repairs",
      search: [
        "reference",
        "customerName",
        "brand",
        "model",
        "reportedIssue",
        "serviceName",
      ],
      filters: [
        {
          key: "status",
          label: "Repair status",
          options: ["completed"],
        },
      ],
      columns: [
        ["reference", "Reference"],
        ["customerName", "Customer"],
        ["brandModel", "Device"],
        ["serviceName", "Service"],
        ["workNoteCount", "Work notes"],
        ["updatedAt", "Completed"],
      ],
      action: "details",
      actionLabel: "View notes",
    },
    notebook: {
      title: "Client Notebook",
      description:
        "Keep a private record of client purchases, requested repairs and services, and other shop notes.",
      collection: "notebook",
      search: ["clientName", "clientPhone", "clientEmail", "title", "details"],
      columns: [
        ["entryDate", "Date"],
        ["clientName", "Client"],
        ["entryType", "Type"],
        ["title", "Item or service"],
        ["detailsPreview", "Notes"],
        ["amount", "Amount (PHP)"],
      ],
      action: "notebook",
      cta: "New notebook entry",
    },
    customers: {
      title: "Customers",
      description:
        "Customer profiles and contact details associated with repair requests.",
      collection: "customers",
      search: ["displayName", "email", "phone"],
      filters: [
        {
          key: "accountStatus",
          label: "Profile status",
          options: ["inquiry_only", "active", "inactive"],
        },
      ],
      columns: [
        ["displayName", "Customer"],
        ["email", "Email"],
        ["phone", "Phone"],
        ["repairCount", "Repairs"],
        ["accountStatus", "Profile status"],
      ],
    },
    services: {
      title: "Services",
      description: "Manage the services shown in the public catalog.",
      collection: "services",
      search: ["name", "category"],
      filters: [
        {
          key: "status",
          label: "Service status",
          options: ["active", "draft", "inactive"],
        },
      ],
      columns: [
        ["name", "Service"],
        ["category", "Category"],
        ["status", "Status"],
        ["updatedAt", "Updated"],
      ],
      cta: "Add service",
    },
    notifications: {
      title: "Notifications",
      description: "Review owner notifications and mark them as read.",
      collection: "notifications",
      search: ["title", "detail"],
      filters: [
        { key: "status", label: "Read status", options: ["unread", "read"] },
      ],
      columns: [
        ["title", "Notification"],
        ["detail", "Details"],
        ["status", "Read status"],
        ["createdAt", "Received"],
      ],
      action: "notification",
    },
    activity: {
      title: "Activity Logs",
      description: "Review the administrative activity audit trail.",
      collection: "activity",
      search: ["actor", "action", "target"],
      columns: [
        ["createdAt", "Time"],
        ["actor", "Actor"],
        ["action", "Action"],
        ["target", "Related record"],
      ],
    },
    settings: {
      title: "Settings",
      description: "Manage the public business profile and owner preferences.",
    },
  };

  const isTheme = (value) => value === "light" || value === "dark";
  const readSavedTheme = () => {
    try {
      const saved = localStorage.getItem(themeKey);
      return isTheme(saved) ? saved : null;
    } catch {
      return null;
    }
  };
  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    themeColor?.setAttribute(
      "content",
      theme === "dark" ? "#171717" : "#f7f7f5",
    );
  };
  const syncTheme = () =>
    applyTheme(readSavedTheme() || (systemTheme.matches ? "dark" : "light"));

  syncTheme();
  window.addEventListener("storage", (event) => {
    if (event.key === themeKey || event.key === null) syncTheme();
  });
  systemTheme.addEventListener("change", () => {
    if (!readSavedTheme()) syncTheme();
  });

  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("#admin-login-form");
    if (loginForm) {
      const password = document.querySelector("#owner-password");
      const passwordToggle = document.querySelector("#password-toggle");
      const loginStatus = document.querySelector("#login-status");
      const loginIntro = document.querySelector("#login-intro");
      const loginHint = document.querySelector("#login-hint");
      const loginModeLabel = document.querySelector("#login-mode-label");
      const loginEyebrow = document.querySelector("#login-eyebrow");
      const loginSubmit = loginForm.querySelector('[type="submit"]');
      const supabaseConfig = window.AdminSupabaseClient;

      const setLoginStatus = (message, state = "error") => {
        loginStatus.textContent = message;
        loginStatus.dataset.state = state;
      };

      if (supabaseConfig?.isPreview()) {
        loginIntro.textContent =
          "Preview mode does not authenticate. Open the dashboard with ?preview=1 to view demo data.";
        loginHint.textContent =
          "This preview does not send or store entered credentials.";
        loginModeLabel.textContent = "PREVIEW / NO AUTH";
        loginEyebrow.lastChild.textContent = " OWNER AREA / PREVIEW";
      } else if (!supabaseConfig?.isConfigured()) {
        loginIntro.textContent =
          "Supabase is not configured. Sign-in is unavailable until project settings are supplied.";
        loginHint.textContent =
          "Credentials are submitted only to Supabase Auth after configuration.";
        loginModeLabel.textContent = "SETUP REQUIRED";
        loginEyebrow.lastChild.textContent = " OWNER AREA / SETUP REQUIRED";
      } else {
        loginIntro.textContent =
          "Sign in with the owner account provisioned in Supabase Auth.";
        loginHint.textContent =
          "Authentication is handled by Supabase. This page does not store your password.";
        loginEyebrow.lastChild.textContent = " OWNER AREA / LIVE AUTH";
      }

      passwordToggle.addEventListener("click", () => {
        const isVisible = password.type === "text";
        password.type = isVisible ? "password" : "text";
        passwordToggle.setAttribute("aria-pressed", String(!isVisible));
        passwordToggle.setAttribute(
          "aria-label",
          isVisible ? "Show password" : "Hide password",
        );
      });
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loginStatus.textContent = "";
        loginStatus.removeAttribute("data-state");
        if (!loginForm.checkValidity()) {
          loginStatus.textContent = "Enter a valid email address and password.";
          loginStatus.dataset.state = "error";
          loginForm.reportValidity();
          return;
        }

        if (supabaseConfig?.isPreview()) {
          setLoginStatus(
            "Preview mode does not authenticate. No sign-in was attempted.",
            "info",
          );
          return;
        }
        if (!supabaseConfig?.isConfigured()) {
          setLoginStatus(
            "Supabase configuration is missing. No sign-in was attempted.",
          );
          return;
        }

        loginSubmit.disabled = true;
        setLoginStatus("Signing in with Supabase…", "loading");
        try {
          const client = await supabaseConfig.get();
          const { data, error } = await client.auth.signInWithPassword({
            email: document.querySelector("#owner-email").value.trim(),
            password: password.value,
          });
          if (error || !data.user) {
            setLoginStatus(
              "Sign-in failed. Check the credentials and try again.",
            );
            return;
          }

          const isOwner = await window.AdminDataAdapter.isOwner(data.user.id);
          if (!isOwner) {
            await client.auth.signOut();
            setLoginStatus("This account is not provisioned for owner access.");
            return;
          }
          setLoginStatus(
            "Owner account verified. Opening the dashboard…",
            "info",
          );
          window.location.replace(new URL("../", window.location.href).href);
        } catch (error) {
          console.error("Owner sign-in failed:", error);
          setLoginStatus(
            "Sign-in is temporarily unavailable. Check the Supabase configuration and try again.",
          );
        } finally {
          loginSubmit.disabled = false;
        }
      });

      if (supabaseConfig?.isConfigured() && !supabaseConfig.isPreview()) {
        supabaseConfig
          .get()
          .then(async (client) => {
            const { data } = await client.auth.getSession();
            const user = data.session?.user;
            if (user && (await window.AdminDataAdapter.isOwner(user.id))) {
              window.location.replace(
                new URL("../", window.location.href).href,
              );
            }
          })
            .catch((error) => {
              console.error("Existing owner session could not be verified:", error);
            });
      }
    }

    const adminPage = document.querySelector("[data-admin-page]");
    if (!adminPage) return;

    const host = document.querySelector("#module-view-host");
    const sidebarToggle = document.querySelector("#sidebar-toggle");
    const sidebarBackdrop = document.querySelector(".sidebar-backdrop");
    const navItems = [
      ...document.querySelectorAll(".admin-nav [data-view-target]"),
    ];
    const breadcrumb = document.querySelector(
      ".topbar-context > span:last-child",
    );
    let activeModule = "overview";
    let activeRecords = [];
    let activePage = 0;
    let activeTotal = 0;
    let currentUserId = null;
    let completionProofRecords = [];
    let downloadedCompletionBatchIds = [];
    const moduleQueryState = new Map();
    let searchTimer;
    let toastTimer;
    const toast = document.querySelector("#admin-toast");

    const showToast = (message, state = "success") => {
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.dataset.state = state;
      toast.hidden = false;
      toastTimer = window.setTimeout(() => {
        toast.hidden = true;
      }, 5000);
    };

    const isProduction = () =>
      window.AdminDataAdapter?.mode === "production";
    const getQueryState = (moduleKey) => {
      if (!moduleQueryState.has(moduleKey))
        moduleQueryState.set(moduleKey, {
          search: "",
          filters:
            moduleKey === "notes"
              ? { status: "completed" }
              : moduleKey === "notebook"
                ? { entryType: "all" }
                : {},
        });
      return moduleQueryState.get(moduleKey);
    };

    document
      .querySelectorAll(".admin-view")
      .forEach((legacyView) => legacyView.remove());

    const makeElement = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };

    const setSidebarOpen = (isOpen) => {
      adminPage.dataset.sidebarOpen = String(isOpen);
      sidebarToggle.setAttribute("aria-expanded", String(isOpen));
      sidebarToggle.setAttribute(
        "aria-label",
        isOpen ? "Close dashboard navigation" : "Open dashboard navigation",
      );
      sidebarBackdrop.hidden = !isOpen;
    };

    const formatValue = (key, value) => {
      if (value === null || value === undefined || value === "")
        return "Not assigned";
      if (key === "entryType") {
        return {
          purchase: "Purchase",
          repair: "Repair / service",
          other: "Other note",
        }[value] || String(value);
      }
      if (key === "entryDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
        }).format(new Date(`${value}T12:00:00`));
      }
      if (
        key.toLowerCase().endsWith("at") &&
        !Number.isNaN(Date.parse(value))
      ) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value));
      }
      if (typeof value === "number") return String(value);
      return String(value).replaceAll("_", " ");
    };

    const makeHeading = (definition) => {
      const heading = makeElement("div", "page-heading module-page-heading");
      const copy = document.createElement("div");
      const crumb = makeElement("p", "breadcrumb");
      crumb.append(
        "Admin ",
        makeElement("span", "", "/"),
        ` ${definition.title}`,
      );
      const title = makeElement("h1", "", definition.title);
      title.id = "module-title";
      copy.append(
        crumb,
        title,
        makeElement("p", "page-description", definition.description),
      );
      heading.append(
        copy,
        makeElement(
          "span",
          "data-label",
          isProduction() ? "LIVE SUPABASE DATA" : "DEMO PREVIEW DATA",
        ),
      );
      return heading;
    };

    const createTable = (definition, records, includeAction = true) => {
      const wrapper = makeElement("div", "table-scroll");
      const table = makeElement("table", "data-table module-table");
      table.append(
        makeElement(
          "caption",
          "visually-hidden",
          `${definition.title} records`,
        ),
      );
      const head = document.createElement("thead");
      const headerRow = document.createElement("tr");
      definition.columns.forEach(([, label]) => {
        const th = makeElement("th", "", label);
        th.scope = "col";
        headerRow.append(th);
      });
      if ((definition.action || definition.cta) && includeAction) {
        const th = makeElement("th", "", "Actions");
        th.scope = "col";
        headerRow.append(th);
      }
      head.append(headerRow);
      const body = document.createElement("tbody");
      records.forEach((record) => {
        const row = document.createElement("tr");
        definition.columns.forEach(([key]) => {
          const value =
            key === "brandModel"
              ? `${record.brand} ${record.model}`
              : key === "workNoteCount"
                ? String(record.workNotes?.length || 0)
                : key === "amount" && record.amount !== null
                  ? new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(record.amount)
              : record[key];
          const cell = makeElement(
            "td",
            key === "reference" ? "request-id" : "",
            formatValue(key, value),
          );
          if (["status", "priority", "accountStatus"].includes(key)) {
            cell.replaceChildren(
              makeElement("span", "status-pill", formatValue(key, value)),
            );
          }
          row.append(cell);
        });
        if ((definition.action || definition.cta) && includeAction) {
          const actionCell = document.createElement("td");
          actionCell.className = "table-actions";
          if (definition.action === "details") {
            const action = makeElement(
              "button",
              "table-action",
              definition.actionLabel || "View details",
            );
            action.type = "button";
            action.dataset.recordAction = "details";
            action.dataset.recordId = record.id;
            action.setAttribute(
              "aria-label",
              `${definition.actionLabel || "View repair details"} for ${record.reference}`,
            );
            actionCell.append(action);
            if (
              isProduction() &&
              !["completed", "cancelled"].includes(record.status)
            ) {
              const complete = makeElement(
                "button",
                "table-action",
                "Mark as done",
              );
              complete.type = "button";
              complete.dataset.recordAction = "complete-repair";
              complete.dataset.recordId = record.id;
              complete.setAttribute(
                "aria-label",
                `Mark repair ${record.reference} as done`,
              );
              actionCell.append(complete);
            }
          }
          if (definition.action === "notification") {
            const action = makeElement(
              "button",
              "table-action",
              record.status === "unread" ? "Mark read" : "Read",
            );
            action.type = "button";
            action.disabled = !isProduction() || record.status === "read";
            action.dataset.recordAction = "mark-read";
            action.dataset.recordId = record.id;
            actionCell.append(action);
          }
          if (definition.action === "notebook") {
            const edit = makeElement("button", "table-action", "Edit");
            edit.type = "button";
            edit.dataset.notebookAction = "edit";
            edit.dataset.recordId = record.id;
            edit.setAttribute("aria-label", `Edit notebook entry for ${record.clientName}`);
            const remove = makeElement("button", "table-action", "Delete");
            remove.type = "button";
            remove.dataset.notebookAction = "delete";
            remove.dataset.recordId = record.id;
            remove.setAttribute("aria-label", `Delete notebook entry for ${record.clientName}`);
            actionCell.append(edit, remove);
          }
          if (
            definition.cta &&
            definition.action !== "notebook" &&
            isProduction()
          ) {
            const action = makeElement("button", "table-action", "Edit");
            action.type = "button";
            action.dataset.recordAction = "edit";
            action.dataset.recordId = record.id;
            actionCell.append(action);
          }
          row.append(actionCell);
        }
        body.append(row);
      });
      table.append(head, body);
      wrapper.append(table);
      return wrapper;
    };

    const renderRepairDetails = async (record) => {
      const detailPanel = host.querySelector("[data-repair-details]");
      if (!record || !detailPanel) return;
      const content = detailPanel.querySelector(".repair-detail-content");
      content.replaceChildren();
      detailPanel.dataset.repairId = record.id;
      [
        [
          "Customer",
          [record.customerName, record.customerEmail, record.customerPhone]
            .filter(Boolean)
            .join(" · "),
        ],
        ["Device", `${record.deviceType} · ${record.brand} ${record.model}`],
        ["Reported issue", record.reportedIssue],
        ["Selected service", record.serviceName],
        [
          "Status and priority",
          `${formatValue("status", record.status)} · ${formatValue("priority", record.priority)}`,
        ],
        [
          "Submitted / updated",
          `${formatValue("submittedAt", record.submittedAt)} · ${formatValue("updatedAt", record.updatedAt)}`,
        ],
        ["Assigned technician", record.assignedTechnician || "Not assigned"],
        [
          "Customer-visible status history",
          record.customerStatusHistory
            .map(
              (entry) =>
                `${formatValue("status", entry.status)}: ${entry.message}`,
            )
            .filter(Boolean)
            .join("; "),
        ],
        ["Customer-visible notes", record.customerVisibleNotes],
      ].forEach(([labelText, value]) => {
        const field = makeElement("div", "detail-field");
        field.append(
          makeElement("dt", "", labelText),
          makeElement("dd", "", value || "Not available"),
        );
        content.append(field);
      });
      renderWorkNotes(record, detailPanel.querySelector("[data-work-log]"));
      const attachmentsField = makeElement("div", "detail-field detail-field--wide");
      attachmentsField.append(
        makeElement("dt", "", "Customer photos"),
        makeElement(
          "dd",
          "repair-attachment-list",
          isProduction() ? "Loading photos…" : "Photos are not included in preview data.",
        ),
      );
      content.append(attachmentsField);
      if (isProduction()) {
        try {
          const attachments = await window.AdminDataAdapter.getRepairAttachments(
            record.id,
          );
          if (detailPanel.dataset.repairId !== record.id) return;
          const gallery = attachmentsField.querySelector("dd");
          gallery.replaceChildren();
          if (!attachments.length) {
            gallery.textContent = "No photos attached.";
          } else {
            attachments.forEach((attachment) => {
              const link = makeElement("a", "repair-attachment-link");
              link.href = attachment.signedUrl;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.setAttribute(
                "aria-label",
                `Open customer photo ${attachment.original_filename}`,
              );
              const image = makeElement("img", "repair-attachment-image");
              image.src = attachment.signedUrl;
              image.alt = attachment.original_filename;
              image.loading = "lazy";
              link.append(image);
              gallery.append(link);
            });
          }
        } catch (error) {
          console.error("Repair photo loading failed:", error);
          if (detailPanel.dataset.repairId === record.id)
            attachmentsField.querySelector("dd").textContent =
              error.message || "Repair photos could not be loaded.";
        }
      }
      detailPanel.hidden = false;
      detailPanel.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
      });
    };

    const createNotificationList = (records) => {
      const list = makeElement("div", "notification-list");
      records.forEach((record) => {
        const item = makeElement(
          "article",
          `notification-card${record.status === "unread" ? " is-unread" : ""}`,
        );
        const body = makeElement("div", "notification-card__body");
        const titleRow = makeElement("div", "notification-card__title");
        titleRow.append(
          makeElement("h3", "", record.title || "Notification"),
          makeElement(
            "span",
            `notification-state notification-state--${record.status}`,
            record.status,
          ),
        );
        body.append(
          titleRow,
          makeElement(
            "p",
            "notification-card__detail",
            record.detail || "No additional details.",
          ),
          makeElement(
            "time",
            "notification-card__time",
            formatValue("createdAt", record.createdAt),
          ),
        );
        item.append(body);
        if (record.status === "unread") {
          const action = makeElement(
            "button",
            "admin-button notification-card__action",
            "Mark as read",
          );
          action.type = "button";
          action.dataset.recordAction = "mark-read";
          action.dataset.recordId = record.id;
          item.append(action);
        }
        list.append(item);
      });
      return list;
    };

    const makeDataPanel = (definition) => {
      const panel = makeElement("section", "panel module-panel");
      panel.setAttribute("aria-labelledby", "module-panel-title");
      const panelHeading = makeElement("div", "panel-heading");
      const titleGroup = document.createElement("div");
      titleGroup.append(
        makeElement(
          "p",
          "panel-eyebrow",
          isProduction() ? "OWNER RECORDS" : "ISOLATED FIXTURE RECORDS",
        ),
      );
      const panelTitle = makeElement("h2", "", definition.title);
      panelTitle.id = "module-panel-title";
      titleGroup.append(panelTitle);
      panelHeading.append(titleGroup);
      if (definition.cta) {
        const button = makeElement(
          "button",
          "admin-button module-cta",
          definition.cta,
        );
        button.type = "button";
        button.disabled = !isProduction();
        button.dataset.createRecord = activeModule;
        button.title = isProduction()
          ? ""
          : "Writes are disabled in demo preview mode";
        button.setAttribute("aria-describedby", "module-action-note");
        panelHeading.append(button);
      }
      panel.append(
        panelHeading,
        makeElement(
          "p",
          "panel-note",
          isProduction()
            ? "Changes are saved to Supabase after you confirm each form."
            : "Synthetic demo data only. No records are stored or changed.",
        ),
      );
      const controls = makeElement("div", "module-controls");
      if (definition.search) {
        const searchLabel = makeElement("label", "module-search");
        searchLabel.append(
          makeElement(
            "span",
            "visually-hidden",
            `Search ${definition.title.toLowerCase()}`,
          ),
        );
        const icon = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        icon.setAttribute("class", "icon");
        icon.setAttribute("aria-hidden", "true");
        const use = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "use",
        );
        use.setAttribute("href", "#icon-search");
        icon.append(use);
        const input = document.createElement("input");
        input.type = "search";
        input.dataset.moduleSearch = "true";
        input.placeholder = `Search ${definition.title.toLowerCase()}`;
        input.autocomplete = "off";
        input.value = getQueryState(activeModule).search;
        searchLabel.append(icon, input);
        controls.append(searchLabel);
      }
      (definition.filters || []).forEach((filter) => {
        const label = makeElement("label", "module-filter");
        label.append(makeElement("span", "", filter.label));
        const select = document.createElement("select");
        select.dataset.moduleFilter = filter.key;
        const all = document.createElement("option");
        all.value = "all";
        all.textContent = `All ${filter.label.toLowerCase()}`;
        select.append(all);
        filter.options.forEach((value) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = formatValue(filter.key, value);
          select.append(option);
        });
        select.value = getQueryState(activeModule).filters[filter.key] || "all";
        label.append(select);
        controls.append(label);
      });
      if (controls.childElementCount) panel.append(controls);
      if (activeModule === "notebook") {
        const tabs = makeElement("div", "notebook-tabs");
        tabs.setAttribute("role", "group");
        tabs.setAttribute("aria-label", "Filter notebook entries");
        [
          ["all", "All entries"],
          ["purchase", "Purchases"],
          ["repair", "Repairs & services"],
          ["other", "Other notes"],
        ].forEach(([value, label]) => {
          const tab = makeElement("button", "notebook-tab", label);
          tab.type = "button";
          tab.dataset.notebookTab = value;
          tab.setAttribute(
            "aria-pressed",
            String(getQueryState(activeModule).filters.entryType === value),
          );
          tabs.append(tab);
        });
        panel.append(tabs);
      }
      const count = makeElement("p", "table-count", "");
      count.id = "module-record-count";
      count.setAttribute("role", "status");
      count.setAttribute("aria-live", "polite");
      count.setAttribute("aria-atomic", "true");
      panel.append(count);
      const loading = makeElement(
        "p",
        "module-state",
        isProduction() ? "Loading records…" : "Loading preview data…",
      );
      loading.dataset.moduleState = "loading";
      loading.setAttribute("role", "status");
      const error = makeElement("div", "module-state module-state--error");
      error.dataset.moduleState = "error";
      error.hidden = true;
      error.setAttribute("role", "alert");
      const empty = makeElement(
        "p",
        "module-state",
        activeModule === "notebook"
          ? "Your notebook is empty. Add a purchase, repair or service, or general client note."
          : `No ${definition.title.toLowerCase()} records are available.`,
      );
      empty.dataset.moduleState = "empty";
      empty.hidden = true;
      const noResults = makeElement(
        "p",
        "module-state",
        "No records match the current search and filters.",
      );
      noResults.dataset.moduleState = "no-results";
      noResults.hidden = true;
      const tableHost = makeElement("div", "module-table-host");
      panel.append(loading, error, empty, noResults, tableHost);
      const pagination = makeElement("div", "module-pagination");
      pagination.dataset.modulePagination = "true";
      panel.append(pagination);
      const actionNote = makeElement(
        "p",
        "module-action-note",
        isProduction()
          ? activeModule === "notebook"
            ? "Notebook entries are private to the owner. Purchases, repairs, services, and general client notes are saved to Supabase."
            : "Customer records are read-only. Repair, service, notification, and settings actions are saved to Supabase."
          : "Data changes and destructive actions are disabled in this preview.",
      );
      actionNote.id = "module-action-note";
      panel.append(actionNote);
      return panel;
    };

    const renderSettings = (settings = null) => {
      const panel = makeElement("section", "panel module-panel settings-panel");
      panel.setAttribute("aria-labelledby", "settings-panel-title");
      panel.append(
        makeElement(
          "p",
          "panel-eyebrow",
          isProduction() ? "BUSINESS PROFILE" : "PREVIEW ONLY",
        ),
      );
      const title = makeElement("h2", "", "Business profile and preferences");
      title.id = "settings-panel-title";
      panel.append(
        title,
        makeElement(
          "p",
          "panel-note",
          isProduction()
            ? "Saving publishes these business contact details on the public website and customer portal. Add multiple phones or emails on separate lines."
            : "Settings are read-only in the isolated demo preview.",
        ),
      );
      const form = document.createElement("form");
      form.className = "settings-form";
      [
        ["Business name", "business_name", "Public-facing shop name", false],
        ["Phone number(s)", "public_phone", "One number per line", true],
        ["Email address(es)", "public_email", "One email per line", true],
        ["Address", "public_address", "Public shop address", true],
        ["Business hours", "business_hours", "Public business hours", true],
      ].forEach(([name, key, placeholder, multiline]) => {
        const label = makeElement("label", "settings-field");
        label.append(makeElement("span", "", name));
        const input = multiline
          ? document.createElement("textarea")
          : document.createElement("input");
        input.name = key;
        if (multiline) input.rows = key === "public_address" ? 3 : 2;
        else input.type = "text";
        input.placeholder = placeholder;
        input.value = settings?.[key] || "";
        input.disabled = !isProduction();
        label.append(input);
        form.append(label);
      });
      const preferences = makeElement("fieldset", "settings-preferences");
      preferences.disabled = !isProduction();
      const legend = document.createElement("legend");
      legend.textContent = "Notification preferences";
      preferences.append(legend);
      [
        ["email_repairs", "Repair request updates"],
        ["email_activity", "Administrative activity alerts"],
      ].forEach(([key, text]) => {
        const label = makeElement("label", "settings-checkbox");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = key;
        input.checked = settings?.notification_preferences?.[key] === true;
        label.append(input, document.createTextNode(text));
        preferences.append(label);
      });
      form.append(preferences);
      const save = makeElement(
        "button",
        "admin-button admin-button--primary",
        "Save settings",
      );
      save.type = "submit";
      save.disabled = !isProduction();
      const status = makeElement("p", "form-status", "");
      status.dataset.settingsStatus = "true";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.dataset.settingsForm = "true";
      form.append(save, status);
      panel.append(form);
      return panel;
    };

    const createCompletionProofPanel = () => {
      const panel = makeElement("section", "panel completion-proof-panel");
      panel.setAttribute("aria-labelledby", "completion-proof-title");
      const copy = makeElement("div", "completion-proof-panel__copy");
      const title = makeElement("h2", "", "Completed repair proof pack");
      title.id = "completion-proof-title";
      copy.append(
        makeElement("p", "panel-eyebrow", "SERVICE MILESTONE"),
        title,
        makeElement(
          "p",
          "panel-note",
          "Keep a polished, downloadable record of who came in, what concern was repaired, when it was completed, and the owner-only work notes.",
        ),
      );
      const progress = document.createElement("progress");
      progress.className = "completion-proof-panel__progress";
      progress.max = 10;
      progress.value = 0;
      progress.setAttribute(
        "aria-label",
        "Completed repairs toward the ten-repair download milestone",
      );
      const progressLabel = makeElement(
        "p",
        "completion-proof-panel__progress-label",
        "",
      );
      progressLabel.dataset.proofProgress = "true";
      const status = makeElement(
        "p",
        "completion-proof-panel__status",
        "Loading saved completion records…",
      );
      status.dataset.proofStatus = "true";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      const download = makeElement(
        "button",
        "admin-button admin-button--primary completion-proof-panel__download",
        "Download proof report",
      );
      download.type = "button";
      download.disabled = true;
      download.dataset.downloadCompletionProofs = "true";
      const authorize = makeElement(
        "button",
        "admin-button completion-proof-panel__authorize",
        "I saved the report — approve cleanup",
      );
      authorize.type = "button";
      authorize.hidden = true;
      authorize.disabled = true;
      authorize.dataset.authorizeCompletionCleanup = "true";
      panel.append(copy, progress, progressLabel, status, download, authorize);
      return panel;
    };

    const renderCompletionProofPanel = (result, error = null) => {
      const panel = host.querySelector(".completion-proof-panel");
      if (!panel) return;
      const progress = panel.querySelector("progress");
      const progressLabel = panel.querySelector("[data-proof-progress]");
      const status = panel.querySelector("[data-proof-status]");
      const download = panel.querySelector("[data-download-completion-proofs]");
      const authorize = panel.querySelector(
        "[data-authorize-completion-cleanup]",
      );
      if (error) {
        completionProofRecords = [];
        downloadedCompletionBatchIds = [];
        progress.hidden = true;
        progressLabel.textContent = "";
        status.textContent =
          `Completion proof batches could not be loaded. Apply migrations 007 and 008, then refresh. ${error.message}`;
        status.dataset.state = "error";
        download.disabled = true;
        authorize.hidden = true;
        authorize.disabled = true;
        return;
      }
      completionProofRecords = result.records;
      downloadedCompletionBatchIds = [];
      const readyCount = result.readyCount;
      const waitingCount = result.waitingCount;
      const approvedProofCount = result.approvedProofCount;
      const hasReadyBatch = readyCount >= 10 && result.batchIds.length > 0;
      download.disabled = !isProduction() || !hasReadyBatch;
      progress.hidden = !isProduction();
      progress.value = Math.min(waitingCount, 10);
      progressLabel.textContent = isProduction()
        ? waitingCount
          ? `${Math.min(waitingCount, 10)} of 10 toward the next report batch`
          : hasReadyBatch
            ? "Full batch ready; remaining repairs will start the next group."
            : "0 of 10 toward the next report batch"
        : "Live completion records are available in the connected owner dashboard.";
      status.dataset.state = hasReadyBatch ? "ready" : "waiting";
      status.textContent = !isProduction()
        ? "Demo preview does not contain customer proof records."
        : hasReadyBatch
          ? `${readyCount} completed repairs are ready in ${result.batchIds.length} full batch${result.batchIds.length === 1 ? "" : "es"}. Download and save the report, then approve cleanup.`
          : approvedProofCount
            ? `${approvedProofCount} repair${approvedProofCount === 1 ? "" : "s"} in downloaded batches are waiting for their 48-hour minimum and automatic cleanup.`
          : approvedProofCount === 0 && (result.approvedBatchCount || 0) > 0
            ? "All approved batches have been cleaned up. Owner work notes and status history remain available."
            : `${waitingCount} of 10 completed repairs recorded. Nothing will be automatically deleted until a full batch is downloaded and approved.`;
      download.textContent = hasReadyBatch
        ? `Download ${readyCount} proof records`
        : `Download unlocks at 10 (${waitingCount}/10)`;
      authorize.hidden = true;
      authorize.disabled = true;
      authorize.textContent = "I saved the report — approve cleanup";
    };

    const escapeReportHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]);

    const formatReportDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "Not available"
        : new Intl.DateTimeFormat("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          }).format(date);
    };

    const downloadCompletionProofReport = (records) => {
      if (records.length < 10) {
        showToast("The proof report unlocks after 10 repairs are completed.", "error");
        return false;
      }
      const generatedAt = formatReportDate(new Date().toISOString());
      const reportItems = records
        .map((record) => {
          const notes = record.workNotes.length
            ? record.workNotes
                .map(
                  (entry) => `<li>
                    <div class="note-meta"><strong>${escapeReportHtml(entry.author)}</strong><time>${escapeReportHtml(formatReportDate(entry.createdAt))}</time></div>
                    <p>${escapeReportHtml(entry.note)}</p>
                  </li>`,
                )
                .join("")
            : '<li class="empty-note">No owner work note was recorded for this repair.</li>';
          const contact = [record.customer_email, record.customer_phone]
            .filter(Boolean)
            .map(escapeReportHtml)
            .join(" · ");
          return `<article class="repair-proof">
            <header><div><p class="eyebrow">COMPLETED REPAIR</p><h2>${escapeReportHtml(record.reference_number)}</h2></div><time>${escapeReportHtml(formatReportDate(record.completed_at))}</time></header>
            <div class="facts">
              <div><span>Customer</span><strong>${escapeReportHtml(record.customer_name)}</strong><small>${contact || "No contact details saved"}</small></div>
              <div><span>Device</span><strong>${escapeReportHtml([record.brand, record.model].filter(Boolean).join(" ") || record.device_type)}</strong><small>${escapeReportHtml(record.device_type)}</small></div>
              <div><span>Service</span><strong>${escapeReportHtml(record.service_name)}</strong></div>
              <div><span>Request received</span><strong>${escapeReportHtml(formatReportDate(record.submitted_at))}</strong></div>
            </div>
            <section class="concern"><h3>Customer concern</h3><p>${escapeReportHtml(record.reported_issue)}</p></section>
            <section class="proof-notes"><h3>Service work & proof notes</h3><ol>${notes}</ol></section>
          </article>`;
        })
        .join("");
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>R&amp;D Cellphone Repair — Completion Proof Report</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f3;color:#1e2622;font:15px/1.55 Arial,sans-serif}.report{max-width:900px;margin:0 auto;padding:40px 24px}.masthead{padding:28px 32px;background:#173b31;color:#fff;border-radius:14px}.brand{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#c6ddd2}.masthead h1{margin:8px 0;font-size:clamp(24px,5vw,38px);line-height:1.15}.masthead p{margin:0;color:#d6e5de}.summary{display:flex;justify-content:space-between;gap:16px;margin:18px 0 26px;padding:18px 22px;background:#fff;border:1px solid #dce3df;border-radius:10px}.summary strong{font-size:24px;color:#173b31}.summary small{display:block;color:#637169}.repair-proof{break-inside:avoid;margin:18px 0;padding:24px;background:#fff;border:1px solid #dce3df;border-radius:12px;box-shadow:0 4px 14px #1e26220b}.repair-proof header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid #e6ebe8}.repair-proof header time{color:#52635a;font-size:13px}.eyebrow{margin:0;color:#527669;font-size:10px;font-weight:bold;letter-spacing:.14em}.repair-proof h2{margin:3px 0;font-size:21px}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:18px 0}.facts div{min-width:0}.facts span,.facts small{display:block;color:#647269;font-size:12px}.facts strong{display:block;margin-top:3px;overflow-wrap:anywhere}.concern,.proof-notes{margin-top:18px}.concern h3,.proof-notes h3{margin:0 0 8px;font-size:14px}.concern p,.proof-notes li p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.proof-notes ol{display:grid;gap:9px;margin:0;padding:0;list-style:none}.proof-notes li{padding:12px 14px;background:#f5f7f5;border-radius:8px}.note-meta{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px;color:#637169;font-size:12px}.note-meta strong{color:#33473c}.empty-note{color:#637169;font-style:italic}.actions{display:flex;justify-content:flex-end;margin:18px 0}.print-button{padding:10px 15px;border:0;border-radius:6px;background:#173b31;color:white;font-weight:bold;cursor:pointer}@media(max-width:560px){.report{padding:18px 12px}.masthead{padding:22px}.repair-proof{padding:18px}.facts{grid-template-columns:1fr}.summary{align-items:flex-start;flex-direction:column}}@media print{body{background:#fff}.report{max-width:none;padding:0}.masthead{background:#173b31!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.repair-proof{box-shadow:none;border-color:#ccd5d0}.actions{display:none}.repair-proof{page-break-inside:avoid}}
</style></head><body><main class="report">
<header class="masthead"><p class="brand">R&amp;D Cellphone Repair</p><h1>Service Completion Proof Report</h1><p>Completed customer repairs with service details and owner-recorded proof notes.</p></header>
<section class="summary"><div><strong>${records.length}</strong><small>completed repair records</small></div><div><strong>${escapeReportHtml(generatedAt)}</strong><small>report generated · Philippine time</small></div></section>
<div class="actions"><button class="print-button" type="button" onclick="window.print()">Print / Save as PDF</button></div>
${reportItems}
<footer><small>Private owner business record · Generated from the connected Supabase project.</small></footer>
</main></body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `repair-completion-proofs-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloaded the report containing ${records.length} completion proofs.`);
      return true;
    };

    const renderModuleShell = (moduleKey) => {
      const definition = moduleDefinitions[moduleKey];
      const view = makeElement("section", "admin-view module-view");
      view.dataset.adminView = moduleKey;
      view.setAttribute("aria-labelledby", "module-title");
      view.append(makeHeading(definition));
      if (moduleKey === "settings") {
        view.append(
          renderSettings(),
          makeElement(
            "p",
            "view-footnote",
            isProduction()
              ? "Settings are stored in Supabase and are visible to the public website only where explicitly connected."
              : "Preview settings are not saved.",
          ),
        );
      } else {
        view.append(makeDataPanel(definition));
        if (moduleKey === "notes") view.append(createCompletionProofPanel());
        if (moduleKey === "repairs" || moduleKey === "notes") {
          const detail = makeElement("section", "panel repair-detail-panel");
          detail.dataset.repairDetails = "true";
          detail.hidden = true;
          detail.setAttribute("aria-labelledby", "repair-detail-title");
          const title = makeElement("h2", "", "Repair details");
          title.id = "repair-detail-title";
          const workLog = makeElement("section", "work-log");
          workLog.dataset.workLog = "true";
          detail.append(
            title,
            makeElement("div", "repair-detail-content"),
            workLog,
          );
          view.append(detail);
        }
        view.append(
          makeElement(
            "p",
            "view-footnote",
            isProduction()
              ? "Records shown here are read from the connected Supabase project. Customer and activity records remain read-only."
              : "All displayed records are isolated demo fixtures. No real customer data or operations are connected.",
          ),
        );
      }
      return view;
    };

    const renderFilteredTable = (moduleKey) => {
      const definition = moduleDefinitions[moduleKey];
      const panel = host.querySelector(
        `[data-admin-view="${moduleKey}"] .module-panel`,
      );
      if (!panel) return;
      const filtered = activeRecords;
      const hasFilters = Boolean(getQueryState(moduleKey).search) ||
        Object.values(getQueryState(moduleKey).filters).some(
          (value) => value && value !== "all",
        );
      panel.querySelector('[data-module-state="loading"]').hidden = true;
      panel.querySelector('[data-module-state="error"]').hidden = true;
      panel.querySelector('[data-module-state="empty"]').hidden =
        activeTotal > 0 || hasFilters;
      panel.querySelector('[data-module-state="no-results"]').hidden =
        activeTotal > 0 || !hasFilters;
      panel.querySelector("#module-record-count").textContent =
        activeTotal
          ? `Showing ${activePage * 25 + 1}-${activePage * 25 + filtered.length} of ${activeTotal} ${definition.title.toLowerCase()} records`
          : `0 ${definition.title.toLowerCase()} records`;
      const tableHost = panel.querySelector(".module-table-host");
      tableHost.replaceChildren();
      if (filtered.length)
        tableHost.append(
          moduleKey === "notifications"
            ? createNotificationList(filtered)
            : createTable(definition, filtered),
        );
      const pagination = panel.querySelector("[data-module-pagination]");
      pagination.replaceChildren();
      if (activeTotal > 25) {
        const previous = makeElement("button", "admin-button", "Previous");
        previous.type = "button";
        previous.dataset.pageChange = String(activePage - 1);
        previous.disabled = activePage === 0;
        const next = makeElement("button", "admin-button", "Next");
        next.type = "button";
        next.dataset.pageChange = String(activePage + 1);
        next.disabled = (activePage + 1) * 25 >= activeTotal;
        pagination.append(previous, next);
      }
    };

    const renderWorkNotes = (record, hostElement) => {
      hostElement.replaceChildren();
      const heading = makeElement("h3", "", "Work log & proof notes");
      const privacy = makeElement(
        "p",
        "work-log__privacy",
        "Owner-only record. These notes are not shown to the customer.",
      );
      const list = makeElement("ol", "work-log__entries");
      (record.workNotes || []).forEach((entry) => {
        const item = makeElement("li", "work-log__entry");
        const meta = makeElement("div", "work-log__meta");
        meta.append(
          makeElement("strong", "", entry.author || "Owner"),
          makeElement(
            "time",
            "",
            formatValue("createdAt", entry.createdAt),
          ),
        );
        item.append(meta, makeElement("p", "", entry.note));
        list.append(item);
      });
      if (!list.childElementCount)
        list.append(
          makeElement(
            "li",
            "work-log__empty",
            "No work notes yet. Record what was repaired, parts used, and final checks performed.",
          ),
        );

      const form = document.createElement("form");
      form.className = "work-log__form";
      form.dataset.workNoteForm = "true";
      form.dataset.repairId = record.id;
      const label = makeElement(
        "label",
        "work-log__label",
        "Add a service work note",
      );
      const input = document.createElement("textarea");
      input.name = "note";
      input.rows = 3;
      input.maxLength = 8000;
      input.required = true;
      input.placeholder =
        "Work performed, parts replaced, tests completed, and any follow-up needed…";
      label.append(input);
      const actions = makeElement("div", "work-log__actions");
      const submit = makeElement(
        "button",
        "admin-button admin-button--primary",
        "Save work note",
      );
      submit.type = "submit";
      const status = makeElement("span", "work-log__status");
      status.dataset.workNoteStatus = "true";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      actions.append(submit, status);
      form.append(label, actions);
      hostElement.append(heading, privacy, list, form);
    };

    const saveWorkNote = async (form) => {
      const repairId = form.dataset.repairId;
      const record = activeRecords.find((item) => item.id === repairId);
      const input = form.elements.note;
      const submit = form.querySelector('[type="submit"]');
      const status = form.querySelector("[data-work-note-status]");
      const note = input.value.trim();
      if (!record || !form.reportValidity()) return;
      if (!note) {
        status.textContent = "Add a work note before saving.";
        input.focus();
        return;
      }
      submit.disabled = true;
      status.textContent = "Saving work note…";
      try {
        const saved = await window.AdminDataAdapter.addInternalNote(
          repairId,
          note,
          currentUserId,
        );
        record.workNotes = [
          ...(record.workNotes || []),
          {
            note,
            createdAt: saved.created_at || new Date().toISOString(),
            author: "Owner",
          },
        ];
        record.internalNotes = [...(record.internalNotes ? [record.internalNotes] : []), note].join("\n");
        renderWorkNotes(
          record,
          host.querySelector("[data-work-log]"),
        );
        showToast("Work note saved to the repair record.");
      } catch (error) {
        console.error("Repair work note save failed:", error);
        status.textContent = error.message || "Work note could not be saved.";
        submit.disabled = false;
      }
    };

    const renderOverview = (overview) => {
      const view = host.querySelector('[data-admin-view="overview"]');
      const metrics = makeElement("section", "metric-grid");
      const production = overview.mode === "production";
      metrics.setAttribute(
        "aria-label",
        production ? "Repair metrics" : "Demo repair metrics",
      );
      const metricDefinitions = [
        ["Open requests", overview.metrics.open],
        ["Awaiting approval", overview.metrics.awaitingApproval],
        ["In progress", overview.metrics.inProgress],
        ["Ready for pickup", overview.metrics.readyForPickup],
      ];
      metricDefinitions.forEach(([label, value]) => {
        const item = makeElement("article", "metric-item");
        item.append(
          makeElement("p", "metric-item__label", label),
          makeElement(
            "p",
            "metric-item__value",
            String(value).padStart(2, "0"),
          ),
          makeElement(
            "p",
            "metric-item__note",
            production ? "Live request count" : "Demo fixture count",
          ),
        );
        metrics.append(item);
      });
      const grid = makeElement("div", "overview-grid");
      const recentPanel = makeElement("section", "panel");
      const panelHeading = makeElement("div", "panel-heading");
      const titleGroup = document.createElement("div");
      titleGroup.append(
        makeElement(
          "p",
          "panel-eyebrow",
          production ? "LATEST RECORDS" : "DEMO FIXTURES",
        ),
        makeElement("h2", "", "Recent repair requests"),
      );
      const viewAll = makeElement(
        "button",
        "inline-action",
        "View all repairs",
      );
      viewAll.type = "button";
      viewAll.dataset.viewTarget = "repairs";
      panelHeading.append(titleGroup, viewAll);
      recentPanel.append(
        panelHeading,
        makeElement(
          "p",
          "panel-note",
          production
            ? "The latest repair requests in your shop."
            : "Synthetic records only; no customer data is connected.",
        ),
      );
      recentPanel.append(
        createTable(moduleDefinitions.repairs, overview.repairs, false),
      );
      const activityPanel = makeElement("section", "panel");
      activityPanel.append(
        makeElement(
          "p",
          "panel-eyebrow",
          production ? "AUDIT TRAIL" : "DEMO FIXTURES",
        ),
        makeElement("h2", "", "Recent activity"),
        makeElement(
          "p",
          "panel-note",
          production
            ? overview.activity.length
              ? "Recent owner and system actions."
              : "No activity has been recorded yet."
            : "No real activity has been performed.",
        ),
      );
      const list = makeElement("ol", "activity-list");
      overview.activity.slice(0, 5).forEach((record) => {
        const item = document.createElement("li");
        item.append(makeElement("span", "activity-marker"));
        const copy = document.createElement("div");
        copy.append(
          makeElement("p", "", `${record.action} · ${record.actor}`),
          makeElement("time", "", formatValue("createdAt", record.createdAt)),
        );
        item.append(copy);
        list.append(item);
      });
      activityPanel.append(list);
      grid.append(recentPanel, activityPanel);
      view.replaceChildren(
        makeHeading(moduleDefinitions.overview),
        metrics,
        grid,
        makeElement(
          "p",
          "view-footnote",
          production
            ? "Overview values are loaded from the connected Supabase project."
            : "All values are derived from synthetic demo fixtures and are not shop records.",
        ),
      );
    };

    let moduleLoadId = 0;
    const loadModule = async (moduleKey, page = 0) => {
      const definition = moduleDefinitions[moduleKey];
      if (!definition) return;
      const loadId = ++moduleLoadId;
      window.clearTimeout(searchTimer);
      const isNewModule =
        activeModule !== moduleKey ||
        !host.querySelector(`[data-admin-view="${moduleKey}"]`);
      activeModule = moduleKey;
      activePage = Math.max(0, page);
      activeRecords = [];
      activeTotal = 0;
      setSidebarOpen(false);
      navItems.forEach((item) => {
        const isActive = item.dataset.viewTarget === moduleKey;
        item.classList.toggle("is-active", isActive);
        if (isActive) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
      breadcrumb.textContent = definition.title;
      if (isNewModule) host.replaceChildren(renderModuleShell(moduleKey));
      host.setAttribute("aria-busy", "true");
      const panel = host.querySelector(".module-panel");
      panel?.querySelector('[data-module-state="loading"]')?.removeAttribute("hidden");
      panel?.querySelector('[data-module-state="error"]')?.setAttribute("hidden", "");
      try {
        if (moduleKey === "overview") {
          const overview = await window.AdminDataAdapter.overview();
          if (loadId !== moduleLoadId) return;
          renderOverview(overview);
        } else if (moduleKey === "settings") {
          const settings = isProduction()
            ? await window.AdminDataAdapter.getSettings()
            : null;
          if (loadId !== moduleLoadId) return;
          const view = host.querySelector('[data-admin-view="settings"]');
          view.replaceChildren(
            makeHeading(definition),
            renderSettings(settings),
            makeElement(
              "p",
              "view-footnote",
              "Settings are available only to the verified owner account.",
            ),
          );
        } else {
          const queryState = getQueryState(moduleKey);
          const result = await window.AdminDataAdapter.list(
            definition.collection,
            {
              page: activePage,
              pageSize: 25,
              search: queryState.search,
              filters: queryState.filters,
            },
          );
          if (loadId !== moduleLoadId) return;
          if (result.mode !== window.AdminDataAdapter.mode)
            throw new Error("Unexpected data source mode.");
          activeRecords = result.records;
          activeTotal = result.total;
          renderFilteredTable(moduleKey);
          if (moduleKey === "notes") {
            try {
              const proofs = await window.AdminDataAdapter.listCompletionProofs();
              if (loadId !== moduleLoadId) return;
              renderCompletionProofPanel(proofs);
            } catch (error) {
              if (loadId !== moduleLoadId) return;
              console.error("Completion proof report could not be loaded:", error);
              renderCompletionProofPanel(null, error);
            }
          }
        }
      } catch (error) {
        if (loadId !== moduleLoadId) return;
        console.error("Admin module load failed:", error);
        const currentPanel = host.querySelector(".module-panel");
        const errorState = currentPanel?.querySelector('[data-module-state="error"]');
        if (currentPanel && errorState) {
          currentPanel.querySelector('[data-module-state="loading"]').hidden = true;
          errorState.replaceChildren(makeElement("p", "", error.message));
          const retry = makeElement("button", "admin-button", "Retry loading");
          retry.type = "button";
          retry.dataset.retryModule = moduleKey;
          errorState.append(retry);
          errorState.hidden = false;
        } else {
          host.replaceChildren(
            makeElement(
              "p",
              "module-state module-state--error",
              error.message || "Dashboard data could not be loaded.",
            ),
          );
        }
      } finally {
        if (loadId === moduleLoadId) host.setAttribute("aria-busy", "false");
      }
    };

    const addEditorField = (
      form,
      { key, label, value = "", type = "text", required = false, rows },
    ) => {
      const wrapper = makeElement("label", "editor-field");
      wrapper.append(makeElement("span", "", label));
      const input = rows
        ? document.createElement("textarea")
        : document.createElement("input");
      input.name = key;
      if (!rows) input.type = type;
      if (rows) input.rows = rows;
      input.value = value ?? "";
      input.required = required;
      wrapper.append(input);
      form.append(wrapper);
      return input;
    };

    const addEditorSelect = (form, { key, label, options, value }) => {
      const wrapper = makeElement("label", "editor-field");
      wrapper.append(makeElement("span", "", label));
      const select = document.createElement("select");
      select.name = key;
      options.forEach(([optionValue, optionLabel]) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel;
        option.selected = String(optionValue) === String(value ?? "");
        select.append(option);
      });
      wrapper.append(select);
      form.append(wrapper);
      return select;
    };

    const openEditor = async (moduleKey, record = null) => {
      if (!isProduction()) return;
      const definition = moduleDefinitions[moduleKey];
      const dialog = document.createElement("dialog");
      dialog.className = "record-editor";
      const form = document.createElement("form");
      form.className = "record-editor__form";
      form.noValidate = false;
      const entityName = {
        repairs: "repair request",
        services: "service",
        notebook: "notebook entry",
      }[moduleKey];
      const title = makeElement(
        "h2",
        "",
        `${record ? "Edit" : "Create"} ${entityName}`,
      );
      const fields = makeElement("div", "record-editor__fields");
      const status = makeElement("p", "form-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      let services = [];

      if (moduleKey === "repairs") {
        const result = await window.AdminDataAdapter.list("services", {
          pageSize: 100,
          filters: moduleKey === "repairs" ? { status: "active" } : {},
        });
        services = result.records;
      }

      if (moduleKey === "repairs") {
        [
          ["customer_name", "Customer name", "customerName", "text", true],
          ["customer_email", "Email", "customerEmail", "email", false],
          ["customer_phone", "Phone", "customerPhone", "tel", false],
          ["device_type", "Device type", "deviceType", "text", true],
          ["brand", "Brand", "brand", "text", true],
          ["model", "Model", "model", "text", true],
          ["reported_issue", "Reported issue", "reportedIssue", "text", true],
        ].forEach(([key, label, source, type, required]) =>
          addEditorField(fields, {
            key,
            label,
            type,
            required,
            value: record?.[source] || "",
            rows: key === "reported_issue" ? 4 : undefined,
          }),
        );
        addEditorSelect(fields, {
          key: "service_id",
          label: "Service",
          options: [
            ["", "Other / not listed"],
            ...services.map((service) => [service.id, service.name]),
          ],
          value: record?.serviceId || "",
        });
        if (record) {
          addEditorSelect(fields, {
            key: "status",
            label: "Repair status",
            options: [
              "submitted",
              "inspecting",
              "awaiting_approval",
              "approved",
              "in_progress",
              "ready_for_pickup",
              "completed",
              "cancelled",
            ].map((value) => [value, formatValue("status", value)]),
            value: record.status,
          });
          addEditorSelect(fields, {
            key: "priority",
            label: "Priority",
            options: ["low", "normal", "high", "urgent"].map((value) => [
              value,
              formatValue("priority", value),
            ]),
            value: record.priority,
          });
          addEditorField(fields, {
            key: "customer_visible_note",
            label: "Customer-visible update",
            value: record.customerVisibleNotes,
            rows: 3,
          });
          addEditorField(fields, {
            key: "internal_note",
            label: "Add private work note",
            rows: 3,
          });
        }
      } else if (moduleKey === "services") {
        addEditorField(fields, {
          key: "name",
          label: "Service name",
          value: record?.name,
          required: true,
        });
        addEditorField(fields, {
          key: "slug",
          label: "URL slug",
          value: record?.slug,
          required: true,
        });
        addEditorField(fields, {
          key: "category",
          label: "Category",
          value: record?.category,
          required: true,
        });
        addEditorField(fields, {
          key: "description",
          label: "Description",
          value: record?.description,
          rows: 4,
        });
        addEditorSelect(fields, {
          key: "status",
          label: "Visibility",
          options: ["active", "draft", "inactive"].map((value) => [
            value,
            formatValue("status", value),
          ]),
          value: record?.status || "active",
        });
        addEditorField(fields, {
          key: "sort_order",
          label: "Display order",
          type: "number",
          value: record?.sortOrder ?? 0,
        });
      } else if (moduleKey === "notebook") {
        const clientNameInput = addEditorField(fields, {
          key: "client_name",
          label: "Client name",
          value: record?.clientName || "",
          required: true,
        });
        clientNameInput.maxLength = 160;
        const clientPhoneInput = addEditorField(fields, {
          key: "client_phone",
          label: "Client phone (optional)",
          type: "tel",
          value: record?.clientPhone || "",
        });
        clientPhoneInput.maxLength = 80;
        const clientEmailInput = addEditorField(fields, {
          key: "client_email",
          label: "Client email (optional)",
          type: "email",
          value: record?.clientEmail || "",
        });
        clientEmailInput.maxLength = 320;
        addEditorSelect(fields, {
          key: "entry_type",
          label: "Notebook tab",
          options: [
            ["purchase", "Purchase / item sold"],
            ["repair", "Repair / service"],
            ["other", "Other client note"],
          ],
          value:
            record?.entryType ||
            (getQueryState("notebook").filters.entryType === "all"
              ? "purchase"
              : getQueryState("notebook").filters.entryType),
        });
        const titleInput = addEditorField(fields, {
          key: "title",
          label: "Item or service",
          value: record?.title || "",
          required: true,
        });
        titleInput.maxLength = 200;
        const detailsInput = addEditorField(fields, {
          key: "details",
          label: "Notes",
          value: record?.details || "",
          rows: 5,
        });
        detailsInput.maxLength = 8000;
        const amountInput = addEditorField(fields, {
          key: "amount",
          label: "Amount paid (PHP, optional)",
          type: "number",
          value: record?.amount ?? "",
        });
        amountInput.min = "0";
        amountInput.max = "99999999.99";
        amountInput.step = "0.01";
        const localToday = new Date();
        localToday.setMinutes(
          localToday.getMinutes() - localToday.getTimezoneOffset(),
        );
        addEditorField(fields, {
          key: "entry_date",
          label: "Date",
          type: "date",
          value: record?.entryDate || localToday.toISOString().slice(0, 10),
          required: true,
        });
      }

      const actions = makeElement("div", "record-editor__actions");
      const cancel = makeElement("button", "admin-button", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", () => dialog.close());
      const save = makeElement(
        "button",
        "admin-button admin-button--primary",
        "Save",
      );
      save.type = "submit";
      actions.append(cancel, save);
      form.append(title, fields, status, actions);
      dialog.append(form);
      document.body.append(dialog);
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form));
        save.disabled = true;
        status.textContent = "Saving…";
        try {
          if (moduleKey === "repairs") {
            if (!values.customer_email.trim() && !values.customer_phone.trim()) {
              status.textContent =
                "Enter at least one customer contact method: email or phone.";
              save.disabled = false;
              return;
            }
            const selectedService = services.find(
              (service) => service.id === values.service_id,
            );
            const payload = {
              customer_name: values.customer_name.trim(),
              customer_email: values.customer_email.trim() || null,
              customer_phone: values.customer_phone.trim() || null,
              device_type: values.device_type.trim(),
              brand: values.brand.trim(),
              model: values.model.trim(),
              reported_issue: values.reported_issue.trim(),
              service_id: values.service_id || null,
              service_name_snapshot:
                selectedService?.name || "Other / not listed",
            };
            if (record) {
              payload.status = values.status;
              payload.priority = values.priority;
              payload.customer_visible_note =
                values.customer_visible_note.trim() || null;
              await window.AdminDataAdapter.updateRepair(record.id, payload);
              if (values.internal_note.trim()) {
                try {
                  await window.AdminDataAdapter.addInternalNote(
                    record.id,
                    values.internal_note.trim(),
                    currentUserId,
                  );
                } catch {
                  status.textContent =
                    "Repair saved, but the internal note could not be saved. Try adding the note again.";
                  save.disabled = false;
                  return;
                }
              }
            } else {
              await window.AdminDataAdapter.createRepair(payload);
            }
          } else if (moduleKey === "services") {
            const payload = {
              name: values.name.trim(),
              slug: values.slug.trim().toLowerCase(),
              category: values.category.trim(),
              description: values.description.trim(),
              status: values.status,
              sort_order: Number(values.sort_order) || 0,
            };
            if (record)
              await window.AdminDataAdapter.updateService(record.id, payload);
            else await window.AdminDataAdapter.createService(payload);
          } else if (moduleKey === "notebook") {
            const amount = values.amount.trim();
            const payload = {
              client_name: values.client_name.trim(),
              client_phone: values.client_phone.trim() || null,
              client_email: values.client_email.trim() || null,
              entry_type: values.entry_type,
              title: values.title.trim(),
              details: values.details.trim() || null,
              amount: amount ? Number(amount) : null,
              entry_date: values.entry_date,
            };
            if (amount && (!Number.isFinite(payload.amount) || payload.amount < 0)) {
              status.textContent = "Enter a valid amount of 0 or more.";
              save.disabled = false;
              return;
            }
            if (record)
              await window.AdminDataAdapter.updateNotebookEntry(record.id, payload);
            else await window.AdminDataAdapter.createNotebookEntry(payload);
          }
          dialog.close();
          if (moduleKey === "notebook")
            showToast(
              record ? "Notebook entry updated." : "Notebook entry added.",
            );
          await loadModule(moduleKey, activePage);
        } catch (error) {
          console.error("Admin record save failed:", error);
          status.textContent = error.message || "The record could not be saved.";
          save.disabled = false;
        }
      });
      dialog.showModal();
    };

    const saveSettingsForm = async (form) => {
      const status = form.querySelector("[data-settings-status]");
      const save = form.querySelector('[type="submit"]');
      const values = new FormData(form);
      save.disabled = true;
      status.textContent = "Saving settings…";
      try {
        const publicEmails = String(values.get("public_email") || "")
          .split(/[\n;,]+/)
          .map((email) => email.trim())
          .filter(Boolean);
        const invalidEmail = publicEmails.find(
          (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        );
        if (invalidEmail) {
          throw new Error(`Enter a valid contact email address: ${invalidEmail}`);
        }
        await window.AdminDataAdapter.saveSettings({
          business_name: String(values.get("business_name") || "").trim(),
          public_phone:
            String(values.get("public_phone") || "").trim() || null,
          public_email:
            publicEmails.join("\n") || null,
          public_address:
            String(values.get("public_address") || "").trim() || null,
          business_hours:
            String(values.get("business_hours") || "").trim() || null,
          notification_preferences: {
            email_repairs: values.has("email_repairs"),
            email_activity: values.has("email_activity"),
          },
          updated_by: currentUserId,
        });
        try {
          localStorage.setItem(
            "rd-business-profile-updated",
            String(Date.now()),
          );
        } catch (error) {
          console.warn("Could not notify open public pages:", error);
        }
        status.textContent =
          "Settings saved. Open public pages are being updated.";
        save.disabled = false;
        showToast("Business profile saved and published to the website.");
      } catch (error) {
        console.error("Business settings save failed:", error);
        status.textContent = error.message || "Settings could not be saved.";
        showToast(status.textContent, "error");
        save.disabled = false;
      }
    };

    navItems.forEach((item) =>
      item.addEventListener("click", () => loadModule(item.dataset.viewTarget)),
    );
    sidebarToggle.addEventListener("click", () =>
      setSidebarOpen(adminPage.dataset.sidebarOpen !== "true"),
    );
    sidebarBackdrop.addEventListener("click", () => {
      setSidebarOpen(false);
      sidebarToggle.focus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && adminPage.dataset.sidebarOpen === "true") {
        setSidebarOpen(false);
        sidebarToggle.focus();
      }
    });
    host.addEventListener("input", () => {
      if (activeModule !== "overview" && activeModule !== "settings") {
        getQueryState(activeModule).search =
          host.querySelector("[data-module-search]")?.value || "";
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(
          () => loadModule(activeModule, 0),
          250,
        );
      }
    });
    host.addEventListener("change", () => {
      if (activeModule !== "overview" && activeModule !== "settings") {
        const filters = getQueryState(activeModule).filters;
        host.querySelectorAll("[data-module-filter]").forEach((select) => {
          filters[select.dataset.moduleFilter] = select.value;
        });
        loadModule(activeModule, 0);
      }
    });
    host.addEventListener("submit", (event) => {
      const settingsForm = event.target.closest("[data-settings-form]");
      if (settingsForm) {
        event.preventDefault();
        saveSettingsForm(settingsForm);
        return;
      }
      const workNoteForm = event.target.closest("[data-work-note-form]");
      if (workNoteForm) {
        event.preventDefault();
        saveWorkNote(workNoteForm);
      }
    });
    host.addEventListener("click", (event) => {
      const downloadProofs = event.target.closest(
        "[data-download-completion-proofs]",
      );
      if (downloadProofs && activeModule === "notes") {
        if (downloadCompletionProofReport(completionProofRecords)) {
          downloadedCompletionBatchIds = [
            ...new Set(
              completionProofRecords
                .map((proof) => proof.batch_id)
                .filter(Boolean),
            ),
          ];
          const authorize = host.querySelector(
            "[data-authorize-completion-cleanup]",
          );
          if (authorize && downloadedCompletionBatchIds.length) {
            authorize.hidden = false;
            authorize.disabled = false;
            showToast(
              "Report downloaded. Review and save it, then approve cleanup to allow eligible records to be deleted.",
            );
          }
        }
        return;
      }
      const authorizeCleanup = event.target.closest(
        "[data-authorize-completion-cleanup]",
      );
      if (authorizeCleanup && activeModule === "notes") {
        if (
          !downloadedCompletionBatchIds.length ||
          !window.confirm(
            "Confirm you saved the downloaded report. This approves deletion of these 10-record batches after each repair has been completed for at least 2 days. Owner work notes and status history will remain.",
          )
        )
          return;
        authorizeCleanup.disabled = true;
        authorizeCleanup.textContent = "Approving cleanup…";
        window.AdminDataAdapter.authorizeCompletionProofCleanup(
          downloadedCompletionBatchIds,
        )
          .then(() => {
            downloadedCompletionBatchIds = [];
            showToast(
              "Report saved and cleanup approved. Requests and photos will be removed only after their 2-day retention period.",
            );
            return loadModule("notes", activePage);
          })
          .catch((error) => {
            console.error("Completion cleanup authorization failed:", error);
            showToast(
              error.message ||
                "Cleanup could not be approved. The records have not been deleted.",
              "error",
            );
            authorizeCleanup.disabled = false;
            authorizeCleanup.textContent =
              "I saved the report — approve cleanup";
          });
        return;
      }
      const navigation = event.target.closest("[data-view-target]");
      if (navigation) {
        loadModule(navigation.dataset.viewTarget);
        return;
      }
      const retry = event.target.closest("[data-retry-module]");
      if (retry) {
        loadModule(retry.dataset.retryModule);
        return;
      }
      const pageChange = event.target.closest("[data-page-change]");
      if (pageChange) {
        loadModule(activeModule, Number(pageChange.dataset.pageChange));
        return;
      }
      const notebookTab = event.target.closest("[data-notebook-tab]");
      if (notebookTab && activeModule === "notebook") {
        getQueryState("notebook").filters.entryType =
          notebookTab.dataset.notebookTab;
        host.querySelectorAll("[data-notebook-tab]").forEach((tab) => {
          tab.setAttribute(
            "aria-pressed",
            String(tab === notebookTab),
          );
        });
        loadModule("notebook", 0);
        return;
      }
      const notebookAction = event.target.closest("[data-notebook-action]");
      if (notebookAction && activeModule === "notebook") {
        const record = activeRecords.find(
          (item) => item.id === notebookAction.dataset.recordId,
        );
        if (!record) return;
        if (notebookAction.dataset.notebookAction === "edit") {
          openEditor("notebook", record).catch((error) => {
            console.error("Could not open notebook entry:", error);
            showToast(error.message || "The notebook entry could not be opened.", "error");
          });
        } else if (
          notebookAction.dataset.notebookAction === "delete" &&
          window.confirm(
            `Delete the notebook entry for ${record.clientName} (${record.title})? This cannot be undone.`,
          )
        ) {
          notebookAction.disabled = true;
          notebookAction.textContent = "Deleting…";
          window.AdminDataAdapter.deleteNotebookEntry(record.id)
            .then(() => {
              showToast("Notebook entry deleted.");
              return loadModule("notebook", activePage);
            })
            .catch((error) => {
              console.error("Notebook entry delete failed:", error);
              showToast(
                error.message || "The notebook entry could not be deleted.",
                "error",
              );
              notebookAction.disabled = false;
              notebookAction.textContent = "Delete";
            });
        }
        return;
      }
      const createRecord = event.target.closest("[data-create-record]");
      if (createRecord) {
        openEditor(createRecord.dataset.createRecord).catch((error) => {
          console.error("Could not open record editor:", error);
          showToast(error.message || "The editor could not be opened.", "error");
        });
        return;
      }
      const recordAction = event.target.closest("[data-record-action]");
      if (recordAction?.dataset.recordAction === "complete-repair") {
        const record = activeRecords.find(
          (item) => item.id === recordAction.dataset.recordId,
        );
        if (
          !record ||
          ["completed", "cancelled"].includes(record.status) ||
          !window.confirm(
            `Mark repair ${record.reference} as done? The customer will see this update in their repair dashboard.`,
          )
        )
          return;
        recordAction.disabled = true;
        recordAction.textContent = "Saving…";
        window.AdminDataAdapter.updateRepair(record.id, {
          status: "completed",
          customer_visible_note:
            "Your repair is complete. Please contact the shop to arrange pickup.",
        })
          .then(async () => {
            showToast(
              `Repair ${record.reference} marked done. The customer dashboard will show the completed status.`,
            );
            try {
              const proofCount =
                await window.AdminDataAdapter.getCompletionProofCount();
              if (proofCount >= 10 && proofCount % 10 === 0)
                showToast(
                  `Milestone reached: ${proofCount} repairs are completed. Open Completed Notes to download the proof report.`,
                );
            } catch (error) {
              console.error(
                "Repair was marked done, but the proof milestone could not be checked:",
                error,
              );
              showToast(
                "Repair marked done, but the proof report status could not be refreshed.",
                "error",
              );
            }
            return loadModule(activeModule, activePage);
          })
          .catch((error) => {
            console.error("Repair completion update failed:", error);
            showToast(
              error.message || "The repair could not be marked done.",
              "error",
            );
            recordAction.disabled = false;
            recordAction.textContent = "Mark as done";
          });
        return;
      }
      if (recordAction?.dataset.recordAction === "mark-read") {
        recordAction.disabled = true;
        window.AdminDataAdapter.markNotificationRead(
          recordAction.dataset.recordId,
        )
          .then(() => loadModule(activeModule, activePage))
          .then(() => showToast("Notification marked as read."))
          .catch((error) => {
            console.error("Notification update failed:", error);
            showToast(
              error.message || "Notification could not be updated.",
              "error",
            );
            recordAction.disabled = false;
          });
        return;
      }
      if (recordAction?.dataset.recordAction === "edit") {
        const record = activeRecords.find(
          (item) => item.id === recordAction.dataset.recordId,
        );
        if (record)
          openEditor(activeModule, record).catch((error) => {
            console.error("Could not open record editor:", error);
            showToast(error.message || "The editor could not be opened.", "error");
          });
        return;
      }
      const detailAction = event.target.closest(
        '[data-record-action="details"]',
      );
      if (!detailAction) return;
      const record = activeRecords.find(
        (item) => item.id === detailAction.dataset.recordId,
      );
      if (record) renderRepairDetails(record);
    });

    const accessGate = document.querySelector("#admin-access-gate");
    const accessTitle = document.querySelector("#admin-access-title");
    const accessMessage = document.querySelector("#admin-access-message");
    const accessLogin = document.querySelector("#admin-access-login");
    const adminLayout = document.querySelector("#admin-layout");
    const adminContext = document.querySelector("#admin-context-label");
    const authModeStatus = document.querySelector("#auth-mode-status");
    const previewWarning = document.querySelector("#preview-warning");
    const skipLink = document.querySelector("#admin-skip-link");
    const signoutButtons = document.querySelectorAll("#admin-signout");

    signoutButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const client = await window.AdminSupabaseClient.get();
          const { error } = await client.auth.signOut();
          if (error) throw error;
          window.location.replace(new URL("./login/", window.location.href));
        } catch (error) {
          console.error("Owner sign-out failed:", error);
          showToast("Sign-out failed. Please try again.", "error");
          button.disabled = false;
        }
      });
    });

    const showAccessMessage = (title, message) => {
      accessTitle.textContent = title;
      accessMessage.textContent = message;
      accessLogin.hidden = false;
      adminPage.dataset.adminState = "unauthorized";
    };

    const showDashboard = (mode, userId = null) => {
      currentUserId = userId;
      accessGate.hidden = true;
      adminLayout.hidden = false;
      adminPage.dataset.adminState = mode;
      adminContext.textContent =
        mode === "preview" ? "Preview data only" : "Owner workspace";
      authModeStatus.replaceChildren(
        authModeStatus.querySelector(".status-dot"),
        mode === "preview" ? " Preview data only" : " Owner access verified",
      );
      previewWarning.hidden = mode !== "preview";
      signoutButtons.forEach((button) => {
        button.hidden = mode !== "authorized";
      });
      skipLink.href = "#admin-main";
      loadModule("overview");
    };

    const supabaseConfig = window.AdminSupabaseClient;
    if (supabaseConfig?.isPreview()) {
      showDashboard("preview");
      return;
    }

    if (!supabaseConfig?.isConfigured()) {
      showAccessMessage(
        "Admin setup required",
        "Supabase is not configured. Sign-in is unavailable until project settings are supplied.",
      );
      return;
    }

    supabaseConfig
      .get()
      .then(async (client) => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        const user = data.session?.user;
        if (!user) {
          showAccessMessage(
            "Owner sign in required",
            "No active session was found. Sign in with the owner account to continue.",
          );
          return;
        }

        const isOwner = await window.AdminDataAdapter.isOwner(user.id);
        if (!isOwner) {
          await client.auth.signOut();
          showAccessMessage(
            "Owner access required",
            "This account is not provisioned for owner access. Sign in with the authorized owner account.",
          );
          return;
        }
        showDashboard("authorized", user.id);
      })
      .catch((error) => {
        console.error("Owner access verification failed:", error);
        showAccessMessage(
          "Unable to verify access",
          "Supabase access could not be verified. Check the connection and sign in again.",
        );
      });
  });
})();
