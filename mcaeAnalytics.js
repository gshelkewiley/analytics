
(() => {
  "use strict";

  // CORE

  const Core = (() => {
    window.adobeDataLayer = window.adobeDataLayer || [];

    const toLower = (value) => String(value ?? "").toLowerCase();

    const pushEvent = (event) => {
      try {
        window.adobeDataLayer.push(event);

        if (window.enableLogging) {
          console.log(
            `DataLayer for ${window.location.href}:`,
            JSON.stringify(window.adobeDataLayer, null, 2)
          );
        }
      } catch (error) {
        console.error(
          "[wiley-tracking] adobeDataLayer.push threw:",
          error,
          event
        );
      }
    };

    const getAttribute = (element, attribute, fallback = "") =>
      element?.getAttribute?.(attribute) || fallback;

    const getElementText = (element) => {
      if (!element) return "";

      const clone = element.querySelector?.("style, script, noscript, template")
        ? element.cloneNode(true)
        : element;

      if (clone !== element) {
        clone
          .querySelectorAll("style, script, noscript, template")
          .forEach((node) => node.remove());
      }

      return (clone.innerText || clone.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
    };

    return {
      toLower,
      getAttribute,
      getElementText,
      pushEvent,
    };
  })();

  window.wileyPushEvent = Core.pushEvent;

  // PAGE

  const Page = (() => {
    const ERROR_MESSAGES = {
      400: "bad request",
      401: "unauthorized",
      403: "forbidden",
      404: "page not found",
      500: "internal server error",
      502: "bad gateway",
      503: "service unavailable",
      504: "gateway timeout",
    };

    const ERROR_PATTERNS = [
      { regex: /\b404\b|not[\s-]?found/i, code: "404" },
      { regex: /\b403\b|forbidden/i, code: "403" },
      { regex: /\b401\b|unauthorized/i, code: "401" },
      { regex: /\b400\b|bad[\s-]?request/i, code: "400" },
      { regex: /\b500\b|internal[\s-]?server[\s-]?error/i, code: "500" },
      { regex: /\b502\b|bad[\s-]?gateway/i, code: "502" },
      { regex: /\b503\b|service[\s-]?unavailable/i, code: "503" },
      { regex: /\b504\b|gateway[\s-]?timeout/i, code: "504" },
    ];

    const SUPPORTED_LANGUAGES = new Set([
      "en",
      "fr",
      "es",
      "de",
      "it",
      "pt",
      "zh",
      "ja",
      "ko",
    ]);

    const getUrlSegments = () =>
      window.location.pathname.split("/").filter(Boolean);

    const getLocale = () => {
      const firstSegment = getUrlSegments()[0] || "";

      return /^[a-z]{2}-[a-z]{2}$/i.test(firstSegment)
        ? firstSegment.toLowerCase()
        : "";
    };

    const getContentSegments = () => {
      const segments = getUrlSegments();
      return getLocale() ? segments.slice(1) : segments;
    };

    const getPageMeta = (attribute) =>
      document.querySelector(`[${attribute}]`)?.getAttribute(attribute) || "";

    const getAncestorSegments = () => getContentSegments().slice(0, -1);

    const getPageName = () => {
      const segments = getContentSegments();
      const lastSegment = segments[segments.length - 1] || "";

      return Core.toLower(lastSegment.split(".")[0]);
    };

    const getSection = () =>
      Core.toLower(getContentSegments()[0] || "");

    const getSubSection = () =>
      Core.toLower(getAncestorSegments()[1] || "");

    const getSubSubSection = () =>
      Core.toLower(getAncestorSegments().slice(2).join("/"));

    const getPageLanguage = () => {
      const locale = getLocale();

      if (locale) {
        const [first, second] = locale.split("-");

        if (SUPPORTED_LANGUAGES.has(first)) return first;
        if (SUPPORTED_LANGUAGES.has(second)) return second;
      }

      return Core.toLower(
        (document.documentElement.lang || "en").split("-")[0]
      );
    };

    const getPageNumber = () => {
      const params = new URLSearchParams(window.location.search);

      for (const parameter of ["page", "pageNumber", "p"]) {
        const value = params.get(parameter);

        if (value && /^\d+$/.test(value)) {
          return value;
        }
      }

      return "";
    };

    const getBreadcrumb = () => {
      const breadcrumb = document.querySelector(
        "[itemtype*='BreadcrumbList' i]"
      );

      if (breadcrumb) {
        const names = Array.from(
          breadcrumb.querySelectorAll(
            "[itemprop='itemListElement'] [itemprop='name']"
          )
        )
          .map((element) => (element.textContent || "").trim())
          .filter(Boolean);

        if (names.length) {
          return Core.toLower(names.join(" > "));
        }
      }

      const dataBreadcrumb = document.body?.getAttribute("data-breadcrumb");

      if (dataBreadcrumb) {
        return Core.toLower(dataBreadcrumb);
      }

      return getContentSegments().length ? "" : "home";
    };

    const getPageCategory = () => {
      const path = `/${getContentSegments().join("/")}`;

      if (/^\/(?:errors?(?:\/.*)?|404)\/?$/i.test(path)) {
        return "error";
      }

      const category =
        getPageMeta("data-page-category") ||
        window.wileyPageCategory ||
        "";

      return Core.toLower(category) || "other";
    };

    const getUserData = () => {
      const user = window.wileyUser || {};

      return {
        loginStatus: Core.toLower(user.loginStatus || "not-logged-in"),
        loginType: Core.toLower(user.loginType || ""),
        adminType: Core.toLower(user.adminType || "non-admin"),
        almId: Core.toLower(user.almId || ""),
        connectId: Core.toLower(user.connectId || ""),
      };
    };

    const buildPageViewPayload = () => ({
      event: "pageView",

      site: {
        name: Core.toLower(window.location.hostname),
        platform: "web",
        locale: getLocale(),
      },

      page: {
        pageName: getPageName(),
        section: getSection(),
        subSection: getSubSection(),
        subSubSection: getSubSubSection(),
        pageLanguage: getPageLanguage(),
        pageCategory: "Campaign Form",/*getPageCategory(),*/
        pageTemplate: "MCAE Core Template Value",/*Core.toLower(
          getPageMeta("data-page-template")
        ),*/
        pageBuild: "MCAE",
        pageNumber: getPageNumber(),
        breadcrumb: getBreadcrumb(),
      },

      user: getUserData(),
    });

    const getServerError = () => {
      const heading = (document.querySelector("h1")?.textContent || "").trim();

      const buildError = (code) => ({
        serverErrorCode: code,
        errorMessage: Core.toLower(
          heading ||
            (code && ERROR_MESSAGES[Number(code)]) ||
            (code ? `error ${code}` : "")
        ),
      });

      const pathMatch = window.location.pathname.match(
        /(?:^|\/)errors\/(\d{3})(?:\/|$)/i
      );

      if (pathMatch) {
        return buildError(pathMatch[1]);
      }

      const pageContent = [
        window.location.pathname,
        document.title || "",
        heading,
      ].join(" ");

      for (const { regex, code } of ERROR_PATTERNS) {
        if (regex.test(pageContent)) {
          return buildError(code);
        }
      }

      if (/(?:^|\/)errors(?:\/|$)/i.test(window.location.pathname)) {
        return buildError("");
      }

      return null;
    };

    let pageViewFlushed = false;

    const schedulePageView = (payload) => {
      const flush = () => {
        if (pageViewFlushed) return;

        pageViewFlushed = true;
        Core.pushEvent(payload);
      };

      // Preserve the existing public flush API.
      window.wileyFlushPageView = flush;

      flush();
    };

    const init = () => {
      const serverError = getServerError();

      if (serverError) {
        Core.pushEvent({ error: serverError });
      }

      schedulePageView(buildPageViewPayload());
    };

    return {
      init,
      buildPageViewPayload,
      getServerError,
    };
  })();

  // CLICK

  const Click = (() => {
    const CLICK_SELECTOR =
      "a, button, img, [data-track-click], [data-click-category]";

    const CLICK_CATEGORIES = new Set([
      "header",
      "footer",
      "cta",
      "download",
      "jump-link",
      "link",
      "search result",
    ]);

    const HEADER_SELECTOR = "#wiley-header-mount";
    const FOOTER_SELECTOR = "#wiley-footer-mount";

    const DOWNLOAD_EXT_RE =
      /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt|rtf|odt|ods|odp)(?:\?|#|$)/i;

    const CTA_SELECTOR =
      ".cta, .btn_main_wrap, .btn_text_wrap, .btn_icon_wrap, " +
      "[data-button-main], [data-button-text], [data-button-icon]";

    const CLICKABLE_SELECTOR = ".g_clickable_wrap";

    const getEventPath = (event) => {
      if (typeof event.composedPath === "function") {
        const path = event.composedPath();

        if (path?.length) return path;
      }

      const path = [];
      let element = event.target;

      while (element) {
        path.push(element);
        element = element.parentNode || element.host || null;
      }

      return path;
    };

    const findInPath = (path, selector) => {
      for (const element of path) {
        if (element instanceof Element && element.matches?.(selector)) {
          return element;
        }
      }

      return null;
    };

    const getComponentType = (element) => {
      if (
        element.tagName === "BUTTON" ||
        element.getAttribute("role") === "button"
      ) {
        return "button";
      }

      if (
        element.tagName === "A" ||
        element.hasAttribute("href")
      ) {
        return "link";
      }

      if (element.tagName === "IMG") {
        return "image";
      }

      return "link";
    };

    const getComponentText = (element) => {
      if (element.tagName === "IMG") {
        return Core.toLower(
          element.getAttribute("alt") || ""
        );
      }

      return Core.toLower(
        Core.getElementText(element) ||
          element.getAttribute("aria-label") ||
          ""
      );
    };

    const getComponentPosition = (element) => {
      const container = element.closest(
        ".w-slider, .w-dyn-list, [role='list']"
      );

      if (!container) return "";

      const itemSelector =
        ".w-slide, .w-dyn-item, [role='listitem']";

      const items = container.querySelectorAll(itemSelector);
      const item = element.closest(itemSelector);

      if (!item || !items.length) return "";

      const index = Array.from(items).indexOf(item);

      return index >= 0 ? String(index + 1) : "";
    };

    const isDownloadLink = (element) => {
      if (element.hasAttribute("data-track-download")) {
        return true;
      }

      if (element.tagName === "A") {
        return DOWNLOAD_EXT_RE.test(
          element.getAttribute("href") || ""
        );
      }

      return false;
    };

    const getDownloadFileName = (element) => {
      const explicitName = element.getAttribute(
        "data-track-download"
      );

      if (explicitName && explicitName !== "true") {
        return explicitName;
      }

      const href = element.getAttribute("href") || "";

      try {
        const path = new URL(href, window.location.origin)
          .pathname
          .split("/")
          .filter(Boolean);

        return path[path.length - 1] || "";
      } catch {
        return (
          href
            .split(/[?#]/)[0]
            .split("/")
            .filter(Boolean)
            .pop() || ""
        );
      }
    };

    const isJumpLink = (element) => {
      if (element.tagName !== "A") return false;

      const href = element.getAttribute("href") || "";

      return href.startsWith("#") && href.length > 1;
    };

    const isCta = (element) =>
      Boolean(
        element.matches?.(CTA_SELECTOR) ||
          element.closest?.(CTA_SELECTOR)
      );

    const isGenericLink = (element) =>
      Boolean(
        element.matches?.(CLICKABLE_SELECTOR) ||
          element.closest?.(CLICKABLE_SELECTOR)
      );

    const getClickAreaCategory = (element, eventPath) => {
      if (findInPath(eventPath, HEADER_SELECTOR)) {
        return null;
      }

      const explicitCategoryElement =
        element.closest?.("[data-click-category]");

      const explicitCategory = Core.toLower(
        explicitCategoryElement?.getAttribute(
          "data-click-category"
        ) || ""
      );

      if (CLICK_CATEGORIES.has(explicitCategory)) {
        return explicitCategory;
      }

      if (isDownloadLink(element)) {
        return "download";
      }

      if (findInPath(eventPath, FOOTER_SELECTOR)) {
        return "footer";
      }

      if (isJumpLink(element)) {
        return "jump-link";
      }

      if (isCta(element)) {
        return "cta";
      }

      if (isGenericLink(element)) {
        return "link";
      }

      return null;
    };

    const getParentComponent = (element) => {
      if (
        element.getAttribute("data-parent-component-name") !== null
      ) {
        return {
          id: Core.toLower(
            element.getAttribute("data-parent-component-id") || ""
          ),
          name: Core.toLower(
            element.getAttribute("data-parent-component-name") || ""
          ),
          text: Core.toLower(
            element.getAttribute("data-parent-component-text") || ""
          ),
        };
      }

      const parent = element.closest("[data-component-name]");

      if (!parent || parent === element) {
        return {
          id: "",
          name: "",
          text: "",
        };
      }

      const id = Core.toLower(
        parent.getAttribute("data-component-id") || ""
      );

      const name = Core.toLower(
        parent.getAttribute("data-component-name") || ""
      );

      const title = parent.getAttribute("data-component-title");

      if (title) {
        return {
          id,
          name,
          text: Core.toLower(title),
        };
      }

      const heading =
        parent.querySelector(
          "h1, h2, h3, h4, h5, h6"
        )?.textContent || "";

      return {
        id,
        name,
        text: Core.toLower(
          heading.replace(/\s+/g, " ").trim()
        ),
      };
    };

    const getParentComponentType = (element, category) => {
      const explicitType = Core.toLower(
        element.getAttribute("data-parent-component-type")
      );

      if (explicitType) return explicitType;
      if (category === "footer") return "footer";
      if (element.closest("nav")) return "nav";
      if (element.closest("section")) return "section";

      return "";
    };

    const getLinkUrl = (element) => {
      if (
        element.tagName === "A" ||
        element.tagName === "AREA"
      ) {
        return Core.toLower(
          element.href ||
            element.getAttribute("href") ||
            ""
        );
      }

      return Core.toLower(
        element.getAttribute("href") || ""
      );
    };

    const getJournalContext = (element) => {
      const journal = element.closest?.(
        "[data-journal-id], [data-journal-title]"
      );

      if (!journal) return null;

      return {
        journalId: Core.toLower(
          journal.getAttribute("data-journal-id") || ""
        ),
        journalTitle: Core.toLower(
          journal.getAttribute("data-journal-title") || ""
        ),
      };
    };

    const getProductCode = (element) => {
      const component = element.closest?.(
        "[data-component-product-code], [data-product-code]"
      );

      return Core.toLower(
        component?.getAttribute("data-component-product-code") ||
          component?.getAttribute("data-product-code") ||
          ""
      );
    };

    const collectClickContext = (element, category) => {
      const isDownload = category === "download";

      const componentType =
        Core.toLower(
          element.getAttribute("data-component-type")
        ) ||
        (isDownload ? "button" : getComponentType(element));

      const defaultText = isDownload
        ? Core.toLower(
            getDownloadFileName(element) ||
              getComponentText(element)
          )
        : getComponentText(element);

      return {
        clickCategory: category,
        componentId: Core.toLower(
          element.getAttribute("data-component-id")
        ),
        componentName: Core.toLower(
          element.getAttribute("data-component-name")
        ),
        componentType,
        componentText:
          Core.toLower(
            element.getAttribute("data-component-text")
          ) || defaultText,
        componentPosition:
          Core.toLower(
            element.getAttribute("data-component-position")
          ) || getComponentPosition(element),
        componentProductCode: getProductCode(element),
        linkURL: getLinkUrl(element),
        parent: getParentComponent(element),
        parentType: getParentComponentType(
          element,
          category
        ),
        journal: getJournalContext(element),
      };
    };

    const shouldDelayNavigation = (event, element) => {
      if (element.tagName !== "A") return false;
      if (event.button !== 0) return false;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return false;
      }

      const href = element.getAttribute("href");

      return (
        Boolean(href) &&
        !href.startsWith("#") &&
        element.getAttribute("target") !== "_blank"
      );
    };

    const handleClick = (event) => {
      if (event._adobeProcessed) return;

      event._adobeProcessed = true;

      const eventPath = getEventPath(event);
      const element = findInPath(
        eventPath,
        CLICK_SELECTOR
      );

      if (
        !element ||
        findInPath(
          eventPath,
          "[data-track-click='false']"
        )
      ) {
        return;
      }

      const category = getClickAreaCategory(
        element,
        eventPath
      );

      if (!category) return;

      let payload;

      try {
        const context = collectClickContext(
          element,
          category
        );

        payload = {
          event: "click",

          component: {
            clickCategory: context.clickCategory,
            componentId: context.componentId,
            componentName: context.componentName,
            componentPosition: context.componentPosition,
            componentProductCode:
              context.componentProductCode,
            componentText: context.componentText,
            componentType: context.componentType,
            linkURL: context.linkURL,
            parentComponentId: context.parent.id,
            parentComponentName: context.parent.name,
            parentComponentText: context.parent.text,
            parentComponentType: context.parentType,
          },
        };

        if (context.journal) {
          payload.journal = context.journal;
        }
      } catch (error) {
        console.error(
          "[wiley-tracking] click payload build threw:",
          error,
          element
        );
        return;
      }

      Core.pushEvent(payload);

      if (!shouldDelayNavigation(event, element)) {
        return;
      }

      event.preventDefault();

      window.setTimeout(() => {
        window.location.assign(element.href);
      }, 150);
    };

    const init = () => {
      document.addEventListener(
        "click",
        handleClick,
        true
      );
    };

    return { init };
  })();

  // FORMS

  const Forms = (() => {
    const FORM_STARTED_FLAG = "wileyFormStarted";

    const pushFormEvent = (
      eventName,
      formMeta,
      fieldData = {}
    ) => {
      Core.pushEvent({
        event: eventName,

        form: {
          formName: String(formMeta.formName ?? ""),
          formCategory: String(
            formMeta.formCategory ?? ""
          ),
          formId: String(formMeta.formId ?? ""),
          formFieldName: String(
            fieldData.formFieldName ?? ""
          ),
          errorCode: String(
            fieldData.errorCode ?? ""
          ),
          errorMessage: String(
            fieldData.errorMessage ?? ""
          ),
        },
      });
    };

    const getFormMeta = (
      element,
      defaultName,
      defaultId
    ) => {
      const form =
        element.closest?.("[data-form-name]") ||
        element;

      const getAttribute = (attribute) =>
        form.getAttribute?.(attribute)?.trim() || "";

      return {
        formName:
          getAttribute("data-form-name") ||
          defaultName,

        formCategory:
          getAttribute("data-form-category") ||
          "general",

        formId:
          getAttribute("data-form-id") ||
          defaultId ||
          "",
      };
    };

    const getFormFieldName = (element) =>
      element?.getAttribute &&
      (
        element.getAttribute(
          "data-form-field-name"
        ) ||
        element.getAttribute("name") ||
        element.getAttribute("data-name") ||
        element.id ||
        element.getAttribute("aria-label")
      ) ||
      "";

    const setFormStartedFlag = (formName) => {
      try {
        window.sessionStorage.setItem(
          FORM_STARTED_FLAG,
          formName
        );
      } catch {
        // Storage may be unavailable due to browser privacy settings.
      }
    };

    const clearFormStartedFlag = () => {
      try {
        window.sessionStorage.removeItem(
          FORM_STARTED_FLAG
        );
      } catch {
        // Storage may be unavailable due to browser privacy settings.
      }
    };

    // Preserve existing public API.
    window.wileyTrackFormError = (
      formName,
      formCategory,
      errorCode,
      errorMessage,
      formId
    ) => {
      pushFormEvent(
        "formError",
        {
          formName,
          formCategory,
          formId,
        },
        {
          errorCode,
          errorMessage,
        }
      );
    };

    // -------------------------------------------------------------------------
    // Marketo
    // -------------------------------------------------------------------------

    const attachMarketoForms = () => {
      window.MktoForms2.whenReady((form) => {
        const formElement =
          form.getFormElem()[0];

        const meta = getFormMeta(
          formElement,
          `form-${form.getId()}`,
          formElement.id ||
            `mktoForm_${form.getId()}`
        );

        let started = false;

        form
          .getFormElem()
          .on(
            "change",
            "input, select, textarea",
            (event) => {
              if (started) return;

              started = true;

              setFormStartedFlag(meta.formName);

              pushFormEvent(
                "formStart",
                meta,
                {
                  formFieldName:
                    getFormFieldName(
                      event?.target
                    ),
                }
              );
            }
          );

        form.onSubmit(() => {
          pushFormEvent(
            "formSubmit",
            meta
          );
        });

        form.onSuccess(() => {
          clearFormStartedFlag();

          pushFormEvent(
            "formSubmitted",
            meta
          );

          return false;
        });
      });
    };

    const initMarketoForms = () => {
      let attempts = 0;

      const waitForMarketo = () => {
        if (
          window.MktoForms2 &&
          typeof window.MktoForms2.whenReady ===
            "function"
        ) {
          attachMarketoForms();
          return;
        }

        attempts += 1;

        if (attempts > 40) return;

        window.setTimeout(
          waitForMarketo,
          250
        );
      };

      waitForMarketo();
    };

    // -------------------------------------------------------------------------
    // Webflow
    // -------------------------------------------------------------------------

    const isExcludedForm = (form) =>
      form.id?.startsWith("mktoForm") ||
      form.closest(".mktoForm") ||
      isListFilterForm(form);

    const isListFilterForm = (form) =>
      Boolean(
        form.matches?.(
          "[fs-list-element='filters'], [data-search-filters]"
        ) ||
          form.closest?.(
            "[fs-list-element='filters'], [data-search-filters]"
          ) ||
          form.querySelector(
            "[fs-list-field], [data-search-input], [data-search-filter]"
          )
      );

    const attachWebflowForm = (form, index) => {
      if (isExcludedForm(form)) return;

      const formContainer =
        form.closest(".w-form") || form;

      const meta = getFormMeta(
        formContainer,
        form.getAttribute("data-name") ||
          `form-${index + 1}`,
        form.id
      );

      let started = false;

      const handleFormStart = (event) => {
        if (started) return;

        started = true;

        setFormStartedFlag(
          meta.formName
        );

        pushFormEvent(
          "formStart",
          meta,
          {
            formFieldName:
              getFormFieldName(
                event?.target
              ),
          }
        );
      };

      form.addEventListener(
        "input",
        handleFormStart
      );

      form.addEventListener(
        "change",
        handleFormStart
      );

      form.addEventListener(
        "submit",
        () => {
          pushFormEvent(
            "formSubmit",
            meta
          );
        }
      );

      const successMessage =
        formContainer.querySelector(
          ".w-form-done"
        );

      const errorMessage =
        formContainer.querySelector(
          ".w-form-fail"
        );

      if (
        !successMessage &&
        !errorMessage
      ) {
        return;
      }

      const isVisible = (element) =>
        Boolean(
          element &&
          window.getComputedStyle(
            element
          ).display !== "none"
        );

      let submitted = false;
      let failed = false;

      new MutationObserver(() => {
        if (
          !submitted &&
          isVisible(successMessage)
        ) {
          submitted = true;
          clearFormStartedFlag();

          pushFormEvent(
            "formSubmitted",
            meta
          );
        }

        if (isVisible(errorMessage)) {
          if (!failed) {
            failed = true;

            pushFormEvent(
              "formError",
              meta,
              {
                errorCode:
                  "submit_failed",
                errorMessage:
                  "form submission failed",
              }
            );
          }
        } else {
          failed = false;
        }
      }).observe(formContainer, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          "style",
          "class",
        ],
      });
    };

    const attachWebflowForms = () => {
      document
        .querySelectorAll("form")
        .forEach(attachWebflowForm);
    };

    const init = () => {
      if (document.querySelector("form")) {
        attachWebflowForms();
      }

      if (
        document.querySelector(
          "form[id^='mktoForm'], .mktoForm, [data-marketo]"
        )
      ) {
        initMarketoForms();
      }
    };

    return {
      init,
      pushFormEvent,
    };
  })();

  // INITIALIZATION

  const initTracking = () => {
    Page.init();
    Click.init();
    Forms.init();
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initTracking,
      { once: true }
    );
  } else {
    initTracking();
  }
})();
