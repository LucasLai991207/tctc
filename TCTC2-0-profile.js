let username_exists = localStorage.getItem("username")

const profile_input_block = document.getElementById("profile_username_input_block");

const profile_intro_input_block = document.getElementById("profile_intro_input_block")

if (username_exists){
    console.log("[local] username:", username_exists)
    profile_input_block.value = username_exists

    const profile_username_default = document.getElementById("profile_history_default_name")
    profile_username_default.textContent = `${localStorage.getItem("username")}`
}
else{
    console.log("並未讀取到username在localstorage的資料")
}

if(localStorage.getItem("intro") === "" || localStorage.getItem("intro") === null){
    console.log("並未讀取到intro在localstorage的資料")
}
else{
    console.log("[local] intro:", localStorage.getItem("intro"))
    profile_intro_input_block.value = localStorage.getItem("intro")
}

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
        return
    }

    const trimmed_username_value = raw_username_value.trim()

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

        const profile_intro_input_value = profile_intro_input_block.value

        if(profile_intro_input_value){
            console.log("[intro]成功獲取資料", profile_intro_input_value)
            localStorage.setItem("intro", profile_intro_input_value)
        }
        else{
            console.log("[intro]並未輸入或改變資料")
        }

        if(typeof Set_Own_Intro === "function"){
            Set_Own_Intro(profile_intro_input_value)
        }

        Show_Profile_Toast("資料已更新", false)
        if(btnEl){
            btnEl.disabled = false
            btnEl.textContent = "更新資料"
        }
    })

}

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
    const likeCountEl = document.getElementById("profile_history_like_count")
    const leaderboardToggleEl = document.getElementById("profile_leaderboard_toggle")
    const profileViewToggleEl = document.getElementById("profile_view_toggle")

    if(typeof Get_Own_Player_Stats !== "function"){
        console.log("[profile] Firebase 尚未載入，無法讀取雲端統計資料")
        if(onlineTimeEl) onlineTimeEl.textContent = "無法載入"
        if(totalPointsEl) totalPointsEl.textContent = "無法載入"
        if(pageViewsEl) pageViewsEl.textContent = "無法載入"
        if(likeCountEl) likeCountEl.textContent = "無法載入"
        return
    }

    Get_Own_Player_Stats(function(stats){

        if(stats === null){
            console.log("[profile] 讀取雲端統計資料失敗")
            if(onlineTimeEl) onlineTimeEl.textContent = "讀取失敗"
            if(totalPointsEl) totalPointsEl.textContent = "讀取失敗"
            if(pageViewsEl) pageViewsEl.textContent = "讀取失敗"
            if(likeCountEl) likeCountEl.textContent = "讀取失敗"

            return
        }

        console.log("[profile] 雲端統計資料：", stats)
        if(onlineTimeEl) onlineTimeEl.textContent = Format_Online_Seconds_For_Profile(stats.online_seconds ?? 0)
        if(totalPointsEl) totalPointsEl.textContent = `${stats.total_points ?? 0} 積分`
        if(pageViewsEl) pageViewsEl.textContent = `${stats.page_views ?? 0} 次`

        if(likeCountEl) likeCountEl.textContent = `${stats.like_count ?? 0} 讚`

        if(leaderboardToggleEl){
            leaderboardToggleEl.checked = !(stats.hide_from_leaderboard === true)
            leaderboardToggleEl.disabled = false
        }

        if(profileViewToggleEl){
            profileViewToggleEl.checked = !(stats.hide_profile_view === true)
            profileViewToggleEl.disabled = false
        }
    })
}

function Toggle_Leaderboard_Visibility(is_visible){
    const toggleEl = document.getElementById("profile_leaderboard_toggle")

    if(typeof Set_Own_Leaderboard_Visibility !== "function"){
        console.log("[leaderboard] Firebase 尚未載入，無法更新排行榜顯示設定")
        Show_Profile_Toast("更新失敗，請重新整理頁面再試一次", true)

        if(toggleEl) toggleEl.checked = !is_visible
        return
    }

    const should_hide = !is_visible

    Set_Own_Leaderboard_Visibility(should_hide, function(success){
        if(!success){
            console.log("[leaderboard] 更新排行榜顯示設定失敗")
            Show_Profile_Toast("更新排行榜顯示設定失敗，請稍後再試", true)
            if(toggleEl) toggleEl.checked = !is_visible
            return
        }

        Show_Profile_Toast(should_hide ? "已從排行榜隱藏你的成績" : "已恢復在排行榜上顯示", false)
    })
}

function Toggle_Profile_Visibility(is_public){
    const toggleEl = document.getElementById("profile_view_toggle")

    if(typeof Set_Own_Profile_Visibility !== "function"){
        console.log("[profile] Firebase 尚未載入，無法更新個人資料公開設定")
        Show_Profile_Toast("更新失敗，請重新整理頁面再試一次", true)
        if(toggleEl) toggleEl.checked = !is_public
        return
    }

    const should_hide = !is_public

    Set_Own_Profile_Visibility(should_hide, function(success){
        if(!success){
            console.log("[profile] 更新個人資料公開設定失敗")
            Show_Profile_Toast("更新個人資料公開設定失敗，請稍後再試", true)
            if(toggleEl) toggleEl.checked = !is_public
            return
        }

        Show_Profile_Toast(should_hide ? "已將個人資料設為不公開" : "已將個人資料設為公開", false)
    })
}

function Show_Delete_Confirm(){
    const confirmEl = document.getElementById("profile_delete_confirm")
    if(confirmEl) confirmEl.classList.remove("is_hidden")
}

function Hide_Delete_Confirm(){
    const confirmEl = document.getElementById("profile_delete_confirm")
    if(confirmEl) confirmEl.classList.add("is_hidden")
}

function Clear_Local_Player_Data(){
    const KEYS_TO_REMOVE = [
        "username", "intro",
        "wpm_sum", "wpm_times", "average_wpm",
        "acc_sum", "acc_times", "average_acc",
        "average_challenge_wpm", "average_challenge_acc",
        "tctc2.0-saved_difficulty",
        "tctc2.0-saved_challenge_difficulty",
        "tctc2.0-saved_challenge_seconds",
        "tctc2.0-saved_challenge_stage",
        "tctc2.0-challenge_history",
        "tctc2.0-challenge_total_points",
        "tctc2.0-profile_avatar"

    ]
    KEYS_TO_REMOVE.forEach(function(key){
        localStorage.removeItem(key)
    })
}

function Init_Logout_Zone_Visibility(){
    const zoneEl = document.getElementById("profile_logout_zone")
    if(!zoneEl) return

    const is_logged_in = (typeof Get_Current_Account_Uid === "function") && !!Get_Current_Account_Uid()
    zoneEl.classList.toggle("is_hidden", !is_logged_in)
}

function Logout_And_Clear_Clicked(){
    const btnEl = document.getElementById("profile_logout_clear_btn")

    if(typeof Logout_And_Clear_Guest_Backup !== "function"){
        console.log("[auth] Firebase 尚未載入，無法登出")
        Show_Profile_Toast("系統暫時無法登出，請重新整理頁面再試一次", true)
        return
    }

    if(btnEl){
        btnEl.disabled = true
        btnEl.textContent = "處理中..."
    }

    Logout_And_Clear_Guest_Backup(function(success){
        if(!success){
            Show_Profile_Toast("登出失敗，請稍後再試一次", true)
            if(btnEl){
                btnEl.disabled = false
                btnEl.textContent = "登出並清除這台裝置的訪客紀錄"
            }
            return
        }

        window.location.reload()
    })
}

function Delete_All_Data_Clicked(){
    const confirmBtnEl = document.getElementById("profile_delete_confirm_btn")

    if(typeof Delete_All_Player_Data !== "function"){
        console.log("[delete] Firebase 尚未載入，無法刪除資料")
        Show_Profile_Toast("系統暫時無法刪除資料，請重新整理頁面再試一次", true)
        return
    }

    if(confirmBtnEl){
        confirmBtnEl.disabled = true
        confirmBtnEl.textContent = "刪除中..."
    }

    Delete_All_Player_Data(function(success){
        if(!success){
            console.log("[delete] 刪除資料失敗")
            Show_Profile_Toast("刪除失敗，請稍後再試一次", true)
            if(confirmBtnEl){
                confirmBtnEl.disabled = false
                confirmBtnEl.textContent = "確認刪除"
            }
            return
        }

        Clear_Local_Player_Data()
        Show_Profile_Toast("資料已全部刪除", false)

        setTimeout(function(){
            window.location.reload()
        }, 900)
    })
}

document.addEventListener("DOMContentLoaded", function(){
    Load_Cloud_Player_Stats()
    Init_Logout_Zone_Visibility()
    Init_Typing_Sound_Toggle()
    Init_Theme_Picker()
})

function Init_Theme_Picker(){
    const gridEl = document.getElementById("profile_theme_grid")
    if(!gridEl) return

    if(typeof TCTC_THEME === "undefined"){
        console.log("[theme] 主題模組尚未載入，跳過選色卡初始化")
        return
    }

    const themes = TCTC_THEME.THEMES
    const currentId = TCTC_THEME.getCurrent()

    gridEl.innerHTML = Object.keys(themes).map(function(id){
        const t = themes[id]
        const isActive = (id === currentId)
        return `
            <div class="profile_theme_option${isActive ? " profile_theme_option_active" : ""}"
                 data-theme-id="${id}"
                 role="button"
                 aria-label="切換為${t.name}主題">
                <div class="profile_theme_swatch">
                    <div class="profile_theme_swatch_fill" style="background: linear-gradient(135deg, ${t.darker} 0%, ${t.darker} 50%, ${t.accent} 50%, ${t.accent} 100%);"></div>
                </div>
                <div class="profile_theme_name">${t.name}</div>
                <div class="profile_theme_desc">${t.desc}</div>
            </div>
        `
    }).join("")

    gridEl.querySelectorAll(".profile_theme_option").forEach(function(el){
        el.addEventListener("click", function(){
            const themeId = el.dataset.themeId
            TCTC_THEME.save(themeId)

            gridEl.querySelectorAll(".profile_theme_option").forEach(function(opt){
                opt.classList.remove("profile_theme_option_active")
            })
            el.classList.add("profile_theme_option_active")
        })
    })
}

function Init_Typing_Sound_Toggle(){
    const toggleEl = document.getElementById("profile_typing_sound_toggle")
    if(!toggleEl) return

    if(typeof Get_Typing_Sound_Enabled !== "function"){
        console.log("[typing_sound] 打字音效模組尚未載入，開關維持預設狀態")
        return
    }
    toggleEl.checked = Get_Typing_Sound_Enabled()
}

function Toggle_Typing_Sound(is_enabled){
    if(typeof Set_Typing_Sound_Enabled !== "function"){
        console.log("[typing_sound] 打字音效模組尚未載入，無法儲存設定")
        Show_Profile_Toast("更新失敗，請重新整理頁面再試一次", true)
        return
    }
    Set_Typing_Sound_Enabled(is_enabled)
    Show_Profile_Toast(is_enabled ? "已開啟打字音效" : "已關閉打字音效", false)
}

const AVATAR_STORAGE_KEY = "tctc2.0-profile_avatar"

const AVATAR_TARGET_SIZE = 160

const AVATAR_JPEG_QUALITY = 0.8

const avatar_preview_el = document.getElementById("profile_avatar_preview")
const avatar_placeholder_el = document.getElementById("profile_avatar_placeholder")
const avatar_img_el = document.getElementById("profile_avatar_img")
const avatar_input_el = document.getElementById("profile_avatar_input")
const avatar_remove_btn_el = document.getElementById("profile_avatar_remove_btn")

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

Render_Avatar_Preview(localStorage.getItem(AVATAR_STORAGE_KEY))

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

            const min_side = Math.min(img.width, img.height)
            const crop_x = (img.width - min_side) / 2
            const crop_y = (img.height - min_side) / 2

            ctx.drawImage(
                img,
                crop_x, crop_y, min_side, min_side,
                0, 0, AVATAR_TARGET_SIZE, AVATAR_TARGET_SIZE
            )

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