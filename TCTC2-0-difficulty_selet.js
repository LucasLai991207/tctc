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
}

//display

function Show_difficulty_selector(){
    mode_selector_window.classList.remove("is_hidden")
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


//改變username
const username = document.querySelector(".main_lobby_main_frame_player_profile_left_div_username")
if(localStorage.getItem("username")){
    username.textContent = localStorage.getItem("username")
}