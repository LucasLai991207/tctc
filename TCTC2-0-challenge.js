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
let cg_prev_typed_length = 0

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
    cg_prev_typed_length = 0   // 重置捲動追蹤用的索引，避免沿用到上一輪的進度

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

function cg_start_timer(){
    if(cg_timer_handle) return
    cg_start_time = Date.now()

    cg_timer_handle = setInterval(function(){
        const elapsedSec = (Date.now() - cg_start_time) / 1000
        const remaining = cg_duration_seconds - elapsedSec

        cg_timer_el.textContent = cg_format_time(remaining)
        if(remaining <= 10) cg_timer_el.classList.add("cg_timer_warn")

        cg_update_live_stats()

        if(remaining <= 0){
            cg_finish_challenge()
        }
    }, 250)
}

function cg_count_correct(typedValue){
    let correct = 0
    const len = Math.min(typedValue.length, cg_target_text.length)
    for(let i = 0; i < len; i++){
        if(typedValue[i] === cg_target_text[i]) correct++
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

function cg_update_display(){
    const typedValue = cg_input_textarea.value
    const chars = cg_article_box.children

    for(let i = 0; i < chars.length; i++){
        const span = chars[i]
        span.classList.remove("correct", "wrong", "current")

        if(i < typedValue.length){
            span.classList.add(typedValue[i] === cg_target_text[i] ? "correct" : "wrong")
        } else if(i === typedValue.length){
            span.classList.add("current")
        }
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
    const new_index = cg_input_textarea.value.length
    const new_top = cg_get_char_top(new_index)

    if(prev_top !== null && new_top !== null && new_top !== prev_top){
        cg_article_box.scrollBy({
            top: new_top - prev_top,   // 直接用差值，換一行捲一行，換兩行（例如選字選出一長串詞）就自動捲兩行的量
            behavior: "smooth"         
        })
    }

    cg_prev_typed_length = new_index
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
    const prev_top = cg_get_char_top(cg_prev_typed_length)

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

    // 走到這裡代表：不是在組字中，這時候才是「真正定案」的內容，
    // 可以放心拿來判斷換行、判斷有沒有打完。
    cg_maybe_scroll_to_next_line(prev_top)

    // ===== 【調整】文章打完了，不代表挑戰結束——怕題庫被打完，改成累計這篇的成績後，
    // 直接再抽一篇新的接著打，直到時間到才真正結算（cg_finish_challenge 只會被計時器呼叫）=====
    if(cg_input_textarea.value.length >= cg_target_text.length){
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
    cg_prev_typed_length = 0

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

    if(target.length > 0 && typedValue === target){
        // ===== 【新增】在「這個詞被吃掉、畫面重新渲染」之前，先記下目前這個詞卡的 offsetTop，
        // 才有辦法在渲染完之後拿新舊位置比較、判斷下一個詞是不是換到新的一行了 =====
        const prev_word_el = document.getElementById("cg_current_word")
        const prev_top = prev_word_el ? prev_word_el.offsetTop : null

        // 打對了：把這個詞「吃掉」——輸入框清空、詞彙標記完成、往下一個詞前進
        cg_word_completed_text += target
        cg_word_index++

        cg_input_textarea.value = ""
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
    Leave_Challenge_Result(`TCTC2-0-ranking.html?mode=challenge&combo=${comboId}`)
}

function Restart_Challenge(){
    if(cg_result_window) cg_result_window.classList.add("is_hidden")
    cg_init(cg_difficulty, cg_duration_seconds, cg_stage)
}

// ===== 綁定事件 =====
if(cg_input_textarea){
    cg_input_textarea.addEventListener("input", cg_on_input_router)
    cg_input_textarea.addEventListener("keydown", cg_on_keydown_count_correction)   // 【新增】統計修正次數

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
    const settings = cg_get_settings_from_url()
    cg_init(settings.difficulty, settings.seconds, settings.stage)
})