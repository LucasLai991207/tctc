/* ============================================================
   TCTC2-0-theme.js
   全站配色系統
   ============================================================
   運作方式：
   1. 這支檔案要放在每個頁面 <head> 裡「CSS <link> 之後、其他 script 之前」，
      同步（不要加 defer/async）載入。它會在頁面畫面真正被瀏覽器繪製出來之前，
      把使用者上次選的主題套用到 <html> 的 inline style 上——inline style
      的優先權天生就比任何外部 CSS 檔案裡的 :root{...} 高，所以不用等
      main_lobby.css / profile.css 這些檔案載入完成，也不會有「先閃一下
      預設色再變成使用者選的顏色」的問題（FOUC）。
   2. 所有頁面的 CSS 檔案（main_lobby.css / profile.css / ranking.css /
      achievements.css）原本就已經把顏色寫成 var(--darker-blue) 這幾個
      變數，這支檔案只是「換掉這些變數實際的值」，不用改任何版面／CSS
      selector 的邏輯。
   3. --accent-rgb / --error-rgb 是給需要「半透明邊框/底色」的地方用的
      （例如 rgba(201,168,76,0.25) 這種寫法），CSS 那邊要寫成
      rgba(var(--accent-rgb), 0.25) 才吃得到主題色，純 var(--champagne-gold)
      這種不透明的地方不受影響。
   4. 【新增】--text-rgb 是給「文字顏色」用的，寫法跟 --accent-rgb 一樣要包
      rgba()：例如原本寫死的 color: whitesmoke 現在改成
      color: rgba(var(--text-rgb), 0.92)。深色主題（navy_gold 等五個）
      textRgb 是 "255, 255, 255"（白字），新增的 paper_ink（白/黑）主題
      textRgb 是 "20, 20, 20"（黑字）。之後如果又新增一個淺色主題，只要
      這裡的 textRgb 給對值，全站文字就會自動翻成正確的深/淺色，不用
      再回頭改任何一個 CSS 檔案。
   ============================================================ */

(function () {
    const STORAGE_KEY = "tctc2.0-theme"

    // ===== 主題定義表 =====
    // 每個主題都改「三層底色 + 主色（金/銀/銅）+ 警示色」，
    // 刻意保留跟原本網站一致的「深底 + 一個強調色」骨架，只換色相，
    // 不動任何版面，所以套用起來風險最低、也最快能看到效果。
    const THEMES = {
        navy_gold: {
            name: "藍 / 金",
            desc: "推薦",
            darker: "#0b1a37",
            dark:   "#0B1E36",
            light:  "#0e243e",
            accent: "#c9a84c",
            accentRgb: "201, 168, 76",
            error:  "#c0392b",
            errorRgb: "192, 57, 43",
            textRgb: "255, 255, 255"
        },
        ink_silver: {
            name: "黑 / 銀",
            desc: "",
            darker: "#1c1c1e",
            dark:   "#212127",
            light:  "#3f3f4b",
            accent: "#c9ced8",
            accentRgb: "201, 206, 216",
            error:  "#c0392b",
            errorRgb: "192, 57, 43",
            textRgb: "255, 255, 255"
        },
        rouge_gold: {
            name: "紅 / 金",
            desc: "",
            darker: "#210a0e",
            dark:   "#331116",
            light:  "#40171d",
            accent: "#d8b471",
            accentRgb: "216, 180, 113",
            error:  "#e2635f",
            errorRgb: "226, 99, 95",
            textRgb: "255, 255, 255"
        },
        jade_gold: {
            name: "綠 / 金",
            desc: "",
            darker: "#0b1e18",
            dark:   "#102a22",
            light:  "#15352b",
            accent: "#c9a84c",
            accentRgb: "201, 168, 76",
            error:  "#c0392b",
            errorRgb: "192, 57, 43",
            textRgb: "255, 255, 255"
        },
        sandal_copper: {
            name: "棕 / 紅",
            desc: "",
            darker: "#20160f",
            dark:   "#2e2015",
            light:  "#38271a",
            accent: "#c98a52",
            accentRgb: "201, 138, 82",
            error:  "#c0392b",
            errorRgb: "192, 57, 43",
            textRgb: "255, 255, 255"
        },
        paper_ink: {
            name: "白 / 米",
            desc: "",
            darker: "#f4f2ee",
            dark:   "#ffffff",
            light:  "#e9e6df",
            accent: "#a9832e",
            accentRgb: "169, 131, 46",
            error:  "#c0392b",
            errorRgb: "192, 57, 43",
            textRgb: "20, 20, 20"
        }
    }

    const DEFAULT_THEME_ID = "navy_gold"

    function Get_Saved_Theme_Id(){
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return (saved && THEMES[saved]) ? saved : DEFAULT_THEME_ID
        } catch(e){
            return DEFAULT_THEME_ID
        }
    }

    // 把指定主題的顏色寫進 <html> 的 inline style（優先權最高，蓋過任何
    // CSS 檔案裡的 :root 定義），套用到全站沿用的那五個 CSS 變數上
    function Apply_Theme(themeId){
        const theme = THEMES[themeId] || THEMES[DEFAULT_THEME_ID]
        const root = document.documentElement.style

        root.setProperty("--darker-blue", theme.darker)
        root.setProperty("--dark-blue", theme.dark)
        root.setProperty("--light-blue", theme.light)
        root.setProperty("--champagne-gold", theme.accent)
        root.setProperty("--accent-rgb", theme.accentRgb)
        root.setProperty("--error-red", theme.error)
        root.setProperty("--error-rgb", theme.errorRgb)
        root.setProperty("--text-rgb", theme.textRgb)
    }

    function Save_Theme(themeId){
        if(!THEMES[themeId]) return
        try {
            localStorage.setItem(STORAGE_KEY, themeId)
        } catch(e){ /* localStorage 不可用就放棄儲存，至少當次還是會套用 */ }
        Apply_Theme(themeId)
    }

    // 掛在 window 上，讓 profile.js 的主題選擇器可以讀清單、讀目前選的是哪個、切換主題
    window.TCTC_THEME = {
        THEMES: THEMES,
        DEFAULT_THEME_ID: DEFAULT_THEME_ID,
        getCurrent: Get_Saved_Theme_Id,
        apply: Apply_Theme,
        save: Save_Theme
    }

    // 立刻套用一次（腳本本身是同步載入，此時 <head> 通常還在解析中，
    // 這行跑完之後瀏覽器才會真的開始繪製畫面，所以不會有換色閃爍的問題）
    Apply_Theme(Get_Saved_Theme_Id())
})()