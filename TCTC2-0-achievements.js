/* ============================================================
   TCTC2-0-achievements.js
   榮譽牆頁面邏輯：讀取 login_streak.js 提供的資料並渲染畫面。

   這支檔案本身「不寫入」任何 Firebase 資料，純粹讀取 +
   前端渲染徽章解鎖狀態，寫入的防作弊邏輯全部在
   TCTC2-0-login_streak.js + database.rules.json 裡處理，
   這裡不重複那一層邏輯，職責切乾淨。
   ============================================================ */

// ===== 登入里程碑徽章表 =====
// metric 只能是 "longest_streak"（歷史最長連續）、"total_login_days"（累積登入天數）、
// 或 "longest_gap_days"（歷史上「回來之前」隔最久的一次，單位：天）。
// 用哪個當門檻由每個徽章自己決定；threshold 是達成門檻的數值。
// 之後要加新徽章，只要在這個陣列裡加一個物件即可，不用改渲染邏輯。
//
// 【排版考量】三組各自固定 5 個，對齊 achv_badge_grid 的排版需求。
//
// 【說明】原本規劃的「夜貓子／早起鳥兒／凌晨系列」（時段類徽章）暫時不做，
// 理由：Realtime Database Rules 只看得到伺服器收到請求當下的 epoch 時間戳，
// 沒有時區資訊，沒辦法在後端可靠驗證「玩家登入當下是不是真的晚上11點」，
// 只能整組信任前端回報的時間，作弊成本太低（改系統時區就能刷），
// 先擱置，等未來真的要做的時候再另外討論防作弊等級。
//
// 【說明・原本 streak_restart_count / gap_return_count / gap_return_7_count 改版】
// 原本「中斷後回來」規劃的是三個各自獨立的計數器（重啟次數／斷3天次數／
// 斷7天次數），但只有 3 天、7 天兩檔、還混了一個「重啟次數」，很難自然湊成
// 5 個一組，語意上也不太一致（一個是次數、兩個是次數，但門檻邏輯不同）。
// 改成單一欄位 longest_gap_days——「歷史上回來之前隔最久的一次」，只存一個
// 數字，5 個徽章都只是這同一個數字的不同門檻（1/3/7/15/30天），寫入邏輯
// 更單純（只在破紀錄時才更新），也自然湊出 5 個一組。
const ACHV_LOGIN_BADGES = [
    // 🔥 連續登入
    { icon: "💥", name: "初次點燃",   desc: "連續登入 3 天",   metric: "longest_streak",   threshold: 3 },
    { icon: "🕯️", name: "火苗不滅",   desc: "連續登入 5 天",   metric: "longest_streak",   threshold: 5 },
    { icon: "🔥", name: "持之以恆",   desc: "連續登入 7 天",   metric: "longest_streak",   threshold: 7 },
    { icon: "⚡️", name: "習慣成型",   desc: "連續登入 14 天",  metric: "longest_streak",   threshold: 14 },
    { icon: "❤️‍🔥", name: "永不熄滅",   desc: "連續登入 30 天",  metric: "longest_streak",   threshold: 30 },

    // 👣 累積登入
    { icon: "🌱", name: "初來乍到",   desc: "累積登入 5 天",   metric: "total_login_days", threshold: 5 },
    { icon: "🌿", name: "常客報到",   desc: "累積登入 10 天",  metric: "total_login_days", threshold: 10 },
    { icon: "🪴", name: "熟面孔",     desc: "累積登入 20 天",  metric: "total_login_days", threshold: 20 },
    { icon: "🌴", name: "資深玩家",  desc: "累積登入 50 天",  metric: "total_login_days", threshold: 50 },
    { icon: "🌳", name: "元老玩家",  desc: "累積登入 100 天", metric: "total_login_days", threshold: 100 },

    // 💀 斷簽後回歸
    { icon: "👋", name: "小別重逢",   desc: "隔了 1 天再回來",  metric: "longest_gap_days", threshold: 1 },
    { icon: "😅", name: "差點忘了",   desc: "隔了 3 天再回來",  metric: "longest_gap_days", threshold: 3 },
    { icon: "💀", name: "我還活著",   desc: "隔了 7 天再回來",  metric: "longest_gap_days", threshold: 7 },
    { icon: "⏳", name: "久違了",     desc: "隔了 15 天再回來", metric: "longest_gap_days", threshold: 15 },
    { icon: "🫨", name: "浪子回頭",   desc: "隔了 30 天再回來", metric: "longest_gap_days", threshold: 30 }
];

function ACHV_Build_Badge_Grid_HTML(streakData){
    return ACHV_LOGIN_BADGES.map(function(badge){
        const currentValue = streakData ? (streakData[badge.metric] || 0) : 0
        const unlocked = currentValue >= badge.threshold

        return `
            <div class="achv_badge_card ${unlocked ? "achv_badge_unlocked" : "achv_badge_locked"}">
                <div class="achv_medal">${badge.icon}</div>
                <p class="achv_badge_name">${badge.name}</p>
                <p class="achv_badge_desc">${badge.desc}</p>
            </div>
        `
    }).join("")
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

function ACHV_Render(streakData){
    const currentEl = document.getElementById("achv_current_streak")
    const longestEl = document.getElementById("achv_longest_streak")
    const totalEl = document.getElementById("achv_total_days")
    const hintEl = document.getElementById("achv_streak_hint")
    const badgeGridEl = document.getElementById("achv_badge_grid")

    if(currentEl) currentEl.textContent = streakData ? (streakData.current_streak || 0) : 0
    if(longestEl) longestEl.textContent = streakData ? (streakData.longest_streak || 0) : 0
    if(totalEl) totalEl.textContent = streakData ? (streakData.total_login_days || 0) : 0
    if(hintEl) hintEl.textContent = ACHV_Build_Streak_Hint(streakData)
    if(badgeGridEl) badgeGridEl.innerHTML = ACHV_Build_Badge_Grid_HTML(streakData)
}

document.addEventListener("DOMContentLoaded", function(){
    // 跟排行榜的 anon_id 機制一致：訪客跟已登入玩家都能看、都能累積，
    // 不需要判斷登入狀態，直接讀資料渲染就好
    if(typeof TCTC_Get_Streak_Data !== "function"){
        console.warn("[achievements] 找不到 TCTC_Get_Streak_Data，請確認有載入 TCTC2-0-login_streak.js")
        ACHV_Render({ current_streak: 0, longest_streak: 0, total_login_days: 0 })
        return
    }

    // 延遲 600ms 再讀取：給 login_streak.js 頁面載入時的當日寫入請求（若有）
    // 足夠時間完成，600ms 是憑經驗抓的寬鬆值，不是精確同步機制——如果玩家網路
    // 真的很慢，這裡讀到的可能還是寫入前的舊資料，但不影響正確性，只是「畫面
    // 慢一點才反映最新數字」，下次重新整理或再次造訪就會是對的
    setTimeout(function(){
        TCTC_Get_Streak_Data().then(ACHV_Render)
    }, 600)
})