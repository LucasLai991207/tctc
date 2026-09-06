const XP_NOTIFY_DURATION_MS = 2200          // 一般 +N XP 提示卡的顯示時間
const XP_NOTIFY_LEVELUP_DURATION_MS = 4200  // 升級提示卡顯示比較久，讓玩家看清楚

function XP_Notify_Ensure_Container(){
    let container = document.getElementById("xp_notify_stack")
    if(!container){
        container = document.createElement("div")
        container.id = "xp_notify_stack"
        container.className = "xp_notify_stack"
        document.body.appendChild(container)
    }
    return container
}

// gained：這次這筆交易實際增加的 XP（xp_after - xp_before）
// xp_before / xp_after：這筆交易前後的總 XP，用來換算等級、判斷有沒有升級
function XP_Notify_Show(gained, xp_before, xp_after){
    if(typeof gained !== "number" || isNaN(gained) || gained <= 0) return
    if(typeof XP_Get_Level !== "function"){
        console.warn("[xp_notify] 找不到 XP_Get_Level，請確認有先載入 TCTC2-0-xp_data.js")
        return
    }

    const level_before = XP_Get_Level(xp_before)
    const level_after = XP_Get_Level(xp_after)
    const leveled_up = level_after > level_before

    const container = XP_Notify_Ensure_Container()
    const toast = document.createElement("div")
    toast.className = "xp_notify_toast" + (leveled_up ? " xp_notify_toast_levelup" : "")

    toast.innerHTML = leveled_up
        ? `
            <div class="xp_notify_levelup_badge">LV ${level_after}</div>
            <div class="xp_notify_body">
                <p class="xp_notify_eyebrow">升級了！</p>
                <p class="xp_notify_name">LV ${level_before} → LV ${level_after}</p>
                <p class="xp_notify_sub">+${gained} XP</p>
            </div>
        `
        : `<p class="xp_notify_plain_text">+${gained} XP</p>`

    container.appendChild(toast)

    // 進場動畫延後一幀才加 show class，理由跟 achv_notify.js 完全一致：
    // 避免瀏覽器把「初始狀態」跟「顯示狀態」合併成一次繪製，動畫直接跳出來、沒有過場
    requestAnimationFrame(function(){
        toast.classList.add("xp_notify_toast_show")
    })

    const duration = leveled_up ? XP_NOTIFY_LEVELUP_DURATION_MS : XP_NOTIFY_DURATION_MS
    setTimeout(function(){
        toast.classList.remove("xp_notify_toast_show")
        toast.classList.add("xp_notify_toast_hide")
        setTimeout(function(){ toast.remove() }, 320)
    }, duration)
}
