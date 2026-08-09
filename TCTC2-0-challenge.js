const cg_article_box    = document.getElementById("cg_article_box")   // 目標文字框（只顯示、上色，不接受輸入）
const cg_input_textarea = document.getElementById("cg_input_textarea") // 【修正】真正可見的輸入框，跟目標文字框是兩個分開的區塊
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
const cg_skip_btn          = document.getElementById("cg_skip_btn")             // 【新增】單詞模式的跳過按鈕
const cg_result_skip_el    = document.getElementById("cg_result_skip_count")    // 【新增】結算頁的跳過次數欄位
const cg_result_highest_el = document.getElementById("cg_result_highest_wpm")


// ===== 難度 / 時間長度 對照表 =====
// 難度：跟 Challenge_Data 的第一層 key 一一對應
const CG_DIFFICULTY_LABEL = {
    easy:    "簡單",
    medium:  "普通",
    hard:    "困難",
    extreme: "極限"
}
const CG_ALLOWED_DIFFICULTIES = ["easy", "medium", "hard", "extreme"]

// ===== 【新增】關卡（文章模式／單詞模式）對照表 =====
const CG_ALLOWED_STAGES = ["article", "word"]
const CG_STAGE_LABEL = {
    article: "文章模式",
    word:    "單詞模式"
}

// 時間長度：全部改用「秒數」為基準單位（取代舊版的「分鐘」），才能支援 30 秒關卡
const CG_ALLOWED_SECONDS = [30, 60, 180, 300, 600]
const CG_DURATION_LABEL = {
    30:  "30 秒挑戰",
    60:  "1 分鐘挑戰",
    180: "3 分鐘挑戰",
    300: "5 分鐘挑戰",
    600: "10 分鐘挑戰"
}


// ===== 【新增】積分對照表（要跟 TCTC2-0-challenge_lobby.js 裡的定義保持一致）=====
const CG_POINTS_BASE = { 30: 1, 60: 2, 180: 6, 300: 10, 600: 20 }
const CG_POINTS_MULTIPLIER = { easy: 1, medium: 1.5, hard: 2, extreme: 3 }

// ===== 【新增】進步曲線用的歷史紀錄 =====
// 跟上面 cg_wpm_sum / cg_acc_sum 那組「只存累加平均」的資料分開存，
// 這裡改成存「一筆一筆帶時間戳記的紀錄」，之後在 lobby 頁面才有辦法依
// 難度／模式／時間長度篩選出對應組合，畫出趨勢曲線。
// key 名稱要跟 TCTC2-0-challenge_lobby.js 裡讀取的地方完全一致，不然會讀不到資料。
const CG_HISTORY_KEY = "tctc2.0-challenge_history"
const CG_HISTORY_MAX = 300   // 避免 localStorage 無限長大，只保留最近 300 筆（所有組合加起來）

let cg_difficulty = "easy"
let cg_duration_seconds = 30
let cg_stage = "article"       // 【新增】article = 文章模式（關卡一）／word = 單詞模式（關卡二）
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
    let extraCount = 0   // 玩家「多打」但被判定要忽略的字數，供之後如果要顯示提示用

    // 檢查 str 從 idx 開始的那一小段，是否完整等於 needle（用來確認「連續 N 個字都對上」）
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

        // ===== 嘗試判定「漏字」：往後跳 1 個目標字，看能不能連續對上 =====
        const skip_window = Math.min(CG_ALIGN_LOOKAHEAD, typed.length - t, target.length - g - 1)
        if(skip_window > 0 && matches_at(typed, t, target.slice(g + 1, g + 1 + skip_window))){
            status[g] = "missed"   // 這個字被漏打，算錯，但不影響後面的比對
            g++
            continue
        }

        // ===== 嘗試判定「多打一個字」：玩家多按了一鍵，往前跳 1 個字看能不能連續對上 =====
        const extra_window = Math.min(CG_ALIGN_LOOKAHEAD, typed.length - t - 1, target.length - g)
        if(extra_window > 0 && matches_at(typed, t + 1, target.slice(g, g + extra_window))){
            extraCount++
            t++   // 忽略這個多打的字，target 指標不動
            continue
        }

        // ===== 都不是，單純打錯字（替換），行為跟原本一樣 =====
        status[g] = "wrong"
        t++
        g++
    }

    if(g < target.length) status[g] = "current"   // 下一格要打的字，游標高亮位置

    return { status: status, targetPointer: g, extraCount: extraCount }
}

// 依目前輸入框內容重新跑一次比對，結果存進 cg_alignment 快取
function cg_recompute_alignment(){
    cg_alignment = cg_align_typed_to_target(cg_input_textarea.value, cg_target_text)
    return cg_alignment
}

function cg_get_settings_from_url(){
    const params = new URLSearchParams(window.location.search)

    const d = params.get("difficulty")
    const difficulty = CG_ALLOWED_DIFFICULTIES.includes(d) ? d : "easy"

    // 【向下相容】舊網址可能還是用 ?minutes=1 這種寫法，這裡順便轉換成秒數
    let seconds = Number(params.get("seconds"))
    if(!CG_ALLOWED_SECONDS.includes(seconds)){
        const legacyMinutes = Number(params.get("minutes"))
        seconds = CG_ALLOWED_SECONDS.includes(legacyMinutes * 60) ? legacyMinutes * 60 : 30
    }

    // 【新增】沒帶 stage 參數的舊網址，預設走關卡一（文章模式），維持原本行為
    const st = params.get("stage")
    const stage = CG_ALLOWED_STAGES.includes(st) ? st : "article"

    return { difficulty, seconds, stage }
}

// ===== 過濾掉還沒填內容的空字串（word 陣列目前還是預留的空字串 ``）=====
function cg_filter_filled(list){
    return (list || []).filter(function(s){ return typeof s === "string" && s.trim().length > 0 })
}

// 文章模式：直接到 Challenge_Data[難度].article 抽一則（題庫不分時間長度，時間純粹只是倒數計時）
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

// ===== 單詞模式：抽詞邏輯 =====
// 把一則字串依空白切成一個一個詞彙，過濾掉切出來的空字串
function cg_split_words(text){
    return text.split(/\s+/).filter(function(w){ return w.length > 0 })
}

// 取得「難度」對應的詞彙庫（把 Challenge_Data[難度].word 全部打散、合併成一個大詞彙池，跟時間長度無關）
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

// 隊列裡「還沒打」的詞彙數量不夠了，就從詞彙池隨機補一批進去（詞彙池會重複抽，永遠不會用完）
function cg_refill_word_queue(){
    if(cg_word_bank.length === 0) return
    while(cg_word_queue.length - cg_word_index < CG_WORD_QUEUE_MIN){
        for(let i = 0; i < CG_WORD_QUEUE_ADD; i++){
            cg_word_queue.push(cg_word_bank[Math.floor(Math.random() * cg_word_bank.length)])
        }
    }
}

// ===== 把目標文章拆成一格一格的 <span>，並且用 data-idx 記錄「這是第幾個字」 =====
// 跟 game.html 的 Build_Target1_Spans_Html() 邏輯一致：
// 之所以特別存一個 data-idx，是為了讓「比對邏輯」跟「span 在畫面上的順序」脫鉤，
// 之後不管畫面怎麼調整，都能用同一套「idx → 對不對」邏輯去比對。
function cg_render_article(){
    cg_article_box.innerHTML = ""
    const frag = document.createDocumentFragment()

    for(let i = 0; i < cg_target_text.length; i++){
        const span = document.createElement("span")
        span.className = "cg_char"
        span.dataset.idx = i          // 記錄這一格對應目標文字的第幾個字（從 0 開始）
        span.textContent = cg_target_text[i]
        if(i === 0) span.classList.add("current")
        frag.appendChild(span)
    }
    cg_article_box.appendChild(frag)

    // 每次重新出題（含「再來一次」）都要把捲動位置歸零，避免延續上一篇文章的捲動高度
    cg_article_box.scrollTop = 0
}


// ===== 【新增】單詞模式：把詞彙隊列畫成一張張「詞卡」=====
// 已完成的詞：整個詞打勾／劃掉，標記成完成
// 目前正在打的詞：拆成逐字 span，比照文章模式做逐字上色（對／錯／目前游標位置）
// 還沒輪到的詞：純文字、顏色偏灰，等待中
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
    // ===== 【修正】原本這裡有一行 cg_article_box.scrollTop = 0，
    // 但這個函式除了「開局」會呼叫，「打對詞」「跳過詞」也都會呼叫（因為每次都要重建詞卡列表），
    // 導致每打對/跳過一次，捲動位置就被強制歸零一次，
    // 跟後面 cg_maybe_scroll_word_to_next_line() 的「捲一行」動作互相打架，
    // 捲動起點跟實際該在的位置越差越多，最後目標詞卡整個捲出可視範圍。
    // 「開局時捲動歸零」改到 cg_init() 裡明確做一次，這個函式不再管捲動狀態。
}

// 目前這個詞的逐字上色（隨著玩家輸入即時更新，不用重新整個 render，效能較好）
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
    cg_prev_target_index = 0   // 重置捲動追蹤用的索引，避免沿用到上一輪的進度
    cg_alignment = null        // 重置即時比對快取，避免沿用到上一輪的比對結果
    cg_prev_input_length = 0   // 【新增】重置音效追蹤變數，避免沿用到上一輪的位置
    cg_prev_target_pointer = 0
    cg_word_prev_input_length = 0

    // 【新增】重置結算統計
    cg_correction_count = 0
    cg_highest_cpm = 0
    cg_skip_count = 0

    // 【新增】重置文章模式「累計已完成文章」的統計，避免延續到上一輪挑戰的數字
    cg_article_completed_correct = 0
    cg_article_completed_typed = 0

    // ===== 【新增】跳過按鈕只有單詞模式才需要，文章模式沒有「單一詞卡」可以跳 =====
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
        // ===== 關卡二：單詞模式 =====
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

let cg_last_tick_second = null   // 【新增】倒數最後3秒嗶聲：記錄「已經嗶過的整數秒數」，避免 250ms 的 interval 在同一秒內重複觸發

function cg_start_timer(){
    if(cg_timer_handle) return
    cg_start_time = Date.now()
    cg_last_tick_second = null   // 【新增】每次重新開始倒數都要重置，不然下一輪最後3秒不會再嗶

    cg_timer_handle = setInterval(function(){
        const elapsedSec = (Date.now() - cg_start_time) / 1000
        const remaining = cg_duration_seconds - elapsedSec

        cg_timer_el.textContent = cg_format_time(remaining)
        if(remaining <= 10) cg_timer_el.classList.add("cg_timer_warn")

        // 【新增】最後 3 秒（3、2、1）各嗶一聲。
        // 這個 interval 是每 250ms 跑一次（不是每秒），所以同一個整數秒（例如 remaining
        // 從 2.98 掉到 2.01 之間）會被跑好幾次，這裡用 cg_last_tick_second 記錄
        // 「這個整數秒是不是已經嗶過了」，確保 3 / 2 / 1 各自只嗶一次，不會連環嗶。
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

// ===== 【調整】改用 cg_align_typed_to_target 的比對結果算正確字數，不再是死板的 typed[i] vs target[i] =====
// 這樣漏字/多打字造成的誤判不會被算進「正確字數」的損失裡（漏掉的那個字本身還是算錯，
// 但不會連帶把後面明明打對的字也一起算成錯）。
function cg_count_correct(typedValue){
    const alignment = cg_align_typed_to_target(typedValue, cg_target_text)
    let correct = 0
    for(let i = 0; i < alignment.status.length; i++){
        if(alignment.status[i] === "correct") correct++
    }
    return correct
}

// ===== 【新增】依目前關卡（文章／單詞）算出「正確字數」跟「總輸入字數」的快照 =====
// 文章模式：邏輯完全比照原本（跟 cg_target_text 逐字比對）
// 單詞模式：已經打對被吃掉的詞（cg_word_completed_text）全部算正確，
//          再加上「目前正在打的這個詞」跟目標逐字比對的即時結果
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
        // pending：維持預設樣式，不用加 class
    }
}

// ===== 取得「目標文字中第 index 個字」目前在畫面上的垂直位置（offsetTop） =====
// offsetTop 是這個字相對於「最近的定位祖先元素」的上緣距離，
// 同一行的字 offsetTop 會一樣，換行之後 offsetTop 就會變大（跳到下一行的高度）。
// 這就是用來判斷「有沒有換行」的依據。
function cg_get_char_top(index){
    const chars = cg_article_box.children
    if(index < 0 || index >= chars.length) return null
    return chars[index].offsetTop
}

// ===== 核心邏輯：偵測換行並捲動「目標文字框」 =====
// 概念跟 game.html 注音模式的捲動邏輯完全一致（見 boxes[current].offsetTop 那段）：
// 1. 先記錄「打字前」目前這格字的 offsetTop（prev_top）
// 2. 畫面更新完成後，再抓一次「打字後」目前這格字的 offsetTop（new_top）
// 3. 如果兩者不同，代表視線焦點換到下一行了，用 scrollBy() 把文章框往下捲「剛好一行」的距離
//    （因為換行造成的 offsetTop 差，本身就等於一行的高度，不用另外硬寫死行高數字）
function cg_maybe_scroll_to_next_line(prev_top){
    // 【調整】原本用「輸入框字數」當作目前打到第幾格的索引，
    // 但現在漏字/多打字之後，輸入框字數不再等於目標文字的實際位置，
    // 改用比對結果的 targetPointer（下一個要打的目標字位置）才準確。
    const new_index = cg_alignment ? cg_alignment.targetPointer : 0
    const new_top = cg_get_char_top(new_index)

    if(prev_top !== null && new_top !== null && new_top !== prev_top){
        cg_article_box.scrollBy({
            top: new_top - prev_top,   // 直接用差值，換一行捲一行，換兩行（例如選字選出一長串詞）就自動捲兩行的量
            behavior: "smooth"         
        })
    }

    cg_prev_target_index = new_index
}

// ===== 【新增】單詞模式專用的「換行就捲動」，邏輯跟上面的 cg_maybe_scroll_to_next_line 是同一套概念，
// 差別只在文章模式是用「字元 offsetTop」判斷換行，單詞模式改用「目前這個詞卡（.cg_word_current）的 offsetTop」判斷，
// 因為單詞模式的排版單位是整個詞卡，不是單一字元。
// 只要「目前這個詞」換到新的一行（offsetTop 變了），就立刻用 scrollBy() 平滑捲動一行，
// 不會像原本的 scrollIntoView({block:"nearest"}) 那樣要等詞卡完全跑出可視範圍才觸發、而且是瞬間跳動。 =====
function cg_maybe_scroll_word_to_next_line(prev_top){
    const currentWordEl = document.getElementById("cg_current_word")
    const new_top = currentWordEl ? currentWordEl.offsetTop : null

    if(prev_top !== null && new_top !== null && new_top !== prev_top){
        cg_article_box.scrollBy({
            top: new_top - prev_top,   // 用新舊 offsetTop 的差值捲動，差多少就捲多少，天然對齊行高
            behavior: "smooth"         // 平滑捲動，跟文章模式的體驗一致
        })
    }
}

function cg_on_input(event){
    if(cg_finished) return

    if(!cg_start_time && cg_input_textarea.value.length > 0){
        cg_start_timer()
    }

    // 在「這次輸入造成畫面更新」之前，先把目前這格字的位置記下來，
    // 才有辦法在更新之後拿新舊位置比較、判斷要不要捲動。
    const prev_top = cg_get_char_top(cg_prev_target_index)

    // 【新增】每次輸入都重新跑一次即時比對（漏字/多打字容錯），結果快取進 cg_alignment，
    // 下面的上色、統計、捲動、完成判斷全部共用同一份結果。
    cg_recompute_alignment()

    cg_update_display()
    cg_update_live_stats()
    cg_auto_grow_textarea()   // 輸入框本身也要跟著內容長高（比照 game.html）

    // ===== 【比照 game.html 的 Check_Text_Input_Match】IME 組字中的防呆 =====
    // event.isComposing 為 true，代表使用者還在輸入法的選字階段（例如注音選字視窗還開著），
    // 這時候 textarea.value 只是「暫時」的內容，還不是使用者最終選定的字，
    // 所以只更新上色（視覺回饋）跟即時數據，先不要判斷「打完了沒」，也先不要捲動，
    // 避免選字選到一半，畫面就提早捲走或提早結束挑戰。
    if(event && event.isComposing){
        return
    }

    // 【修改】原本這裡是「拿這次新增的字元跟目標文章同一個位置比對，對上了才播音效」，
    // 但玩家是用注音輸入法打字：組字中的每一次按鍵，event.isComposing 都是 true，
    // 上面第 615 行 `if(event && event.isComposing) return` 早就把這個函式擋掉了，
    // 真正能跑到這裡的只有「選字選完、字元定案」那一次 input 事件，
    // 也就是說玩家按了一整串注音符號鍵卻幾乎聽不到聲音；空白鍵在 Zhuyin 輸入法裡
    // 大多是拿來選第一個候選字，不會真的打出空白字元，Play_Space_Sound() 這個分支
    // 實際上幾乎永遠不會被觸發。現在把播音效的邏輯整個搬到 cg_on_keydown_typing_sound
    // （綁在 keydown，見下方事件綁定區塊），只要按下鍵盤就給聲音回饋。
    cg_prev_input_length = cg_input_textarea.value.length
    cg_prev_target_pointer = cg_alignment ? cg_alignment.targetPointer : cg_prev_target_pointer

    // 走到這裡代表：不是在組字中，這時候才是「真正定案」的內容，
    // 可以放心拿來判斷換行、判斷有沒有打完。
    cg_maybe_scroll_to_next_line(prev_top)

    // ===== 【調整】文章打完了，不代表挑戰結束——怕題庫被打完，改成累計這篇的成績後，
    // 直接再抽一篇新的接著打，直到時間到才真正結算（cg_finish_challenge 只會被計時器呼叫）。
    // 【調整】改用比對結果的 targetPointer 判斷「打完了沒」，而不是直接比輸入框字數——
    // 因為現在漏字/多打字之後，輸入框字數不一定等於文章總字數了。 =====
    if(cg_alignment && cg_alignment.targetPointer >= cg_target_text.length){
        cg_draw_next_article()
    }
}

// ===== 【新增】把目前這篇文章的成績累加進總計，然後抽一篇新的文章接著打 =====
function cg_draw_next_article(){
    // 把這篇文章的正確字數／總字數累加起來，才不會因為換文章讓統計歸零
    cg_article_completed_correct += cg_count_correct(cg_input_textarea.value)
    cg_article_completed_typed += cg_input_textarea.value.length

    // 重新抽一篇新文章接著打（題庫會重複抽，永遠不會用完）
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

        // 打對了：把這個詞「吃掉」——輸入框清空、詞彙標記完成、往下一個詞前進
        cg_word_completed_text += target
        cg_word_index++

        cg_input_textarea.value = ""
        cg_word_prev_input_length = 0   // 【新增】詞被吃掉、輸入框清空了，音效追蹤也要跟著歸零
        cg_auto_grow_textarea()

        cg_refill_word_queue()
        cg_render_words()

        // ===== 【修正】原本用 scrollIntoView({block:"nearest"}) 要等詞卡完全跑出可視範圍
        // 才會瞬間跳動一次；改成比照文章模式的邏輯，只要換到新的一行就主動平滑捲動一行 =====
        cg_maybe_scroll_word_to_next_line(prev_top)

        cg_update_live_stats()
    }
}

// ===== 【新增】跳過目前這個詞（單詞模式專用）=====
// 設計原則：跳過的詞「完全不計入統計」——不算進 cg_word_completed_text（不算對），
// 也不會被當成打錯扣正確率，單純從結算畫面的「跳過次數」誠實揭露有跳過幾次，
// 不讓 WPM／正確率因為跳過而被灌水，也不會因為跳過而被扣分。
function cg_skip_word(){
    if(cg_stage !== "word" || cg_finished) return
    if(cg_word_queue.length === 0) return

    // 邏輯比照打對時的捲動處理：渲染前先記舊位置，渲染後再比新位置，換行才捲動
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

// ===== 【新增】統計「修正次數」：只抓玩家實際按下 Backspace / Delete 的按鍵次數 =====
// 用 keydown（而不是 input）來算，因為 keydown 保證「使用者每按一次實體按鍵」只會觸發一次，
// 不會受到輸入法組字過程（可能連續觸發多次 input 事件）影響，計數才會準確。
function cg_on_keydown_count_correction(event){
    if(cg_finished) return
    if(event.key === "Backspace" || event.key === "Delete"){
        cg_correction_count++
    }
}

// ===== 【新增，比照 game.html 的 Play_Typing_Feedback_Sound】打字音效：
// 純粹依照「玩家按了哪個實體鍵」決定播什麼音效，完全不管這個鍵最後有沒有讓輸入框
// 內容變成正確答案。文章模式（cg_on_input）跟單詞模式（cg_on_input_word）共用這一個函式。
//
// 這裡用 event.code（實體鍵盤位置，例如 "Space"、"Enter"、"KeyA"）而不是 event.key
// （輸入法轉換後的字元）：玩家用注音輸入法打字、IME 正在組字的過程中，Chrome 等瀏覽器
// 很多時候會把 event.key 回報成字串 "Process"（代表這個鍵被輸入法接管、還沒有確定的
// 字元可以回報），拿 event.key 判斷組字期間按的是不是空白鍵/Enter 幾乎判斷不出來；
// event.code 記錄的是「按下了鍵盤上哪一個實體按鍵」，不受組字狀態影響，
// 不管是不是正在選字，Space 永遠回報 "Space"、Enter 永遠回報 "Enter"。
function cg_on_keydown_typing_sound(event){
    if(cg_finished) return

    // 空白鍵、Enter 各自有專屬音效，優先判斷、判斷完直接 return，
    // 不會再落到下面「一般鍵隨機混音」的分支
    if(event.code === "Space"){
        Play_Space_Sound()
        return
    }
    if(event.code === "Enter" || event.code === "NumpadEnter"){
        Play_Enter_Sound()
        return
    }
    // 【新增】Backspace（退格）沿用 Enter 的音效，不用另外做新的音檔
    if(event.code === "Backspace"){
        Play_Enter_Sound()
        return
    }

    // 【新增】排除「不會打出任何注音符號」的功能鍵/控制鍵，避免切換視窗、
    // 按方向鍵移動游標時也跟著發出「打字」的音效
    // 【修改】Backspace 已經在上面獨立判斷、播 Enter 的音效，這裡的排除清單就把它拿掉
    const NON_TYPING_KEY_CODES = [
        "Tab", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight",
        "AltLeft", "AltRight", "CapsLock", "Escape", "MetaLeft", "MetaRight",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
        "Home", "End", "PageUp", "PageDown", "Delete", "Insert",
        "ContextMenu", "NumLock", "ScrollLock", "Pause", "PrintScreen"
    ]
    if(NON_TYPING_KEY_CODES.includes(event.code)) return
    if(/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) return   // F1 ~ F24 功能鍵

    // 其餘的鍵（不管最後打不打得對）一律當作「有效的一次打字動作」，
    // 用兩種音效隨機混音，避免一直重複同一個聲音聽起來很單調
    Play_Correct_Sound()
}

// ===== 【新增】把這次挑戰的結果存成一筆歷史紀錄，給 lobby 頁面畫進步曲線用 =====
function cg_save_history_entry(entry){
    let history = []
    try {
        history = JSON.parse(localStorage.getItem(CG_HISTORY_KEY)) || []
    } catch(e){
        // 如果舊資料格式壞掉或根本不是 JSON，直接當作沒有歷史紀錄重新開始，不讓整個功能壞掉
        history = []
    }

    history.push(entry)

    // 超過上限就把最舊的砍掉，只留最近 CG_HISTORY_MAX 筆
    if(history.length > CG_HISTORY_MAX){
        history = history.slice(history.length - CG_HISTORY_MAX)
    }

    localStorage.setItem(CG_HISTORY_KEY, JSON.stringify(history))
}

// ===== 【新增】追蹤「這次結算觸發的雲端同步」目前完成了沒 =====
// View_Challenge_Ranking() 跳頁前會等這個 Promise，避免使用者打完馬上點查看排名，
// 頁面在寫入請求送達伺服器前就被砍掉，導致分數/積分悄悄遺失。
let cg_pending_sync_promise = null

// ===== 【新增】分享成績卡用：存放這次結算算好的完整資料（wpm/acc/細項），供分享按鈕讀取 =====
// 跟 game.html 的 last_result_summary 是同一套邏輯，只是換一個變數名稱避免跟主線模式衝突
// （兩個頁面各自載入 TCTC2-0-share_card.js，不會同時存在同一個頁面，就算真的同時載入，
// 兩邊變數名稱不同也不會互相覆寫）。
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

    // ===== 【調整】跟 cg_update_live_stats 用同一套邏輯：正確率分母要加上 cg_correction_count，
    // 每按一次 Backspace / Delete 都算一次錯誤嘗試，最終結算的正確率才會跟即時顯示的算法一致 =====
    const acc_attempts = typed + cg_correction_count
    const finalAcc = acc_attempts > 0 ? Math.round((correct / acc_attempts) * 100) : 0

    // 【新增】跟 game.html 用同一個門檻：acc >= 90 才播放過關音效，acc < 90 不播
    if(finalAcc >= 90){
        Play_Complete_Sound()
    }

    // 挑戰結束當下，也順便檢查一次「最終 WPM」有沒有比過程中記錄到的瞬時最高值還高
    if(finalWpm > cg_highest_cpm) cg_highest_cpm = finalWpm

    // 單詞模式的詞彙庫會不斷自動補充、永遠打不完，只有文章模式才有「提早打完」這個狀態
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

    // ===== 【新增】把這次結算算出來的所有細項，存成分享卡按鈕會讀的資料 =====
    // 邏輯比照 game.html 的 last_result_summary：在這次結算的數字被存進 localStorage、
    // cg_correction_count / cg_skip_count 等變數被 Restart_Challenge() 重設之前，先存好一份快照，
    // 分享卡按鈕點下去的時候直接讀這裡，不用重新計算一次。
    // 跳過次數只有單詞模式才有意義（文章模式沒有「跳過」這個動作），文章模式就不塞這一項，
    // 避免分享卡上出現一行永遠是 0、對文章模式玩家沒有意義的數字。
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

    // ===== 【新增】結算積分＋比照主線模式的作法，用「累計平均」記錄 WPM / 正確率 =====
    // （跟 game.html 的 wpm_sum / wpm_times / average_wpm 邏輯一致，只是換一組 key 給挑戰模式獨立使用）
    // ===== 【新增】加分門檻：正確率 < 75% 或 WPM < 3，視為亂打／隨便打，這次不計分 =====
    // 用 finalAcc / finalWpm（結算當下算出來的最終值）判斷，不是即時值，避免中途數值抖動誤判
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

    // ===== 【新增】把這次結算觸發的所有雲端同步動作收集起來，
    // 讓「查看排名」按鈕跳頁前可以先等這些寫入真正送出去，
    // 不然使用者打完馬上點查看排名，頁面會在網路請求送達伺服器前就被砍掉，
    // 這次的分數/積分就會悄悄遺失、而且不會有任何錯誤訊息（因為連 callback 都沒機會執行）。
    const cg_sync_promises = []

    // ===== 【新增】把算出 wpm/acc 的原始數字一起存起來，方便之後把整包資料匯出做異常分析
    // （wpm/acc 的公式本身是公開的，光攔截改不了根本，但事後拿原始數字互相對照，
    // 抓得出「數字彼此矛盾」或「生理上不可能」這種明顯有問題的成績）=====
    const raw_stats = {
        correct: correct,
        wrong: wrong,
        duration_seconds: Math.round(elapsedSeconds),
        correction_count: cg_correction_count,
        skip_count: cg_skip_count
    }

    if(cg_meets_points_threshold && typeof Submit_Challenge_Score_To_Leaderboard === "function"){
        const comboId = `${cg_difficulty}-${cg_stage}-${cg_duration_seconds}`
        cg_sync_promises.push(Submit_Challenge_Score_To_Leaderboard(comboId, finalWpm, finalAcc, raw_stats))
    }
    // 【新增】跟主線模式 game.html 用一樣的做法：同一個「這次算不算數」的門檻判斷（cg_meets_points_threshold），
    // 同時把這次成績同步進「玩家總排行榜」（平均WPM／平均正確率／在線時長）
    if(cg_meets_points_threshold && typeof Sync_Player_Stats === "function"){
        cg_sync_promises.push(Sync_Player_Stats(finalWpm, finalAcc))
    }
    // 【新增】挑戰模式「自己專屬」的累計平均，另外存一組獨立的雲端欄位（cg_wpm_sum / cg_acc_sum...），
    // 不影響上面 Sync_Player_Stats 寫的整體平均——這樣切換身份（登入/登出/繼承）之後，
    // 挑戰大廳卡片上的「挑戰模式累計平均」才有雲端資料可以還原，不會變成本機清空後就永久消失。
    if(cg_meets_points_threshold && typeof Sync_Challenge_Player_Stats === "function"){
        cg_sync_promises.push(Sync_Challenge_Player_Stats(finalWpm, finalAcc))
    }
    // 【新增】把這次賺到的積分累加進玩家總積分榜。pointsEarned 在門檻沒過時已經是 0，
    // Sync_Player_Points 內部也會擋掉 <= 0 的呼叫，這裡的 if 只是避免多打一次不必要的雲端請求
    if(pointsEarned > 0 && typeof Sync_Player_Points === "function"){
        cg_sync_promises.push(Sync_Player_Points(pointsEarned))
    }

    // 統一存成一個 Promise，View_Challenge_Ranking 之後會等它完成（或等到 timeout）才跳頁
    cg_pending_sync_promise = Promise.all(cg_sync_promises)

    // ===== 【新增】存一筆歷史紀錄，供 lobby 頁面畫進步曲線 =====
    // 注意：這裡故意不管有沒有達到加分門檻都照存，因為進步曲線是「表現趨勢」，
    // 不是「有沒有拿到分」，就算這次沒達標也是曲線的一部分，誠實呈現真實表現。
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

// ===== 【新增】共用：離開結算畫面前，先等這次結算觸發的雲端同步完成（如果有的話），
// 不然常常會發生「剛打完馬上點按鈕跳走」這種操作，把還沒送達伺服器的分數/積分寫入直接砍斷。
// 用 Promise.race 加一個保底逾時（3 秒），避免離線或伺服器異常時，
// 玩家會被卡在結算畫面按了沒反應，體驗比「稍微可能漏同步」更差。
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

// ===== 【新增】跳到排行榜頁面，直接定位到「這一次打的難度＋模式＋時間長度」組合 =====
function View_Challenge_Ranking(){
    const comboId = `${cg_difficulty}-${cg_stage}-${cg_duration_seconds}`
    // 【新增】帶上 return_to = 這次打的這一頁網址（含難度/秒數/模式參數），
    // 排行榜返回時才會回到「這次打的這個挑戰畫面」，而不是隨便一個由排行榜選單猜出來的組合
    Leave_Challenge_Result(`TCTC2-0-ranking.html?mode=challenge&combo=${comboId}&return_to=${encodeURIComponent(window.location.href)}`)
}

// ===== 【新增】分享成績卡按鈕的進入點 =====
// 跟 game.html 的 Share_Current_Result() 是同一套做法：純粹轉接，檢查資料存不存在（防呆用，
// 理論上這個按鈕只會在結算畫面顯示之後才點得到，一定會有資料），有的話直接交給
// share_card.js 的 Open_Share_Card_Modal() 處理接下來所有事情（畫 Canvas、跳出預覽彈窗、下載按鈕）。
// 不需要等雲端同步（cg_pending_sync_promise），分享卡是純前端畫圖，跟排行榜/積分同步沒有關係。
function Share_Current_Challenge_Result(){
    if(!last_challenge_result_summary) return
    Open_Share_Card_Modal(last_challenge_result_summary)
}

function Restart_Challenge(){
    if(cg_result_window) cg_result_window.classList.add("is_hidden")
    cg_init(cg_difficulty, cg_duration_seconds, cg_stage)
}

// ===== 【新增】左上角「←」返回大廳按鈕的確認機制 =====
// 只有「挑戰已經開始計時、但還沒結束」的時候才需要跳出確認視窗，
// 因為這種狀態下離開會直接把這次的成績丟掉，沒有任何存檔機制。
// 如果玩家根本還沒開始打字（cg_start_time 還是 null），或挑戰已經結束（cg_finished），
// 離開沒有任何損失，直接放行、不用打擾玩家。
function Confirm_Leave_Challenge(){
    const in_progress = cg_start_time && !cg_finished
    if(in_progress && !confirm("挑戰還沒結束，現在離開這次的成績不會被記錄，確定要返回大廳嗎？")){
        return
    }
    window.location.href = "TCTC2-0-challenge_lobby.html"
}

// ===== 綁定事件 =====
if(cg_input_textarea){
    cg_input_textarea.addEventListener("input", cg_on_input_router)
    cg_input_textarea.addEventListener("keydown", cg_on_keydown_count_correction)   // 【新增】統計修正次數
    cg_input_textarea.addEventListener("keydown", cg_on_keydown_typing_sound)       // 【新增】按鍵就播打字音效，不用管打不打對

    // ===== 【比照 game.html】IME 選字結束時，再檢查一次 =====
    // 例如玩家打「ㄋㄧˇ ㄏㄠˇ」選出「你好」，選字完成的當下會觸發 compositionend，
    // 如果游標剛好卡在「還在組字」狀態被上面 cg_on_input 的 isComposing 擋下來，
    // 就必須靠這個事件補一次「捲動 / 是否打完」的判斷，不然畫面會停在選字前的舊狀態。
    cg_input_textarea.addEventListener("compositionend", cg_on_input_router)

    // ===== 【比照 game.html】按 Enter 不換行 =====
    // textarea 預設按 Enter 會直接插入 \n，但挑戰文章本身沒有換行符號，
    // 如果讓玩家真的打出換行，逐字比對一定會對不上、卡關。
    // 攔截 Enter、阻止預設換行，行為維持跟單行輸入框一樣。
    cg_input_textarea.addEventListener("keydown", function(event){
        if(event.key === "Enter"){
            event.preventDefault()
        }
    })

    // ===== 【比照 game.html】防止直接貼上文章作弊 =====
    // 挑戰模式是拿來測「真實打字速度」的，如果可以整段貼上，WPM / 正確率就完全失去意義。
    // event.preventDefault() 會擋掉貼上這個動作本身，textarea 的內容完全不會被貼上的文字改變。
    cg_input_textarea.addEventListener("paste", function(event){
        event.preventDefault()
        alert("作弊得來的成績真的有意義嗎?")
    })

    // ===== 【比照 game.html】同理，防止用滑鼠把選取的文字「拖曳」進輸入框 =====
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
// ===== 【新增】跳過按鈕綁定 =====
if(cg_skip_btn){
    cg_skip_btn.addEventListener("click", cg_skip_word)
}

// ===== 【新增】標點符號輸入提示視窗 =====
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
    // ===== 【比照 game.html 的 Bind_Countdown_Modal_Events】點擊遮罩本身（不是點裡面的內容面板）就關閉視窗 =====
    // event.target 是「使用者實際點到的那個元素」，只有直接點在半透明遮罩上（cm_window 本身）
    // event.target 才會等於 cg_punct_modal_overlay；如果點的是裡面的文字、按鈕，
    // event.target 會是那些子元素，不會誤觸關閉，避免玩家想選取文字卻不小心把視窗關掉。
    cg_punct_modal_overlay.addEventListener("click", function(event){
        if(event.target === cg_punct_modal_overlay){
            Close_Punctuation_Modal()
        }
    })
}

// ===== 【新增】單詞模式教學視窗 =====
// 目的：很多玩家第一次玩單詞模式，會下意識打完一個詞就按空白鍵/Enter，以為要手動送出，
// 但實際上系統是「打對就自動判定完成、直接接下一個詞」，不需要手動送出。
// 用一個 localStorage flag 記住「玩家已經勾選不再顯示」，勾了之後才會永久跳過這個視窗，
// 沒勾的話，每一次進單詞模式（包含按「再來一次」）都會再跳出來提醒一次。
const CG_WORD_INTRO_KEY       = "tctc2.0-challenge_word_intro_dismissed"
const cg_word_intro_modal     = document.getElementById("cg_word_intro_modal")
const cg_word_intro_dontshow  = document.getElementById("cg_word_intro_dontshow")
const cg_word_intro_start_btn = document.getElementById("cg_word_intro_start_btn")

function cg_show_word_intro_modal(){
    if(!cg_word_intro_modal) return
    // 視窗蓋著的時候先鎖住輸入框，避免玩家隔著視窗盲打，意外把計時器啟動掉
    if(cg_input_textarea) cg_input_textarea.disabled = true
    cg_word_intro_modal.classList.remove("is_hidden")
}

function cg_close_word_intro_modal(){
    if(!cg_word_intro_modal) return

    // 勾了「之後不再顯示」才寫進 localStorage，沒勾的話這次只是關掉，下次進單詞模式還是會再跳出來
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
    // 點遮罩本身（不是點裡面的內容面板）也能關閉，邏輯跟標點符號提示視窗一致
    cg_word_intro_modal.addEventListener("click", function(event){
        if(event.target === cg_word_intro_modal){
            cg_close_word_intro_modal()
        }
    })
}

// ===== 頁面載入時，讀取網址上的 ?difficulty= 與 ?seconds= 開始測驗 =====
document.addEventListener("DOMContentLoaded", function(){
    Init_Typing_Sound()   // 【新增】頁面一載入就準備好打字音效
    const settings = cg_get_settings_from_url()
    cg_init(settings.difficulty, settings.seconds, settings.stage)
})