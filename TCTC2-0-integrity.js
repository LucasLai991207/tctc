(function () {
    const SESSION_ID = (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : ("sess-" + Date.now() + "-" + Math.random().toString(36).slice(2))


    let total_keydown_count = 0
    let total_untrusted_count = 0

    let attempt_start_ts = null
    let attempt_start_keydown = 0
    let attempt_start_untrusted = 0

    document.addEventListener("keydown", function (event) {
        total_keydown_count++

        if (event.isTrusted === false) total_untrusted_count++
    }, true)

    window.TCTC_Integrity = {
        // 給任何想單獨拿這組 id 的地方用（例如未來想在別的地方也標記同一個 session）
        getSessionId: function () {
            return SESSION_ID
        },


        markAttemptStart: function () {
            attempt_start_ts = Date.now()
            attempt_start_keydown = total_keydown_count
            attempt_start_untrusted = total_untrusted_count
        },


        getAttemptSnapshot: function () {
            const since_keydown = attempt_start_ts !== null ? attempt_start_keydown : 0
            const since_untrusted = attempt_start_ts !== null ? attempt_start_untrusted : 0
            return {
                session_id: SESSION_ID,
                keydown_count: total_keydown_count - since_keydown,
                untrusted_key_events: total_untrusted_count - since_untrusted
            }
        }
    }
})()
