/* ============================================================
   TCTC 打字音效 - 共用模組
   ============================================================
   使用方式：
   1. 在需要打字音效的頁面（目前是 game.html / TCTC2-0-challenge.js
      所在的 TCTC2-0-challenge.html），載入這個檔案：

        <script src="TCTC2-0-typing_sound.js"></script>

   2. 頁面初始化時呼叫一次 Init_Typing_Sound()（負責建立 AudioContext、
      預先讀取並解碼所有音效檔）。

   3. 在判斷「打對」的地方呼叫對應的 Play_*_Sound()：
        - Play_Correct_Sound()  一般打對字：兩種音效隨機混音
        - Play_Space_Sound()    打對「空白鍵」那一下
        - Play_Enter_Sound()    打對「Enter」那一下
        - Play_Complete_Sound() 過關（acc >= 90）時播放一次
        - Play_Wrong_Sound()    打錯時呼叫（目前沒有對應音檔，先當作
                                 保留的 API，呼叫了也不會發出聲音；
                                 之後有音檔了直接補進 SOUND_FILES 就會生效，
                                 呼叫端完全不用改）

   4. Set_Typing_Sound_Enabled(true/false)：切換是否要播放音效，
      這個開關會自己存進 localStorage（純本機設定，不同步雲端），
      下次進頁面會自動讀回上次的設定。

   音效檔要跟這個頁面放在同一個資料夾（相對路徑），檔名如下：
        TCTC3-0-keyboard-short-click.mp3
        TCTC3-0-keyboard-short-click2.mp3
        TCTC3-0-keyboard-space.mp3
        TCTC3-0-keyboard-enter.mp3
        TCTC3-0-complete.mp3
*/

const TYPING_SOUND_ENABLED_KEY = "tctc2.0-typing_sound_enabled"

// 音效檔清單：key 是內部代號，value 是檔案路徑（相對於 HTML 所在資料夾）
const SOUND_FILES = {
    click1:   "TCTC3-0-keyboard-short-click.mp3",
    click2:   "TCTC3-0-keyboard-short-click2.mp3",
    space:    "TCTC3-0-keyboard-space.mp3",
    enter:    "TCTC3-0-keyboard-enter.mp3",
    complete: "TCTC3-0-complete.mp3"
    // wrong: 目前沒有音檔，之後有了直接在這裡加一行 wrong: "檔名.mp3" 就會自動生效
}

let typing_sound_ctx = null          // AudioContext 只需要建立一次，整頁共用
let typing_sound_buffers = {}        // 解碼完成的 AudioBuffer，key 對應 SOUND_FILES 的 key
let typing_sound_enabled = true      // 是否播放音效（從 localStorage 讀回上次設定）
let typing_sound_init_started = false // 避免同一頁不小心呼叫兩次 Init_Typing_Sound() 重複載入

// ===== 初始化：建立 AudioContext + 讀取上次的開關設定 + 非同步載入所有音效檔 =====
// 【重要】瀏覽器的自動播放政策：AudioContext 建立時常常是「suspended」狀態，
// 一定要等到玩家真的有一次操作（例如打字的第一個 keydown）之後才能真正發出聲音，
// 所以 Play_*_Sound() 裡面都會順手呼叫 typing_sound_ctx.resume()，
// 不需要另外在頁面上放一個「請按任意鍵開啟音效」的提示。
function Init_Typing_Sound(){
    if(typing_sound_init_started) return   // 防止重複初始化，重複 fetch 同一批檔案
    typing_sound_init_started = true

    // 讀取上次的開關設定；預設是開（localStorage 完全沒存過的情況）
    const saved = localStorage.getItem(TYPING_SOUND_ENABLED_KEY)
    typing_sound_enabled = (saved === null) ? true : (saved === "true")

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if(!AudioContextClass){
        console.log("[typing_sound] 這個瀏覽器不支援 Web Audio API，打字音效功能停用")
        return
    }
    typing_sound_ctx = new AudioContextClass()

    // 逐一 fetch + decodeAudioData，全部用 Promise 處理，載入失敗（例如檔案還沒放上去）
    // 就只是那個音效播不出來，不影響其他音效跟遊戲本身的功能
    Object.keys(SOUND_FILES).forEach(function(key){
        fetch(SOUND_FILES[key])
            .then(function(res){ return res.arrayBuffer() })
            .then(function(arrayBuffer){ return typing_sound_ctx.decodeAudioData(arrayBuffer) })
            .then(function(audioBuffer){
                typing_sound_buffers[key] = audioBuffer
            })
            .catch(function(error){
                console.log(`[typing_sound] 音效載入失敗：${SOUND_FILES[key]}`, error)
            })
    })
}

// ===== 開關音效：切換就立刻存進 localStorage，純本機設定，不用等任何雲端資料回來 =====
function Set_Typing_Sound_Enabled(enabled){
    typing_sound_enabled = !!enabled
    localStorage.setItem(TYPING_SOUND_ENABLED_KEY, typing_sound_enabled ? "true" : "false")
}

// 給 profile 頁面讀取目前的開關狀態，用來初始化 checkbox 的勾選狀態
function Get_Typing_Sound_Enabled(){
    const saved = localStorage.getItem(TYPING_SOUND_ENABLED_KEY)
    return (saved === null) ? true : (saved === "true")
}

// ===== 實際播放：所有 Play_*_Sound() 共用這個底層函式 =====
// 每次都用 createBufferSource() 建立一個新的播放節點——AudioBufferSourceNode
// 是「用過即丟」的一次性節點，沒辦法重複播放，玩家連續打字（同一個音效很短時間內被
// 呼叫很多次）才能疊在一起播放，不會互相打斷、也不會有「上一個還沒播完就被切掉」的問題。
function _Play_Buffer(key){
    if(!typing_sound_enabled) return
    if(!typing_sound_ctx) return   // 還沒 Init_Typing_Sound()，或瀏覽器不支援

    const buffer = typing_sound_buffers[key]
    if(!buffer) return   // 音效還沒載完，或根本沒有這個檔案（例如 wrong 目前沒有音檔）

    // 瀏覽器的自動播放政策：AudioContext 常常會是 suspended 狀態，
    // 這裡的 resume() 是不需要 await 的，就算這次還沒 resume 完成、這一下沒發出聲音，
    // 之後很快就會 resume 好，不影響接下來的打字音效。
    if(typing_sound_ctx.state === "suspended"){
        typing_sound_ctx.resume().catch(function(){})
    }

    const source = typing_sound_ctx.createBufferSource()
    source.buffer = buffer
    source.connect(typing_sound_ctx.destination)
    source.start(0)
}

// ===== 打對一般字：兩種音效隨機混音，避免一直重複同一個聲音聽起來很單調 =====
function Play_Correct_Sound(){
    const key = Math.random() < 0.5 ? "click1" : "click2"
    _Play_Buffer(key)
}

// 打對「空白鍵」那一下
function Play_Space_Sound(){
    _Play_Buffer("space")
}

// 打對「Enter」那一下
function Play_Enter_Sound(){
    _Play_Buffer("enter")
}

// 過關時播放（acc >= 90 才呼叫，門檻判斷交給呼叫端）
function Play_Complete_Sound(){
    _Play_Buffer("complete")
}

// 打錯：目前沒有對應音檔，呼叫了就是靜靜地什麼都不做。
// 保留這個函式是為了讓 game.html / challenge.js 那幾個 wrong_key_times++ 的地方
// 可以先接上去，之後只要在 SOUND_FILES 補一行 wrong: "檔名.mp3"，
// 呼叫端完全不用改，就會自動開始有聲音。
function Play_Wrong_Sound(){
    _Play_Buffer("wrong")
}