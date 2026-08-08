/* ============================================================
   TCTC2-0-auth_ui.js
   ------------------------------------------------------------
   帳號系統的「畫面」那一半——nav 上的按鈕、登入/註冊彈窗，
   全部用 JS 動態注入，不需要在每個 HTML 檔案裡手動加 nav 按鈕或
   modal 的 HTML（跟 avatar_display.js 用同一種「自我執行 + DOMContentLoaded
   注入」的做法），每個頁面只要多引入這一個 <script> 跟對應的 CSS 就好。

   依賴：這個檔案假設 TCTC2-0-firebase.js 已經在它「之前」被載入
   （用到裡面的 Register_With_Email_Inherit／Login_With_Google／
   Get_Current_Account_Uid 等函式），所以引入順序一定要是：
     firebase SDK (app/database/auth) → TCTC2-0-firebase.js → TCTC2-0-auth_ui.js
   ============================================================ */
(function () {

    // 如果這個頁面沒有載入 Firebase Auth（理論上不該發生，因為現在每個
    // 有 nav 的頁面都會引入），就不注入任何東西，避免點下去直接報錯
    if (typeof firebase === "undefined" || typeof firebase.auth !== "function") {
        console.log("[auth_ui] Firebase Auth 尚未載入，略過帳號 UI 注入")
        return
    }

    // ===== 模組內部共用的狀態 =====
    // pending_register：使用者在註冊表單按下送出的當下，把「要用哪個方式註冊」
    // 先存起來，如果需要跳出「要不要繼承」的確認框，等玩家選完才會真的執行。
    // { method: "email" | "google", email, password }
    let pending_register = null

    // guest_preview：進到註冊分頁時就先預讀一次目前訪客資料（見下方
    // Preload_Guest_Preview 的說明，包含「為什麼要提前讀，不能等按下註冊
    // 才讀」的技術原因——跟 Google 登入彈窗的瀏覽器安全限制有關）
    let guest_preview_stats = null
    let guest_preview_should_prompt = false

    /* ============================================================
       建立 Modal 的 DOM 結構，一次建好、預設隱藏，之後只切換 class
       ============================================================ */
    function Build_Modal_Html() {
        const wrap = document.createElement("div")
        wrap.id = "auth_modal_overlay"
        wrap.className = "auth_modal_overlay is_hidden"
        wrap.innerHTML = `
            <div class="auth_modal_box" role="dialog" aria-modal="true">
                <span class="auth_corner auth_corner_tl" aria-hidden="true"></span>
                <span class="auth_corner auth_corner_br" aria-hidden="true"></span>
                <div class="auth_modal_close" id="auth_modal_close" aria-label="關閉">✕</div>

                <!-- ===== 註冊畫面（預設顯示） ===== -->
                <div id="auth_view_register" class="auth_view">
                    <p class="auth_modal_eyebrow">TCTC 帳號系統</p>
                    <h2 class="auth_modal_title">建立帳號</h2>
                    <div class="auth_modal_hairline"></div>
                    <p class="auth_modal_subtitle">把你的打字進度存到雲端，換裝置也可以繼續使用</p>
                    <p class="auth_modal_subtitle_2">如已經有帳號，請務必點最下方的登入，否則帳號將被覆蓋</p>

                    <button type="button" class="auth_google_btn" id="auth_register_google_btn">
                        <svg class="auth_google_icon" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
                        使用 Google 註冊 (推薦)
                    </button>
                    <div class="auth_divider"><span>或</span></div>

                    <label class="auth_field_label">Email</label>
                    <input type="email" class="auth_input" id="auth_register_email" placeholder="you@example.com" autocomplete="email">

                    <label class="auth_field_label">密碼</label>
                    <input type="password" class="auth_input" id="auth_register_password" placeholder="至少 6 個字元" autocomplete="new-password">

                    <label class="auth_field_label">確認密碼</label>
                    <input type="password" class="auth_input" id="auth_register_password2" placeholder="再輸入一次" autocomplete="new-password">

                    <p class="auth_error_text" id="auth_register_error"></p>

                    <button type="button" class="auth_submit_btn" id="auth_register_submit_btn">註冊</button>

                    <p class="auth_switch_text">已經有帳號了？<span class="auth_switch_link" id="auth_switch_to_login">登入</span></p>
                </div>

                <!-- ===== 登入畫面 ===== -->
                <div id="auth_view_login" class="auth_view is_hidden">
                    <p class="auth_modal_eyebrow">TCTC 帳號系統</p>
                    <h2 class="auth_modal_title">登入</h2>
                    <div class="auth_modal_hairline"></div>
                    <p class="auth_modal_subtitle">歡迎回來</p>

                    <button type="button" class="auth_google_btn" id="auth_login_google_btn">
                        <svg class="auth_google_icon" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
                        使用 Google 登入
                    </button>
                    <div class="auth_divider"><span>或</span></div>

                    <label class="auth_field_label">Email</label>
                    <input type="email" class="auth_input" id="auth_login_email" placeholder="you@example.com" autocomplete="email">

                    <label class="auth_field_label">密碼</label>
                    <input type="password" class="auth_input" id="auth_login_password" placeholder="密碼" autocomplete="current-password">

                    <p class="auth_error_text" id="auth_login_error"></p>

                    <button type="button" class="auth_submit_btn" id="auth_login_submit_btn">登入</button>

                    <p class="auth_switch_text">還沒有帳號？<span class="auth_switch_link" id="auth_switch_to_register">註冊</span></p>
                </div>

                <!-- ===== 「要不要繼承訪客資料」確認畫面 =====
                     只有在偵測到目前這台裝置有實際玩過的資料時才會顯示，
                     內容（局數/平均WPM等）由 Render_Inherit_Confirm() 動態填入 -->
                <div id="auth_view_inherit_confirm" class="auth_view is_hidden">
                    <p class="auth_modal_eyebrow">TCTC 帳號系統</p>
                    <h2 class="auth_modal_title">要繼承這台裝置的進度嗎？</h2>
                    <div class="auth_modal_hairline"></div>
                    <p class="auth_modal_subtitle">這是你目前（訪客身份）在這台裝置上的紀錄：</p>

                    <div class="auth_inherit_stats" id="auth_inherit_stats"></div>

                    <button type="button" class="auth_submit_btn" id="auth_inherit_yes_btn">要，帶著這些進度註冊</button>
                    <button type="button" class="auth_secondary_btn" id="auth_inherit_no_btn">不要，建立全新帳號</button>

                    <p class="auth_error_text" id="auth_inherit_error"></p>
                </div>

                <!-- ===== 處理中／完成提示 ===== -->
                <div id="auth_view_loading" class="auth_view is_hidden">
                    <p class="auth_loading_text" id="auth_loading_text">處理中...</p>
                </div>
            </div>
        `
        document.body.appendChild(wrap)
    }

    // 切換 modal 裡目前顯示哪一個畫面（註冊/登入/繼承確認/處理中），
    // 每次切換都先把全部畫面藏起來，再把目標畫面的 is_hidden 拿掉，
    // 這樣永遠只會有一個畫面顯示，不用一個個判斷「上一個是誰、要不要藏」
    function Show_Auth_View(view_id) {
        document.querySelectorAll(".auth_view").forEach(function (el) {
            el.classList.add("is_hidden")
        })
        const target = document.getElementById(view_id)
        if (target) target.classList.remove("is_hidden")
    }

    function Open_Auth_Modal(default_view) {
        const overlay = document.getElementById("auth_modal_overlay")
        if (!overlay) return
        overlay.classList.remove("is_hidden")
        Show_Auth_View(default_view || "auth_view_register")
        Clear_Auth_Errors()

        // 一打開就先預讀訪客資料，理由見 Preload_Guest_Preview() 的註解
        Preload_Guest_Preview()
    }
    function Close_Auth_Modal() {
        const overlay = document.getElementById("auth_modal_overlay")
        if (overlay) overlay.classList.add("is_hidden")
        pending_register = null
    }
    function Clear_Auth_Errors() {
        ;["auth_register_error", "auth_login_error", "auth_inherit_error"].forEach(function (id) {
            const el = document.getElementById(id)
            if (el) el.textContent = ""
        })
    }
    function Show_Auth_Error(field_error_id, message) {
        const el = document.getElementById(field_error_id)
        if (el) el.textContent = message
    }

    /* ------------------------------------------------------------
       提前預讀「這台裝置目前的訪客資料」，在 modal 一打開的當下就做，
       不是等玩家按下「註冊」才做。

       原因（技術限制，不是隨便的設計選擇）：Google 登入用的
       signInWithPopup／linkWithPopup 必須是「使用者點擊事件的當下、
       同步呼叫」，瀏覽器才會放行彈出視窗；如果中間先插入一段非同步的
       Firebase 資料庫讀取（Get_Guest_Inherit_Preview 也是打 Firebase，
       需要等網路回應），等它 resolve 之後才呼叫 signInWithPopup，
       這個呼叫就不再被瀏覽器視為「直接來自使用者手勢」，Safari／部分
       Chrome 設定下會被彈窗攔截器擋掉，導致 Google 登入按鈕看起來完全
       沒反應。

       解法：資料庫讀取提前到「打開 modal」這一步做（這也是一個使用者
       手勢，但不會馬上接著呼叫 signInWithPopup，所以沒有這個限制），
       等玩家實際按下「使用 Google 註冊」或「使用 Google 登入」時，
       這筆資料早就讀完、存在 guest_preview_stats 裡了，按鈕的 click
       handler 可以直接同步呼叫 signInWithPopup，不會被攔截。
       ------------------------------------------------------------ */
    function Preload_Guest_Preview() {
        guest_preview_stats = null
        guest_preview_should_prompt = false
        Get_Guest_Inherit_Preview(function (stats) {
            guest_preview_stats = stats
            guest_preview_should_prompt = Should_Prompt_Guest_Inherit(stats)
        })
    }

    // 把 guest_preview_stats 轉成畫面上看得懂的文字，塞進「繼承確認」畫面
    function Render_Inherit_Confirm() {
        const stats = guest_preview_stats || {}
        const container = document.getElementById("auth_inherit_stats")
        if (!container) return

        const rows = [
            ["主線練習局數", stats.wpm_count || 0],
            ["平均 WPM", stats.avg_wpm ? stats.avg_wpm.toFixed(1) : "0"],
            ["平均正確率", (stats.avg_acc ? stats.avg_acc.toFixed(1) : "0") + "%"],
            ["挑戰模式累積積分", stats.total_points || 0]
        ]
        container.innerHTML = rows.map(function (row) {
            return `<div class="auth_inherit_row"><span>${row[0]}</span><span class="auth_inherit_value">${row[1]}</span></div>`
        }).join("")
    }

    /* ============================================================
       註冊表單送出 —— Email/密碼
       ============================================================ */
    function Handle_Register_Submit() {
        Clear_Auth_Errors()
        const email = (document.getElementById("auth_register_email").value || "").trim()
        const password = document.getElementById("auth_register_password").value || ""
        const password2 = document.getElementById("auth_register_password2").value || ""

        if (!email || !password) {
            Show_Auth_Error("auth_register_error", "請填寫 Email 跟密碼")
            return
        }
        if (password.length < 6) {
            Show_Auth_Error("auth_register_error", "密碼至少需要 6 個字元")
            return
        }
        if (password !== password2) {
            Show_Auth_Error("auth_register_error", "兩次輸入的密碼不一樣 😩")
            return
        }

        pending_register = { method: "email", email: email, password: password }
        Route_After_Register_Choice()
    }

    // Google 註冊按鈕：因為要保留「直接同步呼叫 signInWithPopup」這個特性
    // （見 Preload_Guest_Preview 的說明），這裡分兩種情況處理：
    // - 不需要問繼承（guest_preview_should_prompt 是 false）：
    //   直接在這個 click handler 裡同步呼叫 Register_With_Google_Fresh
    // - 需要問繼承：【不能】在這裡就開 Google 彈窗（還不知道要不要繼承），
    //   先跳轉去「繼承確認」畫面；玩家在那個畫面按下「要」或「不要」時，
    //   那兩顆按鈕各自的 click handler 才會呼叫 Google 登入——因為那也是
    //   一個全新的、使用者剛點擊的手勢，一樣能同步開窗，不會被攔截。
    function Handle_Register_Google_Click() {
        Clear_Auth_Errors()
        pending_register = { method: "google" }

        if (!guest_preview_should_prompt) {
            Register_With_Google_Fresh(Handle_Register_Result)
            return
        }
        Render_Inherit_Confirm()
        Show_Auth_View("auth_view_inherit_confirm")
    }

    // Email 路徑決定要不要跳出繼承確認畫面
    function Route_After_Register_Choice() {
        if (!guest_preview_should_prompt) {
            // 沒有值得繼承的資料，兩種結果反正一樣，直接走「不繼承」路徑
            // （沿用現有 anon_id 或換新的，對一個全新訪客來說沒有差別，
            // 這裡選擇跟「不繼承」共用同一條程式路徑，邏輯比較單純）
            Execute_Register(false)
            return
        }
        Render_Inherit_Confirm()
        Show_Auth_View("auth_view_inherit_confirm")
    }

    function Execute_Register(should_inherit) {
        Show_Auth_View("auth_view_loading")
        document.getElementById("auth_loading_text").textContent = "註冊中..."

        if (!pending_register) return // 理論上不會發生，保險判斷

        if (pending_register.method === "google") {
            const fn = should_inherit ? Register_With_Google_Inherit : Register_With_Google_Fresh
            fn(Handle_Register_Result)
            return
        }

        const fn = should_inherit ? Register_With_Email_Inherit : Register_With_Email_Fresh
        fn(pending_register.email, pending_register.password, Handle_Register_Result)
    }

    function Handle_Register_Result(success, error_message) {
        if (!success) {
            // 註冊失敗，退回原本填寫的畫面（Google 沒有表單可退，退回註冊首頁）
            Show_Auth_View(pending_register && pending_register.method === "email" ? "auth_view_register" : "auth_view_register")
            Show_Auth_Error("auth_register_error", error_message || "註冊失敗，請稍後再試")
            return
        }
        pending_register = null
        Refresh_Nav_Account_State()
        Close_Auth_Modal()
    }

    /* ============================================================
       登入表單送出
       ============================================================ */
    function Handle_Login_Submit() {
        Clear_Auth_Errors()
        const email = (document.getElementById("auth_login_email").value || "").trim()
        const password = document.getElementById("auth_login_password").value || ""
        if (!email || !password) {
            Show_Auth_Error("auth_login_error", "請填寫 Email 跟密碼")
            return
        }

        Show_Auth_View("auth_view_loading")
        document.getElementById("auth_loading_text").textContent = "登入中..."

        Login_With_Email(email, password, Handle_Login_Result)
    }
    function Handle_Login_Google_Click() {
        Clear_Auth_Errors()
        // 登入不用問繼承，直接呼叫（點擊當下同步開窗，不受彈窗攔截影響）
        Login_With_Google(Handle_Login_Result)
    }
    function Handle_Login_Result(success, error_message) {
        if (!success) {
            Show_Auth_View("auth_view_login")
            Show_Auth_Error("auth_login_error", error_message || "登入失敗，請稍後再試")
            return
        }
        Refresh_Nav_Account_State()
        Close_Auth_Modal()

        // 登入後畫面上很多統計數字（profile.js 的雲端統計、nav 上的暱稱……）
        // 是頁面載入當下就讀好塞進 DOM 的，不是即時反應 localStorage 變化，
        // 直接重新整理頁面最單純，能確保所有地方都換成新身份的資料，
        // 不用一個個手動找出哪些 UI 需要重新渲染
        setTimeout(function () { window.location.reload() }, 300)
    }

    /* ============================================================
       Nav 上的帳號按鈕：未登入顯示「註冊」，已登入顯示帳號名稱 + 登出
       ============================================================ */
    function Build_Nav_Account_Item() {
        const item = document.createElement("div")
        item.id = "auth_nav_item"
        item.className = "nav_dropdown" // 沿用既有的 .nav_dropdown 樣式（hover 展開子選單）
        return item
    }

    function Refresh_Nav_Account_State() {
        const item = document.getElementById("auth_nav_item")
        if (!item) return

        const uid = Get_Current_Account_Uid()
        if (!uid) {
            item.className = ""
            item.innerHTML = `<span onclick="TCTC_Open_Auth_Modal('auth_view_register')">註冊</span>`
            return
        }

        // 已登入狀態：直接顯示「登出」，不再顯示帳號名稱/email
        // （Google 帳號如果沒有 displayName，之前會 fallback 顯示完整 email，
        //   在 nav 上很礙眼，乾脆不顯示名稱，統一只顯示「登出」）
        item.className = "" // 不再需要 .nav_dropdown 的 hover 展開樣式
        item.innerHTML = `<span id="auth_nav_logout_btn" onclick="TCTC_Logout_Account()">登出</span>`
    }

    // 掛在 window 上，讓 innerHTML 裡的 onclick（字串形式）能呼叫得到
    // ——這幾個函式本身是這個 IIFE 內部的私有函式，外部沒有這個橋接的話
    // onclick="..." 在全域作用域下會直接找不到函式、報錯
    window.TCTC_Open_Auth_Modal = function (view_id) { Open_Auth_Modal(view_id) }
    window.TCTC_Logout_Account = function () {
        Logout_Account(function () {
            window.location.reload()
        })
    }

    /* ============================================================
       綁定所有事件、把 nav 按鈕跟 modal 一起插入頁面
       ============================================================ */
    function Bind_Modal_Events() {
        document.getElementById("auth_modal_close").addEventListener("click", Close_Auth_Modal)
        document.getElementById("auth_modal_overlay").addEventListener("click", function (event) {
            // 點在半透明背景上（不是點在卡片本身）才關閉，避免點卡片內容誤觸關閉
            if (event.target.id === "auth_modal_overlay") Close_Auth_Modal()
        })

        document.getElementById("auth_switch_to_login").addEventListener("click", function () {
            Clear_Auth_Errors()
            Show_Auth_View("auth_view_login")
        })
        document.getElementById("auth_switch_to_register").addEventListener("click", function () {
            Clear_Auth_Errors()
            Show_Auth_View("auth_view_register")
        })

        document.getElementById("auth_register_submit_btn").addEventListener("click", Handle_Register_Submit)
        document.getElementById("auth_register_google_btn").addEventListener("click", Handle_Register_Google_Click)
        document.getElementById("auth_login_submit_btn").addEventListener("click", Handle_Login_Submit)
        document.getElementById("auth_login_google_btn").addEventListener("click", Handle_Login_Google_Click)

        document.getElementById("auth_inherit_yes_btn").addEventListener("click", function () { Execute_Register(true) })
        document.getElementById("auth_inherit_no_btn").addEventListener("click", function () { Execute_Register(false) })
    }

    document.addEventListener("DOMContentLoaded", function () {
        Build_Modal_Html()
        Bind_Modal_Events()

        // 把帳號按鈕插進每一個 .nav_css 容器的「最前面」（跟現有的「常見問題／模式／更多」
        // 排在一起）。用 querySelectorAll 而不是 getElementById，是因為理論上一個頁面
        // 只會有一個 .nav_css，但用 forEach 寫法比較保險，不會因為未來版面調整、
        // 不小心變成兩個 .nav_css 就漏掉某一個。
        document.querySelectorAll(".nav_css").forEach(function (nav_css_el) {
            const item = Build_Nav_Account_Item()
            nav_css_el.insertBefore(item, nav_css_el.firstChild)
        })
        Refresh_Nav_Account_State()
    })
})()