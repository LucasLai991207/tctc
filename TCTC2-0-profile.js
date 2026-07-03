let username_exists = localStorage.getItem("username") //username

//input username block
const profile_input_block = document.getElementById("profile_username_input_block");
//input email block
const profile_email_input_block = document.getElementById("profile_email_input_block")
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

//檢查email
if(localStorage.getItem("email") === "" || localStorage.getItem("email") === null){
    console.log("並未讀取到email在localstorage的資料")
}
else{
    console.log("[local] email:", localStorage.getItem("email"))
    profile_email_input_block.value = localStorage.getItem("email")

}
//檢查簡介
if(localStorage.getItem("intro") === "" || localStorage.getItem("intro") === null){
    console.log("並未讀取到intro在localstorage的資料")
}
else{
    console.log("[local] intro:", localStorage.getItem("intro"))
    profile_intro_input_block.value = localStorage.getItem("intro")
}

function Update_profile(){

    //input username value
    const profile_username_value = profile_input_block.value;

    //去除空白的 username value
    let current_profile_username_value = profile_input_block.value.trim()
    if(current_profile_username_value === "" || profile_username_value === " "){
        console.log("名字不可為空白")
        localStorage.setItem("username", "")
        return;
    }
    if(profile_username_value){
        console.log(`[username]成功獲取資料 ${profile_username_value}`);
        localStorage.setItem("username", profile_username_value)
    }
    else{
        console.log("[username]並未輸入或改變資料");
    }

    //input email value
    const profile_email_value = profile_email_input_block.value

    let current_profile_email_value = profile_email_value.trim()
    if(current_profile_email_value === "" || current_profile_email_value === " "){
        console.log("郵箱不可為空白")
        localStorage.setItem("email", "")
        return;
    }
    if(profile_email_value){
        console.log("[email]成功獲取資料", profile_email_value)
        localStorage.setItem("email", profile_email_value)
    }
    else{
        console.log("[email]並未輸入或改變資料")
    }

    //input intro value
    const profile_intro_input_value = profile_intro_input_block.value

    if(profile_intro_input_value){
        console.log("[intro]成功獲取資料", profile_intro_input_value)
        localStorage.setItem("intro", profile_intro_input_value)

    }
    else{
        console.log("[intro]並未輸入或改變資料")
    }

}


//讀取個資

average_wpm = localStorage.getItem("average_wpm") ?
    localStorage.getItem("average_wpm") 
    : 0;

if(average_wpm){
    console.log("[local] average wpm: ", average_wpm);
    document.querySelector("#profile_history_average_wpm").textContent = `${average_wpm} WPM`
}

