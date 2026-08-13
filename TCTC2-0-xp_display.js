// ============================================================
// TCTC2-0-xp_display.js
// 把玩家目前的 XP 換算成等級/進度條，顯示在主大廳的玩家資訊卡上。
// 只負責「讀取 + 顯示」，不負責發 XP——XP 是怎麼賺到的，全部定義在
// TCTC2-0-xp_data.js 的 XP_CONFIG，實際累加寫入則在 TCTC2-0-firebase.js
// 的 Sync_XP()。三支檔案分工：xp_data（設定+計算）／firebase（寫入）／
// 這支（顯示），改設定不會動到這支檔案，改顯示位置也不會動到寫入邏輯。
//
// 【稱號系統先不做】等級對應稱號（取代「初學者」那行文字）之後再另外做，
// 這支檔案目前完全不碰 .main_lobby_main_frame_player_profile_left_div_rank
// 的文字內容。
//
// 依賴：Get_Own_Player_Stats()（TCTC2-0-firebase.js）、
//      XP_Get_Level() / XP_Get_Level_Progress()（TCTC2-0-xp_data.js）
// 務必確認 main.html 裡這支檔案排在 firebase.js 跟 xp_data.js 之後載入。
// ============================================================

// 進度條的 DOM 結構固定只會被建立一次，重複呼叫這支函式（例如之後想加
// 「升級後重新整理數字」的需求）只會更新內容、不會一直疊加新的 DOM。
function XP_Ensure_Progress_Bar_DOM(){
    let wrap = document.getElementById("xp_progress_wrap")
    if(wrap) return wrap

    const rankEl = document.querySelector(".main_lobby_main_frame_player_profile_left_div_rank")
    if(!rankEl || !rankEl.parentElement) return null

    wrap = document.createElement("div")
    wrap.id = "xp_progress_wrap"
    wrap.className = "xp_progress_wrap"
    wrap.innerHTML = `
        <div class="xp_progress_track">
            <div class="xp_progress_fill" id="xp_progress_fill" style="width:0%;"></div>
        </div>
        <p class="xp_progress_text" id="xp_progress_text">— / —</p>
    `
    rankEl.insertAdjacentElement("afterend", wrap)
    return wrap
}

function XP_Render(stats){
    const xp = stats ? (stats.xp || 0) : 0

    const lvEl = document.querySelector(".main_lobby_main_frame_player_profile_left_div_LV")

    if(typeof XP_Get_Level !== "function" || typeof XP_Get_Level_Progress !== "function"){
        console.warn("[xp_display] 找不到 XP_Get_Level 等函式，請確認有先載入 TCTC2-0-xp_data.js")
        return
    }

    const progress = XP_Get_Level_Progress(xp)

    if(lvEl) lvEl.textContent = `LV ${progress.level}`
    // 【稱號先不動】.main_lobby_main_frame_player_profile_left_div_rank 這裡故意
    // 沒有動——稱號要對應到哪個 LV 區間之後再另外設計，目前維持 main.html 裡
    // 原本寫死的文字，不要因為這支檔案覆蓋掉它。

    const wrap = XP_Ensure_Progress_Bar_DOM()
    if(wrap){
        const fillEl = document.getElementById("xp_progress_fill")
        const textEl = document.getElementById("xp_progress_text")
        if(fillEl) fillEl.style.width = `${progress.percent}%`
        if(textEl){
            textEl.textContent = (progress.level >= XP_CONFIG.max_level)
                ? `已達最高等級・${xp} XP`
                : `${progress.current} / ${progress.needed} XP`
        }
    }
}

document.addEventListener("DOMContentLoaded", function(){
    if(typeof Get_Own_Player_Stats !== "function"){
        console.warn("[xp_display] 找不到 Get_Own_Player_Stats，請確認有先載入 TCTC2-0-firebase.js")
        return
    }
    Get_Own_Player_Stats(function(stats){
        XP_Render(stats || {})
    })
})
