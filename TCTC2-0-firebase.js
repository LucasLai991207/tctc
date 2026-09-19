const firebaseConfig = {
    apiKey: "AIzaSyCoizdcDbOjUjsx1UNjbEzm2Px2YP7-S1Q",
    authDomain: "tctc-official.firebaseapp.com",
    databaseURL: "https://tctc-official-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tctc-official",
    storageBucket: "tctc-official.firebasestorage.app",
    messagingSenderId: "1098169583658",
    appId: "1:1098169583658:web:dfdeae095ccefecc459b53"
}

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig)
}
const tctc_db = firebase.database()

let _tctc_current_auth_user = null
let _tctc_auth_ready_waiters = []

function _Tctc_Notify_Auth_Waiters(user) {
    _tctc_current_auth_user = user
    if (_tctc_auth_ready_waiters.length === 0) return
    const waiters = _tctc_auth_ready_waiters
    _tctc_auth_ready_waiters = []
    waiters.forEach(function (fn) { fn(user) })
}

let _tctc_anon_signin_retry_count = 0
function _Tctc_Try_Anonymous_Signin() {
    firebase.auth().signInAnonymously().then(function () {
        _tctc_anon_signin_retry_count = 0
    }).catch(function (error) {

        console.log("[auth] 匿名登入失敗，錯誤代碼：", error && error.code, "訊息：", error && error.message)

        const is_environment_error = error && (
            error.code === "auth/unauthorized-domain" ||
            error.code === "auth/operation-not-supported-in-this-environment"
        )
        if (is_environment_error) {
            console.log("[auth] 這是本機測試環境設定問題，不是網路問題，重試也不會好——請確認是用 http://localhost:port 開啟，且該網域已加進 Firebase Console 的 Authorized domains")
            return
        }

        _tctc_anon_signin_retry_count++
        if (_tctc_anon_signin_retry_count > 5) {
            console.log("[auth] 匿名登入已重試多次仍失敗，暫停自動重試")
            return
        }

        const delay_ms = Math.min(1000 * Math.pow(2, _tctc_anon_signin_retry_count - 1), 16000)
        setTimeout(_Tctc_Try_Anonymous_Signin, delay_ms)
    })
}

if (typeof firebase.auth === "function") {
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            _Tctc_Notify_Auth_Waiters(user)
            return
        }

        _tctc_current_auth_user = null
        _Tctc_Try_Anonymous_Signin()
    })
} else {
    console.log("[auth] 尚未載入 firebase-auth-compat.js，這個頁面沒辦法匿名登入")
}

function Wait_For_Auth_Ready(callback, timeout_ms) {

    if (_tctc_current_auth_user) {
        callback(_tctc_current_auth_user)
        return
    }

    if (typeof firebase.auth === "function" && firebase.auth().currentUser) {
        callback(firebase.auth().currentUser)
        return
    }

    let already_finished = false
    function finish(user) {
        if (already_finished) return
        already_finished = true
        callback(user)
    }

    _tctc_auth_ready_waiters.push(finish)

    setTimeout(function () {
        if (already_finished) return
        const idx = _tctc_auth_ready_waiters.indexOf(finish)
        if (idx !== -1) _tctc_auth_ready_waiters.splice(idx, 1)
        finish(null)
    }, timeout_ms || 8000)
}

function Get_Anon_Id() {
    let anon_id = localStorage.getItem("tctc_anon_id")
    if (!anon_id) {
        anon_id = (crypto.randomUUID ? crypto.randomUUID() : ("anon-" + Date.now() + "-" + Math.random().toString(16).slice(2)))
        localStorage.setItem("tctc_anon_id", anon_id)
    }
    return anon_id
}

function _Hash_Anon_Id_To_Public_Id(anon_id) {
    function _hash32(str, seed) {
        let h1 = 0xdeadbeef ^ seed
        let h2 = 0x41c6ce57 ^ seed
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i)
            h1 = Math.imul(h1 ^ ch, 2654435761)
            h2 = Math.imul(h2 ^ ch, 1597334677)
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
        return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")
    }

    return _hash32(anon_id, 0x9e3779b9) + _hash32(anon_id, 0x85ebca6b)
}

function Get_Public_Id() {
    return _Hash_Anon_Id_To_Public_Id(Get_Anon_Id())
}

function Get_Guest_Number(callback) {
    const anon_id = Get_Anon_Id()

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

        tctc_db.ref("guest_counter").transaction(function (current) {
            return (current || 0) + 1
        }, function (error, committed, snap) {
            if (error || !committed) {
                console.log("[leaderboard] 分配訪客編號失敗：", error)
                callback(null)
                return
            }
            const n = snap.val()
            assign_ref.set(n)
            localStorage.setItem("tctc_guest_number", n)
            callback(n)
        })
    }).catch(function (error) {
        console.log("[leaderboard] 讀取訪客編號失敗：", error)
        callback(null)
    })
}

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

            callback("訪客" + Get_Anon_Id().slice(0, 4))
        }
    })
}

const FORBIDDEN_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "pussy", "cunt", "fk",
  "幹你娘", "操你媽", "機掰", "靠北", "靠腰", "三小", "我操", "去死", "死一死",
  "他媽的", "你媽的", "渣男", "雜碎", "垃圾", "白痴", "智障", "腦殘",
  "賤人", "婊子", "死全家", "草泥馬", "我是gay"
];

function Validate_Username_Format(raw_name) {
  if (typeof raw_name !== "string" || raw_name.trim().length === 0) {
    return { valid: false, reason: "名字不可為空白" };
  }

  if (/^\s/.test(raw_name)) {
    return { valid: false, reason: "名字開頭不可以是空格" };
  }

  const actualLength = [...raw_name].length;
  if (actualLength > 13) {
    return { valid: false, reason: "名字不可超過 13 個字" };
  }

  const normalized = raw_name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-.\u200B-\u200D\uFEFF`~!@#$%^&*()_+=[\]{}|\\:;"'<>,.?/~\u3000-\u303F\uFF00-\uFFEF]/g, "");

  if (normalized.length === 0) {
    return { valid: false, reason: "名字不可全為標點符號或空格" };
  }

  const isForbidden = FORBIDDEN_WORDS.some(word => normalized.includes(word));
  if (isForbidden) {
    return { valid: false, reason: "名稱不雅" };
  }

  return { valid: true };
}

// Firebase 的 key 不能包含 . # $ [ ] / 這幾個字元，用底線取代掉；
// 另外統一轉小寫再比對，「Player1」跟「player1」視為同一個名字，
// 不然會出現兩個看起來幾乎一樣、只差大小寫的名字，容易搞混、也容易被拿來鑽漏洞
function _Username_To_Key(name) {
    return name.trim().toLowerCase().replace(/[.#$\[\]\/]/g, "_")
}

function Claim_Username(name, callback) {
    if (typeof Wait_For_Auth_Ready !== "function") {
        callback(false, "系統尚未準備好，請稍後再試")
        return
    }

    Wait_For_Auth_Ready(function (user) {
        if (!user) {

            console.log(
                "[username] Claim_Username 失敗：Wait_For_Auth_Ready 回傳 null。診斷資訊：",
                "firebase.auth().currentUser =", (typeof firebase.auth === "function" ? firebase.auth().currentUser : "firebase.auth 不是函式"),
                "; _tctc_current_auth_user =", _tctc_current_auth_user,
                "; 時間戳 =", new Date().toISOString()
            )
            callback(false, "登入尚未完成，請稍後再試")
            return
        }

        const anon_id = Get_Anon_Id()
        const owner_uid = user.uid
        const key = _Username_To_Key(name)
        const claim_ref = tctc_db.ref(`usernames/${key}`)

        claim_ref.transaction(function (current) {
            if (current === null) return { anon_id: anon_id, owner_uid: owner_uid }
            if (current.owner_uid === owner_uid) return { anon_id: anon_id, owner_uid: owner_uid }
            return undefined
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

            const old_name = (localStorage.getItem("username") || "").trim()
            const old_key = old_name ? _Username_To_Key(old_name) : null
            if (old_key && old_key !== key) {
                tctc_db.ref(`usernames/${old_key}`).transaction(function (current) {
                    // 只釋放「確定是自己當初佔的」那一筆，避免不小心動到別人的資料
                    return (current && current.owner_uid === owner_uid) ? null : current
                })
            }

            callback(true)
        })
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
            const public_id = Get_Public_Id()
            const entry_ref = tctc_db.ref(`${node_path}/${id}/${public_id}`)

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

                const entry = {
                    name: player_name,
                    wpm: is_new_best ? wpm : current.wpm,
                    acc: is_new_best ? ((typeof acc === "number" && !isNaN(acc)) ? acc : 0) : current.acc,
                    timestamp: is_new_best ? firebase.database.ServerValue.TIMESTAMP : current.timestamp
                }
                if (is_new_best && raw_stats) {
                    Object.assign(entry, raw_stats)
                } else if (!is_new_best) {

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

                resolve()
            })
        })
    })
}

function _Filter_Out_Hidden_Players(list, callback) {
    if (list.length === 0) {
        callback(list)
        return
    }

    const checks = list.map(function (entry) {

        return tctc_db.ref("player_stats")
            .orderByChild("public_id")
            .equalTo(entry._public_id)
            .limitToFirst(1)
            .once("value")
            .then(function (snapshot) {
                let stats = {}
                snapshot.forEach(function (child) { stats = child.val() || {} })
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

                if (r.live_name) r.entry.name = r.live_name
                return r.entry
            })
        callback(visible_list)
    })
}

function _Get_Leaderboard(node_path, id, callback, limit) {
    limit = limit || 50

    const fetch_limit = limit + 50

    tctc_db.ref(`${node_path}/${id}`)
        .orderByChild("wpm")
        .limitToLast(fetch_limit)
        .once("value")
        .then(function (snapshot) {
            const list = []
            snapshot.forEach(function (child) {

                const val = child.val()
                val._public_id = _Hash_Anon_Id_To_Public_Id(child.key)
                list.push(val)
            })

            list.sort(function (a, b) {
                if (b.wpm !== a.wpm) return b.wpm - a.wpm
                return (b.acc || 0) - (a.acc || 0)
            })

            _Filter_Out_Hidden_Players(list, function (visible_list) {
                callback(visible_list.slice(0, limit))
            })
        })
        .catch(function (error) {
            console.log(`[leaderboard] 讀取排行榜失敗（${node_path}）：`, error)
            callback([])
        })
}

function Submit_Score_To_Leaderboard(stageId, wpm, acc, raw_stats) {
    return _Submit_Best_Score("leaderboard", stageId, wpm, acc, raw_stats)
}
function Get_Stage_Leaderboard(stageId, callback, limit) {
    _Get_Leaderboard("leaderboard", stageId, callback, limit)
}

function Submit_Challenge_Score_To_Leaderboard(comboId, wpm, acc, raw_stats) {

    const anon_id = Get_Anon_Id()
    if (anon_id && typeof wpm === "number" && !isNaN(wpm)) {
        tctc_db.ref(`player_stats/${anon_id}/best_challenge_wpm`).transaction(function (current) {
            return Math.max(current || 0, wpm)
        }).catch(function (error) {
            console.log("[player_stats] best_challenge_wpm 同步失敗：", error)
        })

        const CHALLENGE_WPM_STREAK_LENGTH = 7

        tctc_db.ref(`player_stats/${anon_id}/recent_challenge_wpm_window`).transaction(function (current) {
            const window = Array.isArray(current) ? current.slice() : []
            window.push(wpm)
            if (window.length > CHALLENGE_WPM_STREAK_LENGTH) window.shift()
            return window
        }).then(function (result) {
            if (!result.committed) return
            const window = result.snapshot.val() || []
            if (window.length < CHALLENGE_WPM_STREAK_LENGTH) return

            const windowMin = Math.min.apply(null, window)
            return tctc_db.ref(`player_stats/${anon_id}/high_wpm_streak`).transaction(function (current) {
                return Math.max(current || 0, windowMin)
            })
        }).catch(function (error) {
            console.log("[player_stats] WPM 連續紀錄同步失敗：", error)
        })
    }

    const CHALLENGE_ACC_STREAK_THRESHOLD = 90

    if (anon_id && typeof acc === "number" && !isNaN(acc)) {

        tctc_db.ref(`player_stats/${anon_id}/best_challenge_acc`).transaction(function (current) {
            return Math.max(current || 0, acc)
        }).catch(function (error) {
            console.log("[player_stats] best_challenge_acc 同步失敗：", error)
        })

        if (acc >= 100) {
            tctc_db.ref(`player_stats/${anon_id}/perfect_challenge_count`).transaction(function (current) {
                return (current || 0) + 1
            }).catch(function (error) {
                console.log("[player_stats] perfect_challenge_count 同步失敗：", error)
            })
        }

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

    if(typeof ACHV_Schedule_Notify_Check === "function"){
        ACHV_Schedule_Notify_Check()
    }

    return _Submit_Best_Score("challenge_leaderboard", comboId, wpm, acc, raw_stats)
}
function Get_Challenge_Leaderboard(comboId, callback, limit) {
    _Get_Leaderboard("challenge_leaderboard", comboId, callback, limit)
}

function Sync_Player_Stats(wpm, acc) {
    if (typeof wpm !== "number" || isNaN(wpm)) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    const base_ref = tctc_db.ref(`player_stats/${anon_id}`)
    const acc_value = (typeof acc === "number" && !isNaN(acc)) ? acc : 0

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

                base_ref.child("avg_wpm").set(Math.round((new_sum / new_count) * 10) / 10).finally(resolve)
            })
        })
    })

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

    const name_promise = new Promise(function (resolve) {
        Get_Player_Display_Name(function (name) {
            base_ref.child("name").set(name).finally(resolve)
        })
    })

    const public_id_promise = base_ref.child("public_id").set(Get_Public_Id())

    return Promise.all([wpm_chain_promise, acc_chain_promise, name_promise, public_id_promise])
}

function Sync_Stage_Completion(stageId){
    if(typeof get_difficulty_by_stageid !== "function"){
        console.warn("[player_stats] 找不到 get_difficulty_by_stageid，請確認有先載入 TCTC2-0-level_data.js")
        return Promise.resolve()
    }

    const difficulty = get_difficulty_by_stageid(stageId)
    const anon_id = Get_Anon_Id()
    if(!anon_id || !difficulty) return Promise.resolve()

    const field = `stages_completed_${difficulty}`

    return tctc_db.ref(`player_stats/${anon_id}/${field}`).transaction(function(current){
        return (current || 0) + 1
    }).then(function(result){

        if(result && result.committed && typeof ACHV_Schedule_Notify_Check === "function"){
            ACHV_Schedule_Notify_Check()
        }

        if(result && result.committed && typeof CLS_Schedule_Task_Notify_Check === "function"){
            CLS_Schedule_Task_Notify_Check()
        }

        if(result && result.committed && typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
            Sync_XP(XP_CONFIG.actions.stage_first_clear)
        }
    }).catch(function(error){
        console.warn(`[player_stats] ${field} 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：`, error.message)
    })
}

function Sync_Chars_Typed(charCount){
    if(typeof charCount !== "number" || isNaN(charCount) || charCount <= 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    const rounded = Math.round(charCount)

    return tctc_db.ref(`player_stats/${anon_id}/total_chars_typed`).transaction(function(current){
        return (current || 0) + rounded
    }).then(function(result){

        if(result && result.committed && typeof ACHV_Schedule_Notify_Check === "function"){
            ACHV_Schedule_Notify_Check()
        }

        if(result && result.committed && typeof CLS_Schedule_Task_Notify_Check === "function"){
            CLS_Schedule_Task_Notify_Check()
        }

        if(result && result.committed && typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
            const chars_xp = Math.floor(rounded / XP_CONFIG.actions.chars_per_xp)
            if(chars_xp > 0) Sync_XP(chars_xp)
        }
    }).catch(function(error){
        console.warn("[player_stats] total_chars_typed 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：", error.message)
    })
}

function Sync_Zhuyin_Keys_Typed(keyCount){
    if(typeof keyCount !== "number" || isNaN(keyCount) || keyCount <= 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    const rounded = Math.round(keyCount)

    return tctc_db.ref(`player_stats/${anon_id}/total_zhuyin_keys_typed`).transaction(function(current){
        return (current || 0) + rounded
    }).then(function(result){

        if(result && result.committed && typeof CLS_Schedule_Task_Notify_Check === "function"){
            CLS_Schedule_Task_Notify_Check()
        }
    }).catch(function(error){
        console.warn("[player_stats] total_zhuyin_keys_typed 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：", error.message)
    })
}

function Sync_Achievements_Unlocked(count){
    if(typeof count !== "number" || isNaN(count) || count < 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    return tctc_db.ref(`player_stats/${anon_id}/achievements_unlocked`).set(Math.round(count))
        .catch(function(error){

            console.warn("[player_stats] achievements_unlocked 同步失敗（很可能是 Firebase Rules 還沒加上這個欄位的規則）：", error.message)
        })
}

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

function Sync_XP(amount){
    if(typeof amount !== "number" || isNaN(amount) || amount <= 0) return Promise.resolve()

    const anon_id = Get_Anon_Id()
    if(!anon_id) return Promise.resolve()

    let xp_before = 0
    return tctc_db.ref(`player_stats/${anon_id}/xp`).transaction(function(current){
        xp_before = current || 0
        return xp_before + Math.round(amount)
    }).then(function(result){
        if(result && result.committed && typeof XP_Notify_Show === "function"){
            const xp_after = (result.snapshot ? result.snapshot.val() : null) || 0
            XP_Notify_Show(xp_after - xp_before, xp_before, xp_after)
        }
        return result
    }).catch(function(error){
        console.warn("[ WARNING ] 請勿嘗試篡改成績，後端系統已標記此帳號，如再次出現此情形將處以封號，並下架排行榜成績。", error.message)
    })
}

let _online_time_sync_in_flight = null

function Wait_For_Online_Time_Sync(callback) {
    if (_online_time_sync_in_flight) {
        _online_time_sync_in_flight.then(callback)
    } else {
        callback()
    }
}

function Sync_Pending_Online_Time() {
    const PENDING_KEY = "tctc2.0-pending_online_seconds"
    const pending_seconds = Math.floor(Number(localStorage.getItem(PENDING_KEY)) || 0)
    if (pending_seconds <= 0) return

    const anon_id = Get_Anon_Id()

    _online_time_sync_in_flight = new Promise(function (resolve) {
        tctc_db.ref(`player_stats/${anon_id}/online_seconds`).transaction(function (current) {
            return (current || 0) + pending_seconds
        }, function (error, committed) {

            if (!error && committed) {
                const still_pending = Number(localStorage.getItem(PENDING_KEY)) || 0
                localStorage.setItem(PENDING_KEY, Math.max(0, still_pending - pending_seconds))
            } else if (error) {

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

let _page_views_sync_in_flight = null

function Wait_For_Page_Views_Sync(callback) {
    if (_page_views_sync_in_flight) {
        _page_views_sync_in_flight.then(callback)
    } else {
        callback()
    }
}

function Sync_Pending_Page_Views() {
    const PENDING_VIEWS_KEY = "tctc2.0-pending_page_views"
    const pending_views = Math.floor(Number(localStorage.getItem(PENDING_VIEWS_KEY)) || 0)
    if (pending_views <= 0) return

    const anon_id = Get_Anon_Id()

    _page_views_sync_in_flight = new Promise(function (resolve) {

        tctc_db.ref("site_meta/total_page_views").transaction(function (current) {
            return (current || 0) + pending_views
        }, function (error, committed) {
            if (!error && committed) {
                const still_pending = Math.floor(Number(localStorage.getItem(PENDING_VIEWS_KEY)) || 0)
                localStorage.setItem(PENDING_VIEWS_KEY, Math.max(0, still_pending - pending_views))
            } else if (error) {
                console.log("[page_views] 全站瀏覽次數同步失敗（很可能是 Firebase Rules 還沒加上 site_meta 節點的規則）：", error)
            }

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

    Get_Player_Display_Name(function (name) {
        tctc_db.ref(`player_stats/${anon_id}/name`).set(name)
    })
}

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

                val._public_id = _Hash_Anon_Id_To_Public_Id(child.key)

                if (val.hide_from_leaderboard === true) return

                if (!min_count_field || (val[min_count_field] || 0) >= min_count) {
                    list.push(val)
                }
            })

            list.sort(function (a, b) { return (b[order_by_field] || 0) - (a[order_by_field] || 0) })
            callback(list)
        })
        .catch(function (error) {
            console.log(`[leaderboard] 讀取玩家總排行榜失敗（${order_by_field}）：`, error)
            callback([])
        })
}

function Get_Top_Players_By_Avg_Wpm(callback, limit) {
    _Get_Top_Players("avg_wpm", "wpm_count", 50, function (list) {
        callback(list.slice(0, limit || 50))
    })
}

function Get_Top_Players_By_Avg_Acc(callback, limit) {
    _Get_Top_Players("avg_acc", "acc_count", 50, function (list) {
        callback(list.slice(0, limit || 50))
    })
}

function Get_Top_Players_By_Online_Time(callback, limit) {
    Wait_For_Online_Time_Sync(function () {
        _Get_Top_Players("online_seconds", null, 0, function (list) {
            callback(list.slice(0, limit || 50))
        })
    })
}

function Get_Top_Players_By_Points(callback, limit) {
    _Get_Top_Players("total_points", "total_points", 1, function (list) {
        callback(list.slice(0, limit || 50))
    })
}

function Get_Top_Players_By_Page_Views(callback, limit) {
    Wait_For_Page_Views_Sync(function () {
        _Get_Top_Players("page_views", null, 0, function (list) {
            callback(list.slice(0, limit || 50))
        })
    })
}

function Get_Top_Players_By_Streak(callback, limit) {
    _Get_Top_Players("streak_longest", null, 0, function (list) {
        callback(list.slice(0, limit || 50))
    })
}

function Get_Top_Players_By_Total_Login_Days(callback, limit) {
    _Get_Top_Players("streak_total_days", null, 0, function (list) {
        callback(list.slice(0, limit || 50))
    })
}

function Get_All_Player_Stats_For_Achievement_Level(callback) {
    tctc_db.ref("player_stats").once("value")
        .then(function (snapshot) {
            const list = []
            snapshot.forEach(function (child) {
                const val = child.val()
                val._public_id = _Hash_Anon_Id_To_Public_Id(child.key)
                if (val.hide_from_leaderboard === true) return
                list.push(val)
            })
            callback(list)
        })
        .catch(function (error) {
            console.log("[leaderboard] 讀取玩家總榜（成就等級）失敗：", error)
            callback([])
        })
}

function Get_Top_Players_By_XP(callback, limit) {
    _Get_Top_Players("xp", "xp", 1, function (list) {
        callback(list.slice(0, limit || 50))
    })
}

function _Get_Own_Rank_In_Node(node_path, id, callback) {
    const anon_id = Get_Anon_Id()

    tctc_db.ref(`${node_path}/${id}`)
        .orderByChild("wpm")
        .once("value")
        .then(function (snapshot) {
            const list = []
            snapshot.forEach(function (child) {
                const val = child.val()
                val._public_id = _Hash_Anon_Id_To_Public_Id(child.key)
                list.push(val)
            })

            list.sort(function (a, b) {
                if (b.wpm !== a.wpm) return b.wpm - a.wpm
                return (b.acc || 0) - (a.acc || 0)
            })

            const own_index = list.findIndex(function (entry) { return entry._public_id === Get_Public_Id() })
            if (own_index === -1) {
                callback(null)
                return
            }

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

function Get_Own_Player_Rank(order_by_field, min_count_field, min_count, callback) {
    const anon_id = Get_Anon_Id()

    tctc_db.ref("player_stats")
        .orderByChild(order_by_field)
        .once("value")
        .then(function (snapshot) {
            const own_snapshot = snapshot.child(anon_id)
            if (!own_snapshot.exists()) {
                callback(null)
                return
            }

            const own_val = own_snapshot.val()
            if (min_count_field && (own_val[min_count_field] || 0) < min_count) {
                callback(null)
                return
            }

            const list = []
            snapshot.forEach(function (child) {
                const val = child.val()
                val._public_id = _Hash_Anon_Id_To_Public_Id(child.key)
                if (!min_count_field || (val[min_count_field] || 0) >= min_count) {
                    list.push(val)
                }
            })
            list.sort(function (a, b) { return (b[order_by_field] || 0) - (a[order_by_field] || 0) })

            const own_index = list.findIndex(function (entry) { return entry._public_id === Get_Public_Id() })
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

function Get_Own_Leaderboard_Visibility(callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/hide_from_leaderboard`)
        .once("value")
        .then(function (snapshot) {

            callback(snapshot.val() === true)
        })
        .catch(function (error) {
            console.log("[leaderboard] 讀取排行榜顯示設定失敗：", error)
            callback(null)
        })
}

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

function Get_Own_Profile_Visibility(callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}/hide_profile_view`)
        .once("value")
        .then(function (snapshot) {
            callback(snapshot.val() === true)
        })
        .catch(function (error) {
            console.log("[profile] 讀取個人資料公開設定失敗：", error)
            callback(null)
        })
}

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
// 【修改】這是導致「點進個人資料全部顯示找不到這位玩家」的地方——
// 排行榜/總排行榜的連結現在傳過來的 id 是 Get_Public_Id() 算出來的假名，
// 不是 player_stats 底下真正的 key，直接 `player_stats/${id}` 這樣查一定
// 查不到任何東西。改成：先用 public_id 這個索引欄位反查，找不到的話
// （例如教室名單裡點學生名字時，傳的其實還是真正的 anon_id——那個情境
// 本來就已經在別的地方公開這個 anon_id 了，這裡沿用不會多洩漏什麼）
// 才退回原本「把 id 當成直接的 key」查一次，兩種連結來源都能正常運作。
function Get_Public_Player_Profile(id, callback) {
    if (!id) {
        callback({ exists: false })
        return
    }

    function _finish_with(val) {
        if (!val) {
            callback({ exists: false })
            return
        }
        if (val.hide_profile_view === true) {
            // ===== 【修改】簡介不受這個開關影響，永遠公開 =====
            // 理由見 view_profile.js 的 VP_Show_Blocked() 內部說明：這個
            // 開關擋的是「榮譽牆/統計數字」，簡介比較接近自我介紹，公開
            // 出來對其他玩家比較有用，所以就算 hidden，還是把 name/intro
            // 一起帶出去，讓呼叫端能單獨顯示這兩個欄位，其餘欄位一律不給
            // （不能只給 hidden:true 就什麼都不帶，不然呼叫端沒東西可顯示）
            callback({
                hidden: true,
                exists: true,
                name: val.name || "訪客",
                intro: val.intro || ""
            })
            return
        }

        val.hidden = false
        val.exists = true
        callback(val)
    }

    tctc_db.ref("player_stats")
        .orderByChild("public_id")
        .equalTo(id)
        .limitToFirst(1)
        .once("value")
        .then(function (snapshot) {
            let val = null
            snapshot.forEach(function (child) { val = child.val() })

            if (val) {
                _finish_with(val)
                return
            }

            tctc_db.ref(`player_stats/${id}`)
                .once("value")
                .then(function (fallbackSnapshot) { _finish_with(fallbackSnapshot.val()) })
                .catch(function (error) {
                    console.log("[profile] 讀取玩家公開資料失敗（fallback）：", error)
                    callback(null)
                })
        })
        .catch(function (error) {
            console.log("[profile] 讀取玩家公開資料失敗：", error)
            callback(null)
        })
}

function _Resolve_Real_Anon_Id(id, callback) {
    if (!id) { callback(id); return }

    tctc_db.ref("player_stats")
        .orderByChild("public_id")
        .equalTo(id)
        .limitToFirst(1)
        .once("value")
        .then(function (snapshot) {
            let real_id = null
            snapshot.forEach(function (child) { real_id = child.key })
            callback(real_id || id)
        })
        .catch(function (error) {
            console.warn("[like] 反查真正的 anon_id 失敗：", error.message)
            callback(id)
        })
}

function Get_Own_Like_Status(target_anon_id, callback) {
    const anon_id = Get_Anon_Id()
    if (!target_anon_id) {
        callback(false)
        return
    }

    _Resolve_Real_Anon_Id(target_anon_id, function (real_target_id) {
        if (!real_target_id || real_target_id === anon_id) {
            callback(false)
            return
        }

        tctc_db.ref(`player_likes/${real_target_id}/${anon_id}`)
            .once("value")
            .then(function (snapshot) {
                callback(snapshot.val() === true)
            })
            .catch(function (error) {
                console.warn("[like] 讀取按讚狀態失敗：", error.message)
                callback(false)
            })
    })
}

function Like_Player(target_anon_id, callback) {
    const anon_id = Get_Anon_Id()
    if (!target_anon_id) {
        callback(false)
        return
    }

    _Resolve_Real_Anon_Id(target_anon_id, function (real_target_id) {
        if (!real_target_id || real_target_id === anon_id) {
            callback(false)
            return
        }

        tctc_db.ref(`player_likes/${real_target_id}/${anon_id}`)
            .set(true)
            .then(function () {
                tctc_db.ref(`player_stats/${real_target_id}/like_count`).transaction(function (current) {
                    return (current || 0) + 1
                }).catch(function (error) {
                    console.warn("[like] 更新讚數計數器失敗：", error.message)
                })
                callback(true)
            })
            .catch(function (error) {

                console.warn("[like] 按讚失敗（可能是已經讚過了）：", error.message)
                callback(false)
            })
    })
}

function Report_Player(target_anon_id, target_name, categories, reason, callback) {
    const anon_id = Get_Anon_Id()
    if (!target_anon_id) {
        callback(false)
        return
    }

    const trimmed_reason = (reason || "").trim()
    if (!trimmed_reason) {
        callback(false)   // 理由必填，前端理論上已經擋過一次，這裡再擋一次保險
        return
    }

    // 【修正】跟 Like_Player 同一個問題：view_profile.html 傳進來的
    // target_anon_id 其實是 public_id 假名，要先反查成真正的 anon_id，
    // player_reports 才會歸檔在對的玩家底下，管理員之後才查得到。
    _Resolve_Real_Anon_Id(target_anon_id, function (real_target_id) {
        if (!real_target_id || real_target_id === anon_id) {
            callback(false)   // 不能檢舉自己
            return
        }

        // 【新增】頻率限制：跟 rate_limits/player_reports/{anon_id} 這個節點
        // 綁在同一次 multi-path update() 裡一起送出。Rules 那邊要求
        // player_reports 新建時，這個節點的值必須「剛好等於這次寫入的 now」，
        // 逼著這兩個路徑一定要同一次 update() 一起送，不能只送 player_reports
        // 那半邊繞過限制。Rules 規定兩次送出中間至少要間隔 30 秒，
        // 間隔不夠這次的寫入整組會被 Rules 直接拒絕（permission_denied）。
        const report_id = tctc_db.ref(`player_reports/${real_target_id}`).push().key
        const updates = {}
        updates[`player_reports/${real_target_id}/${report_id}`] = {
            reporter_anon_id: anon_id,
            // 【新增】把「被檢舉當下」的暱稱一起存起來，省得每次處理檢舉都要
            // 手動跳去 player_stats/{target_anon_id}/name 對照。這裡刻意存
            // 「檢舉當下」的暱稱快照，不是即時查詢——玩家之後改名了，這筆
            // 舊檢舉紀錄上的名字不會跟著變，這樣反而更準確地反映「當初被
            // 檢舉的那個暱稱」，跟改名前後的行為對得起來
            target_name: (target_name || "訪客").slice(0, 20),
            categories: Array.isArray(categories) ? categories : [],
            reason: trimmed_reason.slice(0, 500),   // 限制長度，避免有人塞超長文字
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }
        updates[`rate_limits/player_reports/${anon_id}`] = firebase.database.ServerValue.TIMESTAMP

        tctc_db.ref().update(updates)
            .then(function () {
                callback(true)
            })
            .catch(function (error) {
                console.warn("[report] 送出檢舉失敗：", error.message)
                // permission_denied 在這裡九成是頻率限制卡到，不是系統壞掉，
                // 訊息講清楚一點，不要讓玩家以為是網站壞了
                const is_probably_rate_limited = error.code === "PERMISSION_DENIED"
                callback(false, is_probably_rate_limited ? "檢舉太頻繁了，請稍等一下再試" : "送出失敗，請稍後再試一次")
            })
    })
}

function Submit_Site_Feedback(category, title, content, contact, callback) {
    const anon_id = Get_Anon_Id()
    const trimmed_content = (content || "").trim()
    if (!trimmed_content) {
        callback(false, "詳細內容不能空白")
        return
    }

    const valid_categories = ["bug", "suggestion", "other"]
    const safe_category = valid_categories.indexOf(category) !== -1 ? category : "other"

    const saved_name = (localStorage.getItem("username") || "").trim()

    // 【新增】頻率限制，做法跟 Report_Player() 一樣：跟
    // rate_limits/site_feedback/{anon_id} 綁在同一次 multi-path update()
    // 一起送出，Rules 要求兩次送出中間至少間隔 60 秒，不夠的話這次
    // 整組 update() 會直接被 Rules 拒絕。
    const feedback_id = tctc_db.ref("site_feedback").push().key
    const updates = {}
    updates[`site_feedback/${feedback_id}`] = {
        category: safe_category,
        title: (title || "").trim().slice(0, 50),
        content: trimmed_content.slice(0, 1000),
        contact: (contact || "").trim().slice(0, 100),
        anon_id: anon_id,
        name: saved_name.slice(0, 20),
        page_url: (typeof location !== "undefined" ? location.href : "").slice(0, 200),
        status: "new",
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }
    updates[`rate_limits/site_feedback/${anon_id}`] = firebase.database.ServerValue.TIMESTAMP

    tctc_db.ref().update(updates)
        .then(function () {
            callback(true)
        })
        .catch(function (error) {
            console.warn("[feedback] 送出意見回報失敗：", error.message)
            const is_probably_rate_limited = error.code === "PERMISSION_DENIED"
            callback(false, is_probably_rate_limited ? "送出太頻繁了，請等一下再試" : "送出失敗，請稍後再試一次")
        })
}

function Delete_All_Player_Data(callback) {
    const anon_id = Get_Anon_Id()
    const public_id = Get_Public_Id()
    const updates = {}

    ;[
        "name", "wpm_sum", "wpm_count", "avg_wpm",
        "acc_sum", "acc_count", "avg_acc",
        "cg_wpm_sum", "cg_wpm_count", "avg_challenge_wpm",
        "cg_acc_sum", "cg_acc_count", "avg_challenge_acc",
        "online_seconds", "total_points", "hide_from_leaderboard",
        "streak_current", "streak_longest", "streak_last_ts", "streak_total_days",

        "longest_gap_days",

        "hide_profile_view", "intro",

        "public_id"
    ].forEach(function (field) {
        updates[`player_stats/${anon_id}/${field}`] = null
    })

    updates[`guest_numbers/${anon_id}`] = null
    localStorage.removeItem("tctc_guest_number")

    const CHALLENGE_DIFFICULTIES = ["easy", "medium", "hard", "extreme"]
    const CHALLENGE_STAGES = ["article", "word"]
    const CHALLENGE_SECONDS = [30, 60, 180, 300, 600]
    CHALLENGE_DIFFICULTIES.forEach(function (diff) {
        CHALLENGE_STAGES.forEach(function (stage) {
            CHALLENGE_SECONDS.forEach(function (seconds) {
                updates[`challenge_leaderboard/${diff}-${stage}-${seconds}/${public_id}`] = null
            })
        })
    })

    if (typeof Level_Data === "object" && Level_Data) {
        Object.keys(Level_Data).forEach(function (difficultyKey) {
            const chapters = (Level_Data[difficultyKey] && Level_Data[difficultyKey].chapter) || []
            chapters.forEach(function (chapter) {
                const stages = chapter.stage || []
                stages.forEach(function (stage) {
                    if (stage && stage.id) {
                        updates[`leaderboard/${stage.id}/${public_id}`] = null
                    }
                })
            })
        })
    } else {
        console.log("[delete] 這個頁面沒有載入 Level_Data，主線關卡榜的資料這次不會被清除")
    }

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
        // 【修改】跟 Claim_Username 一樣改成看 owner_uid，不是看 anon_id 字串。
        // firebase.auth().currentUser 這裡用同步讀取就好，不用整個函式簽名
        // 都改成 Wait_For_Auth_Ready 包一層——執行到這裡的時間點，一定是玩家
        // 已經在個人設定頁面待了一陣子才按下「刪除所有資料」，匿名登入
        // 早就完成了，不會是 null。
        const owner_uid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || null
        tctc_db.ref(`usernames/${username_key}`).transaction(function (current) {
            // 只有現在存的值確實是自己的 owner_uid，才清掉；
            // 如果不是（例如中途被別人搶走、或本機記錄跟雲端不一致），保留原樣不動
            return (current && owner_uid && current.owner_uid === owner_uid) ? null : current
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
const AUTH_ACCOUNT_UID_KEY = "tctc2.0-account_uid"
const AUTH_ACCOUNT_DISPLAY_KEY = "tctc2.0-account_display"
const AUTH_GUEST_BACKUP_KEY = "tctc2.0-guest_backup_anon_id"

function Get_Current_Account_Uid() {
    return localStorage.getItem(AUTH_ACCOUNT_UID_KEY)
}
function Get_Current_Account_Display() {
    return localStorage.getItem(AUTH_ACCOUNT_DISPLAY_KEY)
}

function _Generate_New_Anon_Id() {
    return crypto.randomUUID ? crypto.randomUUID() : ("anon-" + Date.now() + "-" + Math.random().toString(16).slice(2))
}

const IDENTITY_BOUND_LOCAL_KEYS = [
    "average_wpm", "average_acc", "wpm_sum", "wpm_times", "acc_sum", "acc_times",
    "average_challenge_wpm", "average_challenge_acc", "cg_wpm_sum", "cg_wpm_times", "cg_acc_sum", "cg_acc_times",
    "tctc2.0-challenge_total_points",
    "tctc2.0-challenge_history", "tctc2.0-profile_avatar", "stage_progress", "intro"
]

function Switch_Active_Identity(new_anon_id, callback) {

    const anon_id_unchanged = (Get_Anon_Id() === new_anon_id)

    localStorage.setItem("tctc_anon_id", new_anon_id)
    localStorage.removeItem("tctc_guest_number")

    if (!anon_id_unchanged) {
        IDENTITY_BOUND_LOCAL_KEYS.forEach(function (key) { localStorage.removeItem(key) })
    }

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

function Get_Guest_Inherit_Preview(callback) {
    const anon_id = Get_Anon_Id()
    tctc_db.ref(`player_stats/${anon_id}`).once("value").then(function (snapshot) {
        callback(snapshot.val() || {})
    }).catch(function (error) {
        console.log("[auth] 讀取訪客資料預覽失敗：", error)
        callback(null)
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

            callback(false, "找不到這個帳號對應的資料，請聯絡我們回報這個問題")
            return
        }

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

function Logout_And_Clear_Guest_Backup(callback) {
    firebase.auth().signOut().then(function () {
        localStorage.removeItem(AUTH_ACCOUNT_UID_KEY)
        localStorage.removeItem(AUTH_ACCOUNT_DISPLAY_KEY)
        localStorage.removeItem(AUTH_GUEST_BACKUP_KEY)

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

function TCTC_Migrate_Existing_Stage_Progress(){

    const MIGRATION_FLAG_KEY = "tctc_stage_migration_v2_done"

    if(localStorage.getItem(MIGRATION_FLAG_KEY) === "1") return
    if(typeof get_difficulty_by_stageid !== "function") return

    const progress = JSON.parse(localStorage.getItem("stage_progress")) || {}
    const counts = { easy: 0, medium: 0, hard: 0 }

    Object.keys(progress).forEach(function(stageId){
        if(progress[stageId] !== true) return
        const difficulty = get_difficulty_by_stageid(stageId)
        if(difficulty && counts.hasOwnProperty(difficulty)) counts[difficulty] += 1
    })

    const anon_id = Get_Anon_Id()
    if(!anon_id) return

    let allSucceeded = true

    const writes = ["easy", "medium", "hard"].map(function(difficulty){
        if(counts[difficulty] === 0) return Promise.resolve()
        return tctc_db.ref(`player_stats/${anon_id}/stages_completed_${difficulty}`).transaction(function(current){

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

const TCTC_DEFAULT_ADMIN_UID = "itDBv0nzERgayUVmFQvGpLtdFnw2"

function Check_Is_Admin(callback) {
    Wait_For_Auth_Ready(function (user) {
        if (!user) {
            callback(false)
            return
        }
        if (user.uid === TCTC_DEFAULT_ADMIN_UID) {
            callback(true)
            return
        }
        tctc_db.ref(`admins/${user.uid}`).once("value")
            .then(function (snapshot) {
                callback(snapshot.val() === true)
            })
            .catch(function () {

                callback(false)
            })
    })
}

function Admin_Set_Feedback_Status(feedback_id, status, callback) {
    const valid_status = ["new", "read", "resolved"]
    if (valid_status.indexOf(status) === -1) {
        callback(false)
        return
    }
    tctc_db.ref(`site_feedback/${feedback_id}/status`).set(status)
        .then(function () { callback(true) })
        .catch(function (error) {
            console.warn("[admin] 更新意見回報狀態失敗：", error.message)
            callback(false)
        })
}

function Admin_Delete_Feedback(feedback_id, callback) {
    tctc_db.ref(`site_feedback/${feedback_id}`).remove()
        .then(function () { callback(true) })
        .catch(function (error) {
            console.warn("[admin] 刪除意見回報失敗：", error.message)
            callback(false)
        })
}

function Admin_Delete_Report(target_anon_id, report_id, callback) {
    tctc_db.ref(`player_reports/${target_anon_id}/${report_id}`).remove()
        .then(function () { callback(true) })
        .catch(function (error) {
            console.warn("[admin] 刪除檢舉失敗：", error.message)
            callback(false)
        })
}

function Admin_Delete_Player_Data(target_anon_id, callback) {
    if (!target_anon_id) {
        callback(false)
        return
    }

    const updates = {}
    ;[
        "name", "wpm_sum", "wpm_count", "avg_wpm",
        "acc_sum", "acc_count", "avg_acc",
        "cg_wpm_sum", "cg_wpm_count", "avg_challenge_wpm",
        "cg_acc_sum", "cg_acc_count", "avg_challenge_acc",
        "online_seconds", "total_points", "hide_from_leaderboard",
        "streak_current", "streak_longest", "streak_last_ts", "streak_total_days",
        "longest_gap_days", "hide_profile_view", "intro", "public_id"
    ].forEach(function (field) {
        updates[`player_stats/${target_anon_id}/${field}`] = null
    })
    updates[`guest_numbers/${target_anon_id}`] = null

    tctc_db.ref().update(updates)
        .then(function () {

            tctc_db.ref("usernames").orderByChild("anon_id").equalTo(target_anon_id)
                .once("value")
                .then(function (snapshot) {
                    const key_updates = {}
                    snapshot.forEach(function (child) { key_updates[child.key] = null })
                    if (Object.keys(key_updates).length === 0) {
                        callback(true)
                        return
                    }
                    tctc_db.ref("usernames").update(key_updates)
                        .then(function () { callback(true) })
                        .catch(function (error) {
                            console.warn("[admin] 釋放暱稱失敗（其餘資料已刪除）：", error.message)
                            callback(true)
                        })
                })
                .catch(function () {
                    callback(true)
                })
        })
        .catch(function (error) {
            console.warn("[admin] 刪除玩家資料失敗：", error.message)
            callback(false)
        })
}

document.addEventListener("DOMContentLoaded", function(){
    TCTC_Migrate_Existing_Stage_Progress()
})