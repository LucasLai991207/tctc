/* ============================================================
   TCTC2-0-custom.js
   自訂練習模式

   跟挑戰模式的「文章模式」共用同一套核心概念（逐字容錯比對、即時上色、
   即時 WPM／正確率），但這裡刻意獨立一份檔案、不是直接改 challenge.js，
   原因：

   1. 目標文字來源完全不同——挑戰模式從 Challenge_Data 題庫抽，這裡是
      玩家自己貼的任意文字，長度、內容都不可預期。
   2. 【刻意的設計決定，不是漏做】這個模式完全不寫入 Firebase：不上排行榜、
      不計入成就／XP／積分、也不存歷史紀錄到雲端。原因不只是省資料庫用量，
      更重要的是玩家自己貼的文字沒辦法保證公平——如果算進去，隨便貼一段
      只有一兩個簡單字重複幾百次的文字，就能刷出誇張的 WPM 洗榜/洗成就，
      這是「自訂文字」這個功能天生的漏洞，所以乾脆完全不接上任何會被拿來
      比較／排名的系統，資料全部留在玩家自己的瀏覽器（localStorage）。
   ------------------------------------------------------------ */

const CUS_SAVED_KEY = "tctc2.0-custom_texts"
const CUS_SAVED_MAX = 20   // 存在本機而已，上限只是避免 localStorage 無限長大

const cus_setup_section    = document.getElementById("cus_setup_section")
const cus_setup_textarea   = document.getElementById("cus_setup_textarea")
const cus_char_count_el    = document.getElementById("cus_char_count")
const cus_start_btn        = document.getElementById("cus_start_btn")
const cus_save_checkbox    = document.getElementById("cus_save_checkbox")
const cus_save_title_input = document.getElementById("cus_save_title_input")
const cus_saved_list_el    = document.getElementById("cus_saved_list")

const cus_practice_section = document.getElementById("cus_practice_section")
const cus_article_box      = document.getElementById("cus_article_box")
const cus_input_textarea   = document.getElementById("cus_input_textarea")
const cus_elapsed_el       = document.getElementById("cus_elapsed")
const cus_live_wpm_el      = document.getElementById("cus_live_wpm")
const cus_live_acc_el      = document.getElementById("cus_live_acc")

const cus_result_window    = document.getElementById("cus_result_window")
const cus_result_title     = document.getElementById("cus_result_title")
const cus_result_wpm_el    = document.getElementById("cus_result_wpm")
const cus_result_acc_el    = document.getElementById("cus_result_acc")
const cus_result_all_char  = document.getElementById("cus_result_all_char")
const cus_result_time_used_el = document.getElementById("cus_result_time_used")
const cus_result_all_correct  = document.getElementById("cus_result_correct")
const cus_result_all_false    = document.getElementById("cus_result_false")
const cus_result_deleted_el   = document.getElementById("cus_result_deleted_time")
const cus_result_highest_el   = document.getElementById("cus_result_highest_wpm")

let cus_target_text = ""
let cus_start_time = null
let cus_timer_handle = null
let cus_finished = false
let cus_started = false   // 是否已經進入練習畫面（給返回鍵判斷要不要跳確認）

let cus_correction_count = 0
let cus_highest_cpm = 0
let cus_alignment = null
let cus_prev_target_index = 0

const CUS_ALIGN_LOOKAHEAD = 2

// 分享卡用：這次結算算好的完整資料
let last_custom_result_summary = null

// ===== 簡單的 HTML escape，存文本標題／清單顯示用 innerHTML 時要防 XSS =====
function CUS_Escape_Html(str){
    const div = document.createElement("div")
    div.textContent = str || ""
    return div.innerHTML
}

/* ============================================================
   ===== 逐字容錯比對演算法：跟 challenge.js 的 cg_align_typed_to_target
   完全同一套邏輯（能容忍漏字／多打一個字），這裡複製一份而不是直接呼叫
   對方檔案的函式，是因為自訂模式刻意不載入 challenge.js（那支檔案裡
   還牽了題庫、單詞模式、排行榜同步一大串跟這裡無關的東西，載入了也是
   浪費）。演算法本體很單純，複製一份維護成本不高。
   ============================================================ */
function cus_align_typed_to_target(typed, target){
    let t = 0
    let g = 0
    const status = new Array(target.length).fill("pending")

    function matches_at(str, idx, needle){
        if(needle.length === 0) return false
        if(idx < 0 || idx + needle.length > str.length) return false
        for(let k = 0; k < needle.length; k++){
            if(str[idx + k] !== needle[k]) return false
        }
        return true
    }

    while(t < typed.length && g < target.length){
        if(typed[t] === target[g]){
            status[g] = "correct"
            t++
            g++
            continue
        }

        const skip_window = Math.min(CUS_ALIGN_LOOKAHEAD, typed.length - t, target.length - g - 1)
        if(skip_window > 0 && matches_at(typed, t, target.slice(g + 1, g + 1 + skip_window))){
            status[g] = "missed"
            g++
            continue
        }

        const extra_window = Math.min(CUS_ALIGN_LOOKAHEAD, typed.length - t - 1, target.length - g)
        if(extra_window > 0 && matches_at(typed, t + 1, target.slice(g, g + extra_window))){
            t++
            continue
        }

        status[g] = "wrong"
        t++
        g++
    }

    if(g < target.length) status[g] = "current"

    return { status: status, targetPointer: g }
}

function cus_recompute_alignment(){
    cus_alignment = cus_align_typed_to_target(cus_input_textarea.value, cus_target_text)
    return cus_alignment
}

function cus_count_correct(typedValue){
    const alignment = cus_align_typed_to_target(typedValue, cus_target_text)
    let correct = 0
    for(let i = 0; i < alignment.status.length; i++){
        if(alignment.status[i] === "correct") correct++
    }
    return correct
}

/* ============================================================
   ===== 常用文本：本機儲存清單 =====
   ============================================================ */
function CUS_Get_Saved_Texts(){
    try {
        return JSON.parse(localStorage.getItem(CUS_SAVED_KEY)) || []
    } catch(e){
        return []
    }
}
function CUS_Save_Texts_List(list){
    try {
        localStorage.setItem(CUS_SAVED_KEY, JSON.stringify(list))
    } catch(e){
        console.warn("[custom] 寫入常用文本失敗：", e.message)
    }
}

function CUS_Add_Saved_Text(title, text){
    let list = CUS_Get_Saved_Texts()
    list.unshift({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: title && title.trim() ? title.trim() : text.slice(0, 12),
        text: text,
        created_at: Date.now()
    })
    if(list.length > CUS_SAVED_MAX) list = list.slice(0, CUS_SAVED_MAX)
    CUS_Save_Texts_List(list)
    CUS_Render_Saved_List()
}

function CUS_Delete_Saved_Text(id){
    const list = CUS_Get_Saved_Texts().filter(function(item){ return item.id !== id })
    CUS_Save_Texts_List(list)
    CUS_Render_Saved_List()
}

function CUS_Render_Saved_List(){
    if(!cus_saved_list_el) return
    const list = CUS_Get_Saved_Texts()

    if(list.length === 0){
        cus_saved_list_el.innerHTML = `<p class="cus_saved_empty">還沒有存過任何常用文本，打勾「存成常用文本」就能在這裡看到。</p>`
        return
    }

    cus_saved_list_el.innerHTML = list.map(function(item){
        return `
            <div class="cus_saved_item" data-id="${item.id}">
                <span class="cus_saved_item_name">${CUS_Escape_Html(item.title)}</span>
                <span class="cus_saved_item_len">${item.text.length} 字</span>
                <span class="cus_saved_item_delete" data-delete-id="${item.id}">刪除</span>
            </div>
        `
    }).join("")

    cus_saved_list_el.querySelectorAll(".cus_saved_item").forEach(function(el){
        el.addEventListener("click", function(event){
            // 點到刪除按鈕：只刪除，不要順便把文字帶進輸入框
            if(event.target.dataset.deleteId){
                CUS_Delete_Saved_Text(event.target.dataset.deleteId)
                return
            }
            const item = list.find(function(x){ return x.id === el.dataset.id })
            if(item && cus_setup_textarea){
                cus_setup_textarea.value = item.text
                CUS_Update_Char_Count()
                cus_setup_textarea.focus()
            }
        })
    })
}

/* ============================================================
   ===== 設定畫面 =====
   ============================================================ */
function CUS_Update_Char_Count(){
    const len = cus_setup_textarea.value.trim().length
    cus_char_count_el.textContent = `${len} 字`
    cus_start_btn.disabled = len === 0
}

if(cus_setup_textarea){
    cus_setup_textarea.addEventListener("input", CUS_Update_Char_Count)
}
if(cus_save_checkbox){
    cus_save_checkbox.addEventListener("change", function(){
        cus_save_title_input.classList.toggle("is_hidden", !cus_save_checkbox.checked)
    })
}

if(cus_start_btn){
    cus_start_btn.addEventListener("click", function(){
        // 多個空白／換行合併成一個空格：自訂模式的目標文字沿用挑戰模式
        // 「文章是連續一整塊、靠可視寬度自動換行」的呈現方式，不處理玩家
        // 原始輸入裡的真實換行符號，比對邏輯才能跟挑戰模式共用同一套。
        const raw = cus_setup_textarea.value.trim()
        const normalized = raw.replace(/\s+/g, " ")
        if(normalized.length === 0) return

        if(cus_save_checkbox && cus_save_checkbox.checked){
            CUS_Add_Saved_Text(cus_save_title_input.value, normalized)
        }

        CUS_Start(normalized)
    })
}

/* ============================================================
   ===== 練習畫面 =====
   ============================================================ */
function cus_render_article(){
    cus_article_box.innerHTML = ""
    const frag = document.createDocumentFragment()

    for(let i = 0; i < cus_target_text.length; i++){
        const span = document.createElement("span")
        span.className = "cus_char"
        span.dataset.idx = i
        span.textContent = cus_target_text[i]
        if(i === 0) span.classList.add("current")
        frag.appendChild(span)
    }
    cus_article_box.appendChild(frag)
    cus_article_box.scrollTop = 0
}

function cus_auto_grow_textarea(){
    cus_input_textarea.style.height = "auto"
    cus_input_textarea.style.height = cus_input_textarea.scrollHeight + "px"
    cus_input_textarea.scrollTop = cus_input_textarea.scrollHeight
}

function cus_format_time(totalSeconds){
    const s = Math.max(0, Math.floor(totalSeconds))
    const mm = String(Math.floor(s / 60)).padStart(2, "0")
    const ss = String(s % 60).padStart(2, "0")
    return `${mm}:${ss}`
}

function CUS_Start(text){
    cus_target_text = text
    cus_start_time = null
    cus_finished = false
    cus_started = true
    cus_prev_target_index = 0
    cus_alignment = null
    cus_correction_count = 0
    cus_highest_cpm = 0

    if(cus_timer_handle){
        clearInterval(cus_timer_handle)
        cus_timer_handle = null
    }

    cus_elapsed_el.textContent = "00:00"
    cus_live_wpm_el.textContent = "0"
    cus_live_acc_el.textContent = "100%"

    cus_input_textarea.value = ""
    cus_input_textarea.disabled = false
    cus_input_textarea.scrollTop = 0
    cus_auto_grow_textarea()

    cus_render_article()

    cus_setup_section.classList.add("is_hidden")
    cus_result_window.classList.add("is_hidden")
    cus_practice_section.classList.remove("is_hidden")

    cus_input_textarea.focus()
}

// ===== 計時只是「顯示用的碼表」（正著數），沒有倒數、沒有時間到強制結束——
// 自訂模式的長度完全由玩家貼的文字決定，打完才算完成 =====
function cus_start_timer(){
    if(cus_timer_handle) return
    cus_start_time = Date.now()

    cus_timer_handle = setInterval(function(){
        const elapsedSec = (Date.now() - cus_start_time) / 1000
        cus_elapsed_el.textContent = cus_format_time(elapsedSec)
        cus_update_live_stats()
    }, 250)
}

function cus_get_progress_snapshot(){
    const typedValue = cus_input_textarea.value
    return {
        correct: cus_count_correct(typedValue),
        typed: typedValue.length
    }
}

function cus_update_live_stats(){
    const snapshot = cus_get_progress_snapshot()
    const correct = snapshot.correct
    const typed = snapshot.typed
    const elapsedMin = cus_start_time ? Math.max((Date.now() - cus_start_time) / 60000, 1/60) : 1/60

    const wpm = Math.round(correct / elapsedMin)
    const acc_attempts = typed + cus_correction_count
    const acc = acc_attempts > 0 ? Math.round((correct / acc_attempts) * 100) : 100

    cus_live_wpm_el.textContent = wpm
    cus_live_acc_el.textContent = acc + "%"

    if(cus_start_time && wpm > cus_highest_cpm) cus_highest_cpm = wpm
}

function cus_update_display(){
    const chars = cus_article_box.children
    const status = cus_alignment ? cus_alignment.status : []

    for(let i = 0; i < chars.length; i++){
        const span = chars[i]
        span.classList.remove("correct", "wrong", "current")

        const s = status[i]
        if(s === "correct") span.classList.add("correct")
        else if(s === "wrong" || s === "missed") span.classList.add("wrong")
        else if(s === "current") span.classList.add("current")
    }
}

function cus_get_char_top(index){
    const chars = cus_article_box.children
    if(index < 0 || index >= chars.length) return null
    return chars[index].offsetTop
}

function cus_maybe_scroll_to_next_line(prev_top){
    const new_index = cus_alignment ? cus_alignment.targetPointer : 0
    const new_top = cus_get_char_top(new_index)

    if(prev_top !== null && new_top !== null && new_top !== prev_top){
        cus_article_box.scrollBy({ top: new_top - prev_top, behavior: "smooth" })
    }
    cus_prev_target_index = new_index
}

function cus_on_input(event){
    if(cus_finished) return

    if(!cus_start_time && cus_input_textarea.value.length > 0){
        cus_start_timer()
    }

    const prev_top = cus_get_char_top(cus_prev_target_index)

    cus_recompute_alignment()
    cus_update_display()
    cus_update_live_stats()
    cus_auto_grow_textarea()

    if(event && event.isComposing) return

    cus_maybe_scroll_to_next_line(prev_top)

    if(cus_alignment && cus_alignment.targetPointer >= cus_target_text.length){
        cus_finish()
    }
}

function cus_on_keydown_count_correction(event){
    if(cus_finished) return
    if(event.key === "Backspace" || event.key === "Delete"){
        cus_correction_count++
    }
}

// 打字音效：純粹依照按了哪個實體鍵，跟 game.html / challenge.js 同一套做法
function cus_on_keydown_typing_sound(event){
    if(cus_finished) return

    if(event.code === "Space"){ Play_Space_Sound(); return }
    if(event.code === "Enter" || event.code === "NumpadEnter"){ Play_Enter_Sound(); return }
    if(event.code === "Backspace"){ Play_Enter_Sound(); return }

    const NON_TYPING_KEY_CODES = [
        "Tab", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight",
        "AltLeft", "AltRight", "CapsLock", "Escape", "MetaLeft", "MetaRight",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
        "Home", "End", "PageUp", "PageDown", "Delete", "Insert",
        "ContextMenu", "NumLock", "ScrollLock", "Pause", "PrintScreen"
    ]
    if(NON_TYPING_KEY_CODES.includes(event.code)) return
    if(/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) return

    Play_Correct_Sound()
}

function cus_finish(){
    if(cus_finished) return
    cus_finished = true

    if(cus_timer_handle){
        clearInterval(cus_timer_handle)
        cus_timer_handle = null
    }
    cus_input_textarea.disabled = true

    const snapshot = cus_get_progress_snapshot()
    const correct = snapshot.correct
    const typed = snapshot.typed
    const wrong = typed - correct
    const elapsedSeconds = cus_start_time ? (Date.now() - cus_start_time) / 1000 : 0
    const elapsedMin = Math.max(elapsedSeconds / 60, 1/60)
    const finalWpm = Math.round(correct / elapsedMin)

    const acc_attempts = typed + cus_correction_count
    const finalAcc = acc_attempts > 0 ? Math.round((correct / acc_attempts) * 100) : 0

    if(finalAcc >= 90 && typeof Play_Complete_Sound === "function") Play_Complete_Sound()
    if(finalWpm > cus_highest_cpm) cus_highest_cpm = finalWpm

    cus_result_title.textContent = "練習完成！"
    cus_result_wpm_el.textContent = finalWpm
    cus_result_acc_el.textContent = finalAcc + "%"

    if(cus_result_all_char) cus_result_all_char.textContent = `總打字元數：${typed}`
    if(cus_result_time_used_el) cus_result_time_used_el.textContent = `總耗時：${cus_format_time(elapsedSeconds)}`
    if(cus_result_all_correct) cus_result_all_correct.textContent = `正確字元數：${correct}`
    if(cus_result_all_false) cus_result_all_false.textContent = `錯誤字元數：${wrong}`
    if(cus_result_deleted_el) cus_result_deleted_el.textContent = `修正次數：${cus_correction_count}`
    if(cus_result_highest_el) cus_result_highest_el.textContent = `瞬時最高CPM：${cus_highest_cpm}`

    last_custom_result_summary = {
        wpm: finalWpm,
        acc: finalAcc,
        label: "自訂練習",
        sub_label: "自訂模式・不計入排行榜",
        details: [
            { label: "總打字元數", value: String(typed) },
            { label: "正確字元數", value: String(correct) },
            { label: "錯誤字元數", value: String(wrong) },
            { label: "修正次數", value: String(cus_correction_count) },
            { label: "瞬時最高CPM", value: String(cus_highest_cpm) },
            { label: "總耗時", value: cus_format_time(elapsedSeconds) }
        ]
    }

    // ===== 完全不寫入 Firebase：沒有 Submit_Challenge_Score_To_Leaderboard、
    // 沒有 Sync_Player_Stats、沒有 Sync_Chars_Typed、沒有 Sync_XP、沒有 Sync_Player_Points，
    // 也沒有存任何歷史紀錄——這頁打完，資料就只存在這次的記憶體跟畫面上，
    // 離開頁面就沒了（常用文本清單是唯一會留下來的東西，而且純粹是本機文字，不是成績）。

    cus_result_window.classList.remove("is_hidden")
}

function CUS_Restart(){
    cus_result_window.classList.add("is_hidden")
    CUS_Start(cus_target_text)
}

function CUS_Back_To_Setup(){
    cus_result_window.classList.add("is_hidden")
    cus_practice_section.classList.add("is_hidden")
    cus_setup_section.classList.remove("is_hidden")
    cus_started = false

    // 把剛剛打過的文字留在設定框裡，方便玩家微調後再練一次，而不是要重新貼一次
    if(cus_setup_textarea){
        cus_setup_textarea.value = cus_target_text
        CUS_Update_Char_Count()
    }
}

function CUS_Share_Result(){
    if(!last_custom_result_summary) return
    if(typeof Open_Share_Card_Modal === "function") Open_Share_Card_Modal(last_custom_result_summary)
}

// ===== 返回鍵：只有「已經開始打字、還沒打完」才需要確認，避免誤觸弄丟正在打的內容 =====
function CUS_Confirm_Leave(){
    const in_progress = cus_started && cus_start_time && !cus_finished
    if(in_progress && !confirm("練習還沒打完，現在離開這次的內容不會被保留，確定要離開嗎？")){
        return
    }
    window.location.href = "TCTC2-0-main.html"
}

// ===== 事件綁定 =====
if(cus_input_textarea){
    cus_input_textarea.addEventListener("input", cus_on_input)
    cus_input_textarea.addEventListener("keydown", cus_on_keydown_count_correction)
    cus_input_textarea.addEventListener("keydown", cus_on_keydown_typing_sound)
    cus_input_textarea.addEventListener("compositionend", cus_on_input)

    cus_input_textarea.addEventListener("keydown", function(event){
        if(event.key === "Enter") event.preventDefault()
    })

    // 練習模式的重點是「真的打」，貼上就練不到東西了
    cus_input_textarea.addEventListener("paste", function(event){
        event.preventDefault()
        alert("貼上就練不到打字囉，自己打打看吧！")
    })
    cus_input_textarea.addEventListener("drop", function(event){
        event.preventDefault()
    })
}
if(cus_article_box){
    cus_article_box.addEventListener("click", function(){
        cus_input_textarea.focus()
    })
}

// ===== 標點符號提示視窗 =====
const cus_punct_hint_btn      = document.getElementById("cus_punct_hint_btn")
const cus_punct_modal_overlay = document.getElementById("cus_punct_modal_overlay")
const cus_punct_modal_close   = document.getElementById("cus_punct_modal_close")

if(cus_punct_hint_btn){
    cus_punct_hint_btn.addEventListener("click", function(){
        cus_punct_modal_overlay.classList.remove("is_hidden")
    })
}
if(cus_punct_modal_close){
    cus_punct_modal_close.addEventListener("click", function(){
        cus_punct_modal_overlay.classList.add("is_hidden")
    })
}
if(cus_punct_modal_overlay){
    cus_punct_modal_overlay.addEventListener("click", function(event){
        if(event.target === cus_punct_modal_overlay){
            cus_punct_modal_overlay.classList.add("is_hidden")
        }
    })
}

// ===== 打字音效開關（跟 game.html / challenge.js 共用同一份 localStorage 狀態）=====
function CUS_Init_Sound_Toggle_Btn(){
    const btn = document.getElementById("cus_sound_toggle_btn")
    const icon = document.getElementById("cus_sound_toggle_icon")
    if(!btn || !icon) return

    if(typeof Get_Typing_Sound_Enabled !== "function") return

    function Update_Icon(){
        icon.src = Get_Typing_Sound_Enabled() ? "medium-volume.png" : "mute.png"
    }
    Update_Icon()

    btn.addEventListener("click", function(){
        Set_Typing_Sound_Enabled(!Get_Typing_Sound_Enabled())
        Update_Icon()
    })
}

document.addEventListener("DOMContentLoaded", function(){
    if(typeof Init_Typing_Sound === "function") Init_Typing_Sound()
    CUS_Init_Sound_Toggle_Btn()
    CUS_Update_Char_Count()
    CUS_Render_Saved_List()
})
