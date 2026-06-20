/* LANDOS - interactive behavior */
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const money = (value) => Math.round(value).toLocaleString("ru-RU") + " ₽";

  /* Replace native system dropdowns with branded, accessible menus. */
  const enhancedSelects = [];

  function enhanceSelect(select) {
    if (!select || select.dataset.enhanced === "true") return;

    const wrapper = document.createElement("div");
    const trigger = document.createElement("button");
    const menu = document.createElement("div");
    const menuId = (select.id || "select") + "-menu";
    const label = select.getAttribute("aria-label") || "Выберите вариант";

    wrapper.className = "custom-select";
    trigger.className = "custom-select__trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);
    trigger.setAttribute("aria-label", label);
    menu.className = "custom-select__menu";
    menu.id = menuId;
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger, menu);
    select.classList.add("custom-select__native");
    select.dataset.enhanced = "true";
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const optionButtons = Array.from(select.options).map((option, index) => {
      const button = document.createElement("button");
      button.className = "custom-select__option";
      button.type = "button";
      button.textContent = option.textContent;
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      menu.appendChild(button);
      return button;
    });

    const sync = () => {
      trigger.textContent = select.options[select.selectedIndex]?.textContent || label;
      optionButtons.forEach((button, index) => {
        button.setAttribute("aria-selected", String(index === select.selectedIndex));
      });
    };

    const close = (returnFocus = false) => {
      menu.hidden = true;
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) trigger.focus();
    };

    const open = () => {
      enhancedSelects.forEach((item) => item.close());
      menu.hidden = false;
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    };

    trigger.addEventListener("click", () => {
      if (menu.hidden) open();
      else close();
    });

    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        open();
        optionButtons[select.selectedIndex]?.focus();
      }
      if (event.key === "Escape") close();
    });

    optionButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        select.selectedIndex = index;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
        close(true);
      });
    });

    menu.addEventListener("keydown", (event) => {
      const activeIndex = optionButtons.indexOf(document.activeElement);
      let nextIndex = activeIndex;

      if (event.key === "ArrowDown") nextIndex = Math.min(optionButtons.length - 1, activeIndex + 1);
      else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex - 1);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = optionButtons.length - 1;
      else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      } else return;

      event.preventDefault();
      optionButtons[nextIndex]?.focus();
    });

    select.addEventListener("change", sync);
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) close();
    });

    enhancedSelects.push({ close });
    sync();
  }

  $$('select').forEach(enhanceSelect);

  /* Mobile menu */
  const burger = $("#burger");
  const mobileNav = $("#mobileNav");

  if (burger && mobileNav) {
    const toggleMenu = (open) => {
      const shouldOpen = open ?? mobileNav.hidden;
      mobileNav.hidden = !shouldOpen;
      burger.classList.toggle("is-open", shouldOpen);
      burger.setAttribute("aria-expanded", String(shouldOpen));
      document.body.classList.toggle("nav-open", shouldOpen);
    };

    burger.addEventListener("click", () => toggleMenu());
    $$("#mobileNav a").forEach((link) => link.addEventListener("click", () => toggleMenu(false)));
  }

  /* Price calculator */
  const area = $("#area");
  const areaOut = $("#areaOut");
  const totalEl = $("#total");
  const perEl = $("#perMeter");
  const breakdownEl = $("#breakdown");
  const quickArea = $("#quickArea");
  const quickTexture = $("#quickTexture");
  const quickLight = $("#quickLight");
  const quickTotal = $("#quickTotal");
  const quickHint = $("#quickHint");
  const quickApply = $("#quickApply");

  const state = {
    area: area ? Number(area.value) : 18,
    texturePrice: 650,
    textureName: "Матовое полотно",
    colorMult: 1,
    colorName: "Белый",
    extras: [],
  };

  function paintRange() {
    if (!area) return;
    const min = Number(area.min);
    const max = Number(area.max);
    const value = Number(area.value);
    const pct = ((value - min) / (max - min)) * 100;
    area.style.setProperty("--p", pct + "%");
  }

  function readExtras() {
    state.extras = $$("#extraOpts .check input:checked").map((input) => ({
      name: input.dataset.name,
      price: Number(input.dataset.price),
      unit: input.dataset.unit,
    }));
  }

  function extraQuantity(extra, currentArea) {
    if (extra.unit === "м.п.") return Math.max(2, Math.round(Math.sqrt(currentArea) * 1.45));
    if (extra.unit === "точка") return Math.max(2, Math.round(currentArea / 3));
    return 1;
  }

  function extraLabel(extra, qty) {
    if (extra.unit === "м.п.") return `${extra.name} (${qty} м.п.)`;
    if (extra.unit === "точка") return `${extra.name} (${qty} шт)`;
    return extra.name;
  }

  function recalc() {
    if (!area || !totalEl || !perEl || !breakdownEl) return;

    state.area = clamp(Number(area.value) || 18, Number(area.min), Number(area.max));
    area.value = state.area;
    areaOut.textContent = state.area + " м²";

    const baseUnit = state.texturePrice * state.colorMult;
    const base = baseUnit * state.area;
    const lines = [{ name: `${state.textureName}, ${state.colorName}, ${state.area} м²`, sum: base }];

    let extrasTotal = 0;
    state.extras.forEach((extra) => {
      const qty = extraQuantity(extra, state.area);
      const sum = extra.price * qty;
      extrasTotal += sum;
      lines.push({ name: extraLabel(extra, qty), sum });
    });

    const total = base + extrasTotal;
    totalEl.textContent = money(total);
    totalEl.classList.remove("bump");
    void totalEl.offsetWidth;
    totalEl.classList.add("bump");
    perEl.textContent = "≈ " + money(total / state.area) + "/м²";

    breakdownEl.innerHTML = lines
      .map((line) => `<li><span>${line.name}</span><b>${money(line.sum)}</b></li>`)
      .join("") + `<li><span>Итого</span><b>${money(total)}</b></li>`;

    updateQuick();
  }

  function setTextureByPrice(price) {
    const target = $(`#textureOpts .opt[data-price="${price}"]`) || $("#textureOpts .opt");
    if (!target) return;

    $$("#textureOpts .opt").forEach((button) => {
      const active = button === target;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });

    state.texturePrice = Number(target.dataset.price);
    state.textureName = target.dataset.name || target.childNodes[0].textContent.trim();
  }

  function updateQuick() {
    if (!quickArea || !quickTexture || !quickLight || !quickTotal || !quickHint) return;

    const qArea = clamp(Number(quickArea.value) || 18, 5, 120);
    quickArea.value = qArea;
    const texturePrice = Number(quickTexture.value) || 650;
    const selectedLight = quickLight.selectedIndex;
    let lightCost = 0;

    if (selectedLight === 1) lightCost = Math.max(2, Math.round(qArea / 3)) * 350;
    if (selectedLight === 2) lightCost = Math.max(2, Math.round(Math.sqrt(qArea) * 1.45)) * 650;
    if (selectedLight === 3) {
      lightCost = Math.max(2, Math.round(Math.sqrt(qArea) * 1.45)) * 650 + 650;
    }

    quickTotal.textContent = money(qArea * texturePrice + lightCost);
    quickHint.textContent = "за комнату " + qArea + " м²";
  }

  if (area) {
    area.addEventListener("input", () => {
      state.area = Number(area.value);
      paintRange();
      recalc();
    });

    $$("#textureOpts .opt").forEach((button) => {
      button.addEventListener("click", () => {
        setTextureByPrice(Number(button.dataset.price));
        recalc();
      });
    });

    $$("#colorOpts .swatch").forEach((button) => {
      button.addEventListener("click", () => {
        $$("#colorOpts .swatch").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-checked", String(active));
        });
        state.colorMult = Number(button.dataset.mult);
        state.colorName = button.dataset.name;
        recalc();
      });
    });

    $$("#extraOpts .check input").forEach((input) => {
      input.addEventListener("change", () => {
        readExtras();
        recalc();
      });
    });

    [quickArea, quickTexture, quickLight].forEach((control) => {
      if (control) control.addEventListener("input", updateQuick);
      if (control) control.addEventListener("change", updateQuick);
    });

    if (quickApply) {
      quickApply.addEventListener("click", () => {
        area.value = clamp(Number(quickArea.value) || 18, Number(area.min), Number(area.max));
        setTextureByPrice(Number(quickTexture.value));

        const extraInputs = $$("#extraOpts .check input");
        extraInputs.forEach((input) => { input.checked = false; });
        const selectedLight = quickLight ? quickLight.selectedIndex : 0;
        if (selectedLight === 1) {
          const spots = extraInputs.find((input) => input.dataset.name === "Точки света");
          if (spots) spots.checked = true;
        }
        if (selectedLight === 2) {
          const lines = extraInputs.find((input) => input.dataset.name === "Световые линии");
          if (lines) lines.checked = true;
        }
        if (selectedLight === 3) {
          ["Световые линии", "Монтаж люстры"].forEach((name) => {
            const input = extraInputs.find((item) => item.dataset.name === name);
            if (input) input.checked = true;
          });
        }

        readExtras();
        paintRange();
        recalc();
      });
    }

    paintRange();
    readExtras();
    recalc();
  }

  /* Lighting calculator */
  const lightArea = $("#lightArea");
  const lightRoom = $("#lightRoom");
  const lightSpots = $("#lightSpots");
  const lightPower = $("#lightPower");
  const lightLm = $("#lightLm");

  function calcLight() {
    if (!lightArea || !lightRoom || !lightSpots || !lightPower || !lightLm) return;

    const roomArea = Math.max(1, Number(lightArea.value) || 1);
    const norm = Number(lightRoom.value);
    const spots = Math.max(1, Math.ceil((roomArea * norm) / 5));
    const power = spots * 8;
    const lm = Math.round(power * 75);

    lightSpots.textContent = spots + " шт";
    lightPower.textContent = power + " Вт";
    lightLm.textContent = "≈ " + lm.toLocaleString("ru-RU") + " лм";
  }

  if (lightArea && lightRoom) {
    lightArea.addEventListener("input", calcLight);
    lightRoom.addEventListener("change", calcLight);
    calcLight();
  }

  /* Promo countdown to end of current month */
  const timerEls = {
    days: $("#tDays"),
    hours: $("#tHours"),
    mins: $("#tMins"),
    secs: $("#tSecs"),
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function tickTimer() {
    if (!timerEls.days) return;

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    let diff = Math.max(0, end - now);
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const mins = Math.floor(diff / 60000);
    diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);

    timerEls.days.textContent = pad(days);
    timerEls.hours.textContent = pad(hours);
    timerEls.mins.textContent = pad(mins);
    timerEls.secs.textContent = pad(secs);
  }

  tickTimer();
  if (timerEls.days) setInterval(tickTimer, 1000);

  /* Personal promo code */
  const promoFlip = $("#promoFlip");
  const generatePromoButton = $("#generatePromoCode");
  const promoCodeValue = $("#promoCodeValue");
  const copyPromoButton = $("#copyPromoCode");
  const promoToForm = $("#promoToForm");
  const promoCopyStatus = $("#promoCopyStatus");

  const generatePromoCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const randomValues = new Uint8Array(8);

    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(randomValues);
    } else {
      randomValues.forEach((_, index) => {
        randomValues[index] = Math.floor(Math.random() * 256);
      });
    }

    const randomPart = Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
    return `LANDOS-25-${randomPart.slice(0, 4)}-${randomPart.slice(4)}`;
  };

  if (promoFlip && generatePromoButton && promoCodeValue) {
    const frontFace = $(".promo__face--front", promoFlip);
    const backFace = $(".promo__face--back", promoFlip);

    generatePromoButton.addEventListener("click", () => {
      promoCodeValue.textContent = generatePromoCode();
      promoCopyStatus.textContent = "";
      promoFlip.classList.add("is-flipped");
      frontFace.setAttribute("aria-hidden", "true");
      backFace.setAttribute("aria-hidden", "false");
      generatePromoButton.tabIndex = -1;
      copyPromoButton.tabIndex = 0;
      promoToForm.tabIndex = 0;
      window.setTimeout(() => copyPromoButton.focus(), 700);
    });

    copyPromoButton.addEventListener("click", async () => {
      const code = promoCodeValue.textContent;
      const promoInput = $("#promoCode");
      let copied = false;

      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch (error) {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = code;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        copied = document.execCommand("copy");
        temporaryInput.remove();
      }

      if (promoInput) promoInput.value = code;
      promoCopyStatus.textContent = copied
        ? "Промокод скопирован"
        : "Промокод добавлен в заявку";
    });
  }

  /* Lead form */
  const form = $("#leadForm");

  if (form) {
    const nameInput = $("#name");
    const contactInput = $("#contact");
    const contactMethod = $("#contactMethod");
    const contactLabel = $("#contactLabel");
    const contactButtons = $$(".contact-methods button", form);
    const contactError = $('.form__error[data-for="contact"]', form);
    const success = $("#formSuccess");
    const promoInput = $("#promoCode");
    const consentInput = $("#consent");
    const consentField = $("#consentField");
    const savedContacts = {};
    let currentMethod = "phone";

    const methodConfig = {
      phone: {
        label: "Телефон",
        placeholder: "+7 (___) ___-__-__",
        type: "tel",
        autocomplete: "tel",
        error: "Укажите корректный телефон",
      },
      telegram: {
        label: "Ник в Telegram",
        placeholder: "@username",
        type: "text",
        autocomplete: "off",
        error: "Укажите Telegram в формате @username",
      },
      whatsapp: {
        label: "Номер WhatsApp",
        placeholder: "+7 (___) ___-__-__",
        type: "tel",
        autocomplete: "tel",
        error: "Укажите номер WhatsApp",
      },
      email: {
        label: "E-mail",
        placeholder: "name@example.ru",
        type: "email",
        autocomplete: "email",
        error: "Укажите корректный e-mail",
      },
    };

    const setError = (field, hasError) => {
      field.closest(".form__field").classList.toggle("has-error", hasError);
      field.classList.toggle("invalid", hasError);
    };

    const formatPhone = (value) => {
      let digits = value.replace(/\D/g, "");
      if (digits.startsWith("8")) digits = "7" + digits.slice(1);
      if (!digits.startsWith("7")) digits = "7" + digits;
      digits = digits.slice(0, 11);

      let formatted = "+7";
      if (digits.length > 1) formatted += " (" + digits.slice(1, 4);
      if (digits.length >= 4) formatted += ") " + digits.slice(4, 7);
      if (digits.length >= 7) formatted += "-" + digits.slice(7, 9);
      if (digits.length >= 9) formatted += "-" + digits.slice(9, 11);
      return formatted;
    };

    const selectContactMethod = (method) => {
      const config = methodConfig[method];
      if (!config) return;

      savedContacts[currentMethod] = contactInput.value;
      currentMethod = method;
      contactMethod.value = method;
      contactLabel.textContent = config.label;
      contactInput.type = config.type;
      contactInput.placeholder = config.placeholder;
      contactInput.autocomplete = config.autocomplete;
      contactInput.value = savedContacts[method] || "";
      contactError.textContent = config.error;
      setError(contactInput, false);

      contactButtons.forEach((button) => {
        const active = button.dataset.method === method;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-checked", String(active));
      });
    };

    contactButtons.forEach((button, index) => {
      button.addEventListener("click", () => selectContactMethod(button.dataset.method));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
        const nextIndex = (index + direction + contactButtons.length) % contactButtons.length;
        contactButtons[nextIndex].focus();
        contactButtons[nextIndex].click();
      });
    });

    contactInput.addEventListener("input", (event) => {
      if (["phone", "whatsapp"].includes(currentMethod)) {
        event.target.value = formatPhone(event.target.value);
      }
      setError(contactInput, false);
    });

    nameInput.addEventListener("input", () => setError(nameInput, false));

    if (promoInput) {
      promoInput.addEventListener("input", () => {
        promoInput.value = promoInput.value.toUpperCase().replace(/\s+/g, "");
      });
    }

    consentInput.addEventListener("change", () => {
      consentField.classList.toggle("has-error", !consentInput.checked);
    });

    const isContactValid = () => {
      const value = contactInput.value.trim();
      if (["phone", "whatsapp"].includes(currentMethod)) return value.replace(/\D/g, "").length === 11;
      if (currentMethod === "telegram") return /^@?[A-Za-z0-9_]{5,32}$/.test(value);
      if (currentMethod === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      return false;
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let valid = true;

      if (nameInput.value.trim().length < 2) {
        setError(nameInput, true);
        valid = false;
      }

      if (!isContactValid()) {
        setError(contactInput, true);
        valid = false;
      }

      if (!consentInput.checked) {
        consentField.classList.add("has-error");
        valid = false;
      }

      if (!valid) return;

      form.querySelectorAll("input,button").forEach((element) => {
        element.disabled = true;
      });
      success.hidden = false;
      form.classList.add("is-success");
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /* Scroll-linked works marquee */
  const worksMarquee = $("#worksMarquee");

  if (worksMarquee) {
    const tracks = $$('[data-marquee-row]', worksMarquee);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let sectionTop = 0;
    let groupWidths = [];
    let frameRequested = false;

    tracks.forEach((track) => {
      const group = $(".works-marquee__group", track);
      if (!group) return;

      for (let copy = 0; copy < 2; copy += 1) {
        const clone = group.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        $$("img", clone).forEach((image) => {
          image.alt = "";
          image.loading = "lazy";
        });
        track.appendChild(clone);
      }
    });

    const measureMarquee = () => {
      sectionTop = window.scrollY + worksMarquee.getBoundingClientRect().top;
      groupWidths = tracks.map((track) => $(".works-marquee__group", track)?.offsetWidth || 0);
    };

    const updateMarquee = () => {
      const offset = reducedMotion.matches
        ? 200
        : (window.scrollY - sectionTop + window.innerHeight) * 0.3;
      const movement = offset - 200;

      tracks.forEach((track, index) => {
        const direction = index === 0 ? 1 : -1;
        const translateX = -groupWidths[index] + movement * direction;
        track.style.transform = `translate3d(${translateX}px, 0, 0)`;
      });

      frameRequested = false;
    };

    const requestMarqueeUpdate = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(updateMarquee);
    };

    const refreshMarquee = () => {
      measureMarquee();
      requestMarqueeUpdate();
    };

    refreshMarquee();
    window.addEventListener("load", refreshMarquee, { once: true });
    window.addEventListener("scroll", requestMarqueeUpdate, { passive: true });
    window.addEventListener("resize", refreshMarquee);
    reducedMotion.addEventListener?.("change", requestMarqueeUpdate);
  }

  /* Scroll reveal */
  const revealEls = $$(
    ".feature, .section__head, .calc, .textures__copy, .textures__image, .works-marquee, .light__image, .light__content, .timeline__item, .timing__image, .promo__flip, .form-wrap"
  );

  revealEls.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* Footer year and header shadow */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  const backToTop = $("#backToTop");
  if (backToTop) {
    backToTop.addEventListener("click", (event) => {
      event.preventDefault();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }

  const header = $(".header");
  window.addEventListener("scroll", () => {
    if (!header) return;
    header.style.boxShadow = window.scrollY > 10 ? "0 8px 24px rgba(20, 45, 84, .08)" : "none";
  }, { passive: true });
})();
