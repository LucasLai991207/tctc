(function () {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
        || window.matchMedia("(max-width: 768px)").matches;

    // 【除錯用】如果你在 Console 完全看不到這行 log，代表這支檔案
    // 根本沒被載入（最常見原因：檔案沒有真的傳到伺服器上、路徑打錯，
    // 或瀏覽器快取到舊版頁面）。看到這行但沒看到後面的訊息，
    // 代表 isMobile 判斷為 false（例如桌機視窗開太寬，記得縮小或用
    // F12 的裝置模擬工具列，不是只縮小整個瀏覽器視窗）。
    console.log("[mobile_nav] 腳本已載入，isMobile =", isMobile);

    if (!isMobile) return;

    function init() {
        const nav = document.getElementById("nav");
        if (!nav) {
            console.warn("[mobile_nav] 找不到 #nav，選單沒有掛上去");
            return;
        }
        console.log("[mobile_nav] 找到 #nav，開始插入漢堡選單");

        // ----- 插入漢堡按鈕 -----
        const hamburger = document.createElement("button");
        hamburger.type = "button";
        hamburger.className = "tctc_mobile_hamburger";
        hamburger.setAttribute("aria-label", "開啟選單");
        hamburger.innerHTML = "<span></span><span></span><span></span>";
        nav.appendChild(hamburger);

        // ----- 插入背景遮罩，點擊遮罩可關閉選單 -----
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

        // ----- 下拉選單改成點擊展開，不再依賴 hover -----
        nav.querySelectorAll(".nav_dropdown").forEach(function (dropdown) {
            dropdown.addEventListener("click", function (e) {
                // 點到的是選單裡實際的項目（要導頁的），不要攔截，讓它正常跳轉
                if (e.target.closest(".nav_dropdown_item")) return;

                e.stopPropagation();
                const isOpen = dropdown.classList.contains("nav_dropdown_open");

                // 一次只展開一個分類，點別的分類自動收起上一個，抽屜不會越疊越長
                nav.querySelectorAll(".nav_dropdown.nav_dropdown_open").forEach(function (el) {
                    if (el !== dropdown) el.classList.remove("nav_dropdown_open");
                });

                dropdown.classList.toggle("nav_dropdown_open", !isOpen);
            });
        });

        // 點擊選單項目（含最上層「常見問題」跟子選單項目）後先關閉選單，
        // 避免切換到下一頁時抽屜殘留開啟狀態
        nav.querySelectorAll(".nav_dropdown_item, .nav_css > div:not(.nav_dropdown)").forEach(function (item) {
            item.addEventListener("click", closeMenu);
        });
    }

    document.body ? init() : document.addEventListener("DOMContentLoaded", init);
})();