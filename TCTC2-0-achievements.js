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
// 【新增】「活躍度」分類要用的三顆圖示：眼睛（瀏覽次數）、時鐘（遊玩時長）、
// 心電圖波形（分類標題本身，呼應 ranking.js 既有的「活躍度」語意分組）
const ACHV_ICON_EYE = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
const ACHV_ICON_CLOCK = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 16,14"/></svg>`
const ACHV_ICON_PULSE = `<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"><polyline points="2,12 7,12 9,6 13,18 16,12 22,12"/></svg>`

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
                thresholds: [1, 3, 5, 10],
                condition: (t) => `隔了 ${t} 天後回來`,
                format: (v) => `${Math.round(v)} 天`
            }
        ]
    },
    {
        // ===== 【新增】活躍度分類：瀏覽次數 + 遊玩時長 =====
        // 這兩項的資料來源（player_stats/{anon_id} 底下的 page_views /
        // online_seconds）在這支檔案最上方的文件註解裡本來就已經列在
        // 「目前已經有寫入邏輯」的欄位清單中（TCTC2-0-online_time.js +
        // TCTC2-0-firebase.js 的 Sync_Pending_Page_Views() /
        // Sync_Pending_Online_Time() 早就在同步這兩個數字了），所以這裡
        // 不用像「完成課程」那幾項一樣標 pending:true——資料源本來就存在，
        // 只是「榮譽牆」這邊之前沒有把它們變成成就而已。
        key: "activity",
        title: "活躍度",
        titleIcon: ACHV_ICON_PULSE,
        achievements: [
            {
                key: "page_views", name: "瀏覽次數", icon: ACHV_ICON_EYE,
                dataSource: "stats", metric: "page_views",
                thresholds: [100, 500, 1000, 2000],
                condition: (t) => `網站瀏覽次數累積達 ${t.toLocaleString("zh-TW")} 次`,
                format: (v) => `${Math.round(v).toLocaleString("zh-TW")} 次`
            },
            {
                // 門檻直接用「秒數」存放：30分鐘=1800秒、1小時=3600秒、
                // 3小時=10800秒、10小時=36000秒，跟 player_stats 裡
                // online_seconds 這個既有欄位的單位（秒）完全一致，
                // 不用額外新增欄位或做任何單位換算，讀值邏輯跟其他
                // metric 查表式成就完全相同，只有 format() 顯示時
                // 才轉換成人看得懂的「幾分鐘/幾小時」
                key: "online_time", name: "遊玩時長", icon: ACHV_ICON_CLOCK,
                dataSource: "stats", metric: "online_seconds",
                thresholds: [1800, 3600, 10800, 36000],
                condition: (t) => `累積在線時長達到 ${ACHV_Format_Duration(t)}`,
                format: (v) => ACHV_Format_Duration(v)
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
                // 【修改】原本是「所有模式累計平均正確率」，改成跟「速度」分類的
                // wpm 成就同一種語意：只看挑戰模式單次成績裡的最佳一次，
                // 資料源改成 best_challenge_acc（見 TCTC2-0-firebase.js 的
                // Submit_Challenge_Score_To_Leaderboard，跟 best_challenge_wpm
                // 用同一套「transaction + Math.max」寫法同步）
                key: "acc", name: "挑戰模式單次正確率達標", icon: ACHV_ICON_TARGET,
                dataSource: "stats", metric: "best_challenge_acc",
                thresholds: [90, 95, 98, 100],
                condition: (t) => `挑戰模式單次正確率達到 ${t}%`,
                format: (v) => `${Math.round(v * 10) / 10}%`
            },
            {
                // 【修改】原本是 pending（沒有資料源），現在改成計算「挑戰模式單次
                // 正確率剛好 100% 的次數」，資料源 perfect_challenge_count 同樣
                // 在 Submit_Challenge_Score_To_Leaderboard 裡用 transaction 累加
                key: "perfect", name: "挑戰模式滿分次數", icon: ACHV_ICON_CHECK_CIRCLE,
                dataSource: "stats", metric: "perfect_challenge_count",
                thresholds: [1, 3, 5, 10],
                condition: (t) => `挑戰模式單次正確率達到 100% 共 ${t} 次`,
                format: (v) => `${Math.round(v)} 次`
            },
            {
                // 【修改】原本是 pending，現在改成「挑戰模式連續幾次正確率都 ≥90%」，
                // 90% 這個達標門檻跟上面「acc」成就的銅牌門檻一致，資料源
                // high_acc_challenge_streak 存的是「歷史最長連續紀錄」（只增不減，
                // 跟 login_streak 的 streak_longest 同一種語意），不是目前這一段，
                // 這樣就算後來斷了，已經拿到的牌不會被收回
                key: "acc_streak", name: "連續高準確率", icon: ACHV_ICON_SHIELD,
                dataSource: "stats", metric: "high_acc_challenge_streak",
                thresholds: [3, 5, 10, 30],
                condition: (t) => `挑戰模式連續 ${t} 次正確率達到 90% 以上`,
                format: (v) => `${Math.round(v)} 次`
            }
        ]
    }
    // 「特殊」分類（彩蛋／特殊行為／隱藏成就）先擱置，見頁面下方的佔位區塊
]

// ===== 【新增】把「總秒數」轉成人類可讀的時長文字，給「遊玩時長」成就的
// condition() / format() 共用 =====
// 刻意跟 ranking.js 的 Format_Online_Seconds() 分開寫一份、不共用：
// 那支是排行榜要精確到「時分秒」，這裡只是成就卡片上一句簡短說明
// （例如「目前 1.5 小時 / 下一階：3 小時」），精確到秒反而讓文字過長、
// 在窄螢幕的卡片裡容易被擠壓換行，兩邊需求不同，各自維護各自的格式。
function ACHV_Format_Duration(totalSeconds){
    const seconds = Math.max(0, Math.round(totalSeconds || 0))
    const minutes = Math.floor(seconds / 60)

    if(minutes < 60) return `${minutes} 分鐘`

    const hours = minutes / 60
    // 未滿整數小時（例如 90 分鐘 = 1.5 小時）保留一位小數方便閱讀，
    // 剛好是整數小時（例如 180 分鐘 = 3 小時）就不顯示多餘的「.0」
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小時`
}

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

    // 【修正】原本這行只顯示「目前值 / 下一階絕對門檻」（例如 1,114 / 2,000），
    // 但長條圖 fillPercent 算的是「這一階自己的區間進度」（例如金牌→白金
    // 這一階只算 1000~2000 之間，結果是 11%）。當某一階的跨距很大（像
    // 瀏覽次數的 1000→2000 這階），兩個數字放在一起會讓人誤以為長條圖
    // 「填錯了」——文字暗示快 56%，長條卻只有 11%。
    // 這裡不改變長條圖「每階歸零重算」的既有設計（其他成就、連續登入等
    // 都共用這套邏輯，不宜貿然全站更動手感），而是直接把 fillPercent
    // 這個長條圖真正在用的數字一起印在文字說明裡，讓兩邊呈現的內容
    // 對得起來，玩家才知道「11%」指的是「這一階內的進度」，不是「整體
    // 距離下一階的總進度」。
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
    })
})