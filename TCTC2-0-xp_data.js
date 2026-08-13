// ============================================================
// TCTC2-0-xp_data.js
// 全站「經驗值 / 等級」系統的唯一設定檔。
//
// 想調整：
//   - 哪個行為給多少 XP
//   - 升級要多少 XP、封頂等級
//   - 每個等級區間對應的稱號（取代原本寫死的「初學者」）
// 全部只改下面 XP_CONFIG 這個物件就好，不用去改任何一支功能程式碼
// （XP_CONFIG 下面那幾個函式是純計算用，不需要修改）。
//
// 這支檔案本身不會主動呼叫任何雲端同步，純粹是「資料表 + 計算工具」，
// 給 TCTC2-0-firebase.js（負責寫入/累加 XP）跟 TCTC2-0-xp_display.js
// （負責在畫面上顯示等級）共用。務必放在這兩支檔案「之前」載入。
// ============================================================

const XP_CONFIG = {
    // ===== 每個行為給多少 XP =====
    actions: {
        // 主線模式：每完成一次「有算進排行榜」的測驗（不論是不是第一次玩這關）
        stage_clear: 8,

        // 主線模式：「第一次」破某一關的額外獎勵
        // （跟上面 stage_clear 疊加，所以玩家首次破關 = stage_clear + stage_first_clear）
        stage_first_clear: 25,

        // 打字量：每打對這麼多個字，換算 1 點 XP（無條件捨去），主線／挑戰模式共用同一套
        chars_per_xp: 20,

        // 挑戰模式：這次測驗賺到的「積分」乘上這個倍率 = 這次額外拿到的 XP
        // （挑戰模式的積分已經把難度/時長都算進去了，直接借用那套權重，不用重算一次）
        challenge_points_multiplier: 3,

        // 解鎖成就：依徽章等級給對應的 XP
        achievement_tier: {
            bronze: 15,
            silver: 35,
            gold: 70,
            platinum: 150
        },

        // 每日登入（連續登入天數 +1 的那一天）給的 XP
        daily_login: 20
    },

    // ===== 升級門檻（固定間隔）=====
    // 每升一級都需要一樣多的 XP。例如設 100，就是：
    xp_per_level: 300,

    // 等級上限：到了這一級之後 XP 還是會繼續累積、繼續顯示，但等級數字不再往上跳。
    // 不想封頂的話改成 Infinity。
    max_level: 30
}

// ===== 以下是計算用的共用函式，不需要修改 =====

// 依目前總 XP 算出等級
function XP_Get_Level(xp){
    const value = (typeof xp === "number" && !isNaN(xp)) ? xp : 0
    const level = Math.floor(value / XP_CONFIG.xp_per_level)
    return Math.min(level, XP_CONFIG.max_level)
}

// 依目前總 XP 算出「這一級目前的進度」，給進度條/文字顯示用
// 回傳 { level, current, needed, percent }
function XP_Get_Level_Progress(xp){
    const value = (typeof xp === "number" && !isNaN(xp)) ? xp : 0
    const level = XP_Get_Level(value)
    const needed = XP_CONFIG.xp_per_level

    // 已經到等級上限：不再顯示「還差多少」，直接顯示滿條
    if(level >= XP_CONFIG.max_level){
        return { level: level, current: needed, needed: needed, percent: 100 }
    }

    const current = value - (level * needed)
    const percent = needed > 0 ? Math.round((current / needed) * 100) : 0
    return { level: level, current: current, needed: needed, percent: percent }
}
