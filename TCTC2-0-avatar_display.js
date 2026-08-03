
(function () {
    const AVATAR_STORAGE_KEY = "tctc2.0-profile_avatar"

    // 把頭像套用到「單一個」大廳的頭像容器上
    // （之所以寫成可重複套用到多個容器，是因為同一個頁面理論上可能不只一個
    //   .profile_avatar_container，例如以後想在別的地方也顯示玩家頭像）
    function Apply_Avatar_To_Container(container) {
        const data_url = localStorage.getItem(AVATAR_STORAGE_KEY)
        if (!data_url) return // 玩家沒設定過頭像，保留原本的預設剪影就好，不用做任何事

        // 藏起預設剪影（不刪除，這樣以後如果要做「移除頭像後還原成剪影」之類的功能會比較好處理）
        const default_head = container.querySelector(".avatar_default_head")
        const default_body = container.querySelector(".avatar_default_body")
        if (default_head) default_head.style.display = "none"
        if (default_body) default_body.style.display = "none"

        // 用同一張 <img> 顯示頭像；如果容器裡已經有這張圖（避免重複呼叫時一直疊加新增），
        // 就直接更新 src，不要重複建立新的 <img> 節點
        let img = container.querySelector(".profile_avatar_container_img")
        if (!img) {
            img = document.createElement("img")
            img.className = "profile_avatar_container_img"
            img.alt = "玩家頭像"
            container.appendChild(img)
        }
        img.src = data_url
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll(".profile_avatar_container").forEach(Apply_Avatar_To_Container)
    })
})()
