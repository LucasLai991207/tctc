// ============================================================
// TCTC2-0-domain_redirect.js
// ------------------------------------------------------------
// 把「舊網址」（GitHub Pages：lucaslai991207.github.io/tctc/...）的訪客
// 自動轉去「正式網址」（Cloudflare Pages：tctc-typing.pages.dev），
// 同一支檔案轉去同一支檔案（例如 game.html → game.html），不是全部轉去首頁。
//
// 只有在網址真的是舊的 github.io 才會動作（下面第一行就會直接 return），
// 所以這支檔案可以放心「每一頁」都載入同一份，不用為兩個網域各寫一份不同的版本。
// 之後如果哪天不想再導了，只要把每頁裡引用這支檔案的 <script> 那一行拿掉即可，
// 不用去改任何一支頁面本身的邏輯。
//
// 【重要】這支 <script> 標籤要放在每一頁 <head> 裡「越前面越好」（其他 script/css 之前），
// 才能在畫面還沒真的渲染出來、玩家還沒看到舊網址內容之前就先跳轉走，
// 不然會先閃一下舊網址的畫面才跳走，體驗比較差、也比較容易被使用者發現在做轉址。
// ============================================================
(function () {
    var OLD_HOST = "lucaslai991207.github.io"
    var NEW_ORIGIN = "https://tctc-typing.pages.dev"

    if (location.hostname !== OLD_HOST) return   // 不是舊網址，什麼都不做，正式網址載入這支檔案完全無感

    // 舊網址的檔案放在 /tctc/ 這個子路徑底下（例如 /tctc/game.html），
    // 但新網址是放在網域根目錄（例如 /game.html），這裡把 /tctc/ 前綴拿掉再接上新網域。
    // 如果以後子路徑名稱改了，只要改這一行的正則就好。
    var new_path = location.pathname.replace(/^\/tctc(\/|$)/, "/")

    var target = NEW_ORIGIN + new_path + location.search + location.hash

    // 用 replace()（而不是直接改 location.href）：
    // 不會在瀏覽器的「上一頁」歷史紀錄裡留下這個舊網址，
    // 玩家按上一頁不會又跳回這個轉址頁、卡在無限轉圈。
    location.replace(target)
})()
