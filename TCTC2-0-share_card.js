/* ============================================================
   TCTC 成績分享卡片 - 共用模組
   ============================================================
   使用方式：
   1. 在需要分享功能的頁面載入這個檔案（跟 typing_sound.js 一樣是獨立模組，
      沒有依賴關係，放在哪個 <script> 位置都可以）：

        <script src="TCTC2-0-share_card.js"></script>

   2. 局結束、要跳出分享卡時，直接呼叫：

        Open_Share_Card_Modal({
            wpm: 65,                 // 必填，畫面上最大的數字
            acc: 92,                 // 必填，準確率（不用加 % ，模組會自己補上）
            label: "1-3-2 中級關卡",  // 必填，關卡/模式名稱
            sub_label: "主線模式",    // 選填，顯示在 label 上方的小字，不傳就不畫這一行
            details: [                // 選填，任意多筆「細項數據」，畫成卡片下半部的表格
                { label: "難度",     value: "普通" },
                { label: "時間限制", value: "1 分鐘挑戰" },
                { label: "總打字元數", value: "312" },
                { label: "正確字元數", value: "298" },
                { label: "錯誤字元數", value: "14" },
                { label: "修正次數", value: "6" },
                { label: "總耗時",   value: "01：00" }
            ]
        })

      這個函式會自己：跳出「圖片產生中...」的彈窗 → 用 Canvas 畫出成績卡
      （含玩家自訂頭像，如果有設定過的話，以及 details 裡的所有細項）→
      換成「預覽圖 + 下載按鈕」。整個過程玩家不需要做任何事，也不會被要求任何權限。

      details 陣列想放幾筆都可以，卡片高度會自動依筆數往下延伸（三欄排版），
      不會被舊有的固定尺寸卡死；不傳 details 或傳空陣列，卡片就只顯示
      WPM / 準確率兩個主要數據（維持舊版行為）。

   3. 頭像資料直接讀 localStorage 裡跟 avatar_display.js 同一把 key
      （tctc2.0-profile_avatar），玩家沒設定過頭像的話就不畫頭像，
      不會佔位、也不會顯示壞掉的圖示。
   ============================================================ */

const SHARE_CARD_WIDTH = 960
const SHARE_CARD_AVATAR_KEY = "tctc2.0-profile_avatar"   // 跟 avatar_display.js 用同一把 key，讀同一份頭像資料


const SHARE_CARD_DETAILS_TOP_Y   = 490   // 細項表格第一列的文字 baseline y 座標
const SHARE_CARD_DETAILS_ROW_H   = 38    // 每一列的高度（三欄共用同一列高）
const SHARE_CARD_DETAILS_COLS    = 3     // 細項表格欄數
const SHARE_CARD_DETAILS_COL_X   = [50, 370, 690]   // 三欄各自的起始 x 座標
const SHARE_CARD_BOTTOM_PADDING  = 55    // 細項表格畫完之後，底部網址那一行還需要留的空間


function _Compute_Share_Card_Height(details_count){
    if(details_count <= 0) return 500
    const rows = Math.ceil(details_count / SHARE_CARD_DETAILS_COLS)
    return SHARE_CARD_DETAILS_TOP_Y + (rows * SHARE_CARD_DETAILS_ROW_H) + SHARE_CARD_BOTTOM_PADDING
}

function _Load_Share_Card_Avatar(){
    return new Promise(function(resolve){
        const data_url = localStorage.getItem(SHARE_CARD_AVATAR_KEY)
        if(!data_url){
            resolve(null)
            return
        }
        const img = new Image()
        img.onload = function(){ resolve(img) }
        img.onerror = function(){ resolve(null) }   // 頭像資料壞掉就當作沒有頭像處理，不要讓整張卡片產生失敗
        img.src = data_url
    })
}


async function Generate_Result_Share_Card(options){
    const wpm = options.wpm ?? 0
    const acc = options.acc ?? 0
    const label = options.label ?? ""
    const sub_label = options.sub_label ?? ""

    const now = new Date()
    const pad2 = function(n){ return String(n).padStart(2, "0") }
    const played_at = `${now.getFullYear()}/${pad2(now.getMonth() + 1)}/${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
    const all_details = (options.details || []).concat([{ label: "測驗時間", value: played_at }])


    const canvas = document.createElement("canvas")
    canvas.width = SHARE_CARD_WIDTH
    canvas.height = _Compute_Share_Card_Height(all_details.length)
    const ctx = canvas.getContext("2d")
    const card_height = canvas.height


    if(document.fonts && document.fonts.ready){
        await document.fonts.ready
    }

    // ---- 同時把頭像圖片載入好 ----
    const avatar_img = await _Load_Share_Card_Avatar()

    // ===== 背景：深藍漸層，呼應網站 --dark-blue / --darker-blue 兩個主題色 =====
    const bg_gradient = ctx.createLinearGradient(0, 0, SHARE_CARD_WIDTH, card_height)
    bg_gradient.addColorStop(0, "#0B1E36")
    bg_gradient.addColorStop(1, "#0b1a37")
    ctx.fillStyle = bg_gradient
    ctx.fillRect(0, 0, SHARE_CARD_WIDTH, card_height)

    // ---- 外框：金色細框，呼應網站卡片一貫的 border 風格 ----
    ctx.strokeStyle = "#c9a84c"
    ctx.lineWidth = 3
    ctx.strokeRect(6, 6, SHARE_CARD_WIDTH - 12, card_height - 12)

    // ===== 標題區（左上角）=====
    ctx.textBaseline = "alphabetic"   // Canvas 文字預設的基準線，明確寫出來避免不同瀏覽器預設值不一致
    ctx.fillStyle = "#fff"
    ctx.font = "bold 40px 'Noto Serif TC', sans-serif"
    ctx.fillText("TCTC 繁體中文打字中心", 50, 80)

    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = "16px 'Noto Serif TC', sans-serif"
    ctx.fillText("TRADITIONAL CHINESE TYPING CENTER", 50, 105)

    // ===== 關卡 / 模式名稱 =====
    if(sub_label){
        ctx.fillStyle = "rgba(255,255,255,0.6)"
        ctx.font = "18px 'Noto Serif TC', sans-serif"
        ctx.fillText(sub_label, 50, 155)
    }
    ctx.fillStyle = "whitesmoke"
    ctx.font = "26px 'Noto Serif TC', sans-serif"
    ctx.fillText(label, 50, 190)

    // ===== 主要數據：WPM 用超大字體當視覺焦點 =====
    const wpm_text = String(wpm)
    ctx.fillStyle = "#c9a84c"
    ctx.font = "bold 120px 'Noto Serif TC', sans-serif"
    ctx.fillText(wpm_text, 50, 350)

    // 「WPM」這三個字要接在數字後面，用 measureText() 量出數字實際畫出來的寬度，
    // 才能準確算出下一段文字要從哪裡開始畫，不會跟數字疊在一起，也不會留太多空隙。
    const wpm_text_width = ctx.measureText(wpm_text).width
    ctx.fillStyle = "whitesmoke"
    ctx.font = "30px 'Noto Serif TC', sans-serif"
    ctx.fillText("WPM", 50 + wpm_text_width + 16, 350)

    // ===== 次要數據：準確率 =====
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.font = "18px 'Noto Serif TC', sans-serif"
    ctx.fillText("準確率", 50, 400)

    ctx.fillStyle = "#c9a84c"
    ctx.font = "bold 32px 'Noto Serif TC', sans-serif"
    ctx.fillText(acc + "%", 50, 435)

    // ===== 【新增】分隔線：把上面「主要數據」跟下面「細項表格」視覺上區隔開 =====
    ctx.strokeStyle = "rgba(255,255,255,0.15)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(50, 465)
    ctx.lineTo(SHARE_CARD_WIDTH - 50, 465)
    ctx.stroke()

    // ===== 【新增】細項表格：三欄排版，把 all_details 裡每一筆 { label, value } 都畫出來 =====
    // 例如難度、關卡時間限制、總打字元數、正確／錯誤字元數、修正次數、瞬時最高CPM、跳過次數、總耗時...
    // 呼叫端想放多少筆都可以，畫布高度已經在建立 canvas 時依筆數算好了，這裡只管畫，不用擔心裝不下。
    all_details.forEach(function(item, index){
        const col = index % SHARE_CARD_DETAILS_COLS
        const row = Math.floor(index / SHARE_CARD_DETAILS_COLS)
        const x = SHARE_CARD_DETAILS_COL_X[col]
        const y = SHARE_CARD_DETAILS_TOP_Y + row * SHARE_CARD_DETAILS_ROW_H

        // 這一欄實際可以畫多寬：不是最後一欄就抓到下一欄開始前留一點間距，
        // 是最後一欄就抓到卡片右邊界留一點間距，避免文字太長時「爆版」畫出卡片外面。
        const max_width = (col < SHARE_CARD_DETAILS_COLS - 1)
            ? SHARE_CARD_DETAILS_COL_X[col + 1] - x - 24
            : SHARE_CARD_WIDTH - x - 50

        // label 用偏灰的金色、value 緊接在後面用亮白色，兩段分開畫才能各自控制顏色深淺，
        // 視覺上一眼就能分辨「這是欄位名稱」還是「這是實際數值」。
        const label_text = String(item.label ?? "") + "："
        ctx.font = "18px 'Noto Serif TC', sans-serif"
        ctx.fillStyle = "rgba(201,168,76,0.75)"
        ctx.fillText(label_text, x, y)
        const label_width = ctx.measureText(label_text).width

        // ---- value 如果太長、會被下一欄擋到，就用「…」截斷，不讓文字畫出這一欄的範圍 ----
        // 逐字往下砍到量出來的寬度塞得進剩餘空間為止；這種逐字量測的做法比較笨，
        // 但細項的字數通常不多（頂多十幾個字），效能完全不用擔心。
        let value_text = String(item.value ?? "")
        const available_width = Math.max(max_width - label_width, 20)
        if(ctx.measureText(value_text).width > available_width){
            while(value_text.length > 1 && ctx.measureText(value_text + "…").width > available_width){
                value_text = value_text.slice(0, -1)
            }
            value_text += "…"
        }

        ctx.fillStyle = "whitesmoke"
        ctx.fillText(value_text, x + label_width, y)
    })

    // ===== 底部：小字標註網站網址，讓分享出去的人知道是哪個網站 =====
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.font = "20px 'Noto Serif TC', sans-serif"
    ctx.fillText("https://tctc-typing.pages.dev/", 50, card_height - 30)

    // ---- 輸出成 base64 圖片，格式跟頭像功能存的 data_url 一樣，可以直接放進 <img src> ----
    return canvas.toDataURL("image/png")
}

// ===== 私有工具：只在第一次呼叫時把彈窗需要的 CSS 插進 <head>，避免重複插入 =====
let _share_card_style_injected = false
function _Ensure_Share_Card_Style(){
    if(_share_card_style_injected) return
    _share_card_style_injected = true

    const style = document.createElement("style")
    style.textContent = `
        .tctc_share_overlay{
            position: fixed;
            inset: 0;
            background-color: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
            box-sizing: border-box;
        }
        .tctc_share_modal{
            background-color: #0B1E36;
            border: 1px solid #18004b;
            border-radius: 10px;
            padding: 1.6rem;
            max-width: 90vw;
            max-height: 90vh;
            overflow-y: auto;
            box-sizing: border-box;
            text-align: center;
        }
        .tctc_share_modal_title{
            color: whitesmoke;
            font-size: 1.05rem;
            letter-spacing: 1px;
            margin: 0 0 1rem;
        }
        .tctc_share_modal img{
            display: block;
            max-width: 100%;
            /* 【修正】細項變多之後，卡片本身的實際像素高度可能長到 700~800px，
               先前只有 max-width 沒有 max-height，圖片會照原比例把寬度撐到 90vw，
               連帶把高度也撐得比螢幕還高，導致整個彈窗爆版、下載按鈕被推到畫面外。
               這裡改成寬高都設上限（object-fit: contain 保比例縮放），
               卡片內容看不完的話彈窗本身還會出現捲軸（見上面 .tctc_share_modal 的 overflow-y），
               兩層保險一起上，不管細項塞多滿都不會把頁面擠爆。 */
            max-height: 65vh;
            width: auto;
            height: auto;
            object-fit: contain;
            border-radius: 6px;
            margin: 0 auto 1.2rem;
        }
        .tctc_share_loading{
            color: rgba(255,255,255,0.6);
            padding: 3.5rem 4.5rem;
            font-size: 0.9rem;
            letter-spacing: 1px;
        }
        .tctc_share_modal_actions{
            display: flex;
            gap: 0.7rem;
            justify-content: center;
        }
        .tctc_share_btn{
            padding: 0.55rem 1.3rem;
            font-size: 0.9rem;
            letter-spacing: 1px;
            border-radius: 5px;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
            text-decoration: none;
            display: inline-block;
        }
        .tctc_share_btn_download{
            background-color: #c9a84c;
            color: #0b1a37;
            border: 1px solid #c9a84c;
        }
        .tctc_share_btn_close{
            background-color: transparent;
            color: rgb(190,190,190);
            border: 1px solid rgba(255,255,255,0.25);
        }
    `
    document.head.appendChild(style)
}

// ===== 對外主要入口：跳出「產生中 → 預覽 + 下載」的彈窗 =====
// options 格式同 Generate_Result_Share_Card()：{ wpm, acc, label, sub_label }
async function Open_Share_Card_Modal(options){
    _Ensure_Share_Card_Style()

    // ---- 先建立遮罩 + 彈窗骨架，顯示「圖片產生中...」，避免玩家點了按鈕卻覺得沒反應 ----
    const overlay = document.createElement("div")
    overlay.className = "tctc_share_overlay"
    overlay.innerHTML = `
        <div class="tctc_share_modal">
            <p class="tctc_share_modal_title">你的成績卡</p>
            <div class="tctc_share_loading">圖片產生中...</div>
        </div>
    `
    document.body.appendChild(overlay)

    // 點遮罩背景關閉；用 event.target === overlay 判斷是不是「直接點在遮罩上」，
    // 這樣點卡片本體（modal 內部）不會被誤判成要關閉，玩家想仔細看圖也不怕手滑點掉
    overlay.addEventListener("click", function(event){
        if(event.target === overlay) overlay.remove()
    })

    let data_url
    try {
        data_url = await Generate_Result_Share_Card(options)
    } catch(error){
        // Canvas 繪製失敗（極少見，例如某些瀏覽器安全性設定擋掉 toDataURL）就顯示錯誤訊息，
        // 不要讓整個網站因為分享功能出錯而卡住
        console.log("[share_card] 產生成績卡失敗", error)
        overlay.querySelector(".tctc_share_modal").innerHTML = `
            <p class="tctc_share_modal_title">圖片產生失敗，請稍後再試一次</p>
            <div class="tctc_share_modal_actions">
                <button class="tctc_share_btn tctc_share_btn_close" type="button">關閉</button>
            </div>
        `
        overlay.querySelector(".tctc_share_btn_close").addEventListener("click", function(){
            overlay.remove()
        })
        return
    }

    // ---- 圖片產生完成，換成「預覽圖 + 下載按鈕」----
    overlay.querySelector(".tctc_share_modal").innerHTML = `
        <p class="tctc_share_modal_title">你的成績卡</p>
        <img src="${data_url}" alt="TCTC 打字成績卡">
        <div class="tctc_share_modal_actions">
            <a class="tctc_share_btn tctc_share_btn_download" href="${data_url}" download="tctc_result.png">下載圖片</a>
            <button class="tctc_share_btn tctc_share_btn_close" type="button">關閉</button>
        </div>
    `
    overlay.querySelector(".tctc_share_btn_close").addEventListener("click", function(){
        overlay.remove()
    })
}