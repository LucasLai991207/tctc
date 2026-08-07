const challenge_stage_container = document.getElementById("challenge_stage_container")
const minute_list = document.getElementById("minute_list")
const difficulty_selector = document.getElementById("cg_difficulty_selector")

const CGL_DIFFICULTY_LABEL = {
    easy:    "簡單",
    medium:  "普通",
    hard:    "困難",
    extreme: "極限"
}
const CGL_STAGE_LABEL = {
    article: "文章模式",
    word:    "單詞模式"
}
const CGL_DURATION_LABEL = {
    30:  "30 秒",
    60:  "1 分鐘",
    180: "3 分鐘",
    300: "5 分鐘",
    600: "10 分鐘"
}

// ===== 積分對照表（要跟 TCTC2-0-challenge.js 裡的定義保持一致）=====
const CGL_POINTS_BASE = { 30: 1, 60: 2, 180: 6, 300: 10, 600: 20 }
const CGL_POINTS_MULTIPLIER = { easy: 1, medium: 1.5, hard: 2, extreme: 3 }

// ===== 【新增】進步曲線相關 =====
// key 名稱要跟 TCTC2-0-challenge.js 裡儲存歷史紀錄的地方完全一致，不然讀不到資料
const CGL_HISTORY_KEY = "tctc2.0-challenge_history"
const CGL_CHART_POINTS = 50   // 曲線只畫最近幾筆，太多筆線會擠在一起看不清楚

// 讀取歷史紀錄，格式壞掉或還沒有任何紀錄時，安全地回傳空陣列
function CGL_Get_History(){
    try {
        return JSON.parse(localStorage.getItem(CGL_HISTORY_KEY)) || []
    } catch(e){
        return []
    }
}

let selected_difficulty = "easy"
let selected_seconds = 30
let selected_stage = "article"

// 依目前選的難度，更新每個時間按鈕旁的積分顯示（文章模式／單詞模式各 5 顆，共 10 顆都要更新）
function Update_Chapter_Points(){
    Object.keys(CGL_STAGE_LABEL).forEach(function(stage){
        Object.keys(CGL_POINTS_BASE).forEach(function(seconds){
            const el = document.getElementById(`cg_points_${stage}_${seconds}`)
            if(!el) return
            const points = Math.round(CGL_POINTS_BASE[seconds] * CGL_POINTS_MULTIPLIER[selected_difficulty])
            el.textContent = `+${points} 積分`
        })
    })
}

// 讀取玩家「挑戰模式累計平均」的 WPM / 正確率（跟主線模式 average_wpm / average_acc 同一套邏輯），
// 以及累積總積分，顯示在 profile 框
function Load_Challenge_Profile_Stats(){
    const wpmEl = document.getElementById("cg_profile_wpm")
    const accEl = document.getElementById("cg_profile_acc")
    const pointsEl = document.getElementById("cg_profile_points")

    if(wpmEl) wpmEl.textContent = localStorage.getItem("average_challenge_wpm") || "0"
    if(accEl) accEl.textContent = (localStorage.getItem("average_challenge_acc") || "0") + "%"
    if(pointsEl) pointsEl.textContent = localStorage.getItem("tctc2.0-challenge_total_points") || "0"
}

// ===== 【新增】依目前選擇的「難度＋模式＋時間長度」，從歷史紀錄裡篩出對應的資料，畫一條 WPM 趨勢曲線 =====
// 只需要畫「目前這個組合」的曲線就好，不用一次畫 40 組——因為 challenge_start_stage 本來就只會顯示一張卡，
// 玩家換難度/模式/時間，這張卡整個重繪，曲線也跟著换成對應組合的資料即可。
//
// 只使用真實紀錄，不再用「舊版累計平均」補一個虛擬起點——那個平均值是所有難度/模式/時間長度
// 混在一起算出來的，不是這個組合專屬的真實資料，容易誤導，乾脆不要顯示。
// 資料不足兩筆（=玩不到兩次）就完全不畫圖表，交給 CGL_Has_Enough_History() 判斷要不要顯示整個區塊。
function CGL_Build_Progress_Chart_HTML(matched){
    const recent = matched.slice(-CGL_CHART_POINTS)

    // ===== SVG 座標計算 =====
    // viewBox 用固定的邏輯座標系統（400 x 90），實際顯示大小交給 CSS 的 width:100% 決定，
    // 這樣不管卡片實際寬度是多少，SVG 都能等比例撐滿，不用去猜外部 main_lobby.css 的確切寬度。
    const svgW = 400
    const svgH = 90
    const padX = 12
    const padY = 14

    const wpmValues = recent.map(function(r){ return r.wpm })
    const maxWpm = Math.max.apply(null, wpmValues)
    const minWpm = Math.min.apply(null, wpmValues)
    const wpmRange = Math.max(maxWpm - minWpm, 1)   // 避免最高最低都一樣時除以 0

    const points = recent.map(function(r, i){
        const x = padX + (i / (recent.length - 1)) * (svgW - padX * 2)
        const y = svgH - padY - ((r.wpm - minWpm) / wpmRange) * (svgH - padY * 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(" ")

    // ===== 幫每一筆資料點畫一個小圓點，並用 <title> 掛上 hover 提示 =====
    // 為什麼用 SVG 原生的 <title> 而不是自己寫 tooltip：
    // <title> 是瀏覽器內建行為，滑鼠移到對應的圖形上就會自動顯示，不用額外寫 JS 事件、
    // 不用管定位跑版問題，最輕量的做法就能達到「看到每一次的確切成績」這個需求。
    const dots = recent.map(function(r, i){
        const x = padX + (i / (recent.length - 1)) * (svgW - padX * 2)
        const y = svgH - padY - ((r.wpm - minWpm) / wpmRange) * (svgH - padY * 2)

        const dateLabel = r.date
            ? new Date(r.date).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })
            : "—"
        const tooltipText = `${dateLabel}｜${r.wpm} WPM`

        return `
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#C9A84C" pointer-events="none" />
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="transparent" style="cursor:pointer;">
                <title>${tooltipText}</title>
            </circle>
        `
    }).join("")

    const displayMaxWpm = Math.max.apply(null, wpmValues)
    const displayMinWpm = Math.min.apply(null, wpmValues)

    return `
        <svg class="cg_progress_svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
            <polyline
                points="${points}"
                fill="none"
                stroke="#C9A84C"
                stroke-width="2.5"
                stroke-linejoin="round"
                stroke-linecap="round"
            />
            ${dots}
        </svg>
        <p class="cg_progress_label">測試 ${recent.length} 次｜最高 ${displayMaxWpm} WPM｜最低 ${displayMinWpm} WPM</p>
        <p style="margin: 0.5rem 0 0 0;
            color: rgba(255,255,255,0.55);
            font-size: 0.8rem;
            letter-spacing: 1px;
            ">（滑鼠停留在節點上可查看成績）</p>
    `
}

// ===== 【新增】資料不足兩筆時的佔位內容 =====
// 刻意沿用跟 CGL_Build_Progress_Chart_HTML 完全相同的結構（一個跟 svg 同高的框 + 兩行文字），
// 只是把曲線換成提示文字、統計數字行跟提示行都留白，
// 這樣切換難度/模式/時間時，不管有沒有資料，整個 .cg_progress_chart 區塊的高度都不會變，畫面不會跳動。
function CGL_Build_Empty_Chart_HTML(){
    return `
        <div class="cg_progress_svg" style="
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255,255,255,0.4);
            font-size: 0.9rem;
            letter-spacing: 1px;
            ">數據不足，沒辦法產生圖表</div>
        <p class="cg_progress_label">&nbsp;</p>
        <p style="margin: 0.5rem 0 0 0;
            color: rgba(255,255,255,0.55);
            font-size: 0.8rem;
            letter-spacing: 1px;
            ">&nbsp;</p>
    `
}

function Render_Challenge_Stage(){
    if(!challenge_stage_container) return

    // 篩出目前這個「難度＋模式＋時間長度」組合的真實歷史紀錄
    const matched = CGL_Get_History().filter(function(record){
        return record.difficulty === selected_difficulty
            && record.stage === selected_stage
            && record.seconds === selected_seconds
    })

    // 圖表區塊固定顯示；資料不足兩筆時，改用「跟有資料時完全相同的結構」
    // （同樣大小的 svg 佔位框 + 同樣兩行文字），只是內容換成提示文字，
    // 這樣不管有沒有資料，整塊的大小與排版都維持一致，不會有畫面跳動。
    const chartHTML = `
        <!-- ===== 【新增】進步曲線：放在關卡卡片「上方」，寬度跟關卡卡片同寬 ===== -->
        <div class="cg_progress_chart" id="cg_progress_chart">
            <p class="cg_progress_title">${CGL_DIFFICULTY_LABEL[selected_difficulty]}${CGL_STAGE_LABEL[selected_stage]} ${CGL_DURATION_LABEL[selected_seconds]}</p>
            ${matched.length >= 2
                ? CGL_Build_Progress_Chart_HTML(matched)
                : CGL_Build_Empty_Chart_HTML()
            }
        </div>
    `

    challenge_stage_container.innerHTML = `
        ${chartHTML}
        <div class="main_lobby_map_stage" id="challenge_start_stage">
            <div class="main_lobby_map_stage_row">
                <div class="main_lobby_map_stage_text1">挑戰模式 ｜ ${CGL_DIFFICULTY_LABEL[selected_difficulty]} ｜ ${CGL_STAGE_LABEL[selected_stage]}</div>
                <div class="main_lobby_map_stage_text2">
                    <p class="main_lobby_map_stage_text2-1">
                        ${selected_stage === "word" ? "隨機單詞" : "隨機文章"} -<span class="main_lobby_map_stage_text2-2"> ${CGL_DURATION_LABEL[selected_seconds]}</span>
                    </p>
                    <div class="main_lobby_map_stage_text3">打字速度測試</div>
                </div>
            </div>
        </div>
    `

    document.getElementById("challenge_start_stage").addEventListener("click", function(){
        window.location.href = `TCTC2-0-challenge.html?difficulty=${selected_difficulty}&seconds=${selected_seconds}&stage=${selected_stage}`
    })


    const rank_btn = document.getElementById("challenge_rank_btn")
    if(rank_btn){
        rank_btn.addEventListener("click", function(event){
            event.stopPropagation()
            const comboId = `${selected_difficulty}-${selected_stage}-${selected_seconds}`
            // 【新增】帶上 return_to = 目前這頁（大廳）的網址，
            // 這樣排行榜頁面按返回時，才會回到「大廳」而不是直接跳進遊戲畫面
            window.location.href = `TCTC2-0-ranking.html?mode=challenge&combo=${encodeURIComponent(comboId)}&return_to=${encodeURIComponent(window.location.href)}`
        })
    }
}

function Select_Difficulty(difficulty, clickedEl){
    selected_difficulty = difficulty
    localStorage.setItem("tctc2.0-saved_challenge_difficulty", difficulty)

    if(difficulty_selector){
        difficulty_selector.querySelectorAll(".cg_difficulty_card").forEach(function(el){
            el.classList.remove("cg_difficulty_selected")
        })
    }
    if(clickedEl) clickedEl.classList.add("cg_difficulty_selected")

    Render_Challenge_Stage()
    Update_Chapter_Points()
}

// 時間長度按鈕，每一顆同時帶 data-seconds 跟 data-stage，點一下就同時決定「幾秒 + 文章/單詞模式」
// 一整排總共 10 顆：文章模式 5 個時間長度 + 單詞模式 5 個時間長度
function Select_Seconds(seconds, stage, clickedEl){
    selected_seconds = seconds
    selected_stage = stage
    localStorage.setItem("tctc2.0-saved_challenge_seconds", seconds)
    localStorage.setItem("tctc2.0-saved_challenge_stage", stage)

    if(minute_list){
        minute_list.querySelectorAll(".chapter_frame").forEach(function(el){
            el.classList.remove("chapter_selected")
        })
    }
    if(clickedEl) clickedEl.classList.add("chapter_selected")

    Render_Challenge_Stage()
}

document.addEventListener("DOMContentLoaded", function(){
    const usernameEl = document.querySelector(".main_lobby_main_frame_player_profile_left_div_username")
    const saved_username = localStorage.getItem("username")
    const cached_guest_number = localStorage.getItem("tctc_guest_number")

    if(usernameEl && saved_username){
        usernameEl.textContent = saved_username
    } else if(usernameEl && cached_guest_number){
        usernameEl.textContent = "訪客#" + String(cached_guest_number).padStart(4, "0")
    }

    // ===== 難度卡片：綁定點擊事件 =====
    let defaultDifficultyEl = null
    if(difficulty_selector){
        const savedDifficulty = localStorage.getItem("tctc2.0-saved_challenge_difficulty")

        difficulty_selector.querySelectorAll(".cg_difficulty_card").forEach(function(el){
            el.addEventListener("click", function(){
                Select_Difficulty(el.dataset.difficulty, el)
            })

            if(savedDifficulty && el.dataset.difficulty === savedDifficulty){
                defaultDifficultyEl = el
            }
        })

        // 如果沒有上次記錄的難度，預設選第一張（簡單）
        if(!defaultDifficultyEl){
            defaultDifficultyEl = difficulty_selector.querySelector(".cg_difficulty_card")
        }
    }

    // ===== 時間長度按鈕（10 顆，文章/單詞各 5 個）：綁定點擊事件 =====
    // 找出「上次選的秒數 + 上次選的模式」都吻合的按鈕，沒有就退回第一個
    let defaultSecondsEl = null
    if(minute_list){
        const savedSeconds = Number(localStorage.getItem("tctc2.0-saved_challenge_seconds"))
        const savedStage = localStorage.getItem("tctc2.0-saved_challenge_stage")

        minute_list.querySelectorAll(".chapter_frame").forEach(function(el){
            el.addEventListener("click", function(){
                Select_Seconds(Number(el.dataset.seconds), el.dataset.stage, el)
            })

            if(savedSeconds && Number(el.dataset.seconds) === savedSeconds && el.dataset.stage === savedStage){
                defaultSecondsEl = el
            }
        })

        if(!defaultSecondsEl){
            defaultSecondsEl = minute_list.querySelector(".chapter_frame")
        }
    }

    // 先套用預設難度（不觸發 Render，最後統一由秒數選擇觸發一次就好）
    if(defaultDifficultyEl){
        selected_difficulty = defaultDifficultyEl.dataset.difficulty
        difficulty_selector.querySelectorAll(".cg_difficulty_card").forEach(function(el){
            el.classList.remove("cg_difficulty_selected")
        })
        defaultDifficultyEl.classList.add("cg_difficulty_selected")
    }

    // 秒數 + 模式一起由這顆按鈕決定（data-seconds / data-stage 都在同一顆按鈕上）
    if(defaultSecondsEl){
        Select_Seconds(Number(defaultSecondsEl.dataset.seconds), defaultSecondsEl.dataset.stage, defaultSecondsEl)
    } else {
        Render_Challenge_Stage()
    }

    Update_Chapter_Points()
    Load_Challenge_Profile_Stats()
})