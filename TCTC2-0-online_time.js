/* ============================================================
   TCTC2-0-online_time.js
   全站共用的「在線時長」追蹤模組
   ============================================================
   定義：只要分頁在前景（沒有切到別的分頁/別的 App、沒有鎖螢幕），
   就算在線，不判斷滑鼠/鍵盤有沒有實際操作（這是跟 Lucas 確認過的簡化版定義）。

   這支檔案要載入在「每一個頁面」，包括沒有 Firebase 的頁面（例如
   main.html、profile.html），這樣才能真正算到「玩家在整個網站上」的時間，
   而不是只有game.html / TCTC2-0-challenge.html 這種有計時器的頁面。

   運作分工：
   1. 這支檔案只負責「本機累加」，把前景秒數存進 localStorage 的暫存區
      （tctc2.0-pending_online_seconds），不需要網路、不會遺失。
   2. 真正把這些秒數「同步上雲端排行榜」的動作，寫在 TCTC2-0-firebase.js
      的 Sync_Pending_Online_Time() 函式裡，只有在「這個頁面剛好也載入了
      Firebase」時才會被呼叫（目前是 game.html / TCTC2-0-challenge.html /
      TCTC2-0-ranking.html）。如果玩家全程只逛 main.html、profile.html
      這種沒有 Firebase 的頁面，這段時間一樣會被記錄在本機暫存區，
      只是要等到下次造訪上面那三個頁面之一時，才會被「補交」上雲端——
      秒數不會不見，只是上傳的時機會延後。

   注意：PENDING_KEY 這個 localStorage key 名稱，要跟
   TCTC2-0-firebase.js 裡 Sync_Pending_Online_Time() 用的字串完全一致，
   不然兩邊會各自讀寫不同的暫存區，秒數永遠同步不到雲端。
   ============================================================ */

(function () {
    const PENDING_KEY = "tctc2.0-pending_online_seconds"

    // ===== 【新增】網站瀏覽次數：本機暫存 =====
    // PENDING_VIEWS_KEY 這個字串要跟 TCTC2-0-firebase.js 的
    // Sync_Pending_Page_Views() 裡用的完全一致，不然兩邊各自讀寫不同的
    // localStorage key，次數永遠同步不到雲端。
    //
    // 這一段刻意寫在 IIFE 最外層、不包在任何事件監聽器裡——因為這支檔案
    // 本身就是「每個頁面載入時被瀏覽器執行一次」的 script，IIFE 主體本來就只會
    // 在頁面載入的當下跑一次，剛好對應「刷新頁面或換頁都算一次」這個需求，
    // 不需要額外綁 load 或 DOMContentLoaded 事件才能觸發。
    const PENDING_VIEWS_KEY = "tctc2.0-pending_page_views"
    const prev_pending_views = Number(localStorage.getItem(PENDING_VIEWS_KEY)) || 0
    localStorage.setItem(PENDING_VIEWS_KEY, prev_pending_views + 1)

    // 目前這一段「前景累計」的起點時間戳記。
    // 如果分頁「一載入就是前景」（絕大多數情況），立刻開始計時；
    // 如果分頁是在背景被載入的（例如瀏覽器分頁預先載入機制），
    // document.hidden 會是 true，先不計時，等真的切到前景再開始。
    let segment_start = document.hidden ? null : Date.now()

    // 把「目前這一段前景時間」結算進本機暫存區，並把起點歸零，
    // 代表這一段已經處理過，避免下次又被重複加總一次。
    function Flush_Foreground_Segment() {
        if (segment_start === null) return

        const elapsed_seconds = (Date.now() - segment_start) / 1000
        segment_start = null

        if (elapsed_seconds <= 0) return

        const prev_pending = Number(localStorage.getItem(PENDING_KEY)) || 0
        localStorage.setItem(PENDING_KEY, prev_pending + elapsed_seconds)
    }

    // visibilitychange：分頁「從前景切到背景」或「從背景切回前景」都會觸發這個事件，
    // 這是瀏覽器原生提供、最可靠判斷「使用者看不看得到這個分頁」的方式。
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            // 切到背景了：結算剛剛累積的前景時間，暫停計時
            Flush_Foreground_Segment()
        } else {
            // 切回前景了：重新起算下一段
            segment_start = Date.now()
        }
    })

    // pagehide 在「關分頁、導覽到別的網址、手機切到別的 App」時都會可靠觸發，
    // 而且行動裝置上的支援度比 beforeunload 好很多，所以用它來做「最後一次結算」，
    // 避免玩家直接關掉分頁，導致最後那一小段時間沒被記錄到。
    window.addEventListener("pagehide", Flush_Foreground_Segment)

    // ===== 【新增】定期自動同步 =====
    // 前面 visibilitychange / pagehide 只在「切走分頁」或「關閉分頁」時才會結算，
    // 如果玩家就是開著同一頁掛機、既不切走也不重新整理，不管等多久都不會反映在排行榜上——
    // 這對「測試/確認功能有沒有作用」來說非常不直覺，所以額外加一個定時器：
    // 每隔一段時間，只要分頁還在前景，就主動把「目前這一段」切一小段存進本機暫存區，
    // 並立刻重新起算下一段（不會漏秒、也不會重複計算）。
    const AUTO_FLUSH_INTERVAL_MS = 20000 // 20 秒。太短會讓 localStorage 寫入太頻繁，太長則掛機時等待感明顯
    setInterval(function () {
        if (document.hidden) return

        Flush_Foreground_Segment()
        segment_start = Date.now() // 立刻重新起算下一段，維持「持續在前景」的計時不中斷

        // 如果這個頁面剛好也載入了 Firebase，順便嘗試把暫存區同步上雲端，
        // 這樣掛機掛在 game.html / TCTC2-0-ranking.html 這種頁面上，
        // 排行榜的數字也會每 20 秒左右自動更新一次，不用特地重新整理
        if (typeof Sync_Pending_Online_Time === "function") {
            Sync_Pending_Online_Time()
        }
        // 【新增】瀏覽次數同理，但這裡通常不會有新東西可同步——
        // 因為瀏覽次數是「進頁面那一刻」就記一次，不像在線時長會隨時間持續累積，
        // 留著呼叫只是為了「補交」極端情況：例如玩家連上這個頁面時網路剛好不通、
        // 補交失敗過，掛機期間網路恢復了，靠這個定時器補打一次。
        if (typeof Sync_Pending_Page_Views === "function") {
            Sync_Pending_Page_Views()
        }
    }, AUTO_FLUSH_INTERVAL_MS)

    // 頁面載入時，如果這個頁面剛好也載入了 Firebase
    // （也就是全域有定義 Sync_Pending_Online_Time 這個函式），
    // 就順便把本機暫存的秒數「補交」上雲端。
    document.addEventListener("DOMContentLoaded", function () {
        if (typeof Sync_Pending_Online_Time === "function") {
            Sync_Pending_Online_Time()
        }
        // 【新增】瀏覽次數同理：這個頁面如果有載入 Firebase，
        // 就把本機暫存（含這次載入 + 之前逛過沒 Firebase 的頁面留下的欠款）一次補交
        if (typeof Sync_Pending_Page_Views === "function") {
            Sync_Pending_Page_Views()
        }
    })
})()