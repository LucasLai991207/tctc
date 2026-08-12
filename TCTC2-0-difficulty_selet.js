/* LocalStorage:
            saved_difficulty = tctc2.0-saved_difficulty 難度保存
            
            
            
*/

/*綠圓點標記*/
const easy_mode_btn_tag = document.querySelector("#main_lobby_mode_tag_easy")
const medium_mode_btn_tag = document.querySelector("#main_lobby_mode_tag_medium")
const hard_mode_btn_tag = document.querySelector("#main_lobby_mode_tag_hard")

/* difficulty_window */
const easy_window_btn = document.querySelector("#main_lobby_easy_mode")
const medium_window_btn = document.querySelector("#main_lobby_medium_mode")
const hard_window_btn = document.querySelector("#main_lobby_hard_mode")

/*主畫面 難度選擇字卡*/
const easy_mode_btn = document.querySelector('#mode_select_easy_btn')
const medium_mode_btn = document.querySelector('#mode_select_medium_btn')
const hard_mode_btn = document.querySelector('#mode_select_hard_btn')


// 主畫面平均wpm
const main_lobby_average_wpm = document.getElementById("main_lobby_main_frame_wpm")
if(main_lobby_average_wpm && localStorage.getItem("average_wpm")){
    console.log("[main lobby]成功獲取average wpm")
    main_lobby_average_wpm.textContent = localStorage.getItem("average_wpm")
}
// 主畫面平均acc
const main_lobby_average_acc = document.getElementById("main_lobby_main_frame_acc")
if(main_lobby_average_acc && localStorage.getItem("average_acc")){
    console.log("[main lobby]成功獲取average acc")
    main_lobby_average_acc.textContent = localStorage.getItem("average_acc") + "%";
}


/*彈出主視窗*/
const mode_selector_window = document.getElementById("main_lobby_mode_select_window")

/*載入難度視窗*/
document.addEventListener("DOMContentLoaded", function(){

    const saved_difficulty = localStorage.getItem("tctc2.0-saved_difficulty")
    if(saved_difficulty){

        console.log("成功讀取上次難度 難度為", saved_difficulty)

        mode_selector_window.classList.add("is_hidden")

        if(saved_difficulty == "easy"){
            Difficulty_Choose_Easy()
        }
        else if(saved_difficulty == "medium"){
            Difficulty_Choose_Medium()
        }
        else if(saved_difficulty == "hard"){
            Difficulty_Choose_Hard()
        }
    }
    else{
        console.log("上次並未選擇視窗")
        Show_difficulty_selector()
    }
    
})

function Save_and_HighLight(difficulty){

    localStorage.setItem("tctc2.0-saved_difficulty", difficulty)    /*先標記*/

    if(easy_mode_btn) easy_mode_btn.classList.remove("main_lobby_mode_golden_shadow")
    if(medium_mode_btn) medium_mode_btn.classList.remove("main_lobby_mode_golden_shadow")
    if(hard_mode_btn) hard_mode_btn.classList.remove("main_lobby_mode_golden_shadow")
    
    if(easy_mode_btn_tag) easy_mode_btn_tag.classList.remove("main_lobby_mode_tag")
    if(medium_mode_btn_tag) medium_mode_btn_tag.classList.remove("main_lobby_mode_tag")
    if(hard_mode_btn_tag) hard_mode_btn_tag.classList.remove("main_lobby_mode_tag")

    if(difficulty == "easy"){
        easy_mode_btn.classList.add("main_lobby_mode_golden_shadow")
        easy_mode_btn_tag.classList.add("main_lobby_mode_tag")


    }
    if(difficulty == "medium"){
        medium_mode_btn.classList.add("main_lobby_mode_golden_shadow")
        medium_mode_btn_tag.classList.add("main_lobby_mode_tag")

    }
    if(difficulty == "hard"){
        hard_mode_btn.classList.add("main_lobby_mode_golden_shadow")
        hard_mode_btn_tag.classList.add("main_lobby_mode_tag")
    
    }
}


//隱藏視窗

function Exit_mode_selector(){
    if (!mode_selector_window) return
    mode_selector_window.classList.add("is_hidden")

    // 【新增】跟 Show_difficulty_selector() 對應，關窗時把背景捲動鎖定還原、
    // 焦點還給開窗前使用者原本在操作的元素
    document.body.style.overflow = ""
    if (mode_selector_last_focused && typeof mode_selector_last_focused.focus === "function") {
        mode_selector_last_focused.focus()
    }
    mode_selector_last_focused = null
}

//display

// 【新增】記住開窗前的焦點，關窗時要還原（同一套做法跟 auth_ui.js 的登入視窗一致）
let mode_selector_last_focused = null

function Show_difficulty_selector(){
    mode_selector_window.classList.remove("is_hidden")

    // 【新增】鎖住背景捲動 + 記住原本焦點，跟登入視窗同一套邏輯
    mode_selector_last_focused = document.activeElement
    document.body.style.overflow = "hidden"
}

function Difficulty_Choose_Easy(){
    localStorage.setItem("tctc2.0-saved_difficulty", "easy")

    difficulty = 1
    console.log("easy")    
    Save_and_HighLight("easy")
    render_chapter("easy")
    render_stage("easy", Level_Data['easy'].chapter[0])
}

function Difficulty_Choose_Medium(){
    localStorage.setItem("tctc2.0-saved_difficulty", "medium")

    difficulty = 2
    console.log("medium")
    Save_and_HighLight("medium")
    render_chapter("medium")
    render_stage("medium", Level_Data['medium'].chapter[0])

}

function Difficulty_Choose_Hard(){
    localStorage.setItem("tctc2.0-saved_difficulty", "hard")

    difficulty = 3
    console.log("hard")
    Save_and_HighLight("hard")
    render_chapter("hard")
    render_stage("hard", Level_Data['hard'].chapter[0])


}

/*模式偵測*/

if(easy_window_btn){
easy_mode_btn.addEventListener('click', function(){
    Exit_mode_selector()
    Difficulty_Choose_Easy()

})
}

if(medium_window_btn){
medium_mode_btn.addEventListener('click', function(){
    Exit_mode_selector()
    Difficulty_Choose_Medium()
})
}

if(hard_window_btn){
hard_mode_btn.addEventListener('click', function(){
    Exit_mode_selector()
    Difficulty_Choose_Hard()
})
}



/*換到intro葉面*/
function Change_into_intro(){
    window.location.href='TCTC2-0-main.html'
}



const username = document.querySelector(".main_lobby_main_frame_player_profile_left_div_username")
const saved_username = localStorage.getItem("username")
const cached_guest_number = localStorage.getItem("tctc_guest_number")

if(saved_username){
    username.textContent = saved_username
} else if(cached_guest_number){
    // 補零成固定 4 位數，跟 TCTC2-0-firebase.js 的 Get_Player_Display_Name() 格式保持一致
    username.textContent = "訪客#" + String(cached_guest_number).padStart(4, "0")
}

/* ============================================================
   【新增】難度選擇視窗的鍵盤行為：Esc 直接關閉、Tab 把焦點鎖在視窗裡，
   跟 auth_ui.js 的登入視窗是同一套邏輯，只是這裡沒有輸入框，不需要
   Enter 送出的部分。這個視窗本身沒有另外的「關閉」按鈕——原本只能靠
   點選三個難度卡片其中一個才會關閉，Esc 之後等同多一種「先不選、
   關掉視窗」的方式（跟原本點難度卡片一樣，只是呼叫 Exit_mode_selector()
   不會連帶呼叫 Difficulty_Choose_X()）。
   ============================================================ */
document.addEventListener("keydown", function(event){
    if (!mode_selector_window || mode_selector_window.classList.contains("is_hidden")) return // 視窗沒開，不處理

    if (event.key === "Escape"){
        event.preventDefault()
        Exit_mode_selector()
        return
    }

    if (event.key === "Tab"){
        const candidates = mode_selector_window.querySelectorAll('button, [href], input, select, textarea, [onclick], [tabindex]:not([tabindex="-1"])')
        const visible = Array.prototype.filter.call(candidates, function(el){
            return el.offsetParent !== null
        })
        if (visible.length === 0) return

        const first = visible[0]
        const last = visible[visible.length - 1]

        if (event.shiftKey && document.activeElement === first){
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last){
            event.preventDefault()
            first.focus()
        }
        return
    }

    // 【新增】三張難度卡片是 <div tabindex="0" onclick="...">，補上 tabindex 只讓它們
    // 能被 Tab 選到、但瀏覽器不會像 <button> 一樣自動幫 div 處理 Enter/Space 觸發，
    // 要自己判斷「目前聚焦的是不是這三張卡片之一」再手動呼叫 .click()
    if (event.key === "Enter" || event.key === " "){
        const focused = document.activeElement
        if (focused && focused.hasAttribute("onclick") && mode_selector_window.contains(focused)){
            event.preventDefault()
            focused.click()
        }
    }
})