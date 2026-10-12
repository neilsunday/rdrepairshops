(() => {
  "use strict";

  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
  ]);
  const maxFileBytes = 5 * 1024 * 1024;
  const maxFiles = 5;
  const authPanel = document.querySelector("#auth-panel");
  const workspace = document.querySelector("#workspace");
  const globalNotice = document.querySelector("#client-notice");
  const globalError = document.querySelector("#client-error");
  const authForm = document.querySelector("#auth-form");
  const authMessage = document.querySelector("#auth-message");
  const authSubmit = document.querySelector("#auth-submit");
  const authToggle = document.querySelector("#auth-toggle");
  const signupFields = document.querySelector("#signup-fields");
  const bookingForm = document.querySelector("#booking-form");
  const bookingMessage = document.querySelector("#booking-message");
  const bookingSubmit = document.querySelector("#booking-submit");
  const repairList = document.querySelector("#repair-list");
  const serviceSelect = document.querySelector("#service-select");
  const serviceSearch = document.querySelector("#service-search");
  const serviceOptions = document.querySelector("#service-options");
  const serviceClear = document.querySelector("#service-clear");
  const serviceSelectionStatus = document.querySelector(
    "#service-selection-status",
  );
  const photoInput = document.querySelector("#repair-photos");
  const photoPreviewList = document.querySelector("#photo-preview-list");
  let client;
  let currentUser;
  let signingUp = false;
  let repairServices = [];
  let selectedServiceLabel = "";
  let activeServiceIndex = -1;
  let previewUrls = [];
  let pendingPhotoUpload = null;

  const showGlobalMessage = (message, error = false) => {
    globalNotice.hidden = error || !message;
    globalError.hidden = !error || !message;
    (error ? globalError : globalNotice).textContent = message || "";
  };

  const setFormMessage = (element, message, error = false) => {
    element.textContent = message || "";
    element.dataset.state = error ? "error" : "success";
  };

  const friendlyError = (error) => {
    const message = String(error?.message || "Please try again.");
    if (/invalid login credentials/i.test(message))
      return "That email and password combination was not recognized.";
    if (/email not confirmed/i.test(message))
      return "Confirm your email using the verification link, then sign in.";
    return message;
  };

  const makeText = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value ?? "";
    return element;
  };

  const formatStatus = (status) =>
    String(status || "submitted").replaceAll("_", " ");

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  };

  const loadServices = async () => {
    const { data, error } = await client
      .from("repair_services")
      .select("id,name,category")
      .eq("status", "active")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    repairServices = data || [];
    serviceSelect.replaceChildren(new Option("Other / not listed", ""));
    for (const service of repairServices) {
      const option = new Option(
        `${service.name} · ${service.category}`,
        service.id,
      );
      serviceSelect.append(option);
    }
    renderServiceOptions("");
  };

  const serviceLabel = (service) =>
    service ? `${service.name} · ${service.category}` : "Other / not listed";

  const selectRepairService = (service) => {
    serviceSelect.value = service?.id || "";
    selectedServiceLabel = serviceLabel(service);
    serviceSearch.value = selectedServiceLabel;
    serviceClear.hidden = false;
    serviceSelectionStatus.textContent = service
      ? `Selected: ${selectedServiceLabel}`
      : "Other / not listed selected. Describe the issue below.";
    serviceOptions.hidden = true;
    serviceSearch.setAttribute("aria-expanded", "false");
    serviceSearch.removeAttribute("aria-activedescendant");
    activeServiceIndex = -1;
  };

  const renderServiceOptions = (query) => {
    const term = query.trim().toLocaleLowerCase();
    const matches = repairServices.filter((service) =>
      `${service.name} ${service.category}`.toLocaleLowerCase().includes(term),
    );
    const options = [
      { id: "", name: "Other / not listed", category: "", fallback: true },
      ...matches,
    ];
    serviceOptions.replaceChildren();
    options.forEach((service, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.id = `service-option-${index}`;
      option.className = "service-option";
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        String(serviceSelect.value === service.id),
      );
      option.append(
        makeText("span", "service-option-name", service.name),
        service.category
          ? makeText("span", "service-option-category", service.category)
          : makeText("span", "service-option-category", "Describe your issue"),
      );
      option.addEventListener("click", () => selectRepairService(service.fallback ? null : service));
      serviceOptions.append(option);
    });
    if (term && matches.length === 0)
      serviceSelectionStatus.textContent =
        "No services match that search. Choose Other / not listed instead.";
    activeServiceIndex = -1;
    if (!serviceOptions.hidden)
      serviceSearch.setAttribute("aria-expanded", "true");
  };

  const openServiceOptions = (query = "") => {
    renderServiceOptions(query);
    serviceOptions.hidden = false;
    serviceSearch.setAttribute("aria-expanded", "true");
  };

  const closeServiceOptions = () => {
    serviceOptions.hidden = true;
    serviceSearch.setAttribute("aria-expanded", "false");
    serviceSearch.removeAttribute("aria-activedescendant");
    activeServiceIndex = -1;
  };

  const setActiveServiceOption = (index) => {
    const options = [...serviceOptions.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    activeServiceIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      option.classList.toggle("is-active", optionIndex === activeServiceIndex);
    });
    serviceSearch.setAttribute(
      "aria-activedescendant",
      options[activeServiceIndex].id,
    );
    options[activeServiceIndex].scrollIntoView({ block: "nearest" });
  };

  serviceSearch.addEventListener("focus", () => {
    openServiceOptions(serviceSelect.value ? "" : serviceSearch.value);
    serviceSearch.select();
  });

  serviceSearch.addEventListener("input", () => {
    if (serviceSearch.value !== selectedServiceLabel) {
      serviceSelect.value = "";
      selectedServiceLabel = "";
      serviceClear.hidden = true;
      serviceSelectionStatus.textContent =
        "No service selected. You can also describe the issue below.";
    }
    openServiceOptions(serviceSearch.value);
  });

  serviceSearch.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (serviceOptions.hidden) openServiceOptions(serviceSearch.value);
      setActiveServiceOption(activeServiceIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveServiceOption(activeServiceIndex - 1);
    } else if (event.key === "Enter" && !serviceOptions.hidden) {
      event.preventDefault();
      const activeOption = serviceOptions.querySelector(
        `#${CSS.escape(`service-option-${activeServiceIndex}`)}`,
      );
      activeOption?.click();
    } else if (event.key === "Escape") {
      closeServiceOptions();
    }
  });

  serviceClear.addEventListener("click", () => {
    serviceSelect.value = "";
    selectedServiceLabel = "";
    serviceSearch.value = "";
    serviceClear.hidden = true;
    serviceSelectionStatus.textContent =
      "No service selected. You can also describe the issue below.";
    serviceSearch.focus();
    openServiceOptions("");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".service-picker")) closeServiceOptions();
  });

  const updateRepairStats = (requests) => {
    const completed = requests.filter(
      (request) => request.status === "completed",
    ).length;
    const inProgress = requests.filter((request) =>
      ["approved", "in_progress", "ready_for_pickup"].includes(request.status),
    ).length;
    const pending = requests.filter((request) =>
      ["submitted", "inspecting", "awaiting_approval"].includes(
        request.status,
      ),
    ).length;
    document.querySelector("#stat-total").textContent = String(requests.length);
    document.querySelector("#stat-pending").textContent = String(pending);
    document.querySelector("#stat-progress").textContent = String(inProgress);
    document.querySelector("#stat-completed").textContent = String(completed);
    document.querySelector("#repair-count-label").textContent =
      `${requests.length} ${requests.length === 1 ? "request" : "requests"}`;
  };

  const updateBookingAfterSuccess = () => {
    bookingForm.reset();
    pendingPhotoUpload = null;
    bookingForm.querySelectorAll("fieldset").forEach((group) => {
      group.disabled = false;
    });
    document.querySelector("#booking-submit .button-label").textContent =
      "Submit repair request";
    document.querySelector("#booking-submit").classList.remove("is-submitting");
    serviceSelect.value = "";
    selectedServiceLabel = "";
    serviceSearch.value = "";
    serviceClear.hidden = true;
    serviceSelectionStatus.textContent =
      "No service selected. You can also describe the issue below.";
    closeServiceOptions();
    renderPhotoPreviews([]);
  };

  const showRepairLoadError = (error) => {
    const state = makeText("div", "empty-state empty-state--error");
    state.append(
      makeText("h3", "", "Repair history isn’t available"),
      makeText(
        "p",
        "",
        `We couldn’t load your repair updates. ${friendlyError(error)}`,
      ),
    );
    const retry = makeText("button", "button button--quiet empty-state-action", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () =>
      document.querySelector("#refresh-repairs").click(),
    );
    state.append(retry);
    repairList.replaceChildren(state);
  };

  const uploadPendingPhotos = async () => {
    const { request, files } = pendingPhotoUpload;
    for (const [index, file] of files.entries()) {
      try {
        await uploadPhoto(request, file);
      } catch (error) {
        pendingPhotoUpload = { request, files: files.slice(index) };
        bookingForm.querySelectorAll("fieldset").forEach((group) => {
          group.disabled = true;
        });
        bookingSubmit.querySelector(".button-label").textContent =
          "Retry photo uploads";
        throw new Error(
          `Request ${request.reference_number} is saved, but ${pendingPhotoUpload.files.length} photo(s) could not upload: ${friendlyError(error)}. Your form is preserved; retry without creating a duplicate request.`,
        );
      }
    }
    const referenceNumber = request.reference_number;
    updateBookingAfterSuccess();
    setFormMessage(
      bookingMessage,
      `Request ${referenceNumber} is submitted${files.length ? " with the selected photos attached" : ""}. You can follow its updates below.`,
    );
    try {
      await loadRepairs();
    } catch (refreshError) {
      console.error("Booking succeeded but repair list refresh failed:", refreshError);
      showRepairLoadError(refreshError);
      setFormMessage(
        bookingMessage,
        `Request ${referenceNumber} was submitted, but your list could not refresh. Use Refresh to try again.`,
        true,
      );
    }
  };

  const renderRepair = (request, histories, attachments) => {
    const article = makeText("article", "repair-card");
    const top = document.createElement("div");
    top.className = "repair-card__top";
    const titleGroup = document.createElement("div");
    titleGroup.className = "repair-card__title-group";
    titleGroup.append(
      makeText("p", "repair-reference", request.reference_number),
      makeText(
        "h3",
        "",
        [request.brand, request.model].filter(Boolean).join(" ") ||
          request.device_type ||
          "Repair request",
      ),
    );
    const status = makeText(
      "span",
      `status-badge status-badge--${String(request.status || "submitted").replaceAll("_", "-")}`,
      formatStatus(request.status),
    );
    top.append(titleGroup, status);
    article.append(top);

    article.append(
      makeText(
        "p",
        "repair-service",
        `${request.device_type} · ${request.service_name_snapshot || "Other / not listed"}`,
      ),
      makeText("p", "repair-meta", `Submitted ${formatDate(request.submitted_at)}`),
    );

    if (request.reported_issue) {
      const issue = document.createElement("details");
      issue.className = "repair-issue-details";
      const summary = makeText("summary", "", "Issue description");
      issue.append(summary, makeText("p", "repair-issue", request.reported_issue));
      article.append(issue);
    }

    const latestMessage =
      request.customer_visible_note ||
      [...histories].reverse().find((entry) => entry.customer_message)
        ?.customer_message;
    if (latestMessage) {
      const update = makeText("p", "repair-message", "");
      update.append(makeText("strong", "", "Latest update"));
      update.append(document.createTextNode(latestMessage));
      article.append(update);
    }

    if (histories.length) {
      const historyDetails = document.createElement("details");
      historyDetails.className = "repair-history-details";
      historyDetails.append(
        makeText("summary", "", `${histories.length} status ${histories.length === 1 ? "update" : "updates"}`),
      );
      const list = document.createElement("ol");
      list.className = "repair-history";
      for (const entry of histories) {
        const line = document.createElement("li");
        const label = `${formatStatus(entry.to_status)} · ${formatDate(entry.created_at)}`;
        line.append(makeText("strong", "", label));
        if (entry.customer_message)
          line.append(
            document.createTextNode(` — ${entry.customer_message}`),
          );
        list.append(line);
      }
      historyDetails.append(list);
      article.append(historyDetails);
    }

    if (attachments.length) {
      const photos = document.createElement("div");
      photos.className = "repair-photos";
      photos.setAttribute("aria-label", "Photos you uploaded");
      for (const attachment of attachments) {
        const link = document.createElement("a");
        link.href = attachment.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute(
          "aria-label",
          `Open uploaded photo ${attachment.original_filename}`,
        );
        const image = document.createElement("img");
        image.src = attachment.url;
        image.alt = attachment.original_filename;
        image.loading = "lazy";
        link.append(image);
        photos.append(link);
      }
      article.append(photos);
    }
    return article;
  };

  const loadRepairs = async () => {
    repairList.replaceChildren(makeText("p", "empty-state empty-state--loading", "Loading your repair requests…"));
    const { data: requests, error: requestError } = await client
      .from("repair_requests")
      .select(
        "id,reference_number,device_type,brand,model,reported_issue,service_name_snapshot,status,submitted_at,customer_visible_note",
      )
      .eq("customer_id", currentUser.id)
      .order("submitted_at", { ascending: false });
    if (requestError) throw requestError;
    updateRepairStats(requests || []);
    if (!requests?.length) {
      const empty = makeText("div", "empty-state");
      empty.append(
        makeText("h3", "", "No repair requests yet"),
        makeText(
          "p",
          "",
          "When you book your first repair, its status and updates will appear here.",
        ),
        Object.assign(document.createElement("a"), {
          className: "button button--quiet empty-state-action",
          href: "#booking-title",
          textContent: "Book your first repair",
        }),
      );
      repairList.replaceChildren(empty);
      return;
    }

    const requestIds = requests.map((request) => request.id);
    const [historyResult, attachmentResult] = await Promise.all([
      client
        .from("repair_status_history")
        .select("id,repair_request_id,to_status,customer_message,created_at")
        .in("repair_request_id", requestIds)
        .order("created_at", { ascending: true }),
      client
        .from("repair_attachments")
        .select(
          "repair_request_id,object_path,original_filename,content_type",
        )
        .in("repair_request_id", requestIds)
        .order("created_at", { ascending: true }),
    ]);
    if (historyResult.error || attachmentResult.error)
      throw historyResult.error || attachmentResult.error;

    const historyByRequest = new Map();
    for (const entry of historyResult.data || []) {
      const entries = historyByRequest.get(entry.repair_request_id) || [];
      entries.push(entry);
      historyByRequest.set(entry.repair_request_id, entries);
    }
    const attachmentsByRequest = new Map();
    for (const attachment of attachmentResult.data || []) {
      const entries = attachmentsByRequest.get(attachment.repair_request_id) || [];
      entries.push(attachment);
      attachmentsByRequest.set(attachment.repair_request_id, entries);
    }
    const signedAttachments = new Map();
    for (const [requestId, entries] of attachmentsByRequest) {
      const signed = await Promise.all(
        entries.map(async (attachment) => {
          const { data, error } = await client.storage
            .from("repair-attachments")
            .createSignedUrl(attachment.object_path, 300);
          if (error) throw error;
          return { ...attachment, url: data.signedUrl };
        }),
      );
      signedAttachments.set(requestId, signed);
    }

    repairList.replaceChildren(
      ...requests.map((request) =>
        renderRepair(
          request,
          historyByRequest.get(request.id) || [],
          signedAttachments.get(request.id) || [],
        ),
      ),
    );
  };

  const enterWorkspace = async (user) => {
    const { data: profile, error } = await client
      .from("profiles")
      .select("display_name,phone")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    currentUser = user;
    try {
      document.querySelector("#customer-label").textContent =
        profile.display_name || user.email || "Customer";
      document.querySelector("#workspace-customer-label").textContent =
        user.email || "Customer account";
      document.querySelector("#profile-form [name=display_name]").value =
        profile.display_name || "";
      document.querySelector("#profile-form [name=phone]").value =
        profile.phone || "";
      document.querySelector("#profile-email").textContent =
        `Email: ${user.email || "Unavailable"}`;
      await Promise.all([loadServices(), loadRepairs()]);
      document.querySelector("#dashboard-heading").setAttribute(
        "aria-label",
        `Welcome back, ${profile.display_name || user.email || "Customer"}`,
      );
      authPanel.hidden = true;
      workspace.hidden = false;
      showGlobalMessage("");
      if (new URLSearchParams(window.location.search).get("flow") === "book")
        document.querySelector("#booking-title").scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    } catch (error) {
      currentUser = null;
      throw error;
    }
  };

  const selectedPhotos = () => Array.from(photoInput.files || []);

  const validatePhotos = (files) => {
    if (files.length > maxFiles)
      return "Choose no more than five photos for one repair request.";
    for (const file of files) {
      if (!allowedTypes.has(file.type))
        return `${file.name}: use a JPEG, PNG, WebP, or HEIC image.`;
      if (file.size <= 0 || file.size > maxFileBytes)
        return `${file.name}: each image must be smaller than 5 MiB.`;
    }
    return "";
  };

  const uploadPhoto = async (request, file) => {
    const safeName =
      file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "repair-photo";
    const objectPath = `${currentUser.id}/${request.id}/${crypto.randomUUID()}-${safeName}`;
    const bucket = client.storage.from("repair-attachments");
    const { error: uploadError } = await bucket.upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      const { error: cleanupError } = await bucket.remove([objectPath]);
      throw new Error(
        cleanupError
          ? `${uploadError.message} Cleanup also failed: ${cleanupError.message}`
          : uploadError.message,
      );
    }

    const { error: metadataError } = await client
      .from("repair_attachments")
      .insert({
        repair_request_id: request.id,
        uploaded_by: currentUser.id,
        bucket_id: "repair-attachments",
        object_path: objectPath,
        original_filename: file.name.slice(0, 255),
        content_type: file.type,
        byte_size: file.size,
        alt_text: "Customer photo of the reported repair issue",
      });
    if (metadataError) {
      const { error: cleanupError } = await bucket.remove([objectPath]);
      throw new Error(
        cleanupError
          ? `${metadataError.message} Cleanup also failed: ${cleanupError.message}`
          : metadataError.message,
      );
    }
  };

  authToggle.addEventListener("click", () => {
    signingUp = !signingUp;
    signupFields.hidden = !signingUp;
    signupFields.querySelector("[name=display_name]").required = signingUp;
    document.querySelector("#auth-title").textContent = signingUp
      ? "Create your account"
      : "Sign in to continue";
    authSubmit.textContent = signingUp ? "Create account" : "Sign in";
    authToggle.textContent = signingUp ? "I already have an account" : "Create account";
    authForm.querySelector("[name=password]").autocomplete = signingUp
      ? "new-password"
      : "current-password";
    setFormMessage(authMessage, "");
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!authForm.reportValidity()) return;
    const form = new FormData(authForm);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    authSubmit.disabled = true;
    authToggle.disabled = true;
    setFormMessage(authMessage, signingUp ? "Creating your account…" : "Signing in…");
    try {
      let user;
      if (signingUp) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: String(form.get("display_name") || "").trim(),
              phone: String(form.get("phone") || "").trim(),
            },
          },
        });
        if (error) throw error;
        user = data.session?.user;
        if (!user) {
          signingUp = false;
          signupFields.hidden = true;
          signupFields.querySelector("[name=display_name]").required = false;
          authSubmit.textContent = "Sign in";
          authToggle.textContent = "Create account";
          setFormMessage(
            authMessage,
            "Account created. Check your email for a verification link, then sign in.",
          );
          return;
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        user = data.user;
      }
      await enterWorkspace(user);
    } catch (error) {
      console.error("Customer account sign-in failed:", error);
      setFormMessage(authMessage, friendlyError(error), true);
      if (currentUser) showGlobalMessage(friendlyError(error), true);
    } finally {
      authSubmit.disabled = false;
      authToggle.disabled = false;
    }
  });

  document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      const { error } = await client
        .from("profiles")
        .update({
          display_name: form.elements.display_name.value.trim(),
          phone: form.elements.phone.value.trim() || null,
        })
        .eq("id", currentUser.id);
      if (error) throw error;
      document.querySelector("#customer-label").textContent =
        form.elements.display_name.value.trim();
      document.querySelector("#workspace-customer-label").textContent =
        currentUser.email || "Customer account";
      showGlobalMessage("Your contact details have been saved.");
    } catch (error) {
      console.error("Customer profile update failed:", error);
      showGlobalMessage(friendlyError(error), true);
    } finally {
      submit.disabled = false;
    }
  });

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;
    const files = selectedPhotos();
    const validationError = validatePhotos(files);
    if (validationError) {
      setFormMessage(bookingMessage, validationError, true);
      return;
    }
    const profileForm = document.querySelector("#profile-form");
    const customerName = profileForm.elements.display_name.value.trim();
    const customerPhone = profileForm.elements.phone.value.trim();
    if (!customerName || (!customerPhone && !currentUser.email)) {
      setFormMessage(
        bookingMessage,
        "Add your name and at least one contact method to your account details first.",
        true,
      );
      return;
    }

    bookingSubmit.disabled = true;
    bookingSubmit.classList.add("is-submitting");
    if (pendingPhotoUpload) {
      setFormMessage(
        bookingMessage,
        `Your request ${pendingPhotoUpload.request.reference_number} is already submitted. Retrying the remaining photo uploads…`,
      );
      try {
        await uploadPendingPhotos();
      } catch (error) {
        console.error("Repair photo retry failed:", error);
        setFormMessage(
          bookingMessage,
          `Request ${pendingPhotoUpload.request.reference_number} is saved. Photo upload failed: ${friendlyError(error)}. Your form is preserved; select Retry photo uploads to try again.`,
          true,
        );
        bookingSubmit.querySelector(".button-label").textContent =
          "Retry photo uploads";
      } finally {
        bookingSubmit.disabled = false;
        bookingSubmit.classList.remove("is-submitting");
      }
      return;
    }
    setFormMessage(bookingMessage, "Submitting your repair request…");
    try {
      const form = new FormData(bookingForm);
      const { data: request, error } = await client
        .from("repair_requests")
        .insert({
          customer_id: currentUser.id,
          customer_name: customerName,
          customer_email: currentUser.email || null,
          customer_phone: customerPhone || null,
          device_type: String(form.get("device_type") || "").trim(),
          brand: String(form.get("brand") || "").trim(),
          model: String(form.get("model") || "").trim(),
          reported_issue: String(form.get("reported_issue") || "").trim(),
          service_id: String(form.get("service_id") || "") || null,
          service_name_snapshot: "Other / not listed",
        })
        .select("id,reference_number")
        .single();
      if (error) throw error;

      if (files.length) {
        pendingPhotoUpload = { request, files };
        await uploadPendingPhotos();
      } else {
        updateBookingAfterSuccess();
        setFormMessage(
          bookingMessage,
          `Request ${request.reference_number} submitted. You can follow its updates below.`,
        );
      }
      try {
        if (!files.length) await loadRepairs();
      } catch (refreshError) {
        console.error("Booking succeeded but repair list refresh failed:", refreshError);
        setFormMessage(
          bookingMessage,
          `Request ${request.reference_number} was submitted, but your list could not refresh. Use Refresh to try again.`,
          true,
        );
      }
      document.querySelector("#repairs-title").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      console.error("Repair booking failed:", error);
      setFormMessage(bookingMessage, friendlyError(error), true);
    } finally {
      bookingSubmit.disabled = false;
      bookingSubmit.classList.remove("is-submitting");
    }
  });

  document.querySelector("#refresh-repairs").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await loadRepairs();
      showGlobalMessage("Your repair requests are up to date.");
    } catch (error) {
      console.error("Customer repair refresh failed:", error);
      showRepairLoadError(error);
      showGlobalMessage(friendlyError(error), true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#sign-out").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      currentUser = null;
      workspace.hidden = true;
      authPanel.hidden = false;
      document.querySelector("#customer-label").textContent = "";
      document.querySelector("#workspace-customer-label").textContent = "";
      document.querySelector("#profile-form").reset();
      signingUp = false;
      signupFields.hidden = true;
      signupFields.querySelector("[name=display_name]").required = false;
      document.querySelector("#auth-title").textContent = "Sign in to continue";
      authSubmit.textContent = "Sign in";
      authToggle.textContent = "Create account";
      setFormMessage(authMessage, "");
      repairList.replaceChildren();
      ["#stat-total", "#stat-pending", "#stat-progress", "#stat-completed"].forEach(
        (selector) => {
          document.querySelector(selector).textContent = "—";
        },
      );
      document.querySelector("#repair-count-label").textContent = "";
      showGlobalMessage("You have signed out.");
      authForm.reset();
      renderPhotoPreviews([]);
    } catch (error) {
      console.error("Customer sign-out failed:", error);
      showGlobalMessage(friendlyError(error), true);
    } finally {
      button.disabled = false;
    }
  });

  const renderPhotoPreviews = (files) => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    photoPreviewList.replaceChildren();
    for (const [index, file] of files.entries()) {
      const preview = makeText("article", "photo-preview");
      const image = document.createElement("img");
      const imageWrap = makeText("div", "photo-preview-image");
      const objectUrl = URL.createObjectURL(file);
      previewUrls.push(objectUrl);
      image.src = objectUrl;
      image.alt = "";
      image.onerror = () => {
        image.hidden = true;
        imageWrap.append(makeText("span", "photo-file-icon", "IMG"));
      };
      imageWrap.append(image);
      const fileInfo = document.createElement("div");
      fileInfo.className = "photo-preview-info";
      fileInfo.append(
        makeText("strong", "", file.name),
        makeText(
          "span",
          "",
          file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        ),
      );
      const remove = makeText("button", "photo-remove", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.addEventListener("click", () => {
        const transfer = new DataTransfer();
        selectedPhotos().forEach((selectedFile, selectedIndex) => {
          if (selectedIndex !== index) transfer.items.add(selectedFile);
        });
        photoInput.files = transfer.files;
        renderPhotoPreviews(selectedPhotos());
        const message = validatePhotos(selectedPhotos());
        setFormMessage(bookingMessage, message, Boolean(message));
      });
      preview.append(imageWrap, fileInfo, remove);
      photoPreviewList.append(preview);
    }
  };

  photoInput.addEventListener("change", () => {
    const files = selectedPhotos();
    renderPhotoPreviews(files);
    const message = validatePhotos(files);
    setFormMessage(
      bookingMessage,
      message || (files.length ? `${files.length} photo(s) ready to upload.` : ""),
      Boolean(message),
    );
  });

  const start = async () => {
    if (!window.AdminSupabaseClient?.isConfigured()) {
      showGlobalMessage(
        "The customer portal is not configured yet. Add the Supabase project URL and publishable key in admin/js/supabase-config.js.",
        true,
      );
      authSubmit.disabled = true;
      authToggle.disabled = true;
      return;
    }
    let hasSession = false;
    try {
      client = await window.AdminSupabaseClient.get();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      hasSession = Boolean(data.session?.user);
      if (data.session?.user) await enterWorkspace(data.session.user);
    } catch (error) {
      console.error("Customer portal initialization failed:", error);
      showGlobalMessage(friendlyError(error), true);
    }
    if (
      new URLSearchParams(window.location.search).get("flow") === "book" &&
      !hasSession
    )
      document.querySelector("#auth-panel").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  start();
})();
