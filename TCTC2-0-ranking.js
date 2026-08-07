/* ============================================================
   TCTC2-0-ranking.js
   排行榜頁面邏輯：
   - 「主線關卡」模式：難度/章節/關卡三層選單 + 讀取該關卡的雲端排行榜
   - 「挑戰模式」：難度/文章單詞/時間長度三個獨立選單 + 讀取該組合的雲端排行榜
   依賴：TCTC2-0-level_data.js（拿 Level_Data 關卡資料，主線關卡模式用）
        TCTC2-0-firebase.js（Get_Stage_Leaderboard / Get_Challenge_Leaderboard）
   ============================================================ */

// ===== 【修改】排行榜返回鍵：改成用網址帶的 return_to 參數記住「真正的入口」 =====
// 原本的做法是讀「排行榜頁面現在選單顯示的難度/秒數/關卡」去猜返回目的地，
// 這樣做有兩個問題：(1) 就算猜對是挑戰模式，也是猜去遊戲畫面，不是大廳，
// 目的地本身就不對；(2) 只要使用者進來之後自己切換過選單/分頁，
// 猜出來的目的地就會跟他真正的來源完全無關（例如從導覽列直接點「排行榜」，
// 選單預設停在某個組合，按返回卻被送進那個組合的遊戲畫面）。
//
// 現在改成：game.html / TCTC2-0-challenge_lobby.js / TCTC2-0-challenge.js
// 這三個「真正會連來排行榜」的入口，各自在跳轉時把「自己當下的網址」用
// return_to 參數一起帶過來；這裡只負責讀出來、原封不動送回去，
// 不管使用者進來後在排行榜頁面裡怎麼切換選單都不影響返回目的地。
// 如果網址沒帶 return_to（例如直接從導覽列的「排行榜」連結、或直接貼網址進來），
// 代表不是從任何一個「關卡/大廳」過來的，沒有一個該回去的地方，退回主畫面就是合理預設值。
const ranking_return_to = new URLSearchParams(window.location.search).get("return_to")

//======= 共用 DOM =======
const mode_tab_stage = document.getElementById("ranking_mode_tab_stage")
const mode_tab_challenge = document.getElementById("ranking_mode_tab_challenge")
const mode_tab_player = document.getElementById("ranking_mode_tab_player")
const stage_selector_row = document.getElementById("ranking_stage_selector_row")
const challenge_selector_row = document.getElementById("ranking_challenge_selector_row")
const player_selector_row = document.getElementById("ranking_player_selector_row")

const stage_label_el = document.getElementById("ranking_stage_label")
const stage_label_el2 = document.getElementById("ranking_stage_label2")

const list_body_el = document.getElementById("ranking_list_body")
const empty_msg_el = document.getElementById("ranking_empty_msg")
const loading_msg_el = document.getElementById("ranking_loading_msg")

// ===== 【新增】自己名次浮窗：貼在畫面底部置中，顯示「名次／玩家名／目前這份榜單對應的數值」=====
const self_rank_bar_el = document.getElementById("ranking_self_rank_bar")
const self_rank_text_el = document.getElementById("ranking_self_rank_text")

function Hide_Self_Rank_Bar() {
    if (self_rank_bar_el) self_rank_bar_el.classList.add("is_hidden")
}

// rank：名次數字；name：玩家名稱；value_text：依目前選的榜單而變的那個欄位（WPM／正確率／在線時長……）
function Show_Self_Rank_Bar(rank, name, value_text) {
    if (!self_rank_bar_el || !self_rank_text_el) return

    const rank_display = medal_by_rank[rank] || rank
    self_rank_text_el.innerHTML = `
        <span class="ranking_self_bar_rank">${rank_display}</span>
        <span class="ranking_self_bar_name">${Escape_Html(name || "訪客")}</span>
        <span class="ranking_self_bar_value">${value_text}</span>
    `
    self_rank_bar_el.classList.remove("is_hidden")
}

// 兩個會隨分頁切換而改變文字的欄位標題（主線/挑戰模式固定顯示「WPM／正確率」，
// 玩家總榜則依目前選的指標動態改成「平均WPM／測驗次數」之類的文字）
const col_header_metric1_el = document.getElementById("ranking_col_header_metric1")
const col_header_metric2_el = document.getElementById("ranking_col_header_metric2")

let ranking_mode = "stage" // "stage" | "challenge" | "player"

//======= 主線關卡模式 DOM/常數 =======
const difficulty_select = document.getElementById("ranking_difficulty_select")
const chapter_select = document.getElementById("ranking_chapter_select")
const stage_select = document.getElementById("ranking_stage_select")

const difficulty_display_name = {
    easy: "初級（LEVEL I）",
    medium: "中級（LEVEL II）",
    hard: "高級（LEVEL III）"
}

//======= 挑戰模式 DOM/常數（跟 TCTC2-0-challenge.js / challenge_lobby.js 保持一致）=======
const cg_difficulty_select = document.getElementById("ranking_cg_difficulty_select")
const cg_stage_select = document.getElementById("ranking_cg_stage_select")
const cg_seconds_select = document.getElementById("ranking_cg_seconds_select")

const CG_ALLOWED_DIFFICULTIES = ["easy", "medium", "hard", "extreme"]
const CG_DIFFICULTY_LABEL = { easy: "簡單", medium: "普通", hard: "困難", extreme: "極限" }

const CG_ALLOWED_STAGES = ["article", "word"]
const CG_STAGE_LABEL = { article: "文章模式", word: "單詞模式" }

const CG_ALLOWED_SECONDS = [30, 60, 180, 300, 600]
const CG_DURATION_LABEL = { 30: "30 秒", 60: "1 分鐘", 180: "3 分鐘", 300: "5 分鐘", 600: "10 分鐘" }

//避免玩家自訂的姓名裡面含有 <, > 等符號被當成HTML標籤插入畫面
function Escape_Html(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

//======= 渲染排行榜列表（兩種模式共用）=======
const medal_by_rank = { 1: "🥇", 2: "🥈", 3: "🥉" }

// ===== 【新增】標準競賽排名（Standard Competition Ranking，俗稱 1224 制）=====
// 規則：分數相同 → 名次相同；下一個「不同分數」的名次，直接跳到「目前總共有幾筆資料排在他前面（含自己）」，
// 也就是同分的人會把底下的名次「佔位」擠掉，例如：100 100 90 80 → 名次是 1 1 3 4（不是 1 1 2 3）。
//
// 參數：
//   list      —— 已經「由大到小排序好」的原始榜單陣列（這個函式不負責排序，只負責『在排好的順序上』標名次）
//   get_value —— 一個函式，傳入單筆 entry，回傳「用來判斷同分與否」的那個數值
//                （stage/challenge 模式用 wpm；玩家總榜依目前選的指標可能是 avg_wpm / avg_acc / online_seconds 等）
//
// 回傳：一個長度跟 list 一樣的陣列，ranks[i] 就是 list[i] 這筆資料對應的名次數字。
//
// 【重要前提】這個函式假設 list 已經是「依 get_value 由大到小排序」的狀態
// （也就是 Firebase 那邊 orderBy 出來的順序）。如果傳進來的陣列本身順序不對，算出來的名次也會跟著錯，
// 因為這裡完全不做排序，只單純比較「跟上一筆是不是同分」。
function Compute_Competition_Ranks(list, get_value) {
    const ranks = new Array(list.length)

    list.forEach(function (entry, index) {
        if (index > 0 && get_value(entry) === get_value(list[index - 1])) {
            // 跟前一筆同分 → 直接沿用前一筆的名次，不要 +1
            ranks[index] = ranks[index - 1]
        } else {
            // 跟前一筆不同分（或是第一筆）→ 名次 = 目前排在他前面的總筆數 + 1
            // 這一步就是「跳號」的關鍵：即使前面有好幾筆同分，index 仍然是連續遞增的，
            // 所以只要分數一改變，名次就會直接跳到正確的位置，中間的名次自動被同分的人佔掉了。
            ranks[index] = index + 1
        }
    })

    return ranks
}

// 【修改】回傳一個布林值：這份榜單裡有沒有出現「自己」。
// 呼叫端會用這個布林值決定要不要另外去查「自己排第幾名」、顯示底部浮窗。
function Render_Leaderboard(list) {
    list_body_el.innerHTML = ""

    if (!list || list.length === 0) {
        empty_msg_el.classList.remove("is_hidden")
        return false
    }
    empty_msg_el.classList.add("is_hidden")

    let self_found_in_list = false

    // 【修改】這份榜單排名的依據是 wpm（跟 Firebase 端 orderBy("wpm") 的排序欄位保持一致）。
    // 用 Compute_Competition_Ranks 算出「考慮同分」的正確名次陣列，取代原本單純的 index + 1。
    const ranks = Compute_Competition_Ranks(list, function (entry) { return entry.wpm })

    list.forEach(function (entry, index) {
        const rank = ranks[index]
        const row = document.createElement("div")
        row.className = "ranking_row"
        // 用「名次」而不是「陣列索引」判斷要不要套用前三名的金色樣式，
        // 這樣如果第 2 名同分有兩個人，兩個人都還是會被標成前三名（因為他們的名次真的是 2）
        if (rank <= 3) row.classList.add("ranking_row_top3")
        // 【新增】比對這筆資料是不是「我自己」上傳的（用 anon_id 判斷），是的話特別標記出來
        const is_self = typeof Get_Anon_Id === "function" && entry._anon_id === Get_Anon_Id()
        if (is_self) {
            row.classList.add("ranking_row_self")
            self_found_in_list = true
        }

        row.innerHTML = `
            <div class="rank_col_rank">${medal_by_rank[rank] || rank}</div>
            <div class="rank_col_name">${Escape_Html(entry.name || "訪客")}${is_self ? ' <span class="ranking_self_tag">你</span>' : ""}</div>
            <div class="rank_col_wpm">${entry.wpm}</div>
            <div class="rank_col_acc">${typeof entry.acc === "number" ? entry.acc + "%" : "-"}</div>
        `
        list_body_el.appendChild(row)
    })

    return self_found_in_list
}

//把畫面切到「載入中」狀態，兩種模式共用
//【新增】順便收起底部的自己名次浮窗——不然切換難度/章節/關卡時，
//浮窗會一直留著上一份榜單算出來的舊名次，跟畫面上新載入的榜單對不起來。
function Set_Loading_State() {
    list_body_el.innerHTML = ""
    empty_msg_el.classList.add("is_hidden")
    loading_msg_el.textContent = "載入中..."
    loading_msg_el.classList.remove("is_hidden")
    Hide_Self_Rank_Bar()
}

/* ============================================================
   主線關卡模式
   ============================================================ */

// ===== 判斷一個關卡「會不會被採計進排行榜」=====
// 一定要跟 game.html 裡的 Is_Leaderboard_Stage() 保持同一套規則，
// 不然選單裡選得到、但這關其實從來不會上傳分數，點進去只會看到一片空白，
// 玩家會以為網站壞了。
// 條件：章節驗收／精熟度測試（初級）、基礎輸入（初級）、速度挑戰（高級）、
// 綜合練習（中級，2-1-0 教學關本身是「基礎教學」type，不會落在這裡，天生排除）
function Counts_For_Leaderboard(stage) {
    if (!stage) return false
    return stage.name === "章節驗收"
        || stage.name === "精熟度測試"
        || stage.type === "基礎輸入"
        || stage.type === "速度挑戰"
        || stage.type === "綜合練習"
}

//在整個 Level_Data 裡面，用 stage id 反查它屬於哪個難度/章節/關卡物件
function Find_Stage_Location(stage_id) {
    for (const difficulty in Level_Data) {
        const chapters = Level_Data[difficulty].chapter || []
        for (const chapter of chapters) {
            const stages = chapter.stage || []
            for (const stage of stages) {
                if (stage.id === stage_id) {
                    return { difficulty, chapter, stage }
                }
            }
        }
    }
    return null
}

//======= 填充「難度」下拉選單 =======
function Populate_Difficulty_Select() {
    difficulty_select.innerHTML = ""
    Object.keys(Level_Data).forEach(function (difficulty) {
        const option = document.createElement("option")
        option.value = difficulty
        option.textContent = difficulty_display_name[difficulty] || difficulty
        difficulty_select.appendChild(option)
    })
}

//======= 根據目前選的難度，填充「章節」下拉選單 =======
// 只列出「至少有一關會採計進排行榜」的章節，像初級 1-0 認識鍵盤整章都是介紹關，
// 選了也只會看到空選單，乾脆直接不給選
function Populate_Chapter_Select(difficulty) {
    chapter_select.innerHTML = ""
    const chapters = (Level_Data[difficulty] && Level_Data[difficulty].chapter) || []
    chapters.forEach(function (chapter) {
        const stages = chapter.stage || []
        const has_ranked_stage = stages.some(Counts_For_Leaderboard)
        if (!has_ranked_stage) return

        const option = document.createElement("option")
        option.value = chapter.id
        option.textContent = chapter.name
        chapter_select.appendChild(option)
    })
}

//======= 根據目前選的章節，填充「關卡」下拉選單 =======
// 同樣只列出會採計進排行榜的關卡（例如中級 2-1-0 標點符號教學不會出現）
function Populate_Stage_Select(difficulty, chapter_id) {
    stage_select.innerHTML = ""
    const chapters = (Level_Data[difficulty] && Level_Data[difficulty].chapter) || []
    const chapter = chapters.find(function (c) { return c.id === chapter_id })
    const stages = (chapter && chapter.stage) || []
    stages.filter(Counts_For_Leaderboard).forEach(function (stage) {
        const option = document.createElement("option")
        option.value = stage.id
        option.textContent = `${stage.id}　${stage.name}${stage.name2 || ""}`
        stage_select.appendChild(option)
    })
}

//======= 三層選單互相連動 =======
function Set_Selectors_To_Stage(stage_id) {
    const location = Find_Stage_Location(stage_id)
    if (!location) return false

    Populate_Chapter_Select(location.difficulty)
    difficulty_select.value = location.difficulty

    chapter_select.value = location.chapter.id
    Populate_Stage_Select(location.difficulty, location.chapter.id)
    stage_select.value = stage_id

    return true
}

difficulty_select.addEventListener("change", function () {
    Populate_Chapter_Select(this.value)
    Populate_Stage_Select(this.value, chapter_select.value)
    On_Stage_Select_Changed()
})

chapter_select.addEventListener("change", function () {
    Populate_Stage_Select(difficulty_select.value, this.value)
    On_Stage_Select_Changed()
})

stage_select.addEventListener("change", On_Stage_Select_Changed)

function On_Stage_Select_Changed() {
    const stage_id = stage_select.value
    if (!stage_id) return

    //把目前選到的關卡同步進網址，這樣這個連結可以直接分享/收藏
    const url = new URL(window.location.href)
    url.searchParams.set("mode", "stage")
    url.searchParams.set("stage", stage_id)
    url.searchParams.delete("combo")
    history.replaceState(null, "", url)

    Load_Stage_Leaderboard(stage_id)
}

function Load_Stage_Leaderboard(stage_id) {
    const location = Find_Stage_Location(stage_id)
    stage_label_el.textContent = location
        ? `${stage_id}　${location.stage.name}${location.stage.name2 || ""}`
        : stage_id

    Set_Loading_State()

    if (typeof Get_Stage_Leaderboard !== "function") {
        loading_msg_el.textContent = "排行榜載入失敗，請確認 Firebase 設定是否正確。"
        return
    }

    Get_Stage_Leaderboard(stage_id, function (list) {
        loading_msg_el.classList.add("is_hidden")
        Render_Leaderboard(list)
        // 不管有沒有擠進這份 Top 50 榜單，都額外查一次「自己實際排第幾名」，顯示在底部浮窗——
        // 上榜的話這個浮窗會跟榜單裡自己那一列的名次一致，等於是「固定貼底、不用滾動找」的捷徑
        Load_Own_Stage_Rank(stage_id)
    })
}

// ===== 【新增】查詢並顯示「自己在這一關的實際名次」，不管有沒有進 Top 50 都會呼叫 =====
function Load_Own_Stage_Rank(stage_id) {
    if (typeof Get_Own_Stage_Rank !== "function") return
    Get_Own_Stage_Rank(stage_id, function (result) {
        if (!result) return // 這一關還沒打過，沒有名次可以顯示
        Show_Self_Rank_Bar(result.rank, result.name, `${result.wpm} WPM`)
    })
}

//找出「第一個至少有一個採計關卡」的難度/章節，回傳該章節第一個採計關卡的 id
//用途：初次進入頁面、或網址帶的 stage 無效時的預設值
function Find_First_Ranked_Stage_Id() {
    for (const difficulty in Level_Data) {
        const chapters = Level_Data[difficulty].chapter || []
        for (const chapter of chapters) {
            const stages = chapter.stage || []
            const first_ranked_stage = stages.find(Counts_For_Leaderboard)
            if (first_ranked_stage) return first_ranked_stage.id
        }
    }
    return null
}

/* ============================================================
   挑戰模式
   ============================================================ */

function Populate_Cg_Difficulty_Select() {
    cg_difficulty_select.innerHTML = ""
    CG_ALLOWED_DIFFICULTIES.forEach(function (difficulty) {
        const option = document.createElement("option")
        option.value = difficulty
        option.textContent = CG_DIFFICULTY_LABEL[difficulty]
        cg_difficulty_select.appendChild(option)
    })
}

function Populate_Cg_Stage_Select() {
    cg_stage_select.innerHTML = ""
    CG_ALLOWED_STAGES.forEach(function (stage) {
        const option = document.createElement("option")
        option.value = stage
        option.textContent = CG_STAGE_LABEL[stage]
        cg_stage_select.appendChild(option)
    })
}

function Populate_Cg_Seconds_Select() {
    cg_seconds_select.innerHTML = ""
    CG_ALLOWED_SECONDS.forEach(function (seconds) {
        const option = document.createElement("option")
        option.value = seconds
        option.textContent = CG_DURATION_LABEL[seconds]
        cg_seconds_select.appendChild(option)
    })
}

//comboId 格式：難度-模式-秒數，例如 "easy-article-30"，要跟 TCTC2-0-challenge.js 上傳分數時組的格式一致
function Is_Valid_Combo(difficulty, stage, seconds) {
    return CG_ALLOWED_DIFFICULTIES.includes(difficulty)
        && CG_ALLOWED_STAGES.includes(stage)
        && CG_ALLOWED_SECONDS.includes(seconds)
}

function Parse_Combo_Id(combo_id) {
    if (!combo_id) return null
    const parts = combo_id.split("-")
    if (parts.length !== 3) return null

    const difficulty = parts[0]
    const stage = parts[1]
    const seconds = Number(parts[2])

    if (!Is_Valid_Combo(difficulty, stage, seconds)) return null
    return { difficulty, stage, seconds }
}

function Set_Cg_Selectors_To_Combo(combo) {
    cg_difficulty_select.value = combo.difficulty
    cg_stage_select.value = combo.stage
    cg_seconds_select.value = combo.seconds
}

function Current_Combo_Id() {
    return `${cg_difficulty_select.value}-${cg_stage_select.value}-${cg_seconds_select.value}`
}

cg_difficulty_select.addEventListener("change", On_Cg_Select_Changed)
cg_stage_select.addEventListener("change", On_Cg_Select_Changed)
cg_seconds_select.addEventListener("change", On_Cg_Select_Changed)

function On_Cg_Select_Changed() {
    const combo_id = Current_Combo_Id()

    const url = new URL(window.location.href)
    url.searchParams.set("mode", "challenge")
    url.searchParams.set("combo", combo_id)
    url.searchParams.delete("stage")
    history.replaceState(null, "", url)

    Load_Challenge_Leaderboard(combo_id)
}

function Load_Challenge_Leaderboard(combo_id) {
    const combo = Parse_Combo_Id(combo_id)
    stage_label_el.textContent = combo
        ? `挑戰模式｜${CG_DIFFICULTY_LABEL[combo.difficulty]}｜${CG_STAGE_LABEL[combo.stage]}｜${CG_DURATION_LABEL[combo.seconds]}`
        : combo_id

    Set_Loading_State()

    if (typeof Get_Challenge_Leaderboard !== "function") {
        loading_msg_el.textContent = "排行榜載入失敗，請確認 Firebase 設定是否正確。"
        return
    }

    Get_Challenge_Leaderboard(combo_id, function (list) {
        loading_msg_el.classList.add("is_hidden")
        Render_Leaderboard(list)
        // 不管有沒有擠進這份 Top 50 榜單，都額外查一次「自己實際排第幾名」，顯示在底部浮窗
        Load_Own_Challenge_Rank(combo_id)
    })
}

// ===== 【新增】查詢並顯示「自己在這個挑戰組合的實際名次」，不管有沒有進 Top 50 都會呼叫 =====
function Load_Own_Challenge_Rank(combo_id) {
    if (typeof Get_Own_Challenge_Rank !== "function") return
    Get_Own_Challenge_Rank(combo_id, function (result) {
        if (!result) return
        Show_Self_Rank_Bar(result.rank, result.name, `${result.wpm} WPM`)
    })
}

/* ============================================================
   玩家總排行榜（平均WPM最高／平均正確率最高／在線時長最長）
   ------------------------------------------------------------
   跟上面兩種模式最大的不同：這裡沒有「選單」，只有 3 個固定按鈕可以切換，
   而且左側名次之後的兩欄（WPM／正確率）在這個模式下會被「借用」來顯示
   不同的東西（平均WPM、測驗次數、在線時長……），所以欄位標題也要跟著動態改字。
   ============================================================ */

let player_metric = "avg_wpm" // "avg_wpm" | "avg_acc" | "online_seconds" | "total_points" | "page_views"

const player_metric_buttons = {
    avg_wpm: document.getElementById("ranking_player_metric_wpm"),
    avg_acc: document.getElementById("ranking_player_metric_acc"),
    online_seconds: document.getElementById("ranking_player_metric_online"),
    total_points: document.getElementById("ranking_player_metric_points"),
    // 【新增】瀏覽次數最多榜的按鈕
    page_views: document.getElementById("ranking_player_metric_views")
}

// 把「總秒數」轉成「X 小時 Y 分」這種給人看的格式。
// 用 Math.floor 而不是四捨五入，因為在線時長是「累積量」，無條件捨去比較保守、不會灌水。
function Format_Online_Seconds(total_seconds) {
    const seconds_int = Math.floor(total_seconds || 0)
    if (seconds_int < 60) return `${seconds_int} 秒`

    const hours = Math.floor(seconds_int / 3600)
    const minutes = Math.floor((seconds_int % 3600) / 60)
    const seconds = seconds_int % 60

    if (hours > 0) return `${hours}時${minutes}分${seconds}秒`
    return `${minutes} 分 ${seconds} 秒`
}

// ===== 【新增】依「目前選的玩家總榜指標」，回傳這筆 entry 用來排名/判斷同分的數值 =====
// 一定要跟 Load_Player_Leaderboard() 裡呼叫的 Get_Top_Players_By_XXX（Firebase 端 orderBy 的欄位）對應，
// 不然畫面上顯示的名次會跟 Firebase 排序出來的順序對不起來。
function Get_Player_Metric_Value(entry) {
    if (player_metric === "avg_wpm") return entry.avg_wpm ?? 0
    if (player_metric === "avg_acc") return entry.avg_acc ?? 0
    if (player_metric === "total_points") return entry.total_points ?? 0
    if (player_metric === "page_views") return entry.page_views ?? 0
    return entry.online_seconds ?? 0 // 預設：在線時長榜
}

// 依目前選的指標，把「名次之後的兩欄」渲染成對應的內容
// 【修改】跟 Render_Leaderboard 一樣，回傳「自己有沒有出現在這份榜單裡」
function Render_Player_Leaderboard(list) {
    list_body_el.innerHTML = ""

    if (!list || list.length === 0) {
        empty_msg_el.classList.remove("is_hidden")
        return false
    }
    empty_msg_el.classList.add("is_hidden")

    let self_found_in_list = false

    // 【修改】用目前選中的指標（avg_wpm／avg_acc／online_seconds／total_points／page_views）當作同分判斷依據
    const ranks = Compute_Competition_Ranks(list, Get_Player_Metric_Value)

    list.forEach(function (entry, index) {
        const rank = ranks[index]
        const row = document.createElement("div")
        row.className = "ranking_row"
        if (rank <= 3) row.classList.add("ranking_row_top3")
        // 【新增】比對這筆資料是不是「我自己」（用 anon_id 判斷），是的話特別標記出來
        const is_self = typeof Get_Anon_Id === "function" && entry._anon_id === Get_Anon_Id()
        if (is_self) {
            row.classList.add("ranking_row_self")
            self_found_in_list = true
        }

        let metric1_text = "-"
        let metric2_text = "-"

        if (player_metric === "avg_wpm") {
            metric1_text = `${entry.avg_wpm ?? 0} WPM`
            metric2_text = `${entry.wpm_count ?? 0} 次測驗`
        } else if (player_metric === "avg_acc") {
            metric1_text = `${entry.avg_acc ?? 0}%`
            metric2_text = `${entry.acc_count ?? 0} 次測驗`
        } else if (player_metric === "online_seconds") {
            metric1_text = Format_Online_Seconds(entry.online_seconds)
            metric2_text = "—"
        } else if (player_metric === "total_points") {
            metric1_text = `${entry.total_points ?? 0} 積分`
            metric2_text = "—"
        } else if (player_metric === "page_views") {
            // 【新增】瀏覽次數沒有像「測驗次數」那種第二欄可以搭配顯示，
            // 跟 online_seconds / total_points 一樣把第二欄留空（用 "—" 佔位）
            metric1_text = `${entry.page_views ?? 0} 次`
            metric2_text = "—"
        }

        row.innerHTML = `
            <div class="rank_col_rank">${medal_by_rank[rank] || rank}</div>
            <div class="rank_col_name">${Escape_Html(entry.name || "訪客")}${is_self ? ' <span class="ranking_self_tag">你</span>' : ""}</div>
            <div class="rank_col_wpm">${metric1_text}</div>
            <div class="rank_col_acc">${metric2_text}</div>
        `
        list_body_el.appendChild(row)
    })

    return self_found_in_list
}

function Load_Player_Leaderboard() {
    Set_Loading_State()

    const has_firebase_functions = typeof Get_Top_Players_By_Avg_Wpm === "function"
        && typeof Get_Top_Players_By_Avg_Acc === "function"
        && typeof Get_Top_Players_By_Online_Time === "function"
        && typeof Get_Top_Players_By_Points === "function"
        && typeof Get_Top_Players_By_Page_Views === "function" // 【新增】

    if (!has_firebase_functions) {
        loading_msg_el.textContent = "排行榜載入失敗，請確認 Firebase 設定是否正確。"
        return
    }

    const on_result = function (list) {
        loading_msg_el.classList.add("is_hidden")
        Render_Player_Leaderboard(list)
        // 不管有沒有擠進這份 Top 50 榜單，都額外查一次「自己實際排第幾名」，顯示在底部浮窗
        Load_Own_Player_Rank()
    }

    if (player_metric === "avg_wpm") {
        Get_Top_Players_By_Avg_Wpm(on_result)
    } else if (player_metric === "avg_acc") {
        Get_Top_Players_By_Avg_Acc(on_result)
    } else if (player_metric === "total_points") {
        Get_Top_Players_By_Points(on_result)
    } else if (player_metric === "page_views") {
        Get_Top_Players_By_Page_Views(on_result)
    } else {
        Get_Top_Players_By_Online_Time(on_result)
    }
}

// ===== 【新增】查詢並顯示「自己在玩家總榜（目前選的指標）的實際名次」，不管有沒有進 Top 50 都會呼叫 =====
// order_by_field / min_count_field / min_count 要跟 Get_Top_Players_By_Avg_Wpm 等函式
// 內部呼叫 _Get_Top_Players 時用的參數完全對應，不然算出來的名次/門檻會跟真正榜單對不起來
// ——例如榜單因為沒人達標而顯示「沒人上榜」時，浮窗也必須跟著不顯示，不能自相矛盾。
function Load_Own_Player_Rank() {
    if (typeof Get_Own_Player_Rank !== "function") return

    let order_by_field, min_count_field, min_count
    if (player_metric === "avg_wpm") {
        order_by_field = "avg_wpm"; min_count_field = "wpm_count"; min_count = 50
    } else if (player_metric === "avg_acc") {
        order_by_field = "avg_acc"; min_count_field = "acc_count"; min_count = 50
    } else if (player_metric === "total_points") {
        order_by_field = "total_points"; min_count_field = "total_points"; min_count = 1
    } else if (player_metric === "page_views") {
        // 【新增】瀏覽次數榜不設門檻，邏輯跟 online_seconds 一致
        order_by_field = "page_views"; min_count_field = null; min_count = 0
    } else {
        order_by_field = "online_seconds"; min_count_field = null; min_count = 0
    }

    Get_Own_Player_Rank(order_by_field, min_count_field, min_count, function (result) {
        if (!result) return // 沒有資料，或還沒達到上榜門檻，都不顯示浮窗

        let value_text = ""
        if (player_metric === "avg_wpm") value_text = `${result.value ?? 0} WPM`
        else if (player_metric === "avg_acc") value_text = `${result.value ?? 0}%`
        else if (player_metric === "total_points") value_text = `${result.value ?? 0} 積分`
        else if (player_metric === "page_views") value_text = `${result.value ?? 0} 次` // 【新增】
        else value_text = Format_Online_Seconds(result.value)

        Show_Self_Rank_Bar(result.rank, result.name, value_text)
    })
}

// 切換指標：更新按鈕選中狀態、更新欄位標題文字、更新網址參數、重新載入資料
function Switch_Player_Metric(metric) {
    player_metric = metric

    Object.keys(player_metric_buttons).forEach(function (key) {
        const btn = player_metric_buttons[key]
        if (btn) btn.classList.toggle("ranking_select_active", key === metric)
    })

    stage_label_el2.style.display = "none"
    
    if (metric === "avg_wpm") {
        stage_label_el2.style.display = "block"

        stage_label_el.textContent = "玩家總榜｜平均 WPM 最高"
        stage_label_el2.textContent = "採計標準：需累積 50 次以上「有效測驗」（達各模式加分門檻的測驗）才會上榜，取平均 WPM"
        col_header_metric1_el.textContent = "平均WPM"
        col_header_metric2_el.textContent = "測驗次數"
    } else if (metric === "avg_acc") {
        stage_label_el2.style.display = "block"

        stage_label_el.textContent = "玩家總榜｜平均正確率最高"
        stage_label_el2.textContent = "採計標準：需累積 50 次以上「有效測驗」（達各模式加分門檻的測驗）才會上榜，取平均正確率"
        col_header_metric1_el.textContent = "平均正確率"
        col_header_metric2_el.textContent = "測驗次數"
    } else if (metric === "total_points") {
        stage_label_el2.style.display = "block"

        stage_label_el.textContent = "玩家總榜｜挑戰模式累積積分最高"
        stage_label_el2.textContent = "採計標準：正確率須達75%以上、WPM達 3 以上才會計分，累積 1 分以上即可上榜"
        col_header_metric1_el.textContent = "積分"
        col_header_metric2_el.textContent = ""
    } else if (metric === "page_views") {
        // 【新增】瀏覽次數最多榜：文案風格比照在線時長最長榜（同樣不設門檻）
        stage_label_el2.style.display = "block"

        stage_label_el.textContent = "玩家總榜｜瀏覽次數最多"
        stage_label_el2.textContent = "採計標準：不限測驗次數，累積這個玩家造成的所有頁面載入次數（含重新整理與換頁）"
        col_header_metric1_el.textContent = "瀏覽次數"
        col_header_metric2_el.textContent = ""
    } else {
        stage_label_el2.style.display = "block"

        stage_label_el.textContent = "玩家總榜｜在線時長最長"
        stage_label_el2.textContent = "採計標準：不限測驗次數，累積所有頁面期間的在線時間"
        col_header_metric1_el.textContent = "在線時長"
        col_header_metric2_el.textContent = ""
    }

    const url = new URL(window.location.href)
    url.searchParams.set("mode", "player")
    url.searchParams.set("metric", metric)
    url.searchParams.delete("stage")
    url.searchParams.delete("combo")
    history.replaceState(null, "", url)

    Load_Player_Leaderboard()
}

/* ============================================================
   模式切換
   ============================================================ */

function Switch_Ranking_Mode(mode) {
    ranking_mode = mode


    stage_label_el2.style.display = "none"
    
    mode_tab_stage.classList.toggle("ranking_mode_tab_active", mode === "stage")
    mode_tab_challenge.classList.toggle("ranking_mode_tab_active", mode === "challenge")
    mode_tab_player.classList.toggle("ranking_mode_tab_active", mode === "player")

    stage_selector_row.classList.toggle("is_hidden", mode !== "stage")
    challenge_selector_row.classList.toggle("is_hidden", mode !== "challenge")
    player_selector_row.classList.toggle("is_hidden", mode !== "player")

    if (mode === "stage") {
        // 離開玩家總榜切回主線關卡時，欄位標題要還原成固定的「WPM／正確率」
        col_header_metric1_el.textContent = "WPM"
        col_header_metric2_el.textContent = "正確率"

        const stage_id = stage_select.value || Find_First_Ranked_Stage_Id()
        if (stage_id) {
            Set_Selectors_To_Stage(stage_id)
            On_Stage_Select_Changed()
        }
    } else if (mode === "challenge") {
        col_header_metric1_el.textContent = "WPM"
        col_header_metric2_el.textContent = "正確率"
        On_Cg_Select_Changed()
    } else {
        // player 模式：欄位標題交給 Switch_Player_Metric 依目前指標動態設定
        Switch_Player_Metric(player_metric)
    }
}

/* ============================================================
   【新增】網站總瀏覽次數（顯示在整個排行榜頁面最上方，不受模式切換影響）
   ============================================================ */
function Load_Total_Page_Views() {
    const el = document.getElementById("ranking_total_views")
    if (!el) return

    if (typeof Get_Total_Page_Views !== "function") {
        el.textContent = "網站總瀏覽次數：無法載入（Firebase 尚未設定）"
        return
    }

    Get_Total_Page_Views(function (total) {
        // total 是 null 代表「真的讀取失敗」（例如離線、Rules 沒設好），
        // 要跟「讀到 0」明確區分開來，不然會誤導成「網站真的完全沒人瀏覽過」
        el.textContent = (total === null)
            ? "網站總瀏覽次數：讀取失敗"
            : `網站總瀏覽次數：${total.toLocaleString("zh-TW")} 次`
    })
}

/* ============================================================
   【修改】左上角「←」返回按鈕：直接回到 return_to 記住的那個入口網址。
   不再依照排行榜頁面「現在」的選單狀態去猜目的地——
   選單只是使用者在排行榜頁面裡自己瀏覽的紀錄，跟他從哪裡進來是兩回事。
   ============================================================ */
function Go_Back_From_Ranking() {
    if (ranking_return_to) {
        window.location.href = ranking_return_to
        return
    }

    // 沒有 return_to（不是從關卡/大廳點進來的），沒有一個「該回去的地方」，回主畫面是合理的預設值
    window.location.href = "TCTC2-0-main.html"
}

/* ============================================================
   初始化
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
    // 【新增】不管等一下要進哪個模式（主線關卡／挑戰模式／玩家總榜），
    // 頂部的網站總瀏覽次數都要載入，所以放在最前面、不受下面 return 分支影響
    Load_Total_Page_Views()

    Populate_Difficulty_Select()
    Populate_Cg_Difficulty_Select()
    Populate_Cg_Stage_Select()
    Populate_Cg_Seconds_Select()

    const search_params = new URLSearchParams(window.location.search)
    const url_mode = search_params.get("mode")
    const url_stage_id = search_params.get("stage")
    const url_combo_id = search_params.get("combo")
    const url_metric = search_params.get("metric")

    //網址明講 mode=player，就進玩家總榜（可選帶 metric 參數直接定位到某個指標）
    if (url_mode === "player") {
        const valid_metrics = ["avg_wpm", "avg_acc", "online_seconds", "total_points", "page_views"]
        player_metric = valid_metrics.includes(url_metric) ? url_metric : "avg_wpm"
        Switch_Ranking_Mode("player")
        return
    }

    //網址帶 combo（從挑戰模式結算頁「查看排名」點進來），或明講 mode=challenge，就進挑戰模式；
    //網址帶 stage（從主線關卡卡片的獎盃小按鈕、結果畫面點進來）就進主線關卡模式；
    //都沒有的話（直接從導覽列「排行榜」點進來）預設顯示主線關卡第一關
    if (url_mode === "challenge" || url_combo_id) {
        const combo = Parse_Combo_Id(url_combo_id) || { difficulty: "easy", stage: "article", seconds: 30 }
        Set_Cg_Selectors_To_Combo(combo)
        Switch_Ranking_Mode("challenge")
        return
    }

    let initial_stage_id = (url_stage_id && Find_Stage_Location(url_stage_id) && Counts_For_Leaderboard(Find_Stage_Location(url_stage_id).stage))
        ? url_stage_id
        : Find_First_Ranked_Stage_Id()

    if (!initial_stage_id) {
        stage_label_el.textContent = "找不到任何關卡資料"
        loading_msg_el.classList.add("is_hidden")
        return
    }

    Set_Selectors_To_Stage(initial_stage_id)
    Switch_Ranking_Mode("stage")
})