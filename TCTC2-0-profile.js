let username_exists = localStorage.getItem("username") //username

//input username block
const profile_input_block = document.getElementById("profile_username_input_block");
//input intro block
const profile_intro_input_block = document.getElementById("profile_intro_input_block")



//檢查username
if (username_exists){
    console.log("[local] username:", username_exists)
    profile_input_block.value = username_exists      //繼承資料

    //直接改profile裡面的鳴子
    const profile_username_default = document.getElementById("profile_history_default_name")
    profile_username_default.textContent = `${localStorage.getItem("username")}`
}
else{
    console.log("並未讀取到username在localstorage的資料")
}

//檢查簡介
if(localStorage.getItem("intro") === "" || localStorage.getItem("intro") === null){
    console.log("並未讀取到intro在localstorage的資料")
}
else{
    console.log("[local] intro:", localStorage.getItem("intro"))
    profile_intro_input_block.value = localStorage.getItem("intro")
}

// ===== 【新增】更新資料的成功/失敗提示，固定貼在畫面底部置中 =====
// 顯示一下子就自動淡出，不用玩家自己關掉
let profile_toast_timer = null
function Show_Profile_Toast(message, is_error){
    const toastEl = document.getElementById("profile_toast")
    if(!toastEl) return

    toastEl.textContent = message
    toastEl.classList.toggle("profile_toast_error", !!is_error)
    toastEl.classList.add("profile_toast_show")

    if(profile_toast_timer) clearTimeout(profile_toast_timer)
    profile_toast_timer = setTimeout(function(){
        toastEl.classList.remove("profile_toast_show")
    }, 2600)
}

function Update_profile(){

    const warningEl = document.getElementById("profile_username_warning")
    const btnEl = document.getElementById("profile_update_btn")
    if(warningEl) warningEl.textContent = ""

    // ===== 【新增】改名字現在要過兩關：1) 格式規則  2) 全站不能重複 =====
    // 格式檢查要用「原始輸入」（不能先 trim），不然開頭空格會被靜靜吃掉，
    // 玩家永遠不會知道自己違反了規則
    const raw_username_value = profile_input_block.value

    if(typeof Validate_Username_Format !== "function" || typeof Claim_Username !== "function"){
        console.log("[username] Firebase 尚未載入，無法檢查名字")
        if(warningEl) warningEl.textContent = "系統暫時無法確認名字，請重新整理頁面再試一次"
        Show_Profile_Toast("更新失敗，請重新整理頁面再試一次", true)
        return
    }

    const validation = Validate_Username_Format(raw_username_value)
    if(!validation.valid){
        console.log("[username] 格式不符：", validation.reason)
        if(warningEl) warningEl.textContent = validation.reason
        Show_Profile_Toast(validation.reason, true)
        return   // 名字沒過關，整次更新中止（簡介也不會存），等玩家把名字改好再送出一次
    }

    const trimmed_username_value = raw_username_value.trim()

    // ===== 【新增】點下去馬上給反應：按鈕先變成「更新中...」並暫時不能再按第二次，
    // 不然玩家搞不清楚有沒有真的按到，可能會連點好幾次 =====
    if(btnEl){
        btnEl.disabled = true
        btnEl.textContent = "更新中..."
    }

    Claim_Username(trimmed_username_value, function(success, reason){
        if(!success){
            console.log("[username] 佔用失敗：", reason)
            if(warningEl) warningEl.textContent = reason
            Show_Profile_Toast(reason, true)
            if(btnEl){
                btnEl.disabled = false
                btnEl.textContent = "更新資料"
            }
            return
        }

        console.log(`[username]成功獲取資料 ${trimmed_username_value}`)
        localStorage.setItem("username", trimmed_username_value)

        const profile_username_default = document.getElementById("profile_history_default_name")
        if(profile_username_default) profile_username_default.textContent = trimmed_username_value

        // ----- 名字確定沒問題、也真的佔到了，才繼續存簡介 -----
        const profile_intro_input_value = profile_intro_input_block.value

        if(profile_intro_input_value){
            console.log("[intro]成功獲取資料", profile_intro_input_value)
            localStorage.setItem("intro", profile_intro_input_value)
        }
        else{
            console.log("[intro]並未輸入或改變資料")
        }

        Show_Profile_Toast("資料已更新", false)
        if(btnEl){
            btnEl.disabled = false
            btnEl.textContent = "更新資料"
        }
    })

}


//讀取個資

// ===== 【修改】原本這裡只讀 average_wpm / average_acc 一組，現在拆成主線／挑戰兩組 =====
// 主線關卡的鏡像值，key 名稱跟 game.html 結算時寫入的完全一致，沒有變動
const main_average_wpm = localStorage.getItem("average_wpm") || 0
const main_average_acc = localStorage.getItem("average_acc") || 0

if(document.querySelector("#profile_history_main_wpm")){
    console.log("[local] main average wpm: ", main_average_wpm)
    document.querySelector("#profile_history_main_wpm").textContent = `${main_average_wpm} WPM`
}
if(document.querySelector("#profile_history_main_acc")){
    console.log("[local] main average acc: ", main_average_acc)
    document.querySelector("#profile_history_main_acc").textContent = `${main_average_acc} %`
}

// 挑戰模式的鏡像值，key 名稱要跟 TCTC2-0-challenge_lobby.js 裡
// Load_Challenge_Profile_Stats() 讀取的完全一致（average_challenge_wpm / average_challenge_acc），
// 不然這裡讀不到資料，永遠顯示 0
const challenge_average_wpm = localStorage.getItem("average_challenge_wpm") || 0
const challenge_average_acc = localStorage.getItem("average_challenge_acc") || 0

if(document.querySelector("#profile_history_challenge_wpm")){
    console.log("[local] challenge average wpm: ", challenge_average_wpm)
    document.querySelector("#profile_history_challenge_wpm").textContent = `${challenge_average_wpm} WPM`
}
if(document.querySelector("#profile_history_challenge_acc")){
    console.log("[local] challenge average acc: ", challenge_average_acc)
    document.querySelector("#profile_history_challenge_acc").textContent = `${challenge_average_acc} %`
}

/* ============================================================
   【新增】雲端專屬的三項數值：在線時長／累積積分／瀏覽次數
   ------------------------------------------------------------
   這三項「不能」用上面那種直接讀 localStorage 的寫法，因為它們在本機
   只有「待補交上雲端的暫存量」（例如 tctc2.0-pending_online_seconds），
   一旦同步成功就會被清空歸零——本機暫存區從來就不是「總量」，
   真正的累積總量只存在 Firebase 的 player_stats/{anon_id} 節點裡，
   一定要透過 Get_Own_Player_Stats() 向雲端查詢才拿得到正確數字。
   ------------------------------------------------------------ */

// 把「總秒數」轉成「X 小時 Y 分 Z 秒」這種給人看的格式。
// 跟 TCTC2-0-ranking.js 裡的 Format_Online_Seconds 邏輯完全一致，
// 這裡重複寫一份而不是共用同一支檔案，是因為 profile.html 目前沒有載入
// ranking.js（兩個頁面用途不同，沒必要為了一個小函式多載入一整支排行榜邏輯）。
// 用 Math.floor 而不是四捨五入，理由跟 ranking.js 一樣：在線時長是累積量，
// 無條件捨去比較保守、不會灌水。
function Format_Online_Seconds_For_Profile(total_seconds){
    const seconds_int = Math.floor(total_seconds || 0)
    if(seconds_int < 60) return `${seconds_int} 秒`

    const hours = Math.floor(seconds_int / 3600)
    const minutes = Math.floor((seconds_int % 3600) / 60)
    const seconds = seconds_int % 60

    if(hours > 0) return `${hours}時${minutes}分${seconds}秒`
    return `${minutes} 分 ${seconds} 秒`
}

function Load_Cloud_Player_Stats(){
    const onlineTimeEl = document.getElementById("profile_history_online_time")
    const totalPointsEl = document.getElementById("profile_history_total_points")
    const pageViewsEl = document.getElementById("profile_history_page_views")
    const leaderboardToggleEl = document.getElementById("profile_leaderboard_toggle") // 【新增】

    // 這個頁面萬一 Firebase 沒載入成功（例如 CDN 被擋、網路問題），
    // Get_Own_Player_Stats 這個函式就不會存在，三個欄位改顯示明確的錯誤訊息，
    // 不要讓畫面一直卡在「載入中...」讓玩家搞不清楚是壞了還是還在讀。
    // 【新增】開關這種情況也要繼續維持 disabled——連讀都讀不到，
    // 更不可能知道現在到底是開是關，讓玩家點下去只會寫入一個猜測值，這樣不安全。
    if(typeof Get_Own_Player_Stats !== "function"){
        console.log("[profile] Firebase 尚未載入，無法讀取雲端統計資料")
        if(onlineTimeEl) onlineTimeEl.textContent = "無法載入"
        if(totalPointsEl) totalPointsEl.textContent = "無法載入"
        if(pageViewsEl) pageViewsEl.textContent = "無法載入"
        return
    }

    Get_Own_Player_Stats(function(stats){
        // stats 是 null：代表讀取「真的失敗」（離線、Rules 沒設好），
        // 要跟「這個玩家還沒有任何資料」明確區分開來，不能誤植成 0
        if(stats === null){
            console.log("[profile] 讀取雲端統計資料失敗")
            if(onlineTimeEl) onlineTimeEl.textContent = "讀取失敗"
            if(totalPointsEl) totalPointsEl.textContent = "讀取失敗"
            if(pageViewsEl) pageViewsEl.textContent = "讀取失敗"
            // 【新增】讀取失敗時開關保持鎖住，理由同上
            return
        }

        // stats 是 {}（空物件）：代表這個玩家目前雲端真的還沒有任何資料
        // （例如全新訪客一次都還沒同步過），這種情況顯示 0 是正確的，
        // 用 ?? 0 補上預設值即可，不需要額外判斷
        console.log("[profile] 雲端統計資料：", stats)
        if(onlineTimeEl) onlineTimeEl.textContent = Format_Online_Seconds_For_Profile(stats.online_seconds ?? 0)
        if(totalPointsEl) totalPointsEl.textContent = `${stats.total_points ?? 0} 積分`
        if(pageViewsEl) pageViewsEl.textContent = `${stats.page_views ?? 0} 次`

        // ===== 【新增】用同一次讀到的資料，順便初始化排行榜顯示開關 =====
        // stats.hide_from_leaderboard 這個欄位本來就包含在 player_stats/{anon_id}
        // 這整個節點裡，不需要為了這個開關另外再打一次 Get_Own_Leaderboard_Visibility()。
        // checkbox 的 checked 狀態代表「顯示」，所以是 hide_from_leaderboard 的相反值；
        // 資料確定讀回來了，才把 disabled 拿掉，避免玩家在資料還沒到之前搶先亂點。
        if(leaderboardToggleEl){
            leaderboardToggleEl.checked = !(stats.hide_from_leaderboard === true)
            leaderboardToggleEl.disabled = false
        }
    })
}

/* ============================================================
   【新增】排行榜顯示開關：切換就立刻同步上雲端，不需要按「更新資料」按鈕
   ------------------------------------------------------------
   is_visible：目前 checkbox 切換「之後」的狀態（true = 開關被扳成「顯示」）。
   這個參數是 HTML 那邊 onchange="Toggle_Leaderboard_Visibility(this.checked)"
   直接傳進來的，所以拿到的已經是「使用者操作完之後」的新狀態，不是操作前的舊狀態。
   ============================================================ */
function Toggle_Leaderboard_Visibility(is_visible){
    const toggleEl = document.getElementById("profile_leaderboard_toggle")

    if(typeof Set_Own_Leaderboard_Visibility !== "function"){
        console.log("[leaderboard] Firebase 尚未載入，無法更新排行榜顯示設定")
        Show_Profile_Toast("更新失敗，請重新整理頁面再試一次", true)
        // 【新增】寫入不可能成功，把畫面上的開關復原成操作前的狀態，
        // 避免「畫面看起來已經關閉，但雲端其實還是舊設定」這種顯示跟實際不一致的情況
        if(toggleEl) toggleEl.checked = !is_visible
        return
    }

    // hide_from_leaderboard 這個雲端欄位的語意跟 checkbox 剛好相反：
    // checkbox 打勾 = 顯示（is_visible = true），所以要寫入的值要取反
    const should_hide = !is_visible

    Set_Own_Leaderboard_Visibility(should_hide, function(success){
        if(!success){
            console.log("[leaderboard] 更新排行榜顯示設定失敗")
            Show_Profile_Toast("更新排行榜顯示設定失敗，請稍後再試", true)
            if(toggleEl) toggleEl.checked = !is_visible // 同上，寫入失敗就復原畫面狀態
            return
        }

        Show_Profile_Toast(should_hide ? "已從排行榜隱藏你的成績" : "已恢復在排行榜上顯示", false)
    })
}

// ===== 【新增】等 DOMContentLoaded 才呼叫 Load_Cloud_Player_Stats() =====
// 原因：TCTC2-0-online_time.js 會在 DOMContentLoaded 時，把這個瀏覽器
// 本機暫存的「在線秒數」跟「瀏覽次數」補交上雲端（Sync_Pending_Online_Time /
// Sync_Pending_Page_Views）。如果我們在這個事件「之前」就急著去讀雲端資料，
// 會讀到還沒補交這一次的舊數字（少算最新這一段）。
// 由於 <script> 標籤的載入順序是 firebase.js → online_time.js → profile.js，
// 瀏覽器會照這個順序依序註冊 DOMContentLoaded 監聽器，並依「註冊的先後順序」
// 依序觸發——所以只要我們也把這段邏輯包在 DOMContentLoaded 裡，就能保證
// 在 online_time.js 觸發補交「之後」才執行，讀到的資料才會是最新的。
document.addEventListener("DOMContentLoaded", function(){
    Load_Cloud_Player_Stats()
})

/* ============================================================
   【新增】自訂頭像 —— 完全只存在這台裝置的瀏覽器（localStorage），
   不經過 Firebase，所以天生不會出現在排行榜或任何其他玩家能看到的地方。
   ------------------------------------------------------------
   儲存的 key：AVATAR_STORAGE_KEY，內容是一個 Base64 格式的圖片資料網址
   （data URL，例如 "data:image/jpeg;base64,/9j/4AAQ..."），可以直接當
   <img> 的 src 使用，不需要額外解碼。
   ============================================================ */
const AVATAR_STORAGE_KEY = "tctc2.0-profile_avatar"

// 頭像縮圖的目標邊長（正方形）。160px 對「一個小圓形預覽框」來說已經很夠用，
// 刻意不做更大尺寸，因為這張圖是要塞進 localStorage 的，邊長越大、
// Base64 字串就越長，越容易撞到瀏覽器的儲存容量上限
const AVATAR_TARGET_SIZE = 160

// JPEG 壓縮品質（0~1）。0.8 是「肉眼幾乎看不出差異、但檔案大小明顯變小」的
// 常見經驗值，對一個 160x160 的小頭像來說，壓縮後通常只有幾十 KB
const AVATAR_JPEG_QUALITY = 0.8

const avatar_preview_el = document.getElementById("profile_avatar_preview")
const avatar_placeholder_el = document.getElementById("profile_avatar_placeholder")
const avatar_img_el = document.getElementById("profile_avatar_img")
const avatar_input_el = document.getElementById("profile_avatar_input")
const avatar_remove_btn_el = document.getElementById("profile_avatar_remove_btn")

// 把目前畫面上的頭像預覽，同步成 localStorage 裡實際存的內容
// （data_url 是 null 就顯示「尚未設定」的佔位文字，不是 null 就顯示圖片）
function Render_Avatar_Preview(data_url){
    if(!avatar_img_el || !avatar_placeholder_el) return

    if(data_url){
        avatar_img_el.src = data_url
        avatar_img_el.style.display = "block"
        avatar_placeholder_el.style.display = "none"
    }
    else{
        avatar_img_el.removeAttribute("src")
        avatar_img_el.style.display = "none"
        avatar_placeholder_el.style.display = "block"
    }
}

// 頁面載入時，先把上次存過的頭像（如果有的話）顯示出來
Render_Avatar_Preview(localStorage.getItem(AVATAR_STORAGE_KEY))

// ===== 【新增】把使用者選的原始圖片，用 <canvas> 裁切成正方形 + 縮小尺寸 + 壓縮 =====
// 為什麼一定要經過這一步，不能直接把原始檔案存進 localStorage：
// 手機拍的照片動輒 3~10MB，遠超過 localStorage 通常只有 5~10MB 的總容量上限
// （而且這個額度是整個網站共用的，不是頭像專屬），直接存整張原圖幾乎一定會
// 塞爆、甚至讓其他功能（例如在線時長暫存）也一起壞掉。
// <canvas> 是瀏覽器內建、專門用來繪製/處理圖片的畫布 API：先把圖片畫上去，
// 畫的時候直接控制輸出尺寸（等於順便完成縮小），再用 toDataURL() 匯出成
// 壓縮過的 JPEG 格式 Base64 字串，全部都在瀏覽器端完成，不用上傳到任何地方。
function Resize_Image_To_Avatar(file, callback){
    const reader = new FileReader()

    reader.onerror = function(){
        console.log("[avatar] 讀取檔案失敗")
        callback(null)
    }

    reader.onload = function(){
        const img = new Image()

        img.onerror = function(){
            console.log("[avatar] 圖片格式無法解析")
            callback(null)
        }

        img.onload = function(){
            const canvas = document.createElement("canvas")
            canvas.width = AVATAR_TARGET_SIZE
            canvas.height = AVATAR_TARGET_SIZE
            const ctx = canvas.getContext("2d")

            // ----- 置中裁切成正方形 -----
            // 使用者選的原始圖片通常不是正方形（例如手機拍的照片是長方形），
            // 如果直接把整張圖硬塞進正方形畫布，非正方形的圖會被拉伸變形。
            // 這裡的做法是：取原圖「寬跟高裡比較短的那一邊」當作裁切邊長，
            // 從正中間裁出一個正方形區域，再把這個正方形畫進 canvas，
            // 這樣輸出的縮圖才不會變形，只是視野會比原圖窄一點（裁掉部分邊緣）。
            const min_side = Math.min(img.width, img.height)
            const crop_x = (img.width - min_side) / 2
            const crop_y = (img.height - min_side) / 2

            ctx.drawImage(
                img,
                crop_x, crop_y, min_side, min_side,           // 從原圖裁切的來源區域（置中正方形）
                0, 0, AVATAR_TARGET_SIZE, AVATAR_TARGET_SIZE   // 畫到 canvas 上的目標區域（固定縮圖尺寸）
            )

            // 匯出成 JPEG 格式的 Base64 資料網址，第二個參數是壓縮品質
            const data_url = canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY)
            callback(data_url)
        }

        img.src = reader.result
    }

    reader.readAsDataURL(file)
}

if(avatar_input_el){
    avatar_input_el.addEventListener("change", function(){
        const file = avatar_input_el.files && avatar_input_el.files[0]
        if(!file) return

        // input 已經有 accept="image/*" 限制檔案選擇視窗只顯示圖片，
        // 但使用者仍然可能用其他方式（例如拖曳）繞過這個限制，這裡再保險檢查一次
        if(!file.type.startsWith("image/")){
            console.log("[avatar] 選到的檔案不是圖片：", file.type)
            Show_Profile_Toast("請選擇圖片檔案", true)
            avatar_input_el.value = "" // 清空選擇，避免使用者選同一個檔案時 change 事件不會再次觸發
            return
        }

        Resize_Image_To_Avatar(file, function(data_url){
            if(!data_url){
                Show_Profile_Toast("頭像解析度太高了，換一張圖片試試", true)
                avatar_input_el.value = ""
                return
            }

            // ===== 【新增】localStorage.setItem 可能會因為超過容量上限而丟出例外 =====
            // 雖然已經壓縮過，正常情況下一張 160x160 的 JPEG 縮圖只有幾十 KB，
            // 幾乎不可能塞爆，但還是要用 try/catch 包起來，避免真的遇到極端情況
            // （例如瀏覽器的隱私瀏覽模式限制更嚴格的容量）時，讓整頁 JS 直接報錯中斷
            try{
                localStorage.setItem(AVATAR_STORAGE_KEY, data_url)
                Render_Avatar_Preview(data_url)
                Show_Profile_Toast("頭像已更新", false)
            }
            catch(error){
                console.log("[avatar] 儲存頭像失敗（可能是瀏覽器儲存空間已滿）：", error)
                Show_Profile_Toast("頭像儲存失敗，可能是瀏覽器儲存空間已滿", true)
            }

            avatar_input_el.value = "" // 清空選擇，讓使用者可以重選同一張圖片（觸發 change 事件）
        })
    })
}

if(avatar_remove_btn_el){
    avatar_remove_btn_el.addEventListener("click", function(){
        // 【新增】先檢查「目前真的有存過頭像」，再決定要顯示哪一句提示文字，
        // 不然不管有沒有頭像，畫面上都會講「已移除頭像」，會讓玩家誤以為
        // 剛剛按下去之前明明是有頭像的（但其實從頭到尾都沒有設定過）
        const had_avatar = !!localStorage.getItem(AVATAR_STORAGE_KEY)

        localStorage.removeItem(AVATAR_STORAGE_KEY)
        Render_Avatar_Preview(null)

        if(had_avatar){
            Show_Profile_Toast("已移除頭像", false)
        }
        else{
            Show_Profile_Toast("啊你就沒設定頭像是要移除什麼", false)
        }
    })
}