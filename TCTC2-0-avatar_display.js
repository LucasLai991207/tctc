(function () {
    const AVATAR_STORAGE_KEY = "tctc2.0-profile_avatar"

    function Apply_Avatar_To_Container(container) {
        const data_url = localStorage.getItem(AVATAR_STORAGE_KEY)
        if (!data_url) return

        const default_head = container.querySelector(".avatar_default_head")
        const default_body = container.querySelector(".avatar_default_body")
        if (default_head) default_head.style.display = "none"
        if (default_body) default_body.style.display = "none"

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