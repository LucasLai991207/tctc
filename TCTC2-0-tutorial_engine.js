// TCTC2-0-tutorial_engine.js — 教學關卡「拆頁」引擎
// 只負責「畫面切換、上一頁/下一頁、互動練習卡關」，內容資料全部來自 TCTC2-0-tutorial_data.js。
// 依賴 game.html 內嵌 script 裡定義的東西（呼叫時機都在頁面完全載入之後，所以沒問題）：
//   - Start_Inline_Key_Practice() / Start_IME_Selection_Sim() / Start_Finger_Quiz()（互動練習本體）
//   - key_intro_active / ime_sim_active / finger_quiz_active（各互動練習的「目前是否在跑」旗標）
//   - kb_current_el / kb_current_modifier_els（即時鍵盤目前亮著的鍵，切畫面時要清掉）
//   - increase_stage_count() / Sync_Stage_Completion() / get_difficulty_by_stageid()（關卡完成度統計）
// 必須在 TCTC2-0-tutorial_data.js 之後、game.html 主要的 inline script 之前載入。

let TUT_screens = []              // 目前這一關的畫面陣列
let TUT_idx = 0                   // 目前畫面索引
let TUT_completed = []            // 每個畫面的互動練習是否已完成（沒有互動練習的畫面一律視為 true）
let TUT_container = null          // 畫面要畫在哪個容器（game_char_container）
let TUT_next_stage_id = null      // 最後一個畫面按下去要導向哪一關

// 進入一個教學關卡：判斷「第一次完成」要不要記分、清空狀態、畫出第一個畫面
function Render_Tutorial_Stage(stage, stageId, container){
    const data = TUTORIAL_DATA[stageId]
    if(!data || !data.screens || data.screens.length === 0){
        // 理論上不會發生（表示這關被歸類成教學關，但資料檔忘了補），保底顯示錯誤訊息，不要讓畫面整個空白
        container.innerHTML = '<p style="color:gray;text-align:center;padding:2rem 0;">這一關的教學內容還沒有設定，請回報這個問題。</p>'
        return
    }

    // ===== 關卡完成度記錄：跟過去每個 stage.id 各自寫的邏輯完全一致，只是抽成共用流程 =====
    // 只在「這次是第一次看到這一關」才記一次，避免玩家用上一頁/下一頁來回切換，
    // 或重新整理頁面時被重複採計。
    let progress = JSON.parse(localStorage.getItem("stage_progress")) || {}
    const is_first_time_clear = progress[stageId] !== true
    if(is_first_time_clear){
        if(data.count_stage_completion && typeof increase_stage_count === "function" && typeof get_difficulty_by_stageid === "function"){
            increase_stage_count(get_difficulty_by_stageid(stage.id))
        }
        if(typeof Sync_Stage_Completion === "function"){
            Sync_Stage_Completion(stageId)
        }
        progress[stageId] = true
        localStorage.setItem("stage_progress", JSON.stringify(progress))
    }

    // 教學關的畫面裡常常會有「示範」按鈕或互動練習需要對照即時鍵盤，
    // 這裡統一強制打開（跟過去每個 stage.id 各自寫一次「強制打開鍵盤」的效果一樣，只是不用每一關分開寫）
    const kb_wrap_el = document.getElementById("live_keyboard")
    if(kb_wrap_el){
        kb_wrap_el.style.display = ""
        kb_wrap_el.classList.remove("kb_hidden")
    }

    TUT_screens = data.screens
    TUT_idx = 0
    TUT_completed = TUT_screens.map(function(screen){ return !screen.interactive })
    TUT_container = container
    TUT_next_stage_id = data.next_stage_id

    Render_Tutorial_Screen()
}

// 離開目前畫面前，先把可能還醒著的互動練習關掉——
// 不然它們掛在 document 上的 keydown 監聽器（key_intro_active 等旗標）還在運作，
// 玩家在別的畫面按鍵時會被誤判成上一個畫面的練習輸入。
function Stop_Any_Tutorial_Interactive(){
    if(typeof key_intro_active !== "undefined") key_intro_active = false
    if(typeof ime_sim_active !== "undefined") ime_sim_active = false
    if(typeof finger_quiz_active !== "undefined") finger_quiz_active = false

    if(typeof kb_current_el !== "undefined" && kb_current_el){
        kb_current_el.classList.remove("kb_current")
        kb_current_el = null
    }
    if(typeof kb_current_modifier_els !== "undefined" && kb_current_modifier_els){
        kb_current_modifier_els.forEach(function(el){ el.classList.remove("kb_current_modifier") })
        kb_current_modifier_els = []
    }
}

// 畫出目前索引指到的那個畫面：內容 + 上一頁/下一頁按鈕 + （如果有）互動練習
function Render_Tutorial_Screen(){
    Stop_Any_Tutorial_Interactive()

    const screen = TUT_screens[TUT_idx]
    const is_last = TUT_idx === TUT_screens.length - 1
    const can_prev = TUT_idx > 0
    const unlocked = TUT_completed[TUT_idx]

    const next_label = is_last ? (screen.final_label || "下一頁 →") : "下一頁 →"
    const next_action = is_last ? "Tutorial_Go_To_Next_Stage()" : "Tutorial_Next_Screen()"

    TUT_container.innerHTML = `
        <div style="text-align: left; max-width: 900px; margin: 0 auto; font-family: 'Noto Serif TC', serif; color: white; font-weight: 150; position: relative; font-size: 0.9rem;">
            <p style="text-align:center; color:rgba(255,255,255,0.35); font-size:0.75rem; letter-spacing:2px; margin-bottom:1rem;">
                ${TUT_idx + 1} / ${TUT_screens.length}
            </p>

            ${screen.html}

            ${(screen.interactive && !unlocked) ? `<p id="tut_gate_hint" style="color: gray; font-size: 0.9rem; text-align: center; margin-top: 1.5rem;">完成上面的練習後，就可以繼續囉！</p>` : ``}

            <div style="display:flex; justify-content:center; align-items:center; gap:0.8rem; margin-top: 1.5rem;">
                ${can_prev ? `<button onclick="Tutorial_Prev_Screen()" style="width:8rem; height:3rem; background-color:transparent; display:flex; justify-content:center; align-items:center; color:var(--champagne-gold); font-family:'Noto Serif TC',serif; font-size:1rem; letter-spacing:2px; border:1px solid var(--champagne-gold); border-radius:4px; cursor:pointer; transition:all 200ms ease;">← 上一頁</button>` : ``}
                <button id="tut_next_btn" onclick="${next_action}" style="${unlocked ? '' : 'display:none;'} width:10rem; height:3rem; background-color:var(--champagne-gold); justify-content:center; align-items:center; color:var(--dark-blue); font-family:'Noto Serif TC',serif; font-size:1rem; letter-spacing:2px; border:none; border-radius:4px; cursor:pointer; transition:all 200ms ease;">
                    ${next_label}
                </button>
            </div>
        </div>
    `

    if(screen.interactive && !unlocked){
        Mount_Tutorial_Interactive(screen)
    }

    window.scrollTo(0, 0)   // 每次切畫面都捲回頂端，避免停在上一個畫面捲動的位置，看起來像沒換頁
}

// 依 screen.interactive.type 分派到對應的既有互動練習函式，完成後解鎖「下一頁」按鈕
function Mount_Tutorial_Interactive(screen){
    const config = screen.interactive
    const mount_el = document.getElementById(config.container_id)
    if(!mount_el) return

    function On_Interactive_Done(){
        TUT_completed[TUT_idx] = true
        const btn = document.getElementById("tut_next_btn")
        const hint = document.getElementById("tut_gate_hint")
        if(hint) hint.textContent = config.done_text || "完成了，可以繼續囉！🎉"
        if(btn) btn.style.display = "flex"
    }

    if(config.type === "inline_key_practice" && typeof Start_Inline_Key_Practice === "function"){
        Start_Inline_Key_Practice(mount_el, config.keys, On_Interactive_Done, config.title)
    }
    else if(config.type === "ime_sim" && typeof Start_IME_Selection_Sim === "function"){
        Start_IME_Selection_Sim(mount_el, On_Interactive_Done)
    }
    else if(config.type === "finger_quiz" && typeof Start_Finger_Quiz === "function"){
        // 【沿用舊行為】Start_Finger_Quiz 本來就沒有完成回呼，這裡不呼叫 On_Interactive_Done，
        // 因為這一頁本來就不卡關（見 tutorial_data.js 裡 1-0-3 最後一頁的註解）
        Start_Finger_Quiz(mount_el, config.num_rounds || 5)
    }
}

function Tutorial_Next_Screen(){
    if(TUT_idx < TUT_screens.length - 1){
        TUT_idx++
        Render_Tutorial_Screen()
    }
}

function Tutorial_Prev_Screen(){
    if(TUT_idx > 0){
        TUT_idx--
        Render_Tutorial_Screen()
    }
}

function Tutorial_Go_To_Next_Stage(){
    if(TUT_next_stage_id){
        window.location.href = "game.html?stage=" + TUT_next_stage_id
    }
}
