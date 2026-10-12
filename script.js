(() => {
  const root = document.documentElement;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const storageKey = "rd-cellphone-repair-theme";
  const isTheme = (value) => value === "light" || value === "dark";

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(storageKey);
  } catch {
    savedTheme = null;
  }

  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const initialTheme = isTheme(savedTheme)
    ? savedTheme
    : systemPrefersDark
      ? "dark"
      : "light";
  root.setAttribute("data-theme", initialTheme);
  themeColorMeta.setAttribute(
    "content",
    initialTheme === "dark" ? "#171717" : "#f7f7f5",
  );

  document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.querySelector(".theme-toggle");
    const themeIcon = themeToggle.querySelector("use");
    const menuToggle = document.querySelector(".menu-toggle");
    const siteHeader = document.querySelector(".site-header");
    const navigation = document.querySelector(".site-nav__links");
    const desktopQuery = window.matchMedia("(min-width: 801px)");
    const year = document.querySelector("#current-year");

    const setTheme = (theme, persist = true) => {
      const dark = theme === "dark";
      root.setAttribute("data-theme", theme);
      themeColorMeta.setAttribute("content", dark ? "#171717" : "#f7f7f5");
      themeToggle.setAttribute("aria-pressed", String(dark));
      themeToggle.setAttribute(
        "aria-label",
        `Switch to ${dark ? "light" : "dark"} mode`,
      );
      themeToggle.setAttribute(
        "title",
        `Switch to ${dark ? "light" : "dark"} mode`,
      );
      themeIcon.setAttribute("href", dark ? "#icon-sun" : "#icon-moon");
      if (persist) {
        try {
          localStorage.setItem(storageKey, theme);
        } catch {
          // Theme switching still works when storage is unavailable.
        }
      }
    };

    const closeMenu = () => {
      siteHeader.dataset.menuOpen = "false";
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
    };

    setTheme(initialTheme, false);
    themeToggle.addEventListener("click", () => {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });

    menuToggle.addEventListener("click", () => {
      const isOpen = siteHeader.dataset.menuOpen === "true";
      siteHeader.dataset.menuOpen = String(!isOpen);
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Open navigation menu" : "Close navigation menu",
      );
    });

    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && siteHeader.dataset.menuOpen === "true") {
        closeMenu();
        menuToggle.focus();
      }
    });

    desktopQuery.addEventListener("change", closeMenu);
    year.textContent = String(new Date().getFullYear());

    const serviceSearch = document.querySelector("#service-search");
    const serviceReset = document.querySelector("#service-reset");
    const serviceShowAll = document.querySelector("#service-show-all");
    const serviceCards = [...document.querySelectorAll(".service-item")];
    const serviceCategories = [
      ...document.querySelectorAll(".service-category"),
    ];
    const serviceFilterButtons = [
      ...document.querySelectorAll(".service-filter"),
    ];
    const serviceResults = document.querySelector("#service-results");
    const serviceEmpty = document.querySelector("#service-empty");
    const serviceCategoryNotice = document.querySelector(
      "#service-category-notice",
    );
    const serviceCategoryNoticeMessage = document.querySelector(
      "#service-category-notice-message",
    );
    const serviceSuggestions = document.querySelector("#service-suggestions");
    const serviceSuggestionsNote = document.querySelector(
      "#service-suggestions-note",
    );
    const serviceSuggestionList = document.querySelector(
      "#service-suggestion-list",
    );
    const normalizeServiceName = (value) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    const serviceByName = new Map(
      serviceCards.map((card) => [
        normalizeServiceName(card.querySelector("h4").textContent.trim()),
        card,
      ]),
    );
    const serviceRelations = [
      {
        terms: ["charger"],
        names: [
          "Charging Port Replacement",
          "Charging IC Repair",
          "Charging Flex Replacement",
          "Fast Charging Repair",
          "Wireless Charging Repair",
        ],
      },
      {
        terms: ["charge", "charging"],
        names: [
          "Charging Port Replacement",
          "Charging IC Repair",
          "Charging Flex Replacement",
          "Battery Connector Repair",
          "Fast Charging Repair",
          "Wireless Charging Repair",
        ],
      },
      {
        terms: ["battery"],
        names: ["Battery Replacement", "Battery Connector Repair"],
      },
      {
        terms: ["screen", "display"],
        names: [
          "LCD Replacement",
          "Screen Replacement",
          "Touchscreen Repair",
          "Backlight Repair",
          "Display Connector Repair",
          "Screen Protector Installation",
        ],
      },
      {
        terms: ["power button"],
        names: ["Power Button Repair", "Button Flex Replacement"],
      },
      {
        terms: ["volume", "volume button"],
        names: ["Volume Button Repair", "Button Flex Replacement"],
      },
      {
        terms: ["camera"],
        names: [
          "Camera Replacement",
          "Front Camera Repair",
          "Back Camera Repair",
          "Camera Glass Replacement",
          "Rear Camera Lens Replacement",
        ],
      },
      {
        terms: ["front cam", "front camera"],
        names: ["Front Camera Repair", "Camera Replacement"],
      },
      {
        terms: ["rear cam", "rear camera"],
        names: [
          "Back Camera Repair",
          "Camera Replacement",
          "Rear Camera Lens Replacement",
        ],
      },
      {
        terms: ["speaker"],
        names: ["Speaker Repair", "Earpiece Replacement", "Audio IC Repair"],
      },
      {
        terms: ["mic", "microphone"],
        names: ["Microphone Repair", "Audio IC Repair"],
      },
      { terms: ["no signal"], names: ["Network Signal Repair"] },
      { terms: ["wifi", "wi fi"], names: ["Wi-Fi Repair"] },
      {
        terms: ["wet phone", "nabasa", "water damage"],
        names: ["Water Damage Repair"],
      },
      {
        terms: ["stuck logo"],
        names: ["Phone Stuck on Logo Repair", "Bootloop Repair"],
      },
      {
        terms: ["dead phone"],
        names: ["No Power / Dead Boot Repair"],
      },
      {
        terms: ["face unlock"],
        names: ["Face ID / Face Unlock Repair"],
      },
      {
        terms: ["fingerprint"],
        names: ["Fingerprint Sensor Repair"],
      },
      { terms: ["data recovery"], names: ["Data Recovery"] },
    ];
    const categoryLabels = new Map(
      serviceCategories.map((category) => [
        category.dataset.categoryGroup,
        category.querySelector(".service-category__title").textContent.trim(),
      ]),
    );
    let activeServiceCategory = "all";

    const isOneEditApart = (first, second) => {
      if (first === second || Math.abs(first.length - second.length) > 1) {
        return false;
      }

      if (first.length === second.length) {
        const differences = [];
        for (let index = 0; index < first.length; index += 1) {
          if (first[index] !== second[index]) differences.push(index);
        }
        if (differences.length === 1) return true;
        return (
          differences.length === 2 &&
          differences[1] === differences[0] + 1 &&
          first[differences[0]] === second[differences[1]] &&
          first[differences[1]] === second[differences[0]]
        );
      }

      const shorter = first.length < second.length ? first : second;
      const longer = first.length < second.length ? second : first;
      let shortIndex = 0;
      let longIndex = 0;
      let skipped = false;

      while (shortIndex < shorter.length && longIndex < longer.length) {
        if (shorter[shortIndex] === longer[longIndex]) {
          shortIndex += 1;
          longIndex += 1;
        } else if (skipped) {
          return false;
        } else {
          skipped = true;
          longIndex += 1;
        }
      }
      return true;
    };

    const findRelatedServices = (query) => {
      const exactRules = serviceRelations.filter((rule) =>
        rule.terms.includes(query),
      );
      let matchingRules = exactRules.length
        ? exactRules
        : serviceRelations.filter((rule) =>
            rule.terms.some((term) => query.includes(term)),
          );
      let correction = "";

      if (!matchingRules.length && !query.includes(" ") && query.length >= 4) {
        const closeTerms = [
          ...new Set(serviceRelations.flatMap((rule) => rule.terms)),
        ].filter(
          (term) =>
            !term.includes(" ") &&
            term.length >= 5 &&
            isOneEditApart(query, term),
        );

        if (closeTerms.length) {
          correction = closeTerms[0];
          matchingRules = serviceRelations.filter((rule) =>
            rule.terms.includes(correction),
          );
        }
      }

      const relatedCards = [];
      const includedCards = new Set();
      matchingRules.forEach((rule) => {
        rule.names.forEach((name) => {
          const card = serviceByName.get(normalizeServiceName(name));
          if (card && !includedCards.has(card)) {
            includedCards.add(card);
            relatedCards.push(card);
          }
        });
      });
      return { cards: relatedCards, correction };
    };

    const setActiveServiceCategory = (category) => {
      activeServiceCategory = category;
      serviceFilterButtons.forEach((button) => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.categoryFilter === category),
        );
      });
    };

    const makeSuggestionButton = (card) => {
      const title = card.querySelector("h4").textContent.trim();
      const description = card.querySelector("p").textContent.trim();
      const button = document.createElement("button");
      button.className = "service-suggestion";
      button.type = "button";
      button.dataset.serviceName = normalizeServiceName(title);
      button.setAttribute("aria-label", `View ${title} in the service results`);

      const icon = card.querySelector(".service-item__icon").cloneNode(true);
      const copy = document.createElement("span");
      copy.className = "service-suggestion__copy";
      const name = document.createElement("span");
      name.className = "service-suggestion__name";
      name.textContent = title;
      const detail = document.createElement("span");
      detail.className = "service-suggestion__description";
      detail.textContent = description;
      const arrow = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      arrow.setAttribute("class", "icon icon--small service-suggestion__arrow");
      arrow.setAttribute("aria-hidden", "true");
      const arrowUse = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "use",
      );
      arrowUse.setAttribute("href", "#icon-arrow");
      arrow.append(arrowUse);
      copy.append(name, detail);
      button.append(icon, copy, arrow);
      return button;
    };

    const updateServiceCatalog = () => {
      const query = normalizeServiceName(serviceSearch.value.trim());
      const exactMatches = query
        ? serviceCards.filter((card) =>
            normalizeServiceName(card.querySelector("h4").textContent).includes(
              query,
            ),
          )
        : [];
      const related = query
        ? findRelatedServices(query)
        : { cards: [], correction: "" };
      const isInActiveCategory = (card) =>
        activeServiceCategory === "all" ||
        card.dataset.category === activeServiceCategory;
      const exactInCategory = exactMatches.filter(isInActiveCategory);
      const relatedInCategory = related.cards.filter(isInActiveCategory);
      const mainMatches = !query
        ? serviceCards.filter(isInActiveCategory)
        : exactInCategory.length
          ? [...new Set([...exactInCategory, ...relatedInCategory])]
          : [];
      const mainMatchSet = new Set(mainMatches);
      const exactMatchSet = new Set(exactInCategory);
      const fallbackSuggestions =
        query && exactMatches.length === 0 ? relatedInCategory : [];
      const allRelevantMatches = [
        ...new Set([...exactMatches, ...related.cards]),
      ];
      const categoryExcludedMatches = allRelevantMatches.filter(
        (card) => !isInActiveCategory(card),
      );

      serviceCards.forEach((card) => {
        card.hidden = !mainMatchSet.has(card);
        card.style.order = exactMatchSet.has(card) ? "-1" : "";
      });

      serviceCategories.forEach((category) => {
        category.hidden =
          category.querySelector(".service-item:not([hidden])") === null;
      });
      serviceSuggestions.hidden = fallbackSuggestions.length === 0;
      serviceSuggestionList.replaceChildren(
        ...fallbackSuggestions.map(makeSuggestionButton),
      );
      serviceSuggestionsNote.textContent = related.correction
        ? `No exact name match for "${serviceSearch.value.trim()}". These are possible matches for "${related.correction}"; select one to view it in the catalog.`
        : `No exact service name matches "${serviceSearch.value.trim()}". These related services may help; select one to view it in the catalog.`;
      serviceCategoryNotice.hidden = categoryExcludedMatches.length === 0;
      if (!serviceCategoryNotice.hidden) {
        const categoryLabel = categoryLabels.get(activeServiceCategory);
        const count = categoryExcludedMatches.length;
        serviceCategoryNoticeMessage.textContent = `The ${categoryLabel} filter is hiding ${count} other matching or related ${count === 1 ? "service" : "services"}. Switch to All Services to see them.`;
      }

      const hasNoKnownMatch =
        query && exactMatches.length === 0 && related.cards.length === 0;
      serviceEmpty.hidden = !hasNoKnownMatch;

      if (!query) {
        serviceResults.textContent =
          activeServiceCategory === "all"
            ? `Showing all ${mainMatches.length} services`
            : `Showing ${mainMatches.length} of ${serviceCards.length} services in ${categoryLabels.get(activeServiceCategory)}`;
      } else if (exactInCategory.length) {
        const relatedCount = mainMatches.length - exactInCategory.length;
        const categorySuffix =
          activeServiceCategory === "all"
            ? ""
            : ` in ${categoryLabels.get(activeServiceCategory)}`;
        serviceResults.textContent = `${exactInCategory.length} name ${exactInCategory.length === 1 ? "match" : "matches"}${relatedCount ? ` + ${relatedCount} related ${relatedCount === 1 ? "service" : "services"}` : ""}; ${mainMatches.length} shown${categorySuffix} of ${serviceCards.length} total.${categoryExcludedMatches.length ? ` ${categoryExcludedMatches.length} relevant services are outside this category.` : ""}`;
      } else if (fallbackSuggestions.length) {
        const suggestionType = related.correction
          ? `possible typo ${fallbackSuggestions.length === 1 ? "suggestion" : "suggestions"}`
          : `related ${fallbackSuggestions.length === 1 ? "suggestion" : "suggestions"}`;
        serviceResults.textContent = `0 name matches; ${fallbackSuggestions.length} ${suggestionType}; ${serviceCards.length} services total.${categoryExcludedMatches.length ? ` ${categoryExcludedMatches.length} related services are outside this category.` : ""}`;
      } else if (categoryExcludedMatches.length) {
        serviceResults.textContent = `0 name matches in ${categoryLabels.get(activeServiceCategory)}; ${categoryExcludedMatches.length} matching or related services are outside this category; ${serviceCards.length} services total.`;
      } else {
        serviceResults.textContent = `0 name matches; 0 related suggestions; ${serviceCards.length} services total.`;
      }
    };

    serviceSearch.addEventListener("input", updateServiceCatalog);
    serviceFilterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveServiceCategory(button.dataset.categoryFilter);
        updateServiceCatalog();
      });
    });
    serviceReset.addEventListener("click", () => {
      serviceSearch.value = "";
      setActiveServiceCategory("all");
      updateServiceCatalog();
      serviceSearch.focus();
    });
    serviceShowAll.addEventListener("click", () => {
      setActiveServiceCategory("all");
      updateServiceCatalog();
      serviceFilterButtons
        .find((button) => button.dataset.categoryFilter === "all")
        .focus();
    });
    serviceSuggestionList.addEventListener("click", (event) => {
      const suggestion = event.target.closest("[data-service-name]");
      if (!suggestion) return;

      const card = serviceByName.get(suggestion.dataset.serviceName);
      if (!card) return;

      serviceSearch.value = card.querySelector("h4").textContent.trim();
      updateServiceCatalog();
      card.classList.add("is-visible");
      card.setAttribute("tabindex", "-1");
      card.focus({ preventScroll: true });
      card.scrollIntoView({
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
        block: "center",
      });
    });
    updateServiceCatalog();

    const revealElements = document.querySelectorAll(
      ".reveal, .reveal-stagger > *",
    );
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (
      revealElements.length &&
      !reducedMotionQuery.matches &&
      "IntersectionObserver" in window
    ) {
      let revealObserver;
      try {
        revealObserver = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -32px 0px" },
        );

        root.classList.add("has-reveal");
        revealElements.forEach((element) => revealObserver.observe(element));

        reducedMotionQuery.addEventListener("change", (event) => {
          if (event.matches) {
            revealObserver.disconnect();
            root.classList.remove("has-reveal");
            revealElements.forEach((element) =>
              element.classList.add("is-visible"),
            );
          }
        });
      } catch {
        revealObserver?.disconnect();
        root.classList.remove("has-reveal");
      }
    }
  });
})();
