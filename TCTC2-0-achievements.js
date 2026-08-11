/* ============================================================
   TCTC2-0-achievements.js
   榮譽牆頁面邏輯：讀取 login_streak.js / player_stats 的資料並渲染畫面。

   這支檔案本身「不寫入」任何 Firebase 資料，純粹讀取 + 前端渲染，
   寫入的防作弊邏輯全部在 TCTC2-0-login_streak.js +
   database.rules.json 裡處理，這裡不重複那一層邏輯，職責切乾淨。

   ============================================================
   【架構說明・這次改版做了什麼】
   原本是「登入徽章（15張固定卡）」+「打字成就（8張獨立卡）」兩套
   各自的資料結構跟渲染邏輯。這次統一成一套「分類 → 成就 → 位階」
   的資料驅動系統：
     ACHV_CATEGORIES（分類，例如「堅持」）
       └ achievements（分類底下的成就，例如「連續登入」）
            └ thresholds（4 個數字，對應銅/銀/金/白金 4 階）
   好處：之後要新增成就，只要在對應分類的 achievements 陣列裡
   加一個物件即可，不用改渲染邏輯、也不用另外寫 CSS。

   【重要・誠實揭露：哪些成就目前「沒有資料來源」】
   player_stats/{anon_id} 目前只有這些欄位（來自 TCTC2-0-firebase.js）：
     avg_wpm, wpm_count, avg_acc, acc_count,
     avg_challenge_wpm, avg_challenge_acc, total_points,
     online_seconds, page_views,
     streak_current, streak_longest, streak_total_days, longest_gap_days

   「打字」分類的「完成課程」，以及「速度」的「連續維持高WPM」、
   「精準」的「100%正確」「連續高準確率」，目前完全沒有寫入邏輯在
   追蹤這些數字。這裡選擇「誠實顯示」：
   這些成就會被標記 pending:true，卡片顯示「尚未開放」而不是假裝
   有進度——因為 Firebase Rules 沒有對應欄位的 .validate，就算這裡
   算出假數字，也只是顯示假象，不會有任何實際寫入能力。
   要讓這幾項真正運作，需要另外：
     1. 在 game.html / TCTC2-0-challenge.js 對應的完成事件裡，
        新增寫入 total_chars_typed / chapters_completed /
        high_wpm_streak / perfect_session_count / high_acc_streak
        等欄位（建議沿用現有 transaction() 模式）
     2. 在 database.rules.json 的 player_stats 節點下加上對應
        .validate 規則
   這次先不動那些檔案，避免一次改動範圍過大，之後可以再另外討論。

   【重要・「關卡完成度」分類已經是正式功能，不是 pending】
   player_stats/{anon_id} 底下的 stages_completed_easy /
   stages_completed_medium / stages_completed_hard 三個欄位，已經在
   game.html 的六個「關卡第一次過關」寫入點同步進 Firebase（見
   TCTC2-0-firebase.js 的 Sync_Stage_Completion()），Firebase Rules
   也已經加上對應 .validate。這個分類底下四個成就（初級/中級/高級/
   總完成度）算的是「百分比」，分母不是寫死的數字，而是每次渲染時
   用 ACHV_Get_Total_Stage_Count() 現場對 Level_Data 算出來的，
   Lucas 之後加新章節/關卡完全不用回來改這支檔案。

   【重要・「累積字數」也已經是正式功能，不是 pending】
   player_stats/{anon_id} 底下的 total_chars_typed，已經在 game.html
   主線模式（counts_for_leaderboard 門檻通過時）跟 TCTC2-0-challenge.js
   挑戰模式（cg_meets_points_threshold 門檻通過時）同步進 Firebase
   （見 TCTC2-0-firebase.js 的 Sync_Chars_Typed()），算的是「打對的
   字數」，不算錯字。Firebase Rules 也已經加上對應 .validate（限制單次
   漲幅上限，防止一次改成天文數字，但不到逐字比對這麼嚴格）。

   【重要・「挑戰WPM達標」用的 best_challenge_wpm 也是新欄位】
   跟上面那批 pending 的不一樣，這個沒有標 pending——因為只差
   TCTC2-0-firebase.js 一個小地方就能生效，見這支檔案外的說明。
   metric 讀的是「單次挑戰模式最佳 WPM」（跟 avg_challenge_wpm 這個
   累計平均值不是同一個東西），玩家只要打出一次夠高的成績就能解鎖，
   不會因為打太多次把平均值拉低而拿不到。
   ============================================================ */

// ============================================================
// 圖示庫：統一線條 SVG 風格，viewBox 0 0 24 24，stroke 不寫死
// （交給 CSS 的 .pach_tier_xxx svg 規則決定顏色，換等級只是換 class）
// ============================================================
const ACHV_ICON_FLAME = `<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M12 2c2 3 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1.4 0 2-1.1 1-2.4C11 7 10 5 12 2Z"/></svg>`
const ACHV_ICON_CALENDAR_CHECK = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><polyline points="8,15 10.5,17.5 16,12.5"/></svg>`
const ACHV_ICON_COMPASS = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="9"/><polygon points="15,8 12,12 9,16 12,12 15,8"/></svg>`
const ACHV_ICON_KEYBOARD = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" fill="none"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="18" y1="10" x2="18" y2="10.01"/><line x1="7" y1="15" x2="17" y2="15"/></svg>`
const ACHV_ICON_FLAG = `<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="5" y1="3" x2="5" y2="21"/><path d="M5 4c3-2 6 2 9 0v8c-3 2-6-2-9 0Z"/></svg>`
const ACHV_ICON_BOOK = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M4 4c3-1 6-1 8 1v14c-2-2-5-2-8-1Z"/><path d="M20 4c-3-1-6-1-8 1v14c2-2 5-2 8-1Z"/></svg>`
const ACHV_ICON_SPEED = `<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"><polygon points="13,2 5,14 11,14 9,22 19,9 12,9"/></svg>`
const ACHV_ICON_TRENDING_UP = `<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"><polyline points="3,17 9,11 13,15 21,6"/><polyline points="14,6 21,6 21,13"/></svg>`
const ACHV_ICON_TARGET = `<svg viewBox="0 0 24 24" stroke-width="1.6" fill="none"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/></svg>`
const ACHV_ICON_CHECK_CIRCLE = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="9"/><polyline points="8,12.5 11,15.5 16,9"/></svg>`
const ACHV_ICON_SHIELD = `<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M12 2 L20 5.5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5.5 Z"/><polyline points="8.5,12 11,14.5 15.5,9.5"/></svg>`

const ACHV_TIER_CLASSES = ["pach_tier_locked", "pach_tier_bronze", "pach_tier_silver", "pach_tier_gold", "pach_tier_platinum"]
const ACHV_TIER_TITLES_DEFAULT = ["未達標", "銅牌", "銀牌", "金牌", "白金"]

// ============================================================
// 分類 + 成就資料表
// dataSource 決定要從哪個資料物件取值："streak"（TCTC_Get_Streak_Data
// 回傳的物件）或 "stats"（ACHV_Get_Player_Stats 回傳的 player_stats 物件）
// pending: true 代表目前 player_stats 裡還沒有這個欄位在寫入，
// 卡片會顯示「尚未開放」而不是「尚未達標」，避免誤導玩家
// ============================================================
const ACHV_CATEGORIES = [
    {
        key: "persistence",
        title: "堅持",
        titleIcon: ACHV_ICON_FLAME,
        achievements: [
            {
                key: "login_streak", name: "連續登入", icon: ACHV_ICON_FLAME,
                dataSource: "streak", metric: "longest_streak",
                thresholds: [3, 7, 14, 30],
                condition: (t) => `連續登入達 ${t} 天`,
                format: (v) => `${Math.round(v)} 天`
            },
            {
                key: "total_days", name: "累積登入", icon: ACHV_ICON_CALENDAR_CHECK,
                dataSource: "streak", metric: "total_login_days",
                thresholds: [5, 20, 50, 100],
                condition: (t) => `累積登入達 ${t} 天`,
                format: (v) => `${Math.round(v)} 天`
            },
            {
                key: "comeback", name: "中斷後回歸", icon: ACHV_ICON_COMPASS,
                dataSource: "streak", metric: "longest_gap_days",
                thresholds: [1, 7, 15, 30],
                condition: (t) => `隔了 ${t} 天後回來`,
                format: (v) => `${Math.round(v)} 天`
            }
        ]
    },
    {
        key: "typing",
        title: "打字",
        titleIcon: ACHV_ICON_KEYBOARD,
        achievements: [
            {
                key: "total_chars", name: "累積字數", icon: ACHV_ICON_KEYBOARD,
                dataSource: "stats", metric: "total_chars_typed",
                thresholds: [1000, 10000, 50000, 200000],
                condition: (t) => `累積輸入 ${t.toLocaleString("zh-TW")} 字`,
                format: (v) => `${Math.round(v).toLocaleString("zh-TW")} 字`
            },
            {
                key: "chapter_complete", name: "完成課程", icon: ACHV_ICON_BOOK,
                dataSource: "stats", metric: "chapters_completed", pending: true,
                thresholds: [1, 3, 6, 13],
                condition: (t) => `完成 ${t} 個課程章節`,
                format: (v) => `${Math.round(v)} 章`
            }
        ]
    },
    {
        key: "stage_completion",
        title: "關卡完成度",
        titleIcon: ACHV_ICON_FLAG,
        achievements: [
            {
                key: "easy_completion", name: "初級完成度", icon: ACHV_ICON_BOOK,
                dataSource: "stats",
                // 【新增】用 getValue() 現場算值，不是單純查表——這裡要算的是
                // 「已完成關卡數 ÷ Level_Data 裡實際定義的總關卡數 × 100」，
                // 分母交給 ACHV_Get_Total_Stage_Count() 動態算，之後 Lucas
                // 加新章節，這裡完全不用回來改任何寫死的數字
                getValue: (data) => {
                    const total = ACHV_Get_Total_Stage_Count("easy")
                    const completed = data ? (data.stages_completed_easy || 0) : 0
                    return total > 0 ? (completed / total) * 100 : 0
                },
                thresholds: [25, 50, 75, 100],
                condition: (t) => `初級關卡完成度達到 ${t}%`,
                format: (v) => `${Math.round(v)}%`
            },
            {
                key: "medium_completion", name: "中級完成度", icon: ACHV_ICON_KEYBOARD,
                dataSource: "stats",
                getValue: (data) => {
                    const total = ACHV_Get_Total_Stage_Count("medium")
                    const completed = data ? (data.stages_completed_medium || 0) : 0
                    return total > 0 ? (completed / total) * 100 : 0
                },
                thresholds: [25, 50, 75, 100],
                condition: (t) => `中級關卡完成度達到 ${t}%`,
                format: (v) => `${Math.round(v)}%`
            },
            {
                key: "hard_completion", name: "高級完成度", icon: ACHV_ICON_SPEED,
                dataSource: "stats",
                getValue: (data) => {
                    const total = ACHV_Get_Total_Stage_Count("hard")
                    const completed = data ? (data.stages_completed_hard || 0) : 0
                    return total > 0 ? (completed / total) * 100 : 0
                },
                thresholds: [25, 50, 75, 100],
                condition: (t) => `高級關卡完成度達到 ${t}%`,
                format: (v) => `${Math.round(v)}%`
            },
            {
                // 【新增】總關卡完成度：三個難度的「完成數」相加 ÷「總關卡數」相加，
                // 刻意不是三個百分比取平均——三個難度的關卡數不一樣多（目前
                // 78/96/32），直接平均會讓關卡數最少的高級難度佔比被放大、失真，
                // 用「總完成數 / 總關卡數」才能真正代表「玩家破了全站幾 % 的關」
                key: "total_completion", name: "總關卡完成度", icon: ACHV_ICON_FLAG,
                dataSource: "stats",
                getValue: (data) => {
                    const totalStages = ACHV_Get_Total_Stage_Count("easy") + ACHV_Get_Total_Stage_Count("medium") + ACHV_Get_Total_Stage_Count("hard")
                    const totalCompleted = data ? ((data.stages_completed_easy || 0) + (data.stages_completed_medium || 0) + (data.stages_completed_hard || 0)) : 0
                    return totalStages > 0 ? (totalCompleted / totalStages) * 100 : 0
                },
                thresholds: [25, 50, 75, 100],
                condition: (t) => `全站關卡完成度達到 ${t}%`,
                format: (v) => `${Math.round(v)}%`
            }
        ]
    },
    {
        key: "speed",
        title: "速度",
        titleIcon: ACHV_ICON_SPEED,
        achievements: [
            {
                key: "wpm", name: "挑戰模式 WPM 達標", icon: ACHV_ICON_SPEED,
                dataSource: "stats", metric: "best_challenge_wpm",
                thresholds: [20, 50, 100, 180],
                condition: (t) => `挑戰模式單次 WPM 達到 ${t}`,
                format: (v) => `${Math.round(v)} WPM`
            },
            {
                key: "wpm_streak", name: "連續維持高速", icon: ACHV_ICON_TRENDING_UP,
                dataSource: "stats", metric: "high_wpm_streak", pending: true,
                thresholds: [3, 7, 15, 30],
                condition: (t) => `連續 ${t} 場測驗 WPM 達標`,
                format: (v) => `${Math.round(v)} 場`
            }
        ]
    },
    {
        key: "accuracy",
        title: "精準",
        titleIcon: ACHV_ICON_TARGET,
        achievements: [
            {
                key: "acc", name: "正確率達標", icon: ACHV_ICON_TARGET,
                dataSource: "stats", metric: "avg_acc",
                thresholds: [80, 90, 95, 98],
                condition: (t) => `平均正確率達到 ${t}%`,
                format: (v) => `${Math.round(v * 10) / 10}%`
            },
            {
                key: "perfect", name: "100% 正確", icon: ACHV_ICON_CHECK_CIRCLE,
                dataSource: "stats", metric: "perfect_session_count", pending: true,
                thresholds: [1, 10, 50, 200],
                condition: (t) => `達成 100% 正確率 ${t} 次`,
                format: (v) => `${Math.round(v)} 次`
            },
            {
                key: "acc_streak", name: "連續高準確率", icon: ACHV_ICON_SHIELD,
                dataSource: "stats", metric: "high_acc_streak", pending: true,
                thresholds: [3, 7, 15, 30],
                condition: (t) => `連續 ${t} 場正確率達標`,
                format: (v) => `${Math.round(v)} 場`
            }
        ]
    }
    // 「特殊」分類（彩蛋／特殊行為／隱藏成就）先擱置，見頁面下方的佔位區塊
]

// ===== 【新增】動態算出某難度在 Level_Data 裡「實際定義」的總關卡數 =====
// 刻意不寫死數字：直接對 Level_Data 現場算 sum，Lucas 之後不管加幾個
// 章節/關卡，這裡的分母都會自動跟上，不用回來手動改成就門檻
function ACHV_Get_Total_Stage_Count(difficulty){
    if(typeof Level_Data === "undefined" || !Level_Data[difficulty]) return 0
    return Level_Data[difficulty].chapter.reduce(function(sum, chapter){
        return sum + (chapter.stage ? chapter.stage.length : 0)
    }, 0)
}

// 依目前數值算出這個成就達到第幾階（0 = 未達標，1~4 = 銅/銀/金/白金）
function ACHV_Get_Tier_Index(value, thresholds){
    let tierIndex = 0
    for(let i = 0; i < thresholds.length; i++){
        if(value >= thresholds[i]) tierIndex = i + 1
    }
    return tierIndex
}

// 依「目前數值」在「目前這一階的區間」裡算百分比，用來畫單項成就自己的進度條。
// 例如連續登入門檻是 [3,7,14,30]，目前值 5（銅牌已達成，卡在銅→銀之間）：
// 區間下界是 3（銅牌門檻）、上界是 7（銀牌門檻），百分比 = (5-3)/(7-3) = 50%。
// 這樣進度條每一階都是從 0% 重新畫到 100%，而不是「距離最終門檻還有多遠」
// 那種一次性長條——玩家比較容易感覺到「快到下一階了」。
function ACHV_Get_Tier_Progress_Percent(value, thresholds, tierIndex){
    if(tierIndex === thresholds.length) return 100   // 已經封頂（白金），永遠滿條
    const lowerBound = tierIndex === 0 ? 0 : thresholds[tierIndex - 1]
    const upperBound = thresholds[tierIndex]
    const percent = ((value - lowerBound) / (upperBound - lowerBound)) * 100
    return Math.max(0, Math.min(100, Math.round(percent)))
}

// 產生單一成就「橫排列」的 HTML。data 是對應 dataSource 的來源物件
// （streakData 或 statsData），可能是 {} 或 null，一律用 0 兜底。
//
// 版面改成橫排（圖示在左、名稱＋進度條在右）而不是直排卡片格線，
// 原因：直排格線在「一個分類只有 2~3 項成就」時會被 grid 拉開留白，
// 加上原本的長句「目前 X／下一階：條件描述」在窄欄位裡容易強制換行、
// 很難一眼看完。橫排可以讓文字沿著卡片寬度平鋪，同時進度條本身
// 就能表達「還差多少」，不需要再塞一整句條件描述進畫面。
function ACHV_Build_Badge_HTML(achv, data){
    // pending 成就：不計算真實進度（因為資料源不存在），直接顯示「尚未開放」，
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
        : `${achv.format(value)} / ${achv.format(achv.thresholds[tierIndex])}`

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

// 計算單一成就「已解鎖幾階」，pending 成就一律算 0（尚未開放不計入解鎖數，
// 但仍計入總數的分母，讓玩家知道之後會有這些成就等著解鎖）
function ACHV_Get_Unlocked_Tiers(achv, data){
    if(achv.pending) return 0
    const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
    return ACHV_Get_Tier_Index(value, achv.thresholds)
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
// 給「速度」「精準」「打字」三個分類的成就計算用
function ACHV_Get_Player_Stats(){
    return new Promise(function(resolve){
        if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
            resolve({})
            return
        }

        const anon_id = Get_Anon_Id()
        tctc_db.ref(`player_stats/${anon_id}`).once("value")
            .then(function(snapshot){
                resolve(snapshot.val() || {})
            })
            .catch(function(error){
                console.warn("[achievements] 讀取打字成就資料失敗：", error.message)
                resolve({})
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
        ACHV_Render_All(results[0], results[1])
    })
})