
function ACHV_Build_Badge_HTML(achv, data){
    // 不計算真實進度（因為資料源不存在），直接顯示「尚未開放」，
    // 避免用 0 去比對門檻造出一個看起來像「還沒達成」但其實是「功能還沒做」的假象
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

    // 【修改】優先用 getValue() 現場算值；沒有的話沿用原本的 metric 查表方式，
    // 舊的成就完全不用改，只有「關卡完成度」分類的 4 個會用到 getValue
    const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
    const tierIndex = ACHV_Get_Tier_Index(value, achv.thresholds)
    const tierClass = ACHV_TIER_CLASSES[tierIndex]
    const tierTitle = ACHV_TIER_TITLES_DEFAULT[tierIndex]
    const isLocked = tierIndex === 0
    const isMaxed = tierIndex === achv.thresholds.length

    // 進度條的填色跟徽章邊框顏色綁在一起（用同一個 tierClass 當 CSS class），
    // 這樣「進度越高、徽章顏色越高階」跟「進度條顏色」永遠是同一套視覺語言，
    // 不會有徽章已經是金色、但進度條還是灰色這種不一致的情況
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

// 渲染單一分類區塊（標題 + 分類進度條 + 卡片 grid），回傳 { html, unlocked, total }
// 供外層加總算「總覽進度條」用，不用重複算兩次
function ACHV_Render_Category(category, streakData, statsData){
    let categoryUnlocked = 0
    const categoryTotal = category.achievements.length * 4   // 每個成就固定 4 階

    const cardsHTML = category.achievements.map(function(achv){
        const data = achv.dataSource === "streak" ? streakData : statsData
        categoryUnlocked += ACHV_Get_Unlocked_Tiers(achv, data)
        return ACHV_Build_Badge_HTML(achv, data)
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

// 依 current_streak 給一句鼓勵/提醒文字，純顯示用，不影響任何數值計算
function ACHV_Build_Streak_Hint(streakData){
    if(!streakData) return ""

    const current = streakData.current_streak || 0

    if(current === 0){
        return "尚未有登入紀錄，明天再回來就會開始累積囉！"
    }
    if(current === 1){
        return "今天是新的開始，明天再登入就會累積成 2 天連續！"
    }
    return `已經連續 ${current} 天，明天記得回來維持紀錄！`
}

// 讀取這個玩家（anon_id）在 player_stats 底下的完整資料，
// 給「速度」「精準」「打字」「活躍度」等分類的成就計算用
//
// 【修正】原本這裡直接對 player_stats/{anon_id} 發一次 .once("value")，
// 完全沒等 online_time.js／firebase.js 那邊「把本機暫存秒數/瀏覽次數
// 補交上雲端」的 transaction 真正結束，導致「遊玩時長」這種成就有機率
// 讀到一個還沒塵埃落定的暫時推測值（可能只有這次要補交的一小段秒數，
// 不是雲端真正累積的總量），顯示成離譜的小數字（例如明明玩了好幾小時，
// 卻顯示「0 分鐘」）。這正是 firebase.js 裡 Wait_For_Online_Time_Sync()
// 上方那段註解描述的 race condition，Get_Own_Player_Stats()（給
// profile.html 用）早就用「先等同步、才真的發查詢」的寫法處理過這個問題，
// 這裡改成完全比照那個寫法，讓兩個地方讀到的數字不會不一致。
function ACHV_Get_Player_Stats(){
    return new Promise(function(resolve){
        if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
            resolve({})
            return
        }

        const anon_id = Get_Anon_Id()

        // 兩個 Wait_For_XXX_Sync 都用 typeof 保護，理論上有載入 firebase.js
        // 就一定會有這兩個函式，但保留保護比較安全，避免哪天檔案載入順序
        // 調整後這裡直接噴錯、整個榮譽牆壞掉
        const wait_online = (typeof Wait_For_Online_Time_Sync === "function")
            ? Wait_For_Online_Time_Sync
            : function(cb){ cb() }
        const wait_views = (typeof Wait_For_Page_Views_Sync === "function")
            ? Wait_For_Page_Views_Sync
            : function(cb){ cb() }

        wait_online(function(){
            wait_views(function(){
                tctc_db.ref(`player_stats/${anon_id}`).once("value")
                    .then(function(snapshot){
                        resolve(snapshot.val() || {})
                    })
                    .catch(function(error){
                        console.warn("[achievements] 讀取打字成就資料失敗：", error.message)
                        resolve({})
                    })
            })
        })
    })
}

// 主渲染流程：把 streak 資料跟 player_stats 資料都準備好之後，
// 一次算完總覽進度條 + 所有分類，避免總覽數字跟分類數字算兩套邏輯導致對不上
function ACHV_Render_All(streakData, statsData){
    // ----- 連續登入橫幅（沿用原本邏輯，不變動） -----
    const currentEl = document.getElementById("achv_current_streak")
    const longestEl = document.getElementById("achv_longest_streak")
    const totalEl = document.getElementById("achv_total_days")
    const hintEl = document.getElementById("achv_streak_hint")

    if(currentEl) currentEl.textContent = streakData ? (streakData.current_streak || 0) : 0
    if(longestEl) longestEl.textContent = streakData ? (streakData.longest_streak || 0) : 0
    if(totalEl) totalEl.textContent = streakData ? (streakData.total_login_days || 0) : 0
    if(hintEl) hintEl.textContent = ACHV_Build_Streak_Hint(streakData)

    // ----- 逐分類渲染，同時累加總覽用的解鎖數/總數 -----
    const categoriesEl = document.getElementById("achv_categories")
    let overallUnlocked = 0
    let overallTotal = 0

    if(categoriesEl){
        categoriesEl.innerHTML = ACHV_CATEGORIES.map(function(category){
            const result = ACHV_Render_Category(category, streakData, statsData)
            overallUnlocked += result.unlocked
            overallTotal += result.total
            return result.html
        }).join("")
    }

    // ----- 總覽進度條 -----
    const overviewCountEl = document.getElementById("achv_overview_count")
    const overviewFillEl = document.getElementById("achv_overview_fill")

    if(overviewCountEl){
        overviewCountEl.innerHTML = `${overallUnlocked} <span>/ ${overallTotal}</span>`
    }
    if(overviewFillEl){
        const overallPercent = overallTotal > 0 ? Math.round((overallUnlocked / overallTotal) * 100) : 0
        overviewFillEl.style.width = `${overallPercent}%`
    }

    // ===== 【新增】把總覽數字回傳給呼叫端 =====
    // 呼叫端（DOMContentLoaded 內）會拿 unlocked 這個數字去呼叫
    // Sync_Achievements_Unlocked()，同步進 player_stats/{anon_id}/
    // achievements_unlocked，給排行榜的「解鎖成就數量」榜用。
    // 直接回傳「這次渲染算出的同一份數字」，不在外面重算一次，
    // 確保排行榜看到的數字永遠跟畫面上顯示的總覽進度條一致。
    return { unlocked: overallUnlocked, total: overallTotal }
}

document.addEventListener("DOMContentLoaded", function(){
    // 跟排行榜的 anon_id 機制一致：訪客跟已登入玩家都能看、都能累積，
    // 不需要判斷登入狀態，直接讀資料渲染就好
    const streakPromise = (typeof TCTC_Get_Streak_Data === "function")
        ? TCTC_Get_Streak_Data()
        : Promise.resolve({ current_streak: 0, longest_streak: 0, total_login_days: 0, longest_gap_days: 0 })

    if(typeof TCTC_Get_Streak_Data !== "function"){
        console.warn("[achievements] 找不到 TCTC_Get_Streak_Data，請確認有載入 TCTC2-0-login_streak.js")
    }

    // streak 資料延遲 600ms 再讀：給 login_streak.js 頁面載入時的當日寫入請求
    // 足夠時間完成，600ms 是憑經驗抓的寬鬆值，不是精確同步機制——如果玩家網路
    // 真的很慢，這裡讀到的可能還是寫入前的舊資料，但不影響正確性，只是「畫面
    // 慢一點才反映最新數字」，下次重新整理或再次造訪就會是對的。
    // player_stats 資料跟 streak 是各自獨立的讀取，不用互相等待，用 Promise.all
    // 同時發出兩個請求，最後一起渲染，避免畫面分兩次跳動。
    Promise.all([
        new Promise(function(resolve){ setTimeout(function(){ resolve(streakPromise) }, 600) }),
        ACHV_Get_Player_Stats()
    ]).then(function(results){
        const overview = ACHV_Render_All(results[0], results[1])

        // ===== 【新增】把這次算出的「總解鎖成就數」同步進雲端 =====
        // 只在榮譽牆頁面渲染完成後同步一次，不需要在其他頁面也呼叫——
        // 這個數字本來就是「現場重新計算」出來的衍生值（邏輯等同
        // avg_wpm 用 wpm_sum/wpm_count 算出來後才 set() 寫入），只要
        // 玩家造訪過一次榮譽牆，雲端的數字就會更新到當下最新狀態，
        // 不需要更即時的同步頻率。Sync_Achievements_Unlocked() 定義在
        // TCTC2-0-firebase.js，這裡用 typeof 保護，避免哪個頁面忘記
        // 載入 firebase.js 時直接噴錯。
        if(typeof Sync_Achievements_Unlocked === "function" && overview){
            Sync_Achievements_Unlocked(overview.unlocked)
        }

        // ===== 【新增】用這次已經抓好的 streak + stats 資料，順便跑一次成就通知比對 =====
        // 這裡刻意「重複利用」剛剛渲染畫面用的同一份 results，不再另外發一次
        // Firebase 請求。之所以在榮譽牆頁面也要跑這個比對（而不是只靠其他頁面
        // 的即時觸發），是因為榮譽牆頁面同時具備「Level_Data + streak + stats」
        // 三種資料來源，是全站唯一一個「關卡完成度」分類成就能被正確計算與
        // 建立 baseline 的頁面之一（另一個是 game.html / main.html / profile.html，
        // 這幾個頁面也都有載入 level_data.js）。ACHV_Notify_Diff() 定義在
        // TCTC2-0-achv_notify.js，這裡用 typeof 保護，避免忘記載入該檔案時
        // 直接噴錯、拖累整個榮譽牆頁面渲染失敗。
        if(typeof ACHV_Notify_Diff === "function"){
            ACHV_Notify_Diff(results[0], results[1]).forEach(function(item){
                if(typeof ACHV_Notify_Show_Toast === "function") ACHV_Notify_Show_Toast(item)
            })
        }
    })
})