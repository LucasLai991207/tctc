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

function VP_Show_Blocked(title, text, bioData){
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

    // ============================================================
    // 【新增】簡介永遠公開，跟「允許其他玩家查看我的個人資料」開關脫鉤
    // ------------------------------------------------------------
    // 玩家關掉那個開關擋掉的是榮譽牆/統計數字，簡介比較接近「自我介紹／
    // 留言板」的性質，公開出來對其他玩家比較有用（例如想知道這是誰、
    // 老師想看班上學生簡介），所以刻意讓它不受這個隱私開關影響——
    // 就算個人資料被設成不公開，這裡還是會把名字+簡介露出來，只有
    // 榮譽牆/統計數字繼續被擋下。
    //
    // bioData 只有「result.hidden === true」這條路徑才會帶進來（見下面
    // DOMContentLoaded 的呼叫點）。其他呼叫 VP_Show_Blocked() 的地方
    // （找不到玩家／讀取失敗／連結缺資訊）沒有玩家資料可以顯示，不會
    // 傳第三個參數，這裡的 if 判斷會自動把這個區塊藏起來，維持原本
    // 「只有標題+說明文字」的樣子。
    // ============================================================
    const bioWrapEl = document.getElementById("vp_blocked_bio")
    const bioNameEl = document.getElementById("vp_blocked_bio_name")
    const bioIntroEl = document.getElementById("vp_blocked_bio_intro")

    if(bioWrapEl){
        if(bioData){
            bioWrapEl.classList.remove("is_hidden")
            // 用 textContent，理由跟 VP_Render_Profile 裡名字/簡介的寫法一致：
            // 玩家自訂輸入不可信，textContent 天生不會被當 HTML 解析，
            // 不需要另外呼叫 Escape_Html
            if(bioNameEl) bioNameEl.textContent = bioData.name || "訪客"
            if(bioIntroEl) bioIntroEl.textContent = bioData.intro || "這位玩家還沒有寫簡介。"
        } else {
            bioWrapEl.classList.add("is_hidden")
        }
    }
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
   ===== 【改版】已解鎖成就清單 =====
   原本這裡（VP_Build_Badge_HTML / VP_Render_Category）是完整複製一份
   TCTC2-0-achievements.js 的渲染邏輯：不管解鎖與否，每個分類底下的
   每一項成就都會整條列出來、每項還帶一條自己的進度條——在「查看別人
   的公開頁」這個情境下太雜太長（別人還沒達成什麼，其實不是訪客真正
   關心的資訊）。

   改成 VP_Build_Unlocked_List_Item()：只負責畫「單一已解鎖成就」的
   一行（圖示＋名稱＋位階），不畫進度條、不畫 caption。
   VP_Render_Achievements() 則取代原本的 VP_Render_Category()：一次
   掃過 ACHV_CATEGORIES 裡所有成就，篩出「tierIndex > 0（至少拿到銅牌）」
   的項目，其餘（未達標／pending 尚未開發）一律不進清單。
   ------------------------------------------------------------ */

// 單一已解鎖成就的清單項目。tierIndex 由呼叫端算好傳進來（1~4，
// 對應銅/銀/金/白金），這支函式本身不做任何門檻判斷，只負責排版。
function VP_Build_Unlocked_List_Item(achv, tierIndex){
    const tierClass = ACHV_TIER_CLASSES[tierIndex]
    const tierTitle = ACHV_TIER_TITLES_DEFAULT[tierIndex]

    return `
        <div class="vp_achv_item">
            <span class="vp_achv_icon ${tierClass}">${achv.icon}</span>
            <span class="vp_achv_name">${achv.name}</span>
            <span class="vp_achv_tier ${tierClass}">${tierTitle}</span>
        </div>
    `
}

// 掃過全部分類、算出總覽數字，同時把「已解鎖」的項目蒐集成一份扁平陣列
// （不分類、不保留分類標題），最後依位階高到低排序後畫成清單。
function VP_Render_Achievements(streakData, statsData){
    let overallUnlocked = 0
    let overallTotal = 0
    const unlockedItems = []   // 每一項：{ tierIndex, html }，html 先算好存著，排序後直接 join

    ACHV_CATEGORIES.forEach(function(category){
        category.achievements.forEach(function(achv){
            overallTotal += 4   // 每個成就固定 4 階，跟 achievements.js 算總數的邏輯一致，不能改

            if(achv.pending) return   // 功能還沒開發的成就：不計入解鎖數，清單裡也不會出現

            const data = achv.dataSource === "streak" ? streakData : statsData
            const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
            const tierIndex = ACHV_Get_Tier_Index(value, achv.thresholds)

            overallUnlocked += tierIndex

            // tierIndex === 0 代表連銅牌門檻都還沒到，這項成就不進「已解鎖」清單
            if(tierIndex > 0){
                unlockedItems.push({ tierIndex: tierIndex, html: VP_Build_Unlocked_List_Item(achv, tierIndex) })
            }
        })
    })

    // 位階高的排前面（白金 4 > 金 3 > 銀 2 > 銅 1），讓訪客一眼先看到最厲害的成就。
    // Array.prototype.sort 從 ES2019 起在所有主流瀏覽器都保證是穩定排序，
    // 所以同一個 tierIndex 的項目彼此之間，順序會維持 ACHV_CATEGORIES 資料表裡原本的排列，不會被打亂
    unlockedItems.sort(function(a, b){ return b.tierIndex - a.tierIndex })

    const listEl = document.getElementById("vp_achv_list")
    if(listEl){
        listEl.innerHTML = unlockedItems.length > 0
            ? unlockedItems.map(function(item){ return item.html }).join("")
            : `<p class="vp_achv_empty">無（成就系統自2026/8/12才發佈，在此之前獲得的成積不納入）</p>`
    }

    const overviewCountEl = document.getElementById("vp_overview_count")
    const overviewFillEl = document.getElementById("vp_overview_fill")
    if(overviewCountEl) overviewCountEl.innerHTML = `${overallUnlocked} <span>/ ${overallTotal}</span>`
    if(overviewFillEl){
        const overallPercent = overallTotal > 0 ? Math.round((overallUnlocked / overallTotal) * 100) : 0
        overviewFillEl.style.width = `${overallPercent}%`
    }
}

// ===== 主渲染：把整包 player_stats 原始資料畫成頁面內容 =====
// raw：player_stats/{anon_id} 的原始節點內容（Get_Public_Player_Profile 或
// Get_Own_Player_Stats 回傳的物件）。is_self 用來決定要不要顯示提示條。
/* ------------------------------------------------------------
   ===== 【新增】按讚按鈕邏輯 =====
   跟 VP_Render_Profile 分開寫成獨立函式，單純是不想讓那支已經很長的
   函式再變得更長——邏輯上完全是 VP_Render_Profile 的一部分，只在那裡
   被呼叫一次，不是給其他頁面共用的通用工具。
   ------------------------------------------------------------ */
function VP_Init_Like_Button(raw, is_self){
    const btnEl = document.getElementById("vp_like_btn")
    if(!btnEl) return

    const iconEl = document.getElementById("vp_like_icon")
    const countEl = document.getElementById("vp_like_count")

    if(is_self){
        // 看自己：讚數還是要看得到（想知道自己被讚幾次），但不能讚自己，
        // 所以顯示歸顯示，按鈕鎖住不能點，也不套用「已讚」那個實心愛心樣式
        // ——空心愛心 + 鎖住的視覺，跟「還沒讚過別人」但「可以點」的狀態
        // 明確區分開來，靠 disabled 本身的灰階效果做出差異
        btnEl.classList.remove("is_hidden")
        btnEl.disabled = true
        if(countEl) countEl.textContent = raw.like_count || 0
        return
    }

    const target_id = VP_Get_Target_Anon_Id()

    btnEl.classList.remove("is_hidden")
    if(countEl) countEl.textContent = raw.like_count || 0

    function Set_Liked_Visual(){
        btnEl.classList.add("vp_like_btn_liked")
        btnEl.disabled = true
        if(iconEl) iconEl.textContent = "♥"
    }

    if(typeof Get_Own_Like_Status !== "function" || typeof Like_Player !== "function"){
        // 找不到這兩個函式代表沒載入到新版 firebase.js，按鈕先關掉比顯示一顆
        // 按了沒反應的死按鈕誠實
        btnEl.classList.add("is_hidden")
        return
    }

    // 先問過「我是不是已經讚過這個人」，已經讚過就直接顯示已讚狀態，
    // 不用等玩家點下去才發現自己讚過了
    Get_Own_Like_Status(target_id, function(already_liked){
        if(already_liked) Set_Liked_Visual()
    })

    btnEl.addEventListener("click", function(){
        if(btnEl.disabled) return
        btnEl.disabled = true   // 送出去之前先鎖住，避免手滑連點兩次同時發出兩個請求

        Like_Player(target_id, function(success){
            if(success){
                Set_Liked_Visual()
                if(countEl) countEl.textContent = (raw.like_count || 0) + 1
            } else {
                // 失敗最常見的原因是「已經讚過了」（規則擋下重複寫入）——
                // 直接當作已讚處理，不用另外跳錯誤訊息
                Set_Liked_Visual()
            }
        })
    })
}

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

    // ===== 【新增】按讚按鈕 =====
    // 看自己的預覽頁：不顯示按鈕（不能讚自己，顯示了也點不出東西）。
    // 看別人：讚數直接沿用 raw.like_count（Get_Public_Player_Profile／
    // Get_Own_Player_Stats 本來就會把整個 player_stats 節點帶回來，不用
    // 為了這顆數字多發一次請求），是否「已經讚過」則需要另外問一次
    // player_likes/{target}/{我的 anon_id}，這筆資料不在 player_stats 底下。
    VP_Init_Like_Button(raw, is_self)

    // ===== 【新增】XP 進度條 =====
    // XP_Get_Level_Progress() 定義在 TCTC2-0-xp_data.js，回傳
    // { level, current, needed, percent }：current/needed 是「這一級目前
    // 累積多少 XP／這一級總共要多少 XP」，percent 是算好的百分比，
    // 不用自己重算一次公式（跟 main.html 的 xp_display.js 共用同一套邏輯，
    // 兩邊算出來的數字保證一致）。
    const xpWrapEl = document.getElementById("vp_xp_wrap")
    if(xpWrapEl){
        if(typeof XP_Get_Level_Progress === "function"){
            const xp = typeof raw.xp === "number" ? raw.xp : 0
            const progress = XP_Get_Level_Progress(xp)
            const fillEl = document.getElementById("vp_xp_fill")
            const textEl = document.getElementById("vp_xp_text")

            if(fillEl) fillEl.style.width = `${progress.percent}%`
            if(textEl){
                // 已經封頂等級：不再顯示「還差多少」，改顯示總 XP，跟 xp_display.js 的寫法一致
                textEl.textContent = (typeof XP_CONFIG !== "undefined" && progress.level >= XP_CONFIG.max_level)
                    ? `已達最高等級・${xp} XP`
                    : `${progress.current} / ${progress.needed} XP`
            }
        } else {
            // 找不到 XP_Get_Level_Progress（代表 xp_data.js 忘記載入）：
            // 直接把整個進度條區塊藏起來，比顯示一條卡在 0% 的假進度條更誠實
            xpWrapEl.classList.add("is_hidden")
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
    // 【新增】以下三列直接沿用 Get_Public_Player_Profile() 已經回傳的原始欄位，
    // 沒有多發任何一次 Firebase 請求
    set_text("vp_stat_views", `${raw.page_views ?? 0} 次`)
    set_text("vp_stat_longest_streak", `${raw.streak_longest ?? 0} 天`)
    set_text("vp_stat_total_days", `${raw.streak_total_days ?? 0} 天`)

    // ----- 成就（改版：只列已解鎖，扁平條列式，見 VP_Render_Achievements） -----
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

    if(typeof ACHV_CATEGORIES !== "undefined"){
        VP_Render_Achievements(streakData, statsData)
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
            // 【修改】第三個參數帶入 name/intro，讓 VP_Show_Blocked() 就算在
            // 「個人資料不公開」這條路徑，也能把簡介露出來——見 VP_Show_Blocked
            // 內部那段【新增】的完整說明。result.name / result.intro 由
            // firebase.js 的 Get_Public_Player_Profile() 在 hidden 分支裡
            // 額外帶出來，不需要在這裡多發一次請求。
            VP_Show_Blocked(
                "此玩家沒有公開個人資料",
                "這位玩家已將個人資料設為不公開，無法查看成就與統計數字。",
                { name: result.name, intro: result.intro }
            )
            return
        }
        VP_Render_Profile(result, false)
    })
})