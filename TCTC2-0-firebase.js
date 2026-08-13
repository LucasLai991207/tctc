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
   【新增】匿名登入
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
*/
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
        // 【改動】原本只查 hide_from_leaderboard 這一個欄位，
        // 改成查整個 player_stats/{anon_id} 節點，
        // 這樣可以「順便」拿到最新的 name，不用額外多發一次請求
        return tctc_db.ref(`player_stats/${entry._anon_id}`)
            .once("value")
            .then(function (snapshot) {
                const stats = snapshot.val() || {}
                return { entry: entry, hidden: stats.hide_from_leaderboard === true, live_name: stats.name }
            })
            .catch(function () {
                return { entry: entry, hidden: false, live_name: null }
            })
    })

    Promise.all(checks).then(function (results) {
        const visible_list = results
            .filter(function (r) { return !r.hidden })
            .map(function (r) {
                // 【新增】用 player_stats 裡「現在」的名字蓋掉這筆分數記錄裡的舊快照，
                // 這樣不管這筆成績是多久以前上傳的，畫面上永遠顯示玩家目前的名字。
                // 如果 player_stats 裡剛好沒有 name（理論上不該發生），就保留原本的舊名字當備援。
                if (r.live_name) r.entry.name = r.live_name
                return r.entry
            })
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
            // 【修改】先比 wpm，wpm 相同時再比 acc（正確率）當作第二排序依據，
            // 這樣「wpm 和 acc 都一樣」的人才會被視為真正同分（交給 ranking.js 的
            // Compute_Competition_Ranks 判定同名次），單純 wpm 一樣但 acc 不同的人
            // 不會被誤判成並列。
            list.sort(function (a, b) {
                if (b.wpm !== a.wpm) return b.wpm - a.wpm
                return (b.acc || 0) - (a.acc || 0)
            })

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
    // 【新增】同步更新這個玩家「所有挑戰組合裡」單次最高 WPM，
    // 寫進 player_stats/{anon_id}/best_challenge_wpm，給榮譽牆的
    // 「挑戰 WPM 達標」成就用（不是累計平均，是單次最佳紀錄）。
    // 用 transaction() 只在破紀錄時才真的寫入（Math.max 保留較大值），
    // 理由跟 _Submit_Best_Score 內部「只有破紀錄才更新」一致：
    // 避免每次挑戰結束都無條件覆寫，也讓多分頁同時遊玩時不會互相蓋掉
    // 對方剛寫入的紀錄。這裡不等它完成、不影響原本的排行榜上傳流程，
    // 兩個寫入互相獨立，其中一個失敗不會拖累另一個。
    const anon_id = Get_Anon_Id()
    if (anon_id && typeof wpm === "number" && !isNaN(wpm)) {
        tctc_db.ref(`player_stats/${anon_id}/best_challenge_wpm`).transaction(function (current) {
            return Math.max(current || 0, wpm)
        }).catch(function (error) {
            console.log("[player_stats] best_challenge_wpm 同步失敗：", error)
        })

        // ===== 【修改】榮譽牆「速度」分類的「連續維持高速」成就 =====
        // 固定視窗長度 7：只保留「最近 7 次挑戰模式」的 WPM，存進
        // recent_challenge_wpm_window（陣列，超過 7 筆就把最舊的擠掉）。
        // 每次挑戰結束後，如果視窗已經滿 7 筆，就算出這 7 筆裡「最低」的
        // 那個 WPM（代表這連續 7 次裡最弱的一次），拿去跟歷史紀錄
        // Math.max 一次，寫進 high_wpm_streak——要拿到高階牌，
        // 必須連續 7 次「每一次」都不能低於門檻，不是任何一次達標就算數，
        // 也不是平均，這樣「連續維持」才有意義。門檻本身（35/70/100/150）
        // 交給 achievements.js 的 thresholds 陣列比對，這裡只負責算出
        // 「歷史上連續 7 次裡最低那次曾經有過的最高紀錄」這個數值。
        const CHALLENGE_WPM_STREAK_LENGTH = 7 // 要跟 achievements.js 裡 wpm_streak 成就文案的「連續 7 場」保持一致

        tctc_db.ref(`player_stats/${anon_id}/recent_challenge_wpm_window`).transaction(function (current) {
            const window = Array.isArray(current) ? current.slice() : []
            window.push(wpm)
            if (window.length > CHALLENGE_WPM_STREAK_LENGTH) window.shift()
            return window
        }).then(function (result) {
            if (!result.committed) return
            const window = result.snapshot.val() || []
            if (window.length < CHALLENGE_WPM_STREAK_LENGTH) return   // 還沒累積滿 7 次，先不更新紀錄

            const windowMin = Math.min.apply(null, window)
            return tctc_db.ref(`player_stats/${anon_id}/high_wpm_streak`).transaction(function (current) {
                return Math.max(current || 0, windowMin)
            })
        }).catch(function (error) {
            console.log("[player_stats] WPM 連續紀錄同步失敗：", error)
        })
    }

    // ===== 【新增】榮譽牆「精準」分類三項挑戰模式單次正確率成就 =====
    // 跟上面 best_challenge_wpm 一樣，這三個都不等它完成、不影響原本排行榜上傳流程，
    // 各自獨立，其中一個失敗不會拖累另一個或拖累主要的 _Submit_Best_Score。
    const CHALLENGE_ACC_STREAK_THRESHOLD = 90 // 要跟 achievements.js 裡 acc_streak 成就文案的「90% 以上」保持一致

    if (anon_id && typeof acc === "number" && !isNaN(acc)) {
        // 1) 單次最高正確率（只增不減，跟 best_challenge_wpm 同一套 transaction+Math.max 寫法）
        tctc_db.ref(`player_stats/${anon_id}/best_challenge_acc`).transaction(function (current) {
            return Math.max(current || 0, acc)
        }).catch(function (error) {
            console.log("[player_stats] best_challenge_acc 同步失敗：", error)
        })

        // 2) 正確率剛好 100% 的次數，累加型計數器
        if (acc >= 100) {
            tctc_db.ref(`player_stats/${anon_id}/perfect_challenge_count`).transaction(function (current) {
                return (current || 0) + 1
            }).catch(function (error) {
                console.log("[player_stats] perfect_challenge_count 同步失敗：", error)
            })
        }

        // 3) 連續正確率達標（≥90%）次數：先更新「目前這一段連續」的暫存欄位，
        // 再拿這次 transaction 真正結算出來的值（result.snapshot.val()）去更新「歷史最長」，
        // 兩個欄位分開存的理由跟 login_streak.js 的 streak_current / streak_longest 一致——
        // 「目前連續」會因為某次沒達標而歸零，但「歷史最長」只增不減，成就用後者才不會被收回。
        tctc_db.ref(`player_stats/${anon_id}/challenge_acc_streak_current`).transaction(function (current) {
            return acc >= CHALLENGE_ACC_STREAK_THRESHOLD ? (current || 0) + 1 : 0
        }).then(function (result) {
            if (!result.committed) return
            const newStreak = result.snapshot.val() || 0
            return tctc_db.ref(`player_stats/${anon_id}/high_acc_challenge_streak`).transaction(function (current) {
                return Math.max(current || 0, newStreak)
            })
        }).catch(function (error) {
            console.log("[player_stats] 正確率連續紀錄同步失敗：", error)
        })
    }

    // 【新增】上面這些 best_challenge_wpm / high_wpm_streak / best_challenge_acc /
    // perfect_challenge_count / high_acc_challenge_streak 全部都是各自獨立、
    // 互不等待的 fire-and-forget transaction，沒有一個統一的「全部都寫完了」
    // 的時間點可以掛勾子。改用 debounce（見 achv_notify.js 的
    // ACHV_Schedule_Notify_Check 說明）：不管這幾個 transaction 各自什麼時候
    // 完成，都在這裡先排一次「1.2 秒後檢查」，重複呼叫只會延後、不會疊加，
    // 等所有寫入安定下來後才真正讀一次 Firebase 做比對，觸發「速度」「精準」
    // 兩個分類的彈窗通知。
    if(typeof ACHV_Schedule_Notify_Check === "function"){
        ACHV_Schedule_Notify_Check()
    }

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

// ===== 【新增】把「這關第一次過關」同步進雲端的難度別完成計數 =====
// 給榮譽牆「關卡完成度」成就分類用。只在「第一次通過」時呼叫（由呼叫端
// game.html 先判斷 is_first_time_clear 之後才呼叫這裡，這支函式本身不重複判斷），
// 避免玩家反覆重打同一關把數字洗高。
// 用 transaction() 而不是 set()，是為了避免多分頁同時完成時互相蓋掉
// 對方剛寫入的 +1 結果（跟 best_challenge_wpm 用 transaction 的理由一致）。
function Sync_Stage_Completion(stageId){
    if(typeof get_difficulty_by_stageid !== "function"){
        console.warn("[player_stats] 找不到 get_difficulty_by_stageid，請確認有先載入 TCTC2-0-level_data.js")
        return Promise.resolve()
    }

    const difficulty = get_difficulty_by_stageid(stageId)   // "easy" / "medium" / "hard"
    const anon_id = Get_Anon_Id()
    if(!anon_id || !difficulty) return Promise.resolve()

    const field = `stages_completed_${difficulty}`

    return tctc_db.ref(`player_stats/${anon_id}/${field}`).transaction(function(current){
        return (current || 0) + 1
    }).then(function(result){
        // 【新增】關卡完成度寫入成功後，觸發一次成就通知檢查（debounce），
        // 讓「關卡完成度」分類能在破關當下跳出彈窗，不用等玩家自己點進榮譽牆。
        // result.committed 是 Firebase transaction 的標準回傳欄位，true 代表
        // 這次真的寫入成功（不是被 Rules 擋下或客戶端中途放棄），只有這種
        // 情況才有意義觸發檢查。ACHV_Schedule_Notify_Check 定義在
        // TCTC2-0-achv_notify.js，用 typeof 保護，避免頁面忘記載入該檔案時
        // 直接噴錯、拖累原本的關卡完成寫入流程。
        if(result && result.committed && typeof ACHV_Schedule_Notify_Check === "function"){
            ACHV_Schedule_Notify_Check()
        }
        // 【新增】首次破關成功寫入後，順便發「首次破關獎勵」的 XP。
        // 只在這裡發（不在 game.html 裡另外呼叫），因為「這關是不是第一次破」
        // 這個判斷本來就已經在這支函式的呼叫端做過一次、又在這支函式的
        // transaction 裡再次確保只有真的寫入成功才算數，兩層防護疊在一起，
        // 比在 6 個呼叫端各自重複判斷、各自呼叫 Sync_XP 更不容易漏掉或算重複。
        if(result && result.committed && typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
            Sync_XP(XP_CONFIG.actions.stage_first_clear)
        }
    }).catch(function(error){
        console.warn(`[player_stats] ${field} 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：`, error.message)
    })
}

// ===== 【新增】累積打字字數（榮譽牆「累積字數」成就用）=====
// 算的是「這次打對的字數」（跟結果畫面「正確字數」同一個數字），不算錯字，
// 避免玩家亂打灌數字。呼叫時機比照 Sync_Player_Stats：只有「這次成績有
// 算進排行榜/平均值」的情況下才呼叫（主線模式看 counts_for_leaderboard，
// 挑戰模式看 cg_meets_points_threshold），跟其他統計欄位採計標準一致。
// 用 transaction() 累加。Rules 沒辦法驗證「這次加的量剛好等於玩家真的打對
// 幾個字」（那需要額外一個欄位把這次的量也公開寫出來給 Rules 讀，等於給
// 玩家看到怎麼繞過），所以退而求其次：Rules 只擋「新值必須比舊值大，且
// 單次漲幅不能超過一個合理上限（見 database.rules.json）」，防的是「一次
// 把數字改成天文數字」這種明顯作弊，擋不住「每次多打幾個字之類」的小額
// 灌水——這個成就本來就偏「累積量」而非「精準防作弊」的性質，跟 Rules
// 現有其他欄位的防護強度是一致的取捨。
function Sync_Chars_Typed(charCount){
    if(typeof charCount !== "number" || isNaN(charCount) || charCount <= 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    const rounded = Math.round(charCount)

    return tctc_db.ref(`player_stats/${anon_id}/total_chars_typed`).transaction(function(current){
        return (current || 0) + rounded
    }).then(function(result){
        // 【新增】累積字數同步成功後，觸發一次成就通知檢查（打字分類）
        if(result && result.committed && typeof ACHV_Schedule_Notify_Check === "function"){
            ACHV_Schedule_Notify_Check()
        }
        // 【新增】依「這次打對的字數」換算 XP（主線／挑戰模式都會呼叫這支函式，
        // 所以兩邊的「打字量 XP」自動統一套用同一套換算比例，不用各自另外算一次）。
        // 用 Math.floor 無條件捨去，避免「打 1 個字就進位成 1 XP」這種灌水漏洞。
        if(result && result.committed && typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
            const chars_xp = Math.floor(rounded / XP_CONFIG.actions.chars_per_xp)
            if(chars_xp > 0) Sync_XP(chars_xp)
        }
    }).catch(function(error){
        console.warn("[player_stats] total_chars_typed 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：", error.message)
    })
}

// ===== 【新增】把「榮譽牆目前解鎖的成就總數」同步進雲端 =====
// 給玩家總榜「解鎖成就數量」這個新指標用。呼叫端是 TCTC2-0-achievements.js
// 的 ACHV_Render_All()，在每次渲染榮譽牆頁面、算完總覽進度條之後呼叫一次。
//
// 【為什麼用 set() 而不是 transaction()】
// 上面 Sync_Stage_Completion() / Sync_Chars_Typed() 用 transaction()，是因為
// 它們寫入的是「這次事件要 +N」的累加值，需要先讀到目前的舊值才能算出
// 新值，多分頁同時觸發時也要避免互相蓋掉對方剛寫入的結果。
// 這裡不一樣：achievements_unlocked 是「現場重新算一次的完整結果」
// （呼叫端已經把所有分類的 unlocked 加總完了），不是「+1」這種相對量，
// 邏輯跟 avg_wpm 用 wpm_sum/wpm_count 算出平均值後直接 set() 寫入完全對稱，
// 用 transaction() 反而沒有意義（沒有「舊值」可以參照著累加）。
//
// 【信任模型限制，見 firebase.js 開頭 Rules 範例裡 achievements_unlocked
// 那一段的完整說明】這裡的 Rules 只驗證「新值不超過上限」跟「只增不減」，
// 沒辦法在伺服器端重新驗證這個數字是否真的由玩家目前的統計資料算出來，
// 屬於這個網站排行榜系統一貫的取捨，不是這個函式的疏漏。
function Sync_Achievements_Unlocked(count){
    if(typeof count !== "number" || isNaN(count) || count < 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    return tctc_db.ref(`player_stats/${anon_id}/achievements_unlocked`).set(Math.round(count))
        .catch(function(error){
            // 最常見的失敗原因會是 Rules 的「只增不減」驗證擋下來——例如玩家
            // 剛好開兩個分頁，一個分頁先同步了比較新的數字，另一個分頁比較晚
            // 算完、算出來的反而比較舊（理論上不該發生，但多分頁本來就有
            // 這種競態可能），這種情況安靜記在 console 就好，不用跳錯誤通知
            // 給玩家——反正下次造訪榮譽牆頁面就會用最新資料重算一次。
            console.warn("[player_stats] achievements_unlocked 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：", error.message)
        })
}

// ===== 【新增】把「這次挑戰模式測驗的 WPM / 正確率」另外累加進「挑戰模式專屬」的平均值 =====
// 跟上面 Sync_Player_Stats 寫的 wpm_sum / wpm_count / avg_wpm 不是同一組欄位——
// 那組是「主線 + 挑戰模式全部混在一起」的整體表現，給玩家總榜（平均WPM最高／
// 平均正確率最高）用，這是刻意設計，這裡不能動它。
// 挑戰大廳卡片顯示的「挑戰模式累計平均」，原本只靠本機 cg_wpm_sum / cg_wpm_times /
// average_challenge_wpm 這幾個 localStorage key 計算，雲端完全沒有備份，
// 導致切換身份（登入/登出/繼承）之後這組數字永遠救不回來。
// 這裡另外開一組 cg_wpm_sum / cg_wpm_count / avg_challenge_wpm（正確率同理）
// 專門存在雲端，兩邊的用途完全分開，互不影響。
// 呼叫時機：TCTC2-0-challenge.js 結算成績時，要跟 Sync_Player_Stats 一起呼叫
// （兩個都要打，一個負責玩家總榜的整體平均，一個負責挑戰模式自己的平均）。
function Sync_Challenge_Player_Stats(wpm, acc) {
    if (typeof wpm !== "number" || isNaN(wpm)) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    const base_ref = tctc_db.ref(`player_stats/${anon_id}`)
    const acc_value = (typeof acc === "number" && !isNaN(acc)) ? acc : 0

    const wpm_chain_promise = new Promise(function (resolve) {
        base_ref.child("cg_wpm_sum").transaction(function (current) {
            return (current || 0) + wpm
        }, function (error, committed, snapshot) {
            if (error) {
                console.log("[player_stats] cg_wpm_sum 同步失敗（很可能是 Firebase Rules 還沒加上 cg_wpm_sum 欄位的規則）：", error)
                resolve()
                return
            }
            if (!committed) { resolve(); return }
            const new_sum = snapshot.val()
            base_ref.child("cg_wpm_count").transaction(function (current) {
                return (current || 0) + 1
            }, function (error2, committed2, snapshot2) {
                if (error2) {
                    console.log("[player_stats] cg_wpm_count 同步失敗：", error2)
                    resolve()
                    return
                }
                if (!committed2) { resolve(); return }
                const new_count = snapshot2.val()
                base_ref.child("avg_challenge_wpm").set(Math.round((new_sum / new_count) * 10) / 10).finally(resolve)
            })
        })
    })

    const acc_chain_promise = new Promise(function (resolve) {
        base_ref.child("cg_acc_sum").transaction(function (current) {
            return (current || 0) + acc_value
        }, function (error, committed, snapshot) {
            if (error) {
                console.log("[player_stats] cg_acc_sum 同步失敗：", error)
                resolve()
                return
            }
            if (!committed) { resolve(); return }
            const new_sum = snapshot.val()
            base_ref.child("cg_acc_count").transaction(function (current) {
                return (current || 0) + 1
            }, function (error2, committed2, snapshot2) {
                if (error2) {
                    console.log("[player_stats] cg_acc_count 同步失敗：", error2)
                    resolve()
                    return
                }
                if (!committed2) { resolve(); return }
                const new_count = snapshot2.val()
                base_ref.child("avg_challenge_acc").set(Math.round((new_sum / new_count) * 10) / 10).finally(resolve)
            })
        })
    })

    return Promise.all([wpm_chain_promise, acc_chain_promise])
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
            // 【新增】積分累積成功後，觸發一次成就通知檢查（活躍度分類）
            if (committed && typeof ACHV_Schedule_Notify_Check === "function") {
                ACHV_Schedule_Notify_Check()
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

// ===== 【新增】XP／等級系統：把賺到的 XP 累加進玩家總 XP =====
// 呼叫端只需要算好「這次要加多少 XP」丟進來就好，這支函式只負責「累加」，
// 完全不管 XP 是怎麼算出來的——「每個行為給多少 XP」「升級門檻」全部
// 定義在 TCTC2-0-xp_data.js 的 XP_CONFIG，想調整數值只要改那支檔案，
// 不用動這裡（也不用動任何呼叫這支函式的地方）。
// 用 transaction() 累加，理由跟 total_points 一致：避免多分頁同時發生時
// 互相蓋掉對方剛寫入的 +N 結果。
function Sync_XP(amount){
    if(typeof amount !== "number" || isNaN(amount) || amount <= 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    return tctc_db.ref(`player_stats/${anon_id}/xp`).transaction(function(current){
        return (current || 0) + Math.round(amount)
    }).catch(function(error){
        console.warn("[player_stats] xp 同步失敗（很可能是 Firebase Rules 還沒加上 xp 欄位的規則）：", error.message)
    })
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
// 【新增】連續登入最長榜：用「歷史最長連續」排序（不是「目前連續」），
// 理由是 current_streak 每天都在變動，甚至今天沒登入就會一直卡在原地不動，
// 拿一個「會隨時間自然衰退」的數字做排行榜很奇怪；longest_streak 是玩家
// 曾經達到過的最佳紀錄，只增不減，跟 total_points（累積積分最高）同一種
// 「歷史最佳」語意，排行榜比較合理。不設達標門檻——沒有 wpm_count 那種
// 「至少測驗 N 次才準」的統計學理由，1 天也是合法的連續天數。
function Get_Top_Players_By_Streak(callback, limit) {
    _Get_Top_Players("streak_longest", null, 0, function (list) {
        callback(list.slice(0, limit || 50))
    })
}
// 【新增】累積登入天數最多榜：不看「有沒有斷過」，單純看「總共登入過幾次」，
// 邏輯跟 page_views（瀏覽次數最多榜）對稱，同樣不設門檻。
function Get_Top_Players_By_Total_Login_Days(callback, limit) {
    _Get_Top_Players("streak_total_days", null, 0, function (list) {
        callback(list.slice(0, limit || 50))
    })
}
// 【修改】解鎖成就數量最多榜：要求 achievements_unlocked >= 1，濾掉「一項成就都
// 還沒解鎖」的玩家不該佔用榜單名額——道理跟 total_points 要求 >= 1 積分一致
// （0 積分/0 項成就都代表「這個指標上其實還沒有任何實質成績」，不該上榜）。
// 用 achievements_unlocked 自己當 min_count_field，是同一個查詢欄位兼當門檻欄位，
// 跟 Get_Top_Players_By_Points("total_points", "total_points", 1, ...) 的寫法完全對稱。
// 排序用的 achievements_unlocked 欄位由 TCTC2-0-achievements.js 頁面
// 造訪時同步寫入，見 Sync_Achievements_Unlocked() 上方的完整說明。
function Get_Top_Players_By_Achievements_Unlocked(callback, limit) {
    _Get_Top_Players("achievements_unlocked", "achievements_unlocked", 1, function (list) {
        callback(list.slice(0, limit || 50))
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
            // 跟 _Get_Leaderboard 一樣，Firebase 排序後還要自己再排一次確保順序正確：
            // 先比 wpm，wpm 相同時再比 acc，維持跟排行榜列表完全一致的排序依據。
            list.sort(function (a, b) {
                if (b.wpm !== a.wpm) return b.wpm - a.wpm
                return (b.acc || 0) - (a.acc || 0)
            })

            const own_index = list.findIndex(function (entry) { return entry._anon_id === anon_id })
            if (own_index === -1) {
                callback(null)
                return
            }

            // 【新增】套用跟 ranking.js 的 Compute_Competition_Ranks 一樣的「標準競賽排名」規則：
            // wpm 和 acc 都跟前一名相同才算同分、同名次，並列的名次要「佔掉」後面的位置（1224 制）。
            // 從自己這筆往前找，只要還是同分就一直把名次往前推，直到遇到分數不同的那一筆為止。
            let rank = own_index + 1
            let i = own_index
            while (i > 0 && list[i].wpm === list[i - 1].wpm && list[i].acc === list[i - 1].acc) {
                rank--
                i--
            }

            callback({
                rank: rank,
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
   【新增】個人資料頁公開設定
   ------------------------------------------------------------
   單一 boolean 欄位：player_stats/{anon_id}/hide_profile_view
   - 這跟上面的 hide_from_leaderboard 是兩件獨立的事：那個開關只影響
     「排行榜上看不看得到這個人」；這個開關只影響「別人能不能點進
     這個人的個人資料頁（TCTC2-0-view_profile.html）看到成就/統計」。
     玩家可以只關掉其中一個，兩者互不影響。
   - 欄位不存在，或值是 false：允許別人查看（預設狀態，也就是這個玩家
     從來沒關過這個開關）
   - 欄位值是 true：TCTC2-0-view_profile.html 一律顯示「這位玩家沒有
     公開個人資料」，不會回傳任何統計數字或成就資料給查看者
   ============================================================ */

// 讀取「自己目前」的開關狀態，給 profile.html 初始化 checkbox 用（跟
// Get_Own_Leaderboard_Visibility 同一種寫法，profile.js 實際上一樣是
// 直接沿用 Get_Own_Player_Stats() 讀回來的欄位，不會另外呼叫這個函式，
// 留著是給以後其他頁面需要單獨檢查這個開關時使用）
function Get_Own_Profile_Visibility(callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/hide_profile_view`)
        .once("value")
        .then(function (snapshot) {
            callback(snapshot.val() === true)
        })
        .catch(function (error) {
            console.log("[profile] 讀取個人資料公開設定失敗：", error)
            callback(null) // null 代表「真的讀取失敗」，要跟「目前設定為公開」明確區分開來
        })
}

// 更新「自己」的開關狀態，立即生效（跟 Set_Own_Leaderboard_Visibility 同一套邏輯）
function Set_Own_Profile_Visibility(hide, callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/hide_profile_view`).set(!!hide)
        .then(function () {
            if (callback) callback(true)
        })
        .catch(function (error) {
            console.log("[profile] 更新個人資料公開設定失敗（很可能是 Firebase Rules 還沒加上 hide_profile_view 欄位的規則）：", error)
            if (callback) callback(false)
        })
}

// ===== 【新增】把「個人簡介」同步上雲端 =====
// 原本 intro 只存在 localStorage、從來沒同步過雲端——別人的瀏覽器
// 根本讀不到，個人資料頁若要顯示簡介，一定要有這一份雲端拷貝。
// 跟 name 的同步邏輯一樣直接用 .set()，不用 transaction：這欄位不是
// 累加值，而是「玩家這次輸入的最終內容」，後寫的直接蓋掉前一筆即可。
// 由 TCTC2-0-profile.js 的 Update_profile() 在改名字成功之後呼叫。
function Set_Own_Intro(intro_text, callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/intro`).set(intro_text || "")
        .then(function () {
            if (callback) callback(true)
        })
        .catch(function (error) {
            console.log("[profile] 個人簡介同步失敗（很可能是 Firebase Rules 還沒加上 intro 欄位的規則）：", error)
            if (callback) callback(false)
        })
}

/* ============================================================
   【新增】讀取「別人」的公開個人資料頁資料
   ------------------------------------------------------------
   給 TCTC2-0-view_profile.html 用，跟 Get_Own_Player_Stats 不一樣的地方：
   - 這裡讀的是「別人」的 anon_id，不是自己的，所以不需要（也不應該）
     先等 Wait_For_Online_Time_Sync / Wait_For_Page_Views_Sync——那兩個
     只是在等「這台瀏覽器自己」的本機暫存同步完成，跟正在查看的目標
     玩家完全無關，等了也沒有意義。
   - 會先檢查目標玩家的 hide_profile_view 開關，關閉的話直接回傳
     { hidden: true }，呼叫端要用這個旗標顯示「未公開」畫面，
     不能把讀到的其他欄位顯示出來。
   ------------------------------------------------------------
   callback 收到的值：
   - null：讀取失敗（離線、Rules 問題），呼叫端應顯示「讀取失敗」
   - { exists: false }：這個 anon_id 在雲端完全沒有任何資料
   - { hidden: true, exists: true }：這個玩家關閉了個人資料公開設定
   - { hidden: false, exists: true, ...其餘 player_stats 欄位 }：
     正常可以顯示的資料（name / intro / avg_wpm / avg_acc /
     online_seconds / total_points / page_views / streak_xxx /
     stages_completed_xxx / best_challenge_wpm 等等，哪些欄位存在，
     取決於這個玩家之前實際觸發過哪些同步）
   ============================================================ */
function Get_Public_Player_Profile(anon_id, callback) {
    if (!anon_id) {
        callback({ exists: false })
        return
    }

    tctc_db.ref(`player_stats/${anon_id}`)
        .once("value")
        .then(function (snapshot) {
            const val = snapshot.val()
            if (!val) {
                callback({ exists: false })
                return
            }
            if (val.hide_profile_view === true) {
                callback({ hidden: true, exists: true })
                return
            }

            val.hidden = false
            val.exists = true
            callback(val)
        })
        .catch(function (error) {
            console.log("[profile] 讀取玩家公開資料失敗：", error)
            callback(null)
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
    // 【新增】streak_* 4 個欄位一併清空——玩家主動刪除所有資料時，連續登入
    // 紀錄也要跟著歸零重來，不然會出現「資料都刪了，但 streak 卻莫名其妙
    // 保留著」的不一致狀態。設成 null 是「刪除」不是「寫入」，Firebase Rules
    // 的 .validate 只在寫入非 null 值時才會被檢查，刪除操作不受那些時間差
    // 驗證邏輯限制，能正常清空。
    ;[
        "name", "wpm_sum", "wpm_count", "avg_wpm",
        "acc_sum", "acc_count", "avg_acc",
        "cg_wpm_sum", "cg_wpm_count", "avg_challenge_wpm",
        "cg_acc_sum", "cg_acc_count", "avg_challenge_acc",
        "online_seconds", "total_points", "hide_from_leaderboard",
        "streak_current", "streak_longest", "streak_last_ts", "streak_total_days",
        // 【新增】「斷簽後回歸」徽章用的單一欄位，理由跟其他 streak_* 欄位一樣：
        // 玩家主動刪除所有資料時要一起歸零
        "longest_gap_days",
        // 【新增】個人資料頁公開設定 + 雲端簡介，同樣屬於「這個玩家的個人資料」，
        // 刪除所有資料時要一併清空，不然換一台裝置/新身份的人會意外繼承到舊簡介
        "hide_profile_view", "intro"
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

/* ============================================================
   【新增】帳號系統（Email/密碼 + Google 登入 / 註冊）
   ============================================================
   跟全站原本的資料架構有一個很重要的前提差異，先講清楚：

   全站幾乎所有讀寫（player_stats、leaderboard、challenge_leaderboard、
   usernames……）都是用 Get_Anon_Id() 這個「自己土法煉鋼存在 localStorage
   的隨機 UUID」當 key，跟上面 firebase.auth().signInAnonymously() 拿到的
   匿名登入 uid【完全是兩條獨立的線】——匿名登入的 uid 目前只拿來讓
   Rules 檢查「這次寫入是不是從一個有效登入送出來的」，從來沒被拿去當過
   任何資料的 key。

   這代表：如果單純呼叫 linkWithCredential 把匿名身份升級成帳號，
   uid 雖然會保留、變成「正式帳號」，但 player_stats／leaderboard 這些
   資料完全不會自動被帶過去——因為它們的 key 是 tctc_anon_id
   （存在 localStorage），不是 auth 的 uid，linkWithCredential 只會動到
   auth 那條線，不會動到 localStorage 裡的值。

   所以這裡採用的解法，是額外加一層「帳號 → anon_id」對照表
   （accounts/{uid}: { anon_id, email, provider, created_at }），
   而不是把全站幾十個地方全部改成用 uid 當 key：
   - 註冊「要繼承」：不換 tctc_anon_id（沿用現有這組），linkWithCredential
     只負責把 auth 升級成正式帳號，然後把「這組 uid 對應到現有這個 anon_id」
     寫進 accounts 對照表
   - 註冊「不要繼承」：本機直接換一組全新的 anon_id，新 uid 對照到這組新
     anon_id，舊資料變孤兒留在雲端（不刪除，但沒人能再選到）
   - 登入既有帳號：認證拿到 uid → 查 accounts/{uid}/anon_id
     → 把 localStorage 的 tctc_anon_id 覆蓋成那組值 → 全站原本的讀寫函式
     完全不用改，因為它們本來就是每次現讀 localStorage
   ============================================================ */

// ===== 本機 localStorage 的帳號相關 key，統一定義在這裡，其他檔案（auth_ui.js／profile.js）
// 直接呼叫下面的 Get_/Set_ 函式操作，不要自己在別的地方硬寫字串 key，避免打錯字 =====
const AUTH_ACCOUNT_UID_KEY = "tctc2.0-account_uid"       // 目前登入中的帳號 uid，沒登入就不存在這個 key
const AUTH_ACCOUNT_DISPLAY_KEY = "tctc2.0-account_display" // 顯示在 nav 上的帳號名稱（email 或 Google 顯示名稱）
const AUTH_GUEST_BACKUP_KEY = "tctc2.0-guest_backup_anon_id" // 登入帳號「之前」，這台裝置原本的訪客 anon_id 備份

function Get_Current_Account_Uid() {
    return localStorage.getItem(AUTH_ACCOUNT_UID_KEY)
}
function Get_Current_Account_Display() {
    return localStorage.getItem(AUTH_ACCOUNT_DISPLAY_KEY)
}

// 產生一組全新的訪客 anon_id（跟 Get_Anon_Id() 內部產生新 id 的邏輯完全一致，
// 獨立拉出來是因為「不繼承」「登出且沒有備份」這兩種情況都需要各自生一組新的，
// 不想在兩個地方各寫一次一樣的 crypto.randomUUID() fallback 邏輯）
function _Generate_New_Anon_Id() {
    return crypto.randomUUID ? crypto.randomUUID() : ("anon-" + Date.now() + "-" + Math.random().toString(16).slice(2))
}

/* ------------------------------------------------------------
   切換「這台裝置現在代表誰」的核心函式
   ------------------------------------------------------------
   把 localStorage 的 tctc_anon_id 換成 new_anon_id，並且：
   1. 清掉 tctc_guest_number 快取——這個快取是「數字」，沒有標明是哪個
      anon_id 的，身份一換，舊快取跟新身份對不上，留著會顯示錯的訪客編號，
      清掉之後下次呼叫 Get_Guest_Number() 會自動用新 anon_id 重新跟雲端要。
   2. 把 localStorage 的 username 同步成「新身份」在雲端已經設定過的名字
      （讀 player_stats/{new_anon_id}/name）；如果新身份還沒設定過名字，
      就把本機這欄清空，不然畫面會顯示成「舊身份的名字」，資料對不起來。

   呼叫端（Login/Register/Logout 相關函式）都要透過這支函式做切換，
   不要自己徒手 setItem("tctc_anon_id", ...)，不然上面兩個快取清理很容易漏掉。
   ------------------------------------------------------------ */
// 這些 key 都是「跟身份綁定、理論上該跟著身份走」的本機統計，但原本各自
// 用固定字串存在 localStorage，不分訪客/帳號，導致切換身份（登入/繼承/登出）
// 之後，畫面還是顯示「上一個身份」殘留的數字。切換身份時全部清掉，
// 讓新身份從乾淨狀態開始（雲端排行榜資料不受影響，只是本機快取被清空，
// 之後重打就會依新身份重新累積）。
const IDENTITY_BOUND_LOCAL_KEYS = [
    "average_wpm", "average_acc", "wpm_sum", "wpm_times", "acc_sum", "acc_times",
    "average_challenge_wpm", "average_challenge_acc", "cg_wpm_sum", "cg_wpm_times", "cg_acc_sum", "cg_acc_times",
    "tctc2.0-challenge_total_points",
    "tctc2.0-challenge_history", "tctc2.0-profile_avatar", "stage_progress", "intro"
]

function Switch_Active_Identity(new_anon_id, callback) {
    // 【修正 1】只有「真的換成另一組 anon_id」時，才清空這些跟身份綁定的本機快取。
    // 「繼承」註冊路徑（Register_With_Email_Inherit / Register_With_Google_Inherit）
    // 傳進來的 new_anon_id 就是目前這組 anon_id 本人（uid 換了，但 anon_id 沒換），
    // 這種情況下本機快取本來就是對的，不需要清空重來——尤其
    // tctc2.0-challenge_history / tctc2.0-profile_avatar / stage_progress / intro
    // 這些欄位雲端根本沒有備份，一旦清空就真的救不回來了。
    const anon_id_unchanged = (Get_Anon_Id() === new_anon_id)

    localStorage.setItem("tctc_anon_id", new_anon_id)
    localStorage.removeItem("tctc_guest_number")

    if (!anon_id_unchanged) {
        IDENTITY_BOUND_LOCAL_KEYS.forEach(function (key) { localStorage.removeItem(key) })
    }

    // 【修正 2】原本這裡只抓 player_stats/{new_anon_id}/name 一個欄位，
    // 清空快取之後卻只補回暱稱，average_wpm / average_acc / 挑戰積分這些欄位
    // 永遠停在「清空後的空值」，直到玩家再打一關才會被覆蓋——而且那一關算出來的
    // 「平均值」是從本機被清空的 wpm_sum/wpm_times 重新起算，並不是這個身份
    // 真正的累積平均，等於用一次的成績覆蓋掉一直以來的紀錄。
    // 改成抓整個 player_stats/{new_anon_id} 節點，把雲端「這個身份真正的累積數字」
    // 完整地補回本機快取（wpm_sum / wpm_count / avg_wpm、acc_sum / acc_count / avg_acc、
    // total_points），不管是登入別人帳號、登出換訪客，還是繼承註冊，
    // 畫面顯示的都會是雲端當下真實的數字，不會再出現「歸零/消失」的狀況。
    // （tctc2.0-challenge_history、profile_avatar 等雲端沒有備份的欄位，
    // 在真的换成別的身份時仍然無法復原，這是資料本來就只存在本機的既有限制。）
    tctc_db.ref(`player_stats/${new_anon_id}`).once("value").then(function (snapshot) {
        const cloud_stats = snapshot.val() || {}

        if (cloud_stats.name) {
            localStorage.setItem("username", cloud_stats.name)
        } else {
            localStorage.removeItem("username")
        }

        if (typeof cloud_stats.wpm_sum === "number") localStorage.setItem("wpm_sum", cloud_stats.wpm_sum)
        if (typeof cloud_stats.wpm_count === "number") localStorage.setItem("wpm_times", cloud_stats.wpm_count)
        if (typeof cloud_stats.avg_wpm === "number") localStorage.setItem("average_wpm", Math.round(cloud_stats.avg_wpm))

        if (typeof cloud_stats.acc_sum === "number") localStorage.setItem("acc_sum", cloud_stats.acc_sum)
        if (typeof cloud_stats.acc_count === "number") localStorage.setItem("acc_times", cloud_stats.acc_count)
        if (typeof cloud_stats.avg_acc === "number") localStorage.setItem("average_acc", Math.round(cloud_stats.avg_acc))

        // 【新增】挑戰模式專屬的平均值，對應 Sync_Challenge_Player_Stats() 寫的那組獨立欄位
        if (typeof cloud_stats.cg_wpm_sum === "number") localStorage.setItem("cg_wpm_sum", cloud_stats.cg_wpm_sum)
        if (typeof cloud_stats.cg_wpm_count === "number") localStorage.setItem("cg_wpm_times", cloud_stats.cg_wpm_count)
        if (typeof cloud_stats.avg_challenge_wpm === "number") localStorage.setItem("average_challenge_wpm", Math.round(cloud_stats.avg_challenge_wpm))

        if (typeof cloud_stats.cg_acc_sum === "number") localStorage.setItem("cg_acc_sum", cloud_stats.cg_acc_sum)
        if (typeof cloud_stats.cg_acc_count === "number") localStorage.setItem("cg_acc_times", cloud_stats.cg_acc_count)
        if (typeof cloud_stats.avg_challenge_acc === "number") localStorage.setItem("average_challenge_acc", Math.round(cloud_stats.avg_challenge_acc))

        if (typeof cloud_stats.total_points === "number") localStorage.setItem("tctc2.0-challenge_total_points", cloud_stats.total_points)

        if (callback) callback()
    }).catch(function (error) {
        console.log("[auth] 切換身份後讀取雲端資料失敗：", error)
        localStorage.removeItem("username")
        if (callback) callback()
    })
}

/* ------------------------------------------------------------
   把 Firebase Auth 回傳的錯誤代碼翻譯成中文訊息
   ------------------------------------------------------------
   完整代碼表請參考官方文件：
   https://firebase.google.com/docs/reference/js/auth#autherrorcodes
   這裡只列出這個網站實際會碰到的常見狀況，沒列到的一律退回顯示
   error.message（英文原文，至少比完全沒訊息好）。
   ------------------------------------------------------------ */
function _Translate_Auth_Error(error) {
    const code = error && error.code
    const MESSAGE_MAP = {
        "auth/email-already-in-use": "這個 Email 已經被註冊過了，直接登入看看？",
        "auth/invalid-email": "Email 格式不正確",
        "auth/weak-password": "密碼強度不夠，至少需要 6 個字元",
        "auth/wrong-password": "密碼錯誤",
        "auth/user-not-found": "找不到這個帳號",
        "auth/invalid-credential": "帳號或密碼錯誤",
        "auth/popup-closed-by-user": "登入視窗被關閉了，請再試一次",
        "auth/popup-blocked": "瀏覽器擋下了登入彈窗，請允許彈出視窗後再試一次",
        "auth/credential-already-in-use": "這個 Google 帳號已經被其他帳號綁定過了",
        "auth/network-request-failed": "網路連線發生問題，請檢查網路後再試一次",
        "auth/too-many-requests": "嘗試次數過多，請稍後再試"
    }
    return (code && MESSAGE_MAP[code]) || (error && error.message) || "發生未知錯誤，請稍後再試"
}

/* ------------------------------------------------------------
   註冊/登入彈窗要顯示的「訪客資料繼承預覽」
   ------------------------------------------------------------
   回傳目前這個 anon_id 在 player_stats 裡的原始資料（局數、平均 WPM……），
   給彈窗組出「要不要繼承」的比較文字用。

   Should_Prompt_Guest_Inherit(stats)：判斷「這包資料值不值得問一次」——
   局數（wpm_count）、正確率局數（acc_count）、挑戰積分、在線秒數
   只要有任何一項大於 0，就代表這台裝置有實際玩過，才需要跳出詢問；
   全部都是 0 或整包是空物件，代表這是全新訪客，直接跳過詢問即可
   （不管選哪個結果都一樣是空的，問了也沒意義）。
   ------------------------------------------------------------ */
function Get_Guest_Inherit_Preview(callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}`).once("value").then(function (snapshot) {
        callback(snapshot.val() || {})
    }).catch(function (error) {
        console.log("[auth] 讀取訪客資料預覽失敗：", error)
        callback(null) // null 代表讀取失敗（不是「沒有資料」），呼叫端要分開處理
    })
}
function Should_Prompt_Guest_Inherit(stats) {
    if (!stats) return false
    return !!(
        (stats.wpm_count && stats.wpm_count > 0) ||
        (stats.acc_count && stats.acc_count > 0) ||
        (stats.total_points && stats.total_points > 0) ||
        (stats.online_seconds && stats.online_seconds > 0)
    )
}

/* ------------------------------------------------------------
   註冊 —— 「要繼承」路徑
   ------------------------------------------------------------
   用 linkWithCredential／linkWithPopup 把目前的匿名登入升級成正式帳號，
   uid 不變，本機 tctc_anon_id 也【不用換】——這正是「繼承」能夠成立的關鍵：
   所有雲端資料本來就是用這組 anon_id 存的，完全不用搬移，只要把
   「這個新帳號的 uid，對應到這組 anon_id」寫進 accounts 對照表即可。
   ------------------------------------------------------------ */
function Register_With_Email_Inherit(email, password, callback) {
    const user = firebase.auth().currentUser
    if (!user) {
        callback(false, "匿名登入尚未完成，請重新整理頁面再試一次")
        return
    }
    const credential = firebase.auth.EmailAuthProvider.credential(email, password)
    user.linkWithCredential(credential).then(function (result) {
        _Finish_Account_Write(result.user, "email", Get_Anon_Id(), callback)
    }).catch(function (error) {
        callback(false, _Translate_Auth_Error(error))
    })
}
function Register_With_Google_Inherit(callback) {
    const user = firebase.auth().currentUser
    if (!user) {
        callback(false, "匿名登入尚未完成，請重新整理頁面再試一次")
        return
    }
    user.linkWithPopup(new firebase.auth.GoogleAuthProvider()).then(function (result) {
        _Finish_Account_Write(result.user, "google", Get_Anon_Id(), callback)
    }).catch(function (error) {
        callback(false, _Translate_Auth_Error(error))
    })
}

/* ------------------------------------------------------------
   註冊 —— 「不要繼承」路徑
   ------------------------------------------------------------
   直接用 createUserWithEmailAndPassword／signInWithPopup（不 link），
   這兩個方法本身就會把「目前登入中的使用者」換成全新帳號，原本的匿名
   auth session 不會被刪除、只是不再是目前登入者（變成一筆孤兒的匿名
   使用者留在 Firebase Auth 後台，不影響任何功能，也不用特別去清）。

   本機 tctc_anon_id 換成全新一組，舊的那組（連同底下所有 player_stats／
   leaderboard 資料）就此變成孤兒資料留在雲端，不會被刪除，但也沒有任何
   本機記錄能再指回它。
   ------------------------------------------------------------ */
function Register_With_Email_Fresh(email, password, callback) {
    firebase.auth().createUserWithEmailAndPassword(email, password).then(function (result) {
        _Finish_Account_Write(result.user, "email", _Generate_New_Anon_Id(), callback)
    }).catch(function (error) {
        callback(false, _Translate_Auth_Error(error))
    })
}
function Register_With_Google_Fresh(callback) {
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(function (result) {
        _Finish_Account_Write(result.user, "google", _Generate_New_Anon_Id(), callback)
    }).catch(function (error) {
        callback(false, _Translate_Auth_Error(error))
    })
}

// 兩條註冊路徑（繼承／不繼承）最後都會走到這裡：
// 1. 把本機 anon_id 換成 final_anon_id（繼承路徑傳進來的就是目前這組，等於沒換）
// 2. 寫入 accounts/{uid} 對照表
// 3. Email 註冊的話寄一封驗證信（不會擋住註冊流程本身——寄信失敗只印 console，
//    不影響 callback(true)，避免因為信箱服務商偶發問題卡住整個註冊）
function _Finish_Account_Write(user, provider, final_anon_id, callback) {
    Switch_Active_Identity(final_anon_id, function () {
        tctc_db.ref(`accounts/${user.uid}`).set({
            anon_id: final_anon_id,
            email: user.email || null,
            provider: provider,
            created_at: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
            localStorage.setItem(AUTH_ACCOUNT_UID_KEY, user.uid)
            localStorage.setItem(AUTH_ACCOUNT_DISPLAY_KEY, user.displayName || user.email || "已登入玩家")

            if (provider === "email" && user.emailVerified === false && typeof user.sendEmailVerification === "function") {
                user.sendEmailVerification().catch(function (error) {
                    console.log("[auth] 驗證信寄送失敗：", error)
                })
            }
            callback(true)
        }).catch(function (error) {
            console.log("[auth] 寫入帳號對照表失敗：", error)
            callback(false, "註冊時發生錯誤，請稍後再試一次")
        })
    })
}

/* ------------------------------------------------------------
   登入既有帳號（Email/密碼 或 Google）
   ------------------------------------------------------------
   跟註冊不同，登入「不會」問要不要繼承——直接把這台裝置切換成該帳號
   的雲端資料。如果這台裝置切換前本來就處於訪客模式（還沒登入過任何帳號）
   且有自己的訪客進度，會先把那組 anon_id 存進 AUTH_GUEST_BACKUP_KEY 備份，
   不會被覆蓋消失，之後登出時會自動換回來（見下面 Logout_Account）。
   ------------------------------------------------------------ */
function Login_With_Email(email, password, callback) {
    firebase.auth().signInWithEmailAndPassword(email, password).then(function (result) {
        _Finish_Login(result.user, callback)
    }).catch(function (error) {
        callback(false, _Translate_Auth_Error(error))
    })
}
function Login_With_Google(callback) {
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(function (result) {
        _Finish_Login(result.user, callback)
    }).catch(function (error) {
        callback(false, _Translate_Auth_Error(error))
    })
}
function _Finish_Login(user, callback) {
    tctc_db.ref(`accounts/${user.uid}/anon_id`).once("value").then(function (snapshot) {
        const account_anon_id = snapshot.val()
        if (!account_anon_id) {
            // 理論上不該發生——每個帳號一定是透過上面的註冊流程建立，
            // 一定會有這筆對照。保險起見還是給明確錯誤訊息，而不是讓後面整段爆掉。
            callback(false, "找不到這個帳號對應的資料，請聯絡我們回報這個問題")
            return
        }

        // 這台裝置「登入前」如果還不是已登入狀態，代表目前用的 anon_id 是某個訪客的，
        // 先備份起來，登出後才找得回來
        if (!Get_Current_Account_Uid()) {
            localStorage.setItem(AUTH_GUEST_BACKUP_KEY, Get_Anon_Id())
        }

        Switch_Active_Identity(account_anon_id, function () {
            localStorage.setItem(AUTH_ACCOUNT_UID_KEY, user.uid)
            localStorage.setItem(AUTH_ACCOUNT_DISPLAY_KEY, user.displayName || user.email || "已登入玩家")
            callback(true)
        })
    }).catch(function (error) {
        console.log("[auth] 讀取帳號對照表失敗：", error)
        callback(false, "登入時發生錯誤，請稍後再試一次")
    })
}

/* ------------------------------------------------------------
   登出（一般登出，從 nav 按的那個）
   ------------------------------------------------------------
   - 這台裝置登入前有備份訪客資料（AUTH_GUEST_BACKUP_KEY 存在）：
     換回那組 anon_id，訪客進度原封不動「復活」
   - 沒有備份（例如這台裝置一開始就直接登入，從沒當過訪客）：
     配一組全新的 anon_id，變成一個全新訪客
   - 不管哪一種，登出後都要重新呼叫 signInAnonymously()，
     讓 firebase.auth().currentUser 恢復成「有登入」的匿名狀態，
     不然任何要求 auth != null 的 Rules 寫入會全部被擋下來
   ------------------------------------------------------------ */
function Logout_Account(callback) {
    firebase.auth().signOut().then(function () {
        localStorage.removeItem(AUTH_ACCOUNT_UID_KEY)
        localStorage.removeItem(AUTH_ACCOUNT_DISPLAY_KEY)

        const backup_anon_id = localStorage.getItem(AUTH_GUEST_BACKUP_KEY)
        const restore_to_anon_id = backup_anon_id || _Generate_New_Anon_Id()
        if (backup_anon_id) localStorage.removeItem(AUTH_GUEST_BACKUP_KEY)

        Switch_Active_Identity(restore_to_anon_id, function () {
            if (typeof firebase.auth === "function") {
                firebase.auth().signInAnonymously().catch(function (error) {
                    console.log("[auth] 登出後重新匿名登入失敗：", error)
                })
            }
            if (callback) callback(true)
        })
    }).catch(function (error) {
        console.log("[auth] 登出失敗：", error)
        if (callback) callback(false)
    })
}

/* ------------------------------------------------------------
   【新增】登出並清除這台裝置的訪客紀錄（給共用電腦用）
   ------------------------------------------------------------
   跟上面一般的 Logout_Account 差在：不管這台裝置有沒有備份的訪客資料，
   一律【丟棄】那筆備份、配一組全新的 anon_id，不會「復活」成登入前的
   訪客進度。雲端那份舊訪客資料本身不會被刪除（跟 Delete_All_Player_Data
   是兩回事），只是這台裝置不會再有任何本機記錄指向它。
   ------------------------------------------------------------ */
function Logout_And_Clear_Guest_Backup(callback) {
    firebase.auth().signOut().then(function () {
        localStorage.removeItem(AUTH_ACCOUNT_UID_KEY)
        localStorage.removeItem(AUTH_ACCOUNT_DISPLAY_KEY)
        localStorage.removeItem(AUTH_GUEST_BACKUP_KEY) // 刻意丟棄，不 restore

        Switch_Active_Identity(_Generate_New_Anon_Id(), function () {
            if (typeof firebase.auth === "function") {
                firebase.auth().signInAnonymously().catch(function (error) {
                    console.log("[auth] 登出後重新匿名登入失敗：", error)
                })
            }
            if (callback) callback(true)
        })
    }).catch(function (error) {
        console.log("[auth] 登出失敗：", error)
        if (callback) callback(false)
    })
}

// ===== 【新增】既有玩家的關卡完成度「一次性回填」=====
// 這功能上線前，玩家可能本機已經累積一堆 stage_progress[stageId] = true，
// 但 Firebase 端的 stages_completed_easy/medium/hard 全部從 0 開始。
// 如果不做這段回填，那些「早就完成」的關卡會因為 Sync_Stage_Completion()
// 只在「第一次通過」才呼叫，永遠不會被同步，成就會被錯誤地卡在低分。

function TCTC_Migrate_Existing_Stage_Progress(){
    // 換成 v2：v1 這把旗標曾經對一批「回填被舊版 Rules 拒絕、但程式碼誤判
    // 成功」的玩家寫下錯誤的 "1"，讓他們的瀏覽器永遠跳過回填。換一把新
    // key，讓所有人在這次修正部署後都會自動重跑一次，不用手動清 localStorage。
    const MIGRATION_FLAG_KEY = "tctc_stage_migration_v2_done"
    // 本機旗標純粹是省一次不必要的 Firebase 讀寫，不是防作弊的關鍵，
    // 真正擋住重複洗數字的防線是上面 Rules 的 "!data.exists()" 判斷
    if(localStorage.getItem(MIGRATION_FLAG_KEY) === "1") return
    if(typeof get_difficulty_by_stageid !== "function") return   // 這頁沒載入 level_data.js，之後造訪有載入的頁面再補跑

    const progress = JSON.parse(localStorage.getItem("stage_progress")) || {}
    const counts = { easy: 0, medium: 0, hard: 0 }

    Object.keys(progress).forEach(function(stageId){
        if(progress[stageId] !== true) return
        const difficulty = get_difficulty_by_stageid(stageId)
        if(difficulty && counts.hasOwnProperty(difficulty)) counts[difficulty] += 1
    })

    const anon_id = Get_Anon_Id()
    if(!anon_id) return

    // 只有全部寫入真的成功才標記完成；任何一筆失敗，旗標就不設，
    // 下次造訪任何有載入這支檔案的頁面時會自動再試一次
    let allSucceeded = true

    const writes = ["easy", "medium", "hard"].map(function(difficulty){
        if(counts[difficulty] === 0) return Promise.resolve()   // 沒有東西要回填，省一次寫入
        return tctc_db.ref(`player_stats/${anon_id}/stages_completed_${difficulty}`).transaction(function(current){
            // 回傳 undefined = 中止交易，不送出任何寫入，不會被 Rules 驗證卡住；
            // 不能回傳 current（跟原值一樣），那樣還是會真的送一次寫入給 Rules 驗證，
            // 已存在的值的 Rules 規定只能寫「原值+1」，寫「跟原值相同」會被判定不合法
            if(current !== null) return undefined
            return counts[difficulty]
        }).catch(function(error){
            console.warn(`[player_stats] stages_completed_${difficulty} 回填失敗：`, error.message)
            allSucceeded = false
        })
    })

    Promise.all(writes).then(function(){
        if(allSucceeded){
            localStorage.setItem(MIGRATION_FLAG_KEY, "1")
        }
    })
}

document.addEventListener("DOMContentLoaded", function(){
    TCTC_Migrate_Existing_Stage_Progress()
})