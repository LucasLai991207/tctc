let time = 10
let timer = null
let target = "ㄏㄞ˙ㄋㄧˇㄏㄠˇㄓㄜˋㄌㄧˇㄕˋ"
let isRunning = false
let current = 0
let wrong_input = false
let times_up = false
let target_get = 0
let wrong_key_times = 0
let spans = []
let letters = []
let difficulty = 0
const targetElement = document.getElementById("target")
if (targetElement) {
    spans = target.split("").map(char => "<span>" + char + "</span>")
    targetElement.innerHTML = spans.join("")
    letters = document.querySelectorAll("#target span")
}
const bopomofo = {
    "1":"ㄅ", "q":"ㄆ", "a":"ㄇ", "z":"ㄈ",
    "2":"ㄉ", "w":"ㄊ", "s":"ㄋ", "x":"ㄌ",
    "e":"ㄍ", "d":"ㄎ", "c":"ㄏ",
    "r":"ㄐ", "f":"ㄑ", "v":"ㄒ",
    "5":"ㄓ", "t":"ㄔ", "g":"ㄕ", "b":"ㄖ",
    "y":"ㄗ", "h":"ㄘ", "n":"ㄙ",
    "u":"ㄧ", "j":"ㄨ", "m":"ㄩ",
    "8":"ㄚ", "i":"ㄛ", "k":"ㄜ", ",":"ㄝ",
    "9":"ㄞ", "o":"ㄟ", "l":"ㄠ", ";":"ㄡ",
    "0":"ㄢ", "p":"ㄣ", "-":"ㄤ", "7":"ㄥ",
    "=":"ㄦ", "3":"ˇ", "4":"ˋ", " ":"˙", "6":"ˊ"
}

function Start_counting(){
    if(isRunning) return
    isRunning = true
    timer = setInterval(function(){
        time -= 1
        document.getElementById("timer").innerHTML = time
        if(time < 1){
            isRunning = false
            times_up = true
            clearInterval(timer)
            document.getElementById("timer").innerHTML = "times up!"
            document.getElementById("result").innerHTML = "WPM: " + Math.ceil((target_get / 3) / (10 / 60)) + " Accuracy: " + Math.round((1 - wrong_key_times / target_get) * 100) + "%"
            console.log("target_get:", target_get, "wrong_key_times:", wrong_key_times)
        }
    }, 1000)
}

document.addEventListener("keydown", function(event){
    if(!targetElement) return
    if(times_up === true) return
    let key = event.key
    if(key === " ") event.preventDefault()
    
    if(key === "Backspace"){
        if(wrong_input === true){
            wrong_input = false
            letters[current].classList.remove("wrong")
            return
        }
        if(wrong_input === false){
            target_get -= 1
        }
        if(current <= 0){
            current = 0
            return
        }
        current--
        letters[current].classList.remove("correct")
        letters[current].classList.remove("wrong")
        return
    }
    if(bopomofo[key] === undefined) return
    console.log("target:", target[current], "player_input", bopomofo[key])

    if(!isRunning) Start_counting()
    if(wrong_input === false){
        if(target[current] === bopomofo[key]){
            console.log("correct")
            target_get++
            letters[current].classList.add("correct")
            current++
            let time_used = 10 - time
            if(time_used === 0) time_used = 1
            if(current === target.length){
                clearInterval(timer)
                isRunning = false
                times_up = true
                document.getElementById("result").innerHTML = "WPM: " + Math.ceil((target_get / 3) / (time_used / 60)) + " Accuracy: " + Math.round((1 - wrong_key_times / target_get) * 100) + "%"
                console.log("target_get:", target_get, "wrong_key_times:", wrong_key_times)
            }
        }
        else if(key !== "Backspace"){
            console.log(wrong_input)
            wrong_key_times += 1
            wrong_input = true
            letters[current].classList.add("wrong")
        }
    }
})
function Reset_time(){
    clearInterval(timer)
    current = 0
    wrong_input = false
    times_up = false
    target_get = 0
    wrong_key_times = 0
    isRunning = false
    time = 10
    document.getElementById("timer").innerHTML = "time left : 10s"
    document.getElementById("result").innerHTML = ""
    letters.forEach(letter => {
        letter.classList.remove("correct")
        letter.classList.remove("wrong")
    })
}
