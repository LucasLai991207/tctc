(function () {
    var OLD_HOST = "lucaslai991207.github.io"
    var NEW_ORIGIN = "https://tctc-typing.pages.dev"

    if (location.hostname !== OLD_HOST) return

    var new_path = location.pathname.replace(/^\/tctc(\/|$)/, "/")

    var target = NEW_ORIGIN + new_path + location.search + location.hash

    location.replace(target)
})()