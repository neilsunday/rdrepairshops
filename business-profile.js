(() => {
  "use strict";

  const config = window.RDSupabaseConfig;
  const channel =
    "BroadcastChannel" in window
      ? new BroadcastChannel("rd-business-profile")
      : null;

  const renderContact = (element, key, value) => {
    const values = value
      .split(/[\n;,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    element.replaceChildren();
    values.forEach((item, index) => {
      if (index) element.append(document.createElement("br"));
      if (key === "public_email") {
        const link = document.createElement("a");
        link.href = `mailto:${item}`;
        link.textContent = item;
        element.append(link);
      } else if (key === "public_phone") {
        const link = document.createElement("a");
        link.href = `tel:${item.replace(/[^\d+]/g, "")}`;
        link.textContent = item;
        element.append(link);
      } else {
        element.append(document.createTextNode(item));
      }
    });
  };

  const applyProfile = (profile) => {
    for (const element of document.querySelectorAll("[data-business-contact]")) {
      const key = element.dataset.businessContact;
      const value = profile[key];
      if (typeof value === "string" && value.trim())
        renderContact(element, key, value);
    }

    const businessName = String(profile.business_name || "").trim();
    if (!businessName) return;
    const brandSuffix = businessName.replace(/^R\s*&\s*D\b\s*/i, "").trim();
    for (const brand of document.querySelectorAll(".brand")) {
      const name = brand.querySelector(".brand__name");
      if (name && brandSuffix) name.textContent = brandSuffix;
      brand.setAttribute("aria-label", `${businessName} home`);
    }
    const currentTitle = document.title;
    document.title = currentTitle.includes("|")
      ? `${currentTitle.split("|")[0].trim()} | ${businessName}`
      : businessName;
  };

  const loadProfile = async () => {
    if (!config?.projectUrl || !config?.publishableKey) {
      throw new Error("Public business profile configuration is unavailable.");
    }
    const endpoint = new URL(
      "/rest/v1/public_business_profile",
      config.projectUrl,
    );
    endpoint.searchParams.set(
      "select",
      "business_name,public_phone,public_email,public_address,business_hours",
    );
    endpoint.searchParams.set("id", "eq.1");
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
      },
    });
    if (!response.ok)
      throw new Error(
        `Public business profile could not be loaded (${response.status}).`,
      );
    const profiles = await response.json();
    if (!Array.isArray(profiles))
      throw new Error("Public business profile response was invalid.");
    if (profiles[0]) applyProfile(profiles[0]);
  };

  const refreshProfile = () => {
    loadProfile().catch((error) => {
      console.error("Business profile refresh failed:", error);
    });
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", refreshProfile, {
      once: true,
    });
  else refreshProfile();

  channel?.addEventListener("message", (event) => {
    if (event.data === "refresh") refreshProfile();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "rd-business-profile-updated") refreshProfile();
  });
})();
