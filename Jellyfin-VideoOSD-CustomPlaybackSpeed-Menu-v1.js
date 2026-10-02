// INFO:
// unlimited playback speed entries in const SPEEDS possible, as long as the menu fits on screen
// playback speed range: 0.0625x - 16x

(function () {
    // ---- PLUGIN ADAPTER: config source, retrofit for VideoOSD Tweaks and Candy ----

    // The 11 real vanilla Jellyfin default speeds, confirmed directly from
    // htmlVideoPlayer/plugin.js's own getSupportedPlaybackRates().
    const VANILLA_SPEED_FIELD_MAP = {
        0.5: 'VanillaSpeed0_5',
        0.75: 'VanillaSpeed0_75',
        1: 'VanillaSpeed1_0',
        1.25: 'VanillaSpeed1_25',
        1.5: 'VanillaSpeed1_5',
        1.75: 'VanillaSpeed1_75',
        2: 'VanillaSpeed2_0',
        2.5: 'VanillaSpeed2_5',
        3: 'VanillaSpeed3_0',
        3.5: 'VanillaSpeed3_5',
        4: 'VanillaSpeed4_0'
    };

    async function fetchPluginConfig() {
        const maxAttempts = 120;
        const delayMs = 250;
        let failures = 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // No ApiClient yet (jellyfin-web creates it once a server is
            // known, e.g. after the server selection page): wait without
            // using up an attempt, like the not-logged-in case below.
            if (!window.ApiClient) attempt--;
            if (window.ApiClient && typeof ApiClient.getJSON === 'function') {
                // Not logged in yet (e.g. still on the login page): every
                // request would only fail with 401, so wait without using up
                // an attempt (the whole budget used to run out right there).
                if (typeof ApiClient.accessToken === 'function' && !ApiClient.accessToken()) {
                    attempt--;
                    await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
                    continue;
                }
                try {
                    // The plugin's own endpoint, readable for every signed-in user.
                    const config = await ApiClient.getJSON(ApiClient.getUrl('VideoOSDTweaksCandy/ClientConfiguration'));
                    if (config) return config;
                    throw new Error('empty configuration');
                } catch (err) {
                    // 403: no access; 404: plugin not installed (standalone
                    // use). Retrying can't change
                    // either, so stop and use the defaults instead of sending
                    // up to 120 failing requests.
                    if (err && (err.status === 403 || err.status === 404)) return null;
                    // Server error (5xx), network error or empty answer: at most 3
                    // retries, 0.5 / 1 / 2 s apart, then the defaults until the next
                    // fetch (this used to send up to 120 requests in 30 s).
                    if (++failures > 3) return null;
                    await new Promise(function (resolve) { setTimeout(resolve, delayMs * Math.pow(2, failures)); });
                    continue;
                }
            }
            await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
        }
        return null;
    }

    // Builds the final speed list from the plugin's two separate lists
    // (Vanilla Speeds individually toggleable off, Custom Speeds freely
    // added and toggled on), per the concept: "the actually-available
    // combined speed list is derived automatically from these two, no
    // separate third list needed". Falls back to the exact original
    // hardcoded SPEEDS list when there's no plugin config at all
    // (standalone JS-injector usage), zero behavior change for that case.
    function buildSpeedsFromPluginConfig(pluginConfig) {
        if (!pluginConfig) return null;

        const enabledVanilla = Object.keys(VANILLA_SPEED_FIELD_MAP)
            .map(Number)
            .filter(value => pluginConfig[VANILLA_SPEED_FIELD_MAP[value]] !== false);

        const customValues = String(pluginConfig.CustomSpeedValues || '')
            .split(',')
            .map(s => parseFloat(s.trim()))
            .filter(v => !Number.isNaN(v) && v >= 0.0625 && v <= 16);

        const merged = [...new Set([...enabledVanilla, ...customValues])];
        return merged.length ? merged : enabledVanilla;
    }
    // ---- END PLUGIN ADAPTER ----

    // ============================================================
    // == STANDALONE VALUE (JavaScript Injector, no plugin) ==
    // "let", not "const": this list can be REBUILT once plugin
    // config arrives (see PLUGIN ADAPTER above and the .then() call
    // near the bottom of this file). If no plugin config is ever
    // fetched (standalone JS-injector usage), this array is simply
    // never reassigned -- this exact hardcoded list stays in effect
    // untouched, identical to before this retrofit.
    // ============================================================
    let SPEEDS = [0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 10];

    window.JellyfinCustomPlaybackSpeed = {
        SPEEDS: SPEEDS
    };

    const ITEM_HEIGHT_REM = 2.7;
    const DONE = new WeakSet();

    function labelForSpeed(value) {
        return value === 4 ? "4.0x" : `${value}x`;
    }

    function getItemHeight() {
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return ITEM_HEIGHT_REM * rootFontSize;
    }

    function isSpeedMenu(sheet) {
        const scroller = sheet ? sheet.querySelector(".actionSheetScroller") : null;
        if (!scroller) return false;

        const ids = [...scroller.querySelectorAll("button[data-id]")]
            .map(b => b.getAttribute("data-id"));

        return ids.includes("0.5") && ids.includes("0.75") && ids.includes("1");
    }

    function ensureCheckSlot(button) {
        let check = button.querySelector(".check");

        if (!check) {
            check = document.createElement("span");
            check.className = "actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons check";
            check.setAttribute("aria-hidden", "true");
            check.style.visibility = "hidden";
            button.insertBefore(check, button.firstChild);
        }

        return check;
    }

    function updateChecks(scroller, selectedId) {
        scroller.querySelectorAll("button[data-id]").forEach(button => {
            const id = button.getAttribute("data-id");
            const value = parseFloat(id);

            if (Number.isNaN(value)) return;

            const check = ensureCheckSlot(button);
            check.style.visibility = id === selectedId ? "" : "hidden";
        });
    }

    function getCurrentRate() {
        const video = document.querySelector("video");
        return video ? String(video.playbackRate) : null;
    }

    function fitSheetToViewport(sheet, originalTop, originalCount) {
        const diff = SPEEDS.length - originalCount;
        const itemHeight = getItemHeight();
        const targetTop = originalTop - (diff * itemHeight);

        sheet.style.top = `${targetTop}px`;
    }

    function patch(sheet) {
        if (!sheet || DONE.has(sheet)) return;
        if (!isSpeedMenu(sheet)) return;

        const scroller = sheet.querySelector(".actionSheetScroller");
        if (!scroller) return;

        const originalTop = parseFloat(sheet.style.top || sheet.getBoundingClientRect().top);

        const originalCount = [...scroller.querySelectorAll("button[data-id]")]
            .map(b => parseFloat(b.getAttribute("data-id")))
            .filter(v => !Number.isNaN(v))
            .length;

        scroller.querySelectorAll("button[data-id]").forEach(button => {
            const value = parseFloat(button.getAttribute("data-id"));
            if (!Number.isNaN(value)) ensureCheckSlot(button);
        });

        const template =
            scroller.querySelector('button[data-id="0.5"]') ||
            scroller.querySelector('button[data-id="1"]') ||
            scroller.querySelector("button[data-id]");

        if (!template) return;

        SPEEDS.slice().sort((a, b) => a - b).forEach(speed => {
            const id = String(speed);
            let btn = scroller.querySelector(`button[data-id="${CSS.escape(id)}"]`);

            if (!btn) {
                btn = template.cloneNode(true);
                btn.setAttribute("data-id", id);
                ensureCheckSlot(btn).style.visibility = "hidden";
                scroller.appendChild(btn);
            }

            const text = btn.querySelector(".actionSheetItemText, .listItemBodyText");
            if (text) text.textContent = labelForSpeed(speed);

            btn.style.display = "";
        });

        scroller.querySelectorAll("button[data-id]").forEach(button => {
            const value = parseFloat(button.getAttribute("data-id"));

            if (Number.isNaN(value)) return;

            button.style.display = SPEEDS.includes(value) ? "" : "none";
        });

        [...scroller.querySelectorAll("button[data-id]")]
            .map(b => ({
                el: b,
                id: parseFloat(b.getAttribute("data-id"))
            }))
            .filter(x => !Number.isNaN(x.id))
            .sort((a, b) => a.id - b.id)
            .forEach(item => scroller.appendChild(item.el));

        fitSheetToViewport(sheet, originalTop, originalCount);

        scroller.addEventListener("click", e => {
            const button = e.target.closest("button[data-id]");

            if (!button || button.style.display === "none") return;

            const id = button.getAttribute("data-id");
            const rate = parseFloat(id);

            if (Number.isNaN(rate)) return;

            document.querySelectorAll("video").forEach(video => {
                video.playbackRate = rate;
            });

            setTimeout(() => updateChecks(scroller, id), 0);
        });

        const current = getCurrentRate();
        if (current) updateChecks(scroller, current);

        DONE.add(sheet);
    }

    // Jellyfin's settings sheet shows the current speed next to
    // "Playback speed" only when it is one of Jellyfin's own rates
    // (playersettingsmenu.js); for a custom rate the value is missing.
    // Same element Jellyfin renders (actionSheet.ts), added only then.
    function patchRateAside(sheet) {
        const item = sheet.querySelector('button[data-id="playbackrate"]');
        if (!item || item.querySelector(".actionSheetItemAsideText")) return;

        const video = document.querySelector("video");
        if (!video) return;

        const aside = document.createElement("div");
        aside.className = "listItemAside actionSheetItemAsideText";
        aside.textContent = labelForSpeed(video.playbackRate);
        item.appendChild(aside);
    }

    // ============================================================
    // KEYBOARD SPEED STEPS (same block in Speed-Buttons.js)
    // ============================================================
    // Jellyfin's own speed keys (10.10: ">" / "<", 12.1: Shift + the
    // Period / Comma key) step through Jellyfin's built-in rates only, and
    // from any rate missing there (custom 0.33x, 5x, ...) they jump to its
    // first entry, 0.5x. Jellyfin calls preventDefault() on every key it
    // handles, so right after it (window, bubble phase) the step is redone
    // through the custom list: the next rate above / below the one before
    // the key, staying put at the ends like Jellyfin. Which keys count is
    // left to the running Jellyfin version; no key is added. Installed
    // once, by whichever speed addon loads first.
    function installSpeedKeys(getList) {
        if (window.JellyfinVideoOSDSpeedKeys) return;
        window.JellyfinVideoOSDSpeedKeys = true;

        const EPS = 0.0001;
        let rateBefore = null;

        window.addEventListener("keydown", () => {
            const video = document.querySelector("video");
            rateBefore = video ? video.playbackRate : null;
        }, true);

        window.addEventListener("keydown", e => {
            const before = rateBefore;
            rateBefore = null;

            if (before === null || !e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;

            const up = e.key === ">" || (e.shiftKey && e.code === "Period");
            const down = e.key === "<" || (e.shiftKey && e.code === "Comma");
            if (up === down) return;
            if (!document.querySelector("#videoOsdPage:not(.hide)")) return;

            const list = getList();
            if (!list.length) return;

            // No nullish coalescing: these scripts also run on older TV browsers.
            const found = up
                ? list.find(v => v > before + EPS)
                : [...list].reverse().find(v => v < before - EPS);
            const next = found !== undefined ? found : before;

            const videos = [...document.querySelectorAll("video")];
            if (!videos.length || Math.abs(videos[0].playbackRate - next) < EPS) return;

            videos.forEach(video => {
                video.playbackRate = next;
            });
            try {
                // Jellyfin keeps the speed for the next item from here.
                sessionStorage.setItem("playbackRateSpeed", String(next));
            } catch (err) {
                /* storage unavailable: speed applies to this item only */
            }
        });
    }

    installSpeedKeys(() => SPEEDS
        .map(Number)
        .filter(v => !Number.isNaN(v) && v >= 0.0625 && v <= 16)
        .sort((a, b) => a - b));

    const obs = new MutationObserver(() => {
        document.querySelectorAll(".focuscontainer.actionSheet").forEach(sheet => {
            patch(sheet);
            patchRateAside(sheet);
        });
    });

    obs.observe(document.body, {
        childList: true,
        subtree: true
    });

    // ---- PLUGIN ADAPTER: apply fetched config once it arrives ----
    // Fired in parallel, not awaited before the observer starts above, so
    // standalone (no-plugin) behavior is unaffected. If a plugin config
    // does arrive, SPEEDS (and the shared window.JellyfinCustomPlaybackSpeed
    // object Speed-Buttons.js reads from) is rebuilt from it. This
    // normally arrives well before the user ever opens the speed menu, in
    // the rare case it arrives after the menu was already patched once
    // (DONE tracks that per-sheet), the new list is ready in time for the
    // next time the menu is opened.
    fetchPluginConfig().then(function (pluginConfig) {
        const rebuilt = buildSpeedsFromPluginConfig(pluginConfig);
        if (!rebuilt) return; // standalone usage, keep the original hardcoded list

        SPEEDS = rebuilt;
        window.JellyfinCustomPlaybackSpeed.SPEEDS = SPEEDS;
    }).catch(function (err) {
        console.error('[VideoOSD Speed Menu] config apply failed:', err);
    });
    // ---- END PLUGIN ADAPTER ----
})();
