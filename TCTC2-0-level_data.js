const Level_Data = {
    easy : {
        chapter:[
            {
                id : "1-1",
                name :"認識鍵盤",
                stage :[
                    {id : "1-1-1", name:"認識鍵盤佈局", name2:"" , type:"基本介紹", level:"☆☆☆☆☆☆☆", target: ""},            //target: 15字元 正常螢幕一排
                    {id : "1-1-2", name:"認識繁體中文鍵盤", name2:"", type:"基本介紹", level:"☆☆☆☆☆☆☆", target:""},
                    {id : "1-1-3", name:"打字指法", name2:"", type:"基本介紹", level:"☆☆☆☆☆☆☆", target:""}
                ]
            },
            {
                id : "1-2",
                name : "標點符號",
                stage:[
                    {id:"1-2-1", name:"基礎符號", name2:" _  ˊ" ,name3:"二聲請使用左手食指 空白鍵建議使用右手拇指", type:"注音練習", level:"☆☆☆☆☆☆★", target:" ˊ ˊ ˊˊ  ˊˊˊ  "},
                    {id:"1-2-2", name:"階段驗收", name2:" _ ˊ" ,name3:"二聲請使用左手食指 空白鍵建議使用右手拇指", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ˊˊ  ˊˊˊ   ˊ  ˊ ˊˊ  ˊˊ  ˊˊ ˊˊ"},
                    {id:"1-2-3", name:"基礎符號", name2:" ˇ ˋ" ,name3:"此關僅限使用左手（空白鍵除外）", type:"注音練習", level:"☆☆☆☆☆★★", target:"ˇ  ˋ  ˇˇˋ ˋˋˇ ˇˋ ˋˇ ˇˋ ˋˋˇ ˇˇˋ"},
                    {id:"1-2-4", name:"階段驗收", name2:" _  ˊ ˇ ˋ" , name3:"正確的指法 + 頻繁的練習 + 不看鍵盤 = 提升速度關鍵！！", type:"注音練習", level:"☆☆☆☆☆★★", target:" ˊˇˋ ˋˇˊ  ˇ ˋ ˊ ˇˋ ˊˋ ˊˇ ˋˊ ˇˋ"},
                    {id:"1-2-5", name:"階段驗收", name2:" ˙ ↵" , name3:"此關僅限使用右手", type:"注音練習", level:"☆☆☆☆☆★★", target:"˙ ↵ ˙↵ ↵˙ ↵↵˙˙ ↵↵˙ ˙˙↵ ˙˙↵ ↵↵˙"},
                    {id:"1-2-6", name:"階段驗收", name2:" _  ˊ ˇ ˋ ˙ ↵" , name3:"正確的指法 + 頻繁的練習 + 不看鍵盤 = 提升速度關鍵！！", type:"注音練習", level:"☆☆☆☆☆★★", target:" ˊˇˋ˙↵ ˇˋˊ˙↵ ↵↵ˇ ˋˋˊ ˙˙ˇ ↵ˇˋ ˊ˙ˋ ˋˇˊ ↵ˇˊ ˊˋˇ↵"},

                    {id:"1-2-7", name:"章節驗收", name2:" - 1" , name3:"恭喜來到章節尾聲 趕快完成此章節", type:"注音練習", level:"☆☆☆☆☆★★", target:"ˊˇˋ˙↵ ˇˋˋ ˙ˇ↵ ˙ˇˋ ↵˙ˊ ˊˇˋ ↵↵ˊ ˊˊˋ ˋˋˇ ˇˇ↵ ↵˙˙"}

                ]
            },
            {
                id : "1-3",
                name : "食指注音（一）",
                stage:[
                    {id:"1-3-1", name:"基礎注音", name2:" ㄑ ㄨ" , name3:"雙手食指記得隨時要回到起始點喔（ㄑ ㄨ）", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄑㄑ ㄨㄨ ㄑㄨ ㄨㄑ ㄑㄑㄨ ㄨㄨㄑ ㄨˊ ㄨˇ ㄨˋ ↵"},
                    {id:"1-3-2", name:"基礎注音", name2:" ㄕ ㄘ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄕㄕ ㄘㄘ ㄕㄘ ㄘㄕ ㄕ ㄘ ㄕㄘㄕ ㄘㄕㄘ ㄕㄕㄘ ㄘㄘㄕ"},
                    {id:"1-3-3", name:"階段驗收", name2:" ㄑ ㄨ ㄕ ㄘ" , name3:"", type:"注音練習", level:"☆☆☆☆☆★★", target:"ㄑㄨ ㄕㄘ ㄨㄑ ㄘㄕ ㄑㄕ ㄨㄘ ㄕㄑ ㄘㄨ ㄑㄨㄕ ㄘㄨㄑ ㄕㄘㄨ ㄑㄕㄘ ㄨㄑㄕㄘ"},

                    {id:"1-3-4", name:"基礎注音", name2:" ㄐ ㄧ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄐㄐ ㄧㄧ ㄐㄧ ㄧㄐ ㄐ ㄧ ㄐㄧㄐ ㄧㄐㄧ ㄐㄐㄧ ㄧㄧㄐ"},
                    {id:"1-3-5", name:"基礎注音", name2:" ㄒ ㄙ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄒㄒ ㄙㄙ ㄒㄙ ㄙㄒ ㄒ ㄙ ㄒㄙㄒ ㄙㄒㄙ ㄒㄒㄙ ㄙㄙㄒ"},
                    {id:"1-3-6", name:"階段驗收", name2:" ㄐ ㄧ ㄒ ㄙ" , name3:"", type:"注音練習", level:"☆☆☆☆☆★★", target:"ㄐㄧ ㄒㄙ ㄧㄐ ㄙㄒ ㄐㄒ ㄧㄙ ㄒㄐ ㄙㄧ ㄐㄧㄒ ㄙㄧㄐ ㄒㄙㄧ ㄐㄒㄙ ㄧㄐㄒㄙ"},

                    {id:"1-3-7", name:"章節驗收", name2:" - 1-3" , name3:"", type:"注音練習", level:"☆☆☆☆☆★★", target:"ㄑㄨㄕㄘㄐㄧㄒㄙ ㄑㄐㄨㄧㄕㄒㄘㄙ ㄕㄨ ㄑㄧ ㄐㄘ ㄒㄨ ㄙㄑ ㄐㄕ\nㄒㄘ ㄙㄧ ㄑㄨ ㄕㄘ ㄐㄧ ㄒㄙ ㄑㄐ ㄨㄧ ㄕㄒ ㄘㄙ ㄑㄨ ㄕㄘ ㄐㄧ ㄒㄙ"}

                ]
            },
            {
                id : "1-4",
                name : "食指注音（二）",
                stage:[
                    {id:"1-4-1", name:"基礎注音", name2:" ㄏ ㄩ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄏㄏ ㄩㄩ ㄏㄩ ㄩㄏ ㄏ ㄩ ㄏㄩㄏ ㄩㄏㄩ ㄏㄏㄩ ㄩㄩㄏ"},
                    {id:"1-4-2", name:"基礎注音", name2:" ㄔ ㄗ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄔㄔ ㄗㄗ ㄔㄗ ㄗㄔ ㄔ ㄗ ㄔㄗㄔ ㄗㄔㄗ ㄔㄔㄗ ㄗㄗㄔ"},
                    {id:"1-4-3", name:"階段驗收", name2:" ㄏ ㄩ ㄔ ㄗ" , name3:"", type:"注音練習", level:"☆☆☆☆☆★★", target:"ㄏㄩ ㄔㄗ ㄩㄏ ㄗㄔ ㄏㄔ ㄩㄗ ㄔㄏ ㄗㄩ ㄏㄩㄔ ㄗㄩㄏ ㄔㄗㄩ ㄏㄔㄗ ㄩㄏㄔㄗ"},
                    {id:"1-4-4", name:"基礎注音", name2:" ㄖ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄖㄖ ㄖㄖㄖ ㄖ ㄖ ㄖㄖ ㄖㄖㄖ ㄖ ㄖ ㄖㄖ ㄖㄖㄖ ㄖ ㄖ ㄖㄖ ㄖㄖㄖ"},
                    {id:"1-4-5", name:"階段驗收", name2:" ㄏ ㄩ ㄔ ㄗ ㄖ" , name3:"", type:"注音練習", level:"☆☆☆☆☆★★", target:"ㄖㄏ ㄩㄖ ㄔㄖ ㄗㄖ ㄏㄩㄖ ㄔㄗㄖ ㄖㄏㄩ ㄖㄔㄗ ㄏㄔㄖ ㄩㄗㄖ ㄖㄏㄔ ㄖㄩㄗ"},
                    {id:"1-4-6", name:"章節驗收", name2:" - 1-4" , name3:"", type:"注音練習", level:"☆☆☆☆☆★★", target:"ㄏㄩㄔㄗㄖㄑㄨㄕㄘㄐㄧㄒㄙ ㄑㄏ ㄨㄩ ㄕㄔ ㄘㄗ ㄐㄖ\nㄧㄏ ㄒㄩ ㄙㄔ ㄗㄐ ㄖㄨ ㄕㄙ ㄑㄩ ㄏㄩㄔㄗㄖㄑㄨㄕㄘ ㄐㄧㄒㄙ"}
                ]
                
                
            },
            {
                id : "1-5",
                name : "基礎注音-3",
                stage:[
                    {id:"1-5-1", name:"基礎注音", name2:" 空白鍵 Enter" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄑㄑㄑㄨㄨㄨㄑㄑㄨㄨㄑㄑㄨ"},
                    {id:"1-5-2", name:"基礎注音", name2:" ㄎ ㄜ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄑㄑㄑㄨㄨㄨㄑㄑㄨㄨㄑㄑㄨ"},
                    {id:"1-5-3", name:"基礎注音", name2:" ㄋ ㄠ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄑㄑㄑㄨㄨㄨㄑㄑㄨㄨㄑㄑㄨ"},
                    {id:"1-5-4", name:"基礎注音", name2:" ㄇ ㄤ" , name3:"", type:"注音練習", level:"☆☆☆☆☆☆★", target:"ㄑㄑㄑㄨㄨㄨㄑㄑㄨㄨㄑㄑㄨ"}
                ]
                
                
            }
        ]
    },
    medium : {
        chapter:[
            {
                id : "2-1",
                name :"綜合練習-1",
                stage: [
                    {id:"2-1-1", name : "精熟度測試", name2:"", type:"國字注音對照", level:"☆☆☆☆★★★"},
                    {id:"2-1-2", name : "精熟度測試", name2:"", type:"國字注音對照", level:"☆☆☆☆★★★"},
                    {id:"2-1-3", name : "精熟度測試", name2:"", type:"國字注音對照", level:"☆☆☆☆★★★"},
                    {id:"2-1-4", name : "精熟度測試", name2:"", type:"國字注音對照", level:"☆☆☆☆★★★"},
                    {id:"2-1-5", name : "精熟度測試", name2:"", type:"國字注音對照", level:"☆☆☆☆★★★"},


                ]
            }
        ]
    },
    hard : {
        chapter:[
            {id : "3-1", name :"速度挑戰-1"}

        ]
    } 
}
function render_chapter(difficulty){
    const container = document.getElementById("chapter_list")
    const container_stage = document.getElementById("main_lobby_level_container")

    if(!container){
        console.log("沒找到chapter_list")
    }

    container_stage.innerHTML = ""
    container.innerHTML = ""      //清空

    Level_Data[difficulty].chapter.forEach(function(chapter){   //迴圈式建div
        const div = document.createElement("div")
        div.classList.add("chapter_frame")
        div.textContent = chapter.name

        div.addEventListener("click", function(){
            console.log("點了", chapter.name, chapter.id)
            select_chapter(div)
            render_stage(difficulty, chapter)
        })

        container.appendChild(div)
    })
}
function select_chapter(div){             //切章節 視覺部分
    const main_container = document.querySelectorAll(".chapter_frame")
    main_container.forEach(function(frame){
        frame.classList.remove("chapter_selected")
    })

    div.classList.add("chapter_selected")


}

function render_stage(difficulty, chapter){             //渲染關卡
    const single_container = document.getElementById("main_lobby_level_container")
    single_container.innerHTML = ""

    if(!chapter.stage){
        console.log("找不到該難度的關卡 難度：", difficulty)
        return
    }

    chapter.stage.forEach(function(stage){
        const div = document.createElement("div")
        div.classList.add("main_lobby_map_stage")
        div.innerHTML = `
                <div class="main_lobby_map_stage_text1">${stage.id}</div>
                <div class="main_lobby_map_stage_text2">
                    <p class="main_lobby_map_stage_text2-1">
                        -${stage.name}<span class="main_lobby_map_stage_text2-2">${stage.name2}</span>
                    </p>
                </div>
                <div class="main_lobby_map_stage_text3">注音練習</div>
                <div class="main_lobby_map_stage_difficulty_star">${stage.level}</div>
                `

        div.addEventListener("click", function(){
            window.location.href = `game.html?stage=${stage.id}`
        })
        single_container.appendChild(div)
    })
}