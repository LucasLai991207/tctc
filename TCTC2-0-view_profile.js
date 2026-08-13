/* ============================================================
   TCTC2-0-view_profile.js
   排行榜點名字進來的「唯讀公開個人資料頁」

   進入方式：TCTC2-0-view_profile.html?id={anon_id}，id 是被查看那個
   玩家的 anon_id（見 TCTC2-0-ranking.js 的 Get_Player_Name_Link_HTML）。

   隱私規則（跟 TCTC2-0-firebase.js 的 Get_Public_Player_Profile 對應）：
   - 對方把 player_stats/{anon_id}/hide_profile_view 設成 true：
     不管讀到多少資料，這裡一律只顯示「未公開」，不渲染任何統計/成就。
   - id 剛好是自己：略過隱私檢查，永遠看得到（用 Get_Own_Player_Stats，
     不是 Get_Public_Player_Profile），並顯示一條「這是你自己的預覽」提示條，
     這樣玩家調整開關前後都能親自確認畫面長怎樣。
   ============================================================ */

// ===== 讀取網址上的 ?id= 參數 =====
function VP_Get_Target_Anon_Id(){
    const params = new URLSearchParams(window.location.search)
    return params.get("id")
}

function VP_Show_Loading(){
    const el = document.getElementById("vp_loading_state")
    if(el) el.classList.remove("is_hidden")
    const blockedEl = document.getElementById("vp_blocked_state")
    if(blockedEl) blockedEl.classList.add("is_hidden")
    const contentEl = document.getElementById("vp_content")
    if(contentEl) contentEl.classList.add("is_hidden")
}

function VP_Show_Blocked(title, text){
    const loadingEl = document.getElementById("vp_loading_state")
    if(loadingEl) loadingEl.classList.add("is_hidden")
    const contentEl = document.getElementById("vp_content")
    if(contentEl) contentEl.classList.add("is_hidden")

    const blockedEl = document.getElementById("vp_blocked_state")
    if(blockedEl) blockedEl.classList.remove("is_hidden")

    const titleEl = document.getElementById("vp_blocked_title")
    const textEl = document.getElementById("vp_blocked_text")
    if(titleEl && title) titleEl.textContent = title
    if(textEl && text) textEl.textContent = text
}

// ===== 秒數轉人類可讀時長（跟 profile.js 的 Format_Online_Seconds_For_Profile 邏輯一致）=====
function VP_Format_Online_Seconds(total_seconds){
    const seconds_int = Math.floor(total_seconds || 0)
    if(seconds_int < 60) return `${seconds_int} 秒`

    const hours = Math.floor(seconds_int / 3600)
    const minutes = Math.floor((seconds_int % 3600) / 60)
    const seconds = seconds_int % 60

    if(hours > 0) return `${hours}時${minutes}分${seconds}秒`
    return `${minutes} 分 ${seconds} 秒`
}

/* ------------------------------------------------------------
   以下兩個函式跟 TCTC2-0-achievements.js 的 ACHV_Build_Badge_HTML /
   ACHV_Render_Category 邏輯完全一樣（同一份 ACHV_CATEGORIES 資料表、
   同一套徽章樣式），故意複製一份而不是直接載入 achievements.js：
   那支檔案底下的 DOMContentLoaded 會自動抓「自己」的 streak/stats
   資料、呼叫 Sync_Achievements_Unlocked() 等只有「本人」在榮譽牆頁面
   才該做的事，這個頁面顯示的是「別人」的資料，不能共用那段自動流程，
   只需要它前半段「純函式、給什麼資料就畫出什麼 HTML」的部分。
   ------------------------------------------------------------ */
function VP_Build_Badge_HTML(achv, data){
    if(achv.pending){
        return `
            <div class="achv_badge_row achv_badge_pending">
                <div class="pach_medal achv_medal_row pach_tier_locked">${achv.icon}</div>
                <div class="achv_badge_info">
                    <div class="achv_badge_info_top">
                        <span class="achv_badge_name">${achv.name}</span>
                        <span class="achv_badge_pending_tag">此功能還沒開發</span>
                    </div>
                    <p class="achv_badge_caption">目標：${achv.condition(achv.thresholds[0])}</p>
                </div>
            </div>
        `
    }

    const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
    const tierIndex = ACHV_Get_Tier_Index(value, achv.thresholds)
    const tierClass = ACHV_TIER_CLASSES[tierIndex]
    const tierTitle = ACHV_TIER_TITLES_DEFAULT[tierIndex]
    const isLocked = tierIndex === 0
    const isMaxed = tierIndex === achv.thresholds.length

    const fillPercent = ACHV_Get_Tier_Progress_Percent(value, achv.thresholds, tierIndex)

    const caption = isMaxed
        ? `已達最高等級・目前 ${achv.format(value)}`
        : `${achv.format(value)} / ${achv.format(achv.thresholds[tierIndex])}（${fillPercent}%）`

    return `
        <div class="achv_badge_row ${isLocked ? "achv_badge_is_locked" : ""}">
            <div class="pach_medal achv_medal_row ${tierClass}">${achv.icon}</div>
            <div class="achv_badge_info">
                <div class="achv_badge_info_top">
                    <span class="achv_badge_name">${achv.name}</span>
                    <span class="achv_badge_tier_inline">${tierTitle}</span>
                </div>
                <div class="achv_badge_progress_track">
                    <div class="achv_badge_progress_fill ${tierClass}" style="width:${fillPercent}%;"></div>
                </div>
                <p class="achv_badge_caption">${caption}</p>
            </div>
        </div>
    `
}

function VP_Render_Category(category, streakData, statsData){
    let categoryUnlocked = 0
    const categoryTotal = category.achievements.length * 4

    const cardsHTML = category.achievements.map(function(achv){
        const data = achv.dataSource === "streak" ? streakData : statsData
        categoryUnlocked += ACHV_Get_Unlocked_Tiers(achv, data)
        return VP_Build_Badge_HTML(achv, data)
    }).join("")

    const percent = categoryTotal > 0 ? Math.round((categoryUnlocked / categoryTotal) * 100) : 0

    const html = `
        <div class="achv_category_block">
            <div class="achv_category_head">
                <h2 class="achv_category_title">
                    <span class="achv_category_title_icon">${category.titleIcon}</span>${category.title}
                </h2>
                <div class="achv_category_progress_wrap">
                    <div class="achv_category_progress_track">
                        <div class="achv_category_progress_fill" style="width:${percent}%;"></div>
                    </div>
                    <span class="achv_category_progress_text">${categoryUnlocked}/${categoryTotal}</span>
                </div>
            </div>
            <div class="achv_badge_list">${cardsHTML}</div>
        </div>
    `

    return { html: html, unlocked: categoryUnlocked, total: categoryTotal }
}

// ===== 主渲染：把整包 player_stats 原始資料畫成頁面內容 =====
// raw：player_stats/{anon_id} 的原始節點內容（Get_Public_Player_Profile 或
// Get_Own_Player_Stats 回傳的物件）。is_self 用來決定要不要顯示提示條。
function VP_Render_Profile(raw, is_self){
    raw = raw || {}

    const loadingEl = document.getElementById("vp_loading_state")
    if(loadingEl) loadingEl.classList.add("is_hidden")
    const blockedEl = document.getElementById("vp_blocked_state")
    if(blockedEl) blockedEl.classList.add("is_hidden")
    const contentEl = document.getElementById("vp_content")
    if(contentEl) contentEl.classList.remove("is_hidden")

    const selfBannerEl = document.getElementById("vp_self_banner")
    if(selfBannerEl) selfBannerEl.classList.toggle("is_hidden", !is_self)

    // ----- 名字 / 簡介 / LV 標籤 -----
    // 用 textContent 而不是 innerHTML：玩家自訂的名字/簡介是不可信的使用者輸入，
    // textContent 不會把裡面的內容當 HTML 解析，天生就不會有 XSS 問題，
    // 不需要另外呼叫 Escape_Html（那是 ranking.js 用 innerHTML 拼字串時才需要的做法）。
    const nameEl = document.getElementById("vp_player_name")
    if(nameEl) nameEl.textContent = raw.name || "訪客"

    const introEl = document.getElementById("vp_player_intro")
    if(introEl) introEl.textContent = raw.intro || ""

    const levelSlotEl = document.getElementById("vp_level_badge_slot")
    if(levelSlotEl){
        if(typeof XP_Get_Level === "function"){
            const xp = typeof raw.xp === "number" ? raw.xp : 0
            levelSlotEl.innerHTML = `<span class="rank_level_badge">LV ${XP_Get_Level(xp)}</span>`
        } else {
            levelSlotEl.innerHTML = ""
        }
    }

    // ----- 統計資料 -----
    const set_text = function(id, text){
        const el = document.getElementById(id)
        if(el) el.textContent = text
    }
    set_text("vp_stat_avg_wpm", `${raw.avg_wpm ?? 0} WPM`)
    set_text("vp_stat_avg_acc", `${raw.avg_acc ?? 0}%`)
    set_text("vp_stat_online_time", VP_Format_Online_Seconds(raw.online_seconds ?? 0))
    set_text("vp_stat_points", `${raw.total_points ?? 0} 積分`)
    set_text("vp_stat_streak", `${raw.streak_current ?? 0} 天`)

    // ----- 成就 -----
    // ACHV_CATEGORIES 裡「堅持」分類的成就用的是 streakData 這個獨立形狀
    // （current_streak / longest_streak / total_login_days / longest_gap_days），
    // 跟 player_stats 原始欄位名稱（streak_current / streak_longest / ...）不一樣，
    // 這裡要手動轉換，寫法跟 TCTC2-0-achievements.js 的 ACHV_Render_All 一致。
    const streakData = {
        current_streak: raw.streak_current || 0,
        longest_streak: raw.streak_longest || 0,
        total_login_days: raw.streak_total_days || 0,
        longest_gap_days: raw.longest_gap_days || 0
    }
    const statsData = raw // 其餘分類的成就都直接用 metric 名稱查 raw 本身的欄位

    const categoriesEl = document.getElementById("vp_categories")
    let overallUnlocked = 0
    let overallTotal = 0

    if(categoriesEl && typeof ACHV_CATEGORIES !== "undefined"){
        categoriesEl.innerHTML = ACHV_CATEGORIES.map(function(category){
            const result = VP_Render_Category(category, streakData, statsData)
            overallUnlocked += result.unlocked
            overallTotal += result.total
            return result.html
        }).join("")
    }

    const overviewCountEl = document.getElementById("vp_overview_count")
    const overviewFillEl = document.getElementById("vp_overview_fill")
    if(overviewCountEl) overviewCountEl.innerHTML = `${overallUnlocked} <span>/ ${overallTotal}</span>`
    if(overviewFillEl){
        const overallPercent = overallTotal > 0 ? Math.round((overallUnlocked / overallTotal) * 100) : 0
        overviewFillEl.style.width = `${overallPercent}%`
    }
}

document.addEventListener("DOMContentLoaded", function(){
    VP_Show_Loading()

    const target_id = VP_Get_Target_Anon_Id()
    if(!target_id){
        VP_Show_Blocked("找不到這位玩家", "這個連結缺少玩家資訊，請從排行榜重新點擊玩家名字進來。")
        return
    }

    if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
        VP_Show_Blocked("暫時無法載入", "系統暫時無法連線，請重新整理頁面再試一次。")
        return
    }

    const is_self = target_id === Get_Anon_Id()

    if(is_self){
        // 看自己：直接用 Get_Own_Player_Stats()，不受 hide_profile_view 影響，
        // 讓玩家不管開關是什麼狀態，都能親自確認自己的公開頁長怎樣
        if(typeof Get_Own_Player_Stats !== "function"){
            VP_Show_Blocked("暫時無法載入", "系統暫時無法連線，請重新整理頁面再試一次。")
            return
        }
        Get_Own_Player_Stats(function(stats){
            if(stats === null){
                VP_Show_Blocked("讀取失敗", "讀取你的資料時發生錯誤，請稍後再試一次。")
                return
            }
            VP_Render_Profile(stats, true)
        })
        return
    }

    // 看別人：一定要透過 Get_Public_Player_Profile()，讓它先檢查對方的
    // hide_profile_view 開關，這裡不能繞過去直接查 player_stats
    if(typeof Get_Public_Player_Profile !== "function"){
        VP_Show_Blocked("暫時無法載入", "系統暫時無法連線，請重新整理頁面再試一次。")
        return
    }

    Get_Public_Player_Profile(target_id, function(result){
        if(result === null){
            VP_Show_Blocked("讀取失敗", "讀取這位玩家的資料時發生錯誤，請稍後再試一次。")
            return
        }
        if(!result.exists){
            VP_Show_Blocked("找不到這位玩家", "這個玩家還沒有任何資料，或連結有誤。")
            return
        }
        if(result.hidden){
            VP_Show_Blocked("此玩家沒有公開個人資料", "這位玩家已將個人資料設為不公開，無法查看成就與統計數字。")
            return
        }
        VP_Render_Profile(result, false)
    })
})
