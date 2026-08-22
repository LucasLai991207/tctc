// ===== 成就徽章圖示（SVG 字串）=====
// 原封不動從 achievements.js 搬過來，內容完全沒改
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
const ACHV_ICON_EYE = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
const ACHV_ICON_CLOCK = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 16,14"/></svg>`
const ACHV_ICON_PULSE = `<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"><polyline points="2,12 7,12 9,6 13,18 16,12 22,12"/></svg>`
const ACHV_ICON_STAR = `<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linejoin="round" fill="none"><polygon points="12,3 14.9,9.1 21.5,9.9 16.8,14.5 18,21 12,17.7 6,21 7.2,14.5 2.5,9.9 9.1,9.1"/></svg>`
const ACHV_ICON_HEART = `<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5 6.5 5c2 0 3.5 1.3 4.5 3 1-1.7 2.5-3 4.5-3 4 0 5.5 4 3 7.5C19 16.65 12 21 12 21Z"/></svg>`

const ACHV_TIER_CLASSES = ["pach_tier_locked", "pach_tier_bronze", "pach_tier_silver", "pach_tier_gold", "pach_tier_platinum"]
const ACHV_TIER_TITLES_DEFAULT = ["未達標", "銅牌", "銀牌", "金牌", "白金"]


const ACHV_CATEGORIES = [
    {
        key: "persistence",
        title: "堅持",
        titleIcon: ACHV_ICON_FLAME,
        achievements: [
            {
                key: "login_streak", name: "連續登入 - 連續沒中斷的登入天數", icon: ACHV_ICON_FLAME,
                dataSource: "streak", metric: "longest_streak",
                thresholds: [3, 7, 14, 30],
                condition: (t) => `連續登入達 ${t} 天`,
                format: (v) => `${Math.round(v)} 天`
            },
            {
                key: "total_days", name: "累積登入 - 所有累積的登入天數", icon: ACHV_ICON_CALENDAR_CHECK,
                dataSource: "streak", metric: "total_login_days",
                thresholds: [5, 20, 50, 100],
                condition: (t) => `累積登入達 ${t} 天`,
                format: (v) => `${Math.round(v)} 天`
            },
            {
                key: "comeback", name: "中斷後回歸 - 中斷登入特定天數以上後回歸", icon: ACHV_ICON_COMPASS,
                dataSource: "streak", metric: "longest_gap_days",
                thresholds: [1, 7, 15, 30],
                condition: (t) => `隔了 ${t} 天後回來`,
                format: (v) => `${Math.round(v)} 天`
            }
        ]
    },
    {
        key: "activity",
        title: "活躍度",
        titleIcon: ACHV_ICON_PULSE,
        achievements: [
            {
                key: "page_views", name: "瀏覽次數 - 總頁面刷新次數", icon: ACHV_ICON_EYE,
                dataSource: "stats", metric: "page_views",
                thresholds: [100, 500, 1000, 2500],
                condition: (t) => `網站瀏覽次數累積達 ${t.toLocaleString("zh-TW")} 次`,
                format: (v) => `${Math.round(v).toLocaleString("zh-TW")} 次`
            },
            {
                key: "online_time", name: "遊玩時長 - 累積總在線時長", icon: ACHV_ICON_CLOCK,
                dataSource: "stats", metric: "online_seconds",
                thresholds: [1800, 3600, 10800, 36000],
                condition: (t) => `累積在線時長達到 ${ACHV_Format_Duration(t)}`,
                format: (v) => ACHV_Format_Duration(v)
            },
            {
                key: "total_points", name: "積分累積 - 挑戰模式總積分", icon: ACHV_ICON_STAR,
                dataSource: "stats", metric: "total_points",
                thresholds: [50, 200, 600, 1500],
                condition: (t) => `挑戰模式累積積分達到 ${t.toLocaleString("zh-TW")} 分`,
                format: (v) => `${Math.round(v).toLocaleString("zh-TW")} 分`
            },
            {
                key: "popularity", name: "人氣王 - 獲得其他玩家讚數達特定數值", icon: ACHV_ICON_HEART,
                dataSource: "stats", metric: "like_count",
                thresholds: [2, 8, 20, 50],
                condition: (t) => `獲得其他玩家的讚達到 ${t} 個`,
                format: (v) => `${Math.round(v)} 讚`
            }
        ]
    },
    {
        key: "typing",
        title: "打字",
        titleIcon: ACHV_ICON_KEYBOARD,
        achievements: [
            {
                key: "total_chars", name: "累積字數 - 玩家打出的總「文字」數量累積", icon: ACHV_ICON_KEYBOARD,
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
                key: "easy_completion", name: "初級完成度 - 主線模式初級關卡的完成百分比", icon: ACHV_ICON_BOOK,
                dataSource: "stats", requiresLevelData: true,
                certificateLevel: "easy",   // 【新增】滿級（100%）時，榮譽牆會多顯示一個列印證書的連結
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
                key: "medium_completion", name: "中級完成度 - 主線模式中級關卡的完成百分比", icon: ACHV_ICON_KEYBOARD,
                dataSource: "stats", requiresLevelData: true,
                certificateLevel: "medium",   // 【新增】同上，中級也有證書；高級刻意不加──能打完的人太少，做了也沒什麼人用得到
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
                key: "hard_completion", name: "高級完成度 - 主線模式高級關卡的完成百分比", icon: ACHV_ICON_SPEED,
                dataSource: "stats", requiresLevelData: true,
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
                key: "total_completion", name: "總關卡完成度 - 主線模式所有關卡的完成百分比", icon: ACHV_ICON_FLAG,
                dataSource: "stats", requiresLevelData: true,
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
                key: "wpm", name: "挑戰模式 WPM 達標 - 挑戰模式WPM達到特定數值", icon: ACHV_ICON_SPEED,
                dataSource: "stats", metric: "best_challenge_wpm",
                thresholds: [20, 50, 100, 180],
                condition: (t) => `挑戰模式單次 WPM 達到 ${t}`,
                format: (v) => `${Math.round(v)} WPM`
            },
            {
                key: "wpm_streak", name: "連續維持高速 - 挑戰模式連續7場都達到特定速度", icon: ACHV_ICON_TRENDING_UP,
                dataSource: "stats", metric: "high_wpm_streak",
                thresholds: [35, 70, 100, 150],
                condition: (t) => `挑戰模式連續 7 場 WPM 都達到 ${t} 以上`,
                format: (v) => `${Math.round(v)} WPM`
            }
        ]
    },
    {
        key: "accuracy",
        title: "精準",
        titleIcon: ACHV_ICON_TARGET,
        achievements: [
            {
                key: "acc", name: "挑戰模式超級精準 - 挑戰模式單次達到特定正確率", icon: ACHV_ICON_TARGET,
                dataSource: "stats", metric: "best_challenge_acc",
                thresholds: [90, 95, 98, 100],
                condition: (t) => `挑戰模式單次正確率達到 ${t}%`,
                format: (v) => `${Math.round(v * 10) / 10}%`
            },
            {
                key: "perfect", name: "挑戰模式極致精準 - 挑戰模式單次正確率達到100%次數", icon: ACHV_ICON_CHECK_CIRCLE,
                dataSource: "stats", metric: "perfect_challenge_count",
                thresholds: [1, 3, 5, 10],
                condition: (t) => `挑戰模式單次正確率達到 100% 共 ${t} 次`,
                format: (v) => `${Math.round(v)} 次`
            },
            {
                key: "acc_streak", name: "連續高準確率 - 挑戰模式單次正確率達到90%以上次數", icon: ACHV_ICON_SHIELD,
                dataSource: "stats", metric: "high_acc_challenge_streak",
                thresholds: [3, 5, 10, 30],
                condition: (t) => `挑戰模式連續 ${t} 次正確率達到 90% 以上`,
                format: (v) => `${Math.round(v)} 次`
            }
        ]
    }
]

function ACHV_Format_Duration(totalSeconds){
    const seconds = Math.max(0, Math.round(totalSeconds || 0))
    const minutes = Math.floor(seconds / 60)

    if(minutes < 60) return `${minutes} 分鐘`

    const hours = minutes / 60
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小時`
}

// ===== 動態算出某難度在 Level_Data 裡「實際定義」的總關卡數 =====
function ACHV_Get_Total_Stage_Count(difficulty){
    if(typeof Level_Data === "undefined" || !Level_Data[difficulty]) return 0
    return Level_Data[difficulty].chapter.reduce(function(sum, chapter){
        return sum + (chapter.stage ? chapter.stage.length : 0)
    }, 0)
}

// ===== 依數值算出等級（0 = 未達標，1~4 = 銅/銀/金/白金）=====
function ACHV_Get_Tier_Index(value, thresholds){
    let tierIndex = 0
    for(let i = 0; i < thresholds.length; i++){
        if(value >= thresholds[i]) tierIndex = i + 1
    }
    return tierIndex
}

// ===== 目前這一階區間內的百分比（畫單項成就自己的進度條用）=====
function ACHV_Get_Tier_Progress_Percent(value, thresholds, tierIndex){
    if(tierIndex === thresholds.length) return 100
    const lowerBound = tierIndex === 0 ? 0 : thresholds[tierIndex - 1]
    const upperBound = thresholds[tierIndex]
    const percent = ((value - lowerBound) / (upperBound - lowerBound)) * 100
    return Math.max(0, Math.min(100, Math.round(percent)))
}

// ===== 算單一成就目前解鎖到第幾階，pending 成就固定回傳 0 =====
function ACHV_Get_Unlocked_Tiers(achv, data){
    if(achv.pending) return 0
    const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
    return ACHV_Get_Tier_Index(value, achv.thresholds)
}