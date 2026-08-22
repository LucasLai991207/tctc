/* ============================================================
   TCTC2-0-classroom.js
   班級教室功能

   ============================================================
   【架構核心：為什麼要另外開一份「精簡摘要」，不直接讀 player_stats】
   ============================================================
   老師開啟教室頁面時，畫面需要「全班每個人」的名字／等級／關卡完成度。
   如果直接讀每個學生的 player_stats/{anon_id}，會連同大頭貼 Base64、
   wpm_history、挑戰紀錄……等完全用不到、但體積可能不小的欄位一起下載，
   讀一次全班 = 頻寬乘以「學生人數 × 每人完整資料大小」，這正是免費版
   Firebase（每月 10GB 下載流量）最容易被燒掉的地方。

   解法：另外開一個 classroom_students/{classroom_id}/{anon_id} 節點，
   只存畫面真正會用到的欄位，學生加入教室、或之後重新整理頁面時才會
   覆寫這份摘要。老師端只需要讀這一份小節點，不管全班幾十人，每次讀取
   都是「幾十 KB 等級」而不是「幾 MB 等級」。

   ============================================================
   【資料結構總覽】（v2：一師多室）
   ============================================================
   classrooms/{classroom_id}
       : { name, teacher_uid, join_code, created_at, student_count }
         【新增】student_count：這間教室目前人數，靠 transaction 增減，
         給「教室列表」頁用——列表要同時顯示好幾間教室的人數，如果每間
         都整包下載 classroom_students 才能數人頭，流量會被列表頁吃掉，
         這個欄位讓列表頁只需要讀 classrooms/{id} 這個輕量節點。

   classroom_codes/{join_code}        : classroom_id （用代碼查教室 id）

   teacher_classrooms/{uid}/{classroom_id} : true
       【修改】原本是 teacher_classroom/{uid} = classroom_id（單一值，
       一師一室）。現在改成一個 map，key 是這個老師開的每一間教室 id，
       value 固定是 true（只是用來「有沒有這個 key」判斷歸屬，不是拿
       value 本身做事）。一個老師底下可以掛很多間教室。

   classroom_students/{classroom_id}/{anon_id}
       : { name, level, xp, stages_completed_easy/medium/hard,
           avg_wpm, avg_acc, online_seconds, total_points,
           total_chars_typed, achievements_unlocked, joined_at }
         【新增】xp、total_chars_typed：給「班級戰績」卡片加總用
         （總XP、總中文字數、班級之星）。

   player_stats/{anon_id}/classroom_id : classroom_id （這台裝置目前
       加入的教室，v2 一樣是單一值，學生仍然限定同時只能加入一間）

   ============================================================
   【已知限制，之後想加強再處理】
   ============================================================
   摘要只在「加入當下」跟「學生重新打開這個頁面」時同步一次，不會在
   學生打完一關的當下即時更新。要做到即時，需要在 firebase.js 裡加一段
   「順便同步教室摘要」的呼叫——這次先不動 firebase.js，避免一次改動
   牽連太多既有功能，之後穩定了再考慮要不要接上去。

   student_count 是靠 transaction 獨立維護的計數器，跟 classroom_students
   底下實際的筆數理論上要一致，但如果哪次 update() 寫到一半斷線（例如
   踢出學生那個 multi-path update 成功、但後面的 count transaction 沒發出
   去），數字有機率跟真實人數對不上一兩個。這個風險本來就存在於任何
   「非原子性維護的計數器」設計，先接受這個小誤差，之後如果真的對不上
   太多，再考慮改成「進儀表板時順便用 classroom_students 的實際筆數校正」。
   ============================================================ */

// ===== 產生 6 碼邀請代碼 =====
// 字元表故意排除 0/O/1/I 這幾個容易看錯的符號，畢竟代碼是要給學生用眼睛
// 抄或用手打的，不是給程式讀的，可讀性比理論上的隨機空間大小更重要
const CLS_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function CLS_Generate_Join_Code(){
    let code = ""
    for(let i = 0; i < 6; i++){
        code += CLS_CODE_CHARS[Math.floor(Math.random() * CLS_CODE_CHARS.length)]
    }
    return code
}

// ===== 判斷目前是不是「已登入的正式帳號」（不是訪客的匿名登入）=====
// 直接吃 Wait_For_Auth_Ready() 給的 user 物件（Firebase Auth 的第一手資料），
// 不查 localStorage，確保跟 Rules 看到的 auth 永遠是同一份。
function CLS_Is_Teacher_Eligible(user){
    return !!(user && user.isAnonymous === false)
}

// ===== 【新增】增減某間教室的人數計數器 =====
// 用 transaction 而不是直接 .set()，避免「同時有兩個學生加入/離開」
// 導致其中一次寫入被另一次覆蓋、數字算錯的 race condition。
// 這是「盡力而為」的計數器，不是關鍵資料（真正的名單以 classroom_students
// 為準），失敗了也不需要中斷主要操作的 callback，所以這裡不接 callback。
function CLS_Adjust_Student_Count(classroom_id, delta){
    if(!classroom_id) return
    tctc_db.ref(`classrooms/${classroom_id}/student_count`).transaction(function(current){
        const next = (current || 0) + delta
        return next < 0 ? 0 : next   // 保險：不要讓計數器變負數
    }).catch(function(error){
        console.warn("[classroom] 更新人數計數器失敗：", error.message)
    })
}

/* ------------------------------------------------------------
   建立教室
   ------------------------------------------------------------
   步驟：
   1. 用 push().key 生一組不會重複的教室 id
   2. 抽一組 6 碼邀請代碼，用 transaction() 去「卡位」classroom_codes/{code}
   3. 卡位成功後，寫入教室 metadata，並把這間教室掛進
      teacher_classrooms/{uid}/{classroom_id}（v2：多室索引，不再覆蓋
      舊教室，一個老師底下可以同時掛很多間）
   ------------------------------------------------------------ */
function CLS_Create_Classroom(name, callback){
    if(typeof Wait_For_Auth_Ready !== "function"){
        callback({ error: "write_failed" })
        return
    }

    Wait_For_Auth_Ready(function(user){
        _CLS_Create_Classroom_After_Auth_Ready(user, name, callback)
    })
}

function _CLS_Create_Classroom_After_Auth_Ready(user, name, callback){
    if(!CLS_Is_Teacher_Eligible(user)){
        callback({ error: "not_logged_in" })
        return
    }

    const uid = user.uid
    const classroom_id = tctc_db.ref("classrooms").push().key

    function try_claim_code(attempt){
        if(attempt >= 5){
            callback({ error: "code_generation_failed" })
            return
        }

        const code = CLS_Generate_Join_Code()

        tctc_db.ref(`classroom_codes/${code}`).transaction(function(current){
            return current === null ? classroom_id : undefined
        }).then(function(result){
            if(!result.committed){
                try_claim_code(attempt + 1)
                return
            }

            // 【修改】一次寫三個路徑：教室本身、代碼卡位（已在上面完成）、
            // 老師的多教室索引（用 update() 加一個 key，不會動到這個老師
            // 底下其他已存在的教室）
            // 【修改】多存一個 teacher_name，這是「建立教室當下」老師帳號的顯示名稱快照
            // （優先用 Google/Email 帳號的 displayName，沒有的話退回 email，兩者都沒有就顯示「老師」）。
            // 這是快照不是即時值：如果老師之後改了 Google 顯示名稱，這裡不會跟著變，
            // 跟全站其他「建立當下寫死一份摘要」的設計一致（例如 classroom_students 的摘要）。
            const updates = {}
            updates[`classrooms/${classroom_id}`] = {
                name: name,
                teacher_uid: uid,
                teacher_name: user.displayName || user.email || "老師",
                join_code: code,
                created_at: firebase.database.ServerValue.TIMESTAMP,
                student_count: 0
            }
            updates[`teacher_classrooms/${uid}/${classroom_id}`] = true

            tctc_db.ref().update(updates).then(function(){
                callback({ classroom_id: classroom_id, join_code: code })
            }).catch(function(error){
                console.warn("[classroom] 建立教室失敗：", error.message)
                callback({ error: "write_failed" })
            })
        }).catch(function(error){
            console.warn("[classroom] 搶占邀請代碼失敗：", error.message)
            callback({ error: "write_failed" })
        })
    }

    try_claim_code(0)
}

/* ------------------------------------------------------------
   【新增】解散教室
   ------------------------------------------------------------
   老師專屬的危險操作，一次清掉這間教室所有痕跡：
   1. classrooms/{id} 本體
   2. classroom_codes/{join_code}（不然代碼會卡死，之後任何人都搶不到）
   3. teacher_classrooms/{uid}/{id}（從這個老師的教室索引移除）
   4. classroom_students/{id} 整包名單
   5. 【重要】所有還在名單裡的學生，player_stats/{anon}/classroom_id
      要清空——不然學生下次打開教室頁面，會拿著一個已經不存在的
      classroom_id 去讀 classrooms/{id}，讀回 null，卡在一個
      「顯示（教室已被刪除）」但技術上還是「已加入」的尷尬狀態，
      沒辦法用正常的「加入教室」流程重新開始。
   ------------------------------------------------------------ */
function CLS_Dissolve_Classroom(classroom_id, teacher_uid, join_code, callback){
    if(!classroom_id){
        callback({ error: "invalid_target" })
        return
    }

    tctc_db.ref(`classroom_students/${classroom_id}`).once("value").then(function(snapshot){
        const students = snapshot.val() || {}

        // ===== 【修正】拆成兩步，不能跟刪除 classrooms/{id} 放進同一個 update() =====
        // classroom_codes/{code} 的刪除規則要用 root.child('classrooms')...('teacher_uid')
        // 去確認發起者就是這間教室的老師。但 Firebase 對 multi-path update() 評估規則時，
        // root.child() 讀到的是「這次 update 整包寫完之後」的狀態——如果 classrooms/{id}
        // 也在同一個 update() 裡被砍掉，規則看到的 teacher_uid 已經是空的，永遠對不上
        // auth.uid，導致整包 update 被拒絕（連帶其他路徑也一起失敗，因為 multi-path
        // update 是要嘛全部成功要嘛全部失敗）。
        // 解法：邀請代碼一定要在 classrooms/{id} 還活著的時候，用單獨一次寫入先釋放掉，
        // 確定成功之後，才進行第二步刪除教室本體 + 其餘的清理。
        const freeCodeStep = join_code
            ? tctc_db.ref(`classroom_codes/${join_code}`).remove()
            : Promise.resolve()

        freeCodeStep.then(function(){
            const updates = {}

            updates[`classrooms/${classroom_id}`] = null
            if(teacher_uid) updates[`teacher_classrooms/${teacher_uid}/${classroom_id}`] = null
            updates[`classroom_students/${classroom_id}`] = null

            Object.keys(students).forEach(function(anon_id){
                updates[`player_stats/${anon_id}/classroom_id`] = null
            })

            return tctc_db.ref().update(updates)
        }).then(function(){
            callback({})
        }).catch(function(error){
            console.warn("[classroom] 解散教室失敗：", error.message)
            callback({ error: "write_failed" })
        })
    }).catch(function(error){
        console.warn("[classroom] 讀取學生名單失敗：", error.message)
        callback({ error: "write_failed" })
    })
}

/* ------------------------------------------------------------
   組出「這個學生現在的摘要」——加入教室、跟之後重新整理都共用這支函式，
   確保兩個時機算出來的資料格式永遠一致

   【新增】xp、total_chars_typed：原本只存算好的 level，沒存原始 xp，
   也沒存累積打字字數。這兩個現在補上，給教室儀表板的「班級戰績」卡片
   （班級總XP、班級總打字數、班級之星）加總用——老師端本來就會整包
   下載這份摘要，直接在瀏覽器加總，不需要再多打一次 Firebase。
   ------------------------------------------------------------ */
function CLS_Build_Student_Summary(stats){
    const xp = stats.xp || 0
    const level = (typeof XP_Get_Level === "function") ? XP_Get_Level(xp) : 0

    return {
        name: stats.name || ("訪客" + Get_Anon_Id().slice(0, 4)),
        level: level,
        xp: xp,
        stages_completed_easy: stats.stages_completed_easy || 0,
        stages_completed_medium: stats.stages_completed_medium || 0,
        stages_completed_hard: stats.stages_completed_hard || 0,
        avg_wpm: stats.avg_wpm || 0,
        avg_acc: stats.avg_acc || 0,
        online_seconds: stats.online_seconds || 0,
        total_points: stats.total_points || 0,
        total_chars_typed: stats.total_chars_typed || 0,
        // 【新增】給「累積注音數（含空白、符號）」這個新的任務指標讀取現在值用，
        // 跟 total_chars_typed 並列、互不覆蓋，寫入端見 firebase.js 的
        // Sync_Zhuyin_Keys_Typed
        total_zhuyin_keys_typed: stats.total_zhuyin_keys_typed || 0,
        achievements_unlocked: stats.achievements_unlocked || 0,
        joined_at: firebase.database.ServerValue.TIMESTAMP
    }
}

/* ------------------------------------------------------------
   學生輸入代碼加入教室

   【修正】原本這裡完全沒有檢查登入狀態，任何人（包含從沒登入過、
   只是瀏覽器自動幫他做「匿名登入」的訪客）都能直接寫入
   classroom_students/{classroom_id}/{anon_id}。這會導致：
   1. 訪客沒登入也能加入教室——換瀏覽器、清 localStorage，
      這筆「加入紀錄」就跟著這台裝置的舊 anon_id 一起消失，
      老師名單上會殘留一堆再也連不上真人的「幽靈學生」。
   2. 因為「加入教室」面板原本只有沒登入的訪客才看得到（見檔案最下面
      DOMContentLoaded 的判斷邏輯），所以已登入的學生反而永遠碰不到
      這個功能——這就是「登入後只有建立教室/教室列表」那個問題的根源。

   現在改成跟 CLS_Create_Classroom 同一套模式：先用 Wait_For_Auth_Ready()
   拿到 Firebase Auth 給的最新 user 物件，確認 isAnonymous === false
   （代表這是玩家自己登入的正式帳號，不是網站自動幫他做的匿名登入）
   才放行，沒登入就回傳 not_logged_in 錯誤，UI 那邊會顯示對應訊息。
   ------------------------------------------------------------ */
function CLS_Join_Classroom(raw_code, callback){
    if(typeof Wait_For_Auth_Ready !== "function"){
        callback({ error: "not_logged_in" })
        return
    }

    Wait_For_Auth_Ready(function(user){
        _CLS_Join_Classroom_After_Auth_Ready(user, raw_code, callback)
    })
}

// 【新增】實際的加入邏輯搬進這支函式，等 Wait_For_Auth_Ready 確定登入狀態後才呼叫。
// CLS_Is_Teacher_Eligible 這個函式名稱雖然寫「Teacher」，但它實際檢查的只是
// 「這是不是玩家自己登入的正式帳號」，跟老師/學生的身份無關（全站目前沒有
// 真正的角色欄位），這裡直接沿用同一個檢查函式，避免另外重複寫一份一模一樣的邏輯。
function _CLS_Join_Classroom_After_Auth_Ready(user, raw_code, callback){
    if(!CLS_Is_Teacher_Eligible(user)){
        callback({ error: "not_logged_in" })
        return
    }

    const code = (raw_code || "").trim().toUpperCase()
    if(!code){
        callback({ error: "empty_code" })
        return
    }

    tctc_db.ref(`classroom_codes/${code}`).once("value").then(function(snapshot){
        const classroom_id = snapshot.val()
        if(!classroom_id){
            callback({ error: "code_not_found" })
            return
        }

        const anon_id = Get_Anon_Id()

        tctc_db.ref(`player_stats/${anon_id}`).once("value").then(function(statsSnap){
            const stats = statsSnap.val() || {}
            const summary = CLS_Build_Student_Summary(stats)

            const updates = {}
            updates[`classroom_students/${classroom_id}/${anon_id}`] = summary
            updates[`player_stats/${anon_id}/classroom_id`] = classroom_id

            tctc_db.ref().update(updates).then(function(){
                CLS_Adjust_Student_Count(classroom_id, 1)   // 【新增】人數 +1
                callback({ classroom_id: classroom_id })
            }).catch(function(error){
                console.warn("[classroom] 加入教室失敗：", error.message)
                callback({ error: "write_failed" })
            })
        })
    }).catch(function(error){
        console.warn("[classroom] 查詢邀請代碼失敗：", error.message)
        callback({ error: "write_failed" })
    })
}

// ===== 重新整理自己在教室名單裡的摘要（開啟頁面時順便呼叫一次）=====
// 【修改】callback 現在會帶回這次算出的 summary 物件（不只是空物件 {}）。
// 任務進度（CLS_Get_Task_Contribution）需要「我現在的指標數值」才能算貢獻度，
// 這裡直接把剛剛算好的同一份 summary 交給呼叫端，不用為了拿這份資料
// 再另外對 player_stats 發一次 Firebase 請求。
function CLS_Refresh_My_Summary(classroom_id, callback){
    const anon_id = Get_Anon_Id()

    tctc_db.ref(`player_stats/${anon_id}`).once("value").then(function(statsSnap){
        const stats = statsSnap.val() || {}
        const summary = CLS_Build_Student_Summary(stats)

        tctc_db.ref(`classroom_students/${classroom_id}/${anon_id}`).set(summary)
            .then(function(){ if(callback) callback({ summary: summary }) })
            .catch(function(error){
                console.warn("[classroom] 重新整理摘要失敗：", error.message)
                // 就算雲端沒寫成功（例如網路不穩），summary 本身還是現場算好的正確值，
                // 一樣交給呼叫端用來算任務進度；只是老師端名單上的數字會慢一點才更新
                if(callback) callback({ error: "write_failed", summary: summary })
            })
    })
}

// ===== 離開教室：刪除名單裡的自己 + 清掉本機記住的 classroom_id =====
function CLS_Leave_Classroom(callback){
    const anon_id = Get_Anon_Id()

    tctc_db.ref(`player_stats/${anon_id}/classroom_id`).once("value").then(function(snap){
        const classroom_id = snap.val()
        if(!classroom_id){
            callback({ error: "not_in_classroom" })
            return
        }

        const updates = {}
        updates[`classroom_students/${classroom_id}/${anon_id}`] = null
        updates[`player_stats/${anon_id}/classroom_id`] = null

        tctc_db.ref().update(updates).then(function(){
            CLS_Adjust_Student_Count(classroom_id, -1)   // 【新增】人數 -1
            callback({})
        }).catch(function(error){
            console.warn("[classroom] 離開教室失敗：", error.message)
            callback({ error: "write_failed" })
        })
    })
}

/* ------------------------------------------------------------
   老師端：強制把某個學生踢出教室
   ------------------------------------------------------------ */
function CLS_Kick_Student(classroom_id, target_anon_id, callback){
    if(!classroom_id || !target_anon_id){
        callback({ error: "invalid_target" })
        return
    }

    const updates = {}
    updates[`classroom_students/${classroom_id}/${target_anon_id}`] = null
    updates[`player_stats/${target_anon_id}/classroom_id`] = null

    tctc_db.ref().update(updates).then(function(){
        CLS_Adjust_Student_Count(classroom_id, -1)   // 【新增】人數 -1
        callback({})
    }).catch(function(error){
        console.warn("[classroom] 踢出學生失敗：", error.message)
        callback({ error: "write_failed" })
    })
}

/* ------------------------------------------------------------
   【新增】老師端：讀出自己名下「所有教室」的清單（根目錄用）
   ------------------------------------------------------------
   只讀 classrooms/{id} 這個輕量節點（含 student_count），不碰
   classroom_students——列表頁只需要卡片摘要，不需要每間教室的完整
   學生名單，這樣不管老師開幾間教室，列表頁的流量都很小。
   ------------------------------------------------------------ */
function CLS_Load_Teacher_Classrooms(callback){
    if(typeof Wait_For_Auth_Ready !== "function"){
        callback({ is_teacher: false })
        return
    }

    Wait_For_Auth_Ready(function(user){
        _CLS_Load_Teacher_Classrooms_After_Auth_Ready(user, callback)
    })
}

function _CLS_Load_Teacher_Classrooms_After_Auth_Ready(user, callback){
    if(!CLS_Is_Teacher_Eligible(user)){
        callback({ is_teacher: false, user: user })
        return
    }

    const uid = user.uid

    tctc_db.ref(`teacher_classrooms/${uid}`).once("value").then(function(snap){
        const idMap = snap.val() || {}
        const ids = Object.keys(idMap)

        if(ids.length === 0){
            callback({ is_teacher: true, user: user, uid: uid, classrooms: [] })
            return
        }

        Promise.all(ids.map(function(id){
            return tctc_db.ref(`classrooms/${id}`).once("value")
        })).then(function(snapshots){
            const classrooms = snapshots
                .map(function(s, i){ return { classroom_id: ids[i], meta: s.val() } })
                .filter(function(c){ return !!c.meta })   // 保險：忽略已經被刪除但索引沒清乾淨的殘留 key

            callback({ is_teacher: true, user: user, uid: uid, classrooms: classrooms })
        }).catch(function(error){
            console.warn("[classroom] 讀取教室列表失敗：", error.message)
            callback({ is_teacher: true, user: user, uid: uid, classrooms: [], error: "read_failed" })
        })
    }).catch(function(error){
        console.warn("[classroom] 查詢教室索引失敗：", error.message)
        callback({ is_teacher: false, user: user, error: "read_failed" })
    })
}

/* ------------------------------------------------------------
   【新增】學生視角：單一任務列
   ------------------------------------------------------------
   一定會顯示「我的貢獻」進度條；如果是班級共同目標，額外多顯示一條
   「全班進度」——兩條分開顯示，讓學生同時看得到「我自己做多少」跟
   「全班還差多少」，不會因為只顯示加總進度而搞不清楚自己有沒有出力。
   ------------------------------------------------------------ */
function CLS_Build_Student_Task_Row_HTML(task, my_contribution, reached, collectiveTotal){
    const meta = task.meta
    const metricLabel = CLS_TASK_METRIC_LABELS[meta.metric] || meta.metric
    const goalLabel = meta.goal_type === "collective" ? "班級共同目標" : "個人目標"
    const isExpired = meta.deadline && Date.now() > meta.deadline

    const myPercent = meta.target_value > 0 ? Math.min(100, Math.round((my_contribution / meta.target_value) * 100)) : 0

    let collectiveBlock = ""
    if(meta.goal_type === "collective" && collectiveTotal !== null){
        const collectivePercent = meta.target_value > 0 ? Math.min(100, Math.round((collectiveTotal / meta.target_value) * 100)) : 0
        collectiveBlock = `
            <p class="cls_task_sub_label">全班進度</p>
            <div class="cls_row_progress_wrap">
                <div class="cls_row_progress_track">
                    <div class="cls_row_progress_fill" style="width:${collectivePercent}%;"></div>
                </div>
                <span class="cls_row_progress_text">${CLS_Format_Task_Value(meta.metric, collectiveTotal)} / ${CLS_Format_Task_Value(meta.metric, meta.target_value)}</span>
            </div>
        `
    }

    return `
        <div class="cls_task_row ${isExpired ? "cls_task_expired" : ""}">
            <div class="cls_task_row_top">
                <span class="cls_task_title">${CLS_Escape_Html(meta.title)}</span>
                ${reached ? '<span class="cls_task_done_tag">已達標</span>' : ""}
            </div>
            <p class="cls_task_meta">
                <span class="cls_task_badge">${goalLabel}</span>${metricLabel}・目標 ${CLS_Format_Task_Value(meta.metric, meta.target_value)}・${CLS_Format_Deadline(meta.deadline)}
            </p>
            <p class="cls_task_sub_label">我的貢獻</p>
            <div class="cls_row_progress_wrap">
                <div class="cls_row_progress_track">
                    <div class="cls_row_progress_fill" style="width:${myPercent}%;"></div>
                </div>
                <span class="cls_row_progress_text">${CLS_Format_Task_Value(meta.metric, my_contribution)} / ${CLS_Format_Task_Value(meta.metric, meta.target_value)}</span>
            </div>
            ${collectiveBlock}
        </div>
    `
}

// ===== 學生視角：渲染整份任務清單到 #cls_my_task_list =====
// studentsSnapshot 只有在「這批任務裡有班級共同目標」時才會有值（見下面
// DOMContentLoaded 呼叫端的判斷），沒有班級共同目標的話這裡永遠是 null，
// 對應的任務列就不會畫出「全班進度」那一段，也就不需要用到它。
function CLS_Render_Student_Tasks(tasks, my_summary, studentsSnapshot){
    const listEl = document.getElementById("cls_my_task_list")
    if(!listEl) return

    const anon_id = Get_Anon_Id()
    const taskIds = Object.keys(tasks || {}).filter(function(id){ return !!tasks[id].meta })

    // 顯示順序：還沒截止的排前面（依截止日近到遠），已截止的排最後，
    // 讓學生一眼看到「現在還來得及做」的任務，而不是被過期任務洗版
    taskIds.sort(function(a, b){
        const da = tasks[a].meta.deadline || Infinity
        const db = tasks[b].meta.deadline || Infinity
        const expiredA = da && Date.now() > da
        const expiredB = db && Date.now() > db
        if(expiredA !== expiredB) return expiredA ? 1 : -1
        return da - db
    })

    if(taskIds.length === 0){
        listEl.innerHTML = `<p class="cls_empty_text">老師還沒有指派任何任務</p>`
        return
    }

    listEl.innerHTML = taskIds.map(function(task_id){
        const task = tasks[task_id]
        const my_contribution = CLS_Get_Task_Contribution(task, anon_id, my_summary)
        const reached = my_contribution >= task.meta.target_value
        const collectiveTotal = (task.meta.goal_type === "collective" && studentsSnapshot)
            ? CLS_Get_Task_Collective_Total(task, studentsSnapshot)
            : null

        return CLS_Build_Student_Task_Row_HTML(task, my_contribution, reached, collectiveTotal)
    }).join("")
}


/* ------------------------------------------------------------
   老師端：讀出「單一間」教室的 metadata + 學生摘要名單 + 任務清單
   （進儀表板管理時才呼叫，跟列表頁的輕量讀取分開）

   【修改】多帶一個 classroom_tasks/{classroom_id}，這個節點資料量本來就很小
   （每個任務只有標題/指標/目標值等幾個欄位 + 每人一個數字的 baseline），
   跟 classrooms 的 metadata 一起用 Promise.all 讀，不需要額外的 loading 階段。
   ------------------------------------------------------------ */
function CLS_Load_Classroom_Detail(classroom_id, callback){
    Promise.all([
        tctc_db.ref(`classrooms/${classroom_id}`).once("value"),
        tctc_db.ref(`classroom_students/${classroom_id}`).once("value"),
        tctc_db.ref(`classroom_tasks/${classroom_id}`).once("value")
    ]).then(function(results){
        callback({
            classroom_id: classroom_id,
            meta: results[0].val() || {},
            students: results[1].val() || {},
            tasks: results[2].val() || {}
        })
    }).catch(function(error){
        console.warn("[classroom] 讀取教室詳細資料失敗：", error.message)
        callback({ error: "read_failed" })
    })
}

// ===== 依關卡完成度算百分比，跟 achv_data.js 的 getValue() 用同一套公式 =====
function CLS_Compute_Completion_Percent(student){
    if(typeof ACHV_Get_Total_Stage_Count !== "function") return 0

    const totalStages = ACHV_Get_Total_Stage_Count("easy") + ACHV_Get_Total_Stage_Count("medium") + ACHV_Get_Total_Stage_Count("hard")
    const completed = (student.stages_completed_easy || 0) + (student.stages_completed_medium || 0) + (student.stages_completed_hard || 0)

    return totalStages > 0 ? Math.round((completed / totalStages) * 100) : 0
}

/* ============================================================
   【新增】班級任務系統
   ------------------------------------------------------------
   資料結構：
   classroom_tasks/{classroom_id}/{task_id}
       meta: { title, metric, goal_type, target_value, deadline,
               created_at, created_by }
           metric     : "total_chars_typed" | "total_zhuyin_keys_typed" | "xp" | "stage_completion_percent"
               【新增】total_zhuyin_keys_typed：跟 total_chars_typed 是完全獨立的
               兩個欄位，分別對應「累積中文字數」與「累積注音數（含空白、符號）」，
               寫入端見 firebase.js 的 Sync_Chars_Typed / Sync_Zhuyin_Keys_Typed，
               不會互相影響、互相覆蓋。
           goal_type  : "individual"（每人各自要達標）| "collective"（全班加總）
           deadline   : 毫秒時間戳（那天 23:59:59）
       baselines/{anon_id} : number
           這個學生「第一次被這個任務算到」當下的指標原始值，用來當
           貢獻度的起跑點——貢獻度 = 現在的值 - baseline，不會把任務
           出來之前、學生本來就累積的量也算進達標門檻。
           寫入時機有兩種，寫的人不一樣，但都只會寫一次（Rules 用
           !data.exists() 擋住覆寫，跟student_count那種「開放寫入但
           用規則保護」的手法是同一套邏輯）：
           (a) 老師建立任務當下，幫「當時已經在教室裡」的每個學生各寫一筆
           (b) 學生任務建立「之後」才加入教室，或任務出來時他人不在線上，
               之後第一次看到這個任務時，由學生自己的瀏覽器幫自己補一筆
               （見 CLS_Ensure_My_Task_Baselines）
   ------------------------------------------------------------ */

const CLS_TASK_METRIC_LABELS = {
    total_chars_typed: "累積中文字數",
    // 【新增】跟 total_chars_typed 是兩個獨立欄位（見 firebase.js 的
    // Sync_Zhuyin_Keys_Typed），只會被逐字注音模式的關卡累加，直接輸入
    // （IME）模式不會動到這個數字
    total_zhuyin_keys_typed: "累積注音數（含空白、符號）",
    xp: "累積 XP",
    stage_completion_percent: "關卡完成度"
}

// ===== 依指標種類，從一份「學生摘要物件」算出這個指標「現在」的原始數值 =====
// stage_completion_percent 沒有現成欄位存著，借用上面的 CLS_Compute_Completion_Percent()
// 現場算——這樣「任務進度看到的百分比」跟「學生名單那條進度條」永遠是同一套公式算出來的，
// 不會出現兩個地方顯示的關卡完成度對不上的情況。
function CLS_Get_Metric_Value(summary, metric){
    if(!summary) return 0
    if(metric === "stage_completion_percent") return CLS_Compute_Completion_Percent(summary)
    return summary[metric] || 0
}

// ===== 老師建立任務 =====
// studentsSnapshot：目前這間教室 classroom_students 的完整內容（老師端本來就
// 整包下載過一次，直接沿用，不用再多發一次 Firebase 請求），用來幫每個已經
// 在教室裡的學生，各自算出「這個指標現在的值」當基準值。
function CLS_Create_Task(classroom_id, taskData, studentsSnapshot, callback){
    if(!classroom_id){
        callback({ error: "invalid_target" })
        return
    }

    const task_id = tctc_db.ref(`classroom_tasks/${classroom_id}`).push().key
    const metric = taskData.metric

    const updates = {}
    updates[`classroom_tasks/${classroom_id}/${task_id}/meta`] = {
        title: taskData.title,
        metric: metric,
        goal_type: taskData.goal_type,
        target_value: taskData.target_value,
        deadline: taskData.deadline,
        created_at: firebase.database.ServerValue.TIMESTAMP,
        created_by: taskData.teacher_uid
    }

    Object.keys(studentsSnapshot || {}).forEach(function(anon_id){
        updates[`classroom_tasks/${classroom_id}/${task_id}/baselines/${anon_id}`] =
            CLS_Get_Metric_Value(studentsSnapshot[anon_id], metric)
    })

    tctc_db.ref().update(updates).then(function(){
        callback({ task_id: task_id })
    }).catch(function(error){
        console.warn("[classroom] 建立任務失敗：", error.message)
        callback({ error: "write_failed" })
    })
}

// ===== 老師刪除任務：整包（meta + 所有人的 baselines）一起砍掉 =====
function CLS_Delete_Task(classroom_id, task_id, callback){
    if(!classroom_id || !task_id){
        callback({ error: "invalid_target" })
        return
    }

    tctc_db.ref(`classroom_tasks/${classroom_id}/${task_id}`).remove().then(function(){
        callback({})
    }).catch(function(error){
        console.warn("[classroom] 刪除任務失敗：", error.message)
        callback({ error: "write_failed" })
    })
}

// ===== 讀出某間教室目前所有任務（含每人的 baselines）=====
function CLS_Load_Tasks(classroom_id, callback){
    tctc_db.ref(`classroom_tasks/${classroom_id}`).once("value").then(function(snap){
        callback(snap.val() || {})
    }).catch(function(error){
        console.warn("[classroom] 讀取任務失敗：", error.message)
        callback({})
    })
}

// ===== 【重要】確保「我」在每個任務裡都有 baseline，沒有的話現場補一筆 =====
// 補寫用的值是「現在」的指標數值，不是回溯任務建立當下的值——這樣不管是
// 「任務出來之後才加入教室」還是「加入教室很久之後任務才出來、剛好這幾天
// 沒開網站錯過同步」，這個學生的貢獻度都是從「他自己第一次被系統看到」
// 那一刻開始算，不會因為晚看到任務而莫名其妙一次領先或落後一大截。
function CLS_Ensure_My_Task_Baselines(classroom_id, tasks, my_summary, callback){
    const anon_id = Get_Anon_Id()
    const updates = {}

    Object.keys(tasks || {}).forEach(function(task_id){
        const task = tasks[task_id]
        if(!task.meta) return   // 保險：忽略資料不完整的殘留節點
        if(task.baselines && task.baselines.hasOwnProperty(anon_id)) return   // 已經有了，不用補

        updates[`classroom_tasks/${classroom_id}/${task_id}/baselines/${anon_id}`] =
            CLS_Get_Metric_Value(my_summary, task.meta.metric)
    })

    if(Object.keys(updates).length === 0){
        callback(tasks)   // 沒有缺的，原封不動把讀到的資料丟回去就好
        return
    }

    tctc_db.ref().update(updates).then(function(){
        // 補寫成功後順便同步進這份本地物件，呼叫端不用再重新讀一次 Firebase
        Object.keys(updates).forEach(function(path){
            const task_id = path.split("/")[2]
            if(!tasks[task_id].baselines) tasks[task_id].baselines = {}
            tasks[task_id].baselines[anon_id] = updates[path]
        })
        callback(tasks)
    }).catch(function(error){
        console.warn("[classroom] 補寫任務基準值失敗：", error.message)
        callback(tasks)   // 補寫失敗不擋住畫面顯示，下次重新整理再試一次即可
    })
}

// ===== 算出「這個學生」在這個任務裡的貢獻度：現在值 - 基準值，最低是 0 =====
// Math.max(0, ...) 是保險：理論上指標只會越變越大（打字字數、XP、關卡完成度
// 都是累加型數據，不會倒退），但如果哪天基準值補寫的時機比預期晚、算出負數，
// 至少畫面不會顯示「貢獻 -30 字」這種荒謬的數字。
function CLS_Get_Task_Contribution(task, anon_id, summary){
    if(!task.meta) return 0
    const baseline = (task.baselines && task.baselines[anon_id] !== undefined)
        ? task.baselines[anon_id]
        : CLS_Get_Metric_Value(summary, task.meta.metric)
    const current = CLS_Get_Metric_Value(summary, task.meta.metric)
    return Math.max(0, current - baseline)
}

// ===== 算出整個班級在這個任務裡的加總貢獻（班級共同目標用）=====
function CLS_Get_Task_Collective_Total(task, studentsSnapshot){
    let total = 0
    Object.keys(studentsSnapshot || {}).forEach(function(anon_id){
        total += CLS_Get_Task_Contribution(task, anon_id, studentsSnapshot[anon_id])
    })
    return total
}

// ===== 截止日期顯示文字：剩幾天 / 已截止幾天 =====
function CLS_Format_Deadline(deadline){
    if(!deadline) return "無期限"

    const now = Date.now()
    const dateStr = new Date(deadline).toLocaleDateString("zh-TW")
    // Math.ceil 讓「還沒到截止時間，但只剩幾小時」這種情況顯示「剩 1 天」而不是「剩 0 天」，
    // 對學生來說比較不會誤會成「已經沒時間了」
    const diffDays = Math.ceil((deadline - now) / 86400000)

    if(diffDays < 0) return `已截止・${dateStr}`
    if(diffDays === 0) return `今天截止`
    return `剩 ${diffDays} 天・${dateStr}`
}

// ===== 依指標種類，把數值格式化成人看得懂的字串（百分比 vs 一般數字）=====
function CLS_Format_Task_Value(metric, value){
    if(metric === "stage_completion_percent") return `${Math.round(value)}%`
    return Math.round(value).toLocaleString("zh-TW")
}

/* ============================================================
   【新增】班級任務彈窗通知（每次進度推進都彈，不再卡門檻）
   ------------------------------------------------------------
   跟 achv_notify.js 的作法一致：本機 localStorage 記住「這個任務上次
   看到的進度數值」，每次重新檢查時拿現在的進度重新比對，只要比上次
   記錄的還高（哪怕只多一點點），就算一次推進，彈窗顯示「這次增加了
   多少 + 目前進度 / 目標（百分比）」。

   【修改】原本是把 0~100% 切成 25/50/75/100 四個門檻，只有「跨過門檻」
   才彈窗（模擬成就系統的分級感），但這樣玩家打完一關、進度明明有動，
   卻常常因為還沒跨過下一個門檻而完全沒反應，不符合「打完一關就想看到
   回饋」的需求。現在改成直接比較「這次的原始進度值」跟「上次記錄的
   原始進度值」，只要有增加就彈，不再需要門檻切分。

   共同目標（goal_type: "collective"）用「全班加總進度」去比較，個人
   目標則用「我自己的貢獻度」去比較，這點跟原本邏輯一致，沒有變。

   彈窗的徽章顏色仍然沿用銅/銀/金/白金，但現在純粹是「目前進度落在
   哪個百分比區間」的裝飾用途，不再是「有沒有跨過門檻」的判斷依據——
   判斷依據只剩下「current 是否比上次記錄的還高」這一件事。
   ------------------------------------------------------------ */
const CLS_NOTIFY_SEEN_KEY = "tctc2.0-cls_seen_progress"   // { task_id: 已看過的最新進度原始值 }

function CLS_Notify_Get_Seen(){
    try {
        return JSON.parse(localStorage.getItem(CLS_NOTIFY_SEEN_KEY)) || {}
    } catch(e){
        // JSON 壞掉就當全新開始，效果等同「這台瀏覽器的任務進度重新走一次
        // 『第一次看到只記錄、不彈窗』流程」，不會導致功能整個壞掉
        return {}
    }
}
function CLS_Notify_Save_Seen(seen){
    try {
        localStorage.setItem(CLS_NOTIFY_SEEN_KEY, JSON.stringify(seen))
    } catch(e){
        console.warn("[classroom] 寫入本機任務進度紀錄失敗：", e.message)
    }
}

// 純粹給彈窗徽章挑一個裝飾用的顏色，跟「要不要彈窗」的判斷完全無關
function CLS_Get_Progress_Tier_Class(percent){
    if(percent >= 100) return "pach_tier_platinum"
    if(percent >= 75) return "pach_tier_gold"
    if(percent >= 50) return "pach_tier_silver"
    if(percent >= 25) return "pach_tier_bronze"
    return ""
}

// 核心比對邏輯：傳入這次渲染用的同一份 tasksReady / my_summary / studentsSnapshot
// （跟 CLS_Render_Student_Tasks 共用同一份，不重新多發一次 Firebase 請求），
// 回傳「這次真的偵測到進度推進」的陣列（可能是空陣列），不管推進了多少
function CLS_Notify_Diff(tasksReady, my_summary, studentsSnapshot){
    const anon_id = Get_Anon_Id()
    const seen = CLS_Notify_Get_Seen()
    const newlyAdvanced = []
    let seenChanged = false

    Object.keys(tasksReady || {}).forEach(function(task_id){
        const task = tasksReady[task_id]
        if(!task.meta) return   // 保險：忽略資料不完整的殘留節點

        const target = task.meta.target_value
        const current = (task.meta.goal_type === "collective")
            ? CLS_Get_Task_Collective_Total(task, studentsSnapshot || {})
            : CLS_Get_Task_Contribution(task, anon_id, my_summary)

        const stored = seen[task_id]   // undefined 代表「這支瀏覽器從來沒記錄過這個任務」

        if(stored === undefined){
            // 第一次看到這個任務：只建立 baseline，不彈窗——避免任務剛出現、
            // 或這支腳本剛上線那一刻，把學生早就累積好的進度當成
            // 「這次才推進」轟炸彈窗，跟 achv_notify.js 的設計取捨一致
            seen[task_id] = current
            seenChanged = true
            return
        }

        if(current > stored){
            // 【修改】只要比上次記錄的高就算推進，不再要求跨過 25/50/75/100
            // 其中一個門檻——這樣玩家打完一關，只要這關對這個任務有貢獻，
            // 就一定會看到彈窗，符合「每一次都要有回饋」的需求
            const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
            newlyAdvanced.push({
                title: task.meta.title,
                metric: task.meta.metric,
                delta: current - stored,
                current: current,
                target: target,
                percent: percent,
                reached: target > 0 && current >= target
            })
            seen[task_id] = current
            seenChanged = true
        }
        // current <= stored：一律不降記錄、不彈窗，理由同 achv_notify.js——
        // 可能是資料還沒完全同步完成時讀到的暫時低值
    })

    if(seenChanged) CLS_Notify_Save_Seen(seen)

    return newlyAdvanced
}

// ===== 彈窗渲染：直接沿用 achv_notify.js 已經建好的通知容器／CSS class，
// 不另外設計一套彈窗外觀——「班級任務」通知跟「成就解鎖」通知應該是
// 同一個通知系統底下的兩種內容，不是兩套長得不一樣的彈窗。
// 需要 TCTC2-0-achv_notify.js / TCTC2-0-achv_notify.css 先被載入，
// classroom.html 要記得補上這兩個 <link>/<script>。 =====
function CLS_Notify_Show_Toast(item){
    if(typeof ACHV_Notify_Ensure_Container !== "function"){
        console.warn("[classroom] 找不到 ACHV_Notify_Ensure_Container，請確認有先載入 TCTC2-0-achv_notify.js")
        return
    }

    const container = ACHV_Notify_Ensure_Container()
    const tierClass = item.reached ? "pach_tier_platinum" : CLS_Get_Progress_Tier_Class(item.percent)
    const icon = (typeof ACHV_ICON_FLAG !== "undefined") ? ACHV_ICON_FLAG : ""

    const deltaText = CLS_Format_Task_Value(item.metric, item.delta)
    const progressText = `${CLS_Format_Task_Value(item.metric, item.current)} / ${CLS_Format_Task_Value(item.metric, item.target)}（${item.percent}%）`

    const toast = document.createElement("div")
    toast.className = "achv_notify_toast"
    toast.innerHTML = `
        <div class="achv_notify_medal ${tierClass}">${icon}</div>
        <div class="achv_notify_body">
            <p class="achv_notify_eyebrow">班級任務・${item.reached ? "已達成" : "+" + deltaText}</p>
            <p class="achv_notify_name">${CLS_Escape_Html(item.title)}</p>
            <p class="achv_notify_tier">${progressText}</p>
        </div>
    `
    // 點一下通知卡直接跳去教室頁看完整進度，順便當作「立刻關閉」的手動方式，
    // 跟 achv_notify.js 點通知卡跳榮譽牆的手法一致
    toast.addEventListener("click", function(){
        window.location.href = "TCTC2-0-classroom.html"
    })

    container.appendChild(toast)

    // 進場動畫延後一幀才加 show class，理由跟 achv_notify.js 的
    // ACHV_Notify_Show_Toast 完全一樣：避免瀏覽器把「初始狀態」跟
    // 「顯示狀態」合併成同一次繪製，animation 播不出來
    requestAnimationFrame(function(){
        toast.classList.add("achv_notify_toast_show")
    })

    setTimeout(function(){
        toast.classList.remove("achv_notify_toast_show")
        toast.classList.add("achv_notify_toast_hide")
        setTimeout(function(){ toast.remove() }, 320)
    }, 4800)
}

/* ============================================================
   【新增】跨頁面版的班級任務通知檢查
   ------------------------------------------------------------
   上面的 CLS_Notify_Diff / CLS_Notify_Show_Toast 原本只掛在教室頁面
   自己的渲染流程裡（見 CLS_Render_Student_Tasks 兩個呼叫點後面），玩家
   要「下次打開教室頁」才會看到任務推進的通知——這是本檔案開頭那段
   【刻意的範圍限制】註解講的、當初先不接 firebase.js 的取捨。

   這裡補上那個後續：一個不依賴教室頁面 DOM、可以從任何頁面呼叫的
   獨立版本，自己重新走一次「讀 classroom_id → 我的 summary → 班級
   任務 → 里程碑比對」的完整流程，讓玩家「打完一關的當下」就能在
   game.html / TCTC2-0-challenge.html 上直接看到教室任務推進的彈窗，
   不用先跳轉去教室頁才看得到。

   呼叫端：TCTC2-0-firebase.js 裡幾個「這次寫入真的成功了」的 Sync_XXX
   回呼點（Sync_Stage_Completion / Sync_Chars_Typed /
   Sync_Zhuyin_Keys_Typed），跟 ACHV_Schedule_Notify_Check（achv_notify.js）
   用的是同一批掛勾點、同一顆「result.committed」訊號，理由也一樣：
   同一次結算背後是好幾個各自獨立、互不等待的 transaction，用 debounce
   （CLS_Schedule_Task_Notify_Check）讓它們先安定下來，才真正檢查一次。

   如果玩家根本沒加入任何教室，這裡只花一次 player_stats/classroom_id
   的讀取就結束，成本很低，所以不用另外判斷「現在是不是在教室頁」才呼叫，
   每個有載入這支檔案的頁面都可以放心呼叫。
   ------------------------------------------------------------ */
function CLS_Check_Task_Notify(){
    if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined") return

    const anon_id = Get_Anon_Id()
    if(!anon_id) return

    tctc_db.ref(`player_stats/${anon_id}/classroom_id`).once("value").then(function(snap){
        const classroom_id = snap.val()
        if(!classroom_id) return   // 沒加入任何教室，不用往下做

        // 跟教室頁面同一套流程：先補齊我最新的 summary（任務貢獻度要用
        // 「現在的指標值」才準），再載入任務、補齊 baseline、跑里程碑比對
        CLS_Refresh_My_Summary(classroom_id, function(refreshResult){
            const my_summary = refreshResult.summary || {}

            CLS_Load_Tasks(classroom_id, function(tasks){
                CLS_Ensure_My_Task_Baselines(classroom_id, tasks, my_summary, function(tasksReady){
                    // 只有真的有共同目標任務時，才多花一次讀取抓全班資料算加總，
                    // 理由跟教室頁面那邊的 needsCollective 判斷完全一致
                    const needsCollective = Object.keys(tasksReady).some(function(id){
                        return tasksReady[id].meta && tasksReady[id].meta.goal_type === "collective"
                    })

                    if(needsCollective){
                        tctc_db.ref(`classroom_students/${classroom_id}`).once("value").then(function(studentsSnap){
                            const studentsVal = studentsSnap.val() || {}
                            CLS_Notify_Diff(tasksReady, my_summary, studentsVal).forEach(CLS_Notify_Show_Toast)
                        })
                    } else {
                        CLS_Notify_Diff(tasksReady, my_summary, null).forEach(CLS_Notify_Show_Toast)
                    }
                })
            })
        })
    }).catch(function(error){
        console.warn("[classroom] 打完關卡後檢查班級任務進度失敗：", error.message)
    })
}

// debounce 理由跟 achv_notify.js 的 ACHV_Schedule_Notify_Check 完全一樣：
// 同一次結算會觸發好幾個各自獨立的 Sync_XXX transaction，重複呼叫這支
// 函式只會延後、不會疊加，等所有寫入安定下來後才真正檢查一次，避免
// 同一次結算被拆成好幾次讀取、甚至彈出好幾張內容重複的通知卡
const CLS_TASK_NOTIFY_DEBOUNCE_MS = 1200
let cls_task_notify_debounce_timer = null
function CLS_Schedule_Task_Notify_Check(){
    if(cls_task_notify_debounce_timer) clearTimeout(cls_task_notify_debounce_timer)
    cls_task_notify_debounce_timer = setTimeout(function(){
        cls_task_notify_debounce_timer = null
        CLS_Check_Task_Notify()
    }, CLS_TASK_NOTIFY_DEBOUNCE_MS)
}

/* ------------------------------------------------------------
   【新增】把一間教室的學生摘要名單，加總成「班級戰績」
   ------------------------------------------------------------
   全部從已經下載好的 classroom_students 摘要算出來，不額外發任何
   Firebase 請求。「班級之星」目前用 XP 最高當標準——這個數字跟等級
   系統邏輯一致，也不會跟名單本身已經顯示的「平均WPM」重複，
   如果之後想換成別的指標（例如打字量最高），只要改這裡的比較條件。
   ------------------------------------------------------------ */
function CLS_Compute_Classroom_Aggregate(students){
    const entries = Object.entries(students || {})

    let totalChars = 0
    let totalXp = 0
    let starName = "—"
    let starXp = -1

    entries.forEach(function(entry){
        const s = entry[1]
        totalChars += s.total_chars_typed || 0
        totalXp += s.xp || 0

        if((s.xp || 0) > starXp){
            starXp = s.xp || 0
            starName = s.name || "（未命名）"
        }
    })

    return {
        student_count: entries.length,
        total_chars: totalChars,
        total_xp: totalXp,
        star_name: entries.length > 0 ? starName : "—",
        star_xp: entries.length > 0 ? starXp : 0
    }
}

/* ============================================================
   以下是畫面渲染 / DOM 邏輯
   ============================================================ */

function CLS_Escape_Html(text){
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

// 目前顯示中的資料快照：
// - CLS_Current_Teacher_List：教室列表頁用（陣列）
// - CLS_Current_Teacher_Data：單一教室儀表板用（沿用舊名，維持相容）
let CLS_Current_Teacher_List = null
let CLS_Current_Teacher_Data = null
let CLS_Current_Teacher_Uid = null

// 【修改】面板清單加入 cls_login_required（未登入提示，見下方 DOMContentLoaded 的新判斷流程）
function CLS_Show_Panel(panelId){
    const panels = ["cls_loading", "cls_login_required", "cls_teacher_list", "cls_teacher_dashboard", "cls_student_status", "cls_join_create_panel"]
    panels.forEach(function(id){
        const el = document.getElementById(id)
        if(el) el.classList.toggle("is_hidden", id !== panelId)
    })
}

// ===== 【新增】單張教室卡片（教室列表頁用）=====
function CLS_Build_Classroom_Card_HTML(classroom_id, meta){
    return `
        <div class="cls_list_card">
            <div class="cls_list_card_info">
                <p class="cls_list_card_name">${CLS_Escape_Html(meta.name || "（未命名教室）")}</p>
                <p class="cls_list_card_meta">邀請代碼：<span>${meta.join_code || "------"}</span>・${meta.student_count || 0} 位學生</p>
            </div>
            <div class="cls_list_card_actions">
                <button type="button" class="cls_primary_btn cls_manage_btn" data-classroom-id="${encodeURIComponent(classroom_id)}">管理</button>
                <button type="button" class="cls_danger_btn cls_dissolve_list_btn" data-classroom-id="${encodeURIComponent(classroom_id)}" data-name="${encodeURIComponent(meta.name || "這間教室")}" data-join-code="${encodeURIComponent(meta.join_code || "")}">解散</button>
            </div>
        </div>
    `
}

// ===== 【新增】渲染教室列表頁 =====
function CLS_Render_Teacher_List(result){
    CLS_Show_Panel("cls_teacher_list")

    CLS_Current_Teacher_List = result.classrooms || []
    CLS_Current_Teacher_Uid = result.uid

    const countEl = document.getElementById("cls_list_count")
    const gridEl = document.getElementById("cls_list_grid")
    const emptyEl = document.getElementById("cls_list_empty")

    const list = CLS_Current_Teacher_List
    if(countEl) countEl.textContent = `${list.length} 間教室`
    if(emptyEl) emptyEl.classList.toggle("is_hidden", list.length > 0)

    if(gridEl){
        gridEl.innerHTML = list.map(function(c){
            return CLS_Build_Classroom_Card_HTML(c.classroom_id, c.meta)
        }).join("")

        // 事件代理：管理／解散按鈕都綁在容器上，只綁一次
        if(!gridEl.dataset.bound){
            gridEl.dataset.bound = "1"

            gridEl.addEventListener("click", function(e){
                const manageBtn = e.target.closest(".cls_manage_btn")
                if(manageBtn){
                    const id = decodeURIComponent(manageBtn.dataset.classroomId || "")
                    if(id) CLS_Enter_Classroom_Dashboard(id)
                    return
                }

                const dissolveBtn = e.target.closest(".cls_dissolve_list_btn")
                if(dissolveBtn){
                    const id = decodeURIComponent(dissolveBtn.dataset.classroomId || "")
                    const name = decodeURIComponent(dissolveBtn.dataset.name || "這間教室")
                    const joinCode = decodeURIComponent(dissolveBtn.dataset.joinCode || "")
                    CLS_Handle_Dissolve(id, joinCode, dissolveBtn, name, function(){
                        // 成功後從快照移除、重新渲染列表
                        CLS_Current_Teacher_List = CLS_Current_Teacher_List.filter(function(c){
                            return c.classroom_id !== id
                        })
                        CLS_Render_Teacher_List({ classrooms: CLS_Current_Teacher_List, uid: CLS_Current_Teacher_Uid })
                    })
                }
            })
        }
    }
}

// ===== 進入某間教室的管理儀表板 =====
function CLS_Enter_Classroom_Dashboard(classroom_id){
    CLS_Show_Panel("cls_loading")
    CLS_Load_Classroom_Detail(classroom_id, function(result){
        if(result.error){
            window.alert("讀取教室資料失敗，請稍後再試一次")
            CLS_Render_Teacher_List({ classrooms: CLS_Current_Teacher_List, uid: CLS_Current_Teacher_Uid })
            return
        }
        CLS_Render_Teacher_Dashboard(result)
    })
}

// ===== 共用的「解散教室」處理流程（列表頁／儀表板頁都會呼叫）=====
function CLS_Handle_Dissolve(classroom_id, join_code, btnEl, displayName, onSuccess){
    if(!window.confirm(`確定要解散「${displayName}」嗎？\n這個動作無法復原，所有學生都會被移出這間教室。`)) return

    btnEl.disabled = true
    btnEl.textContent = "解散中..."

    CLS_Dissolve_Classroom(classroom_id, CLS_Current_Teacher_Uid, join_code, function(result){
        if(result.error){
            window.alert("解散失敗，請稍後再試一次")
            btnEl.disabled = false
            btnEl.textContent = "解散"
            return
        }
        onSuccess()
    })
}

// ===== 【新增】班級戰績卡片 HTML =====
function CLS_Build_Stats_Grid_HTML(aggregate){
    return `
        <div class="cls_stat_box">
            <p class="cls_stat_box_label">學生數</p>
            <p class="cls_stat_box_value">${aggregate.student_count}</p>
        </div>
        <div class="cls_stat_box">
            <p class="cls_stat_box_label">班級總打字數</p>
            <p class="cls_stat_box_value">${aggregate.total_chars.toLocaleString("zh-TW")}</p>
        </div>
        <div class="cls_stat_box">
            <p class="cls_stat_box_label">班級總 XP</p>
            <p class="cls_stat_box_value">${aggregate.total_xp.toLocaleString("zh-TW")}</p>
        </div>
        <div class="cls_stat_box cls_stat_box_star">
            <p class="cls_stat_box_label">班級之星（XP 最高）</p>
            <p class="cls_stat_box_value">${CLS_Escape_Html(aggregate.star_name)}</p>
        </div>
    `
}

/* ------------------------------------------------------------
   【新增】老師視角：單一任務列
   ------------------------------------------------------------
   兩種目標型態顯示的「整體完成描述」邏輯不一樣：
   - 班級共同目標：全班貢獻度加總 vs 目標值，一條進度條就代表整體進度
   - 個人目標：每人各自的貢獻度是否達標，老師更在意的是「幾個人做到了」，
     所以改顯示「達標人數 / 全班人數」，比起「平均完成率」更直接有意義
     （例如 20 人裡 19 人早就達標、1 人完全沒動，平均完成率看起來很漂亮，
     但其實有一個學生完全沒在做，老師應該看得出來這個警訊）
   ------------------------------------------------------------ */
function CLS_Build_Teacher_Task_Row_HTML(task_id, task, studentsSnapshot){
    const meta = task.meta
    const metricLabel = CLS_TASK_METRIC_LABELS[meta.metric] || meta.metric
    const goalLabel = meta.goal_type === "collective" ? "班級共同目標" : "個人目標"
    const isExpired = meta.deadline && Date.now() > meta.deadline

    let progressPercent, statusText

    if(meta.goal_type === "collective"){
        const total = CLS_Get_Task_Collective_Total(task, studentsSnapshot)
        progressPercent = meta.target_value > 0 ? Math.min(100, Math.round((total / meta.target_value) * 100)) : 0
        statusText = `全班加總 ${CLS_Format_Task_Value(meta.metric, total)} / ${CLS_Format_Task_Value(meta.metric, meta.target_value)}`
    } else {
        const entries = Object.keys(studentsSnapshot || {})
        const achievedCount = entries.filter(function(anon_id){
            return CLS_Get_Task_Contribution(task, anon_id, studentsSnapshot[anon_id]) >= meta.target_value
        }).length
        progressPercent = entries.length > 0 ? Math.round((achievedCount / entries.length) * 100) : 0
        statusText = `${achievedCount} / ${entries.length} 位學生已達標`
    }

    return `
        <div class="cls_task_row ${isExpired ? "cls_task_expired" : ""}">
            <div class="cls_task_row_top">
                <span class="cls_task_title">${CLS_Escape_Html(meta.title)}</span>
                <div class="cls_task_row_actions">
                    <button type="button" class="cls_task_detail_toggle_btn" data-task-id="${encodeURIComponent(task_id)}">查看每人進度</button>
                    <button type="button" class="cls_task_delete_btn" data-task-id="${encodeURIComponent(task_id)}">刪除</button>
                </div>
            </div>
            <p class="cls_task_meta">
                <span class="cls_task_badge">${goalLabel}</span>${metricLabel}・目標 ${CLS_Format_Task_Value(meta.metric, meta.target_value)}・${CLS_Format_Deadline(meta.deadline)}
            </p>
            <div class="cls_row_progress_wrap">
                <div class="cls_row_progress_track">
                    <div class="cls_row_progress_fill" style="width:${progressPercent}%;"></div>
                </div>
                <span class="cls_row_progress_text">${statusText}</span>
            </div>
            <div class="cls_task_detail is_hidden" id="cls_task_detail_${task_id}">
                ${CLS_Build_Task_Student_Breakdown_HTML(task, studentsSnapshot)}
            </div>
        </div>
    `
}

/* ------------------------------------------------------------
   【新增】老師視角：單一任務底下，每個學生各自的貢獻明細
   ------------------------------------------------------------
   點「查看每人進度」才會展開（見下面 CLS_Render_Teacher_Dashboard 的
   事件綁定），預設不渲染在畫面上是為了避免任務一多、學生一多時，
   一次把所有任務的所有學生明細都攤開，畫面會變得又長又亂。

   排序依「貢獻度高到低」，這樣老師一眼就能看到「衝最快的幾個人」在
   最上面，「完全沒動的人」自然沉到最下面，比照打字排行榜的直覺。
   ------------------------------------------------------------ */
function CLS_Build_Task_Student_Breakdown_HTML(task, studentsSnapshot){
    const meta = task.meta
    const entries = Object.keys(studentsSnapshot || {}).map(function(anon_id){
        const student = studentsSnapshot[anon_id]
        return {
            anon_id: anon_id,
            name: student.name || "（未命名）",
            contribution: CLS_Get_Task_Contribution(task, anon_id, student)
        }
    })

    if(entries.length === 0){
        return `<p class="cls_empty_text">目前還沒學生加入該教室</p>`
    }

    entries.sort(function(a, b){ return b.contribution - a.contribution })

    const rows = entries.map(function(entry){
        const percent = meta.target_value > 0 ? Math.min(100, Math.round((entry.contribution / meta.target_value) * 100)) : 0
        const reached = entry.contribution >= meta.target_value

        return `
            <div class="cls_task_detail_row">
                <span class="cls_task_detail_name">${CLS_Escape_Html(entry.name)}</span>
                <div class="cls_row_progress_wrap">
                    <div class="cls_row_progress_track">
                        <div class="cls_row_progress_fill" style="width:${percent}%;"></div>
                    </div>
                    <span class="cls_row_progress_text">${CLS_Format_Task_Value(meta.metric, entry.contribution)} / ${CLS_Format_Task_Value(meta.metric, meta.target_value)}</span>
                </div>
                ${reached ? '<span class="cls_task_done_tag">已達標</span>' : ""}
            </div>
        `
    }).join("")

    return `<div class="cls_task_detail_list">${rows}</div>`
}

function CLS_Build_Student_Row_HTML(anon_id, student){
    const percent = CLS_Compute_Completion_Percent(student)
    const display_name = student.name || "（未命名）"

    return `
        <div class="cls_row">
            <span class="cls_row_name">
                <span class="rank_player_name_link" onclick="window.location.href='TCTC2-0-view_profile.html?id=${encodeURIComponent(anon_id)}'" title="查看個人資料">${CLS_Escape_Html(display_name)}</span>
            </span>
            <span class="rank_level_badge cls_row_level">LV ${student.level || 0}</span>
            <span class="cls_row_metric">${Math.round(student.avg_wpm || 0)}</span>
            <span class="cls_row_metric">${Math.round(student.avg_acc || 0)}%</span>
            <div class="cls_row_progress_wrap">
                <div class="cls_row_progress_track">
                    <div class="cls_row_progress_fill" style="width:${percent}%;"></div>
                </div>
                <span class="cls_row_progress_text">${percent}%</span>
            </div>
            <button type="button" class="cls_kick_btn" data-anon-id="${encodeURIComponent(anon_id)}" data-name="${encodeURIComponent(display_name)}">踢出</button>
        </div>
    `
}

function CLS_Render_Teacher_Dashboard(data){
    CLS_Show_Panel("cls_teacher_dashboard")

    CLS_Current_Teacher_Data = data

    const nameEl = document.getElementById("cls_classroom_name")
    const codeEl = document.getElementById("cls_join_code")
    const countEl = document.getElementById("cls_student_count")
    const listEl = document.getElementById("cls_student_list")
    const statsEl = document.getElementById("cls_stats_grid")

    if(nameEl) nameEl.textContent = data.meta.name || "（未命名教室）"
    if(codeEl) codeEl.textContent = data.meta.join_code || "------"

    const entries = Object.entries(data.students || {})
    entries.sort(function(a, b){
        return (a[1].name || "").localeCompare(b[1].name || "", "zh-Hant")
    })

    if(countEl) countEl.textContent = `${entries.length} 位學生`

    // 【新增】順手校正「教室列表頁」用的人數計數器（classrooms/{id}/student_count）
    // ------------------------------------------------------------
    // 背景：這裡的 entries.length 是從 classroom_students 真實名單算出來的
    // 「正確人數」；列表頁為了省流量，另外維護一個獨立計數欄位
    // （CLS_Adjust_Student_Count 在學生加入/離開時 +1/-1）。這個計數欄位
    // 是後來才加上去的機制，在它存在之前就已經加入教室的學生，從來沒有
    // 被計算過，會讓列表頁一直卡在 0 或某個過舊的數字，即使這裡（詳細頁）
    // 顯示的真實人數是對的。
    //
    // 不另外寫一支一次性 migration script，而是「每次老師打開這間教室的
    // 詳細頁，反正都已經讀到真實人數了，發現跟計數器對不上就順手修正」——
    // 不多花一次 Firebase 讀取，老師本人對 classrooms/{id} 有完整寫入權限
    // （見 database.rules.json），寫入不會被規則擋下來。多數情況兩個數字
    // 本來就一致，這裡不會真的觸發寫入。
    if(data.classroom_id && data.meta && (data.meta.student_count || 0) !== entries.length){
        tctc_db.ref(`classrooms/${data.classroom_id}/student_count`).set(entries.length)
            .then(function(){
                data.meta.student_count = entries.length   // 同步更新記憶體裡的快照，避免這個 session 內數字又對不上
            })
            .catch(function(error){
                console.warn("[classroom] 校正人數計數器失敗：", error.message)
            })
    }

    // 【新增】班級戰績
    if(statsEl){
        const aggregate = CLS_Compute_Classroom_Aggregate(data.students)
        statsEl.innerHTML = CLS_Build_Stats_Grid_HTML(aggregate)
    }

    // ===== 【新增】班級任務列表 =====
    const taskListEl = document.getElementById("cls_task_list")
    if(taskListEl){
        const taskIds = Object.keys(data.tasks || {}).filter(function(id){ return !!data.tasks[id].meta })

        // 顯示順序：離截止日越近的排越前面，讓老師一眼看到「快到期」的任務，
        // 已經沒有 deadline（理論上不會發生，保險用）的排最後
        taskIds.sort(function(a, b){
            return (data.tasks[a].meta.deadline || Infinity) - (data.tasks[b].meta.deadline || Infinity)
        })

        taskListEl.innerHTML = taskIds.length > 0
            ? taskIds.map(function(id){ return CLS_Build_Teacher_Task_Row_HTML(id, data.tasks[id], data.students) }).join("")
            : `<p class="cls_empty_text">目前還沒有指派任何任務</p>`

        if(!taskListEl.dataset.deleteBound){
            taskListEl.dataset.deleteBound = "1"
            taskListEl.addEventListener("click", function(e){
                // ----- 「查看每人進度」：純展開/收合，不用重新讀 Firebase，
                //       明細 HTML 早就跟主要進度條一起渲染好了，只是預設用
                //       is_hidden 藏起來（見 CLS_Build_Teacher_Task_Row_HTML），
                //       這裡只是切換 class + 按鈕文字。 -----
                const toggleBtn = e.target.closest(".cls_task_detail_toggle_btn")
                if(toggleBtn){
                    const task_id = decodeURIComponent(toggleBtn.dataset.taskId || "")
                    const detailEl = document.getElementById(`cls_task_detail_${task_id}`)
                    if(detailEl){
                        const nowHidden = detailEl.classList.toggle("is_hidden")
                        toggleBtn.textContent = nowHidden ? "查看每人進度" : "收合"
                    }
                    return
                }

                const btn = e.target.closest(".cls_task_delete_btn")
                if(!btn) return

                const task_id = decodeURIComponent(btn.dataset.taskId || "")
                if(!task_id || !CLS_Current_Teacher_Data) return

                if(!window.confirm("確定要刪除這個任務嗎？學生會立刻看不到它，這個動作無法復原。")) return

                btn.disabled = true
                btn.textContent = "刪除中..."

                CLS_Delete_Task(CLS_Current_Teacher_Data.classroom_id, task_id, function(result){
                    if(result.error){
                        window.alert("刪除失敗，請稍後再試一次")
                        btn.disabled = false
                        btn.textContent = "刪除"
                        return
                    }

                    if(CLS_Current_Teacher_Data.tasks){
                        delete CLS_Current_Teacher_Data.tasks[task_id]
                    }
                    CLS_Render_Teacher_Dashboard(CLS_Current_Teacher_Data)
                })
            })
        }
    }

    if(listEl){
        listEl.innerHTML = entries.length > 0
            ? entries.map(function(entry){ return CLS_Build_Student_Row_HTML(entry[0], entry[1]) }).join("")
            : `<p class="cls_empty_text">目前還沒學生加入該教室</p>`

        if(!listEl.dataset.kickBound){
            listEl.dataset.kickBound = "1"
            listEl.addEventListener("click", function(e){
                const btn = e.target.closest(".cls_kick_btn")
                if(!btn) return

                const target_anon_id = decodeURIComponent(btn.dataset.anonId || "")
                const target_name = decodeURIComponent(btn.dataset.name || "這位學生")
                if(!target_anon_id || !CLS_Current_Teacher_Data) return

                if(!window.confirm(`確定要把「${target_name}」踢出教室嗎？\n踢出後他需要重新輸入邀請代碼才能再加入。`)) return

                btn.disabled = true
                btn.textContent = "踢出中..."

                CLS_Kick_Student(CLS_Current_Teacher_Data.classroom_id, target_anon_id, function(result){
                    if(result.error){
                        window.alert("踢出失敗，請稍後再試一次")
                        btn.disabled = false
                        btn.textContent = "踢出"
                        return
                    }

                    if(CLS_Current_Teacher_Data.students){
                        delete CLS_Current_Teacher_Data.students[target_anon_id]
                    }
                    CLS_Render_Teacher_Dashboard(CLS_Current_Teacher_Data)
                })
            })
        }
    }

    // ===== 【新增】返回教室列表 =====
    const backBtn = document.getElementById("cls_back_to_list_btn")
    if(backBtn){
        backBtn.onclick = function(){
            CLS_Render_Teacher_List({ classrooms: CLS_Current_Teacher_List, uid: CLS_Current_Teacher_Uid })
        }
    }

    // ===== 【新增】解散這間教室（在儀表板裡直接解散）=====
    const dissolveBtn = document.getElementById("cls_dissolve_btn")
    if(dissolveBtn){
        dissolveBtn.onclick = function(){
            const displayName = data.meta.name || "這間教室"
            CLS_Handle_Dissolve(data.classroom_id, data.meta.join_code || "", dissolveBtn, displayName, function(){
                // 成功後從列表快照移除，回到列表頁
                if(CLS_Current_Teacher_List){
                    CLS_Current_Teacher_List = CLS_Current_Teacher_List.filter(function(c){
                        return c.classroom_id !== data.classroom_id
                    })
                }
                CLS_Render_Teacher_List({ classrooms: CLS_Current_Teacher_List || [], uid: CLS_Current_Teacher_Uid })
            })
        }
    }
}

// 【新增】記住這次登入判斷用的 user 物件跟 uid，給「建立我的第一間教室」按鈕用
// （那顆按鈕不用再重新問一次 Wait_For_Auth_Ready，直接沿用同一次判斷結果即可）
let CLS_Current_Auth_User = null

document.addEventListener("DOMContentLoaded", function(){
    // 【新增】守衛：這支檔案現在也會被 game.html / challenge.html 載入
    // （只為了用上面的 CLS_Check_Task_Notify / CLS_Schedule_Task_Notify_Check，
    // 不需要教室頁面本身的登入判斷／面板切換邏輯）。用 cls_loading 這個只有
    // TCTC2-0-classroom.html 才有的元素當「現在是不是真的在教室頁」的判斷依據，
    // 不是就直接跳過，避免在其他頁面白跑一次 Wait_For_Auth_Ready 跟一堆
    // 教室專屬的 Firebase 讀取、或是對著不存在的面板元素操作。
    if(!document.getElementById("cls_loading")) return

    if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
        console.warn("[classroom] 找不到 Get_Anon_Id / tctc_db，請確認有先載入 TCTC2-0-firebase.js")
        return
    }

    CLS_Show_Panel("cls_loading")

    /* ------------------------------------------------------------
       【修正】原本這裡只分兩種人：「已登入正式帳號」一律當老師、
       「沒登入（匿名訪客）」一律當學生，導致已登入的學生永遠看不到
       加入教室的入口，而沒登入的訪客卻能直接加入教室。

       改成先問一次「有沒有登入」，登入的人再往下細分「老師 / 學生 /
       都還不是（第一次用）」，四種狀態分開處理：
       ------------------------------------------------------------ */
    if(typeof Wait_For_Auth_Ready !== "function"){
        console.warn("[classroom] 找不到 Wait_For_Auth_Ready，請確認有先載入 TCTC2-0-firebase.js")
        CLS_Show_Panel("cls_login_required")
        return
    }

    Wait_For_Auth_Ready(function(user){
        CLS_Current_Auth_User = user

        // ----- 狀態 1：沒登入（含網站自動幫忙做的匿名登入）-----
        // CLS_Is_Teacher_Eligible 這裡實際檢查的是「是不是正式帳號」，
        // 名稱雖然寫 Teacher，但這個判斷跟老師/學生身份無關，是全站
        // 唯一能區分「玩家自己登入」跟「匿名訪客」的方式。
        if(!CLS_Is_Teacher_Eligible(user)){
            CLS_Show_Panel("cls_login_required")
            return
        }

        // ----- 已登入：先看名下有沒有開過教室（老師身份）-----
        CLS_Load_Teacher_Classrooms(function(result){
            if(result.classrooms && result.classrooms.length > 0){
                CLS_Render_Teacher_List(result)
                return
            }

            // ----- 沒開過教室：再看這個帳號目前是不是已經加入某間教室（學生身份） -----
            const anon_id = Get_Anon_Id()
            tctc_db.ref(`player_stats/${anon_id}/classroom_id`).once("value").then(function(snap){
                const classroom_id = snap.val()

                if(classroom_id){
                    // 【修改】CLS_Refresh_My_Summary 現在會回傳這次算好的 summary，
                    // 拿來當「我現在的指標值」去算任務貢獻度，不用再另外讀一次 player_stats
                    CLS_Refresh_My_Summary(classroom_id, function(refreshResult){
                        const my_summary = refreshResult.summary || {}

                        tctc_db.ref(`classrooms/${classroom_id}`).once("value").then(function(metaSnap){
                            const meta = metaSnap.val() || {}
                            CLS_Show_Panel("cls_student_status")

                            const nameEl = document.getElementById("cls_my_classroom_name")
                            if(nameEl) nameEl.textContent = meta.name || "（教室已被刪除）"

                            // 【新增】顯示授課老師名稱
                            const teacherEl = document.getElementById("cls_my_teacher_name")
                            if(teacherEl) teacherEl.textContent = meta.teacher_name || "—"

                            // 【新增】載入任務清單 → 補齊自己缺的 baseline → 渲染
                            CLS_Load_Tasks(classroom_id, function(tasks){
                                CLS_Ensure_My_Task_Baselines(classroom_id, tasks, my_summary, function(tasksReady){
                                    // 只有「這批任務裡真的有班級共同目標」時，才需要多下載一次
                                    // 全班的 classroom_students（用來加總全班貢獻）——沒有共同目標
                                    // 的教室不用多花這次讀取，省流量。
                                    const needsCollective = Object.keys(tasksReady).some(function(id){
                                        return tasksReady[id].meta && tasksReady[id].meta.goal_type === "collective"
                                    })

                                    if(needsCollective){
                                        tctc_db.ref(`classroom_students/${classroom_id}`).once("value").then(function(studentsSnap){
                                            const studentsVal = studentsSnap.val() || {}
                                            CLS_Render_Student_Tasks(tasksReady, my_summary, studentsVal)
                                            // 【新增】渲染完直接拿同一份資料跑一次里程碑比對，
                                            // 不重新多發任何 Firebase 請求
                                            CLS_Notify_Diff(tasksReady, my_summary, studentsVal).forEach(CLS_Notify_Show_Toast)
                                        })
                                    } else {
                                        CLS_Render_Student_Tasks(tasksReady, my_summary, null)
                                        CLS_Notify_Diff(tasksReady, my_summary, null).forEach(CLS_Notify_Show_Toast)
                                    }
                                })
                            })
                        })
                    })
                    return
                }

                // ----- 已登入、但既不是老師也還沒加入教室：第一次使用，
                //       顯示「加入教室」＋「建立我的第一間教室」的選擇面板 -----
                CLS_Show_Panel("cls_join_create_panel")

                const gotoCreateBtn = document.getElementById("cls_goto_create_btn")
                if(gotoCreateBtn){
                    gotoCreateBtn.onclick = function(){
                        CLS_Render_Teacher_List(result)   // result.classrooms 是空陣列，直接進「教室列表」頁，裡面本來就有建立表單
                    }
                }
            })
        })
    })

    // ----- 【新增】事件綁定：指派新任務（老師端，儀表板裡的表單）-----
    // 這幾個表單元素在 HTML 裡是「靜態」存在的（不像學生列表是每次渲染才動態
    // 產生），所以綁定一次就好，不用像 cls_task_delete_btn 那樣用事件代理。
    const newTaskBtn = document.getElementById("cls_new_task_btn")
    const taskForm = document.getElementById("cls_task_form")
    const taskCancelBtn = document.getElementById("cls_task_cancel_btn")
    const taskSubmitBtn = document.getElementById("cls_task_submit_btn")
    const taskMsgEl = document.getElementById("cls_task_form_msg")

    if(newTaskBtn && taskForm){
        newTaskBtn.addEventListener("click", function(){
            taskForm.classList.toggle("is_hidden")
        })
    }
    if(taskCancelBtn && taskForm){
        taskCancelBtn.addEventListener("click", function(){
            taskForm.classList.add("is_hidden")
        })
    }

    if(taskSubmitBtn){
        taskSubmitBtn.addEventListener("click", function(){
            if(!CLS_Current_Teacher_Data){
                if(taskMsgEl) taskMsgEl.textContent = "請先進入教室管理頁再指派任務"
                return
            }

            const title = (document.getElementById("cls_task_title_input").value || "").trim()
            const metric = document.getElementById("cls_task_metric_select").value
            const goal_type = document.getElementById("cls_task_goal_select").value
            const target_value = Number(document.getElementById("cls_task_target_input").value)
            const deadline_raw = document.getElementById("cls_task_deadline_input").value

            if(!title){
                if(taskMsgEl) taskMsgEl.textContent = "請輸入任務標題"
                return
            }
            if(!target_value || target_value <= 0){
                if(taskMsgEl) taskMsgEl.textContent = "請輸入有效的目標數值"
                return
            }
            if(!deadline_raw){
                if(taskMsgEl) taskMsgEl.textContent = "請選擇截止日期"
                return
            }

            // 【重要】把 <input type="date"> 拿到的日期字串（例如 "2026-05-20"）
            // 轉成「那一天 23:59:59」的毫秒時間戳，而不是那天 00:00:00——
            // 這樣截止日當天結束前，任務都還算「進行中」，不會一到那天凌晨
            // 0 點就立刻顯示「已截止」，符合一般人對「XX 號截止」的直覺認知。
            const deadline = new Date(`${deadline_raw}T23:59:59`).getTime()

            taskSubmitBtn.disabled = true
            if(taskMsgEl) taskMsgEl.textContent = "建立中..."

            CLS_Create_Task(CLS_Current_Teacher_Data.classroom_id, {
                title: title,
                metric: metric,
                goal_type: goal_type,
                target_value: target_value,
                deadline: deadline,
                teacher_uid: CLS_Current_Teacher_Uid
            }, CLS_Current_Teacher_Data.students, function(result){
                taskSubmitBtn.disabled = false

                if(result.error){
                    if(taskMsgEl) taskMsgEl.textContent = "建立失敗，請稍後再試一次"
                    return
                }

                if(taskMsgEl) taskMsgEl.textContent = ""
                document.getElementById("cls_task_title_input").value = ""
                document.getElementById("cls_task_target_input").value = ""
                document.getElementById("cls_task_deadline_input").value = ""
                taskForm.classList.add("is_hidden")

                // 直接重新整頁最省事：任務清單、baseline 這些都要重新讀一次才會是最新的，
                // 跟建立/加入教室成功後的處理方式一致，不用另外寫一套「局部更新」的邏輯
                window.location.reload()
            })
        })
    }

    // ----- 事件綁定：加入教室 -----
    const joinBtn = document.getElementById("cls_join_btn")
    const joinInput = document.getElementById("cls_join_code_input")
    const joinMsgEl = document.getElementById("cls_join_msg")

    if(joinBtn){
        joinBtn.addEventListener("click", function(){
            joinBtn.disabled = true
            if(joinMsgEl) joinMsgEl.textContent = "加入中..."

            CLS_Join_Classroom(joinInput ? joinInput.value : "", function(result){
                joinBtn.disabled = false
                if(result.error){
                    const msgMap = {
                        empty_code: "請輸入邀請代碼",
                        code_not_found: "找不到這組邀請代碼，請確認代碼是否正確",
                        write_failed: "加入失敗，請稍後再試一次",
                        not_logged_in: "請先登入帳號才能加入教室"
                    }
                    if(joinMsgEl) joinMsgEl.textContent = msgMap[result.error] || "加入失敗，請稍後再試一次"
                    return
                }
                window.location.reload()
            })
        })
    }

    // ----- 事件綁定：建立教室（現在位於教室列表頁）-----
    const createBtn = document.getElementById("cls_create_btn")
    const createInput = document.getElementById("cls_create_name_input")
    const createMsgEl = document.getElementById("cls_create_msg")

    if(createBtn){
        createBtn.addEventListener("click", function(){
            const name = createInput ? createInput.value.trim() : ""
            if(!name){
                if(createMsgEl) createMsgEl.textContent = "請輸入教室名稱"
                return
            }

            createBtn.disabled = true
            if(createMsgEl) createMsgEl.textContent = "建立中..."

            CLS_Create_Classroom(name, function(result){
                createBtn.disabled = false
                if(result.error){
                    if(createMsgEl) createMsgEl.textContent = "建立失敗，請稍後再試一次"
                    return
                }
                if(createMsgEl) createMsgEl.textContent = ""
                if(createInput) createInput.value = ""
                window.location.reload()
            })
        })
    }

    const leaveBtn = document.getElementById("cls_leave_btn")
    if(leaveBtn){
        leaveBtn.addEventListener("click", function(){
            if(!window.confirm("確定要離開這間教室嗎？離開後老師的名單上會看不到你。")) return

            leaveBtn.disabled = true
            CLS_Leave_Classroom(function(result){
                leaveBtn.disabled = false
                if(result.error){
                    window.alert("離開失敗，請稍後再試一次")
                    return
                }
                window.location.reload()
            })
        })
    }

    // ===== 複製邀請代碼 =====
    const copyBtn = document.getElementById("cls_copy_code_btn")
    if(copyBtn){
        copyBtn.addEventListener("click", function(){
            const codeEl = document.getElementById("cls_join_code")
            const code = codeEl ? codeEl.textContent : ""
            if(!code || !navigator.clipboard) return

            navigator.clipboard.writeText(code).then(function(){
                const originalText = copyBtn.textContent
                copyBtn.textContent = "已複製"
                setTimeout(function(){ copyBtn.textContent = originalText }, 1500)
            })
        })
    }
})