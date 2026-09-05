(function () {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
        || window.matchMedia("(max-width: 768px)").matches;

    console.log("[mobile_nav] 腳本已載入，isMobile =", isMobile);

    if (!isMobile) return;

    function init() {
        const nav = document.getElementById("nav");
        if (!nav) {
            console.warn("[mobile_nav] 找不到 #nav，選單沒有掛上去");
            return;
        }
        console.log("[mobile_nav] 找到 #nav，開始插入漢堡選單");

        const hamburger = document.createElement("button");
        hamburger.type = "button";
        hamburger.className = "tctc_mobile_hamburger";
        hamburger.setAttribute("aria-label", "開啟選單");
        hamburger.innerHTML = "<span></span><span></span><span></span>";
        nav.appendChild(hamburger);

        const overlay = document.createElement("div");
        overlay.className = "tctc_mobile_overlay";
        nav.parentNode.insertBefore(overlay, nav.nextSibling);

        function closeMenu() {
            nav.classList.remove("nav_mobile_open");
            nav.querySelectorAll(".nav_dropdown.nav_dropdown_open").forEach(function (el) {
                el.classList.remove("nav_dropdown_open");
            });
        }

        hamburger.addEventListener("click", function (e) {
            e.stopPropagation();
            nav.classList.toggle("nav_mobile_open");
        });

        overlay.addEventListener("click", closeMenu);

        nav.querySelectorAll(".nav_dropdown").forEach(function (dropdown) {
            dropdown.addEventListener("click", function (e) {
                if (e.target.closest(".nav_dropdown_item")) return;

                e.stopPropagation();
                const isOpen = dropdown.classList.contains("nav_dropdown_open");

                nav.querySelectorAll(".nav_dropdown.nav_dropdown_open").forEach(function (el) {
                    if (el !== dropdown) el.classList.remove("nav_dropdown_open");
                });

                dropdown.classList.toggle("nav_dropdown_open", !isOpen);
            });
        });

        nav.querySelectorAll(".nav_dropdown_item, .nav_css > div:not(.nav_dropdown)").forEach(function (item) {
            item.addEventListener("click", closeMenu);
        });

        document.querySelectorAll(".main_lobby_main_frame_map_selector").forEach(function (selector) {
            const header = selector.querySelector(".main_lobby_chapter_selector_text1");
            if (!header) return;
            header.style.cursor = "pointer";
            header.addEventListener("click", function (e) {
                e.stopPropagation();
                selector.classList.toggle("cg_chapter_open");
            });
        });

        document.querySelectorAll(".cg_difficulty_selector").forEach(function (selector) {
            if (selector.dataset.mobileToggleInit) return;
            selector.dataset.mobileToggleInit = "1";

            const toggle = document.createElement("div");
            toggle.className = "cg_difficulty_toggle_btn";
            toggle.textContent = "選擇難度 ▾";
            selector.parentNode.insertBefore(toggle, selector);

            toggle.addEventListener("click", function (e) {
                e.stopPropagation();
                const isOpen = selector.classList.toggle("cg_diff_open");
                toggle.textContent = isOpen ? "收合 ▴" : "選擇難度 ▾";
            });
        });

        document.querySelectorAll(".main_lobby_main_frame_mode_selector").forEach(function (selector) {
            if (selector.dataset.mobileToggleInit) return;
            selector.dataset.mobileToggleInit = "1";

            const toggle = document.createElement("div");
            toggle.className = "main_lobby_mode_toggle_btn";
            toggle.textContent = "選擇難度 ▾";
            selector.parentNode.insertBefore(toggle, selector);

            toggle.addEventListener("click", function (e) {
                e.stopPropagation();
                const isOpen = selector.classList.toggle("main_lobby_mode_open");
                toggle.textContent = isOpen ? "收合 ▴" : "選擇難度 ▾";
            });
        });
    }

    document.body ? init() : document.addEventListener("DOMContentLoaded", init);
})();