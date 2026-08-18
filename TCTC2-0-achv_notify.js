
const ACHV_XP_TIER_KEYS = [null, "bronze", "silver", "gold", "platinum"]

const ACHV_NOTIFY_SEEN_KEY = "tctc2.0-achv_seen_tiers"   // localStorage：{ 成就key: 已看過的最高等級 }
const ACHV_NOTIFY_TOAST_DURATION_MS = 4800                // 每張通知卡自動消失前的顯示時間
const ACHV_NOTIFY_DEBOUNCE_MS = 1200                       // 見 ACHV_Schedule_Notify_Check() 說明

// 【新增】debounce 計時器要存在函式外層（模組層級），同一個計時器要能被
// 「下一次呼叫」清掉重算，不能每次呼叫都各自開一個新的 setTimeout
let achv_notify_debounce_timer = null

// ===== 讀寫本機的「已看過等級」記錄 =====
function ACHV_Notify_Get_Seen(){
    try {
        return JSON.parse(localStorage.getItem(ACHV_NOTIFY_SEEN_KEY)) || {}
    } catch(e){
        // JSON 壞掉（極少見，通常是玩家手動改過 localStorage）就當作全新開始，
        // 效果等同「這台瀏覽器所有成就都重新走一次『第一次觀察到、只記錄不彈窗』流程」，
        // 不會導致功能整個壞掉，只是這次不會補彈任何通知
        return {}
    }
}
function ACHV_Notify_Save_Seen(seen){
    try {
        localStorage.setItem(ACHV_NOTIFY_SEEN_KEY, JSON.stringify(seen))
    } catch(e){
        console.warn("[achv_notify] 寫入本機成就紀錄失敗：", e.message)
    }
}

// ============================================================
// 核心比對邏輯
// 傳入這次抓到的 streakData / statsData，逐一比對 ACHV_CATEGORIES 裡
// 每個成就，回傳「這次真的偵測到新解鎖」的陣列（可能是空陣列）。
//
// 這個函式本身「不」畫畫面，純粹是資料比對，拆成獨立函式方便之後寫測試，
// 也讓 achievements.js 可以直接重複利用同一份已經抓好的資料
// （見 achievements.js 結尾的呼叫）。
//
// 【新增】偵測到「真正的新解鎖」時，除了記錄 baseline、放進回傳陣列，
// 也會順手呼叫一次 Sync_XP() 發放這個等級對應的 XP——放在這裡（而不是
// 放在 ACHV_Notify_Run / achievements.js 各自的呼叫端）是因為「新解鎖」
// 這件事本來就只有這裡判斷得出來，兩個呼叫端都會經過這裡，寫一次就能
// 保證兩邊都會發到 XP，不用各自重複判斷一次。這讓這個函式不再是純函式
// （會發一次 Firebase 寫入），是刻意的取捨：比起維持「純函式」但要在
// 兩個呼叫端各自重寫一次一樣的判斷邏輯，這裡集中處理更不容易漏掉或算重複。
// ============================================================
function ACHV_Notify_Diff(streakData, statsData){
    if(typeof ACHV_CATEGORIES === "undefined"){
        console.warn("[achv_notify] 找不到 ACHV_CATEGORIES，請確認有先載入 TCTC2-0-achv_data.js")
        return []
    }

    const seen = ACHV_Notify_Get_Seen()
    const newlyUnlocked = []
    let seenChanged = false   // 只有真的有變動才寫回 localStorage，避免每次都無意義地寫入

    ACHV_CATEGORIES.forEach(function(category){
        category.achievements.forEach(function(achv){
            if(achv.pending) return   // 尚未開放的成就（例如「完成課程」）沒有真實資料源，不參與比對

            // ===== 依賴檢查：缺資料來源就整個跳過這一項，不比對也不寫入 baseline =====
            // 理由見檔案開頭的「重要限制」說明第 1 點：寧可這次沒檢查到，
            // 也不要把 baseline 誤記成比實際低的值——那樣之後在有正確資料的
            // 頁面重新算出真實等級時，反而會被誤判成「新解鎖」，對玩家跳出
            // 一個他早就達成、只是這支腳本剛好在缺資料的頁面上跑過一次的假通知。
            if(achv.dataSource === "streak" && typeof TCTC_Get_Streak_Data !== "function") return
            if(achv.requiresLevelData && typeof Level_Data === "undefined") return

            const data = achv.dataSource === "streak" ? streakData : statsData
            const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
            const newTier = ACHV_Get_Tier_Index(value, achv.thresholds)

            const storedTier = seen[achv.key]   // undefined 代表「這支瀏覽器從來沒記錄過這個成就」

            if(storedTier === undefined){
                // ===== 第一次觀察到這個成就：只建立 baseline，不彈窗 =====
                // 這是避免「功能剛上線那一刻，把玩家原本早就達成的成就
                // 全部當成新解鎖轟炸彈窗」的關鍵設計。代價是：如果玩家在這支
                // 腳本上線『之前』就已經達成某個成就，他不會補收到那次的通知——
                // 這是刻意的取捨，「不彈假通知」比「補彈舊通知」更重要。
                seen[achv.key] = newTier
                seenChanged = true
                return
            }

            if(newTier > storedTier){
                // 真正的新解鎖：等級比上次記錄的還高
                newlyUnlocked.push({
                    name: achv.name,
                    icon: achv.icon,
                    tierIndex: newTier,
                    tierTitle: ACHV_TIER_TITLES_DEFAULT[newTier],
                    // 【新增】只有滿級（白金）且這個成就有掛 certificateLevel（見 achv_data.js
                    // 的 easy_completion／medium_completion）才會有值，給 ACHV_Notify_Show_Toast
                    // 判斷要不要把這次的彈窗換成「可以領證書了」的樣式
                    certificateLevel: (newTier === achv.thresholds.length && achv.certificateLevel) ? achv.certificateLevel : null
                })
                seen[achv.key] = newTier
                seenChanged = true

                // 【新增】發放這個等級對應的 XP。用 typeof 保護 Sync_XP / XP_CONFIG，
                // 沒載入 xp_data.js / firebase.js 的頁面（理論上不會發生，但保留保護
                // 比較安全）就單純跳過發 XP，不影響上面已經做完的解鎖判定跟彈窗。
                if(typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
                    const tierKey = ACHV_XP_TIER_KEYS[newTier]
                    const xpAmount = tierKey ? (XP_CONFIG.actions.achievement_tier[tierKey] || 0) : 0
                    if(xpAmount > 0) Sync_XP(xpAmount)
                }
            }
            // newTier <= storedTier 的情況「一律不更新、不彈窗」——
            // 可能是資料還沒完全同步完成時讀到的暫時低值（例如 Firebase
            // transaction 還在路上），一律不降記錄，確保 baseline 只增不減
        })
    })

    if(seenChanged) ACHV_Notify_Save_Seen(seen)

    return newlyUnlocked
}

// ============================================================
// 對外主流程：抓資料 -> 比對 -> 彈窗
// 任何頁面只要呼叫這個函式，就會完整跑一次「讀最新雲端資料、跟本機
// baseline 比對、有新解鎖就彈窗」的流程
// ============================================================
function ACHV_Notify_Run(){
    if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
        console.warn("[achv_notify] 找不到 Get_Anon_Id / tctc_db，請確認有先載入 TCTC2-0-firebase.js")
        return
    }

    const streakPromise = (typeof TCTC_Get_Streak_Data === "function")
        ? TCTC_Get_Streak_Data()
        : Promise.resolve(null)

    const statsPromise = new Promise(function(resolve){
        const anon_id = Get_Anon_Id()
        if(!anon_id){ resolve({}); return }
        tctc_db.ref(`player_stats/${anon_id}`).once("value")
            .then(function(snapshot){ resolve(snapshot.val() || {}) })
            .catch(function(error){
                console.warn("[achv_notify] 讀取 player_stats 失敗：", error.message)
                resolve({})
            })
    })

    Promise.all([streakPromise, statsPromise]).then(function(results){
        const newlyUnlocked = ACHV_Notify_Diff(results[0], results[1])
        newlyUnlocked.forEach(ACHV_Notify_Show_Toast)
    })
}

// ============================================================
// 給「會寫入成就相關資料」的地方呼叫的入口，例如挑戰結算、關卡破關、
// 登入記錄成功。
//
// 【為什麼要 debounce，而不是直接呼叫 ACHV_Notify_Run()】
// 像 Submit_Challenge_Score_To_Leaderboard() 一次動作背後其實踢出了
// 5 個各自獨立、互不等待的 Firebase transaction（best_challenge_wpm、
// high_wpm_streak、best_challenge_acc、perfect_challenge_count、
// high_acc_challenge_streak）。如果每個 transaction 各自完成時都馬上
// 呼叫 ACHV_Notify_Run()，同一次挑戰結算會在幾百毫秒內連續發出 5 次
// Firebase 讀取請求，而且前幾次讀到的可能還是「其他 transaction 還沒
// 寫完」的中途狀態，容易漏判。用 debounce（同一段時間內重複呼叫只保留
// 最後一次）讓所有相關寫入都「安定下來」之後，只真正檢查一次就好。
// ============================================================
function ACHV_Schedule_Notify_Check(){
    if(achv_notify_debounce_timer) clearTimeout(achv_notify_debounce_timer)
    achv_notify_debounce_timer = setTimeout(function(){
        achv_notify_debounce_timer = null
        ACHV_Notify_Run()
    }, ACHV_NOTIFY_DEBOUNCE_MS)
}

// ============================================================
// 彈窗渲染
// ============================================================

// 確保頁面上有一個固定在最頂端的通知堆疊容器，沒有就建立一個。
// 用 document.body.appendChild 動態建立，而不是要求每個 HTML 頁面
// 自己手動加這段 <div>——這樣只要載入這支 JS，任何頁面都能用，不用
// 逐一回去改十幾個 .html 檔案的 <body> 內容。
function ACHV_Notify_Ensure_Container(){
    let container = document.getElementById("achv_notify_stack")
    if(!container){
        container = document.createElement("div")
        container.id = "achv_notify_stack"
        container.className = "achv_notify_stack"
        document.body.appendChild(container)
    }
    return container
}

function ACHV_Notify_Show_Toast(item){
    const container = ACHV_Notify_Ensure_Container()
    // 通知卡的徽章配色直接沿用榮譽牆的 pach_tier_xxx class（bronze/silver/
    // gold/platinum），跟榮譽牆頁面共用同一套視覺語言，玩家不會覺得
    // 「彈窗的金牌」跟「榮譽牆上的金牌」長得不一樣
    const tierClass = ACHV_TIER_CLASSES[item.tierIndex]

    // 【新增】滿級且有掛 certificateLevel：換成「可以領證書了」的措辭，
    // 點下去直接跳證書頁，不是先繞去榮譽牆再讓玩家自己找連結
    const eyebrowText = item.certificateLevel ? "可以領證書了" : "成就解鎖"
    const tierText = item.certificateLevel ? "🎓 點這裡列印證書" : item.tierTitle
    const clickTarget = item.certificateLevel
        ? `TCTC2-0-certificate.html?level=${item.certificateLevel}`
        : "TCTC2-0-achievements.html"

    const toast = document.createElement("div")
    toast.className = "achv_notify_toast"
    toast.innerHTML = `
        <div class="achv_notify_medal ${tierClass}">${item.icon}</div>
        <div class="achv_notify_body">
            <p class="achv_notify_eyebrow">${eyebrowText}</p>
            <p class="achv_notify_name">${item.name}</p>
            <p class="achv_notify_tier">${tierText}</p>
        </div>
    `
    // 點一下通知卡：一般成就跳去榮譽牆看完整進度；證書類的直接跳證書頁，
    // 少讓玩家多繞一步，同時也是「立刻關閉」的手動方式
    toast.addEventListener("click", function(){
        window.location.href = clickTarget
    })

    container.appendChild(toast)

    // 進場動畫：故意不在 appendChild 的同一個 tick 內就加上 show class。
    // 如果同一個 tick 內從「初始狀態」直接跳到「顯示狀態」，瀏覽器有機會把
    // 這兩次樣式變化合併成一次繪製（沒有中間幀可以播 transition），畫面上
    // 會像是直接跳出來、沒有動畫。用 requestAnimationFrame 延後一幀，
    // 確保瀏覽器先畫過一次「初始（透明+偏移）」的畫面，再套用 transition。
    requestAnimationFrame(function(){
        toast.classList.add("achv_notify_toast_show")
    })

    // 顯示一段時間後自動淡出、從 DOM 移除。移除前先加 hide class 播退場動畫，
    // 320ms 這個延遲要跟 achv_notify.css 裡 .achv_notify_toast 的
    // transition duration 一致，不然會在動畫播完前就被硬生生拔掉
    setTimeout(function(){
        toast.classList.remove("achv_notify_toast_show")
        toast.classList.add("achv_notify_toast_hide")
        setTimeout(function(){ toast.remove() }, 320)
    }, ACHV_NOTIFY_TOAST_DURATION_MS)
}

// ============================================================
// 保底檢查：每個有載入這支檔案的頁面，載入時都跑一次完整比對
// ============================================================
// 前面 ACHV_Schedule_Notify_Check() 是掛在「動作完成當下」的即時觸發，
// 只涵蓋 Lucas 有明確加上呼叫的那幾個地方（破關、挑戰結算、登入記錄）。
// 這裡是保底：不管前面有沒有漏掛、或是玩家用別的裝置完成動作後才切回
// 這個瀏覽器，只要重新整理或換頁，最晚也會在這裡被抓到並補彈通知。
// 延遲 900ms 才開始，是給同一頁的 online_time.js / login_streak.js 的
// 頁面載入寫入留一點時間先完成，避免讀到寫入前的舊資料（延遲值沒有
// 跟 achievements.js 的 600ms 用同一個數字，是因為這裡多疊了一層
// Firebase 讀取排隊的餘裕，抓寬鬆一點）。
document.addEventListener("DOMContentLoaded", function(){
    setTimeout(ACHV_Notify_Run, 900)
})