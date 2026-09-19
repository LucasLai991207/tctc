const ACHV_XP_TIER_KEYS = [null, "bronze", "silver", "gold", "platinum"]

const ACHV_NOTIFY_SEEN_KEY = "tctc2.0-achv_seen_tiers"
const ACHV_NOTIFY_TOAST_DURATION_MS = 4800
const ACHV_NOTIFY_DEBOUNCE_MS = 1200

let achv_notify_debounce_timer = null

function ACHV_Notify_Get_Seen(){
    try {
        return JSON.parse(localStorage.getItem(ACHV_NOTIFY_SEEN_KEY)) || {}
    } catch(e){

        return {}
    }
}
function ACHV_Notify_Save_Seen(seen){
    try {
        localStorage.setItem(ACHV_NOTIFY_SEEN_KEY, JSON.stringify(seen))
    } catch(e){
        console.warn("[achv_notify] 寫入本機成就紀錄失敗：", e.message)
    }
}

function ACHV_Notify_Diff(streakData, statsData){
    if(typeof ACHV_CATEGORIES === "undefined"){
        console.warn("[achv_notify] 找不到 ACHV_CATEGORIES，請確認有先載入 TCTC2-0-achv_data.js")
        return []
    }

    const seen = ACHV_Notify_Get_Seen()
    const newlyUnlocked = []
    let seenChanged = false

    ACHV_CATEGORIES.forEach(function(category){
        category.achievements.forEach(function(achv){
            if(achv.pending) return

            if(achv.dataSource === "streak" && typeof TCTC_Get_Streak_Data !== "function") return
            if(achv.requiresLevelData && typeof Level_Data === "undefined") return

            const data = achv.dataSource === "streak" ? streakData : statsData
            const value = achv.getValue ? achv.getValue(data) : (data ? (data[achv.metric] || 0) : 0)
            const newTier = ACHV_Get_Tier_Index(value, achv.thresholds)

            const storedTier = seen[achv.key]

            if(storedTier === undefined){

                seen[achv.key] = newTier
                seenChanged = true
                return
            }

            if(newTier > storedTier){

                newlyUnlocked.push({
                    name: achv.name,
                    icon: achv.icon,
                    tierIndex: newTier,
                    tierTitle: ACHV_TIER_TITLES_DEFAULT[newTier],

                    certificateLevel: (newTier === achv.thresholds.length && achv.certificateLevel) ? achv.certificateLevel : null
                })
                seen[achv.key] = newTier
                seenChanged = true

                if(typeof Sync_XP === "function" && typeof XP_CONFIG !== "undefined"){
                    const tierKey = ACHV_XP_TIER_KEYS[newTier]
                    const xpAmount = tierKey ? (XP_CONFIG.actions.achievement_tier[tierKey] || 0) : 0
                    if(xpAmount > 0) Sync_XP(xpAmount)
                }
            }

        })
    })

    if(seenChanged) ACHV_Notify_Save_Seen(seen)

    return newlyUnlocked
}

function ACHV_Notify_Get_Total_Unlocked(streakData, statsData){
    if(typeof ACHV_CATEGORIES === "undefined") return null

    let total = 0
    ACHV_CATEGORIES.forEach(function(category){
        category.achievements.forEach(function(achv){
            const data = achv.dataSource === "streak" ? streakData : statsData
            total += ACHV_Get_Unlocked_Tiers(achv, data)
        })
    })
    return total
}

function ACHV_Notify_Run(){
    if(typeof Get_Anon_Id !== "function" || typeof tctc_db === "undefined"){
        console.warn("[achv_notify] 找不到 Get_Anon_Id / tctc_db，請確認有先載入 TCTC2-0-firebase.js")
        return
    }

    const streakPromise = (typeof TCTC_Get_Streak_Data === "function")
        ? TCTC_Get_Streak_Data()
        : Promise.resolve(null)

    const statsPromise = new Promise(function(resolve){
        const anon_id = Get_Anon_Id()
        if(!anon_id){ resolve({}); return }
        tctc_db.ref(`player_stats/${anon_id}`).once("value")
            .then(function(snapshot){ resolve(snapshot.val() || {}) })
            .catch(function(error){
                console.warn("[achv_notify] 讀取 player_stats 失敗：", error.message)
                resolve({})
            })
    })

    Promise.all([streakPromise, statsPromise]).then(function(results){
        const newlyUnlocked = ACHV_Notify_Diff(results[0], results[1])
        newlyUnlocked.forEach(ACHV_Notify_Show_Toast)

        if(typeof Sync_Achievements_Unlocked === "function"){
            const total = ACHV_Notify_Get_Total_Unlocked(results[0], results[1])
            if(total !== null) Sync_Achievements_Unlocked(total)
        }
    })
}

function ACHV_Schedule_Notify_Check(){
    if(achv_notify_debounce_timer) clearTimeout(achv_notify_debounce_timer)
    achv_notify_debounce_timer = setTimeout(function(){
        achv_notify_debounce_timer = null
        ACHV_Notify_Run()
    }, ACHV_NOTIFY_DEBOUNCE_MS)
}

function ACHV_Notify_Ensure_Container(){
    let container = document.getElementById("achv_notify_stack")
    if(!container){
        container = document.createElement("div")
        container.id = "achv_notify_stack"
        container.className = "achv_notify_stack"
        document.body.appendChild(container)
    }
    return container
}

function ACHV_Notify_Show_Toast(item){
    const container = ACHV_Notify_Ensure_Container()

    const tierClass = ACHV_TIER_CLASSES[item.tierIndex]

    const eyebrowText = item.certificateLevel ? "可以領證書了" : "成就解鎖"
    const tierText = item.certificateLevel ? "🎓 點這裡列印證書" : item.tierTitle
    const clickTarget = item.certificateLevel
        ? `TCTC2-0-certificate.html?level=${item.certificateLevel}`
        : "TCTC2-0-achievements.html"

    const toast = document.createElement("div")
    toast.className = "achv_notify_toast"
    toast.innerHTML = `
        <div class="achv_notify_medal ${tierClass}">${item.icon}</div>
        <div class="achv_notify_body">
            <p class="achv_notify_eyebrow">${eyebrowText}</p>
            <p class="achv_notify_name">${item.name}</p>
            <p class="achv_notify_tier">${tierText}</p>
        </div>
    `

    toast.addEventListener("click", function(){
        window.location.href = clickTarget
    })

    container.appendChild(toast)

    requestAnimationFrame(function(){
        toast.classList.add("achv_notify_toast_show")
    })

    setTimeout(function(){
        toast.classList.remove("achv_notify_toast_show")
        toast.classList.add("achv_notify_toast_hide")
        setTimeout(function(){ toast.remove() }, 320)
    }, ACHV_NOTIFY_TOAST_DURATION_MS)
}

document.addEventListener("DOMContentLoaded", function(){
    setTimeout(ACHV_Notify_Run, 900)
})