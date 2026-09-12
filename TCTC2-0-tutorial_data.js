// TCTC2-0-tutorial_data.js — 教學關卡「拆頁」內容資料
// 只放內容（每一關拆成好幾個畫面），不放任何顯示邏輯——
// 畫面切換、上一頁/下一頁按鈕、互動練習卡關全部由 TCTC2-0-tutorial_engine.js 負責。
// 這支檔案要在 tutorial_engine.js 之前載入。
//
// 每個 stage 的資料格式：
// TUTORIAL_DATA["1-0-1"] = {
//     count_stage_completion: false, // 是否要呼叫 increase_stage_count()（跟原本每個 stage.id 的行為保持一致，不要自作主張改掉）
//     screens: [
//         { html: "..." },                                   // 純文字/圖片畫面，不卡關
//         { html: "...", interactive: {...} }                 // 有互動練習的畫面，練習完成才會出現下一頁按鈕
//     ]
// }
// 【修改】教學關結束（最後一頁）不再自動接到下一關的教學內容——最後一頁固定只顯示「返回大廳」，
// 所以這裡不再需要 next_stage_id / final_label 這兩個欄位，全部拿掉。
//
// interactive 欄位格式：
//   { type: "inline_key_practice", container_id: "xxx", keys: [...], title: "..." }
//   { type: "ime_sim",             container_id: "xxx" }
//   { type: "finger_quiz",         container_id: "xxx", num_rounds: 5 }   // 這個現有函式本來就沒有完成回呼，跟過去行為一致：不卡關

const TUTORIAL_DATA = {

    // ============================================================
    // 1-0-1：認識鍵盤佈局（基準鍵 Home Row）
    // ============================================================
    "1-0-1": {
        count_stage_completion: false,   // 【沿用舊行為】1-0-1 原本就沒有呼叫 increase_stage_count，只同步 Firebase 完成紀錄
        screens: [
            {
                html: `
                    <p style="font-size: 1.4rem; color: var(--champagne-gold); text-align: center; margin-bottom: 1.5rem; font-weight: 500;">
                        開始打字的第一步：摸到那條「線」
                    </p>

                    <p style="margin-bottom: 1.2rem; color: #ffffff;font-weight: 300;">
                        所有打字高手在打字時，眼睛是不看鍵盤的。他們之所以不會按錯，是因為雙手食指隨時都靠在<b style="font-weight: 400;color: var(--champagne-gold)">「基準鍵（Home Row）」</b>上。
                    </p>

                    <div style="background-color: var(--light-blue); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem;">
                        <b style="color: var(--champagne-gold);line-height: 2rem">請現在跟著做：</b><br>
                        1. 將左手食指放在鍵盤的 <b style=" color: var(--champagne-gold);font-size: 1.1rem">F</b> 鍵上（注音 <b style=" color: var(--champagne-gold);font-size: 1.1rem">ㄑ</b>）<br>
                        2. 將右手食指放在鍵盤的 <b style=" color: var(--champagne-gold);font-size: 1.1rem">J</b> 鍵上（注音 <b style=" color: var(--champagne-gold);font-size: 1.1rem">ㄨ</b>）
                    </div>
                `
            },
            {
                html: `
                    <p style="color: var(--champagne-gold); font-size: 1.2rem; text-align: center; margin-top: 0.5rem; margin-bottom: 0.8rem;font-weight: 500">
                        請依照畫面指示，依序按下 F 鍵、再按下 J 鍵（請切換到英文輸入法）
                    </p>
                    <div id="tut101_practice"></div>
                `,
                interactive: {
                    type: "inline_key_practice",
                    container_id: "tut101_practice",
                    keys: ["ㄑ", "ㄨ"],
                    title: "基準鍵練習",
                    done_text: "太棒了！雙手已經找到基準鍵的位置了 🎉"
                }
            },
            {
                html: `
                    <p style="margin-bottom: 1.2rem; line-height: 1.8rem;font-weight: 500;">
                        💡 <b font-size: large;margin-bottom: 1rem>摸到了嗎？</b> <br>
                        這兩個按鍵上有一個<b style="font-weight: 500;color: var(--champagne-gold)">凸起的小橫線</b>。這條橫線就是盲打的基礎。不論你的手指移到多遠去按別的字，按完後，兩隻食指都必須立刻<b>「彈回」</b>這兩個定位點。
                    </p>
                `
            }
        ]
    },

    // ============================================================
    // 1-0-2：認識繁體中文鍵盤（大千式排列）
    // ============================================================
    "1-0-2": {
        count_stage_completion: false,   // 【沿用舊行為】1-0-2 原本也沒有呼叫 increase_stage_count
        screens: [
            {
                html: `
                    <p style="font-size: 1.4rem; color: var(--champagne-gold); text-align: center; margin-bottom: 1.5rem; font-weight: 500;">
                        探索鍵盤：什麼是「大千式排列」？
                    </p>

                    <p style="margin-bottom: 1.2rem; color: #ffffff; font-weight: 250; line-height: 1.8rem;">
                        大千式排列是由大千公司設計、後來成為台灣國家標準（CNS 2690）的注音輸入法鍵盤排列方式。<br>市面上99%的鍵盤佈局都為此種形式，掌握他的排列規則，能有效提升打字速度。
                    </p>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.8rem;font-weight: 400;">
                        <b style="color: var(--champagne-gold); font-size: 1.1rem;line-height:2rem">．三大排列隱藏規則：</b><br>
                        <span style="color: var(--champagne-gold);font-size: 1rem;font-weight: 500;">1. 聲母由上往下排：</span> 鍵盤最左邊那一縱列，<b>1➔Q➔A➔Z</b>，剛好對應 <b style="font-size: 1rem;">ㄅㄆㄇㄈ</b>接著往右看第二列 <b>&nbsp &nbsp &nbsp2➔W➔S➔X</b>，就是 <b style="font-size: 1rem;">ㄉㄊㄋㄌ</b>。它是「由上往下、再由左往右」整齊排列的。<br>
                        <button class="tut_demo_btn" style="margin-left:0.5rem; font-size:0.8rem; padding:0.2rem 0.6rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;margin-top:0.6rem;" onclick="Highlight_Keys_Temporarily(['1','q','a','z','2','w','s','x'], true)">👆 在鍵盤上示範</button>
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.8rem;font-weight: 400;">
                        <span style="color: var(--champagne-gold);font-size: 1rem;font-weight: 500;">2. 韻母藏在右手邊：</span> 介音（ㄧㄨㄩ）和韻母（ㄚㄛㄜㄝ...）幾乎全部集中在鍵盤的<b>右手邊</b>。<br>
                        <button class="tut_demo_btn" style="margin-left:0.5rem; font-size:0.8rem; padding:0.2rem 0.6rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;margin-top:0.6rem;" onclick="Highlight_Keys_Temporarily(['u','i','o','p','j','k','l',';','m',',','.','/'], false)">👆 在鍵盤上示範</button>
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.8rem;font-weight: 400;">
                        <span style="color: var(--champagne-gold);font-size: 1rem;font-weight: 500;">3. 聲調在鍵盤上排：</span> 輕聲、二聲、三聲、四聲（˙ ˊ ˇ ˋ）整齊地排在數字鍵 7、6、3、4。
                        <button class="tut_demo_btn" style="margin-left:0.5rem; font-size:0.8rem; padding:0.2rem 0.6rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;margin-top:0.6rem;" onclick="Highlight_Keys_Temporarily(['7','6','3','4'], false)">👆 在鍵盤上示範</button>
                    </div>
                `
            },
            {
                html: `
                    <p style="margin-bottom: 1.2rem; line-height: 1.8rem;font-weight: 400;">
                        💡 <b style="color: var(--champagne-gold);font-size: 1rem;">為什麼要這樣設計？</b> <br>
                        因為打一個完整的中文字，順序一定是<b>「聲母 ➔ 介音 ➔ 韻母 ➔ 聲調」</b>。這種排列讓你的雙手在打字時，自然會形成<b>「左右交替」</b>的流暢節奏，打起來速度最快、最省力。
                    </p>

                    <p style="color: gray; font-size: 1.4rem; text-align: center; margin-top: 2rem;font-weight: 400;">
                        初步理解大千式鍵盤後，我們要準備正式敲下第一個字了！
                    </p>
                    <br>
                `
            }
        ]
    },

    // ============================================================
    // 1-0-3：打字指法（十指守備範圍）
    // ============================================================
    "1-0-3": {
        count_stage_completion: true,   // 【沿用舊行為】1-0-3 原本就有呼叫 increase_stage_count（整個 1-0 系列基本介紹只在這關累計一次）
        screens: [
            {
                html: `
                    <p style="font-size: 1.4rem; color: var(--champagne-gold); text-align: center; margin-bottom: 1.5rem; font-weight: 500;">
                        鍵盤指法：十指的「守備範圍」
                    </p>

                    <p style="margin-bottom: 1.2rem; color: #ffffff; font-weight: 300; line-height: 1.8rem;">
                        想提升打字速度，<b>「各司其職」</b>至關重要。鍵盤上的按鍵不是垂直的，而是向左傾斜。每隻手指都有自己專屬管轄的「傾斜縱列」！
                    </p>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.8rem;">
                        <b style="color: var(--champagne-gold); font-size: 1.1rem;">雙手手指正確分工（左手）：</b> <br>
                        <span style="color: var(--champagne-gold); font-size: 1rem;">左手四指（由外往內）：</span> <br>
                         • 小指專管：<b style="font-size: 1.2rem">ㄅ ㄆ ㄇ ㄈ</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['1','q','a','z'], false)">👆 示範</button><br>
                         • 無名指管：<b style="font-size: 1.2rem">ㄉ ㄊ ㄋ</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['2','w','s'], false)">👆 示範</button><br>
                         • 中指專管：<b style="font-size: 1.2rem"> ˇ ㄍ ㄎ ㄌ</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['3','e','d','x'], false)">👆 示範</button><br>
                         • 食指管轄：<b style="font-size: 1.2rem">4 ㄐ ㄑ ㄏ 5 ㄔ ㄕ ㄒ 6</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['4','r','f','c','5','t','g','v','6'], false)">👆 示範</button>
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.8rem;">
                        <b style="color: var(--champagne-gold); font-size: 1.1rem;">雙手手指正確分工（右手＋拇指）：</b> <br>
                        <span style="color: var(--champagne-gold); font-size: 1rem;">右手四指（由內往外）：</span> <br>
                         • 食指管轄：<b style="font-size: 1.2rem">7 ㄗ ㄘ ㄖ ˙ ㄧ ㄨ ㄙ ㄩ</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['7','y','h','b','u','j','n','m'], false)">👆 示範</button><br>
                         • 中指專管：<b style="font-size: 1.2rem">ㄚ ㄛ ㄜ ㄝ</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['8','i','k',','], false)">👆 示範</button><br>
                         • 無名指管：<b style="font-size: 1.2rem">ㄞ ㄟ ㄠ ㄡ 0</b>
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['9','o','l','.','0'], false)">👆 示範</button><br>
                         • 小指專管：<b style="font-size: 1.2rem">ㄦ ㄣ ㄤ ㄥ</b> 以及右側所有標點符號與功能鍵。
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily(['-','p',';','/','[',']','\\\\','Backspace'], false)">👆 示範</button><br>
                        <span style="color: var(--champagne-gold); font-size: 1rem;">大拇指：</span> 雙手大拇指只專職負責敲擊<b>空白鍵</b>。
                         <button class="tut_demo_btn" style="margin-left:0.4rem; font-size:0.75rem; padding:0.15rem 0.5rem; background:transparent; border:1px solid var(--champagne-gold); color:var(--champagne-gold); border-radius:4px; cursor:pointer;" onclick="Highlight_Keys_Temporarily([' '], false)">👆 示範</button>
                    </div>
                `
            },
            {
                html: `
                    <p style="margin-bottom: 1.2rem; line-height: 1.8rem;">
                        💡 <b>盲打的核心心法：</b> <br>
                        當某一隻手指移開基準鍵去按別的字時，<b>其他手指要盡量留在原位</b>，按完的那隻手指要立刻「彈回」定位點（F 和 J）。只要保持這個節奏，打字速度就會開始暴增！
                    </p>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem;">
                        <b style="color: var(--champagne-gold);">小測驗：考考你的手指分工</b><br>
                        <p style="margin:0.5rem 0; color:#ccc; font-size:0.85rem;">畫面會隨機出一個注音符號，想好該用哪根手指後，直接在鍵盤上按下對應的鍵就好！</p>
                        <div id="tut103_quiz"></div>
                    </div>

                    <p style="color: gray; font-size: 1.5rem; text-align: center; margin-top: 2rem;">
                        切記，正確率大於速度!！永遠記住這點 然後開始你的打字旅程吧~
                    </p>
                `,
                // 【沿用舊行為】手指小測驗（Start_Finger_Quiz）本來就沒有完成回呼，這頁不卡關，
                // 測完測不完都能直接翻頁——跟過去這關的行為完全一致，不是這次改版順便加嚴。
                interactive: {
                    type: "finger_quiz",
                    container_id: "tut103_quiz",
                    num_rounds: 5
                }
            }
        ]
    },

    // ============================================================
    // 1-8-1：注音輸入選字教學
    // ============================================================
    "1-8-1": {
        // 【曾經修正過】這裡原本有個 next_stage_id 欄位，且誤連到 1-9-2（跟 2-1-0 那顆共用同一段複製貼上的程式碼）；
        // 現在最後一頁固定只顯示「返回大廳」，不再需要導去下一關，欄位已整個拿掉。
        count_stage_completion: true,   // 【沿用舊行為】1-8-1 原本就有呼叫 increase_stage_count
        screens: [
            {
                html: `
                    <p style="font-size: 1.4rem; color: var(--champagne-gold); text-align: center; margin-bottom: 1.5rem; font-weight: 500;">
                        注音「選字」流暢度教學：手不離鍵盤的關鍵訣竅
                    </p>

                    <p style="margin-bottom: 1.2rem; color: #ffffff; font-weight: 100; line-height: 1.8rem;">
                        打注音要快，核心原則就是：「絕對不要用滑鼠去點選字視窗」。以下是從選字、改字到記憶字詞的必學操作。
                    </p>
                `
            },
            {
                html: `
                    <div style="background-color: var(--dark-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight:300">
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight:400">1.快速叫出選字視窗：</span> <br>
                        <b> 當你打完一串注音，發現系統自動選的字是錯的：</b><br>
                            • 微軟注音 (Windows)：按 ↓ (方向鍵下) 或者是 Space (空白鍵)，就會直接彈出選字清單。<br>
                            • Mac 內建注音：按 Space (空白鍵)，就會彈出選字清單。
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--dark-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight:300">
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight:400">2.新手地雷－滑鼠挑字：</span> <br>
                        <b> 選字清單有很多頁、很多字時，請用以下鍵盤按鍵來選：</b><br>
                            • 看下一頁 / 上一頁：按 Page Down / Page Up，或是按 ↓ / ↑ 一行一行找。<br>
                            • 直接按數字選字：選字清單的字旁邊都有編號，直接按鍵盤最上方的數字鍵，就會自動填入。
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--dark-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight:300">
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight:400">3.其中一個字選錯了怎麼改：</span> <br>
                        <b> 很多人打了一長串字，發現中間有一個字錯了，就全部刪掉重打，這樣超慢..</b><br>
                        <p>正確做法：<br>
                            • 先不要按 Enter，字底下還有虛線時。<br>
                            • 用 ← 或 → (左右方向鍵)，把游標移動到那個錯字後面。<br>
                            • 按 ↓ (方向鍵下) 叫出該字的選字窗。<br>
                            • 按數字鍵選對的字，修正完後，再把游標移到最後面繼續打。
                        </p>
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--dark-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight:300">
                        <span style="color: var(--champagne-gold); font-size: 1rem;">4.一定要照注音順序打嗎(重要！！)：</span> <br>
                        <b> 傳統打「強」字（ㄑㄧㄤˊ），手指必須強制順序：左手按 ㄑ ➔ 右手按 ㄧ ➔ 右手按 ㄤˊ</b><br>
                        <p>偷吃步做法：<br>
                            • 你可以兩隻手同時一起按下去。即使你先按了 ㄤ，再按 ㄧ，最後才按 ㄑ（鍵盤仍會顯示ㄑㄧㄤ），只要你在這三個符號後面直接按二聲，輸入法會自動在後台「重新排列組合」，自動選出「強」這個字。
                        </p>
                    </div>
                `
            },
            {
                // 【修正】原本這頁呼叫 Start_IME_Selection_Sim(document.getElementById("tut191_sim"), ...)，
                // 但整個 innerHTML 裡根本沒有 id="tut191_sim" 的容器，等於一定拿到 null，
                // 模擬練習從沒真正開始過，玩家永遠等不到那顆被藏起來的「進入輸入練習」按鈕，這一關其實是卡死的。
                // 這次拆頁順便把容器補上，讓模擬練習真的能跑起來。
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem;">
                        <b style="color: var(--champagne-gold);"></b><br>
                        <div id="tut191_sim"></div>
                    </div>
                `,
                interactive: {
                    type: "ime_sim",
                    container_id: "tut191_sim",
                    done_text: "熟悉整套流程了嗎？以後手不用離開鍵盤，選字改字都能一氣呵成 🎉"
                }
            }
        ]
    },

    // ============================================================
    // 2-1-0：鍵位教學－標點符號
    // ============================================================
    "2-1-0": {
        // 【曾經修正過】這裡原本有個 next_stage_id 欄位，且誤連到 1-9-2（跟 1-8-1 那顆共用同一段複製貼上的程式碼）；
        // 現在最後一頁固定只顯示「返回大廳」，不再需要導去下一關，欄位已整個拿掉。
        count_stage_completion: true,   // 【沿用舊行為】2-1-0 原本就有呼叫 increase_stage_count
        screens: [
            {
                html: `
                    <p style="font-size: 1.4rem; color: var(--champagne-gold); text-align: center; margin-bottom: 1.5rem; font-weight: 500;">
                        標點符號輸入教學（重要‼️）
                    </p>

                    <p style="margin-bottom: 1.2rem; color: #ffffff; font-weight: 300; line-height: 1.8rem;">
                        如果你是Windows用戶，那麼你一定有遇過「」打不出來 然後要上網查的困擾，以下是常用字符的教學，這些用法在以後的模式也常會用到 請務必詳讀：<br>
                        (以下教學皆為全形符號)
                    </p>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight: 500;">
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">引號「」</span> <br>
                                • Windows ：Ctrl + [ + ↓選擇 ，就會直接彈出選字清單。(持續按住ctrl 點一下 [ 之後使用方向鍵調整至需要的符號)<br>
                                • Mac ：直接按下鍵盤右上角的符號即可打出<br><br>

                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">頓號、</span> <br>
                                •  Windows ：Ctrl + '（'為上引號，在Enter鍵左邊）。<br>
                                •  Mac ：直接按下鍵盤右上角的符號即可打出
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight: 500;">
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">冒號：</span> <br>
                                •  Windows ：Ctrl + shift + ; （;為注音ㄤ的按鍵）<br>
                                •  Mac ：shift + ;<br><br>

                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">問號？</span> <br>
                                •  Windows ：Ctrl + shift + / （/為注音ㄥ的按鍵）<br>
                                •  Mac ：shift + /
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem; line-height: 1.9rem;font-weight: 500;">
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">驚嘆號！</span> <br>
                                •  Windows ：Ctrl + shift + 1 （1為注音ㄅ的按鍵）<br>
                                •  Mac ：shift + 1<br><br>
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">逗號，</span> <br>
                                •  Windows ：Ctrl + ,（,為注音ㄝ的按鍵）<br>
                                •  Mac ：shift + ,<br><br>
                        <span style="color: var(--champagne-gold); font-size: 1rem;font-weight: 400;">句號。</span> <br>
                                •  Windows ：Ctrl + . （.為注音ㄡ的按鍵）<br>
                                •  Mac ：shift + .
                    </div>
                `
            },
            {
                html: `
                    <div style="background-color: var(--light-blue); padding: 1.2rem; border-radius: 8px; border-left: 4px solid var(--champagne-gold); margin-bottom: 1.5rem;font-weight: 500;">
                        <b style="color: var(--champagne-gold);">⌨️ 實際打打看：標點符號互動練習</b><br>
                        <p style="margin:0.5rem 0; color:#ccc; font-size:0.85rem;">依序出現「」、、：？！，。這幾個標點，跟著鍵盤上的金框提示，實際按一次組合鍵。</p>
                        <div id="tut210_practice"></div>
                    </div>
                `,
                interactive: {
                    type: "inline_key_practice",
                    container_id: "tut210_practice",
                    keys: ["「", "」", "、", "：", "？", "！", "，", "。"],
                    title: "標點符號練習",
                    done_text: "太棒了！這些標點符號的組合鍵你都打過一次了 🎉"
                }
            }
        ]
    }
}