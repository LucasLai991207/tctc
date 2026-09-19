const cg_article_box    = document.getElementById("cg_article_box")
const cg_input_textarea = document.getElementById("cg_input_textarea")
const cg_timer_el      = document.getElementById("cg_timer")
const cg_duration_tag  = document.getElementById("cg_duration_tag")
const cg_live_wpm_el   = document.getElementById("cg_live_wpm")
const cg_live_acc_el   = document.getElementById("cg_live_acc")
const cg_result_window = document.getElementById("cg_result_window")
const cg_result_wpm_el = document.getElementById("cg_result_wpm")
const cg_result_acc_el = document.getElementById("cg_result_acc")
const cg_result_title  = document.getElementById("cg_result_title")
const cg_result_mode = document.getElementById("cg_result_mode")
const cg_result_difficulty_el = document.getElementById("cg_result_difficulty")
const cg_result_all_char = document.getElementById("cg_result_all_char")
const cg_result_time_used_el = document.getElementById("cg_result_time_used")
const cg_result_all_correct = document.getElementById("cg_result_correct")
const cg_result_all_false = document.getElementById("cg_result_false")
const cg_result_deleted_el = document.getElementById("cg_result_deleted_time")
const cg_skip_btn          = document.getElementById("cg_skip_btn")
const cg_result_skip_el    = document.getElementById("cg_result_skip_count")
const cg_result_highest_el = document.getElementById("cg_result_highest_wpm")

const CG_DIFFICULTY_LABEL = {
    easy:    "簡單",
    medium:  "普通",
    hard:    "困難",
    extreme: "極限"
}
const CG_ALLOWED_DIFFICULTIES = ["easy", "medium", "hard", "extreme"]

const CG_ALLOWED_STAGES = ["article", "word"]
const CG_STAGE_LABEL = {
    article: "文章模式",
    word:    "單詞模式"
}

const CG_ALLOWED_SECONDS = [30, 60, 180, 300, 600]
const CG_DURATION_LABEL = {
    30:  "30 秒挑戰",
    60:  "1 分鐘挑戰",
    180: "3 分鐘挑戰",
    300: "5 分鐘挑戰",
    600: "10 分鐘挑戰"
}

const CG_POINTS_BASE = { 30: 1, 60: 2, 180: 6, 300: 10, 600: 20 }
const CG_POINTS_MULTIPLIER = { easy: 1, medium: 1.5, hard: 2, extreme: 3 }

const CG_HISTORY_KEY = "tctc2.0-challenge_history"
const CG_HISTORY_MAX = 300

let cg_difficulty = "easy"
let cg_duration_seconds = 30
let cg_stage = "article"
let cg_target_text = ""
let cg_start_time = null
let cg_timer_handle = null
let cg_finished = false

// ===== 【新增】單詞模式專用狀態 =====
let cg_word_bank = []              // 目前難度/時間可抽的詞彙庫（把所有詞條打散成一個個單詞）
let cg_word_queue = []             // 畫面上實際排隊等打的詞彙隊列（打完會補新的進來，不會真的用完）
let cg_word_index = 0              // 目前正在打第幾個詞（對應 cg_word_queue 的 index）
let cg_word_completed_text = ""    // 已經打對、被「吃掉」的詞彙全部接在一起（打對才會被吃，所以這段永遠算正確）

// ===== 【新增】文章模式專用狀態：怕題庫被打完，改成「一篇打完就直接再抽一篇」，時間到才真正結束 =====
// 邏輯比照單詞模式的 cg_word_completed_text：每打完一篇，就把這篇的正確字數/總字數累加起來，
// 再抽新的一篇接著打，這樣統計數字才不會因為換文章而歸零。
let cg_article_completed_correct = 0   // 之前已經打完的文章，累積起來的「正確字數」
let cg_article_completed_typed = 0     // 之前已經打完的文章，累積起來的「總輸入字數」
// ===== 【調整】原本 20 / 30 生出來的詞彙量只夠塞 1~2 行，目標框卻是 4 行高，
// 看起來就像「只生一點點」。改大這兩個數字，讓一開局就生出足夠塞滿整個可視區域的詞彙量，
// 畫面一開始就是滿的，不會等到玩家打到接近底部、隊列被吃掉一大半才觸發補詞。 =====
const CG_WORD_QUEUE_MIN = 50       // 隊列裡「還沒打」的詞彙數量低於這個值，就再補一批
const CG_WORD_QUEUE_ADD = 40       // 每次補詞彙時，一次補幾個

// ===== 【新增】結算用統計數據 =====
let cg_correction_count = 0   // 玩家按下 Backspace / Delete 的次數（= 修正次數）
let cg_highest_cpm = 0        // 挑戰過程中曾經出現過的「瞬時最高 CPM」
let cg_skip_count = 0         // 【新增】玩家按下「跳過」按鈕的次數（單詞模式專用）

// ===== 跟 game.html 直接輸入模式一致：記錄「上一次事件觸發時」游標打到第幾個字 =====
// 用途：每次打字後，要拿「打字前」跟「打字後」目前這格文字的 offsetTop（垂直位置）互相比較，
// 如果不一樣，代表換行了，才需要呼叫 scrollBy() 把「目標文字框」往下捲一行。
// 【調整】原本存的是「輸入框字數」，現在文章模式改用即時比對（cg_align_typed_to_target），
// 玩家實際打的字數可能因為漏字/多打字而跟「目標文字位置」不一樣，
// 所以這裡改存「目標文字的比對位置（target pointer）」，語意更準確，變數也改名成 cg_prev_target_index。
let cg_prev_target_index = 0

// ===== 【新增】打字音效用的追蹤變數 =====
// 邏輯跟 game.html 的 text_input_prev_typed_length 一致：記住「上一次已經處理過的長度／
// 對到目標文字的哪個位置」，下次輸入事件只需要比對「新增的那一段」，
// 不用重算整句，也才能正確跳過 IME 組字中的中間狀態（只在組字結束、真正定案時才比對）。
let cg_prev_input_length = 0     // 文章模式：上次事件時，輸入框的字數
let cg_prev_target_pointer = 0   // 文章模式：上次事件時，比對到目標文章的第幾個字（對應 cg_alignment.targetPointer）
let cg_word_prev_input_length = 0 // 單詞模式：上次事件時，目前這個詞輸入框的字數（每次吃掉一個詞、清空輸入框就會歸零）

// ===== 【新增】文章模式的即時比對結果快取 =====
// 每次輸入事件都會重新跑一次 cg_align_typed_to_target()，把結果存在這裡，
// 同一次輸入事件裡，畫面上色（cg_update_display）、統計數字（cg_get_progress_snapshot）、
// 換行捲動（cg_maybe_scroll_to_next_line）都共用這一份結果，不用重複計算。
let cg_alignment = null

// 連續要對上幾個字，才承認「這是漏字/多打字」而不是單純打錯（巧合對上的機率會隨這個數字指數下降）
const CG_ALIGN_LOOKAHEAD = 2

// ===== 【新增】即時比對演算法：把玩家輸入的內容跟目標文章對齊，容忍「漏字」跟「多打一個字」 =====
// 概念：原本的比對是死死地拿 typed[i] 跟 target[i] 比，只要中間漏一個字，
// 後面所有位置就全部平移、全部判定成錯的。
// 這裡改成一邊比對一邊維護兩根指標（t = 讀到 typed 的第幾格／g = 讀到 target 的第幾格），
// 遇到對不上的時候，先「往後看」CG_ALIGN_LOOKAHEAD 個字：
//   - 如果玩家目前打的字，其實接下來能連續對上「目標往後跳 1 個字」的內容 → 判定成「漏字」，
//     把 target 那個字標成 missed（算錯），target 指標往前推進，玩家輸入的字不動、留著跟新的位置比。
//   - 如果玩家目前打的字，往後跳 1 個字之後能連續對上「目標現在的位置」→ 判定成「多打一個字」，
//     直接跳過玩家那個多打的字，target 指標不動。
//   - 兩種都對不上，才視為單純打錯字（原本的行為：這一格標成錯的，兩邊指標一起往前走）。
// 用「連續 2 個字才算數」而不是只看 1 個字，是為了降低中文常見重複字（的、了、是...）巧合對上、誤判的機率。
function cg_align_typed_to_target(typed, target){
    let t = 0
    let g = 0
    const status = new Array(target.length).fill("pending")
    let extraCount = 0

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

        const skip_window = Math.min(CG_ALIGN_LOOKAHEAD, typed.length - t, target.length - g - 1)
        if(skip_window > 0 && matches_at(typed, t, target.slice(g + 1, g + 1 + skip_window))){
            status[g] = "missed"
            g++
            continue
        }

        const extra_window = Math.min(CG_ALIGN_LOOKAHEAD, typed.length - t - 1, target.length - g)
        if(extra_window > 0 && matches_at(typed, t + 1, target.slice(g, g + extra_window))){
            extraCount++
            t++
            continue
        }

        status[g] = "wrong"
        t++
        g++
    }

    if(g < target.length) status[g] = "current"

    return { status: status, targetPointer: g, extraCount: extraCount }
}

function cg_recompute_alignment(){
    cg_alignment = cg_align_typed_to_target(cg_input_textarea.value, cg_target_text)
    return cg_alignment
}

function cg_get_settings_from_url(){
    const params = new URLSearchParams(window.location.search)

    const d = params.get("difficulty")
    const difficulty = CG_ALLOWED_DIFFICULTIES.includes(d) ? d : "easy"

    let seconds = Number(params.get("seconds"))
    if(!CG_ALLOWED_SECONDS.includes(seconds)){
        const legacyMinutes = Number(params.get("minutes"))
        seconds = CG_ALLOWED_SECONDS.includes(legacyMinutes * 60) ? legacyMinutes * 60 : 30
    }

    const st = params.get("stage")
    const stage = CG_ALLOWED_STAGES.includes(st) ? st : "article"

    return { difficulty, seconds, stage }
}

function cg_filter_filled(list){
    return (list || []).filter(function(s){ return typeof s === "string" && s.trim().length > 0 })
}

function cg_pick_article_pool(difficulty){
    const pool = (typeof Challenge_Data !== "undefined"
        && Challenge_Data[difficulty]
        && Challenge_Data[difficulty].article)
        ? cg_filter_filled(Challenge_Data[difficulty].article)
        : []

    return pool.length > 0 ? pool : null
}

function cg_pick_random_article(difficulty){
    const pool = cg_pick_article_pool(difficulty)
    if(!pool){
        return "沒找到文章"
    }
    const index = Math.floor(Math.random() * pool.length)
    return pool[index]
}

function cg_split_words(text){
    return text.split(/\s+/).filter(function(w){ return w.length > 0 })
}

function cg_build_word_bank(difficulty){
    const entries = (typeof Challenge_Data !== "undefined"
        && Challenge_Data[difficulty]
        && Challenge_Data[difficulty].word)
        ? cg_filter_filled(Challenge_Data[difficulty].word)
        : []

    let words = []
    entries.forEach(function(entry){
        words = words.concat(cg_split_words(entry))
    })
    return words
}

function cg_refill_word_queue(){
    if(cg_word_bank.length === 0) return
    while(cg_word_queue.length - cg_word_index < CG_WORD_QUEUE_MIN){
        for(let i = 0; i < CG_WORD_QUEUE_ADD; i++){
            cg_word_queue.push(cg_word_bank[Math.floor(Math.random() * cg_word_bank.length)])
        }
    }
}

function cg_render_article(){
    cg_article_box.innerHTML = ""
    const frag = document.createDocumentFragment()

    for(let i = 0; i < cg_target_text.length; i++){
        const span = document.createElement("span")
        span.className = "cg_char"
        span.dataset.idx = i
        span.textContent = cg_target_text[i]
        if(i === 0) span.classList.add("current")
        frag.appendChild(span)
    }
    cg_article_box.appendChild(frag)

    cg_article_box.scrollTop = 0
}

function cg_render_words(){
    cg_article_box.innerHTML = ""
    const frag = document.createDocumentFragment()

    for(let i = 0; i < cg_word_queue.length; i++){
        const wordSpan = document.createElement("span")
        wordSpan.className = "cg_word"

        if(i < cg_word_index){
            wordSpan.classList.add("cg_word_done")
            wordSpan.textContent = cg_word_queue[i]
        } else if(i === cg_word_index){
            wordSpan.classList.add("cg_word_current")
            wordSpan.id = "cg_current_word"
            const word = cg_word_queue[i]
            for(let c = 0; c < word.length; c++){
                const charSpan = document.createElement("span")
                charSpan.className = "cg_char"
                if(c === 0) charSpan.classList.add("current")
                charSpan.textContent = word[c]
                wordSpan.appendChild(charSpan)
            }
        } else {
            wordSpan.classList.add("cg_word_pending")
            wordSpan.textContent = cg_word_queue[i]
        }

        frag.appendChild(wordSpan)
    }

    cg_article_box.appendChild(frag)

}

function cg_update_current_word_display(){
    const currentWordEl = document.getElementById("cg_current_word")
    if(!currentWordEl) return

    const typedValue = cg_input_textarea.value
    const target = cg_word_queue[cg_word_index] || ""
    const chars = currentWordEl.children

    for(let i = 0; i < chars.length; i++){
        const span = chars[i]
        span.classList.remove("correct", "wrong", "current")

        if(i < typedValue.length){
            span.classList.add(typedValue[i] === target[i] ? "correct" : "wrong")
        } else if(i === typedValue.length){
            span.classList.add("current")
        }
    }
}

function cg_auto_grow_textarea(){
    cg_input_textarea.style.height = "auto"
    cg_input_textarea.style.height = cg_input_textarea.scrollHeight + "px"

    cg_input_textarea.scrollTop = cg_input_textarea.scrollHeight
}

function cg_format_time(totalSeconds){
    const s = Math.max(0, Math.ceil(totalSeconds))
    const mm = String(Math.floor(s / 60)).padStart(2, "0")
    const ss = String(s % 60).padStart(2, "0")
    return `${mm}:${ss}`
}

function cg_init(difficulty, seconds, stage){
    cg_difficulty = CG_ALLOWED_DIFFICULTIES.includes(difficulty) ? difficulty : "easy"
    cg_duration_seconds = CG_ALLOWED_SECONDS.includes(seconds) ? seconds : 30
    cg_stage = CG_ALLOWED_STAGES.includes(stage) ? stage : "article"

    cg_start_time = null
    cg_finished = false
    cg_prev_target_index = 0
    cg_alignment = null
    cg_prev_input_length = 0
    cg_prev_target_pointer = 0
    cg_word_prev_input_length = 0

    cg_correction_count = 0
    cg_highest_cpm = 0
    cg_skip_count = 0

    cg_article_completed_correct = 0
    cg_article_completed_typed = 0

    if(cg_skip_btn){
        cg_skip_btn.classList.toggle("is_hidden", cg_stage !== "word")
    }

    if(cg_timer_handle){
        clearInterval(cg_timer_handle)
        cg_timer_handle = null
    }

    cg_duration_tag.textContent = `${CG_DIFFICULTY_LABEL[cg_difficulty]}｜${CG_STAGE_LABEL[cg_stage]}｜${CG_DURATION_LABEL[cg_duration_seconds]}`
    cg_timer_el.textContent = cg_format_time(cg_duration_seconds)
    cg_timer_el.classList.remove("cg_timer_warn")
    cg_live_wpm_el.textContent = "0"
    cg_live_acc_el.textContent = "100%"

    cg_input_textarea.value = ""
    cg_input_textarea.disabled = false
    cg_input_textarea.scrollTop = 0   // 【新增】重新出題時，捲動位置也要歸零，避免延續上一輪打到一半的捲動高度
    cg_auto_grow_textarea()   // 每次重新開局都要把輸入框高度重置回一行

    if(cg_stage === "word"){

        cg_word_bank = cg_build_word_bank(cg_difficulty)
        cg_word_queue = []
        cg_word_index = 0
        cg_word_completed_text = ""
        cg_refill_word_queue()
        cg_render_words()
        cg_article_box.scrollTop = 0   // 【新增】開局才需要歸零一次，避免延續上一輪的捲動位置
    } else {
        // ===== 關卡一：文章模式（原本邏輯）=====
        cg_target_text = cg_pick_random_article(cg_difficulty)
        cg_render_article()
    }

    // ===== 【新增】單詞模式教學視窗：玩家還沒勾過「之後不再顯示」的話，
    // 每次進單詞模式（包含按「再來一次」重開）都要先跳出來，說明「打完一個詞會自動送出、換下一個」，
    // 不然很多人會下意識打完一個詞按空白鍵，以為要手動送出。
    // 視窗開著時先不 focus 輸入框（cg_show_word_intro_modal 會順便鎖住 textarea），
    // 避免玩家在視窗蓋著的狀態下盲打、意外啟動計時器。
    if(cg_stage === "word" && localStorage.getItem(CG_WORD_INTRO_KEY) !== "1"){
        cg_show_word_intro_modal()
    } else {
        cg_input_textarea.focus()
    }
}

let cg_last_tick_second = null

function cg_start_timer(){
    if(cg_timer_handle) return
    cg_start_time = Date.now()
    cg_last_tick_second = null

    if(typeof TCTC_Integrity !== "undefined") TCTC_Integrity.markAttemptStart()

    cg_timer_handle = setInterval(function(){
        const elapsedSec = (Date.now() - cg_start_time) / 1000
        const remaining = cg_duration_seconds - elapsedSec

        cg_timer_el.textContent = cg_format_time(remaining)
        if(remaining <= 10) cg_timer_el.classList.add("cg_timer_warn")

        const remaining_ceil = Math.ceil(remaining)
        if(remaining_ceil <= 3 && remaining_ceil >= 1 && remaining_ceil !== cg_last_tick_second){
            cg_last_tick_second = remaining_ceil
            Play_Tick_Sound()
        }

        cg_update_live_stats()

        if(remaining <= 0){
            cg_finish_challenge()
        }
    }, 250)
}

function cg_count_correct(typedValue){
    const alignment = cg_align_typed_to_target(typedValue, cg_target_text)
    let correct = 0
    for(let i = 0; i < alignment.status.length; i++){
        if(alignment.status[i] === "correct") correct++
    }
    return correct
}

function cg_get_progress_snapshot(){
    if(cg_stage === "word"){
        const typedValue = cg_input_textarea.value
        const target = cg_word_queue[cg_word_index] || ""
        let liveCorrect = 0
        const len = Math.min(typedValue.length, target.length)
        for(let i = 0; i < len; i++){
            if(typedValue[i] === target[i]) liveCorrect++
        }
        return {
            correct: cg_word_completed_text.length + liveCorrect,
            typed: cg_word_completed_text.length + typedValue.length
        }
    }

    // 文章模式：之前已經打完、直接被自動換掉的文章，累加進 cg_article_completed_correct/typed，
    // 再加上「目前正在打的這一篇」跟目標逐字比對的即時結果，邏輯跟單詞模式的累加方式一致，
    // 這樣即使中途換了好幾篇文章，WPM / 正確率也不會因為換文章而歸零或斷掉。
    const typedValue = cg_input_textarea.value
    return {
        correct: cg_article_completed_correct + cg_count_correct(typedValue),
        typed: cg_article_completed_typed + typedValue.length
    }
}

function cg_update_live_stats(){
    const snapshot = cg_get_progress_snapshot()
    const correct = snapshot.correct
    const typed = snapshot.typed
    const elapsedMin = cg_start_time ? Math.max((Date.now() - cg_start_time) / 60000, 1/60) : 1/60

    const wpm = Math.round(correct / elapsedMin)

    // ===== 【調整】正確率的分母加上 cg_correction_count（按過幾次 Backspace / Delete）=====
    // 概念：玩家按下 Backspace，代表「剛剛打錯了、需要修正」，這本身就是一次錯誤的嘗試，
    // 即使修正後最終畫面上看起來是對的（typed 裡不會留下錯誤字元），也應該算進正確率的計算，
    // 不然「狂打錯又狂刪」的人跟「一次到位」的人，最後 acc 看起來會一樣，這樣不合理。
    // 只調整 acc 這裡的分母，correct / typed / wpm 等其他統計數字維持原本算法，不受影響。
    const acc_attempts = typed + cg_correction_count
    const acc = acc_attempts > 0 ? Math.round((correct / acc_attempts) * 100) : 100

    cg_live_wpm_el.textContent = wpm
    cg_live_acc_el.textContent = acc + "%"

    // 【新增】只要開始計時了，就持續追蹤挑戰過程中曾經出現過的最高瞬時 CPM
    if(cg_start_time && wpm > cg_highest_cpm){
        cg_highest_cpm = wpm
    }
}

// ===== 【調整】改用 cg_alignment（即時比對結果）決定每一格字的顏色，取代原本死板的 i < typedValue.length 判斷 =====
// status[i] 可能是 correct / wrong / missed（漏字，也顯示成錯誤色）/ current（下一個要打的字）/ pending（還沒打到）
function cg_update_display(){
    const chars = cg_article_box.children
    const status = cg_alignment ? cg_alignment.status : []

    for(let i = 0; i < chars.length; i++){
        const span = chars[i]
        span.classList.remove("correct", "wrong", "current")

        const s = status[i]
        if(s === "correct"){
            span.classList.add("correct")
        } else if(s === "wrong" || s === "missed"){
            span.classList.add("wrong")
        } else if(s === "current"){
            span.classList.add("current")
        }

    }
}

function cg_get_char_top(index){
    const chars = cg_article_box.children
    if(index < 0 || index >= chars.length) return null
    return chars[index].offsetTop
}

function cg_maybe_scroll_to_next_line(prev_top){

    const new_index = cg_alignment ? cg_alignment.targetPointer : 0
    const new_top = cg_get_char_top(new_index)

    if(prev_top !== null && new_top !== null && new_top !== prev_top){
        cg_article_box.scrollBy({
            top: new_top - prev_top,
            behavior: "smooth"
        })
    }

    cg_prev_target_index = new_index
}

function cg_maybe_scroll_word_to_next_line(prev_top){
    const currentWordEl = document.getElementById("cg_current_word")
    const new_top = currentWordEl ? currentWordEl.offsetTop : null

    if(prev_top !== null && new_top !== null && new_top !== prev_top){
        cg_article_box.scrollBy({
            top: new_top - prev_top,
            behavior: "smooth"
        })
    }
}

function cg_on_input(event){
    if(cg_finished) return

    if(!cg_start_time && cg_input_textarea.value.length > 0){
        cg_start_timer()
    }

    const prev_top = cg_get_char_top(cg_prev_target_index)

    cg_recompute_alignment()

    cg_update_display()
    cg_update_live_stats()
    cg_auto_grow_textarea()

    if(event && event.isComposing){
        return
    }

    cg_prev_input_length = cg_input_textarea.value.length
    cg_prev_target_pointer = cg_alignment ? cg_alignment.targetPointer : cg_prev_target_pointer

    cg_maybe_scroll_to_next_line(prev_top)

    if(cg_alignment && cg_alignment.targetPointer >= cg_target_text.length){
        cg_draw_next_article()
    }
}

function cg_draw_next_article(){

    cg_article_completed_correct += cg_count_correct(cg_input_textarea.value)
    cg_article_completed_typed += cg_input_textarea.value.length

    cg_target_text = cg_pick_random_article(cg_difficulty)
    cg_input_textarea.value = ""
    cg_prev_target_index = 0
    cg_alignment = null   // 換文章了，上一篇的比對快取要清掉，避免下一次 render 短暫沿用到舊資料
    cg_prev_input_length = 0     // 【新增】換文章了，音效追蹤也要歸零，不然會拿舊文章的位置去比對新文章
    cg_prev_target_pointer = 0

    cg_render_article()
    cg_auto_grow_textarea()
    cg_update_live_stats()
}

// ===== 【新增】單詞模式的輸入處理 =====
// 核心行為：玩家不用按空白鍵分詞；只要目前輸入框的內容「完全等於」目前要打的詞，
// 這個詞就會被判定完成 → 輸入框直接清空（=被吃掉）、該詞標記成完成、自動換下一個詞，
// 這樣輸入框裡永遠只會有「目前這個詞」的內容，不會越打越長、看起來很亂。
function cg_on_input_word(event){
    if(cg_finished) return

    if(!cg_start_time && cg_input_textarea.value.length > 0){
        cg_start_timer()
    }

    cg_update_current_word_display()
    cg_update_live_stats()
    cg_auto_grow_textarea()

    // IME 組字中，先不要判斷是否打對，避免選字選到一半就被誤判完成
    if(event && event.isComposing){
        return
    }

    const typedValue = cg_input_textarea.value
    const target = cg_word_queue[cg_word_index] || ""

    // 【修改】原本這裡跟文章模式一樣，是「打對才播音效」；理由同上（見 cg_on_input 裡的
    // 說明），改成統一交給 cg_on_keydown_typing_sound 處理，只要按鍵就有聲音回饋。
    cg_word_prev_input_length = typedValue.length

    if(target.length > 0 && typedValue === target){
        // ===== 【新增】在「這個詞被吃掉、畫面重新渲染」之前，先記下目前這個詞卡的 offsetTop，
        // 才有辦法在渲染完之後拿新舊位置比較、判斷下一個詞是不是換到新的一行了 =====
        const prev_word_el = document.getElementById("cg_current_word")
        const prev_top = prev_word_el ? prev_word_el.offsetTop : null

        cg_word_completed_text += target
        cg_word_index++

        cg_input_textarea.value = ""
        cg_word_prev_input_length = 0   // 【新增】詞被吃掉、輸入框清空了，音效追蹤也要跟著歸零
        cg_auto_grow_textarea()

        cg_refill_word_queue()
        cg_render_words()

        // ===== 【修正】原本用 scrollIntoView({block:"nearest"}) 要等詞卡完全跑出可視範圍

        cg_maybe_scroll_word_to_next_line(prev_top)

        cg_update_live_stats()
    }
}

function cg_skip_word(){
    if(cg_stage !== "word" || cg_finished) return
    if(cg_word_queue.length === 0) return

    const prev_word_el = document.getElementById("cg_current_word")
    const prev_top = prev_word_el ? prev_word_el.offsetTop : null

    cg_skip_count++
    cg_word_index++

    cg_input_textarea.value = ""   // 清空輸入框，跟打對「吃掉詞」的行為一致
    cg_word_prev_input_length = 0   // 【新增】同上，音效追蹤要跟著歸零
    cg_start_timer()
    cg_auto_grow_textarea()

    cg_refill_word_queue()
    cg_render_words()

    cg_maybe_scroll_word_to_next_line(prev_top)
    cg_update_live_stats()

    cg_input_textarea.focus()      // 跳過之後游標直接留在輸入框，玩家可以馬上繼續打下一個詞
}

// ===== 【新增】依目前關卡把 input 事件導到對應的處理函式（文章模式 / 單詞模式邏輯完全分開）=====
function cg_on_input_router(event){
    if(cg_stage === "word"){
        cg_on_input_word(event)
    } else {
        cg_on_input(event)
    }
}

function cg_on_keydown_count_correction(event){
    if(cg_finished) return
    if(event.key === "Backspace" || event.key === "Delete"){
        cg_correction_count++
    }
}

function cg_on_keydown_typing_sound(event){
    if(cg_finished) return

    if(event.code === "Space"){
        Play_Space_Sound()
        return
    }
    if(event.code === "Enter" || event.code === "NumpadEnter"){
        Play_Enter_Sound()
        return
    }

    if(event.code === "Backspace"){
        Play_Enter_Sound()
        return
    }

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

function cg_save_history_entry(entry){
    let history = []
    try {
        history = JSON.parse(localStorage.getItem(CG_HISTORY_KEY)) || []
    } catch(e){

        history = []
    }

    history.push(entry)

    if(history.length > CG_HISTORY_MAX){
        history = history.slice(history.length - CG_HISTORY_MAX)
    }

    localStorage.setItem(CG_HISTORY_KEY, JSON.stringify(history))
}

let cg_pending_sync_promise = null

let last_challenge_result_summary = null

function cg_finish_challenge(){
    if(cg_finished) return
    cg_finished = true

    if(cg_timer_handle){
        clearInterval(cg_timer_handle)
        cg_timer_handle = null
    }

    cg_input_textarea.disabled = true

    const snapshot = cg_get_progress_snapshot()
    const correct = snapshot.correct
    const typed = snapshot.typed
    const wrong = typed - correct
    const elapsedSeconds = cg_start_time ? (Date.now() - cg_start_time) / 1000 : cg_duration_seconds
    const elapsedMin = Math.max(elapsedSeconds / 60, 1/60)
    const finalWpm = Math.round(correct / elapsedMin)

    const acc_attempts = typed + cg_correction_count
    const finalAcc = acc_attempts > 0 ? Math.round((correct / acc_attempts) * 100) : 0

    if(finalAcc >= 90){
        Play_Complete_Sound()
    }

    if(finalWpm > cg_highest_cpm) cg_highest_cpm = finalWpm

    const finishedEarly = (cg_stage === "article") && (typed >= cg_target_text.length)
    cg_result_title.textContent = finishedEarly ? "挑戰完成！" : "時間到！"

    cg_result_wpm_el.textContent = finalWpm
    cg_result_acc_el.textContent = finalAcc + "%"

    if(cg_result_mode) cg_result_mode.textContent = `模式：速度挑戰模式｜${CG_STAGE_LABEL[cg_stage]}`
    if(cg_result_difficulty_el) cg_result_difficulty_el.textContent = `關卡難度：${CG_DIFFICULTY_LABEL[cg_difficulty]}｜${CG_DURATION_LABEL[cg_duration_seconds]}`
    if(cg_result_all_char) cg_result_all_char.textContent = `總打字元數：${typed}`
    if(cg_result_time_used_el) cg_result_time_used_el.textContent = `總耗時：${cg_format_time(elapsedSeconds)}`
    if(cg_result_all_correct) cg_result_all_correct.textContent = `正確字元數：${correct}`
    if(cg_result_all_false) cg_result_all_false.textContent = `錯誤字元數：${wrong}`
    if(cg_result_deleted_el) cg_result_deleted_el.textContent = `修正次數：${cg_correction_count}`
    if(cg_result_skip_el) cg_result_skip_el.textContent = `跳過次數：${cg_skip_count}`
    if(cg_result_highest_el) cg_result_highest_el.textContent = `瞬時最高CPM：${cg_highest_cpm}`

    const cg_share_details = [
        { label: "難度", value: CG_DIFFICULTY_LABEL[cg_difficulty] || cg_difficulty },
        { label: "模式", value: CG_STAGE_LABEL[cg_stage] || cg_stage },
        { label: "時間限制", value: CG_DURATION_LABEL[cg_duration_seconds] || `${cg_duration_seconds} 秒` },
        { label: "總打字元數", value: String(typed) },
        { label: "正確字元數", value: String(correct) },
        { label: "錯誤字元數", value: String(wrong) },
        { label: "修正次數", value: String(cg_correction_count) },
        { label: "瞬時最高CPM", value: String(cg_highest_cpm) },
        { label: "總耗時", value: cg_format_time(elapsedSeconds) },
    ]
    if(cg_stage === "word"){
        cg_share_details.splice(7, 0, { label: "跳過次數", value: String(cg_skip_count) })
    }
    last_challenge_result_summary = {
        wpm: finalWpm,
        acc: finalAcc,
        label: `${CG_DIFFICULTY_LABEL[cg_difficulty] || cg_difficulty}・${CG_DURATION_LABEL[cg_duration_seconds] || cg_duration_seconds + " 秒"}`,
        sub_label: `速度挑戰模式・${CG_STAGE_LABEL[cg_stage] || cg_stage}`,
        details: cg_share_details
    }

    const cg_meets_points_threshold = finalAcc >= 75 && finalWpm >= 3
    const pointsEarned = cg_meets_points_threshold
        ? Math.round((CG_POINTS_BASE[cg_duration_seconds] || 0) * (CG_POINTS_MULTIPLIER[cg_difficulty] || 1))
        : 0
    const prevTotalPoints = Number(localStorage.getItem("tctc2.0-challenge_total_points")) || 0

    let cg_wpm_sum = Number(localStorage.getItem("cg_wpm_sum")) || 0
    let cg_wpm_times = Number(localStorage.getItem("cg_wpm_times")) || 0
    cg_wpm_sum += finalWpm
    cg_wpm_times += 1
    localStorage.setItem("cg_wpm_sum", cg_wpm_sum)
    localStorage.setItem("cg_wpm_times", cg_wpm_times)
    localStorage.setItem("average_challenge_wpm", Math.round(cg_wpm_sum / cg_wpm_times))

    let cg_acc_sum = Number(localStorage.getItem("cg_acc_sum")) || 0
    let cg_acc_times = Number(localStorage.getItem("cg_acc_times")) || 0
    cg_acc_sum += finalAcc
    cg_acc_times += 1
    localStorage.setItem("cg_acc_sum", cg_acc_sum)
    localStorage.setItem("cg_acc_times", cg_acc_times)
    localStorage.setItem("average_challenge_acc", Math.round(cg_acc_sum / cg_acc_times))

    localStorage.setItem("tctc2.0-challenge_total_points", prevTotalPoints + pointsEarned)

    const cg_sync_promises = []

    const raw_stats = {
        correct: correct,
        wrong: wrong,
        duration_seconds: Math.round(elapsedSeconds),
        correction_count: cg_correction_count,
        skip_count: cg_skip_count
    }

    if(typeof TCTC_Integrity !== "undefined"){
        Object.assign(raw_stats, TCTC_Integrity.getAttemptSnapshot())
    }

    if(cg_meets_points_threshold && typeof Submit_Challenge_Score_To_Leaderboard === "function"){
        const comboId = `${cg_difficulty}-${cg_stage}-${cg_duration_seconds}`
        cg_sync_promises.push(Submit_Challenge_Score_To_Leaderboard(comboId, finalWpm, finalAcc, raw_stats))
    }

    if(cg_meets_points_threshold && typeof Sync_Player_Stats === "function"){
        cg_sync_promises.push(Sync_Player_Stats(finalWpm, finalAcc))
    }

    if(cg_meets_points_threshold && typeof Sync_Challenge_Player_Stats === "function"){
        cg_sync_promises.push(Sync_Challenge_Player_Stats(finalWpm, finalAcc))
    }

    if(cg_meets_points_threshold && typeof Sync_Chars_Typed === "function"){
        cg_sync_promises.push(Sync_Chars_Typed(correct))
    }

    if(pointsEarned > 0 && typeof Sync_Player_Points === "function"){
        cg_sync_promises.push(Sync_Player_Points(pointsEarned))
    }

    if(pointsEarned > 0 && typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
        cg_sync_promises.push(Sync_XP(pointsEarned * XP_CONFIG.actions.challenge_points_multiplier))
    }

    cg_pending_sync_promise = Promise.all(cg_sync_promises)

    cg_save_history_entry({
        date: Date.now(),
        difficulty: cg_difficulty,
        stage: cg_stage,
        seconds: cg_duration_seconds,
        wpm: finalWpm,
        acc: finalAcc
    })

    cg_result_window.classList.remove("is_hidden")
}

function Leave_Challenge_Result(target_url){
    if(!cg_pending_sync_promise){
        window.location.href = target_url
        return
    }

    const rank_btn = document.getElementById("cg_rank_floating_btn")
    const result_btn = document.getElementById("cg_result_view_ranking_btn")
    const lobby_btn = document.getElementById("cg_result_back_lobby_btn")
    if(rank_btn) rank_btn.textContent = "⏳"
    if(result_btn) result_btn.textContent = "同步中..."
    if(lobby_btn) lobby_btn.textContent = "同步中..."

    const timeout_promise = new Promise(function(resolve){ setTimeout(resolve, 3000) })

    Promise.race([cg_pending_sync_promise, timeout_promise]).then(function(){
        window.location.href = target_url
    })
}

function View_Challenge_Ranking(){
    const comboId = `${cg_difficulty}-${cg_stage}-${cg_duration_seconds}`

    Leave_Challenge_Result(`TCTC2-0-ranking.html?mode=challenge&combo=${comboId}&return_to=${encodeURIComponent(window.location.href)}`)
}

function Share_Current_Challenge_Result(){
    if(!last_challenge_result_summary) return
    Open_Share_Card_Modal(last_challenge_result_summary)
}

function Restart_Challenge(){
    if(cg_result_window) cg_result_window.classList.add("is_hidden")
    cg_init(cg_difficulty, cg_duration_seconds, cg_stage)
}

function Confirm_Leave_Challenge(){
    const in_progress = cg_start_time && !cg_finished
    if(in_progress && !confirm("挑戰還沒結束，現在離開這次的成績不會被記錄，確定要返回大廳嗎？")){
        return
    }
    window.location.href = "TCTC2-0-challenge_lobby.html"
}

if(cg_input_textarea){
    cg_input_textarea.addEventListener("input", cg_on_input_router)
    cg_input_textarea.addEventListener("keydown", cg_on_keydown_count_correction)
    cg_input_textarea.addEventListener("keydown", cg_on_keydown_typing_sound)

    cg_input_textarea.addEventListener("compositionend", cg_on_input_router)

    cg_input_textarea.addEventListener("keydown", function(event){
        if(event.key === "Enter"){
            event.preventDefault()
        }
    })

    cg_input_textarea.addEventListener("paste", function(event){
        event.preventDefault()
        alert("作弊得來的成績真的有意義嗎?")
    })

    cg_input_textarea.addEventListener("drop", function(event){
        event.preventDefault()
        alert("看來你想得很周全 但可惜我想的更甚於你")
    })
}
if(cg_article_box){
    cg_article_box.addEventListener("click", function(){
        cg_input_textarea.focus()
    })
}

if(cg_skip_btn){
    cg_skip_btn.addEventListener("click", cg_skip_word)
}

const cg_punct_hint_btn      = document.getElementById("cg_punct_hint_btn")
const cg_punct_modal_overlay = document.getElementById("cg_punct_modal_overlay")
const cg_punct_modal_close   = document.getElementById("cg_punct_modal_close")

function Open_Punctuation_Modal(){
    if(cg_punct_modal_overlay) cg_punct_modal_overlay.classList.remove("is_hidden")
}

function Close_Punctuation_Modal(){
    if(cg_punct_modal_overlay) cg_punct_modal_overlay.classList.add("is_hidden")
}

if(cg_punct_hint_btn){
    cg_punct_hint_btn.addEventListener("click", Open_Punctuation_Modal)
}
if(cg_punct_modal_close){
    cg_punct_modal_close.addEventListener("click", Close_Punctuation_Modal)
}
if(cg_punct_modal_overlay){

    cg_punct_modal_overlay.addEventListener("click", function(event){
        if(event.target === cg_punct_modal_overlay){
            Close_Punctuation_Modal()
        }
    })
}

const CG_WORD_INTRO_KEY       = "tctc2.0-challenge_word_intro_dismissed"
const cg_word_intro_modal     = document.getElementById("cg_word_intro_modal")
const cg_word_intro_dontshow  = document.getElementById("cg_word_intro_dontshow")
const cg_word_intro_start_btn = document.getElementById("cg_word_intro_start_btn")

function cg_show_word_intro_modal(){
    if(!cg_word_intro_modal) return

    if(cg_input_textarea) cg_input_textarea.disabled = true
    cg_word_intro_modal.classList.remove("is_hidden")
}

function cg_close_word_intro_modal(){
    if(!cg_word_intro_modal) return

    if(cg_word_intro_dontshow && cg_word_intro_dontshow.checked){
        localStorage.setItem(CG_WORD_INTRO_KEY, "1")
    }

    cg_word_intro_modal.classList.add("is_hidden")

    if(cg_input_textarea){
        cg_input_textarea.disabled = false
        cg_input_textarea.focus()
    }
}

if(cg_word_intro_start_btn){
    cg_word_intro_start_btn.addEventListener("click", cg_close_word_intro_modal)
}
if(cg_word_intro_modal){

    cg_word_intro_modal.addEventListener("click", function(event){
        if(event.target === cg_word_intro_modal){
            cg_close_word_intro_modal()
        }
    })
}

document.addEventListener("DOMContentLoaded", function(){
    Init_Typing_Sound()
    Init_Sound_Toggle_Btn()
    const settings = cg_get_settings_from_url()
    cg_init(settings.difficulty, settings.seconds, settings.stage)
})

function Init_Sound_Toggle_Btn(){
    const btn = document.getElementById("cg_sound_toggle_btn")
    const icon = document.getElementById("cg_sound_toggle_icon")
    if(!btn || !icon) return

    if(typeof Get_Typing_Sound_Enabled !== "function"){
        console.log("[typing_sound] 打字音效模組尚未載入，音效開關維持預設圖示")
        return
    }

    function Update_Sound_Icon(){
        icon.src = Get_Typing_Sound_Enabled() ? "medium-volume.png" : "mute.png"
    }

    Update_Sound_Icon()

    btn.addEventListener("click", function(){
        Set_Typing_Sound_Enabled(!Get_Typing_Sound_Enabled())
        Update_Sound_Icon()
    })
}