const CERT_LEVEL_LABELS = {
    easy: "初級",
    medium: "中級"
}

function CERT_Get_Level_Param(){
    const params = new URLSearchParams(window.location.search)
    return params.get("level")
}

function CERT_Show_Gate(title, text){
    const gateEl = document.getElementById("cert_gate_card")
    const paperEl = document.getElementById("cert_paper")
    const printBtn = document.getElementById("cert_print_btn")

    if(paperEl) paperEl.classList.add("is_hidden")
    if(printBtn) printBtn.classList.add("is_hidden")   // 沒有證書可印，工具列的列印按鈕也一起藏起來

    if(gateEl){
        gateEl.classList.remove("is_hidden")
        document.getElementById("cert_gate_title").textContent = title
        document.getElementById("cert_gate_text").textContent = text
    }
}

function CERT_Format_Date(timestamp){
    const d = new Date(timestamp)
    return d.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
}

function CERT_Render(level, stats){
    const paperEl = document.getElementById("cert_paper")
    const gateEl = document.getElementById("cert_gate_card")
    if(gateEl) gateEl.classList.add("is_hidden")
    if(paperEl) paperEl.classList.remove("is_hidden")

    document.getElementById("cert_player_name").textContent = stats.name || "訪客"
    document.getElementById("cert_level_name").textContent = CERT_LEVEL_LABELS[level]
    document.getElementById("cert_stat_wpm").textContent = Math.round(stats.avg_wpm || 0)
    document.getElementById("cert_stat_acc").textContent = `${Math.round(stats.avg_acc || 0)}%`
    document.getElementById("cert_date").textContent = CERT_Format_Date(Date.now())

    document.title = `${CERT_LEVEL_LABELS[level]}完成證書 - TCTC 繁體中文打字練習中心`
}

document.addEventListener("DOMContentLoaded", function(){
    const level = CERT_Get_Level_Param()

    if(level !== "easy" && level !== "medium"){
        CERT_Show_Gate("找不到這張證書", "目前只有初級跟中級難度全部完成時能領取證書，請從個人榮譽牆的連結進來。")
        return
    }

    if(typeof Get_Own_Player_Stats !== "function"){
        CERT_Show_Gate("暫時無法載入", "系統暫時無法連線，請重新整理頁面再試一次。")
        return
    }
    if(typeof ACHV_Get_Total_Stage_Count !== "function" || typeof Level_Data === "undefined"){
        CERT_Show_Gate("暫時無法載入", "關卡資料還沒載入完成，請重新整理頁面再試一次。")
        return
    }

    Get_Own_Player_Stats(function(stats){
        if(stats === null){
            CERT_Show_Gate("讀取失敗", "讀取你的資料時發生錯誤，請稍後再試一次。")
            return
        }

        const total = ACHV_Get_Total_Stage_Count(level)
        const completed = stats ? (stats[`stages_completed_${level}`] || 0) : 0

        if(total <= 0){
            CERT_Show_Gate("暫時無法載入", "關卡資料還沒載入完成，請重新整理頁面再試一次。")
            return
        }

        if(completed < total){
            const remaining = total - completed
            CERT_Show_Gate(
                `${CERT_LEVEL_LABELS[level]}模式尚未完成`,
                `還需要 ${remaining} 關才能領取${CERT_LEVEL_LABELS[level]}難度的完成證書....`
            )
            return
        }

        CERT_Render(level, stats || {})
    })
})
