function Show_Feedback_Toast(message, is_error) {
    const toastEl = document.getElementById("feedback_toast")
    if (!toastEl) return

    toastEl.textContent = message
    toastEl.classList.toggle("profile_toast_error", !!is_error)
    toastEl.classList.add("profile_toast_show")

    clearTimeout(toastEl._hide_timer)
    toastEl._hide_timer = setTimeout(function () {
        toastEl.classList.remove("profile_toast_show")
    }, 3200)
}

function Submit_Feedback_Form() {
    const errorEl = document.getElementById("feedback_error")
    const submitBtn = document.getElementById("feedback_submit_btn")
    if (errorEl) errorEl.textContent = ""

    const category_input = document.querySelector('input[name="feedback_category"]:checked')
    const category = category_input ? category_input.value : "other"

    const title_raw = (document.getElementById("feedback_title") || {}).value || ""
    const content_raw = (document.getElementById("feedback_content") || {}).value || ""
    const contact_raw = (document.getElementById("feedback_contact") || {}).value || ""

    const trimmed_content = content_raw.trim()
    if (!trimmed_content) {
        if (errorEl) errorEl.textContent = "詳細內容不能空白"
        return
    }
    if (trimmed_content.length > 1000) {
        if (errorEl) errorEl.textContent = "內容太長了，請控制在 1000 字以內"
        return
    }

    if (typeof Submit_Site_Feedback !== "function") {
        if (errorEl) errorEl.textContent = "系統暫時無法送出，請重新整理頁面再試一次"
        return
    }

    if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.textContent = "送出中..."
    }

    Submit_Site_Feedback(
        category,
        title_raw.trim().slice(0, 50),
        trimmed_content,
        contact_raw.trim().slice(0, 100),
        function (success, reason) {
            if (submitBtn) {
                submitBtn.disabled = false
                submitBtn.textContent = "送出"
            }

            if (!success) {
                if (errorEl) errorEl.textContent = reason || "送出失敗，請稍後再試一次"
                return
            }

            Show_Feedback_Toast("送出成功，謝謝你的回報！")

            const titleEl = document.getElementById("feedback_title")
            const contentEl = document.getElementById("feedback_content")
            const contactEl = document.getElementById("feedback_contact")
            if (titleEl) titleEl.value = ""
            if (contentEl) contentEl.value = ""
            if (contactEl) contactEl.value = ""
        }
    )
}