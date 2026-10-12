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
        "A snapshot of the repair workflow using isolated demo records.",
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
      cta: "Add customer",
    },
    posts: {
      title: "Repair Posts / Showcase",
      description: "Prepare repair documentation for a future public showcase.",
      collection: "posts",
      search: ["title", "serviceName"],
      filters: [
        {
          key: "status",
          label: "Post status",
          options: ["draft", "published", "archived"],
        },
      ],
      columns: [
        ["title", "Post title"],
        ["serviceName", "Related service"],
        ["mediaCount", "Media items"],
        ["status", "Status"],
        ["updatedAt", "Updated"],
      ],
      cta: "Create post",
    },
    comments: {
      title: "Comments & Moderation",
      description: "Review incoming comments and their moderation state.",
      collection: "comments",
      search: ["postTitle", "authorName", "body"],
      filters: [
        {
          key: "status",
          label: "Moderation status",
          options: ["pending", "approved", "rejected", "hidden"],
        },
      ],
      columns: [
        ["postTitle", "Post"],
        ["authorName", "Author"],
        ["body", "Comment"],
        ["status", "Status"],
        ["submittedAt", "Received"],
      ],
      action: "moderation",
    },
    services: {
      title: "Services",
      description:
        "Review service names and publication state before connecting the public catalog.",
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
      description:
        "Owner notifications associated with sample workflow events.",
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
      description: "A review-only timeline of example administrative events.",
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
      description:
        "Business and notification settings are not connected in this preview.",
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
      } else if (!supabaseConfig?.isConfigured()) {
        loginIntro.textContent =
          "Supabase is not configured. Sign-in is unavailable until project settings are supplied.";
        loginHint.textContent =
          "Credentials are submitted only to Supabase Auth after configuration.";
        loginModeLabel.textContent = "SETUP REQUIRED";
      } else {
        loginIntro.textContent =
          "Sign in with the owner account provisioned in Supabase Auth.";
        loginHint.textContent =
          "Authentication is handled by Supabase. This page does not store your password.";
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
        } catch {
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
          .catch(() => {});
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
        makeElement("span", "data-label", "DEMO PREVIEW DATA"),
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
          `${definition.title} preview records`,
        ),
      );
      const head = document.createElement("thead");
      const headerRow = document.createElement("tr");
      definition.columns.forEach(([, label]) => {
        const th = makeElement("th", "", label);
        th.scope = "col";
        headerRow.append(th);
      });
      if (definition.action && includeAction) {
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
        if (definition.action && includeAction) {
          const actionCell = document.createElement("td");
          const label =
            definition.action === "details"
              ? "View details"
              : definition.action === "moderation"
                ? "Review"
                : "Mark read";
          const action = makeElement("button", "table-action", label);
          action.type = "button";
          if (definition.action === "details") {
            action.dataset.recordAction = "details";
            action.dataset.recordId = record.id;
            action.setAttribute(
              "aria-label",
              `View repair details for ${record.reference}`,
            );
          } else {
            action.disabled = true;
            action.title =
              "Unavailable until authenticated data operations are connected";
          }
          actionCell.append(action);
          row.append(actionCell);
        }
        body.append(row);
      });
      table.append(head, body);
      wrapper.append(table);
      return wrapper;
    };

    const makeDataPanel = (definition) => {
      const panel = makeElement("section", "panel module-panel");
      panel.setAttribute("aria-labelledby", "module-panel-title");
      const panelHeading = makeElement("div", "panel-heading");
      const titleGroup = document.createElement("div");
      titleGroup.append(
        makeElement("p", "panel-eyebrow", "ISOLATED FIXTURE RECORDS"),
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
        button.disabled = true;
        button.title =
          "Unavailable until Supabase and owner authorization are connected";
        button.setAttribute("aria-describedby", "module-action-note");
        panelHeading.append(button);
      }
      panel.append(
        panelHeading,
        makeElement(
          "p",
          "panel-note",
          "Synthetic demo data only. No records are stored or changed.",
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
        label.append(select);
        controls.append(label);
      });
      if (controls.childElementCount) panel.append(controls);
      const count = makeElement("p", "table-count", "");
      count.id = "module-record-count";
      count.setAttribute("role", "status");
      count.setAttribute("aria-live", "polite");
      count.setAttribute("aria-atomic", "true");
      panel.append(count);
      const loading = makeElement("p", "module-state", "Loading preview data…");
      loading.dataset.moduleState = "loading";
      loading.setAttribute("role", "status");
      const error = makeElement("div", "module-state module-state--error");
      error.dataset.moduleState = "error";
      error.hidden = true;
      error.setAttribute("role", "alert");
      const empty = makeElement(
        "p",
        "module-state",
        `No ${definition.title.toLowerCase()} records are available in this preview.`,
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
      const actionNote = makeElement(
        "p",
        "module-action-note",
        "Data changes, moderation decisions, and destructive actions are disabled in this preview.",
      );
      actionNote.id = "module-action-note";
      panel.append(actionNote);
      return panel;
    };

    const renderSettings = () => {
      const panel = makeElement("section", "panel module-panel settings-panel");
      panel.setAttribute("aria-labelledby", "settings-panel-title");
      panel.append(makeElement("p", "panel-eyebrow", "NOT CONNECTED"));
      const title = makeElement("h2", "", "Business profile and preferences");
      title.id = "settings-panel-title";
      panel.append(
        title,
        makeElement(
          "p",
          "panel-note",
          "These fields describe the future settings contract. Inputs are disabled because no settings service is connected.",
        ),
      );
      const form = document.createElement("form");
      form.className = "settings-form";
      form.addEventListener("submit", (event) => event.preventDefault());
      [
        ["Business name", "Public-facing shop name"],
        ["Phone number", "Public contact phone"],
        ["Email address", "Public contact email"],
        ["Address", "Public shop address"],
        ["Business hours", "Public business hours"],
      ].forEach(([name, placeholder]) => {
        const label = makeElement("label", "settings-field");
        label.append(makeElement("span", "", name));
        const input = document.createElement("input");
        input.name = name.toLowerCase().replaceAll(" ", "_");
        input.placeholder = placeholder;
        input.disabled = true;
        label.append(input);
        form.append(label);
      });
      const preferences = makeElement("fieldset", "settings-preferences");
      preferences.disabled = true;
      const legend = document.createElement("legend");
      legend.textContent = "Notification preferences";
      preferences.append(legend);
      [
        "Repair request updates",
        "Comment moderation alerts",
        "Administrative activity alerts",
      ].forEach((text) => {
        const label = makeElement("label", "settings-checkbox");
        const input = document.createElement("input");
        input.type = "checkbox";
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
      save.disabled = true;
      save.title =
        "Unavailable until authenticated settings storage is connected";
      form.append(save);
      panel.append(
        form,
        makeElement(
          "p",
          "module-action-note",
          "Settings are not saved or persisted in this preview.",
        ),
      );
      return panel;
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
            "Future settings fields are documented in admin/DATA-CONTRACTS.md.",
          ),
        );
      } else {
        view.append(makeDataPanel(definition));
        if (moduleKey === "repairs") {
          const detail = makeElement("section", "panel repair-detail-panel");
          detail.dataset.repairDetails = "true";
          detail.hidden = true;
          detail.setAttribute("aria-labelledby", "repair-detail-title");
          const title = makeElement("h2", "", "Repair details");
          title.id = "repair-detail-title";
          detail.append(title, makeElement("div", "repair-detail-content"));
          view.append(detail);
        }
        view.append(
          makeElement(
            "p",
            "view-footnote",
            "All displayed records are isolated demo fixtures. No real customer data or operations are connected.",
          ),
        );
      }
      return view;
    };

    const getFilteredRecords = (definition, records, panel) => {
      const query =
        panel
          .querySelector("[data-module-search]")
          ?.value.trim()
          .toLowerCase() || "";
      return records.filter((record) => {
        const matchesSearch =
          !query ||
          definition.search.some((key) =>
            String(record[key] ?? "")
              .toLowerCase()
              .includes(query),
          );
        const matchesFilters = [
          ...panel.querySelectorAll("[data-module-filter]"),
        ].every(
          (select) =>
            select.value === "all" ||
            String(record[select.dataset.moduleFilter]) === select.value,
        );
        return matchesSearch && matchesFilters;
      });
    };

    const renderFilteredTable = (moduleKey) => {
      const definition = moduleDefinitions[moduleKey];
      const panel = host.querySelector(
        `[data-admin-view="${moduleKey}"] .module-panel`,
      );
      if (!panel) return;
      const filtered = getFilteredRecords(definition, activeRecords, panel);
      const hasFilters =
        Boolean(panel.querySelector("[data-module-search]")?.value.trim()) ||
        [...panel.querySelectorAll("[data-module-filter]")].some(
          (select) => select.value !== "all",
        );
      panel.querySelector('[data-module-state="loading"]').hidden = true;
      panel.querySelector('[data-module-state="error"]').hidden = true;
      panel.querySelector('[data-module-state="empty"]').hidden =
        activeRecords.length > 0;
      panel.querySelector('[data-module-state="no-results"]').hidden =
        activeRecords.length === 0 || filtered.length > 0 || !hasFilters;
      panel.querySelector("#module-record-count").textContent =
        `Showing ${filtered.length} of ${activeRecords.length} demo ${definition.title.toLowerCase()} records`;
      const tableHost = panel.querySelector(".module-table-host");
      tableHost.replaceChildren();
      if (filtered.length) tableHost.append(createTable(definition, filtered));
    };

    const renderOverview = (repairs, activity) => {
      const view = host.querySelector('[data-admin-view="overview"]');
      const metrics = makeElement("section", "metric-grid");
      metrics.setAttribute("aria-label", "Demo repair metrics");
      const metricDefinitions = [
        [
          "Open requests",
          repairs.filter(
            (record) => !["completed", "cancelled"].includes(record.status),
          ).length,
        ],
        [
          "Awaiting approval",
          repairs.filter((record) => record.status === "awaiting_approval")
            .length,
        ],
        [
          "In progress",
          repairs.filter((record) => record.status === "in_progress").length,
        ],
        [
          "Ready for pickup",
          repairs.filter((record) => record.status === "ready_for_pickup")
            .length,
        ],
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
          makeElement("p", "metric-item__note", "Demo fixture count"),
        );
        metrics.append(item);
      });
      const grid = makeElement("div", "overview-grid");
      const recentPanel = makeElement("section", "panel");
      const panelHeading = makeElement("div", "panel-heading");
      const titleGroup = document.createElement("div");
      titleGroup.append(
        makeElement("p", "panel-eyebrow", "DEMO FIXTURES"),
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
          "Synthetic records only; no customer data is connected.",
        ),
      );
      recentPanel.append(
        createTable(moduleDefinitions.repairs, repairs.slice(0, 4), false),
      );
      const activityPanel = makeElement("section", "panel");
      activityPanel.append(
        makeElement("p", "panel-eyebrow", "DEMO FIXTURES"),
        makeElement("h2", "", "Recent activity"),
        makeElement("p", "panel-note", "No real activity has been performed."),
      );
      const list = makeElement("ol", "activity-list");
      activity.slice(0, 5).forEach((record) => {
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
          "All values are derived from synthetic demo fixtures and are not shop records.",
        ),
      );
    };

    const loadModule = async (moduleKey) => {
      const definition = moduleDefinitions[moduleKey];
      if (!definition) return;
      activeModule = moduleKey;
      activeRecords = [];
      setSidebarOpen(false);
      navItems.forEach((item) => {
        const isActive = item.dataset.viewTarget === moduleKey;
        item.classList.toggle("is-active", isActive);
        if (isActive) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
      breadcrumb.textContent = definition.title;
      host.replaceChildren(renderModuleShell(moduleKey));
      host.setAttribute("aria-busy", "true");
      if (moduleKey === "settings") {
        host.setAttribute("aria-busy", "false");
        return;
      }
      try {
        if (moduleKey === "overview") {
          const [repairs, activity] = await Promise.all([
            window.AdminDataAdapter.list("repairs"),
            window.AdminDataAdapter.list("activity"),
          ]);
          if (activeModule !== moduleKey) return;
          renderOverview(repairs.records, activity.records);
        } else {
          const result = await window.AdminDataAdapter.list(
            definition.collection,
          );
          if (activeModule !== moduleKey) return;
          if (result.mode !== "preview")
            throw new Error("Unexpected data source mode.");
          activeRecords = result.records;
          renderFilteredTable(moduleKey);
        }
      } catch {
        if (activeModule !== moduleKey) return;
        const panel = host.querySelector(".module-panel");
        const error = panel?.querySelector('[data-module-state="error"]');
        if (panel && error) {
          panel.querySelector('[data-module-state="loading"]').hidden = true;
          error.append(
            makeElement(
              "p",
              "",
              "Dashboard data could not be loaded. Check your session and owner access, then try again.",
            ),
          );
          const retry = makeElement("button", "admin-button", "Retry loading");
          retry.type = "button";
          retry.dataset.retryModule = moduleKey;
          error.append(retry);
          error.hidden = false;
        } else {
          host.replaceChildren(
            makeElement(
              "p",
              "module-state module-state--error",
              "Dashboard data could not be loaded. Check your session and owner access, then try again.",
            ),
          );
        }
      } finally {
        if (activeModule === moduleKey) host.setAttribute("aria-busy", "false");
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
      if (activeModule !== "overview" && activeModule !== "settings")
        renderFilteredTable(activeModule);
    });
    host.addEventListener("change", () => {
      if (activeModule !== "overview" && activeModule !== "settings")
        renderFilteredTable(activeModule);
    });
    host.addEventListener("click", (event) => {
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
      const detailAction = event.target.closest(
        '[data-record-action="details"]',
      );
      if (!detailAction) return;
      const record = activeRecords.find(
        (item) => item.id === detailAction.dataset.recordId,
      );
      const detailPanel = host.querySelector("[data-repair-details]");
      if (!record || !detailPanel) return;
      const content = detailPanel.querySelector(".repair-detail-content");
      content.replaceChildren();
      [
        [
          "Customer",
          `${record.customerName} · ${record.customerEmail} · ${record.customerPhone}`,
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
            .join("; "),
        ],
        ["Internal notes", record.internalNotes],
        ["Customer-visible notes", record.customerVisibleNotes],
      ].forEach(([labelText, value]) => {
        const field = makeElement("div", "detail-field");
        field.append(
          makeElement("dt", "", labelText),
          makeElement("dd", "", value),
        );
        content.append(field);
      });
      detailPanel.hidden = false;
      detailPanel.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
      });
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

    const showAccessMessage = (title, message) => {
      accessTitle.textContent = title;
      accessMessage.textContent = message;
      accessLogin.hidden = false;
      adminPage.dataset.adminState = "unauthorized";
    };

    const showDashboard = (mode) => {
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
        showDashboard("authorized");
      })
      .catch(() => {
        showAccessMessage(
          "Unable to verify access",
          "Supabase access could not be verified. Check the connection and sign in again.",
        );
      });
  });
})();
