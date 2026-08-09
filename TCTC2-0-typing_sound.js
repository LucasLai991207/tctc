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
        - Play_Wrong_Sound()    打錯時呼叫（音檔 make_mistake.mp3，內建節流，
                                 見下方 Play_Wrong_Sound 的說明）
        - Play_Tick_Sound()     倒數最後幾秒的「嗶」聲，最後 3 秒每秒呼叫一次
                                 【新增】這個不是讀音檔，是用 Web Audio 的
                                 OscillatorNode 現場合成一個短促的嗶聲，
                                 不需要另外準備音檔

   4. Set_Typing_Sound_Enabled(true/false)：切換是否要播放音效，
      這個開關會自己存進 localStorage（純本機設定，不同步雲端），
      下次進頁面會自動讀回上次的設定。

   音效檔要跟這個頁面放在同一個資料夾（相對路徑），檔名如下：
        TCTC3-0-keyboard-short-click.mp3
        TCTC3-0-keyboard-short-click2.mp3
        TCTC3-0-keyboard-space.mp3
        TCTC3-0-keyboard-enter.mp3
        TCTC3-0-complete.mp3
        make_mistake.mp3   【新增】打錯字音效，Play_Wrong_Sound() 用
*/

const TYPING_SOUND_ENABLED_KEY = "tctc2.0-typing_sound_enabled"

// 音效檔清單：key 是內部代號，value 是檔案路徑（相對於 HTML 所在資料夾）
const SOUND_FILES = {
    click1:   "TCTC3-0-keyboard-short-click.mp3",
    click2:   "TCTC3-0-keyboard-short-click2.mp3",
    space:    "TCTC3-0-keyboard-space.mp3",
    enter:    "TCTC3-0-keyboard-enter.mp3",
    complete: "TCTC3-0-complete.mp3",
    wrong:    "make_mistake.mp3"   // 【新增】打錯字音效
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

// 打錯時呼叫，播放 make_mistake.mp3
//
// ===== 【新增】節流（throttle）=====
// 玩家「卡住」狂按同一個錯誤格子時，Play_Wrong_Sound() 可能在極短時間內被連續
// 呼叫非常多次（例如中級的 stuck_mistake_counted 邏輯：卡住格只計一次錯誤次數，
// 但玩家每按一下都還是會呼叫 Play_Wrong_Sound()），這麼短的間隔內同一個音效疊
// 好幾層播放，聽起來會變成一片刺耳的雜音。
// 這裡用一個「最小播放間隔」把它擋掉：距離上次真的播放不到 WRONG_SOUND_MIN_INTERVAL_MS
// 的呼叫直接略過，玩家狂按時聽起來像穩定的「答、答、答」，而不是疊在一起的噪音。
let last_wrong_sound_time = 0
const WRONG_SOUND_MIN_INTERVAL_MS = 150
function Play_Wrong_Sound(){
    const now = Date.now()
    if(now - last_wrong_sound_time < WRONG_SOUND_MIN_INTERVAL_MS) return
    last_wrong_sound_time = now
    _Play_Buffer("wrong")
}

// ===== 【新增】倒數計時最後幾秒的提示音 =====
// 不讀音檔，直接用 Web Audio 的 OscillatorNode 現場合成一個短促的「嗶」聲：
// 好處是不用額外準備/載入音檔、檔案大小是 0、也不會有 fetch 失敗的問題。
// 呼叫端（game.html 的 Update_Timer_Display / challenge.js 的 cg_start_timer）
// 負責判斷「現在是不是該嗶的那一秒」，這裡只單純負責「發出一聲嗶」，
// 不管節流或是不是最後 3 秒——呼叫端每個倒數秒數只會呼叫一次，不需要再額外節流。
function Play_Tick_Sound(){
    if(!typing_sound_enabled) return
    if(!typing_sound_ctx) return   // 還沒 Init_Typing_Sound()，或瀏覽器不支援

    if(typing_sound_ctx.state === "suspended"){
        typing_sound_ctx.resume().catch(function(){})
    }

    const now = typing_sound_ctx.currentTime
    const osc = typing_sound_ctx.createOscillator()
    const gain = typing_sound_ctx.createGain()

    osc.type = "sine"
    osc.frequency.value = 880   // A5，清脆但不刺耳

    // 用 exponentialRamp 做一個很短的「淡入淡出」（不能從 0 開始，exponentialRamp
    // 不接受 0，所以起始值給一個極小的正數 0.0001），避免音量瞬間跳變產生「喀」的爆音。
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

    osc.connect(gain)
    gain.connect(typing_sound_ctx.destination)

    osc.start(now)
    osc.stop(now + 0.13)
}