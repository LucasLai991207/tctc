(function () {

    //偵測是否為行動裝置
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (!isMobile) return;

    const overlay = document.createElement("div");

    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        background-color: #0d1b2e;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        font-family: 'Noto Sans TC', sans-serif;

        text-align: center;
        padding: 2rem;
    `;

    overlay.innerHTML = `
        <div style="font-size: 8rem; margin-bottom: 1rem;">⌨️</div>
        <h1 style="font-size: 9rem; color: #c9a84c; margin-bottom: 0.75rem;">
        請使用非行動裝置開啟
        </h1>
        <p style="font-size: 1rem; color: #aaa; max-width: 300px; line-height: 1.6;">
        TCTC 需要實體鍵盤才能練習，目前不支援行動裝置。
        </p>
        <button id="skip-btn" style="
        margin-top: 2rem;
        padding: 0.6rem 1.4rem;

        background: transparent;

        border: 1px solid #555;
        color: #777;

        font-size: 8rem;

        border-radius: 3px;

        cursor: pointer;
        transition: border-color 0.2s, color 0.2s;
        ">
        我了解，仍要繼續
        </button>
    `;

    const append = () => {
        document.body.appendChild(overlay);

        const btn = document.getElementById("skip-btn");

        // hover 效果：用 JS 監聽 mouseenter / mouseleave 事件來模擬 CSS :hover
        // 原因：按鈕是 inline style 寫的，無法直接用 CSS :hover 選到它
        btn.addEventListener("mouseenter", function () {
        btn.style.borderColor = "#c9a84c"; 
        btn.style.color = "#c9a84c";       
        });

        btn.addEventListener("mouseleave", function () {
        btn.style.borderColor = "#555";    
        btn.style.color = "#777";          
        });

        // 點擊後把整個遮罩從 DOM 移除
        btn.addEventListener("click", function () {
        overlay.remove();
        });
    };

    document.body ? append() : document.addEventListener("DOMContentLoaded", append);

})();