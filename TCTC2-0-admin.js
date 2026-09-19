function Adm_Toast(msg, is_error) {
    const el = document.getElementById("adm_toast")
    if (!el) return
    el.textContent = msg
    el.classList.toggle("profile_toast_error", !!is_error)
    el.classList.add("profile_toast_show")
    clearTimeout(el._t)
    el._t = setTimeout(function () { el.classList.remove("profile_toast_show") }, 3000)
}

function Adm_Fmt_Time(ts) {
    if (!ts) return "—"
    const d = new Date(ts)
    const p = function (n) { return String(n).padStart(2, "0") }
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function Adm_Esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    })
}

function Adm_Switch_Tab(tab) {
    ;["feedback", "reports", "player"].forEach(function (t) {
        const panel = document.getElementById("adm_tab_" + t)
        if (panel) panel.classList.toggle("is_hidden", t !== tab)
    })
    document.querySelectorAll(".adm_tab").forEach(function (el) {
        el.classList.toggle("adm_tab_active", el.dataset.tab === tab)
    })
}

/* ===== 意見回報 ===== */
const ADM_CATEGORY_LABEL = { bug: "錯誤回報", suggestion: "功能建議", other: "其他" }

function Adm_Load_Feedback() {
    const listEl = document.getElementById("adm_feedback_list")
    tctc_db.ref("site_feedback").orderByChild("timestamp").limitToLast(200).once("value")
        .then(function (snapshot) {
            const items = []
            snapshot.forEach(function (child) { items.push({ id: child.key, val: child.val() }) })
            items.reverse()   // 最新的排最前面

            if (items.length === 0) {
                listEl.innerHTML = '<p class="adm_empty">目前沒有任何意見回報</p>'
                return
            }

            listEl.innerHTML = items.map(function (item) {
                const v = item.val || {}
                const cat = ADM_CATEGORY_LABEL[v.category] || "其他"
                const is_resolved = v.status === "resolved"
                return `
                <div class="adm_item">
                    <div class="adm_item_head">
                        <span class="adm_badge ${v.category === "bug" ? "adm_badge_bug" : ""}">${Adm_Esc(cat)}</span>
                        ${is_resolved ? '<span class="adm_badge adm_badge_resolved">已處理</span>' : ""}
                        <span class="adm_item_title">${Adm_Esc(v.title || "（無標題）")}</span>
                        <span class="adm_item_meta">${Adm_Fmt_Time(v.timestamp)}</span>
                    </div>
                    <div class="adm_item_body">${Adm_Esc(v.content || "")}</div>
                    <div class="adm_kv">
                        <div>回報者暱稱</div><div>${Adm_Esc(v.name || "（未取名的訪客）")}</div>
                        <div>anon_id</div><div>${Adm_Esc(v.anon_id || "—")}</div>
                        <div>聯絡方式</div><div>${Adm_Esc(v.contact || "—")}</div>
                        <div>回報頁面</div><div>${Adm_Esc(v.page_url || "—")}</div>
                    </div>
                    <div class="adm_item_actions" style="margin-top:0.8rem;">
                        ${is_resolved
                            ? `<button class="adm_btn" onclick="Adm_Mark_Feedback('${item.id}','new')">標記為未處理</button>`
                            : `<button class="adm_btn" onclick="Adm_Mark_Feedback('${item.id}','resolved')">標記為已處理</button>`}
                    </div>
                </div>`
            }).join("")
        })
        .catch(function (error) {
            listEl.innerHTML = `<p class="adm_empty">讀取失敗：${Adm_Esc(error.message)}</p>`
        })
}

function Adm_Mark_Feedback(id, status) {
    Admin_Set_Feedback_Status(id, status, function (ok) {
        if (!ok) { Adm_Toast("更新失敗", true); return }
        Adm_Toast("已更新")
        Adm_Load_Feedback()
    })
}

/* ===== 玩家檢舉 =====
   player_reports 的結構是 player_reports/{被檢舉者anon_id}/{檢舉id}，
   所以要抓整棵樹下來再自己攤平成一筆一筆 */
function Adm_Load_Reports() {
    const listEl = document.getElementById("adm_reports_list")
    tctc_db.ref("player_reports").once("value")
        .then(function (snapshot) {
            const items = []
            snapshot.forEach(function (targetSnap) {
                const target_anon_id = targetSnap.key
                targetSnap.forEach(function (reportSnap) {
                    items.push({ target_anon_id: target_anon_id, id: reportSnap.key, val: reportSnap.val() })
                })
            })
            items.sort(function (a, b) { return (b.val.timestamp || 0) - (a.val.timestamp || 0) })

            if (items.length === 0) {
                listEl.innerHTML = '<p class="adm_empty">目前沒有任何檢舉</p>'
                return
            }

            listEl.innerHTML = items.map(function (item) {
                const v = item.val || {}
                const cats = Array.isArray(v.categories) ? v.categories.join("、") : ""
                return `
                <div class="adm_item">
                    <div class="adm_item_head">
                        <span class="adm_badge adm_badge_bug">檢舉</span>
                        <span class="adm_item_title">被檢舉者：${Adm_Esc(v.target_name || "（無暱稱）")}</span>
                        <span class="adm_item_meta">${Adm_Fmt_Time(v.timestamp)}</span>
                    </div>
                    <div class="adm_item_body">${Adm_Esc(v.reason || "")}</div>
                    <div class="adm_kv">
                        <div>分類</div><div>${Adm_Esc(cats || "—")}</div>
                        <div>被檢舉者 anon_id</div><div>${Adm_Esc(item.target_anon_id)}</div>
                        <div>檢舉者 anon_id</div><div>${Adm_Esc(v.reporter_anon_id || "—")}</div>
                    </div>
                    <div class="adm_item_actions" style="margin-top:0.8rem;">
                        <button class="adm_btn" onclick="Adm_Lookup_From_Report('${Adm_Esc(item.target_anon_id)}')">查看這個玩家</button>
                        <button class="adm_btn adm_btn_danger" onclick="Adm_Delete_Player('${Adm_Esc(item.target_anon_id)}')">刪除此玩家資料</button>
                    </div>
                </div>`
            }).join("")
        })
        .catch(function (error) {
            listEl.innerHTML = `<p class="adm_empty">讀取失敗：${Adm_Esc(error.message)}</p>`
        })
}

function Adm_Lookup_From_Report(anon_id) {
    Adm_Switch_Tab("player")
    const input = document.getElementById("adm_player_search")
    if (input) input.value = anon_id
    Adm_Search_Player()
}

/* ===== 查詢玩家 =====
   可以用 anon_id 直接查，也可以用暱稱查（暱稱用 orderByChild('name') 找） */
function Adm_Search_Player() {
    const input = document.getElementById("adm_player_search")
    const resultEl = document.getElementById("adm_player_result")
    const q = (input ? input.value : "").trim()
    if (!q) { resultEl.innerHTML = '<p class="adm_empty">請先輸入 anon_id 或暱稱</p>'; return }

    resultEl.innerHTML = '<p class="adm_empty">查詢中…</p>'

    // 先當成 anon_id 直接查
    tctc_db.ref(`player_stats/${q}`).once("value")
        .then(function (snap) {
            if (snap.exists()) {
                Adm_Render_Player(q, snap.val())
                return
            }
            // 查不到就改用暱稱查
            return tctc_db.ref("player_stats").orderByChild("name").equalTo(q).limitToFirst(1)
                .once("value")
                .then(function (s2) {
                    let found = null, key = null
                    s2.forEach(function (c) { found = c.val(); key = c.key })
                    if (!found) {
                        resultEl.innerHTML = '<p class="adm_empty">查無此玩家（anon_id 跟暱稱都沒有符合的）</p>'
                        return
                    }
                    Adm_Render_Player(key, found)
                })
        })
        .catch(function (error) {
            resultEl.innerHTML = `<p class="adm_empty">查詢失敗：${Adm_Esc(error.message)}</p>`
        })
}

function Adm_Render_Player(anon_id, v) {
    const resultEl = document.getElementById("adm_player_result")
    v = v || {}
    const rows = [
        ["暱稱", v.name || "（未取名）"],
        ["anon_id", anon_id],
        ["public_id", v.public_id || "—"],
        ["簡介", v.intro || "—"],
        ["平均 WPM", v.avg_wpm != null ? Math.round(v.avg_wpm) : "—"],
        ["平均正確率", v.avg_acc != null ? Math.round(v.avg_acc) + "%" : "—"],
        ["挑戰最佳 WPM", v.best_challenge_wpm != null ? Math.round(v.best_challenge_wpm) : "—"],
        ["XP", v.xp != null ? v.xp : "—"],
        ["總點數", v.total_points != null ? v.total_points : "—"],
        ["線上時間（秒）", v.online_seconds != null ? v.online_seconds : "—"],
        ["已解鎖成就", v.achievements_unlocked != null ? v.achievements_unlocked : "—"],
        ["打字總字數", v.total_chars_typed != null ? v.total_chars_typed : "—"],
        ["最長連續登入", v.streak_longest != null ? v.streak_longest : "—"],
        ["被按讚數", v.like_count != null ? v.like_count : "—"],
        ["隱藏於排行榜", v.hide_from_leaderboard === true ? "是" : "否"],
        ["隱藏個人公開頁", v.hide_profile_view === true ? "是" : "否"],
        ["所屬教室 id", v.classroom_id || "—"]
    ]

    resultEl.innerHTML = `
    <div class="adm_item">
        <div class="adm_item_head">
            <span class="adm_item_title">${Adm_Esc(v.name || "（未取名的玩家）")}</span>
        </div>
        <div class="adm_kv">
            ${rows.map(function (r) {
                return `<div>${Adm_Esc(r[0])}</div><div>${Adm_Esc(r[1])}</div>`
            }).join("")}
        </div>
        <div class="adm_item_actions" style="margin-top:1rem;">
            ${v.public_id ? `<button class="adm_btn" onclick="window.open('TCTC2-0-view_profile.html?id=${Adm_Esc(v.public_id)}','_blank')">開啟公開頁</button>` : ""}
            <button class="adm_btn adm_btn_danger" onclick="Adm_Delete_Player('${Adm_Esc(anon_id)}')">刪除此玩家資料</button>
        </div>
    </div>`
}

function Adm_Delete_Player(anon_id) {
    // 刪除是不可逆的，所以用兩段式確認：先 confirm，再要求打字確認
    if (!confirm(`確定要刪除這個玩家的所有雲端資料嗎？\n\nanon_id: ${anon_id}\n\n這個動作無法復原。`)) return
    const typed = prompt('這個動作無法復原。請輸入「刪除」兩個字以確認：')
    if (typed !== "刪除") { Adm_Toast("已取消", false); return }

    Admin_Delete_Player_Data(anon_id, function (ok) {
        if (!ok) { Adm_Toast("刪除失敗", true); return }
        Adm_Toast("已刪除該玩家的資料")
        const resultEl = document.getElementById("adm_player_result")
        if (resultEl) resultEl.innerHTML = '<p class="adm_empty">該玩家資料已刪除</p>'
        Adm_Load_Reports()
    })
}

document.addEventListener("DOMContentLoaded", function () {
    const subtitleEl = document.getElementById("adm_subtitle")
    const deniedEl = document.getElementById("adm_denied")
    const deniedTextEl = document.getElementById("adm_denied_text")
    const panelEl = document.getElementById("adm_panel")

    if (typeof Check_Is_Admin !== "function") {
        subtitleEl.textContent = "系統錯誤"
        deniedTextEl.textContent = "firebase.js 沒有正確載入，請確認檔案版本。"
        deniedEl.classList.remove("is_hidden")
        return
    }

    Check_Is_Admin(function (is_admin) {
        if (!is_admin) {
            subtitleEl.textContent = "沒有權限"
            deniedTextEl.textContent = "這個頁面只有管理員能存取。請先用管理員帳號登入（點右上角註冊/登入），並確認該帳號的 uid 已經加進 Firebase 的 admins 節點。"
            deniedEl.classList.remove("is_hidden")
            return
        }

        subtitleEl.textContent = "意見回報、玩家檢舉與資料管理"
        panelEl.classList.remove("is_hidden")
        Adm_Load_Feedback()
        Adm_Load_Reports()
    })
})