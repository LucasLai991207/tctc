/* ============================================================
   TCTC2-0-login_streak.js
   連續登入天數追蹤

   【架構說明・為什麼不用 Firebase Auth 的 uid】
   這個網站的排行榜／個人統計整套系統，都是用 anon_id
   （存在 localStorage 的自訂 UUID，由 TCTC2-0-firebase.js 的
   Get_Anon_Id() 提供）當作 player_stats/{anon_id} 的 key，訪客
   跟登入帳號共用同一套資料結構——訪客也能上榜、也能累積 WPM／
   正確率／瀏覽次數。streak 要跟這些指標一起放進「玩家總榜」排序，
   資料自然也要存在同一個節點、用同一把 key，不能另外開一個只認
   Firebase Auth uid 的節點（那樣訪客永遠無法累積，也沒辦法跟其他
   指標放在同一份榜單排序）。

   核心防作弊邏輯不變：玩家不能自己寫入 streak_current 這個數字，
   只能寫入「streak_last_ts = 現在」這個事實，且這個時間戳記用
   firebase.database.ServerValue.TIMESTAMP（伺服器時間）代填，玩家
   端無法偽造。streak_current／streak_longest／streak_total_days
   最終數值由 Firebase Rules（見 database.rules.json 的 player_stats
   節點）用「這次請求的伺服器時間」跟「上一筆 streak_last_ts」的差距
   重新驗證一次，這裡算出來的只是「猜測」，猜錯會被 Rules 直接拒絕
   （PERMISSION_DENIED），不會寫入成功。

   使用方式：
   - 要載入在 TCTC2-0-firebase.js 之後（需要用到它的 tctc_db 與
     Get_Anon_Id()），建議放在玩家「幾乎每次來都會先經過」的頁面
     （目前放在 main.html / ranking.html / achievements.html）。
   - 一天只要成功寫入一次，不需要每一頁都掛。
   ============================================================ */

// ===== 時間門檻常數 =====
// 20 小時：低於這個值代表「今天已經記過了」，不重複寫入
// 48 小時：超過這個值代表「斷簽」，streak_current 要歸零重算
// 這兩個數字必須跟 database.rules.json 裡寫死的 72000000 / 172800000（毫秒）完全一致，
// 兩邊只要有一邊改了忘記同步，前端猜測值就會一直被 Rules 拒絕
const TCTC_STREAK_HOURS_MIN = 20 * 60 * 60 * 1000
const TCTC_STREAK_HOURS_MAX = 48 * 60 * 60 * 1000

// ===== 【新增】「斷簽後回歸」系列徽章要用的常數 =====
// longest_gap_days 是「歷史上回來之前隔最久的一次，以天數表示」，
// 換算方式固定用「毫秒差 ÷ 一天的毫秒數，無條件捨去」，
// 這個常數必須跟 database.rules.json 裡的 86400000 完全一致。
const TCTC_ONE_DAY_MS = 24 * 60 * 60 * 1000

// 記錄今天登入。內部函式，由 DOMContentLoaded 觸發，不需要外部頁面手動呼叫
function TCTC_Record_Daily_Login(){
    if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
        console.warn("[login_streak] 找不到 Get_Anon_Id / tctc_db，請確認有先載入 TCTC2-0-firebase.js")
        return
    }

    const anon_id = Get_Anon_Id()
    if(!anon_id) return

    // 讀「這個玩家目前整包 player_stats」，不是只讀 streak 欄位——
    // 因為等一下要用 update() 局部寫入，先確認一次現有資料，避免用猜的
    const statsRef = tctc_db.ref(`player_stats/${anon_id}`)

    statsRef.once("value").then(function(snapshot){
        const current = snapshot.val() || {}
        const now = Date.now()

        // 從來沒有 streak_last_ts：初始化為第 1 天
        // 【重要】這裡用 update()，不是 set()——set() 會把整個 player_stats/{anon_id}
        // 節點覆蓋掉，連 avg_wpm、name 這些既有資料都會一起被砍掉。update() 只會
        // 動到明確列出的這幾個欄位，其他欄位原封不動保留。
        if(!current.streak_last_ts){
            return statsRef.update({
                streak_current: 1,
                streak_longest: Math.max(1, current.streak_longest || 0),
                streak_last_ts: firebase.database.ServerValue.TIMESTAMP,
                streak_total_days: (current.streak_total_days || 0) + 1
            })
        }

        const elapsed = now - current.streak_last_ts

        if(elapsed < TCTC_STREAK_HOURS_MIN){
            // 今天（20 小時內）已經記錄過了，不用再打 Firebase
            return
        }

        // ===== 【新增】這次「回來之前隔了幾天」，continue／break 兩種情況都要算 =====
        // 用 Math.floor(elapsed / 一天的毫秒數)，例如 elapsed 是 20~24 小時算 0 天、
        // 24~48 小時算 1 天、超過 48 小時就是實際斷簽的天數。只有「破紀錄」
        // （比玩家目前存的 longest_gap_days 還大）才會被塞進 update 物件裡送出，
        // 平常沒破紀錄的登入完全不會動到這個欄位。
        const gap_days = Math.floor(elapsed / TCTC_ONE_DAY_MS)
        const is_new_gap_record = gap_days > (current.longest_gap_days || 0)

        let update
        if(elapsed < TCTC_STREAK_HOURS_MAX){
            // 20~48 小時之間：視為連續，streak_current +1
            update = {
                streak_current: (current.streak_current || 0) + 1,
                streak_longest: Math.max((current.streak_current || 0) + 1, current.streak_longest || 0),
                streak_last_ts: firebase.database.ServerValue.TIMESTAMP,
                streak_total_days: (current.streak_total_days || 0) + 1
            }
        } else {
            // 超過 48 小時：斷簽，streak_current 重置為 1，
            // 但 streak_longest（歷史紀錄）保留不變
            update = {
                streak_current: 1,
                streak_longest: current.streak_longest || 1,
                streak_last_ts: firebase.database.ServerValue.TIMESTAMP,
                streak_total_days: (current.streak_total_days || 0) + 1
            }
        }

        if(is_new_gap_record){
            update.longest_gap_days = gap_days
        }

        return statsRef.update(update)

    }).catch(function(error){
        // 最常見的 error 會是 PERMISSION_DENIED——代表前端猜的 elapsed
        // 跟伺服器實際驗證出來的對不上（例如玩家改了電腦時間，或試圖用
        // Console 手動呼叫這個函式作弊），屬於預期內、正常運作的拒絕，
        // 不用跳錯誤通知給玩家，安靜記在 console 就好
        console.warn("[login_streak] 寫入被拒絕或失敗：", error.message)
    })
}

// ===== 提供給榮譽牆頁面讀取資料用 =====
// 回傳一個 Promise，resolve 出 { current_streak, longest_streak, total_login_days,
// longest_gap_days }
// （查無資料時全部欄位都給 0，不會是 null——因為現在訪客也算，「沒有資料」
// 只代表「還沒登入過」，不是「不適用」，用 0 表達比較準確、畫面端也不用另外判斷 null）
function TCTC_Get_Streak_Data(){
    return new Promise(function(resolve){
        if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
            resolve({ current_streak: 0, longest_streak: 0, total_login_days: 0, longest_gap_days: 0 })
            return
        }

        const anon_id = Get_Anon_Id()
        tctc_db.ref(`player_stats/${anon_id}`).once("value")
            .then(function(snapshot){
                const val = snapshot.val() || {}
                resolve({
                    current_streak: val.streak_current || 0,
                    longest_streak: val.streak_longest || 0,
                    total_login_days: val.streak_total_days || 0,
                    longest_gap_days: val.longest_gap_days || 0
                })
            })
            .catch(function(error){
                console.warn("[login_streak] 讀取失敗：", error.message)
                resolve({ current_streak: 0, longest_streak: 0, total_login_days: 0, longest_gap_days: 0 })
            })
    })
}

// 頁面載入時直接記錄一次，不需要等任何登入狀態——訪客跟已登入玩家用同一套 anon_id 機制
document.addEventListener("DOMContentLoaded", function(){
    TCTC_Record_Daily_Login()
})