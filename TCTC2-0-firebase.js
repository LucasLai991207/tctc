/* ============================================================
   TCTC 打字排行榜 - Firebase 共用模組（訪客模式，不需登入）
   ============================================================
   使用方式：
   1. 在使用到排行榜功能的 HTML 裡，先載入 Firebase compat SDK
      （順序要在這個檔案「之前」）：

        <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-database-compat.js"></script>
        <script src="TCTC2-0-firebase.js"></script>

   2. 把下面 firebaseConfig 換成你在 Firebase 控制台
      「專案設定(齒輪) → 一般 → 你的應用程式 → SDK 設定與設定」
      裡面那一整包物件（直接複製貼上蓋掉下面這個佔位物件就好）。

      注意 databaseURL 要跟你「Realtime Database 建立時選的地區」一致，
      在 Firebase 控制台的 Realtime Database 頁面最上面可以看到完整網址。

   3. 建議把 Realtime Database 的規則（Rules）從 test mode 換成下面這組，
      避免任何人可以塞奇怪的資料格式進去洗版排行榜：

        {
          "rules": {
            "leaderboard": {
              "$stageId": {
                ".read": true,
                ".indexOn": ["wpm"],
                "$entryId": {
                  ".write": true,
                  ".validate": "newData.hasChildren(['name','wpm','acc','timestamp']) && newData.child('wpm').isNumber() && newData.child('wpm').val() >= 0 && newData.child('wpm').val() < 1000 && newData.child('name').isString() && newData.child('name').val().length <= 20"
                }
              }
            },
            "challenge_leaderboard": {
              "$comboId": {
                ".read": true,
                ".indexOn": ["wpm"],
                "$entryId": {
                  ".write": true,
                  ".validate": "newData.hasChildren(['name','wpm','acc','timestamp']) && newData.child('wpm').isNumber() && newData.child('wpm').val() >= 0 && newData.child('wpm').val() < 1000 && newData.child('name').isString() && newData.child('name').val().length <= 20"
                }
              }
            },
            "guest_counter": {
              ".read": true,
              ".write": true,
              ".validate": "newData.isNumber()"
            },
            "guest_numbers": {
              "$anonId": {
                ".read": true,
                ".write": true,
                ".validate": "newData.isNumber()"
              }
            },
            "player_stats": {
              ".read": true,
              ".indexOn": ["avg_wpm", "avg_acc", "online_seconds", "total_points", "page_views"],
              "$anonId": {
                "name": {
                  ".write": true,
                  ".validate": "newData.isString() && newData.val().length <= 20"
                },
                "wpm_sum": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "wpm_count": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "avg_wpm": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() < 1000" },
                "acc_sum": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "acc_count": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "avg_acc": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100" },
                "online_seconds": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "total_points": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "page_views": { ".write": true, ".validate": "newData.isNumber() && newData.val() >= 0" },
                "hide_from_leaderboard": { ".write": true, ".validate": "newData.isBoolean()" }
              }
            },
            "site_meta": {
              "total_page_views": {
                ".read": true,
                ".write": true,
                ".validate": "newData.isNumber() && newData.val() >= 0"
              }
            }
          }
        }

   【新增規則說明】新增了「網站瀏覽次數」功能，需要兩塊新規則：
   1. site_meta/total_page_views：全站瀏覽總數，不分訪客或已登入玩家，
      每次有人載入任何一個頁面就 +1，用來顯示在排行榜頁面最上方。
   2. player_stats/$anonId/page_views：延續原本 player_stats 的設計，
      每個玩家（不管有沒有設定 username）自己的瀏覽次數，用來做「瀏覽次數最多」
      這個新的玩家總榜指標。跟 online_seconds 一樣不設定任何門檻。
   同樣提醒：如果你的 Firebase 專案是延續舊的規則繼續用，記得手動把
   site_meta 這一段、以及 player_stats 底下的 page_views 這一行「補進」你
   現有的規則物件裡，不要整個覆蓋掉，不然舊規則會不見。

   【重要】.indexOn 要放在 player_stats 這一層（不是塞在 $anonId 裡面）。
   排序查詢是對 player_stats 這個父節點的「每個子節點裡的某個欄位」做排序，
   索引要宣告在被排序的那些子節點的「共同父節點」上，塞在 $anonId 底下沒作用，
   Firebase 只會当作沒設定索引，continue 全量下載＋前端排序（雖然結果還是對的，
   但資料一多會變慢，Console 也會一直跳「Using an unspecified index」的警告）。

   【重要】上面 player_stats 那段特別多了一行 ".read": true 直接寫在 player_stats
   這一層（不是只寫在 $anonId 底下）。這是因為「玩家總排行榜」的查詢方式，是
   直接對 player_stats 這個父節點做 orderByChild().once("value")，把所有玩家
   一次抓出來排序——而 Firebase 的讀取權限不會從子節點的規則「往上」套用到父節點，
   只有子節點自己的 .read 規則的話，讀父節點會直接 permission_denied。
   如果你是照舊版規則貼的、只有 $anonId 底下有 .read，記得補上這一行。

   【重要】上面這組規則是「新增」的 player_stats 節點，對應「玩家總排行榜」
   （平均WPM最高／平均正確率最高／在線時長最長）這個新功能。
   如果你的 Firebase 專案是延續舊專案繼續用，記得手動把 player_stats
   這一段規則「補進」你現有的規則物件裡，不要整個覆蓋掉，
   不然原本 leaderboard / challenge_leaderboard 那些規則會不見。
   ============================================================ */

const firebaseConfig = {
    apiKey: "AIzaSyCoizdcDbOjUjsx1UNjbEzm2Px2YP7-S1Q",
    authDomain: "tctc-official.firebaseapp.com",
    databaseURL: "https://tctc-official-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tctc-official",
    storageBucket: "tctc-official.firebasestorage.app",
    messagingSenderId: "1098169583658",
    appId: "1:1098169583658:web:dfdeae095ccefecc459b53"
}

// 避免同一頁不小心載入這個檔案兩次時重複 initializeApp 報錯
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig)
}
const tctc_db = firebase.database()

/* ============================================================
   【新增】匿名登入（Firebase Anonymous Auth）
   ------------------------------------------------------------
   跟原本 Get_Anon_Id() 產生的那組「自己土法煉鋼存在 localStorage 的
   anon_id」不一樣：這裡拿到的是 Firebase 伺服器簽發、沒辦法偽造的登入狀態。
   目的不是要換掉 anon_id 的用法（那個改動比較大，之後再處理），
   單純是先讓 Rules 能檢查「這次寫入，是不是真的從一個有效的匿名登入
   送出來的」，擋掉完全沒開過網站、直接對 Firebase REST API 亂打的攻擊。

   呼叫這裡就好，不用等它 resolve 才能繼續──玩家實際觸發寫入的動作
   （送出成績、改名字、按下更新資料）本來就會在頁面完全載入好一陣子之後
   才發生，這中間的時間差已經足夠讓匿名登入完成，不需要刻意用
   onAuthStateChanged 卡住其他邏輯。
   ============================================================ */
if (typeof firebase.auth === "function") {
    firebase.auth().signInAnonymously().catch(function (error) {
        console.log("[auth] 匿名登入失敗：", error)
    })
} else {
    console.log("[auth] 尚未載入 firebase-auth-compat.js，這個頁面沒辦法匿名登入")
}

/* ------------------------------------------------------------
   訪客身分
   ------------------------------------------------------------
   不強制登入，所以用「瀏覽器本機產生一組不重複的匿名ID」來代表一個玩家。
   這組 ID 存在 localStorage，只要同一台裝置、同一個瀏覽器，
   之後不管重打幾次同一關，都會用同一個 ID 去更新自己在該關卡的最佳成績，
   而不是每打一次就多新增一筆資料洗版排行榜。
   ------------------------------------------------------------ */
function Get_Anon_Id() {
    let anon_id = localStorage.getItem("tctc_anon_id")
    if (!anon_id) {
        anon_id = (crypto.randomUUID ? crypto.randomUUID() : ("anon-" + Date.now() + "-" + Math.random().toString(16).slice(2)))
        localStorage.setItem("tctc_anon_id", anon_id)
    }
    return anon_id
}

/* ------------------------------------------------------------
   訪客編號系統（不會重複取名）
   ------------------------------------------------------------
   還沒去 profile 設定名字的玩家，上榜時會顯示「訪客#N」，N 是全站唯一、
   依序遞增的編號（用 Firebase transaction 保證不會有兩個人同時搶到同一號）。

   規則：
   - 每個瀏覽器（用 tctc_anon_id 代表）第一次「需要用到訪客編號」時，
     才會跟雲端要一個新號碼，之後永遠固定用這個號碼，不會變來變去。
   - 玩家如果之後去 profile 設定了真實名字，畫面上就會改顯示那個名字，
     原本分到的編號不會被收回、也不會給別人用——所以「#1 消失後，
     下一個沒設定名字的新玩家會拿到 #2」，號碼永遠只增不減、不重複使用。
   ------------------------------------------------------------ */
function Get_Guest_Number(callback) {
    const anon_id = Get_Anon_Id()

    // 先看本機快取，同一台裝置不用每次都問雲端要號碼
    const cached = localStorage.getItem("tctc_guest_number")
    if (cached) {
        callback(Number(cached))
        return
    }

    const assign_ref = tctc_db.ref(`guest_numbers/${anon_id}`)
    assign_ref.once("value").then(function (snapshot) {
        if (snapshot.exists()) {
            const n = snapshot.val()
            localStorage.setItem("tctc_guest_number", n)
            callback(n)
            return
        }

        // 還沒分配過號碼：跟全域計數器要一個新號碼。
        // 用 transaction 對 guest_counter 做 +1，Firebase 保證就算很多人
        // 同時在搶，每個人拿到的回傳值也一定是獨一無二的，不會撞號。
        tctc_db.ref("guest_counter").transaction(function (current) {
            return (current || 0) + 1
        }, function (error, committed, snap) {
            if (error || !committed) {
                console.log("[leaderboard] 分配訪客編號失敗：", error)
                callback(null)
                return
            }
            const n = snap.val()
            assign_ref.set(n) // 把這個號碼永久綁定在這個 anon_id 上
            localStorage.setItem("tctc_guest_number", n)
            callback(n)
        })
    }).catch(function (error) {
        console.log("[leaderboard] 讀取訪客編號失敗：", error)
        callback(null)
    })
}

/* ------------------------------------------------------------
   決定這次要用什麼名字上傳成績：
   有設定 username 就用 username；沒有的話用「訪客#N」。
   ------------------------------------------------------------ */
function Get_Player_Display_Name(callback) {
    const saved_name = (localStorage.getItem("username") || "").trim()
    if (saved_name) {
        callback(saved_name)
        return
    }

    Get_Guest_Number(function (n) {
        if (n) {
            // 補零成固定 4 位數，例如 1 → "0001"，23 → "0023"
            callback("訪客#" + String(n).padStart(4, "0"))
        } else {
            // 萬一分配編號那步失敗（例如網路問題），退回舊版隨機後綴，至少不會擋住整次上傳
            callback("訪客" + Get_Anon_Id().slice(0, 4))
        }
    })
}

/* ------------------------------------------------------------
   自訂名字：格式規則 + 全站不能重複
   ------------------------------------------------------------
   格式規則（純字串檢查，不需要連 Firebase）：
   - 不可為空白
   - 第一個字不可以是空格（檢查「原始輸入」、不是 trim 過的值，
     不然開頭空格會被靜靜吃掉，玩家不會知道自己違反規則）
   - 不可超過 13 個字元
   ------------------------------------------------------------ */
function Validate_Username_Format(raw_name) {
    if (!raw_name || raw_name.length === 0) {
        return { valid: false, reason: "名字不可為空白" }
    }
    if (raw_name[0] === " ") {
        return { valid: false, reason: "名字開頭不可以是空格" }
    }
    if (raw_name.length > 13) {
        return { valid: false, reason: "名字不可超過 13 個字" }
    }
    return { valid: true }
}

// Firebase 的 key 不能包含 . # $ [ ] / 這幾個字元，用底線取代掉；
// 另外統一轉小寫再比對，「Player1」跟「player1」視為同一個名字，
// 不然會出現兩個看起來幾乎一樣、只差大小寫的名字，容易搞混、也容易被拿來鑽漏洞
function _Username_To_Key(name) {
    return name.trim().toLowerCase().replace(/[.#$\[\]\/]/g, "_")
}

/* ------------------------------------------------------------
   佔用一個名字（全站不能重複）
   ------------------------------------------------------------
   用 usernames/{key}: anon_id 這個反查索引，靠 Firebase transaction
   保證「就算兩個人同時搶同一個名字，也只有一個人搶得到」。

   呼叫前請先自己用 Validate_Username_Format() 檢查過格式，
   這個函式只負責「有沒有人在用」，不重複做格式檢查。

   callback(success, reason)：
   - success = true：佔用成功（包含「本來就是自己的名字，沒改」這種情況）
   - success = false：名字被別人佔用，或發生錯誤，reason 是要顯示給玩家看的訊息
   ------------------------------------------------------------ */
function Claim_Username(name, callback) {
    const anon_id = Get_Anon_Id()
    const key = _Username_To_Key(name)
    const claim_ref = tctc_db.ref(`usernames/${key}`)

    claim_ref.transaction(function (current) {
        if (current === null) return anon_id      // 沒人用，佔用成功
        if (current === anon_id) return anon_id   // 本來就是自己的名字（例如只是重新送出一次），維持原樣
        return undefined                          // 已經有別人佔用，中止交易，不搶
    }, function (error, committed) {
        if (error) {
            console.log("[username] 檢查名字時發生錯誤：", error)
            callback(false, "檢查名字時發生錯誤，請稍後再試")
            return
        }
        if (!committed) {
            callback(false, "這個名字已經有人使用了，換一個試試看吧")
            return
        }

        // 佔用成功：如果玩家之前用過別的名字，把舊名字釋放掉，不然會一直卡著沒人能用
        const old_name = (localStorage.getItem("username") || "").trim()
        const old_key = old_name ? _Username_To_Key(old_name) : null
        if (old_key && old_key !== key) {
            tctc_db.ref(`usernames/${old_key}`).transaction(function (current) {
                // 只釋放「確定是自己當初佔的」那一筆，避免不小心動到別人的資料
                return (current === anon_id) ? null : current
            })
        }

        callback(true)
    })
}

/* ------------------------------------------------------------
   內部共用函式：上傳/更新 某個節點底下、某個 id 的最佳成績
   ------------------------------------------------------------
   raw_stats（可省略，主線關卡目前沒有傳）：
   { correct, wrong, duration_seconds, correction_count, skip_count }
   這些是「算出 wpm/acc 的原始數字」，存起來不是為了即時擋作弊
   （公式本來就是公開的，硬改 wpm/acc 的人一樣可以編一組自洽的原始數字），
   而是為了事後把整包資料匯出來，用統計方式抓異常
   （例如 wpm 高到生理上不可能、或原始數字內部互相矛盾）。
   ------------------------------------------------------------ */
function _Submit_Best_Score(node_path, id, wpm, acc, raw_stats) {
    if (!id || typeof wpm !== "number" || isNaN(wpm)) {
        console.log(`[leaderboard] 上傳失敗：id 或 wpm 格式不對`, id, wpm)
        return Promise.resolve()
    }

    return new Promise(function (resolve) {
        Get_Player_Display_Name(function (player_name) {
            const anon_id = Get_Anon_Id()
            const entry_ref = tctc_db.ref(`${node_path}/${id}/${anon_id}`)

            entry_ref.transaction(function (current) {
                if (!current) {
                    const entry = {
                        name: player_name,
                        wpm: wpm,
                        acc: (typeof acc === "number" && !isNaN(acc)) ? acc : 0,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    }
                    if (raw_stats) Object.assign(entry, raw_stats)
                    return entry
                }

                const is_new_best = wpm > current.wpm

                // 名字每次都同步成最新值（就算這次沒破紀錄），
                // 這樣不管是後來才設定名字、還是分配到訪客編號，都會跟上最新狀態，
                // 不會卡在第一次上傳時的舊名字。
                // WPM / 正確率 / 時間戳記 / 原始數字則維持「只有破紀錄才更新」，
                // 分數才不會被亂打的一次蓋掉，原始數字也才會跟當初那筆破紀錄的成績對得上。
                const entry = {
                    name: player_name,
                    wpm: is_new_best ? wpm : current.wpm,
                    acc: is_new_best ? ((typeof acc === "number" && !isNaN(acc)) ? acc : 0) : current.acc,
                    timestamp: is_new_best ? firebase.database.ServerValue.TIMESTAMP : current.timestamp
                }
                if (is_new_best && raw_stats) {
                    Object.assign(entry, raw_stats)
                } else if (!is_new_best) {
                    // 沒破紀錄：把舊的原始數字欄位原封不動保留下來，不然這次 transaction 寫回去會把它們清掉
                    ;["correct", "wrong", "duration_seconds", "correction_count", "skip_count"].forEach(function (k) {
                        if (current[k] !== undefined) entry[k] = current[k]
                    })
                }
                return entry
            }, function (error, committed) {
                if (error) {
                    console.log(`[leaderboard] 上傳分數發生錯誤（${node_path}）：`, error)
                } else if (committed) {
                    console.log(`[leaderboard] 已同步（${node_path}，暱稱：${player_name}）：${id} - ${wpm} WPM`)
                }
                // 不管成功或失敗都要 resolve——呼叫端只是想知道「這次嘗試結束了沒」，
                // 才能決定要不要放行跳頁，不是在乎有沒有真的寫入成功。
                resolve()
            })
        })
    })
}

/* ============================================================
   【新增】排行榜「隱藏我的成績」開關 —— 共用過濾邏輯
   ------------------------------------------------------------
   單一關卡榜（leaderboard）跟挑戰組合榜（challenge_leaderboard）的每一筆
   資料，本身並沒有「這個人要不要被看到」這個欄位——這個開關統一只存在
   player_stats/{anon_id}/hide_from_leaderboard 這一個地方（single source
   of truth），不會在每一筆分數紀錄裡各自存一份容易過期的複製值。

   所以要濾掉「選擇隱藏」的人，就得對榜單裡的每一筆資料，各自去
   player_stats 查一次「這個人現在的開關狀態」，再把設成隱藏的人踢除。

   【已知取捨，誠實記錄】：這代表每次讀取「單一關卡/挑戰組合」榜單，
   都會多發出最多 fetch_limit 筆（通常是幾十筆）的小型雲端查詢，
   不是完全沒有成本的操作，會讓榜單多花一點時間才顯示出來。
   以這個網站目前的規模來說可以接受；如果之後玩家數量暴增、
   覺得這裡拖慢了排行榜載入速度，可以考慮改成「在 _Submit_Best_Score
   寫入分數的當下，順便把 hidden 狀態快取一份到那筆分數紀錄裡」，
   犧牲「切換開關後立即對所有舊紀錄生效」這個特性，換取讀取效能——
   但那是之後才需要考慮的優化，不是現在就要做的事。

   查詢失敗時的處理原則：寧可「多顯示一個人」，也不要「因為查詢失敗
   就誤刪別人的合法上榜資格」，所以任何一筆查詢失敗都當作「沒有隱藏」。
   ------------------------------------------------------------ */
function _Filter_Out_Hidden_Players(list, callback) {
    if (list.length === 0) {
        callback(list)
        return
    }

    const checks = list.map(function (entry) {
        return tctc_db.ref(`player_stats/${entry._anon_id}/hide_from_leaderboard`)
            .once("value")
            .then(function (snapshot) {
                return { entry: entry, hidden: snapshot.val() === true }
            })
            .catch(function () {
                return { entry: entry, hidden: false }
            })
    })

    Promise.all(checks).then(function (results) {
        const visible_list = results
            .filter(function (r) { return !r.hidden })
            .map(function (r) { return r.entry })
        callback(visible_list)
    })
}

/* ------------------------------------------------------------
   內部共用函式：讀取某個節點底下、某個 id 的排行榜（依 wpm 由高到低）
   ------------------------------------------------------------ */
function _Get_Leaderboard(node_path, id, callback, limit) {
    limit = limit || 50

    // 【新增】刻意多抓一些候選名單當緩衝（fetch_limit = limit + 50），
    // 原因跟 _Get_Top_Players 裡 fetch_limit 的取捨完全一樣：
    // 如果只抓剛好 limit 筆就拿去濾掉隱藏的人，當隱藏的人數變多時，
    // 畫面上顯示的筆數就會比 limit 少（例如抓 50 筆、10 筆被隱藏，
    // 畫面只剩 40 筆，即便實際上第 51~60 名可能是沒隱藏、夠資格上榜的人）。
    // 多抓一些當緩衝可以大幅降低這個情況發生的機率，但無法保證絕對不會發生——
    // 這是這個做法在架構上真實存在的取捨，要誠實跟 Lucas 講清楚。
    const fetch_limit = limit + 50

    tctc_db.ref(`${node_path}/${id}`)
        .orderByChild("wpm")
        .limitToLast(fetch_limit)
        .once("value")
        .then(function (snapshot) {
            const list = []
            snapshot.forEach(function (child) {
                // 【新增】把這筆資料的 anon_id（也就是 Firebase 裡的 key）一起帶出來，
                // 存進 _anon_id 這個欄位，讓畫面端可以拿它跟 Get_Anon_Id() 比對，
                // 藉此判斷「這一列是不是我自己」，加上特別標記。
                // 前面加底線是提醒這是內部輔助欄位，不是真正的排行榜資料本身。
                const val = child.val()
                val._anon_id = child.key
                list.push(val)
            })
            list.sort(function (a, b) { return b.wpm - a.wpm })

            // 【新增】濾掉選擇隱藏的玩家，濾完之後才裁切成畫面實際要顯示的筆數
            _Filter_Out_Hidden_Players(list, function (visible_list) {
                callback(visible_list.slice(0, limit))
            })
        })
        .catch(function (error) {
            console.log(`[leaderboard] 讀取排行榜失敗（${node_path}）：`, error)
            callback([])
        })
}

/* ------------------------------------------------------------
   主線關卡排行榜
   ------------------------------------------------------------
   stageId：關卡 id，例如 "1-5-2"
   ------------------------------------------------------------ */
function Submit_Score_To_Leaderboard(stageId, wpm, acc, raw_stats) {
    return _Submit_Best_Score("leaderboard", stageId, wpm, acc, raw_stats)
}
function Get_Stage_Leaderboard(stageId, callback, limit) {
    _Get_Leaderboard("leaderboard", stageId, callback, limit)
}

/* ------------------------------------------------------------
   挑戰模式排行榜（跟主線關卡分開存放，避免關卡 id 混在一起）
   ------------------------------------------------------------
   comboId：難度-模式-秒數 組合，例如 "easy-article-30"
   ------------------------------------------------------------ */
function Submit_Challenge_Score_To_Leaderboard(comboId, wpm, acc, raw_stats) {
    return _Submit_Best_Score("challenge_leaderboard", comboId, wpm, acc, raw_stats)
}
function Get_Challenge_Leaderboard(comboId, callback, limit) {
    _Get_Leaderboard("challenge_leaderboard", comboId, callback, limit)
}

/* ============================================================
   玩家總排行榜（平均WPM最高／平均正確率最高／在線時長最長）
   ------------------------------------------------------------
   跟上面「主線關卡排行榜」「挑戰模式排行榜」不一樣的地方：
   上面兩種是「同一關卡/組合裡，誰打得最好」，資料節點是用 stageId／comboId 分類。
   這裡是「這個玩家整體表現」，資料節點只用 anon_id 分類（player_stats/{anon_id}），
   每個玩家不管打了多少關、多少次挑戰，統計數字都會累加到同一筆資料上。
   ------------------------------------------------------------ */

// ===== 【新增】把「這次測驗的 WPM / 正確率」累加進這個玩家的整體統計 =====
// 呼叫時機：跟 Submit_Score_To_Leaderboard() / Submit_Challenge_Score_To_Leaderboard()
// 完全一樣的時間點、一樣的門檻條件（也就是說「這次測驗算不算數」的判斷只寫一次，
// 不會有「單一關卡榜上有這筆、玩家總榜卻沒有」這種資料不一致的情況）。
//
// 為什麼分成 4 個獨立的 transaction，而不是對 player_stats/{anon_id} 整個節點做一次 transaction：
// Firebase 的 transaction 回傳值會「整個取代」該節點當下的內容，如果在這個函式裡
// 對整個節點做 transaction，回傳的物件必須手動把 name 欄位也一起帶上，
// 不然舊資料裡的 name 會被蓋成 undefined 而消失。分成獨立欄位各自 transaction，
// 就完全不會動到彼此，寫起來也更清楚每個欄位各自在算什麼。
function Sync_Player_Stats(wpm, acc) {
    if (typeof wpm !== "number" || isNaN(wpm)) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    const base_ref = tctc_db.ref(`player_stats/${anon_id}`)
    const acc_value = (typeof acc === "number" && !isNaN(acc)) ? acc : 0

    // ----- WPM 平均值：wpm_sum 跟 wpm_count 各自累加，兩個都確定成功後，
    // 才用最新的 sum / count 算出 avg_wpm 並直接寫入。
    // avg_wpm 是純粹算出來的衍生值、只有這個函式會寫它，所以用 set() 而不是 transaction()。 -----
    const wpm_chain_promise = new Promise(function (resolve) {
        base_ref.child("wpm_sum").transaction(function (current) {
            return (current || 0) + wpm
        }, function (error, committed, snapshot) {
            if (error) {
                console.log("[player_stats] wpm_sum 同步失敗（很可能是 Firebase Rules 還沒加上 player_stats 節點的規則）：", error)
                resolve()
                return
            }
            if (!committed) { resolve(); return }
            const new_sum = snapshot.val()
            base_ref.child("wpm_count").transaction(function (current) {
                return (current || 0) + 1
            }, function (error2, committed2, snapshot2) {
                if (error2) {
                    console.log("[player_stats] wpm_count 同步失敗：", error2)
                    resolve()
                    return
                }
                if (!committed2) { resolve(); return }
                const new_count = snapshot2.val()
                // 四捨五入到小數點後一位，排行榜排序/顯示都夠用，不需要更多位數
                base_ref.child("avg_wpm").set(Math.round((new_sum / new_count) * 10) / 10).finally(resolve)
            })
        })
    })

    // ----- 正確率平均值：邏輯跟上面 WPM 完全對稱 -----
    const acc_chain_promise = new Promise(function (resolve) {
        base_ref.child("acc_sum").transaction(function (current) {
            return (current || 0) + acc_value
        }, function (error, committed, snapshot) {
            if (error) {
                console.log("[player_stats] acc_sum 同步失敗：", error)
                resolve()
                return
            }
            if (!committed) { resolve(); return }
            const new_sum = snapshot.val()
            base_ref.child("acc_count").transaction(function (current) {
                return (current || 0) + 1
            }, function (error2, committed2, snapshot2) {
                if (error2) {
                    console.log("[player_stats] acc_count 同步失敗：", error2)
                    resolve()
                    return
                }
                if (!committed2) { resolve(); return }
                const new_count = snapshot2.val()
                base_ref.child("avg_acc").set(Math.round((new_sum / new_count) * 10) / 10).finally(resolve)
            })
        })
    })

    // 名字每次都同步成最新值，邏輯跟 _Submit_Best_Score 裡的做法一致
    const name_promise = new Promise(function (resolve) {
        Get_Player_Display_Name(function (name) {
            base_ref.child("name").set(name).finally(resolve)
        })
    })

    return Promise.all([wpm_chain_promise, acc_chain_promise, name_promise])
}

// ===== 【新增】把「這次挑戰賺到的積分」累加進玩家總積分 =====
// 呼叫時機：TCTC2-0-challenge.js 結算積分之後，只要 pointsEarned > 0 就會呼叫。
// 邏輯很單純，就是把 pointsEarned 加進 total_points，沒有平均值的概念，
// 所以只需要一個 transaction，不像 wpm/acc 需要 sum + count 兩個欄位配合算平均。
function Sync_Player_Points(points) {
    if (typeof points !== "number" || isNaN(points) || points <= 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    const base_ref = tctc_db.ref(`player_stats/${anon_id}`)

    const points_promise = new Promise(function (resolve) {
        base_ref.child("total_points").transaction(function (current) {
            return (current || 0) + points
        }, function (error, committed) {
            if (error) {
                console.log("[player_stats] total_points 同步失敗（很可能是 Firebase Rules 還沒加上 total_points 欄位的規則）：", error)
            }
            resolve()
        })
    })

    const name_promise = new Promise(function (resolve) {
        Get_Player_Display_Name(function (name) {
            base_ref.child("name").set(name).finally(resolve)
        })
    })

    return Promise.all([points_promise, name_promise])
}

// ===== 【新增】追蹤「在線時長」目前是不是有一筆同步還在跟雲端來回中 =====
// 用來解決一個真實存在的 race condition：Sync_Pending_Online_Time() 是用
// transaction() 寫入 online_seconds，Firebase 的 transaction() 在還沒收到
// 伺服器「真正確認」之前，會先用本機推測值廣播給同一個路徑的任何讀取者——
// 如果推測當下 SDK 手上還沒有這個欄位的最新快取，這個推測值有可能只是
// 「這次要加的 pending 秒數」本身，還沒加上原本雲端已經存好的總量。
// 如果「玩家總排行榜」剛好在這個時間點讀到這筆還沒塵埃落定的暫時值，
// 就會顯示成一個異常小的數字，過一下子（或重讀一次）才會變回正確的——
// 這正是「重新整理頁面後在線時長忽然變超小」這個現象的成因。
// 解法：讀取在線時長排行榜前，先等目前這筆同步真正結束（不管成功失敗），
// 才真的發出查詢，避免讀跟寫互相搶。
let _online_time_sync_in_flight = null

function Wait_For_Online_Time_Sync(callback) {
    if (_online_time_sync_in_flight) {
        _online_time_sync_in_flight.then(callback)
    } else {
        callback()
    }
}

// ===== 【新增】把本機暫存的「在線秒數」補交上雲端 =====
// 由 TCTC2-0-online_time.js 在每個頁面載入時呼叫（如果這個頁面有載入 Firebase 的話）。
// PENDING_KEY 這個字串要跟 TCTC2-0-online_time.js 裡用的完全一致，不然兩邊各自讀寫
// 不同的 localStorage key，秒數永遠對不起來。
function Sync_Pending_Online_Time() {
    const PENDING_KEY = "tctc2.0-pending_online_seconds"
    const pending_seconds = Math.floor(Number(localStorage.getItem(PENDING_KEY)) || 0)
    if (pending_seconds <= 0) return

    const anon_id = Get_Anon_Id()

    _online_time_sync_in_flight = new Promise(function (resolve) {
        tctc_db.ref(`player_stats/${anon_id}/online_seconds`).transaction(function (current) {
            return (current || 0) + pending_seconds
        }, function (error, committed) {
            // 只有「真的成功寫進雲端」才把本機暫存區扣掉這次上傳的量。
            // 這裡刻意用「扣掉剛剛上傳的量」而不是直接歸零，
            // 因為玩家可能在這次上傳還沒完成的同時，又累積了新的前景秒數進暫存區，
            // 直接歸零會把這些「新產生、還沒上傳過」的秒數也一起清掉。
            if (!error && committed) {
                const still_pending = Number(localStorage.getItem(PENDING_KEY)) || 0
                localStorage.setItem(PENDING_KEY, Math.max(0, still_pending - pending_seconds))
            } else if (error) {
                // 【新增】失敗時一定要印出來，不然像「Firebase Rules 還沒貼上導致 permission_denied」
                // 這種問題會完全沒有任何訊息，看起來像「同步邏輯本身沒作用」，其實只是被雲端擋下來而已
                console.log("[online_time] 在線時長同步失敗（很可能是 Firebase Rules 還沒加上 player_stats 節點的規則）：", error)
            }
            _online_time_sync_in_flight = null
            resolve()
        })
    })

    Get_Player_Display_Name(function (name) {
        tctc_db.ref(`player_stats/${anon_id}/name`).set(name)
    })
}

/* ============================================================
   【新增】網站瀏覽次數統計
   ------------------------------------------------------------
   設計上完全比照上面「在線時長」那一套（本機暫存 → 頁面載入時補交上雲端），
   原因：
   - TCTC2-0-online_time.js 會被載入在「每一個頁面」，但不是每個頁面都同時
     載入了 Firebase（例如目前的 main.html／details.html）。
   - 如果沒有這層「本機先暫存，等到剛好逛到有載入 Firebase 的頁面才補交」，
     玩家在那些頁面產生的瀏覽次數就會直接遺失、永遠不會被算進去，
     跟「刷新頁面或換頁都要算一次」這個需求不符。
   - PENDING_VIEWS_KEY 這個 localStorage key 名稱要跟
     TCTC2-0-online_time.js 裡用的字串完全一致，否則兩邊會各自讀寫
     不同的暫存區，次數永遠同步不到雲端。
   ------------------------------------------------------------ */

// 跟 _online_time_sync_in_flight 是同樣的用途：避免「同一個頁面剛寫入瀏覽次數
// 上雲端，緊接著又立刻讀取排行榜」時，讀到 transaction 尚未被伺服器修正回來的
// 暫時推測值（詳細成因見上面 Wait_For_Online_Time_Sync 的說明，這裡是同一種
// race condition，只是換了一個欄位）。
let _page_views_sync_in_flight = null

function Wait_For_Page_Views_Sync(callback) {
    if (_page_views_sync_in_flight) {
        _page_views_sync_in_flight.then(callback)
    } else {
        callback()
    }
}

// ===== 【新增】把本機暫存的「待上傳瀏覽次數」同時累加進：
//   1) site_meta/total_page_views（全站總數，不分訪客/玩家）
//   2) player_stats/{anon_id}/page_views（這個玩家自己的總數，訪客也算，
//      因為 player_stats 本來就是用 anon_id 分類，訪客一樣有 anon_id）
// 由 TCTC2-0-online_time.js 在每個頁面載入時呼叫（如果這個頁面有載入 Firebase 的話）。
// =====
function Sync_Pending_Page_Views() {
    const PENDING_VIEWS_KEY = "tctc2.0-pending_page_views"
    const pending_views = Math.floor(Number(localStorage.getItem(PENDING_VIEWS_KEY)) || 0)
    if (pending_views <= 0) return

    const anon_id = Get_Anon_Id()

    _page_views_sync_in_flight = new Promise(function (resolve) {
        // ----- 先處理「全站總瀏覽次數」-----
        // 這裡刻意只依「全站總數這筆 transaction 有沒有成功」來決定要不要扣掉
        // 本機暫存的次數，而不是等兩邊都成功才扣。這是一個誠實需要承認的取捨：
        // 如果全站總數寫入成功、但底下 player_stats 那筆剛好失敗，
        // 這幾次瀏覽就會「算進全站總數，卻沒算進這個玩家自己的排行榜」，
        // 因為本機暫存已經被清空、不會重試。這種情況機率很低（兩個都是
        // 對同一個 Firebase 專案的獨立 transaction，通常會一起成功或一起因為
        // 網路離線而一起失敗），但架構上確實可能發生，不是「絕對不會出錯」。
        tctc_db.ref("site_meta/total_page_views").transaction(function (current) {
            return (current || 0) + pending_views
        }, function (error, committed) {
            if (!error && committed) {
                const still_pending = Math.floor(Number(localStorage.getItem(PENDING_VIEWS_KEY)) || 0)
                localStorage.setItem(PENDING_VIEWS_KEY, Math.max(0, still_pending - pending_views))
            } else if (error) {
                console.log("[page_views] 全站瀏覽次數同步失敗（很可能是 Firebase Rules 還沒加上 site_meta 節點的規則）：", error)
            }

            // ----- 再處理「這個玩家自己的瀏覽次數」-----
            tctc_db.ref(`player_stats/${anon_id}/page_views`).transaction(function (current) {
                return (current || 0) + pending_views
            }, function (error2) {
                if (error2) {
                    console.log("[page_views] 玩家瀏覽次數同步失敗（很可能是 Firebase Rules 還沒加上 page_views 欄位的規則）：", error2)
                }
                _page_views_sync_in_flight = null
                resolve()
            })
        })
    })

    // 名字同步邏輯跟 Sync_Pending_Online_Time 完全一致：不管這次同步成不成功，
    // 都把名字更新成最新值，讓瀏覽次數榜上顯示的名字不會卡在舊資料。
    Get_Player_Display_Name(function (name) {
        tctc_db.ref(`player_stats/${anon_id}/name`).set(name)
    })
}

// ===== 【新增】讀取「網站目前總瀏覽次數」，給排行榜頁面最上方顯示用 =====
// 讀取前先等目前這筆同步真正結束，避免讀到還沒塵埃落定的暫時推測值
// （原因跟 Get_Top_Players_By_Online_Time 前面要先 Wait_For_Online_Time_Sync 一樣）。
// callback 收到的值：成功是「數字」（0 也算成功，代表目前真的是 0 次）；
// 讀取真的失敗（例如離線、規則沒設好）則是 null，畫面端應該顯示「讀取失敗」
// 而不是誤把 null 當成 0 次顯示出來。
function Get_Total_Page_Views(callback) {
    Wait_For_Page_Views_Sync(function () {
        tctc_db.ref("site_meta/total_page_views").once("value")
            .then(function (snapshot) {
                callback(snapshot.val() || 0)
            })
            .catch(function (error) {
                console.log("[page_views] 讀取全站瀏覽次數失敗：", error)
                callback(null)
            })
    })
}

// ===== 【新增】內部共用函式：依某個欄位排序，取出「玩家總排行榜」前段名單 =====
// min_count_field / min_count：用來實作「至少要打過 N 次才能上榜」的門檻
// （例如平均WPM/平均正確率榜，需要 wpm_count / acc_count >= 50）。
//
// 【已知限制，务必誠實告知使用者】：Firebase Realtime Database 不支援
// 「依 A 欄位排序、同時篩選 B 欄位門檻」這種複合查詢。這裡採取的做法是：
// 先依排序欄位抓一批「數量比實際要顯示的筆數多很多」的候選名單（fetch_limit，預設 200 筆），
// 再由瀏覽器端 JS 把未達門檻的人濾掉。
// 這代表在「玩家總數非常龐大」的極端情況下，如果剛好有超過 fetch_limit 筆
// 「未達門檻但數值很高」的紀錄排在真正合格者前面，就有可能漏掉少數合格的高分玩家。
// 對這個網站目前的規模來說機率極低，但這是這個做法在架構上真實存在的取捨，
// 不是「一定不會出錯」，要跟 Lucas 講清楚。
function _Get_Top_Players(order_by_field, min_count_field, min_count, callback, fetch_limit) {
    fetch_limit = fetch_limit || 200

    tctc_db.ref("player_stats")
        .orderByChild(order_by_field)
        .limitToLast(fetch_limit)
        .once("value")
        .then(function (snapshot) {
            const list = []
            snapshot.forEach(function (child) {
                const val = child.val()
                // 【新增】跟 _Get_Leaderboard 一樣，把這筆是誰（anon_id）帶出來，
                // 讓畫面端可以標記「這是我自己」
                val._anon_id = child.key

                // 【新增】跳過「選擇不顯示在排行榜」的玩家。
                // 這裡「不需要」像 _Get_Leaderboard 那樣額外發查詢——
                // hide_from_leaderboard 本來就跟 avg_wpm 等其他統計數字
                // 存在同一個節點（player_stats/{anon_id}）底下，
                // 讀一次 player_stats 就順便一起拿到了，完全沒有額外成本。
                if (val.hide_from_leaderboard === true) return

                if (!min_count_field || (val[min_count_field] || 0) >= min_count) {
                    list.push(val)
                }
            })
            // limitToLast 只保證「取到的這批」是由小到大排序後最大的那幾筆，
            // 但批次內部的先後順序不保證由大到小，所以濾完門檻之後要自己再排序一次。
            list.sort(function (a, b) { return (b[order_by_field] || 0) - (a[order_by_field] || 0) })
            callback(list)
        })
        .catch(function (error) {
            console.log(`[leaderboard] 讀取玩家總排行榜失敗（${order_by_field}）：`, error)
            callback([])
        })
}

// 平均WPM最高榜：需要至少測驗過 50 次（wpm_count >= 50）才會上榜
function Get_Top_Players_By_Avg_Wpm(callback, limit) {
    _Get_Top_Players("avg_wpm", "wpm_count", 50, function (list) {
        callback(list.slice(0, limit || 50))
    })
}
// 平均正確率最高榜：需要至少測驗過 50 次（acc_count >= 50）才會上榜
function Get_Top_Players_By_Avg_Acc(callback, limit) {
    _Get_Top_Players("avg_acc", "acc_count", 50, function (list) {
        callback(list.slice(0, limit || 50))
    })
}
// 在線時長最長榜：不設門檻，時長本身就是唯一的採計標準
// 【修正】先等目前這筆在線時長的同步真正結束，才真的發出查詢，
// 避免讀到 transaction 還沒被伺服器修正回來的暫時推測值（見上面 Wait_For_Online_Time_Sync 的說明）
function Get_Top_Players_By_Online_Time(callback, limit) {
    Wait_For_Online_Time_Sync(function () {
        _Get_Top_Players("online_seconds", null, 0, function (list) {
            callback(list.slice(0, limit || 50))
        })
    })
}
// 積分最高榜：要求 total_points >= 1，濾掉「從來沒打過挑戰模式、根本沒有積分紀錄」的玩家
// （這種玩家在 player_stats 裡沒有 total_points 欄位，畫面端會用 ?? 0 補成「0 積分」顯示，
// 如果不濾掉，會出現「零積分也上榜」這種很奇怪的狀況）
function Get_Top_Players_By_Points(callback, limit) {
    _Get_Top_Players("total_points", "total_points", 1, function (list) {
        callback(list.slice(0, limit || 50))
    })
}
// 瀏覽次數最多榜：不設門檻，邏輯跟在線時長最長榜對稱。
// 一樣先 Wait_For_Page_Views_Sync 等這個頁面自己的那筆同步結束，
// 才真的發出查詢，理由跟 Get_Top_Players_By_Online_Time 前面加
// Wait_For_Online_Time_Sync 完全一致（避免讀到暫時推測值）。
function Get_Top_Players_By_Page_Views(callback, limit) {
    Wait_For_Page_Views_Sync(function () {
        _Get_Top_Players("page_views", null, 0, function (list) {
            callback(list.slice(0, limit || 50))
        })
    })
}

/* ============================================================
   【新增】玩家自己的名次（沒有擠進 Top 50 榜單時，畫面底部會用這個顯示浮窗）
   ------------------------------------------------------------
   上面 _Get_Leaderboard / _Get_Top_Players 都只抓「前 N 名」，沒辦法回答
   「我沒上榜，但我到底排第幾」這個問題——所以這裡要把整個節點的資料都
   下載下來，自己排序、自己找出這個玩家排在第幾個。
   對這個網站目前的規模來說沒問題；如果玩家數量變得非常龐大，
   這裡會是第一個需要換成後端彙總計算的地方（先誠實記下這個取捨）。
   ------------------------------------------------------------ */

// 內部共用：在 node_path/id 這個節點底下，算出「這個玩家」目前排第幾名
// 回傳 null 代表這個玩家在這個節點底下根本沒有任何紀錄（這關/這個組合還沒打過），
// 這種情況畫面端不應該顯示任何名次浮窗。
function _Get_Own_Rank_In_Node(node_path, id, callback) {
    const anon_id = Get_Anon_Id()

    tctc_db.ref(`${node_path}/${id}`)
        .orderByChild("wpm")
        .once("value")
        .then(function (snapshot) {
            const list = []
            snapshot.forEach(function (child) {
                const val = child.val()
                val._anon_id = child.key
                list.push(val)
            })
            // 跟 _Get_Leaderboard 一樣，Firebase 排序後還要自己再排一次確保順序正確
            list.sort(function (a, b) { return b.wpm - a.wpm })

            const own_index = list.findIndex(function (entry) { return entry._anon_id === anon_id })
            if (own_index === -1) {
                callback(null)
                return
            }
            callback({
                rank: own_index + 1,
                total: list.length,
                name: list[own_index].name,
                wpm: list[own_index].wpm,
                acc: list[own_index].acc
            })
        })
        .catch(function (error) {
            console.log(`[leaderboard] 讀取自己名次失敗（${node_path}）：`, error)
            callback(null)
        })
}

function Get_Own_Stage_Rank(stageId, callback) {
    _Get_Own_Rank_In_Node("leaderboard", stageId, callback)
}
function Get_Own_Challenge_Rank(comboId, callback) {
    _Get_Own_Rank_In_Node("challenge_leaderboard", comboId, callback)
}

// 玩家總榜（平均WPM／平均正確率／在線時長／積分）版本的「自己排第幾名」。
// 【修正】原本這裡只有 (order_by_field, callback) 兩個參數、完全不套用門檻，
// 但 ranking.js 呼叫時是傳 (order_by_field, min_count_field, min_count, callback) 四個參數，
// 多傳的參數在 JS 裡會被直接忽略、真正的 callback 反而傳不進來，導致這個功能其實是壞的
// （呼叫到 callback 那一行會直接噴錯，因為那時候的「callback」其實是 min_count_field）。
// 現在補上這兩個參數，並且真的套用門檻：沒達到門檻（例如平均WPM榜要求至少 50 次測驗）
// 就回傳 null 不顯示浮窗，跟正式榜單「沒達標的人不會出現」的邏輯保持一致，不會自相矛盾。
function Get_Own_Player_Rank(order_by_field, min_count_field, min_count, callback) {
    const anon_id = Get_Anon_Id()

    tctc_db.ref("player_stats")
        .orderByChild(order_by_field)
        .once("value")
        .then(function (snapshot) {
            const own_snapshot = snapshot.child(anon_id)
            if (!own_snapshot.exists()) {
                callback(null) // 這個玩家完全沒有任何統計資料
                return
            }

            const own_val = own_snapshot.val()
            if (min_count_field && (own_val[min_count_field] || 0) < min_count) {
                callback(null) // 還沒達到門檻，跟正式榜單一樣不顯示
                return
            }

            const list = []
            snapshot.forEach(function (child) {
                const val = child.val()
                val._anon_id = child.key
                if (!min_count_field || (val[min_count_field] || 0) >= min_count) {
                    list.push(val)
                }
            })
            list.sort(function (a, b) { return (b[order_by_field] || 0) - (a[order_by_field] || 0) })

            const own_index = list.findIndex(function (entry) { return entry._anon_id === anon_id })
            callback({
                rank: own_index + 1,
                total: list.length,
                name: own_val.name,
                value: own_val[order_by_field]
            })
        })
        .catch(function (error) {
            console.log(`[leaderboard] 讀取玩家總榜自己名次失敗（${order_by_field}）：`, error)
            callback(null)
        })
}

/* ============================================================
   【新增】一次讀出「自己」完整的雲端統計資料（不是榜單，是給 profile.html
   個人設定頁的「個人資訊」卡片顯示用）
   ------------------------------------------------------------
   跟上面 Get_Own_Player_Rank 不一樣的地方：
   - Get_Own_Player_Rank 是「對某一個排序欄位查詢排名」，每次只能查一個指標，
     而且要下載整個 player_stats 節點來排序，對「只是想顯示自己的數字、
     根本不需要知道排第幾名」這種需求來說殺雞用牛刀。
   - 這裡改成直接對 `player_stats/{anon_id}` 這一個節點做 .once("value")，
     Firebase 只會回傳這一筆資料，不會下載其他玩家的資料，開銷小很多。
   ------------------------------------------------------------
   callback 收到的值：
   - 一般情況：一個物件，包含 name / avg_wpm / avg_acc / online_seconds /
     total_points / page_views 等欄位（哪些欄位存在，取決於這個玩家
     之前實際觸發過哪些同步——例如從來沒打過挑戰模式，就不會有 total_points）
   - 這個玩家在雲端「完全還沒有任何資料」（例如全新訪客，一次都還沒同步過）：
     回傳一個空物件 {}，讓呼叫端可以直接用 (result.xxx ?? 0) 取預設值，
     不需要額外判斷 null
   - 讀取「真的失敗」（離線、Rules 沒設好）：回傳 null，呼叫端要能分辨
     「真的沒資料（顯示 0）」跟「讀取失敗（應該顯示錯誤訊息）」的差異
   ------------------------------------------------------------
   讀取前先等「在線時長」跟「瀏覽次數」這兩個目前頁面自己觸發的同步
   都真正結束——原因跟 Get_Top_Players_By_Online_Time / Get_Total_Page_Views
   前面要先 Wait_For_XXX_Sync 完全一樣：避免讀到 transaction 還沒被伺服器
   修正回來的暫時推測值，導致「剛整理完頁面，在線時長忽然變超小」這種現象。
   ============================================================ */
function Get_Own_Player_Stats(callback) {
    const anon_id = Get_Anon_Id()

    Wait_For_Online_Time_Sync(function () {
        Wait_For_Page_Views_Sync(function () {
            tctc_db.ref(`player_stats/${anon_id}`)
                .once("value")
                .then(function (snapshot) {
                    callback(snapshot.val() || {})
                })
                .catch(function (error) {
                    console.log("[player_stats] 讀取自己的完整統計資料失敗：", error)
                    callback(null)
                })
        })
    })
}

/* ============================================================
   【新增】排行榜顯示開關（隱私設定）
   ------------------------------------------------------------
   單一 boolean 欄位：player_stats/{anon_id}/hide_from_leaderboard
   - 欄位不存在，或值是 false：正常顯示在所有排行榜上（預設狀態，
     也就是「這個玩家從來沒關過這個開關」）
   - 欄位值是 true：從「單一關卡榜」「挑戰組合榜」「玩家總榜」都會被濾掉
     （濾掉的邏輯寫在上面的 _Filter_Out_Hidden_Players / _Get_Top_Players）
   - 只影響「別人在排行榜上看不看得到你」，完全不影響你自己在
     profile.html 個人設定頁看到的統計數字（那是靠 Get_Own_Player_Stats
     直接讀自己的節點，跟排行榜的讀取邏輯是兩條獨立路徑）
   ------------------------------------------------------------ */

// 讀取「自己目前」的開關狀態，給 profile.html 初始化 checkbox 用。
// 【注意】profile.js 目前選擇直接重複使用 Get_Own_Player_Stats() 回傳的
// stats.hide_from_leaderboard 欄位來初始化畫面，並沒有另外呼叫這個函式——
// 因為那次呼叫已經把整個 player_stats/{anon_id} 節點都讀回來了，
// 這個欄位當然也包含在裡面，沒必要為了同一份資料多打一次 Firebase API。
// 這個函式留著是給「除了 profile.js 以外，未來可能需要單獨檢查這個開關」
// 的情境使用（例如以後想在別的頁面也顯示這個狀態）。
function Get_Own_Leaderboard_Visibility(callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/hide_from_leaderboard`)
        .once("value")
        .then(function (snapshot) {
            // 沒設定過就是 false（預設「顯示」），不是「讀取失敗」，
            // 這裡刻意用 === true 判斷，讓 undefined／false 都統一視為「顯示」
            callback(snapshot.val() === true)
        })
        .catch(function (error) {
            console.log("[leaderboard] 讀取排行榜顯示設定失敗：", error)
            callback(null) // null 代表「真的讀取失敗」，畫面端要跟「目前設定為顯示」明確區分開來
        })
}

// 更新「自己」的開關狀態。
// hide = true：從此刻開始，所有排行榜的讀取都會把這個玩家濾掉（立即生效，
//              不用等下一次破紀錄或重新整理才生效，因為榜單讀取時是即時查詢這個欄位）
// hide = false：恢復正常顯示
// callback(success)：success 是布林值，讓呼叫端（profile.js）決定要不要
//                     把畫面上的開關復原成操作前的狀態、要不要顯示錯誤提示
function Set_Own_Leaderboard_Visibility(hide, callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/hide_from_leaderboard`).set(!!hide)
        .then(function () {
            if (callback) callback(true)
        })
        .catch(function (error) {
            console.log("[leaderboard] 更新排行榜顯示設定失敗（很可能是 Firebase Rules 還沒加上 hide_from_leaderboard 欄位的規則）：", error)
            if (callback) callback(false)
        })
}

/* ============================================================
   【新增】刪除這個瀏覽器（anon_id）在雲端留下的所有資料
   ------------------------------------------------------------
   刻意「不」刪除的東西：
   - player_stats/{anon_id}/page_views：個人瀏覽次數，跟 site_meta/total_page_views
     （網站總瀏覽次數）是兩個獨立的東西，玩家清空自己的資料不代表要抹掉
     「這台裝置造訪過幾次」這個統計，兩者語意上不衝突，所以保留。
   - site_meta/total_page_views：本來就不是這個玩家專屬的資料，不會被動到。
   - guest_counter：全站共用的流水號計數器，不能因為單一玩家刪資料就往回退，
     不然會跟其他已經分配出去的訪客編號打架。

   會刪除的東西：
   - player_stats/{anon_id} 底下除了 page_views 以外的所有欄位
   - guest_numbers/{anon_id}（下次需要顯示訪客編號時，會重新分配一個新的）
   - usernames/{key}：只有在「這個名字目前真的是被自己佔用」時才釋放，
     用 transaction 做這層確認，避免刪到別人手上的資料
   - leaderboard/{stageId}/{anon_id}：主線每一關，路徑用 Level_Data 現場列舉
     （所以這個頁面要記得載入 TCTC2-0-level_data.js，不然這段會直接跳過）
   - challenge_leaderboard/{comboId}/{anon_id}：挑戰模式固定 40 種組合
     （4 難度 × 2 模式 × 5 時間長度），直接寫死列舉，不需要額外資料

   全部用同一個 multi-path update() 一次送出，Firebase 會把它當成一次
   atomic 的寫入──要嘛全部成功、要嘛全部失敗，不會發生「刪到一半斷掉，
   有些欄位刪了、有些沒刪」這種資料半殘的狀態。
   ============================================================ */
function Delete_All_Player_Data(callback) {
    const anon_id = Get_Anon_Id()
    const updates = {}

    // ----- player_stats：除了 page_views，其餘全部清成 null（等同刪除該欄位）-----
    ;[
        "name", "wpm_sum", "wpm_count", "avg_wpm",
        "acc_sum", "acc_count", "avg_acc",
        "online_seconds", "total_points", "hide_from_leaderboard"
    ].forEach(function (field) {
        updates[`player_stats/${anon_id}/${field}`] = null
    })

    // ----- 訪客編號：連本機快取一起清，才不會畫面顯示舊號碼、雲端卻查無此號 -----
    updates[`guest_numbers/${anon_id}`] = null
    localStorage.removeItem("tctc_guest_number")

    // ----- 挑戰模式排行榜：40 種組合固定列舉 -----
    const CHALLENGE_DIFFICULTIES = ["easy", "medium", "hard", "extreme"]
    const CHALLENGE_STAGES = ["article", "word"]
    const CHALLENGE_SECONDS = [30, 60, 180, 300, 600]
    CHALLENGE_DIFFICULTIES.forEach(function (diff) {
        CHALLENGE_STAGES.forEach(function (stage) {
            CHALLENGE_SECONDS.forEach(function (seconds) {
                updates[`challenge_leaderboard/${diff}-${stage}-${seconds}/${anon_id}`] = null
            })
        })
    })

    // ----- 主線排行榜：走訪 Level_Data 拿到每一關的 id -----
    // Level_Data 定義在 TCTC2-0-level_data.js，如果呼叫這支函式的頁面沒有載入
    // 那支檔案（例如目前的 profile.html），typeof 會是 "undefined"，
    // 這段就整段跳過──不會報錯中斷，只是主線榜這部分刪不到，
    // 其餘 player_stats／guest_numbers／usernames／挑戰榜還是會正常執行。
    if (typeof Level_Data === "object" && Level_Data) {
        Object.keys(Level_Data).forEach(function (difficultyKey) {
            const chapters = (Level_Data[difficultyKey] && Level_Data[difficultyKey].chapter) || []
            chapters.forEach(function (chapter) {
                const stages = chapter.stage || []
                stages.forEach(function (stage) {
                    if (stage && stage.id) {
                        updates[`leaderboard/${stage.id}/${anon_id}`] = null
                    }
                })
            })
        })
    } else {
        console.log("[delete] 這個頁面沒有載入 Level_Data，主線關卡榜的資料這次不會被清除")
    }

    // ----- 使用者名稱：只釋放「確定是自己佔的」那一筆 -----
    const saved_username = (localStorage.getItem("username") || "").trim()
    const username_key = saved_username ? _Username_To_Key(saved_username) : null

    function Finish_Delete() {
        tctc_db.ref().update(updates)
            .then(function () {
                callback(true)
            })
            .catch(function (error) {
                console.log("[delete] 清除雲端資料失敗：", error)
                callback(false)
            })
    }

    if (username_key) {
        tctc_db.ref(`usernames/${username_key}`).transaction(function (current) {
            // 只有現在存的值確實是自己的 anon_id，才清掉；
            // 如果不是（例如中途被別人搶走、或本機記錄跟雲端不一致），保留原樣不動
            return (current === anon_id) ? null : current
        }, function () {
            // 不管這步 transaction 結果如何（成功、被拒絕、甚至出錯），
            // 都繼續往下做其餘資料的刪除，不要讓使用者名稱這一小步卡住整個流程
            Finish_Delete()
        })
    } else {
        Finish_Delete()
    }
}